const { containsBytes } = require("./utils");

class structHelper {
  pos = 0;

  constructor(data, pos = 0) {
    this.pos = pos;
    this.data = data;
  }

  qword(littleEndian=true) {
    const view = new Dataview(this.data.slice(this.pos, this.pos+8), 0);
    this.pos += 8;
    return view.getBigUint64(0, littleEndian);
  }

  dword(littleEndian=true) {
    let view = new DataView(this.data.slice(this.pos, this.pos+4).buffer, 0);
    this.pos += 4;
    return view.getUint32(0, littleEndian);
  }

  bytes(rlen=1) {
    const dat = this.data.slice(this.pos, this.pos+rlen);
    this.pos += rlen;
    if (rlen == 1)
      return dat[0];
    return dat;
  }

  toString(rlen=1) {
    const dat = this.data.slice(this.pos, this.pos+rlen);
    this.pos += rlen;
    return dat;
  }
}


class gptHeader {
  constructor(data) {
    this.sh = new structHelper(data);
    this.signature = sh.bytes(8);
    this.revision = sh.dword();
    this.header_size = sh.dword();
    this.crc32 = sh.dword();
    this.reserved = sh.dword();
    this.current_lba = sh.qword();
    this.backup_lba = sh.qword();
    this.first_usable_lba = sh.qword();
    this.last_usable_lba = sh.qword();
    this.disk_guid = sh.bytes(16);
    this.part_entry_start_lba = sh.qword();
    this.num_part_entries = sh.dword();
    this.part_entry_size = sh.dword();
    this.crc32_part_entries = sh.dword();
  }
}

class gptPartition {
  constructor(data) {
    sh = new structHelper(data)
    this.type = sh.bytes(16);
    this.unique = sh.bytes(16);
    this.first_lba = sh.qword();
    this.last_lba = sh.qword();
    this.flags = sh.qword();
    this.name = sh.string(72);
  }
}


class partf {
  unique =  new Uint8Array();
  firstLba = 0;
  lastLba = 0;
  flags = 0;
  sector = 0;
  sectors = 0;
  type = new Uint8Array();
  name = "";
  entryOffset = 0;
}


// efi_type of leeco : 747038530
class gpt {
  constructor(numPartEntries=0, partEntrySize=0, partEntryStartLba=0) {
    this.numPartEntries = numPartEntries;
    this.partEntrySize = partEntrySize; 
    this.partEntryStartLba = partEntryStartLba;
    this.totalSectors = null;
    this.header = null;
    this.sectorSize = null;
    this.partentries = [];
  }

  parseheader(gptData, sectorSize=512){
    return new gptHeader(gptData.slice(sectorSize, sectorSize + 0x5C));
  }

  parse(gptData, sectorSize=512) {
    this.header = new gptHeader(gptData.slice(sectorsize, sectorsize + 0x5C));
    this.sectorSize = sectorSize;
    if (!containsBytes("EFI PART", this.header.signature))
      return false;
    if (this.header.revision != 0x10000) {
      console.error("Unknown GPT revision.");
      return false;
    }
    let start;
    if (this.partEntryStartLba != 0) {
      start = self.partEntryStartLba;
    } else {
      start = this.header.partEntryStartLba * sectorSize;
    }

    let entrySize = this.header.partEntrySize;
    this.partentries = {};


    let numPartEntries = this.header.numPartEntries;

    // TODO:
    //for (let idx=0; idx < num_part_entries; idx++) {
    //  let data = gptData.slice(start + (idx * entrysize), start + (idx * entrysize) + entrysize)
    //  if (new DataView(data.slice(16,32),0).getUint16(0) == 0)
    //     break
    //  let partentry = new gptPartition(data)
    //  let pa = new partf()
    //  guid1 = unpack("<I", partentry.unique[0:0x4])[0]
    //  guid2 = unpack("<H", partentry.unique[0x4:0x6])[0]
    //  guid3 = unpack("<H", partentry.unique[0x6:0x8])[0]
    //  guid4 = unpack("<H", partentry.unique[0x8:0xA])[0]
    //  guid5 = hexlify(partentry.unique[0xA:0x10]).decode('utf-8')
    //  pa.unique = "{:08x}-{:04x}-{:04x}-{:04x}-{}".format(guid1, guid2, guid3, guid4, guid5)
    //  pa.sector = partentry.first_lba
    //  pa.sectors = partentry.last_lba - partentry.first_lba + 1
    //  pa.flags = partentry.flags
    //  pa.entryoffset = start + (idx * entrysize)
    //  type = int(unpack("<I", partentry.type[0:0x4])[0])
    //  print("EFI TYPE:", type)
    //  try:
    //    pa.type = self.efi_type(type).name
    //  except:
    //    pa.type = hex(type)
    //  pa.name = partentry.name.replace(b"\x00\x00", b"").decode('utf-16')
    //  if pa.type == "EFI_UNUSED":
    //    continue
    //  self.partentries[pa.name]=pa
    //}
    //self.totalsectors = self.header.first_usable_lba + self.header.last_usable_lba
    return True
  }
}
