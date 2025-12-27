import React from 'react'
import ReactDOM from 'react-dom/client'
import posthog from 'posthog-js'
import { initSentry } from './utils/telemetry'

import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'

import './index.css'
import App from './app'

// init PostHog
posthog.init('phc_O4kXIsdyB2cm9Wne1pwJkj5jk9Ua51ABVPAhtSuYQ4V', {
  api_host: 'https://us.i.posthog.com',
  capture_pageview: false,  // We'll track manually
  persistence: 'memory',    // Don't persist across sessions
})

// init sentry
initSentry()

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
