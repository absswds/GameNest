const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const startupLogPath = path.join(__dirname, 'android-startup.log');

// Language packs
const SERVER_LANGS = {
  zh: require('./lang/server-zh'),
  en: require('./lang/server-en'),
};
function serverT(room, key) {
  const lang = (room && room._lang) || 'zh';
  const pack = SERVER_LANGS[lang] || SERVER_LANGS.zh;
  return pack[key] || key;
}
function logStep(message) {
  try {
    fs.appendFileSync(startupLogPath, message + '\n');
  } catch (err) {}
}
logStep('[android-node] server.js require: express');
logStep('[android-node] server.js require: http');
logStep('[android-node] server.js require: ws');
logStep('[android-node] server.js require: os/path/fs/crypto');
logStep('[android-node] server.js require: startup-port');
const { getNextPort, isRecoverablePortError } = require('./startup-port');

const PORT = parseInt(process.env.PORT) || 3000;
const MAX_PORT_RETRIES = 5;
const DISCONNECT_GRACE_MS = 30000;
let activePort = PORT;

// Load game registry
const gameRegistry = Object.create(null);
const gamesDir = path.join(__dirname, 'games');
// Temporary startup isolation for Android crash triage.
// If this server boots with registries disabled, a specific module load is the culprit.
if (!process.env.ANDROID_SKIP_REGISTRY_LOAD) {
  fs.readdirSync(gamesDir).forEach(file => {
    if (file.endsWith('.js')) {
      logStep('[android-node] loading game module: ' + file);
      const mod = require(path.join(gamesDir, file));
      gameRegistry[mod.name] = mod;
    }
  });
}

// Load bot registry
const botRegistry = Object.create(null);
const botsDir = path.join(__dirname, 'bots');
if (fs.existsSync(botsDir) && !process.env.ANDROID_SKIP_REGISTRY_LOAD) {
  fs.readdirSync(botsDir).forEach(file => {
    if (file.endsWith('.js')) {
      logStep('[android-node] loading bot module: ' + file);
      const mod = require(path.join(botsDir, file));
      botRegistry[mod.name] = mod;
    }
  });
}

logStep('[android-node] server.js require: qrcode');
const QRCode = require('qrcode');
logStep('[android-node] server.js require complete');

logStep('[android-node] server.js init express app');
const app = express();
// Always revalidate static assets so clients never run a stale cached HTML/CSS/JS.
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  },
}));

// QR code endpoint — generates QR with the host from the request
// Works on LAN (192.168.x.x:3000) and cloud (project.up.railway.app)
app.get('/qr', async (req, res) => {
  try {
    const room = req.query.room;
    if (!room) { res.status(400).send('missing room'); return; }
    const host = req.get('Host') || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const url = `${proto}://${host}/?room=${room}`;
    const png = await QRCode.toBuffer(url, { width: 256, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' } });
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    res.status(500).send('qr error');
  }
});

// Lightweight room existence check (used by lobby to verify resume banner)
app.get('/api/room-exists/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  res.json({ exists: !!room });
});

app.get('/network-info', (req, res) => {
  const lanURLs = getShareableLanIPs().map(({ name, ip }) => ({
    name,
    ip,
    url: `http://${ip}:${activePort}/`,
  }));
  res.json({
    port: activePort,
    localURL: `http://localhost:${activePort}/`,
    lanURLs,
  });
});

logStep('[android-node] server.js init http/ws server');
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wss.on('error', (err) => {
  if (isRecoverablePortError(err)) return;
  console.error('WebSocket server error:', err.message);
});

// WebSocket keep-alive heartbeat: every 30s ping all clients,
// terminate any that didn't respond within the interval.
// This survives Railway's 5-minute idle proxy timeout.
const wssHeartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws._isAlive === false) return ws.terminate();
    ws._isAlive = false;
    try { ws.ping(); } catch (e) { /* already closed */ }
  });
}, 30000);
wss.on('close', () => clearInterval(wssHeartbeat));

// ---- Room & Game Management ----
const rooms = new Map();

// Short memorable room IDs: 3-4 char alphanumeric, easy to type & share
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  const len = Math.random() < 0.5 ? 3 : 4;
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function createRoom(ws, gameType, lang) {
  const gameMod = gameRegistry[gameType];
  if (!gameMod) { return null; }
  const roomId = generateRoomId();
  const room = {
    game: gameType,
    maxPlayers: gameMod.maxPlayers,
    _lang: lang || 'zh',
    players: new Map(),
    bots: new Map(),
    state: gameMod.createState(),
    hostWS: ws,
    _roomId: roomId,
    _cleanupTimer: null,
    _botTimer: null,
    _realtimeTimer: null,
    // Lobby phase system
    phase: 'lobby',            // 'lobby' | 'ready' | 'playing'
    readyPlayers: new Set(),   // Set of player indices that are ready
    options: {},               // Game-specific options (e.g. requireBreak)
  };
  room.players.set(ws, { name: 'Player 1', index: 0, avatar: '😊', resumeToken: crypto.randomUUID(), disconnectedAt: null });
  rooms.set(roomId, room);
  return { roomId, room };
}

