import * as Comlink from 'comlink'
import { XzReadableStream } from 'xz-decompress'

/**
 * Progress callback
 *
 * @callback progressCallback
 * @param {number} progress
 * @returns {void}
 */

const MIN_QUOTA_MB = 5250

/** @type {FileSystemDirectoryHandle} */
let root

/**
 * @typedef {imageWorker} ImageWorker
 */

const imageWorker = {
  async init() {
    if (!root) {
      root = await navigator.storage.getDirectory()
      await root.remove({ recursive: true })
      console.info('[ImageWorker] Initialized')
    }

    const estimate = await navigator.storage.estimate()
    const quotaMB = (estimate.quota || 0) / (1024 ** 2)
    if (quotaMB < MIN_QUOTA_MB) {
      throw `Not enough storage: ${quotaMB.toFixed(0)}MB free, need ${MIN_QUOTA_MB.toFixed(0)}MB`
    }
  },

  /**
   * Download and unpack an image, saving it to persistent storage.
   *
   * @param {ManifestImage} image
   * @param {progressCallback} [onProgress]
   * @returns {Promise<void>}
   */
  async downloadImage(image, onProgress = undefined) {
    const { archiveUrl, fileName } = image

    /** @type {FileSystemWritableFileStream} */
    let writable
    try {
      const fileHandle = await root.getFileHandle(fileName, { create: true })
      writable = await fileHandle.createWritable()
    } catch (e) {
      throw `Error opening file handle: ${e}`
    }

    console.debug(`[ImageWorker] Downloading ${image.name} from ${archiveUrl}`)
    const response = await fetch(archiveUrl, { mode: 'cors' })
    if (!response.ok) {
      throw `Fetch failed: ${response.status} ${response.statusText}`
    }

    const contentLength = +response.headers.get('Content-Length')
    let receivedLength = 0
    const transform = new TransformStream({
      transform(chunk, controller) {
        receivedLength += chunk.byteLength
        onProgress?.(receivedLength / contentLength)
        controller.enqueue(chunk)
      },
    })
    console.debug("transform", transform)
    console.debug("response.body", response.body)
    let stream = response.body.pipeThrough(transform)
    console.debug("before stream", stream)
    try {
      if (image.compressed) {
        stream = new XzReadableStream(stream)
      }
      console.debug("stream", stream)
      console.debug("writable", writable)
      await stream.pipeTo(writable)
      onProgress?.(1)
    } catch (e) {
      throw `Error unpacking archive: ${e}`
    }
  },

  /**
   * Get a file handle for an image.
   *
   * @param {ManifestImage} image
   * @returns {Promise<FileSystemHandle>}
   */
  async getImage(image) {
    const { fileName } = image

    let fileHandle
    try {
      fileHandle = await root.getFileHandle(fileName, { create: false })
    } catch (e) {
      throw `Error getting file handle: ${e}`
    }

    return fileHandle
  },
}

Comlink.expose(imageWorker)
