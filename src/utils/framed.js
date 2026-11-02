const PROBE_BYTES = 8 * 1024 * 1024
const FAST_LINK_BYTES_PER_SECOND = 96 * 1000 * 1000

// Reject oversized windows and excessive blocks before invoking the WASM
// decoder. These archives contain one bounded, content-sized zstd frame.
// Format: https://github.com/facebook/zstd/blob/dev/doc/zstd_compression_format.md
export function validateZstdFrame(input, expected) {
  let offset = 0
  const read = (size) => {
    if (offset + size > input.length) throw new Error('Truncated zstd frame')
    let value = 0n
    for (let i = 0; i < size; i++) value |= BigInt(input[offset++]) << BigInt(i * 8)
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Oversized zstd frame')
    return Number(value)
  }
  if (read(4) !== 0xfd2fb528) throw new Error('Invalid zstd frame magic')
  const flags = read(1), single = !!(flags & 32), sizeFlag = flags >> 6
  if (flags & 8) throw new Error('Reserved zstd frame flag')
  let window
  if (!single) {
    const descriptor = read(1), base = 2 ** (10 + (descriptor >> 3))
    window = base + base / 8 * (descriptor & 7)
  }
  const dictionary = read([0, 1, 2, 4][flags & 3])
  if (dictionary) throw new Error('Zstd dictionaries are not supported')
  const sizeBytes = sizeFlag ? 2 ** sizeFlag : Number(single)
  if (!sizeBytes) throw new Error('Zstd frame content size is required')
  const size = read(sizeBytes) + (sizeBytes === 2 ? 256 : 0)
  window ??= size
  if (size !== expected || size > 4 * 1024 * 1024 || window > 4 * 1024 * 1024) throw new Error('Zstd frame size mismatch')
  const blockLimit = Math.min(window, 128 * 1024)
  const ends = []
  let last = false
  while (!last) {
    const header = read(3), type = (header >> 1) & 3, length = header >> 3
    last = !!(header & 1)
    if (type === 3 || length > blockLimit || ends.length >= 16384) throw new Error('Invalid zstd block')
    offset += type === 1 ? 1 : length
    if (offset > input.length) throw new Error('Truncated zstd block')
    ends.push(offset)
  }
  if (flags & 4) offset += 4
  if (offset !== input.length) throw new Error('Zstd frame length mismatch')
  ends[ends.length - 1] = offset
  return ends
}

export function decodeZstdFrame(decoder, input, size) {
  const ends = validateZstdFrame(input, size)
  // The library's one-shot path has a fixed output buffer; its larger-input
  // fallback does not. Feed that fallback one bounded zstd block at a time.
  if (input.length <= 2 * 1024 * 1024) return decoder.decompressSync(input, size)
  const output = new Uint8Array(size)
  let start = 0, written = 0
  for (const end of ends) {
    const { buf, in_offset } = decoder.decompressStream(input.subarray(start, end), start === 0)
    if (in_offset !== end - start || written + buf.length > size) throw new Error('Decoded frame size mismatch')
    output.set(buf, written)
    written += buf.length
    start = end
  }
  if (written !== size) throw new Error('Decoded frame size mismatch')
  return output
}

export function validateFrames(image) {
  if (!image.frameSizes && !image.framedArchiveUrl && !image.framedArchiveSize) return false
  if (!Number.isSafeInteger(image.fileSize) || image.fileSize <= 0 ||
      !Number.isSafeInteger(image.chunkSize) || image.chunkSize <= 0 || image.chunkSize > 4 * 1024 * 1024 ||
      !Array.isArray(image.frameSizes) || image.frameSizes.length !== Math.ceil(image.fileSize / image.chunkSize) ||
      image.frameSizes.length !== image.chunkHashes?.length ||
      typeof image.framedArchiveUrl !== 'string' || !image.framedArchiveUrl ||
      !Number.isSafeInteger(image.framedArchiveSize) || image.framedArchiveSize <= 0) {
    throw new Error('Invalid framed archive metadata')
  }
  let size = 0
  for (const frame of image.frameSizes) {
    if (!Number.isSafeInteger(frame) || frame <= 0 || frame > 8 * 1024 * 1024) throw new Error('Invalid compressed frame size')
    size += frame
  }
  if (!Number.isSafeInteger(size) || size !== image.framedArchiveSize) throw new Error('Framed archive size mismatch')
  if (!image.chunkHashes.every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash))) {
    throw new Error('Invalid frame checksum')
  }
  return true
}

