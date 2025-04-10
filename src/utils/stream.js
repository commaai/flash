export async function fetchStream(url, requestOptions = {}, options = {}) {
  const maxRetries = options.maxRetries || 3
  const retryDelay = options.retryDelay || 1000

  let startByte = 0
  let contentLength = null
  let controller = new AbortController()
  let reader

  return new ReadableStream({
    async pull(streamController) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        console.debug(`Attempt ${attempt + 1} to fetch ${url} from byte ${startByte}`)
        try {
          const headers = requestOptions.headers || {}
          if (startByte > 0) headers['range'] = `bytes=${startByte}-`

          const response = await fetch(url, {
            ...requestOptions,
            headers,
            signal: controller.signal
          })

          if (!response.ok && response.status !== 206 && response.status !== 200) {
            throw new Error(`Fetch error: ${response.status}`)
          }

          if (!contentLength) {
            const total = response.headers.get('Content-Length')
            const range = response.headers.get('Content-Range')
            if (range) {
              const match = range.match(/\/(\d+)$/)
              if (match) contentLength = parseInt(match[1], 10)
            } else if (total) {
              contentLength = parseInt(total, 10)
            }
            if (!contentLength) {
              throw new Error('Content-Length not found in response headers')
            }
          }

          reader = response.body.getReader()

          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              streamController.close()
              return
            }

            startByte += value.length
            streamController.enqueue(value)
            options.onProgress?.(startByte / contentLength)
          }
        } catch (err) {
          console.warn(`Attempt ${attempt + 1} failed:`, err)
          if (attempt === maxRetries) {
            streamController.error(new Error('Max retries reached'))
            return
          }
          await new Promise((res) => setTimeout(res, retryDelay))
        }
      }
    },
    cancel(reason) {
      console.log('Stream canceled:', reason)
      controller.abort()
    }
  })
}
