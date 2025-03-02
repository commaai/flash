/**
 * Represents a partition image defined in the AGNOS manifest.
 *
 * Image archives can be retrieved from {@link archiveUrl}.
 */
export class ManifestImage {
  /**
   * Partition name
   * @type {string}
   */
  name

  /**
   * SHA-256 checksum of the unpacked image, encoded as a hex string
   * @type {string}
   */
  checksum
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
    this.sparse = json.sparse

    this.fileName = `${this.name}-${json.hash_raw}.img`
    this.checksum = json.hash
    this.archiveUrl = json.url
    this.size = json.size

    this.archiveFileName = this.archiveUrl.split('/').pop()
    this.compressed = this.archiveFileName.endsWith('.xz')
  }
}

/**
 * @param {string} text
 * @returns {ManifestImage[]}
 */
export function createManifest(text) {
  const expectedPartitions = ['aop', 'devcfg', 'xbl', 'xbl_config', 'abl', 'boot', 'system']
  const partitions = JSON.parse(text).map((image) => new ManifestImage(image))

  // Sort into consistent order
  partitions.sort((a, b) => expectedPartitions.indexOf(a.name) - expectedPartitions.indexOf(b.name))

  // Check that all partitions are present
  // TODO: should we prevent flashing if there are extra partitions?
  const missingPartitions = expectedPartitions.filter((name) => !partitions.some((image) => image.name === name))
  if (missingPartitions.length > 0) {
    throw new Error(`Manifest is missing partitions: ${missingPartitions.join(', ')}`)
  }

  return partitions
}

/**
 * @param {string} url
 * @returns {Promise<ManifestImage[]>}
 */
export function getManifest(url) {
  return fetch(url)
    .then((response) => response.text())
    .then(createManifest)
}
