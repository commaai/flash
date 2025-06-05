/** @param {Response} response */
const getContentLength = (response) => {
  const total = response.headers.get('Content-Length')
  if (total) return parseInt(total, 10)
  throw new Error('Content-Length not found in response headers')
}

/**
 * Determines if an error should be retried
 * @param {Error} error 
 * @returns {boolean}
 */
const isRetriableError = (error) => {
  // Don't retry missing Content-Length headers
  if (error.message.includes('Content-Length not found')) {
    return false
  }
  
  // Don't retry client errors (4xx)
  if (error.message.includes('Fetch error: 4')) {
    return false
  }
  
  // Don't retry abort errors
  if (error.name === 'AbortError' || error.message.includes('aborted')) {
    return false
  }
  
  // Retry server errors (5xx) and network errors
  return true
}

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

  /**
   * @param {number} startByte
   * @param {AbortSignal} signal
   * @param {boolean} isRetry
   */
  const fetchRange = async (startByte, signal, isRetry = false) => {
    const headers = { ...(requestOptions.headers || {}) }
    
    // Always set Range header on retries, even if starting from 0
    if (isRetry || startByte > 0) {
      headers['range'] = `bytes=${startByte}-`
    }

    const response = await fetch(url, {
      ...requestOptions,
      headers,
      signal
    })
    
    if (!response.ok || (response.status !== 206 && response.status !== 200)) {
      throw new Error(`Fetch error: ${response.status}`)
    }
    return response
  }

  // Use provided signal or create new one
  const abortController = requestOptions.signal ? 
    { signal: requestOptions.signal, abort: () => {} } : 
    new AbortController()
    
  let startByte = 0
  let contentLength = null
  let isFirstRequest = true

  return new ReadableStream({
    async pull(stream) {
      // Check if already aborted
      if (abortController.signal.aborted) {
        stream.error(new Error('Aborted'))
        return
      }

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetchRange(startByte, abortController.signal, !isFirstRequest)
          
          // Only get content length on first successful request
          if (contentLength === null) {
            contentLength = getContentLength(response)
          }

          const reader = response.body.getReader()
          while (true) {
            // Check for abort before each read
            if (abortController.signal.aborted) {
              reader.releaseLock()
              stream.error(new Error('Aborted'))
              return
            }

            const { done, value } = await reader.read()
            if (done) {
              stream.close()
              return
            }

            startByte += value.byteLength
            stream.enqueue(value)
            options.onProgress?.(startByte / contentLength)
          }
        } catch (err) {
          console.warn(`Attempt ${attempt + 1} failed:`, err)
          
          // Check if this error should be retried
          if (!isRetriableError(err) || attempt === maxRetries) {
            if (abortController.abort) {
              abortController.abort()
            }
            
            // If it's a non-retriable error, throw the original error
            if (!isRetriableError(err)) {
              stream.error(err)
            } else {
              stream.error(new Error('Max retries reached', { cause: err }))
            }
            return
          }
          
          isFirstRequest = false
          await new Promise((res) => setTimeout(res, retryDelay))
        }
      }
    },

    cancel(reason) {
      console.warn('Stream canceled:', reason)
      if (abortController.abort) {
        abortController.abort()
      }
    },
  })
}
