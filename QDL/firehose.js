import { xmlParser } from "./xmlParser"
import { concatUint8Array, containsBytes, compareStringToBytes } from "./utils"

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
  //xml;
  cfg

  constructor(cdc) {
    this.cdc = cdc;
    this.xml = new xmlParser();
    this.cfg = new cfg();
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
    console.log("writing config");
    let rsp = await this.xmlSend(connectCmd);
    console.log("finish writing config")
    return true;
  }

  async xmlSend(data) {
    let dataToSend = new TextEncoder().encode(data).slice(0, this.cfg.MaxXMLSizeInBytes);
    await this.cdc?._usbWrite(dataToSend);
    console.log("finish writing in xmlsend");
    let rData; // response data in bytes
    let counter = 0;
    let timeout = 0;
    while (!(containsBytes("<response value", rData))) {
      console.log("in while loop")
      try {
        let tmp = await this.cdc?._usbRead();
        if (compareStringToBytes("", tmp)) {
          counter += 1;
          for (let i=0; i < 100; i += 1)
            continue; /* UGLY: this is temp for sleep() */
          if (counter > timeout)
            break;
        }
        console.log(new TextDecoder().decode(tmp));
        rData = concatUint8Array(rData, tmp);
        console.log(new TextDecoder().decode(rData));
      } catch (error) {
        console.error(error);
      }
    }
    try {
      const resp = this.xml.getReponse(rData); // input is Uint8Array
      const status = this.getStatus(resp);
      if (status !== null) {
        if (containsBytes("log value=", rData)) {
          //let log = this.xml.getLog(rData);
          return { "resp" : status, "data" : rData, "log" : "" }; // TODO: getLog()
        }
        return { "resp" : status, "data" : rData };
      }
    } catch (error) {
      console.error(error);
    }
    return {"resp" : true, "data" : rData};
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

  getStatus(resp) {
    if (resp.hasOwnProperty("value")) {
      console.log("In getStatus")
      let value = resp["value"];
      if (value == "ACK" || value == "true" ) {
        console.log("IN value = ACK")
        return true;
      } else {
        return false;
      }
    }
    return true;
  }
}
