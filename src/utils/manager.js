import { qdlDevice } from '@commaai/qdl'
import { usbClass } from '@commaai/qdl/usblib'

import { getManifest } from './manifest'
import { createSteps, withProgress } from './progress'

export const StepCode = {
  INITIALIZING: 0,
  READY: 1,
  CONNECTING: 2,
  REPAIR_PARTITION_TABLES: 3,
  ERASE_DEVICE: 4,
  FLASH_SYSTEM: 5,
  FINALIZING: 6,
  DONE: 7,
}

/**
 * @param {any} storageInfo
 * @returns {string}
 * @throws {Error} If device is not compatible
 */
export function checkCompatibleDevice(storageInfo) {
  // Should be the same for all comma 3/3X
  if (storageInfo.block_size !== 4096 || storageInfo.page_size !== 4096 ||
    storageInfo.num_physical !== 6 || storageInfo.mem_type !== 'UFS') {
    throw new Error('UFS chip parameters mismatch - incompatible device')
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

  // comma 3X
  // userdata start 6159400 size 23446483
  if (storageInfo.prod_name === 'SDINDDH4-128G   1308' && storageInfo.manufacturer_id === 325 &&
    storageInfo.total_blocks === 29605888) {
    return 'userdata_89'
  }
  // unknown userdata sectors
  if (storageInfo.prod_name === 'SDINDDH4-128G   1272' && storageInfo.manufacturer_id === 325 &&
    storageInfo.total_blocks === 29775872) {
    return 'userdata_90'
  }

  throw new Error('Could not identify UFS chip - unrecognized device')
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
 * @property {ChangeCallback<Error>} [onErrorChange]
 * @property {ChangeCallback<boolean>} [onConnectionChange]
 * @property {ChangeCallback<string>} [onSerialChange]
 */

export class FlashManager {
  /** @type {string} */
  #userdataImage

  /**
   * @param {string} manifestUrl
   * @param {ArrayBuffer} programmer
   * @param {FlashManagerCallbacks} callbacks
   */
  constructor(manifestUrl, programmer, callbacks = {}) {
    this.manifestUrl = manifestUrl
    this.callbacks = callbacks
    this.device = new qdlDevice(programmer)
    /** @type {import('./image').ImageManager|null} */
    this.imageManager = null
    /** @type {ManifestImage[]|null} */
    this.manifest = null
    this.step = StepCode.INITIALIZING
    this.error = null
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

  /** @param {boolean} connected */
  #setConnected(connected) {
    this.callbacks.onConnectionChange?.(connected)
  }

  /** @param {string} serial */
  #setSerial(serial) {
    this.callbacks.onSerialChange?.(serial)
  }

  /**
   * Checks if the browser meets all requirements for flashing
   * @throws {Error} If the browser doesn't meet requirements
   */
  #checkRequirements() {
    if (typeof navigator.usb === 'undefined') {
      throw new Error('WebUSB not supported - your browser does not have the required capabilities')
    }
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers not supported - your browser does not have the required capabilities')
    }
    if (typeof Storage === 'undefined') {
      throw new Error('Storage API not supported - your browser does not have the required capabilities')
    }
  }

  /** 
   * @param {import('./image').ImageManager} imageManager 
   * @throws {Error} If initialization fails
   */
  async initialize(imageManager) {
    this.imageManager = imageManager
    this.#setProgress(-1)
    this.#setMessage('')
    this.error = null

    try {
      this.#checkRequirements()
      await this.imageManager.init()

      if (!this.manifest?.length) {
        this.manifest = await getManifest(this.manifestUrl)
        if (this.manifest.length === 0) {
          throw new Error('Manifest is empty - unable to fetch flash data')
        }
        console.info('[Flash] Loaded manifest', this.manifest)
      }

      this.#setStep(StepCode.READY)
    } catch (err) {
      console.error('[Flash] Initialization failed:', err)
      this.callbacks.onErrorChange?.(err)
      throw err
    }
  }

  /**
   * Connects to the device and identifies it
   * @throws {Error} If connection fails or device is not recognized
   */
  async #connect() {
    this.#setStep(StepCode.CONNECTING)
    this.#setProgress(-1)
    this.#setConnected(false)

    let usb
    try {
      usb = new usbClass()
      await this.device.connect(usb)
      console.info('[Flash] Connected')
      this.#setConnected(true)

      const storageInfo = await this.device.getStorageInfo()
      this.#userdataImage = checkCompatibleDevice(storageInfo)

      const serialNum = Number(storageInfo.serial_num).toString(16).padStart(8, '0')
      console.info('[Flash] Device info', { serialNum, storageInfo, userdataImage: this.#userdataImage })
      this.#setSerial(serialNum)
    } catch (err) {
      this.#setConnected(false)
      console.error('[Flash] Connection error:', err)
      throw new Error('Failed to connect to device', { cause: err })
    }
  }

  /**
   * Repairs the partition tables on the device
   * @throws {Error} If partition table repair fails
   */
  async #repairPartitionTables() {
    this.#setStep(StepCode.REPAIR_PARTITION_TABLES)
    this.#setProgress(0)

    const gptImages = this.manifest.filter((image) => !!image.gpt)
    if (gptImages.length === 0) {
      throw new Error('No GPT images found - manifest is incomplete')
    }

    try {
      for await (const [image, onProgress] of withProgress(gptImages, this.#setProgress.bind(this))) {
        const [onDownload, onRepair] = createSteps([2, 1], onProgress)

        // Download GPT image
        await this.imageManager.downloadImage(image, onDownload)
        const blob = await this.imageManager.getImage(image)

        // Recreate main and backup GPT for this LUN
        if (!await this.device.repairGpt(image.gpt.lun, blob)) {
          throw new Error(`Repairing partition tables on LUN ${image.gpt.lun} failed`)
        }
        onRepair(1.0)
      }
    } catch (err) {
      console.error('[Flash] Partition table repair failed:', err)
      throw new Error('Failed to repair partition tables', { cause: err })
    }
  }

  /**
   * Erases the device while preserving critical partitions
   * @throws {Error} If erase operation fails
   */
  async #eraseDevice() {
    this.#setStep(StepCode.ERASE_DEVICE)
    this.#setProgress(-1)

    // TODO: use storageInfo.num_physical
    const luns = Array.from({ length: 6 }).map((_, i) => i)

    try {
      // Find the persist partition
      const [found, persistLun, partition] = await this.device.detectPartition('persist')
      if (!found || luns.indexOf(persistLun) < 0) {
        throw new Error('Could not find "persist" partition')
      }
      if (persistLun !== 0 || partition.start !== 8n || partition.sectors !== 8192n) {
        throw new Error('Partition "persist" does not have expected properties')
      }
      console.info(`[Flash] "persist" partition located in LUN ${persistLun}`)

      // Erase each LUN, avoiding critical partitions and persist
      const critical = ['mbr', 'gpt']
      for (const lun of luns) {
        const preserve = [...critical]
        if (lun === persistLun) preserve.push('persist')
        console.info(`[Flash] Erasing LUN ${lun} while preserving ${preserve.map((part) => `"${part}"`).join(', ')} partitions`)
        if (!await this.device.eraseLun(lun, preserve)) {
          throw new Error(`Erasing LUN ${lun} failed`)
        }
      }
    } catch (err) {
      console.error('[Flash] Erase failed:', err)
      throw new Error('Failed to erase device', { cause: err })
    }
  }

  /**
   * Flashes the system partitions to the device
   * @throws {Error} If flash operation fails
   */
  async #flashSystem() {
    this.#setStep(StepCode.FLASH_SYSTEM)
    this.#setProgress(0)

    // Exclude GPT images and persist image, and pick correct userdata image to flash
    const systemImages = this.manifest
      .filter((image) => !image.gpt && image.name !== 'persist')
      .filter((image) => !image.name.startsWith('userdata_') || image.name === this.#userdataImage)

    if (!systemImages.find((image) => image.name === this.#userdataImage)) {
      throw new Error(`Did not find userdata image "${this.#userdataImage}" in manifest`)
    }

    try {
      for await (const image of systemImages) {
        const [onDownload, onFlash] = createSteps([1, image.hasAB ? 2 : 1], this.#setProgress.bind(this))

        this.#setMessage(`Downloading ${image.name}`)
        await this.imageManager.downloadImage(image, onDownload)
        const blob = await this.imageManager.getImage(image)
        onDownload(1.0)

        // Flash image to each slot
        const slots = image.hasAB ? ['_a', '_b'] : ['']
        for (const [slot, onSlotProgress] of withProgress(slots, onFlash)) {
          // NOTE: userdata image name does not match partition name
          const partitionName = `${image.name.startsWith('userdata_') ? 'userdata' : image.name}${slot}`

          this.#setMessage(`Flashing ${partitionName}`)
          if (!await this.device.flashBlob(partitionName, blob, (progress) => onSlotProgress(progress / image.size))) {
            throw new Error(`Flashing partition "${partitionName}" failed`)
          }
          onSlotProgress(1.0)
        }
      }
    } catch (err) {
      console.error('[Flash] System flash failed:', err)
      throw new Error('Failed to flash system', { cause: err })
    }
  }

  /**
   * Finalizes the flashing process and reboots the device
   * @throws {Error} If finalization fails
   */
  async #finalize() {
    this.#setStep(StepCode.FINALIZING)
    this.#setProgress(-1)
    this.#setMessage('Finalizing...')

    try {
      // Set bootable LUN and update active partitions
      if (!await this.device.setActiveSlot('a')) {
        throw new Error('Failed to set active slot')
      }

      // Reboot the device
      this.#setMessage('Rebooting')
      await this.device.reset()
      this.#setConnected(false)

      this.#setStep(StepCode.DONE)
    } catch (err) {
      console.error('[Flash] Finalization failed:', err)
      throw new Error('Failed to finalize flashing process', { cause: err })
    }
  }

  /**
   * Starts the flashing process
   * @throws {Error} If any step of the process fails
   */
  async start() {
    if (this.step !== StepCode.READY) return

    try {
      let start = performance.now()
      await this.#connect()
      console.info(`Connected in ${((performance.now() - start) / 1000).toFixed(2)}s`)

      start = performance.now()
      await this.#repairPartitionTables()
      console.info(`Repaired partition tables in ${((performance.now() - start) / 1000).toFixed(2)}s`)

      start = performance.now()
      await this.#eraseDevice()
      console.info(`Erased device in ${((performance.now() - start) / 1000).toFixed(2)}s`)

      start = performance.now()
      await this.#flashSystem()
      console.info(`Flashed system in ${((performance.now() - start) / 1000).toFixed(2)}s`)

      start = performance.now()
      await this.#finalize()
      console.info(`Finalized in ${((performance.now() - start) / 1000).toFixed(2)}s`)
    } catch (err) {
      this.callbacks.onErrorChange?.(err)
      this.#setProgress(-1)
      throw err
    }
  }
}
