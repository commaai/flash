const MAX_CHUNK_SIZE = 4 * 1024 * 1024

export function receiveStream(port) {
  let controller
  let pulled
  let finished = false
  const settle = () => { const resolve = pulled; pulled = null; resolve?.() }
  port.onmessage = ({ data }) => {
    if (finished) return
    if (data.chunk) {
      controller.enqueue(data.chunk)
      settle()
    } else {
      finished = true
      if (data.error) controller.error(new Error(data.error))
      else controller.close()
      port.postMessage({ closed: true })
      settle()
    }
  }
  return new ReadableStream({
    start(value) { controller = value },
    pull() {
      if (finished) return
      return new Promise((resolve) => {
        pulled = resolve
        port.postMessage({ pull: true })
      })
    },
    cancel(reason) {
      finished = true
      port.postMessage({ cancel: reason?.message || String(reason || 'Stream cancelled') })
      settle()
    },
  })
}

export async function sendStream(source, port) {
  const abort = new AbortController()
  let credit = false
  let waiting
  let acknowledge
  const closed = new Promise((resolve) => { acknowledge = resolve })
  port.onmessage = ({ data }) => {
    if (data.pull) {
      credit = true
      waiting?.()
      waiting = null
    } else if (data.cancel) {
      abort.abort(new Error(data.cancel))
      waiting?.()
      waiting = null
      acknowledge()
    } else if (data.closed) acknowledge()
  }
  const errorMessage = (error) => ({ error: error?.message || String(error) })
  try {
    await source.pipeTo(new WritableStream({
      async write(chunk) {
        if (!credit && !abort.signal.aborted) await new Promise((resolve) => { waiting = resolve })
        abort.signal.throwIfAborted()
        if (!(chunk instanceof Uint8Array) || !(chunk.buffer instanceof ArrayBuffer) ||
          chunk.length === 0 || chunk.length > MAX_CHUNK_SIZE) throw new Error('Invalid verified stream chunk')
        credit = false
        // Each chunk has its own buffer; ownership now belongs to the consumer.
        port.postMessage({ chunk }, [chunk.buffer])
      },
      close() { port.postMessage({ done: true }) },
      abort(error) { port.postMessage(errorMessage(error)) },
    }), { signal: abort.signal })
    await closed
  } catch (error) {
    source.cancel(error).catch(() => {})
    port.postMessage(errorMessage(error))
    throw error
  } finally {
    port.close()
  }
}
