import { onCleanup } from "solid-js";
import * as Comlink from "comlink";

export function useImageWorker() {
  let worker = new Worker(new URL("../workers/image.worker", import.meta.url), {
    type: "module",
  });

  const api = Comlink.wrap(worker);

  onCleanup(() => {
    worker.terminate();
    worker = null;
  });

  return {
    init: () => api.init(),
    downloadImage: (image, progress) => api.downloadImage(image, progress),
    unpackImage: (image, progress) => api.unpackImage(image, progress),
    getImage: (image) => api.getImage(image),
  };
}
