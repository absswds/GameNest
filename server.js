const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const matchLib = require('./games/lib/match');
// Two-player board games that support a best-of-N match (room option `bestOf`)
const MATCH_GAMES = ['chess', 'checkers', 'reversi', 'go9', 'gomoku', 'chinesechess'];
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
// Startup trace is only for Android crash triage (nodejs-mobile reports platform 'android');
// elsewhere it would append ~70 sync writes per start. GAMENEST_STARTUP_LOG=1 forces it on.
const STARTUP_LOG = process.platform === 'android' || process.env.GAMENEST_STARTUP_LOG === '1';
function logStep(message) {
  if (!STARTUP_LOG) return;
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
// Reconnect grace: 2 minutes mid-game, 5 minutes in the waiting room / after the game.
function disconnectGraceMs(room) {
  return room && room.phase === 'playing' ? 120000 : 300000;
}
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
      // Skip data/support files (e.g. drawguess-words.js word lists) that don't
      // implement the game-module interface. Registering them under `undefined`
      // made create_room crash when a stale/undefined game code reached the player.
      if (typeof mod.createState !== 'function' || typeof mod.handleMove !== 'function') return;
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

// 注册表为空 = 所有游戏都会报"无效的游戏类型"，但服务器照常启动。
// 这种静默失败极难排查（pkg 打包时 games/ 若不可 require 就会这样），必须显式报出来。
if (!process.env.ANDROID_SKIP_REGISTRY_LOAD) {
  const gameCount = Object.keys(gameRegistry).length;
  if (gameCount === 0) {
    console.error('[GameNest] FATAL: game registry is empty — no modules loaded from ' + gamesDir);
    console.error('[GameNest] Every create_room will fail. If this is a packaged build, the games/ directory is not requirable.');
  } else if (process.env.GAMENEST_DEBUG === '1') {
    console.log('[GameNest] loaded ' + gameCount + ' games, ' + Object.keys(botRegistry).length + ' bots');
  }
}

logStep('[android-node] server.js init express app');
const app = express();
// gzip text-based assets (HTML/CSS/JSON/JS). PNG/JPG/WebP are already compressed
// so the filter skips them to save CPU on every request.
const compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 512, // only compress responses > 512 bytes
}));
// Static assets: keep no-cache for HTML shells (so clients pick up new JS/CSS),
// but allow short caching of versioned/hashed assets if added later.
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  },
}));

