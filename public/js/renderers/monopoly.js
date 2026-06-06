// public/js/renderers/monopoly.js — 大富翁
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var BOARD_SIZE = 28;
  var BOARD_META = buildBoardMeta();
  var PLAYER_COLORS = ['#E74C3C','#3498DB','#2ECC71','#F39C12','#9B59B6','#1ABC9C'];
  var PLAYER_EMOJIS = ['🔴','🔵','🟢','🟡','🟣','🩵'];

  function buildBoardMeta() {
    // Minimal board metadata for rendering (matches server BOARD)
    var spaces = [
      { type: 'go',          name: 'GO\n出发', color: '#2ECC71' },
      { type: 'property',    name: '廉租房',   color: '#8B4513' },
      { type: 'chance',      name: '机会',      color: '#F1C40F' },
      { type: 'property',    name: '旧街道',   color: '#8B4513' },
      { type: 'tax',         name: '所得税',   color: '#E74C3C' },
      { type: 'railroad',    name: '北站',      color: '#555' },
      { type: 'property',    name: '东方路',   color: '#82C2FF' },
      { type: 'chance',      name: '机会',      color: '#F1C40F' },
      { type: 'property',    name: '南京路',   color: '#82C2FF' },
      { type: 'property',    name: '淮海路',   color: '#82C2FF' },
      { type: 'jail_visit',  name: '监狱\n探视', color: '#aaa' },
      { type: 'property',    name: '龙华寺',   color: '#FF69B4' },
      { type: 'utility',     name: '电力\n公司', color: '#aaa' },
      { type: 'property',    name: '新天地',   color: '#FF69B4' },
      { type: 'property',    name: '外滩',      color: '#FF69B4' },
      { type: 'railroad',    name: '南站',      color: '#555' },
      { type: 'property',    name: '豫园',      color: '#FFA500' },
      { type: 'chance',      name: '机会',      color: '#F1C40F' },
      { type: 'property',    name: '城隍庙',   color: '#FFA500' },
      { type: 'property',    name: '人民\n广场', color: '#FFA500' },
      { type: 'free_parking',name: '免费\n停车', color: '#27AE60' },
      { type: 'property',    name: '环球港',   color: '#FF0000' },
      { type: 'chance',      name: '机会',      color: '#F1C40F' },
      { type: 'property',    name: '徐汇\n滨江', color: '#FF0000' },
      { type: 'property',    name: '陆家嘴',   color: '#FF0000' },
      { type: 'railroad',    name: '西站',      color: '#555' },
      { type: 'property',    name: '浦东\n机场', color: '#FFDD00' },
      { type: 'property',    name: '迪士尼',   color: '#FFDD00' },
    ];
    return spaces;
  }

  // Layout: 28 spaces around a rectangle
  // Bottom row (left→right): 0-7 (8 spaces)
  // Right col (bottom→top): 8-13 (6 spaces)
  // Top row (right→left): 14-21 (8 spaces)
  // Left col (top→bottom): 22-27 (6 spaces)
  function spaceLayout(W, H, cellSize) {
    var positions = [];
    var cols = Math.floor(W / cellSize);
    var rows = Math.floor(H / cellSize);
    // Bottom: 0..cols-1
    for (var c = 0; c < cols; c++) positions.push({ x: c * cellSize, y: H - cellSize, idx: positions.length });
    // Right: cols..cols+rows-2
    for (var r = rows - 2; r >= 1; r--) positions.push({ x: W - cellSize, y: r * cellSize, idx: positions.length });
    // Top: right→left
    for (var c2 = cols - 1; c2 >= 0; c2--) positions.push({ x: c2 * cellSize, y: 0, idx: positions.length });
    // Left: 0→rows-2
    for (var r2 = 1; r2 < rows - 1; r2++) positions.push({ x: 0, y: r2 * cellSize, idx: positions.length });
    return positions;
  }

  var canvas, ctx, state, playerIndex;
  var W, H, CS; // canvas dims and cell size
  var positions = [];

  function resize(container) {
    var avW = Math.min(window.innerWidth - 12, 480);
    var avH = Math.min(window.innerHeight - 180, avW);
    // Make square
    W = Math.max(avW, 260);
    H = W;
    CS = Math.floor(W / 8);
    W = CS * 8; H = CS * 8; // ensure exact fit
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    positions = spaceLayout(W, H, CS);
  }

  function drawBoard(st) {
    ctx.clearRect(0, 0, W, H);
    // Background
    ctx.fillStyle = '#E8F5E9';
    ctx.fillRect(0, 0, W, H);

    // Center area
    ctx.fillStyle = '#C8E6C9';
    ctx.fillRect(CS, CS, W - 2 * CS, H - 2 * CS);
    ctx.font = 'bold ' + Math.floor(CS * 0.38) + 'px sans-serif';
    ctx.fillStyle = '#2E7D32'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('大 富 翁', W / 2, H / 2 - CS * 0.2);
    ctx.font = Math.floor(CS * 0.25) + 'px sans-serif';
    ctx.fillStyle = '#555';
    var curName = (window._players && window._players[st.currentPlayer]) ? window._players[st.currentPlayer].name : '玩家' + (st.currentPlayer + 1);
    ctx.fillText('当前：' + curName, W / 2, H / 2 + CS * 0.2);

    // Draw spaces
    for (var i = 0; i < Math.min(positions.length, BOARD_SIZE); i++) {
      var pos = positions[i];
      var meta = BOARD_META[i];
      if (!meta) continue;
      drawSpace(pos.x, pos.y, CS, i, meta, st);
    }

    // Draw player tokens
    var players = window._players || [];
    for (var p = 0; p < (st._playerCount || 0); p++) {
      if (st.eliminated && st.eliminated[p]) continue;
      var ppos = st.positions[p];
      if (ppos === undefined || ppos >= positions.length) continue;
      var spos = positions[ppos];
      var offset = p * 6;
      var tx = spos.x + CS / 2 + (p % 2 === 0 ? -CS * 0.18 : CS * 0.18);
      var ty = spos.y + CS / 2 + (p < 2 ? -CS * 0.18 : CS * 0.18);
      ctx.font = Math.floor(CS * 0.35) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(PLAYER_EMOJIS[p] || '🔴', tx, ty);
    }
  }

  function drawSpace(x, y, size, idx, meta, st) {
    // Background
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, size, size);

    // Color bar (top for top row, bottom for bottom, left/right for sides)
    var onBottom = y >= H - size - 1;
    var onTop = y <= 1;
    var onLeft = x <= 1;
    var onRight = x >= W - size - 1;
    var barSize = size * 0.22;
    ctx.fillStyle = meta.color || '#ccc';
    if (onBottom) ctx.fillRect(x, y + size - barSize, size, barSize);
    else if (onTop) ctx.fillRect(x, y, size, barSize);
    else if (onLeft) ctx.fillRect(x, y, barSize, size);
    else ctx.fillRect(x + size - barSize, y, barSize, size);

    // Name text
    var fs = Math.max(8, Math.floor(size * 0.17));
    ctx.fillStyle = '#333'; ctx.font = fs + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var lines = meta.name.split('\n');
    if (lines.length === 1) {
      ctx.fillText(meta.name, x + size / 2, y + size / 2);
    } else {
      lines.forEach(function (line, li) {
        ctx.fillText(line, x + size / 2, y + size / 2 + (li - (lines.length - 1) / 2) * (fs + 1));
      });
    }

    // Property ownership indicator
    var prop = st.properties && st.properties[idx];
    if (prop) {
      var oc = PLAYER_COLORS[prop.owner % PLAYER_COLORS.length];
      ctx.fillStyle = oc;
      ctx.beginPath(); ctx.arc(x + size * 0.78, y + size * 0.25, size * 0.1, 0, Math.PI * 2); ctx.fill();
      // Houses
      for (var h = 0; h < (prop.houses || 0); h++) {
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(x + size * 0.12 + h * size * 0.14, y + size * 0.35, size * 0.1, size * 0.12);
      }
    }
  }

  function buildActionPanel(container, st) {
    var panel = document.getElementById('mono-panel');
    if (!panel) return;
    panel.innerHTML = '';

    var pi = playerIndex;
    var isMyTurn = st.currentPlayer === pi;
    var cash = st.cash && st.cash[pi] !== undefined ? st.cash[pi] : 0;

    // Cash display
    var cashEl = document.createElement('div');
    cashEl.style.cssText = 'font-size:14px;font-weight:700;';
    cashEl.textContent = '💰 ' + cash + ' 元';
    panel.appendChild(cashEl);

    if (st.lastCard) {
      var cardEl = document.createElement('div');
      cardEl.style.cssText = 'font-size:12px;color:var(--accent);background:#fff9ee;padding:4px 10px;border-radius:8px;border:1px solid #f0d890;max-width:280px;text-align:center;';
      cardEl.textContent = '📋 ' + st.lastCard.text;
      panel.appendChild(cardEl);
    }

    if (!isMyTurn) {
      var waitEl = document.createElement('div');
      waitEl.style.cssText = 'color:var(--text-muted);font-size:13px;';
      var name = (window._players && window._players[st.currentPlayer]) ? window._players[st.currentPlayer].name : '对方';
      waitEl.textContent = '等待 ' + name + ' 操作…';
      panel.appendChild(waitEl);
      return;
    }

    if (st.inJail && st.inJail[pi]) {
      var jailEl = document.createElement('div');
      jailEl.style.cssText = 'font-size:12px;color:#e74c3c;';
      jailEl.textContent = '🔒 在监狱（' + (st.jailTurns[pi] || 0) + '/3回合）— 掷双数出狱';
      panel.appendChild(jailEl);
    }

    if (st.phase === 'waiting') {
      var rollBtn = document.createElement('button');
      rollBtn.className = 'btn btn-primary';
      rollBtn.textContent = '🎲 掷骰子';
      rollBtn.onclick = function () { wsSend({ type: 'roll' }); };
      panel.appendChild(rollBtn);
    }

    if (st.phase === 'landed' && st.pendingAction === 'can_buy') {
      var pos2 = st.positions[pi];
      var space2 = BOARD_META[pos2];
      var buyBtn = document.createElement('button');
      buyBtn.className = 'btn btn-primary';
      buyBtn.textContent = '🏠 购买 ' + (space2 ? space2.name.replace('\n', '') : '') + ' (' + (getBoardPrice(pos2)) + '元)';
      buyBtn.onclick = function () { wsSend({ type: 'buy' }); };
      panel.appendChild(buyBtn);

      var skipBtn = document.createElement('button');
      skipBtn.className = 'btn';
      skipBtn.textContent = '跳过';
      skipBtn.onclick = function () { wsSend({ type: 'skip_buy' }); };
      panel.appendChild(skipBtn);
    }

    if (st.phase === 'end_turn') {
      // Build house buttons for owned monopoly groups
      var myProps = Object.entries(st.properties || {}).filter(function (e) { return e[1].owner === pi; });
      var buildable = myProps.filter(function (e) {
        var idx2 = parseInt(e[0]);
        var sp = BOARD_META[idx2];
        if (!sp || sp.type !== 'property') return false;
        // Check monopoly
        var grp = getBoardGroup(idx2);
        if (grp === -1) return false;
        var allOwned = getBoardGroupSpaces(grp).every(function (gi) { return st.properties[gi] && st.properties[gi].owner === pi; });
        return allOwned && (e[1].houses || 0) < 5;
      });
      if (buildable.length > 0) {
        var buildDiv = document.createElement('div');
        buildDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
        buildable.forEach(function (e) {
          var idx3 = parseInt(e[0]);
          var sp = BOARD_META[idx3];
          var btn = document.createElement('button');
          btn.className = 'btn';
          btn.style.fontSize = '11px';
          btn.textContent = '🏠 ' + (sp ? sp.name.replace('\n','') : idx3) + ' (+' + (e[1].houses || 0) + ')';
          btn.onclick = function () { wsSend({ type: 'build', spaceIndex: idx3 }); };
          buildDiv.appendChild(btn);
        });
        panel.appendChild(buildDiv);
      }

      var endBtn = document.createElement('button');
      endBtn.className = 'btn btn-primary';
      endBtn.textContent = '结束回合 →';
      endBtn.onclick = function () { wsSend({ type: 'end_turn' }); };
      panel.appendChild(endBtn);
    }

    // Dice result
    if (st.dice && (st.dice[0] || st.dice[1])) {
      var diceEl = document.createElement('div');
      diceEl.style.cssText = 'font-size:18px;letter-spacing:4px;';
      var faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
      diceEl.textContent = (faces[st.dice[0]-1]||'?') + ' ' + (faces[st.dice[1]-1]||'?');
      panel.appendChild(diceEl);
    }
  }

  // Helper: get price from server BOARD (mirrored here for display)
  var BOARD_PRICES = [0,60,0,60,200,200,100,0,100,120,0,140,150,140,160,200,180,0,180,200,0,220,0,220,240,200,260,280];
  var BOARD_GROUPS = [-1,0,-1,0,-1,-1,1,-1,1,1,-1,2,-1,2,2,-1,3,-1,3,3,-1,4,-1,4,4,-1,5,5];
  function getBoardPrice(idx) { return BOARD_PRICES[idx] || 0; }
  function getBoardGroup(idx) { return BOARD_GROUPS[idx] !== undefined ? BOARD_GROUPS[idx] : -1; }
  function getBoardGroupSpaces(grp) {
    var result = [];
    BOARD_GROUPS.forEach(function(g, i) { if (g === grp) result.push(i); });
    return result;
  }

  function wsSend(data) {
    window._ws && window._ws.send(JSON.stringify({ type: 'game_move', data: data }));
  }

  window.gameRenderers.set('monopoly', {
    init: function (container) {
      container.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:6px;';
      container.appendChild(wrap);

      canvas = document.createElement('canvas');
      canvas.style.cssText = 'border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.1);';
      wrap.appendChild(canvas);
      ctx = canvas.getContext('2d');
      resize(container);
      window.addEventListener('resize', function () { resize(container); if (state) drawBoard(state); });

      var panel = document.createElement('div');
      panel.id = 'mono-panel';
      panel.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;max-width:' + W + 'px;justify-content:center;';
      wrap.appendChild(panel);

      // Player legend
      var legend = document.createElement('div');
      legend.id = 'mono-legend';
      legend.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;font-size:12px;';
      wrap.appendChild(legend);
    },

    render: function (st, container, pi, winner) {
      state = st;
      playerIndex = pi;
      if (!st || !st.positions) return;

      drawBoard(st);
      buildActionPanel(container, st);

      // Legend
      var legend = document.getElementById('mono-legend');
      if (legend) {
        legend.innerHTML = '';
        var players = window._players || [];
        for (var p = 0; p < (st._playerCount || 0); p++) {
          var chip = document.createElement('div');
          var elim = st.eliminated && st.eliminated[p];
          chip.style.cssText = 'padding:3px 10px;border-radius:12px;background:' + PLAYER_COLORS[p] + '22;border:1px solid ' + PLAYER_COLORS[p] + ';color:#333;' + (elim ? 'opacity:0.4;text-decoration:line-through;' : '');
          var pname = players[p] ? players[p].name : '玩家' + (p + 1);
          chip.textContent = PLAYER_EMOJIS[p] + ' ' + pname + ' ' + (st.cash[p] || 0) + '元';
          if (p === pi) chip.style.fontWeight = '700';
          legend.appendChild(chip);
        }
      }

      var statusEl = document.getElementById('status');
      if (statusEl) {
        if (winner !== null && winner !== undefined) {
          var wname = (window._players && window._players[winner]) ? window._players[winner].name : '玩家' + (winner + 1);
          statusEl.textContent = winner === pi ? '🎉 你赢了！' : wname + ' 获胜！';
        } else {
          statusEl.textContent = '';
        }
      }
    },
  });
})();
