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

// QR code endpoint — generates QR with the host from the request
// Works on LAN (192.168.x.x:3000) and cloud (project.up.railway.app)
app.get('/qr', async (req, res) => {
  try {
    const room = req.query.room;
    if (!room) { res.status(400).send('missing room'); return; }
    // Prefer a real LAN IP so the QR is scannable from a phone on the same WiFi.
    // When the requester came via localhost/127.0.0.1, using that Host makes the
    // QR point at the phone's own loopback — useless. Fall back to the first
    // shareable 192.168.x.x / 10.x.x.x address.
    let host = req.get('Host') || 'localhost:3000';
    if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
      const lan = getShareableLanIPs()[0];
      if (lan) host = `${lan.ip}:${activePort}`;
    }
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
    } else if (isCantonese) {
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
    } else {
      return res.json({ error: 'not mahjong' });
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
  let initialState;
  try {
    initialState = gameMod.createState();
  } catch (e) {
    // A single bad/misconfigured state factory must not crash the whole server.
    console.error('createState failed for game "' + gameType + '":', e && e.message);
    return null;
  }
  const roomId = generateRoomId();
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

  const active = new Set();
  for (const [ws, info] of room.players) {
    if (ws.readyState === 1 && !info.disconnectedAt) active.add(info.index);
  }
  for (const index of room.bots.keys()) active.add(index);
  if (active.has(cp) || active.size === 0) return false;

  const seatCount = Array.isArray(state.hands) && state.hands.length
    ? state.hands.length
    : Math.max(1, room.maxPlayers || 0, ...active);
  for (let offset = 1; offset <= seatCount; offset++) {
    const candidate = (cp + offset) % seatCount;
    if (active.has(candidate)) {
      // Update whichever field the game uses for current actor
      if (gameMod && gameMod.getCurrentActor) {
        // Game uses custom actor — let it handle the update
        if (gameMod.setCurrentActor) gameMod.setCurrentActor(state, candidate);
      } else {
        state.currentPlayer = candidate;
      }
      return true;
    }
  }
  return false;
}

// The state a given seat is allowed to see (hidden info filtered by the game module).
function viewFor(room, index) {
  const gameMod = gameRegistry[room.game];
  if (!room.state || !gameMod || index === undefined || index === null) return room.state;
  if (room.game === 'minesweeper' && gameMod.playerBoardView) {
    return Object.assign({}, room.state, { board: gameMod.playerBoardView(room.state, index) });
  }
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
  if (room.game === 'minesweeper' && gameMod.playerBoardView) {
    for (const [client, info] of room.players) {
      if (client.readyState === 1) {
        const viewState = Object.assign({}, room.state, { board: gameMod.playerBoardView(room.state, info.index) });
        client.send(JSON.stringify({ type: t, state: viewState, players, match }));
      }
    }
  } else if (gameMod.playerView) {
    for (const [client, info] of room.players) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: t, state: gameMod.playerView(room.state, info.index), players, match }));
      }
    }
  } else {
    broadcastRoom(room, { type: t, state: room.state, players, match });
  }
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
  clearTimeout(room._tfTimer);
  clearTimeout(room._dgTimer);
  clearTimeout(room._phaseTimer);
  room._phaseDeadline = 0;
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

  try {
    if (!state.cumulativeScore) state.cumulativeScore = new Array(playerCount).fill(0);
    for (var i = 0; i < playerCount; i++) {
      state.cumulativeScore[i] = (state.cumulativeScore[i] || 0) + roundScores[i];
    }
  } catch(e) {
    console.error('[endOfRound] ERROR:', e.message);
  }
  // 刮风下雨：杠收入累加到累计分 + 本局变动
  if (state._rain && state._gangScore && state._gangScore) {
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
    broadcastGameView(room, 'game_state');
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
  // Per-bot cooldown: game modules export botInterval: {min, max} (ms) to space
  // out bot moves. Without it, bots act every tick and finish far too fast.
  const interval = gameMod.botInterval || null;
  room._botNextMove = room._botNextMove || {}; // index -> timestamp (ms) when bot may act
  room._realtimeTimer = setInterval(() => {
    if (!rooms.has(room._roomId) || room.phase !== 'playing' || room.state.winner !== null) {
      stopRealtimeGame(room);
      return;
    }
    try {
      const now = Date.now();
      for (const [index, bot] of room.bots) {
        const nextAllowed = room._botNextMove[index] || 0;
        if (now < nextAllowed) continue; // still on cooldown
        const move = bot.getMove(room.state);
        gameMod.handleMove(move, room.state, index);
        // Schedule next move after a random delay within the game's interval
        if (interval) {
          const delay = interval.min + Math.floor(Math.random() * (interval.max - interval.min));
          room._botNextMove[index] = now + delay;
        }
      }
      gameMod.tick(room.state);
      broadcastGameView(room, 'game_state');
      if (room.state.winner !== null) stopRealtimeGame(room);
    } catch (e) {
      console.error('Realtime game exception:', e.message);
      stopRealtimeGame(room);
    }
  }, gameMod.tickMs || 120);
}

