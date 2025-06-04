import { beforeAll, describe, expect, test, vi } from 'vitest'

import config from '../utils/config.js'
import { ImageManager } from './image.js'
import { getManifest } from './manifest.js'

const CI = import.meta.env.CI
const MANIFEST_BRANCH = import.meta.env.MANIFEST_BRANCH

const imageManager = new ImageManager()

beforeAll(async () => {
  // Navigator mocking is already handled in setup.js
  await imageManager.init()
})

// Add timeout for the entire suite since it involves downloads
describe('Manifest Tests', { timeout: 60000 }, () => {
  for (const [branch, manifestUrl] of Object.entries(config.manifests)) {
    describe.skipIf(MANIFEST_BRANCH && branch !== MANIFEST_BRANCH)(`${branch} manifest`, async () => {
      let images
      
      // Fetch manifest once per branch to avoid repeated calls
      beforeAll(async () => {
        images = await getManifest(manifestUrl)
      })

      test('has correct number of images', () => {
        expect(images).toBeDefined()
        expect(images.length).toBe(33)
      })

      test('has correct number of GPT images', () => {
        const countGpt = images.filter(image => image.gpt !== null).length
        expect(countGpt).toBe(6)
      })

      // Group image tests to avoid deep nesting
      describe('Image validation', () => {
        test.each(images)('$name image has correct compression format', (image) => {
          const big = image.name === 'system' || image.name.startsWith('userdata_')
          
          expect(image.fileName, 'file to be uncompressed').not.toContain('.xz')
          
          if (image.name === 'system') {
            if (image.compressed) {
              expect(image.fileName, 'not to equal archive name').not.toEqual(image.archiveFileName)
              expect(image.archiveFileName, 'archive to be in xz format').toContain('.xz')
              expect(image.archiveUrl, 'archive url to be in xz format').toContain('.xz')
            } else {
              expect(image.fileName, 'to equal archive name').toEqual(image.archiveFileName)
              expect(image.archiveUrl, 'archive url to not be in xz format').not.toContain('.xz')
            }
          } else {
            expect(image.compressed, 'image to be compressed').toBe(true)
            expect(image.archiveFileName, 'archive to be in xz format').toContain('.xz')
            expect(image.archiveUrl, 'archive url to be in xz format').toContain('.xz')
          }
        })
      })

      // Download tests - more controlled
      describe('Image downloads', () => {
        // Only test downloads in CI or when specifically requested
        const shouldTestDownloads = CI || process.env.TEST_DOWNLOADS

        test.skipIf(!shouldTestDownloads).each(
          images.filter(image => {
            const big = image.name === 'system' || image.name.startsWith('userdata_')
            // Skip big files unless specifically testing that branch
            return !big || MANIFEST_BRANCH
          })
        )('can download $name image', async (image) => {
          const big = image.name === 'system' || image.name.startsWith('userdata_')
          const timeout = big ? 11 * 60 * 1000 : 20 * 1000
          
          await expect(imageManager.downloadImage(image)).resolves.not.toThrow()
        }, {
          timeout: 11 * 60 * 1000, // Max timeout for big files
          retry: 1, // Retry once on failure
        })
      })
    })
  }
})