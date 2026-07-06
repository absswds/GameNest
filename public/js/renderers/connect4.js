// Connect Four renderer — Canvas with gravity drop animation
(function() {
  window.gameRenderers = window.gameRenderers || new Map();
  var ROWS = 6, COLS = 7;

  var canvas, ctx, W, margin, cs;

  // Hover column for preview
  var hoverCol = -1;

  // Animation state machine
  var animState = {
    running: false,
    rafId: null,
    type: 'none',       // 'none' | 'drop'
    startTime: 0,
    // Drop animation
    dropCol: -1,
    dropRow: -1,         // target row
    dropSide: 0,         // which player
    dropStartY: 0,       // start Y (above board)
    dropEndY: 0,         // target Y
    dropProgress: 0,
  };

  // Snapshot of previous board for detecting opponent moves
  var prevBoard = null;
  var prevLastMove = null;

  // Winning cells for highlight
  var winCells = null;

  // ---- Drawing helpers ----

  function drawPiece(x, y, side, radius, alpha) {
    var r = radius || cs * 0.40;
    var a = alpha || 1.0;

    ctx.globalAlpha = a;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(x + 1.5, y + 2.5, r, 0, Math.PI * 2);
    ctx.fill();

    // Piece body
    var grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
    if (side === 0) {
      // Yellow
      grad.addColorStop(0, '#fff44f');
      grad.addColorStop(0.6, '#ffd700');
      grad.addColorStop(1, '#e6b800');
    } else {
      // Red
      grad.addColorStop(0, '#ff6b6b');
      grad.addColorStop(0.6, '#e63946');
      grad.addColorStop(1, '#c0392b');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = side === 0 ? '#b8960a' : '#922b21';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
  }

  function drawWinHighlight(x, y, r) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(255,215,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
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

    if (animState.type === 'drop') {
      var duration = 400;
      var t = Math.min(elapsed / duration, 1.0);
      // Ease-in cubic for gravity feel
      t = t * t * t;
      animState.dropProgress = t;
      if (t >= 1.0) {
        animState.dropProgress = 1.0;
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

  // ---- Board diff for opponent move detection ----

  function detectMove(prev, curr, prevLM, currLM) {
    if (!prevLM || !currLM) return null;
    if (prevLM.row === currLM.row && prevLM.col === currLM.col) return null;
    // Use lastMove from state to detect opponent's drop
    return { col: currLM.col, row: currLM.row, side: curr[currLM.row][currLM.col] };
  }

  function cloneBoard(board) {
    return board.map(function(row) { return row.slice(); });
  }

  // ---- Find winning cells ----

  function findWinCells(board, side) {
    var dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (board[r][c] !== side) continue;
        for (var d = 0; d < dirs.length; d++) {
          var dr = dirs[d][0], dc = dirs[d][1];
          var cells = [{row:r, col:c}];
          for (var i = 1; i < 4; i++) {
            var nr = r + dr * i, nc = c + dc * i;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === side) {
              cells.push({row:nr, col:nc});
            } else break;
          }
          if (cells.length >= 4) return cells.slice(0, 4);
        }
      }
    }
    return null;
  }

  // ---- Main draw ----

  function drawFrame(now) {
    var state = window._c4State;
    if (!state || !state.board) return;

    var dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Board background
    var boardW = cs * (COLS + 1);
    var boardH = cs * (ROWS + 1);
    var bgX = margin - cs * 0.5;
    var bgY = margin - cs * 0.5;

    // Blue board background with rounded corners
    ctx.fillStyle = '#1565c0';
    ctx.beginPath();
    rrect(ctx, bgX, bgY, boardW, boardH, 12);
    ctx.fill();

    // Inner shadow
    ctx.fillStyle = '#0d47a1';
    ctx.beginPath();
    rrect(ctx, bgX + 4, bgY + 4, boardW - 8, boardH - 8, 8);
    ctx.fill();

    // Draw cells (dark holes)
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cx = margin + c * cs;
        var cy = margin + r * cs;
        var cellR = cs * 0.42;

        // Cell hole
        ctx.fillStyle = '#0a3d7a';
        ctx.beginPath();
        ctx.arc(cx, cy, cellR, 0, Math.PI * 2);
        ctx.fill();

        // Inner shadow for depth
        var holeGrad = ctx.createRadialGradient(cx - cellR * 0.2, cy - cellR * 0.2, 0, cx, cy, cellR);
        holeGrad.addColorStop(0, 'rgba(0,0,0,0.15)');
        holeGrad.addColorStop(1, 'rgba(0,0,0,0.05)');
        ctx.fillStyle = holeGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, cellR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Hover preview
    if (hoverCol >= 0 && hoverCol < COLS && state.winner === null) {
      var pi = parseInt(sessionStorage.getItem('playerIndex'));
      if (state.currentPlayer === pi && state.board[0][hoverCol] === null) {
        var hx = margin + hoverCol * cs;
        var hy = margin - cs * 0.5;
        drawPiece(hx, hy, pi, cs * 0.35, 0.35);
      }
    }

    // Pieces (skip animated piece)
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var side = state.board[r][c];
        if (side === null) continue;

        // Skip piece being animated
        if (animState.type === 'drop' && r === animState.dropRow && c === animState.dropCol) continue;

        var px = margin + c * cs;
        var py = margin + r * cs;
        drawPiece(px, py, side, cs * 0.40, 1.0);
      }
    }

    // Drop animation overlay
    if (animState.type === 'drop') {
      var dx = margin + animState.dropCol * cs;
      var startY = animState.dropStartY;
      var endY = animState.dropEndY;
      var progress = animState.dropProgress;
      var currentY = startY + (endY - startY) * progress;

      // Draw the dropping piece with slight scale pulse
      var pulse = 1.0 + 0.03 * Math.sin(progress * Math.PI);
      drawPiece(dx, currentY, animState.dropSide, cs * 0.40 * pulse, 1.0);
    }

    // Win highlight
    if (winCells) {
      var cellR = cs * 0.40;
      for (var i = 0; i < winCells.length; i++) {
        var wx = margin + winCells[i].col * cs;
        var wy = margin + winCells[i].row * cs;
        drawWinHighlight(wx, wy, cellR);
      }
    }

    // Status bar
    var sy = margin + cs * (ROWS + 0.8);
    var pi = parseInt(sessionStorage.getItem('playerIndex'));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (state.winner != null) {
      if (state.winner === -1) {
        ctx.fillStyle = '#555';
        ctx.font = 'bold 16px system-ui,-apple-system,sans-serif';
        ctx.fillText('平局！', W / 2, sy);
      } else {
        ctx.fillStyle = state.winner === pi ? '#c8a45c' : '#e63946';
        ctx.font = 'bold 16px system-ui,-apple-system,sans-serif';
        ctx.fillText(state.winner === pi ? '🏆 你赢了！' : '😢 你输了', W / 2, sy);
      }
    } else {
      if (state.currentPlayer === pi) {
        ctx.fillStyle = '#c8a45c';
        ctx.font = 'bold 16px system-ui,-apple-system,sans-serif';
        ctx.fillText('▼ 轮到你落子 ▼', W / 2, sy);
      } else {
        var cp = (window.gamePlayers || [])[state.currentPlayer];
        ctx.fillStyle = '#555';
        ctx.font = '14px system-ui,-apple-system,sans-serif';
        ctx.fillText('对手回合 · ' + (cp ? cp.name : '等待中'), W / 2, sy);
      }
    }
  }

  function rrect(ctx, x, y, w, h, r) {
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

  // ---- Renderer registration ----

  window.gameRenderers.set('connect4', {
    init: function(container) {
      canvas = document.createElement('canvas');
      canvas.id = 'c4Canvas';
      canvas.style.cssText = 'width:100%;display:block;border-radius:16px;touch-action:manipulation;';
      container.appendChild(canvas);
      ctx = canvas.getContext('2d');

      // Reset state on init (e.g. game restart)
      stopAnimLoop();
      hoverCol = -1;
      prevBoard = null;
      prevLastMove = null;
      winCells = null;

      var resize = function() {
        var avW = window.innerWidth - (window.innerWidth > 600 ? 80 : 32);
        var avH = window.innerHeight - 240;
        // 7 columns + some padding; portrait-friendly
        W = Math.min(avW, avH * 1.2, 700);
        W = Math.max(W, 280);
        var dpr = window.devicePixelRatio || 1;
        cs = (W - 60) / COLS;
        margin = 30 + cs * 0.5;
        var H = margin * 2 + cs * (ROWS - 1) + cs * 0.3;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      };
      resize();
      window.addEventListener('resize', resize);

      // Click handler — drop piece in column
      canvas.addEventListener('click', function(e) {
        var state = window._c4State;
        var pi = parseInt(sessionStorage.getItem('playerIndex'));
        if (!state || state.winner != null) return;
        if (state.currentPlayer !== pi) return;

        var rect = canvas.getBoundingClientRect();
        var x = (e.clientX - rect.left) * (W / rect.width);
        var col = Math.round((x - margin) / cs);
        if (col < 0 || col >= COLS) return;

        // Check column is legal
        var legalMoves = state.legalMoves || [];
        if (legalMoves.indexOf(col) === -1) return;

        // Find target row
        var targetRow = -1;
        for (var r = ROWS - 1; r >= 0; r--) {
          if (state.board[r][col] === null) { targetRow = r; break; }
        }
        if (targetRow === -1) return;

        // Start drop animation
        stopAnimLoop();
        animState.type = 'drop';
        animState.dropCol = col;
        animState.dropRow = targetRow;
        animState.dropSide = pi;
        animState.dropStartY = margin - cs * 0.5;
        animState.dropEndY = margin + targetRow * cs;
        animState.dropProgress = 0;
        startAnimLoop();

        window.makeGameMove({ col: col });
      });

      // Mouse move — track hover column
      canvas.addEventListener('mousemove', function(e) {
        var rect = canvas.getBoundingClientRect();
        var x = (e.clientX - rect.left) * (W / rect.width);
        var col = Math.round((x - margin) / cs);
        if (col >= 0 && col < COLS) {
          if (hoverCol !== col) {
            hoverCol = col;
            if (!animState.running) drawFrame(null);
          }
        } else {
          if (hoverCol !== -1) {
            hoverCol = -1;
            if (!animState.running) drawFrame(null);
          }
        }
      });

      canvas.addEventListener('mouseleave', function() {
        hoverCol = -1;
        if (!animState.running) drawFrame(null);
      });

      // Touch support
      canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        var touch = e.touches[0];
        var rect = canvas.getBoundingClientRect();
        var x = (touch.clientX - rect.left) * (W / rect.width);
        var col = Math.round((x - margin) / cs);
        if (col >= 0 && col < COLS) {
          hoverCol = col;
          if (!animState.running) drawFrame(null);
        }
      }, { passive: false });

      canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        if (hoverCol >= 0) {
          // Simulate click at hover column
          var state = window._c4State;
          var pi = parseInt(sessionStorage.getItem('playerIndex'));
          if (state && state.winner === null && state.currentPlayer === pi) {
            var legalMoves = state.legalMoves || [];
            if (legalMoves.indexOf(hoverCol) !== -1) {
              var targetRow = -1;
              for (var r = ROWS - 1; r >= 0; r--) {
                if (state.board[r][hoverCol] === null) { targetRow = r; break; }
              }
              if (targetRow !== -1) {
                stopAnimLoop();
                animState.type = 'drop';
                animState.dropCol = hoverCol;
                animState.dropRow = targetRow;
                animState.dropSide = pi;
                animState.dropStartY = margin - cs * 0.5;
                animState.dropEndY = margin + targetRow * cs;
                animState.dropProgress = 0;
                startAnimLoop();
                window.makeGameMove({ col: hoverCol });
              }
            }
          }
        }
        hoverCol = -1;
      }, { passive: false });
    },

    render: function(state, container, playerIndex, winner) {
      window._c4State = state;
      if (!canvas || !state || !state.board) return;

      // Detect opponent's move
      if (!animState.running && prevBoard && prevLastMove) {
        var move = detectMove(prevBoard, state.board, prevLastMove, state.lastMove);
        if (move) {
          // Find the actual row where the piece landed
          var targetRow = -1;
          for (var r = ROWS - 1; r >= 0; r--) {
            if (state.board[r][move.col] !== null) { targetRow = r; break; }
          }
          if (targetRow !== -1) {
            stopAnimLoop();
            animState.type = 'drop';
            animState.dropCol = move.col;
            animState.dropRow = targetRow;
            animState.dropSide = move.side;
            animState.dropStartY = margin - cs * 0.5;
            animState.dropEndY = margin + targetRow * cs;
            animState.dropProgress = 0;
            startAnimLoop();
          }
        }
      }

      // Save current board for next comparison
      prevBoard = cloneBoard(state.board);
      prevLastMove = state.lastMove ? { row: state.lastMove.row, col: state.lastMove.col } : null;

      // Find winning cells
      if (state.winner !== null && state.winner >= 0) {
        winCells = findWinCells(state.board, state.winner);
      } else {
        winCells = null;
      }

      // If animation is running, drawFrame handles it
      if (animState.running) return;

      var dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      drawFrame(null);
    }
  });
})();
