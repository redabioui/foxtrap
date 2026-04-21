const http = require('http');
const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');

// ---------------- WEB SERVER ----------------
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
    viewDistance: 'tiny' // Saves RAM on Render
  });

  // ✅ THE ULTIMATE FIX: Raw Packet Injection for 1.21 Resource Packs
  bot._client.on('add_resource_pack', (data) => {
    console.log("📦 Server demands a resource pack. Forcing bypass...");
    try {
      // Send Result 3: "I have successfully downloaded the pack"
      bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 3 });
      
      // Send Result 0: "I have successfully loaded the pack"
      bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 0 });
      
      console.log("📦 Resource pack bypassed successfully!");
    } catch (err) {
      console.log("⚠ Failed to send resource pack bypass:", err.message);
    }
  });

  bot.on('spawn', () => {
    console.log("🟢 Connected to server!");
    sendDiscord("🟢 Bot connected!");
    reconnectDelay = 10000;

    if (afkInterval) clearInterval(afkInterval);

    // Anti-AFK Routine
    afkInterval = setInterval(() => {
      if (!bot.entity) return;
      bot.setControlState('sneak', true);
      setTimeout(() => bot.setControlState('sneak', false), 1000);
      bot.swingArm('right');
      bot.look(Math.random() * Math.PI * 2, 0);
    }, 30000);
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
