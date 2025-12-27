import React from 'react'
import ReactDOM from 'react-dom/client'
import { initSentry } from './utils/telemetry'

import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'

import './index.css'
import App from './app'

// Explicitly load fonts before rendering to prevent FOUT
async function loadFonts() {
  await Promise.all([
    document.fonts.load('16px "Inter Variable"'),
    document.fonts.load('16px "JetBrains Mono Variable"'),
  ])
}

// Initialize telemetry (no-op if DSN unset)
initSentry()

loadFonts().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
