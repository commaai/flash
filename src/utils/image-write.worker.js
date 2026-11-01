import { writeImage } from './download'

self.onmessage = ({ data: { image, port } }) => {
  port.onmessage = async ({ data: stream }) => {
    try {
      const root = await navigator.storage.getDirectory()
      await writeImage(root, image, stream)
      self.postMessage({ done: true })
    } catch (error) {
      self.postMessage({ error: error.message || String(error) })
    }
  }
}