function roomShareUrl(req, room) {
  let host = req.get('Host') || 'localhost:3000';
  // Only a plain host[:port] is trusted; a crafted Host header falls back to localhost handling.
  if (!/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host)) host = 'localhost:' + activePort;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    const lan = getShareableLanIPs()[0];
    if (lan) host = `${lan.ip}:${activePort}`;
  }
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${host}/?room=${encodeURIComponent(room)}`;
}

app.get('/api/share-url', (req, res) => {
  const room = req.query.room;
  if (typeof room !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(room)) { res.status(400).json({ error: 'missing room' }); return; }
  res.json({ url: roomShareUrl(req, room) });
});

// QR code endpoint — generates QR with the host from the request
// Works on LAN (192.168.x.x:3000) and cloud (project.up.railway.app)
app.get('/qr', async (req, res) => {
  try {
    const room = req.query.room;
    if (typeof room !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(room)) { res.status(400).send('missing room'); return; }
    // Prefer a real LAN IP so the QR is scannable from a phone on the same WiFi.
    // When the requester came via localhost/127.0.0.1, using that Host makes the
    // QR point at the phone's own loopback — useless. Fall back to the first
    // shareable 192.168.x.x / 10.x.x.x address.
    const url = roomShareUrl(req, room);
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

// 调试接口默认关闭：/api/debug/room/:id 会 dump 原始 state（绕过 playerView，
// 暴露所有玩家手牌），forceWin 还能直接改判胜负。本地排查用 GAMENEST_DEBUG=1 node server.js 开启。
const DEBUG_API = process.env.GAMENEST_DEBUG === '1';
app.use('/api/debug', (req, res, next) => {
  if (!DEBUG_API) return res.status(404).json({ error: 'not found' });
  next();
});

// Debug: list active rooms (no sensitive hand data)
app.get('/api/debug/rooms', (req, res) => {
  const list = [];
  for (const [id, room] of rooms) {
    list.push({
      id,
      game: room.game,
      phase: room.state && room.state.phase,
      playerCount: room.players.size,
      botCount: room.bots ? room.bots.size : 0,
      winners: room.state && room.state.winners,
      cumulativeScore: room.state && room.state.cumulativeScore,
      roundNumber: room.state && room.state.roundNumber,
    });
  }
  res.json({ rooms: list });
});

// Debug: dump full room state for a given roomId (includes hands & scoring)
app.get('/api/debug/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.json({ error: 'room not found' });
  const state = room.state;
  const gameMod = gameRegistry[room.game];
  const dump = {
    id: room._roomId,
    game: room.game,
    phase: state.phase,
    currentPlayer: state.currentPlayer,
    winners: state.winners,
    winner: state.winner,
    winInfo: state.winInfo,
    cumulativeScore: state.cumulativeScore,
    roundNumber: state.roundNumber,
    dealerIndex: state.dealerIndex,
    deckCount: state.deck ? state.deck.length : (state.wall ? state.wall.length : 0),
    wall: state.wall ? state.wall.length : undefined,
    drawn: state.drawn,
    voidSuit: state.voidSuit || [],
    _winSelfDraw: state._winSelfDraw,
    hands: state.hands,
    melds: state.melds,
    discards: state.discards,
    lastDiscard: state.lastDiscard,
  };
  // Attach per-winner score breakdown if winners exist
  if (gameMod && gameMod.calculateScore && state.winners && state.winners.length > 0) {
    dump.winnerScores = {};
    for (const w of state.winners) {
      try {
        dump.winnerScores[w] = gameMod.calculateScore(state, w);
      } catch (e) {
        dump.winnerScores[w] = { error: e.message };
      }
    }
  }
  if (state.winInfo) dump.winInfo = state.winInfo;
  res.json(dump);
});

// Debug: force win for player 0 (摆必赢，验积分板加分)
app.post('/api/debug/room/:roomId/forceWin', express.json(), (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.json({ error: 'room not found' });
  const state = room.state;
  try {
    if (!state || (room.game !== 'mahjong-sichuan' && room.game !== 'mahjong-cantonese')) return res.json({ error: 'not mahjong' });
    const isCantonese = !!state.wall; // 广东有 wall，四川有 deck/voidSuit
    if (!isCantonese) {
      // 四川必赢：1w2w3w 4w5w6w 7w8w9w 1t1t1t 2t2t (清一色+碰) 缺 tong，非血战一胡即结束以验积分
      function T(k,n,id){ return {k,n,id}; }
      state.hands[0]=[
        T('wan',1,901),T('wan',2,902),T('wan',3,903),
        T('wan',4,904),T('wan',5,905),T('wan',6,906),
        T('wan',7,907),T('wan',8,908),T('wan',9,909),
        T('tiao',1,910),T('tiao',1,911),T('tiao',1,912),
        T('tiao',2,913),T('tiao',2,914),
      ];
      // 定缺已完成，缺 tong，且手牌不含 tong 才能胡
      for(let i=0;i<state.hands.length;i++) state.voidSuit[i]='tong';
      state._bloodBattle=false;
      state.phase='play'; state.currentPlayer=0; state.drawn=state.hands[0][13].id;
      const mod=require('./games/mahjong-sichuan');
      const err=mod.handleMove({type:'win'}, state, 0);
      if(err) return res.json({ error: err, state });
      checkMahjongRoundEnd(room);
      broadcastGameView(room);
      return res.json({ ok:true, winners: state.winners, winner: state.winner, winInfo: state.winInfo, cumulativeScore: state.cumulativeScore, phase: state.phase, roundScores: state._lastRoundScores });
    } else {
      // 广东必赢：123m456m789m 222s 11s + 自摸
      const core=require('./games/lib/mahjong-core');
      let _tid=9000;
      function CT(k,n){ return {k,n,id:k+n+'#'+(_tid++)};}
      function hand(str){
        const tiles=[]; let nums='';
        for(const ch of str){ if(ch>='0'&&ch<='9'){nums+=ch; continue;} let k;
          if(ch==='m') k='wan'; else if(ch==='s') k='tiao'; else if(ch==='p') k='tong'; else continue;
          for(const n of nums) tiles.push(CT(k, parseInt(n))); nums='';
        } return tiles;
      }
      state.hands[0]=hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 2s 2s 2s 1s 1s');
      state.phase='play'; state.currentPlayer=0; state.hasDrawn=true; state.drawn=state.hands[0][13].id;
      const mod=require('./games/mahjong-cantonese');
      const err=mod.handleMove({type:'win'}, state, 0);
      if(err) return res.json({ error: err, state });
      checkMahjongRoundEnd(room);
      broadcastGameView(room);
      return res.json({ ok:true, winner: state.winner, winInfo: state.winInfo, cumulativeScore: state.cumulativeScore, phase: state.phase });
    }
  } catch(e){ return res.json({ error: e.message, stack: e.stack }); }
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
function generateRoomId(minLen) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  const len = minLen || (Math.random() < 0.5 ? 3 : 4);
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function createRoom(ws, gameType, lang) {
  const gameMod = gameRegistry[gameType];
  if (!gameMod) { return null; }
  let initialState;
  try {
    initialState = gameMod.createState();
  } catch (e) {
    // A single bad/misconfigured state factory must not crash the whole server.
    console.error('createState failed for game "' + gameType + '":', e && e.message);
    return null;
  }
  // Never overwrite a live room; after many collisions fall back to longer IDs.
  let roomId = generateRoomId();
  for (let tries = 0; rooms.has(roomId); tries++) roomId = generateRoomId(tries > 20 ? 5 : 0);
  const room = {
    game: gameType,
    maxPlayers: gameMod.maxPlayers,
    _lang: lang || 'zh',
    players: new Map(),
    bots: new Map(),
    state: initialState,
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

function broadcastHostChanged(room) {
  const info = room.hostWS && room.players.get(room.hostWS);
  if (info) broadcastRoom(room, { type: 'host_changed', hostIndex: info.index, name: info.name });
}

// Make `name` unique among the room's other humans and bots by appending 2, 3, ...
function uniqueRoomName(room, ws, name) {
  const taken = new Set();
  for (const [client, info] of room.players) if (client !== ws) taken.add(info.name);
  if (room.bots) for (const [, bot] of room.bots) taken.add(bot.name);
  if (!taken.has(name)) return name;
  for (let n = 2; ; n++) {
    const suffix = String(n);
    const cand = name.slice(0, 8 - suffix.length) + suffix;
    if (!taken.has(cand)) return cand;
  }
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

function getCurrentActor(state, gameMod) {
  if (gameMod && gameMod.getCurrentActor) return gameMod.getCurrentActor(state);
  return state.currentPlayer;
}

function skipDisconnectedTurn(room) {
  const state = room && room.state;
  if (!state) return false;
  const gameMod = gameRegistry[room.game];
  const cp = getCurrentActor(state, gameMod);
  if (!Number.isInteger(cp)) return false;
  if (cp < 0) return false; // no turn owner yet (e.g. choosing phase)

  // A player only counts as gone once the reconnect grace has run out: a phone that locks for a
  // few seconds must keep its turn (and its freshly drawn tiles / open claim window).
  const now = Date.now();
  const active = new Set();
  for (const [, info] of room.players) {
    if (!info.disconnectedAt || now - info.disconnectedAt < disconnectGraceMs(room)) active.add(info.index);
  }
  for (const index of room.bots.keys()) active.add(index);
  if (active.has(cp) || active.size === 0) return false;
  // A custom-actor game we cannot advance for: leave the state alone.
  if (gameMod && gameMod.getCurrentActor && !gameMod.setCurrentActor) return false;

  const seatCount = Number.isInteger(state._playerCount) && state._playerCount > 0
    ? state._playerCount
    : (Array.isArray(state.hands) && state.hands.length
      ? state.hands.length
      : Math.max(1, room.maxPlayers || 0, ...active));
  for (let offset = 1; offset <= seatCount; offset++) {
    const candidate = (cp + offset) % seatCount;
    if (active.has(candidate)) {
      // Update whichever field the game uses for current actor
      if (gameMod && gameMod.getCurrentActor) {
        gameMod.setCurrentActor(state, candidate);
      } else {
        state.currentPlayer = candidate;
      }
      return true;
    }
  }
  return false;
}

// Names/avatars end up in client innerHTML: keep only plain strings without markup or control chars.
function sanitizeText(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/[<>&"'`\u0000-\u001f\u007f]/g, '').trim();
}

// The state a given seat is allowed to see (hidden info filtered by the game module).
function viewFor(room, index) {
  const gameMod = gameRegistry[room.game];
  if (!room.state || !gameMod || index === undefined || index === null) return room.state;
  if (gameMod.playerView) {
    // A throwing view (e.g. on a not-yet-initialised state) must not crash the whole server.
    // Return null rather than the raw state so hidden info never leaks.
    try { return gameMod.playerView(room.state, index); }
    catch (e) { console.error('[playerView]', room.game, e.message); return null; }
  }
  return room.state;
}

// Count a finished game toward the room's match exactly once.
function tallyMatch(room) {
  const s = room.state;
  if (!room.match || !s || s.winner == null || s._matchCounted) return;
  s._matchCounted = true;
  matchLib.recordResult(room.match, s.winner);
}

// Start a new match on game start, or when the previous match has finished.
function ensureMatch(room, fresh) {
  if (MATCH_GAMES.indexOf(room.game) === -1) { room.match = null; return; }
  if (fresh || !room.match || room.match.over) room.match = matchLib.createMatch(room.options.bestOf);
}

// Between games of a match the two seats swap, so the first move alternates.
// Bots remember their seat from createBot(), so they are rebuilt for the new seat.
function swapMatchSeats(room) {
  for (const info of room.players.values()) info.index = 1 - info.index;
  if (room.bots && room.bots.size) {
    const botMod = botRegistry[room.game];
    const old = Array.from(room.bots);
    room.bots = new Map();
    for (const [idx, bot] of old) {
      const nb = botMod ? botMod.createBot(1 - idx) : bot;
      nb.name = bot.name;
      room.bots.set(1 - idx, nb);
    }
  }
  room.readyPlayers = new Set(Array.from(room.readyPlayers, i => 1 - i));
  room.match.wins.reverse();
  for (const [client, info] of room.players) {
    if (client.readyState === 1) client.send(JSON.stringify({ type: 'player_index_updated', playerIndex: info.index }));
  }
}

