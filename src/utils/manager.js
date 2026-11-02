import { qdlDevice } from '@commaai/qdl'
import { usbClass } from '@commaai/qdl/usblib'
import { selectSparseRanges, validateSparseStreamMetadata } from '@commaai/qdl/sparse-stream'
import { CalibrationLayoutError, canPreserveDdr, ddrPartitionFromGpt, readDdrPartition } from '@commaai/qdl/calibration'
import { validateLz4Metadata } from '@commaai/qdl/lz4-stream'
import { createFirmwareBatch, firmwareDestinations, flashFirmwareBatch } from '@commaai/qdl/manifest-batch'

import { getManifest, validateLz4Alternative } from './manifest'
import { DownloadQueue } from './download-queue'
import config from '../config'
import { createSteps, withProgress } from './progress'

// Fast mode for development - skips flashing system partition (the slowest)
// Enable with ?fast=1 in URL
const FAST_MODE = new URLSearchParams(window.location.search).has('fast')
if (FAST_MODE) {
  console.warn('[Flash] FAST MODE ENABLED - skipping system partition')
}

export const StepCode = {
  INITIALIZING: 0,
  READY: 1,
  DEVICE_PICKER: 2,
  CONNECTING: 3,
  REPAIR_PARTITION_TABLES: 4,
  ERASE_DEVICE: 5,
  FLASH_SYSTEM: 6,
  FINALIZING: 7,
  DONE: 8,
}

// Device types for the picker
export const DeviceType = {
  COMMA_3: 'comma3',  // comma 3 or 3X
  COMMA_4: 'comma4',  // comma four
}

export const ErrorCode = {
  UNKNOWN: -1,
  NONE: 0,
  REQUIREMENTS_NOT_MET: 1,
  STORAGE_SPACE: 2,
  UNRECOGNIZED_DEVICE: 3,
  LOST_CONNECTION: 4,
  REPAIR_PARTITION_TABLES_FAILED: 5,
  ERASE_FAILED: 6,
  FLASH_SYSTEM_FAILED: 7,
  FINALIZING_FAILED: 8,
}

/**
 * @param {any} storageInfo
 * @returns {string|null}
 */
export function checkCompatibleDevice(storageInfo) {
  // Should be the same for all comma 3/3X
  if (storageInfo.block_size !== 4096 || storageInfo.page_size !== 4096 ||
    storageInfo.num_physical !== 6 || storageInfo.mem_type !== 'UFS') {
    throw new Error('UFS chip parameters mismatch')
  }

  // comma three
  // userdata start 6159400 size 7986131
  if (storageInfo.prod_name === 'H28S7Q302BMR' && storageInfo.manufacturer_id === 429 &&
    storageInfo.total_blocks === 14145536) {
    return 'userdata_30'
  }
  if (storageInfo.prod_name === 'H28U74301AMR' && storageInfo.manufacturer_id === 429 &&
    storageInfo.total_blocks === 14145536) {
    return 'userdata_30'
  }
  if (/64GB-UFS-MT( +)8QSP/.test(storageInfo.prod_name) && storageInfo.manufacturer_id === 300 &&
    storageInfo.total_blocks === 14143488) {
    return 'userdata_30'
  }

  // comma 3X + comma four
  const isSandisk128Gb = /^SDINDDH4-128G(?: +\d+)?$/.test(storageInfo.prod_name)
  // userdata start 6159400 size 23446483
  if (isSandisk128Gb && storageInfo.manufacturer_id === 325 &&
    storageInfo.total_blocks === 29605888) {
    return 'userdata_89'
  }
  // unknown userdata sectors
  if (isSandisk128Gb && storageInfo.manufacturer_id === 325 &&
    storageInfo.total_blocks === 29775872) {
    return 'userdata_90'
  }
  if (storageInfo.prod_name === 'KLUDG4U1EA-B0C1' && storageInfo.manufacturer_id === 462 &&
    storageInfo.total_blocks === 29765632) {
    return 'userdata_90'
  }

  throw new Error('Could not identify UFS chip')
}

/**
 * @template T
 * @callback ChangeCallback
 * @param {T} value
 * @returns {void}
 */

/**
 * @typedef {object} FlashManagerCallbacks
 * @property {ChangeCallback<number>} [onStepChange]
 * @property {ChangeCallback<string>} [onMessageChange]
 * @property {ChangeCallback<number>} [onProgressChange]
 * @property {ChangeCallback<number>} [onErrorChange]
 * @property {ChangeCallback<boolean>} [onConnectionChange]
 * @property {ChangeCallback<string>} [onSerialChange]
 */

