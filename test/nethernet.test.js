const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const vm = require('node:vm')
const { Connection } = require('../src/nethernet/src/connection')

test('fragmentation round trips exact bytes across segment boundaries', () => {
  for (const size of [1, 49999, 50000, 50001, 100000, 800000]) {
    const input = Buffer.alloc(size)
    for (let i = 0; i < size; i++) input[i] = i % 251
    const frames = []
    const sender = new Connection(new EventEmitter())
    sender.reliable = { send: frame => frames.push(frame) }
    assert.equal(sender.sendNow(input), size)
    assert.equal(frames.length, Math.ceil(size / 50000))
    const bus = new EventEmitter()
    const receiver = new Connection(bus)
    const messages = []
    bus.on('encapsulated', data => messages.push(data))
    for (let i = 0; i < frames.length; i++) {
      assert.equal(frames[i][0], frames.length - 1 - i)
      receiver.handleMessage(frames[i])
      if (frames.length > 1) frames[i].fill(0)
    }
    assert.deepEqual(messages, [input])
    assert.equal(receiver.fragmentBytes, 0)
    assert.equal(receiver.fragments.length, 0)
  }
})

test('typed array offsets, out-of-order fragments and size limits are handled', () => {
  const bus = new EventEmitter()
  const receiver = new Connection(bus)
  let output
  bus.on('encapsulated', data => { output = data })
  const backing = Uint8Array.from([99, 0, 42, 99])
  receiver.handleMessage(new DataView(backing.buffer, 1, 2))
  assert.deepEqual(output, Buffer.from([42]))
  receiver.handleMessage(Buffer.from([2, 1]))
  assert.throws(() => receiver.handleMessage(Buffer.from([0, 2])), /Invalid promised segments/)
  receiver.handleMessage(Buffer.from([1, 2]))
  receiver.handleMessage(Buffer.from([0, 3]))
  assert.deepEqual(output, Buffer.from([1, 2, 3]))
  const sender = new Connection(bus)
  sender.reliable = { send: () => assert.fail('oversize frame was sent') }
  assert.throws(() => sender.sendNow(Buffer.alloc(12800001)), /256-fragment limit/)
})

test('receive state is reset before callbacks, supporting consecutive and reentrant messages', () => {
  const bus = new EventEmitter()
  const receiver = new Connection(bus)
  const outputs = []
  bus.on('encapsulated', data => {
    outputs.push(data.toString())
    if (outputs.length === 1) receiver.handleMessage(Buffer.from([0, 67]))
  })
  receiver.handleMessage(Buffer.from([1, 65]))
  receiver.handleMessage(Buffer.from([0, 66]))
  receiver.handleMessage(Buffer.from([0, 68]))
  assert.deepEqual(outputs, ['AB', 'C', 'D'])
})

test('queued sends drain once and close releases pending buffers', () => {
  const connection = new Connection(new EventEmitter())
  assert.equal(connection.send(Buffer.from('first')), 0)
  assert.equal(connection.send(Buffer.from('second')), 0)
  const frames = []
  const channel = { readyState: 'connecting', send: frame => frames.push(frame), close: () => {} }
  connection.setChannels(channel)
  channel.readyState = 'open'
  channel.onopen()
  channel.onopen()
  assert.deepEqual(frames.map(frame => frame.subarray(1).toString()), ['first', 'second'])
  assert.equal(connection.sendQueue.length, 0)
  connection.handleMessage(Buffer.from([1, 42]))
  connection.close()
  assert.equal(connection.fragments.length, 0)
  assert.equal(connection.fragmentBytes, 0)
  assert.equal(connection.promisedSegments, 0)
})

test('relay chunk queue preserves FIFO order without shifting and handles reentrant flushes', () => {
  class Server extends EventEmitter { constructor(options) { super(); this.options = options } }
  const context = { module: { exports: {} }, console, require: name => {
    if (name === './server') return { Server }
    if (name === './serverPlayer') return { Player: EventEmitter }
    if (name === './client') return { Client: EventEmitter }
    assert.fail('Unexpected import: ' + name)
  } }
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/relay'), 'utf8'), context)
  const relay = new context.module.exports.Relay({})
  const flush = relay.RelayPlayer.prototype.flushChunks
  const sent = []
  const chunks = Array.from({ length: 10000 }, (_, i) => i)
  chunks.shift = () => assert.fail('queue was shifted')
  const player = { chunkSendCache: chunks, sendBuffer: chunk => {
    sent.push(chunk)
    if (chunk === 0) flush.call(player)
  } }
  flush.call(player)
  assert.deepEqual(sent, Array.from({ length: 10000 }, (_, i) => i))
  assert.equal(player.chunkSendCache.length, 0)
})
