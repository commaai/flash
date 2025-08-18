import { beforeAll, describe, expect, test, vi } from 'vitest'

import config from '../config'
import { ImageManager } from './image'
import { getManifest } from './manifest'

const CI = import.meta.env.CI
const MANIFEST_BRANCH = import.meta.env.MANIFEST_BRANCH

const imageManager = new ImageManager()

beforeAll(async () => {
  globalThis.navigator = {
    storage: {
      estimate: vi.fn().mockImplementation(() => ({ quota: 10 * (1024 ** 3) })),
      getDirectory: () => ({
        getFileHandle: () => ({
          createWritable: vi.fn().mockImplementation(() => new WritableStream({
            write(_) {
              // Discard the chunk (do nothing with it)
            },
            close() { },
            abort(err) {
              console.error('Mock writable stream aborted:', err)
            },
          })),
        }),
        remove: vi.fn(),
      }),
    },
  }

  await imageManager.init()
})

for (const [branch, manifestUrl] of Object.entries(config.manifests)) {
  describe.skipIf(MANIFEST_BRANCH && branch !== MANIFEST_BRANCH)(`${branch} manifest`, async () => {
    const images = await getManifest(manifestUrl)

    // Check all images are present
    expect(images.length).toBe(33)

    let countGpt = 0

    for (const image of images) {
      if (image.gpt !== null) countGpt++

      const big = image.name === 'system' || image.name.startsWith('userdata_')
      describe(`${image.name} image`, async () => {
        test('xz archive', () => {
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

        test.skipIf(big && !MANIFEST_BRANCH)('download', {
          timeout: (big ? 11 * 60 : 20) * 1000,
          repeats: 1,
        }, async () => {
          await imageManager.downloadImage(image)
        })
      })
    }

    // There should be one GPT image for each LUN
    expect(countGpt).toBe(6)
  })
}