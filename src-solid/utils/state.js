// Direct signal-based state management - SolidJS optimized
import { createSignal } from 'solid-js'

// Simple state factory for common patterns
export function createFlashState() {
  // All state as direct signals - no complex stores needed
  const [step, setStep] = createSignal(0)
  const [message, setMessage] = createSignal('')
  const [progress, setProgress] = createSignal(-1)
  const [error, setError] = createSignal(0)
  const [connected, setConnected] = createSignal(false)
  const [serial, setSerial] = createSignal(null)
  
  // Computed values that automatically update
  const isReady = () => step() === 1 && error() === 0
  const isFlashing = () => step() >= 2 && step() <= 3
  const isDone = () => step() === 4
  const hasError = () => error() !== 0
  
  // Simple actions that directly update state
  const reset = () => {
    setStep(0)
    setMessage('')
    setProgress(-1)
    setError(0)
    setConnected(false)
    setSerial(null)
  }
  
  return {
    // Direct signal accessors
    step, setStep,
    message, setMessage,
    progress, setProgress,
    error, setError,
    connected, setConnected,
    serial, setSerial,
    
    // Computed state
    isReady,
    isFlashing,
    isDone,
    hasError,
    
    // Actions
    reset
  }
}

// Alternative pattern: Single state object (use sparingly)
export function createStateObject(initialState) {
  const [state, setState] = createSignal(initialState)
  
  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }))
  }
  
  return [state, updateState]
}
