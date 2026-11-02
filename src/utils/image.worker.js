import { cacheArchive, decodeImage } from './download'
import { fetchStream } from './stream'
import { getImageDirectory } from './image-storage'
import { decodeFrames, probeArchive, validateFrames } from './framed'

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
    const { image, port, streaming } = data
    let source, root, parallel = false
    const framed = streaming && validateFrames(image)
    if (streaming) {
      root = await getImageDirectory()
      if (framed) {
        source = await cachedArchive(root, image.framedArchiveCacheName, image.framedArchiveSize)
        parallel = !!source
      }
      source ||= await cachedArchive(root, image.archiveCacheName, image.archiveSize)
      if (source) self.postMessage({ progress: 1 })
    }
    if (!source) {
      source = await download(image.archiveUrl, image.archiveSize)
      if (framed) {
        source = await probeArchive(source)
        if (!source) {
          parallel = true
          source = await download(image.framedArchiveUrl, image.framedArchiveSize)
        }
      }
      if (streaming) {
        const name = parallel ? image.framedArchiveCacheName : image.archiveCacheName
        const handle = await root.getFileHandle(name, { create: true })
        archiveWriter = (await handle.createWritable()).getWriter()
      }
      if (archiveWriter) source = cacheArchive(source, archiveWriter)
    }
    if (parallel) {
      const ports = await new Promise((resolve) => {
        receiveFramePorts = resolve
        self.postMessage({ frameWorkers: Math.max(1, Math.min(4, navigator.hardwareConcurrency || 4)) })
      })
      const stream = decodeFrames(source, image, ports)
      port.postMessage({ stream, verified: true }, [stream])
    } else {
      const stream = decodeImage(source, image)
      port.postMessage(stream, [stream])
    }
  } catch (error) {
    self.postMessage({ error: error.message || String(error) })
  }
}
