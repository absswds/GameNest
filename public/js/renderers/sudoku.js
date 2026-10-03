// public/js/renderers/sudoku.js
// Sudoku — Multiplayer speed race renderer. Canvas grid + number pad + lives + hints + timer.
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var N = 9;
  var canvas, ctx, _layout = { ox: 0, oy: 0, cell: 0, size: 0 };
  var _selected = null;   // {r, c} cell chosen by the player
  var _pending = null;    // {r, c, val} fill sent to server, awaiting resolution
  var _flash = null;      // {r, c, start} red-flash animation for a wrong fill
  var _flashRaf = null;
  var _timerEnd = 0;      // epoch ms when the game ended (freeze timer display)
  var _timerRaf = null;   // interval handle for the live timer
  var _inited = false;
  var _container = null;
  var SIDE_W = 230;       // side panel width on wide screens

  var ACCENT = '#c8a45c';
  var ACCENT_SOFT = 'rgba(200,164,92,0.18)';

  // _t returns the key when missing; provide sane fallbacks so the renderer
  // works without dedicated lang keys (lang files are managed separately).
  function t(key, fallback) {
    var v = window._t ? window._t(key) : key;
    return v === key ? fallback : v;
  }

  var STYLES = ''
    + '.su-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;}'
    + '.su-status{text-align:center;font-size:15px;font-weight:700;min-height:22px;letter-spacing:.3px;}'
    + '.su-timer{text-align:center;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--text-muted);min-height:20px;letter-spacing:.5px;}'
    + '.su-lives{display:flex;gap:4px;font-size:22px;line-height:1;min-height:26px;align-items:center;}'
    + '.su-lives .hp{transition:transform .2s,opacity .2s;}'
    + '.su-lives .hp.lost{opacity:.25;transform:scale(.7);}'
    + '.su-board-wrap{display:flex;justify-content:center;touch-action:manipulation;}'
    + '.su-board-wrap canvas{display:block;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.18);touch-action:manipulation;}'
    + '.su-controls{display:flex;gap:8px;width:100%;max-width:360px;align-items:center;}'
    + '.su-hint{flex:1;height:48px;border:1px solid var(--border);border-radius:12px;background:var(--surface);font-size:15px;font-weight:700;color:var(--text);cursor:pointer;transition:transform .08s,background .15s;user-select:none;-webkit-user-select:none;display:flex;align-items:center;justify-content:center;gap:6px;}'
    + '.su-hint:active{transform:scale(.95);}'
    + '.su-hint[disabled]{opacity:.35;cursor:default;}'
    + '.su-hint-badge{font-size:13px;font-weight:600;color:var(--accent);}'
    + '.su-pad{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:100%;max-width:360px;}'
    + '.su-num{height:52px;border:1px solid var(--border);border-radius:12px;background:var(--surface);font-size:20px;font-weight:700;color:var(--text);cursor:pointer;transition:transform .08s,background .15s;user-select:none;-webkit-user-select:none;}'
    + '.su-num:active{transform:scale(.93);}'
    + '.su-num.selected{background:var(--accent);color:#1a1a1a;border-color:var(--accent);}'
    + '.su-num[disabled]{opacity:.3;cursor:default;}'
    + '.su-num-clear{font-size:18px;color:var(--text-muted);}'
    + '@media(min-width:768px){.su-num{height:60px;font-size:22px;}}'
    // wide screens: own stats on the left, digit counts + tips on the right
    + '.su{display:flex;justify-content:center;align-items:flex-start;gap:24px;width:100%;}'
    + '.su-main{flex:1 1 0;min-width:0;display:flex;justify-content:center;}'
    + '.su.wide .su-main{flex:0 1 auto;}'
    + '.su-side{display:none;width:' + SIDE_W + 'px;flex:none;flex-direction:column;gap:12px;}'
    + '.su.wide .su-side{display:flex;}'
    + '.su.wide .su-timer,.su.wide .su-lives{display:none;}'
    + '.su-card{padding:12px 14px;border-radius:var(--radius-sm);background:var(--bg);font-size:13px;}'
    + '.su-label{display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;}'
    + '.su-label span{font-weight:400;white-space:nowrap;}'
    + '.su-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px 8px;}'
    + '.su-stats .big{grid-column:1/-1;}'
    + '.su-stats b{display:block;font-size:20px;font-weight:800;line-height:1.2;font-variant-numeric:tabular-nums;}'
    + '.su-stats .big b{font-size:34px;}'
    + '.su-stats em{display:block;font-style:normal;font-size:11px;color:var(--text-muted);}'
    + '.su-bar{height:6px;border-radius:3px;background:var(--surface);overflow:hidden;margin-top:8px;}'
    + '.su-bar i{display:block;height:100%;background:var(--accent);border-radius:3px;transition:width .4s;}'
    + '.su-hearts{display:flex;gap:3px;font-size:18px;line-height:1.2;}'
    + '.su-digits{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}'
    + '.su-dg{display:flex;align-items:baseline;justify-content:center;gap:4px;padding:8px 0;border-radius:10px;background:var(--surface);}'
    + '.su-dg b{font-size:18px;font-weight:800;}'
    + '.su-dg span{font-size:12px;color:var(--text-muted);font-variant-numeric:tabular-nums;}'
    + '.su-dg.done{opacity:.35;}'
    + '.su-tips ol{margin:0;padding-left:18px;display:grid;gap:6px;color:var(--text-muted);line-height:1.5;}';

  function updateSides(state) {
    var left = document.getElementById('suLeft');
    var right = document.getElementById('suRight');
    if (!left || !right || !state || !state.board) return;
    var blanks = state.blanks || 1, done = state.doneCount || 0;
    var pct = Math.min(100, Math.round(done / blanks * 100));
    var lives = state.lives || 0, hearts = '', i;
    for (i = 0; i < 3; i++) hearts += '<span style="' + (i < lives ? '' : 'opacity:.25') + '">❤️</span>';
    left.innerHTML =
      '<div class="su-card su-stats">' +
        '<div class="big"><em>' + t('sudoku_progress', 'Progress') + '</em><b>' + pct + '%</b></div>' +
        '<div><em>' + t('sudoku_side_filled', 'Filled') + '</em><b>' + done + ' / ' + blanks + '</b></div>' +
        '<div><em>' + t('sudoku_side_time', 'Time') + '</em><b id="suTimerSide">--:--</b></div>' +
        '<div><em>' + t('sudoku_side_lives', 'Lives') + '</em><div class="su-hearts">' + hearts + '</div></div>' +
        '<div><em>' + t('sudoku_hint', 'Hint') + '</em><b>×' + (state.hints || 0) + '</b></div>' +
      '</div>' +
      '<div class="su-card"><div class="su-label">' + t('sudoku_side_bar', 'Blanks left') + '<span>' + (blanks - done) + '</span></div>' +
        '<div class="su-bar"><i style="width:' + pct + '%"></i></div></div>';

    var cnt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], r, c, dg = '';
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) cnt[state.board[r][c].value]++;
    for (i = 1; i <= 9; i++) {
      dg += '<div class="su-dg' + (cnt[i] >= 9 ? ' done' : '') + '"><b>' + i + '</b><span>×' + Math.max(0, 9 - cnt[i]) + '</span></div>';
    }
    right.innerHTML =
      '<div class="su-card"><div class="su-label">' + t('sudoku_side_digits', 'Digits left') + '</div><div class="su-digits">' + dg + '</div></div>' +
      '<div class="su-card su-tips"><div class="su-label">' + t('sudoku_side_tips', 'How to play') + '</div><ol>' +
        '<li>' + t('sudoku_tip_1', 'Tap a blank cell, then a digit') + '</li><li>' + t('sudoku_tip_2', 'Each row, column and 3x3 box holds 1-9 once') + '</li>' +
        '<li>' + t('sudoku_tip_3', 'A wrong digit costs a life') + '</li><li>' + t('sudoku_tip_4', 'First to finish wins') + '</li></ol></div>';
  }

  function computeLayout() {
    var wrap = _container && _container.querySelector('.su');
    var fit = window.boardFit && _container ? window.boardFit(_container) : { w: window.innerWidth - 24, h: window.innerHeight - 160 };
    var wide = fit.w >= 380 + SIDE_W * 2 + 72 && fit.h >= 520;
    if (wrap) wrap.classList.toggle('wide', wide);
    var maxBoard = Math.min(window.innerWidth - 24, 520, window.innerHeight * 0.5);
    if (wide) {
      // room for everything in the middle column that is not the board (status, hint, pad)
      var mid = _container.querySelector('.su-wrap');
      var extra = mid && canvas ? mid.offsetHeight - canvas.offsetHeight : 260;
      maxBoard = Math.min(fit.w - SIDE_W * 2 - 72, fit.h - extra - 4, 600);
    }
    maxBoard = Math.max(maxBoard, 240);
    var size = Math.floor(maxBoard);
    var cell = size / N;
    _layout.size = size;
    _layout.cell = cell;
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

  function drawFrame() {
    var state = window._suState;
    var cell = _layout.cell;
    var size = _layout.size;
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);

    // Board background
    ctx.fillStyle = '#2b2f38';
    ctx.fillRect(0, 0, size, size);

    if (!state || !state.board) return;

    var now = performance.now();
    var flashT = _flash ? Math.min((now - _flash.start) / 400, 1) : -1;

    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var x = _layout.ox + c * cell;
        var y = _layout.oy + r * cell;
        var cellData = state.board[r][c];

        // Cell background
        var bg = '#3a3f4b';
        if (_selected && _selected.r === r && _selected.c === c) bg = ACCENT_SOFT;
        if (_flash && _flash.r === r && _flash.c === c) {
          // Red flash fading out
          var alpha = (1 - flashT) * 0.7;
          bg = 'rgba(231,76,60,' + alpha.toFixed(3) + ')';
        }
        ctx.fillStyle = bg;
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);

        // Number
        var val = cellData.value;
        if (val > 0) {
          if (cellData.given) ctx.fillStyle = '#d0d0d0';
          else if (cellData.mineFill) ctx.fillStyle = ACCENT;
          else ctx.fillStyle = '#e0e0e0';
          ctx.font = 'bold ' + Math.floor(cell * 0.5) + 'px system-ui,-apple-system,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(val), x + cell / 2, y + cell / 2 + 1);
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = '#555a66';
    ctx.lineWidth = 1;
    for (var i = 0; i <= N; i++) {
      var p = Math.round(i * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, 0); ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p); ctx.lineTo(size, p);
      ctx.stroke();
    }

    // Bold 3x3 borders
    ctx.strokeStyle = '#c8a45c';
    ctx.lineWidth = 2.5;
    for (var b = 0; b <= N; b += 3) {
      var q = Math.round(b * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(q, 0); ctx.lineTo(q, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, q); ctx.lineTo(size, q);
      ctx.stroke();
    }
  }

  function flashTick(now) {
    if (!_flash) { _flashRaf = null; drawFrame(); return; }
    drawFrame();
    if (now - _flash.start > 400) { _flash = null; _flashRaf = null; drawFrame(); return; }
    _flashRaf = requestAnimationFrame(flashTick);
  }

  function startFlash(r, c) {
    _flash = { r: r, c: c, start: performance.now() };
    if (!_flashRaf) _flashRaf = requestAnimationFrame(flashTick);
  }

  function updatePad() {
    var pad = document.getElementById('suPad');
    if (!pad) return;
    var state = window._suState;
    var hasSel = _selected && state && state.winner === null && !state.eliminated
      && state.board[_selected.r][_selected.c].value === 0;
    var nums = pad.querySelectorAll('.su-num[data-v]');
    for (var i = 0; i < nums.length; i++) {
      var n = parseInt(nums[i].dataset.v);
      nums[i].classList.toggle('selected', hasSel && _pending && _pending.val === n);
      nums[i].disabled = !hasSel;
    }
  }

  function formatTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function updateTimer(state) {
    var el = document.getElementById('suTimer');
    var el2 = document.getElementById('suTimerSide');
    if (!el) return;
    var txt = '';
    if (state && state.startTime) {
      var end = (state.winner !== null && state.winner !== undefined) ? _timerEnd : Date.now();
      txt = formatTime(end - state.startTime);
    }
    el.textContent = txt ? '⏱ ' + txt : '';
    if (el2) el2.textContent = txt || '--:--';
  }

  function startTimer(state) {
    if (_timerRaf) { clearInterval(_timerRaf); _timerRaf = null; }
    if (!state || !state.startTime) return;
    _timerEnd = 0;
    updateTimer(state);
    _timerRaf = setInterval(function () {
      var s = window._suState;
      if (!s || (s.winner !== null && s.winner !== undefined)) {
        if (_timerRaf) { clearInterval(_timerRaf); _timerRaf = null; }
        return;
      }
      updateTimer(s);
    }, 250);
  }

  function updateLives(state) {
    var el = document.getElementById('suLives');
    if (!el || !state) return;
    var lives = state.lives || 0;
    var html = '';
    for (var i = 0; i < 3; i++) {
      html += '<span class="hp' + (i < lives ? '' : ' lost') + '">❤️</span>';
    }
    el.innerHTML = html;
  }

  function updateHintBtn(state) {
    var btn = document.getElementById('suHint');
    if (!btn || !state) return;
    var hints = state.hints || 0;
    var dead = state.eliminated || state.winner !== null;
    btn.disabled = dead || hints <= 0;
    var badge = btn.querySelector('.su-hint-badge');
    if (badge) badge.textContent = '×' + hints;
  }

  function updateStatus(state, winner) {
    var el = document.getElementById('suStatus');
    if (!el) return;
    if (state && state.eliminated) {
      el.textContent = t('sudoku_dead', 'You are out');
      el.style.color = '#e74c3c';
      return;
    }
    if (winner !== null && winner !== undefined) {
      el.textContent = winner === -1 ? t('draw', 'Draw') : (winner === _playerIndex ? t('you_win', 'You Win!') : t('opponent_wins', 'Opponent Wins'));
      el.style.color = winner === _playerIndex ? ACCENT : 'var(--text-muted)';
    } else if (state) {
      el.textContent = t('sudoku_progress', 'Progress') + ' ' + state.doneCount + ' / ' + state.blanks;
      el.style.color = 'var(--text-muted)';
    }
  }

  window._sudokuSelect = function (r, c) {
    var state = window._suState;
    if (!state || state.winner !== null || state.eliminated) return;
    var cell = state.board[r][c];
    if (cell.given || cell.mineFill) return; // immutable or already solved
    _selected = { r: r, c: c };
    _pending = null;
    updatePad();
    drawFrame();
  };

  window._sudokuFill = function (val) {
    var state = window._suState;
    if (!state || state.winner !== null || state.eliminated) return;
    if (!_selected) return;
    var r = _selected.r, c = _selected.c;
    var cell = state.board[r][c];
    if (cell.given || cell.mineFill) { _selected = null; updatePad(); return; }
    _pending = { r: r, c: c, val: val };
    updatePad();
    drawFrame();
    window.makeGameMove({ type: 'fill', row: r, col: c, val: val });
  };

  window._sudokuClear = function () {
    _selected = null;
    _pending = null;
    updatePad();
    drawFrame();
  };

  window._sudokuHint = function () {
    var state = window._suState;
    if (!state || state.winner !== null || state.eliminated) return;
    if (state.hints <= 0) return;
    window.makeGameMove({ type: 'hint' });
  };

  window.gameRenderers.set('sudoku', {
    init: function (container) {
      injectStylesOnce('suStyles', STYLES);
      _container = container;
      container.innerHTML = '<div class="su"><aside class="su-side" id="suLeft"></aside><div class="su-main">'
        + '<div class="su-wrap">'
          + '<div class="su-status" id="suStatus"></div>'
          + '<div class="su-timer" id="suTimer"></div>'
          + '<div class="su-lives" id="suLives"></div>'
          + '<div class="su-board-wrap" id="suBoardWrap"></div>'
          + '<div class="su-controls">'
            + '<button class="su-hint" id="suHint" onclick="window._sudokuHint()">'
              + t('sudoku_hint', 'Hint') + ' <span class="su-hint-badge" id="suHintBadge">×3</span>'
            + '</button>'
          + '</div>'
          + '<div class="su-pad" id="suPad">'
            + '<button class="su-num" data-v="1" onclick="window._sudokuFill(1)">1</button>'
            + '<button class="su-num" data-v="2" onclick="window._sudokuFill(2)">2</button>'
            + '<button class="su-num" data-v="3" onclick="window._sudokuFill(3)">3</button>'
            + '<button class="su-num" data-v="4" onclick="window._sudokuFill(4)">4</button>'
            + '<button class="su-num" data-v="5" onclick="window._sudokuFill(5)">5</button>'
            + '<button class="su-num" data-v="6" onclick="window._sudokuFill(6)">6</button>'
            + '<button class="su-num" data-v="7" onclick="window._sudokuFill(7)">7</button>'
            + '<button class="su-num" data-v="8" onclick="window._sudokuFill(8)">8</button>'
            + '<button class="su-num" data-v="9" onclick="window._sudokuFill(9)">9</button>'
            + '<button class="su-num su-num-clear" onclick="window._sudokuClear()" style="grid-column:1/-1;">' + t('sudoku_clear', 'Clear') + '</button>'
          + '</div>'
        + '</div></div><aside class="su-side" id="suRight"></aside></div>';

      canvas = document.createElement('canvas');
      canvas.id = 'suCanvas';
      document.getElementById('suBoardWrap').appendChild(canvas);
      ctx = canvas.getContext('2d', { preserveDrawingBuffer: true });

      _selected = null;
      _pending = null;
      _flash = null;
      _timerEnd = 0;
      if (_timerRaf) { clearInterval(_timerRaf); _timerRaf = null; }

      computeLayout();

      if (!_inited) {
        _inited = true;
        window.addEventListener('resize', function () { computeLayout(); drawFrame(); });
        window.addEventListener('scroll', function () { drawFrame(); }, { passive: true });
      }

      // Tap a blank cell to select it.
      canvas.addEventListener('click', function (e) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var c = Math.floor(x / _layout.cell);
        var r = Math.floor(y / _layout.cell);
        if (r < 0 || r >= N || c < 0 || c >= N) return;
        window._sudokuSelect(r, c);
      });

      // Surface a rejected fill as a red flash on the pending cell.
      window._gameErrorHandler = function () {
        if (_pending) {
          startFlash(_pending.r, _pending.c);
          _pending = null;
          updatePad();
        }
      };
    },

    render: function (state, container, playerIndex, winner) {
      window._suState = state;
      _playerIndex = playerIndex;
      if (!canvas) return;

      // A correct fill arrives as a state update: clear any pending attempt there.
      if (_pending && state.board[_pending.r][_pending.c].mineFill) {
        _pending = null;
        _selected = null;
        updatePad();
      }

      if (!ctx) ctx = canvas.getContext('2d');
      updateSides(state);
      computeLayout();
      updateStatus(state, winner);
      updateLives(state);
      updateHintBtn(state);

      // Timer: start on first render, freeze on game over
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

      drawFrame();
    },
  });
})();
