import { validateFrames } from './framed'

/**
 * Represents a partition image defined in the AGNOS manifest.
 *
 * Image archives can be retrieved from {@link archiveUrl}.
 */
export class ManifestImage {
  /**
   * Image name
   * @type {string}
   */
  name
  /**
   * Partition name
   * @type {string}
   */
  partitionName

  /**
   * Size of the unpacked and unsparsified image in bytes
   * @type {number}
   */
  size
  /**
   * Whether the image is sparse
   * @type {boolean}
   */
  sparse
  /**
   * Whether there are multiple slots for this partition
   * @type {boolean}
   */
  hasAB
  /**
   * LUN and sector information for flashing this image
   * @type {{ lun: number; start_sector: number; num_sectors: number }|null}
   */
  gpt

  /**
   * Name of the image file
   * @type {string}
   */
  fileName
  /**
   * Name of the image archive file
   * @type {string}
   */
  archiveFileName
  /**
   * URL of the image archive
   * @type {string}
   */
  archiveUrl

  /**
   * Whether the image is compressed and should be unpacked
   * @type {boolean}
   */
  compressed

  hash
  hashRaw
  fileSize
  archiveSize
  archiveCacheName
  chunkSize
  chunkHashes
  stream
  framedArchiveUrl
  framedArchiveSize
  framedArchiveCacheName
  frameSizes
  lz4
  isLz4

  constructor(json, isLz4 = false) {
    json = { ...json, ...json.flash }
    this.name = json.name
    this.partitionName = json.name.startsWith('userdata_') ? 'userdata' : json.name

    this.hash = json.hash
    this.hashRaw = json.hash_raw
    this.isLz4 = isLz4
    this.archiveSize = json.archive_size
    this.fileSize = json.file_size
    this.chunkSize = json.chunk_size
    this.chunkHashes = json.chunk_hashes
    this.stream = json.stream ? {
      sectorSize: json.stream.sector_size,
      numPartitionSectors: json.stream.num_partition_sectors,
      dataSectors: json.stream.data_sectors,
      extents: json.stream.extents.map((extent) => extent.map((value) => {
        if (!Number.isSafeInteger(value)) throw new Error('Invalid sparse stream extent')
        return BigInt(value)
      })),
      sourceRanges: json.stream.source_ranges,
      compressedBytes: json.stream.compressed_bytes,
      firstFrameBytes: json.stream.first_frame_bytes,
    } : null
    this.size = json.size
    this.sparse = json.sparse
    this.hasAB = json.has_ab
    this.gpt = 'gpt' in json ? json.gpt : null

    this.fileName = `${this.name}-${json.hash}.img`
    this.archiveUrl = json.zstd_url || json.url
    this.archiveFileName = this.archiveUrl.split('/').pop()
    this.archiveCacheName = `${this.fileName}.${this.archiveFileName.split('.').pop()}`
    this.framedArchiveUrl = json.zstd_chunked_url
    this.framedArchiveSize = json.zstd_chunked_size
    this.frameSizes = json.zstd_frame_sizes
    if (validateFrames(this)) this.framedArchiveCacheName = `${this.fileName}.${this.framedArchiveUrl.split('/').pop()}`

    this.compressed = /\.(xz|zst)$/.test(this.archiveFileName)
    this.lz4 = !isLz4 && json.lz4 ? new ManifestImage({ ...json.lz4, name: json.name,
      size: json.size, has_ab: json.has_ab, sparse: false }, true) : null
  }
}

export function validateLz4Alternative(image, alternative) {
  if (!image.stream || !alternative.stream || alternative.fileSize !== alternative.stream.compressedBytes ||
      !/^[a-f0-9]{64}$/i.test(alternative.hashRaw) || alternative.hashRaw !== image.hashRaw ||
      alternative.stream.sectorSize !== image.stream.sectorSize ||
      alternative.stream.numPartitionSectors !== image.stream.numPartitionSectors) {
    throw new Error('LZ4 alternative differs from the logical image')
  }
  let index = 0
  for (const [start, count] of image.stream.extents) {
    let covered = start
    while (covered < start + count) {
      while (index < alternative.stream.extents.length &&
        alternative.stream.extents[index][0] + alternative.stream.extents[index][1] <= covered) index++
      const extent = alternative.stream.extents[index]
      if (!extent || extent[0] > covered) throw new Error('LZ4 alternative omits image sectors')
      covered = extent[0] + extent[1]
    }
  }
}

/**
 * @param {string} url
 * @returns {Promise<ManifestImage[]>}
 */
export async function getManifest(url) {
  const [images, agnos] = await Promise.all([url, url.replace('all-partitions', 'agnos')]
    .map((manifestUrl) => fetch(manifestUrl).then((response) => response.json())))
  return images.map((image) => new ManifestImage(agnos.find((a) => a.name === image.name) ?? image))
}
