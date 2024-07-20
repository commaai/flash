declare module "android-fastboot" {
  export class FastbootError extends Error {}
  export class FastbootDevice {
    /**
     * Request the user to select a USB device and connect to it using the
     * fastboot protocol.
     *
     * @throws {UsbError}
     */
    connect(): Promise<void>;
    get isConnected(): boolean;
    /**
     * Wait for the current USB device to disconnect, if it's still connected.
     * Returns immediately if no device is connected.
     */
    waitForDisconnect(): Promise<void>;
    /**
     * Wait for the USB device to connect. Returns at the next connection,
     * regardless of whether the connected USB device matches the previous one.
     */
    waitForConnect(onReconnect?: () => void): Promise<void>;

    /**
     * Read the value of a bootloader variable. Returns undefined if the variable
     * does not exist.
     * @throws {FastbootError}
     */
    getVariable(varName: string): Promise<string>;
    /**
     * Send a textual command to the bootloader and read the response.
     * This is in raw fastboot format, not AOSP fastboot syntax.
     *
     * @param {string} command - The command to send.
     * @returns {Promise<CommandResponse>} Object containing response text and data size, if any.
     * @throws {FastbootError}
     */
    runCommand(
      cmd: string,
    ): Promise<{ textSize: string; dataSize?: string | number }>;

    /**
     * Flash the given Blob to the given partition on the device. Any image
     * format supported by the bootloader is allowed, e.g. sparse or raw images.
     * Large raw images will be converted to sparse images automatically, and
     * large sparse images will be split and flashed in multiple passes
     * depending on the bootloader's payload size limit.
     *
     * @param {string} partition - The name of the partition to flash.
     * @param {Blob} blob - The Blob to retrieve data from.
     * @param {"a" | "b" | "current" | "other"} targetSlot - Which slot to flash to, if partition
     * is A/B. Defaults to current slot.
     * @param {FlashProgressCallback} onProgress - Callback for flashing progress updates.
     * @throws {FastbootError}
     */
    flashBlob(
      partition: string,
      blob: Blob,
      onProgress: (p: number) => void,
      targetSlot: "a" | "b" | "current" | "other",
    ): Promise<void>;
  }
  /**
   * Change the debug level for the fastboot client:
   *   - 0 = silent
   *   - 1 = debug, recommended for general use
   *   - 2 = verbose, for debugging only
   */
  export function setDebugLevel(level: number): void;
}
