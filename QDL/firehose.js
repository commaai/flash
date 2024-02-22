import { xmlParser } from "./xmlParser"
import { concatUint8Array, containsBytes, compareStringToBytes, sleep, loadFileFromLocal } from "./utils"
import { gpt } from "./gpt"


class response {
  constructor(resp=false, data=new Uint8Array(), error="", log=[]) {
    this.resp = resp;
    this.data = data;
    this.error = error;
    this.log = log;
  }
}

class cfg {
  constructor() {
    this.TargetName = "";
    this.Version = "";
    this.ZLPAwareHost = 1;
    this.SkipStorageInit = 0;
    this.SkipWrite = 0;
    this.MaxPayloadSizeToTargetInBytes = 1048576;
    this.MaxPayloadSizeFromTargetInBytes = 8192;
    this.MaxXMLSizeInBytes = 4096;
    this.bit64 = true;
    this.total_blocks = 0;
    this.num_physical = 0;
    this.block_size = 0;
    this.SECTOR_SIZE_IN_BYTES = 0;
    this.MemoryName = "UFS";
    this.prod_name = "Unknown";
    this.maxlun = 99;
  }
}

export class Firehose {
  cdc;
  xml;
  cfg

  constructor(cdc) {
    this.cdc = cdc;
    this.xml = new xmlParser();
    this.cfg = new cfg();
    this.luns = [];
  }

  async configure(lvl) {
    if (this.cfg.SECTOR_SIZE_IN_BYTES == 0)
      this.cfg.SECTOR_SIZE_IN_BYTES = 4096
    let connectCmd = `<?xml version=\"1.0\" encoding=\"UTF-8\" ?><data>` +
              `<configure MemoryName=\"${this.cfg.MemoryName}\" ` +
              `Verbose=\"0\" ` +
              `AlwaysValidate=\"0\" ` +
              `MaxDigestTableSizeInBytes=\"2048\" ` +
              `MaxPayloadSizeToTargetInBytes=\"${this.cfg.MaxPayloadSizeToTargetInBytes}\" ` +
              `ZLPAwareHost=\"${this.cfg.ZLPAwareHost}\" ` +
              `SkipStorageInit=\"${this.cfg.SkipStorageInit}\" ` +
              `SkipWrite=\"${this.cfg.SkipWrite}\"/>` +
              `</data>`

    // TODO: Transfer connectCmd to Uint8Array
    //let rsp = await this.xmlSend(connectCmd, false);
    //return true;
    let rsp = await this.xmlSend(connectCmd, false);
    if (rsp === null || !rsp.resp) {
      if (rsp.error == "") {
        return await this.configure(lvl+1);
      }
    } else {
      await this.parseStorage();
      this.luns = this.getLuns();
      return true;
    }
  }


  getLuns() {
    let luns = [];
    for (let i=0; i < this.cfg.maxlun; i++)
      luns.push(i);
    return luns;
  }


  async parseStorage() {
    const storageInfo = await this.getStorageInfo();
    if (storageInfo === null || storageInfo.resp && storageInfo.data.length === 0)
      return false;
    const info = storageInfo.data;
    if (info.hasOwnProperty("UFS Inquiry Command Output")) {
      this.cfg.prod_name = info["UFS Inquiry Command Output"];
    }
    if (info.hasOwnProperty("UFS Erase Block Size")) {
      this.cfg.block_size = parseInt(info["UFS Erase Block Size"]);
      this.cfg.MemoryName = "UFS";
      this.cfg.SECTOR_SIZE_IN_BYTES = 4096;
    }
    if (info.hasOwnProperty("UFS Total Active LU")) {
      this.cfg.maxlun = parseInt(info["UFS Total Active LU"]);
    }
    if (info.hasOwnProperty("SECTOR_SIZE_IN_BYTES")) {
      this.cfg.SECTOR_SIZE_IN_BYTES = parseInt(info["SECTOR_SIZE_IN_BYTES"]);
    }
    if (info.hasOwnProperty("num_physical_partitions")) {
      this.cfg.num_physical = parseInt(info["num_physical_partitions"])
    }
    return true;
  }


  async getStorageInfo() {
    const data = "<?xml version=\"1.0\" ?><data><getstorageinfo physical_partition_number=\"0\"/></data>";
    let val = await this.xmlSend(data);
    if (compareStringToBytes("", val.data) && val.log.length == 0 && val.resp)
      return null;
    if (val.resp) {
      if (val.log !== null) {
        let res = {};
        let v;
        for (const value of val.log) {
          v = value.split("=");
          if (v.length > 1) {
            res[v[0]] = v[1];
          } else {
            if (!value.includes("\"storage_info\"")) {
              v = value.split(":");
              if (v.length > 1)
                res[v[0]] = v[1].trimStart();
            }
          }
        }
        return { resp: val.resp, data : res};
      }
      return { resp : val.resp, data : val.data};
    } else {
      if (!val.error !== null && !val.error !== "") {
        console.error("failed to open SDCC device");
      }
      return null;
    }
  }


