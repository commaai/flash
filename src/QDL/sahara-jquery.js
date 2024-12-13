// Global Sahara protocol object
window.SaharaProtocol = (function() {
    // Constants from saharaDefs.js
    const SAHARA_HELLO_REQ = 0x1;
    const SAHARA_HELLO_RSP = 0x2;
    const SAHARA_READ_DATA = 0x3;
    const SAHARA_END_TRANSFER = 0x4;
    const SAHARA_DONE = 0x5;
    const SAHARA_DONE_RSP = 0x6;
    const SAHARA_RESET = 0x7;
    const SAHARA_RESET_RSP = 0x8;
    const SAHARA_MEMORY_DEBUG = 0x9;
    const SAHARA_MEMORY_READ = 0xA;
    const SAHARA_CMD_READY = 0xB;
    const SAHARA_SWITCH_MODE = 0xC;
    const SAHARA_EXECUTE_REQ = 0xD;
    const SAHARA_EXECUTE_RSP = 0xE;
    const SAHARA_EXECUTE_DATA = 0xF;
    const SAHARA_64BIT_MEMORY_DEBUG = 0x10;
    const SAHARA_64BIT_MEMORY_READ = 0x11;
    const SAHARA_64BIT_MEMORY_READ_DATA = 0x12;

    const SAHARA_MODE_IMAGE_TX_PENDING = 0x0;
    const SAHARA_MODE_IMAGE_TX_COMPLETE = 0x1;
    const SAHARA_MODE_MEMORY_DEBUG = 0x2;
    const SAHARA_MODE_COMMAND = 0x3;

    class Sahara {
        constructor(usbdev) {
            this.usbdev = usbdev;
            this.serial = null;
        }

        async readHello() {
            const data = await this.usbdev.readWithTimeout(0x30, 1000);
            if (!data) return null;

            const view = new DataView(data.buffer);
            const cmd = view.getUint32(0, true);
            const len = view.getUint32(4, true);
            const ver = view.getUint32(8, true);
            const ver_min = view.getUint32(12, true);
            const max_cmd_len = view.getUint32(16, true);
            const mode = view.getUint32(20, true);

            // Extract serial number if present (44 bytes)
            if (data.length >= 0x30) {
                const serialBytes = data.slice(24, 24 + 44);
                const nullIndex = serialBytes.findIndex(b => b === 0);
                this.serial = new TextDecoder().decode(
                    serialBytes.slice(0, nullIndex !== -1 ? nullIndex : undefined)
                );
            }

            return {
                cmd: cmd,
                len: len,
                ver: ver,
                ver_min: ver_min,
                max_cmd_len: max_cmd_len,
                mode: mode
            };
        }

        async writeHello(mode = SAHARA_MODE_IMAGE_TX_PENDING) {
            const data = new ArrayBuffer(0x30);
            const view = new DataView(data);
            
            view.setUint32(0, SAHARA_HELLO_RSP, true);  // cmd
            view.setUint32(4, 0x30, true);              // length
            view.setUint32(8, 2, true);                 // version
            view.setUint32(12, 1, true);                // version_min
            view.setUint32(16, 0x1000, true);           // max_cmd_len
            view.setUint32(20, mode, true);             // mode

            return await this.usbdev.write(new Uint8Array(data));
        }

        async readData() {
            const data = await this.usbdev.readWithTimeout(0x10, 1000);
            if (!data) return null;

            const view = new DataView(data.buffer);
            return {
                cmd: view.getUint32(0, true),
                len: view.getUint32(4, true),
                offset: view.getUint32(8, true),
                size: view.getUint32(12, true)
            };
        }

        async writeData(offset, size, data) {
            const header = new ArrayBuffer(0x10);
            const view = new DataView(header);
            
            view.setUint32(0, SAHARA_READ_DATA, true);
            view.setUint32(4, size + 0x10, true);
            view.setUint32(8, offset, true);
            view.setUint32(12, size, true);

            await this.usbdev.write(new Uint8Array(header));
            return await this.usbdev.write(data);
        }

        async writeDone() {
            const data = new ArrayBuffer(0x8);
            const view = new DataView(data);
            
            view.setUint32(0, SAHARA_DONE, true);
            view.setUint32(4, 0x8, true);

            return await this.usbdev.write(new Uint8Array(data));
        }

        async readDone() {
            const data = await this.usbdev.readWithTimeout(0x8, 1000);
            if (!data) return null;

            const view = new DataView(data.buffer);
            return {
                cmd: view.getUint32(0, true),
                len: view.getUint32(4, true)
            };
        }

        async connect() {
            const hello = await this.readHello();
            if (!hello) {
                throw new Error("Failed to read hello packet");
            }

            if (hello.cmd === SAHARA_HELLO_REQ) {
                await this.writeHello();
                return { mode: "sahara" };
            } else if (hello.cmd === SAHARA_CMD_READY) {
                return { mode: "streaming" };
            }

            return { mode: "error" };
        }

        async uploadLoader() {
            // Load the programmer binary
            const response = await fetch('QDL/sdm845_fhprg.bin');
            const programmerData = new Uint8Array(await response.arrayBuffer());

            while (true) {
                const request = await this.readData();
                if (!request) {
                    throw new Error("Failed to read data request");
                }

                if (request.cmd === SAHARA_READ_DATA) {
                    const chunk = programmerData.slice(request.offset, request.offset + request.size);
                    await this.writeData(request.offset, request.size, chunk);
                } else if (request.cmd === SAHARA_END_TRANSFER) {
                    break;
                } else {
                    throw new Error("Unexpected command during upload");
                }
            }

            await this.writeDone();
            const done = await this.readDone();
            if (!done || done.cmd !== SAHARA_DONE_RSP) {
                throw new Error("Upload failed");
            }
        }
    }

    // Public API
    return {
        Sahara: Sahara,
        // Constants
        SAHARA_MODE_IMAGE_TX_PENDING,
        SAHARA_MODE_IMAGE_TX_COMPLETE,
        SAHARA_MODE_MEMORY_DEBUG,
        SAHARA_MODE_COMMAND
    };
})();
