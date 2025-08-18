import { Suspense } from 'solid-js'
import { expect, test } from 'vitest'
import { render, screen } from '@solidjs/testing-library'

import App from '.'

test('renders without crashing', () => {
  render(() => <Suspense fallback="loading"><App /></Suspense>)
  expect(screen.getByText('flash.comma.ai')).toBeInTheDocument()
})