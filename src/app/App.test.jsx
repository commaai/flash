import { Suspense } from 'solid-js'
import { expect, test } from 'vitest'
import { render, screen } from 'solid-testing-library'

import App from '.'

test('renders without crashing', () => {
  const { unmount } = render(() => (
    <Suspense fallback="loading">
      <App />
    </Suspense>
  ))
  
  expect(screen.getByText('flash.comma.ai')).toBeInTheDocument()
  unmount()
})