function broadcastGameView(room, msgType) {
  const t = msgType || 'game_state';
  const gameMod = gameRegistry[room.game];
  const players = roomPlayersList(room);
  tallyMatch(room);
  const match = room.match || null;
  if (!gameMod) return;
  for (const [client, info] of room.players) {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: t, state: viewFor(room, info.index), players, match, yourTurn: isYourTurn(room, gameMod, info.index) }));
    }
  }
}

// True when this seat can act right now (turn owner or one of the pending simultaneous actors).
function isYourTurn(room, gameMod, index) {
  try {
    const state = room.state;
    if (!state || room.phase !== 'playing' || (state.winner !== null && state.winner !== undefined)) return false;
    if (getCurrentActor(state, gameMod) === index) return true;
    if (typeof gameMod.getPendingActors === 'function') return (gameMod.getPendingActors(state) || []).includes(index);
  } catch (e) { /* hidden or half-built state: no cue */ }
  return false;
}

function applyRuntimeState(room, totalPlayers) {
  const s = room.state;
  s._playerCount = totalPlayers;
  s._realPlayerCount = room.players.size;
  s._hasBots = room.bots && room.bots.size > 0;
  s._options = { ...room.options };
  s._lang = room._lang || 'zh';
  // Mahjong multi-round: ensure tracking fields exist (first game / fresh state)
  if (room.game === 'mahjong-sichuan' || room.game === 'mahjong-cantonese') {
    if (!s.cumulativeScore) s.cumulativeScore = new Array(totalPlayers).fill(0);
    if (s.dealerIndex === undefined) s.dealerIndex = 0;
    if (!s.roundNumber) s.roundNumber = 1;
  }
}

function clearAllRoomTimers(room) {
  clearTimeout(room._botTimer);
  clearTimeout(room._phaseTimer);
  room._bsPlacing = false;
  room._tfBotState = null;
  room._phaseDeadline = 0;
  room._phaseBotStuck = null;
  if (room._phaseBotTimers) {
    for (const h of room._phaseBotTimers) clearTimeout(h);
    room._phaseBotTimers = [];
  }
  if (room._phaseBotPending) room._phaseBotPending.clear();
  stopRealtimeGame(room);
  if (room._tfBotTimers) {
    for (const h of room._tfBotTimers) clearTimeout(h);
    room._tfBotTimers = [];
  }
}

// Mahjong: resolve a winner index to a fan total. Cantonese stores the resolved fan
// (incl. buy-tile bonus) on state.winInfo; Sichuan computes it via calculateScore.
function calculateMahjongScore(state, winnerIndex, gameMod) {
  // 粤麻（含走川麻入口的 cantonese 变体）：直接用 handleMove 里算好的 winInfo.fan。
  // 四川规则会访问 state.deck，而粤麻 state 只有 wall，绝不能用四川的 calculateScore。
  if (state._variants === 'cantonese') {
    if (state.winInfo && typeof state.winInfo.fan === 'number') {
      return { fan: state.winInfo.fan, details: [{ name: state.winInfo.type || '胡', fan: state.winInfo.fan }] };
    }
    return { fan: 1, details: [{ name: '平胡', fan: 1 }] };
  }
  // 四川：优先用游戏模块的 calculateScore
  if (gameMod && gameMod.calculateScore) {
    try { return gameMod.calculateScore(state, winnerIndex); } catch (e) {
      console.error('[mahjong] calculateScore error:', e.message);
    }
  }
  if (state.winInfo && typeof state.winInfo.fan === 'number') {
    return { fan: state.winInfo.fan, details: [{ name: state.winInfo.type || '胡', fan: state.winInfo.fan }] };
  }
  return { fan: 1, details: [{ name: '平胡', fan: 1 }] };
}

// Mahjong multi-round: when a round ends (phase === 'over'), convert each winner's
// fan to points, add to cumulative totals, and broadcast a round_end summary.
// Guarded by state._roundEndBroadcast so it fires once per round.
function endOfRound(room) {
  var state = room.state;
  if (!state || state._roundEndBroadcast) return;
  if (state.phase !== 'over') return;
  state._roundEndBroadcast = true;

  var gameMod = gameRegistry[room.game];
  var playerCount = state.hands.length;
  var roundScores = new Array(playerCount).fill(0);

  // Collect winners. Sichuan uses state.winners[] (may be empty on 荒庄),
  // Cantonese uses state.winner (single index, -1 = 荒庄).
  var winners = [];
  if (state.winners && state.winners.length > 0) {
    for (var wi = 0; wi < state.winners.length; wi++) {
      if (state.winners[wi] >= 0) winners.push(state.winners[wi]);
    }
  } else if (state.winner != null && state.winner >= 0) {
    winners.push(state.winner);
  }

  // Zero-sum settlement: a self-drawn win is paid by every player still in the hand, a win
  // off a discard by the discarder alone. In 血战 players who already won (earlier in
  // winners[]) have left the table and pay nothing for later wins.
  for (var w = 0; w < winners.length; w++) {
    var win = winners[w];
    var fan = calculateMahjongScore(state, win, gameMod).fan;
    var selfDraw = state._variants === 'cantonese'
      ? !(state.winInfo && state.winInfo.from >= 0)
      : !!(state._winSelfDraw && state._winSelfDraw[win]);
    var from = state._variants === 'cantonese'
      ? (state.winInfo ? state.winInfo.from : -1)
      : (state._winFrom && state._winFrom[win] !== undefined ? state._winFrom[win] : state._lastDiscardFrom);
    var payers = [];
    if (!selfDraw && Number.isInteger(from) && from >= 0 && from !== win) payers.push(from);
    else for (var q = 0; q < playerCount; q++) if (q !== win && (winners.indexOf(q) < 0 || winners.indexOf(q) > w)) payers.push(q);
    for (var pi = 0; pi < payers.length; pi++) {
      roundScores[payers[pi]] -= fan;
      roundScores[win] += fan;
    }
  }

  // 流局查花猪/查大叫罚分
  var penaltyResult = null;
  if (gameMod.calculatePenalties) {
    penaltyResult = gameMod.calculatePenalties(state);
    for (var p = 0; p < playerCount; p++) {
      if (penaltyResult.penalties[p]) {
        state._penalties[p] = (state._penalties[p] || 0) + penaltyResult.penalties[p];
      }
    }
  }

  if (!state.cumulativeScore) state.cumulativeScore = new Array(playerCount).fill(0);
  for (var i = 0; i < playerCount; i++) {
    state.cumulativeScore[i] = (state.cumulativeScore[i] || 0) + roundScores[i];
  }
  // 刮风下雨：杠收入累加到累计分 + 本局变动
  if (state._rain && state._gangScore) {
    for (var i2 = 0; i2 < playerCount; i2++) {
      if (state._gangScore[i2]) {
        state.cumulativeScore[i2] += state._gangScore[i2];
        roundScores[i2] += state._gangScore[i2];
      }
    }
  }
  // 流局罚分累加 + 本局变动
  if (state._penalties) {
    for (var i3 = 0; i3 < playerCount; i3++) {
      if (state._penalties[i3]) {
        state.cumulativeScore[i3] += state._penalties[i3];
        roundScores[i3] += state._penalties[i3];
      }
    }
  }

  broadcastRoom(room, {
    type: 'round_end',
    roundScores: roundScores,
    cumulativeScore: state.cumulativeScore.slice(),
    dealerIndex: state.dealerIndex,
    roundNumber: state.roundNumber,
    winners: winners,
    gangScore: state._gangScore ? state._gangScore.slice() : new Array(playerCount).fill(0),
    penalties: penaltyResult ? penaltyResult.details : [],
  });
}

