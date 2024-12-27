import { createElement, Fragment } from 'preact'
import { useCallback, useState } from 'preact/hooks'

import { Step, Error, useQdl } from '../utils/flash.js'

const steps = {
  [Step.INITIALIZING]: {
    status: 'Initializing...',
    bgColor: 'bg-gray-400 dark:bg-gray-700',
    icon: 'src/assets/cloud.svg',
  },
  [Step.READY]: {
    status: 'Ready',
    description: 'Tap the button above to begin',
    bgColor: 'bg-[#51ff00]',
    icon: 'src/assets/bolt.svg',
    iconStyle: '',
  },
  [Step.CONNECTING]: {
    status: 'Waiting for connection',
    description: 'Follow the instructions to connect your device to your computer',
    bgColor: 'bg-yellow-500',
    icon: 'src/assets/cable.svg',
  },
  [Step.DOWNLOADING]: {
    status: 'Downloading...',
    bgColor: 'bg-blue-500',
    icon: 'src/assets/cloud_download.svg',
  },
  [Step.UNPACKING]: {
    status: 'Unpacking...',
    bgColor: 'bg-blue-500',
    icon: 'src/assets/cloud_download.svg',
  },
  [Step.FLASHING]: {
    status: 'Flashing device...',
    description: 'Do not unplug your device until the process is complete.',
    bgColor: 'bg-lime-400',
    icon: 'src/assets/system_update_c3.svg',
  },
  [Step.ERASING]: {
    status: 'Erasing device...',
    bgColor: 'bg-lime-400',
    icon: 'src/assets/system_update_c3.svg',
  },
  [Step.DONE]: {
    status: 'Done',
    description: 'Your device has been updated successfully. You can now unplug the all cables from your device, '
      + 'and wait for the light to stop blinking then plug the power cord in again. '
      + ' To complete the system reset, follow the instructions on your device.',
    bgColor: 'bg-green-500',
    icon: 'src/assets/done.svg',
  },
}

const errors = {
  [Error.UNKNOWN]: {
    status: 'Unknown error',
    description: 'An unknown error has occurred. Unplug your device and wait for 20s. ' +
      'Restart your browser and try again.',
    bgColor: 'bg-red-500',
    icon: 'src/assets/exclamation.svg',
  },
  [Error.UNRECOGNIZED_DEVICE]: {
    status: 'Unrecognized device',
    description: 'The device connected to your computer is not supported.',
    bgColor: 'bg-yellow-500',
    icon: 'src/assets/device_question_c3.svg',
  },
  [Error.LOST_CONNECTION]: {
    status: 'Lost connection',
    description: 'The connection to your device was lost. Check that your cables are connected properly and try again. ' +
      'Unplug your device and wait for around 20s.',
    icon: 'src/assets/cable.svg',
  },
  [Error.DOWNLOAD_FAILED]: {
    status: 'Download failed',
    description: 'The system image could not be downloaded. Unplug your device and wait for 20s. ' +
      'Check your internet connection and try again.',
    icon: 'src/assets/cloud_error.svg',
  },
  [Error.CHECKSUM_MISMATCH]: {
    status: 'Download mismatch',
    description: 'The system image downloaded does not match the expected checksum. Try again.',
    icon: 'src/assets/frame_alert.svg',
  },
  [Error.FLASH_FAILED]: {
    status: 'Flash failed',
    description: 'The system image could not be flashed to your device. Try using a different cable, USB port, or ' +
      'computer. If the problem persists, join the #hw-three-3x channel on Discord for help.',
    icon: 'src/assets/device_exclamation_c3.svg',
  },
  [Error.ERASE_FAILED]: {
    status: 'Erase failed',
    description: 'The device could not be erased. Try using a different cable, USB port, or computer. If the problem ' +
      'persists, join the #hw-three-3x channel on Discord for help.',
    icon: 'src/assets/device_exclamation_c3.svg',
  },
  [Error.REQUIREMENTS_NOT_MET]: {
    status: 'Requirements not met',
    description: 'Your system does not meet the requirements to flash your device. Make sure to use a browser which ' +
      'supports WebUSB and is up to date.',
  },
}

const detachScript = [
  "for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e \"$d\" ] && echo -n \"$(basename $d)\" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done"
];

const isLinux = navigator.userAgent.toLowerCase().includes('linux');

function LinearProgress({ value, barColor }) {
  if (value === -1 || value > 100) value = 100;

  return createElement("div", { className: "relative w-full h-2 bg-gray-200 rounded-full overflow-hidden" },
    createElement("div", {
      className: `absolute top-0 bottom-0 left-0 w-full transition-all ${barColor}`,
      style: { transform: `translateX(${value - 100}%)` },
    })
  );
}