export class FlashManager {
  /** @type {string} */
  #userdataImage
  #downloads
  #streamingImages = []
  #preserveDdr = false
  #desiredDdr
  #firmwareBatch

  /**
   * @param {string} manifestUrl
   * @param {ArrayBuffer} programmer
   * @param {FlashManagerCallbacks} callbacks
   */
  constructor(programmer, callbacks = {}) {
    this.manifestUrl = null
    this.callbacks = callbacks
    this.device = new qdlDevice(programmer, { transferSize: 224 * 1024, transferQueueDepth: 32 })
    /** @type {import('./image').ImageManager|null} */
    this.imageManager = null
    /** @type {ManifestImage[]|null} */
    this.manifest = null
    this.step = StepCode.INITIALIZING
    this.error = ErrorCode.NONE
  }

  /** @param {number} step */
  #setStep(step) {
    this.step = step
    this.callbacks.onStepChange?.(step)
  }

  /** @param {string} message */
  #setMessage(message) {
    if (message) console.info('[Flash]', message)
    this.callbacks.onMessageChange?.(message)
  }

  /** @param {number} progress */
  #setProgress(progress) {
    this.callbacks.onProgressChange?.(progress)
  }

  /** @param {number} error */
  #setError(error) {
    this.error = error
    this.callbacks.onErrorChange?.(error)
    this.#setProgress(-1)

    if (error !== ErrorCode.NONE) {
      console.debug('[Flash] error', error)
    }
  }

  /** @param {boolean} connected */
  #setConnected(connected) {
    this.callbacks.onConnectionChange?.(connected)
  }

  /** @param {string} serial */
  #setSerial(serial) {
    this.callbacks.onSerialChange?.(serial)
  }

  /** @returns {boolean} */
  #checkRequirements() {
    if (typeof navigator.usb === 'undefined') {
      console.error('[Flash] WebUSB not supported')
      this.#setError(ErrorCode.REQUIREMENTS_NOT_MET)
      return false
    }
    if (typeof Worker === 'undefined') {
      console.error('[Flash] Web Workers not supported')
      this.#setError(ErrorCode.REQUIREMENTS_NOT_MET)
      return false
    }
    if (typeof Storage === 'undefined') {
      console.error('[Flash] Storage API not supported')
      this.#setError(ErrorCode.REQUIREMENTS_NOT_MET)
      return false
    }
    return true
  }

  /** @param {import('./image').ImageManager} imageManager */
  async initialize(imageManager) {
    this.imageManager = imageManager
    this.#setProgress(-1)
    this.#setMessage('')

    if (!this.#checkRequirements()) {
      return
    }

    try {
      await this.imageManager.init()
    } catch (err) {
      console.error('[Flash] Failed to initialize image worker')
      console.error(err)
      const message = err?.message || String(err)
      if (message.startsWith('Not enough storage')) {
        this.#setError(ErrorCode.STORAGE_SPACE)
        this.#setMessage(message)
      } else {
        this.#setError(ErrorCode.UNKNOWN)
      }
      return
    }

    this.#setStep(StepCode.READY)
  }

  async #connect() {
    this.#setStep(StepCode.CONNECTING)
    this.#setProgress(-1)

    let usb
    try {
      usb = new usbClass()
    } catch (err) {
      console.error('[Flash] Connection lost', err)
      this.#setStep(StepCode.READY)
      this.#setConnected(false)
      return
    }

    try {
      await this.device.connect(usb)
    } catch (err) {
      // User cancelled the WebUSB dialog or no device was selected - not an error
      if (err.name === 'NotFoundError') {
        console.info('[Flash] No device selected')
        this.#setStep(StepCode.READY)
        return
      }
      console.error('[Flash] Connection error', err)
      this.#setError(ErrorCode.LOST_CONNECTION)
      this.#setConnected(false)
      return
    }

    console.info('[Flash] Connected')
    this.#setConnected(true)

    try {
      const deviceType = await this.device.getDeviceType()
      if (deviceType == 32) {
        this.manifestUrl = config.manifests.release_tici
      } else if (deviceType == 33) {
        this.manifestUrl = config.manifests.release_tizi
      } else if (deviceType == 34) {
        this.manifestUrl = config.manifests.release_mici
      } else {
        throw new Error('Unknown device type', deviceType)
      }

      try {
        this.manifest = await getManifest(this.manifestUrl)
        if (this.manifest.length === 0) {
          throw new Error('Manifest is empty')
        }
      } catch (err) {
        console.error('[Flash] Failed to fetch manifest')
        console.error(err)
        this.#setConnected(false)
        this.#setError(ErrorCode.UNKNOWN)
        return
      }
      console.info('[Flash] Loaded manifest', this.manifest)

    } catch (err) {
      console.error('[Flash] Connection lost', err)
      this.#setError(ErrorCode.LOST_CONNECTION)
      this.#setConnected(false)
      return
    }

    let storageInfo
    try {
      storageInfo = await this.device.getStorageInfo()
    } catch (err) {
      console.error('[Flash] Connection lost', err)
      this.#setError(ErrorCode.LOST_CONNECTION)
      this.#setConnected(false)
      return
    }

    try {
      this.#userdataImage = checkCompatibleDevice(storageInfo)
    } catch (e) {
      console.error('[Flash] Could not identify device:', e)
      console.error(storageInfo)
      this.#setError(ErrorCode.UNRECOGNIZED_DEVICE)
      return
    }

    const serialNum = Number(storageInfo.serial_num).toString(16).padStart(8, '0')
    console.info('[Flash] Device info', { serialNum, storageInfo, userdataImage: this.#userdataImage })
    this.#setSerial(serialNum)
  }

  async #prepareDdrPreservation() {
    this.#preserveDdr = false
    const image = this.manifest.find((image) => image.gpt?.lun === 3)
    if (!image) return
    await this.#downloads.get(image)
    const blob = await this.imageManager.getImage(image)
    const desired = readDdrPartition(new Uint8Array(await blob.arrayBuffer()), 3)
    this.#desiredDdr = desired
    try {
      const existing = ddrPartitionFromGpt(await this.device.getGpt(3), 3)
      this.#preserveDdr = canPreserveDdr(existing, desired)
    } catch (error) {
      if (!(error instanceof CalibrationLayoutError) && error.code !== 'GPT_CORRUPT') throw error
      console.info('[Flash] Existing DDR calibration cannot be preserved:', error.message)
    }
  }

  async #prepareFirmwareBatch() {
    this.#firmwareBatch = null
    if (!this.device.canFlashStream(1)) return
    const gpt = this.manifest.find((image) => image.gpt?.lun === 4)
    if (!gpt) return
    await this.#downloads.get(gpt)
    const destinations = firmwareDestinations(new Uint8Array(await (await this.imageManager.getImage(gpt)).arrayBuffer()))
    const images = this.#systemImages().filter((image) => image.sparse && image.stream && !this.#streamingImages.includes(image))
      .map((image) => ({ image, name: image.name, names: [`${image.name}${image.hasAB ? '_a' : ''}`],
        transport: 'sparse', fileSize: image.fileSize, stream: image.stream }))
    this.#firmwareBatch = createFirmwareBatch(this.device, images, destinations, 'a')
    if (this.#firmwareBatch) this.#downloads.prioritize(this.#firmwareBatch.images.map(({ image }) => image))
  }

  async #repairPartitionTables() {
    this.#setStep(StepCode.REPAIR_PARTITION_TABLES)
    this.#setProgress(0)

    // TODO: check that we have an image for each LUN (storageInfo.num_physical)
    const gptImages = this.manifest.filter((image) => !!image.gpt)
    if (gptImages.length === 0) {
      console.error('[Flash] No GPT images found')
      this.#setError(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
      return
    }

    try {
      for await (const [image, onProgress] of withProgress(gptImages, this.#setProgress.bind(this))) {
        // TODO: track repair progress
        const [onDownload, onRepair] = createSteps([2, 1], onProgress)

        // Download GPT image
        await this.#downloads.get(image, onDownload)
        const blob = await this.imageManager.getImage(image);

        // Recreate main and backup GPT for this LUN
        if (!await this.device.repairGpt(image.gpt.lun, blob)) {
          throw new Error(`Repairing LUN ${image.gpt.lun} failed`)
        }
        onRepair(1.0)
      }
      if (this.#preserveDdr) {
        const repaired = ddrPartitionFromGpt(await this.device.getGpt(3), 3)
        if (!canPreserveDdr(repaired, this.#desiredDdr)) throw new Error('Repaired DDR calibration layout changed')
      }
    } catch (err) {
      console.error('[Flash] An error occurred while repairing partition tables')
      console.error(err)
      this.#setError(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
    }
  }

  async #eraseDevice() {
    this.#setStep(StepCode.ERASE_DEVICE)
    this.#setProgress(-1)

    // TODO: use storageInfo.num_physical
    const luns = Array.from({ length: 6 }).map((_, i) => i)

    const [found, persistLun, partition] = await this.device.detectPartition('persist')
    if (!found || luns.indexOf(persistLun) < 0) {
      console.error('[Flash] Could not find "persist" partition', { found, persistLun, partition })
      this.#setError(ErrorCode.ERASE_FAILED)
      return
    }
    if (persistLun !== 0 || partition.start !== 8n || partition.sectors !== 8192n) {
      console.error('[Flash] Partition "persist" does not have expected properties', { found, persistLun, partition })
      this.#setError(ErrorCode.ERASE_FAILED)
      return
    }
    console.info(`[Flash] "persist" partition located in LUN ${persistLun}`)

    try {
      // Erase each LUN, avoid erasing critical partitions and persist
      const critical = ['mbr', 'gpt']
      for (const lun of luns) {
        const preserve = [...critical]
        if (lun === persistLun) preserve.push('persist')
        if (lun === 3 && this.#preserveDdr) preserve.push('ddr')
        console.info(`[Flash] Erasing LUN ${lun} while preserving ${preserve.map((part) => `"${part}"`).join(', ')} partitions`)
        if (!await this.device.eraseLun(lun, preserve)) {
          throw new Error(`Erasing LUN ${lun} failed`)
        }
      }
    } catch (err) {
      console.error('[Flash] An error occurred while erasing device')
      console.error(err)
      this.#setError(ErrorCode.ERASE_FAILED)
    }
  }

  #systemImages() {
    // Exclude GPT images and persist image, and pick correct userdata image to flash
    let systemImages = this.manifest
      .filter((image) => !image.gpt && image.name !== 'persist')
      .filter((image) => !image.name.startsWith('userdata_') || image.name === this.#userdataImage)

    // In fast mode, skip the system partition (slowest to flash)
    if (FAST_MODE) {
      systemImages = systemImages.filter((image) => image.name !== 'system')
      console.info('[Flash] Fast mode: skipping system partition')
    }

    return systemImages
  }

  async #flashSystem() {
    this.#setStep(StepCode.FLASH_SYSTEM)
    this.#setProgress(0)
    const systemImages = this.#systemImages()

    if (!systemImages.find((image) => image.name === this.#userdataImage)) {
      console.error(`[Flash] Did not find userdata image "${this.#userdataImage}"`)
      this.#setError(ErrorCode.UNKNOWN)
      return
    }

    try {
      const batchImages = new Set(this.#firmwareBatch?.images.map(({ image }) => image))
      let batchFlashed = false
      for (const image of systemImages) {
        if (batchImages.has(image)) {
          if (batchFlashed) continue
          this.#setMessage('Flashing firmware')
          const batch = this.#firmwareBatch
          // Verify the whole small group before the target enters raw mode;
          // a slow archive must not leave it waiting for the next partition.
          await Promise.all(batch.images.map(({ image }) => this.#downloads.get(image)))
          if (!await flashFirmwareBatch(this.device, batch, async ({ image }) => {
            return (await this.imageManager.getImage(image)).stream()
          }, (bytes) => this.#setProgress(bytes / (batch.metadata.dataSectors * batch.metadata.sectorSize)))) {
            throw new Error('Flashing firmware failed')
          }
          batchFlashed = true
          this.#setProgress(1)
          continue
        }
        const [onDownload, onFlash] = createSteps([1, 1], this.#setProgress.bind(this))
        const name = `${image.name.startsWith('userdata_') ? 'userdata' : image.name}${image.hasAB ? '_a' : ''}`
        const progress = (bytes) => onFlash(bytes / image.size)
        let streamed = false
        if (this.#streamingImages.includes(image)) {
          let source = await this.#downloads.getStream(image)
          const selected = this.#downloads.getSelectedImage(image)
          if (!source && selected.isLz4) {
            await this.#downloads.get(image)
            source = (await this.imageManager.getImage(selected)).stream()
          }
          if (source) {
            this.#setMessage(`Flashing ${name}`)
            const result = selected.isLz4
              ? await this.device.flashLz4Stream(name, selected.stream, source, progress, false)
              : await this.device.flashStream(name, image.stream, selectSparseRanges(source, image.stream, image.fileSize), progress, false)
            if (!result) {
              throw new Error(`Flashing ${name} failed`)
            }
            await this.#downloads.get(image)
            onDownload(1.0)
            streamed = true
          }
        }
        if (!streamed) {
          this.#setMessage(`Downloading ${image.name}`)
          await this.#downloads.get(image, onDownload)
          const blob = await this.imageManager.getImage(image)
          onDownload(1.0)
          this.#setMessage(`Flashing ${name}`)
          if (!await this.device.flashBlob(name, blob, progress, false)) {
            throw new Error(`Flashing ${name} failed`)
          }
        }
        onFlash(1.0)
      }
    } catch (err) {
      console.error('[Flash] An error occurred while flashing system')
      console.error(err)
      this.#setError(ErrorCode.FLASH_SYSTEM_FAILED)
    }
  }

  async #finalize() {
    this.#setStep(StepCode.FINALIZING)
    this.#setProgress(-1)
    this.#setMessage('Finalizing...')

    // Set bootable LUN and update active partitions
    if (!await this.device.setActiveSlot('a')) {
      console.error('[Flash] Failed to update slot')
      this.#setError(ErrorCode.FINALIZING_FAILED)
      return
    }

    // Reboot the device
    this.#setMessage('Rebooting')
    await this.device.reset()
    this.#setConnected(false)

    this.#setStep(StepCode.DONE)
  }

  async start() {
    if (this.step !== StepCode.READY) return
    await this.#connect()
    // Check if connection was cancelled (step went back to READY) or failed
    if (this.step === StepCode.READY || this.error !== ErrorCode.NONE) return
    const systemImages = this.#systemImages()
    const system = systemImages.find((image) => image.name === 'system')
    const userdata = systemImages.filter((image) => image.name.startsWith('userdata_'))
    const gptImages = this.manifest.filter((image) => image.gpt)
    const ddrGpt = gptImages.find((image) => image.gpt.lun === 3)
    const firmwareGpt = gptImages.find((image) => image.gpt.lun === 4)
    const images = [system, ddrGpt, firmwareGpt, ...gptImages.filter((image) => image !== ddrGpt && image !== firmwareGpt),
      ...systemImages.filter((image) => image !== system && !userdata.includes(image))].filter(Boolean)
    try {
      const streamable = (image) => image?.stream && Number.isSafeInteger(image.fileSize) && image.fileSize > 0 &&
        Number.isSafeInteger(image.chunkSize) && image.chunkSize > 0 && image.chunkSize <= 4 * 1024 * 1024 &&
        Array.isArray(image.chunkHashes) && image.chunkHashes.length === Math.ceil(image.fileSize / image.chunkSize) &&
        image.chunkHashes.every((hash) => /^[a-f0-9]{64}$/i.test(hash)) &&
        Number.isSafeInteger(image.archiveSize) && image.archiveSize > 0 && image.archiveFileName.endsWith('.zst')
      this.#streamingImages = systemImages.filter((image) => {
        image.useLz4 = false
        if (!streamable(image) || !this.device.canFlashStream(image.stream.extents.length)) return false
        if (image.lz4 && this.device.canFlashLz4Stream?.(image.lz4.stream?.extents.length)) {
          validateLz4Metadata(image.lz4.stream)
          validateLz4Alternative(image, image.lz4)
          if (!streamable(image.lz4)) throw new Error('LZ4 alternative is missing verified stream metadata')
          image.useLz4 = true
        }
        return image === system || image.useLz4
      })
      for (const image of this.#streamingImages) validateSparseStreamMetadata(image.stream, image.fileSize)
    } catch (error) {
      console.error('[Flash] Invalid image stream metadata', error)
      this.#setError(ErrorCode.UNKNOWN)
      return
    }
    try {
      await this.imageManager.prune([...images, ...userdata])
    } catch (error) {
      console.error('[Flash] Could not prepare image storage', error)
      this.#setError(ErrorCode.STORAGE_SPACE)
      return
    }
    this.#downloads = new DownloadQueue(this.imageManager, images, 4, userdata, this.#streamingImages)
    try {
      try {
        await this.#prepareDdrPreservation()
        await this.#prepareFirmwareBatch()
      } catch (error) {
        console.error('[Flash] Could not validate the partition layout before repair', error)
        this.#setError(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
        return
      }
      let start = performance.now()
      await this.#repairPartitionTables()
      console.info(`Repaired partition tables in ${((performance.now() - start) / 1000).toFixed(2)}s`)
      if (this.error !== ErrorCode.NONE) return
      start = performance.now()
      await this.#eraseDevice()
      console.info(`Erased device in ${((performance.now() - start) / 1000).toFixed(2)}s`)
      if (this.error !== ErrorCode.NONE) return
      start = performance.now()
      await this.#flashSystem()
      console.info(`Flashed system in ${((performance.now() - start) / 1000).toFixed(2)}s`)
      if (this.error !== ErrorCode.NONE) return
      start = performance.now()
      await this.#finalize()
      console.info(`Finalized in ${((performance.now() - start) / 1000).toFixed(2)}s`)
    } finally {
      this.#downloads.cancel()
    }
  }
}