// Detect a finished mahjong round and trigger the one-time settlement broadcast.
function checkMahjongRoundEnd(room) {
  if (!room || !room.state) return;
  if (room.game !== 'mahjong-sichuan' && room.game !== 'mahjong-cantonese') return;
  if (room.state.phase === 'over') endOfRound(room);
}

function scheduleTwentyFourBots(room) {
  if (!room.bots || room.bots.size === 0) return;
  const state = room.state;
  // Every human move re-enters here: each bot gets one answer timer per round, not one per move.
  const round = state.currentRound || 0;
  if (room._tfBotState === state && room._tfBotRound === round) return;
  room._tfBotState = state;
  room._tfBotRound = round;
  for (const [idx, bot] of room.bots) {
    const realCount = room.state._realPlayerCount || room.players.size;
    const delay = realCount < 3
      ? 20000 + Math.random() * 10000   // 1-2 real players: 20~30s
      : 30000 + Math.random() * 10000;  // 3+ real players: 30~40s
    const attempt = (retries) => {
      // Tracked so clearAllRoomTimers can cancel them (round change, restart, return to lobby).
      const handle = setTimeout(() => {
        if (room._tfBotTimers) room._tfBotTimers = room._tfBotTimers.filter(h => h !== handle);
        if (!rooms.has(room._roomId) || room.state !== state) return;
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
          broadcastGameView(room, 'game_state');
        } catch(e) { console.error('24 Bot exception:', e.message); }
      }, retries === 3 ? delay : 300);
      room._tfBotTimers = room._tfBotTimers || [];
      room._tfBotTimers.push(handle);
    };
    attempt(3);
  }
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
  // Per-bot cooldown: game modules export botInterval: {min, max} (ms) to space
  // out bot moves. Without it, bots act every tick and finish far too fast.
  const interval = gameMod.botInterval || null;
  room._botNextMove = room._botNextMove || {}; // index -> timestamp (ms) when bot may act
  room._rtErrors = 0;
  room._realtimeTimer = setInterval(() => {
    if (!rooms.has(room._roomId) || room.phase !== 'playing' || room.state.winner !== null) {
      stopRealtimeGame(room);
      return;
    }
    // One bad bot move or tick must not freeze the game: log it and keep ticking.
    // Only a tick that keeps failing (20 in a row) stops the loop.
    const now = Date.now();
    for (const [index, bot] of room.bots) {
      const nextAllowed = room._botNextMove[index] || 0;
      if (now < nextAllowed) continue; // still on cooldown
      try {
        const move = bot.getMove(room.state);
        gameMod.handleMove(move, room.state, index);
      } catch (e) {
        console.error('Realtime bot exception:', e.message);
      }
      // Schedule next move after a random delay within the game's interval
      if (interval) {
        const delay = interval.min + Math.floor(Math.random() * (interval.max - interval.min));
        room._botNextMove[index] = now + delay;
      }
    }
    try {
      gameMod.tick(room.state);
      broadcastGameView(room, 'game_state');
      room._rtErrors = 0;
      if (room.state.winner !== null) stopRealtimeGame(room);
    } catch (e) {
      console.error('Realtime game exception:', e.message);
      room._rtErrors = (room._rtErrors || 0) + 1;
      if (room._rtErrors >= 20) stopRealtimeGame(room);
    }
  }, gameMod.tickMs || 120);
}

// Generic scheduler for phase-based games. Module hooks:
//   getPhaseDeadline(state) -> absolute ms timestamp (0 = no timer); the module
//     stores it in state so clients can render a countdown.
//   onTimeout(state) -> apply defaults for everyone who hasn't acted.
//   getPendingActors(state) -> player indexes that may act right now (can be several).
// The deadline timer half: re-arms only when the module's deadline value changes, so moves that
// keep the deadline (e.g. 24-point submissions) do not push it back. Returns the deadline.
function schedulePhaseTimer(room, gameMod) {
  const state = room.state;
  const deadline = typeof gameMod.getPhaseDeadline === 'function' ? (gameMod.getPhaseDeadline(state) || 0) : 0;
  if (room._phaseDeadline !== deadline) {
    clearTimeout(room._phaseTimer);
    room._phaseDeadline = deadline;
    if (deadline > 0 && typeof gameMod.onTimeout === 'function') {
      room._phaseTimer = setTimeout(() => {
        room._phaseDeadline = 0;
        if (!rooms.has(room._roomId) || room.state !== state || room.phase !== 'playing') return;
        if (state.winner !== null && state.winner !== undefined) return;
        try {
          gameMod.onTimeout(state);
          if ((gameMod.getPhaseDeadline(state) || 0) === deadline) {
            // The timeout did not advance anything: don't re-arm a 0ms timer on the same deadline,
            // retry in 1s instead.
            room._phaseDeadline = deadline;
            clearTimeout(room._phaseTimer);
            room._phaseTimer = setTimeout(() => {
              room._phaseDeadline = 0;
              try { scheduleBotMove(room); } catch (e) { console.error('[scheduleBotMove]', e.message); }
            }, 1000);
          }
        } catch (e) {
          console.error('[game=' + room.game + ' room=' + room._roomId + '] onTimeout exception:', e.message);
          // Remember the deadline we failed on so the scheduler does not re-arm a 0ms timer for
          // it forever; the next real move (new deadline) arms normally again.
          room._phaseDeadline = deadline;
        }
        try { broadcastGameView(room, 'game_state'); } catch (e) { console.error('[broadcast]', e.message); }
        try { scheduleBotMove(room); } catch (e) { console.error('[scheduleBotMove]', e.message); }
      }, Math.max(0, deadline - Date.now()));
    }
  }
  return deadline;
}

