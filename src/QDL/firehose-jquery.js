// Global Firehose protocol object
window.FirehoseProtocol = (function() {
    class Firehose {
        constructor(usbdev) {
            this.usbdev = usbdev;
            this.cfg = {
                SECTOR_SIZE_IN_BYTES: 512,
                MAX_PAYLOAD_SIZE_IN_BYTES: 1048576
            };
            this.luns = [0];
            this.xmlParser = new window.XMLParserUtils.Parser();
        }

        async configure() {
            const configureXml = `<?xml version="1.0" ?><data><configure MemoryName="eMMC" Verbose="0" AlwaysValidate="0" MaxPayloadSizeToTargetInBytes="${this.cfg.MAX_PAYLOAD_SIZE_IN_BYTES}" ZlpAwareHost="1" SkipStorageInit="0" /></data>`;
            await this.usbdev.write(new TextEncoder().encode(configureXml));
            
            const response = await this.readResponse();
            if (!response || !response.includes('ACK')) {
                throw new Error('Configure failed');
            }

            return true;
        }

        async readResponse() {
            const chunks = [];
            while (true) {
                const data = await this.usbdev.readWithTimeout(4096, 1000);
                if (!data || data.length === 0) break;
                chunks.push(data);
                if (data[data.length - 1] === 0x0A) break; // \n
            }

            if (chunks.length === 0) return null;

            const response = new TextDecoder().decode(window.QDLUtils.concatUint8Array(chunks));
            return response.trim();
        }

        async cmdProgram(lun, sector, blob, onProgress) {
            const sectorSize = this.cfg.SECTOR_SIZE_IN_BYTES;
            const maxPayloadSize = this.cfg.MAX_PAYLOAD_SIZE_IN_BYTES;
            let offset = 0;

            while (offset < blob.size) {
                const chunkSize = Math.min(maxPayloadSize, blob.size - offset);
                const numSectors = Math.ceil(chunkSize / sectorSize);
                
                const programXml = `<?xml version="1.0" ?><data><program SECTOR_SIZE_IN_BYTES="${sectorSize}" num_partition_sectors="${numSectors}" physical_partition_number="${lun}" start_sector="${sector + (offset / sectorSize)}" /></data>`;
                await this.usbdev.write(new TextEncoder().encode(programXml));

                const chunk = await blob.slice(offset, offset + chunkSize).arrayBuffer();
                await this.usbdev.write(new Uint8Array(chunk));

                const response = await this.readResponse();
                if (!response || !response.includes('ACK')) {
                    throw new Error('Program failed');
                }

                offset += chunkSize;
                if (onProgress) onProgress(offset / blob.size);
            }

            return true;
        }

        async cmdReadBuffer(lun, sector, numSectors) {
            const readXml = `<?xml version="1.0" ?><data><read SECTOR_SIZE_IN_BYTES="${this.cfg.SECTOR_SIZE_IN_BYTES}" num_partition_sectors="${numSectors}" physical_partition_number="${lun}" start_sector="${sector}" /></data>`;
            await this.usbdev.write(new TextEncoder().encode(readXml));

            const data = await this.usbdev.readWithTimeout(numSectors * this.cfg.SECTOR_SIZE_IN_BYTES, 5000);
            if (!data) {
                return { resp: false, error: 'Read failed' };
            }

            const response = await this.readResponse();
            if (!response || !response.includes('ACK')) {
                return { resp: false, error: 'Read response failed' };
            }

            return { resp: true, data: data };
        }

        async cmdErase(lun, sector, numSectors) {
            const eraseXml = `<?xml version="1.0" ?><data><erase SECTOR_SIZE_IN_BYTES="${this.cfg.SECTOR_SIZE_IN_BYTES}" num_partition_sectors="${numSectors}" physical_partition_number="${lun}" start_sector="${sector}" /></data>`;
            await this.usbdev.write(new TextEncoder().encode(eraseXml));

            const response = await this.readResponse();
            if (!response || !response.includes('ACK')) {
                throw new Error('Erase failed');
            }

            return true;
        }

        async cmdSetBootLunId(bootLunId) {
            const setBootLunXml = `<?xml version="1.0" ?><data><setbootablestoragedrive value="${bootLunId}" /></data>`;
            await this.usbdev.write(new TextEncoder().encode(setBootLunXml));

            const response = await this.readResponse();
            if (!response || !response.includes('ACK')) {
                throw new Error('Set boot lun failed');
            }

            return true;
        }

        async cmdReset() {
            const resetXml = `<?xml version="1.0" ?><data><power value="reset" /></data>`;
            await this.usbdev.write(new TextEncoder().encode(resetXml));

            const response = await this.readResponse();
            if (!response || !response.includes('ACK')) {
                throw new Error('Reset failed');
            }

            return true;
        }
    }

    // Public API
    return {
        Firehose: Firehose
    };
})();
