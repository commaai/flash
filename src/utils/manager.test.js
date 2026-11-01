import { describe, expect, it, vi } from 'vitest'

vi.mock('@commaai/qdl', () => ({ qdlDevice: vi.fn() }))
vi.mock('@commaai/qdl/usblib', () => ({ usbClass: vi.fn() }))
vi.mock('./manifest', () => ({ getManifest: vi.fn() }))

import { getManifest } from './manifest'
import { FlashManager, StepCode, ErrorCode } from './manager'

function setup(downloadImage) {
  const gpt = { name: 'gpt_main_0', gpt: { lun: 0 } }
  const system = { name: 'system', hasAB: true, size: 4096 }
  const userdata = { name: 'userdata_89', size: 4096 }
  getManifest.mockResolvedValue([gpt, system, userdata])
  const manager = new FlashManager(new ArrayBuffer(0))
  manager.step = StepCode.READY
  manager.imageManager = { downloadImage, getImage: vi.fn(async () => new Blob(['image'])) }
  manager.device = {
    connect: vi.fn(),
    getDeviceType: vi.fn(async () => 34),
    getStorageInfo: vi.fn(async () => ({ block_size: 4096, page_size: 4096, num_physical: 6, mem_type: 'UFS',
      prod_name: 'SDINDDH4-128G', manufacturer_id: 325, total_blocks: 29605888, serial_num: 1 })),
    repairGpt: vi.fn(async () => true),
    detectPartition: vi.fn(async () => [true, 0, { start: 8n, sectors: 8192n }]),
    eraseLun: vi.fn(async () => true),
    flashBlob: vi.fn(async () => true),
    setActiveSlot: vi.fn(async () => true),
    reset: vi.fn(),
  }
  return manager
}

describe('image prefetch', () => {
  it('downloads the next image while flashing both slots of the current image', async () => {
    const events = []
    const manager = setup(vi.fn(async (image) => { events.push(`download ${image.name}`) }))
    manager.device.flashBlob.mockImplementation(async (name) => { events.push(`flash ${name}`); return true })
    await manager.start()
    expect(manager.error).toBe(ErrorCode.NONE)
    expect(manager.step).toBe(StepCode.DONE)
    expect(events).toEqual(['download gpt_main_0', 'download system', 'download userdata_89',
      'flash system_a', 'flash system_b', 'flash userdata'])
  })

  it('reports a failed prefetch after the current image and does not flash it', async () => {
    const manager = setup(vi.fn(async (image) => {
      if (image.name === 'userdata_89') throw new Error('download failed')
    }))
    manager.device.flashBlob.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      return true
    })
    await manager.start()
    expect(manager.error).toBe(ErrorCode.FLASH_SYSTEM_FAILED)
    expect(manager.device.flashBlob.mock.calls.map(([name]) => name)).toEqual(['system_a', 'system_b'])
    expect(manager.device.setActiveSlot).not.toHaveBeenCalled()
  })
})
