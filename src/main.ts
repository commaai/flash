import {
  FastbootError,
  FastbootManager,
  FastbootManagerStateType,
  FastbootStep,
} from "./utils/fastboot";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";

const fb = new FastbootManager();
fb.init();

function setupProgressIndicatorView(initialState: FastbootManagerStateType) {
  renderProgressIndicator(initialState);
  fb.on("progress", renderProgressIndicator);
}

function setupStatusView(initialState: FastbootManagerStateType) {
  renderStatusView(initialState);
  fb.on("message", renderStatusView);
  fb.on("step", renderStatusView);
  fb.on("error", renderStatusView);
}

function setupIconView(initialState: FastbootManagerStateType) {
  renderIconView(initialState);
  fb.on("step", renderIconView);
  fb.on("error", renderIconView);
}

function setupRetryButtonView(initialState: FastbootManagerStateType) {
  renderRetryButtonView(initialState);
  fb.on("error", renderRetryButtonView);
}

function setupDeviceStatusView(initialState: FastbootManagerStateType) {
  renderDeviceStateView(initialState);
  fb.on("connected", renderDeviceStateView);
  fb.on("serial", renderDeviceStateView);
}

function renderProgressIndicator(state: FastbootManagerStateType) {
  const el = document.getElementById("linear-progress")!;
  const ctnEl = document.getElementById("linear-progress-ctn")!;

  const { progress, step } = state;
  el.style.transform = `translateX(${progress - 100}%)`;
  el.className = `absolute top-0 bottom-0 left-0 w-full transition-all ${fbSteps[step].bgColor}`;
  ctnEl.style.opacity = progress === -1 ? "0" : "1";
}

function renderStatusView(state: FastbootManagerStateType) {
  const el = document.getElementById("title")!;
  const subtitleEl = document.getElementById("subtitle")!;

  const { message, error, progress, step } = state;
  let title;
  if (message && !error) {
    title = message + "...";
    if (progress >= 0) {
      title += ` (${(progress * 100).toFixed(0)}%)`;
    }
  } else {
    title = fbSteps[step].status;
  }
  el.innerHTML = title;
  subtitleEl.innerHTML = fbSteps[step].description ?? "";
}

function renderIconView(state: FastbootManagerStateType) {
  const el = document.getElementById("icon-ctn")!;
  const img = el.getElementsByTagName("img")[0];
  const { step, error, onContinue } = state;
  el.className = `p-8 rounded-full ${fbSteps[step].bgColor}`;
  if (onContinue) {
    el.style.cursor = "pointer";
    el.addEventListener("click", onContinue);
  }
  img.src = fbSteps[step].icon;
  img.className = `${!error && step !== FastbootStep.DONE ? "animate-pulse" : ""}`;
}

function renderRetryButtonView(state: FastbootManagerStateType) {
  const { error } = state;
  if (error !== FastbootError.NONE) {
    const el = document.getElementById("subtitle")!;
    el.insertAdjacentHTML(
      "afterend",
      `
      <button
        id="retry-btn"
        class="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
      >
        Retry
      </button>
      `,
    );
    const retryButton = document.getElementById("retry-btn")!;
    retryButton.addEventListener("click", retryFlashing);
  } else {
    const retryButton = document.getElementById("retry-btn");
    if (retryButton) {
      retryButton.removeEventListener("click", retryFlashing);
      retryButton.remove();
    }
  }
}

function renderDeviceStateView(state: FastbootManagerStateType) {
  const { serial, connected } = state;
  if (!connected) {
    const deviceStateEl = document.getElementById("device-state");
    if (!deviceStateEl) return;
    deviceStateEl.remove();
    return;
  }

  let el: Element;
  const retryButton = document.getElementById("retry-btn");
  if (retryButton) el = retryButton;
  else el = document.getElementById("subtitle")!;
  el.insertAdjacentHTML(
    "afterend",
    `
    <div
      id="device-state"
      class="absolute bottom-0 m-0 lg:m-4 p-4 w-full sm:w-auto sm:min-w-[350px] sm:border sm:border-gray-200 dark:sm:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-md flex flex-row gap-2"
      style="left:50%;transform:translate(-50%, -50%)"
    >
    <div class="flex flex-row gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 96 960 960"
        class="text-green-500 dark:text-[#51ff00]"
        height="24"
        width="24"
      >
        <path
          fill="currentColor"
          d="M480 976q-32 0-52-20t-20-52q0-22 11-40t31-29V724H302q-24 0-42-18t-18-42V555q-20-9-31-26.609-11-17.608-11-40.108Q200 456 220 436t52-20q32 0 52 20t20 52.411Q344 511 333 528.5T302 555v109h148V324h-80l110-149 110 149h-80v340h148V560h-42V416h144v144h-42v104q0 24-18 42t-42 18H510v111q19.95 10.652 30.975 29.826Q552 884 552 904q0 32-20 52t-52 20Z"
        />
      </svg>
      Device connected
    </div>
      <span class="text-gray-400">|</span>
      <div class="flex flex-row gap-2">
        <span>
          Serial:
          <span class="ml-2 font-mono">${serial || "unknown"}</span>
        </span>
      </div>
    </div>
    `,
  );
}

function retryFlashing() {
  console.debug("[fastboot] on retry");
  window.location.reload();
}

const fbSteps: Record<
  FastbootStep,
  { status: string; bgColor: string; icon: string; description?: string }
> = {
  [FastbootStep.INITIALIZING]: {
    status: "Initializing...",
    bgColor: "bg-gray-400 dark:bg-gray-700",
    icon: "assets/cloud.svg",
  },
  [FastbootStep.READY]: {
    status: "Ready",
    description: "Tap the button above to begin",
    bgColor: "bg-[#51ff00]",
    icon: "assets/bolt.svg",
  },
  [FastbootStep.CONNECTING]: {
    status: "Waiting for connection",
    description:
      "Follow the instructions to connect your device to your computer",
    bgColor: "bg-yellow-500",
    icon: "assets/cable.svg",
  },
  [FastbootStep.DOWNLOADING]: {
    status: "Downloading...",
    bgColor: "bg-blue-500",
    icon: "assets/cloud_download.svg",
  },
  [FastbootStep.UNPACKING]: {
    status: "Unpacking...",
    bgColor: "bg-blue-500",
    icon: "assets/cloud_download.svg",
  },
  [FastbootStep.FLASHING]: {
    status: "Flashing device...",
    description: "Do not unplug your device until the process is complete.",
    bgColor: "bg-lime-400",
    icon: "assets/system_update_c3.svg",
  },
  [FastbootStep.ERASING]: {
    status: "Erasing device...",
    bgColor: "bg-lime-400",
    icon: "assets/system_update_c3.svg",
  },
  [FastbootStep.DONE]: {
    status: "Done",
    description:
      "Your device has been updated successfully. You can now unplug the USB cable from your computer. To " +
      "complete the system reset, follow the instructions on your device.",
    bgColor: "bg-green-500",
    icon: "assets/done.svg",
  },
};

setupProgressIndicatorView(fb.state);
setupIconView(fb.state);
setupStatusView(fb.state);
setupDeviceStatusView(fb.state);
setupRetryButtonView(fb.state);
