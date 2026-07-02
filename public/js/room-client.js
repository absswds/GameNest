// public/js/room-client.js
(function() {
  const game = sessionStorage.getItem('game');
  const roomId = sessionStorage.getItem('roomId');
  const playerIndex = parseInt(sessionStorage.getItem('playerIndex'));
  const resumeToken = sessionStorage.getItem('resumeToken');
  const NO_AI_GAMES = new Set(['drawguess', 'minesweeper', 'suikabattle']);

  let ws, state, players, currentRenderer;
  let roomPhase = 'lobby';   // 'lobby' | 'ready' | 'playing'
  let isHost = false;
  let myReady = false;
  let terminalRoomError = false;
  let seatSwapFromIndex = null;

  document.getElementById('roomBadge').textContent = roomId;

  // ---- Game name lookup ----
  const gameNames = {
    tictactoe: { name: '井字棋', icon: '⚡' },
    gomoku: { name: '五子棋', icon: '◉' },
    davinci: { name: '达芬奇密码', icon: '🔢' },
    uno: { name: 'UNO', icon: '🃏' },
    doudizhu: { name: '斗地主', icon: '🂡' },
    'exploding-kittens': { name: '爆炸猫', icon: '💣' },
    rummikub: { name: '魔力桥', icon: '🧩' },
    twentyfour: { name: '24点', icon: '🔢' },
    minesweeper: { name: '扫雷竞速', icon: '💣' },
    numberbomb: { name: '数字炸弹', icon: '💣' },
    oldmaid: { name: '抽鬼牌', icon: '👻' },
    liarsbar: { name: '骗子酒馆', icon: '🤥' },
    bigtwo: { name: '大老二', icon: '🂡' },
    texas: { name: '德州扑克', icon: '🎰' },
    flightchess: { name: '飞行棋', icon: '✈️' },
    snakebattle: { name: '贪吃蛇大乱斗', icon: '🐍' },
    chinesechess: { name: '中国象棋', icon: '♟️' },
    go9: { name: '围棋9路', icon: '⚫' },
    monopoly: { name: '大富翁', icon: '🏦' },
    suikabattle: { name: '合成大西瓜', icon: '🍉' },
    sheeptile: { name: '羊了个羊', icon: '🐑' },
    drawguess: { name: '你画我猜', icon: '🎨' },
  };

  let roomOptions = {};
  let prevPlayerCount = 0;
  const gameInfo = (window.gameCatalog && window.gameCatalog.byId(game))
    || gameNames[game]
    || { name: game, icon: '?', subtitle: '', description: '', players: '', duration: '', category: '', tags: [], cover: '', maxPlayers: 4, supportsAI: !NO_AI_GAMES.has(game) };

  function notify(msg) {
    const bar = document.getElementById('notifyBar');
    if (!bar) return;
    bar.textContent = msg;
    bar.style.transform = 'translateY(0)';
    clearTimeout(bar._timer);
    bar._timer = setTimeout(function() {
      bar.style.transform = 'translateY(-100%)';
    }, 2500);
  }

  function clearExpiredRoomAndReturn() {
    terminalRoomError = true;
    ['roomId', 'playerIndex', 'game', 'resumeToken'].forEach(function(key) { sessionStorage.removeItem(key); });
    if (ws) { try { ws.close(); } catch (e) {} }
    window.location.replace('/?roomExpired=1');
  }

  function getSlotColor(index) {
    const colors = ['#1a1a1a', '#c8a45c', '#d4695a', '#5a9e6f'];
    return colors[index % colors.length];
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '';
  }

  function renderFacts(id, values) {
    const root = document.getElementById(id);
    if (!root) return;
    root.innerHTML = values.filter(Boolean).map(function(value) {
      return '<span>' + value + '</span>';
    }).join('');
  }

  function renderMetaPills(id, values) {
    const root = document.getElementById(id);
    if (!root) return;
    root.innerHTML = values.filter(Boolean).map(function(value) {
      return '<span class="meta-pill">' + value + '</span>';
    }).join('');
  }

  function renderCover() {
    const img = document.getElementById('waitingCoverImage');
    const fallback = document.getElementById('waitingCoverFallback');
    if (!img || !fallback) return;
    fallback.textContent = gameInfo.icon || '?';
    if (!gameInfo.cover) {
      img.style.display = 'none';
      fallback.style.display = 'flex';
      return;
    }
    img.onerror = function() {
      img.style.display = 'none';
      fallback.style.display = 'flex';
    };
    img.src = gameInfo.cover;
    img.style.display = '';
    fallback.style.display = 'none';
  }

  function seatSummary(index) {
    const player = players ? players.find(function(p) { return p.index === index; }) : null;
    if (!player) return { title: '空位', meta: '点这里换到这个位置' };
    const meta = [];
    if (player.isHost) meta.push('房主');
    if (player.isBot) meta.push('AI');
    if (!player.isBot) meta.push(player.ready ? '已准备' : '未准备');
    return { title: player.name, meta: meta.join(' · ') };
  }

  function openSeatSwapModal(fromIndex, maxSlots) {
    seatSwapFromIndex = fromIndex;
    const modal = document.getElementById('seatSwapModal');
    const grid = document.getElementById('seatSwapGrid');
    const hint = document.getElementById('seatSwapHint');
    if (!modal || !grid || !hint) return;

    const origin = seatSummary(fromIndex);
    hint.textContent = '把 ' + (fromIndex + 1) + ' 号位「' + origin.title + '」换到哪里？';
    grid.innerHTML = '';

    for (let i = 0; i < maxSlots; i++) {
      const summary = seatSummary(i);
      const btn = document.createElement('button');
      btn.className = 'seat-swap-option' + (i === fromIndex ? ' current' : '');
      btn.dataset.seatIndex = String(i);
      btn.disabled = i === fromIndex;
      btn.innerHTML =
        '<div class="seat-swap-slot">位置 ' + (i + 1) + '</div>' +
        '<div class="seat-swap-player">' + summary.title + '</div>' +
        '<div class="seat-swap-tags">' + summary.meta + '</div>';
      btn.addEventListener('click', function() {
        const toIdx = parseInt(this.dataset.seatIndex, 10);
        if (Number.isNaN(toIdx) || toIdx === seatSwapFromIndex) return;
        ws.send(JSON.stringify({ type: 'swap_seat', data: { fromIndex: seatSwapFromIndex, toIndex: toIdx } }));
        closeSeatSwapModal();
      });
      grid.appendChild(btn);
    }

    modal.style.display = 'flex';
  }

  function closeSeatSwapModal() {
    const modal = document.getElementById('seatSwapModal');
    if (modal) modal.style.display = 'none';
    seatSwapFromIndex = null;
  }

  function getSocketURL() {
    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return protocol + location.host;
  }

  function updateSharedShell() {
    setText('activeGameName', gameInfo.name);
    setText('activeGameSubtitle', gameInfo.subtitle || '等待玩家加入');
    setText('stageGameName', gameInfo.name);
    setText('waitingGameName', gameInfo.name);
    setText('waitingGameSubtitle', gameInfo.description || gameInfo.subtitle || '');
    setText('stageRoomFacts', '房间 ' + roomId + ' · ' + (gameInfo.supportsAI ? '可加 AI' : '纯玩家对战'));
    renderMetaPills('waitingMeta', [gameInfo.category, gameInfo.players, gameInfo.duration]);
    renderFacts('waitingFacts', [gameInfo.players, gameInfo.duration, gameInfo.supportsAI ? '支持 AI' : '纯 PvP']);
    renderFacts('stageMeta', [gameInfo.category, gameInfo.players, gameInfo.duration]);
    renderCover();
  }

  // ---- WebSocket ----
  function connect() {
    if (ws) { try { ws.close(); } catch(e) {} }
    ws = new WebSocket(getSocketURL());
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join_room', data: { roomId, resumeToken } }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      // room_joined / room_created (initial connection)
      if (msg.type === 'room_joined' || msg.type === 'room_created') {
        state = msg.state || state;
        players = msg.players || players;
        window._players = players;
        roomPhase = msg.phase || 'lobby';
        if (msg.options) roomOptions = msg.options;
        if (msg.resumeToken) sessionStorage.setItem('resumeToken', msg.resumeToken);
        updateWaitingRoom();
        if (roomPhase === 'playing') {
          showGame();
          renderGame();
        }
      }

      // game_state
      if (msg.type === 'game_state') {
        // Detect game restart: winner was set, now cleared
        if (state && state.winner != null && msg.state &&
            (msg.state.winner === null || msg.state.winner === undefined)) {
          currentRenderer = null;
          const container = document.getElementById('boardArea');
          if (container) container.innerHTML = '';
        }
        state = msg.state || state;
        players = msg.players || players;
        window._players = players;
        roomPhase = 'playing';
        showGame();
        updatePlayerBar();
        renderGame();
      }

      // game_started
      if (msg.type === 'game_started') {
        state = msg.state;
        players = msg.players;
        window._players = players;
        roomPhase = 'playing';
        showGame();
        updatePlayerBar();
        renderGame();
        document.getElementById('status').textContent = '';
      }

      // room_update (lobby state change)
      if (msg.type === 'room_update') {
        players = msg.players || players;
        roomPhase = msg.phase || roomPhase;
        if (msg.options) roomOptions = msg.options;
        updateWaitingRoom();
      }

      // player_joined / player_left
      if (msg.type === 'player_joined' || msg.type === 'player_left') {
        const newCount = (msg.players || players || []).length;
        const humanPlayers = (msg.players || []).filter(function(p) { return !p.isBot; });

        if (msg.type === 'player_joined' && newCount > prevPlayerCount) {
          const latest = humanPlayers[humanPlayers.length - 1];
          if (latest && latest.index !== playerIndex) {
            notify('👋 ' + latest.name + ' 加入了房间');
          }
        } else if (msg.type === 'player_left') {
          if (newCount < prevPlayerCount) {
            notify('🚪 有人离开了房间');
          }
        }
        prevPlayerCount = newCount;
        players = msg.players || players;
        roomPhase = msg.phase || roomPhase;
        if (roomPhase === 'playing') {
          showGame();
          updatePlayerBar();
          renderGame();
        } else {
          updateWaitingRoom();
        }
        if (msg.type === 'player_left') {
          document.getElementById('status').textContent = '对手离开了，等待中...';
          document.getElementById('overlay').style.display = 'none';
        }
      }

      // Error
      if (msg.type === 'error') {
        if (msg.code === 'ROOM_NOT_FOUND' || (!state && /房间不存在|房间已结束/.test(msg.message || ''))) {
          clearExpiredRoomAndReturn();
          return;
        }
        const ws2 = document.getElementById('waitingStatus');
        if (ws2) {
          ws2.textContent = msg.message;
          setTimeout(() => {
            if (document.getElementById('waitingStatus'))
              document.getElementById('waitingStatus').textContent = '';
          }, 3000);
        }
        // Let the active game renderer surface the error in-board (e.g. 24-point computed result)
        if (typeof window._gameErrorHandler === 'function') window._gameErrorHandler(msg.message);
      }
    };
    ws.onclose = () => {
      if (!terminalRoomError) setTimeout(connect, 1500);
    };
    ws.onerror = () => {};
  }

  // ---- UI Toggle ----
  function showGame() {
    document.getElementById('waitingRoom').style.display = 'none';
    document.getElementById('profileEdit').style.display = 'none';
    document.getElementById('emojiRow').style.display = 'none';
    document.getElementById('gameStage').style.display = '';
    document.getElementById('playerBar').style.display = '';
    document.getElementById('status').style.display = '';
    document.getElementById('gameActions').style.display = '';
  }

  function showLobby() {
    document.getElementById('waitingRoom').style.display = '';
    document.getElementById('profileEdit').style.display = 'flex';
    document.getElementById('emojiRow').style.display = '';
    document.getElementById('gameStage').style.display = 'none';
    // Generate QR code via server endpoint (server uses LAN IP)
    var qrImg = document.getElementById('qrImage');
    if (qrImg && roomId) {
      qrImg.src = '/qr?room=' + roomId;
    }
    var qrCode = document.getElementById('qrRoomCode');
    if (qrCode && roomId) qrCode.textContent = roomId;
    document.getElementById('playerBar').style.display = 'none';
    document.getElementById('status').style.display = 'none';
    document.getElementById('gameActions').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
  }

  // ---- Waiting Room ----
  function updateWaitingRoom() {
    if (roomPhase === 'playing') {
      showGame();
      return;
    }
    showLobby();

    // Update shared shell copy
    updateSharedShell();

    // Check host status
    const myInfo = players ? players.find(p => p.index === playerIndex && !p.isBot) : null;
    isHost = myInfo ? myInfo.isHost : false;
    myReady = myInfo ? myInfo.ready : false;

    // Profile: name + avatar
    var avatarEmoji = document.getElementById('avatarEmoji');
    var nameInput = document.getElementById('nameInput');
    var emojiRow = document.getElementById('emojiRow');
    if (myInfo) {
      if (avatarEmoji) avatarEmoji.textContent = myInfo.avatar || '😊';
      if (nameInput && nameInput !== document.activeElement) nameInput.value = myInfo.name || '';
    }

    // Build emoji grid once
    if (emojiRow && !emojiRow.dataset.built) {
      var emojis = ['😊','😂','🤣','😍','😎','🤩','😇','🤠','💀','👻','🎃','🤖','👾','🐱','🐶','🦊','🐼','🐸','🦄','🐙','🌈','⭐','🔥','❤️','🍕','🎸','⚽','🚀','🎯','💰','🧩','🎲','🃏','🏆','💣','🔮','🎨','🍀','🌻','🐉','🍄','💎','👑','💪','🎉','🦖','🦝','🐒','🐳'];
      for (var e = 0; e < emojis.length; e++) {
        (function(emoji) {
          var btn = document.createElement('button');
          btn.textContent = emoji;
          btn.className = 'emoji-btn';
          btn.addEventListener('click', function() {
            if (avatarEmoji) avatarEmoji.textContent = emoji;
            emojiRow.querySelectorAll('.emoji-btn').forEach(function(b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            ws.send(JSON.stringify({ type: 'set_avatar', data: { avatar: emoji } }));
            if (window.closeAvatarDrawer) window.closeAvatarDrawer();
          });
          emojiRow.appendChild(btn);
        })(emojis[e]);
      }
      emojiRow.dataset.built = '1';
    }

    // Mark current avatar as selected in the grid
    if (emojiRow && myInfo && myInfo.avatar) {
      emojiRow.querySelectorAll('.emoji-btn').forEach(function(b) {
        b.classList.toggle('selected', b.textContent === myInfo.avatar);
      });
    }

    // Name input → send on change
    if (nameInput) {
      nameInput.onchange = function() {
        var val = nameInput.value.trim();
        if (val && val.length > 0) {
          ws.send(JSON.stringify({ type: 'set_name', data: { name: val } }));
        }
      };
    }

    // Determine max slots
    const defaultSlots = gameInfo.maxPlayers || (game === 'doudizhu' ? 3 : game === 'tictactoe' || game === 'gomoku' || game === 'chinesechess' || game === 'go9' ? 2 : game === 'twentyfour' ? 6 : 4);
    const maxSlots = players && players.length > 0
      ? Math.max(players.length, defaultSlots)
      : defaultSlots;

    // Build slots
    const slots = document.getElementById('waitingSlots');
    let html = '';
    for (let i = 0; i < maxSlots; i++) {
      const player = players ? players.find(p => p.index === i) : null;
      if (player) {
        const isMe = player.index === playerIndex && !player.isBot;
        const meClass = isMe ? ' me' : '';
        const botClass = player.isBot ? ' ai' : '';
        let tagsHtml = '';
        if (player.isHost) tagsHtml += '<span class="waiting-slot-badge host">👑 房主</span>';
        if (player.isBot) {
          tagsHtml += '<span class="waiting-slot-badge ai">🤖 AI</span>';
        } else if (player.ready) {
          tagsHtml += '<span class="waiting-slot-badge ready">✓ 已准备</span>';
        } else {
          tagsHtml += '<span class="waiting-slot-badge">未准备</span>';
        }
        html +=
          '<div class="waiting-slot occupied' + meClass + '">' +
            '<div class="waiting-slot-avatar" style="background:' + getSlotColor(i) + '">' +
              (player.avatar || (player.isBot ? '🤖' : '😊')) +
            '</div>' +
            '<div class="waiting-slot-info">' +
              '<div class="waiting-slot-name">' + player.name + (isMe ? ' (你)' : '') + '</div>' +
              '<div class="waiting-slot-tags">' + tagsHtml + '</div>' +
            '</div>' +
            '<button class="waiting-slot-swap" data-from="' + i + '" title="换位">⇅</button>' +
          '</div>';
      } else {
        html +=
          '<div class="waiting-slot empty">' +
            '<div class="waiting-slot-avatar" style="background:#bbb">' + (i + 1) + '</div>' +
            '<div class="waiting-slot-info">' +
              '<div class="waiting-slot-name" style="color:var(--text-muted)">等待加入...</div>' +
            '</div>' +
          '</div>';
      }
    }
    slots.innerHTML = html;

    // Attach swap handlers
    slots.querySelectorAll('.waiting-slot-swap').forEach(btn => {
      btn.addEventListener('click', function() {
        const from = parseInt(this.dataset.from, 10);
        openSeatSwapModal(from, maxSlots);
      });
    });

    // ---- Game Options (host-only settings) ----
    var optionsEl = document.getElementById('gameOptions');
    if (optionsEl) {
      // Twentyfour: round time option
      if (isHost && game === 'twentyfour') {
        optionsEl.style.display = 'block';
        var rt = roomOptions.roundTime || 0;
        var mr = roomOptions.maxRounds || 5;
        var opts = '';
        [0, 30, 60, 90, 120].forEach(function(t) {
          opts += '<option value="' + t + '"' + (rt === t ? ' selected' : '') + '>' + (t === 0 ? '不限时' : t + '秒') + '</option>';
        });
        var mrOpts = '';
        [3, 5, 7, 10].forEach(function(n) {
          mrOpts += '<option value="' + n + '"' + (mr === n ? ' selected' : '') + '>' + n + '轮</option>';
        });
        optionsEl.innerHTML =
          '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">游戏设置</div>' +
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;margin-bottom:6px;">' +
            '每轮限时: <select id="optRoundTime" onchange="window._setGameOption(\'roundTime\', parseInt(this.value))" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:14px;">' +
              opts +
            '</select>' +
          '</label>' +
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;">' +
            '获胜回合: <select id="optMaxRounds" onchange="window._setGameOption(\'maxRounds\', parseInt(this.value))" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:14px;">' +
              mrOpts +
            '</select>' +
          '</label>';
      } else if (game === 'twentyfour') {
        optionsEl.style.display = 'block';
        var rt2 = roomOptions.roundTime || 0;
        var mr2 = roomOptions.maxRounds || 5;
        optionsEl.innerHTML =
          '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">游戏设置</div>' +
          '<div style="font-size:13px;color:var(--text-muted)">每轮限时: ' + (rt2 === 0 ? '不限时' : rt2 + '秒') + '・获胜回合: ' + mr2 + '轮</div>';
      } else if (isHost && game === 'rummikub') {
        optionsEl.style.display = 'block';
        var breakOn = roomOptions.requireBreak !== false; // default true
        optionsEl.innerHTML =
          '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">游戏设置</div>' +
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;">' +
            '<input type="checkbox" id="optRequireBreak" ' + (breakOn ? 'checked' : '') + ' onchange="window._setGameOption(\'requireBreak\', this.checked)">' +
            '需要破冰（首次出牌 ≥ 30分）' +
          '</label>';
      } else if (game === 'rummikub') {
        optionsEl.style.display = 'block';
        var breakOn2 = roomOptions.requireBreak !== false;
        optionsEl.innerHTML =
          '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">游戏设置</div>' +
          '<div style="font-size:13px;color:var(--text-muted)">破冰: ' + (breakOn2 ? '需要 ≥30分' : '关闭') + '</div>';
      } else if (game === 'sheeptile') {
        optionsEl.style.display = 'block';
        var sameBoard = roomOptions.sameBoard !== false; // 默认同一张棋盘
        if (isHost) {
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">游戏设置</div>' +
            '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;">' +
              '<input type="checkbox" id="optSameBoard" ' + (sameBoard ? 'checked' : '') + ' onchange="window._setGameOption(\'sameBoard\', this.checked)">' +
              '所有人同一张棋盘（公平竞速）' +
            '</label>' +
            '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">关闭则每人随机各自的棋盘</div>';
        } else {
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">游戏设置</div>' +
            '<div style="font-size:13px;color:var(--text-muted)">棋盘: ' + (sameBoard ? '同一张（公平竞速）' : '各自随机') + '</div>';
        }
      } else if (game === 'drawguess') {
        optionsEl.style.display = 'block';
        var dgCats = [['animal','动物'],['food','食物'],['daily','日常物品'],['action','动作'],['place','场景'],['idiom','成语俗语'],['movie','影视动漫游戏'],['internet','网络热词']];
        var selCats = Array.isArray(roomOptions.categories) && roomOptions.categories.length > 0
          ? roomOptions.categories : dgCats.map(function(c){ return c[0]; });
        var dgDraw = roomOptions.drawTime !== undefined ? roomOptions.drawTime : 90;
        var dgGuess = roomOptions.guessTime !== undefined ? roomOptions.guessTime : 45;
        var dgChoices = roomOptions.wordChoices !== undefined ? roomOptions.wordChoices : 3;
        var dgMode = roomOptions.mode || 'stage';
        if (isHost) {
          var catHtml = '';
          dgCats.forEach(function(c) {
            var on = selCats.indexOf(c[0]) >= 0;
            catHtml += '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;margin:2px 8px 2px 0;">' +
              '<input type="checkbox" class="dg-cat" value="' + c[0] + '"' + (on ? ' checked' : '') + ' onchange="window._dgCollectCats()">' + c[1] + '</label>';
          });
          var selStyle = 'background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:14px;';
          function dgSel(id, key, values, labels, cur) {
            var h = '<select id="' + id + '" onchange="window._setGameOption(\'' + key + '\', parseInt(this.value))" style="' + selStyle + '">';
            values.forEach(function(v, i) { h += '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + labels[i] + '</option>'; });
            return h + '</select>';
          }
          var customVal = (roomOptions.customWords || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">游戏设置</div>' +
            '<div style="font-size:13px;margin-bottom:8px;">玩法 <select onchange="window._setGameOption(\'mode\', this.value)" style="' + selStyle + '"><option value="stage"' + (dgMode === 'stage' ? ' selected' : '') + '>舞台猜词（实时）</option><option value="whisper"' + (dgMode === 'whisper' ? ' selected' : '') + '>悄悄话传画</option></select></div>' +
            '<div style="font-size:13px;margin-bottom:6px;">词库分类：<br>' + catHtml + '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:14px;margin-bottom:6px;">' +
              '<label style="display:flex;align-items:center;gap:6px;">画画限时 ' + dgSel('optDgDraw', 'drawTime', [45,60,90,120,0], ['45秒','60秒','90秒','120秒','不限时'], dgDraw) + '</label>' +
              '<label style="display:flex;align-items:center;gap:6px;">猜词限时 ' + dgSel('optDgGuess', 'guessTime', [30,45,60,90,0], ['30秒','45秒','60秒','90秒','不限时'], dgGuess) + '</label>' +
              '<label style="display:flex;align-items:center;gap:6px;">候选词数 ' + dgSel('optDgChoices', 'wordChoices', [1,2,3,5], ['1个(直接给词)','2个','3个','5个'], dgChoices) + '</label>' +
            '</div>' +
            '<div style="font-size:13px;">自定义词（逗号或换行分隔，会并入词库）：<br>' +
              '<textarea id="optDgCustom" rows="2" style="width:100%;margin-top:4px;border:1px solid var(--border);border-radius:8px;padding:6px;font-size:13px;box-sizing:border-box;" placeholder="例：螺蛳粉, 显眼包, 公司团建">' + customVal + '</textarea>' +
              '<button class="btn" style="margin-top:4px;padding:4px 14px;font-size:13px;" onclick="window._setGameOption(\'customWords\', document.getElementById(\'optDgCustom\').value)">保存自定义词</button>' +
            '</div>';
        } else {
          var catNames = dgCats.filter(function(c){ return selCats.indexOf(c[0]) >= 0; }).map(function(c){ return c[1]; }).join('、');
          var customCount = (roomOptions.customWords || '').split(/[,，\n\s]+/).filter(function(w){ return w.trim(); }).length;
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">游戏设置</div>' +
            '<div style="font-size:13px;color:var(--text-muted)">玩法: ' + (dgMode === 'stage' ? '舞台猜词（实时）' : '悄悄话传画') + ' · 词库: ' + catNames +
            '・画 ' + (dgDraw === 0 ? '不限时' : dgDraw + '秒') + '・猜 ' + (dgGuess === 0 ? '不限时' : dgGuess + '秒') +
            '・候选 ' + dgChoices + ' 词' + (customCount > 0 ? '・自定义词 ' + customCount + ' 个' : '') + '</div>';
        }
      } else {
        optionsEl.style.display = 'none';
      }
    }

    // Toggle action buttons
    const readyBtn = document.getElementById('readyBtn');
    const startBtn = document.getElementById('startGameBtn');
    const addBotBtn = document.getElementById('addBotBtn');
    const waitingStatus = document.getElementById('waitingStatus');

    // Ready button
    if (readyBtn) {
      readyBtn.style.display = '';
      if (myReady) {
        readyBtn.textContent = '取消准备';
        readyBtn.classList.add('ready-active');
      } else {
        readyBtn.textContent = '准备';
        readyBtn.classList.remove('ready-active');
      }
      readyBtn.onclick = function() {
        ws.send(JSON.stringify({ type: 'player_ready' }));
        myReady = !myReady;
        // Optimistic update
        if (players) {
          const me = players.find(p => p.index === playerIndex && !p.isBot);
          if (me) me.ready = myReady;
        }
        updateWaitingRoom();
      };
    }

    // Start game button (host only)
    if (startBtn) {
      startBtn.style.display = isHost ? '' : 'none';
      if (isHost) {
        const allReady = players && players.filter(p => !p.isBot).every(p => p.ready);
        const totalPlayers = players ? players.length : 0;
        const minPlayers = (game === 'suikabattle' || game === 'drawguess') ? 1 : 2;
        const canStart = allReady && totalPlayers >= minPlayers;
        startBtn.disabled = !canStart;
        startBtn.classList.toggle('disabled', !canStart);
      }
      startBtn.onclick = function() {
        ws.send(JSON.stringify({ type: 'start_game' }));
      };
    }

    // Add bot button (host only)
    if (addBotBtn) {
      const supportsAI = gameInfo.supportsAI !== undefined ? gameInfo.supportsAI : !NO_AI_GAMES.has(game);
      addBotBtn.style.display = isHost && supportsAI ? '' : 'none';
      const totalOccupied = players ? players.length : 0;
      const roomFull = totalOccupied >= maxSlots;
      addBotBtn.disabled = roomFull;
      addBotBtn.classList.toggle('disabled', roomFull);
      addBotBtn.onclick = function() {
        ws.send(JSON.stringify({ type: 'add_bot' }));
      };
    }

    // Status text
    if (waitingStatus) {
      const allReady = players && players.filter(p => !p.isBot).every(p => p.ready);
      const totalPlayers = players ? players.length : 0;
      if (allReady && totalPlayers >= 2) {
        waitingStatus.textContent = isHost ? '所有玩家已准备，可以开始！' : '等待房主开始游戏...';
      } else {
        waitingStatus.textContent = '等待所有玩家准备...';
      }
    }
  }

  // ---- Player Bar (during game) ----
  function updatePlayerBar() {
    const bar = document.getElementById('playerBar');
    bar.innerHTML = '';
    if (!players) return;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const tag = document.createElement('div');
      tag.className = 'player-tag p' + p.index;
      if (state && state.currentPlayer === p.index) tag.classList.add('active');
      tag.innerHTML = '<span class="dot"></span><span>' + p.name + (p.isBot ? ' 🤖' : '') + '</span>';
      bar.appendChild(tag);
      if (i < players.length - 1) {
        const vs = document.createElement('span');
        vs.className = 'vs-text'; vs.textContent = 'VS'; bar.appendChild(vs);
      }
    }
    if (!state || state.winner == null) {
      const st = document.getElementById('status');
      st.classList.remove('my-turn');
      if (players.length < 2) st.textContent = '等待玩家加入...';
      else if (state && state.currentPlayer === playerIndex) {
        st.textContent = '轮到你了';
        st.classList.add('my-turn');
      }
      else if (state) st.textContent = '对手回合';
    }
  }

  // Global helper: get a player's display name by index (falls back to 玩家N)
  window.getPlayerName = function(idx) {
    if (window.gamePlayers && window.gamePlayers[idx] && window.gamePlayers[idx].name) {
      return window.gamePlayers[idx].name;
    }
    return '玩家' + (idx + 1);
  };

  // ---- Game Rendering ----
  function renderGame() {
    if (!state) return;
    if (!currentRenderer) {
      currentRenderer = window.gameRenderers.get(game);
      const container = document.getElementById('boardArea');
      container.innerHTML = '';
      if (currentRenderer && currentRenderer.init) currentRenderer.init(container);
    }
    window.gamePlayers = players;
    if (currentRenderer) currentRenderer.render(state, document.getElementById('boardArea'), playerIndex, state.winner);
    if (state.winner !== null && state.winner !== undefined) showResult(state.winner);
  }

  function showResult(winner) {
    const overlay = document.getElementById('overlay');
    const resultEl = document.getElementById('resultText');
    let txt, sub, isWin = false;
    if (winner === -1) {
      txt = '平局！'; sub = '不分胜负';
    } else if (game === 'doudizhu' && state) {
      // Doudizhu uses team-based winner sentinels
      if (winner === -2) {
        // Landlord team wins
        isWin = (playerIndex === state.landlord);
        txt = isWin ? '你赢了！' : '你输了';
        sub = isWin ? '地主胜利' : '农民获胜';
      } else if (winner === -3) {
        // Farmers win
        isWin = (playerIndex !== state.landlord);
        txt = isWin ? '你赢了！' : '你输了';
        sub = isWin ? '农民胜利' : '地主获胜';
      } else {
        isWin = (winner === playerIndex);
        txt = isWin ? '你赢了！' : '你输了'; sub = '';
      }
    } else {
      isWin = (winner === playerIndex);
      txt = isWin ? '你赢了！' : '你输了'; sub = '';
    }
    resultEl.textContent = txt;
    resultEl.classList.toggle('win-text', isWin);
    document.getElementById('resultSub').textContent = sub;
    overlay.style.display = 'flex';
    const st = document.getElementById('status');
    st.classList.remove('my-turn');
    st.textContent = isWin ? '你赢了！' : winner === -1 ? '平局' : '对手赢了';
  }

  window.makeGameMove = function(data) {
    ws.send(JSON.stringify({ type: 'game_move', data }));
  };

  window.doRestart = function() {
    document.getElementById('overlay').style.display = 'none';
    ws.send(JSON.stringify({ type: 'game_restart' }));
  };

  window.doReturnToRoom = function() {
    document.getElementById('overlay').style.display = 'none';
    ws.send(JSON.stringify({ type: 'return_to_room' }));
  };

  window.doLeaveRoom = function() {
    window.location.href = '/';
  };

  window.openAvatarDrawer = function() {
    var d = document.getElementById('avatarDrawer');
    if (d) d.style.display = 'flex';
  };

  window.closeAvatarDrawer = function() {
    var d = document.getElementById('avatarDrawer');
    if (d) d.style.display = 'none';
  };
  window.closeSeatSwapModal = closeSeatSwapModal;

  window._sendNextRound = function() {
    ws.send(JSON.stringify({ type: 'next_round' }));
  };

  window._setGameOption = function(key, value) {
    roomOptions[key] = value;
    ws.send(JSON.stringify({ type: 'set_option', data: { key, value } }));
  };

  // drawguess: 收集勾选的词库分类（数组直接作为 option value 保存）
  window._dgCollectCats = function() {
    var arr = [];
    document.querySelectorAll('.dg-cat:checked').forEach(function(cb) { arr.push(cb.value); });
    window._setGameOption('categories', arr);
  };

  // ---- Init ----
  if (!roomId || !game) clearExpiredRoomAndReturn();
  else connect();

  // Show lobby initially (will update when room_joined arrives)
  showLobby();
})();
