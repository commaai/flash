import { Suspense } from 'solid-js'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@solidjs/testing-library'

import App from '.'

//todo-breaking test due to React -> SolidJS migration
describe('App', () => {
  it('renders without crashing', () => {
    const { unmount } = render(() => (
      <Suspense fallback="loading">
        <App />
      </Suspense>
    ))
    
    expect(screen.getByText('flash.comma.ai')).toBeInTheDocument()
    unmount()
  })
})