function schedulePhaseGame(room, gameMod) {
  const state = room.state;
  const deadline = schedulePhaseTimer(room, gameMod);
  if (typeof gameMod.getPendingActors !== 'function') return;
  room._phaseBotPending = room._phaseBotPending || new Set();
  for (const idx of gameMod.getPendingActors(state) || []) {
    const bot = room.bots.get(idx);
    if (!bot || room._phaseBotPending.has(idx)) continue;
    // A bot whose move and fallbacks were all refused for this ask sits it out (until the
    // deadline passes it by) instead of retrying the same failing move every second.
    const stuckKey = idx + '@' + deadline;
    if (room._phaseBotStuck && room._phaseBotStuck.get(stuckKey) > Date.now()) continue;
    room._phaseBotPending.add(idx);
    const delay = 900 + Math.random() * 1500;
    const handle = setTimeout(() => {
      room._phaseBotPending.delete(idx);
      if (!rooms.has(room._roomId) || room.state !== state) return;
      if (state.winner !== null && state.winner !== undefined) return;
      const pending = gameMod.getPendingActors(state) || [];
      if (pending.indexOf(idx) < 0) return;
      try {
        let err;
        try {
          err = gameMod.handleMove(bot.getMove(state, idx), state, idx);
        } catch (e) {
          console.error('[game=' + room.game + ' actor=' + idx + ' room=' + room._roomId + '] Bot exception:', e.message);
          err = 'bot_exception';
        }
        if (err) {
          console.error('[game=' + room.game + ' actor=' + idx + ' room=' + room._roomId + '] Bot error:', err, '- passing');
          try { err = gameMod.handleMove({ pass: true }, state, idx); } catch (e) { err = 'pass_exception'; }
          if (err) {
            try { err = gameMod.handleMove({}, state, idx); } catch (e) { err = 'empty_exception'; }
          }
          if (err) {
            room._phaseBotStuck = room._phaseBotStuck || new Map();
            room._phaseBotStuck.set(stuckKey, Date.now() + 15000);
          }
        }
        broadcastGameView(room);
        scheduleBotMove(room);
      } catch (e) {
        console.error('[game=' + room.game + ' actor=' + idx + ' room=' + room._roomId + '] phase bot timer exception:', e.message);
      }
    }, delay);
    room._phaseBotTimers = room._phaseBotTimers || [];
    room._phaseBotTimers.push(handle);
  }
}

function scheduleBotMove(room) {
  if (!room || !room.state) return;
  const state = room.state;
  // Mahjong: settle when round is over. Must run BEFORE the winner check below —
  // Cantonese sets state.winner to an index on 胡, so `winner !== null` would
  // return early and skip endOfRound (bot wins would never add points).
  if ((room.game === 'mahjong-sichuan' || room.game === 'mahjong-cantonese') && state.phase === 'over') {
    endOfRound(room);
    return;
  }
  if (state.winner !== null && state.winner !== undefined) return;

  const gameMod = gameRegistry[room.game];
  if (!gameMod) return;
  if (gameMod.realtime) return;

  // Phase-based games (night/vote/response windows) opt in via module hooks.
  // Games with simultaneous actors (getPendingActors) are fully driven by the generic scheduler;
  // games that only have a deadline (doudizhu, twentyfour, drawguess) keep their own bot paths below.
  if (typeof gameMod.getPendingActors === 'function') {
    schedulePhaseGame(room, gameMod);
    return;
  }
  if (typeof gameMod.getPhaseDeadline === 'function') schedulePhaseTimer(room, gameMod);

  // Battleship placing phase: all bots place simultaneously (not turn-based)
  if (room.game === 'battleship' && state.phase === 'placing') {
    scheduleBattleshipPlacements(room);
    return;
  }

  // 24 game: all bots race simultaneously, no turn order
  if (room.game === 'twentyfour') {
    scheduleTwentyFourBots(room);
    // The round timer is armed above from getPhaseDeadline (roundEndsAt, fixed at round start)
    return;
  }

  const cp = getCurrentActor(state, gameMod);
  if (cp < 0) return; // no turn owner yet (e.g. choosing phase)
  const bot = room.bots.get(cp);
  if (!bot) return;

  // 打牌/摸牌：快一些（0.8~2s）。吃碰杠等 claim 响应：放慢到 1.6~3s，
  // 给真人玩家留出反应时间，避免"按不过 bot"。
  const isClaimResp = state.phase === 'claim';
  let delay = isClaimResp ? (1600 + Math.random() * 1400) : (800 + Math.random() * 1200);
  // 骗子酒馆：开牌/开枪结果出来后多停一会儿，让真人看清楚再继续
  if (room.game === 'liarsbar') {
    const shotsShown = state.lastShotResults && state.lastShotResults.length > 0;
    if (state.phase === 'shooting' && !shotsShown) delay += 3000;
    else if (state.phase === 'playing' && shotsShown && state.pileCards.length === 0) delay += 3000;
  }
  // 上一次机器人连兜底都失败（状态没变）：别每秒空转重试，隔 15 秒再试，
  // 期间真人操作或计时器可能已让局面前进。
  const stuck = room._botStuck;
  if (stuck && stuck.cp === cp && stuck.state === state) delay = 15000;
  clearTimeout(room._botTimer);
  room._botTimer = setTimeout(() => {
    if (!rooms.has(room._roomId) || room.state !== state) return;
    const tag = '[game=' + room.game + ' actor=' + cp + ' room=' + room._roomId + ']';
    let err;
    try {
      err = gameMod.handleMove(bot.getMove(room.state), room.state, cp);
    } catch (e) {
      console.error(tag + ' Bot exception:', e.message);
      err = 'bot_exception';
    }
    try {
      if (err) {
        // Never let a bad bot move stall the game: fall back to drawing / passing
        console.error(tag + ' Bot error:', err, '— falling back to pass/draw');
        try { err = gameMod.handleMove({ pass: true }, room.state, cp); } catch (e) { err = 'pass_exception'; }
        // last resort: empty move (most games draw + advance)
        if (err) { try { err = gameMod.handleMove({}, room.state, cp); } catch (e) { err = 'empty_exception'; } }
        if (err) console.error(tag + ' Bot fallback failed:', err, '— retrying in 15s');
      }
      room._botStuck = err ? { cp, state } : null;
      skipDisconnectedTurn(room);
      // 麻将：bot 胡牌也先结算再广播，客户端才不会先看到 0 分再被 round_end 修正
      checkMahjongRoundEnd(room);
      broadcastGameView(room);
      scheduleBotMove(room);
    } catch (e) {
      // The fallback runs inside a timer: it must never throw out of the callback.
      console.error(tag + ' Bot fallback exception:', e.message);
    }
  }, delay);
}

function scheduleBattleshipPlacements(room) {
  const state = room.state;
  if (state.phase !== 'placing') { scheduleBotMove(room); return; }

  const gameMod = gameRegistry[room.game];
  if (!gameMod) return;

  // Find a bot that still needs to place ships
  var nextBotIdx = null, nextBot = null;
  for (const [idx, bot] of room.bots) {
    if (state.placedCount[idx] < state.shipSizes.length) {
      nextBotIdx = idx;
      nextBot = bot;
      break;
    }
  }
  if (!nextBot) return;  // all bots placed — wait for humans (their move reschedules)

  // 已有放置定时器就别重排：人类每次（含空过）操作都会走到这里，反复重置会让机器人永远放不下去
  if (room._bsPlacing) return;
  const delay = 250 + Math.random() * 500;
  clearTimeout(room._botTimer);
  room._bsPlacing = true;
  room._botTimer = setTimeout(() => {
    room._bsPlacing = false;
    if (!rooms.has(room._roomId) || room.state !== state) return;
    try {
      const moveData = nextBot.getMove(state);
      const err = gameMod.handleMove(moveData, state, nextBotIdx);
      if (err) {
        console.error('Battleship bot placement error:', err);
      }
      broadcastGameView(room);
      scheduleBattleshipPlacements(room);
    } catch(e) { console.error('Battleship bot exception:', e.message); }
  }, delay);
}

