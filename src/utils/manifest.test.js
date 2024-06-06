import { expect, test, vi } from 'vitest'

import config from '../config'
import { getManifest } from './manifest'

for (const [branch, manifestUrl] of Object.entries(config.manifests)) {
  describe(`${branch} manifest`, async () => {
    const images = await getManifest(manifestUrl)

    // Check all images are present
    expect(images.length).toBe(7)

    for (const image of images) {
      describe(`${image.name} image`, async () => {
        test('xz archive', () => {
          expect(image.archiveUrl, 'archive url to be in xz format').toContain('.xz')
        })

        if (image.name === 'system') {
          test('alt image', () => {
            expect(image.sparse, 'system image to be sparse').toBe(true)
            expect(image.fileName, 'system image to be skip chunks').toContain('-skip-chunks-')
            expect(image.archiveUrl, 'system image to point to skip chunks').toContain('-skip-chunks-')
          })
        }
      })
    }
  })
}
