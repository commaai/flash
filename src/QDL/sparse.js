import { concatUint8Array, readBlobAsBuffer } from "./utils";

const FILE_MAGIC = 0xed26ff3a;
export const FILE_HEADER_SIZE = 28;
const CHUNK_HEADER_SIZE = 12;

const ChunkType = {
  Raw : 0xCAC1,
  Fill : 0xCAC2,
  Skip : 0xCAC3,
  Crc32 : 0xCAC4,
}

async function parseChunkHeader(blobChunkHeader) {
  let chunkHeader  = await readBlobAsBuffer(blobChunkHeader);
  let view         = new DataView(chunkHeader);
  return {
    type       : view.getUint16(0, true),
    blocks     : view.getUint32(4, true),
    dataBytes  : view.getUint32(8, true) - CHUNK_HEADER_SIZE,
    data       : null,
  }
}


export async function parseFileHeader(blobHeader) {
  let header  = await readBlobAsBuffer(blobHeader);
  let view    = new DataView(header);

  let magic          = view.getUint32(0, true);
  let major_version  = view.getUint16(4, true);
  let minor_version  = view.getUint16(6, true);
  let file_hdr_sz    = view.getUint16(8, true);
  let chunk_hdr_sz   = view.getUint16(10, true);
  let blk_sz         = view.getUint32(12, true);
  let total_blks     = view.getUint32(16, true);
  let total_chunks   = view.getUint32(20, true);
  let crc32          = view.getUint32(24, true);

  if (magic != FILE_MAGIC) {
    return null;
  }
  if (file_hdr_sz != FILE_HEADER_SIZE) {
    console.error(`The file header size was expected to be 28, but is ${this.file_hdr_sz}.`);
    return null;
  }
  if (chunk_hdr_sz != CHUNK_HEADER_SIZE) {
    console.error(`The chunk header size was expected to be 12, but is ${this.chunk_hdr_sz}.`);
    return null;
  }

  //console.log("Sparse format detected. Using unpacked image.");
  return {
    magic         : magic, 
    major_version : major_version,
    minor_version : minor_version,
    file_hdr_sz   : file_hdr_sz,
    chunk_hdr_sz  : chunk_hdr_sz,
    blk_sz        : blk_sz,
    total_blks    : total_blks,
    total_chunks  : total_chunks,
    crc32         : crc32,
  }
}

export class QCSparse {
  constructor(blob, header) {
    this.blob = blob;
    this.offset = 0;
    this.major_version = header.major_version;
    this.minor_version = header.minor_version
    this.file_hdr_sz = header.file_hdr_sz;
    this.chunk_hdr_sz = header.chunk_hdr_sz;
    this.blk_sz = header.blk_sz;
    this.total_blks = header.total_blks;
    this.total_chunks = header.total_chunks;
    this.crc32 = header.crc32;
    this.blobOffset = 0;
    this.tmpdata = new Uint8Array(0);
  }

  async getChunkSize() {
    if (this.total_blks < this.offset) {
      console.error("Unmached output blocks");
      return -1;
    }

    let chunkHeader  = await parseChunkHeader(this.blob.slice(this.blobOffset, this.blobOffset + CHUNK_HEADER_SIZE));
    const chunk_type = chunkHeader.type;
    const blocks     = chunkHeader.blocks;
    const data_sz    = chunkHeader.dataBytes;
    this.blobOffset += CHUNK_HEADER_SIZE + data_sz;

    if (chunk_type == ChunkType.Raw) {
      if (data_sz != (blocks*this.blk_sz)) {
        console.error("Rase chunk input size does not match output size");
        return -1;
      } else {
        return data_sz;
      }
    } else if (chunk_type == ChunkType.Fill) {
      if (data_sz != 4) {
        console.error("Fill chunk should have 4 bytes of fill");
        return -1;
      } else {
        return blocks * this.blk_sz;
      }
    } else if (chunk_type == ChunkType.Skip) {
      return blocks * this.blk_sz;
    } else if (chunk_type == ChunkType.Crc32) {
      if (data_sz != 4) {
        console.error("CRC32 chunk should have 4 bytes of CRC");
        return -1;
      } else {
        return 0;
      }
    } else {
      console.error("Unknown chunk type");
      return -1;
    }
  }


