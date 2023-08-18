import * as Comlink from 'comlink'

import jsSHA from 'jssha'
import pako from 'pako'

import { Image } from '@/utils/manifest'

/**
 * Chunk callback
 *
 * @callback chunkCallback
 * @param {Uint8Array} chunk
 * @returns {void}
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
    onChunk(value)
    processed += value.length
    onProgress?.(processed / total)
  }
}

let root

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
   * Download an image to persistent storage.
   *
   * @param {Image} image
   * @param {progressCallback} [onProgress]
   * @returns {Promise<void>}
   */
  async downloadImage(image, onProgress = undefined) {
    const { archiveFileName, archiveUrl } = image

    let writable
    try {
      const fileHandle = await root.getFileHandle(archiveFileName, { create: true })
      writable = await fileHandle.createWritable()
    } catch (e) {
      throw `Error opening file handle: ${e}`
    }

    console.debug('[ImageWorker] Downloading', archiveUrl)
    const response = await fetch(archiveUrl, { mode: 'cors' })
    if (!response.ok) {
      throw `Fetch failed: ${response.status} ${response.statusText}`
    }

    try {
      const contentLength = +response.headers.get('Content-Length')
      const reader = response.body.getReader()
      await readChunks(reader, contentLength, {
        onChunk: (chunk) => writable.write(chunk),
        onProgress,
      })
      onProgress?.(1)
    } catch (e) {
      throw `Could not read response body: ${e}`
    }

    try {
      await writable.close()
    } catch (e) {
      throw `Error closing file handle: ${e}`
    }
  },

  /**
   * Unpack a downloaded image archive.
   *
   * @param {Image} image
   * @param {progressCallback} [onProgress]
   * @returns {Promise<void>}
   */
  async unpackImage(image, onProgress = undefined) {
    const { archiveFileName, fileName } = image

    let archiveFile
    try {
      const archiveFileHandle = await root.getFileHandle(archiveFileName, { create: false })
      archiveFile = await archiveFileHandle.getFile()
    } catch (e) {
      throw `Error opening archive file handle: ${e}`
    }

    let writable
    try {
      const fileHandle = await root.getFileHandle(fileName, { create: true })
      writable = await fileHandle.createWritable()
    } catch (e) {
      throw `Error opening output file handle: ${e}`
    }

    let complete
    try {
      const reader = archiveFile.stream().getReader()
      await new Promise(async (resolve, reject) => {
        const inflator = new pako.Inflate()
        inflator.onData = function (chunk) {
          writable.write(chunk)
        }
        inflator.onEnd = function (status) {
          if (status) {
            reject(`Decompression error ${status}: ${inflator.msg}`)
          } else {
            resolve()
          }
          complete = true
        }

        await readChunks(reader, archiveFile.size, {
          onChunk: (chunk) => inflator.push(chunk),
          onProgress,
        })
        onProgress?.(1)
      })
    } catch (e) {
      throw `Error unpacking archive: ${e}`
    }

    if (!complete) {
      throw 'Decompression error: unexpected end of stream'
    }

    try {
      await writable.close()
    } catch (e) {
      throw `Error closing file handle: ${e}`
    }
  },

  /**
   * Verify the checksum of an image.
   *
   * @param {Image} image
   * @param {progressCallback} [onProgress]
   * @throws {string} If the checksum does not match
   * @returns {Promise<void>}
   */
  async verifyImage(image, onProgress = undefined) {
    const { checksum: expectedChecksum, fileName } = image

    let file
    try {
      const fileHandle = await root.getFileHandle(fileName, { create: false })
      file = await fileHandle.getFile()
    } catch (e) {
      throw `Error opening file: ${e}`
    }

    const shaObj = new jsSHA('SHA-256', 'UINT8ARRAY')
    const reader = file.stream().getReader()
    await readChunks(reader, file.size, {
      onChunk: (chunk) => shaObj.update(chunk),
      onProgress,
    })
    onProgress?.(1)

    const checksum = shaObj.getHash('HEX')
    if (checksum !== expectedChecksum) {
      throw `Checksum mismatch: got ${checksum}, expected ${expectedChecksum}`
    }
  },

  /**
   * Get a file handle for an image.
   * @param {Image} image
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
