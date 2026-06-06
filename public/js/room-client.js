// public/js/room-client.js
(function() {
  const game = sessionStorage.getItem('game');
  const roomId = sessionStorage.getItem('roomId');
  const playerIndex = parseInt(sessionStorage.getItem('playerIndex'));

  let ws, state, players, currentRenderer;
  let roomPhase = 'lobby';   // 'lobby' | 'ready' | 'playing'
  let isHost = false;
  let myReady = false;

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
    chinesechess: { name: '中国象棋', icon: '♟️' },
    go9: { name: '围棋9路', icon: '⚫' },
    monopoly: { name: '大富翁', icon: '🏦' },
    suikabattle: { name: '合成大西瓜', icon: '🍉' },
    sheeptile: { name: '羊了个羊', icon: '🐑' },
    drawguess: { name: '你画我猜', icon: '🎨' },
  };

  let roomOptions = {};
  let prevPlayerCount = 0;
  const gameInfo = gameNames[game] || { name: game, icon: '?' };

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

  function getSlotColor(index) {
    const colors = ['#1a1a1a', '#c8a45c', '#d4695a', '#5a9e6f'];
    return colors[index % colors.length];
  }

  // ---- WebSocket ----
  function connect() {
    if (ws) { try { ws.close(); } catch(e) {} }
    ws = new WebSocket(`ws://${location.host}`);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join_room', data: { roomId } }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      // room_joined / room_created (initial connection)
      if (msg.type === 'room_joined' || msg.type === 'room_created') {
        state = msg.state || state;
        players = msg.players || players;
        window._players = players;
        roomPhase = msg.phase || 'lobby';
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
    ws.onclose = () => setTimeout(connect, 1500);
    ws.onerror = () => {};
  }

  // ---- UI Toggle ----
  function showGame() {
    document.getElementById('waitingRoom').style.display = 'none';
    document.getElementById('profileEdit').style.display = 'none';
    document.getElementById('emojiRow').style.display = 'none';
    document.getElementById('playerBar').style.display = '';
    document.getElementById('status').style.display = '';
    document.querySelector('.board-wrap').style.display = '';
    document.getElementById('gameActions').style.display = '';
  }

  function showLobby() {
    document.getElementById('waitingRoom').style.display = '';
    document.getElementById('profileEdit').style.display = 'flex';
    document.getElementById('emojiRow').style.display = '';
    // Generate QR code via server endpoint (server uses LAN IP)
    var qrImg = document.getElementById('qrImage');
    if (qrImg && roomId) {
      qrImg.src = '/qr?room=' + roomId;
    }
    var qrCode = document.getElementById('qrRoomCode');
    if (qrCode && roomId) qrCode.textContent = roomId;
    document.getElementById('playerBar').style.display = 'none';
    document.getElementById('status').style.display = 'none';
    document.querySelector('.board-wrap').style.display = 'none';
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

    // Update header
    document.getElementById('waitingGameName').textContent = gameInfo.icon + ' ' + gameInfo.name;

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
    const maxSlots = players && players.length > 0
      ? Math.max(players.length, game === 'doudizhu' ? 3 : game === 'tictactoe' || game === 'gomoku' || game === 'chinesechess' || game === 'go9' ? 2 : game === 'twentyfour' ? 6 : 4)
      : (game === 'doudizhu' ? 3 : game === 'tictactoe' || game === 'gomoku' || game === 'chinesechess' || game === 'go9' ? 2 : game === 'twentyfour' ? 6 : 4);

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
        const from = parseInt(this.dataset.from);
        // Find a target: ask which slot to swap with
        const target = prompt('换到哪个位置？输入位置编号 (1-' + maxSlots + ')');
        if (target === null) return;
        const toIdx = parseInt(target) - 1;
        if (isNaN(toIdx) || toIdx < 0 || toIdx >= maxSlots || toIdx === from) return;
        ws.send(JSON.stringify({ type: 'swap_seat', data: { fromIndex: from, toIndex: toIdx } }));
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
        const canStart = allReady && totalPlayers >= 2;
        startBtn.disabled = !canStart;
        startBtn.classList.toggle('disabled', !canStart);
      }
      startBtn.onclick = function() {
        ws.send(JSON.stringify({ type: 'start_game' }));
      };
    }

    // Add bot button (host only)
    if (addBotBtn) {
      addBotBtn.style.display = isHost ? '' : 'none';
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

  window._sendNextRound = function() {
    ws.send(JSON.stringify({ type: 'next_round' }));
  };

  window._setGameOption = function(key, value) {
    roomOptions[key] = value;
    ws.send(JSON.stringify({ type: 'set_option', data: { key, value } }));
  };

  // ---- Init ----
  connect();

  // Show lobby initially (will update when room_joined arrives)
  showLobby();
})();
