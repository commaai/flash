import { describe, expect, it, vi } from 'vitest'
import { createArchiveWriter, openCachedArchive } from './archive-cache'

function filesystem({ sync = true, shortWrite = false, moveError = false, flush = vi.fn(), close = vi.fn() } = {}) {
  const files = new Map([['archive.zst', new Uint8Array([9, 8, 7])]])
  const fallback = { write: vi.fn(), close: vi.fn(), abort: vi.fn() }
  const moves = vi.fn()
  const root = {
    getFileHandle: vi.fn(async (name) => {
      if (!files.has(name)) files.set(name, new Uint8Array())
      return {
        createWritable: async () => ({ getWriter: () => fallback }),
        createSyncAccessHandle: sync ? async () => ({
          write(bytes, { at }) {
            const output = new Uint8Array(at + bytes.length)
            output.set(files.get(name)); output.set(bytes, at); files.set(name, output)
            return bytes.length - Number(shortWrite)
          },
          flush, close,
        }) : undefined,
        async move(destination) {
          moves(destination)
          if (moveError) throw new Error('Rename failed')
          files.set(destination, files.get(name)); files.delete(name)
        },
      }
    }),
    removeEntry: vi.fn(async (name) => { files.delete(name) }),
  }
  return { root, files, fallback, moves, flush }
}

describe('atomic worker archive cache', () => {
  it('replaces the old archive only after the caller commits verified bytes', async () => {
    const { root, files, flush } = filesystem()
    const writer = await createArchiveWriter(root, 'archive.zst')
    await writer.write(new Uint8Array([1, 2]))
    await writer.write(new Uint8Array([3, 4]))
    expect([...files.get('archive.zst')]).toEqual([9, 8, 7])
    await writer.close()
    expect([...files.get('archive.zst')]).toEqual([1, 2, 3, 4])
    expect(files.size).toBe(1)
    expect(flush).not.toHaveBeenCalled()
    await writer.abort()
    expect([...files.get('archive.zst')]).toEqual([1, 2, 3, 4])
  })

  it('keeps the previous archive and removes the temporary file on abort', async () => {
    const { root, files } = filesystem()
    const writer = await createArchiveWriter(root, 'archive.zst')
    await writer.write(new Uint8Array([1]))
    await writer.abort()
    expect([...files.get('archive.zst')]).toEqual([9, 8, 7])
    expect(files.size).toBe(1)
    await expect(writer.close()).rejects.toThrow('closed')
  })

  it('rejects short writes and failed renames without replacing the old file', async () => {
    for (const setting of ['shortWrite', 'moveError']) {
      const { root, files } = filesystem({ [setting]: true })
      const writer = await createArchiveWriter(root, 'archive.zst')
      if (setting === 'shortWrite') await expect(writer.write(new Uint8Array([1]))).rejects.toThrow('Incomplete')
      else { await writer.write(new Uint8Array([1])); await expect(writer.close()).rejects.toThrow('Rename') }
      await writer.abort()
      expect([...files.get('archive.zst')]).toEqual([9, 8, 7])
      expect(files.size).toBe(1)
    }
  })

  it('uses the existing asynchronous atomic writer when sync access is unavailable', async () => {
    const { root, files, fallback } = filesystem({ sync: false })
    expect(await createArchiveWriter(root, 'archive.zst')).toBe(fallback)
    expect(files.size).toBe(1)
  })

  it('waits for asynchronous close before committing or removing a file', async () => {
    let closed
    const close = vi.fn(() => new Promise((resolve) => { closed = resolve }))
    const { root, moves } = filesystem({ close })
    const writer = await createArchiveWriter(root, 'archive.zst')
    const commit = writer.close()
    expect(close).toHaveBeenCalledOnce()
    expect(moves).not.toHaveBeenCalled()
    closed()
    await commit
    expect(moves).toHaveBeenCalledWith('archive.zst')

    const abandoned = await createArchiveWriter(root, 'other.zst')
    const abort = abandoned.abort()
    expect(root.removeEntry).not.toHaveBeenCalled()
    closed()
    await abort
    expect(root.removeEntry).toHaveBeenCalledWith(abandoned.temporaryName)
  })

  it('keeps the previous archive when closing the replacement fails', async () => {
    const { root, files } = filesystem({ close: vi.fn(async () => { throw new Error('Close failed') }) })
    const writer = await createArchiveWriter(root, 'archive.zst')
    await writer.write(new Uint8Array([1, 2]))
    await expect(writer.close()).rejects.toThrow('Close failed')
    expect([...files.get('archive.zst')]).toEqual([9, 8, 7])
    expect(files.size).toBe(1)
  })
})

