import { useEffect, useRef } from 'react'
import { XzReadableStream } from 'xz-decompress'

import { fetchStream } from './stream'

/**
 * Progress callback
 *
 * @callback progressCallback
 * @param {number} progress
 * @returns {void}
 */

export const MIN_STORAGE_GB = 5.25
export const STORAGE_PROBE_BYTES = MIN_STORAGE_GB * (2 ** 30)
const STORAGE_PROBE_FILE = '.comma-flash-storage-probe'
const STORAGE_PROBE_CHUNK_BYTES = 8 * 1024 * 1024

export class StorageProbeError extends Error {
  constructor(message, writtenBytes, cause = undefined) {
    super(message, cause ? { cause } : undefined)
    this.name = 'StorageProbeError'
    this.writtenBytes = writtenBytes
  }
}

async function removeProbeFile(root) {
  if (typeof root.removeEntry !== 'function') return
  try {
    await root.removeEntry(STORAGE_PROBE_FILE)
  } catch (error) {
    if (error?.name !== 'NotFoundError') throw error
  }
}

export async function cleanupStorageProbe() {
  if (!navigator.storage?.getDirectory) return
  const root = await navigator.storage.getDirectory()
  await removeProbeFile(root)
}

export async function runStorageProbe({
  targetBytes = STORAGE_PROBE_BYTES,
  chunkBytes = STORAGE_PROBE_CHUNK_BYTES,
  onProgress = undefined,
  signal = undefined,
} = {}) {
  if (!navigator.storage?.getDirectory) throw new Error('OPFS is unavailable in this browser')

  const root = await navigator.storage.getDirectory()
  try {
    const existingHandle = await root.getFileHandle(STORAGE_PROBE_FILE, { create: false })
    const existingFile = await existingHandle.getFile()
    if (existingFile.size === targetBytes) {
      onProgress?.(1, targetBytes)
      return { writtenBytes: targetBytes, reused: true }
    }
  } catch (error) {
    if (error?.name !== 'NotFoundError') throw error
  }

  await removeProbeFile(root)
  const fileHandle = await root.getFileHandle(STORAGE_PROBE_FILE, { create: true })
  const writable = await fileHandle.createWritable()
  let writtenBytes = 0

  try {
    while (writtenBytes < targetBytes) {
      if (signal?.aborted) throw new DOMException('Storage test canceled', 'AbortError')
      const writeLength = Math.min(chunkBytes, targetBytes - writtenBytes)
      const chunk = new Uint8Array(writeLength)
      await writable.write(chunk)
      writtenBytes += writeLength
      onProgress?.(writtenBytes / targetBytes, writtenBytes)
    }
    await writable.close()
    onProgress?.(1, writtenBytes)
    return { writtenBytes }
  } catch (error) {
    try {
      await writable.abort(error)
    } catch {
      // The browser may have already closed the stream after a quota failure.
    }
    try {
      await removeProbeFile(root)
    } catch (cleanupError) {
      console.warn('[Storage] Could not remove failed storage probe:', cleanupError)
    }
    if (error?.name === 'AbortError') throw error
    throw new StorageProbeError('The storage write test could not reserve enough space', writtenBytes, error)
  }
}

export class ImageManager {
  /** @type {FileSystemDirectoryHandle} */
  root

  async init() {
    if (!this.root) {
      this.root = await navigator.storage.getDirectory()
      await removeProbeFile(this.root)
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
