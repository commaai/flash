import React from 'react'
import ReactDOM from 'react-dom/client'
import Tracker from '@openreplay/tracker'

import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'

import './index.css'
import App from './app'

// Initialize OpenReplay session tracking
const tracker = new Tracker({
  projectKey: 'rN9Ir1HEKHJDs8P5rymv',
  __DISABLE_SECURE_MODE: location.hostname === 'localhost',
})
tracker.start()

// Export for use in other components
export { tracker }

// Explicitly load fonts before rendering to prevent FOUT
async function loadFonts() {
  await Promise.all([
    document.fonts.load('16px "Inter Variable"'),
    document.fonts.load('16px "JetBrains Mono Variable"'),
  ])
}

loadFonts().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
