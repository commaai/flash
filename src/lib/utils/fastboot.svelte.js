import { FastbootDevice, setDebugLevel } from "android-fastboot";
import * as Comlink from "comlink";
//import { usePlausible } from 'next-plausible'

import config from "$lib/utils/config";
import { download } from "$lib/utils/blob";
import { useImageWorker } from "$lib/utils/image";
import { createManifest } from "$lib/utils/manifest";
import { withProgress } from "$lib/utils/progress";
/**
 * @typedef {import('./_manifest.js').Image} Image
 */

// Verbose logging for _fastboot
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
      "[_fastboot] Unrecognised device (kernel, maxDownloadSize or slotCount)",
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
    console.error("[_fastboot] Unrecognised device (partitions)", partitions);
    return false;
  }

  // sanity check, also useful for logging
  if (!deviceInfo["serialno"]) {
    console.error(
      "[_fastboot] Unrecognised device (missing serialno)",
      deviceInfo,
    );
    return false;
  }

  return true;
}
let _step = $state(Step.INITIALIZING);
let _message = $state("");
let _progress = $state(0);
let _error = $state(Error.NONE);

let _connected = $state(false);
let _serial = $state(null);

let _onContinue = $state(null);
let _onRetry = $state(null);
let _fastboot = $state(new FastbootDevice());

