const { containsBytes } = require("./utils");

class structHelper {
  pos = 0;

  constructor(data, pos = 0) {
    this.pos = pos;
    this.data = data;
  }

  qword(littleEndian=true) {
    const view = new DataView(this.data.slice(this.pos, this.pos+8).buffer, 0);
    this.pos += 8;
    return Number(view.getBigUint64(0, littleEndian));
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
    let sh = new structHelper(data);
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
    let sh = new structHelper(data)
    this.type = sh.bytes(16);
    this.unique = sh.bytes(16);
    this.first_lba = sh.qword();
    this.last_lba = sh.qword();
    this.flags = sh.qword();
    this.name = sh.toString(72);
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


export class gpt {
  constructor(numPartEntries=0, partEntrySize=0, partEntryStartLba=0) {
    this.numPartEntries = numPartEntries;
    this.partEntrySize = partEntrySize; 
    this.partEntryStartLba = partEntryStartLba;
    this.totalSectors = null;
    this.header = null;
    this.sectorSize = null;
    this.partentries = {};
  }

  parseHeader(gptData, sectorSize=512){
    return new gptHeader(gptData.slice(sectorSize, sectorSize + 0x5C));
  }

  parse(gptData, sectorSize=512) {
    this.header = new gptHeader(gptData.slice(sectorSize, sectorSize + 0x5C));
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
      start = this.header.part_entry_start_lba * sectorSize;
    }

    let entrySize = this.header.part_entry_size;
    this.partentries = {};

    let numPartEntries = this.header.num_part_entries;

    // TODO:
    for (let idx=0; idx < numPartEntries; idx++) {
      const data = gptData.slice(start + (idx * entrySize), start + (idx * entrySize) + entrySize);
      if (new DataView(data.slice(16,32).buffer, 0).getUint16(0, true) == 0)
         break;
      let partentry = new gptPartition(data);
      let pa = new partf();
    //  guid1 = unpack("<I", partentry.unique[0:0x4])[0]
    //  guid2 = unpack("<H", partentry.unique[0x4:0x6])[0]
    //  guid3 = unpack("<H", partentry.unique[0x6:0x8])[0]
    //  guid4 = unpack("<H", partentry.unique[0x8:0xA])[0]
    //  guid5 = hexlify(partentry.unique[0xA:0x10]).decode('utf-8')
    //  pa.unique = "{:08x}-{:04x}-{:04x}-{:04x}-{}".format(guid1, guid2, guid3, guid4, guid5)
      pa.sector = partentry.first_lba
      pa.sectors = partentry.last_lba - partentry.first_lba + 1
    //  pa.flags = partentry.flags
    //  pa.entryoffset = start + (idx * entrysize)
    //  type = int(unpack("<I", partentry.type[0:0x4])[0])
    //  try:
    //    pa.type = self.efi_type(type).name
    //  except:
    //    pa.type = hex(type)
    //  pa.name = partentry.name.replace(b"\x00\x00", b"").decode('utf-16')
      let nullIndex = Array.from(partentry.name).findIndex((element, index) => index % 2 === 0 && element === 0);
      let nameWithoutNull = partentry.name.slice(0, nullIndex);
      let decodedName = new TextDecoder('utf-16').decode(nameWithoutNull);
      pa.name = decodedName;
    //  if pa.type == "EFI_UNUSED":
    //    continue
      this.partentries[pa.name] = pa;
    }
    this.totalsectors = this.header.first_usable_lba + this.header.last_usable_lba;
    return true;
  }
}
