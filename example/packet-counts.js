const { createClient } = require('../index')
const createOptions = require('./options')

const client = createClient(createOptions())
const counts = new Map()
for (const name of ['play_status', 'start_game', 'text', 'level_chunk', 'move_player']) {
  client.on(name, () => counts.set(name, (counts.get(name) || 0) + 1))
}
const timer = setInterval(() => console.table(Object.fromEntries(counts)), 10000)
timer.unref()
client.on('close', () => {
  clearInterval(timer)
  console.table(Object.fromEntries(counts))
})
client.on('error', error => console.error(error.message))
process.once('SIGINT', () => client.close('Example stopped'))
