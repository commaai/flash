const vendorID = 0x05c6;
const productID = 0x9008;
const QDL_USB_CLASS = 0xff;

// TODO: waitforconnect to check for valid device

export class UsbError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsbError";
  }
}

export class qdlDevice {
  device;
  epIn;
  epOut;

  _registeredUsbListeners;

  constructor() {
    this.device = null;
    this.epIn = null;
    this.epOut = null;
    this._registeredUsbListeners = null;
  }

  async _validateAndConnectDevice() {
    let ife = this.device?.configurations[0].interfaces[0].alternates[0];
    if (ife.endpoints.length !== 2) {
      throw new UsbError("Attempted to connect to null device");
    }

    this.epIn = null;
    this.epOut = null;

    for (let endpoint of ife.endpoints) {
      console.log("Checking endpoint:", endpoint);
      if (endpoint.type !== "bulk") {
        throw new UsbError("Interface endpoint is not bulk");
      }
      if (endpoint.direction === "in") {
        if (this.epIn === null) {
          this.epIn = endpoint;
        } else {
          throw new UsbError("Interface has multiple IN endpoints");
        }
      } else if (endpoint.direction === "out") {
        if (this.epOut === null) {
          this.epOut = endpoint;
        } else {
          throw new UsbError("Interface has multiple OUT endpoints");
        }
      }
    }
    console.log("Endpoints: in =", this.epIn, ", out =", this.epOut);

    try {
        await this.device?.open();
        // Opportunistically reset to fix issues on some platforms
        try {
            await this.device?.reset();
        } catch (error) {
            /* Failed = doesn't support reset */
        }
        await this.device?.selectConfiguration(1);
        await this.device?.claimInterface(0);
    } catch (error) {
        throw error;
    }
  }

  async connect() {
    console.log("Trying to connect Qualcomm device")
    let devices = await navigator.usb.getDevices();
    console.log("Found these USB devices:", devices);

    //console.log("USing USB device:", this.device);
    this.device = await navigator.usb.requestDevice({
      filters: [
        {
          vendorID  : vendorID,
          productID : productID,
          classCode : QDL_USB_CLASS,
        },
      ],
    });
    console.log("USing USB device:", this.device);

    if (!this._registeredUsbListeners){
      navigator.usb.addEventListener("connect", async (event) =>{
        console.log("USB device connect:", event.device);
        this.device = event.device;

        try {
          await this._validateAndConnectDevice();
        } catch (error) {
          console.log("Error while connecting to the device")
        }
      });

      this._registeredUsbListeners = true;
    }
    await this._validateAndConnectDevice();
  }

  async _usbRead(resplen = null){
    let respData = { text : "" };

    if (!(resplen === null)) { resplen = this.epIn.packetSize; }

    while (respData.text.length < resplen) {
      try {
        let respPacket = await this.device?.transferIn(this.epIn.endpointNumber, resplen);
        respData.text += respPacket.data;
      } catch (error) {
        if (error.includes("timed out")) {
          console.error("Timed out");
          return new TextDecoder().endcode("");
        } else if (error.includes("Overflow")) {
          console.error("USB Overflow");
          return new TextDecoder().endcode("");
        }
      }
    }
    return respData;
  }

  async _usbWrite(cmd, pktSize=null) {
    if (!(pktSize === null)) { pktSize = this.epOut.packetSize; }
    let cmdPacket = new TextDecoder().encode(cmd);
    let offset = 0;
    while (offset < cmdPacket.length){
      try {
        await this.device.transferOut(this.epOut.endpointNumber, cmdPacket.slice(offset, offset + pktSize));
        offset += pktSize;
      } catch (error) {
        console.error(error);
        return false;
      }
    }
    return true;
  }
}