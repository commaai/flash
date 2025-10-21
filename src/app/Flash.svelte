<script>
  import { onMount } from 'svelte'
  
  import { FlashManager, StepCode, ErrorCode } from '../utils/manager'
  import { ImageManager } from '../utils/image'
  import { isLinux } from '../utils/platform'
  import config from '../config'
  
  import bolt from '../assets/bolt.svg'
  import cable from '../assets/cable.svg'
  import deviceExclamation from '../assets/device_exclamation_c3.svg'
  import deviceQuestion from '../assets/device_question_c3.svg'
  import done from '../assets/done.svg'
  import exclamation from '../assets/exclamation.svg'
  import systemUpdate from '../assets/system_update_c3.svg'
  
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
      iconStyle: '',
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
    errors[ErrorCode.LOST_CONNECTION].description += ' Did you forget to unbind the device from qcserial?'
  }
  
  let step = StepCode.INITIALIZING
  let message = ''
  let progress = -1
  let error = ErrorCode.NONE
  let connected = false
  let serial = null
  
  let qdlManager = null
  let imageManager = null
  
  onMount(async () => {
    imageManager = new ImageManager()
    
    try {
      const programmerRes = await fetch(config.loader.url)
      const programmer = await programmerRes.arrayBuffer()
      
      qdlManager = new FlashManager(programmer, {
        onStepChange: (s) => step = s,
        onMessageChange: (m) => message = m,
        onProgressChange: (p) => progress = p,
        onErrorChange: (e) => error = e,
        onConnectionChange: (c) => connected = c,
        onSerialChange: (s) => serial = s
      })
      
      await qdlManager.initialize(imageManager)
    } catch (err) {
      console.error('Error initializing Flash manager:', err)
      error = ErrorCode.UNKNOWN
    }
  })
  
  function handleStart() {
    qdlManager?.start()
  }
  
  function handleRetry() {
    window.location.reload()
  }
  
  $: canStart = step === StepCode.READY && !error
  $: uiState = error ? { ...steps[step], ...errors[ErrorCode.UNKNOWN], ...errors[error] } : steps[step]
  $: ({ status, description, bgColor, icon, iconStyle = 'invert' } = uiState)
  
  $: title = (() => {
    if (message && !error) {
      let t = message + '...'
      if (progress >= 0) {
        t += ` (${(progress * 100).toFixed(0)}%)`
      }
      return t
    } else if (error === ErrorCode.STORAGE_SPACE) {
      return message
    } else {
      return status
    }
  })()
  
  // Warn user if they try to leave during flashing
  $: {
    const isFlashing = step >= StepCode.REPAIR_PARTITION_TABLES && step <= StepCode.FINALIZING
    
    if (typeof window !== 'undefined') {
      const handler = (event) => {
        event.preventDefault()
        return (event.returnValue = "Flash in progress. Are you sure you want to leave?")
      }
      
      if (isFlashing) {
        window.addEventListener("beforeunload", handler, { capture: true })
      } else {
        window.removeEventListener("beforeunload", handler, { capture: true })
      }
    }
  }
</script>

<div id="flash" class="relative flex flex-col gap-8 justify-center items-center h-full">
  {#if canStart}
  <button
    class="p-8 rounded-full {bgColor}"
    style="cursor: pointer"
    on:click={handleStart}
  >
    <img
      src={icon}
      alt="status icon"
      width="128"
      height="128"
      class="{iconStyle} {!error && step !== StepCode.DONE ? 'animate-pulse' : ''}"
    />
  </button>
  {:else}
  <div
    class="p-8 rounded-full {bgColor}"
    style="cursor: default"
  >
    <img
      src={icon}
      alt="status icon"
      width="128"
      height="128"
      class="{iconStyle} {!error && step !== StepCode.DONE ? 'animate-pulse' : ''}"
    />
  </div>
  {/if}
  
  <div 
    class="w-full max-w-3xl px-8 transition-opacity duration-300" 
    style="opacity: {progress === -1 ? 0 : 1}"
  >
    <div class="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        class="absolute top-0 bottom-0 left-0 w-full transition-all {bgColor}"
        style="transform: translateX({(progress === -1 || progress > 1 ? 1 : progress) * 100 - 100}%)"
      ></div>
    </div>
  </div>
  
  <span class="text-3xl dark:text-white font-mono font-light">{title}</span>
  <span class="text-xl dark:text-white px-8 max-w-xl">{description || ''}</span>
  
  {#if error}
    <button
      class="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
      on:click={handleRetry}
    >
      Retry
    </button>
  {/if}
  
  {#if connected}
    <div
      class="absolute bottom-0 m-0 lg:m-4 p-4 w-full sm:w-auto sm:min-w-[350px] sm:border sm:border-gray-200 dark:sm:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-md flex flex-row gap-2"
      style="left: 50%; transform: translate(-50%, -50%)"
    >
      <div class="flex flex-row gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 96 960 960"
          class="text-green-500 dark:text-[#51ff00]"
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
      <span class="text-gray-400">|</span>
      <div class="flex flex-row gap-2">
        <span>
          Serial:
          <span class="ml-2 font-mono">{serial || 'unknown'}</span>
        </span>
      </div>
    </div>
  {/if}
</div>