// ---- Seat / room helpers ----

// A finished game (any of the shapes the modules use) - only then may a non-host leave the table.
function isGameOver(state) {
  if (!state) return true;
  if (state.winner !== null && state.winner !== undefined) return true;
  if (Array.isArray(state.winners) && state.winners.length) return true;
  return state.phase === 'over' || state.phase === 'finished' || state.phase === 'gameover' || state.gameOver === true;
}

// initGame(state, n) assumes seats 0..n-1. remove_bot/kick/leave leave gaps, so close them
// (humans and bots keep their relative order) before a game starts.
function compactSeats(room) {
  const entries = [];
  for (const [, info] of room.players) entries.push({ human: true, info, index: info.index });
  for (const [index, bot] of room.bots) entries.push({ human: false, bot, index });
  entries.sort((a, b) => a.index - b.index);
  if (entries.every((e, i) => e.index === i)) return;
  const botMod = botRegistry[room.game];
  const ready = new Set();
  const bots = new Map();
  entries.forEach((e, i) => {
    if (e.human) {
      if (room.readyPlayers.has(e.index)) ready.add(i);
      e.info.index = i;
    } else {
      const nb = botMod ? botMod.createBot(i) : e.bot;
      nb.name = /^(电脑|Bot )\d+$/.test(e.bot.name || '') ? (room._lang === 'zh' ? '电脑' : 'Bot ') + (i + 1) : e.bot.name;
      bots.set(i, nb);
    }
  });
  room.readyPlayers = ready;
  room.bots = bots;
  for (const [client, info] of room.players) {
    if (client.readyState === 1) client.send(JSON.stringify({ type: 'player_index_updated', playerIndex: info.index }));
  }
}

// Drop a human seat. Returns false when that emptied (and deleted) the room.
function removeSeat(room, roomId, ws, info) {
  room.players.delete(ws);
  room.readyPlayers.delete(info.index);
  if (room.hostWS === ws) {
    room.hostWS = Array.from(room.players.keys()).find(client => client.readyState === 1) || null;
    broadcastHostChanged(room);
  }
  if (room.players.size === 0) {
    clearAllRoomTimers(room);
    if (rooms.get(roomId) === room) rooms.delete(roomId);
    return false;
  }
  return true;
}

// Grace period over for a disconnected / left seat: free it and let the game go on.
function expireSeat(room, roomId, ws, info) {
  try {
    if (!info.disconnectedAt || room.players.get(ws) !== info) return;
    if (!removeSeat(room, roomId, ws, info)) return;
    const skipped = room.phase === 'playing' && skipDisconnectedTurn(room);
    broadcastRoom(room, { type: 'player_left', players: roomPlayersList(room), phase: room.phase });
    if (room.phase === 'playing' && room.state && skipped) broadcastGameView(room);
    scheduleBotMove(room);
  } catch (e) {
    console.error('[expireSeat]', e && e.message);
  }
}

// ---- WebSocket Handler ----

