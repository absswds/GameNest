// public/js/renderers/gomoku.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();
  var SIZE = 15;
  var canvas, ctx, cellSize, padding, boardW;
  var _listenerAttached = false;
  var _lastState = null;  // remember last board so resize() can redraw
  var _prevBoard = null;
  var _lastMove = null;   // {row, col} derived by diffing boards (state has no lastMove)
  var _anim = null;       // {row, col, start}
  var _hover = null;      // {row, col} desktop placement preview
  var _myTurn = false;
  var _myColor = 0;

  window.gameRenderers.set('gomoku', {
    init: function(container) {
      container.innerHTML = '<div class="gomoku-wrap" id="gomokuWrap"><canvas id="gomokuCanvas"></canvas></div>';
      canvas = document.getElementById('gomokuCanvas');
      _prevBoard = null; _lastMove = null; _hover = null;
      resize();
      canvas.addEventListener('click', function(e) {
        var cell = cellAt(e);
        if (!cell) return;
        // Touch screens: cells are ~23px, too small for a one-tap commit. First tap previews
        // the stone, tapping the same intersection again places it.
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && _myTurn) {
          var same = _hover && _hover.row === cell.row && _hover.col === cell.col;
          if (!same) {
            _hover = _lastState && _lastState.board[cell.row][cell.col] === null ? cell : null;
            if (_lastState) draw(_lastState);
            return;
          }
          _hover = null;
        }
        window.makeGameMove({ row: cell.row, col: cell.col });
      });
      canvas.addEventListener('mousemove', function(e) {
        var cell = _myTurn ? cellAt(e) : null;
        if (cell && _lastState && _lastState.board[cell.row][cell.col] !== null) cell = null;
        var changed = (cell && (!_hover || _hover.row !== cell.row || _hover.col !== cell.col)) || (!cell && _hover);
        _hover = cell;
        if (changed && _lastState) draw(_lastState);
      });
      canvas.addEventListener('mouseleave', function() {
        if (_hover) { _hover = null; if (_lastState) draw(_lastState); }
      });
      if (!_listenerAttached) {
        window.addEventListener('resize', function() { resize(); });
        window.addEventListener('orientationchange', function() { setTimeout(resize, 100); });
        _listenerAttached = true;
      }
    },
    render: function(state, container, playerIndex, winner) {
      if (_prevBoard) {
        for (var r = 0; r < SIZE; r++) {
          for (var c = 0; c < SIZE; c++) {
            if (_prevBoard[r][c] === null && state.board[r][c] !== null) {
              _lastMove = { row: r, col: c };
              _anim = { row: r, col: c, start: performance.now() };
            }
          }
        }
      }
      _prevBoard = state.board.map(function(row) { return row.slice(); });
      _myTurn = state.winner === null && state.currentPlayer === playerIndex;
      _myColor = playerIndex;
      if (!_myTurn) _hover = null;
      _lastState = state;
      if (_anim && !(window.Motion && window.Motion.reduced())) animate(); else { _anim = null; draw(state); }
    }
  });

  function cellAt(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var col = Math.round((x - padding) / cellSize);
    var row = Math.round((y - padding) / cellSize);
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
    if (Math.abs(x - padding - col * cellSize) > cellSize * 0.45 || Math.abs(y - padding - row * cellSize) > cellSize * 0.45) return null;
    return { row: row, col: col };
  }

  function animate() {
    if (!_anim || !_lastState) return;
    draw(_lastState);
    if (performance.now() - _anim.start < 220) requestAnimationFrame(animate);
    else { _anim = null; draw(_lastState); }
  }

  function resize() {
    if (!canvas) return;
    var wrap = document.getElementById('gomokuWrap');
    if (!wrap) return;
    // Square board: fit both the stage width and the height left below it
    var fit = window.boardFit(wrap.parentElement);
    var size = Math.floor(Math.min(fit.w, fit.h, 900));
    if (!size || size <= 0) return;  // wrap not laid out yet — skip
    wrap.style.width = size + 'px';
    canvas.width = size * (window.devicePixelRatio || 1);
    canvas.height = size * (window.devicePixelRatio || 1);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    boardW = size;
    padding = boardW / (SIZE + 1);
    cellSize = (boardW - padding * 2) / (SIZE - 1);
    // Setting canvas.width/height clears the canvas — redraw the last board
    if (_lastState) draw(_lastState);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawWood(w) {
    ctx.clearRect(0, 0, w, w);
    var g = ctx.createLinearGradient(0, 0, w, w);
    g.addColorStop(0, '#e4c48f');
    g.addColorStop(0.5, '#d8b27a');
    g.addColorStop(1, '#cfa56b');
    roundRect(0, 0, w, w, 14);
    ctx.fillStyle = g;
    ctx.fill();
    // subtle grain: deterministic soft wavy lines
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(120, 78, 30, 0.07)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 26; i++) {
      var y0 = (i + 0.5) * w / 26;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (var x = 0; x <= w; x += w / 12) {
        ctx.lineTo(x, y0 + Math.sin(x / w * 6 + i * 1.7) * 3);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function stone(cx, cy, radius, isBlack, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.arc(cx + radius * 0.08, cy + radius * 0.14, radius, 0, Math.PI * 2); ctx.fill();
    var grad = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.08, cx, cy, radius);
    if (isBlack) { grad.addColorStop(0, '#5a5a5a'); grad.addColorStop(0.55, '#1e1e1e'); grad.addColorStop(1, '#0a0a0a'); }
    else { grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.7, '#ecebe6'); grad.addColorStop(1, '#c9c6bd'); }
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function findWinLine(board, who) {
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] !== who) continue;
        for (var d = 0; d < 4; d++) {
          var cells = [[r, c]];
          for (var k = 1; k < 5; k++) {
            var rr = r + dirs[d][0] * k, cc = c + dirs[d][1] * k;
            if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE || board[rr][cc] !== who) break;
            cells.push([rr, cc]);
          }
          if (cells.length === 5) return cells;
        }
      }
    }
    return null;
  }

  function draw(state) {
    if (!ctx) return;
    var w = boardW;
    drawWood(w);

    var end = padding + (SIZE - 1) * cellSize;
    ctx.strokeStyle = 'rgba(40, 26, 12, 0.72)';
    ctx.lineWidth = 0.9;
    for (var i = 0; i < SIZE; i++) {
      var pos = padding + i * cellSize;
      ctx.beginPath(); ctx.moveTo(padding, pos); ctx.lineTo(end, pos); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pos, padding); ctx.lineTo(pos, end); ctx.stroke();
    }
    ctx.lineWidth = 1.8;
    ctx.strokeRect(padding, padding, end - padding, end - padding);

    var stars = [[3,3],[3,11],[7,7],[11,3],[11,11]];
    ctx.fillStyle = 'rgba(40, 26, 12, 0.85)';
    for (var si = 0; si < stars.length; si++) {
      ctx.beginPath();
      ctx.arc(padding + stars[si][1] * cellSize, padding + stars[si][0] * cellSize, Math.max(2.5, cellSize * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }

    var baseR = cellSize * 0.45;
    for (var row = 0; row < SIZE; row++) {
      for (var col = 0; col < SIZE; col++) {
        if (state.board[row][col] === null) continue;
        var cx = padding + col * cellSize;
        var cy = padding + row * cellSize;
        var radius = baseR;
        if (_anim && _anim.row === row && _anim.col === col) {
          var t = Math.min((performance.now() - _anim.start) / 220, 1);
          radius = baseR * (0.6 + 0.4 * (1 - Math.pow(1 - t, 3)));
        }
        stone(cx, cy, radius, state.board[row][col] === 0);
      }
    }

    if (_hover && state.board[_hover.row][_hover.col] === null) {
      stone(padding + _hover.col * cellSize, padding + _hover.row * cellSize, baseR, _myColor === 0, 0.35);
    }

    var line = state.winner !== null && state.winner !== undefined && state.winner >= 0 ? findWinLine(state.board, state.winner) : null;
    if (line) {
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = Math.max(3, cellSize * 0.14);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(padding + line[0][1] * cellSize, padding + line[0][0] * cellSize);
      ctx.lineTo(padding + line[4][1] * cellSize, padding + line[4][0] * cellSize);
      ctx.stroke();
    } else if (_lastMove && state.board[_lastMove.row][_lastMove.col] !== null) {
      // last move marker: small contrasting dot
      var isBlack = state.board[_lastMove.row][_lastMove.col] === 0;
      ctx.fillStyle = isBlack ? '#f3d9a4' : '#c0392b';
      ctx.beginPath();
      ctx.arc(padding + _lastMove.col * cellSize, padding + _lastMove.row * cellSize, baseR * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
})();
