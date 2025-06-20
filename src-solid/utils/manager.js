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

// Simplified Flash Manager class
export class FlashManager {
  constructor(manifestUrl, programmer, callbacks = {}) {
    this.manifestUrl = manifestUrl
    this.callbacks = callbacks
    this.device = new qdlDevice(programmer)
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

  checkRequirements() {
    return typeof navigator.usb !== 'undefined'
  }

  async connect() {
    this.setStep(StepCode.CONNECTING)
    // Connection logic here - simplified
  }

  async flash() {
    this.setStep(StepCode.FLASHING)
    // Flash logic here - simplified  
  }
}
