const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const { Framer } = require('../src/transforms/framer')
const { createEncryptor, createDecryptor } = require('../src/transforms/encryption')

function originalEncode(batch) {
  const body = Buffer.concat(batch.packets)
  const shouldCompress = body.length > batch.compressionThreshold
  const header = batch.batchHeader ? [batch.batchHeader] : []
  if (batch.writeCompressor) header.push(shouldCompress ? batch.compressionHeader : 255)
  return Buffer.concat([Buffer.from(header), shouldCompress ? batch.compress(body) : body])
}

test('framing matches original bytes across compression settings and packet lengths', () => {
  for (const algorithm of ['none', 'deflate']) {
    for (const batchHeader of [null, 0xfe]) {
      for (const compressionReady of [false, true]) {
        for (const threshold of [undefined, 0, 128, 512, Infinity]) {
          for (const lengths of [[], [0], [1], [127], [128], [511], [512], [513], [16383], [16384], [5, 128, 600]]) {
            const batch = new Framer({ batchHeader, compressionReady,
              features: { compressorInHeader: true }, compressionAlgorithm: algorithm,
              compressionThreshold: threshold, compressionLevel: 6,
              compressionHeader: algorithm === 'none' ? 255 : 0 })
            const packets = lengths.map(length => Buffer.from(Array.from({ length }, (_, i) => i % 251)))
            for (const packet of packets) batch.addEncodedPacket(packet)
            const encoded = batch.encode()
            assert.deepEqual(encoded, originalEncode(batch))
            let body = encoded.subarray((batchHeader ? 1 : 0) + (compressionReady ? 1 : 0))
            if (batch.getBuffer().length > threshold && algorithm === 'deflate') body = zlib.inflateRawSync(body)
            assert.deepEqual(Framer.getPackets(body), packets)
          }
        }
      }
    }
  }
})

test('encoding owns its output and flush/settings updates do not retain old packets', () => {
  const batch = new Framer({ compressionThreshold: Infinity })
  const input = Buffer.from('first')
  batch.addEncodedPacket(input)
  input.fill(0)
  const first = batch.encode()
  const second = batch.encode()
  first.fill(0)
  assert.deepEqual(Framer.getPackets(second), [Buffer.from('first')])
  batch.flush()
  assert.equal(batch.getBuffer().length, 0)
  batch.updateCompressionSettings({ batchHeader: 0xfe, compressionReady: true,
    features: { compressorInHeader: true }, compressionAlgorithm: 'deflate', compressionThreshold: 0 })
  batch.addEncodedPacket(Buffer.from('second'))
  assert.deepEqual(batch.encode(), originalEncode(batch))
})

test('encrypted stream matches original ciphertext, counters and decrypts multiple batches', async () => {
  const secretKeyBytes = Buffer.alloc(32, 42)
  const iv = Buffer.alloc(16, 17)
  const originalCipher = crypto.createCipheriv('aes-256-gcm', secretKeyBytes, iv.subarray(0, 12))
  const received = []
  const receiver = { secretKeyBytes, receiveCounter: 7n, onDecryptedPacket: buffer => received.push(buffer),
    emit: () => assert.fail('checksum verification failed'), disconnect: () => assert.fail('disconnected') }
  const decrypt = createDecryptor(receiver, iv)
  const client = { secretKeyBytes, compressionLevel: 6, sendCounter: 7n, onEncryptedPacket: () => {} }
  const encrypt = createEncryptor(client, iv)
  let counter = 7n
  const chunks = [Buffer.alloc(0), Buffer.from('hello'), crypto.randomBytes(512), Buffer.alloc(65536, 21)]
  for (const chunk of chunks) {
    const compressed = zlib.deflateRawSync(chunk, { level: 6 })
    const body = Buffer.concat([Buffer.from([0]), compressed])
    const counterBytes = Buffer.alloc(8)
    counterBytes.writeBigInt64LE(counter++)
    const checksum = crypto.createHash('sha256').update(counterBytes).update(body).update(secretKeyBytes).digest().subarray(0, 8)
    const expected = originalCipher.update(Buffer.concat([body, checksum]))
    const encrypted = await new Promise(resolve => {
      client.cipher.once('data', resolve)
      encrypt(chunk)
    })
    assert.deepEqual(encrypted, expected)
    decrypt(encrypted)
  }
  assert.equal(client.sendCounter, counter)
  assert.equal(receiver.receiveCounter, counter)
  assert.deepEqual(received, chunks)
})
