import { describe, expect, it, vi } from 'vitest'
import { createArchiveWriter } from './archive-cache'

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
  return { root, files, fallback, moves }
}

describe('atomic worker archive cache', () => {
  it('replaces the old archive only after the caller commits verified bytes', async () => {
    const { root, files } = filesystem()
    const writer = await createArchiveWriter(root, 'archive.zst')
    await writer.write(new Uint8Array([1, 2]))
    await writer.write(new Uint8Array([3, 4]))
    expect([...files.get('archive.zst')]).toEqual([9, 8, 7])
    await writer.close()
    expect([...files.get('archive.zst')]).toEqual([1, 2, 3, 4])
    expect(files.size).toBe(1)
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

  it('waits for asynchronous flush and close before committing or removing a file', async () => {
    let flushed, closed
    const flush = vi.fn(() => new Promise((resolve) => { flushed = resolve }))
    const close = vi.fn(() => new Promise((resolve) => { closed = resolve }))
    const { root, moves } = filesystem({ flush, close })
    const writer = await createArchiveWriter(root, 'archive.zst')
    const commit = writer.close()
    expect(close).not.toHaveBeenCalled()
    expect(moves).not.toHaveBeenCalled()
    flushed()
    await Promise.resolve()
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
})
