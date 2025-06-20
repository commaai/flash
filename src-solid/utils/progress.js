// Simplified progress tracking - direct and minimal
export function createProgressTracker(onProgress) {
  let completed = 0
  let total = 0
  
  return {
    setTotal: (n) => { total = n },
    increment: () => {
      completed++
      onProgress(total > 0 ? completed / total : 0)
    },
    setProgress: (n) => {
      completed = n
      onProgress(total > 0 ? completed / total : 0)
    }
  }
}

// Simplified weighted progress for multiple steps
export function createStepProgress(stepWeights, onProgress) {
  const steps = stepWeights.map(() => 0)
  const total = stepWeights.reduce((sum, weight) => sum + weight, 0)
  
  const update = () => {
    const weighted = stepWeights.reduce((sum, weight, i) => sum + steps[i] * weight, 0)
    onProgress(weighted / total)
  }
  
  return stepWeights.map((_, index) => (progress) => {
    steps[index] = progress
    update()
  })
}
