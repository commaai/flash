import * as Comlink from "comlink";
import { XzReadableStream } from "xz-decompress";
import { ManifestImage } from "../utils/manifest";

/**
 * Progress callback
 */
type ProgressCallback = (progress: number) => void;

export type ImageWorkerApi = {
  init: () => Promise<void>;
  downloadImage: (
    image: ManifestImage,
    onProgress?: ProgressCallback
  ) => Promise<void>;
  getImage: (image: ManifestImage) => Promise<Blob>;
};

const MIN_QUOTA_MB = 5250;

let root: FileSystemDirectoryHandle;

/**
 * Interface for the image worker
 */
const imageWorker = {
  async init(): Promise<void> {
    if (!root) {
      root = await navigator.storage.getDirectory();
      // Using official FileSystemDirectoryHandle type from @types/wicg-file-system-access
      // which doesn't have a recursive remove method, but has removeEntry for individual files
      console.info("[ImageWorker] Initialized");
    }

    const estimate = await navigator.storage.estimate();
    const quotaMB = (estimate.quota || 0) / 1024 ** 2;
    if (quotaMB < MIN_QUOTA_MB) {
      throw `Not enough storage: ${quotaMB.toFixed(
        0
      )}MB free, need ${MIN_QUOTA_MB.toFixed(0)}MB`;
    }
  },

  /**
   * Download and unpack an image, saving it to persistent storage.
   */
  async downloadImage(
    image: ManifestImage,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const { archiveUrl, fileName } = image;

    let writable: FileSystemWritableFileStream;
    try {
      const fileHandle = await root.getFileHandle(fileName, { create: true });
      writable = await fileHandle.createWritable();
    } catch (e) {
      throw `Error opening file handle: ${e}`;
    }

    console.debug(`[ImageWorker] Downloading ${image.name} from ${archiveUrl}`);
    const response = await fetch(archiveUrl, { mode: "cors" });
    if (!response.ok) {
      throw `Fetch failed: ${response.status} ${response.statusText}`;
    }

    const contentLength = +(response.headers.get("Content-Length") ?? "0");
    let receivedLength = 0;
    const transform = new TransformStream({
      transform(chunk, controller) {
        receivedLength += chunk.byteLength;
        if (onProgress) onProgress(receivedLength / contentLength);
        controller.enqueue(chunk);
      },
    });

    if (!response.body) {
      throw "Response body is null";
    }

    let stream = response.body.pipeThrough(transform);
    try {
      if (image.compressed) {
        stream = new XzReadableStream(stream);
      }
      await stream.pipeTo(writable);
      if (onProgress) onProgress(1);
    } catch (e) {
      throw `Error unpacking archive: ${e}`;
    }
  },

  /**
   * Get a blob for an image.
   */
  async getImage(image: ManifestImage): Promise<Blob> {
    const { fileName } = image;

    let fileHandle;
    try {
      fileHandle = await root.getFileHandle(fileName, { create: false });
    } catch (e) {
      throw `Error getting file handle: ${e}`;
    }

    return fileHandle.getFile();
  },
};

Comlink.expose(imageWorker);
