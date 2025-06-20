// Minimal SolidJS Error Boundary - simple fallback UI
import { ErrorBoundary } from 'solid-js'

// Simple error fallback component
function ErrorFallback({ error, retry }) {
  console.error('Component Error:', error)
  
  // Basic error reporting - log to console and optionally report
  if (typeof window !== 'undefined' && window.fetch) {
    // Simple error reporting (optional - only if enabled)
    const reportError = async () => {
      try {
        // Only report in production and if reporting endpoint exists
        if (import.meta.env.PROD && import.meta.env.VITE_ERROR_ENDPOINT) {
          await fetch(import.meta.env.VITE_ERROR_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString(),
              userAgent: navigator.userAgent,
              url: window.location.href
            })
          })
        }
      } catch (reportErr) {
        console.warn('Failed to report error:', reportErr)
      }
    }
    reportError()
  }

  return (
    <div class="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
        Something went wrong
      </div>
      <div class="text-red-500 dark:text-red-300 text-sm mb-4 text-center max-w-md">
        {error.message || 'An unexpected error occurred'}
      </div>
      {retry && (
        <button 
          onClick={retry}
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  )
}

// Simple wrapper component for error boundaries
export function SimpleErrorBoundary({ children, fallback }) {
  return (
    <ErrorBoundary fallback={(error, reset) => 
      fallback ? fallback(error, reset) : <ErrorFallback error={error} retry={reset} />
    }>
      {children}
    </ErrorBoundary>
  )
}

export { ErrorFallback }
