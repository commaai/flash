/**
 * Create a set of callbacks that can be used to track progress of a multistep process.
 *
 * @param {(number[]|number)} steps
 * @param {progressCallback} onProgress
 * @returns {(progressCallback)[]}
 */
export function createSteps(steps, onProgress) {
  const stepWeights = typeof steps === 'number' ? Array(steps).fill(1) : steps

  const progressParts = Array(stepWeights.length).fill(0)
  const totalSize = stepWeights.reduce((total, weight) => total + weight, 0)

  function updateProgress() {
    const weightedAverage = stepWeights.reduce((acc, weight, idx) => {
      return acc + progressParts[idx] * weight
    }, 0)
    onProgress(weightedAverage / totalSize)
  }

  return stepWeights.map((weight, idx) => (progress) => {
    if (progressParts[idx] !== progress) {
      progressParts[idx] = progress
      updateProgress()
    }
  })
}

/**
 * Step weight callback
 *
 * @template T
 * @callback weightCallback
 * @param {T} step
 * @returns {number}
 */

/**
 * Iterate over a list of steps while reporting progress.
 * @template T
 * @param {T[]} steps
 * @param {progressCallback} onProgress
 * @param {weightCallback} [getStepWeight]
 * @returns {([T, progressCallback])[]}
 */
export function withProgress(steps, onProgress, getStepWeight) {
  const callbacks = createSteps(
    steps.map(getStepWeight || (step => typeof step === 'number' ? step : (typeof step !== 'string' ? step.size || step.length || 1 : 1))),
    onProgress,
  )
  return steps.map((step, idx) => [step, callbacks[idx]])
}
