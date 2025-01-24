export const getPlatform = () => {
  if ('userAgentData' in navigator && 'platform' in navigator.userAgentData && navigator.userAgentData.platform) {
    return navigator.userAgentData.platform
  }
  const userAgent = navigator.userAgent.toLowerCase()
  if (userAgent.includes('linux')) return 'Linux'
  if (userAgent.includes('win32')) return 'Windows'
  return null
}

export const isWindows = !getPlatform() || getPlatform() === 'Windows'
