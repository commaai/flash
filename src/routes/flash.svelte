<script>
   import { FlashManager, StepCode, ErrorCode } from '../utils/manager.js'
   import { isLinux } from '../utils/platform'
   import { ImageManager } from '../utils/image'
   import { onMount } from 'svelte'
   import config from '../config.js'

   import bolt from '../assets/bolt.svg'
   import cable from '../assets/cable.svg'
   import systemUpdate from '../assets/system_update_c3.svg'
   import done from '../assets/done.svg'
   import exclamation from '../assets/exclamation.svg'
   import deviceQuestion from '../assets/device_question_c3.svg'
   import deviceExclamation from '../assets/device_exclamation_c3.svg'
   

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
      // this is likely in StepCode.CONNECTING
      errors[ErrorCode.LOST_CONNECTION].description += ' Did you forget to unbind the device from qcserial?';
   }

   function beforeUnloadListener(event) {
      // NOTE: not all browsers will show this message
      event.preventDefault();
      return (event.returnValue = "Flash in progress. Are you sure you want to leave?")
   }

   let step = StepCode.INITIALIZING;
   let message = '';
   let progress = -1;
   let error = ErrorCode.NONE;
   let connected = false;
   let serial = null;
   let qdlManager = null;
   const imageManager = new ImageManager();

   function setStep(newStep) {
      step = newStep;
   }

   function setMessage(newMessage) {
      message = newMessage;
   }

   function setProgress(newProgress) {
      progress = newProgress;
   }

   function setError(newError) {
      error = newError;
   }

   function setConnected(newConnected) {
      connected = newConnected;
   }

   function setSerial(newSerial) {
      serial = newSerial;
   }

   let isInitialized = false;
   $: {
      (() => {
         console.log('Reactive statement triggered:', { imageManager: !!imageManager, config: !!config, isInitialized });

         if (!imageManager || !config || isInitialized) return

         isInitialized = true;

         fetch(config.loader.url)
            .then((res) => res.arrayBuffer())
            .then((programmer) => {
               console.log('Programmer loaded, creating FlashManager...');

               qdlManager = new FlashManager(config.manifests.release, programmer, {
                  onStepChange: setStep,
                  onMessageChange: setMessage,
                  onProgressChange: setProgress,
                  onErrorChange: setError,
                  onConnectionChange: setConnected,
                  onSerialChange: setSerial
               });
               return qdlManager.initialize(imageManager);
            })
            .catch((err) => {
               console.error('Error initializing Flash manager:', err);
               error = ErrorCode.UNKNOWN;
               isInitialized = false;
            });
      })()
   }

   // Handle user clicking the start button
   let canStart = false;
   $: {
      canStart = step === StepCode.READY && !error;
   }
   
   $: handleStart = () => qdlManager?.start();


   // Handle retry on error
   const handleRetry = () => window.location.reload();

   let uiState = step;
   let status, description, bgColor, icon, iconStyle;

   $: { 
      uiState = steps[step]
      if (error) {
         Object.assign(uiState, errors[ErrorCode.UNKNOWN], errors[error]);
      }
      ({ status, description, bgColor, icon, iconStyle = 'invert' } = uiState);
   }

   let title

   $:{
      if (message && !error) {
         title = message + '...';
         if (progress >= 0) {
            title += ` (${(progress * 100).toFixed(0)}%)`
         }
      } else if (error === ErrorCode.STORAGE_SPACE) {
         title = message;
      } else {
         title = status;
      }
   }
   

   // warn the user if they try to leave the page while flashing
   $: {
      if (step >= StepCode.REPAIR_PARTITION_TABLES && step <= StepCode.FINALIZING) {
         window.addEventListener("beforeunload", beforeUnloadListener, { capture: true });
      } else {
         window.removeEventListener("beforeunload", beforeUnloadListener, { capture: true });
      }
   }

   let value;
   $: {
      value = progress * 100;
      if (value === -1 || value > 100) value = 100;
   }

</script>
<div id="flash" class="relative flex flex-col gap-8 justify-center items-center h-full">
   <div
      class={`p-8 rounded-full ${bgColor}`}
      style="cursor: {canStart ? 'pointer' : 'default'}"
      on:click={canStart ? handleStart : null}
   >
      <img
         src={icon}
         alt="cable"
         width={128}
         height={128}
         loading="lazy"
         class={`${iconStyle} ${!error && step !== StepCode.DONE ? 'animate-pulse' : ''}`}
      />
   </div>

   <div class="w-full max-w-3xl px-8 transition-opacity duration-300" style="opacity: {progress === -1 ? 0 : 1}">
      <div class="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
         <div
            class={`absolute top-0 bottom-0 left-0 w-full transition-all ${bgColor}`}
            style="transform: translateX({value - 100}%)"
         />
      </div>
   </div>

   <span class="text-3xl dark:text-white font-mono font-light">{title}</span>
   <span class="text-xl dark:text-white px-8 max-w-xl">{description}</span>

   {#if error}
      <button
         class="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
         on:click={handleRetry}
      >
          Retry
      </button>
   {/if}

</div>

