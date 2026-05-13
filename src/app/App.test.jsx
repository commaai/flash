import { Suspense } from 'react'
import { expect, test } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import App from '.'

test('renders without crashing', () => {
  render(<Suspense fallback="loading"><App /></Suspense>)
  expect(screen.getByText('flash.comma.ai')).toBeInTheDocument()
})

test('opens the walkthrough video without leaving the flash flow', () => {
  render(<Suspense fallback="loading"><App /></Suspense>)

  fireEvent.click(screen.getByRole('button', { name: /watch walkthrough/i }))

  const dialog = screen.getByRole('dialog', { name: /flash walkthrough/i })
  expect(within(dialog).getByText('Flash walkthrough')).toBeInTheDocument()
  expect(within(dialog).getByTitle('Flash walkthrough video')).toHaveAttribute('src', '/flash-walkthrough.mp4')
  expect(screen.getByText('flash.comma.ai')).toBeInTheDocument()
})
