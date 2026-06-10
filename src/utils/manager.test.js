import { describe, expect, test } from 'vitest'

import { isAccessDeniedError } from './manager'

describe('isAccessDeniedError', () => {
  test('detects a SecurityError', () => {
    expect(isAccessDeniedError(new DOMException('Access denied.', 'SecurityError'))).toBe(true)
  })

  test('detects a SecurityError wrapped as a cause', () => {
    const cause = new DOMException('Access denied.', 'SecurityError')
    const wrapped = new Error('Error while connecting to device', { cause })
    expect(isAccessDeniedError(wrapped)).toBe(true)
  })

  test('ignores other connection errors', () => {
    expect(isAccessDeniedError(new Error('Connection lost'))).toBe(false)
    expect(isAccessDeniedError(new DOMException('A transfer error has occurred.', 'NetworkError'))).toBe(false)
    expect(isAccessDeniedError(undefined)).toBe(false)
  })
})
