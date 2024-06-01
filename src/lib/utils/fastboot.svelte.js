import { FastbootDevice, setDebugLevel } from "android-fastboot";
import * as Comlink from "comlink";
import Plausible from 'plausible-tracker';
import config from "$lib/utils/config";
import { download } from "$lib/utils/blob";
import { useImageWorker } from "$lib/utils/image";
import { createManifest } from "$lib/utils/manifest";
import { withProgress } from "$lib/utils/progress";
/**
 * @typedef {import('./manifest.js').Image} Image
 */

// Verbose logging for fastboot
setDebugLevel(2);

export const Step = {
  INITIALIZING: 0,
  READY: 1,
  CONNECTING: 2,
  DOWNLOADING: 3,
  UNPACKING: 4,
  FLASHING: 6,
  ERASING: 7,
  DONE: 8,
};

export const Error = {
  UNKNOWN: -1,
  NONE: 0,
  UNRECOGNIZED_DEVICE: 1,
  LOST_CONNECTION: 2,
  DOWNLOAD_FAILED: 3,
  UNPACK_FAILED: 4,
  CHECKSUM_MISMATCH: 5,
  FLASH_FAILED: 6,
  ERASE_FAILED: 7,
  REQUIREMENTS_NOT_MET: 8,
};

function isRecognizedDevice(deviceInfo) {
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

  const partitions = [];
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
let step = $state({ value: Step.INITIALIZING });
let message = $state({ value: "" });
let progress = $state({ value: 0 });
let error = $state({ value: Error.NONE });

let connected = $state({ value: false });
let serial = $state({ value: null });

let onContinue = $state({ value: null });
let onRetry = $state({ value: null });
let fastboot = $state({ value: new FastbootDevice() });

let manifest = $state({ value: null });
let trackEvent = $state(null);
export function useFastboot() {
  $effect(() => {
    trackEvent = Plausible({ domain: 'flash.comma.ai' }).trackEvent;
    const imageWorker = useImageWorker();
    progress.value = -1;
    message.value = "";

    if (error.value) return;
    if (!imageWorker) {
      console.debug("[fastboot] Waiting for image worker");
      return;
    }
    switch (step.value) {
      case Step.INITIALIZING: {
        // Check that the browser supports WebUSB
        if (typeof navigator.usb === "undefined") {
          console.error("[fastboot] WebUSB not supported");
          error.value = Error.REQUIREMENTS_NOT_MET;
          break;
        }

        // Check that the browser supports Web Workers
        if (typeof Worker === "undefined") {
          console.error("[fastboot] Web Workers not supported");
          error.value = Error.REQUIREMENTS_NOT_MET;
          break;
        }

        // Check that the browser supports Storage API
        if (typeof Storage === "undefined") {
          console.error("[fastboot] Storage API not supported");
          error.value = Error.REQUIREMENTS_NOT_MET;
          break;
        }

        // TODO: change manifest.value once alt image is in release
        imageWorker
          ?.init()
          .then(() => download(config.manifests["master"]))
          .then((blob) => blob.text())
          .then((text) => {
            manifest.value = createManifest(text);

            // sanity check
            if (manifest.value.length === 0) {
              throw "Manifest is empty";
            }

            console.debug("[fastboot] Loaded manifest", manifest.value);
            step.value = Step.READY;
          })
          .catch((err) => {
            console.error("[fastboot] Initialization error", err);
            error.value = Error.UNKNOWN;
          });
        break;
      }

      case Step.READY: {
        // wait for user interaction (we can't use WebUSB without user event)
        onContinue.value = () => {
          onContinue.value = null;
          step.value = Step.CONNECTING;
        };
        break;
      }

      case Step.CONNECTING: {
        fastboot.value
          .waitForConnect()
          .then(() => {
            console.info("[fastboot] Connected", {
              fastboot: fastboot.value,
            });
            return fastboot.value
              .getVariable("all")
              .then((all) => {
                const deviceInfo = all.split("\n").reduce((obj, line) => {
                  const parts = line.split(":");
                  const key = parts.slice(0, -1).join(":").trim();
                  obj[key] = parts.slice(-1)[0].trim();
                  return obj;
                }, {});

                const recognized = isRecognizedDevice(deviceInfo);
                console.debug("[fastboot] Device info", {
                  recognized,
                  deviceInfo,
                });

                if (!recognized) {
                  error.value = Error.UNRECOGNIZED_DEVICE;
                  return;
                }
                serial.value = deviceInfo["serialno"] || "unknown";
                connected.value = true;
                trackEvent('device-connected');
                step.value = Step.DOWNLOADING;
              })
              .catch((err) => {
                console.error(
                  "[fastboot] Error getting device information",
                  err,
                );
                error.value = Error.UNKNOWN;
              });
          })
          .catch((err) => {
            console.error("[fastboot] Connection lost", err);
            error.value = Error.LOST_CONNECTION;
            connected.value = false;
          });

        fastboot.value.connect().catch((err) => {
          console.error("[fastboot] Connection error", err);
          step.value = Step.READY;
        });
        break;
      }

      case Step.DOWNLOADING: {
        progress.value = 0;

        async function downloadImages() {
          for await (const [image, onProgress] of withProgress(
            manifest,
            progress,
          )) {
            message.value = `Downloading ${image.name}`;
            await imageWorker.downloadImage(image, Comlink.proxy(onProgress));
          }
        }

        downloadImages()
          .then(() => {
            console.debug("[fastboot] Downloaded all images");
            step.value = Step.UNPACKING;
          })
          .catch((err) => {
            console.error("[fastboot] Download error", err);
            error.value = Error.DOWNLOAD_FAILED;
          });
        break;
      }

      case Step.UNPACKING: {
        progress.value = 0;

        async function unpackImages() {
          for await (const [image, onProgress] of withProgress(
            manifest,
            progress,
          )) {
            message.value = `Unpacking ${image.name}`;
            await imageWorker.unpackImage(image, Comlink.proxy(onProgress));
          }
        }

        unpackImages()
          .then(() => {
            console.debug("[fastboot] Unpacked all images");
            step.value = Step.FLASHING;
          })
          .catch((err) => {
            console.error("[fastboot] Unpack error", err);
            if (err.startsWith("Checksum mismatch")) {
              error.value = Error.CHECKSUM_MISMATCH;
            } else {
              error.value = Error.UNPACK_FAILED;
            }
          });
        break;
      }

      case Step.FLASHING: {
        progress.value = 0;

        async function flashDevice() {
          const currentSlot = await fastboot.value.getVariable("current-slot");
          if (!["a", "b"].includes(currentSlot)) {
            throw `Unknown current slot ${currentSlot}`;
          }

          for await (const [image, onProgress] of withProgress(
            manifest,
            progress,
          )) {
            const fileHandle = await imageWorker.getImage(image);
            const blob = await fileHandle.getFile();

            if (image.sparse) {
              message.value = `Erasing ${image.name}`;
              await fastboot.value.runCommand(`erase:${image.name}`);
            }
            message.value = `Flashing ${image.name}`;
            await fastboot.value.flashBlob(image.name, blob, onProgress, "other");
          }
          console.debug("[fastboot] Flashed all partitions");

          const otherSlot = currentSlot === "a" ? "b" : "a";
          message.value = `Changing slot to ${otherSlot}`;
          await fastboot.value.runCommand(`set_active:${otherSlot}`);
        }

        flashDevice()
          .then(() => {
            console.debug("[fastboot] Flash complete");
            step.value = Step.ERASING;
          })
          .catch((err) => {
            console.error("[fastboot] Flashing error", err);
            error.value = Error.FLASH_FAILED;
          });
        break;
      }

      case Step.ERASING: {
        progress.value = 0;

        async function eraseDevice() {
          message.value = "Erasing userdata";
          await fastboot.value.runCommand("erase:userdata");
          progress.value = 0.9;

          message.value = "Rebooting";
          await fastboot.value.runCommand("continue");
          progress.value = 1;
          connected.value = false;
        }

        eraseDevice()
          .then(() => {
            console.debug("[fastboot] Erase complete");
            step.value = Step.DONE;
            trackEvent('completed');
          })
          .catch((err) => {
            console.error("[fastboot] Erase error", err);
            error.value = Error.ERASE_FAILED;
          });
        break;
      }
    }
  });
  $effect(() => {
    if (error.value !== Error.NONE) {
      console.debug("[fastboot] error", error.value);
      trackEvent('error', { props: { error: error.value } });
      progress.value = -1;
      onContinue.value = null;
      onRetry.value = () => {
        console.debug("[fastboot] on retry");
        window.location.reload();
      };
    }
  });
}
export {
  step,
  message,
  progress,
  error,
  onContinue,
  onRetry,
  connected,
  serial,
};
