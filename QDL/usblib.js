const vendorID = 0x05c6;
const productID = 0x9008;
const QDL_USB_CLASS = 0xff;

export class UsbError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsbError";
  }
}

// TODO: waitforconnect to check for valid device
export class usbClass {
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

  get connected() {
    return (
      this.device !== null &&
      this.device.opened &&
      this.device.configurations[0].interfaces[0].claimed
    );
  }

  async _validateAndConnectDevice() {
    let ife = this.device?.configurations[0].interfaces[0].alternates[0];
    if (ife.endpoints.length !== 2) {
      throw new UsbError("Attempted to connect to null device");
    }

    this.epIn = null;
    this.epOut = null;

    for (let endpoint of ife.endpoints) {
      if (endpoint.type !== "bulk") {
        throw new UsbError("Interface endpoint is not bulk");
      }
      if (endpoint.direction === "in") {
        if (this.epIn === null) {
          console.log("epIn", endpoint);
          this.epIn = endpoint;
        } else {
          throw new UsbError("Interface has multiple IN endpoints");
        }
      } else if (endpoint.direction === "out") {
        if (this.epOut === null) {
          console.log("epOut", endpoint);
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
      console.log("Get in unregistered");
      navigator.usb.addEventListener("connect", async (event) =>{
        console.log("USB device connect:", event.device);
        this.device = event.device;

        try {
          await this._validateAndConnectDevice();
        } catch (error) {
          console.log("Error while connecting to the device");
        }
      });

      this._registeredUsbListeners = true;
    }
    await this._validateAndConnectDevice();
  }

  async _usbRead(resplen = null){
    let respData = { text : "", };

    if ((resplen === null)) { resplen = this.epIn.packetSize; }

    while (respData.text.length < resplen) {
      try {
        console.log("Transferring In...");
        let respPacket = await this.device?.transferIn(this.epIn?.endpointNumber, resplen);
        console.log("get respPacket");
        let response = new TextDecoder().decode(respPacket.data);
        console.log("get response");
        respData.text += response;
        console.log("added response");
      } catch (error) {
        if (error.includes("timed out")) {
          console.error("Timed out");
          return new TextEncoder().endcode("");
        } else if (error.includes("Overflow")) {
          console.error("USB Overflow");
          return new TextEncoder().endcode("");
        }
      }
    }
    return new TextEncoder().encode(respData);
  }

  async _usbWrite(cmdPacket, pktSize=null) {
    if (!(pktSize === null)) { pktSize = this.epOut?.packetSize; }
    //let cmdPacket = new TextEncoder().encode(cmd);
    let offset = 0;
    while (offset < cmdPacket.length){
      try {
        console.log("Transferring Out...")
        console.log(cmdPacket.slice(offset, offset+4));
        await this.device?.transferOut(this.epOut?.endpointNumber, cmdPacket.slice(offset, offset + pktSize));
        offset += pktSize;
      } catch (error) {
        console.error(error);
        //return new TextEncoder().encode("");
        return false;
      }
    }
    return true;
  }
}