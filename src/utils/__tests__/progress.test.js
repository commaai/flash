import { describe, expect, test, vi } from 'vitest'

import { createSteps, withProgress } from '../progress'

describe('createSteps', () => {
  describe('basic functionality', () => {
    test('handles numeric input to create equal-weight steps', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps(3, onProgress)
      
      expect(callbacks).toHaveLength(3)
      expect(typeof callbacks[0]).toBe('function')
      expect(typeof callbacks[1]).toBe('function')
      expect(typeof callbacks[2]).toBe('function')
    })

    test('handles array input with provided weights', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps([1, 2, 3], onProgress)
      
      expect(callbacks).toHaveLength(3)
      expect(typeof callbacks[0]).toBe('function')
      expect(typeof callbacks[1]).toBe('function')
      expect(typeof callbacks[2]).toBe('function')
    })

    test('calls onProgress when progress is updated', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps(2, onProgress)
      
      expect(onProgress).not.toHaveBeenCalled()
      callbacks[0](0.5)
      expect(onProgress).toHaveBeenCalledWith(0.25)
    })
  })

  describe('progress calculation', () => {
    test('calculates weighted average correctly for equal weights', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps(3, onProgress)
      
      callbacks[0](1)
      expect(onProgress).toHaveBeenLastCalledWith(1/3)
      
      callbacks[1](1)
      expect(onProgress).toHaveBeenLastCalledWith(2/3)
      
      callbacks[2](1)
      expect(onProgress).toHaveBeenLastCalledWith(1)
    })

    test('calculates weighted average correctly for different weights', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps([1, 2, 3], onProgress)
      const totalWeight = 1 + 2 + 3
      
      callbacks[0](1)
      expect(onProgress).toHaveBeenLastCalledWith(1/totalWeight)
      
      callbacks[1](1)
      expect(onProgress).toHaveBeenLastCalledWith((1 + 2)/totalWeight)
      
      callbacks[2](1)
      expect(onProgress).toHaveBeenLastCalledWith(1)
    })

    test('handles partial progress updates', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps([2, 2], onProgress)
      
      callbacks[0](0.5)
      expect(onProgress).toHaveBeenLastCalledWith(0.25)
      
      callbacks[1](0.25)
      expect(onProgress).toHaveBeenLastCalledWith(0.375)
      
      callbacks[0](1)
      callbacks[1](1)
      expect(onProgress).toHaveBeenLastCalledWith(1)
    })

    test('handles completion correctly', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps(2, onProgress)
      
      callbacks[0](1)
      callbacks[1](1)
      expect(onProgress).toHaveBeenLastCalledWith(1)
    })
  })

  describe('optimization and edge cases', () => {
    test('only calls onProgress when progress actually changes', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps(2, onProgress)
      
      callbacks[0](0.5)
      expect(onProgress).toHaveBeenCalledTimes(1)
      
      callbacks[0](0.5)
      expect(onProgress).toHaveBeenCalledTimes(1)
      
      callbacks[0](0.8)
      expect(onProgress).toHaveBeenCalledTimes(2)
    })

    test('handles zero weights gracefully', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps([0, 1, 0], onProgress)
      
      callbacks[0](1)
      expect(onProgress).toHaveBeenLastCalledWith(0)
      
      callbacks[1](1)
      expect(onProgress).toHaveBeenLastCalledWith(1)
      
      callbacks[2](1)
      expect(onProgress).toHaveBeenLastCalledWith(1)
    })

    test('handles empty step arrays', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps([], onProgress)
      
      expect(callbacks).toHaveLength(0)
    })

    test('handles single step', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps(1, onProgress)
      
      expect(callbacks).toHaveLength(1)
      callbacks[0](0.5)
      expect(onProgress).toHaveBeenCalledWith(0.5)
      callbacks[0](1)
      expect(onProgress).toHaveBeenCalledWith(1)
    })

    test('handles negative progress values', () => {
      const onProgress = vi.fn()
      const callbacks = createSteps(2, onProgress)
      
      callbacks[0](-0.5)
      expect(onProgress).toHaveBeenLastCalledWith(-0.25)
    })
  })
})

