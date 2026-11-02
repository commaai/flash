import { createDecoder } from './frame-decoder'
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
        // Decompression has copied the compressed bytes into WASM and hashing
        // only reads output. Return private input storage for the next frame.
        port.postMessage({ index, output, input: new Uint8Array(input.buffer) }, [output.buffer, input.buffer])
      } catch (error) { port.postMessage({ index, error: error?.message || String(error) }) }
    }
    port.start()
    port.postMessage({ ready: true })
  } catch (error) {
    port.postMessage({ error: error?.message || String(error) })
  }
}
