import { usbClass } from "./usblib"
import { Sahara } from  "./sahara"
import { Firehose } from "./firehose"
import { loadFileFromLocal } from "./utils";

export class qdlDevice {
  cdc;
  sahara;

  constructor() {
    this.cdc = new usbClass();
    this.sahara = new Sahara(this.cdc);
    this.firehose = new Firehose(this.cdc);
  }

  async doconnect() {
    while (!this.cdc.connected){
      await this.cdc?.connect();
      if (this.cdc.connected){
        console.log("Device detected");
        try {
          let resp = await this.sahara?.connect();
          if (resp.hasOwnProperty("mode")){
            let mode = resp["mode"];
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

  /** TODO: check for connected to sahara 
   * or mode = firehose then don't need to connect
   */

  async flasbBlob(partitionName) {
    let startSector = 0;
    let dp = await this.firehose?.detectPartition(partitionName);
    if (dp[0]) {
      let lun = dp[1];
      const imgSize = new Uint8Array(await loadFileFromLocal()).length;
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
        //console.log(`startSector of ${partitionName} is ${startSector}`);
        if (await this.firehose.cmdProgram(lun, startSector, "")) {
          console.log(`Wrote to startSector: ${startSector}`);
        } else {
          console.error("Error writing image");
        }
      }
    }
  }

  async erase(partitionName) {
    let luns = this.firehose.getLuns();
    let gptNumPartEntries = 0, gptPartEntrySize = 0, gptPartEntryStartLba = 0;
    for (const lun of luns) {
      let [ data, guidGpt ] = await this.firehose.getGpt(lun, gptNumPartEntries, gptPartEntrySize, gptPartEntryStartLba);
      if (guidGpt === null)
        break;
      if (guidGpt.partentries.hasOwnProperty(partitionName)) {
        const partition = guidGpt.partentries[partitionName];
        console.log(`partition ${partitionName}: startSector ${partition.sector}, sectors: ${partition.sectors}`);
        await this.firehose.cmdErase(lun, partition.sector, partition.sectors);
        console.log(`Erased ${partitionName} starting at sector ${partition.sector} with sector count ${partition.sectors}`)
      } else {
        console.log(`Couldn't erase partition ${partitionName}. Either wrong type or not in lun ${lun}`);
        continue;
      }
    }
  }
  
  async reset() {
    try {
      let resp = await this.doconnect();
      let mode = resp["mode"];
      if (mode === "sahara") {
        let mode = await this.sahara?.uploadLoader(2); // version 2
        console.log("mode from uploadloader:", mode);
      }
      await this.firehose?.configure(0);
      await this.erase("cache");
      await this.firehose?.cmdReset();
    } catch (error) {
      console.error(error);
    }
  }
}