wss.on('connection', (ws) => {
  ws._isAlive = true;
  ws.on('pong', () => { ws._isAlive = true; });
  ws.on('error', () => {});
  let currentRoomId = null;
  let currentRoom = null;

  // This socket is about to enter another room: free its seat in the old one first.
  const leaveCurrentRoom = () => {
    const room = currentRoom, roomId = currentRoomId;
    currentRoom = null;
    currentRoomId = null;
    if (!room) return;
    const info = room.players.get(ws);
    if (!info) return;
    if (info._disconnectTimer) clearTimeout(info._disconnectTimer);
    info._disconnectTimer = null;
    info.disconnectedAt = Date.now();
    expireSeat(room, roomId, ws, info);
  };

  const onMessage = (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;
    const { type, data } = msg;

    // --- create_room ---
    if (type === 'create_room') {
      const { game, lang } = data || {};
      if (typeof game !== 'string' || !gameRegistry[game]) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'invalid_game_type') }));
        return;
      }
      if (currentRoom) leaveCurrentRoom();
      const result = createRoom(ws, game, typeof lang === 'string' && lang ? lang : 'zh');
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

    // --- remove_bot ---
    if (type === 'remove_bot') {
      if (!currentRoom) return;
      if (ws !== currentRoom.hostWS) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'host_only_remove_bot') }));
        return;
      }
      if (currentRoom.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'game_started_remove_bot') }));
        return;
      }
      const { botIndex } = data || {};
      if (typeof botIndex === 'number' && currentRoom.bots.has(botIndex)) {
        // 只删除,不重排:Map key 就是座位号(真人也占着这些号码),
        // 重排到 0..n-1 会与真人座位编号相撞,导致客户端按索引显示时"电脑消失"。
        currentRoom.bots.delete(botIndex);
      }
      broadcastRoom(currentRoom, {
        type: 'room_update',
        phase: currentRoom.phase,
        players: roomPlayersList(currentRoom),
      });
      return;
    }

    // --- kick_player (host removes a human player from the room) ---
    if (type === 'kick_player') {
      if (!currentRoom) return;
      if (ws !== currentRoom.hostWS) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'host_only_kick') }));
        return;
      }
      if (currentRoom.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'kick_disallowed_playing') }));
        return;
      }
      const { playerIndex } = data || {};
      if (typeof playerIndex !== 'number') return;
      let targetWS = null, targetInfo = null;
      for (const [w, info] of currentRoom.players) {
        if (info.index === playerIndex) { targetWS = w; targetInfo = info; break; }
      }
      if (!targetInfo) return; // 不是真人（bot 由 remove_bot 处理）
      // 房主不能踢自己
      let hostIndex = -1;
      for (const [w, info] of currentRoom.players) {
        if (w === currentRoom.hostWS) { hostIndex = info.index; break; }
      }
      if (targetInfo.index === hostIndex) return;
      currentRoom.players.delete(targetWS);
      currentRoom.readyPlayers.delete(playerIndex);
      if (targetWS.readyState === 1) {
        targetWS.send(JSON.stringify({ type: 'kicked', reason: serverT(currentRoom, 'kicked_by_host') }));
        setTimeout(() => { try { targetWS.close(); } catch (e) {} }, 120);
      }
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
      const room = typeof roomId === 'string' ? rooms.get(roomId) : null;
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', code: 'ROOM_NOT_FOUND', message: serverT(currentRoom, 'room_not_found') }));
        return;
      }
      if (currentRoom && currentRoom !== room) leaveCurrentRoom();
      // Resume an existing seat after returning to the lobby / temporary disconnect.
      const resumable = typeof resumeToken === 'string' && resumeToken && Array.from(room.players.entries())
        .find(([, info]) => info.resumeToken === resumeToken);
      if (resumable) {
        const oldWs = resumable[0];
        const info = resumable[1];
        if (info._disconnectTimer) clearTimeout(info._disconnectTimer);
        info._disconnectTimer = null;
        info.disconnectedAt = null;
        info._left = false;
        room.players.delete(oldWs);
        room.players.set(ws, info);
        if (room.hostWS === oldWs) room.hostWS = ws;
        currentRoomId = roomId;
        currentRoom = room;
        ws.send(JSON.stringify({ type: 'room_joined', roomId, game: room.game, maxPlayers: room.maxPlayers,
          playerIndex: info.index, players: roomPlayersList(room), state: viewFor(room, info.index), match: room.match || null, phase: room.phase,
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
          state: viewFor(room, existing[1].index), match: room.match || null,
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
      let hostMoved = false;
      if (!room.hostWS || room.hostWS.readyState !== 1) {
        hostMoved = true;
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
        state: viewFor(room, idx), match: room.match || null,
        phase: room.phase,
        options: room.options,
        resumeToken: room.players.get(ws).resumeToken,
      }));
      sendToRoom(room, {
        type: 'player_joined',
        players: roomPlayersList(room),
        phase: room.phase,
      }, ws);
      if (hostMoved) broadcastHostChanged(room);
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
      if (totalPlayers > (currentRoom.maxPlayers || totalPlayers)) return;
      if (totalPlayers < minPlayers) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'min_players').replace('%s', minPlayers) }));
        return;
      }
      const allReady = Array.from(currentRoom.players.values())
        .every(p => currentRoom.readyPlayers.has(p.index));
      if (!allReady) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'all_ready_required') }));
        return;
      }

      compactSeats(currentRoom); // seats must be 0..n-1 for initGame
      currentRoom.phase = 'playing';
      applyRuntimeState(currentRoom, totalPlayers);
      // 麻将首局随机坐庄：不让房主默认当庄先摸牌先出牌
      if (currentRoom.game === 'mahjong-sichuan' || currentRoom.game === 'mahjong-cantonese') {
        currentRoom.state.dealerIndex = Math.floor(Math.random() * totalPlayers);
      }
      if (gameMod && gameMod.initGame) {
        gameMod.initGame(currentRoom.state, totalPlayers);
      }

      ensureMatch(currentRoom, true);
      broadcastGameView(currentRoom, 'game_started');
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
      const validSeat = (n) => Number.isInteger(n) && n >= 0 && n < currentRoom.maxPlayers;
      if (!validSeat(fromIndex) || !validSeat(toIndex)) return;
      if (fromIndex === toIndex) return;
      // Only the host may rearrange other people's seats; everyone may move their own.
      const swapper = currentRoom.players.get(ws);
      if (ws !== currentRoom.hostWS && !(swapper && (swapper.index === fromIndex || swapper.index === toIndex))) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'swap_own_seat_only') }));
        return;
      }

      const fromPlayer = Array.from(currentRoom.players.entries())
        .find(([, info]) => info.index === fromIndex);
      const toPlayer = Array.from(currentRoom.players.entries())
        .find(([, info]) => info.index === toIndex);

      if (fromPlayer) currentRoom.players.get(fromPlayer[0]).index = toIndex;
      if (toPlayer) currentRoom.players.get(toPlayer[0]).index = fromIndex;

      // Swap bot indices —— 两个 bot 相邻对换时,顺序 delete/set 会把刚放好的那个删掉,
      // 直接把两个 key 值互换;单边有 bot 时移动,无 bot 则不动作。
      if (currentRoom.bots) {
        const fromBot = currentRoom.bots.get(fromIndex);
        const toBot = currentRoom.bots.get(toIndex);
        if (fromBot && toBot) {
          currentRoom.bots.set(toIndex, fromBot);
          currentRoom.bots.set(fromIndex, toBot);
        } else if (fromBot) {
          currentRoom.bots.delete(fromIndex);
          currentRoom.bots.set(toIndex, fromBot);
        } else if (toBot) {
          currentRoom.bots.delete(toIndex);
          currentRoom.bots.set(fromIndex, toBot);
        }
      }

      // Swap ready states
      const fromReady = currentRoom.readyPlayers.has(fromIndex);
      const toReady = currentRoom.readyPlayers.has(toIndex);
      currentRoom.readyPlayers.delete(fromIndex);
      currentRoom.readyPlayers.delete(toIndex);
      if (fromReady) currentRoom.readyPlayers.add(toIndex);
      if (toReady) currentRoom.readyPlayers.add(fromIndex);

      // Transfer host: not needed - hostWS is a socket, not a seat index, so the host follows its player.

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
      if (typeof key !== 'string' || !key || key === '__proto__' || key === 'constructor' || key === 'prototype') return;
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
      const clean = sanitizeText(name);
      if (clean.length > 0 && clean.length <= 8) {
        info.name = uniqueRoomName(currentRoom, ws, clean);
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
      const cleanAv = sanitizeText(avatar);
      if (cleanAv && cleanAv.length <= 4) {
        info.avatar = cleanAv;
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
      // After return_to_room / before start there is no state to move on.
      if (currentRoom.phase !== 'playing' || !currentRoom.state) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'game_not_playing'), code: 'game_not_playing' }));
        return;
      }

      let err;
      try {
        err = gameMod.handleMove(data, currentRoom.state, playerInfo.index);
      } catch (e) {
        console.error(`[${currentRoom.game}] handleMove threw:`, e);
        err = 'g_invalid_action';
      }
      if (err) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, err), code: err }));
        // A non-fatal wrong sudoku entry costs a life: let everyone see it now, not on the next tick.
        if (currentRoom.game === 'sudoku' && err === 'su_wrong') broadcastGameView(currentRoom, 'game_state');
        return;
      }

      skipDisconnectedTurn(currentRoom);

      // Mahjong: settle the round before broadcasting the 'over' game_state so the
      // settlement panel draws with the already-updated cumulativeScore (no stale flash).
      checkMahjongRoundEnd(currentRoom);
      broadcastGameView(currentRoom, 'game_state');
      scheduleBotMove(currentRoom);
      return;
    }

    // --- request_restart (non-host asks the host to start a new game) ---
    if (type === 'request_restart') {
      if (!currentRoom) return;
      if (ws === currentRoom.hostWS) return; // host uses game_restart directly
      const requester = currentRoom.players.get(ws);
      // Tell the host someone wants to restart.
      if (currentRoom.hostWS && currentRoom.hostWS.readyState === 1) {
        currentRoom.hostWS.send(JSON.stringify({
          type: 'restart_requested',
          by: requester ? requester.name : 'Player',
        }));
      }
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
      // Restart is for a game that is (or just was) running; from the lobby the host must use
      // start_game, which enforces ready/min-player checks.
      if (currentRoom.phase !== 'playing' || !currentRoom.state) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'game_not_playing'), code: 'game_not_playing' }));
        return;
      }
      clearAllRoomTimers(currentRoom); // old bot / phase / 24-point timers must not leak into the new game
      const totalPlayers = currentRoom.players.size + (currentRoom.bots ? currentRoom.bots.size : 0);
      const minPlayersR = gameMod.minPlayers || 2;
      if (totalPlayers < minPlayersR) {
        scheduleBotMove(currentRoom);
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'min_players').replace('%s', minPlayersR) }));
        return;
      }

      // Mahjong multi-round: snapshot the previous round's tracking fields
      // before createState() replaces the state object.
      var prevMJ = null;
      if (currentRoom.state && (currentRoom.game === 'mahjong-sichuan' || currentRoom.game === 'mahjong-cantonese')) {
        prevMJ = {
          cumulativeScore: currentRoom.state.cumulativeScore,
          dealerIndex: currentRoom.state.dealerIndex,
          roundNumber: currentRoom.state.roundNumber,
          // Sichuan: state.winners[] (array, empty on 荒庄); Cantonese: state.winner (single index, -1 = 荒庄)
          winners: currentRoom.state.winners,
          winner: currentRoom.state.winner,
        };
      }
      // 多局比赛：上一局已分出结果、比赛还没结束时交换座位，轮流先手
      if (currentRoom.match && !currentRoom.match.over && currentRoom.state && currentRoom.state.winner != null) {
        swapMatchSeats(currentRoom);
      }
      // Texas: chips and dealer carry over between hands (games/texas.js carryOver decides; it starts a
      // fresh session when the session is over). compactSeats renumbers the remaining seats in
      // ascending order, so the sorted old indexes map each new seat back to its previous stack.
      var prevTexas = currentRoom.game === 'texas' ? currentRoom.state : null;
      var texasSeats = prevTexas
        ? Array.from(currentRoom.players.values(), info => info.index).concat(Array.from(currentRoom.bots.keys())).sort((a, b) => a - b)
        : null;
      compactSeats(currentRoom);
      currentRoom.state = gameMod.createState();
      applyRuntimeState(currentRoom, totalPlayers);
      if (prevTexas) gameMod.carryOver(prevTexas, currentRoom.state, totalPlayers, texasSeats);

      // 麻将多局：庄家/累计分必须在 initGame 之前写回，
      // 因为 initGame 要按 dealerIndex 发牌决定谁先摸（写在后面就永远是 0 号先手）。
      if (prevMJ) {
        currentRoom.state.cumulativeScore = prevMJ.cumulativeScore || new Array(totalPlayers).fill(0);
        var nextDealer;
        var hadWinner = false;
        if (prevMJ.winners && prevMJ.winners.length > 0 && prevMJ.winners[0] >= 0) {
          nextDealer = prevMJ.winners[0]; // 胡牌者坐庄
          hadWinner = true;
        } else if (prevMJ.winner != null && prevMJ.winner >= 0) {
          nextDealer = prevMJ.winner; // Cantonese 胡牌者坐庄
          hadWinner = true;
        }
        if (!hadWinner) {
          nextDealer = ((prevMJ.dealerIndex || 0) + 1) % totalPlayers; // 荒庄顺时针轮庄
        }
        currentRoom.state.dealerIndex = nextDealer;
        currentRoom.state.roundNumber = (prevMJ.roundNumber || 1) + 1;
      }

      if (gameMod && gameMod.initGame) {
        gameMod.initGame(currentRoom.state, totalPlayers);
      }

      currentRoom.phase = 'playing';
      ensureMatch(currentRoom, false);

      broadcastGameView(currentRoom, 'game_state');
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
      info._left = true; // the socket close that follows must not shorten this 5-minute window
      if (info._disconnectTimer) clearTimeout(info._disconnectTimer);
      const leftRoom = currentRoom, leftRoomId = currentRoomId; // not the connection-scoped vars: the socket may join another room
      info._disconnectTimer = setTimeout(() => expireSeat(leftRoom, leftRoomId, ws, info), 300000);  // 5-minute grace for rejoin
      ws.send(JSON.stringify({ type: 'left_room' }));
      return;
    }

    // --- return_to_room ---
    if (type === 'return_to_room') {
      if (!currentRoom) return;
      // Mid-game only the host may abort the table; anyone may leave once the game is over.
      if (currentRoom.phase === 'playing' && ws !== currentRoom.hostWS && !isGameOver(currentRoom.state)) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'host_only_return_midgame') }));
        return;
      }
      currentRoom.phase = 'lobby';
      currentRoom.readyPlayers = new Set();
      currentRoom.state = null;
      clearAllRoomTimers(currentRoom);
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
      if (currentRoom.phase !== 'playing' || !state || !currentRoom.players.has(ws)) return;
      // Only once the round is really over: stops a click on a running round (or two players
      // clicking together) from skipping rounds.
      if (state.phase !== 'round_end') return;
      const totalPlayers = currentRoom.players.size + (currentRoom.bots ? currentRoom.bots.size : 0);

      if (state.currentRound >= state.maxRounds) {
        state.phase = 'over';
        let bestWins = -1, best = -1;
        for (let i = 0; i < state.roundsWon.length; i++) {
          if (state.roundsWon[i] > bestWins) { bestWins = state.roundsWon[i]; best = i; }
        }
        state.winner = best;
        broadcastGameView(currentRoom, 'game_state');
        return;
      }

      state.currentRound++;
      state.phase = 'playing';
      state.roundWinner = null;
      state.solutions = [];
      state.playerSubmissions = {};
      applyRuntimeState(currentRoom, totalPlayers);
      // Generate new numbers (use the game module's function)
      gameRegistry['twentyfour'].initGame(state, totalPlayers);
      broadcastGameView(currentRoom, 'game_state');
      scheduleBotMove(currentRoom);
      return;
    }
  };

  // Any exception from a message (a game module bug, a malformed payload) must only fail that
  // one message: an uncaught throw in a ws listener would take the whole server down.
  ws.on('message', (raw) => {
    try {
      onMessage(raw);
    } catch (e) {
      console.error('[ws message] handler threw:', e);
      try {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'g_invalid_action'), code: 'g_invalid_action' }));
      } catch (e2) { /* socket already gone */ }
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentRoomId) {
      const info = currentRoom.players.get(ws);
      if (!info) return;
      const room = currentRoom, roomId = currentRoomId;
      if (!info._left) { // leave_room already armed the longer 5-minute window
        info.disconnectedAt = Date.now();
        if (info._disconnectTimer) clearTimeout(info._disconnectTimer);
        info._disconnectTimer = setTimeout(() => expireSeat(room, roomId, ws, info), disconnectGraceMs(room));
      }
      broadcastRoom(room, { type: 'player_left', players: roomPlayersList(room), phase: room.phase });
    }
  });
});

