// @vitest-environment node
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { cacheArchive } from './download'

const BLOCK = 4 * 1024 * 1024
const delay = () => new Promise((resolve) => setImmediate(resolve))
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function source(chunks, callbacks = {}) {
  return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close() }, ...callbacks })
}
function contents(size) {
  const data = new Uint8Array(size)
  for (let offset = 0; offset < size; offset += 65536) data.fill((offset / 65536 * 17 + 11) % 251, offset, offset + 65536)
  return data
}
function controlledWriter() {
  const calls = [], retained = []
  let active = 0, maximum = 0
  return {
    calls, retained,
    get active() { return active },
    get maximum() { return maximum },
    write(chunk) {
      const done = deferred()
      const index = calls.length
      active++; maximum = Math.max(maximum, active)
      const call = { chunk, snapshot: chunk.slice(), done }
      calls.push(call)
      return done.promise.then(() => { assert.deepEqual(chunk, call.snapshot); retained[index] = chunk.slice(); active-- })
    },
  }
}

// A writer owns its argument only until write resolves, then retains stored bytes.
test('two private buffers preserve ordered cache bytes and pass through original input objects', async () => {
  const data = contents(11 * BLOCK + 137)
  const chunks = [data.subarray(0, 17), data.subarray(17, 3 * BLOCK + 19), data.subarray(3 * BLOCK + 19)]
  const writer = controlledWriter(), output = []
  let finished = false
  const piping = cacheArchive(source(chunks), writer).pipeTo(new WritableStream({ write(chunk) { output.push(chunk) } })).finally(() => { finished = true })
  while (!finished) {
    for (const call of writer.calls) call.done.resolve()
    await delay()
  }
  await piping
  assert.equal(writer.maximum, 2)
  assert.equal(new Set(writer.calls.map(({ chunk }) => chunk.buffer)).size, 2)
  assert.ok(writer.calls.every(({ chunk }) => chunk.buffer !== data.buffer))
  assert.deepEqual(Buffer.concat(writer.retained), Buffer.from(data))
  assert.equal(output.length, chunks.length)
  output.forEach((chunk, i) => assert.equal(chunk, chunks[i]))
})

test('does not reuse a pending buffer and tolerates second write resolving before first', async () => {
  const data = contents(3 * BLOCK), writer = controlledWriter()
  const reader = cacheArchive(source([data]), writer).getReader()
  const read = reader.read()
  await delay()
  assert.equal(writer.calls.length, 2)
  writer.calls[1].done.resolve()
  await delay()
  assert.equal(writer.calls.length, 2)
  assert.deepEqual(writer.calls[0].chunk, writer.calls[0].snapshot)
  writer.calls[0].done.resolve()
  await delay()
  assert.equal(writer.calls.length, 3)
  writer.calls[2].done.resolve()
  assert.equal((await read).value, data)
  assert.equal((await reader.read()).done, true)
  assert.deepEqual(Buffer.concat(writer.retained), Buffer.from(data))
})

test('downstream can detach original chunks without affecting pending cache writes', async () => {
  const data = contents(BLOCK), expected = data.slice(), writer = controlledWriter()
  const reader = cacheArchive(source([data]), writer).getReader()
  assert.equal((await reader.read()).value, data)
  structuredClone(data, { transfer: [data.buffer] })
  assert.equal(data.byteLength, 0)
  writer.calls[0].done.resolve()
  assert.equal((await reader.read()).done, true)
  assert.deepEqual(writer.retained[0], expected)
})

test('EOF waits for final partial write and leaves writer lifecycle to caller', async () => {
  const data = contents(BLOCK + 27), writer = controlledWriter()
  writer.close = () => { throw new Error('must not close') }
  writer.abort = () => { throw new Error('must not abort') }
  const reader = cacheArchive(source([data]), writer).getReader()
  assert.equal((await reader.read()).value, data)
  let ended = false
  const end = reader.read().then((value) => { ended = true; return value })
  await delay()
  assert.equal(writer.calls.length, 2)
  assert.equal(writer.calls[1].chunk.length, 27)
  writer.calls[0].done.resolve()
  await delay()
  assert.equal(ended, false)
  writer.calls[1].done.resolve()
  assert.equal((await end).done, true)
  assert.deepEqual(Buffer.concat(writer.retained), Buffer.from(data))
})

test('late write rejection promptly interrupts stalled network input', async () => {
  const write = deferred(), error = new Error('disk full')
  let cancelled
  const input = new ReadableStream({ start(c) { c.enqueue(contents(BLOCK)) }, cancel(reason) { cancelled = reason } })
  const reader = cacheArchive(input, { write() { return write.promise } }).getReader()
  await reader.read()
  const pending = reader.read()
  write.reject(error)
  await assert.rejects(pending, (actual) => actual === error)
  await delay()
  assert.equal(cancelled, error)
})

