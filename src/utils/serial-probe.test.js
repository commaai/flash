import { describe, expect, it, vi } from 'vitest'
import { measuredArchiveRate, preferFramedArchive, sampleVerifiedStream, serialProbeSize } from './serial-probe'

const image = { fileSize: 3799422044, chunkSize: 4 * 1024 * 1024, archiveSize: 886715983, framedArchiveSize: 944671310 }

function source(chunks, cancel) {
  return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close() }, cancel })
}

describe('serial decode calibration', () => {
  it('excludes the initial network burst when later rate samples are available', () => {
    expect(measuredArchiveRate([{ bytes: 8 << 20, bytesPerSecond: 49e6 },
      { bytes: 16 << 20, bytesPerSecond: 32e6 }, { bytes: 32 << 20, bytesPerSecond: 31e6 }])).toBe(32e6)
    expect(measuredArchiveRate([{ bytes: 8 << 20, bytesPerSecond: 120e6 }])).toBe(120e6)
  })
  it('caps the retained prefix at complete verified chunks and skips short images', () => {
    expect(serialProbeSize(image)).toBe(32 * 1024 * 1024)
    expect(serialProbeSize({ ...image, chunkSize: 3 * 1024 * 1024 })).toBe(30 * 1024 * 1024)
    expect(serialProbeSize({ ...image, fileSize: 32 * 1024 * 1024 })).toBe(0)
  })
  it('chooses frames for slow serial decoding and keeps solid when network or fast decoding wins', () => {
    const bytes = 32 * 1024 * 1024
    expect(preferFramedArchive(image, { bytes, seconds: 0.72 }, 32e6, bytes, 4)).toBe(true)
    expect(preferFramedArchive(image, { bytes, seconds: 0.11 }, 32e6, bytes, 4)).toBe(false)
    expect(preferFramedArchive(image, { bytes, seconds: 0.72 }, 8e6, bytes, 4)).toBe(false)
    expect(preferFramedArchive(image, { bytes, seconds: 0.72 }, 32e6, bytes, 1)).toBe(false)
    expect(preferFramedArchive(image, { bytes, seconds: 0 }, 32e6, bytes, 4)).toBe(false)
  })
  it('replays verified prefix bytes exactly once and continues the same reader', async () => {
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4]), new Uint8Array([5])]
    const decide = vi.fn(async () => false), cancel = vi.fn()
    const replay = await sampleVerifiedStream(source(chunks, cancel), 4, Promise.resolve(100), decide, () => 300)
    const received = []
    for await (const chunk of replay) received.push(...chunk)
    expect(received).toEqual([1, 2, 3, 4, 5])
    expect(decide).toHaveBeenCalledWith({ bytes: 4, seconds: 0.2 })
    expect(cancel).not.toHaveBeenCalled()
  })
  it('cancels the serial pipeline before accepting an alternative', async () => {
    const cancel = vi.fn()
    const input = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4)) }, cancel })
    expect(await sampleVerifiedStream(input, 4, 0, async () => true, () => 100)).toBeNull()
    expect(cancel).toHaveBeenCalledOnce()
    expect(input.locked).toBe(false)
  })
  it('rejects truncation, oversized chunks, decisions and propagates replay cancellation', async () => {
    await expect(sampleVerifiedStream(source([new Uint8Array(3)]), 4, 0, () => false)).rejects.toThrow('Incomplete')
    await expect(sampleVerifiedStream(source([new Uint8Array(5)]), 4, 0, () => false)).rejects.toThrow('bound')
    await expect(sampleVerifiedStream(source([new Uint8Array(4)]), 4, 0, () => { throw new Error('decision failed') })).rejects.toThrow('decision')
    const cancel = vi.fn(), input = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4)) }, cancel })
    const replay = await sampleVerifiedStream(input, 4, 0, async () => false)
    await replay.cancel('stopped')
    expect(cancel).toHaveBeenCalledWith('stopped')
    expect(input.locked).toBe(false)
  })
})
