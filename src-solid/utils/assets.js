// Minimal asset management - direct paths to public assets
// This approach uses zero build-time processing and serves assets directly

// Base path for all assets (served from public directory)
const ASSETS_BASE = '/assets'

// Asset paths - direct references to public assets
export const assets = {
  // UI Icons
  bolt: `${ASSETS_BASE}/bolt.svg`,
  cable: `${ASSETS_BASE}/cable.svg`,
  done: `${ASSETS_BASE}/done.svg`,
  exclamation: `${ASSETS_BASE}/exclamation.svg`,
  
  // Device icons
  deviceExclamation: `${ASSETS_BASE}/device_exclamation_c3.svg`,
  deviceQuestion: `${ASSETS_BASE}/device_question_c3.svg`,
  systemUpdate: `${ASSETS_BASE}/system_update_c3.svg`,
  
  // Brand and instructional
  comma: `${ASSETS_BASE}/comma.svg`,
  qdlPorts: `${ASSETS_BASE}/qdl-ports.svg`,
  
  // Windows driver setup images
  zadigCreateNewDevice: `${ASSETS_BASE}/zadig_create_new_device.png`,
  zadigForm: `${ASSETS_BASE}/zadig_form.png`,
}

// Simple asset loader - no caching or complex logic needed
// Vite/browser handles all caching automatically
export function getAsset(name) {
  return assets[name] || null
}

// Preload critical assets (optional - for performance)
export function preloadCriticalAssets() {
  const critical = [
    assets.bolt,
    assets.cable, 
    assets.done,
    assets.comma
  ]
  
  critical.forEach(src => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = src
    document.head.appendChild(link)
  })
}

export default assets
