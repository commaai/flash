import { writeImage, verifyImage } from './download'
import { getImageDirectory } from './image-storage'
import { sendStream } from './stream-channel'

self.onmessage = ({ data: { image, port, streaming, output } }) => {
  port.onmessage = async ({ data: stream }) => {
    try {
      if (streaming) {
        if (!image.chunkHashes) throw new Error('Streaming requires image chunk hashes')
        const verified = await verifyImage(stream, image)
        self.postMessage({ streamReady: true })
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
