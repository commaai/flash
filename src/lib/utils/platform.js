const platform = (() => {
  if ('userAgentData' in globalThis.navigator && 'platform' in globalThis.navigator.userAgentData && globalThis.navigator.userAgentData.platform) {
    return globalThis.navigator.userAgentData.platform
  }
  const userAgent = globalThis.navigator.userAgent.toLowerCase()
  if (userAgent.includes('linux')) return 'Linux' // includes Android
  if (userAgent.includes('win32') || userAgent.includes('windows')) return 'Windows'
  return null
})()

export const isWindows = !platform || platform === 'Windows'
export const isLinux = platform === 'Linux'
