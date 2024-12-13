// Global GPT utilities object
window.GPTUtils = (function() {
    // Constants
    const AB_FLAG_OFFSET = 48;
    const AB_PARTITION_ATTR_SLOT_ACTIVE = 0x1;
    const AB_PARTITION_ATTR_BOOT_SUCCESSFUL = 0x2;
    const AB_PARTITION_ATTR_UNBOOTABLE = 0x4;

    class gptHeader {
        constructor(data) {
            const view = new DataView(data.buffer);
            this.signature = data.slice(0, 8);
            this.revision = view.getUint32(8, true);
            this.headerSize = view.getUint32(12, true);
            this.headerCrc32 = view.getUint32(16, true);
            this.reserved = view.getUint32(20, true);
            this.currentLba = view.getBigUint64(24, true);
            this.backupLba = view.getBigUint64(32, true);
            this.firstUsableLba = view.getBigUint64(40, true);
            this.lastUsableLba = view.getBigUint64(48, true);
            this.diskGuid = data.slice(56, 72);
            this.partEntryStartLba = view.getBigUint64(72, true);
            this.numPartEntries = view.getUint32(80, true);
            this.partEntrySize = view.getUint32(84, true);
            this.partArrayCrc32 = view.getUint32(88, true);
        }
    }

    class gptPartition {
        constructor(data) {
            const view = new DataView(data.buffer);
            this.type = data.slice(0, 16);
            this.guid = data.slice(16, 32);
            this.sector = Number(view.getBigUint64(32, true));
            this.sectors = Number(view.getBigUint64(40, true));
            this.flags = view.getBigUint64(48, true);
            
            // Convert name from UTF-16LE to string
            const nameBytes = data.slice(56, 128);
            const nameArray = [];
            for (let i = 0; i < nameBytes.length; i += 2) {
                const code = (nameBytes[i+1] << 8) | nameBytes[i];
                if (code === 0) break;
                nameArray.push(code);
            }
            this.name = String.fromCharCode(...nameArray);
        }

        create() {
            const data = new Uint8Array(128);
            const view = new DataView(data.buffer);
            
            data.set(this.type, 0);
            data.set(this.guid, 16);
            view.setBigUint64(32, BigInt(this.sector), true);
            view.setBigUint64(40, BigInt(this.sectors), true);
            view.setBigUint64(48, this.flags, true);
            
            // Convert name to UTF-16LE
            const encoder = new TextEncoder();
            const nameBytes = encoder.encode(this.name);
            for (let i = 0; i < nameBytes.length && i < 36; i++) {
                data[56 + i*2] = nameBytes[i];
                data[56 + i*2 + 1] = 0;
            }
            
            return data;
        }
    }

    class gpt {
        constructor() {
            this.header = null;
            this.partentries = {};
        }

        parseHeader(data, sectorSize) {
            this.header = new gptHeader(data.slice(sectorSize));
            return this.header;
        }

        parse(data, sectorSize) {
            const partitionTableOffset = Number(this.header.partEntryStartLba) * sectorSize;
            
            for (let i = 0; i < this.header.numPartEntries; i++) {
                const offset = partitionTableOffset + (i * this.header.partEntrySize);
                const partitionData = data.slice(offset, offset + this.header.partEntrySize);
                
                // Skip empty partitions
                if (partitionData.every(b => b === 0)) continue;
                
                const partition = new gptPartition(partitionData);
                if (partition.name) {
                    this.partentries[partition.name] = {
                        sector: partition.sector,
                        sectors: partition.sectors,
                        flags: partition.flags,
                        entryOffset: offset
                    };
                }
            }
        }

        fixGptCrc(data) {
            // Implementation of CRC32 calculation and fixing
            // This would need to be implemented if needed
            console.warn('GPT CRC fixing not implemented');
        }
    }

    function setPartitionFlags(flags, active, isBoot) {
        let newFlags = flags;
        if (active) {
            newFlags |= BigInt(AB_PARTITION_ATTR_SLOT_ACTIVE);
            if (isBoot) {
                newFlags |= BigInt(AB_PARTITION_ATTR_BOOT_SUCCESSFUL);
            }
        } else {
            newFlags &= ~BigInt(AB_PARTITION_ATTR_SLOT_ACTIVE);
            if (isBoot) {
                newFlags |= BigInt(AB_PARTITION_ATTR_UNBOOTABLE);
            }
        }
        return newFlags;
    }

    function ensureGptHdrConsistency(gptData, backupGptData, guidGpt, backupGuidGpt) {
        // Implementation of GPT header consistency check
        // This would need to be implemented if needed
        console.warn('GPT header consistency check not implemented');
        return gptData;
    }

    // Public API
    return {
        gpt: gpt,
        gptHeader: gptHeader,
        gptPartition: gptPartition,
        setPartitionFlags: setPartitionFlags,
        ensureGptHdrConsistency: ensureGptHdrConsistency,
        AB_FLAG_OFFSET: AB_FLAG_OFFSET,
        AB_PARTITION_ATTR_SLOT_ACTIVE: AB_PARTITION_ATTR_SLOT_ACTIVE,
        AB_PARTITION_ATTR_BOOT_SUCCESSFUL: AB_PARTITION_ATTR_BOOT_SUCCESSFUL,
        AB_PARTITION_ATTR_UNBOOTABLE: AB_PARTITION_ATTR_UNBOOTABLE
    };
})();