  async getSize() {
    this.blobOffset = FILE_HEADER_SIZE;
    let length = 0, chunk = 0;
    while (chunk < this.total_chunks) {
      let tlen = await this.getChunkSize();
      if (tlen == -1)
        break;
      length += tlen;
      chunk += 1;
    }
    this.blobOffset = FILE_HEADER_SIZE;
    return length;
  }


  async unsparse() {
    if (this.total_blks < this.offset) {
      console.error("Error while unsparsing");
      return -1;
    }


    let chunkHeader  = await parseChunkHeader(this.blob.slice(this.blobOffset, this.blobOffset += CHUNK_HEADER_SIZE))
    const chunk_type = chunkHeader.type;
    const blocks     = chunkHeader.blocks;
    const data_sz    = chunkHeader.dataBytes;

    if (chunk_type == ChunkType.Raw) {
      if (data_sz != (blocks*this.blk_sz)) {
        console.error("Rase chunk input size does not match output size");
        return -1;
      } else {
        const buffer  = await readBlobAsBuffer(this.blob.slice(this.blobOffset, this.blobOffset += data_sz));
        const data = new Uint8Array(buffer);
        this.offset += blocks;
        return data;
      }
    } else if (chunk_type == ChunkType.Fill) {
      if (data_sz != 4) {
        console.error("Fill chunk should have 4 bytes of fill");
        return -1;
      } else {
        const buffer = await readBlobAsBuffer(this.blob.slice(this.blobOffset, this.blobOffset += 4));
        let fill_bin = new Uint8Array(buffer);

        const repetitions = Math.floor((blocks*this.blk_sz)/4);
        let data = new Uint8Array(blocks*this.blk_sz);
        for (let i = 0; i < blocks*this.blk; i+=4) {
          data.set(fill_bin, i);
        }
        this.offset += blocks;
        return data;
      }
    } else if (chunk_type == ChunkType.Skip) {
      let byteToSend = blocks*this.blk_sz;
      this.offset += blocks;
      return new Uint8Array(byteToSend).fill(0x00);
    } else if (chunk_type == ChunkType.Crc32) {
      if (data_sz != 4) {
        console.error("CRC32 chunk should have 4 bytes of CRC");
        return -1;
      } else {
        this.blobOffset += 4;
        return new Uint8Array(0);
      }
    } else {
      console.error("Unknown chunk type");
      return -1;
    }
  }


  async read(length=null) {
    let tdata;
    this.blobOffset = FILE_HEADER_SIZE;
    if (length === null)
      return await this.unsparse();
    if (length <= this.tmpdata.length) {
      tdata = this.tmpdata.slice(0, length);
      this.tmpdata = this.tmpdata.slice(length);
      return tdata;
    }
    while (this.tmpdata.length < length) {
      let addedData = await this.unsparse();
      this.tmpdata = concatUint8Array([this.tmpdata, addedData]);
      if (length <= this.tmpdata.length) {
        tdata = this.tmpdata.slice(0, length);
        this.tmpdata = this.tmpdata.slice(length);
        return tdata;
      }
    }
  }
}


class BlobBuilder {
  constructor(type) {
    this.type = type;
    this.blob = new Blob([], { type: this.type });
  }

  append(blob) {
    this.blob = new Blob([this.blob, blob], { type: this.type });
  }

  getBlob() {
    return this.blob;
  }
}


