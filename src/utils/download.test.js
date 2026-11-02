import { readFileSync } from 'node:fs'
import { createHash, webcrypto } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { cacheArchive, decodeImage, unpackImage, verifyImage, writeImage } from './download'
import { ManifestImage } from './manifest'

vi.mock('zstd-wasm-decoder/perf/external', async () => import('zstd-wasm-decoder'))

const contents = Buffer.from('comma four image integrity\n'.repeat(5000))
const hash = createHash('sha256').update(contents).digest('hex')
const metadata = { name: 'system', hash, hash_raw: 'raw', url: 'https://example.com/system.img.xz' }

function source(data) {
  let offset = 0
  return new ReadableStream({
    pull(controller) {
      if (offset === data.length) return controller.close()
      controller.enqueue(data.subarray(offset, offset += Math.min(17, data.length - offset)))
    },
  })
}

async function unpack(data, extension, expectedHash = hash) {
  const stream = await unpackImage(source(data), { name: 'system', archiveFileName: `image.${extension}`, hash: expectedHash })
  const chunks = []
  await stream.pipeTo(new WritableStream({ write(chunk) { chunks.push(chunk) } }))
  return Buffer.concat(chunks)
}

describe('image decoding', () => {
  it('makes a sample output readable while pausing further decoding until the decision', async () => {
    const archive = readFileSync('src/test/fixtures/image.zst')
    let release
    const decision = new Promise((resolve) => { release = resolve })
    const afterOutput = vi.fn(() => decision)
    const decoded = decodeImage(new ReadableStream({ start(controller) {
      controller.enqueue(archive)
      controller.close()
    } }), { archiveFileName: 'image.zst' }, undefined, afterOutput)
    const reader = decoded.getReader()
    expect(Buffer.from((await reader.read()).value)).toEqual(contents)
    expect(afterOutput).toHaveBeenCalledWith(contents.length)
    let finished = false
    const last = reader.read().then((result) => { finished = true; return result })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(finished).toBe(false)
    release()
    expect(await last).toEqual({ done: true, value: undefined })
    reader.releaseLock()
  })
  for (const extension of ['xz', 'zst']) {
    const archive = readFileSync(`src/test/fixtures/image.${extension}`)
    it(`decodes ${extension} across network chunk boundaries and verifies its hash`, async () => {
      expect(await unpack(archive, extension)).toEqual(contents)
    })
    it(`rejects a truncated ${extension} image`, async () => {
      await expect(unpack(archive.subarray(0, archive.length - 10), extension)).rejects.toThrow()
    })
    it(`rejects a ${extension} image whose contents differ from the manifest`, async () => {
      await expect(unpack(archive, extension, '0'.repeat(64))).rejects.toThrow('Checksum mismatch')
    })
  }

  it('selects optimized flash metadata without changing slot or partition identity', () => {
    const image = new ManifestImage({ ...metadata, has_ab: true, size: 4096,
      flash: { hash: 'optimized', hash_raw: 'original sectors', sparse: true,
        zstd_url: 'https://example.com/flash.img.zst', file_size: 123, chunk_size: 4096, chunk_hashes: ['digest'] } })
    expect(image.name).toBe('system')
    expect(image.hasAB).toBe(true)
    expect(image.size).toBe(4096)
    expect(image.hash).toBe('optimized')
    expect(image.fileSize).toBe(123)
    expect(image.sparse).toBe(true)
    expect(image.archiveUrl).toBe('https://example.com/flash.img.zst')
  })

  it('prefers the zstd archive when provided and retains xz compatibility', () => {
    expect(new ManifestImage(metadata).archiveUrl).toBe(metadata.url)
    const image = new ManifestImage({ ...metadata, zstd_url: 'https://example.com/system.img.zst' })
    expect(image.archiveFileName).toBe('system.img.zst')
    expect(image.compressed).toBe(true)
    expect(image.hash).toBe(hash)
  })
})


