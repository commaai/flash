import { readBlobAsBuffer } from "./utils";

const FILE_MAGIC = 0xed26ff3a;
export const FILE_HEADER_SIZE = 28;
const CHUNK_HEADER_SIZE = 12;
const MAX_DOWNLOAD_SIZE = 1024 * 1024 * 1024; // 1 GiB

const ChunkType = {
  Raw : 0xCAC1,
  Fill : 0xCAC2,
  Skip : 0xCAC3,
  Crc32 : 0xCAC4,
}


class QCSparse {
  constructor(blob, header) {
    this.blob = blob;
    this.blk_sz = header.blk_sz;
    this.total_chunks = header.total_chunks;
    this.blobOffset = 0;
  }


  async getChunkSize() {
    let chunkHeader = await parseChunkHeader(this.blob.slice(this.blobOffset, this.blobOffset + CHUNK_HEADER_SIZE));
    const chunk_type = chunkHeader.type;
    const blocks = chunkHeader.blocks;
    const data_sz = chunkHeader.dataBytes;
    this.blobOffset += CHUNK_HEADER_SIZE + data_sz;

    if (chunk_type == ChunkType.Raw) {
      if (data_sz != (blocks*this.blk_sz)) {
        throw new Error("Sparse - Chunk input size does not match output size");
      } else {
        return data_sz;
      }
    } else if (chunk_type == ChunkType.Fill) {
      if (data_sz != 4) {
        throw new Error("Sparse - Fill chunk should have 4 bytes");
      } else {
        return blocks * this.blk_sz;
      }
    } else if (chunk_type == ChunkType.Skip) {
      return blocks * this.blk_sz;
    } else if (chunk_type == ChunkType.Crc32) {
      if (data_sz != 4) {
        throw new Error("Sparse - CRC32 chunk should have 4 bytes");
      } else {
        return 0;
      }
    } else {
      console.error("Sparse - Unknown chunk type");
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
}


export async function getSparseRealSize(blob, header) {
  const sparseImage = new QCSparse(blob, header);
  return await sparseImage.getSize();
}


async function parseChunkHeader(blobChunkHeader) {
  let chunkHeader = await readBlobAsBuffer(blobChunkHeader);
  let view = new DataView(chunkHeader);
  return {
    type : view.getUint16(0, true),
    blocks : view.getUint32(4, true),
    dataBytes : view.getUint32(8, true) - CHUNK_HEADER_SIZE,
    data : null,
  }
}


export async function parseFileHeader(blobHeader) {
  let header = await readBlobAsBuffer(blobHeader);
  let view = new DataView(header);

  let magic = view.getUint32(0, true);
  let major_version = view.getUint16(4, true);
  let minor_version = view.getUint16(6, true);
  let file_hdr_sz = view.getUint16(8, true);
  let chunk_hdr_sz = view.getUint16(10, true);
  let blk_sz = view.getUint32(12, true);
  let total_blks = view.getUint32(16, true);
  let total_chunks = view.getUint32(20, true);
  let crc32 = view.getUint32(24, true);

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

  return {
    magic : magic,
    major_version : major_version,
    minor_version : minor_version,
    file_hdr_sz : file_hdr_sz,
    chunk_hdr_sz : chunk_hdr_sz,
    blk_sz : blk_sz,
    total_blks : total_blks,
    total_chunks : total_chunks,
    crc32 : crc32,
  }
}


async function populate(chunks, blockSize) {
  const nBlocks = calcChunksBlocks(chunks);
  let ret = new Uint8Array(nBlocks*blockSize);
  let offset = 0;

  for (const chunk of chunks) {
    const chunk_type = chunk.type;
    const blocks = chunk.blocks;
    const data_sz = chunk.dataBytes;
    const data = chunk.data;

    if (chunk_type == ChunkType.Raw) {
      let rawData = new Uint8Array(await readBlobAsBuffer(data));
      ret.set(rawData, offset);
      offset += blocks*blockSize;
    } else if (chunk_type == ChunkType.Fill) {
      const fill_bin = new Uint8Array(await readBlobAsBuffer(data));
      const bufferSize = blocks*blockSize;
      for (let i = 0; i < bufferSize; i+=data_sz) {
        ret.set(fill_bin, offset);
        offset += data_sz;
      }
    } else if (chunk_type == ChunkType.Skip) {
      let byteToSend = blocks*blockSize;
      let skipData = new Uint8Array(byteToSend).fill(0);
      ret.set(skipData, offset);
      offset += byteToSend;
    } else if (chunk_type == ChunkType.Crc32) {
      continue;
    } else {
      throw new Error("Sparse - Unknown chunk type");
    }
  }
  return new Blob([ret.buffer]);
}


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
      throw new Error("Sparse - Unknown chunk type");
  }
}


