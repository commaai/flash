import { cacheArchive, decodeImage } from './download'
import { fetchStream } from './stream'
import { getImageDirectory } from './image-storage'
import { decodeFrames, probeArchive, validateFrames } from './framed'
import { sendStream } from './stream-channel'
import { createArchiveWriter } from './archive-cache'

let archiveWriter
let receiveFramePorts

async function cachedArchive(root, name, size) {
  try {
    const file = await (await root.getFileHandle(name)).getFile()
    return file.size === size ? file.stream() : null
  } catch (error) {
    if (error.name !== 'NotFoundError') throw error
    return null
  }
}

const download = (url, size) => fetchStream(url, { mode: 'cors' }, {
  expectedLength: size,
  onProgress: (progress) => self.postMessage({ progress }),
})

self.onmessage = async ({ data }) => {
  try {
    if (data.framePorts) { receiveFramePorts(data.framePorts); return }
    if (data.commit) {
      // The verifier has accepted every decoded byte before this message is sent.
      await archiveWriter?.close()
      archiveWriter?.releaseLock()
      self.postMessage({ cacheDone: true })
      return
    }
    const { image: requested, port, streaming } = data
    let image = requested
    let source, root, parallel = false
    const allowLz4 = streaming && requested.useLz4 && requested.lz4
    const candidates = allowLz4 ? [requested.lz4, requested] : [requested]
    if (streaming) {
      root = await getImageDirectory()
      for (const candidate of candidates) {
        if (validateFrames(candidate)) {
          source = await cachedArchive(root, candidate.framedArchiveCacheName, candidate.framedArchiveSize)
          parallel = !!source
        }
        source ||= await cachedArchive(root, candidate.archiveCacheName, candidate.archiveSize)
        if (source) { image = candidate; break }
      }
      if (source) self.postMessage({ progress: 1 })
    }
    if (!source) {
      const framed = streaming && validateFrames(image)
      const primaryFramed = framed && image.archiveUrl === image.framedArchiveUrl && image.archiveSize === image.framedArchiveSize
      let fastLink = data.fastLink
      if ((framed || allowLz4) && fastLink === undefined && !(primaryFramed && !allowLz4)) {
        source = await probeArchive(await download(image.archiveUrl, image.archiveSize), undefined,
          (measurement) => console.debug('[ImageManager] Archive source', measurement))
        fastLink = !source
        self.postMessage({ fastLink })
      }
      if (fastLink && allowLz4) image = requested.lz4
      parallel = streaming && validateFrames(image) && (fastLink || primaryFramed)
      source ||= await download(parallel ? image.framedArchiveUrl : image.archiveUrl,
        parallel ? image.framedArchiveSize : image.archiveSize)
      if (streaming) {
        const name = parallel ? image.framedArchiveCacheName : image.archiveCacheName
        archiveWriter = await createArchiveWriter(root, name)
        if (archiveWriter.temporaryName) self.postMessage({ cacheTemporary: archiveWriter.temporaryName })
      }
      if (archiveWriter) source = cacheArchive(source, archiveWriter)
    }
    if (parallel) {
      const ports = await new Promise((resolve) => {
        receiveFramePorts = resolve
        self.postMessage({ frameWorkers: Math.max(1, Math.min(4, navigator.hardwareConcurrency || 4)) })
      })
      const stream = decodeFrames(source, image, ports)
      port.postMessage({ ownedStream: true, image, verified: true })
      await sendStream(stream, port)
    } else {
      const stream = decodeImage(source, image)
      port.postMessage({ stream, image }, [stream])
    }
  } catch (error) {
    await archiveWriter?.abort().catch(() => {})
    self.postMessage({ error: error.message || String(error) })
  }
}
