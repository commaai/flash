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
        await access.flush()
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
