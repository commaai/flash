import { isLinux } from './platform'

/**
 * Parses an error object to extract user-friendly message and troubleshooting steps
 * @param {Error|string} error - The error to parse
 * @returns {{ message: string, description: string, icon?: string, bgColor?: string }}
 */
export function parseError(error) {
  let result = {
    message: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again.',
    icon: 'exclamation',
    bgColor: 'bg-red-500',
  }

  if (!error) return result

  const errorMessage = getErrorMessage(error)

  if (
    errorMessage.includes('WebUSB not supported') ||
    errorMessage.includes('Web Workers not supported') ||
    errorMessage.includes('Storage API not supported')
  ) {
    result.message = 'Browser not supported'
    result.description =
      'Your browser does not support the required technologies. Please use Chrome, Edge, or another browser with WebUSB support.'
  } else if (errorMessage.includes('Not enough storage')) {
    result.message = errorMessage
    result.description =
      'Your system does not have enough space available to download AGNOS. Your browser may be restricting the available space if you are in a private, incognito or guest session.'
  } else if (errorMessage.includes('Could not identify')) {
    result.message = 'Unrecognized device'
    result.description =
      'The device connected to your computer is not supported. Try using a different cable, USB port, or computer.'
    result.icon = 'deviceQuestion'
    result.bgColor = 'bg-yellow-500'
  } else if (
    errorMessage.includes('connect') ||
    errorMessage.includes('Connection lost') ||
    errorMessage.includes('Not connected')
  ) {
    result.message = 'Connection lost'
    result.description = 'The connection to your device was lost. Unplug your device and try again.'
    result.icon = 'cable'

    if (isLinux) {
      result.description += ' Did you forget to unbind the device from qcserial?'
    }
  } else if (errorMessage.includes('partition') || errorMessage.includes('GPT')) {
    result.message = 'Repairing partition tables failed'
    result.description =
      "Your device's partition tables could not be repaired. Try using a different cable, USB port, or computer."
    result.icon = 'deviceExclamation'
  } else if (errorMessage.includes('eras')) {
    result.message = 'Erase failed'
    result.description = 'The device could not be erased. Try using a different cable, USB port, or computer.'
    result.icon = 'deviceExclamation'
  } else if (errorMessage.includes('flash')) {
    result.message = 'Flash failed'
    result.description =
      'AGNOS could not be flashed to your device. Try using a different cable, USB port, or computer.'
    result.icon = 'deviceExclamation'
  } else if (errorMessage.includes('finaliz') || errorMessage.includes('slot')) {
    result.message = 'Finalizing failed'
    result.description =
      'The final setup steps could not be completed. Try using a different cable, USB port, or computer.'
    result.icon = 'deviceExclamation'
  } else {
    // For unknown errors, use a truncated version of the original message
    const shortMessage = errorMessage.split('\n')[0].substring(0, 50)
    result.message = shortMessage.length < errorMessage.length ? `${shortMessage}...` : shortMessage
  }

  if (!result.description.includes('Discord')) {
    result.description += ' If the problem persists, join the #hw-three-3x channel on Discord for help.'
  }

  return result
}

/**
 * Extracts the most specific error message from an error object or chain
 * @param {Error|string} error - The error to extract a message from
 * @returns {string} The most specific error message
 */
function getErrorMessage(error) {
  if (!error) return 'Unknown error'

  if (typeof error === 'string') return error

  if (error instanceof Error) {
    // Check for a more specific cause
    if (error.cause) {
      const causeMessage = getErrorMessage(error.cause)
      if (causeMessage && causeMessage !== 'Unknown error') {
        return causeMessage
      }
    }
    return error.message
  }

  return String(error)
}
