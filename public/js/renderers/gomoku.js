// public/js/renderers/gomoku.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();
  var SIZE = 15;
  var canvas, ctx, cellSize, padding, boardW;
  var _listenerAttached = false;
  var _lastState = null;  // remember last board so resize() can redraw

  window.gameRenderers.set('gomoku', {
    init: function(container) {
      container.innerHTML = '<div class="gomoku-wrap" id="gomokuWrap"><canvas id="gomokuCanvas"></canvas></div>';
      canvas = document.getElementById('gomokuCanvas');
      resize();
      canvas.addEventListener('click', function(e) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var col = Math.round((x - padding) / cellSize);
        var row = Math.round((y - padding) / cellSize);
        if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
        var distX = Math.abs(x - padding - col * cellSize);
        var distY = Math.abs(y - padding - row * cellSize);
        if (distX > cellSize * 0.45 || distY > cellSize * 0.45) return;
        window.makeGameMove({ row: row, col: col });
      });
      if (!_listenerAttached) {
        window.addEventListener('resize', function() { resize(); });
        window.addEventListener('orientationchange', function() { setTimeout(resize, 100); });
        _listenerAttached = true;
      }
    },
    render: function(state, container, playerIndex, winner) {
      _lastState = state;
      draw(state);
    }
  });

  function resize() {
    if (!canvas) return;
    var wrap = document.getElementById('gomokuWrap');
    if (!wrap) return;
    var size = wrap.clientWidth;
    if (!size || size <= 0) return;  // wrap not laid out yet — skip
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

  function draw(state) {
    if (!ctx) return;
    var w = boardW;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = '#c9975b';
    var r = 12, x = 4, y = 4, bw = w - 8, bh = w - 8;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + bw - r, y);
    ctx.arcTo(x + bw, y, x + bw, y + r, r);
    ctx.lineTo(x + bw, y + bh - r);
    ctx.arcTo(x + bw, y + bh, x + bw - r, y + bh, r);
    ctx.lineTo(x + r, y + bh);
    ctx.arcTo(x, y + bh, x, y + bh - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.8;
    for (var i = 0; i < SIZE; i++) {
      var pos = padding + i * cellSize;
      ctx.beginPath(); ctx.moveTo(padding, pos); ctx.lineTo(padding + (SIZE-1) * cellSize, pos); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pos, padding); ctx.lineTo(pos, padding + (SIZE-1) * cellSize); ctx.stroke();
    }

    var stars = [[3,3],[3,7],[3,11],[7,3],[7,7],[7,11],[11,3],[11,7],[11,11]];
    for (var si = 0; si < stars.length; si++) {
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(padding + stars[si][1] * cellSize, padding + stars[si][0] * cellSize, 3.5, 0, Math.PI*2);
      ctx.fill();
    }

    for (var row = 0; row < SIZE; row++) {
      for (var col = 0; col < SIZE; col++) {
        if (state.board[row][col] === null) continue;
        var cx = padding + col * cellSize;
        var cy = padding + row * cellSize;
        var radius = cellSize * 0.44;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.arc(cx + 1.5, cy + 1.5, radius, 0, Math.PI*2); ctx.fill();
        var isBlack = state.board[row][col] === 0;
        var grad = ctx.createRadialGradient(cx - radius*0.3, cy - radius*0.3, radius*0.1, cx, cy, radius);
        if (isBlack) { grad.addColorStop(0, '#666'); grad.addColorStop(1, '#111'); }
        else { grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#ccc'); }
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.fill();
      }
    }
  }
})();
