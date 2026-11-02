import { createDecoder } from 'zstd-wasm-decoder/perf/external'
import { decodeZstdFrame } from './framed'

self.onmessage = async ({ data: { port } }) => {
  try {
    const decoder = await createDecoder()
    port.onmessage = async ({ data: { index, input, size, hash } }) => {
      try {
        const output = decodeZstdFrame(decoder, input, size)
        if (output.length !== size) throw new Error('Decoded frame size mismatch')
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', output)))
          .map((byte) => byte.toString(16).padStart(2, '0')).join('')
        if (digest !== hash.toLowerCase()) throw new Error('Frame checksum mismatch')
        port.postMessage({ index, output }, [output.buffer])
      } catch (error) { port.postMessage({ index, error: error.message || String(error) }) }
    }
    port.start()
    port.postMessage({ ready: true })
  } catch (error) {
    port.postMessage({ error: error.message || String(error) })
  }
}
