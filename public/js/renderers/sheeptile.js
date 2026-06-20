// public/js/renderers/sheeptile.js — 羊了个羊（关卡制堆叠三消，重做）
// 读 state.layout 几何 + 自己的 removed/patterns。白底圆角卡牌、暗牌牌背、飞入槽位 + 三连消除动画。
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var EMOJIS = ['🐑', '🍉', '🥕', '🌽', '🍅', '🍆', '🌶️', '🧅', '🥔', '🍄', '🌰', '🌻', '🍇', '🥦'];
  // 高对比牌面：不能再使用接近白色的色块，否则 Windows emoji 会像半透明。
  var EMOJI_BG = ['#ffd6d2', '#ffe39b', '#ffd0a8', '#c9f0a8', '#ffc9c9', '#ddcbff', '#ffd0b5', '#ffe3a8', '#f8c6bd', '#ffc9d7', '#e8d19b', '#fff0a8', '#e4c6ff', '#bfeecb'];

  var canvas, ctx, panel, oppBar;
  var W, H, TS, boardBottom, slotY, slotCS, slotPad;
  var state, playerIndex, winnerIdx = null;
  var rects = {};      // tileId -> {x,y,s,z} 屏幕矩形（当前关卡）
  var curBounds = null;
  // 动画
  var prevSlotLen = 0, prevLevel = 1;
  var anim = { rafId: null, flies: [], merges: [], running: false };

  function wsSend(d) { window.makeGameMove && window.makeGameMove(d); }
  function me() { return state.players[playerIndex]; }

  function myPat(tile) {
    var p = state.players[playerIndex];
    if (p.shuffleOverride && p.shuffleOverride[tile.id] !== undefined) return p.shuffleOverride[tile.id];
    var b = state.sameBoard ? 0 : playerIndex;
    return state.patterns[b][tile.id];
  }
  function curLevelTiles() {
    var lv = me().level;
    return state.layout.filter(function (t) { return t.level === lv; });
  }
  function isBlocked(tile, tiles, removed) {
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      if (t === tile || removed[t.id]) continue;
      if (t.z > tile.z && Math.abs(t.x - tile.x) < 1 && Math.abs(t.y - tile.y) < 1) return true;
    }
    return false;
  }

  // ---------- 尺寸 / 布局 ----------
  function computeSize() {
    W = Math.max(300, Math.min(window.innerWidth - 12, 560));
    H = Math.max(360, Math.min(window.innerHeight - 210, 720));
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr);
    layoutBoard();
  }

  function layoutBoard() {
    if (!state) return;
    var tiles = curLevelTiles();
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    tiles.forEach(function (t) {
      if (t.x < minX) minX = t.x; if (t.x > maxX) maxX = t.x;
      if (t.y < minY) minY = t.y; if (t.y > maxY) maxY = t.y;
    });
    curBounds = { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
    // 槽位条
    slotCS = Math.min((W - 16) / 7, 56);
    slotPad = 8;
    var slotH = slotCS + slotPad * 2;
    boardBottom = H - slotH - 8;
    slotY = boardBottom + 8 + slotPad;
    // 棋盘缩放（顶部留 30px 关卡标题）
    var topPad = 30, padX = 10;
    var spanX = (maxX - minX) + 1, spanY = (maxY - minY) + 1;
    var availW = W - padX * 2, availH = boardBottom - topPad - 8;
    TS = Math.min(availW / spanX, availH / spanY, 64);
    var boardW = spanX * TS, boardH = spanY * TS;
    var offX = (W - boardW) / 2, offY = topPad + (availH - boardH) / 2;
    rects = {};
    tiles.forEach(function (t) {
      rects[t.id] = {
        x: offX + (t.x - minX) * TS,
        y: offY + (t.y - minY) * TS - t.z * TS * 0.04,
        s: TS, z: t.z, tile: t
      };
    });
  }

  // ---------- 绘制 ----------
  function drawBoard() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#cfe8d6'; ctx.fillRect(0, 0, W, H);

    // 关卡标题 + 剩余
    var lv = me().level;
    var tiles = curLevelTiles();
    var remain = tiles.filter(function (t) { return !me().removed[t.id]; }).length;
    ctx.fillStyle = '#2e6b46'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('第 ' + lv + ' 关　剩余 ' + remain, W / 2, 16);

    // 卡牌：低 z 先画
    var ids = tiles.map(function (t) { return t.id; }).filter(function (id) { return !me().removed[id]; });
    ids.sort(function (a, b) { return rects[a].z - rects[b].z; });
    ids.forEach(function (id) {
      var blocked = isBlocked(rects[id].tile, tiles, me().removed);
      drawTile(rects[id], myPat(rects[id].tile), blocked, rects[id].tile.faceDown);
    });

    drawSlot();
    drawFlies();
  }

  function drawTile(r, pat, blocked, faceDown) {
    var x = r.x, y = r.y, s = r.s, pad = s * 0.06;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(x + pad + 1, y + pad + 3, s - 2 * pad, s - 2 * pad, s * 0.18); ctx.fill();
    if (faceDown && blocked) {
      // 暗牌牌背
      ctx.fillStyle = '#e6d8b8';
      roundRect(x + pad, y + pad, s - 2 * pad, s - 2 * pad, s * 0.18); ctx.fill();
      ctx.strokeStyle = '#c9b78a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#bfa878'; ctx.font = Math.floor(s * 0.4) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('❔', x + s / 2, y + s / 2);
    } else {
      // 被遮挡只代表暂时不能点，不应该把牌面画成半透明灰块。
      ctx.fillStyle = EMOJI_BG[pat % EMOJI_BG.length] || '#fff';
      roundRect(x + pad, y + pad, s - 2 * pad, s - 2 * pad, s * 0.18); ctx.fill();
      // 底部立体边
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      roundRect(x + pad, y + s - pad - s * 0.1, s - 2 * pad, s * 0.1, s * 0.06); ctx.fill();
      ctx.strokeStyle = blocked ? '#88998a' : '#8b6d45'; ctx.lineWidth = 2;
      roundRect(x + pad, y + pad, s - 2 * pad, s - 2 * pad, s * 0.18); ctx.stroke();
      ctx.save();
      if (blocked) ctx.globalAlpha = 1;
      // 使用原生 Emoji，但以白色圆底和阴影与浅色牌面分离。
      ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * .31, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = 'rgba(57,42,23,.34)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
      ctx.font = Math.floor(s * 0.62) + 'px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(EMOJIS[pat % EMOJIS.length], x + s / 2, y + s / 2);
      ctx.restore();
      if (blocked) {
        ctx.fillStyle = 'rgba(40,44,40,0.035)';
        roundRect(x + pad, y + pad, s - 2 * pad, s - 2 * pad, s * 0.18); ctx.fill();
      }
    }
  }

  function drawSlot() {
    var slot = me().slot;
    var totalW = 7 * slotCS;
    var startX = (W - totalW) / 2;
    // 槽位托盘
    ctx.fillStyle = '#b9986a';
    roundRect(startX - 6, slotY - 6, totalW + 12, slotCS + 12, 12); ctx.fill();
    for (var i = 0; i < 7; i++) {
      var cx = startX + i * slotCS;
      ctx.fillStyle = '#a6855a';
      roundRect(cx + 2, slotY + 2, slotCS - 4, slotCS - 4, 8); ctx.fill();
      var cell = slot[i];
      if (cell) {
        ctx.fillStyle = EMOJI_BG[cell.pattern % EMOJI_BG.length] || '#fff';
        roundRect(cx + 3, slotY + 3, slotCS - 6, slotCS - 6, 8); ctx.fill();
        ctx.font = Math.floor(slotCS * 0.55) + 'px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(EMOJIS[cell.pattern % EMOJIS.length], cx + slotCS / 2, slotY + slotCS / 2);
      }
    }
    // 合并闪光
    var now = Date.now();
    anim.merges = anim.merges.filter(function (m) { return now - m.start < 320; });
    anim.merges.forEach(function (m) {
      var p = (now - m.start) / 320;
      ctx.save(); ctx.globalAlpha = 1 - p;
      ctx.fillStyle = '#fff6c8';
      var cx = startX + m.idx * slotCS;
      roundRect(cx + 3 - p * 6, slotY + 3 - p * 6, slotCS - 6 + p * 12, slotCS - 6 + p * 12, 8); ctx.fill();
      ctx.restore();
    });
  }

  function drawFlies() {
    var now = Date.now();
    anim.flies = anim.flies.filter(function (f) { return now - f.start < f.dur; });
    anim.flies.forEach(function (f) {
      var p = Math.min((now - f.start) / f.dur, 1);
      var e = 1 - Math.pow(1 - p, 3); // ease-out
      var x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e;
      var s = f.s * (1 - 0.25 * e);
      ctx.fillStyle = EMOJI_BG[f.pattern % EMOJI_BG.length] || '#fff';
      roundRect(x, y, s, s, s * 0.18); ctx.fill();
      ctx.strokeStyle = '#e3d9c2'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = Math.floor(s * 0.55) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(EMOJIS[f.pattern % EMOJIS.length], x + s / 2, y + s / 2);
    });
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- 动画循环 ----------
  function ensureLoop() {
    if (anim.running) return;
    anim.running = true;
    tick();
  }
  function tick() {
    drawBoard();
    if (anim.flies.length > 0 || anim.merges.length > 0) {
      anim.rafId = requestAnimationFrame(tick);
    } else {
      anim.running = false;
    }
  }

  // ---------- 交互 ----------
  function onClick(e) {
    if (!state || state.phase !== 'playing' || me().eliminated) return;
    if (winnerIdx !== null) return;
    var r = canvas.getBoundingClientRect();
    var mx = (e.clientX - r.left) * (W / r.width);
    var my = (e.clientY - r.top) * (H / r.height);
    var tiles = curLevelTiles();
    // 从最高 z 往下找命中的可点牌
    var cand = tiles.filter(function (t) { return !me().removed[t.id]; })
      .sort(function (a, b) { return rects[b.id].z - rects[a.id].z; });
    for (var i = 0; i < cand.length; i++) {
      var rc = rects[cand[i].id];
      if (mx >= rc.x && mx <= rc.x + rc.s && my >= rc.y && my <= rc.y + rc.s) {
        if (isBlocked(cand[i], tiles, me().removed)) return; // 被遮挡
        startFly(cand[i]);
        wsSend({ type: 'pick', tileId: cand[i].id });
        return;
      }
    }
  }

  function startFly(tile) {
    var rc = rects[tile.id];
    if (!rc) return;
    var slotLen = me().slot.length;
    var totalW = 7 * slotCS, startX = (W - totalW) / 2;
    anim.flies.push({
      x0: rc.x, y0: rc.y, x1: startX + slotLen * slotCS, y1: slotY,
      s: rc.s, pattern: myPat(tile), start: Date.now(), dur: 240
    });
    ensureLoop();
  }

  // ---------- DOM 面板 ----------
  function buildPanel() {
    if (!panel) return;
    panel.innerHTML = '';
    var p = me();
    var powers = [
      { k: 'power_undo', label: '↩ 撤回', n: p.powers.undo },
      { k: 'power_shuffle', label: '🔀 洗牌', n: p.powers.shuffle },
      { k: 'power_pop3', label: '⏏ 移出3张', n: p.powers.pop3 },
    ];
    powers.forEach(function (pw) {
      var b = document.createElement('button');
      b.className = 'btn';
      b.style.cssText = 'font-size:13px;padding:6px 12px;' + (pw.n <= 0 ? 'opacity:.4;' : '');
      b.textContent = pw.label + ' ×' + pw.n;
      b.disabled = pw.n <= 0 || p.eliminated || winnerIdx !== null;
      b.onclick = function () { if (pw.n > 0) wsSend({ type: pw.k }); };
      panel.appendChild(b);
    });
  }

  function buildOppBar() {
    if (!oppBar) return;
    oppBar.innerHTML = '';
    for (var i = 0; i < state._playerCount; i++) {
      if (i === playerIndex) continue;
      var op = state.players[i];
      var lvT = state.layout.filter(function (t) { return t.level === op.level; });
      var remain = lvT.filter(function (t) { return !op.removed[t.id]; }).length;
      var chip = document.createElement('div');
      chip.style.cssText = 'padding:4px 10px;border-radius:12px;font-size:12px;background:#fff;border:1px solid var(--border);' + (op.eliminated ? 'opacity:.45;text-decoration:line-through;' : '');
      var nm = (window._players && window._players[i]) ? window._players[i].name : '玩家' + (i + 1);
      chip.textContent = nm + '：第' + op.level + '关·剩' + remain + (op.eliminated ? '·爆槽' : '·槽' + op.slot.length + '/7');
      oppBar.appendChild(chip);
    }
  }

  // ---------- 渲染入口 ----------
  window.gameRenderers.set('sheeptile', {
    init: function (container) {
      container.innerHTML = '';
      state = null; prevSlotLen = 0; prevLevel = 1;
      anim.flies = []; anim.merges = []; anim.running = false;
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:6px;';
      container.appendChild(wrap);
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'border-radius:12px;box-shadow:0 4px 18px rgba(46,107,70,.2);touch-action:manipulation;';
      wrap.appendChild(canvas);
      ctx = canvas.getContext('2d');
      canvas.addEventListener('click', onClick);
      canvas.addEventListener('touchstart', function (e) { e.preventDefault(); if (e.touches[0]) onClick(e.touches[0]); }, { passive: false });
      computeSize();
      window.addEventListener('resize', function () { computeSize(); if (state) drawBoard(); });

      oppBar = document.createElement('div');
      oppBar.id = 'sheep-opp';
      oppBar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:8px;';
      wrap.appendChild(oppBar);

      panel = document.createElement('div');
      panel.id = 'sheep-panel';
      panel.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px;';
      wrap.appendChild(panel);
    },

    render: function (st, container, pi, winner) {
      var newGame = !state || (st.layout && state.layout !== st.layout);
      state = st; playerIndex = pi;
      winnerIdx = (winner === null || winner === undefined) ? null : winner;
      if (!st || !st.players || !st.players[pi]) return;

      if (newGame) { prevSlotLen = 0; prevLevel = me().level; layoutBoard(); }

      // 关卡切换 → 重算布局
      if (me().level !== prevLevel) { prevLevel = me().level; prevSlotLen = 0; layoutBoard(); }

      // 检测三连消除（slot 减少）→ 合并动画
      var curSlot = me().slot.length;
      if (curSlot < prevSlotLen) {
        for (var k = 0; k < 3; k++) anim.merges.push({ idx: k, start: Date.now() });
        ensureLoop();
      }
      prevSlotLen = curSlot;

      drawBoard();
      buildPanel();
      buildOppBar();
      ensureLoop();

      var statusEl = document.getElementById('status');
      if (statusEl) {
        if (winner !== null && winner !== undefined) {
          var wn = (window._players && window._players[winner]) ? window._players[winner].name : '玩家' + (winner + 1);
          statusEl.textContent = winner === pi ? '🎉 你赢了！' : wn + ' 通关获胜！';
        } else if (me().eliminated) {
          statusEl.textContent = '💥 你爆槽了，观战中…';
        } else { statusEl.textContent = ''; }
      }
    },
  });
})();
