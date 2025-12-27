// Lightweight Sentry integration (CDN-based, no-op if DSN unset)
// - Loads Sentry browser bundle at runtime if a DSN is provided
// - Exposes helpers to set tags, add breadcrumbs, and send a final session event

let sentryInited = false
let sentryInitPromise = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.crossOrigin = 'anonymous'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

// Best-effort CDN load for Sentry + Replay. If already present, skips.
async function ensureSentryBundle() {
  if (window.Sentry) return
  // Use a stable recent v7 bundle that includes tracing + replay
  // If you want to pin a newer version later, update this URL.
  const url = 'https://browser.sentry-cdn.com/7.114.0/bundle.tracing.replay.min.js'
  await loadScript(url)
}

const SENTRY_DSN = 'https://acb8cfad1992fafc3dc90ab1bfa3d07f@o33823.ingest.us.sentry.io/4510604761825280'

/** Initialize Sentry */
export async function initSentry(options = {}) {
  if (sentryInited || sentryInitPromise) return sentryInitPromise

  sentryInitPromise = (async () => {
    const dsn = SENTRY_DSN
    try {
      await ensureSentryBundle()
      if (!window.Sentry) return false

      const release = import.meta.env.VITE_PUBLIC_GIT_SHA || 'dev'
      const environment = import.meta.env.MODE || 'development'

      // Default to replay only on error to keep costs down; can be tuned.
      window.Sentry.init({
        dsn,
        release,
        environment,
        // Breadcrumbs already capture console by default; keep it.
        // Limit traces by default; you can increase later if desired.
        tracesSampleRate: options.tracesSampleRate ?? 0.0,
        replaysSessionSampleRate: options.replaysSessionSampleRate ?? 0.0,
        replaysOnErrorSampleRate: options.replaysOnErrorSampleRate ?? 1.0,
        maxBreadcrumbs: options.maxBreadcrumbs ?? 100,
        integrations: [new window.Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        })],
      })

      sentryInited = true
      return true
    } catch (e) {
      // Swallow init errors to avoid breaking the app
      // eslint-disable-next-line no-console
      console.warn('[Sentry] init failed:', e)
      sentryInited = false
      return false
    }
  })()

  return sentryInitPromise
}

// Safe no-op wrappers if Sentry isn’t available
function withSentry(cb) {
  if (!sentryInited || !window.Sentry) return
  try { cb(window.Sentry) } catch { /* no-op */ }
}

export function setTags(tags = {}) {
  withSentry((S) => S.setTags(tags))
}

export function setTag(key, value) {
  withSentry((S) => S.setTag(key, value))
}

export function setContext(key, context) {
  withSentry((S) => S.setContext(key, context))
}

export function addBreadcrumb({ category, message, level = 'info', data }) {
  withSentry((S) => S.addBreadcrumb({ category, message, level, data }))
}

/**
 * Send a compact session summary event with pass/fail and optional console tail.
 * To keep payloads small, logs are placed in `extra.console_tail` and truncated.
 */
export function captureSessionSummary({
  sessionId,
  result, // 'pass' | 'fail' | 'abort'
  errorCode,
  step,
  meta = {},
  consoleTail = [], // Array<{ time, level, message }>
}) {
  withSentry((S) => {
    const level = result === 'pass' ? 'info' : 'error'

    // Attach tags for easier filtering
    S.setTags({
      session_id: sessionId,
      result,
      error_code: typeof errorCode === 'number' ? String(errorCode) : (errorCode || 'none'),
      last_step: typeof step === 'number' ? String(step) : (step || 'unknown'),
    })

    // Try to attach full logs if the SDK supports attachments (v7+ feature; guarded)
    let usedAttachment = false
    try {
      const hasAddAttachment = !!S.addAttachment
      if (hasAddAttachment && consoleTail && consoleTail.length) {
        const blob = new Blob([JSON.stringify(consoleTail)], { type: 'application/json' })
        // Some SDKs attach to current scope and include on next captured event
        S.addAttachment({ filename: 'console_tail.json', data: blob, contentType: 'application/json' })
        usedAttachment = true
      }
    } catch { /* ignore */ }

    // Always include a compact tail in extras as a fallback
    const safeTail = (consoleTail || []).slice(-200)
    S.captureMessage('flash_session', {
      level,
      tags: undefined, // tags set via setTags above
      extra: {
        usedAttachment,
        meta,
        console_tail: safeTail,
      },
    })
  })
}

