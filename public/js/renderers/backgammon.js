// public/js/renderers/backgammon.js — Canvas renderer for 西洋双陆
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var canvas, ctx, W, H;
  var boardLeft, boardTop, boardRight, boardBottom;
  var halfWidth, barWidth, triWidth, triHeight, barGap;
  var diceAreaH = 50;

  // Selection state
  var selSource = null; // {type:'point', index:n} | {type:'bar'} | null
  var curLegalMoves = [];
  var curState = null;
  var curPlayerIdx = -1;

  // Point ↔ column mapping
  // Top row (points 23-12): col 0-5 → 23-18, col 6-11 → 17-12
  // Bottom row (points 0-11): col 0-5 → 0-5, col 6-11 → 6-11
  function topPoint(col) { return 23 - col; }
  function botPoint(col) { return col; }

  function pointCol(p) {
    if (p >= 12) return 23 - p;
    return p;
  }
  function isTop(p) { return p >= 12; }

  // ---- Layout ----
  function calcLayout() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    var mx = 6;
    boardLeft = mx;
    boardRight = W - mx;
    boardTop = mx + diceAreaH;
    boardBottom = H - mx;

    barWidth = Math.max(24, W * 0.055);
    halfWidth = (boardRight - boardLeft - barWidth) / 2;
    triWidth = halfWidth / 6;
    barGap = Math.max(16, H * 0.04);
    triHeight = (boardBottom - boardTop - barGap) / 2;
  }

  // ---- Colors ----
  var COL_DARK = '#5a3a1a';
  var COL_LIGHT = '#e8d5a8';
  var COL_BOARD = '#1a5c2a';
  var COL_P0 = '#f5f0e0';
  var COL_P0_STROKE = '#b8a878';
  var COL_P1 = '#2a2a2a';
  var COL_P1_STROKE = '#555';
  var COL_BAR = '#10408';
  var COL_SELECTED = 'rgba(255,215,0,0.45)';
  var COL_LEGAL = 'rgba(0,200,80,0.35)';
  var COL_HIT = 'rgba(220,50,50,0.4)';

  // ---- Drawing helpers ----
  function triPath(x, y, w, h, down) {
    ctx.beginPath();
    if (down) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w / 2, y + h);
    } else {
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w / 2, y);
    }
    ctx.closePath();
  }

  function drawPiece(cx, cy, r, side, isSelected, isDimmed) {
    var fillColor = side === 0 ? COL_P0 : COL_P1;
    var strokeColor = side === 0 ? COL_P0_STROKE : COL_P1_STROKE;

    ctx.globalAlpha = isDimmed ? 0.4 : 1;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(cx + 1.5, cy + 2, r, 0, Math.PI * 2);
    ctx.fill();

    // Body
    var grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, side === 0 ? '#fff' : '#555');
    grad.addColorStop(1, fillColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isSelected ? '#ffd700' : strokeColor;
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  function drawDiceValue(cx, cy, val, size, dimmed) {
    var s = size;
    ctx.globalAlpha = dimmed ? 0.35 : 1;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - s / 2, cy - s / 2, s, s, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.font = 'bold ' + (s * 0.55) + 'px "Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(val), cx, cy + 1);
    ctx.globalAlpha = 1;
  }

  // ---- Main drawing ----
  function drawFrame() {
    if (!curState) return;
    var st = curState;

    ctx.clearRect(0, 0, W, H);

    // Board background
    ctx.fillStyle = COL_BOARD;
    ctx.beginPath();
    ctx.roundRect(boardLeft - 3, boardTop - 3, boardRight - boardLeft + 6, boardBottom - boardTop + 6, 8);
    ctx.fill();

    // Outer border
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(boardLeft - 3, boardTop - 3, boardRight - boardLeft + 6, boardBottom - boardTop + 6, 8);
    ctx.stroke();

    // Draw triangles
    var midX = boardLeft + halfWidth + barWidth / 2;
    var midY = boardTop + triHeight + barGap / 2;

    for (var col = 0; col < 12; col++) {
      var isDark = col % 2 === 0;
      // Top row
      var tx = col < 6
        ? boardLeft + col * triWidth
        : boardLeft + halfWidth + barWidth + (col - 6) * triWidth;
      triPath(tx, boardTop, triWidth - 1, triHeight, true);
      ctx.fillStyle = isDark ? COL_DARK : COL_LIGHT;
      ctx.fill();

      // Bottom row
      triPath(tx, midY + barGap / 2, triWidth - 1, triHeight, false);
      ctx.fillStyle = isDark ? COL_LIGHT : COL_DARK;
      ctx.fill();
    }

    // Bar
    ctx.fillStyle = '#123';
    ctx.fillRect(boardLeft + halfWidth, boardTop, barWidth, boardBottom - boardTop);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(boardLeft + halfWidth, boardTop, barWidth, boardBottom - boardTop);

    // Bear-off trays (left side)
    var trayW = triWidth * 1.2;
    var trayH = triHeight;
    // Player 0 tray (bottom left)
    ctx.fillStyle = '#0d2a0d';
    ctx.fillRect(boardLeft - trayW - 4, midY + barGap / 2, trayW, trayH);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(boardLeft - trayW - 4, midY + barGap / 2, trayW, trayH);
    // Player 1 tray (top left)
    ctx.fillStyle = '#0d2a0d';
    ctx.fillRect(boardLeft - trayW - 4, boardTop, trayW, trayH);
    ctx.strokeStyle = '#8b6914';
    ctx.strokeRect(boardLeft - trayW - 4, boardTop, trayW, trayH);

    // Tray labels
    ctx.fillStyle = '#aaa';
    ctx.font = '10px "Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('BEAR', boardLeft - trayW / 2 - 4, boardTop + trayH + 2);
    ctx.fillText('BEAR', boardLeft - trayW / 2 - 4, midY + barGap / 2 + trayH + 2);

    // Draw borne-off pieces
    var trayCx = boardLeft - trayW / 2 - 4;
    var pieceR = Math.min(triWidth * 0.35, 11);
    for (var b = 0; b < st.home[0]; b++) {
      var by = midY + barGap / 2 + trayH - pieceR - b * pieceR * 2;
      drawPiece(trayCx, by, pieceR, 0, false, false);
    }
    for (var b = 0; b < st.home[1]; b++) {
      var by = boardTop + trayH - pieceR - b * pieceR * 2;
      drawPiece(trayCx, by, pieceR, 1, false, false);
    }

    // Draw pieces on points
    var pieceR = Math.min(triWidth * 0.38, 13);
    var maxVisible = 5;

    for (var col = 0; col < 12; col++) {
      // Top row point
      var tp = topPoint(col);
      var pt = st.points[tp];
      if (pt && pt.count > 0) {
        var tx = col < 6
          ? boardLeft + col * triWidth + triWidth / 2
          : boardLeft + halfWidth + barWidth + (col - 6) * triWidth + triWidth / 2;
        var startY = boardTop + 4;
        var stackCount = Math.min(pt.count, maxVisible);
        for (var i = 0; i < stackCount; i++) {
          var py = startY + pieceR + i * pieceR * 1.85;
          var isSel = selSource && selSource.type === 'point' && selSource.index === tp;
          drawPiece(tx, py, pieceR, pt.side, isSel, false);
        }
        if (pt.count > maxVisible) {
          ctx.fillStyle = pt.side === 0 ? '#333' : '#eee';
          ctx.font = 'bold 10px "Nunito",sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(pt.count), tx, startY + pieceR + stackCount * pieceR * 1.85 + 4);
        }
      }

      // Bottom row point
      var bp = botPoint(col);
      var pt = st.points[bp];
      if (pt && pt.count > 0) {
        var bx = col < 6
          ? boardLeft + col * triWidth + triWidth / 2
          : boardLeft + halfWidth + barWidth + (col - 6) * triWidth + triWidth / 2;
        var startY = boardBottom - 4;
        var stackCount = Math.min(pt.count, maxVisible);
        for (var i = 0; i < stackCount; i++) {
          var py = startY - pieceR - i * pieceR * 1.85;
          var isSel = selSource && selSource.type === 'point' && selSource.index === bp;
          drawPiece(bx, py, pieceR, pt.side, isSel, false);
        }
        if (pt.count > maxVisible) {
          ctx.fillStyle = pt.side === 0 ? '#333' : '#eee';
          ctx.font = 'bold 10px "Nunito",sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(pt.count), bx, startY - pieceR - stackCount * pieceR * 1.85 - 4);
        }
      }
    }

    // Draw bar pieces
    var barCx = boardLeft + halfWidth + barWidth / 2;
    if (st.bar[0] > 0) {
      var startY = midY + barGap / 2 - 4;
      var stackCount = Math.min(st.bar[0], maxVisible);
      for (var i = 0; i < stackCount; i++) {
        var py = startY - pieceR - i * pieceR * 1.85;
        var isSel = selSource && selSource.type === 'bar';
        drawPiece(barCx, py, pieceR, 0, isSel, false);
      }
      if (st.bar[0] > maxVisible) {
        ctx.fillStyle = '#eee';
        ctx.font = 'bold 10px "Nunito",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(st.bar[0]), barCx, startY - pieceR - stackCount * pieceR * 1.85 - 4);
      }
    }
    if (st.bar[1] > 0) {
      var startY = boardTop + 4;
      var stackCount = Math.min(st.bar[1], maxVisible);
      for (var i = 0; i < stackCount; i++) {
        var py = startY + pieceR + i * pieceR * 1.85;
        var isSel = selSource && selSource.type === 'bar';
        drawPiece(barCx, py, pieceR, 1, isSel, false);
      }
      if (st.bar[1] > maxVisible) {
        ctx.fillStyle = '#333';
        ctx.font = 'bold 10px "Nunito",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(st.bar[1]), barCx, startY + pieceR + stackCount * pieceR * 1.85 + 4);
      }
    }

    // Legal move highlights
    if (selSource && curLegalMoves.length > 0) {
      var shown = {};
      for (var m = 0; m < curLegalMoves.length; m++) {
        var mv = curLegalMoves[m];
        var fromKey = mv.from === 'bar' ? 'bar' : String(mv.from);
        if (fromKey !== String(selSource.type === 'bar' ? 'bar' : selSource.index)) continue;

        var destKey = mv.to === 'off' ? 'off' : String(mv.to);
        if (shown[destKey]) continue;
        shown[destKey] = true;

        if (mv.to === 'off') {
          // Highlight bear-off tray
          var trayX = boardLeft - trayW - 4;
          var trayY = curPlayerIdx === 0 ? midY + barGap / 2 : boardTop;
          ctx.fillStyle = COL_LEGAL;
          ctx.fillRect(trayX, trayY, trayW, trayH);
          // Draw die value
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px "Nunito",sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(mv.dieUsed), trayX + trayW / 2, trayY + trayH / 2);
        } else {
          // Highlight destination point
          var dp = mv.to;
          var dcol = pointCol(dp);
          var dx = dcol < 6
            ? boardLeft + dcol * triWidth + triWidth / 2
            : boardLeft + halfWidth + barWidth + (dcol - 6) * triWidth + triWidth / 2;
          var dy;
          if (isTop(dp)) {
            dy = boardTop + triHeight / 2;
          } else {
            dy = boardBottom - triHeight / 2;
          }
          ctx.fillStyle = COL_LEGAL;
          ctx.beginPath();
          ctx.arc(dx, dy, pieceR + 4, 0, Math.PI * 2);
          ctx.fill();
          // Die value label
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px "Nunito",sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(mv.dieUsed), dx, dy);
        }
      }
    }

    // Dice display
    drawDiceDisplay(st);

    // Turn indicator
    if (st.winner === null) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px "Nunito",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      var turnText = st.currentPlayer === curPlayerIdx ? '你的回合' : '对手回合';
      ctx.fillText(turnText, W / 2, 4);
    }

    // Roll button
    if (st.winner === null && st.currentPlayer === curPlayerIdx && !st.hasRolled) {
      var bw = 110, bh = 36;
      var bx = W / 2 - bw / 2, by = boardBottom + 6;
      ctx.fillStyle = '#c8a45c';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 18);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px "Nunito",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎲 掷骰子', W / 2, by + bh / 2);
    }
  }

  function drawDiceDisplay(st) {
    if (!st.dice || st.dice.length === 0) return;
    var diceSize = Math.min(32, W * 0.06);
    var gap = 6;
    var totalW = st.dice.length * diceSize + (st.dice.length - 1) * gap;
    var startX = W / 2 - totalW / 2 + diceSize / 2;
    var dy = boardTop - diceAreaH / 2 - 4;

    for (var i = 0; i < st.dice.length; i++) {
      var dx = startX + i * (diceSize + gap);
      var used = st.remainingDice.indexOf(st.dice[i]) === -1;
      // For duplicates, mark used by count
      if (!used) {
        var totalCount = 0, usedCount = 0;
        for (var j = 0; j <= i; j++) {
          if (st.dice[j] === st.dice[i]) totalCount++;
        }
        var remCount = 0;
        for (var j = 0; j < st.remainingDice.length; j++) {
          if (st.remainingDice[j] === st.dice[i]) remCount++;
        }
        used = totalCount > remCount;
      }
      drawDiceValue(dx, dy, st.dice[i], diceSize, used);
    }
  }

  // ---- Click handling ----
  function getClickedTarget(mx, my) {
    if (!curState) return null;
    var st = curState;

    // Check roll button
    if (st.currentPlayer === curPlayerIdx && !st.hasRolled) {
      var bw = 110, bh = 36;
      var bx = W / 2 - bw / 2, by = boardBottom + 6;
      if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) {
        return { type: 'roll' };
      }
    }

    if (!st.hasRolled) return null;

    // Check bear-off trays
    var trayW = triWidth * 1.2;
    var trayX = boardLeft - trayW - 4;
    var midY = boardTop + triHeight + barGap / 2;
    if (mx >= trayX && mx <= trayX + trayW) {
      if (my >= boardTop && my <= boardTop + triHeight) {
        return { type: 'off' }; // Player 1 bear-off
      }
      if (my >= midY + barGap / 2 && my <= midY + barGap / 2 + triHeight) {
        return { type: 'off' }; // Player 0 bear-off
      }
    }

    // Check bar area
    var barX = boardLeft + halfWidth;
    if (mx >= barX && mx <= barX + barWidth) {
      if (st.bar[curPlayerIdx] > 0) {
        return { type: 'bar' };
      }
    }

    // Check points
    if (mx < boardLeft || mx > boardRight || my < boardTop || my > boardBottom) return null;

    var midY = boardTop + triHeight + barGap / 2;
    var isTopRow = my < midY;

    // Determine column
    var x = mx - boardLeft;
    var col;
    if (x < halfWidth) {
      col = Math.floor(x / triWidth);
    } else if (x < halfWidth + barWidth) {
      return null; // bar area
    } else {
      col = 6 + Math.floor((x - halfWidth - barWidth) / triWidth);
    }
    if (col < 0 || col > 11) return null;

    var point = isTopRow ? topPoint(col) : botPoint(col);
    return { type: 'point', index: point };
  }

  function handleClick(e) {
    if (!curState || curState.winner !== null) return;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var target = getClickedTarget(mx, my);
    if (!target) {
      selSource = null;
      drawFrame();
      return;
    }

    var st = curState;

    // Roll
    if (target.type === 'roll') {
      selSource = null;
      window._bgSend && window._bgSend({ roll: true });
      return;
    }

    // If no source selected, try to select one
    if (!selSource) {
      if (target.type === 'bar' && st.bar[curPlayerIdx] > 0) {
        selSource = { type: 'bar' };
        drawFrame();
        return;
      }
      if (target.type === 'point') {
        var pt = st.points[target.index];
        if (pt && pt.side === curPlayerIdx && pt.count > 0) {
          selSource = { type: 'point', index: target.index };
          drawFrame();
          return;
        }
      }
      // Can't select bear-off as source
      return;
    }

    // Source selected — try to move
    if (target.type === 'off') {
      // Bear off
      if (selSource.type === 'bar') {
        selSource = null;
        drawFrame();
        return; // Can't bear off from bar
      }
      var from = selSource.index;
      // Find appropriate die
      var dieUsed = findBearOffDie(st, curPlayerIdx, from);
      if (dieUsed !== null) {
        window._bgSend && window._bgSend({ from: from, to: 'off', dieUsed: dieUsed });
        selSource = null;
      } else {
        selSource = null;
        drawFrame();
      }
      return;
    }

    if (target.type === 'bar') {
      // Clicking bar while having a source — deselect or reselect
      if (st.bar[curPlayerIdx] > 0) {
        selSource = { type: 'bar' };
      } else {
        selSource = null;
      }
      drawFrame();
      return;
    }

    if (target.type === 'point') {
      // Moving to a point
      var from = selSource.type === 'bar' ? 'bar' : selSource.index;
      var to = target.index;

      // Find appropriate die
      var dieUsed = findMoveDie(st, curPlayerIdx, from, to);
      if (dieUsed !== null) {
        window._bgSend && window._bgSend({ from: from, to: to, dieUsed: dieUsed });
        selSource = null;
      } else {
        // Maybe selecting a different source
        var pt = st.points[to];
        if (pt && pt.side === curPlayerIdx && pt.count > 0) {
          selSource = { type: 'point', index: to };
        } else {
          selSource = null;
        }
        drawFrame();
      }
    }
  }

  function findMoveDie(st, side, from, to) {
    for (var i = 0; i < st.remainingDice.length; i++) {
      var die = st.remainingDice[i];
      if (from === 'bar') {
        var ep = side === 0 ? 24 - die : die - 1;
        if (ep === to) return die;
      } else {
        var expected = side === 0 ? from - to : to - from;
        if (die === expected && expected > 0) return die;
      }
    }
    return null;
  }

  function findBearOffDie(st, side, from) {
    var exactDie = side === 0 ? from + 1 : 24 - from;
    // Prefer exact match
    for (var i = 0; i < st.remainingDice.length; i++) {
      if (st.remainingDice[i] === exactDie) return exactDie;
    }
    // Overshoot
    for (var i = 0; i < st.remainingDice.length; i++) {
      if (st.remainingDice[i] > exactDie) return st.remainingDice[i];
    }
    return null;
  }

  // ---- Touch support ----
  function handleTouch(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      var touch = e.touches[0];
      handleClick({ clientX: touch.clientX, clientY: touch.clientY });
    }
  }

  // ---- Resize ----
  function handleResize() {
    calcLayout();
    drawFrame();
  }

  // ---- Renderer interface ----
  window.gameRenderers.set('backgammon', {
    init: function(container) {
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
      ctx = canvas.getContext('2d');
      container.appendChild(canvas);

      calcLayout();
      canvas.addEventListener('click', handleClick);
      canvas.addEventListener('touchstart', handleTouch, { passive: false });
      window.addEventListener('resize', handleResize);
    },

    render: function(state, container, playerIndex, winner) {
      curState = state;
      curPlayerIdx = playerIndex;
      curLegalMoves = state.legalMoves || [];

      // If it's not player's turn or hasn't rolled, clear selection
      if (state.currentPlayer !== playerIndex || !state.hasRolled) {
        selSource = null;
      }

      // Check for new game (reset selection)
      if (state.hasRolled && selSource && curLegalMoves.length === 0) {
        selSource = null;
      }

      drawFrame();
    }
  });

  // Global send function placeholder
  window._bgSend = null;
})();