describe('withProgress', () => {
  describe('basic functionality', () => {
    test('works with simple arrays without weight function', () => {
      const onProgress = vi.fn()
      const steps = ['a', 'b', 'c']
      const result = withProgress(steps, onProgress)
      
      expect(result).toHaveLength(3)
      expect(result[0][0]).toBe('a')
      expect(result[1][0]).toBe('b')
      expect(result[2][0]).toBe('c')
      expect(typeof result[0][1]).toBe('function')
      expect(typeof result[1][1]).toBe('function')
      expect(typeof result[2][1]).toBe('function')
    })

    test('pairs steps with progress callbacks correctly', () => {
      const onProgress = vi.fn()
      const steps = [1, 2, 3]
      const result = withProgress(steps, onProgress)
      
      expect(result[0]).toEqual([1, expect.any(Function)])
      expect(result[1]).toEqual([2, expect.any(Function)])
      expect(result[2]).toEqual([3, expect.any(Function)])
    })

    test('returns correct array structure [step, callback]', () => {
      const onProgress = vi.fn()
      const steps = ['test']
      const result = withProgress(steps, onProgress)
      
      expect(Array.isArray(result)).toBe(true)
      expect(Array.isArray(result[0])).toBe(true)
      expect(result[0]).toHaveLength(2)
    })
  })

  describe('weight function behavior', () => {
    test('uses custom weight function when provided', () => {
      const onProgress = vi.fn()
      const steps = [{ id: 1, priority: 5 }, { id: 2, priority: 10 }]
      const getWeight = (step) => step.priority
      const result = withProgress(steps, onProgress, getWeight)
      
      const [, callback1] = result[0]
      const [, callback2] = result[1]
      
      callback1(1)
      expect(onProgress).toHaveBeenLastCalledWith(5/15)
      
      callback2(1)
      expect(onProgress).toHaveBeenLastCalledWith(1)
    })

    test('auto-detects weights from step size property', () => {
      const onProgress = vi.fn()
      const steps = [{ size: 100 }, { size: 200 }]
      const result = withProgress(steps, onProgress)
      
      const [, callback1] = result[0]
      const [, callback2] = result[1]
      
      callback1(1)
      expect(onProgress).toHaveBeenLastCalledWith(100/300)
    })

    test('auto-detects weights from step length property', () => {
      const onProgress = vi.fn()
      const steps = [{ length: 5 }, { length: 10 }]
      const result = withProgress(steps, onProgress)
      
      const [, callback1] = result[0]
      const [, callback2] = result[1]
      
      callback1(1)
      expect(onProgress).toHaveBeenLastCalledWith(5/15)
    })

    test('defaults to weight 1 for strings', () => {
      const onProgress = vi.fn()
      const steps = ['short', 'a much longer string']
      const result = withProgress(steps, onProgress)
      
      const [, callback1] = result[0]
      const [, callback2] = result[1]
      
      callback1(1)
      expect(onProgress).toHaveBeenLastCalledWith(0.5)
      
      callback2(1)
      expect(onProgress).toHaveBeenLastCalledWith(1)
    })

    test('handles numeric steps directly', () => {
      const onProgress = vi.fn()
      const steps = [5, 10, 15]
      const result = withProgress(steps, onProgress)
      
      const [, callback1] = result[0]
      const [, callback2] = result[1]
      const [, callback3] = result[2]
      
      callback1(1)
      expect(onProgress).toHaveBeenLastCalledWith(5/30)
      
      callback2(1)
      expect(onProgress).toHaveBeenLastCalledWith(15/30)
      
      callback3(1)
      expect(onProgress).toHaveBeenLastCalledWith(1)
    })
  })

  describe('integration', () => {
    test('verifies integration with createSteps works correctly', () => {
      const onProgress = vi.fn()
      const steps = [1, 2]
      const result = withProgress(steps, onProgress)
      
      const [, callback1] = result[0]
      const [, callback2] = result[1]
      
      callback1(0.5)
      callback2(0.25)
      
      expect(onProgress).toHaveBeenCalledWith((0.5 * 1 + 0.25 * 2) / 3)
    })

    test('end-to-end progress reporting through both functions', () => {
      const onProgress = vi.fn()
      const steps = [
        { name: 'download', size: 100 },
        { name: 'process', size: 50 },
        { name: 'upload', size: 25 }
      ]
      
      const result = withProgress(steps, onProgress, (step) => step.size)
      
      const [downloadStep, downloadProgress] = result[0]
      const [processStep, processProgress] = result[1]
      const [uploadStep, uploadProgress] = result[2]
      
      expect(downloadStep.name).toBe('download')
      expect(processStep.name).toBe('process')
      expect(uploadStep.name).toBe('upload')
      
      downloadProgress(0.5)
      expect(onProgress).toHaveBeenLastCalledWith(50/175)
      
      processProgress(1)
      expect(onProgress).toHaveBeenLastCalledWith(100/175)
      
      downloadProgress(1)
      expect(onProgress).toHaveBeenLastCalledWith(150/175)
      
      uploadProgress(1)
      expect(onProgress).toHaveBeenLastCalledWith(1)
    })
  })
})