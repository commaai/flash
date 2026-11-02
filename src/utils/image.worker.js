import { cacheArchive, decodeImage } from './download'
import { fetchStream } from './stream'
import { getImageDirectory } from './image-storage'
import { decodeFrames, probeArchive, validateFrames } from './framed'
import { sendStream } from './stream-channel'
import { createArchiveWriter, openCachedArchive } from './archive-cache'
import { measuredArchiveRate, preferFramedArchive, serialProbeSize } from './serial-probe'

let archiveWriter
let receiveFramePorts

const download = (url, size, probe = false) => fetchStream(url, { mode: 'cors' }, {
  expectedLength: size,
  probeRanges: probe ? [8 * 1024 * 1024, 16 * 1024 * 1024, 32 * 1024 * 1024 + 65536] : undefined,
  onProgress: (progress) => self.postMessage({ progress }),
})

self.onmessage = async ({ data }) => {
  try {
    if (data.framePorts) { receiveFramePorts(data.framePorts); return }
    if (data.commit) {
      // The verifier has accepted every decoded byte before this message is sent.
      await archiveWriter?.close()
      archiveWriter?.releaseLock()
      self.postMessage({ cacheDone: true })
      return
    }
    const { image: requested, port, streaming } = data
    let image = requested
    let source, root, probeSource, parallel = false, cached = false, sourceRate = data.sourceRate, probeBytes = 0
    const workers = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 4))
    const allowLz4 = streaming && requested.useLz4 && requested.lz4
    const candidates = allowLz4 ? [requested.lz4, requested] : [requested]
    if (streaming) {
      root = await getImageDirectory()
      for (const candidate of candidates) {
        if (validateFrames(candidate)) {
          source = await openCachedArchive(root, candidate.framedArchiveCacheName, candidate.framedArchiveSize, true)
          parallel = !!source
        }
        source ||= await openCachedArchive(root, candidate.archiveCacheName, candidate.archiveSize)
        if (source) { image = candidate; break }
      }
      if (source) { cached = true; self.postMessage({ progress: 1 }) }
    }
    if (!source) {
      const framed = streaming && validateFrames(image)
      const primaryFramed = framed && image.archiveUrl === image.framedArchiveUrl && image.archiveSize === image.framedArchiveSize
      let fastLink = data.fastLink
      if ((framed || allowLz4) && fastLink === undefined && !(primaryFramed && !allowLz4)) {
        const samples = []
        probeSource = await download(image.archiveUrl, image.archiveSize, true)
        source = await probeArchive(probeSource, undefined,
          (measurement) => {
            samples.push(measurement)
            console.debug('[ImageManager] Archive source', measurement)
          })
        fastLink = !source
        sourceRate = Math.max(sourceRate || 0, measuredArchiveRate(samples))
        self.postMessage({ fastLink, sourceRate })
      }
      if (fastLink && allowLz4) image = requested.lz4
      parallel = streaming && validateFrames(image) && (fastLink || primaryFramed)
      const calibrate = streaming && !parallel && validateFrames(image) && image.archiveFileName.endsWith('.zst') && serialProbeSize(image) && sourceRate > 0
      if (!source) {
        source = await download(parallel ? image.framedArchiveUrl : image.archiveUrl,
          parallel ? image.framedArchiveSize : image.archiveSize, !!calibrate)
        if (calibrate) probeSource = source
      }
      if (calibrate) {
        if (!source.probeBytes) source = await probeArchive(source, undefined, undefined, false)
        probeBytes = source.probeBytes
      }
      if (!probeBytes) probeSource?.finishProbe()
      if (streaming) {
        const name = parallel ? image.framedArchiveCacheName : image.archiveCacheName
        archiveWriter = await createArchiveWriter(root, name)
        if (archiveWriter.temporaryName) self.postMessage({ cacheTemporary: archiveWriter.temporaryName })
      }
      if (archiveWriter) source = cacheArchive(source, archiveWriter)
    }
    if (!parallel && !cached && probeBytes) {
      const calibration = serialProbeSize(image)
      let decideSample, discardSample = false
      const sampleDecision = new Promise((resolve) => { decideSample = resolve })
      const useFrames = new Promise((resolve) => {
        port.onmessage = ({ data }) => {
          if (data.calibrated) {
            const useFramed = preferFramedArchive(image, data.calibrated, sourceRate, probeBytes, workers)
            console.debug('[ImageManager] Serial sample', { ...data.calibrated, sourceRate, useFramed })
            if (!useFramed) probeSource.finishProbe()
            discardSample = useFramed
            decideSample()
            port.postMessage({ useFramed })
            if (!useFramed) resolve(false)
          } else if (data.discarded) resolve(true)
        }
        port.start()
      })
      let decoded = 0, consumed = 0
      const stream = decodeImage(source, image, () => port.postMessage({ decodeStarted: performance.timeOrigin + performance.now() }),
        (bytes) => {
          decoded += bytes
          // The verifier can finish its sample using this output. Do not decode
          // or fetch ahead while it hashes the retained prefix and chooses a codec.
          if (decoded >= calibration) return sampleDecision
        }, (bytes) => {
          consumed += bytes
          if (!discardSample) probeSource.creditProbe(consumed)
        })
      port.postMessage({ stream, image, calibration }, [stream])
      if (!await useFrames) return
      await archiveWriter.abort()
      archiveWriter.releaseLock()
      archiveWriter = await createArchiveWriter(root, image.framedArchiveCacheName)
      if (archiveWriter.temporaryName) self.postMessage({ cacheTemporary: archiveWriter.temporaryName })
      source = cacheArchive(await download(image.framedArchiveUrl, image.framedArchiveSize), archiveWriter)
      parallel = true
    }
    if (parallel) {
      const ports = await new Promise((resolve) => {
        receiveFramePorts = resolve
        self.postMessage({ frameWorkers: workers })
      })
      const stream = decodeFrames(source, image, ports)
      port.postMessage({ ownedStream: true, image, verified: true })
      await sendStream(stream, port)
    } else {
      const stream = decodeImage(source, image)
      port.postMessage({ stream, image }, [stream])
    }
  } catch (error) {
    await archiveWriter?.abort().catch(() => {})
    self.postMessage({ error: error?.message || String(error) })
  }
}
