import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchStream } from './stream.js'

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
      ...headers, // Support both .get() and direct property access
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
          releaseLock: vi.fn(), // Add for completeness
        }
      },
    }
  }
}

async function readText(stream) {
  const reader = stream.getReader()
  const chunks = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(decoder.decode(value))
    }
  } finally {
    reader.releaseLock()
  }
  return chunks.join('')
}

describe('fetchStream', () => {
  const retryDelay = 1

  beforeEach(() => {
    global.fetch = vi.fn()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('downloads content and tracks progress', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({
      body: ['Hello ', 'World'],
      headers: { 'content-length': '11' },
    }))

    const progress = []
    const stream = await fetchStream('https://example.com', {}, {
      onProgress: (p) => progress.push(p),
    })

    expect(await readText(stream)).toBe('Hello World')
    expect(progress).toHaveLength(2) // One for each chunk
    expect(progress[progress.length - 1]).toBe(1) // Final progress should be 100%
    expect(global.fetch).toHaveBeenCalledWith('https://example.com', {})
  })

  it('handles missing content-length header', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({
      body: ['Hello ', 'World'],
      headers: {}, // No content-length
    }))

    const progress = []
    const stream = await fetchStream('https://example.com', {}, {
      onProgress: (p) => progress.push(p),
    })

    expect(await readText(stream)).toBe('Hello World')
    // Progress tracking should still work, just differently
    expect(progress.length).toBeGreaterThan(0)
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
            'content-length': '12',
            'content-range': 'bytes 7-11/12',
          },
        })
      )

    const stream = await fetchStream('https://example.com', {}, { 
      maxRetries: 1, 
      retryDelay 
    })

    expect(await readText(stream)).toBe(' data')
    expect(global.fetch).toHaveBeenCalledTimes(2)
    
    // Check that second call includes Range header
    const secondCall = global.fetch.mock.calls[1]
    expect(secondCall[1].headers).toEqual(
      expect.objectContaining({
        'range': expect.stringContaining('bytes=')
      })
    )
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
          headers: {
            'content-length': '12',
            'content-range': 'bytes 10-21/22',
          },
        })
      )

    const stream = await fetchStream('https://example.com', {}, { 
      maxRetries: 1, 
      retryDelay 
    })

    expect(await readText(stream)).toBe('First part second part')
    
    const secondCallHeaders = global.fetch.mock.calls[1][1].headers
    expect(secondCallHeaders['range']).toBe('bytes=10-')
  })

  it('throws after max retries', async () => {
    global.fetch.mockRejectedValue(new Error('network error'))

    const stream = await fetchStream('https://example.com', {}, { 
      maxRetries: 2, 
      retryDelay 
    })

    await expect(stream.getReader().read()).rejects.toThrow('Max retries reached')
    expect(global.fetch).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it('handles custom headers correctly', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({
      body: ['test'],
      headers: { 'content-length': '4' },
    }))

    const customHeaders = { 'Authorization': 'Bearer token' }
    await fetchStream('https://example.com', { headers: customHeaders })

    expect(global.fetch).toHaveBeenCalledWith('https://example.com', {
      headers: customHeaders
    })
  })

  it('respects abort signal', async () => {
    const controller = new AbortController()
    global.fetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))

    const streamPromise = fetchStream('https://example.com', { 
      signal: controller.signal 
    })
    
    controller.abort()

    await expect(streamPromise).rejects.toThrow('Aborted')
  })
})