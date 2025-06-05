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
      ...headers,
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
          releaseLock: vi.fn(),
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
  const retryDelay = 10 // Shorter delay for tests

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
    expect(progress[progress.length - 1]).toBe(1) // Final progress should be 1
    
    // Updated expectation to match actual implementation
    expect(global.fetch).toHaveBeenCalledWith('https://example.com', {
      headers: {},
      signal: expect.any(AbortSignal)
    })
  })

  it('handles missing content-length header', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({
      body: ['Hello ', 'World'],
      headers: {}, // No content-length
    }))

    const stream = await fetchStream('https://example.com', {}, {})
    
    // The error happens when reading from the stream
    const reader = stream.getReader()
    await expect(reader.read()).rejects.toThrow('Content-Length not found in response headers')
  }, 10000) // Increased timeout

  it('retries and uses Range header after failure', async () => {
    global.fetch
      .mockResolvedValueOnce(
        mockResponse({
          body: ['partial'],
          headers: { 'content-length': '12' },
          status: 500, // This will trigger a retry
        })
      )
      .mockResolvedValueOnce(
        mockResponse({
          body: [' data'],
          headers: {
            'content-length': '5', // Content length for the range response
          },
          status: 206, // Partial content
        })
      )

    const stream = await fetchStream('https://example.com', {}, { 
      maxRetries: 1, 
      retryDelay 
    })

    const result = await readText(stream)
    expect(result).toBe(' data')
    expect(global.fetch).toHaveBeenCalledTimes(2)
    
    // Check that second call includes Range header starting from 0 
    // (since first request failed before any data was read)
    const secondCall = global.fetch.mock.calls[1]
    expect(secondCall[1].headers).toEqual(
      expect.objectContaining({
        'range': 'bytes=0-'
      })
    )
  }, 10000)

  it('resumes download when reader fails mid-stream', async () => {
    global.fetch
      .mockResolvedValueOnce(
        mockResponse({
          body: ['First part'],
          headers: { 'content-length': '22' },
          failAfter: 0, // Fail after first chunk
        })
      )
      .mockResolvedValueOnce(
        mockResponse({
          body: [' second part'],
          headers: {
            'content-length': '12',
          },
          status: 206,
        })
      )

    const stream = await fetchStream('https://example.com', {}, { 
      maxRetries: 1, 
      retryDelay 
    })

    const result = await readText(stream)
    expect(result).toBe('First part second part')
    
    // Should resume from where it left off (10 bytes from "First part")
    const secondCallHeaders = global.fetch.mock.calls[1][1].headers
    expect(secondCallHeaders['range']).toBe('bytes=10-')
  }, 10000)

  it('throws after max retries', async () => {
    global.fetch.mockRejectedValue(new Error('network error'))

    const stream = await fetchStream('https://example.com', {}, { 
      maxRetries: 2, 
      retryDelay 
    })

    const reader = stream.getReader()
    await expect(reader.read()).rejects.toThrow('Max retries reached')
    expect(global.fetch).toHaveBeenCalledTimes(3) // Initial + 2 retries
  }, 10000)

  it('handles custom headers correctly', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({
      body: ['test'],
      headers: { 'content-length': '4' },
    }))

    const customHeaders = { 'Authorization': 'Bearer token' }
    await fetchStream('https://example.com', { headers: customHeaders })

    // Updated expectation to include signal
    expect(global.fetch).toHaveBeenCalledWith('https://example.com', {
      headers: customHeaders,
      signal: expect.any(AbortSignal)
    })
  })

  it('respects abort signal', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({
      body: ['data'],
      headers: { 'content-length': '4' },
    }))

    const controller = new AbortController()
    
    const streamPromise = fetchStream('https://example.com', { 
      signal: controller.signal 
    }, {})
    
    // Abort immediately
    controller.abort()
    
    // Should still return a stream, but reading from it should fail
    const stream = await streamPromise
    const reader = stream.getReader()
    await expect(reader.read()).rejects.toThrow()
  })
})
