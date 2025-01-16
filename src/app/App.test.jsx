import { Suspense } from 'react'
import { afterEach, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

import App from '.'

expect.extend(matchers);

afterEach(() => {
  cleanup()
})

test('renders without crashing', () => {
  render(<Suspense fallback="loading"><App /></Suspense>)
  expect(screen.getByText('flash.comma.ai')).toBeTruthy()
})
