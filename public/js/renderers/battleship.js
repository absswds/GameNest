// Battleship renderer — dual 10×10 grids, placing + shooting phases
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var ROWS = 10, COLS = 10;
  var SHIP_SIZES = [5, 4, 3, 3, 2];
  var SHIP_LABELS = { carrier: '航母', battleship: '战列', cruiser: '巡洋', submarine: '潜艇', destroyer: '驱逐' };
  var SHIP_LABELS_EN = { carrier: 'Carrier', battleship: 'Battleship', cruiser: 'Cruiser', submarine: 'Submarine', destroyer: 'Destroyer' };

  var canvas, ctx, W, H;
  var cs; // cell size
  var margin = 40;
  var boardGap = 50;

  // Placing state
  var placePhase = 'orientation'; // 'orientation' | 'origin'
  var placeOrientation = 'h';
  var placePreview = null; // {r,c}

  // Animation state machine
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

  var prevEnemyBoard = null;
  var prevMyBoard = null;

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
    // Board background
    ctx.fillStyle = '#e8edf2';
    rrect(ox - 4, oy - 4, cs * COLS + 8, cs * ROWS + 8, 6);
    ctx.fill();

    // Grid lines
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

    // Column labels A-J
    ctx.fillStyle = '#78909c';
    ctx.font = '11px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var c2 = 0; c2 < COLS; c2++) {
      ctx.fillText(String.fromCharCode(65 + c2), ox + c2 * cs + cs / 2, oy - 14);
    }
    // Row labels 1-10
    for (var r2 = 0; r2 < ROWS; r2++) {
      ctx.fillText(String(r2 + 1), ox - 14, oy + r2 * cs + cs / 2);
    }

    // Title
    ctx.fillStyle = '#37474f';
    ctx.font = 'bold 14px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, ox + COLS * cs / 2, oy - 28);

    if (!boardData) return;

    // Draw cells
    for (var r3 = 0; r3 < ROWS; r3++) {
      for (var c3 = 0; c3 < COLS; c3++) {
        var x = ox + c3 * cs;
        var y = oy + r3 * cs;
        var cell = boardData[r3] && boardData[r3][c3];

        if (isEnemy) {
          // Enemy board: show shot results
          if (cell && cell.shot === 'hit') {
            ctx.fillStyle = 'rgba(244,67,54,0.25)';
            ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
            // Red X
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
            // Bold red X
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
            // Small dot for miss
            ctx.fillStyle = '#90a4ae';
            ctx.beginPath();
            ctx.arc(x + cs / 2, y + cs / 2, cs * 0.12, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // My board: show ships and incoming shots
          if (cell && cell.hasShip) {
            ctx.fillStyle = cell.shot === 'hit' ? 'rgba(244,67,54,0.35)' : 'rgba(33,150,243,0.25)';
            ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
            // Ship cell border
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
      // Ripple effect
      var maxR = cs * 0.6;
      ctx.strokeStyle = 'rgba(144,164,174,' + (0.8 * (1 - progress)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, maxR * progress, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Hit/sunk explosion
      var radius = cs * 0.4 * (1 - progress * 0.5);
      var alpha = 0.7 * (1 - progress);
      ctx.fillStyle = animState.shotResult === 'sunk'
        ? 'rgba(183,28,28,' + alpha + ')'
        : 'rgba(244,67,54,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Sparks
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

    // Calculate cell size
    var totalWidth = W - margin * 2;
    cs = Math.floor((totalWidth - boardGap) / COLS / 2);
    cs = Math.max(20, Math.min(cs, 38));

    var boardW = cs * COLS;
    var boardH = cs * ROWS;
    var leftOx = margin;
    var rightOx = margin + boardW + boardGap;
    var oy = margin + 30;

    // Left board: my ships
    var myLabel = getLang() === 'en' ? 'My Fleet' : '我的舰队';
    drawGrid(leftOx, oy, myLabel, state.myBoard, false, state, pi);

    // Right board: enemy
    var enemyLabel = getLang() === 'en' ? 'Enemy Waters' : '敌方海域';
    drawGrid(rightOx, oy, enemyLabel, state.enemyBoard, true, state, pi);

    // Placing phase preview
    if (state.phase === 'placing' && state.currentPlayer === pi && placePreview) {
      var valid = canPlacePreview(state, placePreview.r, placePreview.c, placeOrientation);
      var size = SHIP_SIZES[state.placedCount[pi]];
      drawPlacingPreview(leftOx, oy, placePreview.r, placePreview.c, placeOrientation, size, valid);
    }

    // Shot animation overlay
    if (animState.type === 'shot') {
      var aOx = animState.shotBoard === 'enemy' ? rightOx : leftOx;
      var aBoard = animState.shotBoard === 'enemy' ? state.enemyBoard : state.myBoard;
      drawShotAnimation(aOx, oy, aBoard);
    }

    // Ship status bar at bottom
    drawShipStatus(state, pi, leftOx, oy + boardH + 16, rightOx);

    // Phase indicator
    ctx.fillStyle = '#37474f';
    ctx.font = 'bold 13px "Nunito", sans-serif';
    ctx.textAlign = 'center';

    if (state.phase === 'placing') {
      var isMyTurn = state.currentPlayer === pi;
      var txt = isMyTurn
        ? (getLang() === 'en' ? 'Your turn to place ships' : '轮到你放置战舰')
        : (getLang() === 'en' ? 'Waiting for opponent to place...' : '等待对手放置...');
      ctx.fillText(txt, W / 2, oy - 8);
    } else if (state.phase === 'shooting') {
      var isMyTurn2 = state.currentPlayer === pi;
      var txt2 = isMyTurn2
        ? (getLang() === 'en' ? 'Your turn — click enemy grid to fire!' : '轮到你 — 点击敌方海域开火！')
        : (getLang() === 'en' ? 'Waiting for opponent to fire...' : '等待对手开火...');
      ctx.fillText(txt2, W / 2, oy - 8);
    } else if (state.phase === 'over') {
      var won = state.winner === pi;
      var txt3 = won
        ? (getLang() === 'en' ? 'Victory!' : '胜利！')
        : (getLang() === 'en' ? 'Defeat' : '败北');
      ctx.fillStyle = won ? '#2e7d32' : '#c62828';
      ctx.font = 'bold 16px "Nunito", sans-serif';
      ctx.fillText(txt3, W / 2, oy - 8);
    }
  }

  function drawShipStatus(state, pi, leftOx, topY, rightOx) {
    var sizes = state.shipSizes;
    var placed = state.placedCount[pi];
    var myShips = state.myShips || [];
    var totalW = cs * COLS;
    var y = topY;

    ctx.font = '11px "Nunito", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // My fleet status (left)
    ctx.fillStyle = '#546e7a';
    var label = getLang() === 'en' ? 'Fleet:' : '舰队:';
    ctx.fillText(label, leftOx, y);

    for (var i = 0; i < sizes.length; i++) {
      var x = leftOx + (i < 3 ? 0 : (i === 3 ? totalW * 0.4 : totalW * 0.7));
      var row = i < 3 ? 0 : 1;
      var cellY = y + 14 + row * 16;
      var cellX = leftOx + (i % 3) * (totalW / 3);

      var shipInfo = myShips[i];
      var sunk = shipInfo && shipInfo.cells && shipInfo.cells.every(function (c) { return c.hit; });

      if (i < placed && shipInfo) {
        ctx.fillStyle = sunk ? '#c62828' : '#1565c0';
        // Draw small ship icon
        for (var j = 0; j < sizes[i]; j++) {
          ctx.fillRect(cellX + j * 10, cellY, 8, 12);
        }
        ctx.fillStyle = sunk ? '#c62828' : '#37474f';
        ctx.fillText(shipLabel(shipInfo.type) + (sunk ? ' ✕' : ''), cellX + sizes[i] * 10 + 4, cellY);
      } else if (i < placed) {
        ctx.fillStyle = '#90a4ae';
        for (var j2 = 0; j2 < sizes[i]; j2++) {
          ctx.fillRect(cellX + j2 * 10, cellY, 8, 12);
        }
      } else {
        ctx.fillStyle = '#b0bec5';
        for (var j3 = 0; j3 < sizes[i]; j3++) {
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
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var c = Math.floor((mx - ox) / cs);
    var r = Math.floor((my - oy) / cs);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) return { r: r, c: c };
    return null;
  }

  // ---- Renderer registration ----

  window.gameRenderers.set('battleship', {
    init: function (container) {
      canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.touchAction = 'none';
      container.appendChild(canvas);
      ctx = canvas.getContext('2d');

      function resize() {
        var dpr = window.devicePixelRatio || 1;
        W = Math.min(window.innerWidth, 900);
        H = Math.min(window.innerHeight - 120, 680);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawFrame(null);
      }
      resize();
      window.addEventListener('resize', resize);

      // Click handler
      canvas.addEventListener('click', function (e) {
        var state = window._bsState;
        var pi = window._bsPI;
        if (!state || pi === undefined) return;

        var totalWidth = W - margin * 2;
        var cellSize = Math.floor((totalWidth - boardGap) / COLS / 2);
        cellSize = Math.max(20, Math.min(cellSize, 38));
        var boardW = cellSize * COLS;
        var leftOx = margin;
        var rightOx = margin + boardW + boardGap;
        var oy = margin + 30;

        if (state.phase === 'placing' && state.currentPlayer === pi) {
          var cell = getCellFromEvent(e, leftOx, oy);
          if (!cell) return;

          var size = SHIP_SIZES[state.placedCount[pi]];
          if (placePhase === 'orientation') {
            // Toggle orientation on click
            placeOrientation = placeOrientation === 'h' ? 'v' : 'h';
            placePreview = { r: cell.r, c: cell.c };
            placePhase = 'origin';
            drawFrame(null);
            return;
          }

          // placePhase === 'origin'
          if (!placePreview) {
            placePreview = { r: cell.r, c: cell.c };
            drawFrame(null);
            return;
          }

          // Try to place at clicked cell
          var valid = canPlacePreview(state, cell.r, cell.c, placeOrientation);
          if (valid) {
            window.makeGameMove({
              r: cell.r,
              c: cell.c,
              orientation: placeOrientation,
              size: size,
            });
            placePhase = 'orientation';
            placePreview = null;
          } else {
            // Reset and start over
            placePreview = { r: cell.r, c: cell.c };
            drawFrame(null);
          }
        } else if (state.phase === 'shooting' && state.currentPlayer === pi) {
          var cell2 = getCellFromEvent(e, rightOx, oy);
          if (!cell2) return;

          // Check if already shot
          if (state.enemyBoard[cell2.r] && state.enemyBoard[cell2.r][cell2.c] &&
              state.enemyBoard[cell2.r][cell2.c].shot) return;

          // Start shot animation
          var result = state.enemyBoard[cell2.r] && state.enemyBoard[cell2.r][cell2.c]
            ? state.enemyBoard[cell2.r][cell2.c].shot : null;
          stopAnimLoop();
          animState.type = 'shot';
          animState.shotR = cell2.r;
          animState.shotC = cell2.c;
          animState.shotResult = 'hit'; // optimistic, server will confirm
          animState.shotProgress = 0;
          animState.shotBoard = 'enemy';
          startAnimLoop();

          window.makeGameMove({ r: cell2.r, c: cell2.c });
        }
      });

      // Right-click to cancel placing
      canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var state = window._bsState;
        if (state && state.phase === 'placing' && state.currentPlayer === window._bsPI) {
          placePhase = 'orientation';
          placePreview = null;
          placeOrientation = 'h';
          drawFrame(null);
        }
      });

      // Hover for placing preview
      canvas.addEventListener('mousemove', function (e) {
        var state = window._bsState;
        var pi = window._bsPI;
        if (!state || pi === undefined) return;
        if (state.phase !== 'placing' || state.currentPlayer !== pi) return;

        var totalWidth = W - margin * 2;
        var cellSize = Math.floor((totalWidth - boardGap) / COLS / 2);
        cellSize = Math.max(20, Math.min(cellSize, 38));
        var boardW = cellSize * COLS;
        var leftOx = margin;
        var oy = margin + 30;

        var cell = getCellFromEvent(e, leftOx, oy);
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

      // If animation is running, animTick handles drawing
      if (animState.running) return;

      drawFrame(null);
    },
  });
})();