function sendToRoom(room, data, excludeWs) {
  const payload = JSON.stringify(data);
  for (const client of room.players.keys()) {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(payload);
    }
  }
}

function broadcastRoom(room, data) {
  sendToRoom(room, data, null);
}

function roomPlayersList(room) {
  const list = [];
  for (const [client, info] of room.players) {
    const isHost = room.players.get(room.hostWS) === info;
    list.push({
      name: info.name,
      index: info.index,
      isBot: false,
      avatar: info.avatar || '😊',
      ready: room.readyPlayers.has(info.index),
      isHost,
      connected: client.readyState === 1,
    });
  }
  if (room.bots) {
    for (const [index, bot] of room.bots) {
      list.push({
        name: bot.name,
        index,
        isBot: true,
        avatar: '🤖',
        ready: true,
        isHost: false,
      });
    }
  }
  list.sort((a, b) => a.index - b.index);
  return list;
}

function skipDisconnectedTurn(room) {
  const state = room && room.state;
  const turnKey = state && state.phase === 'shooting' && Number.isInteger(state.currentShooter)
    ? 'currentShooter'
    : 'currentPlayer';
  if (!state || !Number.isInteger(state[turnKey])) return false;

  const active = new Set();
  for (const [ws, info] of room.players) {
    if (ws.readyState === 1 && !info.disconnectedAt) active.add(info.index);
  }
  for (const index of room.bots.keys()) active.add(index);
  if (active.has(state[turnKey]) || active.size === 0) return false;

  const seatCount = Array.isArray(state.hands) && state.hands.length
    ? state.hands.length
    : Math.max(1, room.maxPlayers || 0, ...active);
  for (let offset = 1; offset <= seatCount; offset++) {
    const candidate = (state[turnKey] + offset) % seatCount;
    if (active.has(candidate)) {
      state[turnKey] = candidate;
      return true;
    }
  }
  return false;
}

function broadcastGameState(room) {
  const gameMod = gameRegistry[room.game];
  const players = roomPlayersList(room);
  if (room.game === 'minesweeper' && gameMod.playerBoardView) {
    for (const [client, info] of room.players) {
      if (client.readyState === 1) {
        const viewState = Object.assign({}, room.state, { board: gameMod.playerBoardView(room.state, info.index) });
        client.send(JSON.stringify({ type: 'game_state', state: viewState, players }));
      }
    }
  } else if (['texas', 'chinesechess', 'drawguess'].includes(room.game) && gameMod.playerView) {
    for (const [client, info] of room.players) {
      if (client.readyState === 1) client.send(JSON.stringify({ type: 'game_state', state: gameMod.playerView(room.state, info.index), players }));
    }
  } else {
    broadcastRoom(room, { type: 'game_state', state: room.state, players });
  }
}

function scheduleTwentyFourBots(room) {
  if (!room.bots || room.bots.size === 0) return;
  for (const [idx, bot] of room.bots) {
    const realCount = room.state._realPlayerCount || room.players.size;
    const delay = realCount < 3
      ? 20000 + Math.random() * 10000   // 1-2 real players: 20~30s
      : 30000 + Math.random() * 10000;  // 3+ real players: 30~40s
    const attempt = (retries) => {
      setTimeout(() => {
        if (!rooms.has(room._roomId)) return;
        if (room.state.phase !== 'playing') {
          // round hasn't started yet — retry once after a short wait
          if (retries > 0) attempt(retries - 1);
          return;
        }
        try {
          const moveData = bot.getMove(room.state);
          if (!moveData.expression) return;
          const gameMod = gameRegistry[room.game];
          const err = gameMod.handleMove(moveData, room.state, idx);
          if (err) { console.error('24 Bot error:', err); return; }
          broadcastRoom(room, { type: 'game_state', state: room.state, players: roomPlayersList(room) });
        } catch(e) { console.error('24 Bot exception:', e.message); }
      }, retries === 3 ? delay : 300);
    };
    attempt(3);
  }
}

function scheduleTwentyFourTimer(room) {
  clearTimeout(room._tfTimer);
  const state = room.state;
  if (!state.roundTime || state.roundTime <= 0) return;
  const ms = state.roundTime * 1000;
  room._tfTimer = setTimeout(() => {
    if (!rooms.has(room._roomId)) return;
    if (state.phase !== 'playing') return;
    // Time's up — fastest correct submission wins this round
    const subs = state.playerSubmissions || {};
    let best = null, bestTime = Infinity;
    for (const key of Object.keys(subs)) {
      const sub = subs[key];
      if (sub && sub.correct && sub.submittedAt < bestTime) {
        bestTime = sub.submittedAt;
        best = parseInt(key, 10);
      }
    }
    if (best !== null) {
      state.roundWinner = best;
      state.roundsWon[best] = (state.roundsWon[best] || 0) + 1;
    } else {
      state.roundWinner = -1; // nobody got it
    }
    state.phase = 'round_end';
    broadcastRoom(room, { type: 'game_state', state: state, players: roomPlayersList(room) });
  }, ms);
}

