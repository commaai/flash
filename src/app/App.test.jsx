import { Suspense } from 'react'
import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'

import App from '.'

test('renders without crashing', () => {
  render(<Suspense fallback="loading"><App /></Suspense>)
  expect(screen.getByText('flash.comma.ai')).toBeInTheDocument()
})
