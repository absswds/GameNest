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
  let currentRendererKey = null;  // 麻将四川/广东切换时据此重新 init
  let roomPhase = 'lobby';   // 'lobby' | 'ready' | 'playing'
  let isHost = false;
  let myReady = false;
  let terminalRoomError = false;
  let seatSwapFromIndex = null;

  el.roomBadge.textContent = roomId;

  // Games whose bots read state._options.difficulty (via difficulty.js)
  window._gamesWithDifficulty = ['reversi','gomoku','chess','connect4','checkers','chinesechess','go9','hearts','battleship'];

  // ---- Game name lookup ----
  function _gt(id) {
    return window.gameCatalog && window.gameCatalog.byId(id)
      || { name: id, icon: '?', maxPlayers: 4, supportsAI: true };
  }

  // Games that can be started and played solo (no AI / opponent needed).
  const SOLO_GAMES = ['2048', 'sudoku', 'minesweeper', 'numberbomb', 'twentyfour', 'suikabattle', 'drawguess'];

  let roomOptions = {};
  let match = null; // best-of-N score for board games, from the server
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

  // Toast for in-game hints (UNO draw/challenge, restart requests, etc.)
  window.showToast = function(msg) {
    notify(msg);
  };
  function showToast(msg) { notify(msg); }
  function tf(key) { var args = Array.prototype.slice.call(arguments, 1); return String(_t(key)).replace(/%s/g, function() { return args.shift(); }); }

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
    document.title = 'GameNest — ' + _t('room');
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
      var btns = el.overlay.querySelectorAll('.btn-outline:not(#resultViewBoard)');
      if (btns.length >= 2) {
        btns[0].textContent = _t('return_to_room');
        btns[1].textContent = _t('back_to_lobby');
      }
      var viewBtn = document.getElementById('resultViewBoard');
      if (viewBtn) viewBtn.textContent = _t('view_board');
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
        var wasRestart = false;
        if (state && state.winner != null && msg.state &&
            (msg.state.winner === null || msg.state.winner === undefined)) {
          wasRestart = true;
          if (typeof unregisterAllActions === 'function') unregisterAllActions();
          currentRenderer = null;
          currentRendererKey = null;
          const container = el.boardArea;
          if (container) container.innerHTML = '';
          // Host started a new game: non-hosts drop their result overlay.
          if (!isHost && typeof window._updateOverlayForNewGame === 'function') {
            window._updateOverlayForNewGame();
          }
        }
        // round_end 设的 roundScores 会被 game_state 的整体替换覆盖；
        // phase 仍是 over 时把它保留下来，供结算面板显示本局加减分
        var prevRoundScores = state && state.roundScores;
        state = msg.state || state;
        if (state && !state.roundScores && prevRoundScores && state.phase === 'over') {
          state.roundScores = prevRoundScores;
        }
        players = msg.players || players;
        window._players = players;
        if (msg.match !== undefined) match = msg.match;
        roomPhase = 'playing';
        showGame();
        updatePlayerBar();
        renderGame();
      },
      game_started(msg) {
        state = msg.state;
        if (msg.match !== undefined) match = msg.match;
        players = msg.players;
        window._players = players;
        roomPhase = 'playing';
        showGame();
        updatePlayerBar();
        renderGame();
        el.status.textContent = '';
      },
      // Host started a new game: non-hosts should drop their result overlay
      // and see "continue" instead of "play again".
      game_restart(msg) {
        if (!isHost) {
          if (typeof window._updateOverlayForNewGame === 'function') {
            window._updateOverlayForNewGame();
          }
        }
      },
      round_end(msg) {
        if (state) {
          state.cumulativeScore = msg.cumulativeScore;
          state.dealerIndex = msg.dealerIndex;
          state.roundNumber = msg.roundNumber;
          state.winners = msg.winners;
          state.roundScores = msg.roundScores;
        }
        renderGame();
      },
      // Non-host asked to restart: notify the host.
      restart_requested(msg) {
        if (isHost) {
          showToast(tf('restart_request_notify', msg.by || 'Player'));
        }
      },
      // Host removed this player from the room: clear local state and go back to lobby.
      kicked(msg) {
        terminalRoomError = true;
        ['roomId', 'playerIndex', 'game', 'resumeToken'].forEach(function(key) { sessionStorage.removeItem(key); });
        if (ws) { try { ws.close(); } catch (e) {} }
        window.location.replace('/?kicked=1');
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
        // 多局比赛换边：提示这一局的先后手
        if (roomPhase === 'playing' && match) showToast(_t(msg.playerIndex === 0 ? 'match_swap_first' : 'match_swap_second'));
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
        // UNO-specific hints: show a toast instead of a harsh error.
        if (msg.code === 'uno_have_playable_card') {
          showToast(_t('uno_have_playable_hint'));
          return;
        }
        if (msg.code === 'uno_cannot_play_card') {
          showToast(_t('uno_cannot_play'));
          return;
        }
        if (msg.code === 'g_not_your_turn') {
          showToast(_t('uno_opponent_turn'));
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
      if (msg.match !== undefined) match = msg.match;
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
  // 麻将竖屏放不下 14 张手牌（360dp 宽最多容 ~8 张可点的牌），锁横屏 + 沉浸式全屏。
  // 安卓走 WebAppBridge；普通浏览器退化到 Screen Orientation API（多数需已全屏，失败静默）。
  const IMMERSIVE_GAMES = ['mahjong-sichuan', 'mahjong-cantonese'];
  // 方形棋盘游戏：宽屏时玩家栏放左侧、操作按钮放右侧，让棋盘占满中间高度
  const SIDE_LAYOUT_GAMES = ['chess', 'checkers', 'reversi', 'go9', 'gomoku', 'chinesechess'];
  // Other square boards that only borrow the wide three-column stage (no match score / move list)
  const SIDE_STAGE_GAMES = SIDE_LAYOUT_GAMES.concat(['connect4', 'tictactoe']);
  function setImmersiveLandscape(on) {
    try {
      if (window.GameNestNative && window.GameNestNative.setImmersiveLandscape) {
        window.GameNestNative.setImmersiveLandscape(!!on);
      } else if (window.screen && screen.orientation) {
        if (on && screen.orientation.lock) screen.orientation.lock('landscape').catch(function() {});
        else if (!on && screen.orientation.unlock) screen.orientation.unlock();
      }
    } catch (e) { /* 桌面浏览器不支持，静默降级 */ }
  }

  function showGame() {
    el.waitingRoom.style.display = 'none';
    el.profileEdit.style.display = 'none';
    el.emojiRow.style.display = 'none';
    el.gameStage.style.display = '';
    el.playerBar.style.display = '';
    el.status.style.display = '';
    // 动作条现在在文档流最底部、不遮挡棋盘，所有游戏都照常显示
    el.gameActions.style.display = '';
    setImmersiveLandscape(IMMERSIVE_GAMES.indexOf(game) !== -1);
    el.gameStage.classList.toggle('stage-side', SIDE_STAGE_GAMES.indexOf(game) !== -1);
    // 棋盘在等待房间还显示时就量过尺寸，舞台出现后让各渲染器按真实位置重新量一次
    requestAnimationFrame(function() { window.dispatchEvent(new Event('resize')); });
  }

  function showLobby() {
    setImmersiveLandscape(false);
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
    // 房主身份与 phase 无关，必须在 playing 早退之前算：
    // 中途退出房间会让页面重载、isHost 归 false，再重连进 playing 房间时
    // 若在早退之后才算，就永远读不到服务端下发的 isHost。
    const myInfo = players ? players.find(p => p.index === playerIndex && !p.isBot) : null;
    isHost = myInfo ? myInfo.isHost : false;
    myReady = myInfo ? myInfo.ready : false;

    if (roomPhase === 'playing') {
      updateSharedShell();
      showGame();
      updatePlayerBar();
      return;
    }
    showLobby();

    // Update shared shell copy
    updateSharedShell();

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

    // Determine max slots: show occupied seats + 1 empty invite slot (capped at
    // the game's max). This avoids wasting screen space on a wall of empty
    // seats when only a couple of people are in the room.
    const defaultSlots = gameInfo.maxPlayers || 4;
    let maxSlots = defaultSlots;
    if (players && players.length > 0) {
      maxSlots = Math.min(defaultSlots, Math.max(players.length + 1, 2));
    }

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
          if (isHost) tagsHtml += '<button class="waiting-slot-xbtn" data-bot-index="' + i + '" title="' + _t('remove_bot') + '">✕</button>';
        } else if (disconnected) {
          tagsHtml += '<span class="waiting-slot-badge" style="background:#fff3e0;color:#e67e22">📱 ' + _t('in_lobby') + '</span>';
        } else if (player.ready) {
          tagsHtml += '<span class="waiting-slot-badge ready">✓ ' + _t('ready_status') + '</span>';
        } else {
          tagsHtml += '<span class="waiting-slot-badge">' + _t('not_ready') + '</span>';
        }
        // 房主可移出真人玩家（不能踢自己/房主）
        if (isHost && !player.isBot && !player.isHost) {
          tagsHtml += '<button class="waiting-slot-xbtn" data-kick-index="' + i + '" title="' + _t('kick_player') + '">✕</button>';
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

    // Attach swap handlers — 一键直换：把该座位与下一位（顺时针）对调，不弹选择框
    slots.querySelectorAll('.waiting-slot-swap').forEach(btn => {
      btn.addEventListener('click', function() {
        const from = parseInt(this.dataset.from, 10);
        const to = (from + 1) % maxSlots;
        if (to === from) return;
        send('swap_seat', { fromIndex: from, toIndex: to });
      });
    });

    // Attach remove-bot / kick handlers (host only) — 按钮统一为 .waiting-slot-xbtn,用 data 属性区分
    // 破坏性操作必须确认,避免在 ⇅ 换位按钮旁边误触 ✕ 造成"电脑消失"
    slots.querySelectorAll('.waiting-slot-xbtn[data-bot-index]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!window.confirm(_t('confirm_remove_bot'))) return;
        const botIndex = parseInt(this.dataset.botIndex, 10);
        send('remove_bot', { botIndex });
      });
    });
    slots.querySelectorAll('.waiting-slot-xbtn[data-kick-index]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!window.confirm(_t('confirm_kick_player'))) return;
        const kickIndex = parseInt(this.dataset.kickIndex, 10);
        send('kick_player', { playerIndex: kickIndex });
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
      } else if (game === 'doudizhu') {
        optionsEl.style.display = 'block';
        var bm = roomOptions.bidMode || 'rob';
        var fc = roomOptions.firstCaller || 'random';
        var pt = roomOptions.playTimeLimit || 20;
        var tr = roomOptions.totalRounds || 3;
        if (isHost) {
          var timeOpts = [10, 20, 60, 300];
          var roundOpts = [3, 6, 9, 12];
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:10px;">' + _t('game_settings') + '</div>' +
            // Row 1: 叫地主方式
            '<div style="display:grid;grid-template-columns:80px 1fr;gap:6px;margin-bottom:10px;font-size:13px;">' +
              '<div style="font-weight:600;padding-top:4px;">' + _t('ddz_bid_mode') + '</div>' +
              '<div style="display:flex;gap:16px;">' +
                '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;">' +
                  '<input type="radio" name="ddzBidMode" value="rob"' + (bm === 'rob' ? ' checked' : '') + ' onchange="window._setGameOption(\'bidMode\',this.value)">' + _t('ddz_bid_mode_rob') + '</label>' +
                '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;">' +
                  '<input type="radio" name="ddzBidMode" value="score"' + (bm === 'score' ? ' checked' : '') + ' onchange="window._setGameOption(\'bidMode\',this.value)">' + _t('ddz_bid_mode_score') + '</label>' +
              '</div>' +
            '</div>' +
            // Row 2: 先叫规则
            '<div style="display:grid;grid-template-columns:80px 1fr;gap:6px;margin-bottom:10px;font-size:13px;">' +
              '<div style="font-weight:600;padding-top:4px;">' + _t('ddz_first_caller') + '</div>' +
              '<div style="display:flex;gap:16px;">' +
                '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;">' +
                  '<input type="radio" name="ddzFirstCaller" value="random"' + (fc === 'random' ? ' checked' : '') + ' onchange="window._setGameOption(\'firstCaller\',this.value)">' + _t('ddz_first_caller_random') + '</label>' +
                '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;">' +
                  '<input type="radio" name="ddzFirstCaller" value="winner"' + (fc === 'winner' ? ' checked' : '') + ' onchange="window._setGameOption(\'firstCaller\',this.value)">' + _t('ddz_first_caller_winner') + '</label>' +
              '</div>' +
            '</div>' +
            // Row 4: 出牌时长
            '<div style="display:grid;grid-template-columns:80px 1fr;gap:6px;margin-bottom:10px;font-size:13px;">' +
              '<div style="font-weight:600;padding-top:4px;">' + _t('ddz_play_time') + '</div>' +
              '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
                timeOpts.map(function(t) {
                  return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;">' +
                    '<input type="radio" name="ddzPlayTime" value="' + t + '"' + (pt === t ? ' checked' : '') + ' onchange="window._setGameOption(\'playTimeLimit\',' + t + ')">' +
                    _t('ddz_play_time_' + t) + '</label>';
                }).join('') +
              '</div>' +
            '</div>' +
            // Row 5: 总局数
            '<div style="display:grid;grid-template-columns:80px 1fr;gap:6px;font-size:13px;">' +
              '<div style="font-weight:600;padding-top:4px;">' + _t('ddz_total_rounds') + '</div>' +
              '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
                roundOpts.map(function(n) {
                  return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;">' +
                    '<input type="radio" name="ddzTotalRounds" value="' + n + '"' + (tr === n ? ' checked' : '') + ' onchange="window._setGameOption(\'totalRounds\',' + n + ')">' +
                    _t('ddz_total_rounds_' + n) + '</label>';
                }).join('') +
              '</div>' +
            '</div>';
        } else {
          var timeLabel = _t('ddz_play_time_' + pt) || (pt + _t('seconds'));
          var roundsLabel = _t('ddz_total_rounds_' + tr) || (tr + _t('rounds'));
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">' + _t('game_settings') + '</div>' +
            '<div style="font-size:13px;color:var(--text-muted)">' +
              _t('ddz_bid_mode') + ': ' + (bm === 'rob' ? _t('ddz_bid_mode_rob') : _t('ddz_bid_mode_score')) + ' ・ ' +
              _t('ddz_play_time') + ': ' + timeLabel + ' ・ ' +
              _t('ddz_total_rounds') + ': ' + roundsLabel +
            '</div>';
        }
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
      } else if (game === 'werewolf') {
        optionsEl.style.display = 'block';
        var wwSpeech = roomOptions.speechTime || 60;
        var wwSheriff = roomOptions.sheriff !== false;
        var wwTalk = roomOptions.talkMode === 'chat' ? 'chat' : 'face';
        var wwDiscuss = roomOptions.discussTime !== undefined ? roomOptions.discussTime : 60;
        var wwDiscussLabel = function(v) { return v ? v + _t('seconds') : _t('ww_off'); };
        var wwHead = '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + _t('game_settings') + '</div>';
        var wwHint = '<div style="font-size:12px;color:var(--text-muted);margin-top:6px;line-height:1.5;">' + _t('ww_setup_hint') + '</div>';
        if (isHost) {
          var wwSel = 'background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:14px;';
          var wwOpts = '';
          [30, 60, 90, 120, 180].forEach(function(v) { wwOpts += '<option value="' + v + '"' + (wwSpeech === v ? ' selected' : '') + '>' + v + _t('seconds') + '</option>'; });
          var wwDisOpts = '';
          [0, 60, 120, 180].forEach(function(v) { wwDisOpts += '<option value="' + v + '"' + (wwDiscuss === v ? ' selected' : '') + '>' + wwDiscussLabel(v) + '</option>'; });
          optionsEl.innerHTML = wwHead +
            '<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:14px;">' +
              '<label style="display:flex;align-items:center;gap:6px;">' + _t('ww_talk_mode') + ' <select onchange="window._setGameOption(\'talkMode\', this.value)" style="' + wwSel + '">' +
                '<option value="face"' + (wwTalk === 'face' ? ' selected' : '') + '>' + _t('ww_talk_face') + '</option><option value="chat"' + (wwTalk === 'chat' ? ' selected' : '') + '>' + _t('ww_talk_chat') + '</option></select></label>' +
              '<label style="display:flex;align-items:center;gap:6px;">' + _t('ww_discuss_time') + ' <select onchange="window._setGameOption(\'discussTime\', parseInt(this.value))" style="' + wwSel + '">' + wwDisOpts + '</select></label>' +
              '<label style="display:flex;align-items:center;gap:6px;">' + _t('ww_speech_time') + ' <select onchange="window._setGameOption(\'speechTime\', parseInt(this.value))" style="' + wwSel + '">' + wwOpts + '</select></label>' +
              '<label style="display:flex;align-items:center;gap:6px;">' + _t('ww_sheriff_opt') + ' <select onchange="window._setGameOption(\'sheriff\', this.value === \'1\')" style="' + wwSel + '">' +
                '<option value="1"' + (wwSheriff ? ' selected' : '') + '>' + _t('ww_on') + '</option><option value="0"' + (wwSheriff ? '' : ' selected') + '>' + _t('ww_off') + '</option></select></label>' +
            '</div>' + wwHint;
        } else {
          optionsEl.innerHTML = wwHead + '<div style="font-size:13px;color:var(--text-muted)">' + _t('ww_talk_mode') + ': ' + _t(wwTalk === 'chat' ? 'ww_talk_chat' : 'ww_talk_face') +
            ' · ' + _t('ww_discuss_time') + ': ' + wwDiscussLabel(wwDiscuss) + ' · ' + _t('ww_speech_time') + ': ' + wwSpeech + _t('seconds') +
            ' · ' + _t('ww_sheriff_opt') + ': ' + _t(wwSheriff ? 'ww_on' : 'ww_off') + '</div>' + wwHint;
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
      } else if (isHost && game === 'reversi') {
        optionsEl.style.display = 'block';
        var bs = roomOptions.boardSize || 8;
        var rvDiff = roomOptions.difficulty || 'normal';
        optionsEl.innerHTML =
          '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + _t('game_settings') + '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:14px;">' +
            '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">' +
              _t('ec_board_size') + ': <select onchange="window._setGameOption(\'boardSize\', parseInt(this.value))" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:14px;">' +
                '<option value="8"' + (bs === 8 ? ' selected' : '') + '>8×8</option>' +
                '<option value="10"' + (bs === 10 ? ' selected' : '') + '>10×10</option>' +
                '<option value="12"' + (bs === 12 ? ' selected' : '') + '>12×12</option>' +
              '</select>' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">' +
              _t('difficulty_label') + ': <select onchange="window._setGameOption(\'difficulty\', this.value)" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:14px;">' +
                '<option value="easy"' + (rvDiff === 'easy' ? ' selected' : '') + '>' + _t('difficulty_easy') + '</option>' +
                '<option value="normal"' + (rvDiff === 'normal' ? ' selected' : '') + '>' + _t('difficulty_normal') + '</option>' +
                '<option value="hard"' + (rvDiff === 'hard' ? ' selected' : '') + '>' + _t('difficulty_hard') + '</option>' +
              '</select>' +
            '</label>' +
          '</div>';
      } else if (game === 'reversi') {
        optionsEl.style.display = 'block';
        var bs2 = roomOptions.boardSize || 8;
        var rvDiff2 = roomOptions.difficulty || 'normal';
        var rvDiffLabel2 = rvDiff2 === 'easy' ? _t('difficulty_easy') : rvDiff2 === 'hard' ? _t('difficulty_hard') : _t('difficulty_normal');
        optionsEl.innerHTML =
          '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">' + _t('game_settings') + '</div>' +
          '<div style="font-size:13px;color:var(--text-muted)">' + _t('ec_board_size') + ': ' + bs2 + '×' + bs2 + ' · ' + _t('difficulty_label') + ': ' + rvDiffLabel2 + '</div>';
      } else if (game === 'mahjong-sichuan') {
        optionsEl.style.display = 'block';
        var mjMode = roomOptions.mahjongMode || 'sichuan';
        // Helper: build a toggle checkbox line + optional muted description
        function mjToggle(key, labelKey) {
          var checked = roomOptions[key] === true || roomOptions[key] === 'true';
          var desc = _t(labelKey + '_desc');
          var descHtml = (desc && desc !== labelKey + '_desc')
            ? '<div style="font-size:12px;color:var(--text-muted);margin:-2px 0 6px 24px;line-height:1.4;">' + desc + '</div>'
            : '';
          return '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-bottom:6px;">' +
            '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="window._setGameOption(\'' + key + '\', this.checked)" style="width:16px;height:16px;cursor:pointer;">' +
            _t(labelKey) +
            '</label>' + descHtml;
        }
        if (isHost) {
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + _t('game_settings') + '</div>' +
            '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;margin-bottom:10px;">' +
              _t('mahjong_mode') + ': <select onchange="window._setGameOption(\'mahjongMode\', this.value)" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:14px;">' +
                '<option value="sichuan"' + (mjMode === 'sichuan' ? ' selected' : '') + '>' + _t('mahjong_mode_sichuan') + '</option>' +
                '<option value="cantonese"' + (mjMode === 'cantonese' ? ' selected' : '') + '>' + _t('mahjong_mode_cantonese') + '</option>' +
              '</select>' +
            '</label>' +
            (mjMode === 'sichuan' ? '<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;">' +
              '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-muted);">' + _t('mj_rules_title') + '</div>' +
              mjToggle('mj_bloodBattle', 'mj_rule_bloodBattle') +
              mjToggle('mj_multiWinner', 'mj_rule_multiWinner') +
              mjToggle('mj_rain', 'mj_rule_rain') +
              mjToggle('mj_checkFlowerPig', 'mj_rule_checkFlowerPig') +
              mjToggle('mj_checkBigCall', 'mj_rule_checkBigCall') +
              mjToggle('mj_lastFourAutoWin', 'mj_rule_lastFourAutoWin') +
              mjToggle('mj_swapThree', 'mj_rule_swapThree') +
            '</div>' : mjMode === 'cantonese' ? '<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;">' +
              '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-muted);">' + _t('mj_rules_cantonese') + '</div>' +
              mjToggle('mj_buyTiles', 'mj_rule_buyTiles') +
              mjToggle('mj_wildcard', 'mj_rule_wildcard') +
              '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-bottom:6px;">' +
                _t('mj_rule_maxFan') + ': ' +
                '<select onchange="window._setGameOption(\'mj_maxFan\', parseInt(this.value))" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:13px;">' +
                  '<option value="0"' + (roomOptions.mj_maxFan === 0 || !roomOptions.mj_maxFan ? ' selected' : '') + '>' + _t('mj_fan_nolimit') + '</option>' +
                  '<option value="3"' + (roomOptions.mj_maxFan === 3 ? ' selected' : '') + '>' + tf('mj_fan_n', 3) + '</option>' +
                  '<option value="4"' + (roomOptions.mj_maxFan === 4 ? ' selected' : '') + '>' + tf('mj_fan_n', 4) + '</option>' +
                  '<option value="5"' + (roomOptions.mj_maxFan === 5 ? ' selected' : '') + '>' + tf('mj_fan_n', 5) + '</option>' +
                '</select>' +
              '</label>' +
              '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-bottom:6px;">' +
                _t('mj_rule_minFan') + ': ' +
                '<select onchange="window._setGameOption(\'mj_minFan\', parseInt(this.value))" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:13px;">' +
                  '<option value="0"' + (roomOptions.mj_minFan === 0 || !roomOptions.mj_minFan ? ' selected' : '') + '>' + _t('mj_fan_chicken') + '</option>' +
                  '<option value="1"' + (roomOptions.mj_minFan === 1 ? ' selected' : '') + '>' + tf('mj_fan_n', 1) + '</option>' +
                  '<option value="3"' + (roomOptions.mj_minFan === 3 ? ' selected' : '') + '>' + tf('mj_fan_n', 3) + '</option>' +
                '</select>' +
              '</label>' +
            '</div>' : '');
        } else {
          var onOff = function(k) { return (roomOptions[k] === true || roomOptions[k] === 'true') ? '✓' : '—'; };
          var maxFanLabel = function(v) { return v ? tf('mj_fan_n', v) : _t('mj_fan_nolimit'); };
          optionsEl.innerHTML =
            '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">' + _t('game_settings') + '</div>' +
            '<div style="font-size:13px;color:var(--text-muted)">' + _t('mahjong_mode') + ': ' +
              (mjMode === 'cantonese' ? _t('mahjong_mode_cantonese') : _t('mahjong_mode_sichuan')) + '</div>' +
            (mjMode === 'sichuan' ? '<div style="font-size:12px;color:var(--text-muted);margin-top:6px;line-height:1.8;">' +
              '<div style="font-weight:600;margin-bottom:2px;">' + _t('mj_rules_title') + '</div>' +
              _t('mj_rule_bloodBattle') + ': ' + onOff('mj_bloodBattle') + '<br>' +
              _t('mj_rule_multiWinner') + ': ' + onOff('mj_multiWinner') + '<br>' +
              _t('mj_rule_rain') + ': ' + onOff('mj_rain') + '<br>' +
              _t('mj_rule_checkFlowerPig') + ': ' + onOff('mj_checkFlowerPig') + '<br>' +
              _t('mj_rule_checkBigCall') + ': ' + onOff('mj_checkBigCall') + '<br>' +
              _t('mj_rule_lastFourAutoWin') + ': ' + onOff('mj_lastFourAutoWin') + '<br>' +
              _t('mj_rule_swapThree') + ': ' + onOff('mj_swapThree') +
            '</div>' : mjMode === 'cantonese' ? '<div style="font-size:12px;color:var(--text-muted);margin-top:6px;line-height:1.8;">' +
              '<div style="font-weight:600;margin-bottom:2px;">' + _t('mj_rules_cantonese') + '</div>' +
              _t('mj_rule_buyTiles') + ': ' + onOff('mj_buyTiles') + '<br>' +
              _t('mj_rule_wildcard') + ': ' + onOff('mj_wildcard') + '<br>' +
              _t('mj_rule_maxFan') + ': ' + maxFanLabel(roomOptions.mj_maxFan) + '<br>' +
              _t('mj_rule_minFan') + ': ' + (roomOptions.mj_minFan ? tf('mj_fan_n', roomOptions.mj_minFan) : _t('mj_fan_chicken')) +
            '</div>' : '');
        }
      } else if (isHost && gameInfo.supportsAI && window._gamesWithDifficulty.indexOf(game) >= 0) {
        // AI difficulty selector only for games whose bots actually read it
        optionsEl.style.display = 'block';
        var curDiff = roomOptions.difficulty || 'normal';
        optionsEl.innerHTML =
          '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + _t('game_settings') + '</div>' +
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;">' +
            _t('difficulty_label') + ': <select id="optDifficulty" onchange="window._setGameOption(\'difficulty\', this.value)" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:14px;">' +
              '<option value="easy"' + (curDiff === 'easy' ? ' selected' : '') + '>' + _t('difficulty_easy') + '</option>' +
              '<option value="normal"' + (curDiff === 'normal' ? ' selected' : '') + '>' + _t('difficulty_normal') + '</option>' +
              '<option value="hard"' + (curDiff === 'hard' ? ' selected' : '') + '>' + _t('difficulty_hard') + '</option>' +
            '</select>' +
          '</label>';
      } else if (!isHost && gameInfo.supportsAI && window._gamesWithDifficulty.indexOf(game) >= 0) {
        // Non-host: show difficulty summary
        optionsEl.style.display = 'block';
        var curDiff2 = roomOptions.difficulty || 'normal';
        var diffLabel = curDiff2 === 'easy' ? _t('difficulty_easy') : curDiff2 === 'hard' ? _t('difficulty_hard') : _t('difficulty_normal');
        optionsEl.innerHTML =
          '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">' + _t('game_settings') + '</div>' +
          '<div style="font-size:13px;color:var(--text-muted)">' + _t('difficulty_label') + ': ' + diffLabel + '</div>';
      } else {
        optionsEl.style.display = 'none';
      }
      // 棋类多局制：局数选项追加在上面的设置之后，默认一局
      if (SIDE_LAYOUT_GAMES.indexOf(game) !== -1) {
        var bo = roomOptions.bestOf || 1;
        if (optionsEl.style.display === 'none') {
          optionsEl.innerHTML = '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + _t('game_settings') + '</div>';
          optionsEl.style.display = 'block';
        }
        var boHtml;
        if (isHost) {
          boHtml = '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">' + _t('best_of_label') + ': <select onchange="window._setGameOption(\'bestOf\', parseInt(this.value))" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:14px;">';
          [1, 3, 5].forEach(function(n) { boHtml += '<option value="' + n + '"' + (bo === n ? ' selected' : '') + '>' + _t('best_of_' + n) + '</option>'; });
          boHtml += '</select></label>';
        } else {
          boHtml = '<span style="font-size:13px;color:var(--text-muted)">' + _t('best_of_label') + ': ' + _t('best_of_' + bo) + '</span>';
        }
        optionsEl.insertAdjacentHTML('beforeend', '<div style="margin-top:8px;font-size:14px;">' + boHtml + '</div>');
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
        const minPlayers = SOLO_GAMES.indexOf(game) >= 0 ? 1 : 2;
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
      const minNeeded = SOLO_GAMES.indexOf(game) >= 0 ? 1 : 2;
      if (allReady && totalPlayers >= minNeeded) {
        waitingStatus.textContent = isHost ? _t('all_ready_start') : _t('waiting_host_start');
      } else {
        waitingStatus.textContent = _t('waiting_all_ready');
      }
    }
  }

  // ---- Player Bar (during game) ----
  let _playerTooltip = null;
  let _playerTooltipTimer = null;

  function ensurePlayerTooltip() {
    if (_playerTooltip) return;
    _playerTooltip = document.createElement('div');
    _playerTooltip.id = 'playerTooltip';
    _playerTooltip.style.cssText = 'position:fixed;z-index:9999;padding:6px 14px;background:#333;color:#fff;font-size:13px;font-weight:600;border-radius:16px;pointer-events:none;opacity:0;transition:opacity 0.15s;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(_playerTooltip);
    // Hide on scroll or tap elsewhere
    document.addEventListener('click', hidePlayerTooltip, true);
    document.addEventListener('touchstart', hidePlayerTooltip, true);
  }

  function showPlayerTooltip(name, el) {
    if (_playerTooltipTimer) clearTimeout(_playerTooltipTimer);
    var rect = el.getBoundingClientRect();
    _playerTooltip.textContent = name;
    _playerTooltip.style.opacity = '1';
    // Position above the element
    var tx = rect.left + rect.width / 2;
    var ty = rect.top - 36;
    _playerTooltip.style.left = tx + 'px';
    _playerTooltip.style.top = ty + 'px';
    _playerTooltip.style.transform = 'translateX(-50%)';
    _playerTooltipTimer = setTimeout(hidePlayerTooltip, 2000);
  }

  function hidePlayerTooltip() {
    if (_playerTooltip) _playerTooltip.style.opacity = '0';
    if (_playerTooltipTimer) { clearTimeout(_playerTooltipTimer); _playerTooltipTimer = null; }
  }

  function updatePlayerBar() {
    const bar = el.playerBar;
    bar.innerHTML = '';
    if (!players) return;
    // Ensure the tooltip div exists once
    ensurePlayerTooltip();
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const tag = document.createElement('div');
      tag.className = 'player-tag p' + p.index;
      if (state && state.currentPlayer === p.index) tag.classList.add('active');
      const avatar = p.avatar || (p.isBot ? '\u{1F916}' : '\u{1F60A}');
      tag.innerHTML = '<span class="dot"></span><span class="player-tag-avatar">' + avatar + '</span><span class="player-tag-name">' + p.name + (p.isBot ? ' \u{1F916}' : '') + '</span>';
      // Tap to show name tooltip (works on touch + mouse)
      tag.addEventListener('click', function(e) {
        e.stopPropagation();
        showPlayerTooltip(p.name, tag);
      });
      bar.appendChild(tag);
      if (i < players.length - 1) {
        const vs = document.createElement('span');
        vs.className = 'vs-text'; vs.textContent = 'VS'; bar.appendChild(vs);
      }
    }
    // Overflowing bar (many players): bring whoever is acting into view
    const act = bar.querySelector('.player-tag.active');
    if (act && bar.scrollWidth > bar.clientWidth) {
      const br = bar.getBoundingClientRect(), ar = act.getBoundingClientRect();
      bar.scrollLeft += (ar.left + ar.width / 2) - (br.left + br.width / 2);
    }
    if (!state || state.winner == null) {
      const st = el.status;
      st.classList.remove('my-turn');
      if (players.length < 2) st.textContent = _t('waiting_players');
      else if (state && state.currentPlayer === playerIndex) {
        st.textContent = _t('your_turn');
        st.classList.add('my-turn');
      }
      else if (state && state.currentPlayer >= 0) st.textContent = _t('opponent_turn');
      else if (state) st.textContent = _t('realtime_race');
      // These renderers draw their own whose-turn header; the generic line would be wrong for them.
      if (game === 'sanguo' || game === 'werewolf') st.style.display = 'none';
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
  // 麻将只有一个大厅入口（mahjong-sichuan），四川/广东是房间内的模式。
  // 渲染器必须跟着模式走，否则广东局会套用四川界面：出现不该有的定缺提示，
  // 而买码翻牌动画（只存在于广东渲染器里）永远不会显示。
  function rendererKeyFor(g) {
    if (g !== 'mahjong-sichuan') return g;
    // 兜底：_buyTiles 是广东 playerView 独有字段，房间选项还没同步到时也能判对
    var isCantonese = roomOptions.mahjongMode === 'cantonese' ||
      (state && state._buyTiles !== undefined);
    return isCantonese ? 'mahjong-cantonese' : 'mahjong-sichuan';
  }

  // 「查看规则」按钮也要按模式取教程：sessionStorage 里存的是大厅入口 id，
  // 直接用它会让广东局弹出四川教程（开头就是定缺）。
  window._effectiveGameKey = function() {
    return rendererKeyFor(game);
  };

  // ---- Side info for board games: match score, captures, recent moves ----
  var CHESS_FIG = [{ K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' }, { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }];
  var XQ_NAME = [{ K: '帅', A: '仕', E: '相', H: '马', R: '车', C: '炮', P: '兵' }, { K: '将', A: '士', E: '象', H: '马', R: '车', C: '炮', P: '卒' }];
  var CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  function esc(v) { return String(v).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Which side made move i, and the stone/piece colour class for that side
  function moveSide(m, i) {
    if (game === 'chess') return i % 2;
    if (m.piece && m.piece.side != null) return m.piece.side;
    if (m.player != null) return m.player;
    return m.side != null ? m.side : i % 2;
  }
  function sideClass(side) {
    if (game === 'chess') return side === 0 ? 'w' : 'b';
    if (game === 'checkers' || game === 'chinesechess') return side === 0 ? 'r' : 'b';
    return side === 0 ? 'b' : 'w'; // reversi / go9 / gomoku: player 0 plays black
  }
  function sq(p) {
    var size = (state && state.boardSize) || (game === 'go9' ? 9 : game === 'gomoku' ? 15 : 8);
    return 'ABCDEFGHJKLMNOP'.charAt(p.col) + (size - p.row);
  }
  // Traditional xiangqi notation, e.g. 炮二平五 / 马8进7
  function xqNotation(m) {
    var side = m.piece.side, t = m.piece.type;
    var file = function(c) { return side === 0 ? CN_NUM[9 - c] : String(c + 1); };
    var dist = function(n) { return side === 0 ? CN_NUM[n] : String(n); };
    var fwd = side === 0 ? m.toRow < m.fromRow : m.toRow > m.fromRow;
    var act, val;
    if (m.toRow === m.fromRow) { act = '平'; val = file(m.toCol); }
    else {
      act = fwd ? '进' : '退';
      val = (t === 'H' || t === 'E' || t === 'A') ? file(m.toCol) : dist(Math.abs(m.toRow - m.fromRow));
    }
    return XQ_NAME[side][t] + file(m.fromCol) + act + val;
  }
  // One move → { text, note }; text is the move itself, note a short muted detail
  function moveText(m, i) {
    var side = moveSide(m, i);
    if (m.pass) return { text: _t('side_pass'), note: '' };
    if (game === 'chess') {
      var san = m.san || '';
      if (/^O-O/.test(san)) return { text: san, note: '' };
      var fig = /^[KQRBN]/.test(san) ? CHESS_FIG[side][san[0]] : CHESS_FIG[side].P;
      return { fig: fig, text: /^[KQRBN]/.test(san) ? san.slice(1) : san, note: '' };
    }
    if (game === 'chinesechess') return { text: xqNotation(m), note: m.captured ? tf('side_took', XQ_NAME[m.captured.side][m.captured.type]) : '' };
    if (game === 'checkers') return { text: sq(m.from) + ' → ' + sq(m.to), note: m.captures && m.captures.length ? tf('side_took_n', m.captures.length) : '' };
    if (game === 'reversi') return { text: sq(m), note: m.flips ? tf('side_flipped', m.flips.length) : '' };
    if (game === 'go9') return { text: sq(m), note: m.captured ? tf('side_took_n', m.captured) : '' };
    return { text: sq(m), note: '' };
  }

  function updateStageInfo() {
    var box = document.getElementById('stageInfo');
    if (!box) return;
    if (SIDE_LAYOUT_GAMES.indexOf(game) === -1 || !state) { box.style.display = 'none'; return; }
    var name = function(i) { return i === playerIndex ? _t('you') : window.getPlayerName(i); };
    var stone = function(side) { return '<i class="si-stone ' + sideClass(side) + '"></i>'; };
    var html = '';
    if (match && match.bestOf > 1) {
      var me = playerIndex === 1 ? 1 : 0; // your score always on the left
      var gameNo = Math.min(match.played + (state.winner == null ? 1 : 0), match.bestOf);
      html += '<div class="si-block si-match"><div class="si-title">' + _t('best_of_' + match.bestOf) + ' · ' + tf('match_game_n', gameNo) + '</div>' +
        '<div class="si-score"><span>' + esc(name(me)) + '</span><b>' + match.wins[me] + ' : ' + match.wins[1 - me] + '</b><span>' + esc(name(1 - me)) + '</span></div></div>';
    }
    var hist = state.moveHistory || [];
    // Counts shown on phones too (pieces for reversi, captures for checkers); chess/xiangqi captures are desktop only
    var countTitle = '', counts = null, capRow = '';
    if (game === 'reversi' && state.scores) {
      countTitle = _t('side_pieces'); counts = [state.scores[0], state.scores[1]];
    } else if (game === 'checkers') {
      countTitle = _t('side_captured'); counts = [0, 0];
      hist.forEach(function(m) { if (m.piece && m.captures) counts[m.piece.side] += m.captures.length; });
    } else if (game === 'chess' || game === 'chinesechess') {
      var caps = ['', ''];
      hist.forEach(function(m, i) {
        if (!m.captured) return;
        var s0 = moveSide(m, i);
        caps[s0] += game === 'chess' ? CHESS_FIG[1 - s0][m.captured.toUpperCase()] : XQ_NAME[m.captured.side][m.captured.type];
      });
      capRow = '<div class="si-title">' + _t('side_captured') + '</div>' +
        '<div class="si-cap">' + stone(0) + '<span>' + (caps[0] || '—') + '</span></div><div class="si-cap">' + stone(1) + '<span>' + (caps[1] || '—') + '</span></div>';
    }
    if (counts) {
      html += '<div class="si-block si-count"><div class="si-title">' + countTitle + '</div><div class="si-row">' +
        '<span>' + stone(0) + esc(name(0)) + ' <b>' + counts[0] + '</b></span><span><b>' + counts[1] + '</b> ' + esc(name(1)) + stone(1) + '</span></div></div>';
    } else if (capRow) {
      html += '<div class="si-block">' + capRow + '</div>';
    }
    var recent = '';
    for (var i = hist.length - 1; i >= Math.max(0, hist.length - 12); i--) {
      var mt = moveText(hist[i], i);
      recent += '<li><span class="si-n">' + (i + 1) + '</span>' + stone(moveSide(hist[i], i)) +
        '<span class="si-mv">' + (mt.fig ? '<span class="si-fig">' + mt.fig + '</span>' : '') + esc(mt.text) + '</span>' + (mt.note ? '<span class="si-note">' + esc(mt.note) + '</span>' : '') + '</li>';
    }
    html += '<div class="si-block si-moves"><div class="si-title">' + _t('side_moves') + '</div>' +
      (recent ? '<ol>' + recent + '</ol>' : '<div class="si-empty">' + _t('side_no_moves') + '</div>') + '</div>';
    var prevH = box.offsetHeight;
    box.innerHTML = html;
    box.style.display = '';
    // 信息栏高度变了（比如比分卡出现）会挤占棋盘上方空间，让棋盘重新量尺寸
    if (box.offsetHeight !== prevH) window.dispatchEvent(new Event('resize'));
  }

  function renderGame() {
    if (!state) return;
    var key = rendererKeyFor(game);
    if (!currentRenderer || currentRendererKey !== key) {
      if (typeof unregisterAllActions === 'function') unregisterAllActions();
      currentRenderer = window.gameRenderers.get(key);
      currentRendererKey = key;
      el.boardArea.innerHTML = '';
      if (currentRenderer && currentRenderer.init) currentRenderer.init(el.boardArea);
    }
    window.gamePlayers = players;
    if (currentRenderer) currentRenderer.render(state, el.boardArea, playerIndex, state.winner);
    updateStageInfo();
    if (state.winner !== null && state.winner !== undefined) showResult(state.winner);
  }

  function showResult(winner) {
    if (game === 'mahjong-sichuan' || game === 'mahjong-cantonese') return;
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
    } else if (game === 'sanguo' && state && state.winners) {
      // -2 lord side, -3 rebels, -4 spy; winners lists the winning seats
      isWin = state.winners.indexOf(playerIndex) >= 0;
      txt = isWin ? _t('you_win') : _t('you_lose');
      sub = _t(winner === -2 ? 'sg_win_lord' : winner === -3 ? 'sg_win_rebel' : 'sg_win_spy');
    } else if (game === 'werewolf' && state && state.roles) {
      // -2 wolves win, -3 village wins
      var wolfSide = state.roles[playerIndex] === 'wolf';
      isWin = winner === -2 ? wolfSide : !wolfSide;
      txt = isWin ? _t('you_win') : _t('you_lose');
      sub = _t(winner === -2 ? 'ww_win_wolf' : 'ww_win_good');
    } else {
      isWin = (winner === playerIndex);
      txt = isWin ? _t('you_win') : _t('you_lose'); sub = '';
    }
    var inMatch = match && match.bestOf > 1 && SIDE_LAYOUT_GAMES.indexOf(game) !== -1;
    if (inMatch) {
      var me = playerIndex === 1 ? 1 : 0;
      var gameLine = _t('best_of_' + match.bestOf) + ' · ' + _t('match_score') + ' ' + match.wins[me] + ' : ' + match.wins[1 - me];
      if (match.over) {
        isWin = match.winner === playerIndex;
        txt = match.winner === -1 ? _t('match_draw') : isWin ? _t('match_you_win') : _t('match_you_lose');
      }
      sub = gameLine;
    }
    resultEl.textContent = txt;
    resultEl.classList.toggle('win-text', isWin);
    el.resultSub.textContent = sub;
    overlay.style.display = 'flex';
    var st = el.status;
    st.classList.remove('my-turn');
    st.textContent = isWin ? _t('you_win') : winner === -1 ? _t('draw') : _t('opponent_wins');

    // Reset the overlay buttons to their defaults for this fresh result screen.
    // (A previous game's _updateOverlayForNewGame may have changed them.)
    var accentBtn = overlay.querySelector('.btn-accent');
    if (accentBtn) {
      accentBtn.textContent = _t('play_again');
      accentBtn.onclick = function() { window.doRestart(); };
      // 比赛还没分出胜负：直接进下一局，不弹"确定重新开始"
      if (inMatch && !match.over) {
        accentBtn.textContent = _t('next_game');
        accentBtn.onclick = function() { window.doNextRound(); };
      }
    }
    pendingRestart = false;

    // Stays open until the player dismisses it, so the final board and score can be read.
    clearTimeout(resultCloseTimer);
  }

  var resultCloseTimer = null;

  // Called when the host starts a new round: replace "play again" with
  // "continue game" for non-host players. The overlay stays visible so the
  // player can press "continue" to dismiss it; the button now just hides the
  // overlay (the new game is already in progress server-side).
  window._updateOverlayForNewGame = function() {
    var accentBtn = el.overlay.querySelector('.btn-accent');
    if (accentBtn) {
      accentBtn.textContent = _t('continue_game');
      accentBtn.onclick = function() {
        el.overlay.style.display = 'none';
      };
    }
    clearTimeout(resultCloseTimer);
  };

  window.makeGameMove = function(data) {
    send('game_move', data);
  };

  var pendingRestart = false; // non-host clicked "play again", waiting for host

  window.doRestart = function() {
    // Host: confirm before restarting. Non-host: request host to restart.
    if (isHost) {
      if (!confirm(_t('restart_confirm'))) return;
      el.overlay.style.display = 'none';
      if (typeof window._beforeGameRestart === 'function') window._beforeGameRestart();
      send('game_restart');
    } else {
      if (pendingRestart) return;
      pendingRestart = true;
      showToast(_t('restart_wait_host'));
      send('request_restart', {});
      // Reset the flag after 10s so they can re-request.
      setTimeout(function() { pendingRestart = false; }, 10000);
    }
  };

  // 麻将结算界面的「下一局」：多局制的正常推进，不该弹"确定要重新开始"的警告框。
  // 非房主仍走请求房主的路径。
  window.doNextRound = function() {
    if (isHost) {
      el.overlay.style.display = 'none';
      if (typeof window._beforeGameRestart === 'function') window._beforeGameRestart();
      send('game_restart');
    } else {
      if (pendingRestart) return;
      pendingRestart = true;
      showToast(_t('restart_wait_host'));
      send('request_restart', {});
      setTimeout(function() { pendingRestart = false; }, 10000);
    }
  };

  window.closeResult = function() {
    el.overlay.style.display = 'none';
  };

  window.doReturnToRoom = function() {
    el.overlay.style.display = 'none';
    send('return_to_room');
  };

  window.doLeaveRoom = function() {
    if (typeof window._beforeLeaveRoom === 'function') window._beforeLeaveRoom();
    // 页面马上要 location.replace 跳走，showLobby() 不会执行，必须在这里主动解锁横屏
    setImmersiveLandscape(false);
    send('leave_room');
    // Keep roomId + resumeToken in sessionStorage so lobby shows the resume banner
    sessionStorage.setItem('_returnFromGame', '1');
    var shell = document.querySelector('.game-page-shell');
    if (shell) shell.classList.add('exit-anim');
    setTimeout(function() {
      window.location.replace('/');
    }, 350);
  };

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
