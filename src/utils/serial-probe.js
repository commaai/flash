const MAX_PREFIX = 32 * 1024 * 1024

export function measuredArchiveRate(samples) {
  const steady = samples.filter((sample) => sample.bytes > 8 * 1024 * 1024)
  return (steady.length ? steady : samples).reduce((rate, sample) => Math.max(rate, sample.bytesPerSecond), 0)
}

export function serialProbeSize(image) {
  const size = Math.floor(MAX_PREFIX / image.chunkSize) * image.chunkSize
  return size > 0 && image.fileSize > size ? size : 0
}

export function preferFramedArchive(image, sample, networkRate, downloaded, workers) {
  if (!(sample.bytes > 0 && sample.seconds > 0 && Number.isFinite(sample.seconds) && networkRate > 0)) return false
  const serialRate = sample.bytes / sample.seconds
  const serialSeconds = Math.max((image.fileSize - sample.bytes) / serialRate,
    Math.max(0, image.archiveSize - downloaded) / networkRate)
  // Leave headroom for worker scheduling, hashing and shared memory bandwidth.
  const parallelism = Math.max(1, workers * 0.7)
  const framedSeconds = Math.max(image.fileSize / (serialRate * parallelism), image.framedArchiveSize / networkRate)
  return framedSeconds * 1.1 + 0.25 < serialSeconds
}

// Retain only verified, independently owned chunks. A rejected sample cancels
// its source before another codec can expose any payload to the flasher.
export async function sampleVerifiedStream(stream, limit, started, decide, now = () => performance.timeOrigin + performance.now()) {
  const reader = stream.getReader(), prefix = []
  let bytes = 0
  try {
    while (bytes < limit) {
      const next = await reader.read()
      if (next.done) throw new Error('Incomplete serial image sample')
      bytes += next.value.length
      if (bytes > limit) throw new Error('Serial image sample exceeds its bound')
      prefix.push(next.value)
    }
    const ended = now(), seconds = (ended - await started) / 1000
    if (await decide({ bytes, seconds })) {
      await reader.cancel('Using parallel archive')
      reader.releaseLock()
      return null
    }
    return new ReadableStream({
      async pull(controller) {
        try {
          if (prefix.length) { controller.enqueue(prefix.shift()); return }
          const next = await reader.read()
          if (next.done) { controller.close(); reader.releaseLock() }
          else controller.enqueue(next.value)
        } catch (error) { controller.error(error); reader.releaseLock() }
      },
      async cancel(reason) { await reader.cancel(reason); reader.releaseLock() },
    })
  } catch (error) {
    await reader.cancel(error).catch(() => {})
    reader.releaseLock()
    throw error
  }
}
