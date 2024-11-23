import { createSignal, createEffect } from "solid-js";
import { concatUint8Array } from "@/QDL/utils";
import { qdlDevice } from "@/QDL/qdl";
import * as Comlink from "comlink";
import config from "@/config";
import { download } from "@/utils/blob";
import { useImageWorker } from "@/utils/image";
import { createManifest } from "@/utils/manifest";
import { withProgress } from "@/utils/progress";

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

function isRecognizedDevice(slotCount, partitions) {
  if (slotCount !== 2) {
    console.error("[QDL] Unrecognised device (slotCount)");
    return false;
  }

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
    console.error("[QDL] Unrecognised device (partitions)", partitions);
    return false;
  }
  return true;
}

export function useQdl() {
  const [step, setStep] = createSignal(Step.INITIALIZING);
  const [message, setMessage] = createSignal("");
  const [progress, setProgress] = createSignal(0);
  const [error, setError] = createSignal(Error.NONE);
  const [connected, setConnected] = createSignal(false);
  const [serial, setSerial] = createSignal(null);
  const [onContinue, setOnContinue] = createSignal(null);
  const [onRetry, setOnRetry] = createSignal(null);

  const imageWorker = useImageWorker();
  const qdl = new qdlDevice();
  let manifest = null;

  const updateMessage = (msg = "") => {
    if (msg) console.info("[QDL]", msg);
    setMessage(msg);
  };

  createEffect(() => {
    setProgress(-1);
    updateMessage();

    if (error()) return;
    if (!imageWorker) return;

    switch (step()) {
      case Step.INITIALIZING: {
        if (
          typeof navigator.usb === "undefined" ||
          typeof Worker === "undefined" ||
          typeof Storage === "undefined"
        ) {
          console.error("[QDL] Requirements not met");
          setError(Error.REQUIREMENTS_NOT_MET);
          break;
        }

        imageWorker
          .init()
          .then(() => download(config.manifests["release"]))
          .then((blob) => blob.text())
          .then((text) => {
            manifest = createManifest(text);
            if (manifest.length === 0) throw "Manifest is empty";
            console.debug("[QDL] Loaded manifest", manifest);
            setStep(Step.READY);
          })
          .catch((err) => {
            console.error("[QDL] Initialization error", err);
            setError(Error.UNKNOWN);
          });
        break;
      }

      case Step.READY: {
        setOnContinue(() => () => {
          setOnContinue(null);
          setStep(Step.CONNECTING);
        });
        break;
      }

      case Step.CONNECTING: {
        qdl
          .waitForConnect()
          .then(() => {
            console.info("[QDL] Connected");
            return qdl
              .getDevicePartitionsInfo()
              .then(([slotCount, partitions]) => {
                const recognized = isRecognizedDevice(slotCount, partitions);
                if (!recognized) {
                  setError(Error.UNRECOGNIZED_DEVICE);
                  return;
                }
                setSerial(qdl.sahara.serial || "unknown");
                setConnected(true);
                setStep(Step.DOWNLOADING);
              });
          })
          .catch((err) => {
            console.error("[QDL] Connection error", err);
            setError(Error.LOST_CONNECTION);
            setConnected(false);
          });
        qdl.connect().catch(() => setStep(Step.READY));
        break;
      }

      case Step.DOWNLOADING: {
        setProgress(0);
        async function downloadImages() {
          for await (const [image, onProgress] of withProgress(
            manifest,
            setProgress,
          )) {
            updateMessage(`Downloading ${image.name}`);
            await imageWorker.downloadImage(image, Comlink.proxy(onProgress));
          }
        }

        downloadImages()
          .then(() => setStep(Step.UNPACKING))
          .catch((err) => {
            console.error("[QDL] Download error", err);
            setError(Error.DOWNLOAD_FAILED);
          });
        break;
      }

      case Step.UNPACKING: {
        setProgress(0);
        async function unpackImages() {
          for await (const [image, onProgress] of withProgress(
            manifest,
            setProgress,
          )) {
            updateMessage(`Unpacking ${image.name}`);
            await imageWorker.unpackImage(image, Comlink.proxy(onProgress));
          }
        }

        unpackImages()
          .then(() => setStep(Step.FLASHING))
          .catch((err) => {
            console.error("[QDL] Unpack error", err);
            setError(
              err.startsWith("Checksum mismatch")
                ? Error.CHECKSUM_MISMATCH
                : Error.UNPACK_FAILED,
            );
          });
        break;
      }

      case Step.FLASHING: {
        setProgress(0);
        async function flashDevice() {
          const currentSlot = await qdl.getActiveSlot();
          if (!["a", "b"].includes(currentSlot))
            throw `Unknown current slot ${currentSlot}`;
          const otherSlot = currentSlot === "a" ? "b" : "a";

          await qdl.erase("xbl" + `_${currentSlot}`);

          for await (const [image, onProgress] of withProgress(
            manifest,
            setProgress,
          )) {
            const fileHandle = await imageWorker.getImage(image);
            const blob = await fileHandle.getFile();
            updateMessage(`Flashing ${image.name}`);
            await qdl.flashBlob(image.name + `_${otherSlot}`, blob, onProgress);
          }

          updateMessage(`Changing slot to ${otherSlot}`);
          await qdl.setActiveSlot(otherSlot);
        }

        flashDevice()
          .then(() => setStep(Step.ERASING))
          .catch((err) => {
            console.error("[QDL] Flashing error", err);
            setError(Error.FLASH_FAILED);
          });
        break;
      }

      case Step.ERASING: {
        setProgress(0);
        async function eraseDevice() {
          updateMessage("Erasing userdata");
          let wData = new TextEncoder().encode("COMMA_RESET");
          wData = new Blob([
            concatUint8Array([
              wData,
              new Uint8Array(28 - wData.length).fill(0),
            ]),
          ]);
          await qdl.flashBlob("userdata", wData);
          setProgress(0.9);

          updateMessage("Rebooting");
          await qdl.reset();
          setProgress(1);
          setConnected(false);
        }

        eraseDevice()
          .then(() => setStep(Step.DONE))
          .catch((err) => {
            console.error("[QDL] Erase error", err);
            setError(Error.ERASE_FAILED);
          });
        break;
      }
    }
  });

  createEffect(() => {
    if (error() !== Error.NONE) {
      setProgress(-1);
      setOnContinue(null);
      setOnRetry(() => () => window.location.reload());
    }
  });

  return {
    step: step,
    message: message,
    progress: progress,
    error: error,
    connected: connected,
    serial: serial,
    onContinue: onContinue,
    onRetry: onRetry,
  };
}
