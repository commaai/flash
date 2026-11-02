import { describe, expect, it } from 'vitest'
import { ManifestImage, validateLz4Alternative } from './manifest'

const hash = 'a'.repeat(64)
function fixture() {
  const encoded = { hash, hash_raw: hash, file_size: 4096, zstd_url: 'https://images/raw.zst',
    archive_size: 100, chunk_size: 4096, chunk_hashes: [hash],
    stream: { sector_size: 4096, num_partition_sectors: 20, data_sectors: 4,
      extents: [[2, 2], [8, 2]], source_ranges: [[28, 4096]] } }
  return new ManifestImage({ name: 'system', has_ab: true, sparse: true, size: 81920,
    ...encoded, flash: { ...encoded, lz4: { ...encoded, hash: 'b'.repeat(64),
      stream: { sector_size: 4096, num_partition_sectors: 20, data_sectors: 8,
        extents: [[2, 8]], compressed_bytes: 4096, first_frame_bytes: 4096 } } } })
}

describe('LZ4 image alternatives', () => {
  it('keeps logical identity and separate transport hashes and filenames', () => {
    const image = fixture()
    expect(image.lz4.name).toBe('system')
    expect(image.lz4.size).toBe(image.size)
    expect(image.lz4.hasAB).toBe(true)
    expect(image.lz4.isLz4).toBe(true)
    expect(image.lz4.lz4).toBeNull()
    expect(image.lz4.stream.extents).toEqual([[2n, 8n]])
    expect(image.lz4.stream.compressedBytes).toBe(4096)
    expect(image.lz4.fileName).not.toBe(image.fileName)
    expect(() => validateLz4Alternative(image, image.lz4)).not.toThrow()
  })

  it('accepts an extent split that still covers every source sector', () => {
    const image = fixture()
    image.lz4.stream.extents = [[2n, 1n], [3n, 1n], [8n, 2n]]
    expect(() => validateLz4Alternative(image, image.lz4)).not.toThrow()
  })

  it.each(['hashRaw', 'fileSize', 'sectorSize', 'numPartitionSectors', 'extents'])('rejects mismatched %s', (field) => {
    const image = fixture()
    if (field === 'hashRaw') image.lz4.hashRaw = undefined
    else if (field === 'fileSize') image.lz4.fileSize++
    else if (field === 'extents') image.lz4.stream.extents = [[3n, 7n]]
    else image.lz4.stream[field]++
    expect(() => validateLz4Alternative(image, image.lz4)).toThrow()
  })
})
