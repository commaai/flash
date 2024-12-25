import * as gpt from "./gpt"
import { usbClass } from "./usblib"
import { Sahara } from  "./sahara"
import { Firehose } from "./firehose"
import { concatUint8Array, runWithTimeout, containsBytes } from "./utils"


export class qdlDevice {
  constructor() {
    this.mode = "";
    this.cdc = new usbClass();
    this.sahara = new Sahara(this.cdc);
    this.firehose = new Firehose(this.cdc);
    this._connectResolve = null;
    this._connectReject = null;
  }

  async waitForConnect() {
    return await new Promise((resolve, reject) => {
      this._connectResolve = resolve;
      this._connectReject  = reject;
    });
  }

  async connectToSahara() {
    while (!this.cdc.connected) {
      await this.cdc?.connect();
      if (this.cdc.connected) {
        console.log("QDL device detected");
        let resp = await runWithTimeout(this.sahara?.connect(), 10000);
        if ("mode" in resp) {
          this.mode = resp["mode"];
          console.log("Mode detected:", this.mode);
          return resp;
        }
      }
    }
    return {"mode" : "error"};
  }

  async connect() {
    try {
      let resp = await this.connectToSahara();
      let mode = resp["mode"];
      if (mode === "sahara") {
        await this.sahara?.uploadLoader();
      } else if (mode === "error") {
        throw "Error connecting to Sahara";
      }
      await this.firehose?.configure();
      this.mode = "firehose";
    } catch (error) {
      if (this._connectReject !== null) {
        this._connectReject(error);
        this._connectResolve = null;
        this._connectReject = null;
      }
    }

    if (this._connectResolve !== null) {
      this._connectResolve(undefined);
      this._connectResolve = null;
      this._connectReject = null;
    }
    return true;
  }

  async getGpt(lun, startSector=1) {
    let resp;
    resp = await this.firehose.cmdReadBuffer(lun, 0, 1);
    if (!resp.resp) {
      console.error(resp.error);
      return [null, null];
    }
    let data = concatUint8Array([resp.data, (await this.firehose.cmdReadBuffer(lun, startSector, 1)).data]);
    let guidGpt = new gpt.gpt();
    const header = guidGpt.parseHeader(data, this.firehose.cfg.SECTOR_SIZE_IN_BYTES);
    if (containsBytes("EFI PART", header.signature)) {
      const partTableSize = header.numPartEntries * header.partEntrySize;
      const sectors = Math.floor(partTableSize / this.firehose.cfg.SECTOR_SIZE_IN_BYTES);
      data = concatUint8Array([data, (await this.firehose.cmdReadBuffer(lun, header.partEntryStartLba, sectors)).data]);
      guidGpt.parse(data, this.firehose.cfg.SECTOR_SIZE_IN_BYTES);
      return [guidGpt, data];
    } else {
      throw "Error reading gpt header";
    }
  }

  async detectPartition(partitionName, sendFull=false) {
    const luns = this.firehose.luns;
    for (const lun of luns) {
      const [guidGpt, data] = await this.getGpt(lun);
      if (guidGpt === null) {
        break;
      } else {
        if (partitionName in guidGpt.partentries) {
          return sendFull ? [true, lun, data, guidGpt] : [true, lun, guidGpt.partentries[partitionName]];
        }
      }
    }
    return [false];
  }

