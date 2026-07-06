// Reversi renderer — variable board size 8×8/10×10/12×12, green felt board, flip animation
(function() {
  window.gameRenderers = window.gameRenderers || new Map();
  var canvas, ctx, W, H, cs, margin;
  var ROWS = 8, COLS = 8;
  var BOARD_COLOR = '#2a8a3a';
  var BOARD_BORDER = '#1e6b2a';

  var animState = {
    running: false,
    rafId: null,
    type: 'none',
    startTime: 0,
    flipPieces: [],
    flipDuration: 300,
  };

  var prevBoard = null;

  function drawCell(r, c, x, y, size) {
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }

  function drawPiece(x, y, radius, side, scaleX) {
    var sx = scaleX !== undefined ? scaleX : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, 1);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(2, 3, radius, 0, Math.PI * 2);
    ctx.fill();

    var grad = ctx.createRadialGradient(-radius * 0.2, -radius * 0.3, radius * 0.1, 0, 0, radius);
    if (side === 0) {
      grad.addColorStop(0, '#555');
      grad.addColorStop(1, '#111');
    } else {
      grad.addColorStop(0, '#fff');
      grad.addColorStop(1, '#ccc');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = side === 0 ? '#000' : '#999';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = side === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(-radius * 0.25, -radius * 0.3, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function startAnimLoop() {
    if (animState.running) return;
    animState.running = true;
    animState.startTime = performance.now();
    animTick();
  }

  function stopAnimLoop() {
    animState.running = false;
    animState.type = 'none';
    animState.flipPieces = [];
    if (animState.rafId) {
      cancelAnimationFrame(animState.rafId);
      animState.rafId = null;
    }
  }

  function animTick(now) {
    if (!animState.running) return;
    now = now || performance.now();
    var elapsed = now - animState.startTime;

    if (animState.type === 'flip') {
      var allDone = true;
      for (var i = 0; i < animState.flipPieces.length; i++) {
        var fp = animState.flipPieces[i];
        var pieceElapsed = elapsed - fp.delay;
        if (pieceElapsed < 0) { allDone = false; continue; }
        var t = Math.min(pieceElapsed / animState.flipDuration, 1.0);
        fp.scaleX = 1 - 2 * t;
        fp.progress = t;
        if (t < 1.0) allDone = false;
      }
      if (allDone) stopAnimLoop();
    }

    drawFrame(now);

    if (animState.running) {
      animState.rafId = requestAnimationFrame(animTick);
    } else {
      animState.rafId = null;
    }
  }

  function cloneBoard(board) {
    if (!board) return null;
    return board.map(function(row) { return row.slice(); });
  }

  function detectFlip(prev, curr) {
    if (!prev || !curr) return null;
    var placed = null;
    var flipped = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var pv = prev[r] && prev[r][c];
        var cv = curr[r] && curr[r][c];
        if (pv === null && cv !== null) {
          placed = { row: r, col: c, side: cv };
        } else if (pv !== null && cv !== null && pv !== cv) {
          flipped.push({ row: r, col: c, fromSide: pv, toSide: cv });
        }
      }
    }
    if (placed) return { placed: placed, flipped: flipped };
    return null;
  }

  function drawFrame(now) {
    var state = window._rvState;
    if (!state || !state.board) return;

    var dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    var boardW = cs * COLS;
    var boardH = cs * ROWS;

    ctx.fillStyle = BOARD_BORDER;
    ctx.beginPath();
    roundRect(ctx, margin - 12, margin - 12, boardW + 24, boardH + 24, 10);
    ctx.fill();

    ctx.fillStyle = BOARD_COLOR;
    ctx.beginPath();
    roundRect(ctx, margin - 8, margin - 8, boardW + 16, boardH + 16, 8);
    ctx.fill();

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var x = margin + c * cs;
        var y = margin + r * cs;
        drawCell(r, c, x, y, cs);
      }
    }

    // Star points at the initial piece positions
    var mid = Math.floor(ROWS / 2);
    var starPts = [[mid-1,mid-1],[mid-1,mid],[mid,mid-1],[mid,mid]];
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (var si = 0; si < starPts.length; si++) {
      var sp = starPts[si];
      ctx.beginPath();
      ctx.arc(margin + sp[1] * cs + cs / 2, margin + sp[0] * cs + cs / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.lastMove && animState.type !== 'flip') {
      var lmx = margin + state.lastMove.col * cs + cs / 2;
      var lmy = margin + state.lastMove.row * cs + cs / 2;
      ctx.strokeStyle = '#c8a45c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(lmx, lmy, cs * 0.44, 0, Math.PI * 2);
      ctx.stroke();
    }

    var legalMoves = state.legalMoves || [];
    if (animState.type !== 'flip') {
      for (var mi = 0; mi < legalMoves.length; mi++) {
        var mv = legalMoves[mi];
        var dotX = margin + mv.col * cs + cs / 2;
        var dotY = margin + mv.row * cs + cs / 2;
        var pi2 = parseInt(sessionStorage.getItem('playerIndex'));
        var dotColor = pi2 === 0 ? 'rgba(30,30,30,0.4)' : 'rgba(255,255,255,0.5)';
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(dotX, dotY, cs * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    var pieceRadius = cs * 0.38;
    var animFlipMap = {};
    if (animState.type === 'flip') {
      for (var ai = 0; ai < animState.flipPieces.length; ai++) {
        var afp = animState.flipPieces[ai];
        var key = afp.row + ',' + afp.col;
        animFlipMap[key] = afp;
      }
    }

    for (var pr = 0; pr < ROWS; pr++) {
      for (var pc = 0; pc < COLS; pc++) {
        var val = state.board[pr] && state.board[pr][pc];
        if (val === null || val === undefined) continue;

        var px = margin + pc * cs + cs / 2;
        var py = margin + pr * cs + cs / 2;
        var fKey = pr + ',' + pc;

        if (animFlipMap[fKey]) {
          var fp = animFlipMap[fKey];
          var absScaleX = Math.abs(fp.scaleX);
          var displaySide = fp.scaleX > 0 ? fp.fromSide : fp.toSide;
          drawPiece(px, py, pieceRadius, displaySide, absScaleX);
        } else {
          drawPiece(px, py, pieceRadius, val, 1);
        }
      }
    }

    var scoreY = margin;
    var scoreX = margin - 40;
    if (scoreX > 30) {
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(scoreX, scoreY + 12, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px system-ui,-apple-system,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('' + (state.scores ? state.scores[0] : 2), scoreX, scoreY + 13);

      ctx.fillStyle = '#eee';
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(scoreX, scoreY + 36, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.fillText('' + (state.scores ? state.scores[1] : 2), scoreX, scoreY + 37);
    }

    var statusY = margin + boardH + 28;
    ctx.fillStyle = '#333';
    ctx.font = 'bold 15px system-ui,-apple-system,sans-serif';
    ctx.textAlign = 'center';
    var pi3 = parseInt(sessionStorage.getItem('playerIndex'));
    if (state.winner != null) {
      if (state.winner === -1) {
        ctx.fillText('平局！', W / 2, statusY);
      } else {
        ctx.fillText(state.winner === pi3 ? '🏆 你赢了！' : '😢 你输了', W / 2, statusY);
      }
      ctx.font = '13px system-ui,-apple-system,sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText((state.scores ? state.scores[0] : 0) + ' : ' + (state.scores ? state.scores[1] : 0), W / 2, statusY + 20);
    } else {
      if (state.currentPlayer === pi3) {
        ctx.fillStyle = '#c8a45c';
        ctx.fillText('▼ 轮到你落子 ▼', W / 2, statusY);
      } else {
        var cp = (window.gamePlayers || [])[state.currentPlayer];
        ctx.fillText('对手回合 · ' + (cp ? cp.name : '等待中'), W / 2, statusY);
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
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

  window.gameRenderers.set('reversi', {
    init: function(container) {
      canvas = document.createElement('canvas');
      canvas.id = 'rvCanvas';
      canvas.style.cssText = 'width:100%;display:block;border-radius:16px;touch-action:manipulation;';
      container.appendChild(canvas);
      ctx = canvas.getContext('2d');

      stopAnimLoop();
      prevBoard = null;

      var resize = function() {
        var avW = window.innerWidth - (window.innerWidth > 600 ? 80 : 32);
        var avH = window.innerHeight - 240;
        W = Math.min(avW, avH, 720);
        W = Math.max(W, 240);
        var dpr = window.devicePixelRatio || 1;
        cs = (W - 80) / Math.max(COLS, 8);
        margin = 50;
        H = margin * 2 + cs * Math.max(ROWS, 8) + 50;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr);
        if (animState.type !== 'flip') {
          var dpr2 = window.devicePixelRatio || 1;
          ctx.clearRect(0, 0, canvas.width / dpr2, canvas.height / dpr2);
          drawFrame(null);
        }
      };
      resize(); window.addEventListener('resize', resize);

      canvas.addEventListener('click', function(e) {
        var rect = canvas.getBoundingClientRect();
        var x = (e.clientX - rect.left) * (W / rect.width);
        var y = (e.clientY - rect.top) * (H / rect.height);
        var col = Math.round((x - margin - cs / 2) / cs);
        var row = Math.round((y - margin - cs / 2) / cs);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

        var state = window._rvState;
        var pi = parseInt(sessionStorage.getItem('playerIndex'));
        if (!state || state.winner != null) return;
        if (state.currentPlayer !== pi) return;

        var legalMoves = state.legalMoves || [];
        var isLegal = false;
        for (var i = 0; i < legalMoves.length; i++) {
          if (legalMoves[i].row === row && legalMoves[i].col === col) {
            isLegal = true;
            break;
          }
        }
        if (!isLegal) return;

        window.makeGameMove({ row: row, col: col });
      });

      canvas.addEventListener('click', function(e) {
        var rect = canvas.getBoundingClientRect();
        var y = (e.clientY - rect.top) * (H / rect.height);
        var state = window._rvState;
        var pi = parseInt(sessionStorage.getItem('playerIndex'));
        if (!state || state.winner != null || state.currentPlayer !== pi) return;
        if (y > margin + cs * ROWS + 5) {
          var legalMoves = state.legalMoves || [];
          if (legalMoves.length === 0) {
            window.makeGameMove({ pass: true });
          }
        }
      });
    },

    render: function(state, container, playerIndex, winner) {
      window._rvState = state;
      if (!canvas || !state || !state.board) return;

      var newSize = state.boardSize || 8;
      if (COLS !== newSize) {
        COLS = newSize;
        ROWS = newSize;
        // Recalc canvas size to fit the new board
        var avW = window.innerWidth - (window.innerWidth > 600 ? 80 : 32);
        var avH = window.innerHeight - 240;
        W = Math.min(avW, avH, 720);
        W = Math.max(W, 240);
        var dpr2 = window.devicePixelRatio || 1;
        cs = (W - 80) / Math.max(COLS, 8);
        H = margin * 2 + cs * Math.max(ROWS, 8) + 50;
        canvas.width = W * dpr2; canvas.height = H * dpr2;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr2, dpr2);
        // Board shape changed — discard stale flip-detection snapshot from a
        // previous (different-sized) board; otherwise detectFlip would index
        // out of bounds and throw, leaving the new board unrendered.
        prevBoard = null;
        stopAnimLoop();
      }

      if (!animState.running && prevBoard && animState.type !== 'flip' && state.board) {
        var diff = detectFlip(prevBoard, state.board);
        if (diff && diff.flipped.length > 0) {
          stopAnimLoop();
          animState.type = 'flip';
          animState.flipPieces = diff.flipped.map(function(f, idx) {
            return {
              row: f.row, col: f.col,
              fromSide: f.fromSide, toSide: f.toSide,
              delay: idx * 120,
              scaleX: 1, progress: 0,
            };
          });
          animState.startTime = performance.now();
          startAnimLoop();
        }
      }

      prevBoard = cloneBoard(state.board);

      if (animState.running) return;

      var dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      drawFrame(null);
    }
  });
})();
