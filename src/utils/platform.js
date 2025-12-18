// Force Windows mode for development - shows Zadig driver instructions
// Enable with ?windows=1 in URL
const FORCE_WINDOWS = new URLSearchParams(window.location.search).has('windows')
if (FORCE_WINDOWS) {
  console.warn('[Platform] FORCE WINDOWS MODE ENABLED')
}

const platform = (() => {
  if ('userAgentData' in navigator && 'platform' in navigator.userAgentData && navigator.userAgentData.platform) {
    return navigator.userAgentData.platform
  }
  const userAgent = navigator.userAgent.toLowerCase()
  if (userAgent.includes('linux')) return 'Linux' // includes Android
  if (userAgent.includes('win32') || userAgent.includes('windows')) return 'Windows'
  return null
})()

export const isWindows = FORCE_WINDOWS || !platform || platform === 'Windows'
export const isLinux = !FORCE_WINDOWS && platform === 'Linux'
