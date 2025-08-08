import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flashComponent } from './flash.js'
import { StepCode, ErrorCode } from './utils/manager'

// Mock the external dependencies
vi.mock('./utils/manager', () => ({
  FlashManager: vi.fn(),
  StepCode: {
    INITIALIZING: 0,
    READY: 1,
    CONNECTING: 2,
    REPAIR_PARTITION_TABLES: 3,
    ERASE_DEVICE: 4,
    FLASH_SYSTEM: 5,
    FINALIZING: 6,
    DONE: 7
  },
  ErrorCode: {
    NONE: 0,
    UNKNOWN: 1,
    REQUIREMENTS_NOT_MET: 2,
    STORAGE_SPACE: 3,
    UNRECOGNIZED_DEVICE: 4,
    LOST_CONNECTION: 5,
    REPAIR_PARTITION_TABLES_FAILED: 6,
    ERASE_FAILED: 7,
    FLASH_SYSTEM_FAILED: 8
  }
}))

vi.mock('./utils/image', () => ({
  ImageManager: vi.fn()
}))

vi.mock('./utils/platform', () => ({
  isLinux: false
}))

vi.mock('./config', () => ({
  default: {
    loader: { url: 'test-url' },
    manifests: { release: 'test-manifest' }
  }
}))

// Mock SVG imports
vi.mock('./assets/bolt.svg', () => ({ default: 'bolt-icon' }))
vi.mock('./assets/cable.svg', () => ({ default: 'cable-icon' }))
vi.mock('./assets/device_exclamation_c3.svg', () => ({ default: 'device-exclamation-icon' }))
vi.mock('./assets/device_question_c3.svg', () => ({ default: 'device-question-icon' }))
vi.mock('./assets/done.svg', () => ({ default: 'done-icon' }))
vi.mock('./assets/exclamation.svg', () => ({ default: 'exclamation-icon' }))
vi.mock('./assets/system_update_c3.svg', () => ({ default: 'system-update-icon' }))