// drawguess: per-player filtered broadcast (never broadcast the raw state — it contains the word)
function sendDrawguessViews(room) {
  const gameMod = gameRegistry['drawguess'];
  for (const [client, info] of room.players) {
    if (client.readyState === 1) {
      const viewState = gameMod.playerView(room.state, info.index);
      client.send(JSON.stringify({ type: 'game_state', state: viewState, players: roomPlayersList(room) }));
    }
  }
}

// drawguess: server-side step timer — auto-advances when a player stalls
function scheduleDrawguessTimer(room) {
  clearTimeout(room._dgTimer);
  const state = room.state;
  if (!state) return;
  let seconds = 0;
  if (state.phase === 'choosing') {
    seconds = 15;
  } else if (state.phase === 'playing') {
    if (state.mode === 'stage') {
      seconds = state.drawTime;
    } else {
      const step = state.chain[state.currentStep];
      if (!step) return;
      seconds = step.type === 'draw' ? state.drawTime : state.guessTime;
    }
  } else if (state.phase === 'round_result') {
    seconds = 5;
  } else {
    state.stepDeadline = 0;
    return;
  }
  if (!seconds || seconds <= 0) { state.stepDeadline = 0; return; } // 不限时
  const ms = seconds * 1000 + 2000; // 2s 网络缓冲，前端先到先得
  state.stepDeadline = Date.now() + ms;
  room._dgTimer = setTimeout(() => {
    if (!rooms.has(room._roomId)) return;
    if (room.state !== state) return; // game_restart 已换 state，旧 timer 作废
    const gameMod = gameRegistry['drawguess'];
    if (!gameMod.onTimeout(state)) return;
    if (state.phase === 'choosing' || state.phase === 'playing' || state.phase === 'round_result') {
      scheduleDrawguessTimer(room); // 先更新 deadline 再广播
    } else {
      state.stepDeadline = 0;
    }
    sendDrawguessViews(room);
  }, ms);
}

function stopRealtimeGame(room) {
  if (!room) return;
  if (room._realtimeTimer) clearInterval(room._realtimeTimer);
  room._realtimeTimer = null;
}

function scheduleRealtimeGame(room) {
  const gameMod = room && gameRegistry[room.game];
  if (!gameMod || !gameMod.realtime || typeof gameMod.tick !== 'function') return;
  stopRealtimeGame(room);
  room._realtimeTimer = setInterval(() => {
    if (!rooms.has(room._roomId) || room.phase !== 'playing' || room.state.winner !== null) {
      stopRealtimeGame(room);
      return;
    }
    try {
      for (const [index, bot] of room.bots) {
        const move = bot.getMove(room.state);
        gameMod.handleMove(move, room.state, index);
      }
      gameMod.tick(room.state);
      broadcastRoom(room, { type: 'game_state', state: room.state, players: roomPlayersList(room) });
      if (room.state.winner !== null) stopRealtimeGame(room);
    } catch (e) {
      console.error('Realtime game exception:', e.message);
      stopRealtimeGame(room);
    }
  }, gameMod.tickMs || 120);
}

function scheduleBotMove(room) {
  if (!room || !room.state) return;
  const state = room.state;
  if (state.winner !== null && state.winner !== undefined) return;

  const gameMod = gameRegistry[room.game];
  if (!gameMod) return;
  if (gameMod.realtime) return;

  // 24 game: all bots race simultaneously, no turn order
  if (room.game === 'twentyfour') {
    scheduleTwentyFourBots(room);
    // Timer is started explicitly in start_game and next_round — NOT here,
    // because resetting it on every move drifts the end time past roundEndsAt
    return;
  }

  // Liarsbar shooting phase: use currentShooter instead of currentPlayer
  let cp = state.currentPlayer;
  if (state.phase === 'shooting' && state.currentShooter >= 0) {
    cp = state.currentShooter;
  }
  const bot = room.bots.get(cp);
  if (!bot) return;

  const delay = 800 + Math.random() * 1200;
  clearTimeout(room._botTimer);
  room._botTimer = setTimeout(() => {
    if (!rooms.has(room._roomId)) return;
    try {
      const moveData = bot.getMove(room.state);
      let err = gameMod.handleMove(moveData, room.state, cp);
      if (err) {
        // Never let a bad bot move stall the game: fall back to drawing / passing
        console.error('Bot error:', err, '— falling back to pass/draw');
        const fb = gameMod.handleMove({ pass: true }, room.state, cp);
        if (fb) gameMod.handleMove({}, room.state, cp); // last resort: empty move (most games draw + advance)
      }
      skipDisconnectedTurn(room);
      broadcastRoom(room, { type: 'game_state', state: room.state, players: roomPlayersList(room) });
      scheduleBotMove(room);
    } catch(e) { console.error('Bot exception:', e.message); }
  }, delay);
}

// ---- WebSocket Handler ----

