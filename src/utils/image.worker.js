import { decodeImage } from './download'
import { fetchStream } from './stream'

self.onmessage = async ({ data: { image, port } }) => {
  try {
    const source = await fetchStream(image.archiveUrl, { mode: 'cors' }, {
      onProgress: (progress) => self.postMessage({ progress }),
    })
    const stream = decodeImage(source, image)
    port.postMessage(stream, [stream])
  } catch (error) {
    self.postMessage({ error: error.message || String(error) })
  }
}
