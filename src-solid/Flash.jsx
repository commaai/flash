// Simplified SolidJS Flash component - direct signals, minimal effects
import { createSignal, createEffect, onCleanup } from 'solid-js'
import { FlashManager, StepCode, ErrorCode } from './utils/manager.js'
import { ProgressBar, DeviceState } from './components/FlashComponents.jsx'
import { createImageManager } from './utils/image.js'
import { isLinux } from './utils/platform.js'
import config from './config.js'

// Assets - simplified imports
import bolt from '../src/assets/bolt.svg'
import cable from '../src/assets/cable.svg'
import deviceExclamation from '../src/assets/device_exclamation_c3.svg'
import deviceQuestion from '../src/assets/device_question_c3.svg'
import done from '../src/assets/done.svg'
import exclamation from '../src/assets/exclamation.svg'
import systemUpdate from '../src/assets/system_update_c3.svg'

// Step configurations - static data
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
  },
  [StepCode.CONNECTING]: {
    status: 'Waiting for connection',
    description: 'Follow the instructions to connect your device',
    bgColor: 'bg-yellow-500',
    icon: cable,
  },
  [StepCode.FLASHING]: {
    status: 'Flashing device...',
    description: 'Do not unplug your device until complete',
    bgColor: 'bg-lime-400',
    icon: systemUpdate,
  },
  [StepCode.DONE]: {
    status: 'Done',
    description: 'Your device was flashed successfully',
    bgColor: 'bg-green-500',
    icon: done,
  },
}

const errors = {
  [ErrorCode.REQUIREMENTS_NOT_MET]: {
    status: 'Requirements not met',
    description: 'Your browser does not support WebUSB',
    bgColor: 'bg-red-500',
    icon: exclamation,
  },
  [ErrorCode.DEVICE_ERROR]: {
    status: 'Device error',
    description: 'Try a different cable or USB port',
    bgColor: 'bg-yellow-500',
    icon: deviceQuestion,
  },
  [ErrorCode.FLASH_FAILED]: {
    status: 'Flash failed',
    description: isLinux 
      ? 'Try again with a different cable. Did you unbind from qcserial?'
      : 'Try again with a different cable or computer',
    bgColor: 'bg-red-500',
    icon: deviceExclamation,
  },
}

export function Flash() {
  // Direct signals - no unnecessary state layers
  const [step, setStep] = createSignal(StepCode.INITIALIZING)
  const [message, setMessage] = createSignal('')
  const [progress, setProgress] = createSignal(-1)
  const [error, setError] = createSignal(ErrorCode.NONE)
  const [connected, setConnected] = createSignal(false)
  const [serial, setSerial] = createSignal(null)
  const [initError, setInitError] = createSignal(null) // Track initialization errors
  
  let flashManager = null
  const imageManager = createImageManager()

  // Single initialization effect - minimal and focused
  createEffect(async () => {
    try {
      await imageManager.init()
      const response = await fetch(config.loader.url)
      
      if (!response.ok) {
        throw new Error(`Failed to load programmer: ${response.status}`)
      }
      
      const programmer = await response.arrayBuffer()
      
      flashManager = new FlashManager(config.manifests.release, programmer, {
        onStepChange: setStep,
        onMessageChange: setMessage,
        onProgressChange: setProgress,
        onErrorChange: setError,
        onConnectionChange: setConnected,
        onSerialChange: setSerial
      })

      await flashManager.initialize(imageManager)
      setStep(StepCode.READY)
      setInitError(null) // Clear any previous init errors
    } catch (err) {
      console.error('Flash manager initialization failed:', err)
      setInitError(err.message)
      setError(ErrorCode.DEVICE_ERROR)
    }
  })

  // Minimal beforeunload effect - only when actively flashing
  createEffect(() => {
    const currentStep = step()
    if (currentStep === StepCode.FLASHING) {
      const handler = (event) => {
        event.preventDefault()
        return (event.returnValue = "Flash in progress. Are you sure you want to leave?")
      }
      window.addEventListener("beforeunload", handler, { capture: true })
      onCleanup(() => {
        window.removeEventListener("beforeunload", handler, { capture: true })
      })
    }
  })

  // Event handlers - direct and simple
  const handleStart = async () => {
    try {
      await flashManager?.start()
    } catch (err) {
      console.error('Flash start failed:', err)
      setError(ErrorCode.FLASH_FAILED)
    }
  }
  
  const handleRetry = () => window.location.reload()

  // Computed UI state - inline
  const uiState = () => {
    const currentStep = steps[step()]
    const currentError = error() !== ErrorCode.NONE ? errors[error()] : null
    return { ...currentStep, ...currentError }
  }

  const canStart = () => step() === StepCode.READY && error() === ErrorCode.NONE

  const title = () => {
    const msg = message()
    const prog = progress()
    const err = error()
    
    if (msg && err === ErrorCode.NONE) {
      return prog >= 0 ? `${msg}... (${(prog * 100).toFixed(0)}%)` : `${msg}...`
    }
    return uiState().status
  }

  const ui = uiState()
  const iconStyle = 'invert'

  return (
    <div id="flash" class="relative flex flex-col gap-8 justify-center items-center h-full">
      <div
        class={`p-8 rounded-full ${ui.bgColor}`}
        style={{ cursor: canStart() ? 'pointer' : 'default' }}
        onClick={canStart() ? handleStart : null}
      >
        <img
          src={ui.icon}
          alt="flash status"
          width={128}
          height={128}
          class={`${iconStyle} ${!error() && step() !== StepCode.DONE ? 'animate-pulse' : ''}`}
        />
      </div>
      
      <div 
        class="w-full max-w-3xl px-8 transition-opacity duration-300" 
        style={{ opacity: progress() === -1 ? 0 : 1 }}
      >
        <ProgressBar value={progress} bgColor={() => ui.bgColor} />
      </div>
      
      <span class="text-3xl dark:text-white font-mono font-light">{title()}</span>
      <span class="text-xl dark:text-white px-8 max-w-xl">{ui.description}</span>
      
      {/* Show initialization error if present */}
      {initError() && (
        <div class="text-red-500 dark:text-red-400 text-sm px-8 max-w-xl text-center">
          Initialization failed: {initError()}
        </div>
      )}
      
      {error() !== ErrorCode.NONE && (
        <button
          class="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
          onClick={handleRetry}
        >
          Retry
        </button>
      )}
      
      {connected() && <DeviceState serial={serial} />}
    </div>
  )
}
