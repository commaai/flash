// Minimal component tests for SolidJS
import { render } from '@solidjs/testing-library'
import { ProgressBar, DeviceState } from '../components/FlashComponents.jsx'
import { createSignal } from 'solid-js'

describe('FlashComponents', () => {
  test('ProgressBar renders correctly', () => {
    const [progress] = createSignal(0.5)
    const [bgColor] = createSignal('bg-blue-500')
    const { container } = render(() => <ProgressBar value={progress} bgColor={bgColor} />)
    expect(container.querySelector('.relative')).toBeInTheDocument()
  })

  test('DeviceState shows serial', () => {
    const [serial] = createSignal('test-serial-123')
    const { getByText } = render(() => <DeviceState serial={serial} />)
    expect(getByText('test-serial-123')).toBeInTheDocument()
  })
})
