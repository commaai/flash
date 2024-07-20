import * as Comlink from "comlink";

import jsSHA from "jssha";
import { XzReadableStream } from "xz-decompress";
import { Image as ManifestImage } from "../utils/manifest";

type ChunkCallbackFnType = (chunk: Uint8Array) => Promise<void>;

type ProgressCallbackFnType = (progress: number) => Promise<void>;

type CallbackType = {
  onChunk: ChunkCallbackFnType;
  onProgress?: ProgressCallbackFnType;
};

/**
 * Read chunks from a readable stream reader while reporting progress
 */
async function readChunks(
  reader: ReadableStreamDefaultReader,
  total: number,
  { onChunk, onProgress = undefined }: CallbackType,
) {
  let processed = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await onChunk(value);
    processed += value.length;
    onProgress?.(processed / total);
  }
}

let root: FileSystemDirectoryHandle;

const imageWorker = {
  async init() {
    if (root) {
      console.warn("[ImageWorker] Already initialized");
      return;
    }

    // TODO: check storage quota and report error if insufficient
    root = await navigator.storage.getDirectory();
    console.info("[ImageWorker] Initialized");
  },

  /**
   * Download an image to persistent storage.
   */
  async downloadImage(
    image: ManifestImage,
    onProgress?: ProgressCallbackFnType,
  ) {
    const { archiveFileName, archiveUrl } = image;

    let writable;
    try {
      const fileHandle = await root.getFileHandle(archiveFileName, {
        create: true,
      });
      writable = await fileHandle.createWritable();
    } catch (e) {
      throw `Error opening file handle: ${e}`;
    }

    console.debug("[ImageWorker] Downloading", archiveUrl);
    const response = await fetch(archiveUrl, { mode: "cors" });
    if (!response.ok) {
      throw `Fetch failed: ${response.status} ${response.statusText}`;
    }

    try {
      const contentLength = +response.headers.get("Content-Length")!;
      const reader = response.body!.getReader();
      await readChunks(reader, contentLength, {
        onChunk: async (chunk) => await writable.write(chunk),
        onProgress,
      });
      onProgress?.(1);
    } catch (e) {
      throw `Could not read response body: ${e}`;
    }

    try {
      await writable.close();
    } catch (e) {
      throw `Error closing file handle: ${e}`;
    }
  },

  /**
   * Unpack and verify a downloaded image archive.
   *
   * Throws an error if the checksum does not match.
   */
  async unpackImage(image: ManifestImage, onProgress?: ProgressCallbackFnType) {
    const {
      archiveFileName,
      checksum: expectedChecksum,
      fileName,
      size: imageSize,
    } = image;

    let archiveFile;
    try {
      const archiveFileHandle = await root.getFileHandle(archiveFileName, {
        create: false,
      });
      archiveFile = await archiveFileHandle.getFile();
    } catch (e) {
      throw `Error opening archive file handle: ${e}`;
    }

    let writable;
    try {
      const fileHandle = await root.getFileHandle(fileName, { create: true });
      writable = await fileHandle.createWritable();
    } catch (e) {
      throw `Error opening output file handle: ${e}`;
    }

    const shaObj = new jsSHA("SHA-256", "UINT8ARRAY");
    let complete;
    try {
      const reader = new XzReadableStream(archiveFile.stream()).getReader();

      await readChunks(reader, imageSize, {
        onChunk: async (chunk) => {
          await writable.write(chunk);
          shaObj.update(chunk);
        },
        onProgress,
      });

      complete = true;
      onProgress?.(1);
    } catch (e) {
      throw `Error unpacking archive: ${e}`;
    }

    if (!complete) {
      throw "Decompression error: unexpected end of stream";
    }

    try {
      await writable.close();
    } catch (e) {
      throw `Error closing file handle: ${e}`;
    }

    const checksum = shaObj.getHash("HEX");
    if (checksum !== expectedChecksum) {
      throw `Checksum mismatch: got ${checksum}, expected ${expectedChecksum}`;
    }
  },

  /**
   * Get a file handle for an image.
   */
  async getImage(image: ManifestImage) {
    const { fileName } = image;

    let fileHandle;
    try {
      fileHandle = await root.getFileHandle(fileName, { create: false });
    } catch (e) {
      throw `Error getting file handle: ${e}`;
    }

    return fileHandle;
  },
};

export type ImageWorkerType = typeof imageWorker;

Comlink.expose(imageWorker);
