<script>
  import { browser } from "$app/environment";
  import { ErrorCode, FlashManager, StepCode } from "$lib/utils/manager";
  import { ImageManager } from "$lib/utils/image";
  import config from "$lib/config";
  import LinearProgress from "./LinearProgress.svelte";
  import DeviceState from "./DeviceState.svelte";

  import bolt from "$lib/images/bolt.svg";
  import cable from "$lib/images/cable.svg";
  import deviceExclamation from "$lib/images/device_exclamation_c3.svg";
  import deviceQuestion from "$lib/images/device_question_c3.svg";
  import done from "$lib/images/done.svg";
  import exclamation from "$lib/images/exclamation.svg";
  import systemUpdate from "$lib/images/system_update_c3.svg";

  let isLinux = () => globalThis.navigator.userAgent.toLowerCase().includes("linux") ?? false;

  const steps = {
    [StepCode.INITIALIZING]: {
      status: "Initializing...",
      bgColor: "bg-gray-400 dark:bg-gray-700",
      icon: bolt,
    },
    [StepCode.READY]: {
      status: "Tap to start",
      bgColor: "bg-[#51ff00]",
      icon: bolt,
      iconStyle: "",
    },
    [StepCode.CONNECTING]: {
      status: "Waiting for connection",
      description: "Follow the instructions to connect your device to your computer",
      bgColor: "bg-yellow-500",
      icon: cable,
    },
    [StepCode.REPAIR_PARTITION_TABLES]: {
      status: "Repairing partition tables...",
      description: "Do not unplug your device until the process is complete",
      bgColor: "bg-lime-400",
      icon: systemUpdate,
    },
    [StepCode.ERASE_DEVICE]: {
      status: "Erasing device...",
      description: "Do not unplug your device until the process is complete",
      bgColor: "bg-lime-400",
      icon: systemUpdate,
    },
    [StepCode.FLASH_SYSTEM]: {
      status: "Flashing device...",
      description: "Do not unplug your device until the process is complete",
      bgColor: "bg-lime-400",
      icon: systemUpdate,
    },
    [StepCode.FINALIZING]: {
      status: "Finalizing...",
      description: "Do not unplug your device until the process is complete",
      bgColor: "bg-lime-400",
      icon: systemUpdate,
    },
    [StepCode.DONE]: {
      status: "Done",
      description:
        "Your device was flashed successfully. It should now boot into the openpilot setup.",
      bgColor: "bg-green-500",
      icon: done,
    },
  };

  const errors = {
    [ErrorCode.UNKNOWN]: {
      status: "Unknown error",
      description:
        "An unknown error has occurred. Unplug your device, restart your browser and try again.",
      bgColor: "bg-red-500",
      icon: exclamation,
    },
    [ErrorCode.REQUIREMENTS_NOT_MET]: {
      status: "Requirements not met",
      description:
        "Your system does not meet the requirements to flash your device. Make sure to use a browser which " +
        "supports WebUSB and is up to date.",
    },
    [ErrorCode.STORAGE_SPACE]: {
      description:
        "Your system does not have enough space available to download AGNOS. Your browser may be restricting" +
        " the available space if you are in a private, incognito or guest session.",
    },
    [ErrorCode.UNRECOGNIZED_DEVICE]: {
      status: "Unrecognized device",
      description:
        "The device connected to your computer is not supported. Try using a different cable, USB port, or " +
        "computer. If the problem persists, join the #hw-three-3x channel on Discord for help.",
      bgColor: "bg-yellow-500",
      icon: deviceQuestion,
    },
    [ErrorCode.LOST_CONNECTION]: {
      status: "Lost connection",
      description: "The connection to your device was lost. Unplug your device and try again.",
      icon: cable,
    },
    [ErrorCode.REPAIR_PARTITION_TABLES_FAILED]: {
      status: "Repairing partition tables failed",
      description:
        "Your device's partition tables could not be repaired. Try using a different cable, USB port, or " +
        "computer. If the problem persists, join the #hw-three-3x channel on Discord for help.",
      icon: deviceExclamation,
    },
    [ErrorCode.ERASE_FAILED]: {
      status: "Erase failed",
      description:
        "The device could not be erased. Try using a different cable, USB port, or computer. If the problem " +
        "persists, join the #hw-three-3x channel on Discord for help.",
      icon: deviceExclamation,
    },
    [ErrorCode.FLASH_SYSTEM_FAILED]: {
      status: "Flash failed",
      description:
        "AGNOS could not be flashed to your device. Try using a different cable, USB port, or computer. If " +
        "the problem persists, join the #hw-three-3x channel on Discord for help.",
      icon: deviceExclamation,
    },
  };

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

  let step = $state(StepCode.INITIALIZING);
  let message = $state("");
  let progress = $state(-1);
  let error = $state(ErrorCode.NONE);
  let connected = $state(false);
  let serial = $state(null);

  let qdlManager = $state(null);
  let imageManager = $state(new ImageManager());

  // setFunctions for FlashManager callbacks
  const setStep = (newStep) => step = newStep;
  const setMessage = (newMessage) => message = newMessage;
  const setProgress = (newProgress) => progress = newProgress;
  const setError = (newError) => error = newError;
  const setConnected = (isConnected) => connected = isConnected;
  const setSerial = (newSerial) => serial = newSerial;

  $effect(() => {
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
  const handleStart = () => qdlManager?.start();
  const canStart = $derived(step === StepCode.READY && !error);

  // Handle retry on error
  const handleRetry = () => window.location.reload();

  const uiState = $derived.by(() => {
    const uiState = {...steps[step]};
    if (error) {
      Object.assign(uiState, errors[ErrorCode.UNKNOWN], errors[error]);
    }
    return uiState;
  });
  const { status, description, bgColor, icon, iconStyle = "invert" } = $derived(uiState);

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

  // warn the user if they try to leave the page while flashing
  $effect(() => {
    if (step >= StepCode.REPAIR_PARTITION_TABLES && step <= StepCode.FINALIZING) {
      window.addEventListener("beforeunload", beforeUnloadListener, { capture: true });
    } else {
      window.removeEventListener("beforeunload", beforeUnloadListener, { capture: true });
    }
  });
</script>

<div id="flash" class="relative flex flex-col gap-8 justify-center items-center h-full">
  <button
    type="button"
    class={`p-8 rounded-full ${bgColor} ${canStart ? "cursor-pointer" : ""}`}
    onclick={handleStart}
    disabled={!canStart}
  >
    <img
      src={icon}
      alt="cable"
      width={128}
      height={128}
      class={`${iconStyle} ${!error && step !== StepCode.DONE ? "animate-pulse" : ""}`}
    />
  </button>
  <div
    class="w-full max-w-3xl px-8 transition-opacity duration-300"
    style:opacity={progress === -1 ? 0 : 1}
  >
    <LinearProgress value={progress * 100} barColor={bgColor} />
  </div>
  <span class="text-3xl dark:text-white font-mono font-light">{title}</span>
  <span class="text-xl dark:text-white px-8 max-w-xl">{description}</span>
  {#if error}
    <button
      class="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
      onclick={handleRetry}
    >
      Retry
    </button>
  {/if}

  {#if connected}
    <DeviceState {serial} />
  {/if}
</div>
