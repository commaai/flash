import { useEffect, useRef } from 'react'

/**
 * Progress callback
 *
 * @callback progressCallback
 * @param {number} progress
 * @returns {void}
 */

const MIN_QUOTA_GB = 5.25

export class ImageManager {
  /** @type {FileSystemDirectoryHandle} */
  root

  async init() {
    if (!this.root) {
      this.root = await navigator.storage.getDirectory()
      // Clean up any leftover files from previous sessions
      try {
        await this.root.remove({ recursive: true })
      } catch (e) {
        // Ignore errors - directory might not exist or be empty
        console.debug('[ImageManager] Could not remove old directory:', e)
      }
      // Re-get the directory after removal
      this.root = await navigator.storage.getDirectory()
      console.info('[ImageManager] Initialized')
    }

    const estimate = await navigator.storage.estimate()
    const quotaGB = (estimate.quota || 0) / (1024 ** 3)
    if (quotaGB < MIN_QUOTA_GB) {
      throw new Error(`Not enough storage: ${quotaGB.toFixed(1)}GB free, need ${MIN_QUOTA_GB.toFixed(1)}GB`)
    }
  }

  /**
   * Download and unpack an image, saving it to persistent storage.
   *
   * @param {ManifestImage} image
   * @param {progressCallback} [onProgress]
   * @param {AbortSignal} [signal]
   * @returns {Promise<void>}
   */
  async downloadImage(image, onProgress = undefined, signal = undefined) {
    signal?.throwIfAborted()
    const decoder = new Worker(new URL('./image.worker.js', import.meta.url), { type: 'module' })
    const writer = new Worker(new URL('./image-write.worker.js', import.meta.url), { type: 'module' })
    const channel = new MessageChannel()
    let onAbort
    try {
      await new Promise((resolve, reject) => {
        onAbort = () => reject(signal.reason)
        signal?.addEventListener('abort', onAbort, { once: true })
        decoder.onmessage = ({ data }) => {
          if (data.error) reject(new Error(data.error))
          else onProgress?.(data.progress)
        }
        writer.onmessage = ({ data }) => {
          if (data.error) reject(new Error(data.error))
          else if (data.done) resolve()
        }
        decoder.onerror = writer.onerror = (event) => reject(new Error(event.message))
        writer.postMessage({ image, port: channel.port2 }, [channel.port2])
        decoder.postMessage({ image, port: channel.port1 }, [channel.port1])
      })
    } finally {
      signal?.removeEventListener('abort', onAbort)
      decoder.terminate()
      writer.terminate()
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
