import { afterEach, describe, expect, test, vi } from 'vitest'

import { cleanupStorageProbe, runStorageProbe, StorageProbeError } from './image'

const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage')

function notFoundError() {
  return new DOMException('File not found', 'NotFoundError')
}

function createFakeOpfs({ failWrite = undefined } = {}) {
  let exists = false
  let size = 0
  let allZero = true
  const writes = []
  const removeEntry = vi.fn(async () => {
    if (!exists) throw notFoundError()
    exists = false
    size = 0
  })
  const createWritable = vi.fn(async () => {
    size = 0
    return {
      write: vi.fn(async (chunk) => {
        if (failWrite?.(writes.length, chunk)) throw new DOMException('Disk full', 'QuotaExceededError')
        allZero = allZero && chunk.every((byte) => byte === 0)
        writes.push(chunk.byteLength)
        size += chunk.byteLength
      }),
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
    }
  })
  const fileHandle = {
    getFile: vi.fn(async () => ({ size })),
    createWritable,
  }
  const root = {
    removeEntry,
    getFileHandle: vi.fn(async (_name, { create }) => {
      if (!exists && !create) throw notFoundError()
      if (create) exists = true
      return fileHandle
    }),
  }

  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { getDirectory: vi.fn(async () => root) },
  })

  return { createWritable, removeEntry, writes, allZero: () => allZero }
}

afterEach(() => {
  if (originalStorage) Object.defineProperty(navigator, 'storage', originalStorage)
  else delete navigator.storage
})

describe('storage balloon test', () => {
  test('writes blank data up to the requested size and retains the file', async () => {
    const opfs = createFakeOpfs()
    const progress = vi.fn()

    await expect(runStorageProbe({ targetBytes: 10, chunkBytes: 4, onProgress: progress }))
      .resolves.toEqual({ writtenBytes: 10 })
    expect(opfs.writes).toEqual([4, 4, 2])
    expect(opfs.allZero()).toBe(true)
    expect(progress).toHaveBeenLastCalledWith(1, 10)

    await expect(runStorageProbe({ targetBytes: 10, chunkBytes: 4 }))
      .resolves.toEqual({ writtenBytes: 10, reused: true })
    expect(opfs.createWritable).toHaveBeenCalledTimes(1)

    await cleanupStorageProbe()
    expect(opfs.removeEntry).toHaveBeenCalled()
  })

  test('reports bytes written and removes a partial file when the disk fills', async () => {
    const opfs = createFakeOpfs({ failWrite: (writeIndex) => writeIndex === 1 })

    const error = await runStorageProbe({ targetBytes: 12, chunkBytes: 4 }).catch((caught) => caught)

    expect(error).toBeInstanceOf(StorageProbeError)
    expect(error.writtenBytes).toBe(4)
    expect(opfs.removeEntry).toHaveBeenCalled()
  })

  test('removes the partial file when canceled', async () => {
    const opfs = createFakeOpfs()
    const controller = new AbortController()

    const probe = runStorageProbe({
      targetBytes: 12,
      chunkBytes: 4,
      onProgress: () => controller.abort(),
      signal: controller.signal,
    })

    await expect(probe).rejects.toMatchObject({ name: 'AbortError' })
    expect(opfs.removeEntry).toHaveBeenCalled()
  })
})
