import { useEffect, useRef, useState } from 'react'

import { FlashManager, StepCode, ErrorCode, DeviceType } from '../utils/manager'
import { useImageManager } from '../utils/image'
import { isLinux, isWindows } from '../utils/platform'
import config from '../config'

import comma from '../assets/comma.svg'
import bolt from '../assets/bolt.svg'
import cable from '../assets/cable.svg'
import deviceExclamation from '../assets/device_exclamation_c3.svg'
import deviceQuestion from '../assets/device_question_c3.svg'
import done from '../assets/done.svg'
import exclamation from '../assets/exclamation.svg'
import systemUpdate from '../assets/system_update_c3.svg'
import qdlPortsThree from '../assets/qdl-ports-three.svg'
import qdlPortsFour from '../assets/qdl-ports-four.svg'
import zadigCreateNewDevice from '../assets/zadig_create_new_device.png'
import zadigForm from '../assets/zadig_form.png'


const steps = {
  [StepCode.INITIALIZING]: {
    status: 'Initializing...',
    bgColor: 'bg-gray-400 dark:bg-gray-700',
    icon: bolt,
  },
  [StepCode.READY]: {
    // Landing page - handled separately
  },
  [StepCode.DEVICE_PICKER]: {
    // Device picker - handled separately
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


function LinearProgress({ value, barColor }) {
  if (value === -1 || value > 100) value = 100
  return (
    <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`absolute top-0 bottom-0 left-0 w-full transition-all ${barColor}`}
        style={{ transform: `translateX(${value - 100}%)` }}
      />
    </div>
  )
}


function DeviceState({ serial }) {
  return (
    <div
      className="absolute bottom-0 m-0 lg:m-4 p-4 w-full sm:w-auto sm:min-w-[350px] sm:border sm:border-gray-200 dark:sm:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-md flex flex-row gap-2"
      style={{ left: '50%', transform: 'translate(-50%, -50%)' }}
    >
      <div className="flex flex-row gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 96 960 960"
          className="text-green-500 dark:text-[#51ff00]"
          height="24"
          width="24"
        >
          <path
            fill="currentColor"
            d="M480 976q-32 0-52-20t-20-52q0-22 11-40t31-29V724H302q-24 0-42-18t-18-42V555q-20-9-31-26.609-11-17.608-11-40.108Q200 456 220 436t52-20q32 0 52 20t20 52.411Q344 511 333 528.5T302 555v109h148V324h-80l110-149 110 149h-80v340h148V560h-42V416h144v144h-42v104q0 24-18 42t-42 18H510v111q19.95 10.652 30.975 29.826Q552 884 552 904q0 32-20 52t-52 20Z"
          />
        </svg>
        Device connected
      </div>
      <span className="text-gray-400">|</span>
      <div className="flex flex-row gap-2">
        <span>
          Serial:
          <span className="ml-2 font-mono">{serial || 'unknown'}</span>
        </span>
      </div>
    </div>
  )
}


function beforeUnloadListener(event) {
  // NOTE: not all browsers will show this message
  event.preventDefault()
  return (event.returnValue = "Flash in progress. Are you sure you want to leave?")
}


// Stepper/breadcrumb component
function Stepper({ steps, currentStep, onStepClick }) {
  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-center gap-2">
      {steps.map((stepName, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isClickable = index < currentStep

        return (
          <div key={stepName} className="flex items-center">
            {index > 0 && (
              <div className={`w-8 h-0.5 mx-1 ${isCompleted ? 'bg-[#51ff00]' : 'bg-gray-300 dark:bg-gray-600'}`} />
            )}
            <button
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                isCurrent
                  ? 'bg-[#51ff00] text-black'
                  : isCompleted
                    ? 'bg-[#51ff00]/20 text-[#51ff00] hover:bg-[#51ff00]/30 cursor-pointer'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-default'
              }`}
            >
              {isCompleted && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {stepName}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Landing page component
function LandingPage({ onStart }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
      <img src={comma} alt="comma" width={80} height={80} className="dark:invert" />
      <div className="text-center">
        <h1 className="text-4xl font-bold dark:text-white mb-4">flash.comma.ai</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-md">
          Flash your comma back to a factory state
        </p>
      </div>
      <button
        onClick={onStart}
        className="px-12 py-4 text-2xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
      >
        Start
      </button>
    </div>
  )
}

// Connect instructions component - shows how to physically connect the device
function ConnectInstructions({ deviceType, onNext }) {
  const isCommaFour = deviceType === DeviceType.COMMA_4

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold dark:text-white mb-2">Connect your device</h2>
        <p className="text-gray-600 dark:text-gray-300">Follow these steps to put your device into QDL mode</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-center">
        <img
          src={isCommaFour ? qdlPortsFour : qdlPortsThree}
          alt={isCommaFour ? "comma four ports" : "comma 3/3X ports"}
          className="h-48 dark:invert"
        />

        <ol className="text-left space-y-3 text-lg dark:text-white">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-sm">1</span>
            <span>Unplug the device and wait for the LED to switch off</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-sm">2</span>
            <span>Connect the <strong>{isCommaFour ? 'right' : 'lower'}</strong> USB-C port <strong>(port 1)</strong> to your computer</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-sm">3</span>
            <span>Connect power to the <strong>{isCommaFour ? 'left' : 'upper'}</strong> port <strong>(port 2)</strong></span>
          </li>
        </ol>
      </div>

      <p className="text-gray-500 dark:text-gray-400 text-sm">
        Your device&apos;s screen will remain blank. This is normal.
      </p>

      <button
        onClick={onNext}
        className="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
      >
        Next
      </button>
    </div>
  )
}

// Linux unbind component
const DETACH_SCRIPT = 'for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done'

function LinuxUnbind({ onNext }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(DETACH_SCRIPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold dark:text-white mb-2">Unbind from qcserial</h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-lg">
          On Linux, devices in QDL mode are bound to the kernel&apos;s qcserial driver.
          Run this command to unbind it:
        </p>
      </div>

      <div className="relative w-full max-w-2xl">
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto font-mono">
          {DETACH_SCRIPT}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-400 text-white text-sm rounded transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <button
        onClick={onNext}
        className="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
      >
        Done
      </button>
    </div>
  )
}

// Device picker component
function DevicePicker({ onSelect }) {
  const [selected, setSelected] = useState(null)

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold dark:text-white mb-2">Which device are you flashing?</h2>
        <p className="text-gray-600 dark:text-gray-300">Select your comma device</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <button
          onClick={() => setSelected(DeviceType.COMMA_3)}
          className={`flex flex-col items-center gap-4 px-8 py-6 rounded-xl border-2 transition-all ${
            selected === DeviceType.COMMA_3
              ? 'border-[#51ff00] bg-[#51ff00]/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          <img src={qdlPortsThree} alt="comma 3/3X" className="h-24 dark:invert" />
          <span className="text-xl font-semibold dark:text-white">comma 3 / 3X</span>
        </button>

        <button
          onClick={() => setSelected(DeviceType.COMMA_4)}
          className={`flex flex-col items-center gap-4 px-8 py-6 rounded-xl border-2 transition-all ${
            selected === DeviceType.COMMA_4
              ? 'border-[#51ff00] bg-[#51ff00]/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          <img src={qdlPortsFour} alt="comma four" className="h-24 dark:invert" />
          <span className="text-xl font-semibold dark:text-white">comma four</span>
        </button>
      </div>

      <button
        onClick={() => selected && onSelect(selected)}
        disabled={!selected}
        className={`px-8 py-3 text-xl font-semibold rounded-full transition-colors ${
          selected
            ? 'bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black'
            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
        }`}
      >
        Next
      </button>
    </div>
  )
}

// Wizard step names for the stepper (UI-level steps, not flash manager steps)
// Note: Linux unbind step is inserted dynamically for Linux + comma 3/3X users
const WIZARD_STEPS_BASE = ['Device', 'Connect', 'Flash']
const WIZARD_STEPS_LINUX = ['Device', 'Connect', 'Unbind', 'Flash']

// Wizard step indices
const WizardStep = {
  DEVICE: 0,
  CONNECT: 1,
  UNBIND: 2,  // Only for Linux + comma 3/3X
  FLASH: -1,  // Computed dynamically based on whether unbind is shown
}

export default function Flash() {
  const [step, setStep] = useState(StepCode.INITIALIZING)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(-1)
  const [error, setError] = useState(ErrorCode.NONE)
  const [connected, setConnected] = useState(false)
  const [serial, setSerial] = useState(null)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [wizardStep, setWizardStep] = useState(-1) // -1 = landing

  const qdlManager = useRef(null)
  const imageManager = useImageManager()

  // Determine if we need to show the Linux unbind step
  const needsLinuxUnbind = isLinux && selectedDevice === DeviceType.COMMA_3
  const wizardSteps = needsLinuxUnbind ? WIZARD_STEPS_LINUX : WIZARD_STEPS_BASE
  const flashStepIndex = needsLinuxUnbind ? 3 : 2

  useEffect(() => {
    if (!imageManager.current) return

    fetch(config.loader.url)
      .then((res) => res.arrayBuffer())
      .then((programmer) => {
        // Create QDL manager with callbacks that update React state
        qdlManager.current = new FlashManager(programmer, {
          onStepChange: setStep,
          onMessageChange: setMessage,
          onProgressChange: setProgress,
          onErrorChange: setError,
          onConnectionChange: setConnected,
          onSerialChange: setSerial
        })

        // Initialize the manager
        return qdlManager.current.initialize(imageManager.current)
      })
      .catch((err) => {
        console.error('Error initializing Flash manager:', err)
        setError(ErrorCode.UNKNOWN)
      })
  }, [config, imageManager.current])

  // Handle user clicking start on landing page
  const handleStart = () => {
    setStep(StepCode.DEVICE_PICKER)
    setWizardStep(WizardStep.DEVICE)
  }

  // Handle device selection
  const handleDeviceSelect = (deviceType) => {
    setSelectedDevice(deviceType)
    setWizardStep(WizardStep.CONNECT)
  }

  // Handle connect instructions next
  const handleConnectNext = () => {
    if (isLinux && selectedDevice === DeviceType.COMMA_3) {
      setWizardStep(WizardStep.UNBIND)
    } else {
      // Go directly to flash
      setWizardStep(flashStepIndex)
      qdlManager.current?.start()
    }
  }

  // Handle linux unbind done
  const handleUnbindDone = () => {
    setWizardStep(flashStepIndex)
    qdlManager.current?.start()
  }

  // Handle going back in wizard
  const handleWizardBack = (toStep) => {
    if (toStep === WizardStep.DEVICE) {
      setStep(StepCode.DEVICE_PICKER)
      setWizardStep(WizardStep.DEVICE)
      setSelectedDevice(null)
    } else if (toStep === WizardStep.CONNECT) {
      setWizardStep(WizardStep.CONNECT)
    }
  }

  // Handle retry on error
  const handleRetry = () => window.location.reload()

  // Render landing page
  if (step === StepCode.READY && !error) {
    return <LandingPage onStart={handleStart} />
  }

  // Render device picker
  if (wizardStep === WizardStep.DEVICE && !error) {
    return (
      <div className="relative h-full">
        <Stepper steps={wizardSteps} currentStep={wizardStep} onStepClick={handleWizardBack} />
        <DevicePicker onSelect={handleDeviceSelect} />
      </div>
    )
  }

  // Render connect instructions
  if (wizardStep === WizardStep.CONNECT && !error) {
    return (
      <div className="relative h-full">
        <Stepper steps={wizardSteps} currentStep={wizardStep} onStepClick={handleWizardBack} />
        <ConnectInstructions deviceType={selectedDevice} onNext={handleConnectNext} />
      </div>
    )
  }

  // Render linux unbind
  if (wizardStep === WizardStep.UNBIND && !error) {
    return (
      <div className="relative h-full">
        <Stepper steps={wizardSteps} currentStep={wizardStep} onStepClick={handleWizardBack} />
        <LinuxUnbind onNext={handleUnbindDone} />
      </div>
    )
  }

  const uiState = steps[step] || {}
  if (error) {
    Object.assign(uiState, errors[ErrorCode.UNKNOWN], errors[error])
  }
  const { status, description, bgColor = 'bg-gray-400', icon = bolt, iconStyle = 'invert' } = uiState

  let title
  if (message && !error) {
    title = message + '...'
    if (progress >= 0) {
      title += ` (${(progress * 100).toFixed(0)}%)`
    }
  } else if (error === ErrorCode.STORAGE_SPACE) {
    title = message
  } else {
    title = status
  }

  // warn the user if they try to leave the page while flashing
  if (step >= StepCode.REPAIR_PARTITION_TABLES && step <= StepCode.FINALIZING) {
    window.addEventListener("beforeunload", beforeUnloadListener, { capture: true })
  } else {
    window.removeEventListener("beforeunload", beforeUnloadListener, { capture: true })
  }

  // Don't allow going back once flashing has started
  const canGoBack = step === StepCode.CONNECTING && !connected

  return (
    <div id="flash" className="relative flex flex-col gap-8 justify-center items-center h-full">
      {wizardStep >= 0 && (
        <Stepper
          steps={wizardSteps}
          currentStep={wizardStep}
          onStepClick={canGoBack ? handleWizardBack : () => {}}
        />
      )}
      <div className={`p-8 rounded-full ${bgColor}`}>
        <img
          src={icon}
          alt="status"
          width={128}
          height={128}
          className={`${iconStyle} ${!error && step !== StepCode.DONE ? 'animate-pulse' : ''}`}
        />
      </div>
      <div className="w-full max-w-3xl px-8 transition-opacity duration-300" style={{ opacity: progress === -1 ? 0 : 1 }}>
        <LinearProgress value={progress * 100} barColor={bgColor} />
      </div>
      <span className="text-3xl dark:text-white font-mono font-light">{title}</span>
      <span className="text-xl dark:text-white px-8 max-w-xl text-center">{description}</span>
      {error && (
        <button
          className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
          onClick={handleRetry}
        >
          Retry
        </button>
      )}
      {connected && <DeviceState serial={serial} />}
    </div>
  )
}
