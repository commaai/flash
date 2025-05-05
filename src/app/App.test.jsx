import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'

import App from '.'

test('renders without crashing', () => {
  render(<App />)
  // Check for the iframe with the correct source
  expect(screen.getByTitle('flash.comma.ai')).toHaveAttribute('src', 'https://flash-4fy.pages.dev/')
})
