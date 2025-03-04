import { qdlDevice } from '@commaai/qdl'
import { usbClass } from '@commaai/qdl/usblib'
import * as Comlink from 'comlink'

import { getManifest } from './manifest'
import { withProgress } from './progress'

export const Step = {
  INITIALIZING: 0,
  READY: 1,
  CONNECTING: 2,
  DOWNLOADING: 3,
  FLASHING: 6,
  ERASING: 7,
  DONE: 8,
}

export const Error = {
  UNKNOWN: -1,
  NONE: 0,
  UNRECOGNIZED_DEVICE: 1,
  LOST_CONNECTION: 2,
  DOWNLOAD_FAILED: 3,
  CHECKSUM_MISMATCH: 5,
  FLASH_FAILED: 6,
  ERASE_FAILED: 7,
  REQUIREMENTS_NOT_MET: 8,
  STORAGE_SPACE: 9,
}

/**
 * @param {number} slotCount
 * @param {string[]} partitions
 * @returns {boolean}
 */
function isRecognizedDevice(slotCount, partitions) {
  if (slotCount !== 2) {
    console.error('[QDL] Unrecognised device (slotCount)')
    return false
  }

  // check we have the expected partitions to make sure it's a comma three
  const expectedPartitions = [
    'ALIGN_TO_128K_1', 'ALIGN_TO_128K_2', 'ImageFv', 'abl', 'aop', 'apdp', 'bluetooth', 'boot', 'cache',
    'cdt', 'cmnlib', 'cmnlib64', 'ddr', 'devcfg', 'devinfo', 'dip', 'dsp', 'fdemeta', 'frp', 'fsc', 'fsg',
    'hyp', 'keymaster', 'keystore', 'limits', 'logdump', 'logfs', 'mdtp', 'mdtpsecapp', 'misc', 'modem',
    'modemst1', 'modemst2', 'msadp', 'persist', 'qupfw', 'rawdump', 'sec', 'splash', 'spunvm', 'ssd',
    'sti', 'storsec', 'system', 'systemrw', 'toolsfv', 'tz', 'userdata', 'vm-linux', 'vm-system', 'xbl',
    'xbl_config'
  ]
  if (!partitions.every(partition => expectedPartitions.includes(partition))) {
    console.error('[QDL] Unrecognised device (partitions)', partitions)
    return false
  }
  return true
}

/**
 * @template T
 * @callback ChangeCallback
 * @param {T} value
 * @returns {void}
 */

/**
 * @typedef {object} QdlManagerCallbacks
 * @property {ChangeCallback<number>} [onStepChange]
 * @property {ChangeCallback<string>} [onMessageChange]
 * @property {ChangeCallback<number>} [onProgressChange]
 * @property {ChangeCallback<number>} [onErrorChange]
 * @property {ChangeCallback<boolean>} [onConnectionChange]
 * @property {ChangeCallback<string>} [onSerialChange]
 */

export class QdlManager {
  /**
   * @param {string} manifestUrl
   * @param {string} programmerUrl
   * @param {QdlManagerCallbacks} callbacks
   */
  constructor(manifestUrl, programmerUrl, callbacks = {}) {
    this.manifestUrl = manifestUrl
    this.callbacks = callbacks
    this.qdl = new qdlDevice(programmerUrl)
    this.imageWorker = null
    /** @type {ManifestImage[]|null} */
    this.manifest = null
    this.step = Step.INITIALIZING
    this.error = Error.NONE
  }

  /**
   * @private
   * @param {number} step
   * @returns {void}
   */
  setStep(step) {
    this.step = step
    this.callbacks.onStepChange?.(step)
  }

  /**
   * @private
   * @param {string} message
   */
  setMessage(message) {
    if (message) console.info('[QDL]', message)
    this.callbacks.onMessageChange?.(message)
  }

  /**
   * @private
   * @param {number} progress
   */
  setProgress(progress) {
    this.callbacks.onProgressChange?.(progress)
  }

  /**
   * @private
   * @param {number} error
   */
  setError(error) {
    this.error = error
    this.callbacks.onErrorChange?.(error)
    this.setProgress(-1)

    if (error !== Error.NONE) {
      console.debug('[QDL] error', error)
    }
  }

  /**
   * @private
   * @param {boolean} connected
   */
  setConnected(connected) {
    this.callbacks.onConnectionChange?.(connected)
  }

  /**
   * @private
   * @param {string} serial
   */
  setSerial(serial) {
    this.callbacks.onSerialChange?.(serial)
  }

  /**
   * @param {ImageWorker} imageWorker
   * @returns {Promise<void>}
   */
  async initialize(imageWorker) {
    this.imageWorker = imageWorker
    this.setProgress(-1)
    this.setMessage('')

    if (!this.checkRequirements()) {
      return
    }

    try {
      await this.imageWorker.init()
      this.manifest = await getManifest(this.manifestUrl)

      if (this.manifest.length === 0) {
        throw 'Manifest is empty'
      }

      console.debug('[QDL] Loaded manifest', this.manifest)
      this.setStep(Step.READY)
    } catch (err) {
      console.error('[QDL] Initialization error', err)
      if (err.startsWith('Not enough storage')) {
        this.setError(Error.STORAGE_SPACE)
        this.setMessage(err)
      } else {
        this.setError(Error.UNKNOWN)
      }
    }
  }

