import { usbClass } from "./usblib"
import { Sahara } from  "./sahara"
import { Firehose } from "./firehose"

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
      await this.firehose?.cmdReset();
    } catch (error) {
      console.error(error);
    }
  }
}