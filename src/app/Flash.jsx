import {
  createSignal,
  onCleanup,
  createEffect,
  createMemo,
  Show,
} from "solid-js";

import { Step, Error, useQdl } from "@/utils/flash";
import { errors } from "../constants/errors";
import { steps } from "../constants/steps";

const detachScript = [
  'for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done',
];

const isLinux = navigator.userAgent.toLowerCase().includes("linux");

function LinearProgress(props) {
  let value = props.value;
  if (value === -1 || value > 100) value = 100;
  return (
    <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`absolute top-0 bottom-0 left-0 w-full transition-all ${props.barColor}`}
        style={{ transform: `translateX(${value - 100}%)` }}
      />
    </div>
  );
}

function USBIndicator() {
  return (
    <div className="flex flex-row gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 96 960 960"
        className="text-green-500 dark:text-[#51ff00]"
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
  );
}

function SerialIndicator(props) {
  return (
    <div className="flex flex-row gap-2">
      <span>
        Serial:
        <span className="ml-2 font-mono">{props.serial() || "unknown"}</span>
      </span>
    </div>
  );
}

function DeviceState(props) {
  return (
    <div
      className="absolute bottom-0 m-0 lg:m-4 p-4 w-full sm:w-auto sm:min-w-[350px] sm:border sm:border-gray-200 dark:sm:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white rounded-md flex flex-row gap-2"
      style={{ left: "50%", transform: "translate(-50%, -50%)" }}
    >
      <USBIndicator />
      <span className="text-gray-400">|</span>
      <SerialIndicator serial={props.serial} />
    </div>
  );
}

function beforeUnloadListener(event) {
  event.preventDefault();
  return (event.returnValue =
    "Flash in progress. Are you sure you want to leave?");
}

export default function Flash() {
  const {
    step,
    message,
    progress,
    error,
    onContinue,
    onRetry,
    connected,
    serial,
  } = useQdl();

  const [copied, setCopied] = createSignal(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  createEffect(() => {
    if (Step.DOWNLOADING <= step() && step() <= Step.ERASING) {
      window.addEventListener("beforeunload", beforeUnloadListener, {
        capture: true,
      });
      onCleanup(() =>
        window.removeEventListener("beforeunload", beforeUnloadListener, {
          capture: true,
        }),
      );
    }
  });

  const uiState = createMemo(() => {
    const state = steps[step()];
    if (error()) {
      return { ...state, ...errors[Error.UNKNOWN], ...errors[error()] };
    }
    return state;
  });

  const title = createMemo(() => {
    if (message() && !error()) {
      let text = message() + "...";
      if (progress() >= 0) {
        text += ` (${(progress() * 100).toFixed(0)}%)`;
      }
      return text;
    }
    return uiState().status;
  });

  return (
    <div
      id="flash"
      className="relative flex flex-col gap-8 justify-center items-center h-full"
    >
      <div
        className={`p-8 rounded-full ${uiState().bgColor}`}
        style={{ cursor: onContinue() ? "pointer" : "default" }}
        onClick={() => onContinue()?.()}
      >
        <img
          src={uiState().icon}
          alt="status"
          width={128}
          height={128}
          className={`${uiState().iconStyle} ${!error() && step() !== Step.DONE ? "animate-pulse" : ""}`}
        />
      </div>

      <div
        className="w-full max-w-3xl px-8 transition-opacity duration-300"
        style={{ opacity: progress() === -1 ? 0 : 1 }}
      >
        <LinearProgress value={progress() * 100} barColor={uiState().bgColor} />
      </div>

      <span className="text-3xl dark:text-white font-mono font-light">
        {title()}
      </span>
      <span className="text-xl dark:text-white px-8 max-w-xl">
        {uiState().description}
      </span>

      {/* Linux instructions */}
      <Show
        when={(title() === "Lost connection" || title() === "Ready") && isLinux}
      >
        <span className="text-l dark:text-white px-2 max-w-xl">
          It seems that you&apos;re on Linux, make sure to run the script below
          in your terminal after plugging in your device.
        </span>
        <div className="relative mt-2 max-w-3xl">
          <div className="bg-gray-200 dark:bg-gray-800 rounded-md overflow-x-auto">
            <div className="relative">
              <pre className="font-mono text-sm text-gray-800 dark:text-gray-200 bg-gray-300 dark:bg-gray-700 rounded-md p-6 flex-grow max-w-m text-wrap">
                {detachScript.map((line, index) => (
                  <span className="block" key={index}>
                    {line}
                  </span>
                ))}
              </pre>
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(detachScript.join("\n"));
                    handleCopy();
                  }}
                  className={`bg-${copied() ? "green" : "blue"}-500 text-white px-1 py-1 rounded-md ml-2 text-sm`}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      <Show when={error()}>
        <button
          className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
          onClick={() => onRetry()?.()}
        >
          Retry
        </button>
      </Show>

      {connected() && <DeviceState connected={connected} serial={serial} />}
    </div>
  );
}
