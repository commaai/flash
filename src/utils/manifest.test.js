import { expect, test } from 'vitest'

import config from '../config'
import { getManifest } from './manifest'

for (const [branch, manifestUrl] of Object.entries(config.manifests)) {
  describe(`${branch} manifest`, async () => {
    const images = await getManifest(manifestUrl)

    // Check all images are present
    expect(images.length).toBe(7)

    for (const image of images) {
      test(`${image.name} image`, async () => {
        expect(image.archiveFileName, 'archive to be a gzip').toContain('.gz')
        expect(image.archiveUrl, 'archive url to be a gzip').toContain('.gz')

        if (image.name === 'system') {
          expect(image.sparse, 'system image to be sparse').toBe(true)
          expect(image.fileName, 'system image to be skip chunks').toContain('-skip-chunks.img')
          expect(image.archiveUrl, 'system image to point to skip chunks').toContain('-skip-chunks.img.gz')
        }

        // TODO: download and calculate checksum?
        const response = await fetch(image.archiveUrl, { method: 'HEAD' })
        expect(response.ok, 'to be uploaded').toBe(true)
      })
    }
  })
}
