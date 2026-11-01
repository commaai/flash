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

  it('rejects a writer verification error and terminates both workers', async () => {
    const pending = new ImageManager().downloadImage({})
    workers[1].onmessage({ data: { error: 'Checksum mismatch' } })
    await expect(pending).rejects.toThrow('Checksum mismatch')
    for (const worker of workers) expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
