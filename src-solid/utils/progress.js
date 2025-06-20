// Simplified progress tracking - direct and minimal
export function createProgressTracker(onProgress) {
  let completed = 0
  let total = 0
  
  return {
    setTotal: (n) => { 
      total = n
      onProgress(total > 0 ? completed / total : 0)
    },
    increment: () => {
      completed++
      onProgress(total > 0 ? completed / total : 0)
    },
    setProgress: (n) => {
      completed = n
      onProgress(total > 0 ? completed / total : 0)
    },
    reset: () => {
      completed = 0
      total = 0
      onProgress(0)
    }
  }
}

// Simplified weighted progress for multiple steps
export function createStepProgress(stepWeights, onProgress) {
  const steps = stepWeights.map(() => 0)
  const total = stepWeights.reduce((sum, weight) => sum + weight, 0)
  
  const update = () => {
    const weighted = stepWeights.reduce((sum, weight, i) => sum + steps[i] * weight, 0)
    onProgress(total > 0 ? weighted / total : 0)
  }
  
  return stepWeights.map((_, index) => (progress) => {
    steps[index] = Math.max(0, Math.min(1, progress)) // Clamp between 0-1
    update()
  })
}
