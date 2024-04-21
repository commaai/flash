import * as Utils from "@/QDL/utils"
import jsSHA from 'jssha'
import { XzReadableStream } from 'xz-decompress';


const FILE_MAGIC = 0xed26ff3a;
const FILE_HEADER_SIZE = 28;
const CHUNK_HEADER_SIZE = 12;
const MAX_YIELD_SIZE = 1024 * 1024;

const ChunkType = {
  Raw : 0xCAC1,
  Fill : 0xCAC2,
  Skip : 0xCAC3,
  Crc32 : 0xCAC4,
}


export class streamingDecompressor {
  constructor(url) {
    this.eof = false;
    this.shaObj = new jsSHA('SHA-256', 'UINT8ARRAY');
    this.buf = new Uint8Array();
    this.url = url;
    this.compressedResp = null;
    this.decompressor = null;
  }

  async read(length) {
    if (this.compressedResp === null && this.decompressor === null) {
      this.compressedResp = await fetch(this.url, {mode: "cors"});
      this.decompressor = (new XzReadableStream(this.compressedResp.body)).getReader();
    }

    try {
      while (this.buf.length < length) {
        const {done, value} = await this.decompressor.read();
        if (done) {
          this.eof = true;
          break;
        }
        this.shaObj.update(value);
        this.buf = Utils.concatUint8Array([this.buf, value]);
      }
    } catch (error) {
      throw `Error download archive: ${error}`;
    }

    const result = this.buf.slice(0, length);
    this.buf = this.buf.slice(length);

    return result;
  }
}


function parseChunkHeader(chunkHeader) {
  let view = new DataView(chunkHeader.buffer);
  return {
    type : view.getUint16(0, true),
    blocks : view.getUint32(4, true),
    dataBytes : view.getUint32(8, true) - CHUNK_HEADER_SIZE
  }
}


function parseFileHeader(header) {
  let view = new DataView(header.buffer);

  const magic = view.getUint32(0, true);
  const majorVersion = view.getUint16(4, true);
  const minorVersion = view.getUint16(6, true);
  const fileHeadrSize = view.getUint16(8, true);
  const chunkHeaderSize = view.getUint16(10, true);
  const blockSize = view.getUint32(12, true);
  const totalBlocks = view.getUint32(16, true);
  const totalChunks = view.getUint32(20, true);
  const crc32 = view.getUint32(24, true);

  if (magic != FILE_MAGIC) {
    return null;
  }
  if (fileHeadrSize != FILE_HEADER_SIZE) {
    console.error(`The file header size was expected to be 28, but is ${fileHeadrSize}.`);
    return null;
  }
  if (chunkHeaderSize != CHUNK_HEADER_SIZE) {
    console.error(`The chunk header size was expected to be 12, but is ${chunkHeaderSize}.`);
    return null;
  }

  return {
    magic : magic,
    majorVersion : majorVersion,
    minorVersion : minorVersion,
    fileHeadrSize : fileHeadrSize,
    chunkHeaderSize : chunkHeaderSize,
    blockSize : blockSize,
    totalBlocks : totalBlocks,
    totalChunks : totalChunks,
    crc32 : crc32,
  }
}


function checkPartitionHash(checksum, expectedCheckSum) {
  if (checksum !== expectedCheckSum) {
    throw `Checksum mismatch. Got: ${checksum}, expected: ${expectedCheckSum}`;
  }
}


export async function* unsparsify(image, maxYieldSize=MAX_YIELD_SIZE) {
  const downloader = new streamingDecompressor(image.archiveUrl);
  const header = parseFileHeader(await downloader.read(FILE_HEADER_SIZE));
  const blockSize = header.blockSize;
  if (header === null) {
    throw "Invalid sparse image";
  }
  const rawHash = new jsSHA('SHA-256', 'UINT8ARRAY');

  for (let i = 0; i < header.totalChunks; i++) {
    const chunkHeader = parseChunkHeader(await downloader.read(CHUNK_HEADER_SIZE));
    const chunkType = chunkHeader.type;
    const blocks = chunkHeader.blocks;
    const dataSize = chunkHeader.dataBytes;

    if (chunkType == ChunkType.Raw) {
      let remainingBytes = blocks * blockSize;
      while (remainingBytes > 0) {
        const wlen = Math.min(maxYieldSize, remainingBytes);
        yield await downloader.read(wlen);
        remainingBytes -= wlen;
      }
    } else if (chunkType == ChunkType.Fill) {
      const fillData = await downloader.read(dataSize);
      let filler = new Uint8Array(blockSize);
      for (let offset = 0; offset < blockSize; offset += 4) {
        filler.set(fillData, offset);
      }
      for (let block = 0; block < chunkHeader.blocks; block++) {
        yield filler;
      }
    } else if (chunkType == ChunkType.Skip) {
      let byteToSend = chunkHeader.blocks * blockSize;
      while (byteToSend > 0) {
        const wlen = Math.min(maxYieldSize, byteToSend);
        const wData = new Uint8Array(wlen).fill(0);
        yield wData;
        byteToSend -= wlen
      }
    } else {
      throw `Unhandled sparse chunk type: ${chunkType}`;
    }
  }
  checkPartitionHash(downloader.shaObj.getHash('HEX'), image.checksum);
}


export async function* noop(image, maxYieldSize=MAX_YIELD_SIZE) {
  const downloader = new streamingDecompressor(image.archiveUrl);
  while (!downloader.eof) {
    const wData = await downloader.read(maxYieldSize);
    yield wData;
  }
  checkPartitionHash(downloader.shaObj.getHash('HEX'), image.checksum);
}


export async function* splitBlobToChunks(blob, maxYieldSize=MAX_YIELD_SIZE) {
  let bytesToWrite = blob.size;
  let offset = 0;
  while (bytesToWrite > 0) {
    const wlen = Math.min(maxYieldSize, bytesToWrite);
    yield new Uint8Array(await Utils.readBlobAsBuffer(blob.slice(offset, offset + wlen)));
    offset += wlen;
    bytesToWrite -= wlen;
  }
}