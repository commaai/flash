import { browser } from "$app/environment"

export const isWindows = () => {
  if (!browser) return false
  const FORCE_WINDOWS = new URLSearchParams(globalThis.window.location?.search).has('windows') ?? false
  if (FORCE_WINDOWS) {
    console.warn('[Platform] FORCE WINDOWS MODE ENABLED')
  }
  return FORCE_WINDOWS || (globalThis.navigator.userAgent.toLowerCase().includes("windows") ?? false)
}

export const isLinux = () => {
  if (!browser) return false;
  return globalThis.navigator.userAgent.toLowerCase().includes("linux") ?? false
}
