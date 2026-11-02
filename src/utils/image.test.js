import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageManager } from './image'

let workers
beforeEach(() => {
  workers = []
  vi.stubGlobal('Worker', class {
    constructor() { workers.push(this) }
    postMessage = vi.fn()
    terminate = vi.fn()
  })
  vi.stubGlobal('MessageChannel', class {
    port1 = {}
    port2 = {}
  })
})

describe('download workers', () => {
  it('terminates both workers on cancellation and ignores late completion', async () => {
    const controller = new AbortController()
    const pending = new ImageManager().downloadImage({}, undefined, controller.signal)
    controller.abort()
    workers[1].onmessage({ data: { done: true } })
    await expect(pending).rejects.toThrow('aborted')
    expect(workers).toHaveLength(2)
    for (const worker of workers) expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('reuses a committed image with the expected content hash name and length', async () => {
    const manager = new ImageManager()
    manager.root = { getFileHandle: vi.fn(async () => ({ getFile: async () => ({ size: 123 }) })) }
    const progress = vi.fn()
    await manager.downloadImage({ fileName: 'system-verified-hash.img', fileSize: 123 }, progress)
    expect(manager.root.getFileHandle).toHaveBeenCalledWith('system-verified-hash.img', { create: false })
    expect(workers).toHaveLength(0)
    expect(progress).toHaveBeenLastCalledWith(1)
  })

  it('prunes obsolete files and keeps only images with known complete lengths', async () => {
    const manager = new ImageManager()
    manager.root = {
      async *entries() { for (const name of ['keep.img', 'old.img', 'legacy.img']) yield [name, {}] },
      removeEntry: vi.fn(),
    }
    await manager.prune([{ fileName: 'keep.img', fileSize: 123 }, { fileName: 'legacy.img' }])
    expect(manager.root.removeEntry.mock.calls).toEqual([['old.img'], ['legacy.img']])
  })

  it('rejects a writer verification error and terminates both workers', async () => {
    const pending = new ImageManager().downloadImage({})
    workers[1].onmessage({ data: { error: 'Checksum mismatch' } })
    await expect(pending).rejects.toThrow('Checksum mismatch')
    for (const worker of workers) expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('retains the writer after cache completion until the transferred stream reaches EOF', async () => {
    let received
    const ready = new Promise((resolve) => { received = resolve })
    const complete = new ImageManager().downloadImage({}, undefined, undefined, received)
    const source = new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]))
      controller.close()
    } })
    workers[1].onmessage({ data: { stream: source } })
    workers[1].onmessage({ data: { done: true } })
    workers[0].onmessage({ data: { cacheDone: true } })
    const stream = await ready
    for (const worker of workers) expect(worker.terminate).not.toHaveBeenCalled()
    const chunks = []
    await stream.pipeTo(new WritableStream({ write(chunk) { chunks.push(...chunk) } }))
    await complete
    expect(chunks).toEqual([1, 2, 3])
    for (const worker of workers) expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('errors a pending exposed stream read when the download is aborted', async () => {
    const controller = new AbortController()
    let received
    const ready = new Promise((resolve) => { received = resolve })
    const complete = new ImageManager().downloadImage({}, undefined, controller.signal, received)
    workers[1].onmessage({ data: { stream: new ReadableStream() } })
    const reader = (await ready).getReader()
    const reading = reader.read()
    controller.abort()
    await expect(reading).rejects.toThrow('aborted')
    await expect(complete).rejects.toThrow('aborted')
    for (const worker of workers) expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('owns and terminates every parallel decoder on cancellation', async () => {
    const controller = new AbortController()
    const complete = new ImageManager().downloadImage({}, undefined, controller.signal, vi.fn())
    workers[0].onmessage({ data: { frameWorkers: 4 } })
    expect(workers).toHaveLength(6)
    controller.abort()
    await expect(complete).rejects.toThrow('aborted')
    for (const worker of workers) expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('reuses the initial link measurement within one flash and resets it for the next', async () => {
    const manager = new ImageManager()
    const first = manager.downloadImage({})
    workers[0].onmessage({ data: { fastLink: true } })
    workers[1].onmessage({ data: { done: true } })
    await first
    const second = manager.downloadImage({})
    expect(workers[2].postMessage.mock.calls[0][0].fastLink).toBe(true)
    workers[3].onmessage({ data: { done: true } })
    await second
    manager.root = { async *entries() {} }
    await manager.prune([])
    expect(manager.fastLink).toBeUndefined()
    workers[0].onmessage({ data: { fastLink: true } })
    expect(manager.fastLink).toBeUndefined()
  })
})
