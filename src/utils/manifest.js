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

  constructor(json) {
    json = { ...json, ...json.flash }
    this.name = json.name
    this.partitionName = json.name.startsWith('userdata_') ? 'userdata' : json.name

    this.hash = json.hash
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
