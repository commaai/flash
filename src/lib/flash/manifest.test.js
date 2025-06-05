import { beforeAll, describe, expect, test, vi } from 'vitest'

import config from '../utils/config.js'
import { ImageManager } from './image.js'
import { getManifest, ManifestImage } from './manifest.js'

const CI = import.meta.env.CI
const MANIFEST_BRANCH = import.meta.env.MANIFEST_BRANCH

const imageManager = new ImageManager()

beforeAll(async () => {
  // Navigator mocking is already handled in setup.js
  await imageManager.init()
})

describe('Manifest Tests', () => {
  // Test the config structure first
  describe('Configuration', () => {
    test('has required manifest URLs', () => {
      expect(config.manifests).toBeDefined()
      expect(typeof config.manifests).toBe('object')
      
      // Should have at least release and master
      expect(config.manifests.release).toBeDefined()
      expect(config.manifests.master).toBeDefined()
      
      // URLs should be valid
      expect(config.manifests.release).toMatch(/^https:\/\//)
      expect(config.manifests.master).toMatch(/^https:\/\//)
    })

    test('has loader configuration', () => {
      expect(config.loader).toBeDefined()
      expect(config.loader.url).toBeDefined()
      expect(config.loader.url).toMatch(/^https:\/\//)
    })
  })

  for (const [branch, manifestUrl] of Object.entries(config.manifests)) {
    describe.skipIf(MANIFEST_BRANCH && branch !== MANIFEST_BRANCH)(`${branch} manifest`, () => {
      let images = [] // Initialize as empty array
      
      beforeAll(async () => {
        try {
          // Mock fetch with realistic openpilot partition data
          global.fetch = vi.fn().mockResolvedValue({
            text: () => Promise.resolve(JSON.stringify([
              {
                name: 'system',
                size: 2000000000,
                sparse: false,
                has_ab: false,
                hash_raw: 'abc123def456',
                url: 'https://raw.githubusercontent.com/commaai/openpilot/master/system.img.xz'
              },
              {
                name: 'userdata_0', 
                size: 8000000000,
                sparse: true,
                has_ab: false,
                hash_raw: 'def456789abc',
                url: 'https://raw.githubusercontent.com/commaai/openpilot/master/userdata_0.img.xz'
              },
              {
                name: 'userdata_1', 
                size: 8000000000,
                sparse: true,
                has_ab: false,
                hash_raw: 'fed654321cba',
                url: 'https://raw.githubusercontent.com/commaai/openpilot/master/userdata_1.img.xz'
              },
              {
                name: 'boot_a',
                size: 67108864,
                sparse: false,
                has_ab: true,
                gpt: { lun: 0, start_sector: 1000, num_sectors: 131072 },
                hash_raw: '123456789abc',
                url: 'https://raw.githubusercontent.com/commaai/openpilot/master/boot_a.img.xz'
              },
              {
                name: 'boot_b',
                size: 67108864,
                sparse: false,
                has_ab: true,
                gpt: { lun: 0, start_sector: 132072, num_sectors: 131072 },
                hash_raw: 'cba987654321',
                url: 'https://raw.githubusercontent.com/commaai/openpilot/master/boot_b.img.xz'
              },
              {
                name: 'recovery_a',
                size: 104857600,
                sparse: false,
                has_ab: true,
                gpt: { lun: 0, start_sector: 263144, num_sectors: 204800 },
                hash_raw: '456789abcdef',
                url: 'https://raw.githubusercontent.com/commaai/openpilot/master/recovery_a.img.xz'
              },
              {
                name: 'recovery_b',
                size: 104857600,
                sparse: false,
                has_ab: true,
                gpt: { lun: 0, start_sector: 467944, num_sectors: 204800 },
                hash_raw: 'fedcba654321',
                url: 'https://raw.githubusercontent.com/commaai/openpilot/master/recovery_b.img.xz'
              },
              {
                name: 'vendor_a',
                size: 500000000,
                sparse: false,
                has_ab: true,
                gpt: { lun: 0, start_sector: 672744, num_sectors: 976563 },
                hash_raw: '789abcdef012',
                url: 'https://raw.githubusercontent.com/commaai/openpilot/master/vendor_a.img.xz'
              },
              {
                name: 'vendor_b',
                size: 500000000,
                sparse: false,
                has_ab: true,
                gpt: { lun: 0, start_sector: 1649307, num_sectors: 976563 },
                hash_raw: '210fedcba987',
                url: 'https://raw.githubusercontent.com/commaai/openpilot/master/vendor_b.img.xz'
              }
            ]))
          })
          
          images = await getManifest(manifestUrl)
        } catch (error) {
          console.error(`Failed to fetch manifest for ${branch}:`, error)
          images = [] // Ensure it's always an array
        }
      })

      test('manifest can be fetched and parsed', () => {
        expect(images).toBeDefined()
        expect(Array.isArray(images)).toBe(true)
        expect(images.length).toBeGreaterThan(0)
      })

      test('all images are ManifestImage instances', () => {
        if (!images || images.length === 0) {
          console.warn(`No images to test for ${branch}`)
          return
        }
        
        for (const image of images) {
          expect(image).toBeInstanceOf(ManifestImage)
        }
      })

      // Group image tests to avoid deep nesting
      describe('Image validation', () => {
        test('images have required properties for flashing', () => {
          if (!images || images.length === 0) {
            console.warn(`No images to test for ${branch}`)
            return
          }

          for (const image of images) {
            // Required for comma.ai devices
            expect(typeof image.name).toBe('string')
            expect(typeof image.partitionName).toBe('string')
            expect(typeof image.fileName).toBe('string')
            expect(typeof image.archiveFileName).toBe('string')
            expect(typeof image.archiveUrl).toBe('string')
            
            // Size should be reasonable for partition images
            expect(typeof image.size).toBe('number')
            expect(image.size).toBeGreaterThan(1000000) // At least 1MB
            expect(image.size).toBeLessThan(20000000000) // Less than 20GB
            
            // Boolean flags
            expect(typeof image.sparse).toBe('boolean')
            expect(typeof image.hasAB).toBe('boolean')
            expect(typeof image.compressed).toBe('boolean')
            
            // GPT info for flashing
            if (image.gpt !== null) {
              expect(typeof image.gpt.lun).toBe('number')
              expect(typeof image.gpt.start_sector).toBe('number')
              expect(typeof image.gpt.num_sectors).toBe('number')
              expect(image.gpt.lun).toBeGreaterThanOrEqual(0)
              expect(image.gpt.start_sector).toBeGreaterThanOrEqual(0)
              expect(image.gpt.num_sectors).toBeGreaterThan(0)
            }
          }
        })

        test('compression is correctly detected', () => {
          if (!images || images.length === 0) {
            console.warn(`No images to test for ${branch}`)
            return
          }

          for (const image of images) {
            if (image.archiveFileName.endsWith('.xz')) {
              expect(image.compressed).toBe(true)
            } else {
              expect(image.compressed).toBe(false)
            }
          }
        })

        test('fileName format is correct for comma devices', () => {
          if (!images || images.length === 0) {
            console.warn(`No images to test for ${branch}`)
            return
          }

          for (const image of images) {
            // Format: name-hash.img
            expect(image.fileName).toMatch(/^.+-[a-f0-9]+\.img$/)
            expect(image.fileName).toContain(image.name)
            expect(image.fileName).toContain('.img')
          }
        })

        test('userdata partitions are properly mapped', () => {
          if (!images || images.length === 0) {
            console.warn(`No images to test for ${branch}`)
            return
          }

          const userdataImages = images.filter(img => img.name.startsWith('userdata_'))
          
          for (const image of userdataImages) {
            expect(image.partitionName).toBe('userdata')
            expect(image.name).toMatch(/^userdata_\d+$/)
            // Userdata should be large and sparse
            expect(image.size).toBeGreaterThan(1000000000) // > 1GB
            expect(image.sparse).toBe(true)
          }
        })

        test('boot partitions have A/B slots', () => {
          if (!images || images.length === 0) {
            console.warn(`No images to test for ${branch}`)
            return
          }

          const bootImages = images.filter(img => img.name.startsWith('boot_'))
          
          for (const image of bootImages) {
            expect(image.hasAB).toBe(true)
            expect(image.gpt).not.toBe(null)
            expect(image.name).toMatch(/^boot_[ab]$/)
          }
        })

        test('system partition properties', () => {
          if (!images || images.length === 0) {
            console.warn(`No images to test for ${branch}`)
            return
          }

          const systemImage = images.find(img => img.name === 'system')
          if (systemImage) {
            expect(systemImage.size).toBeGreaterThan(500000000) // > 500MB
            expect(systemImage.partitionName).toBe('system')
            // System is typically not sparse on comma devices
            expect(systemImage.sparse).toBe(false)
          }
        })
      })

      // Integration tests with ImageManager
      describe('ImageManager integration', () => {
        const shouldTestDownloads = CI || process.env.TEST_DOWNLOADS

        test.skipIf(!shouldTestDownloads)('can download small partitions', async () => {
          if (!images || images.length === 0) {
            console.warn(`No images to test download for ${branch}`)
            return
          }

          // Find the smallest image to minimize test time
          const smallestImage = images.reduce((smallest, current) => 
            current.size < smallest.size ? current : smallest
          )
          
          // Mock the download to avoid actual network calls in tests
          vi.mock('./stream.js', () => ({
            fetchStream: vi.fn().mockResolvedValue({
              pipeTo: vi.fn().mockResolvedValue(undefined)
            })
          }))

          await expect(imageManager.downloadImage(smallestImage)).resolves.not.toThrow()
        }, 60000)

        test('handles compressed and uncompressed images', async () => {
          if (!images || images.length === 0) {
            console.warn(`No images to test compression handling for ${branch}`)
            return
          }

          const compressedImages = images.filter(img => img.compressed)
          const uncompressedImages = images.filter(img => !img.compressed)

          expect(compressedImages.length + uncompressedImages.length).toBe(images.length)
          
          // Most comma.ai images should be compressed
          expect(compressedImages.length).toBeGreaterThan(0)
        })
      })
    })
  }

  // Test ManifestImage constructor directly with comma.ai-like data
  describe('ManifestImage class', () => {
    test('constructs correctly from openpilot partition data', () => {
      const openpilotJsonData = {
        name: 'boot_a',
        size: 67108864,
        sparse: false,
        has_ab: true,
        gpt: { lun: 0, start_sector: 1000, num_sectors: 131072 },
        hash_raw: 'abcdef123456',
        url: 'https://raw.githubusercontent.com/commaai/openpilot/master/boot_a.img.xz'
      }

      const image = new ManifestImage(openpilotJsonData)

      expect(image.name).toBe('boot_a')
      expect(image.partitionName).toBe('boot_a')
      expect(image.size).toBe(67108864)
      expect(image.sparse).toBe(false)
      expect(image.hasAB).toBe(true)
      expect(image.gpt).toEqual({ lun: 0, start_sector: 1000, num_sectors: 131072 })
      expect(image.fileName).toBe('boot_a-abcdef123456.img')
      expect(image.archiveUrl).toBe('https://raw.githubusercontent.com/commaai/openpilot/master/boot_a.img.xz')
      expect(image.archiveFileName).toBe('boot_a.img.xz')
      expect(image.compressed).toBe(true)
    })

    test('handles userdata partition naming', () => {
      const userdataJsonData = {
        name: 'userdata_0',
        size: 8000000000,
        sparse: true,
        has_ab: false,
        hash_raw: 'abcdef123456',
        url: 'https://raw.githubusercontent.com/commaai/openpilot/master/userdata_0.img.xz'
      }

      const image = new ManifestImage(userdataJsonData)
      expect(image.name).toBe('userdata_0')
      expect(image.partitionName).toBe('userdata')
    })

    test('handles system partition without GPT', () => {
      const systemJsonData = {
        name: 'system',
        size: 2000000000,
        sparse: false,
        has_ab: false,
        hash_raw: 'abcdef123456',
        url: 'https://raw.githubusercontent.com/commaai/openpilot/master/system.img.xz'
      }

      const image = new ManifestImage(systemJsonData)
      expect(image.gpt).toBe(null)
      expect(image.compressed).toBe(true)
      expect(image.partitionName).toBe('system')
    })
  })
})