describe('chunk verification', () => {
  vi.stubGlobal('crypto', webcrypto)
  const chunkSize = 65536
  const chunkHashes = []
  for (let start = 0; start < contents.length; start += chunkSize) {
    chunkHashes.push(createHash('sha256').update(contents.subarray(start, start + chunkSize)).digest('hex'))
  }
  const image = { name: 'system', fileSize: contents.length, chunkSize, chunkHashes }
  async function verify(data, metadata = image) {
    const stream = await verifyImage(source(data), metadata)
    const output = []
    await stream.pipeTo(new WritableStream({ write(chunk) { output.push(chunk) } }))
    return Buffer.concat(output)
  }
  it('verifies ordered chunks, including a partial final chunk', async () => {
    expect(await verify(contents)).toEqual(contents)
  })
  it('rejects reordered chunk hashes', async () => {
    await expect(verify(contents, { ...image, chunkHashes: [...chunkHashes].reverse() })).rejects.toThrow('Checksum mismatch')
  })
  it('rejects incomplete and extra output', async () => {
    await expect(verify(contents.subarray(0, chunkSize))).rejects.toThrow('Incomplete')
    await expect(verify(Buffer.concat([contents, Buffer.from([0])]))).rejects.toThrow('too large')
  })
  it('rejects malformed chunk metadata', async () => {
    for (const fields of [{ chunkSize: 0 }, { fileSize: -1 }, { chunkHashes: [] }, { chunkHashes: chunkHashes.map(() => 'bad') }]) {
      await expect(verify(contents, { ...image, ...fields })).rejects.toThrow('Invalid')
    }
  })
})

describe('verified decoded cache', () => {
  function cache() {
    let committed = Buffer.from('previous image')
    const root = { async getFileHandle() { return { async createWritable() {
      const chunks = []
      return new WritableStream({
        write(chunk) { chunks.push(Buffer.from(chunk)) },
        close() { committed = Buffer.concat(chunks) },
      })
    } } } }
    return { root, contents: () => committed }
  }

  it('commits verified bytes and preserves the previous file on checksum failure', async () => {
    const { root, contents: cached } = cache()
    const image = { name: 'system', fileName: 'image.img', fileSize: contents.length,
      chunkSize: contents.length, chunkHashes: [hash] }
    await writeImage(root, image, source(contents))
    expect(cached()).toEqual(contents)
    await expect(writeImage(root, { ...image, chunkHashes: ['0'.repeat(64)] }, source(contents))).rejects.toThrow('Checksum mismatch')
    expect(cached()).toEqual(contents)
  })
})

describe('compressed archive cache', () => {
  it('pipelines at most two writes, preserves byte order, and leaves commit to image verification', async () => {
    const contents = new Uint8Array(9 * 1024 * 1024)
    for (let i = 0; i < contents.length; i++) contents[i] = i % 251
    const source = new ReadableStream({ start(controller) { controller.enqueue(contents); controller.close() } })
    const writes = []
    let active = 0, maximum = 0
    const writer = {
      write(chunk) {
        active++
        maximum = Math.max(maximum, active)
        return new Promise((resolve) => setTimeout(() => { writes.push(chunk.slice()); active--; resolve() }, 0))
      },
      close: vi.fn(),
    }
    const output = []
    await cacheArchive(source, writer).pipeTo(new WritableStream({ write(chunk) { output.push(chunk) } }))
    expect(maximum).toBe(2)
    expect(Buffer.concat(writes).equals(Buffer.from(contents))).toBe(true)
    expect(Buffer.concat(output).equals(Buffer.from(contents))).toBe(true)
    expect(writer.close).not.toHaveBeenCalled()
  })

  it('propagates a cache write failure without committing', async () => {
    const writer = { write: vi.fn(async () => { throw new Error('Disk full') }), close: vi.fn() }
    await expect(cacheArchive(source(contents), writer).pipeTo(new WritableStream())).rejects.toThrow('Disk full')
    expect(writer.close).not.toHaveBeenCalled()
  })
})
