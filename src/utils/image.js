import { useEffect, useRef } from 'preact/hooks'
import { XzReadableStream } from 'xz-decompress'

import { fetchStream } from './stream'

/**
 * Progress callback
 *
 * @callback progressCallback
 * @param {number} progress
 * @returns {void}
 */

const MIN_QUOTA_MB = 5250

export class ImageManager {
  /** @type {FileSystemDirectoryHandle} */
  root

  async init() {
    if (!this.root) {
      this.root = await navigator.storage.getDirectory()
      await this.root.remove({ recursive: true })
      console.info('[ImageManager] Initialized')
    }

    const estimate = await navigator.storage.estimate()
    const quotaMB = (estimate.quota || 0) / (1024 ** 2)
    if (quotaMB < MIN_QUOTA_MB) {
      throw new Error(`Not enough storage: ${quotaMB.toFixed(0)}MB free, need ${MIN_QUOTA_MB.toFixed(0)}MB`)
    }
  }

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
      const fileHandle = await this.root.getFileHandle(fileName, { create: true })
      writable = await fileHandle.createWritable()
    } catch (e) {
      throw new Error(`Error opening file handle: ${e}`, { cause: e })
    }

    console.debug(`[ImageManager] Downloading ${image.name} from ${archiveUrl}`)
    let stream = await fetchStream(archiveUrl, { mode: 'cors' }, { onProgress })
    try {
      if (image.compressed) {
        stream = new XzReadableStream(stream)
      }
      await stream.pipeTo(writable)
      onProgress?.(1)
    } catch (e) {
      throw new Error(`Error unpacking archive: ${e}`, { cause: e })
    }
  }

  /**
   * Get a blob for an image.
   *
   * @param {ManifestImage} image
   * @returns {Promise<Blob>}
   */
  async getImage(image) {
    const { fileName } = image

    let fileHandle
    try {
      fileHandle = await this.root.getFileHandle(fileName, { create: false })
    } catch (e) {
      throw new Error(`Error getting file handle: ${e}`, { cause: e })
    }

    return fileHandle.getFile()
  }
}

/** @returns {React.MutableRefObject<ImageManager>} */
export function useImageManager() {
  const apiRef = useRef()

  useEffect(() => {
    const worker = new ImageManager()
    apiRef.current = worker
  }, [])

  return apiRef
}