describe('cached frame input', () => {
  function cached({ bytes = new Uint8Array([1, 2, 3, 4]), short = false, sync = true, changed = false, blocked = false, asyncSize = false } = {}) {
    const close = vi.fn(), read = vi.fn((target, { at }) => {
      if (short) return 0
      target.set(bytes.subarray(at, at + target.length))
      return target.length
    })
    const stream = vi.fn(() => new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close() } }))
    const createSyncAccessHandle = vi.fn(async () => {
      if (blocked) throw new DOMException('locked', 'NoModificationAllowedError')
      return { close, read, getSize: () => asyncSize ? Promise.resolve(bytes.length) : changed ? 0 : bytes.length }
    })
    const root = { getFileHandle: async () => ({ getFile: async () => ({ size: bytes.length, stream }),
      createSyncAccessHandle: sync ? createSyncAccessHandle : undefined }) }
    return { root, close, read, stream, createSyncAccessHandle }
  }
  it('fills caller-owned storage without changing its identity and closes exactly once', async () => {
    const { root, close } = cached(), reader = await openCachedArchive(root, 'image', 4, true)
    const buffer = new Uint8Array(3)
    expect(await reader.readInto(buffer)).toBe(3)
    expect([...buffer]).toEqual([1, 2, 3])
    expect(await reader.readInto(buffer)).toBe(1)
    expect(buffer[0]).toBe(4)
    expect(await reader.readInto(buffer)).toBe(0)
    await reader.close(); await reader.cancel()
    expect(close).toHaveBeenCalledOnce()
    await expect(reader.readInto(buffer)).rejects.toThrow('closed')
  })
  it('rejects short reads, closes on cancellation, and detects changed size after locking', async () => {
    const first = cached({ short: true }), reader = await openCachedArchive(first.root, 'image', 4, true)
    await expect(reader.readInto(new Uint8Array(4))).rejects.toThrow('Incomplete')
    await reader.cancel(); expect(first.close).toHaveBeenCalledOnce()
    const second = cached({ changed: true })
    expect(await openCachedArchive(second.root, 'image', 4, true)).toBeNull()
    expect(second.close).toHaveBeenCalledOnce()
    const third = cached(), cancelled = await openCachedArchive(third.root, 'image', 4, true)
    await cancelled.cancel(); expect(third.close).toHaveBeenCalledOnce()
  })
  it('keeps stream fallback for unsupported or locked access and rejects wrong-size caches', async () => {
    for (const setting of [{ sync: false }, { blocked: true }, {}]) {
      const { root, stream } = cached(setting)
      const reader = await openCachedArchive(root, 'image', 4, Object.keys(setting).length > 0)
      expect(reader).toBeInstanceOf(ReadableStream)
      expect(stream).toHaveBeenCalledOnce()
    }
    const { root, createSyncAccessHandle } = cached()
    expect(await openCachedArchive(root, 'image', 7, true)).toBeNull()
    expect(createSyncAccessHandle).not.toHaveBeenCalled()
  })
  it('waits for the older asynchronous size API without treating a valid cache as missing', async () => {
    const { root, close, stream } = cached({ asyncSize: true })
    const reader = await openCachedArchive(root, 'image', 4, true)
    expect(await reader.readInto(new Uint8Array(4))).toBe(4)
    await reader.close()
    expect(close).toHaveBeenCalledOnce()
    expect(stream).not.toHaveBeenCalled()
  })
})
