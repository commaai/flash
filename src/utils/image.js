import { useEffect, useRef } from 'react'

import { ImageWorker } from '../workers/image.worker.js'

/** @returns {React.MutableRefObject<ImageWorker>} */
export function useImageWorker() {
  const apiRef = useRef()

  useEffect(() => {
    const worker = new ImageWorker()
    apiRef.current = worker
  }, [])

  return apiRef
}
