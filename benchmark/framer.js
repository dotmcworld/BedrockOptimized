const { performance } = require('node:perf_hooks')
const assert = require('node:assert/strict')
const { Framer } = require('../src/transforms/framer')

function originalEncode() {
  const buf = Buffer.concat(this.packets)
  const shouldCompress = buf.length > this.compressionThreshold
  const header = this.batchHeader ? [this.batchHeader] : []
  if (this.writeCompressor) header.push(shouldCompress ? this.compressionHeader : 255)
  return Buffer.concat([Buffer.from(header), shouldCompress ? this.compress(buf) : buf])
}

let sink = 0
function measure(batch, encode, iterations) {
  const start = performance.now()
  for (let i = 0; i < iterations; i++) sink ^= encode.call(batch).length
  return performance.now() - start
}

const results = []
for (const [name, count, size, algorithm, threshold, iterations] of [
  ['small uncompressed', 1, 64, 'deflate', 512, 200000],
  ['multi-packet uncompressed', 8, 32, 'deflate', 512, 100000],
  ['large compression disabled', 1, 65536, 'none', 512, 10000],
  ['deflate control', 8, 256, 'deflate', 512, 5000]
]) {
  const batch = new Framer({ batchHeader: 0xfe, compressionReady: true,
    features: { compressorInHeader: true }, compressionAlgorithm: algorithm,
    compressionHeader: algorithm === 'none' ? 255 : 0,
    compressionThreshold: threshold, compressionLevel: 6 })
  for (let i = 0; i < count; i++) batch.addEncodedPacket(Buffer.alloc(size, i + 1))
  assert.deepEqual(batch.encode(), originalEncode.call(batch))
  measure(batch, originalEncode, 3000)
  measure(batch, batch.encode, 3000)
  const before = []
  const after = []
  for (let round = 0; round < 7; round++) {
    if (round % 2 === 0) {
      before.push(measure(batch, originalEncode, iterations))
      after.push(measure(batch, batch.encode, iterations))
    } else {
      after.push(measure(batch, batch.encode, iterations))
      before.push(measure(batch, originalEncode, iterations))
    }
  }
  before.sort((a, b) => a - b)
  after.sort((a, b) => a - b)
  results.push({ workload: name, iterations, originalMs: +before[3].toFixed(2),
    optimizedMs: +after[3].toFixed(2), speedup: +(before[3] / after[3]).toFixed(2) })
}
console.log(JSON.stringify({ node: process.version, platform: process.platform,
  arch: process.arch, statistic: 'median of seven alternating rounds', results, sink }, null, 2))
