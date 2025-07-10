import { Component } from './base.js';
import { appState } from '../state.js';
import { FlashManager, StepCode, ErrorCode } from '../../utils/manager.js';
import { ImageManager } from '../../utils/image.js';
import { isLinux } from '../../utils/platform.js';
import config from '../../config.js';

// Import SVG assets
import bolt from '../../assets/bolt.svg';
import cable from '../../assets/cable.svg';
import deviceExclamation from '../../assets/device_exclamation_c3.svg';
import deviceQuestion from '../../assets/device_question_c3.svg';
import done from '../../assets/done.svg';
import exclamation from '../../assets/exclamation.svg';
import systemUpdate from '../../assets/system_update_c3.svg';

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
};

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
};

if (isLinux) {
  // this is likely in StepCode.CONNECTING
  errors[ErrorCode.LOST_CONNECTION].description += ' Did you forget to unbind the device from qcserial?';
}

function beforeUnloadListener(event) {
  // NOTE: not all browsers will show this message
  event.preventDefault();
  return (event.returnValue = "Flash in progress. Are you sure you want to leave?");
}

export class FlashComponent extends Component {
  constructor(container, options = {}) {
    super(container, options);

    this.qdlManager = null;
    this.imageManager = null;
    this.stateUnsubscribe = null;

    this.state = {
      step: StepCode.INITIALIZING,
      message: '',
      progress: -1,
      error: ErrorCode.NONE,
      connected: false,
      serial: null,
      loading: true
    };
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize image manager
      this.imageManager = new ImageManager();

      // Fetch loader
      const response = await fetch(config.loader.url);
      const programmer = await response.arrayBuffer();

      // Create QDL manager with callbacks
      this.qdlManager = new FlashManager(config.manifests.release, programmer, {
        onStepChange: (step) => {
          this.setState({ step });
          appState.setState({ step });
        },
        onMessageChange: (message) => {
          this.setState({ message });
          appState.setState({ message });
        },
        onProgressChange: (progress) => {
          this.setState({ progress });
          appState.setState({ progress });
        },
        onErrorChange: (error) => {
          this.setState({ error });
          appState.setState({ error });
        },
        onConnectionChange: (connected) => {
          this.setState({ connected });
          appState.setState({ connected });
        },
        onSerialChange: (serial) => {
          this.setState({ serial });
          appState.setState({ serial });
        }
      });

      // Initialize the manager
      await this.qdlManager.initialize(this.imageManager);

      this.setState({ loading: false });
    } catch (err) {
      console.error('Error initializing Flash manager:', err);
      this.setState({
        error: ErrorCode.UNKNOWN,
        loading: false
      });
      appState.setState({ error: ErrorCode.UNKNOWN });
    }
  }

  renderLinearProgress(value, barColor) {
    if (value === -1 || value > 100) value = 100;
    return `
      <div class="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          class="absolute top-0 bottom-0 left-0 w-full transition-all ${barColor}"
          style="transform: translateX(${value - 100}%)"
        ></div>
      </div>
    `;
  }

  renderDeviceState(serial) {
    if (!this.state.connected) return '';
    return `
      <div
        class="absolute bottom-0 m-0 lg:m-4 p-4 w-full sm:w-auto sm:min-w-[350px] sm:border sm:border-gray-200 dark:sm:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-md flex flex-row gap-2"
        style="left: 50%; transform: translate(-50%, -50%);"
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
            <span class="ml-2 font-mono">${serial || 'unknown'}</span>
          </span>
        </div>
      </div>
    `;
  }

  render() {
    if (this.state.loading) {
      return `  
        <div class="flex items-center justify-center h-full">
          <p class="text-black dark:text-white">Loading...</p>
        </div>
      `;
    }

    const { step, message, progress, error, connected, serial } = this.state;

    const uiState = { ...steps[step] };
    if (error) {
      Object.assign(uiState, errors[ErrorCode.UNKNOWN], errors[error]);
    }

    const { status, description, bgColor, icon, iconStyle = 'invert' } = uiState;

    let title;
    if (message && !error) {
      title = message + '...';
      if (progress >= 0) {
        title += ` (${(progress * 100).toFixed(0)}%)`;
      }
    } else if (error === ErrorCode.STORAGE_SPACE) {
      title = message;
    } else {
      title = status;
    }

    const canStart = step === StepCode.READY && !error;
    const showProgress = progress !== -1;
    const showRetry = !!error;

    return `
      <div id="flash" class="relative flex flex-col gap-8 justify-center items-center h-full">
        <div
          class="p-8 rounded-full ${bgColor} ${canStart ? 'cursor-pointer' : 'cursor-default'}"
          data-action="${canStart ? 'start' : ''}"
        >
          <img
            src="${icon}"
            alt="flash icon"
            width="128"
            height="128"
            class="${iconStyle} ${!error && step !== StepCode.DONE ? 'animate-pulse' : ''}"
          />
        </div>
        <div class="w-full max-w-3xl px-8 transition-opacity duration-300" style="opacity: ${showProgress ? 1 : 0}">
          ${this.renderLinearProgress(progress * 100, bgColor)}
        </div>
        <span class="text-3xl dark:text-white font-mono font-light">${title}</span>
        <span class="text-xl dark:text-white px-8 max-w-xl">${description || ''}</span>
        ${showRetry ? `
          <button
            class="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
            data-action="retry"
          >
            Retry
          </button>
        ` : ''}
        ${this.renderDeviceState(serial)}
      </div>
    `;
  }

  attachEventListeners() {
    // Handle start button click
    const startElement = this.querySelector('[data-action="start"]');
    if (startElement) {
      this.addEventListener(startElement, 'click', () => {
        this.handleStart();
      });
    }

    // Handle retry button click
    const retryElement = this.querySelector('[data-action="retry"]');
    if (retryElement) {
      this.addEventListener(retryElement, 'click', () => {
        this.handleRetry();
      });
    }

    // Handle beforeunload warning
    this.updateBeforeUnloadListener();
  }

  updateBeforeUnloadListener() {
    const { step } = this.state;
    if (step >= StepCode.REPAIR_PARTITION_TABLES && step <= StepCode.FINALIZING) {
      window.addEventListener("beforeunload", beforeUnloadListener, { capture: true });
    } else {
      window.removeEventListener("beforeunload", beforeUnloadListener, { capture: true });
    }
  }

  handleStart() {
    if (this.qdlManager) {
      this.qdlManager.start();
    }
  }

  handleRetry() {
    window.location.reload();
  }

  setState(updates) {
    super.setState(updates);
    // Update beforeunload listener when step changes
    if (updates.step !== undefined) {
      this.updateBeforeUnloadListener();
    }
  }

  cleanup() {
    super.cleanup();

    // Remove beforeunload listener
    window.removeEventListener("beforeunload", beforeUnloadListener, { capture: true });

    // Clean up managers
    if (this.qdlManager) {
      this.qdlManager.cleanup && this.qdlManager.cleanup();
    }
    if (this.imageManager) {
      this.imageManager.cleanup && this.imageManager.cleanup();
    }
  }
}