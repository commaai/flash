import { useCallback, useEffect } from 'react'
import { renderIsland } from '@/utils/islands'
import { Step, Error, useFastboot } from '@/utils/fastboot'

import bolt from '@/assets/bolt.svg'
import cable from '@/assets/cable.svg'
import cloud from '@/assets/cloud.svg'
import cloudDownload from '@/assets/cloud_download.svg'
import cloudError from '@/assets/cloud_error.svg'
import deviceExclamation from '@/assets/device_exclamation_c3.svg'
import deviceQuestion from '@/assets/device_question_c3.svg'
import done from '@/assets/done.svg'
import exclamation from '@/assets/exclamation.svg'
import frameAlert from '@/assets/frame_alert.svg'
import systemUpdate from '@/assets/system_update_c3.svg'

import {
  RetryButton,
  Progress,
  FlashButton,
  Title,
  Description,
  DeviceState,
} from './islands'

const steps = {
  [Step.INITIALIZING]: {
    status: 'Initializing...',
    bgColor: 'bg-gray-400 dark:bg-gray-700',
    icon: cloud,
  },
  [Step.READY]: {
    status: 'Ready',
    description: 'Tap the button above to begin',
    bgColor: 'bg-[#51ff00]',
    icon: bolt,
    iconStyle: '',
  },
  [Step.CONNECTING]: {
    status: 'Waiting for connection',
    description:
      'Follow the instructions to connect your device to your computer',
    bgColor: 'bg-yellow-500',
    icon: cable,
  },
  [Step.DOWNLOADING]: {
    status: 'Downloading...',
    bgColor: 'bg-blue-500',
    icon: cloudDownload,
  },
  [Step.UNPACKING]: {
    status: 'Unpacking...',
    bgColor: 'bg-blue-500',
    icon: cloudDownload,
  },
  [Step.FLASHING]: {
    status: 'Flashing device...',
    description: 'Do not unplug your device until the process is complete.',
    bgColor: 'bg-lime-400',
    icon: systemUpdate,
  },
  [Step.ERASING]: {
    status: 'Erasing device...',
    bgColor: 'bg-lime-400',
    icon: systemUpdate,
  },
  [Step.DONE]: {
    status: 'Done',
    description:
      'Your device has been updated successfully. You can now unplug the USB cable from your computer. To ' +
      'complete the system reset, follow the instructions on your device.',
    bgColor: 'bg-green-500',
    icon: done,
  },
}

const errors = {
  [Error.UNKNOWN]: {
    status: 'Unknown error',
    description:
      'An unknown error has occurred. Restart your browser and try again.',
    bgColor: 'bg-red-500',
    icon: exclamation,
  },
  [Error.UNRECOGNIZED_DEVICE]: {
    status: 'Unrecognized device',
    description: 'The device connected to your computer is not supported.',
    bgColor: 'bg-yellow-500',
    icon: deviceQuestion,
  },
  [Error.LOST_CONNECTION]: {
    status: 'Lost connection',
    description:
      'The connection to your device was lost. Check that your cables are connected properly and try again.',
    icon: cable,
  },
  [Error.DOWNLOAD_FAILED]: {
    status: 'Download failed',
    description:
      'The system image could not be downloaded. Check your internet connection and try again.',
    icon: cloudError,
  },
  [Error.CHECKSUM_MISMATCH]: {
    status: 'Download mismatch',
    description:
      'The system image downloaded does not match the expected checksum. Try again.',
    icon: frameAlert,
  },
  [Error.FLASH_FAILED]: {
    status: 'Flash failed',
    description:
      'The system image could not be flashed to your device. Try using a different cable, USB port, or ' +
      'computer. If the problem persists, join the #hw-three-3x channel on Discord for help.',
    icon: deviceExclamation,
  },
  [Error.ERASE_FAILED]: {
    status: 'Erase failed',
    description:
      'The device could not be erased. Try using a different cable, USB port, or computer. If the problem ' +
      'persists, join the #hw-three-3x channel on Discord for help.',
    icon: deviceExclamation,
  },
  [Error.REQUIREMENTS_NOT_MET]: {
    status: 'Requirements not met',
    description:
      'Your system does not meet the requirements to flash your device. Make sure to use a browser which ' +
      'supports WebUSB and is up to date.',
  },
}

function beforeUnloadListener(event) {
  // NOTE: not all browsers will show this message
  event.preventDefault()
  return (event.returnValue =
    'Flash in progress. Are you sure you want to leave?')
}

export default function App() {
  const {
    step,
    message,
    progress,
    error,

    onContinue,
    onRetry,

    connected,
    serial,
  } = useFastboot()

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

  // warn the user if they try to leave the page while flashing
  if (Step.DOWNLOADING <= step && step <= Step.ERASING) {
    window.addEventListener('beforeunload', beforeUnloadListener, {
      capture: true,
    })
  } else {
    window.removeEventListener('beforeunload', beforeUnloadListener, {
      capture: true,
    })
  }

  useEffect(() => {
    renderIsland(
      'title',
      <Title
        status={status}
        message={message}
        error={error}
        progress={progress}
      />
    )

    renderIsland('description', <Description description={description} />)

    renderIsland(
      'deviceState',
      <DeviceState connected={connected} serial={serial} />
    )

    renderIsland(
      'retryButton',
      <RetryButton error={error} handleRetry={handleRetry} />
    )

    renderIsland('progress', <Progress progress={progress} bgColor={bgColor} />)

    renderIsland(
      'flashButton',
      <FlashButton
        onContinue={onContinue}
        handleContinue={handleContinue}
        icon={icon}
        iconStyle={iconStyle}
        step={step}
        error={error}
        bgColor={bgColor}
      />
    )
  })
}
