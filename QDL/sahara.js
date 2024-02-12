import { CommandHandler, cmd_t, sahara_mode_t } from "./saharaDefs"
import { packGenerator } from "./utils";

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

  async enterCommandMode(version=2) {
    console.log("In enterCommandMode");
    if (!await this.cmdHello(sahara_mode_t.SAHARA_MODE_COMMAND, version=version)){
      console.log("cmdHello() in enterCommandMode failed");
      return false;
    }
    console.log("Finish cmdHello")
    let res = await this.getResponse();
    if (res.hasOwnProperty("cmd")){
      if (res["cmd"] === cmd_t.SAHARA_END_TRANSFER){
        if (res.hasOwnProperty("data")){
          //let pkt = res["data"];
          return false;
        }
      } else if (res["cmd"] === cmd_t.SAHARA_CMD_READY){
        return true;
      }
    }
    return false;
  }

  async getResponse() {
    try {
      let data = await this.cdc?._usbRead();
      let data_text = new TextDecoder().decode(data);
      if (data_text.includes("")) {
        return {};
      } else if (data_text.includes("<?xml")){
        return {"firehose" : "yes"};
      }
      let pkt = this.ch.pkt_cmd_hdr(data);
      if (pkt.cmd === cmd_t.SAHARA_HELLO_REQ) {
        return { "cmd" : pkt.cmd, "data" : this.ch.pkt_hello_req(data) };
      } else if (pkt.cmd === cmd_t.SAHARA_DONE_RSP) {
        return {"cmd": pkt.cmd, "data":this.ch.pkt_done(data)}
      } else if (pkt.cmd === cmd_t.SAHARA_END_TRANSFER){
        return {"cmd": pkt.cmd, "data": this.ch.pkt_image_end(data)};
      } else if (pkt.cmd == cmd_t.SAHARA_64BIT_MEMORY_READ_DATA) {
        return {"cmd": pkt.cmd, "data": this.ch.pkt_read_data_64(data)}
      } else if (pkt.cmd === cmd_t.SAHARA_EXECUTE_RSP) {
        return {"cmd": pkt.cmd, "data": this.ch.pkt_execute_rsp_cmd(data)};
      } else if (pkt.cmd === cmd_t.SAHARA_CMD_READY || pkt.cmd == cmd_t.SAHARA_RESET_RSP) {
        return {"cmd": pkt.cmd, "data": None };
      }
      return {};
    } catch (erro) {
      console.error(error);
      return {};
    }
  }

  async cmdHello(mode, version_min=1, max_cmd_len=0, version=2) {
    let cmd = cmd_t.SAHARA_HELLO_RSP;
    let len = 0x30;
    const elements = [cmd, len, version, version_min, max_cmd_len, mode, 1, 2, 3, 4, 5, 6];
    const responseData = packGenerator(elements);
    try {
      await this.cdc?._usbWrite(responseData);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}