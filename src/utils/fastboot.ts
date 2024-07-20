import * as Comlink from "comlink";
import { FastbootDevice, setDebugLevel } from "android-fastboot";
import type { ImageWorkerType } from "../workers/image.worker";
import { download } from "./blob";
import config from "../config";
import { createManifest, Image as ManifestImage } from "./manifest";
import { withProgress } from "./progress";

setDebugLevel(2);

export class FastbootManager extends EventTarget {
  state: FastbootManagerStateType;
  imageWorker: Comlink.Remote<ImageWorkerType>;
  device: FastbootDevice;
  manifest: ManifestImage[] | null;

  constructor() {
    super();
    this.state = {
      step: FastbootStep.INITIALIZING,
      message: "",
      progress: -1,
      error: FastbootError.NONE,
      connected: false,
      serial: null,
    };
    this.imageWorker = Comlink.wrap(
      new Worker(new URL("../workers/image.worker.ts", import.meta.url), {
        type: "module",
      }),
    );
    this.device = new FastbootDevice();
    this.manifest = null;
  }

  on(type: string, listener: (data: FastbootManagerStateType) => void) {
    this.addEventListener(type, ((
      event: CustomEvent<FastbootManagerStateType>,
    ) => listener(event.detail)) as EventListener);
  }

  private setStep(step: FastbootStep) {
    this.state.step = step;
    this.dispatchEvent(new CustomEvent("step", { detail: this.state }));
  }

  private setError(error: FastbootError) {
    this.state.error = error;
    this.dispatchEvent(new CustomEvent("error", { detail: this.state }));
  }

  private setSerial(serial: string) {
    this.state.serial = serial;
    this.dispatchEvent(new CustomEvent("serial", { detail: this.state }));
  }

  private setConnected(isConnected: boolean) {
    this.state.connected = isConnected;
    this.dispatchEvent(new CustomEvent("connected", { detail: this.state }));
  }

  private setProgress(progress: number) {
    this.state.progress = progress;
    this.dispatchEvent(new CustomEvent("progress", { detail: this.state }));
  }

  private setMessage(message: string) {
    this.state.message = message;
    this.dispatchEvent(new CustomEvent("message", { detail: this.state }));
  }

  init() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Check that the browser supports WebUSB
    if (typeof navigator.usb === "undefined") {
      console.error("[fastboot] WebUSB not supported");
      this.setError(FastbootError.REQUIREMENTS_NOT_MET);
      return;
    }

    // Check that the browser supports Web Workers
    if (typeof Worker === "undefined") {
      console.error("[fastboot] Web Workers not supported");
      this.setError(FastbootError.REQUIREMENTS_NOT_MET);
      return;
    }

    // Check that the browser supports Storage API
    if (typeof Storage === "undefined") {
      console.error("[fastboot] Storage API not supported");
      this.setError(FastbootError.REQUIREMENTS_NOT_MET);
      return;
    }

    this.imageWorker
      .init()
      .then(() => download(config.manifests["master"]))
      .then((blob) => blob.text())
      .then((text) => {
        this.manifest = createManifest(text);
        // sanity check
        if (this.manifest.length === 0) {
          throw "Manifest is empty";
        }
        console.debug("[fastboot] Loaded manifest", this.manifest);
        this.state.onContinue = () => this.connectDevice();
        this.setStep(FastbootStep.READY);
      })
      .catch((err) => {
        console.error("[fastboot] Initialization error", err);
        this.setError(FastbootError.UNKNOWN);
      });
  }

  async connectDevice() {
    this.device.connect().catch((err) => {
      console.error("[fastboot] Connection error", err);
      this.setStep(FastbootStep.READY);
    });
    this.setStep(FastbootStep.CONNECTING);
    try {
      await this.device.waitForConnect();
      console.info("[fastboot] Connected", {
        fastboot: this.device,
      });
      try {
        const all = await this.device.getVariable("all");
        const deviceInfo = all.split("\n").reduce(
          (obj, line) => {
            const parts = line.split(":");
            const key = parts.slice(0, -1).join(":").trim();
            obj[key] = parts.slice(-1)[0].trim();
            return obj;
          },
          {} as Record<string, string>,
        );

        const recognized = isRecognizedDevice(deviceInfo);
        console.debug("[fastboot] Device info", {
          recognized,
          deviceInfo,
        });

        if (!recognized) {
          this.setError(FastbootError.UNRECOGNIZED_DEVICE);
          return;
        }

        this.setSerial(deviceInfo["serialno"] || "unknown");
        this.setConnected(true);
        this.downloadImages();
      } catch (err) {
        console.error("[fastboot] Error getting device information", err);
        this.setError(FastbootError.UNKNOWN);
      }
    } catch (err) {
      console.error("[fastboot] Connection lost", err);
      this.setError(FastbootError.LOST_CONNECTION);
      this.setConnected(false);
    }
  }

  async downloadImages() {
    this.setStep(FastbootStep.DOWNLOADING);
    this.setProgress(0);
    try {
      for await (const [image, onProgress] of withProgress(
        this.manifest!,
        this.setProgress,
      )) {
        this.setMessage(`Downloading ${image.name}`);
        await this.imageWorker.downloadImage(image, Comlink.proxy(onProgress));
      }
      this.unpackImages();
    } catch (err) {
      console.error("[fastboot] Download error", err);
      this.setError(FastbootError.DOWNLOAD_FAILED);
    }
  }

  async unpackImages() {
    this.setStep(FastbootStep.UNPACKING);
    this.setProgress(0);
    try {
      for await (const [image, onProgress] of withProgress(
        this.manifest!,
        this.setProgress,
      )) {
        this.setMessage(`Unpacking ${image.name}`);
        await this.imageWorker.unpackImage(image, Comlink.proxy(onProgress));
      }
      this.flashDevice();
    } catch (err) {
      console.error("[fastboot] Unpack error", err);
      if ((err as string).startsWith("Checksum mismatch")) {
        this.setError(FastbootError.CHECKSUM_MISMATCH);
      } else {
        this.setError(FastbootError.UNPACK_FAILED);
      }
    }
  }

  async flashDevice() {
    this.setStep(FastbootStep.FLASHING);
    this.setProgress(0);
    try {
      const currentSlot = await this.device.getVariable("current-slot");
      if (!["a", "b"].includes(currentSlot)) {
        throw `Unknown current slot ${currentSlot}`;
      }

      for await (const [image, onProgress] of withProgress(
        this.manifest!,
        this.setProgress,
      )) {
        const fileHandle = await this.imageWorker.getImage(image);
        const blob = await fileHandle.getFile();

        if (image.sparse) {
          this.setMessage(`Erasing ${image.name}`);
          await this.device.runCommand(`erase:${image.name}`);
        }
        this.setMessage(`Flashing ${image.name}`);
        await this.device.flashBlob(image.name, blob, onProgress, "other");
      }
      console.debug("[fastboot] Flashed all partitions");

      const otherSlot = currentSlot === "a" ? "b" : "a";
      this.setMessage(`Changing slot to ${otherSlot}`);
      await this.device.runCommand(`set_active:${otherSlot}`);
      console.debug("[fastboot] Flash complete");
      this.eraseDevice();
    } catch (err) {
      console.error("[fastboot] Flashing error", err);
      this.setError(FastbootError.FLASH_FAILED);
    }
  }

  async eraseDevice() {
    this.setStep(FastbootStep.ERASING);
    this.setProgress(0);
    try {
      this.setMessage("Erasing userdata");
      await this.device.runCommand("erase:userdata");
      this.setProgress(0.9);

      this.setMessage("Rebooting");
      await this.device.runCommand("continue");
      this.setProgress(1);
      this.setConnected(false);
    } catch (err) {
      console.error("[fastboot] Erase error", err);
      this.setError(FastbootError.ERASE_FAILED);
    }
  }
}

