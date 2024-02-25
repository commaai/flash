const { containsBytes } = require("./utils");
const crc32 = require("crc-32");

const AB_FLAG_OFFSET = 6;
const AB_PARTITION_ATTR_SLOT_ACTIVE = (0x1 << 2);
const AB_PARTITION_ATTR_UNBOOTABLE = (0x1 << 7);

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

const efiType = {
  0x00000000 : "EFI_UNUSED",
  0x024DEE41 : "EFI_MBR",
  0xC12A7328 : "EFI_SYSTEM",
  0x21686148 : "EFI_BIOS_BOOT",
  0xD3BFE2DE : "EFI_IFFS",
  0xF4019732 : "EFI_SONY_BOOT",
  0xBFBFAFE7 : "EFI_LENOVO_BOOT",
  0xE3C9E316 : "EFI_MSR ",
  0xEBD0A0A2 : "EFI_BASIC_DATA",
  0x5808C8AA : "EFI_LDM_META",
  0xAF9B60A0 : "EFI_LDM",
  0xDE94BBA4 : "EFI_RECOVERY",
  0x37AFFC90 : "EFI_GPFS ",
  0xE75CAF8F : "EFI_STORAGE_SPACES ",
  0x75894C1E : "EFI_HPUX_DATA",
  0xE2A1E728 : "EFI_HPUX_SERVICE",
  0x0FC63DAF : "EFI_LINUX_DAYA",
  0xA19D880F : "EFI_LINUX_RAID",
  0x44479540 : "EFI_LINUX_ROOT32",
  0x4F68BCE3 : "EFI_LINUX_ROOT64",
  0x69DAD710 : "EFI_LINUX_ROOT_ARM32",
  0xB921B045 : "EFI_LINUX_ROOT_ARM64",
  0x0657FD6D : "EFI_LINUX_SWAP",
  0xE6D6D379 : "EFI_LINUX_LVM",
  0x933AC7E1 : "EFI_LINUX_HOME",
  0x3B8F8425 : "EFI_LINUX_SRV",
  0x7FFEC5C9 : "EFI_LINUX_DM_CRYPT",
  0xCA7D7CCB : "EFI_LINUX_LUKS",
  0x8DA63339 : "EFI_LINUX_RESERVED",
  0x83BD6B9D : "EFI_FREEBSD_BOOT",
  0x516E7CB4 : "EFI_FREEBSD_DATA",
  0x516E7CB5 : "EFI_FREEBSD_SWAP",
  0x516E7CB6 : "EFI_FREEBSD_UFS",
  0x516E7CB8 : "EFI_FREEBSD_VINUM",
  0x516E7CBA : "EFI_FREEBSD_ZFS",
  0x48465300 : "EFI_OSX_HFS",
  0x55465300 : "EFI_OSX_UFS",
  0x6A898CC3 : "EFI_OSX_ZFS",
  0x52414944 : "EFI_OSX_RAID",
  0x52414944 : "EFI_OSX_RAID_OFFLINE",
  0x426F6F74 : "EFI_OSX_RECOVERY",
  0x4C616265 : "EFI_OSX_LABEL",
  0x5265636F : "EFI_OSX_TV_RECOVERY",
  0x53746F72 : "EFI_OSX_CORE_STORAGE",
  0x6A82CB45 : "EFI_SOLARIS_BOOT",
  0x6A85CF4D : "EFI_SOLARIS_ROOT",
  0x6A87C46F : "EFI_SOLARIS_SWAP",
  0x6A8B642B : "EFI_SOLARIS_BACKUP",
  0x6A898CC3 : "EFI_SOLARIS_USR",
  0x6A8EF2E9 : "EFI_SOLARIS_VAR",
  0x6A90BA39 : "EFI_SOLARIS_HOME",
  0x6A9283A5 : "EFI_SOLARIS_ALTERNATE",
  0x6A945A3B : "EFI_SOLARIS_RESERVED1",
  0x6A9630D1 : "EFI_SOLARIS_RESERVED2",
  0x6A980767 : "EFI_SOLARIS_RESERVED3",
  0x6A96237F : "EFI_SOLARIS_RESERVED4",
  0x6A8D2AC7 : "EFI_SOLARIS_RESERVED5",
  0x49F48D32 : "EFI_NETBSD_SWAP",
  0x49F48D5A : "EFI_NETBSD_FFS",
  0x49F48D82 : "EFI_NETBSD_LFS",
  0x49F48DAA : "EFI_NETBSD_RAID",
  0x2DB519C4 : "EFI_NETBSD_CONCAT",
  0x2DB519EC : "EFI_NETBSD_ENCRYPT",
  0xFE3A2A5D : "EFI_CHROMEOS_KERNEL",
  0x3CB8E202 : "EFI_CHROMEOS_ROOTFS",
  0x2E0A753D : "EFI_CHROMEOS_FUTURE",
  0x42465331 : "EFI_HAIKU",
  0x85D5E45E : "EFI_MIDNIGHTBSD_BOOT",
  0x85D5E45A : "EFI_MIDNIGHTBSD_DATA",
  0x85D5E45B : "EFI_MIDNIGHTBSD_SWAP",
  0x0394EF8B : "EFI_MIDNIGHTBSD_UFS",
  0x85D5E45C : "EFI_MIDNIGHTBSD_VINUM",
  0x85D5E45D : "EFI_MIDNIGHTBSD_ZFS",
  0x45B0969E : "EFI_CEPH_JOURNAL",
  0x45B0969E : "EFI_CEPH_ENCRYPT",
  0x4FBD7E29 : "EFI_CEPH_OSD",
  0x4FBD7E29 : "EFI_CEPH_ENCRYPT_OSD",
  0x89C57F98 : "EFI_CEPH_CREATE",
  0x89C57F98 : "EFI_CEPH_ENCRYPT_CREATE",
  0x824CC7A0 : "EFI_OPENBSD",
  0xCEF5A9AD : "EFI_QNX",
  0xC91818F9 : "EFI_PLAN9",
  0x9D275380 : "EFI_VMWARE_VMKCORE",
  0xAA31E02A : "EFI_VMWARE_VMFS",
  0x9198EFFC : "EFI_VMWARE_RESERVED",
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
  

  create() {
    // TODO: finish create function
    let buffer = new ArrayBuffer(16 + 16 + 8 + 8 + 8 + 72);
    let view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < this.type.length; i++) {
      view.setUint8(offset++, this.type[i]);
    }
    for (let i = 0; i < this.unique.length; i++) {
      view.setUint8(offset++, this.unique[i]);
    }
    let tmp = [this.first_lba, this.last_lba, this.flags];
    for (let i = 0; i < 3; i++) {
      view.setBigInt64(offset, tmp[i]);
      offset += 8;
    }
    for (let i = 0; i < 72; i++) {
      view.setUint8(offset++, this.name[i]);
    }
    return new Uint8Array(view.buffer);
  }
}


