export class Timer {
  /** @type {number|null} */
  startTime = null

  /** @type {Object.<string, number>} */
  stepTimestamps = {}

  start() {
    this.startTime = performance.now()
    this.stepTimestamps = {}
    this.mark('start')
  }

  /**
   * @param {string} step
   */
  mark(step) {
    if (!this.startTime) return
    const now = performance.now()
    this.stepTimestamps[step] = now
    console.info(`[Timer] ${step} at ${((now - this.startTime) / 1000).toFixed(2)}s`)
  }

  /**
   * @param {string} reason
   */
  stop(reason) {
    if (!this.startTime) return null
    this.mark(reason)
    console.debug({
      reason,
      totalDuration: this.stepTimestamps[reason],
      steps: this.stepTimestamps,
    })
  }
}
