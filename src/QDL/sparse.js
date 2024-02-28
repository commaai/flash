import { concatUint8Array, loadFileFromLocal } from "./utils";


const FILE_MAGIC = 0xed26ff3a;
const FILE_HEADER_SIZE = 28;
const CHUNK_HEADER_SIZE = 12;

export const ChunkType = {
  Raw : 0xcac1,
  Fill : 0xcac2,
  Skip : 0xcac3,
  Crc32 : 0xcac4,
}


export class QCSparse {
  constructor(blob) {
    this.blob = blob
    this.offset = 0;
    this.major_version = null;
    this.minor_version = null;
    this.file_hdr_sz = null;
    this.chunk_hdr_sz = null;
    this.blk_sz = null;
    this.total_blks = null;
    this.total_chunks = null;
    this.image_checksum = null;
    this.blobOffset = 0;
  }


  parseFileHeader() {
    let header  = this.blob.slice(0, FILE_HEADER_SIZE);
    let view    = new DataView(header);

    let magic           = view.getUint32(0, true);
    this.major_version  = view.getUint16(4, true);
    this.minor_version  = view.getUint16(6, true);
    this.file_hdr_sz    = view.getUint16(8, true);
    this.chunk_hdr_sz   = view.getUint16(10, true);
    this.blk_sz         = view.getUint32(12, true);
    this.total_blks     = view.getUint32(16, true);
    this.total_chunks   = view.getUint32(20, true);
    this.image_checksum = view.getUint32(24, true);

    if (magic != FILE_MAGIC) {
        return false;
    }
    if (this.file_hdr_sz != FILE_MAGIC) {
      console.error(`The file header size was expected to be 28, but is ${this.file_hdr_sz}.`);
      return false;
    }
    if (this.chunk_hdr_sz != CHUNK_HEADER_SIZE) {
      console.error(`The chunk header size was expected to be 12, but is ${this.chunk_hdr_sz}.`);
      return false;
    }
    console.log("Sparse format detected. USing unpacked iamge.");
    return true;
  }


  getChunkSize() {
    if (this.total_blks < this.offset) {
      console.error("Unmached output blocks");
      return -1;
    }
    let chunkHeader = this.blob.slice(this.blobOffset, CHUNK_HEADER_SIZE);
    let view = new DataView(chunkHeader);
    const chunk_type = view.getUint16(0, true);
    const chunk_sz   = view.getUint32(4, true);
    const total_sz   = view.getUint32(8, true);
    const data_sz    = total_sz - 12;

    if (chunk_type == ChunkType.Raw) {
      if (data_sz != (chunk_sz*this.blk_sz)) {
        console.error("Rase chunk input size does not match output size");
        return -1;
      } else {
        this.blobOffset += chunk_sz * this.blk_sz;
        return chunk_sz * this.blk_sz;
      }
    } else if (chunk_type == ChunkType.Fill) {
      if (data_sz != 4) {
        console.error("Fill chunk shoudl have 4 bytes of fill");
        return -1;
      } else {
        return Math.floor((chunk_sz * this.blk_sz)/4);
      }
    } else if (chunk_type == ChunkType.Skip) {
      return chunk_sz * this.blk_sz;
    } else if (chunk_type == ChunkType.Crc32) {
      if (data_sz != 4) {
        console.error("CRC32 chunk should have 4 bytes of CRC");
        return -1;
      } else {
        this.blobOffset += 4;
        return 0;
      }
    } else {
      console.error("Unknown chunk type");
      return -1;
    }
  }


  getSize() {
    this.blobOffset += FILE_HEADER_SIZE;
    let length = 0, chunk = 0;
    while (chunk < this.total_chunks) {
      let tlen = this.getChunkSize();
      if (tlen == -1)
        break;
      length += tlen;
      chunk += 1;
    }
    this.blobOffset = FILE_HEADER_SIZE;
    return length;
  }


  unsparse() {
    if (this.total_blks < this.offset) {
      console.error("Error while unsparsing");
      return -1;
    }
    let chunkHeader = this.blob.slice(this.blobOffset, CHUNK_HEADER_SIZE);
    let view = new DataView(chunkHeader);
    const chunk_type = view.getUint16(0, true);
    const chunk_sz   = view.getUint32(4, true);
    const total_sz   = view.getUint32(8, true);
    const data_sz    = total_sz - 12;

    if (chunk_type == ChunkType.Raw) {
      if (data_sz != (chunk_sz*this.blk_sz)) {
        console.error("Rase chunk input size does not match output size");
        return -1;
      } else {
        let data = this.blob.slice(this.blobOffset, this.blobOffset += chunk_sz * this.blk_sz);
        this.offset += chunk_sz;
        return data;
      }
    } else if (chunk_type == ChunkType.Fill) {
      if (data_sz != 4) {
        console.error("Fill chunk should have 4 bytes of fill");
        return -1;
      } else {
        let fill_bin = new Uint8Array(this.blob.slice(this.blobOffset, this.blobOffset += 4));
        const repetitions = Math.floor((chunk_sz * this.blk_sz)/4);
        let data;
        for (let i = 0; i < repetitions; i++) {
          data = concatUint8Array([data, fill_bin]);
        }
        this.offset += chunk_sz;
        return data.buffer;
      }
    } else if (chunk_type == ChunkType.Skip) {
      let data = new ArrayBuffer(chunk_sz*this.blk_sz).fill(0x00);
      this.offset += chunk_sz;
      return data;
    } else if (chunk_type == ChunkType.Crc32) {
      if (data_sz != 4) {
        console.error("CRC32 chunk should have 4 bytes of CRC");
        return -1;
      } else {
        this.blobOffset += 4;
        return new ArrayBuffer(0);
      }
    } else {
      console.error("Unknown chunk type");
      return -1;
    }
  }


  read(length=null) {
    let tdata;
    if (length === null)
      return this.unsparse();
    if (length <= this.tmpdata.length) {
      tdata = this.tmpdata.slice(0, length);
      this.tmpdata = this.tmpdata.slice(length);
      return tdata;
    }
    while (this.tmpdata.length < length) {
      this.tmpdata = concatUint8Array([this.tmpdata, new Uint8Array(this.unsparse())])
      if (length <= this.tmpdata.length) {
        tdata = this.tmpdata.slice(0, length);
        this.tmpdata = this.tmpdata.slice(length);
        return tdata;
      }
    }
  }
}