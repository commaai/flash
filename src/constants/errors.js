import exclamation from "@/assets/exclamation.svg";
import deviceQuestion from "@/assets/device_question_c3.svg";
import cable from "@/assets/cable.svg";
import cloudError from "@/assets/cloud_error.svg";
import frameAlert from "@/assets/frame_alert.svg";
import deviceExclamation from "@/assets/device_exclamation_c3.svg";
import { Error } from "@/utils/flash";

export const errors = {
  [Error.UNKNOWN]: {
    status: "Unknown error",
    description:
      "An unknown error has occurred. Unplug your device and wait for 20s. " +
      "Restart your browser and try again.",
    bgColor: "bg-red-500",
    icon: exclamation,
  },
  [Error.UNRECOGNIZED_DEVICE]: {
    status: "Unrecognized device",
    description: "The device connected to your computer is not supported.",
    bgColor: "bg-yellow-500",
    icon: deviceQuestion,
  },
  [Error.LOST_CONNECTION]: {
    status: "Lost connection",
    description:
      "The connection to your device was lost. Check that your cables are connected properly and try again. " +
      "Unplug your device and wait for around 20s.",
    icon: cable,
  },
  [Error.DOWNLOAD_FAILED]: {
    status: "Download failed",
    description:
      "The system image could not be downloaded. Unplug your device and wait for 20s. " +
      "Check your internet connection and try again.",
    icon: cloudError,
  },
  [Error.CHECKSUM_MISMATCH]: {
    status: "Download mismatch",
    description:
      "The system image downloaded does not match the expected checksum. Try again.",
    icon: frameAlert,
  },
  [Error.FLASH_FAILED]: {
    status: "Flash failed",
    description:
      "The system image could not be flashed to your device. Try using a different cable, USB port, or " +
      "computer. If the problem persists, join the #hw-three-3x channel on Discord for help.",
    icon: deviceExclamation,
  },
  [Error.ERASE_FAILED]: {
    status: "Erase failed",
    description:
      "The device could not be erased. Try using a different cable, USB port, or computer. If the problem " +
      "persists, join the #hw-three-3x channel on Discord for help.",
    icon: deviceExclamation,
  },
  [Error.REQUIREMENTS_NOT_MET]: {
    status: "Requirements not met",
    description:
      "Your system does not meet the requirements to flash your device. Make sure to use a browser which " +
      "supports WebUSB and is up to date.",
  },
};
