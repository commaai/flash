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
  async reset() {
    try {
      let resp = await this.doconnect();
      let mode = resp["mode"];
      if (mode === "sahara") {
        let mode = await this.sahara?.uploadLoader(2); // version 2
        console.log("mode from uploadloader:", mode);
      }
      await this.firehose?.configure(0);

      let startSector = 0;
      let partitionName = "boot";
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

      await this.firehose?.cmdReset();
    } catch (error) {
      console.error(error);
    }
  }
}
