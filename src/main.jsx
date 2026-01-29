import { render } from 'solid-js/web'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/browser'

import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'

import './index.css'
import App from './app'

posthog.init('phc_O4kXIsdyB2cm9Wne1pwJkj5jk9Ua51ABVPAhtSuYQ4V', {
  api_host: 'https://us.i.posthog.com',
  capture_pageview: false,
  persistence: 'memory',
})

Sentry.init({
  dsn: 'https://acb8cfad1992fafc3dc90ab1bfa3d07f@o33823.ingest.us.sentry.io/4510604761825280',
  sendDefaultPii: true,
})

// Explicitly load fonts before rendering to prevent FOUT
async function loadFonts() {
  await Promise.all([
    document.fonts.load('16px "Inter Variable"'),
    document.fonts.load('16px "JetBrains Mono Variable"'),
  ])
}

loadFonts().then(() => {
  render(() => <App />, document.getElementById('root'))
})
