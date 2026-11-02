import { describe, expect, it, vi } from 'vitest'

vi.mock('@commaai/qdl', () => ({ qdlDevice: vi.fn() }))
vi.mock('@commaai/qdl/usblib', () => ({ usbClass: vi.fn() }))
vi.mock('@commaai/qdl/sparse-stream', () => ({ selectSparseRanges: vi.fn((stream) => stream), validateSparseStreamMetadata: vi.fn() }))
vi.mock('./manifest', () => ({ getManifest: vi.fn() }))

import { getManifest } from './manifest'
import { FlashManager, StepCode, ErrorCode, checkCompatibleDevice } from './manager'

function setup(downloadImage) {
  const gpt = { name: 'gpt_main_0', gpt: { lun: 0 } }
  const system = { name: 'system', hasAB: true, size: 4096, archiveSize: 100, archiveFileName: 'system.zst',
    chunkSize: 4096, chunkHashes: ['0'.repeat(64)] }
  const userdata = { name: 'userdata_89', size: 4096 }
  getManifest.mockResolvedValue([gpt, system, userdata])
  const manager = new FlashManager(new ArrayBuffer(0))
  manager.step = StepCode.READY
  manager.imageManager = { downloadImage, prune: vi.fn(), getImage: vi.fn(async () => new Blob(['image'])) }
  manager.device = {
    connect: vi.fn(),
    getDeviceType: vi.fn(async () => 34),
    getStorageInfo: vi.fn(async () => ({ block_size: 4096, page_size: 4096, num_physical: 6, mem_type: 'UFS',
      prod_name: 'SDINDDH4-128G', manufacturer_id: 325, total_blocks: 29605888, serial_num: 1 })),
    repairGpt: vi.fn(async () => true),
    detectPartition: vi.fn(async () => [true, 0, { start: 8n, sectors: 8192n }]),
    eraseLun: vi.fn(async () => true),
    flashBlob: vi.fn(async () => true),
    canFlashStream: vi.fn(() => false),
    flashStream: vi.fn(async () => true),
    setActiveSlot: vi.fn(async () => true),
    reset: vi.fn(),
  }
  return manager
}

describe('image prefetch', () => {
  it('selects the validated userdata size for Samsung 128 GB storage', () => {
    const storage = { block_size: 4096, page_size: 4096, num_physical: 6, mem_type: 'UFS',
      prod_name: 'KLUDG4U1EA-B0C1', manufacturer_id: 462, total_blocks: 29765632 }
    expect(checkCompatibleDevice(storage)).toBe('userdata_90')
    expect(() => checkCompatibleDevice({ ...storage, total_blocks: 29765631 })).toThrow('Could not identify')
  })
  it('prefetches system, flashes slot A and shared images, then activates A', async () => {
    const events = []
    const manager = setup(vi.fn(async (image) => { events.push(`download ${image.name}`) }))
    const manifest = await getManifest()
    manifest.splice(1, 0, { name: 'boot', hasAB: true, size: 4096 })
    manifest.push({ name: 'cache', size: 4096 })
    manager.device.flashBlob.mockImplementation(async (name) => { events.push(`flash ${name}`); return true })
    manager.device.setActiveSlot.mockImplementation(async (slot) => { events.push(`activate ${slot}`); return true })
    manager.device.reset.mockImplementation(async () => { events.push('reset') })
    await manager.start()
    expect(manager.error).toBe(ErrorCode.NONE)
    expect(manager.step).toBe(StepCode.DONE)
    expect(events).toEqual(['download system', 'download gpt_main_0', 'download boot', 'download cache',
      'download userdata_89', 'flash boot_a', 'flash system_a', 'flash userdata', 'flash cache', 'activate a', 'reset'])
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
    expect(manager.device.flashBlob.mock.calls.map(([name]) => name)).toEqual(['system_a'])
    expect(manager.device.setActiveSlot).not.toHaveBeenCalled()
  })

  it('streams slot A before the system cache completes and waits for verified completion', async () => {
    let finish
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4096)); controller.close() } })
    const manager = setup(vi.fn(async (image, progress, signal, onStream) => {
      if (image.name === 'system') {
        onStream(stream)
        await new Promise((resolve) => { finish = resolve })
      }
    }))
    const system = (await getManifest())[1]
    system.stream = { extents: [[0n, 1n]] }
    system.fileSize = 4096
    manager.device.canFlashStream.mockReturnValue(true)
    manager.callbacks.onProgressChange = vi.fn()
    manager.device.flashStream.mockImplementation(async (names, metadata, payload, progress) => {
      await payload.pipeTo(new WritableStream())
      progress(4096)
      expect(manager.callbacks.onProgressChange).toHaveBeenLastCalledWith(0.5)
      manager.callbacks.onProgressChange.mockClear()
      finish()
      return true
    })
    manager.device.flashBlob.mockImplementation(async () => {
      expect(manager.callbacks.onProgressChange.mock.calls[0]).toEqual([1])
      return true
    })
    await manager.start()
    expect(manager.error).toBe(ErrorCode.NONE)
    expect(manager.device.canFlashStream).toHaveBeenCalledWith(1, 1)
    expect(manager.device.flashStream.mock.calls[0][0]).toBe('system_a')
    expect(manager.device.flashBlob.mock.calls.map(([name]) => name)).toEqual(['userdata'])
    expect(manager.step).toBe(StepCode.DONE)
  })

  it('uses the verified cached Blob when streaming is supported but no download is needed', async () => {
    const manager = setup(vi.fn(async (image, progress, signal, onStream) => { onStream?.(null) }))
    const system = (await getManifest())[1]
    system.stream = { extents: [[0n, 1n]] }
    system.fileSize = 4096
    manager.device.canFlashStream.mockReturnValue(true)
    await manager.start()
    expect(manager.device.flashStream).not.toHaveBeenCalled()
    expect(manager.device.flashBlob.mock.calls.map(([name]) => name)).toEqual(['system_a', 'userdata'])
  })

  it('cancels downloads and skips finalization when native streaming fails', async () => {
    const signals = []
    const manager = setup(vi.fn(async (image, progress, signal, onStream) => {
      signals.push(signal)
      onStream?.(new ReadableStream())
    }))
    const system = (await getManifest())[1]
    system.stream = { extents: [[0n, 1n]] }
    system.fileSize = 4096
    manager.device.canFlashStream.mockReturnValue(true)
    manager.device.flashStream.mockRejectedValue(new Error('Stream interrupted; power cycle required'))
    await manager.start()
    expect(manager.error).toBe(ErrorCode.FLASH_SYSTEM_FAILED)
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    expect(manager.device.setActiveSlot).not.toHaveBeenCalled()
    expect(manager.device.reset).not.toHaveBeenCalled()
  })
})