  async flashBlob(partitionName, blob, onProgress=()=>{}) {
    let startSector = 0;
    let dp = await this.detectPartition(partitionName);
    const found = dp[0];
    if (found) {
      let lun = dp[1];
      const imgSize = blob.size;
      let imgSectors = Math.floor(imgSize / this.firehose.cfg.SECTOR_SIZE_IN_BYTES);
      if (imgSize % this.firehose.cfg.SECTOR_SIZE_IN_BYTES !== 0) {
        imgSectors += 1;
      }
      if (partitionName.toLowerCase() !== "gpt") {
        const partition = dp[2];
        if (imgSectors > partition.sectors) {
          console.error("partition has fewer sectors compared to the flashing image");
          return false;
        }
        startSector = partition.sector;
        console.log(`Flashing ${partitionName}...`);
        if (await this.firehose.cmdProgram(lun, startSector, blob, (progress) => onProgress(progress))) {
          console.log(`partition ${partitionName}: startSector ${partition.sector}, sectors ${partition.sectors}`);
        } else {
          throw `Error while writing ${partitionName}`;
        }
      }
    } else {
      throw `Can't find partition ${partitionName}`;
    }
    return true;
  }

  async erase(partitionName) {
    const luns = this.firehose.luns;
    for (const lun of luns) {
      let [guidGpt] = await this.getGpt(lun);
      if (partitionName in guidGpt.partentries) {
        const partition = guidGpt.partentries[partitionName];
        console.log(`Erasing ${partitionName}...`);
        await this.firehose.cmdErase(lun, partition.sector, partition.sectors);
        console.log(`Erased ${partitionName} starting at sector ${partition.sector} with sectors ${partition.sectors}`);
      } else {
        continue;
      }
    }
    return true;
  }

  async getDevicePartitionsInfo() {
    const slots = [];
    const partitions = [];
    const luns = this.firehose.luns;
    for (const lun of luns) {
      let [guidGpt] = await this.getGpt(lun);
      if (guidGpt === null) {
        throw "Error while reading device partitions";
      }
      for (let partition in guidGpt.partentries) {
        let slot = partition.slice(-2);
        if (slot === "_a" || slot === "_b") {
          partition = partition.substring(0, partition.length-2);
          if (!slots.includes(slot)) {
            slots.push(slot);
          }
        }
        if (!partitions.includes(partition)) {
          partitions.push(partition);
        }
      }
    }
    return [slots.length, partitions];
  }

  async getActiveSlot() {
    const luns = this.firehose.luns;
    for (const lun of luns) {
      const [guidGpt] = await this.getGpt(lun);
      if (guidGpt === null) {
        throw "Cannot get active slot."
      }
      for (const partitionName in guidGpt.partentries) {
        const slot = partitionName.slice(-2);
        // backup gpt header is more reliable, since it would always has the non-corrupted gpt header
        const [backupGuidGpt] = await this.getGpt(lun, guidGpt.header.backupLba);
        const partition = backupGuidGpt.partentries[partitionName];
        const active = (((BigInt(partition.flags) >> (BigInt(gpt.AB_FLAG_OFFSET) * BigInt(8))))
                      & BigInt(gpt.AB_PARTITION_ATTR_SLOT_ACTIVE)) === BigInt(gpt.AB_PARTITION_ATTR_SLOT_ACTIVE);
        if (slot == "_a" && active) {
          return "a";
        } else if (slot == "_b" && active) {
          return "b";
        }
      }
    }
    throw "Can't detect slot A or B";
  }

  patchNewGptData(gptDataA, gptDataB, guidGpt, partA, partB, slot_a_status, slot_b_status, isBoot) {
    const partEntrySize = guidGpt.header.partEntrySize;

    const sdataA = gptDataA.slice(partA.entryOffset, partA.entryOffset+partEntrySize);
    const sdataB = gptDataB.slice(partB.entryOffset, partB.entryOffset+partEntrySize);

    const partEntryA = new gpt.gptPartition(sdataA);
    const partEntryB = new gpt.gptPartition(sdataB);

    partEntryA.flags = gpt.setPartitionFlags(partEntryA.flags, slot_a_status, isBoot);
    partEntryB.flags = gpt.setPartitionFlags(partEntryB.flags, slot_b_status, isBoot);
    const tmp = partEntryB.type;
    partEntryB.type = partEntryA.type;
    partEntryA.type = tmp;
    const pDataA = partEntryA.create(), pDataB = partEntryB.create();

    return [pDataA, partA.entryOffset, pDataB, partB.entryOffset];
  }

