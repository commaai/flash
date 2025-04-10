export async function fetchStream(url, requestOptions = {}, options = {}) {
  const maxRetries = options.maxRetries || 3
  const retryDelay = options.retryDelay || 1000

  return new ReadableStream({
    start() {
      this.startByte = 0
      this.contentLength = null
      this.abortController = new AbortController()
      this.reader = null
    },

    async pull(streamController) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const headers = { ...(requestOptions.headers || {}) }
          if (this.startByte > 0) headers['range'] = `bytes=${this.startByte}-`

          const response = await fetch(url, {
            ...requestOptions,
            headers,
            signal: this.abortController.signal
          })

          if (!response.ok && response.status !== 206 && response.status !== 200) {
            throw new Error(`Fetch error: ${response.status}`)
          }

          if (!this.contentLength) {
            const total = response.headers.get('Content-Length')
            const range = response.headers.get('Content-Range')
            if (range) {
              const match = range.match(/\/(\d+)$/)
              if (match) this.contentLength = parseInt(match[1], 10)
            } else if (total) {
              this.contentLength = parseInt(total, 10)
            }
            if (!this.contentLength) {
              throw new Error('Content-Length not found in response headers')
            }
          }

          this.reader = response.body.getReader()

          while (true) {
            const { done, value } = await this.reader.read()
            if (done) {
              streamController.close()
              return
            }

            this.startByte += value.length
            streamController.enqueue(value)
            options.onProgress?.(this.startByte / this.contentLength)
          }
        } catch (err) {
          console.warn(`Attempt ${attempt + 1} failed:`, err)
          if (attempt === maxRetries) {
            this.abortController.abort()
            streamController.error(new Error('Max retries reached'))
            return
          }
          await new Promise((res) => setTimeout(res, retryDelay))
        }
      }
    },

    cancel(reason) {
      console.warn('Stream canceled:', reason)
      this.abortController.abort()
    }
  })
}
