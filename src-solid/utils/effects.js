// Minimal effect patterns for SolidJS - optimized for performance
import { createEffect, onCleanup, createSignal } from 'solid-js'

// Minimal effect patterns
export function createMinimalEffect(fn, deps) {
  // Only run effect when specific dependencies change
  createEffect(() => {
    const values = deps?.() 
    return fn(values)
  })
}

// Cleanup utility - only use when necessary
export function createCleanupEffect(setup, deps) {
  createEffect(() => {
    const values = deps?.()
    const cleanup = setup(values)
    if (cleanup) {
      onCleanup(cleanup)
    }
  })
}

// Simple async effect pattern
export function createAsyncEffect(asyncFn, deps) {
  createEffect(async () => {
    try {
      const values = deps?.()
      await asyncFn(values)
    } catch (error) {
      console.error('Async effect error:', error)
    }
  })
}

// Debounced effect - useful for expensive operations
export function createDebouncedEffect(fn, delay = 300) {
  const [debouncedFn] = createSignal(
    debounce(fn, delay)
  )
  
  return debouncedFn()
}

function debounce(fn, delay) {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// Event listener effect - minimal DOM management
export function createEventEffect(target, event, handler, options) {
  createEffect(() => {
    const element = typeof target === 'function' ? target() : target
    if (element) {
      element.addEventListener(event, handler, options)
      onCleanup(() => {
        element.removeEventListener(event, handler, options)
      })
    }
  })
}
