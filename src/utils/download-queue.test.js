import { describe, expect, it, vi } from 'vitest'
import { DownloadQueue } from './download-queue'

function harness() {
  const pending = new Map()
  const manager = { downloadImage: vi.fn((image, onProgress, signal) => new Promise((resolve, reject) => {
    pending.set(image, { resolve, reject, onProgress })
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })) }
  const images = ['system', 'gpt0', 'gpt1', 'boot', 'userdata']
  return { manager, images, pending }
}

describe('download queue', () => {
  it('starts in priority order, limits concurrency, and serves completed images', async () => {
    const { manager, images, pending } = harness()
    const queue = new DownloadQueue(manager, images, 2)
    expect(manager.downloadImage.mock.calls.map(([image]) => image)).toEqual(['system', 'gpt0'])
    pending.get('gpt0').resolve()
    await queue.get('gpt0')
    expect(manager.downloadImage.mock.calls.map(([image]) => image)).toEqual(['system', 'gpt0', 'gpt1'])
    const progress = vi.fn()
    await queue.get('gpt0', progress)
    expect(progress).toHaveBeenLastCalledWith(1)
    queue.cancel()
  })

  it('rejects active and queued downloads on cancellation without starting more', async () => {
    const { manager, images } = harness()
    const queue = new DownloadQueue(manager, images, 2)
    queue.cancel()
    for (const image of images) await expect(queue.get(image)).rejects.toThrow('aborted')
    expect(manager.downloadImage).toHaveBeenCalledTimes(2)
  })

  it('retains a prefetch failure until the consumer requests that image', async () => {
    const { manager, images, pending } = harness()
    const queue = new DownloadQueue(manager, images, 2)
    pending.get('system').reject(new Error('connection failed'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await expect(queue.get('system')).rejects.toThrow('connection failed')
    queue.cancel()
  })

  it('defers userdata until the system and firmware downloads finish', async () => {
    const { manager, pending } = harness()
    const queue = new DownloadQueue(manager, ['system', 'boot'], 4, ['userdata'])
    pending.get('boot').resolve()
    await queue.get('boot')
    expect(pending.has('userdata')).toBe(false)
    pending.get('system').resolve()
    await queue.get('system')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(pending.has('userdata')).toBe(true)
    queue.cancel()
  })

  it('makes a verified stream available before its cache completes and continues prefetching', async () => {
    let finish
    const stream = new ReadableStream()
    const manager = { downloadImage: vi.fn((image, progress, signal, onStream) => {
      if (image === 'system') {
        onStream(stream)
        return new Promise((resolve) => { finish = resolve })
      }
      return Promise.resolve()
    }) }
    const queue = new DownloadQueue(manager, ['system', 'boot'], 1, ['userdata'], ['system'])
    expect(await queue.getStream('system')).toBe(stream)
    await queue.get('userdata')
    expect(manager.downloadImage.mock.calls.map(([image]) => image)).toEqual(['system', 'boot', 'userdata'])
    finish()
    await queue.get('system')
    queue.cancel()
  })

  it('reprioritizes unopened downloads without restarting active images', async () => {
    const { manager, images, pending } = harness()
    const queue = new DownloadQueue(manager, images, 1)
    queue.prioritize(['boot', 'gpt1'])
    expect(manager.downloadImage.mock.calls.map(([image]) => image)).toEqual(['system'])
    pending.get('system').resolve()
    await queue.get('system')
    expect(manager.downloadImage.mock.calls.map(([image]) => image)).toEqual(['system', 'boot'])
    pending.get('boot').resolve()
    await queue.get('boot')
    expect(manager.downloadImage.mock.calls.map(([image]) => image)).toEqual(['system', 'boot', 'gpt1'])
    queue.cancel()
  })
})
