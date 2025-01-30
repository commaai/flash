import { useEffect, useRef } from 'react'

import * as Comlink from 'comlink'

/**
 * @returns {React.MutableRefObject<ImageWorker>}
 */
export function useImageWorker() {
  const apiRef = useRef()

  useEffect(() => {
    const worker = new Worker(new URL('../workers/image.worker', import.meta.url), {
      type: 'module',
    })
    const proxy = Comlink.wrap(worker)
    apiRef.current = proxy
    return () => {
      proxy.releaseProxy()
      worker.terminate()
    }
  }, [])

  return apiRef
}
