// public/js/renderers/2048.js
// 2048 — Canvas 4x4 grid. Arrow keys + touch swipe -> window.makeGameMove({dir}).
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var N = 4;
  var canvas, ctx, _layout = { ox: 0, oy: 0, cell: 0, size: 0 };
  var _playerIndex = 0;
  var _timerEnd = 0;
  var _timerRaf = null;
  var _inited = false;

  // Tile background colors by value (classic 2048 palette).
  var TILE_COLORS = {
    0: '#3a3f4b', 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179',
    16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72',
    256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e',
  };
  var TILE_TEXT = {
    0: '#3a3f4b', 2: '#776e65', 4: '#776e65', 8: '#f9f6f2',
    16: '#f9f6f2', 32: '#f9f6f2', 64: '#f9f6f2', 128: '#f9f6f2',
    256: '#f9f6f2', 512: '#f9f6f2', 1024: '#f9f6f2', 2048: '#f9f6f2',
  };

  function t(key, fallback) {
    var v = window._t ? window._t(key) : key;
    return v === key ? fallback : v;
  }

  var STYLES = ''
    + '.g2048-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;}'
    + '.g2048-bar{display:flex;gap:10px;justify-content:center;width:100%;}'
    + '.g2048-stat{background:var(--bg);border-radius:12px;padding:8px 16px;text-align:center;min-width:92px;}'
    + '@media (max-width:480px){.g2048-bar{gap:6px}.g2048-stat{flex:1 1 0;min-width:0;padding:6px 4px}.g2048-stat .value{font-size:18px}}'
    + '.g2048-stat .label{font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;}'
    + '.g2048-stat .value{font-size:22px;font-weight:800;line-height:1.2;}'
    + '.g2048-board-wrap{display:flex;justify-content:center;touch-action:none;}'
    + '.g2048-board-wrap canvas{display:block;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.18);touch-action:none;}'
    + '.g2048-hint{text-align:center;font-size:13px;color:var(--text-muted);}';

  function tileColor(v) { return TILE_COLORS[v] || '#3c3a32'; }
  function textColor(v) { return TILE_TEXT[v] || '#f9f6f2'; }

  function formatTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function updateTimer(state) {
    var el = document.getElementById('g2048Timer');
    if (!el) return;
    if (!state || !state.startTime) { el.textContent = '--:--'; return; }
    var end = (state.winner !== null && state.winner !== undefined) ? _timerEnd : Date.now();
    el.textContent = formatTime(end - state.startTime);
  }
  function startTimer(state) {
    if (_timerRaf) { clearInterval(_timerRaf); _timerRaf = null; }
    if (!state || !state.startTime) return;
    _timerEnd = 0;
    updateTimer(state);
    _timerRaf = setInterval(function () {
      var s = window._g2048State;
      if (!s || (s.winner !== null && s.winner !== undefined)) {
        if (_timerRaf) { clearInterval(_timerRaf); _timerRaf = null; }
        return;
      }
      updateTimer(s);
    }, 250);
  }

  function computeLayout() {
    var maxBoard = Math.min(window.innerWidth - 24, 520, window.innerHeight * 0.55);
    maxBoard = Math.max(maxBoard, 240);
    var size = Math.floor(maxBoard);
    _layout.size = size;
    _layout.cell = size / N;
    _layout.ox = 0;
    _layout.oy = 0;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  // ---- Animation state (flightchess-style loop) ----
  var animState = {
    running: false,
    rafId: null,
    startTime: 0,
    // Per-cell pop animations: key "r,c" -> { type:'pop'|'merge', start }
    pops: {},
  };

  function startAnimLoop() {
    if (animState.running) return;
    animState.running = true;
    animState.startTime = performance.now();
    animTick();
  }

  function stopAnimLoop() {
    animState.running = false;
    animState.pops = {};
    if (animState.rafId) { cancelAnimationFrame(animState.rafId); animState.rafId = null; }
  }

  function animTick(now) {
    if (!animState.running) return;
    now = now || performance.now();
    var POP_MS = 160;

    // Drop finished pops.
    for (var key in animState.pops) {
      if (now - animState.pops[key].start > POP_MS) delete animState.pops[key];
    }

    drawFrame();

    // Always keep looping so the board stays visible (no "disappears on scroll").
    animState.rafId = requestAnimationFrame(animTick);
  }

  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawFrame() {
    var state = window._g2048State;
    var cell = _layout.cell;
    var size = _layout.size;
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);

    // Board background
    ctx.fillStyle = '#2b2f38';
    ctx.fillRect(0, 0, size, size);

    if (!state || !state.board) return;

    var now = performance.now();
    var POP_MS = 160;

    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var x = _layout.ox + c * cell;
        var y = _layout.oy + r * cell;
        var v = state.board[r][c];
        var g = cell * 0.06;

        // Cell background (empty slot)
        ctx.fillStyle = '#3a3f4b';
        ctx.beginPath(); rr(x + g, y + g, cell - 2 * g, cell - 2 * g, cell * 0.12); ctx.fill();

        if (v === 0) continue;

        // Pop/merge scale animation
        var key = r + ',' + c;
        var pop = animState.pops[key];
        var scale = 1, ox = 0, oy = 0;
        if (pop) {
          var t = Math.min((now - pop.start) / POP_MS, 1);
          // ease-out back for a little overshoot on merge
          var s = pop.type === 'merge'
            ? 1 + 0.18 * Math.sin(Math.min(t, 1) * Math.PI)
            : 0.6 + 0.4 * (1 - Math.pow(1 - t, 3));
          scale = s;
          ox = (cell - cell * scale) / 2;
          oy = (cell - cell * scale) / 2;
        }

        ctx.fillStyle = tileColor(v);
        ctx.beginPath();
        rr(x + g + ox, y + g + oy, cell * scale - 2 * g, cell * scale - 2 * g, cell * 0.12);
        ctx.fill();

        // Number
        ctx.fillStyle = textColor(v);
        var fontSize = v >= 1024 ? cell * 0.3 : v >= 128 ? cell * 0.35 : cell * 0.42;
        ctx.font = 'bold ' + Math.floor(fontSize) + 'px system-ui,-apple-system,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(v), x + cell / 2, y + cell / 2 + 1);
      }
    }
  }

  // Detect merges/pops by comparing the new board against the previous snapshot.
  function triggerPopAnims(prev, next) {
    if (prev) {
      for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
          var a = prev[r][c], b = next[r][c];
          if (b === 0) continue;
          if (a !== b) {
            // Value grew here -> a merge landed on this cell; new spawn is a->b where a==0.
            animState.pops[r + ',' + c] = { type: a === 0 ? 'spawn' : 'merge', start: performance.now() };
          }
        }
      }
    }
    startAnimLoop();
  }

  // ---- Input: keyboard ----
  var KEY_MAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
  };
  function onKeyDown(e) {
    var dir = KEY_MAP[e.key];
    if (!dir) return;
    e.preventDefault();
    window.makeGameMove({ dir: dir });
  }

  // ---- Input: touch swipe ----
  var touchStart = null;
  function onTouchStart(e) {
    var tch = e.changedTouches[0];
    touchStart = { x: tch.clientX, y: tch.clientY };
  }
  function onTouchEnd(e) {
    if (!touchStart) return;
    var tch = e.changedTouches[0];
    var dx = tch.clientX - touchStart.x;
    var dy = tch.clientY - touchStart.y;
    var absX = Math.abs(dx), absY = Math.abs(dy);
    touchStart = null;
    if (Math.max(absX, absY) < 24) return; // too small -> ignore
    if (absX > absY) window.makeGameMove({ dir: dx > 0 ? 'right' : 'left' });
    else window.makeGameMove({ dir: dy > 0 ? 'down' : 'up' });
  }

  window.gameRenderers.set('2048', {
    init: function (container) {
      injectStylesOnce('g2048Styles', STYLES);
      container.innerHTML = ''
        + '<div class="g2048-wrap">'
          + '<div class="g2048-bar">'
            + '<div class="g2048-stat"><div class="label">' + t('g2048_score', '分数') + '</div><div class="value" id="g2048Score">0</div></div>'
            + '<div class="g2048-stat"><div class="label">' + t('g2048_best', '最高分') + '</div><div class="value" id="g2048Best">0</div></div>'
            + '<div class="g2048-stat"><div class="label">' + t('g2048_max', '最大') + '</div><div class="value" id="g2048Max">0</div></div>'
            + '<div class="g2048-stat"><div class="label">' + t('g2048_time', '用时') + '</div><div class="value" id="g2048Timer" style="font-variant-numeric:tabular-nums;">--:--</div></div>'
          + '</div>'
          + '<div class="g2048-board-wrap" id="g2048BoardWrap"></div>'
          + '<div class="g2048-hint" id="g2048Hint">' + t('g2048_hint', '方向键 / 滑动 移动方块') + '</div>'
        + '</div>';

      canvas = document.createElement('canvas');
      canvas.id = 'g2048Canvas';
      document.getElementById('g2048BoardWrap').appendChild(canvas);
      ctx = canvas.getContext('2d', { preserveDrawingBuffer: true });

      _timerEnd = 0;
      if (_timerRaf) { clearInterval(_timerRaf); _timerRaf = null; }

      computeLayout();

      if (!_inited) {
        _inited = true;
        window.addEventListener('resize', function () { computeLayout(); drawFrame(); });
        window.addEventListener('scroll', function () { drawFrame(); }, { passive: true });
        window.addEventListener('keydown', onKeyDown);
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });
      }
    },

    render: function (state, container, playerIndex, winner) {
      window._g2048State = state;
      _playerIndex = playerIndex;
      if (!canvas) return;

      var prev = window._g2048Prev;
      if (!ctx) ctx = canvas.getContext('2d');
      computeLayout();
      // Always draw at least once (animation loop may not start on first render)
      drawFrame();
      triggerPopAnims(prev, state.board);
      window._g2048Prev = state.board.map(function (r) { return r.slice(); });

      var scoreEl = document.getElementById('g2048Score');
      var bestEl = document.getElementById('g2048Best');
      var maxEl = document.getElementById('g2048Max');
      if (scoreEl) scoreEl.textContent = state.score;
      if (bestEl) bestEl.textContent = state.highScore;
      if (maxEl) maxEl.textContent = state.maxTile;

      // Timer
      if (state && state.startTime) {
        if (winner !== null && winner !== undefined && !_timerEnd) {
          _timerEnd = Date.now();
          if (_timerRaf) { clearInterval(_timerRaf); _timerRaf = null; }
        }
        updateTimer(state);
        if ((winner === null || winner === undefined) && !_timerRaf) {
          startTimer(state);
        }
      }

      var hintEl = document.getElementById('g2048Hint');
      if (hintEl) {
        if (winner !== null && winner !== undefined) {
          hintEl.textContent = winner === -1
            ? t('draw', '平局')
            : (winner === _playerIndex ? t('you_win', '你赢了') : t('opponent_wins', '对手获胜'));
          hintEl.style.color = winner === _playerIndex ? '#c8a45c' : 'var(--text-muted)';
        } else if (state.alive === false) {
          hintEl.textContent = t('g2048_lock', '已锁定，等待其他玩家');
          hintEl.style.color = 'var(--text-muted)';
        } else {
          hintEl.textContent = t('g2048_hint', '方向键 / 滑动 移动方块');
          hintEl.style.color = 'var(--text-muted)';
        }
      }

      drawFrame();
    },
  });
})();
