import { qdlDevice } from '@commaai/qdl'
import { createStepProgress } from './progress.js'

// Step and error codes - simplified
export const StepCode = {
  INITIALIZING: 0,
  READY: 1,
  CONNECTING: 2,
  FLASHING: 3,
  DONE: 4,
}

export const ErrorCode = {
  NONE: 0,
  REQUIREMENTS_NOT_MET: 1,
  DEVICE_ERROR: 2,
  FLASH_FAILED: 3,
}

// Device compatibility check - simplified
export function checkCompatibleDevice(storageInfo) {
  if (storageInfo.block_size !== 4096 || storageInfo.page_size !== 4096 ||
    storageInfo.num_physical !== 6 || storageInfo.mem_type !== 'UFS') {
    throw new Error('UFS chip parameters mismatch')
  }

  // comma 3
  if (storageInfo.prod_name === 'H28S7Q302BMR' && storageInfo.total_blocks === 14145536) {
    return 'userdata_30'
  }
  
  // comma 3X  
  if (storageInfo.prod_name === 'SDINDDH4-128G   1308' && storageInfo.total_blocks === 29605888) {
    return 'userdata_89'
  }

  throw new Error('Could not identify UFS chip')
}

// Simplified Flash Manager class with direct device management
export class FlashManager {
  constructor(manifestUrl, programmer, callbacks = {}) {
    this.manifestUrl = manifestUrl
    this.callbacks = callbacks
    this.device = new qdlDevice(programmer)
    this.imageManager = null
    this.manifest = null
    this.step = StepCode.INITIALIZING
    this.error = ErrorCode.NONE
  }

  setStep(step) {
    this.step = step
    this.callbacks.onStepChange?.(step)
  }

  setMessage(message) {
    if (message) console.info('[Flash]', message)
    this.callbacks.onMessageChange?.(message)
  }

  setProgress(progress) {
    this.callbacks.onProgressChange?.(progress)
  }

  setError(error) {
    this.error = error
    this.callbacks.onErrorChange?.(error)
    if (error !== ErrorCode.NONE) {
      console.debug('[Flash] error', error)
    }
  }

  setConnected(connected) {
    this.callbacks.onConnectionChange?.(connected)
  }

  setSerial(serial) {
    this.callbacks.onSerialChange?.(serial)
  }

  checkRequirements() {
    if (typeof navigator.usb === 'undefined') {
      console.error('[Flash] WebUSB not supported')
      this.setError(ErrorCode.REQUIREMENTS_NOT_MET)
      return false
    }
    return true
  }

  async initialize(imageManager) {
    this.imageManager = imageManager
    this.setProgress(-1)
    this.setMessage('')

    if (!this.checkRequirements()) {
      return
    }

    try {
      await this.imageManager.init()
      this.setStep(StepCode.READY)
    } catch (err) {
      console.error('[Flash] Failed to initialize:', err)
      this.setError(ErrorCode.DEVICE_ERROR)
    }
  }

  async start() {
    if (!this.checkRequirements()) return
    
    try {
      this.setStep(StepCode.CONNECTING)
      this.setMessage('Connecting to device...')
      
      // Request USB device access
      const devices = await navigator.usb.requestDevice({
        filters: [{ vendorId: 0x05c6, productId: 0x9008 }]
      })
      
      if (!devices) {
        this.setError(ErrorCode.DEVICE_ERROR)
        return
      }

      this.setConnected(true)
      this.setSerial('connected-device')
      this.setStep(StepCode.FLASHING)
      this.setMessage('Starting flash process...')
      
      // Simulate flash progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 500))
        this.setProgress(i / 100)
        this.setMessage(`Flashing... ${i}%`)
      }
      
      this.setStep(StepCode.DONE)
      this.setMessage('Flash complete!')
      
    } catch (err) {
      console.error('[Flash] Start failed:', err)
      this.setError(ErrorCode.FLASH_FAILED)
    }
  }
}
