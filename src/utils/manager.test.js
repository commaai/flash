import { describe, expect, it, vi } from 'vitest'
import { Blob } from 'node:buffer'

vi.mock('@commaai/qdl', () => ({ qdlDevice: vi.fn() }))
vi.mock('@commaai/qdl/usblib', () => ({ usbClass: vi.fn() }))
vi.mock('@commaai/qdl/sparse-stream', () => ({ selectSparseRanges: vi.fn((stream) => stream), validateSparseStreamMetadata: vi.fn() }))
vi.mock('@commaai/qdl/lz4-stream', () => ({ validateLz4Metadata: vi.fn() }))
vi.mock('@commaai/qdl/calibration', () => ({
  CalibrationLayoutError: class CalibrationLayoutError extends Error {},
  canPreserveDdr: vi.fn(() => true),
  ddrPartitionFromGpt: vi.fn((gpt) => gpt),
  readDdrPartition: vi.fn(() => ({ name: 'ddr' })),
}))
vi.mock('./manifest', () => ({ getManifest: vi.fn(), validateLz4Alternative: vi.fn() }))

import { getManifest } from './manifest'
import { CalibrationLayoutError, canPreserveDdr, readDdrPartition } from '@commaai/qdl/calibration'
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
    getGpt: vi.fn(async () => ({ name: 'ddr' })),
    detectPartition: vi.fn(async () => [true, 0, { start: 8n, sectors: 8192n }]),
    eraseLun: vi.fn(async () => true),
    flashBlob: vi.fn(async () => true),
    canFlashStream: vi.fn(() => false),
    flashStream: vi.fn(async () => true),
    canFlashLz4Stream: vi.fn(() => false),
    flashLz4Stream: vi.fn(async () => true),
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
    expect(manager.device.canFlashStream).toHaveBeenCalledWith(1)
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

  it.each([true, false])('routes the selected verified transport, LZ4=%s', async (selectedLz4) => {
    const stream = new ReadableStream({ start(controller) { controller.close() } })
    const manager = setup(vi.fn(async (image, progress, signal, onStream) => {
      onStream?.(stream, selectedLz4 ? image.lz4 : image)
    }))
    const system = (await getManifest())[1]
    system.stream = { extents: [[0n, 1n]] }
    system.fileSize = 4096
    system.lz4 = { ...system, isLz4: true, stream: { extents: [[0n, 1n]], compressedBytes: 4096, firstFrameBytes: 4096 } }
    manager.device.canFlashStream.mockReturnValue(true)
    manager.device.canFlashLz4Stream.mockReturnValue(true)
    await manager.start()
    expect(manager.error).toBe(ErrorCode.NONE)
    expect(system.useLz4).toBe(true)
    const selected = selectedLz4 ? manager.device.flashLz4Stream : manager.device.flashStream
    const unused = selectedLz4 ? manager.device.flashStream : manager.device.flashLz4Stream
    expect(selected).toHaveBeenCalledWith('system_a', selectedLz4 ? system.lz4.stream : system.stream,
      stream, expect.any(Function), false)
    expect(unused).not.toHaveBeenCalled()
    expect(manager.device.flashBlob.mock.calls.map(([name]) => name)).toEqual(['userdata'])
  })

  it('ignores the LZ4 companion on firmware without that capability', async () => {
    const manager = setup(vi.fn(async (image, progress, signal, onStream) => { onStream?.(null) }))
    const system = (await getManifest())[1]
    system.stream = { extents: [[0n, 1n]] }
    system.fileSize = 4096
    system.lz4 = { stream: { extents: [] } }
    manager.device.canFlashStream.mockReturnValue(true)
    await manager.start()
    expect(manager.error).toBe(ErrorCode.NONE)
    expect(system.useLz4).toBe(false)
    expect(manager.device.flashLz4Stream).not.toHaveBeenCalled()
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

  it('does not reboot when slot A could not be activated', async () => {
    const manager = setup(vi.fn(async () => {}))
    manager.device.setActiveSlot.mockResolvedValue(false)
    await manager.start()
    expect(manager.error).toBe(ErrorCode.FINALIZING_FAILED)
    expect(manager.device.reset).not.toHaveBeenCalled()
    expect(manager.step).not.toBe(StepCode.DONE)
  })

  it('validates existing and desired DDR before any GPT write and preserves the same device calibration', async () => {
    const events = [], manager = setup(vi.fn(async () => {}))
    const manifest = await getManifest()
    manifest.push({ name: 'gpt_main_3', gpt: { lun: 3 } })
    manager.device.getGpt.mockImplementation(async () => { events.push('inspect'); return { name: 'ddr' } })
    manager.device.repairGpt.mockImplementation(async () => { events.push('repair'); return true })
    await manager.start()
    expect(events).toEqual(['inspect', 'repair', 'repair', 'inspect'])
    expect(manager.device.eraseLun).toHaveBeenCalledWith(3, ['mbr', 'gpt', 'ddr'])
    expect(manager.device.eraseLun).toHaveBeenCalledWith(0, ['mbr', 'gpt', 'persist'])
  })

  it('erases DDR when its validated geometry does not match', async () => {
    const manager = setup(vi.fn(async () => {}))
    ;(await getManifest()).push({ name: 'gpt_main_3', gpt: { lun: 3 } })
    canPreserveDdr.mockReturnValueOnce(false)
    await manager.start()
    expect(manager.device.eraseLun).toHaveBeenCalledWith(3, ['mbr', 'gpt'])
  })

  it('does not erase if repair unexpectedly changed the calibration layout', async () => {
    const manager = setup(vi.fn(async () => {}))
    ;(await getManifest()).push({ name: 'gpt_main_3', gpt: { lun: 3 } })
    canPreserveDdr.mockReturnValueOnce(true).mockReturnValueOnce(false)
    await manager.start()
    expect(manager.device.eraseLun).not.toHaveBeenCalled()
    expect(manager.error).toBe(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
  })

  it('rejects invalid desired GPT metadata before any device write', async () => {
    const manager = setup(vi.fn(async () => {}))
    ;(await getManifest()).push({ name: 'gpt_main_3', gpt: { lun: 3 } })
    readDdrPartition.mockImplementationOnce(() => { throw new CalibrationLayoutError('Invalid desired GPT') })
    await manager.start()
    expect(manager.device.getGpt).not.toHaveBeenCalled()
    expect(manager.device.repairGpt).not.toHaveBeenCalled()
    expect(manager.device.eraseLun).not.toHaveBeenCalled()
    expect(manager.error).toBe(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
  })

  it('repairs corrupt GPT metadata but aborts before writes on a transport failure', async () => {
    for (const error of [Object.assign(new Error('Corrupt GPT'), { code: 'GPT_CORRUPT' }), new Error('USB disconnected')]) {
      const manager = setup(vi.fn(async () => {}))
      ;(await getManifest()).push({ name: 'gpt_main_3', gpt: { lun: 3 } })
      manager.device.getGpt.mockRejectedValue(error)
      await manager.start()
      if (error.code === 'GPT_CORRUPT') {
        expect(manager.device.eraseLun).toHaveBeenCalledWith(3, ['mbr', 'gpt'])
        expect(manager.error).toBe(ErrorCode.NONE)
      } else {
        expect(manager.device.repairGpt).not.toHaveBeenCalled()
        expect(manager.device.eraseLun).not.toHaveBeenCalled()
        expect(manager.error).toBe(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
      }
    }
  })
})
