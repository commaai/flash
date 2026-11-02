class ArchiveResponseError extends Error {}

/** @param {Response} response */
const getContentLength = (response) => {
  const total = response.headers.get('Content-Length')
  if (total !== null && /^\d+$/.test(total) && Number.isSafeInteger(Number(total))) return Number(total)
  throw new ArchiveResponseError('Invalid archive Content-Length')
}

/**
 * @param {string|URL} url
 * @param {RequestInit} [requestOptions]
 * @param {object} [options]
 * @param {number} [options.maxRetries]
 * @param {number} [options.retryDelay]
 * @param {number} [options.expectedLength]
 * @param {number[]} [options.probeRanges] Bounded initial range endpoints (exclusive).
 * @param {progressCallback} [options.onProgress]
 */
export async function fetchStream(url, requestOptions = {}, options = {}) {
  const maxRetries = options.maxRetries ?? 3
  const retryDelay = options.retryDelay ?? 1000
  if (options.expectedLength !== undefined && (!Number.isSafeInteger(options.expectedLength) || options.expectedLength < 0)) {
    throw new ArchiveResponseError('Invalid expected archive size')
  }
  const probeRanges = options.probeRanges
  if (probeRanges && (!(options.expectedLength > 0) || !probeRanges.length ||
      probeRanges.some((end, index) => !Number.isSafeInteger(end) || end <= (probeRanges[index - 1] || 0)))) {
    throw new ArchiveResponseError('Invalid archive probe ranges')
  }
  const abortController = new AbortController()
  let startByte = 0, contentLength = options.expectedLength ?? null, responseEnd
  let reader, probing = !!probeRanges, probeConsumed = 0, resumeProbe
  const wakeProbe = () => { const resume = resumeProbe; resumeProbe = undefined; resume?.() }

  /**
   * @param {number} startByte
   * @param {AbortSignal} signal
   */
  const fetchRange = async (startByte, signal) => {
    const headers = { ...(requestOptions.headers || {}) }
    const end = probing ? Math.min(contentLength,
      probeRanges.find((end) => end > startByte) ?? startByte + 1024 * 1024) - 1 : undefined
    if (startByte > 0 || probing) headers['range'] = `bytes=${startByte}-${end ?? ''}`

    const response = await fetch(url, {
      ...requestOptions,
      headers,
      signal
    })
    try {
      if (!response.ok || (response.status !== 206 && response.status !== 200)) throw new Error(`Fetch error: ${response.status}`)
      const length = getContentLength(response)
      if (startByte > 0 || response.status === 206) {
        if (response.status !== 206) throw new ArchiveResponseError('Invalid resumed archive response')
        const header = response.headers.get('Content-Range')
        const range = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec(header || '')
        // Some CDNs do not expose Content-Range through CORS. A known total,
        // status206 and exact requested length still bound the response; image
        // hashes independently verify its identity before any payload is sent.
        if ((header && !range) || (!range && contentLength === null)) throw new ArchiveResponseError('Invalid archive Content-Range')
        const [start, receivedEnd, total] = range ? range.slice(1).map(Number) : [startByte, end ?? contentLength - 1, contentLength]
        if (![start, receivedEnd, total].every(Number.isSafeInteger) || start !== startByte ||
            receivedEnd !== (end ?? total - 1) || receivedEnd < start || length !== receivedEnd - start + 1 ||
            (contentLength !== null && total !== contentLength)) {
          throw new ArchiveResponseError('Invalid archive Content-Range')
        }
        contentLength ??= total
        responseEnd = receivedEnd
      } else {
        if (contentLength !== null && length !== contentLength) throw new ArchiveResponseError('Archive size mismatch')
        contentLength ??= length
        responseEnd = contentLength - 1
        // A server may ignore an initial Range request. Keep that valid full
        // response; it cannot be used to resume a partially consumed response.
        probing = false
      }
      return response
    } catch (error) {
      await response.body?.cancel?.(error).catch(() => {})
      throw error
    }
  }

  const result = new ReadableStream({
    async pull(stream) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          for (;;) {
            if (!reader) {
              // Upstream pipes may request more input while the decoder still
              // has the retained prefix. Extend only after it consumes that
              // prefix, or after the caller chooses the full serial archive.
              while (probing && startByte >= probeRanges.at(-1) && probeConsumed < startByte) {
                await new Promise((resolve) => { resumeProbe = resolve })
                if (abortController.signal.aborted) return
              }
              const response = await fetchRange(startByte, abortController.signal)
              reader = response.body.getReader()
            }
            const { done, value } = await reader.read()
            if (done) {
              if (startByte !== responseEnd + 1) throw new ArchiveResponseError('Archive size mismatch')
              reader.releaseLock?.()
              reader = null
              if (startByte < contentLength) continue
              stream.close()
              return
            }
            if (value.byteLength > responseEnd + 1 - startByte) throw new ArchiveResponseError('Archive size mismatch')
            startByte += value.byteLength
            stream.enqueue(value)
            options.onProgress?.(startByte / contentLength)
            return
          }
        } catch (err) {
          await reader?.cancel?.(err).catch(() => {})
          reader?.releaseLock?.()
          reader = null
          if (abortController.signal.aborted) return
          if (err instanceof ArchiveResponseError) {
            abortController.abort()
            stream.error(err)
            return
          }
          console.warn(`Attempt ${attempt + 1} failed:`, err)
          if (attempt === maxRetries) {
            abortController.abort()
            stream.error(new Error('Max retries reached', { cause: err }))
            return
          }
          await new Promise((res) => setTimeout(res, retryDelay))
        }
      }
    },

    cancel(reason) {
      console.warn('Stream canceled:', reason)
      abortController.abort()
      wakeProbe()
    },
  }, { highWaterMark: probeRanges ? 0 : 4 * 1024 * 1024, size: (chunk) => chunk.byteLength })
  result.finishProbe = () => { probing = false; wakeProbe() }
  result.creditProbe = (bytes) => {
    if (!Number.isSafeInteger(bytes) || bytes < probeConsumed || bytes > startByte) throw new Error('Invalid archive probe credit')
    probeConsumed = bytes
    wakeProbe()
  }
  return result
}
