import { writeImage, verifyImage } from './download'
import { getImageDirectory } from './image-storage'
import { receiveStream, sendStream } from './stream-channel'

self.onmessage = ({ data: { image, port, streaming, output } }) => {
  port.onmessage = async ({ data }) => {
    try {
      const stream = data.ownedStream ? receiveStream(port) : data.stream || data
      const selected = data.image || image
      if (streaming) {
        if (!selected.chunkHashes) throw new Error('Streaming requires image chunk hashes')
        const verified = data.verified ? stream : await verifyImage(stream, selected)
        self.postMessage({ streamReady: true, transport: selected.isLz4 ? 'lz4' : 'raw' })
        await sendStream(verified, output)
      } else {
        await writeImage(await getImageDirectory(), image, stream)
      }
      self.postMessage({ done: true })
    } catch (error) {
      self.postMessage({ error: error.message || String(error) })
    }
  }
}
