import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StepCode, ErrorCode, checkCompatibleDevice, FlashManager } from '../manager'
import { getManifest } from '../manifest'
import { qdlDevice } from '@commaai/qdl'
import { usbClass } from '@commaai/qdl/usblib'

// Mock external dependencies
vi.mock('../manifest', () => ({
  getManifest: vi.fn()
}))

vi.mock('@commaai/qdl', () => ({
  qdlDevice: vi.fn()
}))

vi.mock('@commaai/qdl/usblib', () => ({
  usbClass: vi.fn()
}))

vi.mock('../progress', () => ({
  withProgress: (items, onProgress) => items.map(item => [item, onProgress]),
  createSteps: (steps, onProgress) => steps.map(() => onProgress)
}))

describe('StepCode constants', () => {
  it('should have correct step code values', () => {
    expect(StepCode.INITIALIZING).toBe(0)
    expect(StepCode.READY).toBe(1)
    expect(StepCode.CONNECTING).toBe(2)
    expect(StepCode.REPAIR_PARTITION_TABLES).toBe(3)
    expect(StepCode.ERASE_DEVICE).toBe(4)
    expect(StepCode.FLASH_SYSTEM).toBe(5)
    expect(StepCode.FINALIZING).toBe(6)
    expect(StepCode.DONE).toBe(7)
  })
})

describe('ErrorCode constants', () => {
  it('should have correct error code values', () => {
    expect(ErrorCode.UNKNOWN).toBe(-1)
    expect(ErrorCode.NONE).toBe(0)
    expect(ErrorCode.REQUIREMENTS_NOT_MET).toBe(1)
    expect(ErrorCode.STORAGE_SPACE).toBe(2)
    expect(ErrorCode.UNRECOGNIZED_DEVICE).toBe(3)
    expect(ErrorCode.LOST_CONNECTION).toBe(4)
    expect(ErrorCode.REPAIR_PARTITION_TABLES_FAILED).toBe(5)
    expect(ErrorCode.ERASE_FAILED).toBe(6)
    expect(ErrorCode.FLASH_SYSTEM_FAILED).toBe(7)
    expect(ErrorCode.FINALIZING_FAILED).toBe(8)
  })
})

describe('checkCompatibleDevice', () => {
  const baseValidStorageInfo = {
    block_size: 4096,
    page_size: 4096,
    num_physical: 6,
    mem_type: 'UFS'
  }

  it('should identify comma three H28S7Q302BMR device', () => {
    const storageInfo = {
      ...baseValidStorageInfo,
      prod_name: 'H28S7Q302BMR',
      manufacturer_id: 429,
      total_blocks: 14145536
    }
    
    expect(checkCompatibleDevice(storageInfo)).toBe('userdata_30')
  })

  it('should identify comma three H28U74301AMR device', () => {
    const storageInfo = {
      ...baseValidStorageInfo,
      prod_name: 'H28U74301AMR',
      manufacturer_id: 429,
      total_blocks: 14145536
    }
    
    expect(checkCompatibleDevice(storageInfo)).toBe('userdata_30')
  })

  it('should identify comma three 64GB-UFS-MT device with regex match', () => {
    const storageInfo = {
      ...baseValidStorageInfo,
      prod_name: '64GB-UFS-MT     8QSP',
      manufacturer_id: 300,
      total_blocks: 14143488
    }
    
    expect(checkCompatibleDevice(storageInfo)).toBe('userdata_30')
  })

  it('should identify comma 3X SDINDDH4-128G 1308 device', () => {
    const storageInfo = {
      ...baseValidStorageInfo,
      prod_name: 'SDINDDH4-128G   1308',
      manufacturer_id: 325,
      total_blocks: 29605888
    }
    
    expect(checkCompatibleDevice(storageInfo)).toBe('userdata_89')
  })

  it('should identify comma 3X SDINDDH4-128G 1272 device', () => {
    const storageInfo = {
      ...baseValidStorageInfo,
      prod_name: 'SDINDDH4-128G   1272',
      manufacturer_id: 325,
      total_blocks: 29775872
    }
    
    expect(checkCompatibleDevice(storageInfo)).toBe('userdata_90')
  })

  it('should throw error for invalid block size', () => {
    const storageInfo = {
      ...baseValidStorageInfo,
      block_size: 2048 // Invalid
    }
    
    expect(() => checkCompatibleDevice(storageInfo)).toThrow('UFS chip parameters mismatch')
  })

  it('should throw error for invalid page size', () => {
    const storageInfo = {
      ...baseValidStorageInfo,
      page_size: 2048 // Invalid
    }
    
    expect(() => checkCompatibleDevice(storageInfo)).toThrow('UFS chip parameters mismatch')
  })

  it('should throw error for invalid num_physical', () => {
    const storageInfo = {
      ...baseValidStorageInfo,
      num_physical: 4 // Invalid
    }
    
    expect(() => checkCompatibleDevice(storageInfo)).toThrow('UFS chip parameters mismatch')
  })

  it('should throw error for invalid mem_type', () => {
    const storageInfo = {
      ...baseValidStorageInfo,
      mem_type: 'eMMC' // Invalid
    }
    
    expect(() => checkCompatibleDevice(storageInfo)).toThrow('UFS chip parameters mismatch')
  })

  it('should throw error for unrecognized device', () => {
    const storageInfo = {
      ...baseValidStorageInfo,
      prod_name: 'UNKNOWN_DEVICE',
      manufacturer_id: 999,
      total_blocks: 999999
    }
    
    expect(() => checkCompatibleDevice(storageInfo)).toThrow('Could not identify UFS chip')
  })
})

