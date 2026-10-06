const { Relay } = require('../index')
const createOptions = require('./options')

const upstream = createOptions()
const port = Number(process.env.RELAY_PORT || 19133)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('RELAY_PORT must be an integer between 1 and 65535.')
  process.exit(1)
}
const relay = new Relay({
  ...upstream, host: '127.0.0.1', port, motd: 'BedrockOptimized example',
  maxPlayers: 1, compressionAlgorithm: 'deflate', compressionThreshold: 512,
  destination: { host: upstream.host, port: upstream.port, transport: upstream.transport }
})
relay.on('connect', player => {
  console.log('Local player connected')
  player.on('close', () => console.log('Local player disconnected'))
})
relay.on('join', () => console.log('Upstream relay connected'))
relay.on('error', error => console.error(error.message))
relay.listen().then(() => {
  console.log(`Connect Minecraft to 127.0.0.1:${port}`)
  process.once('SIGINT', () => relay.close('Example stopped'))
})
