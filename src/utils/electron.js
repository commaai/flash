/**
 * Check if the app is running in Electron
 * @returns {boolean}
 */
export const isElectron = () => {
  return typeof window !== 'undefined' &&
    typeof window.electronAPI !== 'undefined'
}

/**
 * Get the current platform
 * @returns {string}
 */
export const getPlatform = () => {
  if (isElectron()) {
    return window.electronAPI.platform
  }
  return navigator.platform
}

/**
 * Get app version (Electron only)
 * @returns {Promise<string|null>}
 */
export const getAppVersion = async () => {
  if (isElectron()) {
    try {
      return await window.electronAPI.getAppVersion()
    } catch (error) {
      console.error('Failed to get app version:', error)
      return null
    }
  }
  return null
}

/**
 * Show native file dialogs (Electron only)
 */
export const showOpenDialog = async (options) => {
  if (isElectron()) {
    return await window.electronAPI.showOpenDialog(options)
  }
  throw new Error('File dialogs are only available in Electron')
}

export const showSaveDialog = async (options) => {
  if (isElectron()) {
    return await window.electronAPI.showSaveDialog(options)
  }
  throw new Error('File dialogs are only available in Electron')
}