  async setActiveSlot(slot) {
    slot = slot.toLowerCase();
    const luns = this.firehose.luns
    let slot_a_status, slot_b_status;

    if (slot == "a") {
      slot_a_status = true;
    } else if (slot == "b") {
      slot_a_status = false;
    }
    slot_b_status = !slot_a_status;

    for (const lunA of luns) {
      let checkGptHeader = false;
      let sameLun = false;
      let hasPartitionA = false;
      let [guidGptA, gptDataA] = await this.getGpt(lunA);
      let [backupGuidGptA, backupGptDataA] = await this.getGpt(lunA, guidGptA.header.backupLba);
      let lunB, gptDataB, guidGptB, backupGptDataB, backupGuidGptB;

      if (guidGptA === null) {
        throw "Error while getting gpt header data";
      }
      for (const partitionNameA in guidGptA.partentries) {
        let slotSuffix = partitionNameA.toLowerCase().slice(-2);
        if (slotSuffix !== "_a") {
          continue;
        }
        const partitionNameB = partitionNameA.slice(0, partitionNameA.length-1) + "b";
        let sts;
        if (!checkGptHeader) {
          hasPartitionA = true;
          if (partitionNameB in guidGptA.partentries) {
            lunB = lunA;
            sameLun = true;
            gptDataB = gptDataA;
            guidGptB = guidGptA;
            backupGptDataB = backupGptDataA;
            backupGuidGptB = backupGuidGptA;
          } else {
            const resp = await this.detectPartition(partitionNameB, true);
            sts = resp[0];
            if (!sts) {
              throw `Cannot find partition ${partitionNameB}`;
            }
            [sts, lunB, gptDataB, guidGptB] = resp;
            [backupGuidGptB, backupGptDataB] = await this.getGpt(lunB, guidGptB.header.backupLba);
          }
        }

        if (!checkGptHeader && partitionNameA.slice(0, 3) !== "xbl") { // xbl partitions aren't affected by failure of changing slot, saves time
          gptDataA = gpt.ensureGptHdrConsistency(gptDataA, backupGptDataA, guidGptA, backupGuidGptA);
          if (!sameLun) {
            gptDataB = gpt.ensureGptHdrConsistency(gptDataB, backupGptDataB, guidGptB, backupGuidGptB);
          }
          checkGptHeader = true;
        }

        const partA = guidGptA.partentries[partitionNameA];
        const partB = guidGptB.partentries[partitionNameB];

        let isBoot = false;
        if (partitionNameA === "boot_a") {
          isBoot = true;
        }
        const [pDataA, pOffsetA, pDataB, pOffsetB] = this.patchNewGptData(
          gptDataA, gptDataB, guidGptA, partA, partB, slot_a_status, slot_b_status, isBoot
        );

        gptDataA.set(pDataA, pOffsetA)
        guidGptA.fixGptCrc(gptDataA);
        if (lunA === lunB) {
          gptDataB = gptDataA;
        }
        gptDataB.set(pDataB, pOffsetB)
        guidGptB.fixGptCrc(gptDataB);
      }

      if (!hasPartitionA) {
        continue;
      }
      const writeOffset = this.firehose.cfg.SECTOR_SIZE_IN_BYTES;
      const gptBlobA = new Blob([gptDataA.slice(writeOffset)]);
      await this.firehose.cmdProgram(lunA, 1, gptBlobA);
      if (!sameLun) {
        const gptBlobB = new Blob([gptDataB.slice(writeOffset)]);
        await this.firehose.cmdProgram(lunB, 1, gptBlobB);
      }
    }
    const activeBootLunId = (slot === "a") ? 1 : 2;
    await this.firehose.cmdSetBootLunId(activeBootLunId);
    console.log(`Successfully set slot ${slot} active`);
    return true;
  }

  async reset() {
    await this.firehose.cmdReset();
    return true;
  }
}