  async xmlSend(data, wait=true) {
    let dataToSend = new TextEncoder().encode(data).slice(0, this.cfg.MaxXMLSizeInBytes);
    await this.cdc?._usbWrite(dataToSend, null, wait);
    let rData = new Uint8Array(); // response data in bytes
    let counter = 0;
    let timeout = 0;
    while (!(containsBytes("<response value", rData))) {
      try {
        let tmp = await this.cdc?._usbRead();
        if (compareStringToBytes("", tmp)) {
          counter += 1;
          await sleep(50);
          if (counter > timeout)
            break;
        }
        rData = concatUint8Array([rData, tmp]);
      } catch (error) {
        console.error(error);
      }
    }
    try {
      const resp = this.xml.getReponse(rData); // input is Uint8Array
      const status = this.getStatus(resp);
      if (resp.hasOwnProperty("rawmode")) {
        if (resp["rawmode"] == "false") {
          let log = this.xml.getLog(rData);
          return new response(status, rData, "", log)
        }
      } else { 
        if (status) {
          if (containsBytes("log value=", rData)) {
            let log = this.xml.getLog(rData);
            //return { resp : status, data : rData, log : log, error : "" }; // TODO: getLog()
            return new response(status, rData, "", log);
          }
          return new response(status, rData);
        }
      }
    } catch (error) {
      console.error(error);
    }
    return new response(true, rData);
  }

  
  async cmdReset() {
    let data = "<?xml version=\"1.0\" ?><data><power value=\"reset\"/></data>";
    let val = await this.xmlSend(data);
    if (val.resp) {
      console.log("Reset succeeded");
      return true;
    } else {
      console.error("Reset failed");
      return false;
    }
  }


  async detectPartition(partitionName) {
    let fPartitions = {};
    for (const lun of this.luns) {
      const lunName = "Lun" + lun.toString();
      fPartitions[lunName] = []
      const gptNumPartEntries = 0;
      const gptPartEntrySize = 0;
      const gptPartEntryStartLba = 0;
      let [ data, guidGpt ] = await this.getGpt(lun, gptNumPartEntries, gptPartEntrySize, gptPartEntryStartLba);
      if (guidGpt === null) {
        break;
      } else {
        if (guidGpt.partentries.hasOwnProperty(partitionName)) {
          return [true, lun, guidGpt.partentries[partitionName]]
        }
      }
      for (const part in guidGpt.partentries)
        fPartitions[lunName] = part;
    }
    return [false, fPartitions]
  }


  async getGpt(lun, gptNumPartEntries, gptPartEntrySize, gptPartEntryStartLba) {
    let resp;
    try {
      resp = await this.cmdReadBuffer(lun, 0, 2);
    } catch (error) {
      console.error(error);
    }
    if (!resp.resp) {
      console.error(resp.error);
      return [null, null];
    }
    let data = resp.data;
    let guidGpt = new gpt(gptNumPartEntries, gptPartEntrySize, gptPartEntryStartLba);
    try {
      const header = guidGpt.parseHeader(data, this.cfg.SECTOR_SIZE_IN_BYTES);
      if (containsBytes("EFI PART", header.signature)) {
        const gptSize =   (header.part_entry_start_lba * this.cfg.SECTOR_SIZE_IN_BYTES) +
                        (header.num_part_entries * header.part_entry_size);
        let sectors = Math.floor(gptSize / this.cfg.SECTOR_SIZE_IN_BYTES);
        if (gptSize % this.cfg.SECTOR_SIZE_IN_BYTES != 0)
          sectors += 1;
        if (sectors === 0)
          sectors = 64;
        if (sectors > 64)
          sectors = 64;
        data = await this.cmdReadBuffer(lun, 0, sectors);
        if (compareStringToBytes("", data.data))
          return [null, null];
        guidGpt.parse(data.data, this.cfg.SECTOR_SIZE_IN_BYTES);
        return [data.data, guidGpt];
      } else {
        return [null, null];
      }
    } catch (error) {
      console.error(error);
      return [null, null]
    }
  }


  async cmdReadBuffer(physicalPartitionNumber, startSector, numPartitionSectors) {
    //let prog = 0;
    const data = `<?xml version=\"1.0\" ?><data><read SECTOR_SIZE_IN_BYTES=\"${this.cfg.SECTOR_SIZE_IN_BYTES}\"` +
        ` num_partition_sectors=\"${numPartitionSectors}\"` +
        ` physical_partition_number=\"${physicalPartitionNumber}\"` +
        ` start_sector=\"${startSector}\"/>\n</data>`
    let rsp = await this.xmlSend(data);
    let resData = new Uint8Array();
    if (!rsp.resp){
      return rsp
    } else {
      let bytesToRead = this.cfg.SECTOR_SIZE_IN_BYTES * numPartitionSectors;
      let total = bytesToRead; // for progress bar
      while (bytesToRead > 0) {
        let tmp = await this.cdc._usbRead(Math.min(this.cdc.maxSize, bytesToRead));
        const size = tmp.length;
        bytesToRead -= size;
        resData = concatUint8Array([resData, tmp]);
      }
      const wd = await this.waitForData();
      const info = this.xml.getLog(wd);
      rsp = this.xml.getReponse(wd);
      if (rsp.hasOwnProperty("value")) { 
        if (rsp["value"] !== "ACK") {
          return new response(false, resData, info);
        } else if (rsp.hasOwnProperty("rawmode")) {
          if (rsp["rawmode"] === "false")
            return new response(true, resData);
        }
      } else {
        console.error("Failed read buffer");
        return new response(false, resData, rsp[2]);
      }
    }
    let resp = rsp["value"] === "ACK";
    return response(resp, resData, rsp[2]);
  }


  async waitForData() {
    let tmp = new Uint8Array();
    let timeout = 0;
    while (!containsBytes("response value", tmp)) {
      let res = await this.cdc._usbRead();
      if (compareStringToBytes("", res)) {
        timeout += 1;
        if (timeout === 4){
          break;
        }
        await sleep(20);
      }
      tmp = concatUint8Array([tmp, res]);
    }
    return tmp;
  }


  // display?
  async cmdProgram(physicalPartitionNumber, startSector, fileName) {
    let fname = new Uint8Array(await loadFileFromLocal())
  }


  getStatus(resp) {
    if (resp.hasOwnProperty("value")) {
      let value = resp["value"];
      if (value == "ACK" || value == "true" ) {
        return true;
      } else {
        return false;
      }
    }
    return true;
  }
}
