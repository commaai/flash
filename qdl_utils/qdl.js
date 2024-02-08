const vendorID = 0x05c6;
const productID = 0x9008;
const QDL_USB_CLASS = 0xff;

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
        console.log("Interface has wrong number of endpoints");
    }

    this.epIn = null;
    this.epOut = null;

    for (let endpoint of ife.endpoints) {
        console.log("Checking endpoint:", endpoint);
        if (endpoint.type !== "bulk") {
            console.log("Interface endpoint is not bulk");
        }
        if (endpoint.direction === "in") {
            if (this.epIn === null) {
                this.epIn = endpoint.endpointNumber;
            } else {
                console.log("Interface has multiple IN endpoints");
            }
        } else if (endpoint.direction === "out") {
            if (this.epOut === null) {
                this.epOut = endpoint.endpointNumber;
            } else {
                console.log("Interface has multiple OUT endpoints");
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
        await this.device?.claimInterface(0); // fastboot
    } catch (error) {
        throw error;
    }
  }


  async connect() {
    console.log("In hello")
    let devices = await navigator.usb.getDevices();
    console.log("Found these USB devices:", devices);

    this.device = await navigator.usb.requestDevice({
      filters: [
        {
          vendorID  : vendorID,
          productID : productID,
          calssCode : QDL_USB_CLASS,
        },
      ],
    });
    console.log("USing USB device:", this.device);

    if (!this._registeredUsbListeners){
      navigator.usb.addEventListener("connect", (event) =>{
        console.log("USB device connect:", event.device);
        this.device = event.device;

        try {
          await.this._validateAndConnectDevice();
        } catch (error) {
          console.log("Error while connecting to the device")
        }
      });

      this._registeredUsbListeners = true;
    }
    await this._validateAndConnectDevice();
  }
}