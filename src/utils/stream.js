/**
 * @param {string|URL} url
 * @param {RequestInit} [requestOptions]
 * @param {object} [options]
 * @param {number} [options.maxRetries]
 * @param {number} [options.retryDelay]
 * @param {progressCallback} [options.onProgress]
 */
export async function fetchStream(url, requestOptions = {}, options = {}) {
  const maxRetries = options.maxRetries || 3
  const retryDelay = options.retryDelay || 1000

  /** @param {Response} response */
  const getContentLength = (response) => {
    const total = response.headers.get('Content-Length')
    const range = response.headers.get('Content-Range')
    if (range) {
      const match = range.match(/\/(\d+)$/)
      if (match) return parseInt(match[1], 10)
    }
    if (total) return parseInt(total, 10)
    throw new Error('Content-Length not found in response headers')
  }

  /**
   * @param {number} startByte
   * @param {AbortSignal} signal
   */
  const fetchRange = async (startByte, signal) => {
    const headers = { ...(requestOptions.headers || {}) }
    if (startByte > 0) {
      headers['range'] = `bytes=${startByte}-`
    }

    const response = await fetch(url, {
      ...requestOptions,
      headers,
      signal
    })
    if (!response.ok && response.status !== 206 && response.status !== 200) {
      throw new Error(`Fetch error: ${response.status}`)
    }
    return response
  }

  return new ReadableStream({
    start() {
      this.startByte = 0
      this.contentLength = null
      this.abortController = new AbortController()
    },

    async pull(streamController) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetchRange(this.startByte, this.abortController.signal)
          if (this.contentLength === null) {
            this.contentLength = getContentLength(response)
          }

          const reader = response.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              streamController.close()
              return
            }

            this.startByte += value.byteLength
            streamController.enqueue(value)
            options.onProgress?.(this.startByte / this.contentLength)
          }
        } catch (err) {
          console.warn(`Attempt ${attempt + 1} failed:`, err)
          if (attempt === maxRetries) {
            this.abortController.abort()
            streamController.error(new Error('Max retries reached', { cause: err }))
            return
          }
          await new Promise((res) => setTimeout(res, retryDelay))
        }
      }
    },

    cancel(reason) {
      console.warn('Stream canceled:', reason)
      this.abortController.abort()
    },
  })
}
