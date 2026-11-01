import { readFileSync } from 'node:fs'
import { createHash, webcrypto } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { unpackImage, verifyImage } from './download'
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
