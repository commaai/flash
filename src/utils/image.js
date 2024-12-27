import { createSignal, createEffect, onCleanup } from 'solid-js'
import * as Comlink from 'comlink'

export function useImageWorker() {
  const [apiRef, setApiRef] = createSignal({ current: null })

  createEffect(() => {
    const worker = new Worker(new URL('../workers/image.worker', import.meta.url), {
      type: 'module',
    })
    const wrappedWorker = Comlink.wrap(worker)
    setApiRef({ current: wrappedWorker })

    onCleanup(() => {
      worker.terminate()
      setApiRef({ current: null })
    })
  })

  return apiRef
}
