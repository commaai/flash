import { Suspense } from 'react'
import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import Page from './+Page'

test('renders without crashing', () => {
  render(<Suspense fallback="loading"><Page /></Suspense>)
  expect(screen.getByText('flash.comma.ai')).toBeInTheDocument()
})
