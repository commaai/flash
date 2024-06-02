import * as Comlink from "comlink";
import ImageWorker from "$lib/utils/workers/image.worker.js?worker";
import { onDestroy } from "svelte";
export function useImageWorker() {
  const worker = new ImageWorker();
  onDestroy(() => worker.terminate());
  return Comlink.wrap(worker);
}
