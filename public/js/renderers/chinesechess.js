// Chinese Chess renderer v4 — valid-move indicators + pickup/move animations
(function() {
  window.gameRenderers = window.gameRenderers || new Map();
  var ROWS = 10, COLS = 9;
  var PIECE_NAMES = {
    K:{0:'帅',1:'将'}, R:{0:'车',1:'車'}, H:{0:'马',1:'馬'},
    C:{0:'炮',1:'砲'}, E:{0:'相',1:'象'}, A:{0:'仕',1:'士'}, P:{0:'兵',1:'卒'}
  };
  var canvas, ctx, W, margin, cs;
  var selRow = -1, selCol = -1; // selected piece

  // Animation state machine
  var animState = {
    running: false,
    rafId: null,
    type: 'none',       // 'none' | 'pickup' | 'move'
    startTime: 0,
    // Pickup animation
    pickupRow: -1, pickupCol: -1,
    pickupScale: 1.0,
    pickupShadowOffset: 2.5,
    // Move animation
    moveFromRow: -1, moveFromCol: -1,
    moveToRow: -1, moveToCol: -1,
    movePiece: null,     // { type, side } snapshot
    moveProgress: 0,
    moveCaptured: null,
  };

  // Snapshot of previous board for detecting opponent moves
  var prevBoard = null;

  // ---- Drawing helpers ----

  function drawPiece(x, y, piece, isRed, isSelected, animScale, shadowOffset) {
    var radius = cs * 0.42 * (animScale || 1.0);
    var sdOff = shadowOffset || 2.5;

    // Selection glow (enhanced during pickup)
    if (isSelected) {
      var glowRadius = radius + 7 + (animScale > 1 ? 5 : 0);
      var glow = ctx.createRadialGradient(x, y, radius * 0.6, x, y, glowRadius);
      glow.addColorStop(0, 'rgba(255,215,0,0.7)');
      glow.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, glowRadius, 0, Math.PI * 2); ctx.fill();
    }

    // Piece shadow (deepens during pickup)
    ctx.fillStyle = 'rgba(0,0,0,' + (0.2 + (animScale > 1 ? (animScale - 1) * 1.0 : 0)) + ')';
    ctx.beginPath(); ctx.arc(x + sdOff, y + sdOff + 1, radius, 0, Math.PI * 2); ctx.fill();

    // Piece body — radial gradient for 3D effect
    var hlX = x - radius * 0.25;
    var hlY = y - radius * 0.35; // highlight shifts up slightly during pickup
    if (animScale > 1) { hlY -= radius * 0.08; }
    var grad = ctx.createRadialGradient(hlX, hlY, radius * 0.05, x, y, radius);
    grad.addColorStop(0, '#fffef5');
    grad.addColorStop(0.5, '#f0e8c8');
    grad.addColorStop(1, '#d4c8a0');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();

    // Outer ring
    ctx.strokeStyle = isRed ? '#c04040' : '#1a1a1a';
    ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();

    // Inner ring
    ctx.strokeStyle = isRed ? '#c04040' : '#1a1a1a';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, radius * 0.78, 0, Math.PI * 2); ctx.stroke();

    // Character
    ctx.fillStyle = isRed ? '#b02020' : '#111';
    ctx.font = 'bold ' + (radius * 1.2) + 'px "KaiTi","楷体","STKaiti","SimSun",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var name = (PIECE_NAMES[piece.type] || {})[piece.side] || piece.type;
    ctx.fillText(name, x, y + 1.5);

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
      // Pickup: 150ms ease-out cubic, scale 1.0 → 1.08
      var t = Math.min(elapsed / 150, 1.0);
      t = 1 - Math.pow(1 - t, 3); // ease-out cubic
      animState.pickupScale = 1.0 + 0.08 * t;
      animState.pickupShadowOffset = 2.5 + 5.5 * t;
      if (t >= 1.0) {
        animState.pickupScale = 1.08;
        animState.pickupShadowOffset = 8;
        animState.running = false; // pickup done, stays lifted
      }
    } else if (animState.type === 'move') {
      // Move: 250ms ease-in-out quad
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
    var state = window._ccState;
    if (!state) return;

    var dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    var boardH = cs * (ROWS - 1);

    // === Board background (wood gradient) ===
    var bgGrad = ctx.createLinearGradient(0, 0, W, boardH + margin * 2);
    bgGrad.addColorStop(0, '#e8c97a'); bgGrad.addColorStop(0.5, '#dfb85a'); bgGrad.addColorStop(1, '#d4a840');
    ctx.fillStyle = bgGrad;
    ctx.beginPath(); rrect(ctx, margin - 16, margin - 16, cs * (COLS - 1) + 32, boardH + 32, 10); ctx.fill();

    // Inner shadow effect
    ctx.fillStyle = '#d4a535';
    ctx.beginPath(); rrect(ctx, margin - 8, margin - 8, cs * (COLS - 1) + 16, boardH + 16, 6); ctx.fill();

    // Wood grain lines (subtle)
    ctx.strokeStyle = 'rgba(139,90,20,0.06)'; ctx.lineWidth = 1;
    for (var i = 0; i < 12; i++) {
      var gy = margin + boardH * (i / 11); ctx.beginPath();
      ctx.moveTo(margin - 8, gy); ctx.lineTo(margin + cs * (COLS - 1) + 8, gy + Math.sin(gy * 0.1) * 8); ctx.stroke();
    }

    // === Grid lines ===
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.5;
    var riverTop = margin + 4 * cs, riverBot = margin + 5 * cs;

    // Horizontals
    for (var r = 0; r < ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(margin, margin + r * cs);
      ctx.lineTo(margin + (COLS - 1) * cs, margin + r * cs); ctx.stroke();
    }
    // Verticals
    for (var c = 0; c < COLS; c++) {
      var vx = margin + c * cs;
      if (c === 0 || c === COLS - 1) {
        ctx.beginPath(); ctx.moveTo(vx, margin); ctx.lineTo(vx, margin + boardH); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(vx, margin); ctx.lineTo(vx, riverTop); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(vx, riverBot); ctx.lineTo(vx, margin + boardH); ctx.stroke();
      }
    }

    // Palace diagonals
    var drawPalace = function(tr) {
      ctx.beginPath(); ctx.moveTo(margin + 3 * cs, margin + tr * cs); ctx.lineTo(margin + 5 * cs, margin + (tr + 2) * cs); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(margin + 5 * cs, margin + tr * cs); ctx.lineTo(margin + 3 * cs, margin + (tr + 2) * cs); ctx.stroke();
    };
    drawPalace(0); drawPalace(7);

    // River text
    ctx.fillStyle = '#5a3a1a'; ctx.font = 'bold ' + (cs * 0.46) + 'px "KaiTi","楷体","STKaiti",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('楚   河', margin + cs * 1.6, margin + 4.5 * cs);
    ctx.fillText('汉   界', margin + cs * 6.4, margin + 4.5 * cs);

    // === Valid move indicators ===
    var legalMoves = state.legalMoves || [];
    if (selRow >= 0 && selCol >= 0 && animState.type !== 'move') {
      for (var mi = 0; mi < legalMoves.length; mi++) {
        var m = legalMoves[mi];
        if (m.fromRow === selRow && m.fromCol === selCol) {
          var mx = margin + m.toCol * cs;
          var my = margin + m.toRow * cs;
          var targetPiece = state.board[m.toRow][m.toCol];

          if (targetPiece) {
            // Capture indicator: dashed red ring
            ctx.strokeStyle = 'rgba(220, 60, 40, 0.65)'; ctx.lineWidth = 2.5;
            ctx.setLineDash([3, 2]);
            ctx.beginPath(); ctx.arc(mx, my, cs * 0.42 + 3, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
          } else {
            // Empty square: green dot
            ctx.fillStyle = 'rgba(80, 150, 80, 0.45)';
            ctx.beginPath(); ctx.arc(mx, my, cs * 0.13, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(80, 150, 80, 0.6)'; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.arc(mx, my, cs * 0.13, 0, Math.PI * 2); ctx.stroke();
          }
        }
      }
    }

    // === Pieces ===
    for (var rr = 0; rr < ROWS; rr++) {
      for (var cc = 0; cc < COLS; cc++) {
        var piece = state.board[rr][cc];
        if (!piece) continue;

        // Skip the piece being animated (drawn in overlay)
        if (animState.type === 'pickup' && rr === animState.pickupRow && cc === animState.pickupCol) continue;
        if (animState.type === 'move' && rr === animState.moveFromRow && cc === animState.moveFromCol) continue;
        // Hide captured piece at destination during first half of move animation
        if (animState.type === 'move' && animState.moveCaptured &&
            rr === animState.moveToRow && cc === animState.moveToCol) {
          if (animState.moveProgress < 0.55) continue;
        }

        var px = margin + cc * cs, py = margin + rr * cs;
        var isRed = piece.side === 0;
        var isSel = selRow === rr && selCol === cc && animState.type !== 'move';
        drawPiece(px, py, piece, isRed, isSel, 1.0, 2.5);
      }
    }

    // === Animation overlay ===
    if (animState.type === 'pickup') {
      var pPiece = state.board[animState.pickupRow][animState.pickupCol];
      if (pPiece) {
        var apx = margin + animState.pickupCol * cs;
        var apy = margin + animState.pickupRow * cs;
        drawPiece(apx, apy, pPiece, pPiece.side === 0, true,
          animState.pickupScale, animState.pickupShadowOffset);
      }
    } else if (animState.type === 'move') {
      var srcPiece = animState.movePiece;
      if (srcPiece) {
        var sx = margin + animState.moveFromCol * cs;
        var sy = margin + animState.moveFromRow * cs;
        var dx = margin + animState.moveToCol * cs;
        var dy = margin + animState.moveToRow * cs;
        var progress = animState.moveProgress;
        // Slight arc path
        var arcOffset = Math.sin(progress * Math.PI) * cs * 0.18;
        var cx = sx + (dx - sx) * progress;
        var cy = sy + (dy - sy) * progress - arcOffset;
        var mScale = 1.0 + 0.04 * Math.sin(progress * Math.PI);
        var mShadow = 4 + 3 * Math.sin(progress * Math.PI);
        drawPiece(cx, cy, srcPiece, srcPiece.side === 0, false, mScale, mShadow);
      }
    }

    // === Status bar ===
    var sy = margin + boardH + 22;
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center';
    var pi = parseInt(sessionStorage.getItem('playerIndex'));
    if (state.winner != null) {
      ctx.fillText(state.winner === pi ? '🏆 你赢了！' : '😢 你输了', W / 2, sy);
    } else {
      if (state.currentPlayer === pi) {
        ctx.fillStyle = '#c8a45c'; ctx.fillText('▼ 轮到你走棋 ▼', W / 2, sy);
      } else {
        var cp = (window.gamePlayers || [])[state.currentPlayer];
        ctx.fillText('对手回合 · ' + (cp ? cp.name : '等待中'), W / 2, sy);
      }
    }
  }

  // ---- Renderer registration ----

  window.gameRenderers.set('chinesechess', {
    init: function(container) {
      canvas = document.createElement('canvas');
      canvas.id = 'ccCanvas';
      canvas.style.cssText = 'width:100%;display:block;border-radius:16px;touch-action:manipulation;';
      container.appendChild(canvas);
      ctx = canvas.getContext('2d');

      // Reset state on init (e.g. game restart)
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
        margin = 30;
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
        var state = window._ccState;
        var pi = parseInt(sessionStorage.getItem('playerIndex'));
        if (!state || state.winner != null) return;
        if (state.currentPlayer !== pi) { selRow = -1; return; }

        if (selRow >= 0 && selCol >= 0) {
          // A piece is already selected
          var clickedPiece = state.board[row][col];

          // BUGFIX: clicking own piece → re-select
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

          // Check if legal move
          var legalMoves = state.legalMoves || [];
          var isValid = false;
          for (var mi = 0; mi < legalMoves.length; mi++) {
            var m = legalMoves[mi];
            if (m.fromRow === selRow && m.fromCol === selCol && m.toRow === row && m.toCol === col) {
              isValid = true;
              break;
            }
          }
          if (!isValid) {
            selRow = -1; selCol = -1;
            return;
          }

          // Valid move: start move animation then send
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
          // selRow/selCol cleared after animation completes in animTick
        } else {
          // No piece selected: try to select one
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
      window._ccState = state;
      if (!canvas || !state || !state.board) return;

      // Detect opponent's move (piece moved without our animation trigger)
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

      // Save current board for next comparison
      prevBoard = cloneBoard(state.board);

      // If animation is running, drawFrame handles it
      if (animState.running) return;

      var dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      drawFrame(null);
    }
  });

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
})();