  /**
   * @private
   * @returns {boolean}
   */
  checkRequirements() {
    if (typeof navigator.usb === 'undefined') {
      console.error('[QDL] WebUSB not supported')
      this.setError(Error.REQUIREMENTS_NOT_MET)
      return false
    }

    if (typeof Worker === 'undefined') {
      console.error('[QDL] Web Workers not supported')
      this.setError(Error.REQUIREMENTS_NOT_MET)
      return false
    }

    if (typeof Storage === 'undefined') {
      console.error('[QDL] Storage API not supported')
      this.setError(Error.REQUIREMENTS_NOT_MET)
      return false
    }

    return true
  }

  /**
   * @private
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      await this.qdl.connect(new usbClass())
      console.info('[QDL] Connected')

      const { serial_num } = await this.qdl.getStorageInfo()
      this.setSerial(Number(serial_num).toString(16).padStart(8, '0'))

      const [slotCount, partitions] = await this.qdl.getDevicePartitionsInfo()
      const recognized = isRecognizedDevice(slotCount, partitions)
      console.debug('[QDL] Device info', { slotCount, partitions, recognized })

      if (!recognized) {
        this.setError(Error.UNRECOGNIZED_DEVICE)
        return
      }

      this.setConnected(true)
      this.setStep(Step.DOWNLOADING)
    } catch (err) {
      console.error('[QDL] Connection lost', err)
      this.setError(Error.LOST_CONNECTION)
      this.setConnected(false)
    }
  }

  /**
   * @returns {Promise<void>}
   * @private
   */
  async downloadImages() {
    this.setProgress(0)

    try {
      for await (const [image, onProgress] of withProgress(this.manifest, this.setProgress.bind(this))) {
        this.setMessage(`Downloading ${image.name}`)
        await this.imageWorker.downloadImage(image, Comlink.proxy(onProgress))
      }

      console.debug('[QDL] Downloaded all images')
      this.setStep(Step.FLASHING)
    } catch (err) {
      console.error('[QDL] Download error', err)
      if (err.startsWith('Checksum mismatch')) {
        this.setError(Error.CHECKSUM_MISMATCH)
      } else {
        this.setError(Error.DOWNLOAD_FAILED)
      }
    }
  }

  /**
   * @private
   * @returns {Promise<void>}
   */
  async flashDevice() {
    this.setProgress(0)

    try {
      const currentSlot = await this.qdl.getActiveSlot()
      const otherSlot = currentSlot === 'a' ? 'b' : 'a'

      // Erase current xbl partition
      await this.qdl.erase(`xbl_${currentSlot}`)

      const steps = []
      const findImage = (name) => this.manifest.find((it) => it.name === name)

      // Flash aop, abl, xbl, xbl_config, devcfg to both slots
      for (const name of ['aop', 'abl', 'xbl', 'xbl_config', 'devcfg']) {
        const image = findImage(name)
        steps.push([image, `${name}_a`], [image, `${name}_b`])
      }

      // Flash boot, system to other slot
      for (const name of ['boot', 'system']) {
        const image = findImage(name)
        steps.push([image, `${name}_${otherSlot}`])
      }

      for (const [[image, partitionName], onProgress] of withProgress(steps, this.setProgress.bind(this), ([image]) => Math.sqrt(image.size))) {
        const fileHandle = await this.imageWorker.getImage(image)
        const blob = await fileHandle.getFile()
        this.setMessage(`Flashing ${partitionName}`)
        await this.qdl.flashBlob(partitionName, blob, onProgress)
      }

      console.debug('[QDL] Flashed all partitions')
      this.setMessage(`Changing slot to ${otherSlot}`)
      await this.qdl.setActiveSlot(otherSlot)

      this.setStep(Step.ERASING)
    } catch (err) {
      console.error('[QDL] Flashing error', err)
      this.setError(Error.FLASH_FAILED)
    }
  }

  /**
   * @private
   * @returns {Promise<void>}
   */
  async eraseDevice() {
    this.setProgress(0)

    try {
      this.setMessage('Erasing userdata')
      const label = new Uint8Array(28).fill(0)  // sparse header size
      label.set(new TextEncoder().encode('COMMA_RESET'), 0)
      await this.qdl.flashBlob('userdata', new Blob([label]))
      this.setProgress(0.9)

      this.setMessage('Rebooting')
      await this.qdl.reset()
      this.setProgress(1)
      this.setConnected(false)

      console.debug('[QDL] Erase complete')
      this.setStep(Step.DONE)
    } catch (err) {
      console.error('[QDL] Erase error', err)
      this.setError(Error.ERASE_FAILED)
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async start() {
    if (this.step !== Step.READY) return
    await this.connect()
    if (this.error !== Error.NONE) return
    await this.downloadImages()
    if (this.error !== Error.NONE) return
    const start = performance.now()
    await this.flashDevice()
    console.debug(`Flashing took ${((performance.now() - start) / 1000).toFixed(2)}s`)
    if (this.error !== Error.NONE) return
    await this.eraseDevice()
  }
}
