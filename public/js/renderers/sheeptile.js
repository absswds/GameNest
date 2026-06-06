// public/js/renderers/sheeptile.js — 羊了个羊
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var PATTERNS = ['🍎','🍊','🍋','🍇','🍓','🫐','🍑','🍒','🥝','🍍','🥥','🌸','⭐','💎','🔔','🔑','❄','🔥'];
  var PAT_BG = ['#ffe0e0','#ffe8cc','#fff9cc','#f0d8ff','#ffd8e4','#dce8ff','#ffd8cc','#ffe0ec',
                '#d8ffe4','#fff0cc','#f0f0f0','#ffd8f0','#fffacc','#d4f0ff','#fff0d4','#e8d4ff','#d8f8ff','#ffd4d4'];

  var canvas, ctx, state, playerIndex;
  var W, H, tW, tH;
  var COLS = 8, ROWS = 8, LAYERS = 3;
  var SLOT_SIZE = 7;
  var hoverTile = -1;

  function measure() {
    var avW = window.innerWidth - 16;
    var avH = window.innerHeight - 200;
    W = Math.min(avW, avH, 480);
    W = Math.max(W, 260);
    H = W;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    tW = (W - 8) / COLS;
    tH = tW;
  }

  function tileRect(tile) {
    var offX = tile.layer * tW * 0.45;
    var offY = tile.layer * tH * 0.45;
    return {
      x: tile.col * tW + offX + 4,
      y: tile.row * tH + offY + 4,
      w: tW - 2,
      h: tH - 2,
    };
  }

  function isBlocked(tile, board) {
    for (var i = 0; i < board.length; i++) {
      var t = board[i];
      if (t.removed || t.layer <= tile.layer) continue;
      var dr = Math.abs(t.row - tile.row + 0.45 * (t.layer - tile.layer));
      var dc = Math.abs(t.col - tile.col + 0.45 * (t.layer - tile.layer));
      if (dr < 1 && dc < 1) return true;
    }
    return false;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawBoard(board, slot) {
    ctx.clearRect(0, 0, W, H);
    // Background
    ctx.fillStyle = '#f5ede0';
    ctx.fillRect(0, 0, W, H);

    // Draw tiles layer by layer (bottom up)
    for (var layer = 0; layer < LAYERS; layer++) {
      for (var i = 0; i < board.length; i++) {
        var tile = board[i];
        if (tile.removed || tile.layer !== layer) continue;
        var r = tileRect(tile);
        var blocked = isBlocked(tile, board);
        var pat = tile.pattern;
        var bg = PAT_BG[pat % PAT_BG.length];
        var emoji = PATTERNS[pat % PATTERNS.length];

        // Shadow for higher layers
        if (layer > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          roundRect(r.x + 3, r.y + 3, r.w, r.h, 6);
          ctx.fill();
        }

        // Tile body
        var grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        grad.addColorStop(0, blocked ? '#d0d0d0' : '#fff');
        grad.addColorStop(0.2, blocked ? '#b8b8b8' : bg);
        grad.addColorStop(1, blocked ? '#aaa' : bg);
        ctx.fillStyle = grad;
        roundRect(r.x, r.y, r.w, r.h, 6);
        ctx.fill();

        // Border
        ctx.strokeStyle = blocked ? '#999' : 'rgba(0,0,0,0.15)';
        ctx.lineWidth = tile.id === hoverTile && !blocked ? 2.5 : 1;
        if (tile.id === hoverTile && !blocked) ctx.strokeStyle = '#c8a45c';
        roundRect(r.x, r.y, r.w, r.h, 6);
        ctx.stroke();

        // Blocked overlay
        if (blocked) {
          ctx.fillStyle = 'rgba(120,120,120,0.3)';
          roundRect(r.x, r.y, r.w, r.h, 6);
          ctx.fill();
        }

        // Emoji
        var fs = Math.max(10, tW * 0.55);
        ctx.font = fs + 'px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = blocked ? 0.4 : 1;
        ctx.fillText(emoji, r.x + r.w / 2, r.y + r.h / 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawSlot(slot, container) {
    var slotDiv = document.getElementById('sheep-slot');
    if (!slotDiv) return;
    slotDiv.innerHTML = '';
    for (var i = 0; i < SLOT_SIZE; i++) {
      var cell = document.createElement('div');
      cell.style.cssText = 'width:' + Math.floor(W / SLOT_SIZE - 4) + 'px;height:' + Math.floor(W / SLOT_SIZE - 4) + 'px;border-radius:6px;border:1.5px solid #ddd;background:#fff;display:flex;align-items:center;justify-content:center;font-size:' + Math.floor(W / SLOT_SIZE * 0.5) + 'px;flex-shrink:0;';
      if (slot[i]) {
        var bg2 = PAT_BG[slot[i].pattern % PAT_BG.length];
        cell.style.background = bg2;
        cell.style.borderColor = 'rgba(0,0,0,0.15)';
        cell.textContent = PATTERNS[slot[i].pattern % PATTERNS.length];
      }
      slotDiv.appendChild(cell);
    }
  }

  function getTileAt(mx, my, board) {
    // Check top layers first (higher layer = on top)
    for (var layer = LAYERS - 1; layer >= 0; layer--) {
      for (var i = 0; i < board.length; i++) {
        var tile = board[i];
        if (tile.removed || tile.layer !== layer) continue;
        var r = tileRect(tile);
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          return tile;
        }
      }
    }
    return null;
  }

  function getCanvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height),
    };
  }

  function wsSend(data) {
    window.sendMove && window.sendMove(data);
  }

  window.gameRenderers.set('sheeptile', {
    init: function (container) {
      container.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:6px;';
      container.appendChild(wrap);

      // Opponent scores bar
      var oppBar = document.createElement('div');
      oppBar.id = 'sheep-opp';
      oppBar.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap;justify-content:center;';
      wrap.appendChild(oppBar);

      canvas = document.createElement('canvas');
      canvas.style.cssText = 'border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.12);cursor:pointer;touch-action:none;';
      wrap.appendChild(canvas);
      ctx = canvas.getContext('2d');
      measure();
      window.addEventListener('resize', function () { measure(); if (state) drawBoard(state.boards[playerIndex], state.slots[playerIndex]); });

      // Slot bar
      var slotLabel = document.createElement('div');
      slotLabel.style.cssText = 'font-size:12px;color:var(--text-muted);margin:8px 0 4px;';
      slotLabel.textContent = '槽位（满7张出局）';
      wrap.appendChild(slotLabel);

      var slotDiv = document.createElement('div');
      slotDiv.id = 'sheep-slot';
      slotDiv.style.cssText = 'display:flex;gap:3px;';
      wrap.appendChild(slotDiv);

      // Power buttons
      var pwrDiv = document.createElement('div');
      pwrDiv.style.cssText = 'display:flex;gap:8px;margin-top:10px;';
      wrap.appendChild(pwrDiv);

      var undoBtn = document.createElement('button');
      undoBtn.className = 'btn';
      undoBtn.textContent = '↩ 撤回';
      undoBtn.onclick = function () { wsSend({ type: 'power_undo' }); };
      pwrDiv.appendChild(undoBtn);

      var shufBtn = document.createElement('button');
      shufBtn.className = 'btn';
      shufBtn.textContent = '🔀 洗牌';
      shufBtn.onclick = function () { wsSend({ type: 'power_shuffle' }); };
      pwrDiv.appendChild(shufBtn);

      // Canvas events
      canvas.addEventListener('mousemove', function (e) {
        if (!state || !state.boards) return;
        var pos = getCanvasPos(e);
        var tile = getTileAt(pos.x, pos.y, state.boards[playerIndex] || []);
        var newHover = tile && !isBlocked(tile, state.boards[playerIndex]) ? tile.id : -1;
        if (newHover !== hoverTile) { hoverTile = newHover; drawBoard(state.boards[playerIndex], state.slots[playerIndex]); }
      });
      canvas.addEventListener('mouseleave', function () { hoverTile = -1; if (state) drawBoard(state.boards[playerIndex], state.slots[playerIndex]); });
      canvas.addEventListener('click', function (e) {
        if (!state || !state.boards) return;
        var pos = getCanvasPos(e);
        var board = state.boards[playerIndex] || [];
        var tile = getTileAt(pos.x, pos.y, board);
        if (tile && !isBlocked(tile, board)) wsSend({ type: 'pick', tileId: tile.id });
      });
      canvas.addEventListener('touchend', function (e) {
        e.preventDefault();
        var touch = e.changedTouches[0];
        var pos = getCanvasPos(touch);
        var board = state && state.boards && state.boards[playerIndex] || [];
        var tile = getTileAt(pos.x, pos.y, board);
        if (tile && !isBlocked(tile, board)) wsSend({ type: 'pick', tileId: tile.id });
      });
    },

    render: function (st, container, pi, winner) {
      state = st;
      playerIndex = pi;
      if (!st || !st.boards || !st.boards[pi]) return;

      var board = st.boards[pi];
      var slot = st.slots[pi] || [];
      drawBoard(board, slot);
      drawSlot(slot, container);

      // Opponent bar
      var oppBar = document.getElementById('sheep-opp');
      if (oppBar) {
        oppBar.innerHTML = '';
        var players = window._players || [];
        for (var i = 0; i < (st._playerCount || 0); i++) {
          if (i === pi) continue;
          var pname = players[i] ? players[i].name : ('玩家' + (i + 1));
          var chip = document.createElement('div');
          var elim = st.eliminated && st.eliminated[i];
          var remaining = st.boards[i] ? st.boards[i].filter(function(t){return !t.removed;}).length : '?';
          chip.style.cssText = 'padding:4px 10px;border-radius:20px;font-size:12px;background:' + (elim ? '#fee' : '#f0f9f0') + ';color:' + (elim ? '#c00' : '#333') + ';border:1px solid ' + (elim ? '#fcc' : '#c0e8c0') + ';';
          chip.textContent = pname + ': ' + (elim ? '❌出局' : remaining + '张剩余');
          oppBar.appendChild(chip);
        }
      }

      // Status
      var statusEl = document.getElementById('status');
      if (statusEl) {
        if (winner !== null && winner !== undefined) {
          var wname = (window._players && window._players[winner]) ? window._players[winner].name : ('玩家' + (winner + 1));
          statusEl.textContent = winner === pi ? '🎉 你赢了！' : wname + ' 获胜！';
        } else if (st.eliminated && st.eliminated[pi]) {
          statusEl.textContent = '💀 槽位已满，你出局了';
        } else {
          var rem = board.filter(function(t){return !t.removed;}).length;
          statusEl.textContent = rem + ' 张牌剩余 · 槽位 ' + slot.length + '/' + SLOT_SIZE;
        }
      }
    },
  });
})();
