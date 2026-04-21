const http = require('http');
const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');

// ---------------- WEB SERVER (For Render Health Checks) ----------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
});

const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
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
let reconnectDelay = 10000;
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
    version: "1.21.11",
    profilesFolder: authFolder,
    viewDistance: 'tiny',
    checkTimeoutInterval: 600000 // 10-minute lag tolerance
  });

  // 🛡️ DISABLE PHYSICS
  bot.physicsEnabled = false;

  // ⚡ RAW KEEPALIVE BYPASS
  bot._client.on('keep_alive', (packet) => {
      try {
          bot._client.write('keep_alive', { keepAliveId: packet.keepAliveId });
      } catch (e) {}
  });

  // 📦 RESOURCE PACK BYPASS
  bot._client.on('add_resource_pack', (data) => {
    console.log("📦 Bypassing server resource pack...");
    try {
      bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 3 });
      setTimeout(() => {
          bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 4 });
          setTimeout(() => {
              bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 0 });
              console.log("📦 Pack bypass successful!");
          }, 2000);
      }, 3000);
    } catch (err) {
      console.log("⚠ Failed to bypass pack:", err.message);
    }
  });

  bot.on('message', (message) => {
    const text = message.toString();
    if (text.trim()) {
        console.log(`[CHAT] ${text}`);
    }
  });

  bot.on('spawn', () => {
    console.log("🟢 Connected to server!");
    sendDiscord("🟢 Bot connected!");
    reconnectDelay = 10000;

    if (afkInterval) clearInterval(afkInterval);

    // 🏃 TCP SOCKET WARMER (Runs every 15 seconds)
    // Swapping hotbar slots forces data through the proxy so it doesn't close the socket
    afkInterval = setInterval(() => {
      if (!bot.entity) return;
      
      try {
          bot.swingArm('right');
          bot.setQuickBarSlot(Math.floor(Math.random() * 9)); 
      } catch (e) {
          // Ignore errors if the bot hasn't fully loaded its inventory yet
      }
      
    }, 15000);
  });

  bot.on('end', (reason) => {
    console.log(`🔴 Disconnected: ${reason}`);
    sendDiscord(`🔴 Disconnected (${reason}). Reconnecting in ${reconnectDelay / 1000}s`);
    if (afkInterval) clearInterval(afkInterval);

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
  });
}

// ---------------- CRASH SAFETY ----------------
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// Initialize
startBot();
