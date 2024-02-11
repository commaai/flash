import { CommandHandler, cmd_t } from "./saharaDefs"

export class Sahara {
  cdc;
  ch; // CommandHandler
  pktSize;
  version;

  constructor(cdc) {
    this.cdc = cdc;
    this.pktSize = null;
    this.version = null;
    this.ch = new CommandHandler();
  }

  async connect() {
    try {
      let v = await this.cdc?._usbRead(0xC * 0x4);
      let v_text = new TextDecoder().decode(v);
      console.log("v_text:", v_text);
      if (v.length > 1){
        if (v[0] === 0x01){
          let pkt = this.ch.pkt_cmd_hdr(v);
          if (pkt.cmd == cmd_t.SAHARA_HELLO_REQ) {
            let rsp = this.ch.pkt_hello_req(v);
            this.pktSize = rsp.cmd_packet_length;
            this.version = rsp.version;
            console.log("Protocol version: ${rsp.version}, Version supported: ${rsp.version_supported}")
            return { "mode" : "sahara", "cmd" : cmd_t.SAHARA_HELLO_REQ, "data" : rsp };
          } else if (v_text.includes("<?xml")) {
            return { "mode" : "firehose" };
          }
        }
      } else {
        let data = new TextEndcoder().encode("<?xml version=\"1.0\" ?><data><nop /></data>")
        this.cdc._usbwrite(data);
        let resp = this.cdc._usbRead();
        let resp_text = new TextDecoder().decode(resp);
        if (resp_text.includes("<?xml")) {
          return { "mode" : "firehose" };
        }
      }
    } catch (error) {
      console.error(error);
      return { "mode" : "error" };
    }
  } 
}