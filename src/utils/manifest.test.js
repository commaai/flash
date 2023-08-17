import { expect, test } from 'vitest'

import config from '../config'
import { getManifest } from './manifest'

test('release manifest is valid', async () => {
  const images = await getManifest(config.manifests.release)
  expect(images.length).toBe(7)
})

test('master manifest is valid', async () => {
  const images = await getManifest(config.manifests.master)
  expect(images.length).toBe(7)
})
