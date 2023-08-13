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
   * Size of the image in bytes
   * @type {number}
   */
  size
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
    this.checksum = json.hash
    this.size = json.size

    let baseUrl = json.url.split('.')
    while (baseUrl.at(-1) !== 'img') baseUrl.pop()
    baseUrl = baseUrl.join('.')

    this.fileName = baseUrl.split('/').at(-1)
    this.archiveFileName = this.fileName + '.gz'
    this.archiveUrl = baseUrl + '.gz'
  }
}

export function createManifest(config) {
  const expectedPartitions = ['aop', 'devcfg', 'xbl', 'xbl_config', 'abl', 'boot', 'system']
  const partitions = config.map((image) => new Image(image))

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
