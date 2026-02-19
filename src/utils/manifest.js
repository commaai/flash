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

  constructor(json) {
    this.name = json.name
    this.partitionName = json.name.startsWith('userdata_') ? 'userdata' : json.name

    this.size = json.size
    this.sparse = json.sparse
    this.hasAB = json.has_ab
    this.gpt = 'gpt' in json ? json.gpt : null

    this.fileName = `${this.name}-${json.hash_raw}.img`
    this.archiveUrl = json.url
    this.archiveFileName = this.archiveUrl.split('/').pop()

    this.compressed = this.archiveFileName.endsWith('.xz')
  }
}

/**
 * @param {string} url
 * @returns {Promise<ManifestImage[]>}
 */
export function getManifest(url) {
  return fetch(url)
    .then((response) => response.text())
    .then((text) => JSON.parse(text).map((image) => new ManifestImage(image)))
}
