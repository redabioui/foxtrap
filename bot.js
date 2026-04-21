const http = require('http')
const mineflayer = require('mineflayer')
const fs = require('fs')
const path = require('path')

// ---------------- WEB SERVER ----------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Bot is running!')
})

const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Web server listening on port ${port}`)
})
// --------------------------------------------

// ---------------- AUTH ----------------
const authFolder = './auth_cache'
const authFile = path.join(authFolder, 'nmp-cache.json')

if (process.env.AUTH_DATA) {
  if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder)
  fs.writeFileSync(authFile, process.env.AUTH_DATA)
}
// --------------------------------------

let bot
let reconnectDelay = 30000
let movementInterval

function sendDiscord(msg) {
  if (!process.env.WEBHOOK) return
  fetch(process.env.WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: msg })
  }).catch(() => {})
}

function startBot() {
  bot = mineflayer.createBot({
    host: process.env.SERVER_IP,
    port: Number(process.env.SERVER_PORT),
    username: process.env.MC_EMAIL,
    auth: 'microsoft',

    // ✅ FIX #1: MATCH SERVER VERSION
    version: "1.21.11",

    profilesFolder: authFolder
  })

  bot.on('spawn', () => {
    console.log("Connected")
    sendDiscord("🟢 Bot connected!")

    reconnectDelay = 30000

    if (movementInterval) clearInterval(movementInterval)

    movementInterval = setInterval(() => {
      if (!bot.entity) return
      bot.swingArm('right')
    }, 300000)
  })

  bot.on('end', () => {
    console.log("Disconnected")
    sendDiscord(`🔴 Disconnected. Reconnecting in ${reconnectDelay / 1000}s`)

    if (movementInterval) clearInterval(movementInterval)

    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 300000)
      startBot()
    }, reconnectDelay)
  })

  bot.on('error', (err) => {
    console.log("Error:", err.message)
    sendDiscord("⚠ Error: " + err.message)
  })
}

// ---------------- CRASH SAFETY ----------------
process.on('unhandledRejection', e => console.log(e))
process.on('uncaughtException', e => console.log(e))
// ---------------------------------------------

startBot()
