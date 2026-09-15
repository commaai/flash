import { StrictMode, Suspense } from 'react'
import { expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import App from '.'
import { runStorageProbe } from '../utils/image'

vi.mock('../utils/image', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    cleanupStorageProbe: vi.fn().mockResolvedValue(undefined),
    runStorageProbe: vi.fn(({ signal }) => new Promise((resolve, reject) => {
      const passTimer = setTimeout(() => resolve({ writtenBytes: 1 }), 10)
      signal.addEventListener('abort', () => {
        clearTimeout(passTimer)
        reject(new DOMException('Storage test canceled', 'AbortError'))
      }, { once: true })
    })),
  }
})

function openStorageCheck() {
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
}

test('renders without crashing', () => {
  render(<Suspense fallback="loading"><App /></Suspense>)
  expect(screen.getByText('flash.comma.ai')).toBeInTheDocument()
})

test('shows the storage check without private-browsing guidance', async () => {
  render(<Suspense fallback="loading"><App /></Suspense>)
  openStorageCheck()

  expect(screen.getByRole('heading', { name: 'Checking available storage' })).toBeInTheDocument()
  expect(screen.queryByText(/Do not use Incognito or InPrivate browsing/)).not.toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Which device are you flashing?' })).toBeInTheDocument()
})

test('shows private-browsing guidance after a storage failure', async () => {
  vi.mocked(runStorageProbe).mockRejectedValueOnce(new Error('Quota exceeded'))
  render(<Suspense fallback="loading"><App /></Suspense>)
  openStorageCheck()

  expect(screen.queryByText(/Do not use Incognito or InPrivate browsing/)).not.toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Storage check failed' })).toBeInTheDocument()
  expect(screen.getByText(/Use a regular browser window/)).toBeInTheDocument()
  expect(screen.getByText(/Free at least 6 GiB of space on this device/)).toBeInTheDocument()
  expect(screen.getByText(/chrome:\/\/settings\/content\/siteData/)).toBeInTheDocument()
  expect(screen.getByText(/Fully quit and reopen the browser/)).toBeInTheDocument()
  expect(screen.getByText(/Android phone running Chrome, following the same steps above/)).toBeInTheDocument()
})

test('can skip the storage check', async () => {
  render(<Suspense fallback="loading"><App /></Suspense>)
  openStorageCheck()

  fireEvent.click(screen.getByRole('button', { name: 'Skip storage check' }))
  expect(await screen.findByRole('heading', { name: 'Which device are you flashing?' })).toBeInTheDocument()
})

test('Shift-clicking Skip storage check opens the failure guidance for testing', async () => {
  render(<Suspense fallback="loading"><App /></Suspense>)
  openStorageCheck()

  fireEvent.click(screen.getByRole('button', { name: 'Skip storage check' }), { shiftKey: true })
  expect(await screen.findByText(/Storage check failed/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry storage check' })).toBeInTheDocument()
})

test('does not cancel the storage pre-check during the Strict Mode effect cycle', async () => {
  render(
    <StrictMode>
      <Suspense fallback="loading"><App /></Suspense>
    </StrictMode>,
  )
  openStorageCheck()

  expect(await screen.findByRole('heading', { name: 'Which device are you flashing?' })).toBeInTheDocument()
})
