import { useEffect, useRef } from "preact/compat";

import * as Comlink from "comlink";

import type { ImageWorkerApi } from "../workers/image.worker";

export function useImageWorker() {
  const apiRef = useRef<ImageWorkerApi>();

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/image.worker", import.meta.url),
      { type: "module" }
    );
    apiRef.current = Comlink.wrap(worker);
    return () => worker.terminate();
  }, []);

  return apiRef;
}
