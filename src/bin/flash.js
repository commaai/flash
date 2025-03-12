#!/usr/bin/env bun
import { readableStreamToBlob } from 'bun'
import { createProgress, createQdl } from '@commaai/qdl/cli'
import { XzReadableStream } from 'xz-decompress'

/**
 * @typedef {Object} Partition
 * @property {number} lun
 * @property {number} start_sector
 * @property {number} num_sectors
 */

/**
 * @typedef {Object} ManifestImage
 * @property {string} name
 * @property {string} url
 * @property {string} hash
 * @property {string} hash_raw
 * @property {number} size
 * @property {boolean} full_check
 * @property {boolean} has_ab
 * @property {string} ondevice_hash
 * @property {(Partition|undefined)} gpt
 */

const qdl = await createQdl()
const storageInfo = await qdl.getStorageInfo()

console.debug('UFS Serial:', storageInfo.serial_num.toString(16).padStart(8, '0'))

const manifestUrl = 'https://raw.githubusercontent.com/commaai/openpilot/release3-staging/system/hardware/tici/all-partitions.json'
/** @type {ManifestImage[]} */
const manifest = await fetch(manifestUrl).then((res) => res.json())
// console.debug('Loaded manifest:')
// console.debug(manifest)

// Flash main GPTs
for (const image of manifest) {
  if (!image.gpt) continue
  console.debug(`Downloading ${image.name}`)
  const compressedResponse = await fetch(image.url)
  const blob = await readableStreamToBlob(new XzReadableStream(compressedResponse.body))
  console.debug(`Flashing ${image.name}`)
  await qdl.firehose.cmdProgram(image.gpt.lun, image.gpt.start_sector, blob, createProgress(image.size))
}

// Erase device
for (const lun of qdl.firehose.luns) {
  console.debug(`Erasing lun ${lun}`)
  await qdl.eraseLun(lun, ['gpt', 'persist'])
}

// Flash partitions
for (const image of manifest) {
  if (image.gpt) continue
  if (['persist', 'userdata'].some((name) => image.name.includes(name))) {
    console.debug(`skipping ${image.name}`)
    continue
  }
  console.debug(`Downloading ${image.name}`)
  const compressedResponse = await fetch(image.url)
  const blob = await readableStreamToBlob(new XzReadableStream(compressedResponse.body))
  const slots = image.has_ab ? ['_a', '_b'] : [''];
  for (const slot of slots) {
    const partitionName = `${image.name}${slot}`
    await qdl.flashBlob(partitionName, blob, createProgress(image.size))
  }
}

process.exit(0)
