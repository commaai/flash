import { xmlParser } from "./xmlParser"
import { concatUint8Array, containsBytes, compareStringToBytes, sleep, fromUint8ArrayToNumber, readBlobAsBuffer } from "./utils"
import * as gpt from "./gpt"
import * as Sparse from "./sparse";


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
    //this.MaxPayloadSizeToTargetInBytes = 32768;
    this.MaxPayloadSizeFromTargetInBytes = 4096;
    this.MaxXMLSizeInBytes = 4096;
    this.bit64 = true;
    this.total_blocks = 0;
    this.num_physical = 0;
    this.block_size = 0;
    this.SECTOR_SIZE_IN_BYTES = 4096; // ufs sector size is 4096
    this.MemoryName = "UFS";
    this.prod_name = "Unknown";
    this.maxlun = 6;
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


  async xmlSend(data, wait=true) {
    let dataToSend = new TextEncoder().encode(data).slice(0, this.cfg.MaxXMLSizeInBytes);
    await this.cdc?.write(dataToSend, null, wait);

    let rData   = new Uint8Array(); // response data in bytes
    let counter = 0;
    let timeout = 0;

    while (!(containsBytes("<response value", rData))) {
      try {
        let tmp = await this.cdc?.read();
        if (compareStringToBytes("", tmp)) {
          counter += 1;
          await sleep(50);
          if (counter > timeout)
            break;
        }
        rData = concatUint8Array([rData, tmp]);
      } catch (error) {
        throw new Error("Error connecting with Firehose:", error)
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


  async configure(lvl) {
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

    let rsp = await this.xmlSend(connectCmd, false);
    if (rsp === null || !rsp.resp | rsp === undefined ) {
      if (rsp.error == "") {
        return await this.configure(lvl+1);
      }
    } else {
      // TODO: delete if not needed
      if (typeof rsp.resp === "object") {
        let field = rsp.resp;
        if (field.hasOwnProperty("MaxPayloadSizeToTargetInBytes")) {
          this.cfg.MaxPayloadSizeToTargetInBytes = parseInt(field["MaxPayloadSizeToTargetInBytes"]);
        }
        if (field.hasOwnProperty("MaxXMLSizeInBytes")) {
          this.cfg.MaxXMLSizeInBytes = parseInt(field["MaxXMLSizeInBytes"]);
        }
        if (field.hasOwnProperty("MaxPayloadSizeFromTargetInBytes")) {
          this.cfg.MaxPayloadSizeFromTargetInBytes = parseInt(field["MaxPayloadSizeFromTargetInBytes"]);
        }
        if (lvl == 0) {
          return this.configure(lvl + 1);
        }
      }
      await this.parseStorage();
      this.luns = this.getLuns();
      return true;
    }
  }


  // TODO: better auto detect maxlun
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
        return new response(val.resp, res);
      }
      return new response(val.resp, val.data);
    } else {
      if (!val.error !== null && !val.error !== "") {
        console.error("failed to open SDCC device");
      }
      return null;
    }
  }


  async detectPartition(partitionName, sendFull=false) {
    let fPartitions = {};
    for (const lun of this.luns) {

      const lunName               = "Lun" + lun.toString();
      fPartitions[lunName]        = []
      const gptNumPartEntries     = 0;
      const gptPartEntrySize      = 0;
      const gptPartEntryStartLba  = 0;

      const [ data, guidGpt ] = await this.getGpt(lun, gptNumPartEntries, gptPartEntrySize, gptPartEntryStartLba);
      if (guidGpt === null) {
        break;
      } else {
        if (guidGpt.partentries.hasOwnProperty(partitionName)) {

          return sendFull ? [true, lun, data, guidGpt] : [true, lun, guidGpt.partentries[partitionName]];
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

    let data    = resp.data;
    let guidGpt = new gpt.gpt(gptNumPartEntries, gptPartEntrySize, gptPartEntryStartLba);

    try {
      const header = guidGpt.parseHeader(data, this.cfg.SECTOR_SIZE_IN_BYTES);
      if (containsBytes("EFI PART", header.signature)) {
        const gptSize = (header.part_entry_start_lba * this.cfg.SECTOR_SIZE_IN_BYTES) +
                        header.num_part_entries * header.part_entry_size;
        let sectors   = Math.floor(gptSize / this.cfg.SECTOR_SIZE_IN_BYTES);
        if (gptSize % this.cfg.SECTOR_SIZE_IN_BYTES != 0)
          sectors += 1;
        if (sectors == 0)
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
    const data = `<?xml version=\"1.0\" ?><data><read SECTOR_SIZE_IN_BYTES=\"${this.cfg.SECTOR_SIZE_IN_BYTES}\"` +
        ` num_partition_sectors=\"${numPartitionSectors}\"` +
        ` physical_partition_number=\"${physicalPartitionNumber}\"` +
        ` start_sector=\"${startSector}\"/>\n</data>`

    let rsp     = await this.xmlSend(data);
    let resData = new Uint8Array();

    if (!rsp.resp) {
      return rsp
    } else {
      let bytesToRead = this.cfg.SECTOR_SIZE_IN_BYTES * numPartitionSectors;
      while (bytesToRead > 0) {
        let tmp     = await this.cdc.read(Math.min(this.cdc.maxSize, bytesToRead));
        const size  = tmp.length;
        bytesToRead-= size;
        resData     = concatUint8Array([resData, tmp]);
      }

      const wd    = await this.waitForData();
      const info  = this.xml.getLog(wd);
      rsp         = this.xml.getReponse(wd);

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
    let tmp     = new Uint8Array();
    let timeout = 0;

    while (!containsBytes("response value", tmp)) {
      let res = await this.cdc.read();
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


  async cmdProgram(physicalPartitionNumber, startSector, blob, onProgress=()=>{}, userdataReset=false) {
    let total         = blob.size;
    let sparseformat  = false;

    if (!userdataReset) {
      let sparseHeader = await Sparse.parseFileHeader(blob.slice(0, Sparse.FILE_HEADER_SIZE));
      let sparseImage;
      if (sparseHeader !== null) {
        sparseImage   = new Sparse.QCSparse(blob, sparseHeader)
        sparseformat  = true;
        total         = await sparseImage.getSize();
        console.log("size of image:", total);
      }
    }

    let numPartitionSectors = Math.floor(total/this.cfg.SECTOR_SIZE_IN_BYTES);
    if (total % this.cfg.SECTOR_SIZE_IN_BYTES != 0)
      numPartitionSectors += 1;

    const data  = `<?xml version=\"1.0\" ?><data>\n` +
              `<program SECTOR_SIZE_IN_BYTES=\"${this.cfg.SECTOR_SIZE_IN_BYTES}\"` +
              ` num_partition_sectors=\"${numPartitionSectors}\"` +
              ` physical_partition_number=\"${physicalPartitionNumber}\"` +
              ` start_sector=\"${startSector}\" />\n</data>`;
    let rsp     = await this.xmlSend(data);
    let i = 0, bytesWritten = 0;

    if (rsp.resp) {
      for await (let split of Sparse.splitBlob(blob)) {
        let offset            = 0;
        let bytesToWriteSplit = split.size;

        while (bytesToWriteSplit > 0) {
          const wlen = Math.min(bytesToWriteSplit, this.cfg.MaxPayloadSizeToTargetInBytes);
          let wdata = new Uint8Array(await readBlobAsBuffer(split.slice(offset, offset + wlen)));
          if (wlen % this.cfg.SECTOR_SIZE_IN_BYTES !== 0){
            let fillLen = (Math.floor(wlen/this.cfg.SECTOR_SIZE_IN_BYTES) * this.cfg.SECTOR_SIZE_IN_BYTES) +
                          this.cfg.SECTOR_SIZE_IN_BYTES;
            const fillArray = new Uint8Array(fillLen-wlen).fill(0x00);
            wdata = concatUint8Array([wdata, fillArray]);
          }
          await this.cdc.write(wdata);
          await this.cdc.write(new Uint8Array(0), null, true, true);
          offset             += wlen;
          bytesToWriteSplit  -= wlen;
          bytesWritten       += wlen;
          // ??? why do I need this for sparse? maybe because I split and doesn't fill the whole data?
          if (sparseformat && bytesWritten < total)
            await this.cdc.write(new Uint8Array(0), null, true, true);
          if (i % 10 === 0)
            onProgress(bytesWritten/total);
          i += 1;
        }
      }
      const wd  = await this.waitForData();
      const resposne = this.xml.getReponse(wd);
      if (resposne.hasOwnProperty("value")) {
        if (resposne["value"] !== "ACK") {
          console.error("ERROR")
          return false;
        }
      } else {
        console.error("Error:", resposne);
        return false;
      }
    }
    onProgress(1.0);
    return true;
  }

  async cmdPatchMultiple(lun, startSector, byteOffset, patchData) {
    const writeSize     = patchData.length;
    const sizeEachPatch = 4;
    let offset          = 0;
    for (let i = 0; i < writeSize; i += sizeEachPatch) {
      const pdataSubset = fromUint8ArrayToNumber(patchData.slice(offset, offset+sizeEachPatch));
      await this.cmdPatch(lun, startSector, byteOffset+offset, pdataSubset, sizeEachPatch);
      offset += sizeEachPatch;
    }
    return true;
  }

  setPartitionFlags(flags, active, isBoot) {
    let newFlags = BigInt(flags);
    if (active) {
      if (isBoot) {
        //newFlags |= (gpt.PART_ATT_PRIORITY_VAL | gpt.PART_ATT_ACTIVE_VAL | gpt.PART_ATT_MAX_RETRY_COUNT_VAL);
        //newFlags &= (~gpt.PART_ATT_SUCCESSFUL_VAL & ~gpt.PART_ATT_UNBOOTABLE_VAL);
        newFlags = BigInt(0x006f) << gpt.PART_ATT_PRIORITY_BIT;
      } else {
        newFlags |= gpt.PART_ATT_ACTIVE_VAL;
      }
    } else {
      if (isBoot) {
        //newFlags &= (~gpt.PART_ATT_PRIORITY_VAL & ~gpt.PART_ATT_ACTIVE_VAL);
        //newFlags |= ((gpt.MAX_PRIORITY-BigInt(1)) << gpt.PART_ATT_PRIORITY_BIT);
        newFlags = BigInt(0x003a) << gpt.PART_ATT_PRIORITY_BIT;
      } else {
        newFlags &= ~gpt.PART_ATT_ACTIVE_VAL;
      }
    }
    return Number(newFlags);
  }

  patchSetActiveHelper(headerA, headerB, guidGpt, partA, partB, slot_a_status, slot_b_status, isBoot) {
    const partEntrySize = guidGpt.header.part_entry_size;

    const sdataA = headerA.slice(partA.entryOffset, partA.entryOffset+partEntrySize);
    const sdataB = headerB.slice(partB.entryOffset, partB.entryOffset+partEntrySize);

    const partEntryA = new gpt.gptPartition(sdataA);
    const partEntryB = new gpt.gptPartition(sdataB);

    partEntryA.flags = this.setPartitionFlags(partEntryA.flags, slot_a_status, isBoot);
    partEntryB.flags = this.setPartitionFlags(partEntryB.flags, slot_b_status, isBoot);
    const tmp        = partEntryB.type;
    partEntryB.type  = partEntryA.type;
    partEntryA.type  = tmp;
    const pDataA = partEntryA.create(), pDataB = partEntryB.create();

    return [pDataA, partA.entryOffset, pDataB, partB.entryOffset];
  }


  async cmdSetActiveSlot(slot) {
    slot          = slot.toLowerCase();
    const luns    = this.getLuns();
    let slot_a_status, slot_b_status;

    if (slot == "a") {
      slot_a_status = true;
    } else if (slot == "b") {
      slot_a_status = false;
    } else {
      console.error("Only slots a or b are accepted. Aborting.");
      return false;
    }
    slot_b_status = !slot_a_status;

    try {
      for (const lunA of luns) {
        let [ headerA, guidGptA ] = await this.getGpt(lunA, 0, 0, 0);
        if (guidGptA === null)
          break;
        for (const partitionNameA in guidGptA.partentries) {
          let slotSuffix      = partitionNameA.toLowerCase().slice(-2);
          if (slotSuffix === "_a") {
            const partitionNameB = partitionNameA.slice(0, partitionNameA.length-1) + "b";
            let sts, lunB, headerB, guidGptB;
            if (guidGptA.partentries.hasOwnProperty(partitionNameB)) {
              lunB = lunA;
              headerB = headerA;
              guidGptB = guidGptA;
            } else {
              const resp = await this.detectPartition(partitionNameB, true);
              sts = resp[0];
              if (!sts) {
                console.error(`Cannot find partition ${partitionNameB}`);
                return false;
              }
              [sts, lunB, headerB, guidGptB] = resp;
            }

            const partA = guidGptA.partentries[partitionNameA];
            const partB = guidGptB.partentries[partitionNameB];

            let isBoot = false;
            if (partitionNameA === "boot_a")
              isBoot = true;
            const [pDataA, pOffsetA, pDataB, pOffsetB] = this.patchSetActiveHelper(
              headerA, headerB, guidGptA, partA, partB, slot_a_status, slot_b_status, isBoot
            );

            headerA.set(pDataA, pOffsetA);
            const newHeaderA = guidGptA.fixGptCrc(headerA);
            if (lunA === lunB)
              headerB = newHeaderA;
            headerB.set(pDataB, pOffsetB);
            const newHeaderB = guidGptB.fixGptCrc(headerB);

            if (headerA !== null) {
              const startSectorPatchA = Math.floor(pOffsetA / this.cfg.SECTOR_SIZE_IN_BYTES);
              const byteOffsetPatchA = pOffsetA % this.cfg.SECTOR_SIZE_IN_BYTES;
              await this.cmdPatchMultiple(lunA, startSectorPatchA, byteOffsetPatchA, pDataA);


              if (lunA !== lunB) {
                const headerOffsetA = guidGptA.header.current_lba * guidGptA.sectorSize;
                const startSectorHdrA = guidGptA.header.current_lba;
                const pHeaderA = newHeaderA.slice(headerOffsetA, headerOffsetA+guidGptA.header.header_size);
                await this.cmdPatchMultiple(lunA, startSectorHdrA, 0, pHeaderA);
              }
            } 
            if (headerB !== null) {
              const startSectorPatchB = Math.floor(pOffsetB /this.cfg.SECTOR_SIZE_IN_BYTES);
              const byteOffsetPatchB = pOffsetB % this.cfg.SECTOR_SIZE_IN_BYTES;
              await this.cmdPatchMultiple(lunB, startSectorPatchB, byteOffsetPatchB, pDataB);

              const headerOffsetB = guidGptB.header.current_lba * guidGptB.sectorSize;
              const startSectorHdrB = guidGptB.header.current_lba;
              const pHeaderB = newHeaderB.slice(headerOffsetB, headerOffsetB+guidGptB.header.header_size);
              await this.cmdPatchMultiple(lunB, startSectorHdrB, 0, pHeaderB);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed setting slot ${slot} active`);
      console.error(error);
      return false
    }
    const activeBootLunId = (slot === "a") ? 1 : 2;
    await this.cmdSetBootLunId(activeBootLunId);
    console.log(`Successfully set slot ${slot} active`);
    return true;
  }


  async cmdPatch(physical_partition_number, start_sector, byte_offset, value, size_in_bytes) {
    const data = `<?xml version=\"1.0\" ?><data>\n` +
        `<patch SECTOR_SIZE_IN_BYTES=\"${this.cfg.SECTOR_SIZE_IN_BYTES}\"` +
        ` byte_offset=\"${byte_offset}\"` +
        ` filename=\"DISK\"` +
        ` physical_partition_number=\"${physical_partition_number}\"` +
        ` size_in_bytes=\"${size_in_bytes}\" ` +
        ` start_sector=\"${start_sector}\" ` +
        ` value=\"${value}\" />\n</data>`;

    let rsp = await this.xmlSend(data);
    if (rsp.resp) {
      //console.log("Patch:\n--------------------\n");
      //console.log(rsp.data);
      return true;
    } else {
      console.error(`Error: ${rsp.error}`);
      return false;
    }
  }

  async cmdSetBootLunId(lun) {
    const data = `<?xml version=\"1.0\" ?><data>\n<setbootablestoragedrive value=\"${lun}\" /></data>`
    const val = await this.xmlSend(data);
    if (val.resp) {
      console.log(`Successfully set bootID to lun ${lun}`);
      return true;
    } else {
      console.error(`Failed to set boot lun ${lun}`);
      return false;
    }
  }


  async cmdErase(physicalPartitionNumber, startSector, numPartitionSectors, onProgress) {
    const data = `<?xml version=\"1.0\" ?><data>\n` +
          `<program SECTOR_SIZE_IN_BYTES=\"${this.cfg.SECTOR_SIZE_IN_BYTES}\"` +
          ` num_partition_sectors=\"${numPartitionSectors}\"` +
          ` physical_partition_number=\"${physicalPartitionNumber}\"` +
          ` start_sector=\"${startSector}\" />\n</data>`;

    let rsp     = await this.xmlSend(data)
    let empty   = new Uint8Array(this.cfg.MaxPayloadSizeToTargetInBytes).fill(0x00);
    let pos     = 0, bytesToWrite = this.cfg.SECTOR_SIZE_IN_BYTES * numPartitionSectors;
    const total = bytesToWrite;

    if (rsp.resp) {
      while (bytesToWrite > 0) {
        let wlen = Math.min(bytesToWrite, this.cfg.MaxPayloadSizeToTargetInBytes);
        await this.cdc.write(empty.slice(0, wlen));
        bytesToWrite -= wlen;
        pos += wlen;
        await this.cdc.write(new Uint8Array(0), null, true, true);
        //console.log(`Progress: ${Math.floor(pos/total)*100}%`);
        onProgress(pos/total);
      }

      const res       = await this.waitForData();
      const response  = this.xml.getReponse(res);
      if (response.hasOwnProperty("value")) {
        if (response["value"] !== "ACK") {
            console.error("ERROR: receiving ACK trying to erase");
            return false;
        }
      } else {
        console.error("Error:", rsp);
        return false;
      }
    }
    console.log("Finish erasing");
    return true;
  }

  
  async cmdReset() {
    let data  = "<?xml version=\"1.0\" ?><data><power value=\"reset\"/></data>";
    let val   = await this.xmlSend(data);

    if (val.resp) {
      console.log("Reset succeeded");
      return true;
    } else {
      console.error("Reset failed");
      return false;
    }
  }
}
