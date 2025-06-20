// Simplified Image Manager for SolidJS - direct and minimal
import { XzReadableStream } from 'xz-decompress'

const MIN_QUOTA_MB = 5250

export class ImageManager {
  constructor() {
    this.root = null
  }

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

  async fetchImage(url, onProgress) {
    // Simplified fetch with progress
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch ${url}`)
    
    const reader = response.body?.getReader()
    const chunks = []
    let receivedLength = 0
    const contentLength = parseInt(response.headers.get('content-length') || '0')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      chunks.push(value)
      receivedLength += value.length
      
      if (contentLength > 0) {
        onProgress?.(receivedLength / contentLength)
      }
    }

    return new Uint8Array(receivedLength).map((_, i) => {
      let offset = 0
      for (const chunk of chunks) {
        if (i < offset + chunk.length) return chunk[i - offset]
        offset += chunk.length
      }
      return 0
    })
  }

  async decompressXz(compressedData, onProgress) {
    // Simplified XZ decompression
    const stream = new XzReadableStream(new ReadableStream({
      start(controller) {
        controller.enqueue(compressedData)
        controller.close()
      }
    }))

    const reader = stream.getReader()
    const chunks = []
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      onProgress?.(chunks.length / 100) // Simplified progress
    }

    return new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
  }
}

// Simple hook replacement for SolidJS
export function createImageManager() {
  const manager = new ImageManager()
  return manager
}
