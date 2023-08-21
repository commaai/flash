import { expect, test } from 'vitest'

import jsSHA from 'jssha'
import pako from 'pako'

import config from '../config'
import { getManifest } from './manifest'

for (const [branch, manifestUrl] of Object.entries(config.manifests)) {
  describe(`${branch} manifest`, async () => {
    const images = await getManifest(manifestUrl)

    // Check all images are present
    expect(images.length).toBe(7)

    for (const image of images) {
      describe(`${image.name} image`, async () => {
        test('gzip archive', () => {
          expect(image.archiveFileName, 'archive to be a gzip').toContain('.gz')
          expect(image.archiveUrl, 'archive url to be a gzip').toContain('.gz')
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

          const inflator = new pako.Inflate()
          const shaObj = new jsSHA('SHA-256', 'UINT8ARRAY')

          inflator.onData = function (chunk) {
            shaObj.update(chunk)
          }

          inflator.onEnd = function (status) {
            expect(status, 'to decompress').toBe(0)

            const checksum = shaObj.getHash('HEX')
            expect(checksum, 'to match').toBe(image.checksum)
          }

          const reader = response.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            inflator.push(value)
          }
        }, 8 * 60 * 1000)
      })
    }
  })
}
