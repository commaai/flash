import { FlashManager, StepCode, ErrorCode } from './utils/manager'
import { ImageManager } from './utils/image'
import { isLinux } from './utils/platform'
import config from './config'

// Import SVG assets
import bolt from './assets/bolt.svg'
import cable from './assets/cable.svg'
import deviceExclamation from './assets/device_exclamation_c3.svg'
import deviceQuestion from './assets/device_question_c3.svg'
import done from './assets/done.svg'
import exclamation from './assets/exclamation.svg'
import systemUpdate from './assets/system_update_c3.svg'

const steps = {
  [StepCode.INITIALIZING]: {
    status: 'Initializing...',
    bgColor: 'bg-gray-400 dark:bg-gray-700',
    icon: bolt,
  },
  [StepCode.READY]: {
    status: 'Tap to start',
    bgColor: 'bg-[#51ff00]',
    icon: bolt,
    iconStyle: 'no-invert',
  },
  [StepCode.CONNECTING]: {
    status: 'Waiting for connection',
    description: 'Follow the instructions to connect your device to your computer',
    bgColor: 'bg-yellow-500',
    icon: cable,
  },
  [StepCode.REPAIR_PARTITION_TABLES]: {
    status: 'Repairing partition tables...',
    description: 'Do not unplug your device until the process is complete',
    bgColor: 'bg-lime-400',
    icon: systemUpdate,
  },
  [StepCode.ERASE_DEVICE]: {
    status: 'Erasing device...',
    description: 'Do not unplug your device until the process is complete',
    bgColor: 'bg-lime-400',
    icon: systemUpdate,
  },
  [StepCode.FLASH_SYSTEM]: {
    status: 'Flashing device...',
    description: 'Do not unplug your device until the process is complete',
    bgColor: 'bg-lime-400',
    icon: systemUpdate,
  },
  [StepCode.FINALIZING]: {
    status: 'Finalizing...',
    description: 'Do not unplug your device until the process is complete',
    bgColor: 'bg-lime-400',
    icon: systemUpdate,
  },
  [StepCode.DONE]: {
    status: 'Done',
    description: 'Your device was flashed successfully. It should now boot into the openpilot setup.',
    bgColor: 'bg-green-500',
    icon: done,
  },
}

const errors = {
  [ErrorCode.UNKNOWN]: {
    status: 'Unknown error',
    description: 'An unknown error has occurred. Unplug your device, restart your browser and try again.',
    bgColor: 'bg-red-500',
    icon: exclamation,
  },
  [ErrorCode.REQUIREMENTS_NOT_MET]: {
    status: 'Requirements not met',
    description: 'Your system does not meet the requirements to flash your device. Make sure to use a browser which ' +
      'supports WebUSB and is up to date.',
  },
  [ErrorCode.STORAGE_SPACE]: {
    description: 'Your system does not have enough space available to download AGNOS. Your browser may be restricting' +
      ' the available space if you are in a private, incognito or guest session.',
  },
  [ErrorCode.UNRECOGNIZED_DEVICE]: {
    status: 'Unrecognized device',
    description: 'The device connected to your computer is not supported. Try using a different cable, USB port, or ' +
      'computer. If the problem persists, join the #hw-three-3x channel on Discord for help.',
    bgColor: 'bg-yellow-500',
    icon: deviceQuestion,
  },
  [ErrorCode.LOST_CONNECTION]: {
    status: 'Lost connection',
    description: 'The connection to your device was lost. Unplug your device and try again.',
    icon: cable,
  },
  [ErrorCode.REPAIR_PARTITION_TABLES_FAILED]: {
    status: 'Repairing partition tables failed',
    description: 'Your device\'s partition tables could not be repaired. Try using a different cable, USB port, or ' +
      'computer. If the problem persists, join the #hw-three-3x channel on Discord for help.',
    icon: deviceExclamation,
  },
  [ErrorCode.ERASE_FAILED]: {
    status: 'Erase failed',
    description: 'The device could not be erased. Try using a different cable, USB port, or computer. If the problem ' +
      'persists, join the #hw-three-3x channel on Discord for help.',
    icon: deviceExclamation,
  },
  [ErrorCode.FLASH_SYSTEM_FAILED]: {
    status: 'Flash failed',
    description: 'AGNOS could not be flashed to your device. Try using a different cable, USB port, or computer. If ' +
      'the problem persists, join the #hw-three-3x channel on Discord for help.',
    icon: deviceExclamation,
  },
}

if (isLinux) {
  // this is likely in StepCode.CONNECTING
  errors[ErrorCode.LOST_CONNECTION].description += ' Did you forget to unbind the device from qcserial?'
}

function beforeUnloadListener(event) {
  // NOTE: not all browsers will show this message
  event.preventDefault()
  return (event.returnValue = "Flash in progress. Are you sure you want to leave?")
}

export function flashComponent() {
  return {
    step: StepCode.INITIALIZING,
    message: '',
    progress: -1,
    error: ErrorCode.NONE,
    connected: false,
    serial: null,
    qdlManager: null,
    imageManager: null,

    async init() {
      // Initialize image manager
      this.imageManager = new ImageManager()
      
      try {
        const response = await fetch(config.loader.url)
        const programmer = await response.arrayBuffer()
        
        // Create QDL manager with callbacks that update Alpine state
        this.qdlManager = new FlashManager(config.manifests.release, programmer, {
          onStepChange: (step) => { this.step = step },
          onMessageChange: (message) => { this.message = message },
          onProgressChange: (progress) => { this.progress = progress },
          onErrorChange: (error) => { this.error = error },
          onConnectionChange: (connected) => { this.connected = connected },
          onSerialChange: (serial) => { this.serial = serial }
        })

        // Initialize the manager
        await this.qdlManager.initialize(this.imageManager)
      } catch (err) {
        console.error('Error initializing Flash manager:', err)
        this.error = ErrorCode.UNKNOWN
      }
    },

    // Computed properties
    get uiState() {
      const state = steps[this.step] || {}
      if (this.error) {
        Object.assign(state, errors[ErrorCode.UNKNOWN], errors[this.error])
      }
      return state
    },

    get title() {
      if (this.message && !this.error) {
        let title = this.message + '...'
        if (this.progress >= 0) {
          title += ` (${(this.progress * 100).toFixed(0)}%)`
        }
        return title
      } else if (this.error === ErrorCode.STORAGE_SPACE) {
        return this.message
      } else {
        return this.uiState.status
      }
    },

    get canStart() {
      return this.step === StepCode.READY && !this.error
    },

    get progressValue() {
      if (this.progress === -1 || this.progress > 100) return 100
      return this.progress * 100
    },

    // Methods
    handleStart() {
      if (this.qdlManager) {
        this.qdlManager.start()
      }
    },

    handleRetry() {
      window.location.reload()
    },

    // Watch for step changes to manage beforeUnload listener
    $watch: {
      step(newStep) {
        if (newStep >= StepCode.REPAIR_PARTITION_TABLES && newStep <= StepCode.FINALIZING) {
          window.addEventListener("beforeunload", beforeUnloadListener, { capture: true })
        } else {
          window.removeEventListener("beforeunload", beforeUnloadListener, { capture: true })
        }
      }
    }
  }
}