let _manifest = $state(null);
//const plausible = usePlausible()
export function useFastboot() {
  $effect(() => {
    const imageWorker = useImageWorker();
    _progress = -1;
    _message = "";

    if (_error) return;
    if (!imageWorker) {
      console.debug("[_fastboot] Waiting for image worker");
      return;
    }
    switch (_step) {
      case Step.INITIALIZING: {
        // Check that the browser supports WebUSB
        if (typeof navigator.usb === "undefined") {
          console.error("[_fastboot] WebUSB not supported");
          _error = Error.REQUIREMENTS_NOT_MET;
          break;
        }

        // Check that the browser supports Web Workers
        if (typeof Worker === "undefined") {
          console.error("[_fastboot] Web Workers not supported");
          _error = Error.REQUIREMENTS_NOT_MET;
          break;
        }

        // Check that the browser supports Storage API
        if (typeof Storage === "undefined") {
          console.error("[_fastboot] Storage API not supported");
          _error = Error.REQUIREMENTS_NOT_MET;
          break;
        }

        // TODO: change _manifest once alt image is in release
        imageWorker
          ?.init()
          .then(() => download(config.manifests["master"]))
          .then((blob) => blob.text())
          .then((text) => {
            _manifest = createManifest(text);

            // sanity check
            if (_manifest.length === 0) {
              throw "Manifest is empty";
            }

            console.debug("[_fastboot] Loaded _manifest", _manifest);
            _step = Step.READY;
          })
          .catch((err) => {
            console.error("[_fastboot] Initialization _error", err);
            _error = Error.UNKNOWN;
          });
        break;
      }

      case Step.READY: {
        // wait for user interaction (we can't use WebUSB without user event)
        _onContinue = () => {
          _onContinue = null;
          _step = Step.CONNECTING;
        };
        break;
      }

      case Step.CONNECTING: {
        _fastboot
          .waitForConnect()
          .then(() => {
            console.info("[_fastboot] Connected", {
              _fastboot: _fastboot.current,
            });
            return _fastboot
              .getVariable("all")
              .then((all) => {
                const deviceInfo = all.split("\n").reduce((obj, line) => {
                  const parts = line.split(":");
                  const key = parts.slice(0, -1).join(":").trim();
                  obj[key] = parts.slice(-1)[0].trim();
                  return obj;
                }, {});

                const recognized = isRecognizedDevice(deviceInfo);
                console.debug("[_fastboot] Device info", {
                  recognized,
                  deviceInfo,
                });

                if (!recognized) {
                  _error = Error.UNRECOGNIZED_DEVICE;
                  return;
                }

                _serial = deviceInfo["serialno"] || "unknown";
                _connected = true;
                //plausible('device-_connected')
                _step = Step.DOWNLOADING;
              })
              .catch((err) => {
                console.error(
                  "[_fastboot] Error getting device information",
                  err,
                );
                _error = Error.UNKNOWN;
              });
          })
          .catch((err) => {
            console.error("[_fastboot] Connection lost", err);
            _error = Error.LOST_CONNECTION;
            _connected = false;
          });

        _fastboot.connect().catch((err) => {
          console.error("[_fastboot] Connection _error", err);
          _step = Step.READY;
        });
        break;
      }

      case Step.DOWNLOADING: {
        _progress = 0;

        async function downloadImages() {
          for await (const [image, onProgress] of withProgress(
            _manifest,
            _progress,
          )) {
            _message = `Downloading ${image.name}`;
            await imageWorker.downloadImage(image, Comlink.proxy(onProgress));
          }
        }

        downloadImages()
          .then(() => {
            console.debug("[_fastboot] Downloaded all images");
            _step = Step.UNPACKING;
          })
          .catch((err) => {
            console.error("[_fastboot] Download _error", err);
            _error = Error.DOWNLOAD_FAILED;
          });
        break;
      }

      case Step.UNPACKING: {
        _progress = 0;

        async function unpackImages() {
          for await (const [image, onProgress] of withProgress(
            _manifest,
            _progress,
          )) {
            _message = `Unpacking ${image.name}`;
            await imageWorker.unpackImage(image, Comlink.proxy(onProgress));
          }
        }

        unpackImages()
          .then(() => {
            console.debug("[_fastboot] Unpacked all images");
            _step = Step.FLASHING;
          })
          .catch((err) => {
            console.error("[_fastboot] Unpack _error", err);
            if (err.startsWith("Checksum mismatch")) {
              _error = Error.CHECKSUM_MISMATCH;
            } else {
              _error = Error.UNPACK_FAILED;
            }
          });
        break;
      }

      case Step.FLASHING: {
        _progress = 0;

        async function flashDevice() {
          const currentSlot = await _fastboot.getVariable("current-slot");
          if (!["a", "b"].includes(currentSlot)) {
            throw `Unknown current slot ${currentSlot}`;
          }

          for await (const [image, onProgress] of withProgress(
            _manifest,
            _progress,
          )) {
            const fileHandle = await imageWorker.getImage(image);
            const blob = await fileHandle.getFile();

            if (image.sparse) {
              _message = `Erasing ${image.name}`;
              await _fastboot.runCommand(`erase:${image.name}`);
            }
            _message = `Flashing ${image.name}`;
            await _fastboot.flashBlob(image.name, blob, onProgress, "other");
          }
          console.debug("[_fastboot] Flashed all partitions");

          const otherSlot = currentSlot === "a" ? "b" : "a";
          _message = `Changing slot to ${otherSlot}`;
          await _fastboot.runCommand(`set_active:${otherSlot}`);
        }

        flashDevice()
          .then(() => {
            console.debug("[_fastboot] Flash complete");
            _step = Step.ERASING;
          })
          .catch((err) => {
            console.error("[_fastboot] Flashing _error", err);
            _error = Error.FLASH_FAILED;
          });
        break;
      }

      case Step.ERASING: {
        _progress = 0;

        async function eraseDevice() {
          _message = "Erasing userdata";
          await _fastboot.runCommand("erase:userdata");
          _progress = 0.9;

          _message = "Rebooting";
          await _fastboot.runCommand("continue");
          _progress = 1;
          _connected = false;
        }

        eraseDevice()
          .then(() => {
            console.debug("[_fastboot] Erase complete");
            _step = Step.DONE;
            //plausible('completed')
          })
          .catch((err) => {
            console.error("[_fastboot] Erase _error", err);
            _error = Error.ERASE_FAILED;
          });
        break;
      }
    }
    if (_error !== Error.NONE) {
      console.debug("[_fastboot] _error", _error);
      //plausible('_error', { props: { _error }})
      _progress = -1;
      _onContinue = null;

      _onRetry = () => {
        console.debug("[_fastboot] on retry");
        window.location.reload();
      };
    }
  });
}

const step = {
  get value() {
    return _step;
  },
  set value(v) {
    _step = v;
  },
};
const message = {
  get value() {
    return _message;
  },
  set value(v) {
    _message = v;
  },
};
const progress = {
  get value() {
    return _progress;
  },
  set value(v) {
    _progress = v;
  },
};
const error = {
  get value() {
    return _error;
  },
  set value(v) {
    _error = v;
  },
};
const onContinue = {
  get value() {
    return _onContinue;
  },
  set value(v) {
    _onContinue = v;
  },
};
const onRetry = {
  get value() {
    return _onRetry;
  },
  set value(v) {
    _onRetry = v;
  },
};
const connected = {
  get value() {
    return _connected;
  },
  set value(v) {
    _connected = v;
  },
};
const serial = {
  get value() {
    return _serial;
  },
  set value(v) {
    _serial = v;
  },
};
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
