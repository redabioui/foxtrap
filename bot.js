const http = require('http');
const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');

// --- Dummy Web Server to keep Render happy ---
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Web server listening on port ${port}`);
});

// --- SESSION SAVER (Prevents 24h Microsoft Lockout) ---
const authFolder = './auth_cache';
const authFile = path.join(authFolder, 'nmp-cache.json');

if (process.env.AUTH_DATA) {
    if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder);
    try { fs.writeFileSync(authFile, process.env.AUTH_DATA); } catch (e) {}
}

let bot = null;
let reconnectDelay = 30000;
let movementInterval = null;

function sendDiscord(msg) {
  if (!process.env.WEBHOOK) return;
  fetch(process.env.WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: msg })
  }).catch(() => {});
}

function startBot() {
  bot = mineflayer.createBot({
    host: '192.135.114.74',         // ✅ HARDCODED IP
    port: 1075,                     // ✅ HARDCODED PORT
    username: process.env.MC_EMAIL, // ✅ Will pull from Render
    auth: 'microsoft',
    version: "1.20.4",
    profilesFolder: authFolder
  });

  bot.on('spawn', () => {
    console.log("Connected to Minecraft server!");
    sendDiscord("✅ Bot connected!");

    setTimeout(() => {
        if (fs.existsSync(authFile)) {
            const data = fs.readFileSync(authFile, 'utf8');
            if (data !== process.env.AUTH_DATA) {
                console.log("\n--- 👇 SAVE THIS TO RENDER ENV 'AUTH_DATA' 👇 ---\n" + data + "\n---------------------------------------------------\n");
            }
        }
    }, 5000);

    reconnectDelay = 30000;

    if (movementInterval) clearInterval(movementInterval);
    movementInterval = setInterval(() => {
      if (!bot.entity) return;
      bot.swingArm('right');
      console.log("Clicked (5m interval)");
    }, 300000);
  });

  bot.on('end', () => {
    console.log("Disconnected");
    sendDiscord("⚠️ Disconnected. Reconnecting in " + (reconnectDelay / 1000) + "s");
    if (movementInterval) clearInterval(movementInterval);
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 300000);
      startBot();
    }, reconnectDelay);
  });

  bot.on('error', (err) => {
    console.log("Error:", err.message);
    if (!err.message.includes('timed out')) {
        sendDiscord("⚠ Error: " + err.message);
    }
  });
}

process.on('unhandledRejection', err => console.log("Unhandled:", err.message));
process.on('uncaughtException', err => console.log("Crash:", err.message));

startBot();
