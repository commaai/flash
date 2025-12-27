import * as Sentry from '@sentry/react'

const SENTRY_DSN = 'https://acb8cfad1992fafc3dc90ab1bfa3d07f@o33823.ingest.us.sentry.io/4510604761825280'

export function initSentry() {
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: true,
  })
}

export function setTags(tags = {}) {
  Sentry.setTags(tags)
}

export function setTag(key, value) {
  Sentry.setTag(key, value)
}

export function setContext(key, context) {
  Sentry.setContext(key, context)
}

export function addBreadcrumb({ category, message, level = 'info', data }) {
  Sentry.addBreadcrumb({ category, message, level, data })
}

export function captureSessionSummary({
  sessionId,
  result,
  errorCode,
  step,
  meta = {},
  consoleTail = [],
}) {
  const level = result === 'pass' ? 'info' : 'error'

  Sentry.setTags({
    session_id: sessionId,
    result,
    error_code: typeof errorCode === 'number' ? String(errorCode) : (errorCode || 'none'),
    last_step: typeof step === 'number' ? String(step) : (step || 'unknown'),
  })

  Sentry.captureMessage('flash_session', {
    level,
    extra: {
      meta,
      console_tail: consoleTail.slice(-200),
    },
  })
}
