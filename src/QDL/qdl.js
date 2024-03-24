import { usbClass } from "./usblib"
import { Sahara } from  "./sahara"
import { Firehose } from "./firehose"
import { AB_FLAG_OFFSET, AB_PARTITION_ATTR_SLOT_ACTIVE } from "./gpt"
import { concatUint8Array, runWithTimeout } from "./utils"


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
        if (resp.hasOwnProperty("mode")) {
          this.mode = resp["mode"];
          console.log("Mode detected:", this.mode);
          return resp;
        }
      }
    }
    return {"mode" : "error"};
  }


  async flashBlob(partitionName, blob, onProgress=(_progress)=>{}) {
    let startSector = 0;
    let dp = await this.firehose?.detectPartition(partitionName);
    const found = dp[0];
    if (found) {
      let lun = dp[1];
      const imgSize = blob.size;
      let imgSectors = Math.floor(imgSize/this.firehose.cfg.SECTOR_SIZE_IN_BYTES);
      if (imgSize % this.firehose.cfg.SECTOR_SIZE_IN_BYTES !== 0)
        imgSectors += 1;
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
          throw new Error(`Errow while writing ${partitionName}`);
        }
      }
    } else {
      throw new Error(`Can't find partition ${partitionName}`);
    }
    return true;
  }


  async resetUserdata() {
    let dp = await this.firehose?.detectPartition("userdata");
    const found = dp[0];
    if (found) {
      const lun = dp[1], partition = dp[2];
      let wData = new TextEncoder().encode("COMMA_RESET");
      wData = concatUint8Array([wData, new Uint8Array(28).fill(0)]);
      const startSector = partition.sector;
      console.log("Writing reset flag to partition \"userdata\"");
      if (await this.firehose.cmdProgram(lun, startSector, new Blob([wData.buffer]), () => {}, true)) {
        console.log("Successfully writing reset flag to userdata");
      } else {
        throw new Error("Error writing reset flag to userdata");
      }
    } else {
      throw new Error("Can't find partition userdata");
    }
    return true;
  }


  async getDevicePartitions() {
    const slots = [];
    const partitions = [];
    const luns = this.firehose.luns;
    let gptNumPartEntries = 0, gptPartEntrySize = 0, gptPartEntryStartLba = 0;
    for (const lun of luns) {
      let [ data, guidGpt ] = await this.firehose.getGpt(lun, gptNumPartEntries, gptPartEntrySize, gptPartEntryStartLba);
      if (guidGpt === null)
        throw new Error("Error while reading device partitions");
      for (let partition in guidGpt.partentries) {
        let slot = partition.slice(-2);
        if (slot === "_a" || slot === "_b") {
          partition = partition.substring(0, partition.length-2);
          if (!slots.includes(slot))
            slots.push(slot);
        }
        if (!partitions.includes(partition))
          partitions.push(partition);
      }
    }
    return [slots.length, partitions];
  }


  async getActiveSlot() {
    const luns = this.firehose.luns;
    let gptNumPartEntries = 0, gptPartEntrySize = 0, gptPartEntryStartLba = 0;
    for (const lun of luns) {
      let [ data, guidGpt ] = await this.firehose.getGpt(lun, gptNumPartEntries, gptPartEntrySize, gptPartEntryStartLba);
      if (guidGpt === null)
        return "";
      for (const partitionName in guidGpt.partentries) {
        const slot = partitionName.slice(-2);
        const partition = guidGpt.partentries[partitionName];
        const active = (((BigInt(partition.flags) >> (BigInt(AB_FLAG_OFFSET) * BigInt(8))))
                      & BigInt(AB_PARTITION_ATTR_SLOT_ACTIVE)) === BigInt(AB_PARTITION_ATTR_SLOT_ACTIVE);
        if (slot == "_a" && active) {
          return "a";
        } else if (slot == "_b" && active) {
          return "b";
        }
      }
    }
    throw new Error("Can't detect slot A or B");
  }


  async connect() {
    try {
      let resp = await this.connectToSahara();
      let mode = resp["mode"];
      if (mode === "sahara") {
        await this.sahara?.uploadLoader();
      } else if (mode === "error") {
        throw new Error("Error connecting to Sahara");
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


  async setActvieSlot(slot) {
    await this.firehose.cmdSetActiveSlot(slot);
    return true;
  }


  async reset() {
    await this.firehose?.cmdReset();
    return true;
  }
}
