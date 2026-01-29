import { createEffect, createSignal, onMount, For, Index } from 'solid-js'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/browser'

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
import comma3XProduct from '../assets/comma3X.webp'
import comma4Product from '../assets/four_screen_on.webp'

// All images that need to be preloaded
const preloadImages = [
  comma, bolt, cable, deviceExclamation, deviceQuestion, done, exclamation,
  systemUpdate, qdlPortsThree, qdlPortsFour, zadigCreateNewDevice, zadigForm,
  comma3XProduct, comma4Product
]

// Hidden preload component - renders all images offscreen so they're decoded and ready
function ImagePreloader() {
  return (
    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden' }}>
      <For each={preloadImages}>
        {(src) => <img src={src} alt="" />}
      </For>
    </div>
  )
}

// Capture console logs for debug reports and telemetry
const consoleLogs = []
const MAX_LOGS = 500
const originalConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug }
  ;['log', 'warn', 'error', 'info', 'debug'].forEach(level => {
    console[level] = (...args) => {
      consoleLogs.push({ level, time: new Date().toISOString(), message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') })
      if (consoleLogs.length > MAX_LOGS) consoleLogs.shift()
      originalConsole[level]?.(...args)
    }
  })

// Debug info component for error reporting
function DebugInfo(props) {
  const [copied, setCopied] = createSignal(false)

  const getDebugReport = () => {
    const deviceName = props.selectedDevice === DeviceType.COMMA_4 ? 'comma four' : props.selectedDevice === DeviceType.COMMA_3 ? 'comma 3/3X' : 'unknown'
    const errorName = Object.keys(ErrorCode).find(k => ErrorCode[k] === props.error) || 'UNKNOWN'
    const stepName = Object.keys(StepCode).find(k => StepCode[k] === props.step) || 'UNKNOWN'

    // Get detailed OS info
    const ua = navigator.userAgent
    let os = 'Unknown'
    if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11'
    else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1'
    else if (ua.includes('Windows NT 6.2')) os = 'Windows 8'
    else if (ua.includes('Windows NT 6.1')) os = 'Windows 7'
    else if (ua.includes('Mac OS X')) {
      const match = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/)
      os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS'
    } else if (ua.includes('Linux')) {
      os = 'Linux'
      if (ua.includes('Ubuntu')) os += ' (Ubuntu)'
      else if (ua.includes('Fedora')) os += ' (Fedora)'
      else if (ua.includes('Debian')) os += ' (Debian)'
    } else if (ua.includes('CrOS')) os = 'ChromeOS'

    // Detect sandboxed browsers
    const sandboxHints = []
    if (ua.includes('snap')) sandboxHints.push('Snap')
    if (ua.includes('Flatpak')) sandboxHints.push('Flatpak')
    if (navigator.userAgentData?.brands?.some(b => b.brand.includes('snap'))) sandboxHints.push('Snap')
    // Snap Chrome often has restricted /dev access which breaks WebUSB
    if (isLinux && !navigator.usb) sandboxHints.push('WebUSB unavailable - possibly sandboxed')
    const sandbox = sandboxHints.length ? sandboxHints.join(', ') : 'None detected'

    return `## Bug Report - flash.comma.ai

**Device:** ${deviceName}
**Serial:** ${props.serial || 'N/A'}
**Error:** ${errorName}
**Step:** ${stepName}
**Last Message:** ${props.message || 'N/A'}

**OS:** ${os}
**Sandbox:** ${sandbox}
**Browser:** ${navigator.userAgent}
**URL:** ${window.location.href}
**Time:** ${new Date().toISOString()}

<details>
<summary>Console Logs</summary>

\`\`\`
${consoleLogs.slice(-30).map(l => `[${l.time}] [${l.level}] ${l.message}`).join('\n')}
\`\`\`

</details>
`
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getDebugReport())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div class="mt-6 w-full max-w-xl mx-4 p-4 bg-gray-100 rounded-lg text-left text-sm overflow-hidden">
      <div class="flex justify-between items-start mb-3 gap-2">
        <p class="text-gray-600 text-sm">
          Copy this debug info and paste it in{' '}
          <a href="https://discord.comma.ai" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">Discord</a>
          {' '}or{' '}
          <a href="https://github.com/commaai/flash/issues/new" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">GitHub Issues</a>.
        </p>
        {props.onClose && (
          <button
            onClick={props.onClose}
            class="text-gray-400 hover:text-gray-600 flex-shrink-0"
            title="Hide debug info"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <pre class="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-32 sm:max-h-48 font-mono debug-scrollbar whitespace-pre-wrap break-all">
        {getDebugReport()}
      </pre>
      <button
        onClick={handleCopy}
        class="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
      >
        {copied() ? 'Copied!' : 'Copy Debug Info'}
      </button>
    </div>
  )
}


const steps = {
  [StepCode.INITIALIZING]: {
    status: 'Initializing...',
    bgColor: 'bg-gray-400',
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
    description: 'Your device was flashed successfully!',
    bgColor: 'bg-green-500',
    icon: done,
  },
}

const errors = {
  [ErrorCode.UNKNOWN]: {
    status: 'Unknown error',
    description: 'An unknown error has occurred. Unplug your device, restart your browser and try again.',
    bgColor: 'bg-yellow-500',
    icon: exclamation,
  },
  [ErrorCode.REQUIREMENTS_NOT_MET]: {
    status: 'Unsupported Browser',
    description: (
      <>
        This browser doesn&apos;t support WebUSB. Please use a compatible browser like{' '}
        <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline font-semibold">
          Google Chrome
        </a>.
      </>
    ),
    hideRetry: true,
  },
  [ErrorCode.STORAGE_SPACE]: {
    description: 'Your system does not have enough space available to download the OS images. Your browser may be restricting' +
      ' the available space if you are in a private, incognito or guest session.',
    hideRetry: true,
  },
  [ErrorCode.UNRECOGNIZED_DEVICE]: {
    status: 'Unrecognized device',
    description: 'The device connected to your computer is not supported. Try using a different cable, USB port, or computer.',
    bgColor: 'bg-yellow-500',
    icon: deviceQuestion,
    showDiscordHelp: true,
  },
  [ErrorCode.LOST_CONNECTION]: {
    status: 'Lost connection',
    description: 'The connection to your device was lost. Unplug your device and try again.',
    icon: cable,
  },
  [ErrorCode.REPAIR_PARTITION_TABLES_FAILED]: {
    status: 'Repairing partition tables failed',
    description: 'Your device\'s partition tables could not be repaired. Try using a different cable, USB port, or computer.',
    icon: deviceExclamation,
    showDiscordHelp: true,
  },
  [ErrorCode.ERASE_FAILED]: {
    status: 'Erase failed',
    description: 'The device could not be erased. Try using a different cable, USB port, or computer.',
    icon: deviceExclamation,
    showDiscordHelp: true,
  },
  [ErrorCode.FLASH_SYSTEM_FAILED]: {
    status: 'Flash failed',
    description: 'Try using a different cable, USB port, browser, or computer.',
    icon: deviceExclamation,
    showDiscordHelp: true,
  },
}

// Note: qcserial unbind hint is added dynamically in the component based on device type


function LinearProgress(props) {
  const value = () => (props.value === -1 || props.value > 100) ? 100 : props.value
  return (
    <div class="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        class={`absolute top-0 bottom-0 left-0 w-full transition-all ${props.barColor}`}
        style={{ transform: `translateX(${value() - 100}%)` }}
      />
    </div>
  )
}


function DeviceState(props) {
  return (
    <div class="mt-8 p-3 px-4 border border-gray-200 bg-white text-black rounded-md flex flex-row items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 96 960 960"
        class="text-green-500"
        height="20"
        width="20"
      >
        <path
          fill="currentColor"
          d="M480 976q-32 0-52-20t-20-52q0-22 11-40t31-29V724H302q-24 0-42-18t-18-42V555q-20-9-31-26.609-11-17.608-11-40.108Q200 456 220 436t52-20q32 0 52 20t20 52.411Q344 511 333 528.5T302 555v109h148V324h-80l110-149 110 149h-80v340h148V560h-42V416h144v144h-42v104q0 24-18 42t-42 18H510v111q19.95 10.652 30.975 29.826Q552 884 552 904q0 32-20 52t-52 20Z"
        />
      </svg>
      <span class="font-mono">Device serial: {props.serial || 'unknown'}</span>
    </div>
  )
}


function beforeUnloadListener(event) {
  // NOTE: not all browsers will show this message
  event.preventDefault()
  return (event.returnValue = "Flash in progress. Are you sure you want to leave?")
}


// Stepper/breadcrumb component
function Stepper(props) {
  return (
    <div class="absolute top-0 left-0 right-0 p-4 flex items-center justify-center gap-2">
      <Index each={props.steps}>
        {(stepName, index) => {
          const isCompleted = () => index < props.currentStep
          const isCurrent = () => index === props.currentStep
          const isClickable = () => index < props.currentStep

          return (
            <div class="flex items-center">
              {index > 0 && (
                <div class={`w-8 h-0.5 mx-1 ${isCompleted() ? 'bg-[#51ff00]' : 'bg-gray-300'}`} />
              )}
              <button
                onClick={() => isClickable() && props.onStepClick(index)}
                disabled={!isClickable()}
                class={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isCurrent()
                  ? 'bg-[#51ff00] text-black'
                  : isCompleted()
                    ? 'bg-[#51ff00]/80 text-black hover:bg-[#51ff00] cursor-pointer'
                    : 'bg-gray-200 text-gray-500 cursor-default'
                  }`}
              >
                {isCompleted() && (
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {stepName()}
              </button>
            </div>
          )
        }}
      </Index>
    </div>
  )
}

// Landing page component
function LandingPage(props) {
  return (
    <div class="wizard-screen flex flex-col items-center justify-center h-full gap-8 p-8">
      <img src={comma} alt="comma" width={80} height={80} />
      <div class="text-center">
        <h1 class="text-4xl font-bold mb-4">flash.comma.ai</h1>
        <p class="text-xl text-gray-600 max-w-md">
          Restore your comma device to a fresh factory state
        </p>
      </div>
      <button
        onClick={props.onStart}
        class="px-12 py-4 text-2xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
      >
        Start
      </button>
    </div>
  )
}

// Windows Zadig driver setup component
const PRODUCT_ID = '9008'

function WindowsZadig(props) {
  const vendorId = props.deviceType === DeviceType.COMMA_4 ? '3801' : '05C6'
  return (
    <div class="wizard-screen flex flex-col items-center justify-center h-full gap-6 p-8 overflow-y-auto">
      <div class="text-center">
        <h2 class="text-3xl font-bold mb-2">Install USB Driver</h2>
        <p class="text-xl text-gray-600">Windows requires a driver to communicate with your device</p>
      </div>

      <div class="max-w-2xl space-y-6 text-lg">
        <div class="flex gap-4">
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-base">1</span>
          <div >
            <p>Download and run <a href="https://zadig.akeo.ie/" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline font-semibold">Zadig</a></p>
          </div>
        </div>

        <div class="flex gap-4">
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-base">2</span>
          <div >
            <p class="mb-2">Under <code class="bg-gray-200 px-1 rounded">Device</code> in the menu bar, select <code class="bg-gray-200 px-1 rounded">Create New Device</code></p>
            <img src={zadigCreateNewDevice} alt="Zadig Create New Device" class="rounded-lg border border-gray-300" width={460} />
          </div>
        </div>

        <div class="flex gap-4">
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-base">3</span>
          <div >
            <p class="mb-2">Fill in the form:</p>
            <ul class="list-none space-y-1 ml-2 mb-2">
              <li><span class="text-gray-500 mr-2">a.</span>Name: <code class="bg-gray-200 px-1 rounded">{props.deviceType === DeviceType.COMMA_4 ? 'comma four' : 'comma 3/3X'}</code></li>
              <li><span class="text-gray-500 mr-2">b.</span>USB ID: <code class="bg-gray-200 px-1 rounded">{vendorId}</code> and <code class="bg-gray-200 px-1 rounded">{PRODUCT_ID}</code></li>
            </ul>
            <img src={zadigForm} alt="Zadig Form" class="rounded-lg border border-gray-300" width={460} />
          </div>
        </div>

        <div class="flex gap-4">
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-base">4</span>
          <div >
            <p>Click <code class="bg-gray-200 px-1 rounded">Install Driver</code></p>
          </div>
        </div>
      </div>

      <button
        onClick={props.onNext}
        class="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
      >
        Done
      </button>
    </div>
  )
}

// Connect instructions component - shows how to physically connect the device
function ConnectInstructions(props) {
  const isCommaFour = props.deviceType === DeviceType.COMMA_4

  return (
    <div class="wizard-screen flex flex-col items-center justify-center h-full gap-6 p-8">
      <div class="text-center">
        <h2 class="text-3xl font-bold mb-2">Connect your device</h2>
        <p class="text-xl text-gray-600">Follow these steps to prepare your device for flashing</p>
      </div>

      <div class="flex flex-col md:flex-row gap-8 items-center">
        <img
          src={isCommaFour ? qdlPortsFour : qdlPortsThree}
          alt={isCommaFour ? "comma four ports" : "comma three and 3X ports"}
          class="h-48"
        />

        <ol class="text-left space-y-3 text-lg">
          <li class="flex gap-3">
            <span class="flex-shrink-0 w-7 h-7 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-sm">A</span>
            <span>Unplug the device</span>
          </li>
          {!isCommaFour && (
            <li class="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-sm">B</span>
              <span>Wait for the light on the back to fully turn off</span>
            </li>
          )}
          <li class="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-sm">{isCommaFour ? 'B' : 'C'}</span>
            <span>Connect <strong>port 1</strong> to your computer</span>
          </li>
          <li class="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-sm">{isCommaFour ? 'C' : 'D'}</span>
            <span>Connect <strong>port 2</strong> to your computer or a power brick</span>
          </li>
        </ol>
      </div>

      <p class="text-gray-500 text-xl">
        Your device&apos;s screen will remain blank. This is normal.
      </p>

      <button
        onClick={props.onNext}
        class="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
      >
        Next
      </button>
    </div>
  )
}

// Linux unbind component
const DETACH_SCRIPT = 'for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done'

function LinuxUnbind(props) {
  const [copied, setCopied] = createSignal(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(DETACH_SCRIPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div class="wizard-screen flex flex-col items-center justify-center h-full gap-6 p-8">
      <div class="text-center">
        <h2 class="text-3xl font-bold mb-2">Unbind from qcserial</h2>
        <p class="text-xl text-gray-600 max-w-lg">
          On Linux, devices in QDL mode are bound to the kernel&apos;s qcserial driver.
          Run this command in a terminal to unbind it:
        </p>
      </div>

      <div class="relative w-full max-w-2xl">
        <pre class="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto font-mono">
          {DETACH_SCRIPT}
        </pre>
        <button
          onClick={handleCopy}
          class="absolute top-2 right-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-400 text-white text-sm rounded transition-colors"
        >
          {copied() ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <button
        onClick={props.onNext}
        class="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
      >
        Done
      </button>
    </div>
  )
}

// WebUSB connection screen - shows while waiting for user to select device
function WebUSBConnect(props) {
  return (
    <div class="wizard-screen flex flex-col items-center justify-center h-full gap-6 p-8">
      <div class="p-8 rounded-full bg-yellow-500">
        <img src={cable} alt="connect" width={128} height={128} class="invert" />
      </div>
      <div class="text-center">
        <h2 class="text-3xl font-bold mb-2">Select your device</h2>
        <p class="text-xl text-gray-600 max-w-lg">
          Click the button below to open the device selector, then choose <code class="px-2 py-0.5 bg-[#51ff00] rounded font-mono text-black font-semibold">QUSB_BULK_CID</code> from the list.
        </p>
      </div>
      <button
        onClick={props.onConnect}
        class="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
      >
        Connect
      </button>
    </div>
  )
}

// Device picker component
// Device picker component
function DevicePicker(props) {
  const [selected, setSelected] = createSignal(null)

  return (
    <div class="wizard-screen flex flex-col items-center justify-center h-full gap-8 p-8">
      <div class="text-center">
        <h2 class="text-3xl font-bold mb-2">Which device are you flashing?</h2>
        <p class="text-xl text-gray-600">Select your comma device</p>
      </div>

      <div class="flex flex-col sm:flex-row gap-6">
        <button
          onClick={() => setSelected(DeviceType.COMMA_3)}
          class={`flex flex-col items-center gap-4 px-8 py-6 rounded-xl border-2 transition-colors ${selected() === DeviceType.COMMA_3
            ? 'border-[#51ff00] bg-[#51ff00]/10'
            : 'border-gray-300 hover:border-gray-400'
            }`}
        >
          <img src={comma3XProduct} alt="comma three or comma 3X" class="h-32 object-contain" />
          <span class="text-xl font-semibold">comma three<br />comma 3X</span>
        </button>

        <button
          onClick={() => setSelected(DeviceType.COMMA_4)}
          class={`flex flex-col items-center gap-4 px-8 py-6 rounded-xl border-2 transition-colors ${selected() === DeviceType.COMMA_4
            ? 'border-[#51ff00] bg-[#51ff00]/10'
            : 'border-gray-300 hover:border-gray-400'
            }`}
        >
          <img src={comma4Product} alt="comma four" class="h-32 object-contain" />
          <span class="text-xl font-semibold">comma four</span>
        </button>
      </div>

      <button
        onClick={() => selected() && props.onSelect(selected())}
        disabled={!selected()}
        class={`px-8 py-3 text-xl font-semibold rounded-full transition-colors ${selected()
          ? 'bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black'
          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
      >
        Next
      </button>
    </div>
  )
}

// Build wizard steps dynamically based on platform and device
function getWizardSteps(selectedDevice) {
  const steps = ['Device']
  if (isWindows) steps.push('Driver')
  steps.push('Connect')
  if (isLinux && selectedDevice === DeviceType.COMMA_3) steps.push('Unbind')
  steps.push('Flash')
  return steps
}

// Map screen names to step names
const screenToStep = {
  device: 'Device',
  zadig: 'Driver',
  connect: 'Connect',
  unbind: 'Unbind',
  webusb: 'Flash',
  flash: 'Flash',
}

export default function Flash() {
  const [step, setStep] = createSignal(StepCode.INITIALIZING)
  const [message, setMessage] = createSignal('')
  const [progress, setProgress] = createSignal(-1)
  const [error, setError] = createSignal(ErrorCode.NONE)
  const [showDebugInfo, setShowDebugInfo] = createSignal(false)
  const [connected, setConnected] = createSignal(false)
  const [serial, setSerial] = createSignal(null)
  const [selectedDevice, setSelectedDevice] = createSignal(null)
  const [wizardScreen, setWizardScreen] = createSignal('landing') // 'landing', 'device', 'zadig', 'connect', 'unbind', 'webusb', 'flash'
  let reportSent = false

  let qdlManager = null
  const imageManager = useImageManager()

  // Build steps based on current platform and selected device
  const wizardSteps = () => getWizardSteps(selectedDevice())
  const wizardStep = () => screenToStep[wizardScreen()] ? wizardSteps().indexOf(screenToStep[wizardScreen()]) : -1

  onMount(() => {
    if (!imageManager.current) return

    fetch(config.loader.url)
      .then((res) => res.arrayBuffer())
      .then((programmer) => {
        // Create QDL manager with callbacks that update state
        qdlManager = new FlashManager(programmer, {
          onStepChange: setStep,
          onMessageChange: setMessage,
          onProgressChange: setProgress,
          onErrorChange: setError,
          onConnectionChange: setConnected,
          onSerialChange: setSerial,
        })

        // Initialize the manager
        return qdlManager.initialize(imageManager.current)
      })
      .catch((err) => {
        console.error('Error initializing Flash manager:', err)
        setError(ErrorCode.UNKNOWN)
      })
  })

  // Helper to send a single pass/fail summary
  function sendSessionSummary(result) {
    if (reportSent) return
    reportSent = true

    const errorName = Object.keys(ErrorCode).find(k => ErrorCode[k] === error()) || 'NONE'
    const stepName = Object.keys(StepCode).find(k => StepCode[k] === step()) || 'UNKNOWN'

    // PostHog
    posthog.capture('flash_session', {
      result,
      serial: serial(),
      device_type: selectedDevice(),
      error_code: errorName,
      step: stepName,
    })

    // Sentry
    Sentry.captureMessage('flash_session', {
      level: result === 'pass' ? 'info' : 'error',
      tags: { result, serial: serial(), device_type: selectedDevice(), error_code: errorName, step: stepName },
      extra: { console_tail: consoleLogs.slice(-200) },
    })
  }

  // Send report on failure
  createEffect(() => {
    if (error() !== ErrorCode.NONE && !reportSent) {
      sendSessionSummary('fail')
    }
  })

  // Send report on success
  createEffect(() => {
    if (step() === StepCode.DONE && error() === ErrorCode.NONE && !reportSent) {
      sendSessionSummary('pass')
    }
  })

  // Transition to flash screen when connected
  createEffect(() => {
    if (connected() && wizardScreen() === 'webusb') {
      setWizardScreen('flash')
    }
  })

  // Handle user clicking start on landing page
  const handleStart = () => {
    setStep(StepCode.DEVICE_PICKER)
    setWizardScreen('device')
  }

  // Handle device selection
  const handleDeviceSelect = (deviceType) => {
    setSelectedDevice(deviceType)
    if (isWindows) {
      setWizardScreen('zadig')
    } else {
      setWizardScreen('connect')
    }
  }

  // Handle zadig done
  const handleZadigDone = () => {
    setWizardScreen('connect')
  }

  // Handle connect instructions next
  const handleConnectNext = () => {
    // On Linux with comma 3/3X, need to unbind qcserial BEFORE showing WebUSB picker
    if (isLinux && selectedDevice() === DeviceType.COMMA_3) {
      setWizardScreen('unbind')
    } else {
      setWizardScreen('webusb')
    }
  }

  // Handle linux unbind done
  const handleUnbindDone = () => {
    setWizardScreen('webusb')
  }

  // Handle WebUSB connect button
  const handleWebUSBConnect = () => {
    qdlManager?.start()
  }

  // Handle going back in wizard
  const handleWizardBack = (toStep) => {
    const stepName = wizardSteps()[toStep]
    if (stepName === 'Device') {
      setStep(StepCode.DEVICE_PICKER)
      setWizardScreen('device')
      setSelectedDevice(null)
    } else if (stepName === 'Driver') {
      setWizardScreen('zadig')
    } else if (stepName === 'Connect') {
      setWizardScreen('connect')
    } else if (stepName === 'Unbind') {
      setWizardScreen('unbind')
    }
  }

  // Handle retry on error
  const handleRetry = () => window.location.reload()

  // warn the user if they try to leave the page while flashing (but not if there's an error)
  createEffect(() => {
    if (step() >= StepCode.REPAIR_PARTITION_TABLES && step() <= StepCode.FINALIZING && error() === ErrorCode.NONE) {
      window.addEventListener("beforeunload", beforeUnloadListener, { capture: true })
    } else {
      window.removeEventListener("beforeunload", beforeUnloadListener, { capture: true })
    }
  })

  // Render landing page
  if (wizardScreen() === 'landing' && !error()) {
    return (
      <>
        <ImagePreloader />
        <LandingPage onStart={handleStart} />
      </>
    )
  }

  // Render device picker
  if (wizardScreen() === 'device' && !error()) {
    return (
      <div class="relative h-full">
        <Stepper steps={wizardSteps()} currentStep={wizardStep()} onStepClick={handleWizardBack} />
        <DevicePicker onSelect={handleDeviceSelect} />
      </div>
    )
  }

  // Render Windows Zadig driver setup
  if (wizardScreen() === 'zadig' && !error()) {
    return (
      <div class="relative h-full">
        <Stepper steps={wizardSteps()} currentStep={wizardStep()} onStepClick={handleWizardBack} />
        <WindowsZadig deviceType={selectedDevice()} onNext={handleZadigDone} />
      </div>
    )
  }

  // Render connect instructions
  if (wizardScreen() === 'connect' && !error()) {
    return (
      <div class="relative h-full">
        <Stepper steps={wizardSteps()} currentStep={wizardStep()} onStepClick={handleWizardBack} />
        <ConnectInstructions deviceType={selectedDevice()} onNext={handleConnectNext} />
      </div>
    )
  }

  // Render linux unbind
  if (wizardScreen() === 'unbind' && !error()) {
    return (
      <div class="relative h-full">
        <Stepper steps={wizardSteps()} currentStep={wizardStep()} onStepClick={handleWizardBack} />
        <LinuxUnbind onNext={handleUnbindDone} />
      </div>
    )
  }

  // Render WebUSB connection screen
  if (wizardScreen() === 'webusb' && !error()) {
    return (
      <div class="relative h-full">
        <Stepper steps={wizardSteps()} currentStep={wizardStep()} onStepClick={handleWizardBack} />
        <WebUSBConnect onConnect={handleWebUSBConnect} />
      </div>
    )
  }

  const uiState = steps[step()] || {}
  if (error() !== ErrorCode.NONE) {
    Object.assign(uiState, errors[ErrorCode.UNKNOWN], errors[error()])
  }
  let { status, description, bgColor = 'bg-gray-400', icon = bolt, iconStyle = 'invert', hideRetry = false, showDiscordHelp = false } = uiState

  // Add qcserial hint for Linux + comma 3/3X only
  if (error() === ErrorCode.LOST_CONNECTION && isLinux && selectedDevice() === DeviceType.COMMA_3) {
    description += ' Did you forget to unbind the device from qcserial?'
  }

  // Build Discord help link based on device type
  const discordChannel = selectedDevice() === DeviceType.COMMA_4 ? 'hw-four' : 'hw-three-3x'
  const discordLink = showDiscordHelp && (
    <> If the problem persists, join <a href="https://discord.comma.ai" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline font-semibold">#{discordChannel}</a> on Discord for help.</>
  )


  let title = ''
  if (message() && error() === ErrorCode.NONE) {
    title = message() + '...'
    if (progress() >= 0) {
      title += ` (${(progress() * 100).toFixed(0)}%)`
    }
  } else if (error() === ErrorCode.STORAGE_SPACE) {
    title = message()
  } else {
    title = status
  }

  // Don't allow going back once flashing has started
  const canGoBack = step() === StepCode.CONNECTING && !connected()

  return (
    <div id="flash" class="wizard-screen relative flex flex-col gap-8 justify-center items-center h-full pt-16 pb-12 overflow-y-auto overflow-x-hidden">
      {wizardStep() >= 0 && (
        <Stepper
          steps={wizardSteps()}
          currentStep={wizardStep()}
          onStepClick={canGoBack ? handleWizardBack : () => { }}
        />
      )}
      <div class={`p-8 rounded-full ${bgColor}`}>
        <img
          src={icon}
          alt="status"
          width={128}
          height={128}
          class={`${iconStyle} ${error() === ErrorCode.NONE && step() !== StepCode.DONE ? 'animate-pulse' : ''}`}
        />
      </div>
      <div class="w-full max-w-3xl px-8 transition-opacity duration-300" style={{ opacity: progress() === -1 ? 0 : 1 }}>
        <LinearProgress value={progress() * 100} barColor={bgColor} />
      </div>
      <span class="text-3xl font-mono font-light">{title}</span>
      <span class="text-xl px-8 max-w-xl text-center">
        {description}{discordLink}
        {error() !== ErrorCode.NONE && hideRetry && !showDebugInfo() && (
          <button
            onClick={() => setShowDebugInfo(true)}
            class="block mx-auto mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            show debug info
          </button>
        )}
      </span>
      {error() !== ErrorCode.NONE && !hideRetry && (
        <button
          class="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
          onClick={handleRetry}
        >
          Retry
        </button>
      )}
      {connected() && <DeviceState serial={serial()} />}
      {error() !== ErrorCode.NONE && (!hideRetry || showDebugInfo()) && (
        <DebugInfo
          error={error()}
          step={step()}
          selectedDevice={selectedDevice()}
          serial={serial()}
          message={message()}
          onClose={hideRetry ? () => setShowDebugInfo(false) : undefined}
        />
      )}
    </div>
  )
}