class partf {
  unique =  new Uint8Array();
  firstLba = 0;
  lastLba = 0;
  flags = 0;
  sector = 0;
  sectors = 0;
  type = null;
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

    for (let idx=0; idx < numPartEntries; idx++) {
      const data = gptData.slice(start + (idx * entrySize), start + (idx * entrySize) + entrySize);
      if (new DataView(data.slice(16,32).buffer, 0).getUint16(0, true) == 0)
         break;
      let partentry = new gptPartition(data);
      let pa = new partf();

      const guid1 = new DataView(partentry.unique.slice(0, 0x4).buffer, 0).getUint32(0, true);
      const guid2 = new DataView(partentry.unique.slice(0x4, 0x6).buffer, 0).getUint16(0, true);
      const guid3 = new DataView(partentry.unique.slice(0x6, 0x8).buffer, 0).getUint16(0, true);
      const guid4 = new DataView(partentry.unique.slice(0x8, 0xA).buffer, 0).getUint16(0, true);
      const guid5 = Array.from(partentry.unique.subarray(0xA, 0x10))
          .map(byte => byte.toString(16).padStart(2, '0'))
          .join('');

      pa.unique = `${guid1.toString(16).padStart(8, '0')}-${guid2.toString(16).padStart(4, '0')}-${guid3.toString(16).padStart(4, '0')}-${guid4.toString(16).padStart(4, '0')}-${guid5}`;
      pa.sector = partentry.first_lba;
      pa.sectors = partentry.last_lba - partentry.first_lba + 1;
      pa.flags = partentry.flags;
      pa.entryOffset = start + (idx * entrySize);
      const typeOfPartentry = new DataView(partentry.type.slice(0, 0x4).buffer, 0).getUint32(0, true);
      if (efiType.hasOwnProperty(typeOfPartentry)) {
        pa.type = efiType[typeOfPartentry];
      } else {
        pa.type = typeOfPartentry.toString(16);
      }
      let nullIndex = Array.from(partentry.name).findIndex((element, index) => index % 2 === 0 && element === 0);
      let nameWithoutNull = partentry.name.slice(0, nullIndex);
      let decodedName = new TextDecoder('utf-16').decode(nameWithoutNull);
      pa.name = decodedName;
      if (pa.type == "EFI_UNUSED")
        continue;
      this.partentries[pa.name] = pa;
    }
    this.totalsectors = this.header.first_usable_lba + this.header.last_usable_lba;
    return true;
  }
  

  patch(data, partitionName="boot", active=true) {
    for (const sectorSize of [512, 4096]) {
      const result = this.parse(data, sectorSize);
      if (result) {
        for (const rname in this.partentries) {
          if (partitionName.toLowerCase() === rname.toLowerCase()) {
            const partition = this.partentries[rname];
            const sdata = data.slice(partition.entryOffset, partition.entryOffset+this.header.part_entry_size);
            const partentry = new gptPartition(sdata);
            let flags = partentry.flags;
            if (active) {
              flags |= AB_PARTITION_ATTR_SLOT_ACTIVE << (AB_FLAG_OFFSET*8);
            } else {
              flags |= AB_PARTITION_ATTR_UNBOOTABLE << (AB_FLAG_OFFSET*9)
            }
            partentry.flags = flags;
            let pdata = partentry.create();
            return [ pdata, partition.entryOffset ];
          }
        }
        break;
      }
    }
  return [ null, null ];
  }


  fixGptCrc(data) {
    const partentry_size = this.header.num_part_entries * this.header.part_entry_size;
    const partentry_offset = this.header.part_entry_start_lba * this.sectorSize;
    const partdata = data.slice(partentry_offset, partentry_offset + partentry_size);
    const headeroffset = this.header.current_lba * this.sectorSize;
    let headerdata = data.slice(headeroffset, headeroffset+this.header.header_size);
    headerdata.splice(0x58, 4, new Uint8Array(new DataView(new ArrayBuffer(4)).setUint8(0, crc32(Array.from(partdata)), true)));
    headerdata.splice(0x10, 4, new Uint8Array(new DataView(new ArrayBuffer(4)).setUint8(0, crc32(new Array(4).fill(0)), true)));
    headerdata.splice(0x10, 4, new Uint8Array(new DataView(new ArrayBuffer(4)).setUint8(0, crc32(Array.from(headerdata)), true)));
    data.splice(headeroffset, this.header.header_size, headerdata);
    return data;
  }
}