function calcChunksSize(chunks, blockSize) {
  return chunks.map((chunk) => calcChunksRealDataBytes(chunk, blockSize)).reduce((total, c) => total + c, 0);
}

function calcChunksBlocks(chunks) {
  return chunks.map((chunk) => chunk.blocks).reduce((total, c) => total + c, 0);
}


export async function* splitBlob(blob, splitSize = 1048576 /* maxPayloadSizeToTarget */) {
  const safeToSend = splitSize;

  let header = await parseFileHeader(blob.slice(0, FILE_HEADER_SIZE));
  if (header === null || blob.size <= MAX_DOWNLOAD_SIZE) {
    yield blob;
    return;
  }

  header.crc32 = 0;
  blob = blob.slice(FILE_HEADER_SIZE);
  let splitChunks = [];
  for (let i = 0; i < header.total_chunks; i++) {
    let originalChunk = await parseChunkHeader(blob.slice(0, CHUNK_HEADER_SIZE));
    originalChunk.data = blob.slice(CHUNK_HEADER_SIZE, CHUNK_HEADER_SIZE + originalChunk.dataBytes);
    blob = blob.slice(CHUNK_HEADER_SIZE + originalChunk.dataBytes);

    let chunksToProcess = [];
    let realBytesToWrite = calcChunksRealDataBytes(originalChunk, header.blk_sz)

    const isChunkTypeSkip = originalChunk.type == ChunkType.Skip;
    const isChunkTypeFill = originalChunk.type == ChunkType.Fill;

    if (realBytesToWrite > safeToSend) {
      let bytesToWrite = isChunkTypeSkip ? 1 : originalChunk.dataBytes;
      let originalChunkData = originalChunk.data;

      while (bytesToWrite > 0) {
        const toSend = Math.min(safeToSend, bytesToWrite);
        let tmpChunk;

        if (isChunkTypeFill || isChunkTypeSkip) {
          while (realBytesToWrite > 0) {
            const realSend = Math.min(safeToSend, realBytesToWrite);
            tmpChunk = {
              type : originalChunk.type,
              blocks : realSend / header.blk_sz,
              dataBytes : isChunkTypeSkip ? 0 : toSend,
              data : isChunkTypeSkip ? new Blob([]) : originalChunkData.slice(0, toSend),
            }
            chunksToProcess.push(tmpChunk);
            realBytesToWrite -= realSend;
          }
        } else {
          tmpChunk = {
            type : originalChunk.type,
            blocks : toSend / header.blk_sz,
            dataBytes : toSend,
            data : originalChunkData.slice(0, toSend),
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
      const remainingBytes = splitSize - calcChunksSize(splitChunks);
      const realChunkBytes = calcChunksRealDataBytes(chunk);
      if (remainingBytes >= realChunkBytes) {
        splitChunks.push(chunk);
      } else {
        yield await populate(splitChunks, header.blk_sz);
        splitChunks = [chunk];
      }
    }
  }
  if (splitChunks.length > 0 ) {
    yield await populate(splitChunks, header.blk_sz);
  }
}