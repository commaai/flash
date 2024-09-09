/**
 * Represents a partition image defined in the AGNOS manifest.
 *
 * Image archives can be retrieved from {@link archiveUrl}.
 */
export class Image {
  /**
   * Partition name
   * @type {string}
   */
  name

  /**
   * SHA-256 checksum of the image, encoded as a hex string
   * @type {string}
   */
  checksum
  /**
   * Size of the unpacked image in bytes
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

  constructor(json) {
    this.name = json.name
    this.sparse = json.sparse
    this.checksum = json.hash
    this.fileName = `${this.name}-${json.hash_raw}.img`
    this.archiveUrl = json.url
    this.size = json.size
    this.archiveFileName = this.archiveUrl.split('/').pop()
  }
}

/**
 * @param {string} text
 * @returns {Image[]}
 */
export function createManifest(text) {
  const expectedPartitions = ['aop', 'devcfg', 'xbl', 'xbl_config', 'abl', 'boot', 'system']
  const partitions = JSON.parse(text).map((image) => new Image(image))

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
 * @returns {Promise<Image[]>}
 */
export function getManifest(url) {
  return fetch(url)
    .then((response) => response.text())
    .then(createManifest)
}