// ---- LAN IP Detection ----

function getLanIPs() {
  let interfaces = {};
  try { interfaces = os.networkInterfaces(); } catch (e) { return []; } // can throw on some Android builds
  const ips = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push({ name, ip: addr.address, netmask: addr.netmask });
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
  const noisyNamePattern = /(wireguard|vpn|vethernet|virtual|hyper-v|loopback|^tun|^ppp)/i;
  // Phone cellular interfaces, tunnels and carrier-grade NAT: never reachable from the LAN.
  const cellularNamePattern = /^(rmnet|ccmni|pdp|clat|v4-|tun|ppp)/i;
  const cgnatPattern = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./;
  // A /32 address is a point-to-point tunnel (VPN, vendor gateways like vgate0), not a LAN.
  const all = getLanIPs().filter(({ name, ip, netmask }) =>
    !cellularNamePattern.test(name) && !cgnatPattern.test(ip) && netmask !== '255.255.255.255');
  const preferred = all.filter(({ name, ip }) => privatePattern.test(ip) && !noisyNamePattern.test(name));
  if (preferred.length) return preferred;

  const privateOnly = all.filter(({ ip }) => privatePattern.test(ip));
  return privateOnly.length ? privateOnly : all;
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

module.exports = { server, getActivePort: () => activePort };
