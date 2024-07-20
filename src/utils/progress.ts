/**
 * Create a set of callbacks that can be used to track progress of a multistep process.
 *
 * @param {(number[]|number)} steps
 * @param {progressCallback} onProgress
 * @returns {(progressCallback)[]}
 */
export function createSteps(
  steps: number | number[],
  onProgress: (val: number) => void,
) {
  const stepWeights = typeof steps === "number" ? Array(steps).fill(1) : steps;

  const progressParts = Array(stepWeights.length).fill(0);
  const totalSize = stepWeights.reduce((total, weight) => total + weight, 0);

  function updateProgress() {
    const weightedAverage = stepWeights.reduce((acc, weight, idx) => {
      return acc + progressParts[idx] * weight;
    }, 0);
    onProgress(weightedAverage / totalSize);
  }

  return stepWeights.map((_weight, idx) => (progress: number) => {
    if (progressParts[idx] !== progress) {
      progressParts[idx] = progress;
      updateProgress();
    }
  });
}

/**
 * Iterate over a list of steps while reporting progress.
 * @template T
 * @param {(number[]|T[])} steps
 * @param {progressCallback} onProgress
 * @returns {([T, progressCallback])[]}
 */
export function withProgress(
  steps: number[] | any[],
  onProgress: (val: number) => void,
) {
  const callbacks = createSteps(
    steps.map((step) =>
      typeof step === "number" ? step : step.size || step.length || 1,
    ),
    onProgress,
  );
  return steps.map((step, idx) => [step, callbacks[idx]]);
}
