import { usbClass } from "./usblib"
import { Sahara } from  "./sahara"
import { Firehose } from "./firehose"
import { loadFileFromLocal } from "./utils";

// TODO: reset from sahara mode

export class qdlDevice {
  cdc;
  sahara;
  mode;

  constructor() {
    this.mode = "";
    this.cdc = new usbClass();
    this.sahara = new Sahara(this.cdc);
    this.firehose = new Firehose(this.cdc);
  }

  async connectToSahara() {
    while (!this.cdc.connected){
      await this.cdc?.connect();
      if (this.cdc.connected){
        console.log("Device detected");
        try {
          let resp = await this.sahara?.connect();
          if (resp.hasOwnProperty("mode")){
            let mode = resp["mode"];
            this.mode = mode;
            console.log("Mode detected:", mode);
            return resp;
          }
        } catch (error) {
          console.error(error);
        }
      }
    }
    return {"mode" : "error"};
  }


  async flashBlob(partitionName, blob) {
    if (this.mode !== "firehose") {
      console.error("Please try again, must be in command mode to flash")
      return false;
    }
    let startSector = 0;
    let dp = await this.firehose?.detectPartition(partitionName);
    if (dp[0]) {
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
        console.log(`Writing to partition ${partitionName}: startSector ${partition.sector} including ${partition.sectors} sectors`);
        if (await this.firehose.cmdProgram(lun, startSector, blob)) {
          console.log(`Wrote to startSector: ${startSector}`);
        } else {
          console.error("Error writing image");
        }
      }
    }
    return true;
  }


  async erase(partitionName) {
    if (this.mode !== "firehose") {
      console.error("Please try again, must be in command mode to erase")
      return false;
    }
    let luns = this.firehose.getLuns();
    let gptNumPartEntries = 0, gptPartEntrySize = 0, gptPartEntryStartLba = 0;
    for (const lun of luns) {
      let [ data, guidGpt ] = await this.firehose.getGpt(lun, gptNumPartEntries, gptPartEntrySize, gptPartEntryStartLba);
      if (guidGpt === null)
        break;
      if (guidGpt.partentries.hasOwnProperty(partitionName)) {
        const partition = guidGpt.partentries[partitionName];
        console.log(`partition ${partitionName}: startSector ${partition.sector}, sectors ${partition.sectors}`);
        await this.firehose.cmdErase(lun, partition.sector, partition.sectors);
        console.log(`Erased ${partitionName} starting at sector ${partition.sector} with sector count ${partition.sectors}`)
      } else {
        console.log(`Couldn't erase partition ${partitionName}. Either wrong type or not in lun ${lun}`);
        continue;
      }
    }
    return true;
  }

  
  async getActiveSlot() {
    if (this.mode !== "firehose") {
      console.error("Please try again, must be in command mode to get active slot")
      return false;
    }
    const luns = this.firehose?.getLuns();
    let gptNumPartEntries = 0, gptPartEntrySize = 0, gptPartEntryStartLba = 0;
    //for (const lun of luns) {
    const lun = luns[0];
    let [ data, guidGpt ] = await this.firehose.getGpt(lun, gptNumPartEntries, gptPartEntrySize, gptPartEntryStartLba);
    if (guidGpt === null)
      return ""
    for (const partitionName in guidGpt.partentries) {
      const slot = partitionName.slice(-2);
      if (slot == "_a") {
        return "a";
      } else if (slot == "b") {
        return "b";
      } else {
        console.error("Can't detect slot A or B");
        return ""
      }
    }
    //}
    return true;
  }


  async setActvieSlot(slot) {
    if (this.mode !== "firehose") {
      console.error("Please try again, must be in command mode to set active slot");
      return false;
    }
    try {
      await this.firehose.cmdSetActiveSlot(slot);
      return true;
    } catch (error) {
      console.error(`Error while setting active slot: ${error}`)
      return false;
    }
    return true;
  }


  async transferToCmdMode() {
    let resp = await this.connectToSahara();
    let mode = resp["mode"];
    if (mode === "sahara")
      await this.sahara?.uploadLoader(2); // version 2
    await this.firehose?.configure(0);
    this.mode = "firehose";
    return true;
  }


  async reset() {
    if (this.mode !== "firehose") {
      console.error("Please try again, must be in command mode reset")
      return false;
    }
    try {
      await this.firehose?.cmdReset();
    } catch (error) {
      console.error(error);
    }
    return true;
  }


  // TODO: run() is for testing, will be deleted so that qdl.js is a module
  async run() {
    try {
      let flashPartition = "boot";
      let erasePartition = "cache";

      await this.transferToCmdMode();

      let blob = await loadFileFromLocal();
      await this.flashBlob(flashPartition, blob);

      await this.erase(erasePartition)

      await this.reset();

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}