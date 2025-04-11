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

  const abortController = new AbortController()
  let startByte = 0
  let contentLength = null

  return new ReadableStream({
    async pull(controller) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetchRange(startByte, abortController.signal)
          if (contentLength === null) {
            contentLength = getContentLength(response)
          }

          const reader = response.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              controller.close()
              return
            }

            startByte += value.byteLength
            controller.enqueue(value)
            options.onProgress?.(startByte / contentLength)
          }
        } catch (err) {
          console.warn(`Attempt ${attempt + 1} failed:`, err)
          if (attempt === maxRetries) {
            abortController.abort()
            controller.error(new Error('Max retries reached', { cause: err }))
            return
          }
          await new Promise((res) => setTimeout(res, retryDelay))
        }
      }
    },

    cancel(reason) {
      console.warn('Stream canceled:', reason)
      abortController.abort()
    },
  })
}
