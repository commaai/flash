const platform = (() => {
  if ('userAgentData' in navigator && 'platform' in navigator.userAgentData && navigator.userAgentData.platform) {
    return navigator.userAgentData.platform
  }
  const userAgent = navigator.userAgent.toLowerCase()
  if (userAgent.includes('linux')) return 'Linux' // includes Android
  if (userAgent.includes('win32') || userAgent.includes('windows')) return 'Windows'
  return null
})()

export const isWindows = !platform || platform === 'Windows'
export const isLinux = platform === 'Linux'