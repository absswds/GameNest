// public/js/room-client.js
(function() {
  let game = sessionStorage.getItem('game');
  const roomId = sessionStorage.getItem('roomId');
  let playerIndex = parseInt(sessionStorage.getItem('playerIndex'));
  const resumeToken = sessionStorage.getItem('resumeToken');
  const NO_AI_GAMES = new Set(['truthdare', 'drawguess', 'minesweeper', 'suikabattle']);

  let ws, state, players, currentRenderer;
  let roomPhase = 'lobby';   // 'lobby' | 'ready' | 'playing'
  let isHost = false;
  let myReady = false;
  let terminalRoomError = false;
  let seatSwapFromIndex = null;

  document.getElementById('roomBadge').textContent = roomId;

  // ---- Game name lookup ----
  function _gt(id) {
    var g = window.gameCatalog && window.gameCatalog.byId(id);
    return g ? { name: g.name, icon: g.icon } : null;
  }
  const gameNames = {
    tictactoe: _gt('tictactoe') || { name: 'Tic Tac Toe', icon: '✦' },
    gomoku: _gt('gomoku') || { name: 'Gomoku', icon: '●' },
    davinci: _gt('davinci') || { name: 'Davinci Code', icon: '🧠' },
    uno: _gt('uno') || { name: 'UNO', icon: '🃏' },
    doudizhu: _gt('doudizhu') || { name: 'Dou Dizhu', icon: '♠' },
    'exploding-kittens': _gt('exploding-kittens') || { name: 'Exploding Kittens', icon: '💣' },
    rummikub: _gt('rummikub') || { name: 'Rummikub', icon: '▦' },
    twentyfour: _gt('twentyfour') || { name: '24 Game', icon: '24' },
    minesweeper: _gt('minesweeper') || { name: 'Minesweeper', icon: '✹' },
    numberbomb: _gt('numberbomb') || { name: 'Number Bomb', icon: '#' },
    oldmaid: _gt('oldmaid') || { name: 'Old Maid', icon: '👻' },
    liarsbar: _gt('liarsbar') || { name: "Liar's Bar", icon: '♣' },
    bigtwo: _gt('bigtwo') || { name: 'Big Two', icon: '♠' },
    texas: _gt('texas') || { name: "Texas Hold'em", icon: 'A' },
    flightchess: _gt('flightchess') || { name: 'Flight Chess', icon: '✈' },
    snakebattle: _gt('snakebattle') || { name: 'Snake Battle', icon: 'S' },
    chinesechess: _gt('chinesechess') || { name: 'Chinese Chess', icon: '楚' },
    go9: _gt('go9') || { name: 'Go 9x9', icon: '○' },
    monopoly: _gt('monopoly') || { name: 'Monopoly', icon: 'M' },
    suikabattle: _gt('suikabattle') || { name: 'Suika Battle', icon: '◔' },
    sheeptile: _gt('sheeptile') || { name: 'Sheep Tile', icon: 'Y' },
    truthdare: _gt('truthdare') || { name: 'Truth or Dare', icon: '?' },
    drawguess: _gt('drawguess') || { name: 'Draw & Guess', icon: '✎' },
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
      bar._timer = null;
    }, 2500);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
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

  function seatSummary(index) {
    const player = players ? players.find(function(p) { return p.index === index; }) : null;
    if (!player) return { title: _t('empty_seat'), meta: _t('swap_hint') };
    var meta = [];
    if (player.isHost) meta.push(_t('host'));
    if (player.isBot) meta.push('AI');
    if (!player.isBot) meta.push(player.ready ? _t('ready_status') : _t('not_ready'));
    return { title: player.name, meta: meta.join(' · ') };
  }

  function openSeatSwapModal(fromIndex, maxSlots) {
    seatSwapFromIndex = fromIndex;
    const modal = document.getElementById('seatSwapModal');
    const grid = document.getElementById('seatSwapGrid');
    const hint = document.getElementById('seatSwapHint');
    if (!modal || !grid || !hint) return;

    const origin = seatSummary(fromIndex);
    hint.textContent = _t('swap_hint_full');
    grid.innerHTML = '';

    for (let i = 0; i < maxSlots; i++) {
      const summary = seatSummary(i);
      const btn = document.createElement('button');
      btn.className = 'seat-swap-option' + (i === fromIndex ? ' current' : '');
      btn.dataset.seatIndex = String(i);
      btn.disabled = i === fromIndex;
      btn.innerHTML =
        '<div class="seat-swap-slot">' + _t('seat_label') + (i + 1) + '</div>' +
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
    setText('activeGameSubtitle', gameInfo.subtitle || _t('waiting_players'));
    setText('stageGameName', gameInfo.name);
    setText('waitingGameName', gameInfo.name);
    setText('waitingGameSubtitle', gameInfo.description || gameInfo.subtitle || '');
    setText('stageRoomFacts', _t('room') + ' ' + roomId + ' · ' + (gameInfo.supportsAI ? _t('can_add_bot') : _t('pvp_only')));
    renderMetaPills('waitingMeta', [gameInfo.category, gameInfo.players, gameInfo.duration]);
    renderFacts('stageMeta', [gameInfo.category, gameInfo.players, gameInfo.duration]);
    // Show connecting status until first server response arrives
    document.getElementById('waitingStatus').textContent = _t('connecting_room');
  }

  // ---- WebSocket ----
  function i18nStatic() {
    if (typeof _t !== 'function') return;
    var el;
    el = document.getElementById('tutorialBtn');
    if (el) el.textContent = _t('view_rules');
    el = document.querySelector('.qr-hint');
    if (el) el.textContent = _t('scan_join');
    el = document.getElementById('readyBtn');
    if (el) el.textContent = _t('ready');
    el = document.getElementById('addBotBtn');
    if (el) el.textContent = _t('add_bot');
    el = document.getElementById('startGameBtn');
    if (el) el.textContent = _t('start_game');
    el = document.querySelector('.back-btn');
    if (el) el.textContent = _t('back_to_lobby');
    el = document.querySelector('.seat-swap-close');
    if (el) el.textContent = _t('cancel');
    el = document.querySelector('.seat-swap-card strong');
    if (el) el.textContent = _t('swap_seat');
    el = document.getElementById('seatSwapHint');
    if (el) el.textContent = _t('swap_hint_full');
    el = document.querySelector('.avatar-drawer-title');
    if (el) el.textContent = _t('choose_avatar');
    el = document.getElementById('nameInput');
    if (el) el.placeholder = _t('name_placeholder');
    var overlay = document.getElementById('overlay');
    if (overlay) {
      var btns = overlay.querySelectorAll('.btn-outline');
      if (btns.length >= 2) {
        btns[0].textContent = _t('return_to_room');
        btns[1].textContent = _t('back_to_lobby');
      }
      var accentBtn = overlay.querySelector('.btn-accent');
      if (accentBtn) accentBtn.textContent = _t('play_again');
    }
    var restartBtns = document.querySelectorAll('#gameActions .btn-outline');
    if (restartBtns.length > 0) restartBtns[0].textContent = _t('restart');
    document.title = gameInfo ? (gameInfo.name || 'GameNest') : 'GameNest';
  }
  i18nStatic();

  function connect() {
    if (ws) { try { ws.close(); } catch(e) {} }
    ws = new WebSocket(getSocketURL());
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join_room', data: { roomId, resumeToken, lang: window.__ACTIVE_LANG || 'zh' } }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      // Clear reconnecting indicator on any successful message
      if (msg.type !== 'error') {
        var bar = document.getElementById('notifyBar');
        if (bar && bar._timer === 0) {
          bar.style.transform = 'translateY(-100%)';
          bar._timer = null;
        }
      }

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

      // player_index_updated (after seat swap — update local playerIndex)
      if (msg.type === 'player_index_updated') {
        playerIndex = msg.playerIndex;
        sessionStorage.setItem('playerIndex', msg.playerIndex);
        updateWaitingRoom();
      }

      // player_joined / player_left
      if (msg.type === 'player_joined' || msg.type === 'player_left') {
        const newCount = (msg.players || players || []).length;
        const humanPlayers = (msg.players || []).filter(function(p) { return !p.isBot; });

        if (msg.type === 'player_joined' && newCount > prevPlayerCount) {
          const latest = humanPlayers[humanPlayers.length - 1];
          if (latest && latest.index !== playerIndex) {
            notify('👋 ' + latest.name + ' ' + _t('joined_room'));
          }
        } else if (msg.type === 'player_left') {
          if (newCount < prevPlayerCount) {
            notify('🚪 ' + _t('left_room'));
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
          document.getElementById('status').textContent = _t('opponent_left');
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
      if (!terminalRoomError) {
        var bar = document.getElementById('notifyBar');
        if (bar) {
          bar.textContent = _t('reconnecting') || 'Disconnected. Reconnecting…';
          bar.style.transform = 'translateY(0)';
          clearTimeout(bar._timer);
          bar._timer = 0;
        }
        setTimeout(connect, 1500);
      }
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
    const defaultSlots = gameInfo.maxPlayers || (game === 'doudizhu' ? 3 : game === 'tictactoe' || game === 'gomoku' || game === 'chinesechess' || game === 'go9' ? 2 : game === 'truthdare' ? 10 : game === 'twentyfour' ? 6 : 4);
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
        const disconnected = !player.isBot && player.connected === false;
        let tagsHtml = '';
        if (player.isHost) tagsHtml += '<span class="waiting-slot-badge host">👑 ' + _t('host') + '</span>';
        if (player.isBot) {
          tagsHtml += '<span class="waiting-slot-badge ai">🤖 AI</span>';
        } else if (disconnected) {
          tagsHtml += '<span class="waiting-slot-badge" style="background:#fff3e0;color:#e67e22">📱 ' + _t('in_lobby') + '</span>';
        } else if (player.ready) {
          tagsHtml += '<span class="waiting-slot-badge ready">✓ ' + _t('ready_status') + '</span>';
        } else {
          tagsHtml += '<span class="waiting-slot-badge">' + _t('not_ready') + '</span>';
        }
        html +=
          '<div class="waiting-slot occupied' + meClass + '">' +
            '<div class="waiting-slot-avatar" style="background:' + getSlotColor(i) + '">' +
              (player.avatar || (player.isBot ? '🤖' : '😊')) +
            '</div>' +
            '<div class="waiting-slot-info">' +
              '<div class="waiting-slot-name">' + player.name + (isMe ? ' (' + _t('you') + ')' : '') + '</div>' +
              '<div class="waiting-slot-tags">' + tagsHtml + '</div>' +
            '</div>' +
            '<button class="waiting-slot-swap" data-from="' + i + '" title="⇅">⇅</button>' +
          '</div>';
      } else {
        html +=
          '<div class="waiting-slot empty">' +
            '<div class="waiting-slot-avatar" style="background:#bbb">' + (i + 1) + '</div>' +
            '<div class="waiting-slot-info">' +
              '<div class="waiting-slot-name" style="color:var(--text-muted)">' + _t('waiting') + '</div>' +
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
          opts += '<option value="' + t + '"' + (rt === t ? ' selected' : '') + '>' + (t === 0 ? _t('unlimited') : t + _t('seconds')) + '</option>';
        });
        var mrOpts = '';
        [3, 5, 7, 10].forEach(function(n) {
          mrOpts += '<option value="' + n + '"' + (mr === n ? ' selected' : '') + '>' + n + _t('rounds') + '</option>';
        });
        optionsEl.innerHTML =
          '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + _t('game_settings') + '</div>' +
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;margin-bottom:6px;">' +
            _t('round_time_label') + ': <select id="optRoundTime" onchange="window._setGameOption(\'roundTime\', parseInt(this.value))" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:14px;">' +
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
          '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">' + _t('game_settings') + '</div>' +
          '<div style="font-size:13px;color:var(--text-muted)">' + _t('round_time_label') + ': ' + (rt2 === 0 ? _t('unlimited') : rt2 + _t('seconds')) + ' ・ ' + _t('max_rounds_label') + ': ' + mr2 + _t('rounds') + '</div>';
      } else if (isHost && game === 'rummikub') {
        optionsEl.style.display = 'block';
        var breakOn = roomOptions.requireBreak !== false; // default true
        optionsEl.innerHTML =
          '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + _t('game_settings') + '</div>' +
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;">' +
            '<input type="checkbox" id="optRequireBreak" ' + (breakOn ? 'checked' : '') + ' onchange="window._setGameOption(\'requireBreak\', this.checked)">' +
            _t('require_break') +
          '</label>';
      } else if (game === 'rummikub') {
        optionsEl.style.display = 'block';
        var breakOn2 = roomOptions.requireBreak !== false;
        optionsEl.innerHTML =
          '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">' + _t('game_settings') + '</div>' +
          '<div style="font-size:13px;color:var(--text-muted)">' + _t('break_in_rule') + ': ' + (breakOn2 ? _t('break_on') : _t('break_off')) + '</div>';
      } else if (game === 'sheeptile') {
        optionsEl.style.display = 'block';
        var sameBoard = roomOptions.sameBoard !== false; // default same board
        if (isHost) {
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + _t('game_settings') + '</div>' +
            '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;">' +
              '<input type="checkbox" id="optSameBoard" ' + (sameBoard ? 'checked' : '') + ' onchange="window._setGameOption(\'sameBoard\', this.checked)">' +
              _t('same_board') +
            '</label>' +
            '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">' + _t('random_boards') + '</div>';
        } else {
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">' + _t('game_settings') + '</div>' +
            '<div style="font-size:13px;color:var(--text-muted)">' + _t('board_label') + ': ' + (sameBoard ? _t('same_board') : _t('random_boards')) + '</div>';
        }
      } else if (game === 'truthdare') {
        optionsEl.style.display = 'block';
        var tdDecks = [
          ['icebreaker', _t('deck_icebreaker')],
          ['party', _t('deck_party')],
          ['deep', _t('deck_deep')],
          ['challenge', _t('deck_challenge')],
          ['custom', _t('deck_custom')],
        ];
        var tdEnabled = Array.isArray(roomOptions.enabledDecks) && roomOptions.enabledDecks.length > 0
          ? roomOptions.enabledDecks : ['icebreaker', 'party', 'deep', 'challenge'];
        var tdTruths = escapeHtml(roomOptions.customTruths || '');
        var tdDares = escapeHtml(roomOptions.customDares || '');
        if (isHost) {
          var tdDeckHtml = '';
          tdDecks.forEach(function(d) {
            var checked = tdEnabled.indexOf(d[0]) >= 0;
            tdDeckHtml += '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;margin:2px 10px 2px 0;">' +
              '<input type="checkbox" class="td-deck" value="' + d[0] + '"' + (checked ? ' checked' : '') + ' onchange="window._tdCollectDecks()">' + d[1] + '</label>';
          });
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + _t('game_settings') + '</div>' +
            '<div style="font-size:13px;margin-bottom:8px;">' + _t('enable_decks') + ':<br>' + tdDeckHtml + '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">' +
              '<label>' + _t('custom_truths') + '<textarea id="optTdTruths" rows="3" style="width:100%;margin-top:4px;border:1px solid var(--border);border-radius:8px;padding:6px;font-size:13px;box-sizing:border-box;" placeholder="' + _t('custom_truths_placeholder') + '">' + tdTruths + '</textarea></label>' +
              '<label>' + _t('custom_dares') + '<textarea id="optTdDares" rows="3" style="width:100%;margin-top:4px;border:1px solid var(--border);border-radius:8px;padding:6px;font-size:13px;box-sizing:border-box;" placeholder="' + _t('custom_dares_placeholder') + '">' + tdDares + '</textarea></label>' +
            '</div>' +
            '<button class="btn" style="margin-top:6px;padding:5px 14px;font-size:13px;" onclick="window._tdSaveCustom()">' + _t('save_custom_decks') + '</button>' +
            '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">' + _t('truthdare_rule_hint') + '</div>';
        } else {
          var tdNames = tdDecks.filter(function(d) { return tdEnabled.indexOf(d[0]) >= 0; }).map(function(d) { return d[1]; }).join('、');
          var truthCount = (roomOptions.customTruths || '').split(/\r?\n|[;；]/).filter(function(x) { return x.trim(); }).length;
          var dareCount = (roomOptions.customDares || '').split(/\r?\n|[;；]/).filter(function(x) { return x.trim(); }).length;
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">' + _t('game_settings') + '</div>' +
            '<div style="font-size:13px;color:var(--text-muted)">' + _t('enable_decks') + ': ' + (tdNames || _t('deck_custom')) +
            (truthCount + dareCount > 0 ? ' · ' + _t('deck_custom') + ' ' + (truthCount + dareCount) + ' ' + _t('seconds') : '') + '</div>';
        }
      } else if (game === 'drawguess') {
        optionsEl.style.display = 'block';
        var dgCats = [['animal',_t('cat_animal')],['food',_t('cat_food')],['daily',_t('cat_daily')],['action',_t('cat_action')],['place',_t('cat_place')],['idiom',_t('cat_idiom')],['movie',_t('cat_movie')],['internet',_t('cat_internet')]];
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
          function _dgTimeLbl(v) { return v === 0 ? _t('unlimited') : v + _t('seconds'); }
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + _t('game_settings') + '</div>' +
            '<div style="font-size:13px;margin-bottom:8px;">' + _t('mode_label') + ' <select onchange="window._setGameOption(\'mode\', this.value)" style="' + selStyle + '"><option value="stage"' + (dgMode === 'stage' ? ' selected' : '') + '>' + _t('mode_stage') + '</option><option value="whisper"' + (dgMode === 'whisper' ? ' selected' : '') + '>' + _t('mode_whisper') + '</option></select></div>' +
            '<div style="font-size:13px;margin-bottom:6px;">' + _t('word_categories') + ':<br>' + catHtml + '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:14px;margin-bottom:6px;">' +
              '<label style="display:flex;align-items:center;gap:6px;">' + _t('draw_time_label') + ' ' + dgSel('optDgDraw', 'drawTime', [45,60,90,120,0], [_dgTimeLbl(45),_dgTimeLbl(60),_dgTimeLbl(90),_dgTimeLbl(120),_dgTimeLbl(0)], dgDraw) + '</label>' +
              '<label style="display:flex;align-items:center;gap:6px;">' + _t('guess_time_label') + ' ' + dgSel('optDgGuess', 'guessTime', [30,45,60,90,0], [_dgTimeLbl(30),_dgTimeLbl(45),_dgTimeLbl(60),_dgTimeLbl(90),_dgTimeLbl(0)], dgGuess) + '</label>' +
              '<label style="display:flex;align-items:center;gap:6px;">' + _t('word_count_label') + ' ' + dgSel('optDgChoices', 'wordChoices', [1,2,3,5], [_t('label_1choice'),_t('label_2choices'),_t('label_3choices'),_t('label_5choices')], dgChoices) + '</label>' +
            '</div>' +
            '<div style="font-size:13px;">' + _t('custom_words_label') + ':<br>' +
              '<textarea id="optDgCustom" rows="2" style="width:100%;margin-top:4px;border:1px solid var(--border);border-radius:8px;padding:6px;font-size:13px;box-sizing:border-box;" placeholder="' + _t('custom_words_placeholder') + '">' + customVal + '</textarea>' +
              '<button class="btn" style="margin-top:4px;padding:4px 14px;font-size:13px;" onclick="window._setGameOption(\'customWords\', document.getElementById(\'optDgCustom\').value)">' + _t('save_custom_words') + '</button>' +
            '</div>';
        } else {
          var catNames = dgCats.filter(function(c){ return selCats.indexOf(c[0]) >= 0; }).map(function(c){ return c[1]; }).join('、');
          var customCount = (roomOptions.customWords || '').split(/[,，\n\s]+/).filter(function(w){ return w.trim(); }).length;
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">' + _t('game_settings') + '</div>' +
            '<div style="font-size:13px;color:var(--text-muted)">' + _t('mode_label') + ': ' + (dgMode === 'stage' ? _t('mode_stage') : _t('mode_whisper')) + ' · ' + _t('word_categories') + ': ' + catNames +
            ' · ' + _t('draw_time_label') + ': ' + (dgDraw === 0 ? _t('unlimited') : dgDraw + _t('seconds')) + ' · ' + _t('guess_time_label') + ': ' + (dgGuess === 0 ? _t('unlimited') : dgGuess + _t('seconds')) +
            ' · ' + _t('word_count_label') + ': ' + dgChoices + ' ' + _t('dg_choices_suffix') + (customCount > 0 ? ' · ' + _t('deck_custom') + ' ' + customCount + ' ' + _t('dg_choices_suffix') : '') + '</div>';
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
        readyBtn.textContent = _t('unready');
        readyBtn.classList.add('ready-active');
      } else {
        readyBtn.textContent = _t('ready');
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
        waitingStatus.textContent = isHost ? _t('all_ready_start') : _t('waiting_host_start');
      } else {
        waitingStatus.textContent = _t('waiting_all_ready');
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
      if (players.length < 2) st.textContent = _t('waiting_players');
      else if (state && state.currentPlayer === playerIndex) {
        st.textContent = _t('your_turn');
        st.classList.add('my-turn');
      }
      else if (state) st.textContent = _t('opponent_turn');
    }
  }

  // Global helper: get a player's display name by index (falls back to 玩家N)
  window.getPlayerName = function(idx) {
    if (window.gamePlayers && window.gamePlayers[idx] && window.gamePlayers[idx].name) {
      return window.gamePlayers[idx].name;
    }
    return _t('player') + (idx + 1);
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
      txt = _t('draw'); sub = '';
    } else if (game === 'doudizhu' && state) {
      // Doudizhu uses team-based winner sentinels
      if (winner === -2) {
        // Landlord team wins
        isWin = (playerIndex === state.landlord);
        txt = isWin ? _t('you_win') : _t('you_lose');
        sub = isWin ? _t('landlord_win') : _t('farmer_win');
      } else if (winner === -3) {
        // Farmers win
        isWin = (playerIndex !== state.landlord);
        txt = isWin ? _t('you_win') : _t('you_lose');
        sub = isWin ? _t('farmer_win') : _t('landlord_win');
      } else {
        isWin = (winner === playerIndex);
        txt = isWin ? _t('you_win') : _t('you_lose'); sub = '';
      }
    } else {
      isWin = (winner === playerIndex);
      txt = isWin ? _t('you_win') : _t('you_lose'); sub = '';
    }
    resultEl.textContent = txt;
    resultEl.classList.toggle('win-text', isWin);
    document.getElementById('resultSub').textContent = sub;
    overlay.style.display = 'flex';
    var st = document.getElementById('status');
    st.classList.remove('my-turn');
    st.textContent = isWin ? _t('you_win') : winner === -1 ? _t('draw') : _t('opponent_wins');
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
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'leave_room' }));
    }
    // Keep roomId + resumeToken in sessionStorage so lobby shows the resume banner
    sessionStorage.setItem('_returnFromGame', '1');
    var shell = document.querySelector('.game-page-shell');
    if (shell) shell.classList.add('exit-anim');
    setTimeout(function() {
      window.location.replace('/');
    }, 350);
  };

  window._leaveRoom = window.doLeaveRoom;

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

  window._tdCollectDecks = function() {
    var arr = [];
    document.querySelectorAll('.td-deck:checked').forEach(function(cb) { arr.push(cb.value); });
    if (arr.length === 0) arr = ['icebreaker'];
    window._setGameOption('enabledDecks', arr);
  };

  window._tdSaveCustom = function() {
    var truths = document.getElementById('optTdTruths');
    var dares = document.getElementById('optTdDares');
    window._setGameOption('customTruths', truths ? truths.value : '');
    window._setGameOption('customDares', dares ? dares.value : '');
    if (document.querySelector('.td-deck[value="custom"]:checked')) window._tdCollectDecks();
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

  // Pre-populate shell from sessionStorage immediately (before WS connects)
  updateSharedShell();

  // Show lobby initially (will update when room_joined arrives)
  showLobby();
})();
