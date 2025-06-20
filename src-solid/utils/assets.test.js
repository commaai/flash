// Asset management tests - verify simple asset handling
import { describe, it, expect } from 'vitest'
import { assets, getAsset, preloadCriticalAssets } from '../utils/assets.js'

describe('Asset Management', () => {
  it('should provide access to all expected assets', () => {
    // Test that all expected assets are defined
    expect(assets.bolt).toBe('/assets/bolt.svg')
    expect(assets.cable).toBe('/assets/cable.svg')
    expect(assets.done).toBe('/assets/done.svg')
    expect(assets.comma).toBe('/assets/comma.svg')
    expect(assets.qdlPorts).toBe('/assets/qdl-ports.svg')
    expect(assets.deviceExclamation).toBe('/assets/device_exclamation_c3.svg')
    expect(assets.deviceQuestion).toBe('/assets/device_question_c3.svg')
    expect(assets.systemUpdate).toBe('/assets/system_update_c3.svg')
    expect(assets.exclamation).toBe('/assets/exclamation.svg')
    expect(assets.zadigCreateNewDevice).toBe('/assets/zadig_create_new_device.png')
    expect(assets.zadigForm).toBe('/assets/zadig_form.png')
  })

  it('should return asset paths via getAsset function', () => {
    expect(getAsset('bolt')).toBe('/assets/bolt.svg')
    expect(getAsset('comma')).toBe('/assets/comma.svg')
    expect(getAsset('nonexistent')).toBeNull()
  })

  it('should handle preloadCriticalAssets without errors', () => {
    // Mock document.createElement and document.head
    const mockLink = { rel: '', as: '', href: '' }
    const mockHead = { appendChild: vi.fn() }
    
    vi.stubGlobal('document', {
      createElement: vi.fn(() => mockLink),
      head: mockHead
    })

    expect(() => preloadCriticalAssets()).not.toThrow()
    expect(mockHead.appendChild).toHaveBeenCalledWith(mockLink)

    vi.unstubAllGlobals()
  })

  it('should use consistent asset base path', () => {
    // All assets should start with /assets/
    Object.values(assets).forEach(assetPath => {
      expect(assetPath).toMatch(/^\/assets\//)
    })
  })

  it('should export assets as default', async () => {
    // Test default export
    const { default: defaultAssets } = await import('./assets.js')
    expect(defaultAssets).toBe(assets)
  })
})
