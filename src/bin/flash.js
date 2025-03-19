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

function assert(condition, message = undefined) {
  if (condition) return
  if (message) console.error(message)
  process.exit(1)
}

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

// Should be the same for all comma 3/3X
assert(storageInfo.block_size === 4096)
assert(storageInfo.page_size === 4096)
assert(storageInfo.num_physical === 6)
assert(storageInfo.mem_type === 'UFS')

let userdataImage = null;

// comma three
// serial e22af7f8
// serial 696f4917
// userdata	start 6159400 size 7986131
if (storageInfo.prod_name === 'H28S7Q302BMR' && storageInfo.manufacturer_id === 429 &&
    storageInfo.fw_version === '205' && storageInfo.total_blocks === 14145536) {
  userdataImage = 'userdata_30'
}

// comma 3X
// serial 6c65f4e7
// userdata	start 6159400 size 23446483
if (storageInfo.prod_name === 'SDINDDH4-128G   1308' && storageInfo.manufacturer_id === 325 &&
    storageInfo.fw_version === '308' && storageInfo.total_blocks === 29605888) {
  userdataImage = 'userdata_89'
}
// serial cb80a5fa
if (storageInfo.prod_name === 'SDINDDH4-128G   1272' && storageInfo.manufacturer_id === 325 &&
    storageInfo.fw_version === '272' && storageInfo.total_blocks === 29775872) {
  userdataImage = 'userdata_90'
}

if (!userdataImage) {
  console.error('Could not identify device by UFS chip')
  console.debug(storageInfo)
  process.exit(1)
}

console.debug('Detected userdata image:', userdataImage)

const manifestUrl = 'https://raw.githubusercontent.com/commaai/openpilot/release3-staging/system/hardware/tici/all-partitions.json'
/** @type {ManifestImage[]} */
const manifest = await fetch(manifestUrl).then((res) => res.json())

// Flash main GPTs
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
  if (['persist', 'userdata'].some((name) => image.name.includes(name))) {
    console.debug(`skipping ${image.name}`)
    continue
  }
  console.debug(`Downloading ${image.name}`)
  const compressedStream = await fetchWithProgress(image.url)
  const blob = await readableStreamToBlob(new XzReadableStream(compressedStream))
  const slots = image.has_ab ? ['_a', '_b'] : ['']
  for (const slot of slots) {
    const partitionName = `${image.name}${slot}`
    await qdl.flashBlob(partitionName, blob, createProgress(image.size))
  }
}

// Set bootable lun
await qdl.setActiveSlot('a')

process.exit(0)
