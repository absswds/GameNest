// Battleship renderer — responsive dual/single 10×10 grids, placing + shooting phases
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var ROWS = 10, COLS = 10;
  var SHIP_SIZES = [5, 4, 3, 3, 2];
  var SHIP_LABELS = { carrier: '航母', battleship: '战列', cruiser: '巡洋', submarine: '潜艇', destroyer: '驱逐' };
  var SHIP_LABELS_EN = { carrier: 'Carrier', battleship: 'Battleship', cruiser: 'Cruiser', submarine: 'Submarine', destroyer: 'Destroyer' };

  var canvas, ctx, W, H;
  var cs;
  var margin = 32;
  var boardGap = 40;

  var placeOrientation = 'h';
  var placePreview = null;
  var viewMode = 'both'; // 'single' (phone) | 'both'
  var prevMyBoard = null;

  var animState = {
    running: false,
    rafId: null,
    type: 'none',
    startTime: 0,
    shotR: -1, shotC: -1,
    shotResult: null,
    shotProgress: 0,
    shotBoard: 'enemy',
  };

  function getLang() {
    return (window.__ACTIVE_LANG === 'en') ? 'en' : 'zh';
  }

  function shipLabel(type) {
    var labels = getLang() === 'en' ? SHIP_LABELS_EN : SHIP_LABELS;
    return labels[type] || type;
  }

  // ---- Drawing helpers ----

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawGrid(ox, oy, label, boardData, isEnemy, state, pi) {
    var W = cs * COLS, H = cs * ROWS;
    // Sea surface
    var sea = ctx.createLinearGradient(ox, oy, ox + W, oy + H);
    sea.addColorStop(0, isEnemy ? '#1d3a4f' : '#1f4a5c');
    sea.addColorStop(1, isEnemy ? '#132838' : '#143545');
    ctx.fillStyle = sea;
    rrect(ox - 4, oy - 4, W + 8, H + 8, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1;
    for (var r = 1; r < ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(ox, oy + r * cs); ctx.lineTo(ox + W, oy + r * cs); ctx.stroke();
    }
    for (var c = 1; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(ox + c * cs, oy); ctx.lineTo(ox + c * cs, oy + H); ctx.stroke();
    }

    ctx.fillStyle = '#8a99a6';
    ctx.font = '600 11px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var c2 = 0; c2 < COLS; c2++) ctx.fillText(String.fromCharCode(65 + c2), ox + c2 * cs + cs / 2, oy - 14);
    for (var r2 = 0; r2 < ROWS; r2++) ctx.fillText(String(r2 + 1), ox - 14, oy + r2 * cs + cs / 2);

    ctx.fillStyle = '#1c1b19';
    ctx.font = '800 14px "Nunito", "LXGW WenKai", sans-serif';
    ctx.fillText(label, ox + W / 2, oy - 30);

    if (!boardData) return;

    function shipAt(rr, cc) {
      var cl = boardData[rr] && boardData[rr][cc];
      return !!(cl && (cl.hasShip || (isEnemy && cl.shot === 'sunk')));
    }
    // Neighbour belongs to the same ship → hull segments join; different ships stay separate
    function sameShip(rr, cc, id) {
      var cl = boardData[rr] && boardData[rr][cc];
      return shipAt(rr, cc) && cl.shipId === id;
    }

    // Pass 1: hulls. Sunk ships are drawn once as a whole wreck with an outline.
    var wrecks = {};
    for (var r3 = 0; r3 < ROWS; r3++) {
      for (var c3 = 0; c3 < COLS; c3++) {
        var cell = boardData[r3] && boardData[r3][c3];
        if (!cell || !shipAt(r3, c3)) continue;
        if (cell.shot === 'sunk' && cell.shipId != null) {
          var w = wrecks[cell.shipId] || (wrecks[cell.shipId] = { r0: r3, c0: c3, r1: r3, c1: c3 });
          w.r0 = Math.min(w.r0, r3); w.c0 = Math.min(w.c0, c3);
          w.r1 = Math.max(w.r1, r3); w.c1 = Math.max(w.c1, c3);
          continue;
        }
        drawHull(ox + c3 * cs, oy + r3 * cs, sameShip(r3, c3 - 1, cell.shipId), sameShip(r3, c3 + 1, cell.shipId), sameShip(r3 - 1, c3, cell.shipId), sameShip(r3 + 1, c3, cell.shipId), cell.shot === 'sunk');
      }
    }
    Object.keys(wrecks).forEach(function (id) { drawWreck(ox, oy, wrecks[id]); });

    // Pass 2: shot markers on top
    for (var r4 = 0; r4 < ROWS; r4++) {
      for (var c4 = 0; c4 < COLS; c4++) {
        var cl = boardData[r4] && boardData[r4][c4];
        if (!cl) continue;
        var x = ox + c4 * cs, y = oy + r4 * cs;
        if (cl.shot === 'hit' || cl.shot === 'sunk') drawHit(x, y, cl.shot === 'sunk');
        else if (cl.shot === 'miss') drawMiss(x, y);
      }
    }
  }

  // Destroyed ship: one rounded shape with a warm outline, readable at a glance
  function drawWreck(ox, oy, w) {
    var m = cs * 0.1;
    var x = ox + w.c0 * cs + m, y = oy + w.r0 * cs + m;
    var ww = (w.c1 - w.c0 + 1) * cs - m * 2, hh = (w.r1 - w.r0 + 1) * cs - m * 2;
    rrect(x, y, ww, hh, Math.min(ww, hh) * 0.4);
    ctx.fillStyle = '#5b3b35';
    ctx.fill();
    ctx.strokeStyle = '#ff8a65';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Hull segment: inset on sides without a neighbouring ship cell, so adjacent cells merge into one ship
  function drawHull(x, y, left, right, up, down, sunk) {
    var m = cs * 0.14;
    var x0 = x + (left ? 0 : m), x1 = x + cs - (right ? 0 : m);
    var y0 = y + (up ? 0 : m), y1 = y + cs - (down ? 0 : m);
    var rad = cs * 0.3;
    ctx.fillStyle = sunk ? '#5b3b35' : '#c9d3db';
    ctx.beginPath();
    var tl = (!left && !up) ? rad : 0, tr = (!right && !up) ? rad : 0;
    var br = (!right && !down) ? rad : 0, bl = (!left && !down) ? rad : 0;
    ctx.moveTo(x0 + tl, y0);
    ctx.arcTo(x1, y0, x1, y1, tr);
    ctx.arcTo(x1, y1, x0, y1, br);
    ctx.arcTo(x0, y1, x0, y0, bl);
    ctx.arcTo(x0, y0, x1, y0, tl);
    ctx.closePath();
    ctx.fill();
    if (!sunk) {
      ctx.fillStyle = 'rgba(28,40,52,0.28)';
      ctx.beginPath();
      ctx.arc(x + cs / 2, y + cs / 2, cs * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHit(x, y, sunk) {
    var cx = x + cs / 2, cy = y + cs / 2;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cs * 0.42);
    g.addColorStop(0, sunk ? 'rgba(255,120,80,0.55)' : 'rgba(255,140,90,0.9)');
    g.addColorStop(1, 'rgba(230,70,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, cs, cs);
    ctx.fillStyle = sunk ? '#b0392b' : '#ff5a36';
    ctx.beginPath();
    ctx.arc(cx, cy, cs * 0.17, 0, Math.PI * 2);
    ctx.fill();
    if (sunk) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - cs * 0.1, cy - cs * 0.1); ctx.lineTo(cx + cs * 0.1, cy + cs * 0.1);
      ctx.moveTo(cx + cs * 0.1, cy - cs * 0.1); ctx.lineTo(cx - cs * 0.1, cy + cs * 0.1);
      ctx.stroke();
    }
  }

  function drawMiss(x, y) {
    var cx = x + cs / 2, cy = y + cs / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, cs * 0.2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(cx, cy, cs * 0.06, 0, Math.PI * 2); ctx.fill();
  }

  function drawPlacingPreview(ox, oy, r, c, orientation, size, valid) {
    if (r < 0 || c < 0) return;
    for (var i = 0; i < size; i++) {
      var cr = orientation === 'v' ? r + i : r;
      var cc = orientation === 'h' ? c + i : c;
      if (cr >= ROWS || cc >= COLS) return;
      var x = ox + cc * cs;
      var y = oy + cr * cs;
      ctx.fillStyle = valid ? 'rgba(76,175,80,0.35)' : 'rgba(244,67,54,0.35)';
      ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
      ctx.strokeStyle = valid ? '#2e7d32' : '#c62828';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
    }
  }

  // ---- Layout ----
  // One place computes every rect, so drawing and hit-testing always agree.
  var lay = null;
  var drag = null;          // {x, y, moved} while dragging the next ship from the tray
  var suppressClickUntil = 0;

  function computeLayout(state, pi) {
    var single = viewMode !== 'both';
    var c = single ? Math.floor((W - margin * 2) / COLS) : Math.floor((W - margin * 2 - boardGap) / COLS / 2);
    c = Math.max(18, Math.min(c, 38));
    cs = c;
    var boardW = c * COLS, boardH = c * ROWS, oy = margin + 44;
    var placing = state.phase === 'placing';
    var L = { single: single, cs: c, oy: oy, boardW: boardW, boardH: boardH, compact: single && !placing };
    L.myOx = single ? (W - boardW) / 2 : margin;
    L.enemyOx = single ? L.myOx : margin + boardW + boardGap;
    var y = oy + boardH + 8;
    var size = SHIP_SIZES[state.placedCount[pi]];
    if (placing && state.currentPlayer === pi && size) {
      var cx = L.myOx + boardW / 2;
      L.btn = { x: cx - 40, y: y, w: 80, h: 28 };
      L.tray = { x: cx - size * c / 2, y: y + 58, w: size * c, h: c, size: size };
      y = L.tray.y + c + 16;
    } else if (L.compact) {
      // Phone, shooting: enemy board on top, a mini copy of my fleet below
      L.miniCs = Math.max(12, Math.floor(c * 0.55));
      L.miniOx = L.myOx + 14;
      L.miniOy = y + 38;
      y = L.miniOy + L.miniCs * ROWS + 14;
    }
    L.totalH = y + 8;
    return L;
  }

  function inRect(p, r) { return !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

  function drawControlButton() {
    if (!lay.btn) return;
    var isZh = getLang() === 'zh';
    var label = isZh ? ('⟳ ' + (placeOrientation === 'h' ? '横放' : '竖放')) : ('⟳ ' + (placeOrientation === 'h' ? 'Horiz' : 'Vert'));
    var b = lay.btn;
    ctx.fillStyle = '#c8a45c';
    rrect(b.x, b.y, b.w, b.h, 14);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2);
  }

  // A free-floating hull of `size` cells (tray + drag ghost)
  function drawLooseShip(x, y, size, orientation) {
    var h = orientation === 'h';
    for (var i = 0; i < size; i++) {
      drawHull(h ? x + i * cs : x, h ? y : y + i * cs, h && i > 0, h && i < size - 1, !h && i > 0, !h && i < size - 1, false);
    }
  }

  function drawTray() {
    var t = lay.tray;
    if (!t || drag) return;
    ctx.fillStyle = '#1f4a5c';
    rrect(t.x - 8, t.y - 6, t.w + 16, t.h + 12, 10);
    ctx.fill();
    drawLooseShip(t.x, t.y, t.size, 'h');
    ctx.fillStyle = '#6b7a86';
    ctx.font = '600 11px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(getLang() === 'en' ? 'Drag onto your board · tap to rotate' : '拖到棋盘上 · 轻点旋转', t.x + t.w / 2, t.y - 10);
  }

  // Board cell the dragged ship would start at (pointer holds the ship's middle)
  function anchorFor(p) {
    var size = lay.tray ? lay.tray.size : 0;
    var col = Math.floor((p.x - lay.myOx) / cs), row = Math.floor((p.y - lay.oy) / cs);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    var half = Math.floor((size - 1) / 2);
    return placeOrientation === 'h' ? { r: row, c: col - half } : { r: row - half, c: col };
  }

  function ensureHeight(need) {
    need = Math.ceil(need);
    if (Math.abs(need - H) < 2) return;
    var dpr = window.devicePixelRatio || 1;
    H = need;
    canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- Animation ----
  function startAnimLoop() {
    if (animState.running) return;
    animState.running = true;
    animState.startTime = performance.now();
    animTick();
  }

  function stopAnimLoop() {
    animState.running = false;
    animState.type = 'none';
    if (animState.rafId) {
      cancelAnimationFrame(animState.rafId);
      animState.rafId = null;
    }
  }

  function animTick(now) {
    if (!animState.running) return;
    now = now || performance.now();
    var elapsed = now - animState.startTime;

    if (animState.type === 'shot') {
      var t = Math.min(elapsed / 400, 1.0);
      t = 1 - Math.pow(1 - t, 3);
      animState.shotProgress = t;
      if (t >= 1.0) {
        animState.shotProgress = 1.0;
        animState.type = 'none';
        animState.running = false;
      }
    }

    drawFrame(now);

    if (animState.running) {
      animState.rafId = requestAnimationFrame(animTick);
    } else {
      animState.rafId = null;
    }
  }

  function drawShotAnimation(ox, oy, boardData) {
    if (animState.type !== 'shot') return;
    var r = animState.shotR;
    var c = animState.shotC;
    if (r < 0 || c < 0) return;
    var x = ox + c * cs + cs / 2;
    var y = oy + r * cs + cs / 2;
    var progress = Math.min(1, Math.max(0, animState.shotProgress)); // a late frame can overshoot 1 -> negative arc radius

    if (animState.shotResult === 'miss') {
      var maxR = cs * 0.6;
      ctx.strokeStyle = 'rgba(144,164,174,' + (0.8 * (1 - progress)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, maxR * progress, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      var radius = cs * 0.4 * (1 - progress * 0.5);
      var alpha = 0.7 * (1 - progress);
      ctx.fillStyle = animState.shotResult === 'sunk'
        ? 'rgba(183,28,28,' + alpha + ')'
        : 'rgba(244,67,54,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      for (var i = 0; i < 6; i++) {
        var angle = (i / 6) * Math.PI * 2 + progress * 2;
        var dist = cs * 0.5 * progress;
        var sx = x + Math.cos(angle) * dist;
        var sy = y + Math.sin(angle) * dist;
        ctx.fillStyle = 'rgba(255,193,7,' + (0.8 * (1 - progress)) + ')';
        ctx.beginPath();
        ctx.arc(sx, sy, 2 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---- Main draw ----
  function drawFrame(now) {
    var state = window._bsState;
    var pi = window._bsPI;
    if (!state || pi === undefined) return;

    lay = computeLayout(state, pi);
    ensureHeight(lay.totalH);
    // Placing needs raw pointer events; otherwise let the page scroll through the canvas
    canvas.style.touchAction = (state.phase === 'placing' && state.currentPlayer === pi) ? 'none' : 'pan-y';
    var dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    var oy = lay.oy;
    var myLabel = getLang() === 'en' ? 'My Fleet' : '我的舰队';
    var enemyLabel = getLang() === 'en' ? 'Enemy Waters' : '敌方海域';

    if (lay.compact) {
      drawGrid(lay.enemyOx, oy, enemyLabel, state.enemyBoard, true, state, pi);
      if (animState.type === 'shot' && animState.shotBoard === 'enemy') drawShotAnimation(lay.enemyOx, oy);
      var full = cs;
      cs = lay.miniCs;
      drawGrid(lay.miniOx, lay.miniOy, myLabel, state.myBoard, false, state, pi);
      if (animState.type === 'shot' && animState.shotBoard === 'my') drawShotAnimation(lay.miniOx, lay.miniOy);
      cs = full;
    } else {
      drawGrid(lay.myOx, oy, myLabel, state.myBoard, false, state, pi);
      if (!lay.single) drawGrid(lay.enemyOx, oy, enemyLabel, state.enemyBoard, true, state, pi);
      if (animState.type === 'shot') drawShotAnimation(animState.shotBoard === 'enemy' ? lay.enemyOx : lay.myOx, oy);
    }

    // Placing: preview on the board, tray with the next ship, drag ghost off-board
    if (state.phase === 'placing' && state.currentPlayer === pi) {
      var size = SHIP_SIZES[state.placedCount[pi]];
      if (placePreview) {
        drawPlacingPreview(lay.myOx, oy, placePreview.r, placePreview.c, placeOrientation, size,
          canPlacePreview(state, placePreview.r, placePreview.c, placeOrientation));
      } else if (drag && drag.moved) {
        var half = Math.floor((size - 1) / 2) * cs + cs / 2;
        ctx.globalAlpha = 0.8;
        drawLooseShip(drag.x - (placeOrientation === 'h' ? half : cs / 2), drag.y - (placeOrientation === 'v' ? half : cs / 2), size, placeOrientation);
        ctx.globalAlpha = 1;
      }
      drawTray();
    }

    drawControlButton();

    // Phase indicator
    ctx.fillStyle = '#37474f';
    ctx.font = 'bold 13px "Nunito", sans-serif';
    ctx.textAlign = 'center';

    if (state.phase === 'placing') {
      var isMyTurn = state.currentPlayer === pi;
      var placing = getLang() === 'en' ? 'Place your ' : '放置 ';
      var shipType = shipLabel(SHIP_SIZES[state.placedCount[pi]] >= 5 ? 'carrier' :
        SHIP_SIZES[state.placedCount[pi]] >= 4 ? 'battleship' :
        SHIP_SIZES[state.placedCount[pi]] >= 3 ? (state.placedCount[pi] < 3 ? 'cruiser' : 'submarine') : 'destroyer');
      var sizeStr = ' (' + String(SHIP_SIZES[state.placedCount[pi]]) + ')';
      var txt = isMyTurn
        ? placing + shipType + sizeStr + (getLang() === 'en' ? ' — drag it or tap a cell' : '：拖到棋盘或点格子')
        : (getLang() === 'en' ? 'Waiting for opponent to place...' : '等待对手放置...');
      ctx.fillText(txt, W / 2, 16);
    } else if (state.phase === 'shooting') {
      var isMyTurn2 = state.currentPlayer === pi;
      var txt2 = isMyTurn2
        ? (getLang() === 'en' ? 'Your turn — click enemy grid to fire!' : '轮到你 — 点击敌方海域开火！')
        : (getLang() === 'en' ? 'Waiting for opponent to fire...' : '等待对手开火...');
      ctx.fillText(txt2, W / 2, 16);
    } else if (state.phase === 'over') {
      var won = state.winner === pi;
      var txt3 = won
        ? (getLang() === 'en' ? 'Victory!' : '胜利！')
        : (getLang() === 'en' ? 'Defeat' : '败北');
      ctx.fillStyle = won ? '#2e7d32' : '#c62828';
      ctx.font = 'bold 16px "Nunito", sans-serif';
      ctx.fillText(txt3, W / 2, 16);
    }
  }

  function canPlacePreview(state, r, c, orientation) {
    var size = SHIP_SIZES[state.placedCount[window._bsPI]];
    if (!size) return false;
    var myBoard = state.myBoard;
    for (var i = 0; i < size; i++) {
      var cr = orientation === 'v' ? r + i : r;
      var cc = orientation === 'h' ? c + i : c;
      if (cr < 0 || cr >= ROWS || cc < 0 || cc >= COLS) return false;
      if (myBoard[cr] && myBoard[cr][cc] && myBoard[cr][cc].hasShip) return false;
    }
    return true;
  }

  function getCellFromEvent(e, ox, oy) {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var mx = (e.clientX - rect.left);
    var my = (e.clientY - rect.top);
    var c = Math.floor((mx - ox) / cs);
    var r = Math.floor((my - oy) / cs);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) return { r: r, c: c };
    return null;
  }

  // ---- Renderer registration ----
  window.gameRenderers.set('battleship', {
    init: function (container) {
      canvas = document.createElement('canvas');
      canvas.style.touchAction = 'none';
      container.appendChild(canvas);
      ctx = canvas.getContext('2d');

      function resize() {
        var dpr = window.devicePixelRatio || 1;
        // Size from the board slot, not the window (the panel has padding on phones)
        var slot = document.querySelector('.board-wrap');
        W = Math.min((slot && slot.clientWidth) || window.innerWidth, 900);
        H = H || 560;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        viewMode = W < 560 ? 'single' : 'both';
        drawFrame(null);
      }
      resize();
      window.addEventListener('resize', resize);

      function pt(e) {
        var rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
      function myPlacing() {
        var st = window._bsState;
        return !!st && st.phase === 'placing' && st.currentPlayer === window._bsPI;
      }
      function rotate() {
        placeOrientation = placeOrientation === 'h' ? 'v' : 'h';
        placePreview = null;
        drawFrame(null);
      }
      function place(cell) {
        var st = window._bsState;
        if (!cell || !canPlacePreview(st, cell.r, cell.c, placeOrientation)) return;
        window.makeGameMove({ r: cell.r, c: cell.c, orientation: placeOrientation, size: SHIP_SIZES[st.placedCount[window._bsPI]] });
        placePreview = null;
      }

      canvas.addEventListener('pointerdown', function (e) {
        if (!lay || !myPlacing()) return;
        var p = pt(e);
        if (inRect(p, lay.tray)) {
          drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
          try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
          e.preventDefault();
        }
      });

      canvas.addEventListener('pointermove', function (e) {
        if (!lay || !myPlacing()) return;
        var p = pt(e);
        if (drag) {
          drag.x = p.x; drag.y = p.y;
          if (Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 6) drag.moved = true;
          placePreview = drag.moved ? anchorFor(p) : null;
          drawFrame(null);
          return;
        }
        if (e.pointerType !== 'mouse') return;
        // Desktop hover preview
        var cell = getCellFromEvent(e, lay.myOx, lay.oy);
        placePreview = cell ? { r: cell.r, c: cell.c } : null;
        drawFrame(null);
      });

      canvas.addEventListener('pointerup', function () {
        if (!drag) return;
        var d = drag;
        drag = null;
        suppressClickUntil = Date.now() + 400;
        if (!d.moved) rotate();
        else place(placePreview);
        placePreview = null;
        drawFrame(null);
      });
      canvas.addEventListener('pointercancel', function () { drag = null; placePreview = null; drawFrame(null); });
      canvas.addEventListener('pointerleave', function (e) {
        if (!drag && e.pointerType === 'mouse' && placePreview) { placePreview = null; drawFrame(null); }
      });

      canvas.addEventListener('click', function (e) {
        var state = window._bsState;
        var pi = window._bsPI;
        if (!state || pi === undefined || !lay) return;
        if (Date.now() < suppressClickUntil) return;
        var p = pt(e);

        if (myPlacing()) {
          if (inRect(p, lay.btn)) { rotate(); return; }
          place(getCellFromEvent(e, lay.myOx, lay.oy));
          drawFrame(null);
        } else if (state.phase === 'shooting' && state.currentPlayer === pi) {
          var cell2 = getCellFromEvent(e, lay.enemyOx, lay.oy);
          if (!cell2) return;
          if (state.enemyBoard[cell2.r] && state.enemyBoard[cell2.r][cell2.c] &&
              state.enemyBoard[cell2.r][cell2.c].shot) return;

          stopAnimLoop();
          animState.type = 'shot';
          animState.shotR = cell2.r;
          animState.shotC = cell2.c;
          animState.shotResult = 'hit';
          animState.shotProgress = 0;
          animState.shotBoard = 'enemy';
          startAnimLoop();
          window.makeGameMove({ r: cell2.r, c: cell2.c });
        }
      });

      canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (myPlacing()) rotate();
      });
    },

    render: function (state, container, playerIndex, winner) {
      window._bsState = state;
      window._bsPI = playerIndex;

      if (!canvas || !state) return;

      // Opponent just fired at my fleet -> play the splash/explosion on my board too
      var incoming = null;
      if (prevMyBoard && state.myBoard) {
        for (var r = 0; r < ROWS && !incoming; r++) {
          for (var c = 0; c < COLS; c++) {
            var now = state.myBoard[r][c].shot;
            if (now && !prevMyBoard[r][c]) { incoming = { r: r, c: c, shot: now }; break; }
          }
        }
      }
      prevMyBoard = state.myBoard ? state.myBoard.map(function (row) { return row.map(function (cl) { return cl.shot; }); }) : null;
      if (incoming && !(window.Motion && window.Motion.reduced())) {
        stopAnimLoop();
        animState.type = 'shot';
        animState.shotR = incoming.r;
        animState.shotC = incoming.c;
        animState.shotResult = incoming.shot;
        animState.shotProgress = 0;
        animState.shotBoard = 'my';
        startAnimLoop();
        return;
      }
      if (animState.running) return;
      drawFrame(null);
    },
  });
})();
