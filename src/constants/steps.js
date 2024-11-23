import bolt from "@/assets/bolt.svg";
import cable from "@/assets/cable.svg";
import cloud from "@/assets/cloud.svg";
import cloudDownload from "@/assets/cloud_download.svg";
import systemUpdate from "@/assets/system_update_c3.svg";
import done from "@/assets/done.svg";
import { Step } from "@/utils/flash";

export const steps = {
  [Step.INITIALIZING]: {
    status: "Initializing...",
    bgColor: "bg-gray-400 dark:bg-gray-700",
    icon: cloud,
  },
  [Step.READY]: {
    status: "Ready",
    description: "Tap the button above to begin",
    bgColor: "bg-[#51ff00]",
    icon: bolt,
    iconStyle: "",
  },
  [Step.CONNECTING]: {
    status: "Waiting for connection",
    description:
      "Follow the instructions to connect your device to your computer",
    bgColor: "bg-yellow-500",
    icon: cable,
  },
  [Step.DOWNLOADING]: {
    status: "Downloading...",
    bgColor: "bg-blue-500",
    icon: cloudDownload,
  },
  [Step.UNPACKING]: {
    status: "Unpacking...",
    bgColor: "bg-blue-500",
    icon: cloudDownload,
  },
  [Step.FLASHING]: {
    status: "Flashing device...",
    description: "Do not unplug your device until the process is complete.",
    bgColor: "bg-lime-400",
    icon: systemUpdate,
  },
  [Step.ERASING]: {
    status: "Erasing device...",
    bgColor: "bg-lime-400",
    icon: systemUpdate,
  },
  [Step.DONE]: {
    status: "Done",
    description:
      "Your device has been updated successfully. You can now unplug the all cables from your device, and wait for the light to stop blinking then plug the power cord in again. To complete the system reset, follow the instructions on your device.",
    bgColor: "bg-green-500",
    icon: done,
  },
};
