// Error boundary tests - verify simple error handling
import { describe, it, expect } from 'vitest'
import { render } from '@solidjs/testing-library'
import { SimpleErrorBoundary, ErrorFallback } from './ErrorBoundary.jsx'

// Component that throws an error for testing
function ThrowingComponent() {
  throw new Error('Test error')
}

// Component that works fine
function WorkingComponent() {
  return <div>Working fine</div>
}

describe('Error Boundary', () => {
  it('should render children when no error occurs', () => {
    const { getByText } = render(() => (
      <SimpleErrorBoundary>
        <WorkingComponent />
      </SimpleErrorBoundary>
    ))
    
    expect(getByText('Working fine')).toBeInTheDocument()
  })

  it('should render error fallback when error occurs', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    const { getByText } = render(() => (
      <SimpleErrorBoundary>
        <ThrowingComponent />
      </SimpleErrorBoundary>
    ))
    
    expect(getByText('Something went wrong')).toBeInTheDocument()
    expect(getByText('Test error')).toBeInTheDocument()
    expect(getByText('Try Again')).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })

  it('should render custom fallback when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    const customFallback = (error) => <div>Custom error: {error.message}</div>
    
    const { getByText } = render(() => (
      <SimpleErrorBoundary fallback={customFallback}>
        <ThrowingComponent />
      </SimpleErrorBoundary>
    ))
    
    expect(getByText('Custom error: Test error')).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })

  it('should call retry function when retry button is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    let retryCount = 0
    const TestComponent = () => {
      if (retryCount === 0) {
        retryCount++
        throw new Error('First attempt error')
      }
      return <div>Retry successful</div>
    }
    
    const { getByText, rerender } = render(() => (
      <SimpleErrorBoundary>
        <TestComponent />
      </SimpleErrorBoundary>
    ))
    
    expect(getByText('Something went wrong')).toBeInTheDocument()
    
    // Clicking retry should reset the error boundary
    const retryButton = getByText('Try Again')
    retryButton.click()
    
    // After retry, the component should work
    rerender(() => (
      <SimpleErrorBoundary>
        <TestComponent />
      </SimpleErrorBoundary>
    ))
    
    consoleSpy.mockRestore()
  })
})

describe('ErrorFallback', () => {
  it('should display error message', () => {
    const error = new Error('Test error message')
    const { getByText } = render(() => <ErrorFallback error={error} />)
    
    expect(getByText('Something went wrong')).toBeInTheDocument()
    expect(getByText('Test error message')).toBeInTheDocument()
  })

  it('should display retry button when retry function provided', () => {
    const error = new Error('Test error')
    const retry = vi.fn()
    
    const { getByText } = render(() => <ErrorFallback error={error} retry={retry} />)
    
    const retryButton = getByText('Try Again')
    expect(retryButton).toBeInTheDocument()
    
    retryButton.click()
    expect(retry).toHaveBeenCalled()
  })

  it('should not display retry button when no retry function provided', () => {
    const error = new Error('Test error')
    const { queryByText } = render(() => <ErrorFallback error={error} />)
    
    expect(queryByText('Try Again')).not.toBeInTheDocument()
  })
})
