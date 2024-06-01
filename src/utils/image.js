import { useEffect, useRef } from 'react'

import * as Comlink from 'comlink'

export function useImageWorker() {
  const apiRef = useRef()

  useEffect(() => {
    const worker = new Worker(new URL('../workers/image.worker', import.meta.url), {
      type: 'module',
    })
    apiRef.current = Comlink.wrap(worker)
    return () => worker.terminate()
  }, [])

  return apiRef
}
