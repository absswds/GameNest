// Chess renderer — Unicode pieces + pickup/move animations + promotion UI
(function() {
  window.gameRenderers = window.gameRenderers || new Map();
  var ROWS = 8, COLS = 8;

  // Unicode chess pieces: white uppercase, black lowercase
  var PIECE_GLYPH = { K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙' };
  var PIECE_GLYPH_B = { K:'♚', Q:'♛', R:'♜', B:'♝', N:'♞', P:'♟' };

  var canvas, ctx, W, margin, cs;
  var selRow = -1, selCol = -1;

  // Animation state machine
  var animState = {
    running: false,
    rafId: null,
    type: 'none',
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

  // Promotion state
  var pendingPromotion = null; // { from, to, legalMoves }

  // ---- Drawing helpers ----

  function drawPiece(x, y, piece, isSelected, animScale, shadowOffset) {
    var radius = cs * 0.42 * (animScale || 1.0);
    var sdOff = shadowOffset || 2.5;
    var isWhite = piece.side === 0;

    // Selection glow
    if (isSelected) {
      var glowRadius = radius + 7 + (animScale > 1 ? 5 : 0);
      var glow = ctx.createRadialGradient(x, y, radius * 0.6, x, y, glowRadius);
      glow.addColorStop(0, 'rgba(255,215,0,0.7)');
      glow.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, glowRadius, 0, Math.PI * 2); ctx.fill();
    }

    // Piece shadow
    ctx.fillStyle = 'rgba(0,0,0,' + (0.2 + (animScale > 1 ? (animScale - 1) * 1.0 : 0)) + ')';
    ctx.beginPath(); ctx.arc(x + sdOff, y + sdOff + 1, radius, 0, Math.PI * 2); ctx.fill();

    // Piece body
    var hlX = x - radius * 0.25;
    var hlY = y - radius * 0.35;
    if (animScale > 1) { hlY -= radius * 0.08; }
    var grad = ctx.createRadialGradient(hlX, hlY, radius * 0.05, x, y, radius);
    grad.addColorStop(0, '#fffef5');
    grad.addColorStop(0.5, isWhite ? '#f0e8c8' : '#a08060');
    grad.addColorStop(1, isWhite ? '#d4c8a0' : '#604020');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();

    // Outer ring
    ctx.strokeStyle = isWhite ? '#8a7a50' : '#3a2810';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();

    // Unicode glyph
    var glyph = isWhite ? PIECE_GLYPH[piece.type] : PIECE_GLYPH_B[piece.type];
    ctx.fillStyle = isWhite ? '#1a1a1a' : '#0a0a0a';
    ctx.font = (radius * 1.5) + 'px "Segoe UI Symbol","Apple Symbols","Noto Sans Symbols","Noto Sans Symbols2",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x, y + 1.5);

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
    if (!board) return null;
    return board.map(function(row) {
      return row.map(function(cell) { return cell ? { type: cell.type, side: cell.side } : null; });
    });
  }

  // ---- Promotion UI ----

  function showPromotionOverlay(from, to, legalMoves) {
    pendingPromotion = { from: from, to: to, legalMoves: legalMoves };
    drawPromotionUI();
  }

  function drawPromotionUI() {
    if (!pendingPromotion || !ctx) return;
    var state = window._chState;
    if (!state) return;

    var pi = parseInt(sessionStorage.getItem('playerIndex'));
    var isWhite = pi === 0;
    var options = ['Q', 'R', 'B', 'N'];
    var glyphs = isWhite ? PIECE_GLYPH : PIECE_GLYPH_B;

    // Semi-transparent overlay
    var dpr = window.devicePixelRatio || 1;
    var boardH = cs * (ROWS - 1);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, margin * 2 + boardH + 50);

    // Promotion panel
    var panelW = cs * 4.5;
    var panelH = cs * 1.4;
    var px = (W - panelW) / 2;
    var py = (margin * 2 + boardH - panelH) / 2;

    ctx.fillStyle = '#f8f0e0';
    ctx.strokeStyle = '#8a7a50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    rrect(ctx, px, py, panelW, panelH, 10);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#3a3028';
    ctx.font = 'bold 14px system-ui,-apple-system,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('升变为', W / 2, py + 6);

    var btnSize = cs * 0.75;
    var gap = (panelW - 4 * btnSize) / 5;
    var btnY = py + 28;

    for (var i = 0; i < 4; i++) {
      var bx = px + gap + i * (btnSize + gap);
      // Button background
      ctx.fillStyle = '#e8dcc8';
      ctx.strokeStyle = '#a09070';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      rrect(ctx, bx, btnY, btnSize, btnSize, 8);
      ctx.fill(); ctx.stroke();
      // Piece glyph
      ctx.fillStyle = '#1a1a1a';
      ctx.font = (btnSize * 0.7) + 'px "Segoe UI Symbol","Apple Symbols","Noto Sans Symbols",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(glyphs[options[i]], bx + btnSize / 2, btnY + btnSize / 2 + 1);
    }

    // Store button positions for click detection
    window._promoButtons = [];
    for (var j = 0; j < 4; j++) {
      var bbx = px + gap + j * (btnSize + gap);
      window._promoButtons.push({
        x: bbx, y: btnY, w: btnSize, h: btnSize,
        promote: options[j],
      });
    }
  }

  function handlePromotionClick(x, y) {
    if (!pendingPromotion || !window._promoButtons) return false;
    for (var i = 0; i < window._promoButtons.length; i++) {
      var b = window._promoButtons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        var promo = pendingPromotion;
        pendingPromotion = null;
        window._promoButtons = null;
        window.makeGameMove({
          from: promo.from,
          to: promo.to,
          promote: promo.promote,
        });
        return true;
      }
    }
    return false;
  }

  // ---- Main draw ----

  function drawFrame(now) {
    var state = window._chState;
    if (!state) return;

    var dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    var boardH = cs * (ROWS - 1);

    // === Board background ===
    ctx.fillStyle = '#f0d9b5';
    ctx.fillRect(margin - 10, margin - 10, cs * (COLS - 1) + 20, boardH + 20);

    // === Checkered squares ===
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var x = margin + c * cs - cs / 2;
        var y = margin + r * cs - cs / 2;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#f0d9b5' : '#b58863';
        ctx.fillRect(x, y, cs, cs);
      }
    }

    // Board border
    ctx.strokeStyle = '#8a7a50'; ctx.lineWidth = 2;
    ctx.strokeRect(margin - cs / 2 - 1, margin - cs / 2 - 1, cs * COLS + 2, cs * ROWS + 2);

    // === Rank/file labels ===
    ctx.fillStyle = '#8a7a50';
    ctx.font = '11px system-ui,-apple-system,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var fileChars = 'abcdefgh';
    for (var fi = 0; fi < 8; fi++) {
      ctx.fillText(fileChars[fi], margin + fi * cs, margin + boardH + cs * 0.45);
    }
    for (var ri = 0; ri < 8; ri++) {
      ctx.fillText(String(8 - ri), margin - cs * 0.45, margin + ri * cs);
    }

    // === Valid move indicators ===
    var legalMoves = state.legalMoves || [];
    if (selRow >= 0 && selCol >= 0 && animState.type !== 'move' && !pendingPromotion) {
      for (var mi = 0; mi < legalMoves.length; mi++) {
        var m = legalMoves[mi];
        if (m.from.row === selRow && m.from.col === selCol) {
          var mx = margin + m.to.col * cs;
          var my = margin + m.to.row * cs;
          var targetPiece = state.board[m.to.row][m.to.col];

          if (targetPiece) {
            ctx.strokeStyle = 'rgba(220, 60, 40, 0.65)'; ctx.lineWidth = 2.5;
            ctx.setLineDash([3, 2]);
            ctx.beginPath(); ctx.arc(mx, my, cs * 0.42 + 3, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
          } else {
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

    // === Animation overlay ===
    if (animState.type === 'pickup') {
      var pPiece = state.board[animState.pickupRow][animState.pickupCol];
      if (pPiece) {
        var apx = margin + animState.pickupCol * cs;
        var apy = margin + animState.pickupRow * cs;
        drawPiece(apx, apy, pPiece, true,
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
        var arcOffset = Math.sin(progress * Math.PI) * cs * 0.18;
        var cx = sx + (dx - sx) * progress;
        var cy = sy + (dy - sy) * progress - arcOffset;
        var mScale = 1.0 + 0.04 * Math.sin(progress * Math.PI);
        var mShadow = 4 + 3 * Math.sin(progress * Math.PI);
        drawPiece(cx, cy, srcPiece, false, mScale, mShadow);
      }
    }

    // === Status bar ===
    var sy = margin + boardH + 30;
    ctx.fillStyle = '#3a3028'; ctx.font = 'bold 16px system-ui,-apple-system,sans-serif'; ctx.textAlign = 'center';
    var pi = parseInt(sessionStorage.getItem('playerIndex'));
    if (state.winner != null) {
      if (state.winner === -1) {
        ctx.fillText('🤝 和棋', W / 2, sy);
      } else {
        ctx.fillText(state.winner === pi ? '🏆 你赢了！' : '😢 你输了', W / 2, sy);
      }
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

  window.gameRenderers.set('chess', {
    init: function(container) {
      canvas = document.createElement('canvas');
      canvas.id = 'chessCanvas';
      canvas.style.cssText = 'width:100%;display:block;border-radius:16px;touch-action:manipulation;';
      container.appendChild(canvas);
      ctx = canvas.getContext('2d');

      stopAnimLoop();
      selRow = -1; selCol = -1;
      prevBoard = null;
      pendingPromotion = null;

      var resize = function() {
        var avW = window.innerWidth - (window.innerWidth > 600 ? 80 : 32);
        var avH = window.innerHeight - 240;
        W = Math.min(avW, avH, 960);
        W = Math.max(W, 240);
        var dpr = window.devicePixelRatio || 1;
        cs = (W - 30) / COLS;
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

        // Check promotion overlay click first
        if (pendingPromotion) {
          handlePromotionClick(x, y);
          return;
        }

        var col = Math.round((x - margin) / cs);
        var row = Math.round((y - margin) / cs);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) { selRow = -1; return; }
        var state = window._chState;
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
          var matched = null;
          for (var mi = 0; mi < legalMoves.length; mi++) {
            var m = legalMoves[mi];
            if (m.from.row === selRow && m.from.col === selCol && m.to.row === row && m.to.col === col) {
              if (!matched) matched = [];
              matched.push(m);
            }
          }
          if (!matched) {
            selRow = -1; selCol = -1;
            return;
          }

          // Check if this is a promotion move
          var promoMoves = matched.filter(function(m) { return m.promotion !== null; });
          if (promoMoves.length > 0) {
            // Show promotion overlay
            stopAnimLoop();
            selRow = row; selCol = col;
            showPromotionOverlay(
              { row: selRow, col: selCol },
              { row: row, col: col },
              promoMoves
            );
            return;
          }

          // Regular move: animate then send
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
            to: { row: row, col: col },
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
      window._chState = state;
      if (!canvas || !state || !state.board) return;

      if (!animState.running && prevBoard && selRow === -1 && selCol === -1 && !pendingPromotion) {
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
      if (pendingPromotion) drawPromotionUI();
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
