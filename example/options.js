const path = require('node:path')
const { Authflow, Titles } = require('prismarine-auth')

module.exports = function createOptions() {
  const version = process.env.BEDROCK_VERSION
  const protocolVersion = Number(process.env.BEDROCK_PROTOCOL)
  const port = Number(process.env.BEDROCK_PORT || 19132)
  if (!version || !Number.isInteger(protocolVersion) || protocolVersion <= 0) {
    console.error('Set BEDROCK_VERSION and BEDROCK_PROTOCOL to match the bundled protocol schema and your server.')
    process.exit(1)
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('BEDROCK_PORT must be an integer between 1 and 65535.')
    process.exit(1)
  }
  const profilesFolder = path.resolve(__dirname, '../auth')
  const onMsaCode = code => console.log(code.message)
  const authOptions = { flow: 'sisu', authTitle: Titles.MinecraftIOS, deviceType: 'iOS' }
  return {
    host: process.env.BEDROCK_HOST || '127.0.0.1', port,
    version, protocolVersion, transport: 'DEFAULT', profilesFolder,
    ...authOptions, onMsaCode, skinData: {}, compressionLevel: 6,
    authflow: new Authflow(process.env.BEDROCK_ACCOUNT || 'example', profilesFolder, authOptions, onMsaCode)
  }
}
