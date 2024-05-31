import * as Comlink from "comlink";
import MyWorker from "$lib/utils/workers/image.worker.js?url";
export function useImageWorker() {
  const worker = new Worker(MyWorker, { type: "module" });
  return Comlink.wrap(worker);
}
