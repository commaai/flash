import { useEffect, useRef } from 'react'
import { getImageDirectory } from './image-storage'
import { receiveStream } from './stream-channel'

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
  fastLink

  async init() {
    if (!this.root) {
      const root = await navigator.storage.getDirectory()
      for await (const [name, handle] of root.entries()) {
        if (handle.kind === 'file' && name.endsWith('.img')) await root.removeEntry(name)
      }
      this.root = await getImageDirectory()
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
   * @param {(stream: ReadableStream<Uint8Array>|null, selected: ManifestImage) => void} [onStream] Receives verified bytes and their selected image, or null for an existing decoded cache.
   * @returns {Promise<void>}
   */
  async downloadImage(image, onProgress = undefined, signal = undefined, onStream = undefined) {
    signal?.throwIfAborted()
    if (Number.isSafeInteger(image.fileSize)) {
      try {
        const file = await this.getImage(image)
        if (file.size === image.fileSize) {
          onStream?.(null, image)
          onProgress?.(1)
          return
        }
        await this.root.removeEntry(image.fileName)
      } catch (error) {
        if (error.name !== 'NotFoundError') throw error
      }
    }
    signal?.throwIfAborted()
    const decoder = new Worker(new URL('./image.worker.js', import.meta.url), { type: 'module' })
    const writer = new Worker(new URL('./image-write.worker.js', import.meta.url), { type: 'module' })
    const channel = new MessageChannel()
    const output = onStream ? new MessageChannel() : null
    const frameWorkers = []
    let active = true
    let onAbort
    let streamComplete = Promise.resolve()
    let rejectStream = () => {}
    let streamController
    let sourceReader
    let cacheTemporary
    const stopStream = (error) => {
      const controller = streamController
      streamController = null
      controller?.error(error)
      if (sourceReader) {
        const reader = sourceReader
        sourceReader = null
        reader.cancel(error).catch(() => {}).finally(() => reader.releaseLock())
      }
      rejectStream(error)
    }
    try {
      await new Promise((resolve, reject) => {
        onAbort = () => {
          stopStream(signal.reason)
          reject(signal.reason)
        }
        signal?.addEventListener('abort', onAbort, { once: true })
        decoder.onmessage = ({ data }) => {
          if (!active) return
          if (data.error) reject(new Error(data.error))
          else if (data.cacheDone) resolve()
          else if (data.cacheTemporary) cacheTemporary = data.cacheTemporary
          else if (typeof data.fastLink === 'boolean') this.fastLink = data.fastLink
          else if (data.frameWorkers) {
            try {
              if (!onStream || !Number.isInteger(data.frameWorkers) || data.frameWorkers < 1 || data.frameWorkers > 4 || frameWorkers.length) {
                throw new Error('Invalid frame worker request')
              }
              const ports = []
              for (let i = 0; i < data.frameWorkers; i++) {
                const worker = new Worker(new URL('./frame.worker.js', import.meta.url), { type: 'module' })
                frameWorkers.push(worker)
                worker.onerror = (event) => reject(new Error(event.message))
                const channel = new MessageChannel()
                worker.postMessage({ port: channel.port1 }, [channel.port1])
                ports.push(channel.port2)
              }
              decoder.postMessage({ framePorts: ports }, ports)
            } catch (error) { reject(error) }
          }
          else onProgress?.(data.progress)
        }
        writer.onmessage = ({ data }) => {
          if (!active) return
          if (data.error) reject(new Error(data.error))
          else if (data.stream || data.streamReady) {
            const selected = data.transport === 'lz4' ? image.lz4 : image
            if (!selected) { reject(new Error('Missing selected image alternative')); return }
            let completeStream
            streamComplete = new Promise((resolve, reject) => { completeStream = resolve; rejectStream = reject })
            streamComplete.catch(() => {})
            sourceReader = (data.stream || receiveStream(output.port1)).getReader()
            const reader = sourceReader
            const stream = new ReadableStream({
              start(controller) { streamController = controller },
              async pull(controller) {
                try {
                  const { value, done } = await reader.read()
                  if (!streamController) return
                  if (done) {
                    streamController = null
                    sourceReader = null
                    controller.close()
                    reader.releaseLock()
                    completeStream()
                  } else controller.enqueue(value)
                } catch (error) {
                  stopStream(error)
                  reject(error)
                }
              },
              cancel(reason) {
                streamController = null
                const error = reason || new DOMException('Image stream cancelled', 'AbortError')
                stopStream(error)
                reject(error)
              },
            })
            onStream?.(stream, selected)
          }
          else if (data.done) {
            if (onStream) decoder.postMessage({ commit: true })
            else resolve()
          }
        }
        decoder.onerror = writer.onerror = (event) => reject(new Error(event.message))
        writer.postMessage({ image, port: channel.port2, streaming: !!onStream, output: output?.port2 },
          [channel.port2, ...(output ? [output.port2] : [])])
        decoder.postMessage({ image, port: channel.port1, streaming: !!onStream, fastLink: this.fastLink }, [channel.port1])
      })
      await streamComplete
    } catch (error) {
      stopStream(error)
      throw error
    } finally {
      active = false
      signal?.removeEventListener('abort', onAbort)
      decoder.terminate()
      writer.terminate()
      for (const worker of frameWorkers) worker.terminate()
      output?.port1.close?.()
      if (cacheTemporary) {
        // Terminating the decoder closes its exclusive access handle. Cleanup
        // can briefly race that release; a future prune also removes leftovers.
        for (let attempt = 0; attempt < 10; attempt++) {
          try { await this.root.removeEntry(cacheTemporary); break }
          catch (error) {
            if (error.name === 'NotFoundError') break
            if (error.name !== 'NoModificationAllowedError' || attempt === 9) {
              console.warn('[ImageManager] Could not remove incomplete cache:', error)
              break
            }
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
        }
      }
    }
  }

  async prune(images) {
    this.fastLink = undefined
    images = images.flatMap((image) => image.lz4 ? [image, image.lz4] : [image])
    const keep = new Set(images.filter((image) => Number.isSafeInteger(image.fileSize)).map((image) => image.fileName))
    for (const image of images) {
      if (Number.isSafeInteger(image.archiveSize) && image.archiveCacheName) keep.add(image.archiveCacheName)
      if (Number.isSafeInteger(image.framedArchiveSize) && image.framedArchiveCacheName) keep.add(image.framedArchiveCacheName)
    }
    for await (const [name] of this.root.entries()) {
      if (!keep.has(name)) await this.root.removeEntry(name)
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

    const fileHandle = await this.root.getFileHandle(fileName, { create: false })

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
