// Framed decoding fills reusable input buffers directly. The bytes are still
// verified after decompression; a cache hit never bypasses image integrity.
export async function openCachedArchive(root, name, size, reusable = false) {
  let file
  try { file = await root.getFileHandle(name) }
  catch (error) { if (error.name === 'NotFoundError') return null; throw error }
  const snapshot = await file.getFile()
  if (snapshot.size !== size) return null
  if (!reusable || typeof file.createSyncAccessHandle !== 'function') return snapshot.stream()
  let access
  try { access = await file.createSyncAccessHandle() }
  catch (error) {
    if (error.name === 'NotSupportedError' || error.name === 'NoModificationAllowedError') return snapshot.stream()
    throw error
  }
  let offset = 0, closed = false
  const close = async () => {
    if (!closed) { closed = true; await access.close() }
  }
  try {
    if (await access.getSize() !== size) { await close(); return null }
  } catch (error) { await close(); throw error }
  return {
    async readInto(bytes) {
      if (closed) throw new Error('Archive cache reader is closed')
      const count = Math.min(bytes.byteLength, size - offset)
      let filled = 0
      try {
        while (filled < count) {
          const read = access.read(bytes.subarray(filled, count), { at: offset + filled })
          if (!Number.isSafeInteger(read) || read <= 0 || read > count - filled) throw new Error('Incomplete archive cache read')
          filled += read
        }
        offset += filled
        return filled
      } catch (error) { await close(); throw error }
    },
    close,
    cancel: close,
  }
}

// Sync access handles keep large file writes in this worker. A temporary file
// keeps an existing verified archive intact until the caller verifies its EOF.
export async function createArchiveWriter(root, name) {
  const temporaryName = `.partial-${crypto.randomUUID()}`
  const temporary = await root.getFileHandle(temporaryName, { create: true })
  if (typeof temporary.createSyncAccessHandle !== 'function' || typeof temporary.move !== 'function') {
    await root.removeEntry(temporaryName)
    const file = await root.getFileHandle(name, { create: true })
    return (await file.createWritable()).getWriter()
  }
  let access
  try { access = await temporary.createSyncAccessHandle() }
  catch (error) {
    await root.removeEntry(temporaryName)
    if (error.name !== 'NotSupportedError') throw error
    const file = await root.getFileHandle(name, { create: true })
    return (await file.createWritable()).getWriter()
  }
  let offset = 0, closed = false, committed = false
  const closeAccess = async () => {
    if (!closed) { closed = true; await access.close() }
  }
  const remove = async () => {
    try { await root.removeEntry(temporaryName) }
    catch (error) { if (error.name !== 'NotFoundError') throw error }
  }
  return {
    temporaryName,
    async write(chunk) {
      if (closed) throw new Error('Archive cache is closed')
      const written = access.write(chunk, { at: offset })
      if (written !== chunk.byteLength) throw new Error('Incomplete archive cache write')
      offset += written
    },
    async close() {
      if (committed) return
      if (closed) throw new Error('Archive cache is closed')
      try {
        // Every cache read is decoded and hash-verified again. Let the OS
        // schedule durable writeback instead of stalling a completed flash.
        await closeAccess()
        await temporary.move(name)
        committed = true
      } catch (error) {
        await closeAccess()
        await remove()
        throw error
      }
    },
    async abort() {
      if (committed) return
      await closeAccess()
      await remove()
    },
    releaseLock() {},
  }
}
