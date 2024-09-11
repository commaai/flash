import { describe, expect, test, vi } from 'vitest'

import * as Comlink from 'comlink'

import config from '../config'
import { getManifest } from './manifest'

async function getImageWorker() {
  let imageWorker

  vi.mock('comlink')
  vi.mocked(Comlink.expose).mockImplementation(worker => {
    imageWorker = worker
    imageWorker.init()
  })

  await import('./../workers/image.worker')

  return imageWorker
}

for (const [branch, manifestUrl] of Object.entries(config.manifests)) {
  describe(`${branch} manifest`, async () => {
    const imageWorkerFileHandler = {
      getFile: vi.fn(),
      createWritable: vi.fn().mockImplementation(() => ({
        write: vi.fn(),
        close: vi.fn(),
      })),
    }

    globalThis.navigator = {
      storage: {
        getDirectory: () => ({
          getFileHandle: () => imageWorkerFileHandler,
        })
      }
    }

    const imageWorker = await getImageWorker()

    const images = await getManifest(manifestUrl)

    // Check all images are present
    expect(images.length).toBe(7)

    for (const image of images) {
      describe(`${image.name} image`, async () => {
        test('xz archive', () => {
          expect(image.archiveFileName, 'archive to be in xz format').toContain('.xz')
          expect(image.archiveUrl, 'archive url to be in xz format').toContain('.xz')
        })

        if (image.name === 'system') {
          test('alt image', () => {
            expect(image.sparse, 'system image to be sparse').toBe(true)
            expect(image.fileName, 'system image to be skip chunks').toContain('-skip-chunks-')
            expect(image.archiveUrl, 'system image to point to skip chunks').toContain('-skip-chunks-')
          })
        }

        test('image and checksum', async () => {
          imageWorkerFileHandler.getFile.mockImplementation(async () => {
            const response = await fetch(image.archiveUrl)
            expect(response.ok, 'to be uploaded').toBe(true)

            return response.blob()
          })

          await imageWorker.unpackImage(image)
        }, 8 * 60 * 1000)
      })
    }
  })
}