describe('FlashManager', () => {
  let mockDevice
  let mockImageManager
  let callbacks
  let flashManager
  let mockProgrammer

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Mock device methods
    mockDevice = {
      connect: vi.fn(),
      getStorageInfo: vi.fn(),
      repairGpt: vi.fn(),
      detectPartition: vi.fn(),
      eraseLun: vi.fn(),
      flashBlob: vi.fn(),
      setActiveSlot: vi.fn(),
      reset: vi.fn()
    }
    
    qdlDevice.mockReturnValue(mockDevice)
    
    // Mock image manager
    mockImageManager = {
      init: vi.fn(),
      downloadImage: vi.fn(),
      getImage: vi.fn()
    }
    
    // Mock callbacks
    callbacks = {
      onStepChange: vi.fn(),
      onMessageChange: vi.fn(),
      onProgressChange: vi.fn(),
      onErrorChange: vi.fn(),
      onConnectionChange: vi.fn(),
      onSerialChange: vi.fn()
    }
    
    mockProgrammer = new ArrayBuffer(1024)
    
    // Mock browser APIs
    global.navigator = {
      usb: {}
    }
    global.Worker = vi.fn()
    global.Storage = vi.fn()
    
    flashManager = new FlashManager('https://manifest.url', mockProgrammer, callbacks)
  })

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(flashManager.manifestUrl).toBe('https://manifest.url')
      expect(flashManager.callbacks).toBe(callbacks)
      expect(flashManager.device).toBe(mockDevice)
      expect(flashManager.imageManager).toBeNull()
      expect(flashManager.manifest).toBeNull()
      expect(flashManager.step).toBe(StepCode.INITIALIZING)
      expect(flashManager.error).toBe(ErrorCode.NONE)
      expect(qdlDevice).toHaveBeenCalledWith(mockProgrammer)
    })

    it('should work without callbacks', () => {
      const manager = new FlashManager('https://manifest.url', mockProgrammer)
      expect(manager.callbacks).toEqual({})
    })
  })

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const mockManifest = [
        { name: 'system', size: 1000 },
        { name: 'userdata_30', size: 2000 }
      ]
      
      getManifest.mockResolvedValue(mockManifest)
      
      await flashManager.initialize(mockImageManager)
      
      expect(flashManager.imageManager).toBe(mockImageManager)
      expect(mockImageManager.init).toHaveBeenCalled()
      expect(getManifest).toHaveBeenCalledWith('https://manifest.url')
      expect(flashManager.manifest).toBe(mockManifest)
      expect(flashManager.step).toBe(StepCode.READY)
      expect(callbacks.onStepChange).toHaveBeenCalledWith(StepCode.READY)
    })

    it('should fail if WebUSB not supported', async () => {
      global.navigator = {}
      
      await flashManager.initialize(mockImageManager)
      
      expect(flashManager.error).toBe(ErrorCode.REQUIREMENTS_NOT_MET)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.REQUIREMENTS_NOT_MET)
    })

    it('should fail if Web Workers not supported', async () => {
      global.Worker = undefined
      
      await flashManager.initialize(mockImageManager)
      
      expect(flashManager.error).toBe(ErrorCode.REQUIREMENTS_NOT_MET)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.REQUIREMENTS_NOT_MET)
    })

    it('should fail if Storage API not supported', async () => {
      global.Storage = undefined
      
      await flashManager.initialize(mockImageManager)
      
      expect(flashManager.error).toBe(ErrorCode.REQUIREMENTS_NOT_MET)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.REQUIREMENTS_NOT_MET)
    })

    it('should handle image manager initialization failure', async () => {
      mockImageManager.init.mockRejectedValue(new Error('Init failed'))
      
      await flashManager.initialize(mockImageManager)
      
      expect(flashManager.error).toBe(ErrorCode.UNKNOWN)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.UNKNOWN)
    })

    it('should handle storage space error', async () => {
      mockImageManager.init.mockRejectedValue('Not enough storage space')
      
      await flashManager.initialize(mockImageManager)
      
      expect(flashManager.error).toBe(ErrorCode.UNKNOWN) // String errors default to UNKNOWN
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.UNKNOWN)
    })

    it('should handle manifest fetch failure', async () => {
      getManifest.mockRejectedValue(new Error('Manifest fetch failed'))
      
      await flashManager.initialize(mockImageManager)
      
      expect(flashManager.error).toBe(ErrorCode.UNKNOWN)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.UNKNOWN)
    })

    it('should handle empty manifest', async () => {
      getManifest.mockResolvedValue([])
      
      await flashManager.initialize(mockImageManager)
      
      expect(flashManager.error).toBe(ErrorCode.UNKNOWN)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.UNKNOWN)
    })
  })

  describe('start', () => {
    beforeEach(() => {
      flashManager.step = StepCode.READY
      flashManager.imageManager = mockImageManager
      flashManager.manifest = [
        { name: 'system', size: 1000, hasAB: true },
        { name: 'userdata_30', size: 2000, hasAB: false },
        { name: 'gpt0', gpt: { lun: 0 } }
      ]
    })

    it('should not start if not in READY state', async () => {
      flashManager.step = StepCode.INITIALIZING
      
      await flashManager.start()
      
      expect(mockDevice.connect).not.toHaveBeenCalled()
    })

    it('should handle connection failure', async () => {
      usbClass.mockImplementation(() => { throw new Error('USB error') })
      
      await flashManager.start()
      
      expect(flashManager.step).toBe(StepCode.REPAIR_PARTITION_TABLES) // Failed during repair due to no manifest
      expect(callbacks.onConnectionChange).toHaveBeenCalledWith(false)
    })

    it('should handle device connection error', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockRejectedValue(new Error('Connection failed'))
      
      await flashManager.start()
      
      expect(flashManager.error).toBe(ErrorCode.LOST_CONNECTION)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.LOST_CONNECTION)
      expect(callbacks.onConnectionChange).toHaveBeenCalledWith(false)
    })

    it('should handle storage info failure', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockRejectedValue(new Error('Storage info failed'))
      
      await flashManager.start()
      
      expect(flashManager.error).toBe(ErrorCode.LOST_CONNECTION)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.LOST_CONNECTION)
      expect(callbacks.onConnectionChange).toHaveBeenCalledWith(false)
    })

    it('should handle unrecognized device', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'UNKNOWN',
        manufacturer_id: 999,
        total_blocks: 999999,
        serial_num: 123456789
      })
      
      await flashManager.start()
      
      expect(flashManager.error).toBe(ErrorCode.UNRECOGNIZED_DEVICE)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.UNRECOGNIZED_DEVICE)
    })

    it('should successfully connect and identify device', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'H28S7Q302BMR',
        manufacturer_id: 429,
        total_blocks: 14145536,
        serial_num: 0x12345678
      })
      
      // Mock the rest of the flash process to fail quickly for testing
      mockDevice.detectPartition.mockResolvedValue([false, 0, null])
      
      await flashManager.start()
      
      expect(callbacks.onConnectionChange).toHaveBeenCalledWith(true)
      expect(callbacks.onSerialChange).toHaveBeenCalledWith('12345678')
      expect(flashManager.step).toBe(StepCode.REPAIR_PARTITION_TABLES) // Should fail during repair (no manifest)
    })

    it('should handle repair partition tables failure', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'H28S7Q302BMR',
        manufacturer_id: 429,
        total_blocks: 14145536,
        serial_num: 0x12345678
      })

      // Mock manifest with GPT images but make repair fail
      flashManager.manifest = [
        { name: 'gpt0', gpt: { lun: 0 } },
        { name: 'gpt1', gpt: { lun: 1 } }
      ]
      mockImageManager.downloadImage.mockResolvedValue()
      mockImageManager.getImage.mockResolvedValue(new Blob(['gpt data']))
      mockDevice.repairGpt.mockResolvedValue(false) // Repair fails
      
      await flashManager.start()
      
      expect(flashManager.error).toBe(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
    })

    it('should handle no GPT images in manifest', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'H28S7Q302BMR',
        manufacturer_id: 429,
        total_blocks: 14145536,
        serial_num: 0x12345678
      })

      // Mock manifest without GPT images
      flashManager.manifest = [
        { name: 'system', size: 1000 },
        { name: 'userdata_30', size: 2000 }
      ]
      
      await flashManager.start()
      
      expect(flashManager.error).toBe(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
    })

    it('should handle persist partition not found during erase', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'H28S7Q302BMR',
        manufacturer_id: 429,
        total_blocks: 14145536,
        serial_num: 0x12345678
      })

      // Provide complete manifest with GPT images for repair to succeed
      flashManager.manifest = [
        { name: 'gpt0', gpt: { lun: 0 } },
        { name: 'gpt1', gpt: { lun: 1 } },
        { name: 'gpt2', gpt: { lun: 2 } },
        { name: 'gpt3', gpt: { lun: 3 } },
        { name: 'gpt4', gpt: { lun: 4 } },
        { name: 'gpt5', gpt: { lun: 5 } }
      ]
      mockImageManager.downloadImage.mockResolvedValue()
      mockImageManager.getImage.mockResolvedValue(new Blob(['gpt data']))
      mockDevice.repairGpt.mockResolvedValue(true) // Repair succeeds
      mockDevice.detectPartition.mockResolvedValue([false, 0, null]) // Persist not found during erase
      
      await flashManager.start()
      
      expect(flashManager.error).toBe(ErrorCode.ERASE_FAILED)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.ERASE_FAILED)
    })

    it('should handle persist partition with wrong properties', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'H28S7Q302BMR',
        manufacturer_id: 429,
        total_blocks: 14145536,
        serial_num: 0x12345678
      })

      // Provide complete manifest with GPT images for repair to succeed
      flashManager.manifest = [
        { name: 'gpt0', gpt: { lun: 0 } },
        { name: 'gpt1', gpt: { lun: 1 } },
        { name: 'gpt2', gpt: { lun: 2 } },
        { name: 'gpt3', gpt: { lun: 3 } },
        { name: 'gpt4', gpt: { lun: 4 } },
        { name: 'gpt5', gpt: { lun: 5 } }
      ]
      mockImageManager.downloadImage.mockResolvedValue()
      mockImageManager.getImage.mockResolvedValue(new Blob(['gpt data']))
      mockDevice.repairGpt.mockResolvedValue(true) // Repair succeeds
      // Wrong persist partition properties during erase
      mockDevice.detectPartition.mockResolvedValue([true, 0, { start: 16n, sectors: 4096n }])
      
      await flashManager.start()
      
      expect(flashManager.error).toBe(ErrorCode.ERASE_FAILED)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.ERASE_FAILED)
    })

    it('should handle erase LUN failure', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'H28S7Q302BMR',
        manufacturer_id: 429,
        total_blocks: 14145536,
        serial_num: 0x12345678
      })

      // Provide complete manifest with GPT images for repair to succeed
      flashManager.manifest = [
        { name: 'gpt0', gpt: { lun: 0 } },
        { name: 'gpt1', gpt: { lun: 1 } },
        { name: 'gpt2', gpt: { lun: 2 } },
        { name: 'gpt3', gpt: { lun: 3 } },
        { name: 'gpt4', gpt: { lun: 4 } },
        { name: 'gpt5', gpt: { lun: 5 } }
      ]
      mockImageManager.downloadImage.mockResolvedValue()
      mockImageManager.getImage.mockResolvedValue(new Blob(['gpt data']))
      mockDevice.repairGpt.mockResolvedValue(true) // Repair succeeds
      mockDevice.detectPartition.mockResolvedValue([true, 0, { start: 8n, sectors: 8192n }]) // Correct persist partition
      mockDevice.eraseLun.mockResolvedValue(false) // Erase LUN fails
      
      await flashManager.start()
      
      expect(flashManager.error).toBe(ErrorCode.ERASE_FAILED)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.ERASE_FAILED)
    })

    it('should handle missing userdata image during flash system', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'H28S7Q302BMR',
        manufacturer_id: 429,
        total_blocks: 14145536,
        serial_num: 0x12345678
      })

      // Manifest with GPT images + wrong userdata image
      flashManager.manifest = [
        { name: 'gpt0', gpt: { lun: 0 } },
        { name: 'gpt1', gpt: { lun: 1 } },
        { name: 'gpt2', gpt: { lun: 2 } },
        { name: 'gpt3', gpt: { lun: 3 } },
        { name: 'gpt4', gpt: { lun: 4 } },
        { name: 'gpt5', gpt: { lun: 5 } },
        { name: 'system', size: 1000 },
        { name: 'userdata_89', size: 2000 } // Wrong userdata image (should be userdata_30)
      ]
      mockImageManager.downloadImage.mockResolvedValue()
      mockImageManager.getImage.mockResolvedValue(new Blob(['data']))
      mockDevice.repairGpt.mockResolvedValue(true) // Repair succeeds
      mockDevice.detectPartition.mockResolvedValue([true, 0, { start: 8n, sectors: 8192n }]) // Correct persist
      mockDevice.eraseLun.mockResolvedValue(true) // Erase succeeds
      
      await flashManager.start()
      
      expect(flashManager.error).toBe(ErrorCode.UNKNOWN)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.UNKNOWN)
    })

    it('should handle flash blob failure', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'H28S7Q302BMR',
        manufacturer_id: 429,
        total_blocks: 14145536,
        serial_num: 0x12345678
      })

      // Complete manifest with GPT images + system images
      flashManager.manifest = [
        { name: 'gpt0', gpt: { lun: 0 } },
        { name: 'gpt1', gpt: { lun: 1 } },
        { name: 'gpt2', gpt: { lun: 2 } },
        { name: 'gpt3', gpt: { lun: 3 } },
        { name: 'gpt4', gpt: { lun: 4 } },
        { name: 'gpt5', gpt: { lun: 5 } },
        { name: 'system', size: 1000, hasAB: true },
        { name: 'userdata_30', size: 2000, hasAB: false }
      ]
      mockImageManager.downloadImage.mockResolvedValue()
      mockImageManager.getImage.mockResolvedValue(new Blob(['data']))
      mockDevice.repairGpt.mockResolvedValue(true) // Repair succeeds
      mockDevice.detectPartition.mockResolvedValue([true, 0, { start: 8n, sectors: 8192n }]) // Correct persist
      mockDevice.eraseLun.mockResolvedValue(true) // Erase succeeds
      mockDevice.flashBlob.mockResolvedValue(false) // Flash blob fails
      
      await flashManager.start()
      
      expect(flashManager.error).toBe(ErrorCode.FLASH_SYSTEM_FAILED)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.FLASH_SYSTEM_FAILED)
    })

    it('should handle finalize failure when setting active slot', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'H28S7Q302BMR',
        manufacturer_id: 429,
        total_blocks: 14145536,
        serial_num: 0x12345678
      })

      // Complete manifest with GPT images + system images
      flashManager.manifest = [
        { name: 'gpt0', gpt: { lun: 0 } },
        { name: 'gpt1', gpt: { lun: 1 } },
        { name: 'gpt2', gpt: { lun: 2 } },
        { name: 'gpt3', gpt: { lun: 3 } },
        { name: 'gpt4', gpt: { lun: 4 } },
        { name: 'gpt5', gpt: { lun: 5 } },
        { name: 'system', size: 1000, hasAB: true },
        { name: 'userdata_30', size: 2000, hasAB: false }
      ]
      mockImageManager.downloadImage.mockResolvedValue()
      mockImageManager.getImage.mockResolvedValue(new Blob(['data']))
      mockDevice.repairGpt.mockResolvedValue(true) // Repair succeeds
      mockDevice.detectPartition.mockResolvedValue([true, 0, { start: 8n, sectors: 8192n }]) // Correct persist
      mockDevice.eraseLun.mockResolvedValue(true) // Erase succeeds
      mockDevice.flashBlob.mockResolvedValue(true) // Flash succeeds
      mockDevice.setActiveSlot.mockResolvedValue(false) // Set active slot fails
      mockDevice.reset.mockResolvedValue()
      
      await flashManager.start()
      
      expect(flashManager.error).toBe(ErrorCode.FINALIZING_FAILED)
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.FINALIZING_FAILED)
    })

    it('should complete successful flash process', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'H28S7Q302BMR',
        manufacturer_id: 429,
        total_blocks: 14145536,
        serial_num: 0x12345678
      })

      // Complete manifest with GPT images + system images
      flashManager.manifest = [
        { name: 'gpt0', gpt: { lun: 0 } },
        { name: 'gpt1', gpt: { lun: 1 } },
        { name: 'gpt2', gpt: { lun: 2 } },
        { name: 'gpt3', gpt: { lun: 3 } },
        { name: 'gpt4', gpt: { lun: 4 } },
        { name: 'gpt5', gpt: { lun: 5 } },
        { name: 'system', size: 1000, hasAB: true },
        { name: 'userdata_30', size: 2000, hasAB: false }
      ]
      mockImageManager.downloadImage.mockResolvedValue()
      mockImageManager.getImage.mockResolvedValue(new Blob(['data']))
      mockDevice.repairGpt.mockResolvedValue(true) // Repair succeeds
      mockDevice.detectPartition.mockResolvedValue([true, 0, { start: 8n, sectors: 8192n }]) // Correct persist
      mockDevice.eraseLun.mockResolvedValue(true) // Erase succeeds
      mockDevice.flashBlob.mockResolvedValue(true) // Flash succeeds
      mockDevice.setActiveSlot.mockResolvedValue(true) // Set active slot succeeds
      mockDevice.reset.mockResolvedValue() // Reset succeeds
      
      await flashManager.start()
      
      expect(flashManager.step).toBe(StepCode.DONE)
      expect(flashManager.error).toBe(ErrorCode.NONE)
      expect(callbacks.onStepChange).toHaveBeenCalledWith(StepCode.DONE)
      expect(callbacks.onConnectionChange).toHaveBeenCalledWith(false) // Disconnected after reboot
    })
  })

  describe('callback integration', () => {
    it('should call callbacks during initialization success', async () => {
      const mockManifest = [
        { name: 'system', size: 1000 },
        { name: 'userdata_30', size: 2000 }
      ]
      
      getManifest.mockResolvedValue(mockManifest)
      
      await flashManager.initialize(mockImageManager)
      
      expect(callbacks.onStepChange).toHaveBeenCalledWith(StepCode.READY)
    })

    it('should call callbacks during initialization failure', async () => {
      global.navigator = {} // Remove WebUSB support
      
      await flashManager.initialize(mockImageManager)
      
      expect(callbacks.onErrorChange).toHaveBeenCalledWith(ErrorCode.REQUIREMENTS_NOT_MET)
    })

    it('should call callbacks during connection process', async () => {
      const mockUsb = {}
      usbClass.mockReturnValue(mockUsb)
      mockDevice.connect.mockResolvedValue()
      mockDevice.getStorageInfo.mockResolvedValue({
        block_size: 4096,
        page_size: 4096,
        num_physical: 6,
        mem_type: 'UFS',
        prod_name: 'H28S7Q302BMR',
        manufacturer_id: 429,
        total_blocks: 14145536,
        serial_num: 0x12345678
      })

      // Set step to READY and provide complete manifest to succeed connection and repair, then fail during erase
      flashManager.step = StepCode.READY
      flashManager.imageManager = mockImageManager
      flashManager.manifest = [
        { name: 'gpt0', gpt: { lun: 0 } }
      ]
      mockImageManager.downloadImage.mockResolvedValue()
      mockImageManager.getImage.mockResolvedValue(new Blob(['gpt data']))
      mockDevice.repairGpt.mockResolvedValue(true)
      mockDevice.detectPartition.mockResolvedValue([false, 0, null]) // Fail during erase
      
      await flashManager.start()
      
      expect(callbacks.onConnectionChange).toHaveBeenCalledWith(true)
      expect(callbacks.onSerialChange).toHaveBeenCalledWith('12345678')
      expect(callbacks.onStepChange).toHaveBeenCalledWith(StepCode.CONNECTING)
      expect(callbacks.onStepChange).toHaveBeenCalledWith(StepCode.REPAIR_PARTITION_TABLES)
      expect(callbacks.onStepChange).toHaveBeenCalledWith(StepCode.ERASE_DEVICE)
    })
  })
})