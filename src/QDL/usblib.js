import { concatUint8Array, sleep } from "./utils";

const vendorID = 0x05c6;
const productID = 0x9008;
const QDL_USB_CLASS = 0xff;
const BULK_TRANSFER_SIZE = 16384;


export class usbClass {
  constructor() {
    this.device = null;
    this.epIn = null;
    this.epOut = null;
    this.maxSize = 512;
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
      throw "USB - Attempted to connect to null device";
    }

    this.epIn = null;
    this.epOut = null;

    for (let endpoint of ife.endpoints) {
      if (endpoint.type !== "bulk") {
        throw "USB - Interface endpoint is not bulk";
      }
      if (endpoint.direction === "in") {
        if (this.epIn === null) {
          this.epIn = endpoint;
        } else {
          throw "USB - Interface has multiple IN endpoints";
        }
      } else if (endpoint.direction === "out") {
        if (this.epOut === null) {
          this.epOut = endpoint;
        } else {
          throw "USB - Interface has multiple OUT endpoints";
        }
      }
      this.maxSize = this.epIn.packetSize;
    }
    console.log("Endpoints: in =", this.epIn, ", out =", this.epOut);

    try {
        await this.device?.open();
        await this.device?.selectConfiguration(1);
        try {
          await this.device?.claimInterface(0);
        } catch(error) {
          await this.device?.reset();
          await this.device?.forget();
          await this.device?.close();
          console.error(error);
        }
    } catch (error) {
      throw `USB - ${error}`;
    }
  }

  async connect() {
    this.device = await navigator.usb.requestDevice({
      filters: [
        {
          vendorID : vendorID,
          productID : productID,
          classCode : QDL_USB_CLASS,
        },
      ],
    });
    console.log("Using USB device:", this.device);

    navigator.usb.addEventListener("connect", async (event) =>{
      console.log("USB device connect:", event.device);
      this.device = event.device;
      try {
        await this._validateAndConnectDevice();
      } catch (error) {
        console.log("Error while connecting to the device");
        throw error;
      }
    });
    await this._validateAndConnectDevice();
  }

  async read(resplen=null) {
    let respData = new Uint8Array();
    let covered = 0;
    if (resplen === null) {
      resplen = this.epIn.packetSize;
    }

    while (covered < resplen) {
      let respPacket = await this.device?.transferIn(this.epIn?.endpointNumber, resplen);
      respData = concatUint8Array([respData, new Uint8Array(respPacket.data.buffer)]);
      resplen = respData.length;
      covered += respData.length;
    }
    return respData;
  }


  async write(cmdPacket, pktSize=null, wait=true) {
    if (cmdPacket.length === 0) {
      try {
        await this.device?.transferOut(this.epOut?.endpointNumber, cmdPacket);
      } catch(error) {
        await this.device?.transferOut(this.epOut?.endpointNumber, cmdPacket);
      }
      return true;
    }

    let offset = 0;
    if (pktSize === null) {
      pktSize = BULK_TRANSFER_SIZE;
    }
    while (offset < cmdPacket.length) {
      if (wait) {
        await this.device?.transferOut(this.epOut?.endpointNumber, cmdPacket.slice(offset, offset + pktSize));
      } else {
        // this is a hack, webusb doesn't have timed out catching
        // this only happens in sahara.configure(). The loader receive the packet but doesn't respond back (same as edl repo).
        this.device?.transferOut(this.epOut?.endpointNumber, cmdPacket.slice(offset, offset + pktSize));
        await sleep(80);
      }
      offset += pktSize;
    }
    return true;
  }
}
