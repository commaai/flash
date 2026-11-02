import { XzReadableStream } from 'xz-decompress'
import { createDecoder } from 'zstd-wasm-decoder/perf/external'
import { createSHA256 } from 'hash-wasm'

import { fetchStream } from './stream'

export function decodeImage(stream, image) {
  if (image.archiveFileName.endsWith('.xz')) {
    stream = new XzReadableStream(stream)
  } else if (image.archiveFileName.endsWith('.zst')) {
    let decoder
    let reset = true
    stream = stream.pipeThrough(new TransformStream({
      async start() { decoder = await createDecoder() },
      transform(chunk, controller) {
        const { buf, in_offset } = decoder.decompressStream(chunk, reset)
        reset = false
        if (in_offset !== chunk.length) throw new Error('Incomplete zstd input')
        if (buf.length) controller.enqueue(buf)
      },
    }))
  }

  return stream
}

export async function verifyImage(stream, image) {
  if (image.chunkHashes) {
    if (!Number.isSafeInteger(image.chunkSize) || image.chunkSize <= 0 || image.chunkSize > 16 * 1024 * 1024 ||
      !Number.isSafeInteger(image.fileSize) || image.fileSize < 0 || !Array.isArray(image.chunkHashes) ||
      image.chunkHashes.length !== Math.ceil(image.fileSize / image.chunkSize) ||
      image.chunkHashes.some((hash) => !/^[a-f0-9]{64}$/.test(hash))) {
      throw new Error('Invalid image chunk hashes')
    }
    let buffer = new Uint8Array(image.chunkSize)
    let offset = 0
    let index = 0
    let bytes = 0
    const verify = async (controller) => {
      const chunk = buffer.subarray(0, offset)
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', chunk))
      const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
      if (hash !== image.chunkHashes[index++]) throw new Error(`Checksum mismatch for ${image.name}`)
      controller.enqueue(chunk)
      buffer = new Uint8Array(image.chunkSize)
      offset = 0
    }
    return stream.pipeThrough(new TransformStream({
      async transform(chunk, controller) {
        bytes += chunk.length
        if (bytes > image.fileSize) throw new Error(`Image too large: ${image.name}`)
        let start = 0
        while (start < chunk.length) {
          const length = Math.min(chunk.length - start, buffer.length - offset)
          buffer.set(chunk.subarray(start, start + length), offset)
          start += length
          offset += length
          if (offset === buffer.length) await verify(controller)
        }
      },
      async flush(controller) {
        if (offset) await verify(controller)
        if (bytes !== image.fileSize || index !== image.chunkHashes.length) throw new Error(`Incomplete image ${image.name}`)
      },
    }))
  }

  const hash = await createSHA256()
  return stream.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      hash.update(chunk)
      controller.enqueue(chunk)
    },
    flush() {
      if (hash.digest() !== image.hash) throw new Error(`Checksum mismatch for ${image.name}`)
    },
  }))
}

export async function unpackImage(stream, image) {
  return verifyImage(decodeImage(stream, image), image)
}

// Keep compressed writes bounded; the caller commits only after decoded-image verification.
export function cacheArchive(stream, writer) {
  let buffer = new Uint8Array(4 * 1024 * 1024)
  let offset = 0
  const writes = []
  return stream.pipeThrough(new TransformStream({
    async transform(chunk, controller) {
      let start = 0
      while (start < chunk.length) {
        const length = Math.min(chunk.length - start, buffer.length - offset)
        buffer.set(chunk.subarray(start, start + length), offset)
        offset += length
        start += length
        if (offset === buffer.length) {
          const write = writer.write(buffer)
          write.catch(() => {})
          writes.push(write)
          buffer = new Uint8Array(buffer.length)
          offset = 0
          if (writes.length === 2) await writes.shift()
        }
      }
      controller.enqueue(chunk)
    },
    async flush() {
      if (offset) await writer.write(buffer.subarray(0, offset))
      await Promise.all(writes)
    },
  }))
}

export async function writeImage(root, image, stream) {
  const handle = await root.getFileHandle(image.fileName, { create: true })
  const writable = await handle.createWritable()
  try {
    const unpacked = await verifyImage(stream, image)
    await unpacked.pipeTo(writable)
  } catch (error) {
    // Verification setup can fail before pipeTo takes ownership of the file.
    if (!writable.locked) await writable.abort().catch(() => {})
    throw error
  }
}

export async function downloadImage(root, image, onProgress) {
  const response = await fetchStream(image.archiveUrl, { mode: 'cors' }, { onProgress, expectedLength: image.archiveSize })
  await writeImage(root, image, decodeImage(response, image))
  onProgress?.(1)
}
