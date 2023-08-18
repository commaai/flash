import { expect, test } from 'vitest'

import config from '../config'
import { getManifest } from './manifest'

for (const [branch, manifestUrl] of Object.entries(config.manifests)) {
  describe(`${branch} manifest`, async () => {
    const images = await getManifest(manifestUrl)

    // Check all images are present
    expect(images.length).toBe(7)

    for (const image of images) {
      test(`image ${image.name}`, async () => {
        // Check image URL points to a real file
        const response = await fetch(image.archiveUrl, { method: 'HEAD' })
        expect(response.ok).toBe(true)
      })
    }
  })
}