describe('flashComponent', () => {
  let component

  beforeEach(() => {
    vi.clearAllMocks()
    component = flashComponent()
    // Reset component to default state
    component.step = StepCode.INITIALIZING
    component.error = ErrorCode.NONE
    component.message = ''
    component.progress = -1
  })

  describe('basic component creation', () => {
    it('should create component with correct initial state', () => {
      const comp = flashComponent()
      expect(comp.step).toBe(StepCode.INITIALIZING)
      expect(comp.error).toBe(ErrorCode.NONE)
      expect(comp.message).toBe('')
      expect(comp.progress).toBe(-1)
    })
  })

  describe('uiState getter', () => {
    it('should return step state when no error', () => {
      component.step = StepCode.READY
      component.error = ErrorCode.NONE

      const state = component.uiState
      expect(state.status).toBe('Tap to start')
      expect(state.bgColor).toBe('bg-[#51ff00]')
    })

    it('should merge error state when error exists', () => {
      component.step = StepCode.READY
      component.error = ErrorCode.UNKNOWN

      const state = component.uiState
      expect(state.status).toBe('Unknown error')
      expect(state.bgColor).toBe('bg-red-500')
    })

    it('should handle unrecognized device error', () => {
      component.step = StepCode.CONNECTING
      component.error = ErrorCode.UNRECOGNIZED_DEVICE

      const state = component.uiState
      expect(state.status).toBe('Unrecognized device')
      expect(state.bgColor).toBe('bg-yellow-500')
    })
  })

  describe('title getter', () => {
    it('should return message with percentage when progress available', () => {
      component.message = 'Downloading'
      component.progress = 0.5
      component.error = ErrorCode.NONE

      expect(component.title).toBe('Downloading... (50%)')
    })

    it('should return message without percentage when no progress', () => {
      component.message = 'Connecting'
      component.progress = -1
      component.error = ErrorCode.NONE

      expect(component.title).toBe('Connecting...')
    })

    it('should return message for storage space error', () => {
      component.message = 'Not enough space'
      component.error = ErrorCode.STORAGE_SPACE

      expect(component.title).toBe('Not enough space')
    })

    it('should return status when no message and no storage error', async () => {
      // Use module isolation to avoid test contamination
      vi.resetModules()
      const { flashComponent: freshFlashComponent } = await import('./flash.js')
      const freshComponent = freshFlashComponent()
      freshComponent.message = ''
      freshComponent.step = StepCode.READY
      freshComponent.error = ErrorCode.NONE

      expect(freshComponent.title).toBe('Tap to start')
    })

    it('should return status when error but not storage space', () => {
      component.message = 'Some message'
      component.error = ErrorCode.UNKNOWN
      component.step = StepCode.READY

      expect(component.title).toBe('Unknown error')
    })
  })

  describe('canStart getter', () => {
    it('should return true when step is READY and no error', () => {
      component.step = StepCode.READY
      component.error = ErrorCode.NONE

      expect(component.canStart).toBe(true)
    })

    it('should return false when step is not READY', () => {
      component.step = StepCode.CONNECTING
      component.error = ErrorCode.NONE

      expect(component.canStart).toBe(false)
    })

    it('should return false when there is an error', () => {
      component.step = StepCode.READY
      component.error = ErrorCode.UNKNOWN

      expect(component.canStart).toBe(false)
    })

    it('should return false when step is not READY and there is an error', () => {
      component.step = StepCode.CONNECTING
      component.error = ErrorCode.UNKNOWN

      expect(component.canStart).toBe(false)
    })
  })

  describe('progressValue getter', () => {
    it('should return 100 when progress is -1', () => {
      component.progress = -1
      expect(component.progressValue).toBe(100)
    })

    it('should return 100 when progress is over 100', () => {
      component.progress = 150
      expect(component.progressValue).toBe(100)
    })

    it('should return percentage when progress is valid', () => {
      component.progress = 0.75
      expect(component.progressValue).toBe(75)
    })

    it('should return 0 when progress is 0', () => {
      component.progress = 0
      expect(component.progressValue).toBe(0)
    })

    it('should return correct percentage for decimal values', () => {
      component.progress = 0.333
      expect(component.progressValue).toBeCloseTo(33.3, 1)
    })
  })

  describe('step-specific states', () => {
    it('should handle INITIALIZING step', () => {
      component.step = StepCode.INITIALIZING
      const state = component.uiState
      expect(state.status).toBe('Initializing...')
      expect(state.bgColor).toBe('bg-gray-400 dark:bg-gray-700')
    })

    it('should handle CONNECTING step', async () => {
      // Use module isolation to avoid test contamination
      vi.resetModules()
      const { flashComponent: freshFlashComponent } = await import('./flash.js')
      const freshComponent = freshFlashComponent()
      freshComponent.step = StepCode.CONNECTING
      freshComponent.error = ErrorCode.NONE
      const state = freshComponent.uiState
      expect(state.status).toBe('Waiting for connection')
      expect(state.description).toBe('Follow the instructions to connect your device to your computer')
      expect(state.bgColor).toBe('bg-yellow-500')
    })

    it('should handle DONE step', () => {
      component.step = StepCode.DONE
      const state = component.uiState
      expect(state.status).toBe('Done')
      expect(state.description).toBe('Your device was flashed successfully. It should now boot into the openpilot setup.')
      expect(state.bgColor).toBe('bg-green-500')
    })
  })

  describe('error handling', () => {
    it('should handle multiple error types correctly', () => {
      const errorTests = [
        { error: ErrorCode.REQUIREMENTS_NOT_MET, expectedStatus: 'Requirements not met' },
        { error: ErrorCode.UNRECOGNIZED_DEVICE, expectedStatus: 'Unrecognized device' },
        { error: ErrorCode.LOST_CONNECTION, expectedStatus: 'Lost connection' },
        { error: ErrorCode.REPAIR_PARTITION_TABLES_FAILED, expectedStatus: 'Repairing partition tables failed' },
        { error: ErrorCode.ERASE_FAILED, expectedStatus: 'Erase failed' },
        { error: ErrorCode.FLASH_SYSTEM_FAILED, expectedStatus: 'Flash failed' }
      ]

      errorTests.forEach(({ error, expectedStatus }) => {
        component.error = error
        component.step = StepCode.READY
        expect(component.uiState.status).toBe(expectedStatus)
      })
    })

    it('should fall back to unknown error for unmapped errors', () => {
      component.error = 999 // Non-existent error code
      component.step = StepCode.READY
      
      const state = component.uiState
      expect(state.status).toBe('Unknown error')
      expect(state.bgColor).toBe('bg-red-500')
    })

    it('should preserve step state properties when no error', async () => {
      // Use module isolation to avoid test contamination
      vi.resetModules()
      const { flashComponent: freshFlashComponent } = await import('./flash.js')
      const freshComponent = freshFlashComponent()
      freshComponent.step = StepCode.CONNECTING
      freshComponent.error = ErrorCode.NONE

      const state = freshComponent.uiState
      expect(state.status).toBe('Waiting for connection')
      expect(state.bgColor).toBe('bg-yellow-500')
      expect(state.description).toBe('Follow the instructions to connect your device to your computer')
    })
  })
})

// Test Linux-specific error modifications
describe('flashComponent with Linux platform', () => {
  let component

  beforeEach(() => {
    // Mock isLinux as true for these tests
    vi.doMock('./utils/platform', () => ({
      isLinux: true
    }))
    
    // Re-import the component to get the Linux-modified errors
    vi.resetModules()
  })

  it('should modify LOST_CONNECTION error description on Linux', async () => {
    // Import after mocking Linux
    const { flashComponent: linuxFlashComponent } = await import('./flash.js')
    component = linuxFlashComponent()
    
    component.step = StepCode.CONNECTING
    component.error = ErrorCode.LOST_CONNECTION

    const state = component.uiState
    expect(state.description).toContain('Did you forget to unbind the device from qcserial?')
  })
})