async function createImage(header, chunks) {
  let blobBuilder = new BlobBuilder();

  let buffer = new ArrayBuffer(FILE_HEADER_SIZE);
  let dataView = new DataView(buffer);
  let arrayView = new Uint8Array(buffer);

  dataView.setUint32(0, FILE_MAGIC, true);
  // v1.0
  dataView.setUint16(4, header.major_version, true);
  dataView.setUint16(6, header.minor_version, true);
  dataView.setUint16(8, header.file_hdr_sz, true);
  dataView.setUint16(10, header.chunk_hdr_sz, true);

  // Match input parameters
  //TODO: multiple chunks in a split
  dataView.setUint32(12, header.blk_sz, true);
  dataView.setUint32(16, chunks[0].blocks, true);
  dataView.setUint32(20, chunks.length, true);

  dataView.setUint32(24, 0, true);

  blobBuilder.append(new Blob([buffer]));
  for (let chunk of chunks) {
    let isChunkTypeSkip = chunk.data == null;
    buffer = new ArrayBuffer(CHUNK_HEADER_SIZE + (isChunkTypeSkip ? 0 : chunk.data.size));
    dataView = new DataView(buffer);
    arrayView = new Uint8Array(buffer);

    dataView.setUint16(0, chunk.type, true);
    dataView.setUint16(2, 0, true); // reserved
    dataView.setUint32(4, chunk.blocks, true);
    dataView.setUint32(
        8,
        CHUNK_HEADER_SIZE + (isChunkTypeSkip ? 0 : chunk.data.size),
        true
    );

    let chunkArrayView;
    if (!isChunkTypeSkip) { 
      chunkArrayView = new Uint8Array(await readBlobAsBuffer(chunk.data));
    } else {
      chunkArrayView = new Uint8Array(0);
    }
    arrayView.set(chunkArrayView, CHUNK_HEADER_SIZE);
    blobBuilder.append(new Blob([buffer]));
  }

  return blobBuilder.getBlob();
}


const MAX_DOWNLOAD_SIZE = 1024 * 1024 * 1024; // 1 GiB

function calcChunksRealDataBytes(chunk, blockSize) {
  switch (chunk.type) {
    case ChunkType.Raw:
      return chunk.dataBytes;
    case ChunkType.Fill:
      return chunk.blocks * blockSize;
    case ChunkType.Skip:
      return chunk.blocks * blockSize;
    case ChunkType.Crc32:
      return 0;
    default:
      return null;
  }
}


export async function* splitBlob(blob, splitSize = 1048576) {
  const safeToSend = splitSize;

  if (blob.size <= MAX_DOWNLOAD_SIZE) {
    yield blob;
    return;
  }

  let header   = await parseFileHeader(blob.slice(0, FILE_HEADER_SIZE));
  header.crc32 = 0;
  blob         = blob.slice(FILE_HEADER_SIZE);

  for (let i = 0; i < header.total_chunks; i++) {
    let originalChunk  = await parseChunkHeader(blob.slice(0, CHUNK_HEADER_SIZE));
    originalChunk.data = blob.slice(CHUNK_HEADER_SIZE, CHUNK_HEADER_SIZE + originalChunk.dataBytes);
    blob = blob.slice(CHUNK_HEADER_SIZE + originalChunk.dataBytes);

    let chunksToProcess  = [];
    let realBytesToWrite = calcChunksRealDataBytes(originalChunk, header.blk_sz)
    
    const isChunkTypeSkip = originalChunk.type == ChunkType.Skip;
    const isChunkTypeFill = originalChunk.type == ChunkType.Fill;

    if (realBytesToWrite > safeToSend) {
      
      let bytesToWrite      = isChunkTypeSkip ? 1 : originalChunk.dataBytes;
      let originalChunkData = originalChunk.data;

      while (bytesToWrite > 0) {
        const toSend = Math.min(safeToSend, bytesToWrite);
        let tmpChunk;

        if (isChunkTypeFill || isChunkTypeSkip) {
          while (realBytesToWrite > 0) {
            const realSend = Math.min(safeToSend, realBytesToWrite);
            tmpChunk = {
              type      : originalChunk.type,
              blocks    : realSend / header.blk_sz,
              dataBytes : isChunkTypeSkip ? 0 : toSend,
              data      : isChunkTypeSkip ? null : originalChunkData.slice(0, toSend),
            }
            chunksToProcess.push(tmpChunk);
            realBytesToWrite -= realSend;
          }
        } else {
          tmpChunk = {
            type      : originalChunk.type,
            blocks    : toSend / header.blk_sz,
            dataBytes : isChunkTypeSkip ? 0 : toSend,
            data      : isChunkTypeSkip ? null : originalChunkData.slice(0, toSend),
          }
          chunksToProcess.push(tmpChunk);
        }

        bytesToWrite -= toSend;
        originalChunkData = originalChunkData?.slice(toSend);
      }
    } else { 
      chunksToProcess.push(originalChunk)
    }
    for (const chunk of chunksToProcess) {
      let splitImage = await createImage(header, [chunk]);
      yield splitImage;
    }
  }
}
