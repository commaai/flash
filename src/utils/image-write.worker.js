import { writeImage, verifyImage } from './download'
import { getImageDirectory } from './image-storage'
import { receiveStream, sendStream } from './stream-channel'
import { sampleVerifiedStream } from './serial-probe'

self.onmessage = ({ data: { image, port, streaming, output } }) => {
  let resolveStart, resolveDecision
  const started = new Promise((resolve) => { resolveStart = resolve })
  port.onmessage = async ({ data }) => {
    try {
      if (data.decodeStarted !== undefined) { resolveStart(data.decodeStarted); return }
      if (data.useFramed !== undefined) { resolveDecision(data.useFramed); return }
      const stream = data.ownedStream ? receiveStream(port) : data.stream || data
      const selected = data.image || image
      if (streaming) {
        if (!selected.chunkHashes) throw new Error('Streaming requires image chunk hashes')
        let verified = data.verified ? stream : await verifyImage(stream, selected)
        if (data.calibration) {
          verified = await sampleVerifiedStream(verified, data.calibration, started, (sample) => {
            const decision = new Promise((resolve) => { resolveDecision = resolve })
            port.postMessage({ calibrated: sample })
            return decision
          })
          if (!verified) { port.postMessage({ discarded: true }); return }
        }
        self.postMessage({ streamReady: true, transport: selected.isLz4 ? 'lz4' : 'raw' })
        await sendStream(verified, output)
      } else {
        await writeImage(await getImageDirectory(), image, stream)
      }
      self.postMessage({ done: true })
    } catch (error) {
      self.postMessage({ error: error?.message || String(error) })
    }
  }
}
