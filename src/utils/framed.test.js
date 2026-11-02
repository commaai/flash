import { MessageChannel } from 'node:worker_threads'
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { decodeFrames, decodeZstdFrame, probeArchive, validateFrames, validateZstdFrame } from './framed'
import { instantiateDecoder } from './frame-decoder'

function stream(chunks, cancel) {
  let index = 0
  return new ReadableStream({ pull(controller) {
    if (index === chunks.length) controller.close()
    else controller.enqueue(chunks[index++])
  }, cancel })
}

async function collect(source) {
  const chunks = []
  for await (const chunk of source) chunks.push(chunk)
  return Buffer.concat(chunks)
}

function rawFrame(contents) {
  const chunks = [Buffer.from([0x28, 0xb5, 0x2f, 0xfd, 0xa0]), Buffer.alloc(4)]
  chunks[1].writeUInt32LE(contents.length)
  for (let offset = 0; offset < contents.length; offset += 128 * 1024) {
    const block = contents.subarray(offset, offset + 128 * 1024), header = Buffer.alloc(3)
    header.writeUIntLE(block.length * 8 + Number(offset + block.length === contents.length), 0, 3)
    chunks.push(header, block)
  }
  return Buffer.concat(chunks)
}

function metadata(count = 5) {
  return { fileSize: count * 8, chunkSize: 8, chunkHashes: Array(count).fill('0'.repeat(64)),
    framedArchiveUrl: 'https://example.com/image.zst', framedArchiveSize: count, frameSizes: Array(count).fill(1) }
}

describe('bounded zstd frames', () => {
  it('decodes a large frame in bounded memory and retains independent output', async () => {
    const contents = Buffer.alloc(4 * 1024 * 1024, 137), frame = rawFrame(contents)
    const module = await WebAssembly.compile(await readFile('node_modules/zstd-wasm-decoder/_esm/zstd-decoder-perf.wasm'))
    const decoder = instantiateDecoder(module)
    const first = decodeZstdFrame(decoder, frame, contents.length)
    expect(Buffer.from(first).equals(contents)).toBe(true)
    const small = Buffer.alloc(8192, 14)
    expect(Buffer.from(decodeZstdFrame(decoder, rawFrame(small), small.length)).equals(small)).toBe(true)
    expect(Buffer.from(first).equals(contents)).toBe(true)
    expect(() => decoder.decompressSync(frame, 4 * 1024 * 1024 + 1)).toThrow('Oversized')
    expect(() => decoder.decompressSync(new Uint8Array(8 * 1024 * 1024 + 1), 4096)).toThrow('Oversized')
    expect(() => decoder.decompressSync(frame, 4096)).toThrow('size mismatch')
    expect(() => decoder.decompressSync(frame.subarray(0, -1), contents.length)).toThrow('size mismatch')
    // A bad frame must not poison the next independent decode.
    expect(Buffer.from(decodeZstdFrame(decoder, rawFrame(small), small.length)).equals(small)).toBe(true)
  })

  it('rejects oversized windows, wrong decoded sizes, truncation and trailing frames before decoding', () => {
    const frame = rawFrame(Buffer.alloc(4096, 12))
    expect(validateZstdFrame(frame, 4096)).toHaveLength(1)
    expect(() => validateZstdFrame(frame, 8192)).toThrow('size mismatch')
    expect(() => validateZstdFrame(frame.subarray(0, -1), 4096)).toThrow('Truncated')
    expect(() => validateZstdFrame(Buffer.concat([frame, frame]), 4096)).toThrow('length mismatch')
    const huge = Buffer.concat([frame.subarray(0, 4), Buffer.from([0x80, 0xf8]), frame.subarray(5)])
    expect(() => validateZstdFrame(huge, 4096)).toThrow('size mismatch')
  })

  it('requires exact frame count, total size and valid chunk hashes', () => {
    const image = metadata()
    expect(validateFrames(image)).toBe(true)
    expect(validateFrames({})).toBe(false)
    expect(() => validateFrames({ ...image, frameSizes: [1] })).toThrow('metadata')
    expect(() => validateFrames({ ...image, framedArchiveSize: 6 })).toThrow('size mismatch')
    expect(() => validateFrames({ ...image, chunkHashes: Array(5).fill('wrong') })).toThrow('checksum')
  })
})

