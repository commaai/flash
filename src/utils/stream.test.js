import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchStream } from './stream'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function mockResponse({
  body = [],
  headers = {},
  status = 200,
  failAfter = -1,
}) {
  const chunks = body.map(chunk => encoder.encode(chunk))
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key) => headers[key.toLowerCase()] || null,
    },
    body: {
      getReader() {
        let readCount = 0
        return {
          read() {
            if (failAfter >= 0 && readCount > failAfter) {
              return Promise.reject(new Error('Network error'))
            }
            if (readCount < chunks.length) {
              return Promise.resolve({ done: false, value: chunks[readCount++] })
            }
            return Promise.resolve({ done: true })
          },
        }
      },
    }
  }
}

async function readText(stream) {
  const reader = stream.getReader()
  const chunks = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(decoder.decode(value))
  }
  return chunks.join('')
}

describe('fetchStream', () => {
  const retryDelay = 1

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('downloads content and tracks progress', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({
      body: ['Hello ', 'World'],
      headers: { 'content-length': '11' },
    }))

    const progress = []
    const stream = await fetchStream('https://example.com', {}, {
      onProgress: progress.push.bind(progress),
    })

    expect(await readText(stream)).toBe('Hello World')
    expect(progress[progress.length - 1]).toBe(1)
  })

  it('retries and uses Range header after failure', async () => {
    global.fetch
      .mockResolvedValueOnce(
        mockResponse({
          body: ['partial'],
          headers: { 'content-length': '12' },
          status: 500,
        })
      )
      .mockResolvedValueOnce(
        mockResponse({
          body: [' data'],
          headers: {
            'content-length': '5',
          },
        })
      )

    const stream = await fetchStream('https://example.com', {}, { maxRetries: 1, retryDelay })

    expect(await readText(stream)).toBe(' data')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('resumes download when reader fails mid-stream', async () => {
    global.fetch
      .mockResolvedValueOnce(
        mockResponse({
          body: ['First part'],
          headers: { 'content-length': '22' },
          failAfter: 0,
        })
      )
      .mockResolvedValueOnce(
        mockResponse({
          body: [' second part'],
          status: 206,
          headers: {
            'content-length': '12',
            'content-range': 'bytes 10-21/22',
          },
        })
      )

    const stream = await fetchStream('https://example.com', {}, { maxRetries: 1, retryDelay })

    expect(await readText(stream)).toBe('First part second part')
    const { headers } = global.fetch.mock.calls[1][1]
    expect(headers['range']).toBe('bytes=10-')
  })

  it('does not read the entire response ahead of the consumer', async () => {
    const read = vi.fn(async () => ({ done: false, value: new Uint8Array(1024 * 1024) }))
    global.fetch.mockResolvedValue({ ok: true, status: 200,
      headers: { get: () => String(100 * 1024 * 1024) }, body: { getReader: () => ({ read }) } })
    const stream = await fetchStream('https://example.com')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(read).toHaveBeenCalledTimes(4)
    await stream.cancel()
  })

  it('rejects truncated or oversized archives against the manifest byte count', async () => {
    for (const expectedLength of [4, 2]) {
      global.fetch.mockResolvedValue(mockResponse({ body: ['abc'], headers: { 'content-length': '3' } }))
      const stream = await fetchStream('https://example.com', {}, { expectedLength, maxRetries: 0 })
      await expect(readText(stream)).rejects.toThrow('Archive size mismatch')
    }
  })

  it('rejects known EOF truncation without retrying an endpoint that repeats its body', async () => {
    global.fetch.mockResolvedValue(mockResponse({ body: ['abc'], headers: { 'content-length': '4' } }))
    await expect(readText(await fetchStream('https://example.com', {}, { expectedLength: 4, retryDelay }))).rejects.toThrow('Archive size mismatch')
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('rejects an overrun before exposing the oversized chunk', async () => {
    global.fetch.mockResolvedValue(mockResponse({ body: ['abcde'], headers: { 'content-length': '4' } }))
    const stream = await fetchStream('https://example.com', {}, { expectedLength: 4 })
    await expect(stream.getReader().read()).rejects.toThrow('Archive size mismatch')
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('rejects ignored or inconsistent resumed ranges', async () => {
    for (const [status, range] of [[200, null], [206, 'bytes 0-3/4'], [206, 'bytes 2-4/5'], [206, 'bytes 2-3/4']]) {
      global.fetch.mockReset()
      global.fetch.mockResolvedValueOnce(mockResponse({ body: ['ab'], headers: { 'content-length': '4' }, failAfter: 0 }))
        .mockResolvedValueOnce(mockResponse({ body: ['cd'], headers: { 'content-length': '3', 'content-range': range }, status }))
      await expect(readText(await fetchStream('https://example.com', {}, { expectedLength: 4, retryDelay }))).rejects.toThrow(/response|Range/)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    }
  })

  it('resumes a known archive when CORS hides the valid partial Content-Range', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({ body: ['ab'], headers: { 'content-length': '4' }, failAfter: 0 }))
      .mockResolvedValueOnce(mockResponse({ body: ['cd'], headers: { 'content-length': '2' }, status: 206 }))
    expect(await readText(await fetchStream('https://example.com', {}, { expectedLength: 4, retryDelay }))).toBe('abcd')
    expect(global.fetch.mock.calls[1][1].headers.range).toBe('bytes=2-')
  })

  it('pauses at bounded probe ranges and resumes the remainder only on demand', async () => {
    for (const body of ['ab', 'cd', 'ef']) global.fetch.mockResolvedValueOnce(mockResponse({ body: [body], headers: { 'content-length': '2' }, status: 206 }))
    const stream = await fetchStream('https://example.com', {}, { expectedLength: 6, probeRanges: [2, 4] })
    const reader = stream.getReader()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(decoder.decode((await reader.read()).value)).toBe('ab')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(global.fetch).toHaveBeenCalledOnce()
    expect(global.fetch.mock.calls[0][1].headers.range).toBe('bytes=0-1')
    expect(decoder.decode((await reader.read()).value)).toBe('cd')
    expect(global.fetch.mock.calls[1][1].headers.range).toBe('bytes=2-3')
    stream.finishProbe()
    expect(decoder.decode((await reader.read()).value)).toBe('ef')
    expect(global.fetch.mock.calls[2][1].headers.range).toBe('bytes=4-')
    expect((await reader.read()).done).toBe(true)
  })

  it('does not extend a probe until the decoder consumes the retained input', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({ body: ['abcd'], headers: { 'content-length': '4' }, status: 206 }))
      .mockResolvedValueOnce(mockResponse({ body: ['ef'], headers: { 'content-length': '2' }, status: 206 }))
    const stream = await fetchStream('https://example.com', {}, { expectedLength: 6, probeRanges: [4] })
    const reader = stream.getReader()
    expect(decoder.decode((await reader.read()).value)).toBe('abcd')
    const next = reader.read()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(global.fetch).toHaveBeenCalledOnce()
    stream.creditProbe(3)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(global.fetch).toHaveBeenCalledOnce()
    expect(() => stream.creditProbe(5)).toThrow('Invalid archive probe credit')
    stream.creditProbe(4)
    expect(decoder.decode((await next).value)).toBe('ef')
    expect(global.fetch.mock.calls[1][1].headers.range).toBe('bytes=4-5')
    expect((await reader.read()).done).toBe(true)
  })

  it('cancels a probe waiting for decoder credit without fetching an extension', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({ body: ['abcd'], headers: { 'content-length': '4' }, status: 206 }))
    const stream = await fetchStream('https://example.com', {}, { expectedLength: 8, probeRanges: [4] })
    const reader = stream.getReader()
    await reader.read()
    const next = reader.read()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await reader.cancel('Selected framed archive')
    expect(await next).toEqual({ done: true, value: undefined })
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('keeps an ignored initial range response but rejects a truncated bounded range', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({ body: ['abcdef'], headers: { 'content-length': '6' } }))
    expect(await readText(await fetchStream('https://example.com', {}, { expectedLength: 6, probeRanges: [2, 4] }))).toBe('abcdef')
    global.fetch.mockReset().mockResolvedValue(mockResponse({ body: ['a'], headers: { 'content-length': '2' }, status: 206 }))
    await expect(readText(await fetchStream('https://example.com', {}, { expectedLength: 6, probeRanges: [2, 4] }))).rejects.toThrow('Archive size mismatch')
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('throws after max retries', async () => {
    global.fetch.mockRejectedValue(new Error('network error'))

    const stream = await fetchStream('https://example.com', {}, { maxRetries: 2, retryDelay })

    await expect(stream.getReader().read()).rejects.toThrow('Max retries reached')
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })
})
