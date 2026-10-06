const MAX_MESSAGE_SIZE = 50000; // 262143 IS MAX MESSAGE SIZE EXACT, lower because of larger packets

const ensureBuffer = (data) => {
  if (Buffer.isBuffer(data)) return data
  if (typeof data === 'string') return Buffer.from(data)
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength)

  throw new Error('Unsupported data type for RTC message')
}

class Connection {
  constructor(nethernet, address, rtcConnection) {
    this.nethernet = nethernet
    this.address = address
    this.rtcConnection = rtcConnection
    this.reliable = null
    this.unreliable = null
    this.promisedSegments = 0
    this.fragments = []
    this.fragmentBytes = 0
    this.sendQueue = []
  }

  setChannels(reliable, unreliable) {
    if (reliable) {
      this.reliable = reliable
      this.reliable.binaryType = 'arraybuffer'
      this.reliable.onmessage = (event) => this.handleMessage(event.data)
      this.reliable.onopen = () => this.flushQueue()
    }

    if (unreliable) {
      this.unreliable = unreliable
      this.unreliable.binaryType = 'arraybuffer'
    }
  }

  handleMessage(data) {
    data = ensureBuffer(data)

    if (data.length < 2) throw new Error('Unexpected EOF')

    const segments = data[0]
    data = data.subarray(1)

    if (this.promisedSegments > 0 && this.promisedSegments - 1 !== segments) throw new Error(`Invalid promised segments: expected ${this.promisedSegments - 1}, got ${segments}`)

    this.promisedSegments = segments
    if (segments > 0) {
      // Retain owned bytes: callers may reuse their RTC input buffer.
      this.fragments.push(Buffer.from(data))
      this.fragmentBytes += data.length
      return
    }

    if (this.fragments.length === 0) {
      this.nethernet.emit('encapsulated', data)
      return
    }
    this.fragments.push(data)
    const message = Buffer.concat(this.fragments, this.fragmentBytes + data.length)
    this.fragments.length = 0
    this.fragmentBytes = 0
    this.nethernet.emit('encapsulated', message)
  }

  send(data) {
    const payload = ensureBuffer(data)

    if (!this.reliable || this.reliable.readyState === 'connecting') {
      this.sendQueue.push(payload)
      return 0
    }

    if (this.reliable.readyState === 'closed' || this.reliable.readyState === 'closing') throw new Error('Reliable channel is not open')

    return this.sendNow(payload)
  }

  sendNow(data) {
    const segments = Math.ceil(data.length / MAX_MESSAGE_SIZE)
    if (segments > 256) throw new RangeError('NetherNet message exceeds the 256-fragment limit')
    for (let i = 0, offset = 0; i < segments; i++) {
      const length = Math.min(MAX_MESSAGE_SIZE, data.length - offset)
      const message = Buffer.allocUnsafe(1 + length)
      message[0] = segments - 1 - i
      data.copy(message, 1, offset, offset + length)
      offset += length
      this.reliable?.send(message)
    }

    return data.length
  }

  flushQueue() {
    const queued = this.sendQueue
    this.sendQueue = []
    for (const payload of queued) this.sendNow(payload)
  }

  close() {
    this.sendQueue = []
    this.fragments = []
    this.fragmentBytes = 0
    this.promisedSegments = 0
    this.reliable?.close()
    this.unreliable?.close()
    this.rtcConnection?.close()
  }
}

module.exports = { Connection }