function USBIndicator() {
  return createElement("div", { className: "flex flex-row gap-2" },
    createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 96 960 960",
      className: "text-green-500 dark:text-[#51ff00]",
      height: "24",
      width: "24",
    },
      createElement("path", {
        fill: "currentColor",
        d: "M480 976q-32 0-52-20t-20-52q0-22 11-40t31-29V724H302q-24 0-42-18t-18-42V555q-20-9-31-26.609-11-17.608-11-40.108Q200 456 220 436t52-20q32 0 52 20t20 52.411Q344 511 333 528.5T302 555v109h148V324h-80l110-149 110 149h-80v340h148V560h-42V416h144v144h-42v104q0 24-18 42t-42 18H510v111q19.95 10.652 30.975 29.826Q552 884 552 904q0 32-20 52t-52 20Z",
      })
    ),
    createElement("span", null, "Device connected")
  );
}


function SerialIndicator({ serial }) {
  return createElement("div", { className: "flex flex-row gap-2" },
    createElement("span", null, "Serial:", createElement("span", { className: "ml-2 font-mono" }, serial || "unknown"))
  );
}


function DeviceState({ serial }) {
  return createElement("div", {
    className: "absolute bottom-0 m-0 lg:m-4 p-4 w-full sm:w-auto sm:min-w-[350px] sm:border sm:border-gray-200 dark:sm:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-md flex flex-row gap-2",
    style: { left: "50%", transform: "translate(-50%, -50%)" },
  },
    createElement(USBIndicator),
    createElement("span", { className: "text-gray-400" }, "|"),
    createElement(SerialIndicator, { serial })
  );
}


function beforeUnloadListener(event) {
  // NOTE: not all browsers will show this message
  event.preventDefault()
  return (event.returnValue = "Flash in progress. Are you sure you want to leave?")
}


export default function Flash() {
  const {
    step,
    message,
    progress,
    error,

    onContinue,
    onRetry,

    connected,
    serial,
  } = useQdl()

  const handleContinue = useCallback(() => {
    onContinue?.()
  }, [onContinue])

  const handleRetry = useCallback(() => {
    onRetry?.()
  }, [onRetry])

  const uiState = steps[step]
  if (error) {
    Object.assign(uiState, errors[Error.UNKNOWN], errors[error])
  }
  const { status, description, bgColor, icon, iconStyle = 'invert' } = uiState

  let title
  if (message && !error) {
    title = message + '...'
    if (progress >= 0) {
      title += ` (${(progress * 100).toFixed(0)}%)`
    }
  } else {
    title = status
  }

  // warn the user if they try to leave the page while flashing
  if (Step.DOWNLOADING <= step && step <= Step.ERASING) {
    window.addEventListener("beforeunload", beforeUnloadListener, { capture: true })
  } else {
    window.removeEventListener("beforeunload", beforeUnloadListener, { capture: true })
  }

  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1000);
  };

  return createElement("div", { id: "flash", className: "relative flex flex-col gap-8 justify-center items-center h-full" },
    createElement("div", {
      className: `p-8 rounded-full ${bgColor}`,
      style: { cursor: onContinue ? "pointer" : "default" },
      onClick: handleContinue,
    },
      createElement("img", {
        src: icon,
        alt: "cable",
        width: 128,
        height: 128,
        className: `${iconStyle} ${!error && step !== Step.DONE ? "animate-pulse" : ""}`,
      })
    ),
    createElement("div", {
      className: "w-full max-w-3xl px-8 transition-opacity duration-300",
      style: { opacity: progress === -1 ? 0 : 1 },
    },
      createElement(LinearProgress, { value: progress * 100, barColor: bgColor })
    ),
    createElement("span", { className: "text-3xl dark:text-white font-mono font-light" }, title),
    createElement("span", { className: "text-xl dark:text-white px-8 max-w-xl" }, description),
    (title === "Lost connection" || title === "Ready") && isLinux && (
      createElement(Fragment, null,
        createElement("span",
          { className: "text-l dark:text-white px-2 max-w-xl" },
          "It seems that you're on Linux, make sure to run the script below in your terminal after plugging in your device."
        ),
        createElement("div", { className: "relative mt-2 max-w-3xl" },
          createElement("div", { className: "bg-gray-200 dark:bg-gray-800 rounded-md overflow-x-auto" },
            createElement("div", { className: "relative" },
              createElement("pre", { className: "font-mono text-sm text-gray-800 dark:text-gray-200 bg-gray-300 dark:bg-gray-700 rounded-md p-6 flex-grow max-w-m text-wrap" },
                detachScript.map((line, index) =>
                  createElement("span", { key: index, className: "block" }, line)
                )
              ),
              createElement("div", { className: "absolute top-2 right-2" },
                createElement("button", {
                  onClick: () => {
                    navigator.clipboard.writeText(detachScript.join("\n"));
                    handleCopy();
                  },
                  className: `bg-${copied ? "green" : "blue"}-500 text-white px-1 py-1 rounded-md ml-2 text-sm`
                }, "Copy")
              )
            )
          )
        )
      )
    ),
    error && (
      createElement("button", {
        className:
          "px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors",
        onClick: handleRetry,
      }, "Retry")
    ) || false,
    connected && createElement(DeviceState, { connected, serial })
  )
}