// Generic scheduler for phase-based games. Module hooks:
//   getPhaseDeadline(state) -> absolute ms timestamp (0 = no timer); the module
//     stores it in state so clients can render a countdown.
//   onTimeout(state) -> apply defaults for everyone who hasn't acted.
//   getPendingActors(state) -> player indexes that may act right now (can be several).
function schedulePhaseGame(room, gameMod) {
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
        } catch (e) {
          console.error('[game=' + room.game + ' room=' + room._roomId + '] onTimeout exception:', e.message);
        }
        broadcastGameView(room, 'game_state');
        scheduleBotMove(room);
      }, Math.max(0, deadline - Date.now()));
    }
  }

  if (typeof gameMod.getPendingActors !== 'function') return;
  room._phaseBotPending = room._phaseBotPending || new Set();
  for (const idx of gameMod.getPendingActors(state) || []) {
    const bot = room.bots.get(idx);
    if (!bot || room._phaseBotPending.has(idx)) continue;
    room._phaseBotPending.add(idx);
    const delay = 900 + Math.random() * 1500;
    const handle = setTimeout(() => {
      room._phaseBotPending.delete(idx);
      if (!rooms.has(room._roomId) || room.state !== state) return;
      if (state.winner !== null && state.winner !== undefined) return;
      const pending = gameMod.getPendingActors(state) || [];
      if (pending.indexOf(idx) < 0) return;
      try {
        const err = gameMod.handleMove(bot.getMove(state, idx), state, idx);
        if (err) {
          console.error('[game=' + room.game + ' actor=' + idx + ' room=' + room._roomId + '] Bot error:', err, '— passing');
          gameMod.handleMove({ pass: true }, state, idx);
        }
      } catch (e) {
        console.error('[game=' + room.game + ' actor=' + idx + ' room=' + room._roomId + '] Bot exception:', e.message);
      }
      broadcastGameView(room);
      scheduleBotMove(room);
    }, delay);
    room._phaseBotTimers = room._phaseBotTimers || [];
    room._phaseBotTimers.push(handle);
  }
}

