import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageManager, createImageManager } from '../image'
import { fetchStream } from '../stream'
import { XzReadableStream } from 'xz-decompress'

// Mock external dependencies
vi.mock('../stream', () => ({
  fetchStream: vi.fn()
}))

vi.mock('xz-decompress', () => ({
  XzReadableStream: vi.fn()
}))

describe('ImageManager', () => {
  let imageManager
  let mockRoot
  let mockFileHandle
  let mockWritableStream

  beforeEach(() => {
    // Create fresh mocks for each test
    mockWritableStream = {
      write: vi.fn(),
      close: vi.fn(),
      abort: vi.fn()
    }

    mockFileHandle = {
      createWritable: vi.fn(() => Promise.resolve(mockWritableStream)),
      getFile: vi.fn(() => Promise.resolve(new Blob(['test content'])))
    }

    mockRoot = {
      getFileHandle: vi.fn(() => Promise.resolve(mockFileHandle)),
      remove: vi.fn(() => Promise.resolve())
    }

    // Mock navigator.storage
    global.navigator = {
      storage: {
        estimate: vi.fn(() => Promise.resolve({ quota: 10 * (1024 ** 3) })), // 10GB
        getDirectory: vi.fn(() => Promise.resolve(mockRoot))
      }
    }

    imageManager = new ImageManager()
  })

  describe('init', () => {
    it('initializes successfully with sufficient quota', async () => {
      await expect(imageManager.init()).resolves.toBeUndefined()
      
      expect(global.navigator.storage.getDirectory).toHaveBeenCalled()
      expect(mockRoot.remove).toHaveBeenCalledWith({ recursive: true })
      expect(global.navigator.storage.estimate).toHaveBeenCalled()
      expect(imageManager.root).toBe(mockRoot)
    })

    it('throws error when quota is below minimum', async () => {
      global.navigator.storage.estimate = vi.fn(() => 
        Promise.resolve({ quota: 1 * (1024 ** 3) }) // 1GB (below 5250MB)
      )

      await expect(imageManager.init()).rejects.toThrow('Not enough storage: 1024MB free, need 5250MB')
    })

    it('throws error when quota is undefined', async () => {
      global.navigator.storage.estimate = vi.fn(() => 
        Promise.resolve({ quota: undefined })
      )

      await expect(imageManager.init()).rejects.toThrow('Not enough storage: 0MB free, need 5250MB')
    })

    it('only initializes once', async () => {
      await imageManager.init()
      await imageManager.init()
      
      expect(global.navigator.storage.getDirectory).toHaveBeenCalledTimes(1)
      expect(mockRoot.remove).toHaveBeenCalledTimes(1)
    })

    it('handles storage API failures', async () => {
      global.navigator.storage.getDirectory = vi.fn(() => 
        Promise.reject(new Error('Storage API error'))
      )

      await expect(imageManager.init()).rejects.toThrow('Storage API error')
    })
  })

  describe('downloadImage', () => {
    let mockStream

    beforeEach(async () => {
      // Initialize the ImageManager for download tests
      await imageManager.init()

      // Create mock stream with pipeTo method
      mockStream = {
        pipeTo: vi.fn(() => Promise.resolve())
      }

      fetchStream.mockResolvedValue(mockStream)
    })

    it('downloads uncompressed image successfully', async () => {
      const image = {
        name: 'test-image',
        archiveUrl: 'https://example.com/image.img',
        fileName: 'image.img',
        compressed: false
      }
      const progressCallback = vi.fn()

      await imageManager.downloadImage(image, progressCallback)

      expect(mockRoot.getFileHandle).toHaveBeenCalledWith('image.img', { create: true })
      expect(mockFileHandle.createWritable).toHaveBeenCalled()
      expect(fetchStream).toHaveBeenCalledWith(
        'https://example.com/image.img',
        { mode: 'cors' },
        { onProgress: progressCallback }
      )
      expect(mockStream.pipeTo).toHaveBeenCalledWith(mockWritableStream)
      expect(progressCallback).toHaveBeenCalledWith(1)
    })

    it('downloads and decompresses compressed image', async () => {
      const image = {
        name: 'test-image',
        archiveUrl: 'https://example.com/image.img.xz',
        fileName: 'image.img',
        compressed: true
      }
      const mockDecompressedStream = {
        pipeTo: vi.fn(() => Promise.resolve())
      }
      
      XzReadableStream.mockReturnValue(mockDecompressedStream)

      await imageManager.downloadImage(image)

      expect(XzReadableStream).toHaveBeenCalledWith(mockStream)
      expect(mockDecompressedStream.pipeTo).toHaveBeenCalledWith(mockWritableStream)
    })

    it('calls progress callback with final value', async () => {
      const image = {
        name: 'test-image',
        archiveUrl: 'https://example.com/image.img',
        fileName: 'image.img',
        compressed: false
      }
      const progressCallback = vi.fn()

      await imageManager.downloadImage(image, progressCallback)

      expect(progressCallback).toHaveBeenCalledWith(1)
    })

    it('works without progress callback', async () => {
      const image = {
        name: 'test-image',
        archiveUrl: 'https://example.com/image.img',
        fileName: 'image.img',
        compressed: false
      }

      await expect(imageManager.downloadImage(image)).resolves.toBeUndefined()
    })

    it('throws error when file handle creation fails', async () => {
      const image = {
        name: 'test-image',
        archiveUrl: 'https://example.com/image.img',
        fileName: 'image.img',
        compressed: false
      }
      
      mockRoot.getFileHandle = vi.fn(() => Promise.reject(new Error('File handle error')))

      await expect(imageManager.downloadImage(image)).rejects.toThrow('Error opening file handle: Error: File handle error')
    })

    it('throws error when writable stream creation fails', async () => {
      const image = {
        name: 'test-image',
        archiveUrl: 'https://example.com/image.img',
        fileName: 'image.img',
        compressed: false
      }
      
      mockFileHandle.createWritable = vi.fn(() => Promise.reject(new Error('Writable error')))

      await expect(imageManager.downloadImage(image)).rejects.toThrow('Error opening file handle: Error: Writable error')
    })

    it('throws error when stream unpacking fails', async () => {
      const image = {
        name: 'test-image',
        archiveUrl: 'https://example.com/image.img',
        fileName: 'image.img',
        compressed: false
      }

      mockStream.pipeTo = vi.fn(() => Promise.reject(new Error('Stream error')))

      await expect(imageManager.downloadImage(image)).rejects.toThrow('Error unpacking archive: Error: Stream error')
    })
  })

  describe('getImage', () => {
    beforeEach(async () => {
      await imageManager.init()
    })

    it('retrieves existing image file', async () => {
      const image = {
        name: 'test-image',
        fileName: 'image.img'
      }
      const expectedBlob = new Blob(['test content'])
      mockFileHandle.getFile = vi.fn(() => Promise.resolve(expectedBlob))

      const result = await imageManager.getImage(image)

      expect(mockRoot.getFileHandle).toHaveBeenCalledWith('image.img', { create: false })
      expect(mockFileHandle.getFile).toHaveBeenCalled()
      expect(result).toBe(expectedBlob)
    })

    it('throws error when file handle retrieval fails', async () => {
      const image = {
        name: 'test-image',
        fileName: 'non-existent.img'
      }
      
      mockRoot.getFileHandle = vi.fn(() => Promise.reject(new Error('File not found')))

      await expect(imageManager.getImage(image)).rejects.toThrow('Error getting file handle: Error: File not found')
    })

    it('handles getFile errors', async () => {
      const image = {
        name: 'test-image',
        fileName: 'corrupt.img'
      }
      
      mockFileHandle.getFile = vi.fn(() => Promise.reject(new Error('File corrupted')))

      // The method doesn't catch getFile errors, so it should propagate
      await expect(imageManager.getImage(image)).rejects.toThrow('File corrupted')
    })
  })
})

describe('createImageManager', () => {
  it('creates a new ImageManager instance', () => {
    const manager = createImageManager()
    expect(manager).toBeInstanceOf(ImageManager)
  })
})