// public/js/room-client.js
(function() {
  const el = {};
  function cacheElements() {
    ['notifyBar','status','overlay','boardArea','waitingRoom','waitingSlots','waitingStatus','playerBar','resultOverlay','resultText','resultSub','gameStage','gameActions','profileEdit','emojiRow','avatarDrawer','readyBtn','startGameBtn','addBotBtn','gameOptions','seatSwapModal','seatSwapGrid','seatSwapHint','nameInput','avatarEmoji','qrImage','qrRoomCode','roomBadge'].forEach(function(id) {
      el[id] = document.getElementById(id);
    });
  }
  cacheElements();

  let game = sessionStorage.getItem('game');
  const roomId = sessionStorage.getItem('roomId');
  let playerIndex = parseInt(sessionStorage.getItem('playerIndex'));
  const resumeToken = sessionStorage.getItem('resumeToken');


  let ws, state, players, currentRenderer;
  let roomPhase = 'lobby';   // 'lobby' | 'ready' | 'playing'
  let isHost = false;
  let myReady = false;
  let terminalRoomError = false;
  let seatSwapFromIndex = null;

  el.roomBadge.textContent = roomId;

  // ---- Game name lookup ----
  function _gt(id) {
    return window.gameCatalog && window.gameCatalog.byId(id)
      || { name: id, icon: '?', maxPlayers: 4, supportsAI: true };
  }

  let roomOptions = {};
  let prevPlayerCount = 0;
  const gameInfo = _gt(game);

  function notify(msg) {
    const bar = el.notifyBar;
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
    var nd = document.getElementById(id);
    if (nd) nd.textContent = value || '';
  }

  function renderFacts(id, values) {
    var nd = document.getElementById(id);
    if (!nd) return;
    nd.innerHTML = values.filter(Boolean).map(function(value) {
      return '<span>' + value + '</span>';
    }).join('');
  }

  function renderMetaPills(id, values) {
    var nd = document.getElementById(id);
    if (!nd) return;
    nd.innerHTML = values.filter(Boolean).map(function(value) {
      return '<span class="meta-pill">' + value + '</span>';
    }).join('');
  }

  function roomContextSummary() {
    var parts = [];
    if (gameInfo && gameInfo.name) parts.push(gameInfo.name);
    if (roomId) parts.push(_t('room') + ' ' + roomId);
    return parts.join(' · ');
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
    const modal = el.seatSwapModal;
    const grid = el.seatSwapGrid;
    const hint = el.seatSwapHint;
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
        send('swap_seat', { fromIndex: seatSwapFromIndex, toIndex: toIdx });
        closeSeatSwapModal();
      });
      grid.appendChild(btn);
    }

    modal.style.display = 'flex';
  }

  function closeSeatSwapModal() {
    const modal = el.seatSwapModal;
    if (modal) modal.style.display = 'none';
    seatSwapFromIndex = null;
  }

  function getSocketURL() {
    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return protocol + location.host;
  }

  function updateSharedShell() {
    setText('activeGameName', gameInfo.name);
    setText('activeGameSubtitle', roomContextSummary());
    setText('stageGameName', gameInfo.name);
    setText('waitingGameName', gameInfo.name);
    setText('waitingGameSubtitle', gameInfo.description || gameInfo.subtitle || '');
    setText('stageRoomFacts', roomContextSummary() + ' · ' + (gameInfo.supportsAI ? _t('can_add_bot') : _t('pvp_only')));
    renderMetaPills('waitingMeta', [gameInfo.category, gameInfo.players, gameInfo.duration]);
    renderFacts('stageMeta', [gameInfo.category, gameInfo.players, gameInfo.duration]);
    // Show connecting status until first server response arrives
    el.waitingStatus.textContent = _t('connecting_room');
  }

  // ---- WebSocket ----
  function send(type, data) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(data === undefined ? { type } : { type, data }));
    }
  }

  function i18nStatic() {
    if (typeof _t !== 'function') return;
    var nd;
    nd = document.getElementById('tutorialBtn');
    if (nd) nd.textContent = _t('view_rules');
    nd = document.querySelector('.qr-hint');
    if (nd) nd.textContent = _t('scan_join');
    if (el.readyBtn) el.readyBtn.textContent = _t('ready');
    if (el.addBotBtn) el.addBotBtn.textContent = _t('add_bot');
    if (el.startGameBtn) el.startGameBtn.textContent = _t('start_game');
    nd = document.querySelector('.back-btn');
    if (nd) nd.textContent = _t('back_to_lobby');
    nd = document.querySelector('.seat-swap-close');
    if (nd) nd.textContent = _t('cancel');
    nd = document.querySelector('.seat-swap-card strong');
    if (nd) nd.textContent = _t('swap_seat');
    if (el.seatSwapHint) el.seatSwapHint.textContent = _t('swap_hint_full');
    nd = document.querySelector('.avatar-drawer-title');
    if (nd) nd.textContent = _t('choose_avatar');
    if (el.nameInput) el.nameInput.placeholder = _t('name_placeholder');
    if (el.overlay) {
      var btns = el.overlay.querySelectorAll('.btn-outline');
      if (btns.length >= 2) {
        btns[0].textContent = _t('return_to_room');
        btns[1].textContent = _t('back_to_lobby');
      }
      var accentBtn = el.overlay.querySelector('.btn-accent');
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
    ws.onopen = () => send('join_room', { roomId, resumeToken, lang: window.__ACTIVE_LANG || 'zh' });

    const handlers = {
      room_joined(msg) {
        handleRoomJoined(msg);
      },
      room_created(msg) {
        handleRoomJoined(msg);
      },
      game_state(msg) {
        if (state && state.winner != null && msg.state &&
            (msg.state.winner === null || msg.state.winner === undefined)) {
          if (typeof unregisterAllActions === 'function') unregisterAllActions();
          currentRenderer = null;
          const container = el.boardArea;
          if (container) container.innerHTML = '';
        }
        state = msg.state || state;
        players = msg.players || players;
        window._players = players;
        roomPhase = 'playing';
        showGame();
        updatePlayerBar();
        renderGame();
      },
      game_started(msg) {
        state = msg.state;
        players = msg.players;
        window._players = players;
        roomPhase = 'playing';
        showGame();
        updatePlayerBar();
        renderGame();
        el.status.textContent = '';
      },
      room_update(msg) {
        players = msg.players || players;
        roomPhase = msg.phase || roomPhase;
        if (msg.options) roomOptions = msg.options;
        updateWaitingRoom();
      },
      player_index_updated(msg) {
        playerIndex = msg.playerIndex;
        sessionStorage.setItem('playerIndex', msg.playerIndex);
        updateWaitingRoom();
      },
      player_joined(msg) {
        handlePlayerChange(msg, 'player_joined');
      },
      player_left(msg) {
        handlePlayerChange(msg, 'player_left');
      },
      error(msg) {
        if (msg.code === 'ROOM_NOT_FOUND' || (!state && /房间不存在|房间已结束/.test(msg.message || ''))) {
          clearExpiredRoomAndReturn();
          return;
        }
        const ws2 = el.waitingStatus;
        if (ws2) {
          ws2.textContent = msg.message;
          setTimeout(() => {
            if (el.waitingStatus) el.waitingStatus.textContent = '';
          }, 3000);
        }
        if (typeof window._gameErrorHandler === 'function') window._gameErrorHandler(msg.message);
      }
    };

    function handleRoomJoined(msg) {
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

    function handlePlayerChange(msg, type) {
      const newCount = (msg.players || players || []).length;
      const humanPlayers = (msg.players || []).filter(function(p) { return !p.isBot; });
      if (type === 'player_joined' && newCount > prevPlayerCount) {
        const latest = humanPlayers[humanPlayers.length - 1];
        if (latest && latest.index !== playerIndex) {
          notify('👋 ' + latest.name + ' ' + _t('joined_room'));
        }
      } else if (type === 'player_left' && newCount < prevPlayerCount) {
        notify('🚪 ' + _t('left_room'));
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
      if (type === 'player_left') {
        el.status.textContent = _t('opponent_left');
        el.overlay.style.display = 'none';
      }
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type !== 'error') {
        var bar = el.notifyBar;
        if (bar && bar._timer === 0) {
          bar.style.transform = 'translateY(-100%)';
          bar._timer = null;
        }
      }

      const handler = handlers[msg.type];
      if (handler) handler(msg);
    };
    ws.onclose = () => {
      if (!terminalRoomError) {
        var bar = el.notifyBar;
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
    el.waitingRoom.style.display = 'none';
    el.profileEdit.style.display = 'none';
    el.emojiRow.style.display = 'none';
    el.gameStage.style.display = '';
    el.playerBar.style.display = '';
    el.status.style.display = '';
    el.gameActions.style.display = '';
  }

  function showLobby() {
    el.waitingRoom.style.display = '';
    el.profileEdit.style.display = 'flex';
    el.emojiRow.style.display = '';
    el.gameStage.style.display = 'none';
    if (el.qrImage && roomId) el.qrImage.src = '/qr?room=' + roomId;
    if (el.qrRoomCode && roomId) el.qrRoomCode.textContent = roomId;
    el.playerBar.style.display = 'none';
    el.status.style.display = 'none';
    el.gameActions.style.display = 'none';
    el.overlay.style.display = 'none';
  }

  // ---- Waiting Room ----
  function updateWaitingRoom() {
    if (roomPhase === 'playing') {
      updateSharedShell();
      showGame();
      updatePlayerBar();
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
    var avatarEmoji = el.avatarEmoji;
    var nameInput = el.nameInput;
    var emojiRow = el.emojiRow;
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
            send('set_avatar', { avatar: emoji });
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
          send('set_name', { name: val });
        }
      };
    }

    // Determine max slots
    const defaultSlots = gameInfo.maxPlayers || 4;
    const maxSlots = players && players.length > 0
      ? Math.max(players.length, defaultSlots)
      : defaultSlots;

    // Build slots
    const slots = el.waitingSlots;
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
    var optionsEl = el.gameOptions;
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
            _t('rc_win_rounds_label') + ' <select id="optMaxRounds" onchange="window._setGameOption(\'maxRounds\', parseInt(this.value))" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:14px;">' +
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
    const readyBtn = el.readyBtn;
    const startBtn = el.startGameBtn;
    const addBotBtn = el.addBotBtn;
    const waitingStatus = el.waitingStatus;

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
        send('player_ready');
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
        send('start_game');
      };
    }

    // Add bot button (host only)
    if (addBotBtn) {
      const supportsAI = gameInfo.supportsAI !== false;
      addBotBtn.style.display = isHost && supportsAI ? '' : 'none';
      const totalOccupied = players ? players.length : 0;
      const roomFull = totalOccupied >= maxSlots;
      addBotBtn.disabled = roomFull;
      addBotBtn.classList.toggle('disabled', roomFull);
      addBotBtn.onclick = function() {
        send('add_bot');
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
    const bar = el.playerBar;
    bar.innerHTML = '';
    if (!players) return;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const tag = document.createElement('div');
      tag.className = 'player-tag p' + p.index;
      if (state && state.currentPlayer === p.index) tag.classList.add('active');
      const avatar = p.avatar || (p.isBot ? '\u{1F916}' : '\u{1F60A}');
      tag.innerHTML = '<span class="dot"></span><span class="player-tag-avatar">' + avatar + '</span><span>' + p.name + (p.isBot ? ' \u{1F916}' : '') + '</span>';
      bar.appendChild(tag);
      if (i < players.length - 1) {
        const vs = document.createElement('span');
        vs.className = 'vs-text'; vs.textContent = 'VS'; bar.appendChild(vs);
      }
    }
    if (!state || state.winner == null) {
      const st = el.status;
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
      if (typeof unregisterAllActions === 'function') unregisterAllActions();
      currentRenderer = window.gameRenderers.get(game);
      el.boardArea.innerHTML = '';
      if (currentRenderer && currentRenderer.init) currentRenderer.init(el.boardArea);
    }
    window.gamePlayers = players;
    if (currentRenderer) currentRenderer.render(state, el.boardArea, playerIndex, state.winner);
    if (state.winner !== null && state.winner !== undefined) showResult(state.winner);
  }

  function showResult(winner) {
    const overlay = el.overlay;
    const resultEl = el.resultText;
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
    el.resultSub.textContent = sub;
    overlay.style.display = 'flex';
    var st = el.status;
    st.classList.remove('my-turn');
    st.textContent = isWin ? _t('you_win') : winner === -1 ? _t('draw') : _t('opponent_wins');
  }

  window.makeGameMove = function(data) {
    send('game_move', data);
  };

  window.doRestart = function() {
    el.overlay.style.display = 'none';
    if (typeof window._beforeGameRestart === 'function') window._beforeGameRestart();
    send('game_restart');
  };

  window.doReturnToRoom = function() {
    el.overlay.style.display = 'none';
    send('return_to_room');
  };

  window.doLeaveRoom = function() {
    if (typeof window._beforeLeaveRoom === 'function') window._beforeLeaveRoom();
    send('leave_room');
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
    if (el.avatarDrawer) el.avatarDrawer.style.display = 'flex';
  };

  window.closeAvatarDrawer = function() {
    if (el.avatarDrawer) el.avatarDrawer.style.display = 'none';
  };
  window.closeSeatSwapModal = closeSeatSwapModal;

  window._sendNextRound = function() {
    send('next_round');
  };

  window._setGameOption = function(key, value) {
    roomOptions[key] = value;
    send('set_option', { key, value });
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
