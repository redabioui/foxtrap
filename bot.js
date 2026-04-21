const http = require('http');
const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');

// ---------------- WEB SERVER (Keeps Render Alive) ----------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is alive and running!');
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Web server listening on port ${port}`);
});

// ---------------- AUTH CACHE ----------------
const authFolder = './auth_cache';
const authFile = path.join(authFolder, 'nmp-cache.json');

if (process.env.AUTH_DATA) {
  if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder);
  fs.writeFileSync(authFile, process.env.AUTH_DATA);
}

// ---------------- BOT LOGIC ----------------
let bot;
let reconnectDelay = 10000; // Start with 10s delay
let afkInterval;

function sendDiscord(msg) {
  if (!process.env.WEBHOOK) return;
  fetch(process.env.WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: msg })
  }).catch(() => {});
}

function startBot() {
  console.log("Starting bot...");
  bot = mineflayer.createBot({
    host: process.env.SERVER_IP,
    port: Number(process.env.SERVER_PORT) || 25565,
    username: process.env.MC_EMAIL,
    auth: 'microsoft',
    
    // ✅ LOCKED TO EXACT VERSION
    version: "1.21.11", 
    
    profilesFolder: authFolder
  });

  bot.on('spawn', () => {
    console.log("🟢 Connected to server!");
    sendDiscord("🟢 Bot connected!");
    reconnectDelay = 10000; // Reset delay on successful connection

    if (afkInterval) clearInterval(afkInterval);

    // ✅ AGGRESSIVE ANTI-AFK: Sneak, swing, and look every 30 seconds
    afkInterval = setInterval(() => {
      if (!bot.entity) return;
      
      bot.setControlState('sneak', true);
      setTimeout(() => bot.setControlState('sneak', false), 1000);
      
      bot.swingArm('right');
      bot.look(Math.random() * Math.PI * 2, 0);
    }, 30000); 
  });

  // ✅ AUTO-REJOIN LOGIC
  bot.on('end', (reason) => {
    console.log(`🔴 Disconnected: ${reason}`);
    sendDiscord(`🔴 Disconnected (${reason}). Reconnecting in ${reconnectDelay / 1000}s`);
    if (afkInterval) clearInterval(afkInterval);

    // Auto-reconnect with exponential backoff (capped at 5 mins)
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 300000); 
      startBot();
    }, reconnectDelay);
  });

  bot.on('kicked', (reason) => {
    console.log(`⚠ Kicked: ${reason}`);
    sendDiscord(`⚠ Kicked: ${reason}`);
  });

  bot.on('error', (err) => {
    console.log("⚠ Bot Error:", err.message);
    // The 'end' event will trigger right after an error and handle the rejoin automatically
  });
}

// ---------------- CRASH SAFETY ----------------
// ✅ These prevent the entire Node.js app from crashing and stopping on Render
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// Initialize
startBot();
