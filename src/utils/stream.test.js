import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchStream } from './stream'

function createMockResponse({ bodyChunks, headers = {}, status = 200 }) {
  const encoder = new TextEncoder()
  const chunks = bodyChunks.map(chunk => encoder.encode(chunk))
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key) => headers[key.toLowerCase()] || null,
    },
    body: {
      getReader() {
        let index = 0
        return {
          read() {
            if (index < chunks.length) {
              return Promise.resolve({ done: false, value: chunks[index++] })
            }
            return Promise.resolve({ done: true, value: undefined })
          }
        }
      }
    }
  }
}

describe('fetchStream', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  it('downloads content successfully and calls onProgress', async () => {
    const bodyChunks = ['Hello ', 'World']
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        bodyChunks,
        headers: { 'content-length': '11' },
      })
    )

    const progressCalls = []
    const stream = await fetchStream('https://test.com/file.txt', {}, {
      onProgress: progressCalls.push.bind(progressCalls),
    })
    const reader = stream.getReader()
    const received = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received.push(new TextDecoder().decode(value))
    }

    expect(received.join('')).toBe('Hello World')
    expect(progressCalls.length).toBeGreaterThan(0)
    expect(progressCalls[progressCalls.length - 1]).toBe(1)
  })

  it('retries on failure and resumes with Range header', async () => {
    const bodyChunks1 = ['partial'] // will fail
    const bodyChunks2 = [' data']

    fetchMock
      .mockResolvedValueOnce(
        createMockResponse({
          bodyChunks: bodyChunks1,
          headers: {
            'content-length': '12'
          },
          status: 500 // force failure
        })
      )
      .mockResolvedValueOnce(
        createMockResponse({
          bodyChunks: bodyChunks2,
          headers: {
            'content-length': '12',
            'content-range': 'bytes 7-11/12'
          }
        })
      )

    const stream = await fetchStream('https://test.com/file.txt', {}, {
      maxRetries: 1
    })
    const reader = stream.getReader()
    const received = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received.push(new TextDecoder().decode(value))
    }

    expect(received.join('')).toBe(' data')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws after max retries', async () => {
    fetchMock.mockRejectedValue(new Error('network error'))

    const stream = await fetchStream('https://test.com/file.txt', {}, {
      maxRetries: 2
    })
    const reader = stream.getReader()

    await expect(reader.read()).rejects.toThrow('Max retries reached.')
  })
})
