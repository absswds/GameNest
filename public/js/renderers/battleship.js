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
  var viewMode = 'both'; // 'my' | 'enemy' | 'both'

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
    ctx.fillStyle = '#e8edf2';
    rrect(ox - 4, oy - 4, cs * COLS + 8, cs * ROWS + 8, 6);
    ctx.fill();

    ctx.strokeStyle = '#b0bec5';
    ctx.lineWidth = 0.8;
    for (var r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * cs);
      ctx.lineTo(ox + COLS * cs, oy + r * cs);
      ctx.stroke();
    }
    for (var c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * cs, oy);
      ctx.lineTo(ox + c * cs, oy + ROWS * cs);
      ctx.stroke();
    }

    ctx.fillStyle = '#78909c';
    ctx.font = '11px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var c2 = 0; c2 < COLS; c2++) {
      ctx.fillText(String.fromCharCode(65 + c2), ox + c2 * cs + cs / 2, oy - 14);
    }
    for (var r2 = 0; r2 < ROWS; r2++) {
      ctx.fillText(String(r2 + 1), ox - 14, oy + r2 * cs + cs / 2);
    }

    ctx.fillStyle = '#37474f';
    ctx.font = 'bold 14px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, ox + COLS * cs / 2, oy - 28);

    if (!boardData) return;

    for (var r3 = 0; r3 < ROWS; r3++) {
      for (var c3 = 0; c3 < COLS; c3++) {
        var x = ox + c3 * cs;
        var y = oy + r3 * cs;
        var cell = boardData[r3] && boardData[r3][c3];

        if (isEnemy) {
          if (cell && cell.shot === 'hit') {
            ctx.fillStyle = 'rgba(244,67,54,0.25)';
            ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
            ctx.strokeStyle = '#c62828';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(x + cs * 0.25, y + cs * 0.25);
            ctx.lineTo(x + cs * 0.75, y + cs * 0.75);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + cs * 0.75, y + cs * 0.25);
            ctx.lineTo(x + cs * 0.25, y + cs * 0.75);
            ctx.stroke();
          } else if (cell && cell.shot === 'sunk') {
            ctx.fillStyle = 'rgba(183,28,28,0.3)';
            ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
            ctx.strokeStyle = '#b71c1c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + cs * 0.2, y + cs * 0.2);
            ctx.lineTo(x + cs * 0.8, y + cs * 0.8);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + cs * 0.8, y + cs * 0.2);
            ctx.lineTo(x + cs * 0.2, y + cs * 0.8);
            ctx.stroke();
          } else if (cell && cell.shot === 'miss') {
            ctx.fillStyle = '#90a4ae';
            ctx.beginPath();
            ctx.arc(x + cs / 2, y + cs / 2, cs * 0.12, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          if (cell && cell.hasShip) {
            ctx.fillStyle = cell.shot === 'hit' ? 'rgba(244,67,54,0.35)' : 'rgba(33,150,243,0.25)';
            ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
            ctx.strokeStyle = cell.shot === 'hit' ? '#c62828' : '#1565c0';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
          }
          if (cell && cell.shot === 'hit') {
            ctx.strokeStyle = '#c62828';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(x + cs * 0.3, y + cs * 0.3);
            ctx.lineTo(x + cs * 0.7, y + cs * 0.7);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + cs * 0.7, y + cs * 0.3);
            ctx.lineTo(x + cs * 0.3, y + cs * 0.7);
            ctx.stroke();
          } else if (cell && cell.shot === 'miss' && !cell.hasShip) {
            ctx.fillStyle = '#90a4ae';
            ctx.beginPath();
            ctx.arc(x + cs / 2, y + cs / 2, cs * 0.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
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

  // ---- Layout helpers ----
  function getBoardOx() {
    if (viewMode === 'both') return margin;
    var boardW = cs * COLS;
    return (W - boardW) / 2;
  }

  var bsBtnX, bsBtnY, bsBtnW, bsBtnH;

  function layoutButton() {
    var boardH = cs * ROWS;
    var oy = margin + 22;
    bsBtnW = 80; bsBtnH = 28;
    bsBtnX = (W - bsBtnW) / 2;
    bsBtnY = oy + boardH + 6;
  }

  function bsBtnHit(mx, my) {
    return mx >= bsBtnX && mx <= bsBtnX + bsBtnW && my >= bsBtnY && my <= bsBtnY + bsBtnH;
  }

  function drawControlButton(state, pi) {
    var isZh = getLang() === 'zh';
    var label;
    if (state.phase === 'placing' && state.currentPlayer === pi) {
      label = isZh ? ('\u27F3 ' + (placeOrientation === 'h' ? '横' : '竖')) : ('\u27F3 ' + (placeOrientation === 'h' ? 'Horiz' : 'Vert'));
    } else if (viewMode === 'both') {
      return;
    } else if (viewMode === 'my') {
      label = isZh ? '\u{1F6E1}\uFE0F 查看敌方' : '\u{1F6E1}\uFE0F View Enemy';
    } else {
      label = isZh ? '\u{1F3F4}\uFE0F 查看我方' : '\u{1F3F4}\uFE0F View Mine';
    }

    ctx.fillStyle = '#c8a45c';
    ctx.beginPath();
    ctx.roundRect(bsBtnX, bsBtnY, bsBtnW, bsBtnH, 14);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bsBtnX + bsBtnW / 2, bsBtnY + bsBtnH / 2);
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
    var progress = animState.shotProgress;

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

    var dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    if (viewMode === 'both') {
      cs = Math.floor((W - margin * 2 - boardGap) / COLS / 2);
    } else {
      cs = Math.floor((W - margin * 2) / COLS);
    }
    cs = Math.max(18, Math.min(cs, 38));

    var boardW = cs * COLS;
    var boardH = cs * ROWS;
    var oy = margin + 22;
    var lox = viewMode === 'both' ? margin : (W - boardW) / 2;
    var rox = viewMode === 'both' ? margin + boardW + boardGap : lox;

    var myLabel = getLang() === 'en' ? 'My Fleet' : '我的舰队';
    var enemyLabel = getLang() === 'en' ? 'Enemy Waters' : '敌方海域';

    if (viewMode === 'both' || viewMode === 'my') {
      drawGrid(lox, oy, myLabel, state.myBoard, false, state, pi);
    }
    if (viewMode === 'both' || viewMode === 'enemy') {
      drawGrid(rox, oy, enemyLabel, state.enemyBoard, true, state, pi);
    }

    // Placing phase preview
    if (state.phase === 'placing' && state.currentPlayer === pi && placePreview) {
      var valid = canPlacePreview(state, placePreview.r, placePreview.c, placeOrientation);
      var size = SHIP_SIZES[state.placedCount[pi]];
      drawPlacingPreview(lox, oy, placePreview.r, placePreview.c, placeOrientation, size, valid);
    }

    // Shot animation overlay
    if (animState.type === 'shot') {
      var aOx = animState.shotBoard === 'enemy' ? rox : lox;
      drawShotAnimation(aOx, oy);
    }

    layoutButton();

    // Ship status bar
    drawShipStatus(state, pi, lox, oy + boardH + 8, rox);

    // Control button
    drawControlButton(state, pi);

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
        ? placing + shipType + sizeStr
        : (getLang() === 'en' ? 'Waiting for opponent to place...' : '等待对手放置...');
      ctx.fillText(txt, W / 2, oy - 10);
    } else if (state.phase === 'shooting') {
      var isMyTurn2 = state.currentPlayer === pi;
      var txt2 = isMyTurn2
        ? (getLang() === 'en' ? 'Your turn — click enemy grid to fire!' : '轮到你 — 点击敌方海域开火！')
        : (getLang() === 'en' ? 'Waiting for opponent to fire...' : '等待对手开火...');
      ctx.fillText(txt2, W / 2, oy - 10);
    } else if (state.phase === 'over') {
      var won = state.winner === pi;
      var txt3 = won
        ? (getLang() === 'en' ? 'Victory!' : '胜利！')
        : (getLang() === 'en' ? 'Defeat' : '败北');
      ctx.fillStyle = won ? '#2e7d32' : '#c62828';
      ctx.font = 'bold 16px "Nunito", sans-serif';
      ctx.fillText(txt3, W / 2, oy - 10);
    }
  }

  function drawShipStatus(state, pi, leftOx, topY, rightOx) {
    var sizes = state.shipSizes;
    var placed = state.placedCount[pi];
    var myShips = state.myShips || [];
    var boardW = cs * COLS;

    ctx.font = '11px "Nunito", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#546e7a';
    var label = getLang() === 'en' ? 'Fleet:' : '舰队:';
    ctx.fillText(label, leftOx, topY);

    for (var i = 0; i < sizes.length; i++) {
      var row = i < 3 ? 0 : 1;
      var cellY = topY + 14 + row * 16;
      var cellX = leftOx + (i % 3) * (boardW / 3);

      var shipInfo = myShips[i];
      var sunk = shipInfo && shipInfo.cells && shipInfo.cells.every(function (c) { return c.hit; });

      if (i < placed && shipInfo) {
        ctx.fillStyle = sunk ? '#c62828' : '#1565c0';
        for (var j = 0; j < Math.min(sizes[i], 5); j++) {
          ctx.fillRect(cellX + j * 10, cellY, 8, 12);
        }
        ctx.fillStyle = sunk ? '#c62828' : '#37474f';
        ctx.fillText(shipLabel(shipInfo.type) + (sunk ? ' ✕' : ''), cellX + Math.min(sizes[i], 5) * 10 + 4, cellY);
      } else if (i < placed) {
        ctx.fillStyle = '#90a4ae';
        for (var j2 = 0; j2 < Math.min(sizes[i], 5); j2++) {
          ctx.fillRect(cellX + j2 * 10, cellY, 8, 12);
        }
      } else {
        ctx.fillStyle = '#b0bec5';
        for (var j3 = 0; j3 < Math.min(sizes[i], 5); j3++) {
          ctx.fillRect(cellX + j3 * 10, cellY, 8, 12);
        }
      }
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
        W = Math.min(window.innerWidth, 900);
        H = Math.min(window.innerHeight - 150, 680);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        viewMode = W < 560 ? 'my' : 'both';
        drawFrame(null);
      }
      resize();
      window.addEventListener('resize', resize);

      canvas.addEventListener('click', function (e) {
        var state = window._bsState;
        var pi = window._bsPI;
        if (!state || pi === undefined) return;

        // Control button
        if (bsBtnHit(e.clientX - canvas.getBoundingClientRect().left, e.clientY - canvas.getBoundingClientRect().top)) {
          if (state.phase === 'placing' && state.currentPlayer === pi) {
            placeOrientation = placeOrientation === 'h' ? 'v' : 'h';
          } else if (viewMode === 'my') {
            viewMode = 'enemy';
          } else if (viewMode === 'enemy') {
            viewMode = 'my';
          }
          drawFrame(null);
          return;
        }

        var lox = getBoardOx();
        var oy = margin + 22;

        if (state.phase === 'placing' && state.currentPlayer === pi) {
          var cell = getCellFromEvent(e, lox, oy);
          if (!cell) return;
          var size = SHIP_SIZES[state.placedCount[pi]];
          var valid = canPlacePreview(state, cell.r, cell.c, placeOrientation);
          if (valid) {
            window.makeGameMove({ r: cell.r, c: cell.c, orientation: placeOrientation, size: size });
            placePreview = null;
          }
          drawFrame(null);
        } else if (state.phase === 'shooting' && state.currentPlayer === pi && viewMode !== 'my') {
          var rox = viewMode === 'both' ? (margin + cs * COLS + boardGap) : lox;
          var cell2 = getCellFromEvent(e, rox, oy);
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
        var state = window._bsState;
        if (state && state.phase === 'placing' && state.currentPlayer === window._bsPI) {
          placeOrientation = placeOrientation === 'h' ? 'v' : 'h';
          placePreview = null;
          drawFrame(null);
        }
      });

      canvas.addEventListener('mousemove', function (e) {
        var state = window._bsState;
        var pi = window._bsPI;
        if (!state || pi === undefined) return;
        if (state.phase !== 'placing' || state.currentPlayer !== pi) return;

        var lox = getBoardOx();
        var oy = margin + 22;
        var cell = getCellFromEvent(e, lox, oy);
        if (cell) {
          placePreview = { r: cell.r, c: cell.c };
        } else {
          placePreview = null;
        }
        drawFrame(null);
      });
    },

    render: function (state, container, playerIndex, winner) {
      window._bsState = state;
      window._bsPI = playerIndex;

      if (!canvas || !state) return;
      if (animState.running) return;

      // Auto-switch view on phase change
      if (viewMode !== 'both') {
        if (state.phase === 'placing') viewMode = 'my';
        else if (state.phase === 'shooting' && state.currentPlayer === playerIndex) viewMode = 'enemy';
      }

      drawFrame(null);
    },
  });
})();
