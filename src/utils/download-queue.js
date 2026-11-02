export class DownloadQueue {
  constructor(imageManager, images, concurrency = 4, deferred = [], streaming = []) {
    this.controller = new AbortController()
    this.downloads = new Map([...images, ...deferred].map((image) => {
      const entry = { progress: 0 }
      entry.promise = new Promise((resolve, reject) => { entry.resolve = resolve; entry.reject = reject })
      entry.stream = new Promise((resolve, reject) => { entry.resolveStream = resolve; entry.rejectStream = reject })
      entry.promise.catch(() => {})
      entry.stream.catch(() => {})
      return [image, entry]
    }))
    const run = async (pending) => {
      for (const image of pending) {
        if (this.controller.signal.aborted) break
        const entry = this.downloads.get(image)
        try {
          const complete = imageManager.downloadImage(image, (progress) => {
            entry.progress = progress
            entry.onProgress?.(progress)
          }, this.controller.signal, streaming.includes(image) ? entry.resolveStream : undefined)
          complete.then(() => {
            entry.progress = 1
            entry.onProgress?.(1)
            entry.resolve()
          }, (error) => {
            entry.reject(error)
            entry.rejectStream(error)
          })
          await (streaming.includes(image) ? entry.stream : complete)
        } catch (error) {
          entry.reject(error)
          entry.rejectStream(error)
        }
      }
    }
    const pending = images.values()
    Promise.all(Array.from({ length: concurrency }, () => run(pending))).then(() => run(deferred.values()))
  }

  get(image, onProgress) {
    const entry = this.downloads.get(image)
    entry.onProgress = onProgress
    onProgress?.(entry.progress)
    return entry.promise
  }

  getStream(image, onProgress) {
    const entry = this.downloads.get(image)
    entry.onProgress = onProgress
    onProgress?.(entry.progress)
    return entry.stream
  }

  cancel() {
    this.controller.abort()
    for (const entry of this.downloads.values()) {
      entry.reject(this.controller.signal.reason)
      entry.rejectStream(this.controller.signal.reason)
    }
  }
}
