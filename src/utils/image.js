import { useEffect, useRef } from 'react'

import * as Comlink from 'comlink'

export function useImageWorker() {
  const apiRef = useRef()

  useEffect(() => {
    const worker = new Worker(new URL('../workers/image.worker.js', import.meta.url))
    apiRef.current = Comlink.wrap(worker)
    return () => worker.terminate()
  }, [])

  return apiRef
}