// Start with the smaller archive. Slow links keep every downloaded byte; fast
// links discard only this bounded probe before switching to parallel frames.
export async function probeArchive(source, now = () => performance.now()) {
  const reader = source.getReader()
  const prefix = []
  let size = 0, measuredSize = 0, started, done = false
  try {
    while (size < PROBE_BYTES) {
      const next = await reader.read()
      if (next.done) { done = true; break }
      prefix.push(next.value)
      size += next.value.length
      if (started !== undefined) measuredSize += next.value.length
      else if (size >= PROBE_BYTES / 2) started = now()
    }
    const fast = !done && started !== undefined && measuredSize / Math.max(0.001, (now() - started) / 1000) >= FAST_LINK_BYTES_PER_SECOND
    if (fast) {
      await reader.cancel('Using parallel archive')
      reader.releaseLock()
      return null
    }
    return new ReadableStream({
      async pull(controller) {
        try {
          if (prefix.length) { controller.enqueue(prefix.shift()); return }
          const next = done ? { done: true } : await reader.read()
          if (next.done) { controller.close(); reader.releaseLock() }
          else controller.enqueue(next.value)
        } catch (error) { controller.error(error); reader.releaseLock() }
      },
      async cancel(reason) { await reader.cancel(reason); reader.releaseLock() },
    })
  } catch (error) {
    await reader.cancel(error).catch(() => {})
    reader.releaseLock()
    throw error
  }
}

// Ports belong to workers owned by ImageManager, so cancellation terminates the
// entire pool even if a decoder or a downstream consumer stops responding.
export function decodeFrames(source, image, ports) {
  validateFrames(image)
  if (!ports.length || ports.length > 4) throw new Error('Invalid frame worker count')
  const reader = source.getReader()
  const tasks = new Map(), pending = []
  let buffer = new Uint8Array(0), offset = 0, index = 0, stopped = false, failure, streamController
  const fail = (error) => {
    if (stopped) return
    failure = error
    streamController?.error(error)
    stop(error).catch(() => {})
  }
  const ready = ports.map((port) => new Promise((resolve, reject) => {
    port.onmessage = ({ data }) => {
      if (data.ready) { resolve(); return }
      if (data.error && data.index === undefined) {
        const error = new Error(data.error)
        reject(error)
        fail(error)
        return
      }
      const task = tasks.get(data.index)
      if (!task) return
      tasks.delete(data.index)
      if (data.error) { const error = new Error(data.error); task.reject(error); fail(error) }
      else if (!ArrayBuffer.isView(data.output) || data.output.BYTES_PER_ELEMENT !== 1 || data.output.length !== task.size) {
        const error = new Error('Decoded frame size mismatch'); task.reject(error); fail(error)
      }
      else task.resolve(data.output)
    }
    port.start()
  }))
  const stop = async (error) => {
    if (stopped) return
    stopped = true
    for (const task of tasks.values()) task.reject(error)
    tasks.clear()
    for (const port of ports) port.close()
    await reader.cancel(error).catch(() => {})
    reader.releaseLock()
  }
  const readFrame = async (size) => {
    const frame = new Uint8Array(size)
    let filled = 0
    while (filled < size) {
      if (offset === buffer.length) {
        const next = await reader.read()
        if (next.done) throw new Error('Truncated compressed frame')
        buffer = next.value
        offset = 0
        if (!buffer.length) continue
      }
      const count = Math.min(size - filled, buffer.length - offset)
      frame.set(buffer.subarray(offset, offset + count), filled)
      offset += count
      filled += count
    }
    return frame
  }
  const submit = async () => {
    if (stopped) throw failure || new DOMException('Frame decoding cancelled', 'AbortError')
    if (index === image.frameSizes.length) return
    const i = index++, input = await readFrame(image.frameSizes[i])
    const size = Math.min(image.chunkSize, image.fileSize - i * image.chunkSize)
    const result = new Promise((resolve, reject) => tasks.set(i, { resolve, reject, size }))
    result.catch(() => {})
    pending.push(result)
    ports[i % ports.length].postMessage({ index: i, input, size, hash: image.chunkHashes[i] }, [input.buffer])
  }
  const initialized = (async () => {
    await Promise.all(ready)
    for (let i = 0; i < ports.length * 2; i++) await submit()
  })()
  initialized.catch(() => {})
  return new ReadableStream({
    start(controller) { streamController = controller },
    async pull(controller) {
      try {
        await initialized
        if (stopped) return
        const output = await pending.shift()
        if (pending.length === 0 && index === image.frameSizes.length) {
          if (offset !== buffer.length) throw new Error('Trailing compressed bytes')
          for (;;) {
            const next = await reader.read()
            if (next.done) break
            if (next.value.length) throw new Error('Trailing compressed bytes')
          }
          // Withhold the final verified frame until archive EOF and cache writes.
          controller.enqueue(output)
          controller.close()
          reader.releaseLock()
          stopped = true
          for (const port of ports) port.close()
          return
        }
        controller.enqueue(output)
        await submit()
      } catch (error) { controller.error(failure || error); await stop(failure || error) }
    },
    cancel(reason) { return stop(reason || new DOMException('Frame decoding cancelled', 'AbortError')) },
  }, { highWaterMark: 1 })
}
