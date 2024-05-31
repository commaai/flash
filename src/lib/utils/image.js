import * as Comlink from "comlink";
import ImageWorker from "$lib/utils/workers/image.worker.js?worker";
export function useImageWorker() {
  const worker = new ImageWorker();
  return Comlink.wrap(worker);
}
