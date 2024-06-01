/**
 * Create a set of callbacks that can be used to track progress of a multistep process.
 *
 * @param {(number[]|number)} steps
 * @param {Object} progress
 * @returns {(number)[]}
 */
// eslint-disable-next-line no-unused-vars
export function createSteps(steps, progress) {
  const stepWeights = typeof steps === 'number' ? Array(steps).fill(1) : steps

  const progressParts = Array(stepWeights.length).fill(0)
  const totalSize = stepWeights.reduce((total, weight) => total + weight, 0)

  function updateProgress() {
    const weightedAverage = stepWeights.reduce((acc, weight, idx) => {
      return acc + progressParts[idx] * weight
    }, 0)
    progress.value = weightedAverage / totalSize;
  }

  return stepWeights.map((weight, idx) => (progress) => {
    if (progressParts[idx] !== progress.value) {
      progressParts[idx] = progress.value;
      updateProgress()
    }
  })
}

/**
 * Iterate over a list of steps while reporting progress.
 * @template T
 * @param {(number[]|T[])} steps
 * @param {Object} progress
 * @returns {([T, Object])[]}
 */
export function withProgress(steps, progress) {
  const callbacks = createSteps(
    steps.value.map(step => typeof step === 'number' ? step : step.size || step.length || 1),
    progress,
  )
  return steps.value.map((step, idx) => [step, callbacks[idx]])
}
