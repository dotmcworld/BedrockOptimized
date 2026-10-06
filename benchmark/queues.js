const { performance } = require('node:perf_hooks')
const assert = require('node:assert/strict')
const { Connection } = require('../src/nethernet/src/connection')

const { Connection: OriginalReceiver } = require('./fixtures/nethernet-legacy')

let sink = 0
function medianComparison(before, after, iterations) {
  const samples = [[], []]
  const operations = [before, after]
  for (const operation of operations) for (let i = 0; i < 3; i++) operation()
  for (let round = 0; round < 7; round++) {
    for (const index of round % 2 ? [1, 0] : [0, 1]) {
      const start = performance.now()
      for (let i = 0; i < iterations; i++) operations[index]()
      samples[index].push(performance.now() - start)
    }
  }
  for (const sample of samples) sample.sort((a, b) => a - b)
  return { iterations, originalMs: +samples[0][3].toFixed(2), optimizedMs: +samples[1][3].toFixed(2),
    speedup: +(samples[0][3] / samples[1][3]).toFixed(2) }
}

const results = []
for (const [count, iterations] of [[1, 10000], [8, 300], [64, 20], [256, 3]]) {
  const frames = Array.from({ length: count }, (_, i) => {
    const frame = Buffer.alloc(50001, i % 251)
    frame[0] = count - 1 - i
    return frame
  })
  const outputs = []
  const bus = { emit: (name, output) => { sink ^= output.length; outputs.push(output) } }
  const original = new OriginalReceiver(bus)
  const optimized = new Connection(bus)
  for (const frame of frames) original.handleMessage(frame)
  for (const frame of frames) optimized.handleMessage(frame)
  assert.deepEqual(outputs[0], outputs[1])
  bus.emit = (name, output) => { sink ^= output.length }
  results.push({ workload: `${count} x 50 KB fragments`, ...medianComparison(
    () => { for (const frame of frames) original.handleMessage(frame) },
    () => { for (const frame of frames) optimized.handleMessage(frame) }, iterations) })
}
for (const count of [1000, 30000]) {
  const data = Array.from({ length: count }, (_, i) => i)
  results.push({ workload: `drain ${count} relay chunks (including queue clone)`, ...medianComparison(
    () => { const queue = data.slice(); while (queue.length) sink ^= queue.shift() },
    () => { const queue = data.slice(); for (const chunk of queue) sink ^= chunk }, 20) })
}
console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch,
  statistic: 'median of seven alternating rounds', results, sink }, null, 2))
