// Checkers renderer v1 — 8×8 dark/light board,圆形棋子, pickup/move animations
(function() {
  window.gameRenderers = window.gameRenderers || new Map();
  var ROWS = 8, COLS = 8;
  var canvas, ctx, W, margin, cs;
  var selRow = -1, selCol = -1;

  // Animation state machine
  var animState = {
    running: false,
    rafId: null,
    type: 'none',       // 'none' | 'pickup' | 'move'
    startTime: 0,
    pickupRow: -1, pickupCol: -1,
    pickupScale: 1.0,
    pickupShadowOffset: 2.5,
    moveFromRow: -1, moveFromCol: -1,
    moveToRow: -1, moveToCol: -1,
    movePiece: null,
    moveProgress: 0,
    moveCaptured: null,
  };

  var prevBoard = null;

  // ---- Drawing helpers ----

  function drawPiece(x, y, piece, isSelected, animScale, shadowOffset) {
    var radius = cs * 0.38 * (animScale || 1.0);
    var sdOff = shadowOffset || 2.5;
    var isRed = piece.side === 0;
    var isKing = piece.type === 'k';

    // Selection glow
    if (isSelected) {
      var glowRadius = radius + 7 + (animScale > 1 ? 5 : 0);
      var glow = ctx.createRadialGradient(x, y, radius * 0.6, x, y, glowRadius);
      glow.addColorStop(0, 'rgba(255,215,0,0.7)');
      glow.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, glowRadius, 0, Math.PI * 2); ctx.fill();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,' + (0.2 + (animScale > 1 ? (animScale - 1) * 1.0 : 0)) + ')';
    ctx.beginPath(); ctx.arc(x + sdOff, y + sdOff + 1, radius, 0, Math.PI * 2); ctx.fill();

    // Piece body
    var hlX = x - radius * 0.25;
    var hlY = y - radius * 0.35;
    if (animScale > 1) { hlY -= radius * 0.08; }
    var grad = ctx.createRadialGradient(hlX, hlY, radius * 0.05, x, y, radius);
    if (isRed) {
      grad.addColorStop(0, '#ff6b5b');
      grad.addColorStop(0.5, '#d44030');
      grad.addColorStop(1, '#a02818');
    } else {
      grad.addColorStop(0, '#555');
      grad.addColorStop(0.5, '#333');
      grad.addColorStop(1, '#1a1a1a');
    }
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();

    // Outer ring
    ctx.strokeStyle = isRed ? '#8b1a0a' : '#000';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();

    // Inner ring for depth
    ctx.strokeStyle = isRed ? 'rgba(255,200,180,0.3)' : 'rgba(200,200,200,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, radius * 0.75, 0, Math.PI * 2); ctx.stroke();

    // King crown marker
    if (isKing) {
      ctx.fillStyle = isRed ? '#ffd700' : '#ffd700';
      ctx.font = 'bold ' + (radius * 0.9) + 'px "Segoe UI Symbol","Apple Symbols","Noto Sans Symbols",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('♛', x, y + 1);
    }

    // Selection highlight ring
    if (isSelected) {
      ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(x, y, radius + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ---- Animation loop ----

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

    if (animState.type === 'pickup') {
      var t = Math.min(elapsed / 150, 1.0);
      t = 1 - Math.pow(1 - t, 3);
      animState.pickupScale = 1.0 + 0.08 * t;
      animState.pickupShadowOffset = 2.5 + 5.5 * t;
      if (t >= 1.0) {
        animState.pickupScale = 1.08;
        animState.pickupShadowOffset = 8;
        animState.running = false;
      }
    } else if (animState.type === 'move') {
      var t2 = Math.min(elapsed / 250, 1.0);
      t2 = t2 < 0.5 ? 2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 2) / 2;
      animState.moveProgress = t2;
      if (t2 >= 1.0) {
        animState.moveProgress = 1.0;
        animState.type = 'none';
        animState.running = false;
        selRow = -1; selCol = -1;
      }
    }

    drawFrame(now);

    if (animState.running) {
      animState.rafId = requestAnimationFrame(animTick);
    } else {
      animState.rafId = null;
    }
  }

  // ---- Board diff for opponent move detection ----

  function detectMove(prev, curr) {
    var movedFrom = null, movedTo = null, capturedPiece = null;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var prevP = prev[r][c];
        var currP = curr[r][c];
        if (prevP && !currP) {
          if (!movedFrom) { movedFrom = { row: r, col: c }; }
          else { capturedPiece = prevP; }
        }
        if (!prevP && currP) {
          movedTo = { row: r, col: c };
        }
        if (prevP && currP && (prevP.type !== currP.type || prevP.side !== currP.side)) {
          movedTo = { row: r, col: c };
          capturedPiece = prevP;
        }
      }
    }
    if (movedFrom && movedTo) {
      return { fromRow: movedFrom.row, fromCol: movedFrom.col,
               toRow: movedTo.row, toCol: movedTo.col, captured: capturedPiece };
    }
    return null;
  }

  function cloneBoard(board) {
    return board.map(function(row) {
      return row.map(function(cell) { return cell ? { type: cell.type, side: cell.side } : null; });
    });
  }

  // ---- Main draw ----

  function drawFrame(now) {
    var state = window._ckState;
    if (!state) return;

    var dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    var boardH = cs * (ROWS - 1);

    // Board background
    ctx.fillStyle = '#f0d9b5';
    ctx.fillRect(margin - 16, margin - 16, cs * (COLS - 1) + 32, boardH + 32);

    // Draw 8x8 checkerboard
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var x = margin + c * cs - cs * 0.5;
        var y = margin + r * cs - cs * 0.5;
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = '#eeeed2';
        } else {
          ctx.fillStyle = '#769656';
        }
        ctx.fillRect(x, y, cs, cs);
      }
    }

    // Board border
    ctx.strokeStyle = '#5a7a3a'; ctx.lineWidth = 3;
    ctx.strokeRect(margin - cs * 0.5, margin - cs * 0.5, cs * COLS, cs * ROWS);

    // Valid move indicators
    var legalMoves = state.legalMoves || [];
    if (selRow >= 0 && selCol >= 0 && animState.type !== 'move') {
      for (var mi = 0; mi < legalMoves.length; mi++) {
        var m = legalMoves[mi];
        if (m.from.row === selRow && m.from.col === selCol) {
          var mx = margin + m.to.col * cs;
          var my = margin + m.to.row * cs;
          if (m.captures && m.captures.length > 0) {
            // Capture indicator: red ring
            ctx.strokeStyle = 'rgba(220, 60, 40, 0.7)'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(mx, my, cs * 0.42 + 3, 0, Math.PI * 2); ctx.stroke();
          } else {
            // Empty square: green dot
            ctx.fillStyle = 'rgba(80, 150, 80, 0.5)';
            ctx.beginPath(); ctx.arc(mx, my, cs * 0.14, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(80, 150, 80, 0.65)'; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.arc(mx, my, cs * 0.14, 0, Math.PI * 2); ctx.stroke();
          }
        }
      }
    }

    // Pieces
    for (var rr = 0; rr < ROWS; rr++) {
      for (var cc = 0; cc < COLS; cc++) {
        var piece = state.board[rr][cc];
        if (!piece) continue;

        if (animState.type === 'pickup' && rr === animState.pickupRow && cc === animState.pickupCol) continue;
        if (animState.type === 'move' && rr === animState.moveFromRow && cc === animState.moveFromCol) continue;
        if (animState.type === 'move' && animState.moveCaptured &&
            rr === animState.moveToRow && cc === animState.moveToCol) {
          if (animState.moveProgress < 0.55) continue;
        }

        var px = margin + cc * cs, py = margin + rr * cs;
        var isSel = selRow === rr && selCol === cc && animState.type !== 'move';
        drawPiece(px, py, piece, isSel, 1.0, 2.5);
      }
    }

    // Animation overlay
    if (animState.type === 'pickup') {
      var pPiece = state.board[animState.pickupRow][animState.pickupCol];
      if (pPiece) {
        var apx = margin + animState.pickupCol * cs;
        var apy = margin + animState.pickupRow * cs;
        drawPiece(apx, apy, pPiece, true, animState.pickupScale, animState.pickupShadowOffset);
      }
    } else if (animState.type === 'move') {
      var srcPiece = animState.movePiece;
      if (srcPiece) {
        var sx = margin + animState.moveFromCol * cs;
        var sy = margin + animState.moveFromRow * cs;
        var dx = margin + animState.moveToCol * cs;
        var dy = margin + animState.moveToRow * cs;
        var progress = animState.moveProgress;
        var arcOffset = Math.sin(progress * Math.PI) * cs * 0.18;
        var cx = sx + (dx - sx) * progress;
        var cy = sy + (dy - sy) * progress - arcOffset;
        var mScale = 1.0 + 0.04 * Math.sin(progress * Math.PI);
        var mShadow = 4 + 3 * Math.sin(progress * Math.PI);
        drawPiece(cx, cy, srcPiece, false, mScale, mShadow);
      }
    }

    // Status bar
    var sy2 = margin + boardH + cs * 0.5 + 22;
    ctx.fillStyle = '#3a3028'; ctx.font = 'bold 16px "Segoe UI",system-ui,-apple-system,sans-serif';
    ctx.textAlign = 'center';
    var pi = parseInt(sessionStorage.getItem('playerIndex'));
    if (state.winner != null) {
      ctx.fillText(state.winner === pi ? '🏆 你赢了！' : '😢 你输了', W / 2, sy2);
    } else {
      if (state.currentPlayer === pi) {
        ctx.fillStyle = '#c8a45c'; ctx.fillText('▼ 轮到你走棋 ▼', W / 2, sy2);
      } else {
        var cp = (window.gamePlayers || [])[state.currentPlayer];
        ctx.fillText('对手回合 · ' + (cp ? cp.name : '等待中'), W / 2, sy2);
      }
    }
  }

  // ---- Renderer registration ----

  window.gameRenderers.set('checkers', {
    init: function(container) {
      canvas = document.createElement('canvas');
      canvas.id = 'ckCanvas';
      canvas.style.cssText = 'width:100%;display:block;border-radius:16px;touch-action:manipulation;';
      container.appendChild(canvas);
      ctx = canvas.getContext('2d');

      // Reset state on init
      stopAnimLoop();
      selRow = -1; selCol = -1;
      prevBoard = null;

      var resize = function() {
        var avW = window.innerWidth - (window.innerWidth > 600 ? 80 : 32);
        var avH = window.innerHeight - 240;
        W = Math.min(avW, avH, 960);
        W = Math.max(W, 240);
        var dpr = window.devicePixelRatio || 1;
        cs = (W - 60) / (COLS - 1);
        margin = 30 + cs * 0.5;
        var H = margin * 2 + cs * (ROWS - 1);
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr);
      };
      resize(); window.addEventListener('resize', resize);

      canvas.addEventListener('click', function(e) {
        var rect = canvas.getBoundingClientRect();
        var x = (e.clientX - rect.left) * (W / rect.width);
        var y = (e.clientY - rect.top) * (W / rect.width);
        var col = Math.round((x - margin) / cs);
        var row = Math.round((y - margin) / cs);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) { selRow = -1; return; }
        var state = window._ckState;
        var pi = parseInt(sessionStorage.getItem('playerIndex'));
        if (!state || state.winner != null) return;
        if (state.currentPlayer !== pi) { selRow = -1; return; }

        if (selRow >= 0 && selCol >= 0) {
          var clickedPiece = state.board[row][col];
          if (clickedPiece && clickedPiece.side === pi) {
            stopAnimLoop();
            selRow = row; selCol = col;
            animState.type = 'pickup';
            animState.pickupRow = row;
            animState.pickupCol = col;
            animState.pickupScale = 1.0;
            animState.pickupShadowOffset = 2.5;
            startAnimLoop();
            return;
          }

          var legalMoves = state.legalMoves || [];
          var isValid = false;
          var matchMove = null;
          for (var mi = 0; mi < legalMoves.length; mi++) {
            var m = legalMoves[mi];
            if (m.from.row === selRow && m.from.col === selCol && m.to.row === row && m.to.col === col) {
              isValid = true;
              matchMove = m;
              break;
            }
          }
          if (!isValid) {
            selRow = -1; selCol = -1;
            return;
          }

          var captured = state.board[row][col];
          stopAnimLoop();
          animState.type = 'move';
          animState.moveFromRow = selRow; animState.moveFromCol = selCol;
          animState.moveToRow = row; animState.moveToCol = col;
          animState.movePiece = { type: state.board[selRow][selCol].type, side: state.board[selRow][selCol].side };
          animState.moveCaptured = captured ? { type: captured.type, side: captured.side } : null;
          animState.moveProgress = 0;
          startAnimLoop();

          window.makeGameMove({
            from: { row: selRow, col: selCol },
            to: { row: row, col: col }
          });
        } else {
          var piece = state.board[row][col];
          if (piece && piece.side === pi) {
            stopAnimLoop();
            selRow = row; selCol = col;
            animState.type = 'pickup';
            animState.pickupRow = row;
            animState.pickupCol = col;
            animState.pickupScale = 1.0;
            animState.pickupShadowOffset = 2.5;
            startAnimLoop();
          } else {
            selRow = -1; selCol = -1;
          }
        }
      });
    },

    render: function(state, container, playerIndex, winner) {
      window._ckState = state;
      if (!canvas || !state || !state.board) return;

      if (!animState.running && prevBoard && selRow === -1 && selCol === -1) {
        var move = detectMove(prevBoard, state.board);
        if (move) {
          stopAnimLoop();
          animState.type = 'move';
          animState.moveFromRow = move.fromRow;
          animState.moveFromCol = move.fromCol;
          animState.moveToRow = move.toRow;
          animState.moveToCol = move.toCol;
          animState.movePiece = state.board[move.toRow][move.toCol];
          animState.moveCaptured = move.captured;
          animState.moveProgress = 0;
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
