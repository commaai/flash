<script>
  import { ErrorCode, FlashManager, StepCode, DeviceType } from "$lib/utils/manager";
  import { ImageManager } from "$lib/utils/image";
  import config from "$lib/config";
  import LinearProgress from "./_components/LinearProgress.svelte";
  import DeviceState from "./_components/DeviceState.svelte";

  // Step Pages
  import ConnectInstructions from "./_components/ConnectInstructions.svelte";
  import DebugInfo from "./_components/DebugInfo.svelte";
  import DevicePicker from "./_components/DevicePicker.svelte";
  import LandingPage from "./_components/LandingPage.svelte";
  import LinuxUnbind from "./_components/LinuxUnbind.svelte";
  import WebUSBConnect from "./_components/WebUSBConnect.svelte";
  import WindowsZadig from "./_components/WindowsZadig.svelte";
  import Stepper from "./Stepper.svelte";

  import bolt from "$lib/images/bolt.svg";
  import cable from "$lib/images/cable.svg";
  import deviceExclamation from "$lib/images/device_exclamation_c3.svg";
  import deviceQuestion from "$lib/images/device_question_c3.svg";
  import done from "$lib/images/done.svg";
  import exclamation from "$lib/images/exclamation.svg";
  import systemUpdate from "$lib/images/system_update_c3.svg";

  import {isWindows, isLinux} from "$lib/utils/platform.js"

  // Build wizard steps dynamically based on platform and device
  function getWizardSteps(selectedDevice) {
    const steps = ['Device']
    if (isWindows()) steps.push('Driver')
    steps.push('Connect')
    if (isLinux() && selectedDevice === DeviceType.COMMA_3) steps.push('Unbind')
    steps.push('Flash')
    return steps
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
      description: `
          This browser doesn&apos;t support WebUSB. Please use a compatible browser like 
          <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline font-semibold">
            Google Chrome</a>.`,
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

  if (isLinux()) {
    // this is likely in StepCode.CONNECTING
    errors[ErrorCode.LOST_CONNECTION].description +=
      " Did you forget to unbind the device from qcserial?";
  }

  function beforeUnloadListener(event) {
    // NOTE: not all browsers will show this message
    event.preventDefault();
    return (event.returnValue = "Flash in progress. Are you sure you want to leave?");
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

  let step = $state(StepCode.INITIALIZING);
  let message = $state("");
  let progress = $state(-1);
  let error = $state(ErrorCode.NONE);
  let showDebugInfo = $state(false);
  let connected = $state(false);
  let serial = $state(null);
  let selectedDevice = $state(null);
  let wizardScreen = $state('landing') // 'landing' | 'device' | 'zadig'

  let qdlManager = $state(null);
  let imageManager = $state(new ImageManager());

  const wizardSteps = $derived(getWizardSteps(selectedDevice))
  const wizardStep = $derived(screenToStep[wizardScreen] ? wizardSteps.indexOf(screenToStep[wizardScreen]) : -1)

  // setFunctions for FlashManager callbacks
  const setStep = (newStep) => step = newStep;
  const setMessage = (newMessage) => message = newMessage;
  const setProgress = (newProgress) => progress = newProgress;
  const setError = (newError) => error = newError;
  const setConnected = (isConnected) => connected = isConnected;
  const setSerial = (newSerial) => serial = newSerial;

  $effect(() => {
    if (!imageManager) return;

    fetch(config.loader.url)
      .then((res) => res.arrayBuffer())
      .then((programmer) => {
        // Create QDL manager with callbacks that update React state
        qdlManager = new FlashManager(programmer, {
          onStepChange: setStep,
          onMessageChange: setMessage,
          onProgressChange: setProgress,
          onErrorChange: setError,
          onConnectionChange: setConnected,
          onSerialChange: setSerial,
        });

        // Initialize the manager
        return qdlManager.initialize(imageManager);
      })
      .catch((err) => {
        console.error("Error initializing Flash manager:", err);
        error = ErrorCode.UNKNOWN;
      });
  });

  // Handle user clicking the start button
  //const canStart = $derived(step === StepCode.READY && !error);

  // Transition to flash screen when connected
  $effect(() => {
    if (connected && wizardScreen === 'webusb') {
      wizardScreen = 'flash'
    }
  })

  // Handle user clicking start on landing page
  const handleStart = () => {
    step = StepCode.DEVICE_PICKER
    wizardScreen = 'device'
  }

  // Handle device selection
  const handleDeviceSelect = (deviceType) => {
    selectedDevice = deviceType
    if (isWindows()) {
      wizardScreen = 'zadig'
    } else {
      wizardScreen = 'connect'
    }
  }

  // Handle zadig done
  const handleZadigDone = () => {
    wizardScreen = 'connect'
  }

  // Handle connect instructions next
  const handleConnectNext = () => {
    // On Linux with comma 3/3X, need to unbind qcserial BEFORE showing WebUSB picker
    if (isLinux() && selectedDevice === DeviceType.COMMA_3) {
      wizardScreen = 'unbind'
    } else {
      wizardScreen = 'webusb'
    }
  }

  // Handle linux unbind done
  const handleUnbindDone = () => {
    wizardScreen = 'webusb'
  }

  // Handle WebUSB connect button
  const handleWebUSBConnect = () => {
    qdlManager?.start()
  }

  // Handle going back in wizard
  const handleWizardBack = (toStep) => {
    const stepName = wizardSteps[toStep]
    if (stepName === 'Device') {
      step = StepCode.DEVICE_PICKER
      wizardScreen = 'device'
      selectedDevice = null
    } else if (stepName === 'Driver') {
      wizardScreen = 'zadig'
    } else if (stepName === 'Connect') {
      wizardScreen = 'connect'
    } else if (stepName === 'Unbind') {
      wizardScreen = 'unbind'
    }
  }

  // Handle retry on error
  const handleRetry = () => window.location.reload();

  const uiState = $derived.by(() => {
    const uiState = {...steps[step]};
    if (error) {
      Object.assign(uiState, errors[ErrorCode.UNKNOWN], errors[error]);
    }
    return uiState;
  });
  const { status, description, bgColor = 'bg-gray-400', icon = bolt, iconStyle = 'invert', hideRetry = false, showDiscordHelp = false } = $derived(uiState);

  let title = $derived.by(() => {
    if (message && !error) {
      let title = message + "...";
      if (progress >= 0) {
        title += ` (${(progress * 100).toFixed(0)}%)`;
      }
      return title;
    } else if (error === ErrorCode.STORAGE_SPACE) {
      return message;
    } else {
      return status;
    }
  });

  // Build Discord help link based on device type
  const discordChannel = $derived(selectedDevice === DeviceType.COMMA_4 ? 'hw-four' : 'hw-three-3x')

  // warn the user if they try to leave the page while flashing (but not if there's an error)
  $effect(() => {
    if (step >= StepCode.REPAIR_PARTITION_TABLES && step <= StepCode.FINALIZING && error === ErrorCode.NONE) {
      window.addEventListener("beforeunload", beforeUnloadListener, { capture: true });
    } else {
      window.removeEventListener("beforeunload", beforeUnloadListener, { capture: true });
    }
  });

  // Don't allow going back once flashing has started
  const canGoBack = $derived(step === StepCode.CONNECTING && !connected)
</script>

<!-- Render landing page -->
{#if wizardScreen === 'landing' && !(error && error != ErrorCode.REQUIREMENTS_NOT_MET)}
  <LandingPage onStart={handleStart} />

<!-- Render device picker -->
{:else if wizardScreen === 'device' && !error}
  <div class="relative h-full">
    <Stepper steps={wizardSteps} currentStep={wizardStep} onStepClick={handleWizardBack} />
    <DevicePicker onSelect={handleDeviceSelect} />
  </div>

<!-- Render Windows Zadig driver setup -->
{:else if wizardScreen === 'zadig' && !error}
  <div class="relative h-full">
    <Stepper steps={wizardSteps} currentStep={wizardStep} onStepClick={handleWizardBack} />
    <WindowsZadig deviceType={selectedDevice} onNext={handleZadigDone} />
  </div>

<!-- Render connect instructions -->
{:else if wizardScreen === 'connect' && !error}
  <div class="relative h-full">
    <Stepper steps={wizardSteps} currentStep={wizardStep} onStepClick={handleWizardBack} />
    <ConnectInstructions deviceType={selectedDevice} onNext={handleConnectNext} />
  </div>

<!-- Render linux unbind -->
{:else if wizardScreen === 'unbind' && !error}
  <div class="relative h-full">
    <Stepper steps={wizardSteps} currentStep={wizardStep} onStepClick={handleWizardBack} />
    <LinuxUnbind onNext={handleUnbindDone} />
  </div>

<!-- Render WebUSB connection screen -->
{:else if wizardScreen === 'webusb' && !error}
  <div class="relative h-full">
      <Stepper steps={wizardSteps} currentStep={wizardStep} onStepClick={handleWizardBack} />
      <WebUSBConnect onConnect={handleWebUSBConnect} />
    </div>

{:else}
  <div id="flash" class="wizard-screen relative flex flex-col gap-8 justify-center items-center h-full pt-16 pb-12 overflow-y-auto overflow-x-hidden">
    {#if wizardStep >= 0 && error != ErrorCode.REQUIREMENTS_NOT_MET}
      <Stepper
        steps={wizardSteps}
        currentStep={wizardStep}
        onStepClick={canGoBack ? handleWizardBack : () => {}}
      />
    {/if}
    <div class={`p-8 rounded-full ${bgColor}`}>
      <img
        src={icon}
        alt="status"
        width={128}
        height={128}
        class={`${iconStyle} ${!error && step !== StepCode.DONE ? 'animate-pulse' : ''}`}
      />
    </div>
    <div class="w-full max-w-3xl px-8 transition-opacity duration-300" style:opacity={ progress === -1 ? 0 : 1 }>
      <LinearProgress value={progress * 100} barColor={bgColor} />
    </div>
    <span class="text-3xl font-mono font-light">{title}</span>
    <span class="text-xl px-8 max-w-xl text-center">
      {@html description}
      {#if showDiscordHelp}
        If the problem persists, join <a href="https://discord.comma.ai" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline font-semibold">#{discordChannel}</a> on Discord for help.
      {/if}
      {#if error !== ErrorCode.NONE && hideRetry && !showDebugInfo}
        <button
          onclick={() => showDebugInfo = true}
          class="block mx-auto mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
        >
          show debug info
        </button>
      {/if}
    </span>
    {#if error !== ErrorCode.NONE && !hideRetry}
      <button
        class="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
        onclick={handleRetry}
      >
        Retry
      </button>
    {/if}
    {#if connected}
      <DeviceState {serial} />
    {/if}
    {#if error !== ErrorCode.NONE && (!hideRetry || showDebugInfo)}
      <DebugInfo
        error={error}
        step={step}
        selectedDevice={selectedDevice}
        serial={serial}
        message={message}
        onclose={hideRetry ? () => showDebugInfo = false : undefined}
      />
    {/if}
  </div>
{/if}
