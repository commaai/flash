import * as Sentry from '@sentry/react'

export function initSentry() {
  Sentry.init({
    dsn: 'https://acb8cfad1992fafc3dc90ab1bfa3d07f@o33823.ingest.us.sentry.io/4510604761825280',
    sendDefaultPii: true,
  })
}
