const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const zlib = require('zlib')

class Framer {
  constructor(client) {
    // Encoding
    this.packets = []
    this.updateCompressionSettings(client)
  }

  updateCompressionSettings(client) {
    this.batchHeader = client.batchHeader
    this.compressor = client.compressionAlgorithm || 'none'
    this.compressionLevel = client.compressionLevel
    this.compressionThreshold = client.compressionThreshold
    this.compressionHeader = client.compressionHeader || 0
    this.writeCompressor = Boolean(client.features?.compressorInHeader && client.compressionReady)
  }

  // No compression in base class
  compress(buffer) {
    switch (this.compressor) {
      case 'deflate': return zlib.deflateRawSync(buffer, { level: this.compressionLevel })
      case 'none': return buffer
    }
  }

  static decompress(algorithm, buffer) {
    switch (algorithm) {
      case 0:
      case 'deflate':
        return zlib.inflateRawSync(buffer, { chunkSize: 512000 })
      case 'none':
      case 255:
        return buffer
      default: throw Error('Unknown compression type ' + algorithm)
    }
  }

  static decode(client, buf) {
    if (client.batchHeader && buf[0] !== client.batchHeader) throw Error(`bad batch packet header, received: ${buf[0]}, expected: ${client.batchHeader}`)
    const buffer = buf.slice(client.batchHeader ? 1 : 0)

    let decompressed

    if (client.compressionReady) {
      decompressed = this.decompress(buffer[0], buffer.slice(1))
    } else {
      try {
        decompressed = this.decompress(client.compressionAlgorithm, buffer)
      } catch (e) {
        decompressed = buffer
      }
    }

    return Framer.getPackets(decompressed)
  }

  encode() {
    let length = 0
    for (const packet of this.packets) length += packet.length
    const shouldCompress = length > this.compressionThreshold
    const headerLength = (this.batchHeader ? 1 : 0) + (this.writeCompressor ? 1 : 0)
    const compressPayload = shouldCompress && this.compressor !== 'none'
    const compressed = compressPayload
      ? this.compress(Buffer.concat(this.packets, length))
      : null
    const buffer = Buffer.allocUnsafe(headerLength + (compressPayload ? compressed.length : length))
    let offset = 0
    if (this.batchHeader) buffer[offset++] = this.batchHeader
    if (this.writeCompressor) buffer[offset++] = shouldCompress ? this.compressionHeader : 255
    if (compressPayload) {
      compressed.copy(buffer, offset)
    } else {
      for (const packet of this.packets) offset += packet.copy(buffer, offset)
    }
    return buffer
  }

  addEncodedPacket(chunk) {
    const varIntSize = sizeOfVarInt(chunk.byteLength)
    const buffer = Buffer.allocUnsafe(varIntSize + chunk.byteLength)

    writeVarInt(chunk.length, buffer, 0)
    chunk.copy(buffer, varIntSize)

    this.packets.push(buffer)
  }

  flush() {
    this.packets = []
  }

  getBuffer() {
    return Buffer.concat(this.packets)
  }

  static getPackets(buffer) {
    const packets = [];
    let offset = 0;

    while (offset < buffer.byteLength) {
      const { value, size } = readVarInt(buffer, offset);
      offset += size;

      const packet = buffer.slice(offset, offset + value);
      packets.push(packet);

      offset += value;
    }

    return packets;
  }
}

module.exports = { Framer }
