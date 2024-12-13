// Global USB library object
window.USBLib = (function() {
    class usbClass {
        constructor() {
            this.device = null;
            this.interface = null;
            this.endpointIn = null;
            this.endpointOut = null;
            this.connected = false;
        }

        async connect() {
            try {
                this.device = await navigator.usb.requestDevice({
                    filters: [
                        { vendorId: 0x05c6, productId: 0x9008 },  // Qualcomm QDL
                        { vendorId: 0x18d1, productId: 0xd00d }   // Google Fastboot
                    ]
                });

                await this.device.open();
                await this.device.selectConfiguration(1);
                await this.device.claimInterface(0);

                this.interface = this.device.configuration.interfaces[0];
                this.endpointIn = this.interface.alternate.endpoints.find(e => e.direction === "in");
                this.endpointOut = this.interface.alternate.endpoints.find(e => e.direction === "out");

                if (!this.endpointIn || !this.endpointOut) {
                    throw new Error("Device endpoints not found");
                }

                this.connected = true;
                return true;
            } catch (error) {
                console.error("USB connection error:", error);
                this.connected = false;
                return false;
            }
        }

        async write(data) {
            if (!this.connected) {
                throw new Error("Device not connected");
            }

            try {
                const result = await this.device.transferOut(this.endpointOut.endpointNumber, data);
                return result.status === 'ok';
            } catch (error) {
                console.error("USB write error:", error);
                return false;
            }
        }

        async read(length) {
            if (!this.connected) {
                throw new Error("Device not connected");
            }

            try {
                const result = await this.device.transferIn(this.endpointIn.endpointNumber, length);
                if (result.status === 'ok') {
                    return new Uint8Array(result.data.buffer);
                }
                return null;
            } catch (error) {
                console.error("USB read error:", error);
                return null;
            }
        }

        async readWithTimeout(length, timeout) {
            return await window.QDLUtils.runWithTimeout(this.read(length), timeout);
        }

        disconnect() {
            if (this.device) {
                this.device.close();
            }
            this.device = null;
            this.interface = null;
            this.endpointIn = null;
            this.endpointOut = null;
            this.connected = false;
        }
    }

    // Public API
    return {
        usbClass: usbClass
    };
})();
