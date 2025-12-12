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
            'content-length': '12',
            'content-range': 'bytes 7-11/12',
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

  it('throws after max retries', async () => {
    global.fetch.mockRejectedValue(new Error('network error'))

    const stream = await fetchStream('https://example.com', {}, { maxRetries: 2, retryDelay })

    await expect(stream.getReader().read()).rejects.toThrow('Max retries reached')
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })
})