export type FastbootManagerStateType = {
  step: FastbootStep;
  message: string;
  progress: number;
  error: FastbootError;
  connected: boolean;
  serial: string | null;
  onContinue?: () => void;
};

export enum FastbootStep {
  INITIALIZING = 0,
  READY,
  CONNECTING,
  DOWNLOADING,
  UNPACKING,
  FLASHING,
  ERASING,
  DONE,
}

export enum FastbootError {
  UNKNOWN = -1,
  NONE,
  UNRECOGNIZED_DEVICE,
  LOST_CONNECTION,
  DOWNLOAD_FAILED,
  UNPACK_FAILED,
  CHECKSUM_MISMATCH,
  FLASH_FAILED,
  ERASE_FAILED,
  REQUIREMENTS_NOT_MET,
}

function isRecognizedDevice(deviceInfo: Record<string, string | number>) {
  // check some variables are as expected for a comma three
  const {
    kernel,
    "max-download-size": maxDownloadSize,
    "slot-count": slotCount,
  } = deviceInfo;
  if (
    kernel !== "uefi" ||
    maxDownloadSize !== "104857600" ||
    slotCount !== "2"
  ) {
    console.error(
      "[fastboot] Unrecognised device (kernel, maxDownloadSize or slotCount)",
      deviceInfo,
    );
    return false;
  }

  const partitions: string[] = [];
  for (const key of Object.keys(deviceInfo)) {
    if (!key.startsWith("partition-type:")) continue;
    let partition = key.substring("partition-type:".length);
    if (partition.endsWith("_a") || partition.endsWith("_b")) {
      partition = partition.substring(0, partition.length - 2);
    }
    if (partitions.includes(partition)) continue;
    partitions.push(partition);
  }

  // check we have the expected partitions to make sure it's a comma three
  const expectedPartitions = [
    "ALIGN_TO_128K_1",
    "ALIGN_TO_128K_2",
    "ImageFv",
    "abl",
    "aop",
    "apdp",
    "bluetooth",
    "boot",
    "cache",
    "cdt",
    "cmnlib",
    "cmnlib64",
    "ddr",
    "devcfg",
    "devinfo",
    "dip",
    "dsp",
    "fdemeta",
    "frp",
    "fsc",
    "fsg",
    "hyp",
    "keymaster",
    "keystore",
    "limits",
    "logdump",
    "logfs",
    "mdtp",
    "mdtpsecapp",
    "misc",
    "modem",
    "modemst1",
    "modemst2",
    "msadp",
    "persist",
    "qupfw",
    "rawdump",
    "sec",
    "splash",
    "spunvm",
    "ssd",
    "sti",
    "storsec",
    "system",
    "systemrw",
    "toolsfv",
    "tz",
    "userdata",
    "vm-linux",
    "vm-system",
    "xbl",
    "xbl_config",
  ];
  if (
    !partitions.every((partition) => expectedPartitions.includes(partition))
  ) {
    console.error("[fastboot] Unrecognised device (partitions)", partitions);
    return false;
  }

  // sanity check, also useful for logging
  if (!deviceInfo["serialno"]) {
    console.error(
      "[fastboot] Unrecognised device (missing serialno)",
      deviceInfo,
    );
    return false;
  }

  return true;
}
