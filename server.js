const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const os = require('os');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.PORT) || 3000;
const MAX_PORT_RETRIES = 5;

// Load game registry
const gameRegistry = Object.create(null);
const gamesDir = path.join(__dirname, 'games');
fs.readdirSync(gamesDir).forEach(file => {
  if (file.endsWith('.js')) {
    const mod = require(path.join(gamesDir, file));
    gameRegistry[mod.name] = mod;
  }
});

// Load bot registry
const botRegistry = Object.create(null);
const botsDir = path.join(__dirname, 'bots');
if (fs.existsSync(botsDir)) {
  fs.readdirSync(botsDir).forEach(file => {
    if (file.endsWith('.js')) {
      const mod = require(path.join(botsDir, file));
      botRegistry[mod.name] = mod;
    }
  });
}

const QRCode = require('qrcode');

const app = express();
// Always revalidate static assets so clients never run a stale cached HTML/CSS/JS.
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  },
}));

// QR code endpoint — generates QR with LAN IP
app.get('/qr', async (req, res) => {
  try {
    const room = req.query.room;
    if (!room) { res.status(400).send('missing room'); return; }
    // Use LAN IP instead of localhost
    const ips = getLanIPs();
    const lanIP = ips.length > 0 ? ips[0].ip : req.hostname;
    const url = `http://${lanIP}:${PORT}/?room=${room}`;
    const png = await QRCode.toBuffer(url, { width: 256, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' } });
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    res.status(500).send('qr error');
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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

function createRoom(ws, gameType) {
  const gameMod = gameRegistry[gameType];
  if (!gameMod) { return null; }
  const roomId = generateRoomId();
  const room = {
    game: gameType,
    maxPlayers: gameMod.maxPlayers,
    players: new Map(),
    bots: new Map(),
    state: gameMod.createState(),
    hostWS: ws,
    _roomId: roomId,
    _cleanupTimer: null,
    _botTimer: null,
    // Lobby phase system
    phase: 'lobby',            // 'lobby' | 'ready' | 'playing'
    readyPlayers: new Set(),   // Set of player indices that are ready
    options: {},               // Game-specific options (e.g. requireBreak)
  };
  room.players.set(ws, { name: '玩家 1', index: 0, avatar: '😊' });
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
  for (const [, info] of room.players) {
    const isHost = room.players.get(room.hostWS) === info;
    list.push({
      name: info.name,
      index: info.index,
      isBot: false,
      avatar: info.avatar || '😊',
      ready: room.readyPlayers.has(info.index),
      isHost,
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

function scheduleTwentyFourBots(room) {
  if (!room.bots || room.bots.size === 0) return;
  for (const [idx, bot] of room.bots) {
    const delay = 500 + Math.random() * 400; // 0.5~0.9s — feel human but actually fast
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

function scheduleBotMove(room) {
  if (!room || !room.state) return;
  const state = room.state;
  if (state.winner !== null && state.winner !== undefined) return;

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

  const gameMod = gameRegistry[room.game];
  if (!gameMod) return;

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
      broadcastRoom(room, { type: 'game_state', state: room.state, players: roomPlayersList(room) });
      scheduleBotMove(room);
    } catch(e) { console.error('Bot exception:', e.message); }
  }, delay);
}

// ---- WebSocket Handler ----

wss.on('connection', (ws) => {
  ws.on('error', () => {});
  let currentRoomId = null;
  let currentRoom = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    const { type, data } = msg;

    // --- create_room ---
    if (type === 'create_room') {
      const { game } = data || {};
      if (!gameRegistry[game]) {
        ws.send(JSON.stringify({ type: 'error', message: '无效的游戏类型' }));
        return;
      }
      const result = createRoom(ws, game);
      if (!result) {
        ws.send(JSON.stringify({ type: 'error', message: '创建房间失败' }));
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
      }));
      return;
    }

    // --- add_bot ---
    if (type === 'add_bot') {
      if (!currentRoom) return;
      if (ws !== currentRoom.hostWS) {
        ws.send(JSON.stringify({ type: 'error', message: '只有房主可以添加AI' }));
        return;
      }
      if (currentRoom.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: '游戏已开始，不能添加AI' }));
        return;
      }
      const botMod = botRegistry[currentRoom.game];
      if (!botMod) {
        ws.send(JSON.stringify({ type: 'error', message: '该游戏不支持AI' }));
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
        ws.send(JSON.stringify({ type: 'error', message: '房间已满' }));
        return;
      }
      const bot = botMod.createBot(botIndex);
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
      const { roomId } = data || {};
      const room = rooms.get(roomId);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }));
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
        }));
        return;
      }
      // Clean up stale connections (WS closed but close event hasn't fired yet)
      for (const [w, info] of room.players) {
        if (w.readyState !== 1) {
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
        ws.send(JSON.stringify({ type: 'error', message: '房间已满' }));
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
        ws.send(JSON.stringify({ type: 'error', message: '房间已满' }));
        return;
      }
      room.players.set(ws, { name: `玩家 ${idx + 1}`, index: idx, avatar: '😊' });
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
        ws.send(JSON.stringify({ type: 'error', message: '游戏已经开始' }));
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
        ws.send(JSON.stringify({ type: 'error', message: '只有房主可以开始游戏' }));
        return;
      }
      if (currentRoom.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: '游戏已经开始' }));
        return;
      }
      const totalPlayers = currentRoom.players.size + (currentRoom.bots ? currentRoom.bots.size : 0);
      if (totalPlayers < 2) {
        ws.send(JSON.stringify({ type: 'error', message: '至少需要2名玩家' }));
        return;
      }
      const allReady = Array.from(currentRoom.players.values())
        .every(p => currentRoom.readyPlayers.has(p.index));
      if (!allReady) {
        ws.send(JSON.stringify({ type: 'error', message: '所有玩家就绪后才能开始' }));
        return;
      }

      currentRoom.phase = 'playing';
      currentRoom.state._playerCount = totalPlayers;
      currentRoom.state._options = { ...currentRoom.options };

      // Init game state if the game module supports it
      const gameMod = gameRegistry[currentRoom.game];
      if (gameMod && gameMod.initGame) {
        gameMod.initGame(currentRoom.state, totalPlayers);
      }

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
      } else {
        broadcastRoom(currentRoom, {
          type: 'game_started',
          state: currentRoom.state,
          players: roomPlayersList(currentRoom),
        });
      }
      if (currentRoom.game === 'twentyfour') scheduleTwentyFourTimer(currentRoom);
      scheduleBotMove(currentRoom);
      return;
    }

    // --- swap_seat ---
    if (type === 'swap_seat') {
      if (!currentRoom) return;
      if (currentRoom.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: '游戏已经开始，不能换位' }));
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
      if (fromReady) currentRoom.readyPlayers.delete(fromIndex); else currentRoom.readyPlayers.add(fromIndex);
      if (toReady) currentRoom.readyPlayers.delete(toIndex); else currentRoom.readyPlayers.add(toIndex);

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
      return;
    }

    // --- set_option ---
    if (type === 'set_option') {
      if (!currentRoom) return;
      if (ws !== currentRoom.hostWS) {
        ws.send(JSON.stringify({ type: 'error', message: '只有房主可以修改设置' }));
        return;
      }
      if (currentRoom.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: '游戏已开始，不能修改设置' }));
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

      // Clear 24-point round timer when a round ends via player submission
      if (currentRoom.game === 'twentyfour' && currentRoom.state.phase === 'round_end') {
        clearTimeout(currentRoom._tfTimer);
      }

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
        ws.send(JSON.stringify({ type: 'error', message: '只有房主可以重新开局' }));
        return;
      }
      const gameMod = gameRegistry[currentRoom.game];
      if (!gameMod) return;
      const totalPlayers = currentRoom.players.size + (currentRoom.bots ? currentRoom.bots.size : 0);
      currentRoom.state = gameMod.createState();
      currentRoom.state._playerCount = totalPlayers;
      currentRoom.state._options = { ...currentRoom.options };
      if (gameMod && gameMod.initGame) {
        gameMod.initGame(currentRoom.state, totalPlayers);
      }
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
      } else {
        broadcastRoom(currentRoom, {
          type: 'game_state',
          state: currentRoom.state,
          players: roomPlayersList(currentRoom),
        });
      }
      if (currentRoom.game === 'twentyfour') scheduleTwentyFourTimer(currentRoom);
      scheduleBotMove(currentRoom);
      return;
    }

    // --- return_to_room ---
    if (type === 'return_to_room') {
      if (!currentRoom) return;
      currentRoom.phase = 'lobby';
      currentRoom.readyPlayers = new Set();
      currentRoom.state = null;
      clearTimeout(currentRoom._tfTimer);
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
      currentRoom.players.delete(ws);
      // Clean up ready state for departed player
      const remainingIndices = new Set(
        Array.from(currentRoom.players.values()).map(p => p.index)
      );
      for (const idx of currentRoom.readyPlayers) {
        if (!remainingIndices.has(idx)) currentRoom.readyPlayers.delete(idx);
      }
      // Transfer host if needed
      if (ws === currentRoom.hostWS && currentRoom.players.size > 0) {
        currentRoom.hostWS = currentRoom.players.keys().next().value;
      }
      if (currentRoom.players.size === 0) {
        if (currentRoom._botTimer) clearTimeout(currentRoom._botTimer);
        if (currentRoom._tfTimer) clearTimeout(currentRoom._tfTimer);
        if (currentRoom._cleanupTimer) clearTimeout(currentRoom._cleanupTimer);
        currentRoom._cleanupTimer = setTimeout(() => {
          rooms.delete(currentRoomId);
        }, 60000);
      } else {
        currentRoom.state = gameRegistry[currentRoom.game].createState();
        currentRoom.readyPlayers.clear();
        currentRoom.phase = 'lobby';
        broadcastRoom(currentRoom, {
          type: 'player_left',
          players: roomPlayersList(currentRoom),
          phase: currentRoom.phase,
        });
      }
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

function startServer(port, attempt = 0) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_RETRIES) {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      setTimeout(() => startServer(port + 1, attempt + 1), 200);
    } else {
      console.error('Server error:', err.message);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const lanIPs = getLanIPs();

    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║    🎲  Local Games Server           ║');
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
  });
}

startServer(PORT);
