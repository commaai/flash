export class Timer {
  /** @type {number|null} */
  startTime = null

  start() {
    this.startTime = this.mark('start')
  }

  /**
   * @param {string} markName
   * @returns {number}
   */
  mark(markName) {
    const now = performance.mark(markName).startTime
    if (this.startTime) console.info(`[Timer] ${markName} at ${((now - this.startTime) / 1000).toFixed(2)}s`)
    return now
  }

  /**
   * @param {string} reason
   */
  stop(reason) {
    if (!this.startTime) return null
    const measure = performance.measure('flash', {
      start: this.startTime,
      end: this.mark(reason),
      detail: reason,
    })
    // TODO: submit results
    console.log(measure)
    console.log(performance.getEntriesByType('mark'))
  }
}
