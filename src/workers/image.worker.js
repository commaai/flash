import * as Comlink from 'comlink'

import { createSHA256 } from 'hash-wasm'
import { XzReadableStream } from 'xz-decompress'

/**
 * Chunk callback
 *
 * @callback chunkCallback
 * @param {Uint8Array} chunk
 * @returns {Promise<void>}
 */

/**
 * Progress callback
 *
 * @callback progressCallback
 * @param {number} progress
 * @returns {void}
 */

/**
 * Read chunks from a readable stream reader while reporting progress
 *
 * @param {ReadableStreamDefaultReader} reader
 * @param {number} total
 * @param {chunkCallback} onChunk
 * @param {progressCallback} [onProgress]
 * @returns {Promise<void>}
 */
async function readChunks(reader, total, { onChunk, onProgress = undefined }) {
  let processed = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    await onChunk(value)
    processed += value.length
    onProgress?.(processed / total)
  }
}

/** @type {FileSystemDirectoryHandle} */
let root

/**
 * @typedef {imageWorker} ImageWorker
 */

const imageWorker = {
  async init() {
    if (root) {
      console.warn('[ImageWorker] Already initialized')
      return
    }

    // TODO: check storage quota and report error if insufficient
    root = await navigator.storage.getDirectory()
    console.info('[ImageWorker] Initialized')
  },

  /**
   * Download and unpack an image, saving it to persistent storage. Verifies that the image matches the expected
   * SHA-256 checksum.
   *
   * @param {ManifestImage} image
   * @param {progressCallback} [onProgress]
   * @returns {Promise<void>}
   */
  async downloadImage(image, onProgress = undefined) {
    const { archiveUrl, checksum: expectedChecksum, fileName, size } = image

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

    const shaObj = await createSHA256()
    try {
      let stream = response.body
      if (image.compressed) {
        stream = new XzReadableStream(stream)
      }

      await readChunks(stream.getReader(), size, {
        onChunk: async (chunk) => {
          await writable.write(chunk)
          shaObj.update(chunk)
        },
        onProgress,
      })

      onProgress?.(1)
    } catch (e) {
      throw `Error unpacking archive: ${e}`
    }

    try {
      await writable.close()
    } catch (e) {
      throw `Error closing file handle: ${e}`
    }

    const checksum = shaObj.digest()
    if (checksum !== expectedChecksum) {
      throw `Checksum mismatch: got ${checksum}, expected ${expectedChecksum}`
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
