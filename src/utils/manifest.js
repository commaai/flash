import { useMemo, useRef } from 'react'

import config from '../config'

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

  /**
   * Whether the image is compressed and should be unpacked
   * @type {boolean}
   */
  compressed

  constructor(json) {
    this.name = json.name
    this.sparse = json.sparse

    this.fileName = `${this.name}-${json.hash_raw}.img`
    if (this.name === 'system' && json.alt) {
      this.checksum = json.alt.hash
      this.archiveUrl = json.alt.url
      this.size = json.alt.size
    } else {
      this.checksum = json.hash
      this.archiveUrl = json.url
      this.size = json.size
    }

    this.archiveFileName = this.archiveUrl.split('/').pop()
    this.compressed = this.archiveFileName.endsWith('.xz')
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
 * @param {RequestInit} [init]
 * @returns {Promise<Image[]>}
 */
export function getManifest(url, init) {
  return fetch(url, init)
    .then((response) => response.text())
    .then(createManifest)
}

/**
 * @param {string} manifestName
 * @returns {RefObject<Image[]>}
 */
export function useManifest(manifestName) {
  const ref = useRef([])

  useMemo(() => {
    if (!manifestName) return
    if (!(manifestName in config.manifests) || !config.manifests[manifestName]) {
      console.warn("unrecognised manifest name:", manifestName)
      return
    }
    const controller = new AbortController()
    getManifest(config.manifests[manifestName], { signal: controller.signal })
      .then((manifest) => {
        console.debug(manifestName, manifest)
        ref.current = manifest
      })
      .catch((error) => console.warn("[QDL] Fetching manifest interrupted:", error))
    return () => controller.abort("new manifest selected")
  }, [manifestName])

  return ref
}