test('second write rejection interrupts a never-settling first write', async () => {
  const second = deferred(), error = new Error('second write failed')
  let calls = 0, cancelled
  const input = new ReadableStream({ start(c) { c.enqueue(contents(2 * BLOCK)) }, cancel(reason) { cancelled = reason } })
  const reader = cacheArchive(input, { write() { return ++calls === 1 ? new Promise(() => {}) : second.promise } }).getReader()
  const pending = reader.read()
  await delay()
  second.reject(error)
  await assert.rejects(pending, (actual) => actual === error)
  await delay()
  assert.equal(cancelled, error)
})

test('synchronous writer throw and final partial rejection reject EOF', async () => {
  const error = new Error('no storage')
  const stream = cacheArchive(source([new Uint8Array(3)]), { write() { throw error } })
  const reader = stream.getReader()
  assert.equal((await reader.read()).value.length, 3)
  await assert.rejects(reader.read(), (actual) => actual === error)
})

test('consumer cancellation plus caller writer abort preserves owned buffers and observes late rejection', async () => {
  const data = contents(2 * BLOCK), writer = controlledWriter(), reason = new Error('cancelled by consumer')
  let sourceCancelled
  const input = new ReadableStream({ start(c) { c.enqueue(data) }, cancel(error) { sourceCancelled = error } })
  const reader = cacheArchive(input, writer).getReader()
  const pending = reader.read()
  await delay()
  await reader.cancel(reason)
  for (const call of writer.calls) {
    assert.deepEqual(call.chunk, call.snapshot)
    call.done.reject(reason)
  }
  assert.equal((await pending).done, true)
  await delay()
  assert.equal(writer.calls.length, 2)
  assert.equal(sourceCancelled, reason)
})

test('source failure does not leave unobserved pending write rejections', async () => {
  const write = deferred(), failure = new Error('network failed')
  let controller
  const reader = cacheArchive(new ReadableStream({ start(c) { controller = c; c.enqueue(contents(BLOCK)) } }), { write() { return write.promise } }).getReader()
  await reader.read()
  const pending = reader.read()
  controller.error(failure)
  await assert.rejects(pending, (actual) => actual === failure)
  write.reject(new Error('late cache failure'))
  await delay()
})

test('cancellation while two writes are pending prevents every later write after a late success', async () => {
  const data = contents(5 * BLOCK), writer = controlledWriter(), reason = new Error('switch to framed source')
  let cancellations = 0, sourceReason
  const input = new ReadableStream({ start(c) { c.enqueue(data) }, cancel(error) { cancellations++; sourceReason = error } })
  const reader = cacheArchive(input, writer).getReader()
  const read = reader.read()
  await delay()
  assert.equal(writer.calls.length, 2)
  await reader.cancel(reason)
  assert.equal((await read).done, true)
  writer.calls[0].done.resolve()
  await delay()
  assert.equal(writer.calls.length, 2)
  assert.equal(cancellations, 1)
  assert.equal(sourceReason, reason)
  assert.deepEqual(writer.calls[1].chunk, writer.calls[1].snapshot)
  writer.calls[1].done.reject(new Error('late abort failure'))
  await delay()
  assert.equal(writer.calls.length, 2)
  assert.equal(cancellations, 1)
})

test('cancellation plus late second rejection interrupts a never-resolving first write', async () => {
  const second = deferred(), reason = new Error('switch source')
  let writes = 0, cancelled = 0, sourceReason
  const input = new ReadableStream({ start(c) { c.enqueue(contents(4 * BLOCK)) }, cancel(error) { cancelled++; sourceReason = error } })
  const reader = cacheArchive(input, { write() { return ++writes === 1 ? new Promise(() => {}) : second.promise } }).getReader()
  const read = reader.read()
  await delay()
  await reader.cancel(reason)
  second.reject(new Error('late cache abort'))
  assert.equal((await read).done, true)
  await delay()
  assert.equal(writes, 2)
  assert.equal(cancelled, 1)
  assert.equal(sourceReason, reason)
})

test('cancellation with only the first write pending preserves its bytes until it settles', async () => {
  const data = contents(BLOCK), writer = controlledWriter()
  let cancelled = 0
  const input = new ReadableStream({ start(c) { c.enqueue(data) }, cancel() { cancelled++ } })
  const reader = cacheArchive(input, writer).getReader()
  assert.equal((await reader.read()).value, data)
  await reader.cancel('stop')
  await delay()
  assert.equal(cancelled, 1)
  assert.deepEqual(writer.calls[0].chunk, writer.calls[0].snapshot)
  writer.calls[0].done.resolve()
  await delay()
  assert.equal(writer.calls.length, 1)
})

test('empty input performs no cache writes and no lifecycle calls', async () => {
  const writer = { write() { throw new Error('unexpected write') }, close() { throw new Error('unexpected close') }, abort() { throw new Error('unexpected abort') } }
  const reader = cacheArchive(source([]), writer).getReader()
  assert.equal((await reader.read()).done, true)
})

test('a falsy write rejection is still propagated and prevents subsequent writes', async () => {
  let calls = 0
  const reader = cacheArchive(source([contents(3 * BLOCK)]), { write() { calls++; return Promise.reject(undefined) } }).getReader()
  await reader.read().then(() => assert.fail('expected rejection'), (error) => assert.equal(error, undefined))
  await delay()
  assert.equal(calls, 2)
})