describe('archive selection', () => {
  const chunks = () => Array.from({ length: 8 }, (_, index) => new Uint8Array(1024 * 1024).fill(index))
  it('replays every probed byte and keeps the smaller archive on a slow link', async () => {
    const times = [0, 1000], input = chunks(), cancel = vi.fn()
    const selected = await probeArchive(stream(input, cancel), () => times.shift())
    expect((await collect(selected)).equals(Buffer.concat(input))).toBe(true)
    expect(cancel).not.toHaveBeenCalled()
  })
  it('cancels the bounded probe on a fast link', async () => {
    const times = [0, 20], cancel = vi.fn()
    expect(await probeArchive(stream([...chunks(), new Uint8Array(1)], cancel), () => times.shift())).toBeNull()
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('keeps a short archive and cancels its source when the consumer stops', async () => {
    expect(await collect(await probeArchive(stream([new Uint8Array([1, 2])])))).toEqual(Buffer.from([1, 2]))
    const times = [0, 1000, 2000, 4000], cancel = vi.fn()
    const selected = await probeArchive(stream([...chunks(), ...chunks(), ...chunks(), ...chunks(), new Uint8Array(1)], cancel), () => times.shift())
    await selected.cancel('stop')
    expect(cancel).toHaveBeenCalledWith('stop')
  })
  it('retries a slow startup sample before classifying a fast link', async () => {
    const times = [0, 1000, 1040], cancel = vi.fn(), report = vi.fn()
    const selected = await probeArchive(stream([...chunks(), ...chunks(), new Uint8Array(1)], cancel), () => times.shift(), report)
    expect(selected).toBeNull()
    expect(report).toHaveBeenCalledTimes(2)
    expect(report.mock.calls[1][0].bytes).toBe(16 * 1024 * 1024)
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('buffers an already classified source without discarding its prefix', async () => {
    const input = [...chunks(), ...chunks(), ...chunks(), ...chunks(), new Uint8Array([99])]
    const selected = await probeArchive(stream(input), () => 0, undefined, false)
    expect(selected.probeBytes).toBe(32 * 1024 * 1024)
    expect((await collect(selected)).equals(Buffer.concat(input))).toBe(true)
  })
})

function pool(count = 2, fail = -1) {
  const jobs = []
  const ports = Array.from({ length: count }, () => {
    const channel = new MessageChannel()
    channel.port2.onmessage = ({ data }) => {
      jobs.push(data.index)
      setTimeout(() => {
        if (data.index === fail) channel.port2.postMessage({ index: data.index, error: 'Frame checksum mismatch' })
        else channel.port2.postMessage({ index: data.index, output: new Uint8Array(data.size).fill(data.index), input: new Uint8Array(data.input.buffer) }, [data.input.buffer])
      }, data.index % 2 ? 0 : 5)
    }
    channel.port2.postMessage({ ready: true })
    channel.port2.unref()
    return channel.port1
  })
  return { ports, jobs }
}

describe('ordered frame workers', () => {
  it('reorders worker completions and preserves exact output', async () => {
    const image = metadata(), { ports } = pool()
    const output = await collect(decodeFrames(stream([new Uint8Array(5)]), image, ports))
    expect(output).toEqual(Buffer.concat(Array.from({ length: 5 }, (_, i) => Buffer.alloc(8, i))))
  })
  it('rejects a bad frame, truncation and extra archive bytes', async () => {
    await expect(collect(decodeFrames(stream([new Uint8Array(5)]), metadata(), pool(2, 2).ports))).rejects.toThrow('checksum')
    await expect(collect(decodeFrames(stream([new Uint8Array(4)]), metadata(), pool().ports))).rejects.toThrow('Truncated')
    const received = []
    await expect(decodeFrames(stream([new Uint8Array(6)]), metadata(), pool().ports)
      .pipeTo(new WritableStream({ write(chunk) { received.push(chunk) } }))).rejects.toThrow('Trailing')
    expect(received.length).toBeLessThan(5)
  })
  it('bounds queued frames and cancels the source', async () => {
    const cancel = vi.fn(), { ports, jobs } = pool(4)
    const source = decodeFrames(stream(Array.from({ length: 100 }, () => new Uint8Array(1)), cancel), metadata(100), ports)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(jobs.length).toBeLessThanOrEqual(9)
    await source.cancel(new Error('cancel test'))
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('interrupts a stalled network read immediately when an earlier frame fails', async () => {
    const cancel = vi.fn()
    const input = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1)) }, cancel })
    const output = decodeFrames(input, metadata(), pool(2, 0).ports)
    await expect(output.getReader().read()).rejects.toThrow('checksum')
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('rejects decoder initialization failure before any input is needed', async () => {
    const channel = new MessageChannel(), cancel = vi.fn()
    channel.port2.postMessage({ error: 'WASM initialization failed' })
    channel.port2.unref()
    const output = decodeFrames(new ReadableStream({ cancel }), metadata(), [channel.port1])
    await expect(output.getReader().read()).rejects.toThrow('WASM initialization failed')
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('reads cached frames into private reusable input buffers and closes after EOF', async () => {
    let remaining = 17
    const close = vi.fn(), cancel = vi.fn()
    const readInto = vi.fn(async (bytes) => {
      if (!remaining) return 0
      bytes.fill(42)
      remaining -= bytes.length
      return bytes.length
    })
    const output = await collect(decodeFrames({ readInto, close, cancel }, metadata(17), pool().ports))
    expect(output).toEqual(Buffer.concat(Array.from({ length: 17 }, (_, i) => Buffer.alloc(8, i))))
    expect(readInto).toHaveBeenCalledTimes(18)
    expect(close).toHaveBeenCalledOnce()
    expect(cancel).not.toHaveBeenCalled()
  })
  it('closes a cached reader on failure and withholds the final output on trailing data', async () => {
    for (const invalid of ['truncated', 'trailing', 'checksum']) {
      let reads = 0
      const cancel = vi.fn(), close = vi.fn(), received = []
      const readInto = async (bytes) => {
        reads++
        if (invalid === 'truncated' && reads === 2) return 0
        if (reads > 5) return invalid === 'trailing' ? 1 : 0
        return bytes.length
      }
      await expect(decodeFrames({ readInto, close, cancel }, metadata(), pool(2, invalid === 'checksum' ? 0 : -1).ports)
        .pipeTo(new WritableStream({ write(chunk) { received.push(chunk) } }))).rejects.toThrow()
      expect(cancel).toHaveBeenCalledOnce()
      expect(close).not.toHaveBeenCalled()
      expect(received.length).toBeLessThan(5)
    }
  })
})