wss.on('connection', (ws) => {
  ws._isAlive = true;
  ws.on('pong', () => { ws._isAlive = true; });
  ws.on('error', () => {});
  let currentRoomId = null;
  let currentRoom = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    const { type, data } = msg;

    // --- create_room ---
    if (type === 'create_room') {
      const { game, lang } = data || {};
      if (!gameRegistry[game]) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'invalid_game_type') }));
        return;
      }
      const result = createRoom(ws, game, lang || 'zh');
      if (!result) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'create_room_failed') }));
        return;
      }
      currentRoomId = result.roomId;
      currentRoom = rooms.get(result.roomId);
      ws.send(JSON.stringify({
        type: 'room_created',
        roomId: result.roomId,
        game,
        maxPlayers: currentRoom.maxPlayers,
        playerIndex: 0,
        players: roomPlayersList(currentRoom),
        phase: currentRoom.phase,
        options: currentRoom.options,
        resumeToken: currentRoom.players.get(ws).resumeToken,
      }));
      return;
    }

    // --- add_bot ---
    if (type === 'add_bot') {
      if (!currentRoom) return;
      if (ws !== currentRoom.hostWS) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'host_only_add_bot') }));
        return;
      }
      if (currentRoom.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'game_started_add_bot') }));
        return;
      }
      const botMod = botRegistry[currentRoom.game];
      if (!botMod) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'game_no_ai') }));
        return;
      }
      // Find next available slot
      const occupied = new Set();
      for (const [, info] of currentRoom.players) occupied.add(info.index);
      for (const [idx] of currentRoom.bots) occupied.add(idx);
      let botIndex = -1;
      for (let i = 0; i < currentRoom.maxPlayers; i++) {
        if (!occupied.has(i)) { botIndex = i; break; }
      }
      if (botIndex === -1) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'room_full') }));
        return;
      }
      const bot = botMod.createBot(botIndex);
      bot.name = currentRoom._lang === 'zh' ? '电脑' + (botIndex + 1) : 'Bot ' + (botIndex + 1);
      if (!currentRoom.bots) currentRoom.bots = new Map();
      currentRoom.bots.set(botIndex, bot);
      broadcastRoom(currentRoom, {
        type: 'room_update',
        phase: currentRoom.phase,
        players: roomPlayersList(currentRoom),
      });
      return;
    }

    // --- join_room ---
    if (type === 'join_room') {
      const { roomId, resumeToken, lang } = data || {};
      const room = rooms.get(roomId);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', code: 'ROOM_NOT_FOUND', message: serverT(currentRoom, 'room_not_found') }));
        return;
      }
      if (lang && !room._lang) room._lang = lang;
      // Resume an existing seat after returning to the lobby / temporary disconnect.
      const resumable = resumeToken && Array.from(room.players.entries())
        .find(([, info]) => info.resumeToken === resumeToken);
      if (resumable) {
        const oldWs = resumable[0];
        const info = resumable[1];
        if (info._disconnectTimer) clearTimeout(info._disconnectTimer);
        info._disconnectTimer = null;
        info.disconnectedAt = null;
        room.players.delete(oldWs);
        room.players.set(ws, info);
        if (room.hostWS === oldWs) room.hostWS = ws;
        currentRoomId = roomId;
        currentRoom = room;
        ws.send(JSON.stringify({ type: 'room_joined', roomId, game: room.game, maxPlayers: room.maxPlayers,
          playerIndex: info.index, players: roomPlayersList(room), state: room.state, phase: room.phase,
          options: room.options, resumeToken: info.resumeToken }));
        sendToRoom(room, {
          type: 'room_update',
          phase: room.phase,
          players: roomPlayersList(room),
          options: room.options,
        }, ws);
        return;
      }
      // Check if already in this room (reconnect)
      const existing = Array.from(room.players.entries()).find(([w]) => w === ws);
      if (existing) {
        currentRoomId = roomId;
        currentRoom = room;
        ws.send(JSON.stringify({
          type: 'room_joined',
          roomId,
          game: room.game,
          maxPlayers: room.maxPlayers,
          playerIndex: existing[1].index,
          players: roomPlayersList(room),
          state: room.state,
          phase: room.phase,
          options: room.options,
        }));
        return;
      }
      // Clean up stale connections (WS closed but close event hasn't fired yet)
      for (const [w, info] of room.players) {
        if (w.readyState !== 1 && (!info.disconnectedAt || Date.now() - info.disconnectedAt > 300000)) {
          room.players.delete(w);
          room.readyPlayers.delete(info.index);
        }
      }
      // Transfer host if host WS is stale
      if (!room.hostWS || room.hostWS.readyState !== 1) {
        if (room.players.size > 0) {
          room.hostWS = room.players.keys().next().value;
        } else {
          room.hostWS = ws;
        }
      }
      // Count current human players
      if (room.players.size >= room.maxPlayers) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'room_full') }));
        return;
      }
      // Find next available slot
      const occupied = new Set();
      for (const [, info] of room.players) occupied.add(info.index);
      for (const [idx] of room.bots) occupied.add(idx);
      let idx = -1;
      for (let i = 0; i < room.maxPlayers; i++) {
        if (!occupied.has(i)) { idx = i; break; }
      }
      if (idx === -1) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'room_full') }));
        return;
      }
      room.players.set(ws, { name: `Player ${idx + 1}`, index: idx, avatar: '😊', resumeToken: crypto.randomUUID(), disconnectedAt: null });
      if (room.players.size === 1) room.hostWS = ws;
      currentRoomId = roomId;
      currentRoom = room;
      // Cancel pending cleanup
      if (room._cleanupTimer) { clearTimeout(room._cleanupTimer); room._cleanupTimer = null; }

      ws.send(JSON.stringify({
        type: 'room_joined',
        roomId,
        game: room.game,
        maxPlayers: room.maxPlayers,
        playerIndex: idx,
        players: roomPlayersList(room),
        state: room.state,
        phase: room.phase,
        options: room.options,
        resumeToken: room.players.get(ws).resumeToken,
      }));
      sendToRoom(room, {
        type: 'player_joined',
        players: roomPlayersList(room),
        phase: room.phase,
      }, ws);
      return;
    }

    // --- player_ready ---
    if (type === 'player_ready') {
      if (!currentRoom) return;
      if (currentRoom.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'game_started') }));
        return;
      }
      const info = currentRoom.players.get(ws);
      if (!info) return;

      if (currentRoom.readyPlayers.has(info.index)) {
        currentRoom.readyPlayers.delete(info.index);
      } else {
        currentRoom.readyPlayers.add(info.index);
      }
      if (currentRoom.readyPlayers.size > 0) {
        currentRoom.phase = 'ready';
      } else {
        currentRoom.phase = 'lobby';
      }

      broadcastRoom(currentRoom, {
        type: 'room_update',
        phase: currentRoom.phase,
        players: roomPlayersList(currentRoom),
      });
      return;
    }

    // --- start_game ---
    if (type === 'start_game') {
      if (!currentRoom) return;
      if (ws !== currentRoom.hostWS) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'host_only_start') }));
        return;
      }
      if (currentRoom.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'game_started') }));
        return;
      }
      const gameMod = gameRegistry[currentRoom.game];
      const totalPlayers = currentRoom.players.size + (currentRoom.bots ? currentRoom.bots.size : 0);
      const minPlayers = (gameMod && gameMod.minPlayers) || 2;
      if (totalPlayers < minPlayers) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'min_players') }));
        return;
      }
      const allReady = Array.from(currentRoom.players.values())
        .every(p => currentRoom.readyPlayers.has(p.index));
      if (!allReady) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'all_ready_required') }));
        return;
      }

      currentRoom.phase = 'playing';
      currentRoom.state._playerCount = totalPlayers;
      currentRoom.state._realPlayerCount = currentRoom.players.size;
      currentRoom.state._hasBots = currentRoom.bots.size > 0;
      currentRoom.state._options = { ...currentRoom.options };
      if (gameMod && gameMod.initGame) {
        gameMod.initGame(currentRoom.state, totalPlayers);
      }
      if (currentRoom.game === 'drawguess') scheduleDrawguessTimer(currentRoom); // 在广播前写入 stepDeadline

      // Minesweeper: each player gets their own board view (independent reveal/flag state)
      if (currentRoom.game === 'minesweeper' && gameMod.playerBoardView) {
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = Object.assign({}, currentRoom.state, {
              board: gameMod.playerBoardView(currentRoom.state, info.index),
            });
            client.send(JSON.stringify({ type: 'game_started', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else if (currentRoom.game === 'texas' && gameMod.playerView) {
        // Texas: per-player view (hide other players' hole cards)
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = gameMod.playerView(currentRoom.state, info.index);
            client.send(JSON.stringify({ type: 'game_started', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else if (currentRoom.game === 'chinesechess' && gameMod.playerView) {
        // Chinese Chess: per-player view (legal moves only for current player)
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = gameMod.playerView(currentRoom.state, info.index);
            client.send(JSON.stringify({ type: 'game_started', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else if (currentRoom.game === 'drawguess' && gameMod.playerView) {
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = gameMod.playerView(currentRoom.state, info.index);
            client.send(JSON.stringify({ type: 'game_started', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else {
        broadcastRoom(currentRoom, {
          type: 'game_started',
          state: currentRoom.state,
          players: roomPlayersList(currentRoom),
        });
      }
      if (currentRoom.game === 'twentyfour') scheduleTwentyFourTimer(currentRoom);
      scheduleRealtimeGame(currentRoom);
      scheduleBotMove(currentRoom);
      return;
    }

    // --- swap_seat ---
    if (type === 'swap_seat') {
      if (!currentRoom) return;
      if (currentRoom.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'game_started_no_swap') }));
        return;
      }
      const { fromIndex, toIndex } = data || {};
      if (typeof fromIndex !== 'number' || typeof toIndex !== 'number') return;
      if (fromIndex === toIndex) return;

      const fromPlayer = Array.from(currentRoom.players.entries())
        .find(([, info]) => info.index === fromIndex);
      const toPlayer = Array.from(currentRoom.players.entries())
        .find(([, info]) => info.index === toIndex);

      if (fromPlayer) currentRoom.players.get(fromPlayer[0]).index = toIndex;
      if (toPlayer) currentRoom.players.get(toPlayer[0]).index = fromIndex;

      // Swap bot indices
      if (currentRoom.bots) {
        const fromBot = currentRoom.bots.get(fromIndex);
        const toBot = currentRoom.bots.get(toIndex);
        if (fromBot) { currentRoom.bots.delete(fromIndex); currentRoom.bots.set(toIndex, fromBot); }
        else { currentRoom.bots.delete(toIndex); }
        if (toBot) { currentRoom.bots.delete(toIndex); currentRoom.bots.set(fromIndex, toBot); }
        else { currentRoom.bots.delete(fromIndex); }
      }

      // Swap ready states
      const fromReady = currentRoom.readyPlayers.has(fromIndex);
      const toReady = currentRoom.readyPlayers.has(toIndex);
      currentRoom.readyPlayers.delete(fromIndex);
      currentRoom.readyPlayers.delete(toIndex);
      if (fromReady) currentRoom.readyPlayers.add(toIndex);
      if (toReady) currentRoom.readyPlayers.add(fromIndex);

      // Transfer host if host player swapped
      if (currentRoom.hostWS === (fromPlayer ? fromPlayer[0] : null)) {
        currentRoom.hostWS = fromPlayer[0]; // host follows the player
      } else if (currentRoom.hostWS === (toPlayer ? toPlayer[0] : null)) {
        currentRoom.hostWS = toPlayer[0];
      }

      broadcastRoom(currentRoom, {
        type: 'room_update',
        phase: currentRoom.phase,
        players: roomPlayersList(currentRoom),
      });

      // Tell each swapped player their new index so the client can update sessionStorage
      if (fromPlayer) {
        const fromWs = fromPlayer[0];
        if (fromWs.readyState === 1) {
          fromWs.send(JSON.stringify({ type: 'player_index_updated', playerIndex: toIndex }));
        }
      }
      if (toPlayer) {
        const toWs = toPlayer[0];
        if (toWs.readyState === 1) {
          toWs.send(JSON.stringify({ type: 'player_index_updated', playerIndex: fromIndex }));
        }
      }
      return;
    }

    // --- set_option ---
    if (type === 'set_option') {
      if (!currentRoom) return;
      if (ws !== currentRoom.hostWS) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'host_only_settings') }));
        return;
      }
      if (currentRoom.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'game_started_no_settings') }));
        return;
      }
      const { key, value } = data || {};
      if (!key) return;
      currentRoom.options[key] = value;
      broadcastRoom(currentRoom, {
        type: 'room_update',
        phase: currentRoom.phase,
        players: roomPlayersList(currentRoom),
        options: currentRoom.options,
      });
      return;
    }

    // --- set_name ---
    if (type === 'set_name') {
      if (!currentRoom) return;
      const info = currentRoom.players.get(ws);
      if (!info) return;
      const { name } = data || {};
      if (name && name.trim().length > 0 && name.trim().length <= 8) {
        info.name = name.trim();
        broadcastRoom(currentRoom, { type: 'room_update', phase: currentRoom.phase, players: roomPlayersList(currentRoom) });
      }
      return;
    }

    // --- set_avatar ---
    if (type === 'set_avatar') {
      if (!currentRoom) return;
      const info = currentRoom.players.get(ws);
      if (!info) return;
      const { avatar } = data || {};
      if (avatar && avatar.length <= 4) {
        info.avatar = avatar;
        broadcastRoom(currentRoom, { type: 'room_update', phase: currentRoom.phase, players: roomPlayersList(currentRoom) });
      }
      return;
    }

    // --- game_move ---
    if (type === 'game_move') {
      if (!currentRoom) return;
      const gameMod = gameRegistry[currentRoom.game];
      if (!gameMod) return;
      const playerInfo = currentRoom.players.get(ws);
      if (!playerInfo) return;

      const err = gameMod.handleMove(data, currentRoom.state, playerInfo.index);
      if (err) { ws.send(JSON.stringify({ type: 'error', message: err })); return; }

      skipDisconnectedTurn(currentRoom);

      // Clear 24-point round timer when a round ends via player submission
      if (currentRoom.game === 'twentyfour' && currentRoom.state.phase === 'round_end') {
        clearTimeout(currentRoom._tfTimer);
      }

      // drawguess: reset the step timer after every successful move (updates stepDeadline before broadcast)
      const isStageLiveAction = currentRoom.game === 'drawguess' && (data.type === 'stage_stroke' || data.type === 'stage_guess');
      if (currentRoom.game === 'drawguess' && !isStageLiveAction) scheduleDrawguessTimer(currentRoom);

      // Minesweeper: each player gets their own board view (independent reveal/flag state)
      if (currentRoom.game === 'minesweeper' && gameMod.playerBoardView) {
        const basePayload = { type: 'game_state', state: currentRoom.state, players: roomPlayersList(currentRoom) };
        // Send per-player views
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = Object.assign({}, currentRoom.state, {
              board: gameMod.playerBoardView(currentRoom.state, info.index),
            });
            client.send(JSON.stringify({ type: 'game_state', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else if (currentRoom.game === 'texas' && gameMod.playerView) {
        // Texas: per-player view (hide other players' hole cards)
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = gameMod.playerView(currentRoom.state, info.index);
            client.send(JSON.stringify({ type: 'game_state', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else if (currentRoom.game === 'chinesechess' && gameMod.playerView) {
        // Chinese Chess: per-player view (legal moves only for current player)
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = gameMod.playerView(currentRoom.state, info.index);
            client.send(JSON.stringify({ type: 'game_state', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else if (currentRoom.game === 'drawguess' && gameMod.playerView) {
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = gameMod.playerView(currentRoom.state, info.index);
            client.send(JSON.stringify({ type: 'game_state', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else {
        broadcastRoom(currentRoom, {
          type: 'game_state',
          state: currentRoom.state,
          players: roomPlayersList(currentRoom),
        });
      }
      scheduleBotMove(currentRoom);
      return;
    }

    // --- game_restart ---
    if (type === 'game_restart') {
      if (!currentRoom) return;
      if (ws !== currentRoom.hostWS) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'host_only_restart') }));
        return;
      }
      const gameMod = gameRegistry[currentRoom.game];
      if (!gameMod) return;
      const totalPlayers = currentRoom.players.size + (currentRoom.bots ? currentRoom.bots.size : 0);
      currentRoom.state = gameMod.createState();
      currentRoom.state._playerCount = totalPlayers;
      currentRoom.state._realPlayerCount = currentRoom.players.size;
      currentRoom.state._hasBots = currentRoom.bots.size > 0;
      currentRoom.state._options = { ...currentRoom.options };
      if (gameMod && gameMod.initGame) {
        gameMod.initGame(currentRoom.state, totalPlayers);
      }
      if (currentRoom.game === 'drawguess') scheduleDrawguessTimer(currentRoom);
      currentRoom.phase = 'playing';

      // Minesweeper: per-player board views on restart too
      if (currentRoom.game === 'minesweeper' && gameMod.playerBoardView) {
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = Object.assign({}, currentRoom.state, {
              board: gameMod.playerBoardView(currentRoom.state, info.index),
            });
            client.send(JSON.stringify({ type: 'game_state', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else if (currentRoom.game === 'texas' && gameMod.playerView) {
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = gameMod.playerView(currentRoom.state, info.index);
            client.send(JSON.stringify({ type: 'game_state', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else if (currentRoom.game === 'chinesechess' && gameMod.playerView) {
        // Chinese Chess: per-player view (legal moves only for current player)
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = gameMod.playerView(currentRoom.state, info.index);
            client.send(JSON.stringify({ type: 'game_state', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else if (currentRoom.game === 'drawguess' && gameMod.playerView) {
        for (const [client, info] of currentRoom.players) {
          if (client.readyState === 1) {
            const viewState = gameMod.playerView(currentRoom.state, info.index);
            client.send(JSON.stringify({ type: 'game_state', state: viewState, players: roomPlayersList(currentRoom) }));
          }
        }
      } else {
        broadcastRoom(currentRoom, {
          type: 'game_state',
          state: currentRoom.state,
          players: roomPlayersList(currentRoom),
        });
      }
      if (currentRoom.game === 'twentyfour') scheduleTwentyFourTimer(currentRoom);
      scheduleRealtimeGame(currentRoom);
      scheduleBotMove(currentRoom);
      return;
    }

    // --- leave_room (go back to lobby, with grace period for resume) ---
    if (type === 'leave_room') {
      if (!currentRoom) return;
      const info = currentRoom.players.get(ws);
      if (!info) return;
      // Don't delete immediately — start grace timer so the player can resume
      info.disconnectedAt = Date.now();
      if (info._disconnectTimer) clearTimeout(info._disconnectTimer);
      info._disconnectTimer = setTimeout(() => {
        if (info.disconnectedAt && currentRoom.players.get(ws) === info) {
          currentRoom.players.delete(ws);
          currentRoom.readyPlayers.delete(info.index);
          if (currentRoom.hostWS === ws) {
            currentRoom.hostWS = Array.from(currentRoom.players.keys()).find(client => client.readyState === 1) || null;
          }
          if (currentRoom.players.size === 0) {
            stopRealtimeGame(currentRoom);
            rooms.delete(currentRoomId);
          } else {
            broadcastRoom(currentRoom, { type: 'player_left', players: roomPlayersList(currentRoom), phase: currentRoom.phase });
            scheduleBotMove(currentRoom);
          }
        }
      }, 300000);  // 5-minute grace for rejoin
      ws.send(JSON.stringify({ type: 'left_room' }));
      return;
    }

    // --- return_to_room ---
    if (type === 'return_to_room') {
      if (!currentRoom) return;
      currentRoom.phase = 'lobby';
      currentRoom.readyPlayers = new Set();
      currentRoom.state = null;
      clearTimeout(currentRoom._tfTimer);
      clearTimeout(currentRoom._dgTimer);
      stopRealtimeGame(currentRoom);
      broadcastRoom(currentRoom, {
        type: 'room_update',
        phase: 'lobby',
        players: roomPlayersList(currentRoom),
        options: currentRoom.options,
      });
      return;
    }

    // --- next_round (24 game multi-round) ---
    if (type === 'next_round') {
      if (!currentRoom) return;
      if (currentRoom.game !== 'twentyfour') return;
      const state = currentRoom.state;
      const totalPlayers = currentRoom.players.size + (currentRoom.bots ? currentRoom.bots.size : 0);

      if (state.currentRound >= state.maxRounds) {
        state.phase = 'over';
        let bestWins = -1, best = -1;
        for (let i = 0; i < state.roundsWon.length; i++) {
          if (state.roundsWon[i] > bestWins) { bestWins = state.roundsWon[i]; best = i; }
        }
        state.winner = best;
        broadcastRoom(currentRoom, { type: 'game_state', state: state, players: roomPlayersList(currentRoom) });
        return;
      }

      state.currentRound++;
      state.phase = 'playing';
      state.roundWinner = null;
      state.solutions = [];
      state.playerSubmissions = {};
      state._realPlayerCount = currentRoom.players.size;
      state._hasBots = currentRoom.bots.size > 0;
      // Generate new numbers (use the game module's function)
      gameRegistry['twentyfour'].initGame(state, totalPlayers);
      broadcastRoom(currentRoom, { type: 'game_state', state: state, players: roomPlayersList(currentRoom) });
      scheduleTwentyFourTimer(currentRoom);
      scheduleBotMove(currentRoom);
      return;
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentRoomId) {
      const info = currentRoom.players.get(ws);
      if (!info) return;
      info.disconnectedAt = Date.now();
      if (info._disconnectTimer) clearTimeout(info._disconnectTimer);
      info._disconnectTimer = setTimeout(() => {
        if (info.disconnectedAt && currentRoom.players.get(ws) === info) {
          currentRoom.players.delete(ws);
          currentRoom.readyPlayers.delete(info.index);
          if (currentRoom.hostWS === ws) {
            currentRoom.hostWS = Array.from(currentRoom.players.keys()).find(client => client.readyState === 1) || null;
          }
          const skipped = skipDisconnectedTurn(currentRoom);
          if (currentRoom.players.size === 0) {
            stopRealtimeGame(currentRoom);
            rooms.delete(currentRoomId);
            return;
          }
          broadcastRoom(currentRoom, { type: 'player_left', players: roomPlayersList(currentRoom), phase: currentRoom.phase });
          if (currentRoom.phase === 'playing' && currentRoom.state && skipped) broadcastGameState(currentRoom);
          scheduleBotMove(currentRoom);
        }
      }, DISCONNECT_GRACE_MS);
      broadcastRoom(currentRoom, { type: 'player_left', players: roomPlayersList(currentRoom), phase: currentRoom.phase });
    }
  });
});

// ---- LAN IP Detection ----

function getLanIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push({ name, ip: addr.address });
      }
    }
  }
  // Sort: 192.168.x.x first (most common home WiFi), then 10.x.x.x, then 172.16-31.x.x (often virtual adapters)
  ips.sort((a, b) => {
    const pri = ip => {
      if (ip.startsWith('192.168.')) return 0;
      if (ip.startsWith('10.')) return 1;
      return 2; // 172.x and others last
    };
    return pri(a.ip) - pri(b.ip);
  });
  return ips;
}

function getShareableLanIPs() {
  const privatePattern = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
  const noisyNamePattern = /(wireguard|vpn|vethernet|virtual|hyper-v|loopback)/i;
  const preferred = getLanIPs().filter(({ name, ip }) => privatePattern.test(ip) && !noisyNamePattern.test(name));
  if (preferred.length) return preferred;

  const privateOnly = getLanIPs().filter(({ ip }) => privatePattern.test(ip));
  return privateOnly.length ? privateOnly : getLanIPs();
}

function startServer(port, attempt = 0) {
  // When PORT is explicitly set by the platform (Railway, etc.), do NOT retry
  // on a different port — the platform only routes traffic to the assigned $PORT.
  const isEnvPort = 'PORT' in process.env;
  const onListening = () => {
    activePort = port;
    const lanIPs = getShareableLanIPs();

    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║    🎲  GameNest                     ║');
    console.log('  ╠══════════════════════════════════════╣');
    if (lanIPs.length === 0) {
      console.log(`  ║  http://localhost:${port}`);
    } else {
      for (const { name, ip } of lanIPs) {
        const url = `http://${ip}:${port}`;
        console.log(`  ║  ${url}${' '.repeat(38 - url.length)}║`);
      }
    }
    console.log('  ╠══════════════════════════════════════╣');
    console.log('  ║  Share the LAN address with others. ║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
  };

  server.once('error', (err) => {
    if (isEnvPort) {
      console.error('Server error on platform-assigned port:', err.message);
      process.exit(1);
      return;
    }
    const nextPort = getNextPort(err.code, port);
    if (nextPort && attempt < MAX_PORT_RETRIES) {
      console.log(`Port ${port} unavailable (${err.code}), trying ${nextPort}...`);
      server.off('listening', onListening);
      setTimeout(() => startServer(nextPort, attempt + 1), 200);
      return;
    }
    console.error('Server error:', err.message);
  });

  server.once('listening', onListening);
  server.listen(port, '0.0.0.0');
}

startServer(PORT);
