#!/usr/bin/env bun
import { readableStreamToBlob } from 'bun'
import { createProgress, createQdl } from '@commaai/qdl/cli'
import { XzReadableStream } from 'xz-decompress'

import { getManifest } from '../utils/manifest'
import { checkCompatibleDevice } from '../utils/qdl'

async function fetchWithProgress(url) {
  const response = await fetch(url)
  const reader = response.body.getReader()
  const onProgress = createProgress(Number(response.headers.get('content-length')))
  let received = 0
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      received += value.length
      onProgress(received)
      controller.enqueue(value)
    },
  })
}

const qdl = await createQdl()
const storageInfo = await qdl.getStorageInfo()

console.debug('UFS Serial:', storageInfo.serial_num.toString(16).padStart(8, '0'))
const userdataImage = checkCompatibleDevice(storageInfo)
if (!userdataImage) {
  console.error('Could not identify device by UFS chip')
  console.debug(storageInfo)
  process.exit(1)
}
console.debug('Detected userdata image:', userdataImage)

const manifestUrl = 'https://raw.githubusercontent.com/commaai/openpilot/release3-staging/system/hardware/tici/all-partitions.json'
/** @type {ManifestImage[]} */
const manifest = await getManifest(manifestUrl)

// Repair GPTs
for (const image of manifest) {
  if (!image.gpt) continue
  console.debug(`Downloading ${image.name}`)
  const compressedStream = await fetchWithProgress(image.url)
  const blob = await readableStreamToBlob(new XzReadableStream(compressedStream))
  console.debug(`Flashing ${image.name}`)
  await qdl.repairGpt(image.gpt.lun, blob)
}

// Erase device
const preserve = ['mbr', 'gpt', 'persist']
for (const lun of qdl.firehose.luns) {
  console.debug(`Erasing lun ${lun}`)
  await qdl.eraseLun(lun, preserve)
}

// Flash partitions
for (const image of manifest) {
  if (image.gpt) continue
  if (image.name === 'persist' || image.name.startsWith('userdata_') && image.name !== userdataImage) {
    console.debug(`Skipping ${image.name}`)
    continue
  }
  console.debug(`Downloading ${image.name}`)
  const compressedStream = await fetchWithProgress(image.url)
  const blob = await readableStreamToBlob(new XzReadableStream(compressedStream))
  const slots = image.has_ab ? ['_a', '_b'] : ['']
  for (const slot of slots) {
    const partitionName = image.name.startsWith('userdata_') ? 'userdata' : `${image.name}${slot}`
    await qdl.flashBlob(partitionName, blob, createProgress(image.size))
  }
}

// Set bootable lun
await qdl.setActiveSlot('a')

process.exit(0)
