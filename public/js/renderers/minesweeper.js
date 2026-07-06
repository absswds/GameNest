// public/js/renderers/minesweeper.js
// 扫雷 — Multiplayer speed race renderer
// 左键/点击 = 翻格 | 右键/长按 = 标旗 (desktop + mobile)
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var _playerIndex = 0;
  var _longPressTimer = null;
  var _touchMoved = false;
  var _preventNextClick = false;

  var STYLES = '' +
    // === Layout ===
    '.ms-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;}' +
    '.ms-status{text-align:center;font-size:15px;font-weight:700;min-height:22px;letter-spacing:.5px;}' +
    '.ms-grid-wrap{display:flex;justify-content:center;overflow-x:auto;max-width:100%;padding:4px;}' +

    // === Grid — industrial dark aesthetic ===
    '.ms-grid{display:inline-grid;gap:3px;background:linear-gradient(145deg,#1a1d23,#252830);border-radius:14px;padding:6px;touch-action:manipulation;box-shadow:0 4px 20px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.04);}' +

    // === Cells ===
    '.ms-cell{width:34px;height:34px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;' +
      'background:linear-gradient(145deg,#3a3f4b,#2c313a);' +
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 2px 4px rgba(0,0,0,.3);' +
      'color:#a0a8b8;transition:transform .1s,box-shadow .15s;}' +
    '.ms-cell:active:not(.revealed):not(.flagged){transform:scale(.92);}' +

    // Revealed safe cell
    '.ms-cell.revealed{background:linear-gradient(145deg,#1e2229,#252a33);box-shadow:inset 0 2px 4px rgba(0,0,0,.4);cursor:default;}' +

    // Mine cell
    '.ms-cell.mine.revealed{background:linear-gradient(145deg,#4a1525,#3d101e);box-shadow:inset 0 2px 8px rgba(180,40,40,.3);}' +
    '.ms-cell.mine.exploded{background:linear-gradient(145deg,#8b1a1a,#6b1010);box-shadow:0 0 16px rgba(255,60,60,.5),inset 0 2px 4px rgba(0,0,0,.4);animation:msExplode .4s ease;}' +

    // Flagged cell
    '.ms-cell.flagged{background:linear-gradient(145deg,#4a4520,#3d3818);box-shadow:inset 0 1px 0 rgba(255,220,80,.15),0 2px 4px rgba(0,0,0,.3);}' +

    // Adjacent number colors — neon on dark
    '.ms-adj-1{color:#5dade2;} .ms-adj-2{color:#58d68d;} .ms-adj-3{color:#f7dc6f;}' +
    '.ms-adj-4{color:#af7ac5;} .ms-adj-5{color:#f0b27a;} .ms-adj-6{color:#48c9b0;}' +
    '.ms-adj-7{color:#d5dbdb;} .ms-adj-8{color:#85929e;}' +

    // === Players bar ===
    '.ms-players{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}' +
    '.ms-player{padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;' +
      'background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-sm);' +
      'display:flex;align-items:center;gap:6px;transition:all .3s;}' +
    '.ms-player.dead{opacity:.35;text-decoration:line-through;background:var(--bg);}' +
    '.ms-player.self{border-color:var(--accent);box-shadow:0 0 0 2px rgba(200,164,92,.2);}' +
    '.ms-player .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}' +
    '.ms-player .dot.alive{background:#58d68d;box-shadow:0 0 6px rgba(88,214,141,.4);}' +
    '.ms-player .dot.dead{background:#e74c3c;}' +

    // === Legend ===
    '.ms-legend{font-size:11px;color:var(--text-muted);text-align:center;padding:2px 12px;line-height:1.6;' +
      'display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}' +
    '.ms-legend span{white-space:nowrap;}' +

    // === Animations ===
    '@keyframes msExplode{0%{transform:scale(1);}30%{transform:scale(1.25);}100%{transform:scale(1);}}' +
    '@keyframes msRevealPop{0%{transform:scale(.85);opacity:.5;}60%{transform:scale(1.08);}100%{transform:scale(1);opacity:1;}}' +

    // === Responsive ===
    '@media(max-width:400px){.ms-cell{width:30px;height:30px;font-size:12px;}.ms-grid{padding:4px;gap:2px;}}' +
    '@media(max-width:340px){.ms-cell{width:26px;height:26px;font-size:10px;border-radius:3px;}}' +
    '@media(min-width:768px){.ms-cell{width:44px;height:44px;font-size:18px;}.ms-grid{gap:4px;}}';

  function colorClass(n) { return n >= 1 && n <= 8 ? ' ms-adj-' + n : ''; }

  function renderGrid(board, rows, cols) {
    var html = '<div class="ms-grid" style="grid-template-columns:repeat(' + cols + ',1fr);" id="msGrid">';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = board[r][c];
        var cls = 'ms-cell';
        var txt = '';
        if (cell.revealed) {
          cls += ' revealed';
          if (cell.mine) {
            cls += ' mine' + (cell.exploded ? ' exploded' : '');
            txt = '💣';
          } else if (cell.adjacent > 0) {
            txt = cell.adjacent;
            cls += colorClass(cell.adjacent);
          }
        } else if (cell.flagged) {
          cls += ' flagged';
          txt = '🚩';
        }
        html += '<div class="' + cls + '" data-r="' + r + '" data-c="' + c + '">' + txt + '</div>';
      }
    }
    html += '</div>';
    return html;
  }

  function attachCellEvents(cell, alive, playerIndex) {
    var newCell = cell.cloneNode(true);
    cell.parentNode.replaceChild(newCell, cell);

    // Click = reveal
    newCell.addEventListener('click', function(e) {
      e.preventDefault();
      if (_preventNextClick) { _preventNextClick = false; return; }
      if (alive[playerIndex] === false) return;
      window.makeGameMove({ action: 'reveal', row: parseInt(this.dataset.r), col: parseInt(this.dataset.c) });
    });

    // Right-click = flag (desktop)
    newCell.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      if (alive[playerIndex] === false) return;
      window.makeGameMove({ action: 'flag', row: parseInt(this.dataset.r), col: parseInt(this.dataset.c) });
    });

    // Touch long-press = flag (mobile)
    newCell.addEventListener('touchstart', function(e) {
      _touchMoved = false;
      _preventNextClick = false;
      var self = this;
      _longPressTimer = setTimeout(function() {
        if (!_touchMoved) {
          _preventNextClick = true;
          if (alive[playerIndex] === false) return;
          window.makeGameMove({ action: 'flag', row: parseInt(self.dataset.r), col: parseInt(self.dataset.c) });
          if (navigator.vibrate) navigator.vibrate(15);
        }
      }, 500);
    }, { passive: true });

    newCell.addEventListener('touchmove', function() {
      _touchMoved = true;
      if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
    });

    newCell.addEventListener('touchend', function() {
      if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
    });
    newCell.addEventListener('touchcancel', function() {
      if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
    });
  }

  window.gameRenderers.set('minesweeper', {
    init: function(container) {
      injectStylesOnce('msStyles', STYLES);
      container.innerHTML = '' +
        '<div class="ms-wrap">' +
          '<div class="ms-players" id="msPlayers"></div>' +
          '<div class="ms-status" id="msStatus"></div>' +
          '<div class="ms-grid-wrap" id="msGridWrap"></div>' +
          '<div class="ms-legend" id="msLegend">' +
            '<span>' + _t('ms_click_reveal') + '</span><span>' + _t('ms_right_click_flag') + '</span>' +
            '<span>' + _t('ms_tap_reveal') + '</span><span>' + _t('ms_longpress_flag') + '</span>' +
          '</div>' +
        '</div>';
    },
    render: function(state, container, playerIndex, winner) {
      _playerIndex = playerIndex;
      var alive = state.alive || [];
      var revealed = state.cellsRevealed || [];
      var safeCells = state.safeCells || 85;

      // Players bar
      var colors = ['#5dade2','#f7dc6f','#58d68d','#af7ac5','#f0b27a','#48c9b0'];
      var playersHtml = '';
      for (var i = 0; i < alive.length; i++) {
        var dotCls = alive[i] ? 'alive' : 'dead';
        var deadCls = !alive[i] ? ' dead' : '';
        var selfCls = i === playerIndex ? ' self' : '';
        var badgeClr = colors[i % colors.length];
        var cleared = revealed[i] || 0;
        playersHtml += '<div class="ms-player' + deadCls + selfCls + '">' +
          '<span class="dot ' + dotCls + '" style="background:' + badgeClr + (alive[i] ? '' : ';box-shadow:none') + '"></span>' +
          'P' + (i + 1) + ' <span style="font-size:11px;opacity:.7;">🔍' + cleared + '</span>' +
          '</div>';
      }
      var playersEl = document.getElementById('msPlayers');
      if (playersEl) playersEl.innerHTML = playersHtml;

      // Status
      var statusEl = document.getElementById('msStatus');
      if (statusEl) {
        if (winner !== null && winner !== undefined && winner >= 0) {
          statusEl.innerHTML = _tf('ms_player_wins', winner + 1);
          statusEl.style.color = '#58d68d';
        } else if (winner === -1) {
          statusEl.textContent = _t('ms_draw');
          statusEl.style.color = '#e74c3c';
        } else if (alive[playerIndex] === false) {
          statusEl.textContent = _t('ms_exploded');
          statusEl.style.color = '#e74c3c';
        } else {
          var aliveCount = alive.filter(function(v) { return v; }).length;
          var pct = safeCells > 0 ? Math.round((state.revealedCount || 0) / safeCells * 100) : 0;
          statusEl.textContent = _tf('ms_safe_progress', (state.revealedCount || 0), safeCells, aliveCount);
          statusEl.style.color = '';
        }
      }

      // Grid
      if (state.board) {
        var wrap = document.getElementById('msGridWrap');
        if (wrap) wrap.innerHTML = renderGrid(state.board, state.rows, state.cols);
      }

      // Attach events per cell
      var cells = document.querySelectorAll('#msGrid .ms-cell');
      for (var i = 0; i < cells.length; i++) {
        attachCellEvents(cells[i], alive, playerIndex);
      }
    }
  });
})();
