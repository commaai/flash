import { describe, expect, test, vi } from 'vitest'

import * as Comlink from 'comlink'

import config from '../config'
import { getManifest } from './manifest'

const imageWorkerFileHandler = {
  createWritable: vi.fn().mockImplementation(() => ({
    write: vi.fn(),
    close: vi.fn(),
  })),
  remove: vi.fn(),
}

globalThis.navigator = {
  storage: {
    getDirectory: () => ({
      getFileHandle: () => imageWorkerFileHandler,
    })
  }
}

let imageWorker

vi.mock('comlink')
vi.mocked(Comlink.expose).mockImplementation(worker => {
  imageWorker = worker
  imageWorker.init()
})

vi.resetModules() // this makes the import be reevaluated on each call
await import('./../workers/image.worker')

for (const [branch, manifestUrl] of Object.entries(config.manifests)) {
  describe(`${branch} manifest`, async () => {
    const images = await getManifest(manifestUrl)

    // Check all images are present
    expect(images.length).toBe(7)

    for (const image of images) {
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

        test('download', async () => {
          await imageWorker.downloadImage(image)
        }, { skip: image.name === 'system', timeout: 8 * 1000 })
      })
    }
  })
}
