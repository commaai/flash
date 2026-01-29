import { expect, test } from 'vitest'
import { render, screen } from '@solidjs/testing-library'

import App from '.'

test('renders without crashing', () => {
  render(() => <App />)
  expect(screen.getByText('flash.comma.ai')).toBeInTheDocument()
})
