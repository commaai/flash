import wasmUrl from '../../node_modules/zstd-wasm-decoder/_esm/zstd-decoder-perf.wasm?url'

const MAX_INPUT = 8 * 1024 * 1024
const MAX_OUTPUT = 4 * 1024 * 1024

// The package's one-shot wrapper fixes its input staging at 2 MiB. Our frames
// have bounded, validated lengths, so reserve both regions once and avoid its
// streaming fallback's temporary block copies. Keep the package pinned: these
// exports are the decoder binary's allocation and one-shot interface.
export function instantiateDecoder(module) {
  const { exports } = new WebAssembly.Instance(module, { env: {} })
  exports._initialize()
  const input = exports.malloc(MAX_INPUT)
  const output = exports.malloc(MAX_OUTPUT + 64)
  if (!Number.isSafeInteger(input) || input < 0 || output !== input + MAX_INPUT) throw new Error('Invalid decoder memory layout')
  const required = output + MAX_OUTPUT + 64
  if (required > exports.memory.buffer.byteLength) exports.memory.grow(Math.ceil((required - exports.memory.buffer.byteLength) / 65536))
  const memory = new Uint8Array(exports.memory.buffer)
  return {
    maxInputSize: MAX_INPUT,
    decompressSync(bytes, size) {
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_OUTPUT || bytes.length > MAX_INPUT) throw new Error('Oversized decoder frame')
      memory.set(bytes, input)
      exports.pb(required)
      const result = exports.dS(output, size, input, bytes.length)
      if (result !== size) throw new Error(`Decoded frame size mismatch (${result})`)
      return memory.slice(output, output + result)
    },
  }
}

export async function createDecoder() {
  const response = await fetch(wasmUrl)
  if (!response.ok) throw new Error(`Decoder download failed: ${response.status}`)
  return instantiateDecoder(await WebAssembly.compile(await response.arrayBuffer()))
}
