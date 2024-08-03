import { createRoot } from 'react-dom/client'

const islandRoots = {}

function createIslandRoot(containerId) {
  const container = document.getElementById(containerId)

  if (!container) {
    throw new Error(`Failed to find container with id ${containerId}`)
  }

  return createRoot(container)
}

export function renderIsland(containerId, children) {
  const islandRoot = islandRoots[containerId] ?? createIslandRoot(containerId)

  islandRoot.render(children)

  islandRoots[containerId] = islandRoot
}
