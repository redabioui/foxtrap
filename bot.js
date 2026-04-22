const http = require('http');
const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');

// ---------------- DEEP DISCORD LOGGING ----------------
let logBuffer = [];

setInterval(() => {
  if (logBuffer.length > 0 && process.env.WEBHOOK) {
    const content = logBuffer.join('\n').substring(0, 1980); 
    fetch(process.env.WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `\`\`\`\n${content}\n\`\`\`` })
    }).catch(() => {});
    logBuffer = [];
  }
}, 3000); 

function deepLog(msg) {
  const time = new Date().toISOString().split('T')[1].split('.')[0]; 
  const formatted = `[${time}] ${msg}`;
  console.log(formatted);
  logBuffer.push(formatted);
}

// ---------------- HARDENED WEB SERVER ----------------
const server = http.createServer((req, res) => {
  // Ignore ghost requests from pingers that cause lag
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  // Force the pinger to hang up immediately
  res.setHeader('Connection', 'close');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is awake and secured!');
});

server.on('error', (err) => {
    deepLog(`[WEB SERVER ERROR] ${err.message}`);
});

server.keepAliveTimeout = 2000;

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

function startBot() {
  deepLog("SYSTEM: Booting up new bot instance...");
  
  bot = mineflayer.createBot({
    host: process.env.SERVER_IP,
    port: Number(process.env.SERVER_PORT) || 25565,
    username: process.env.MC_EMAIL,
    auth: 'microsoft',
    version: "1.21.11", 
    profilesFolder: authFolder,
    viewDistance: 'tiny',
    
    // 10-minute lag tolerance to survive Render network drops
    checkTimeoutInterval: 600000 
  });

  // 🛡️ DISABLE PHYSICS: Saves Render CPU
  bot.physicsEnabled = false;

  bot._client.on('error', (err) => {
      deepLog(`[TCP ERROR] Raw socket failed: ${err.message}`);
  });

  // 📦 RESOURCE PACK BYPASS
  bot._client.on('add_resource_pack', (data) => {
    deepLog("📦 Server requested resource pack. Attempting bypass...");
    try {
      bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 3 });
      setTimeout(() => {
          bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 4 });
          setTimeout(() => {
              bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 0 });
              deepLog("📦 Resource pack bypass sequence completed.");
          }, 2000);
      }, 3000);
    } catch (err) {
      deepLog(`⚠ Pack Bypass Failed: ${err.message}`);
    }
  });

  bot.on('message', (message) => {
    const text = message.toString();
    if (text.trim()) {
        deepLog(`[CHAT] ${text}`);
    }
  });

  bot.on('spawn', () => {
    deepLog("🟢 SUCCESS: Bot has officially spawned into the world!");
    reconnectDelay = 10000;

    if (afkInterval) clearInterval(afkInterval);

    // 🏃 TCP SOCKET WARMER (Safe Anti-AFK)
    afkInterval = setInterval(() => {
      if (!bot.entity) return;
      try {
          bot.swingArm('right');
          bot.setQuickBarSlot(Math.floor(Math.random() * 9)); 
      } catch (e) {}
    }, 15000);
  });

  bot.on('end', (reason) => {
    deepLog(`🔴 DISCONNECTED: ${reason}`);
    deepLog(`🔄 Reconnecting in ${reconnectDelay / 1000} seconds...`);
    if (afkInterval) clearInterval(afkInterval);

    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 300000); 
      startBot();
    }, reconnectDelay);
  });

  bot.on('kicked', (reason) => {
    deepLog(`⚠ KICKED BY SERVER. Raw Reason: ${JSON.stringify(reason)}`);
  });

  bot.on('error', (err) => {
    deepLog(`🚨 BOT FATAL ERROR: ${err.stack}`);
  });
}

// ---------------- CRASH SAFETY ----------------
process.on('unhandledRejection', (reason, promise) => {
    deepLog(`🔥 NODE JS UNHANDLED REJECTION: ${reason}`);
});
process.on('uncaughtException', (err) => {
    deepLog(`🔥 NODE JS EXCEPTION: ${err.stack}`);
});

// Initialize
startBot();
