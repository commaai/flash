import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

describe('platform detection', () => {
  let originalNavigator

  beforeEach(() => {
    originalNavigator = globalThis.navigator
    vi.resetModules()
  })

  afterEach(() => {
    globalThis.navigator = originalNavigator
  })

  const importPlatform = async () => {
    return await import('../platform.js')
  }

  describe('modern browser userAgentData.platform detection', () => {
    test('detects Windows from userAgentData.platform', async () => {
      globalThis.navigator = {
        userAgentData: {
          platform: 'Windows'
        },
        userAgent: 'some other user agent'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(true)
      expect(isLinux).toBe(false)
    })

    test('detects Linux from userAgentData.platform', async () => {
      globalThis.navigator = {
        userAgentData: {
          platform: 'Linux'
        },
        userAgent: 'some other user agent'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(false)
      expect(isLinux).toBe(true)
    })

    test('returns platform name for other platforms from userAgentData.platform', async () => {
      globalThis.navigator = {
        userAgentData: {
          platform: 'macOS'
        },
        userAgent: 'some other user agent'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(false) // macOS platform means isWindows = false
      expect(isLinux).toBe(false)
    })

    test('skips userAgentData when platform property is missing', async () => {
      globalThis.navigator = {
        userAgentData: {},
        userAgent: 'mozilla/5.0 (x11; linux x86_64)'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(false)
      expect(isLinux).toBe(true)
    })

    test('skips userAgentData when platform is falsy', async () => {
      globalThis.navigator = {
        userAgentData: {
          platform: null
        },
        userAgent: 'mozilla/5.0 (x11; linux x86_64)'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(false)
      expect(isLinux).toBe(true)
    })
  })

  describe('fallback userAgent parsing', () => {
    test('detects Linux from userAgent containing linux', async () => {
      globalThis.navigator = {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(false)
      expect(isLinux).toBe(true)
    })

    test('detects Android as Linux from userAgent', async () => {
      globalThis.navigator = {
        userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(false)
      expect(isLinux).toBe(true)
    })

    test('detects Windows from userAgent containing win32', async () => {
      globalThis.navigator = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win32; x64) AppleWebKit/537.36'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(true)
      expect(isLinux).toBe(false)
    })

    test('detects Windows from userAgent containing windows', async () => {
      globalThis.navigator = {
        userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0)'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(true)
      expect(isLinux).toBe(false)
    })

    test('returns null for unknown userAgent', async () => {
      globalThis.navigator = {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(true) // null platform means isWindows = true
      expect(isLinux).toBe(false)
    })

    test('handles case insensitive userAgent matching', async () => {
      globalThis.navigator = {
        userAgent: 'Mozilla/5.0 (WINDOWS NT 10.0; WIN32; x64) AppleWebKit/537.36'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(true)
      expect(isLinux).toBe(false)
    })
  })

  describe('exported boolean constants', () => {
    test('isWindows is true when platform is Windows', async () => {
      globalThis.navigator = {
        userAgentData: {
          platform: 'Windows'
        }
      }

      const { isWindows } = await importPlatform()
      expect(isWindows).toBe(true)
    })

    test('isWindows is true when platform is null', async () => {
      globalThis.navigator = {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }

      const { isWindows } = await importPlatform()
      expect(isWindows).toBe(true)
    })

    test('isWindows is false when platform is Linux', async () => {
      globalThis.navigator = {
        userAgentData: {
          platform: 'Linux'
        }
      }

      const { isWindows } = await importPlatform()
      expect(isWindows).toBe(false)
    })

    test('isLinux is true only when platform is Linux', async () => {
      globalThis.navigator = {
        userAgentData: {
          platform: 'Linux'
        }
      }

      const { isLinux } = await importPlatform()
      expect(isLinux).toBe(true)
    })

    test('isLinux is false for Windows platform', async () => {
      globalThis.navigator = {
        userAgentData: {
          platform: 'Windows'
        }
      }

      const { isLinux } = await importPlatform()
      expect(isLinux).toBe(false)
    })

    test('isLinux is false for null platform', async () => {
      globalThis.navigator = {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }

      const { isLinux } = await importPlatform()
      expect(isLinux).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('handles missing navigator object', async () => {
      delete globalThis.navigator

      await expect(importPlatform()).rejects.toThrow()
    })

    test('handles navigator without userAgent', async () => {
      globalThis.navigator = {}

      await expect(importPlatform()).rejects.toThrow()
    })

    test('handles empty userAgent', async () => {
      globalThis.navigator = {
        userAgent: ''
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(true) // null platform means isWindows = true
      expect(isLinux).toBe(false)
    })

    test('handles userAgent with only whitespace', async () => {
      globalThis.navigator = {
        userAgent: '   '
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(true) // null platform means isWindows = true
      expect(isLinux).toBe(false)
    })

    test('handles userAgentData without platform property', async () => {
      globalThis.navigator = {
        userAgentData: {
          brands: [{ brand: 'Chrome', version: '120' }]
        },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      }

      const { isWindows, isLinux } = await importPlatform()
      expect(isWindows).toBe(false)
      expect(isLinux).toBe(true)
    })
  })
})