import { expect, test } from 'vitest'

import jsSHA from 'jssha'
import { XzReadableStream } from 'xzwasm';

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
          const response = await fetch(image.archiveUrl)
          expect(response.ok, 'to be uploaded').toBe(true)

          const shaObj = new jsSHA('SHA-256', 'UINT8ARRAY')

          const decompressedResponse = new Response(
            new XzReadableStream(response.body)
          );
         
          const reader = decompressedResponse.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            shaObj.update(value)
          }

          const checksum = shaObj.getHash('HEX')
          expect(checksum, 'to match').toBe(image.checksum)
        }, 8 * 60 * 1000)
      })
    }
  })
}