function scheduleBotMove(room) {
  if (!room || !room.state) return;
  const state = room.state;
  // 斗地主出牌计时：每次落子/广播后都重新挂上（机器人出完轮到真人时也要计时）
  if (room.game === 'doudizhu') scheduleTurnTimer(room);
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
  if (typeof gameMod.getPhaseDeadline === 'function' || typeof gameMod.getPendingActors === 'function') {
    schedulePhaseGame(room, gameMod);
    return;
  }

  // Battleship placing phase: all bots place simultaneously (not turn-based)
  if (room.game === 'battleship' && state.phase === 'placing') {
    scheduleBattleshipPlacements(room);
    return;
  }

  // 24 game: all bots race simultaneously, no turn order
  if (room.game === 'twentyfour') {
    scheduleTwentyFourBots(room);
    // Timer is started explicitly in start_game and next_round — NOT here,
    // because resetting it on every move drifts the end time past roundEndsAt
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
  clearTimeout(room._botTimer);
  room._botTimer = setTimeout(() => {
    if (!rooms.has(room._roomId)) return;
    try {
      const moveData = bot.getMove(room.state);
      let err = gameMod.handleMove(moveData, room.state, cp);
      if (err) {
        // Never let a bad bot move stall the game: fall back to drawing / passing
        console.error('[game=' + room.game + ' actor=' + cp + ' room=' + room._roomId + '] Bot error:', err, '— falling back to pass/draw');
        const fb = gameMod.handleMove({ pass: true }, room.state, cp);
        if (fb) gameMod.handleMove({}, room.state, cp); // last resort: empty move (most games draw + advance)
      }
      skipDisconnectedTurn(room);
      // 麻将：bot 胡牌也先结算再广播，客户端才不会先看到 0 分再被 round_end 修正
      checkMahjongRoundEnd(room);
      broadcastGameView(room);
      scheduleBotMove(room);
    } catch(e) {
        console.error('[game=' + room.game + ' actor=' + cp + ' room=' + room._roomId + '] Bot exception:', e.message);
        gameMod.handleMove({ pass: true }, room.state, cp);
        skipDisconnectedTurn(room);
        broadcastGameView(room);
        scheduleBotMove(room);
      }
  }, delay);
}

function scheduleTurnTimer(room) {
  clearTimeout(room._ddzTurnTimer);
  if (!room || room.game !== 'doudizhu' || !rooms.has(room._roomId)) return;
  var st = room.state;
  if (!st || !st.playTimeLimit || st.playTimeLimit <= 0) return;
  if (st.winner != null || !st.currentTurnDeadline) return;
  var ms = st.currentTurnDeadline - Date.now();
  if (ms <= 0) {
    if (st.phase !== 'playing') return;
    var cp = st.currentPlayer;
    var ddz = gameRegistry['doudizhu'];
    ddz.handleMove(ddz.timeoutMove(st), st, cp);
    broadcastGameView(room, 'game_state');
    scheduleBotMove(room);
    return;
  }
  room._ddzTurnTimer = setTimeout(function() { scheduleTurnTimer(room); }, Math.min(ms, 1000));
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

  const delay = 250 + Math.random() * 500;
  clearTimeout(room._botTimer);
  room._botTimer = setTimeout(() => {
    if (!rooms.has(room._roomId)) return;
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
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'min_players').replace('%s', minPlayers) }));
        return;
      }
      const allReady = Array.from(currentRoom.players.values())
        .every(p => currentRoom.readyPlayers.has(p.index));
      if (!allReady) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, 'all_ready_required') }));
        return;
      }

      currentRoom.phase = 'playing';
      applyRuntimeState(currentRoom, totalPlayers);
      // 麻将首局随机坐庄：不让房主默认当庄先摸牌先出牌
      if (currentRoom.game === 'mahjong-sichuan' || currentRoom.game === 'mahjong-cantonese') {
        currentRoom.state.dealerIndex = Math.floor(Math.random() * totalPlayers);
      }
      if (gameMod && gameMod.initGame) {
        gameMod.initGame(currentRoom.state, totalPlayers);
      }
      if (currentRoom.game === 'drawguess') scheduleDrawguessTimer(currentRoom); // 在广播前写入 stepDeadline

      ensureMatch(currentRoom, true);
      broadcastGameView(currentRoom, 'game_started');
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
      if (err) {
        ws.send(JSON.stringify({ type: 'error', message: serverT(currentRoom, err), code: err }));
        return;
      }

      skipDisconnectedTurn(currentRoom);

      // Clear 24-point round timer when a round ends via player submission
      if (currentRoom.game === 'twentyfour' && currentRoom.state.phase === 'round_end') {
        clearTimeout(currentRoom._tfTimer);
      }

      // drawguess: reset the step timer after every successful move (updates stepDeadline before broadcast)
      const isStageLiveAction = currentRoom.game === 'drawguess' && (data.type === 'stage_stroke' || data.type === 'stage_guess');
      if (currentRoom.game === 'drawguess' && !isStageLiveAction) scheduleDrawguessTimer(currentRoom);

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
      const totalPlayers = currentRoom.players.size + (currentRoom.bots ? currentRoom.bots.size : 0);

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
      currentRoom.state = gameMod.createState();
      applyRuntimeState(currentRoom, totalPlayers);

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

      if (currentRoom.game === 'drawguess') scheduleDrawguessTimer(currentRoom);
      currentRoom.phase = 'playing';
      ensureMatch(currentRoom, false);

      broadcastGameView(currentRoom, 'game_state');
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
            clearAllRoomTimers(currentRoom);
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
      applyRuntimeState(currentRoom, totalPlayers);
      // Generate new numbers (use the game module's function)
      gameRegistry['twentyfour'].initGame(state, totalPlayers);
      broadcastGameView(currentRoom, 'game_state');
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
            clearAllRoomTimers(currentRoom);
            rooms.delete(currentRoomId);
            return;
          }
          broadcastRoom(currentRoom, { type: 'player_left', players: roomPlayersList(currentRoom), phase: currentRoom.phase });
          if (currentRoom.phase === 'playing' && currentRoom.state && skipped) broadcastGameView(currentRoom);
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

module.exports = { server, getActivePort: () => activePort };
