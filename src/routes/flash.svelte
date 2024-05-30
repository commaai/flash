<script>
    import LinearProgress from "./LinearProgress.svelte";
    import bolt from "$lib/assets/bolt.svg";
    import cable from "$lib/assets/cable.svg";
    import cloud from "$lib/assets/cloud.svg";
    import cloudDownload from "$lib/assets/cloud_download.svg";
    import cloudError from "$lib/assets/cloud_error.svg";
    import deviceExclamation from "$lib/assets/device_exclamation_c3.svg";
    import deviceQuestion from "$lib/assets/device_question_c3.svg";
    import done from "$lib/assets/done.svg";
    import exclamation from "$lib/assets/exclamation.svg";
    import frameAlert from "$lib/assets/frame_alert.svg";
    import systemUpdate from "$lib/assets/system_update_c3.svg";
    import DeviceState from "./DeviceState.svelte";
    import { FastbootDevice, setDebugLevel } from "android-fastboot";
    import * as Comlink from "comlink";
    //import { usePlausible } from 'next-plausible'

    import config from "$lib/utils/config";
    import { download } from "$lib/utils/blob";
    import { useImageWorker } from "$lib/utils/image";
    import { createManifest } from "$lib/utils/manifest";
    import { withProgress } from "$lib/utils/progress";
    import { onMount } from "svelte";
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
            !partitions.every((partition) =>
                expectedPartitions.includes(partition),
            )
        ) {
            console.error(
                "[fastboot] Unrecognised device (partitions)",
                partitions,
            );
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

    let step = $state(Step.INITIALIZING);
    let message = $state("");
    let progress = $state(0);
    let error = $state(Error.NONE);

    let connected = $state(false);
    let serial = $state(null);

    let onContinue = $state(null);
    let onRetry = $state(null);
    let fastboot = $state(new FastbootDevice());

    let manifest = $state(null);

    //const plausible = usePlausible()

    $effect(() => {
        const imageWorker = useImageWorker();
        progress = -1;
        message = "";

        if (error) return;
        if (!imageWorker) {
            console.debug("[fastboot] Waiting for image worker");
            return;
        }
        switch (step) {
            case Step.INITIALIZING: {
                // Check that the browser supports WebUSB
                if (typeof navigator.usb === "undefined") {
                    console.error("[fastboot] WebUSB not supported");
                    error = Error.REQUIREMENTS_NOT_MET;
                    break;
                }

                // Check that the browser supports Web Workers
                if (typeof Worker === "undefined") {
                    console.error("[fastboot] Web Workers not supported");
                    error = Error.REQUIREMENTS_NOT_MET;
                    break;
                }

                // Check that the browser supports Storage API
                if (typeof Storage === "undefined") {
                    console.error("[fastboot] Storage API not supported");
                    error = Error.REQUIREMENTS_NOT_MET;
                    break;
                }

                // TODO: change manifest once alt image is in release
                imageWorker
                    ?.init()
                    .then(() => download(config.manifests["master"]))
                    .then((blob) => blob.text())
                    .then((text) => {
                        manifest = createManifest(text);

                        // sanity check
                        if (manifest.length === 0) {
                            throw "Manifest is empty";
                        }

                        console.debug("[fastboot] Loaded manifest", manifest);
                        step = Step.READY;
                    })
                    .catch((err) => {
                        console.error("[fastboot] Initialization error", err);
                        error = Error.UNKNOWN;
                    });
                break;
            }

            case Step.READY: {
                // wait for user interaction (we can't use WebUSB without user event)
                onContinue = () => {
                    onContinue = null;
                    step = Step.CONNECTING;
                };
                break;
            }

            case Step.CONNECTING: {
                fastboot
                    .waitForConnect()
                    .then(() => {
                        console.info("[fastboot] Connected", {
                            fastboot: fastboot.current,
                        });
                        return fastboot
                            .getVariable("all")
                            .then((all) => {
                                const deviceInfo = all
                                    .split("\n")
                                    .reduce((obj, line) => {
                                        const parts = line.split(":");
                                        const key = parts
                                            .slice(0, -1)
                                            .join(":")
                                            .trim();
                                        obj[key] = parts.slice(-1)[0].trim();
                                        return obj;
                                    }, {});

                                const recognized =
                                    isRecognizedDevice(deviceInfo);
                                console.debug("[fastboot] Device info", {
                                    recognized,
                                    deviceInfo,
                                });

                                if (!recognized) {
                                    error = Error.UNRECOGNIZED_DEVICE;
                                    return;
                                }

                                serial = deviceInfo["serialno"] || "unknown";
                                connected = true;
                                //plausible('device-connected')
                                step = Step.DOWNLOADING;
                            })
                            .catch((err) => {
                                console.error(
                                    "[fastboot] Error getting device information",
                                    err,
                                );
                                error = Error.UNKNOWN;
                            });
                    })
                    .catch((err) => {
                        console.error("[fastboot] Connection lost", err);
                        error = Error.LOST_CONNECTION;
                        connected = false;
                    });

                fastboot.connect().catch((err) => {
                    console.error("[fastboot] Connection error", err);
                    step = Step.READY;
                });
                break;
            }

            case Step.DOWNLOADING: {
                progress = 0;

                async function downloadImages() {
                    for await (const [image, onProgress] of withProgress(
                        manifest,
                        progress,
                    )) {
                        message = `Downloading ${image.name}`;
                        await imageWorker.downloadImage(
                            image,
                            Comlink.proxy(onProgress),
                        );
                    }
                }

                downloadImages()
                    .then(() => {
                        console.debug("[fastboot] Downloaded all images");
                        step = Step.UNPACKING;
                    })
                    .catch((err) => {
                        console.error("[fastboot] Download error", err);
                        error = Error.DOWNLOAD_FAILED;
                    });
                break;
            }

            case Step.UNPACKING: {
                progress = 0;

                async function unpackImages() {
                    for await (const [image, onProgress] of withProgress(
                        manifest,
                        progress,
                    )) {
                        message = `Unpacking ${image.name}`;
                        await imageWorker.unpackImage(
                            image,
                            Comlink.proxy(onProgress),
                        );
                    }
                }

                unpackImages()
                    .then(() => {
                        console.debug("[fastboot] Unpacked all images");
                        step = Step.FLASHING;
                    })
                    .catch((err) => {
                        console.error("[fastboot] Unpack error", err);
                        if (err.startsWith("Checksum mismatch")) {
                            error = Error.CHECKSUM_MISMATCH;
                        } else {
                            error = Error.UNPACK_FAILED;
                        }
                    });
                break;
            }

            case Step.FLASHING: {
                progress = 0;

                async function flashDevice() {
                    const currentSlot =
                        await fastboot.getVariable("current-slot");
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
                            message = `Erasing ${image.name}`;
                            await fastboot.runCommand(`erase:${image.name}`);
                        }
                        message = `Flashing ${image.name}`;
                        await fastboot.flashBlob(
                            image.name,
                            blob,
                            onProgress,
                            "other",
                        );
                    }
                    console.debug("[fastboot] Flashed all partitions");

                    const otherSlot = currentSlot === "a" ? "b" : "a";
                    message = `Changing slot to ${otherSlot}`;
                    await fastboot.runCommand(`set_active:${otherSlot}`);
                }

                flashDevice()
                    .then(() => {
                        console.debug("[fastboot] Flash complete");
                        step = Step.ERASING;
                    })
                    .catch((err) => {
                        console.error("[fastboot] Flashing error", err);
                        error = Error.FLASH_FAILED;
                    });
                break;
            }

            case Step.ERASING: {
                progress = 0;

                async function eraseDevice() {
                    message = "Erasing userdata";
                    await fastboot.runCommand("erase:userdata");
                    progress = 0.9;

                    message = "Rebooting";
                    await fastboot.runCommand("continue");
                    progress = 1;
                    connected = false;
                }

                eraseDevice()
                    .then(() => {
                        console.debug("[fastboot] Erase complete");
                        step = Step.DONE;
                        //plausible('completed')
                    })
                    .catch((err) => {
                        console.error("[fastboot] Erase error", err);
                        error = Error.ERASE_FAILED;
                    });
                break;
            }
        }
        if (error !== Error.NONE) {
            console.debug("[fastboot] error", error);
            //plausible('error', { props: { error }})
            progress = -1;
            onContinue = null;

            onRetry = () => {
                console.debug("[fastboot] on retry");
                window.location.reload();
            };
        }
    });
    const steps = {
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
            description:
                "Do not unplug your device until the process is complete.",
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
                "Your device has been updated successfully. You can now unplug the USB cable from your computer. To " +
                "complete the system reset, follow the instructions on your device.",
            bgColor: "bg-green-500",
            icon: done,
        },
    };

    const errors = {
        [Error.UNKNOWN]: {
            status: "Unknown error",
            description:
                "An unknown error has occurred. Restart your browser and try again.",
            bgColor: "bg-red-500",
            icon: exclamation,
        },
        [Error.UNRECOGNIZED_DEVICE]: {
            status: "Unrecognized device",
            description:
                "The device connected to your computer is not supported.",
            bgColor: "bg-yellow-500",
            icon: deviceQuestion,
        },
        [Error.LOST_CONNECTION]: {
            status: "Lost connection",
            description:
                "The connection to your device was lost. Check that your cables are connected properly and try again.",
            icon: cable,
        },
        [Error.DOWNLOAD_FAILED]: {
            status: "Download failed",
            description:
                "The system image could not be downloaded. Check your internet connection and try again.",
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
    let {
        status,
        description,
        bgColor,
        icon,
        iconStyle = "invert",
    } = $derived(steps[step]);
    let title = $derived(
        message
            ? progress >= 0
                ? message + "..."
                : message + "..." + ` (${(progress * 100).toFixed(0)}%)`
            : status,
    );
</script>

<div
    id="flash"
    class="relative flex flex-col gap-8 justify-center items-center h-full"
>
    {#if onContinue}
        <div
            class="p-8 rounded-full {bgColor}"
            style="cursor: 'pointer'"
            onclick={onContinue}
        >
            <img
                src={icon}
                alt="cable"
                width={128}
                height={128}
                class="{iconStyle} {!error && step !== Step.DONE
                    ? 'animate-pulse'
                    : ''}"
            />
        </div>
    {:else}
        <div
            class="p-8 rounded-full {bgColor}"
            style="cursor: 'default'"
            onclick={onContinue}
        >
            <img
                src={icon}
                alt="cable"
                width={128}
                height={128}
                class={iconStyle}
            />
        </div>
    {/if}
    <div
        class="w-full max-w-3xl px-8 transition-opacity duration-300"
        style="opacity: {progress === -1 ? 0 : 1}"
    >
        <LinearProgress value={progress * 100} barColor={bgColor} />
    </div>
    <span class={`text-3xl dark:text-white font-mono font-light`}>{title}</span>
    <span class={`text-xl dark:text-white px-8 max-w-xl`}>{description}</span>
    {#if error}
        <button
            class="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
            onclick={onRetry}
        >
            Retry
        </button>
    {/if}
    {#if connected}
        <DeviceState {serial} />
    {/if}
</div>
