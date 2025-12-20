export const isWindows = () => {
  const FORCE_WINDOWS = new URLSearchParams(window.location.search).has('windows')
  if (FORCE_WINDOWS) {
    console.warn('[Platform] FORCE WINDOWS MODE ENABLED')
  }
  return FORCE_WINDOWS || (globalThis.navigator.userAgent.toLowerCase().includes("windows") ?? false)
}

export const isLinux = () => globalThis.navigator.userAgent.toLowerCase().includes("linux") ?? false
