// Global sparse image handling utility
window.SparseUtils = (function() {
    // Sparse image format constants
    const SPARSE_HEADER_MAGIC = 0xed26ff3a;
    const SPARSE_HEADER_MAJOR_VER = 1;
    const SPARSE_HEADER_MINOR_VER = 0;
    const SPARSE_HEADER_SIZE = 28;
    const CHUNK_HEADER_SIZE = 12;

    // Chunk types
    const CHUNK_TYPE_RAW = 0xCAC1;
    const CHUNK_TYPE_FILL = 0xCAC2;
    const CHUNK_TYPE_DONT_CARE = 0xCAC3;
    const CHUNK_TYPE_CRC32 = 0xCAC4;

    class SparseImage {
        constructor(data) {
            this.data = data;
            this.offset = 0;
            this.totalBlocks = 0;
            this.chunks = [];
            this.parse();
        }

        readUint32() {
            const value = new DataView(this.data.buffer).getUint32(this.offset, true);
            this.offset += 4;
            return value;
        }

        parse() {
            // Parse header
            const magic = this.readUint32();
            if (magic !== SPARSE_HEADER_MAGIC) {
                throw new Error('Invalid sparse image magic');
            }

            const majorVersion = this.readUint32();
            const minorVersion = this.readUint32();
            const fileHeaderSize = this.readUint32();
            const chunkHeaderSize = this.readUint32();
            const blockSize = this.readUint32();
            const totalBlocks = this.readUint32();
            const totalChunks = this.readUint32();
            this.readUint32(); // Skip CRC

            if (majorVersion !== SPARSE_HEADER_MAJOR_VER || 
                minorVersion !== SPARSE_HEADER_MINOR_VER ||
                fileHeaderSize !== SPARSE_HEADER_SIZE ||
                chunkHeaderSize !== CHUNK_HEADER_SIZE) {
                throw new Error('Unsupported sparse image version');
            }

            this.blockSize = blockSize;
            this.totalBlocks = totalBlocks;

            // Parse chunks
            for (let i = 0; i < totalChunks; i++) {
                const chunkType = this.readUint32();
                const chunkBlocks = this.readUint32();
                const chunkDataSize = this.readUint32();

                this.chunks.push({
                    type: chunkType,
                    blocks: chunkBlocks,
                    dataSize: chunkDataSize,
                    offset: this.offset
                });

                this.offset += chunkDataSize;
            }
        }

        async unpack() {
            const totalBytes = this.totalBlocks * this.blockSize;
            const output = new Uint8Array(totalBytes);
            let outputOffset = 0;

            for (const chunk of this.chunks) {
                const chunkBytes = chunk.blocks * this.blockSize;

                switch (chunk.type) {
                    case CHUNK_TYPE_RAW:
                        // Copy raw data
                        output.set(
                            new Uint8Array(this.data.buffer, chunk.offset, chunk.dataSize),
                            outputOffset
                        );
                        break;

                    case CHUNK_TYPE_FILL:
                        // Fill with 4-byte pattern
                        const pattern = new Uint32Array(this.data.buffer, chunk.offset, 1)[0];
                        const patternBytes = new Uint8Array(4);
                        new DataView(patternBytes.buffer).setUint32(0, pattern, true);
                        
                        for (let i = 0; i < chunkBytes; i += 4) {
                            output.set(patternBytes, outputOffset + i);
                        }
                        break;

                    case CHUNK_TYPE_DONT_CARE:
                        // Fill with zeros
                        output.fill(0, outputOffset, outputOffset + chunkBytes);
                        break;

                    case CHUNK_TYPE_CRC32:
                        // Skip CRC chunks
                        break;

                    default:
                        throw new Error(`Unknown chunk type: ${chunk.type}`);
                }

                outputOffset += chunkBytes;
            }

            return output;
        }

        static isSparse(data) {
            if (data.length < 4) return false;
            const magic = new DataView(data.buffer).getUint32(0, true);
            return magic === SPARSE_HEADER_MAGIC;
        }
    }

    // Public API
    return {
        SparseImage: SparseImage,
        isSparse: SparseImage.isSparse,
        // Constants
        SPARSE_HEADER_MAGIC,
        CHUNK_TYPE_RAW,
        CHUNK_TYPE_FILL,
        CHUNK_TYPE_DONT_CARE,
        CHUNK_TYPE_CRC32
    };
})();
