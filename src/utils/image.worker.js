import { cacheArchive, decodeImage } from './download'
import { fetchStream } from './stream'
import { getImageDirectory } from './image-storage'

let archiveWriter

self.onmessage = async ({ data }) => {
  try {
    if (data.commit) {
      // The verifier has accepted every decoded byte before this message is sent.
      await archiveWriter?.close()
      archiveWriter?.releaseLock()
      self.postMessage({ cacheDone: true })
      return
    }
    const { image, port, streaming } = data
    let source
    if (streaming) {
      const root = await getImageDirectory()
      const handle = await root.getFileHandle(image.archiveCacheName, { create: true })
      const cached = await handle.getFile()
      if (cached.size === image.archiveSize) {
        source = cached.stream()
        self.postMessage({ progress: 1 })
      } else {
        archiveWriter = (await handle.createWritable()).getWriter()
      }
    }
    if (!source) {
      source = await fetchStream(image.archiveUrl, { mode: 'cors' }, {
        expectedLength: image.archiveSize,
        onProgress: (progress) => self.postMessage({ progress }),
      })
      if (archiveWriter) source = cacheArchive(source, archiveWriter)
    }
    const stream = decodeImage(source, image)
    port.postMessage(stream, [stream])
  } catch (error) {
    self.postMessage({ error: error.message || String(error) })
  }
}
