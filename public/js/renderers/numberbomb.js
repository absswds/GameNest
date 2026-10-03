// public/js/renderers/numberbomb.js
// 数字炸弹 — Guess the number, avoid the bomb!
// Aesthetic: bold arcade/retro game feel, big numbers, dark card, neon glow
(function() {
  var SIDE_W = 220; // side panel width on wide screens
  window.gameRenderers = window.gameRenderers || new Map();

  function esc(v) { return String(v).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pname(i, me) {
    if (i === me) return _t('nb_side_you');
    var pl = window._players && window._players[i];
    return pl && pl.name ? pl.name : 'P' + (i + 1);
  }

  // Wide screens only: range + turn on the left, history, players and rules on the right
  function renderSides(state, playerIndex, winner) {
    var left = document.getElementById('nbLeft'), right = document.getElementById('nbRight');
    if (!left || !right) return;
    var low = state.low, high = state.high, size = high - low + 1;
    var over = winner !== null && winner !== undefined;
    var turn = over ? '—' : (state.currentPlayer === playerIndex ? _t('nb_side_you_turn') : esc(pname(state.currentPlayer, playerIndex)));
    left.innerHTML =
      '<div class="nb-scard"><div class="nb-slabel">' + _t('nb_side_range') + '<span>' + _tf('nb_side_round', state.round || 1) + '</span></div>' +
        '<div class="nb-sbig' + (low === high ? ' danger' : '') + '">' + (low === high ? low : low + ' ~ ' + high) + '</div>' +
        '<div class="nb-sbar"><i style="left:' + (low - 1) + '%;width:' + size + '%"></i></div>' +
        '<div class="nb-sticks"><span>1</span><span>100</span></div></div>' +
      '<div class="nb-scard"><div class="nb-slabel">' + _t('nb_side_shrunk') + '<span>' + (100 - size) + '%</span></div>' +
        '<div>' + _tf('nb_side_left', size) + '</div></div>' +
      '<div class="nb-scard"><div class="nb-slabel">' + _t('nb_side_turn') + '</div>' +
        '<div class="nb-sturn' + (!over && state.currentPlayer === playerIndex ? ' me' : '') + '">' + turn + '</div></div>';

    var hist = '';
    var msgs = state.messages || [];
    for (var m = msgs.length - 1; m >= 0; m--) {
      var t = esc(msgs[m].text).replace(/↓/g, '<span class="dir down">↓</span>').replace(/↑/g, '<span class="dir up">↑</span>');
      hist += '<div class="nb-hrow' + (msgs[m].bombHit ? ' hit' : '') + '">' + t + '</div>';
    }
    var plist = '';
    for (var i = 0; i < (state.lives || []).length; i++) {
      var dead = state.lives[i] <= 0, hearts = '';
      for (var h = 0; h < state.lives[i]; h++) hearts += '❤️';
      plist += '<div class="nb-prow' + (i === playerIndex ? ' me' : '') + (dead ? ' out' : '') + (!over && !dead && state.currentPlayer === i ? ' turn' : '') + '">' +
        '<span class="nb-pwho">' + esc(pname(i, playerIndex)) + '</span><span>' + (dead ? '💀' : hearts) + '</span></div>';
    }
    right.innerHTML =
      '<div class="nb-scard"><div class="nb-slabel">' + _t('nb_side_history') + '</div>' + (hist || '<div class="nb-log-empty">' + _t('nb_waiting_first_guess') + '</div>') + '</div>' +
      '<div class="nb-scard"><div class="nb-slabel">' + _t('nb_side_players') + '</div>' + plist + '</div>' +
      '<div class="nb-scard nb-tips"><div class="nb-slabel">' + _t('nb_side_tips') + '</div><ol>' +
        '<li>' + _t('nb_side_tip_1') + '</li><li>' + _t('nb_side_tip_2') + '</li><li>' + _t('nb_side_tip_3') + '</li><li>' + _t('nb_side_tip_4') + '</li></ol></div>';
  }

  window.gameRenderers.set('numberbomb', {
    init: function(container) {
      container.innerHTML = '' +
        '<div class="nb-wrap" id="nbWrap"><aside class="nb-side" id="nbLeft"></aside>' +
        '<div class="nb-shell">' +
          // Top: players lives row
          '<div class="nb-lives" id="nbLives"></div>' +
          // Main: bomb icon + range display
          '<div class="nb-card">' +
            '<div class="nb-icon" id="nbBombIcon">💣</div>' +
            '<div class="nb-range" id="nbRange">1 ~ 100</div>' +
            // Input row
            '<div class="nb-input-row">' +
              '<input class="nb-input" type="text" inputmode="numeric" pattern="[0-9]*" id="nbInput" placeholder="?" maxlength="3" autocomplete="off">' +
            '</div>' +
            // Number pad
            '<div class="nb-pad">' +
              '<button class="nb-key" onclick="window._nbPad(1)">1</button>' +
              '<button class="nb-key" onclick="window._nbPad(2)">2</button>' +
              '<button class="nb-key" onclick="window._nbPad(3)">3</button>' +
              '<button class="nb-key" onclick="window._nbPad(4)">4</button>' +
              '<button class="nb-key" onclick="window._nbPad(5)">5</button>' +
              '<button class="nb-key" onclick="window._nbPad(6)">6</button>' +
              '<button class="nb-key" onclick="window._nbPad(7)">7</button>' +
              '<button class="nb-key" onclick="window._nbPad(8)">8</button>' +
              '<button class="nb-key" onclick="window._nbPad(9)">9</button>' +
              '<button class="nb-key nb-key-action" onclick="window._nbClear()">⌫</button>' +
              '<button class="nb-key" onclick="window._nbPad(0)">0</button>' +
              '<button class="nb-key nb-key-fire" onclick="window._nbGuess()">' + _t('nb_guess') + '</button>' +
            '</div>' +
          '</div>' +
          // Status line
          '<div class="nb-status" id="nbStatus"></div>' +
          // Message log
          '<div class="nb-log" id="nbLog"><div class="nb-log-empty">' + _t('nb_waiting_first_guess') + '</div></div>' +
          // Bomb hit flash overlay
          '<div class="nb-boom" id="nbBoom"><div class="nb-boom-text">💥</div></div>' +
        '</div><aside class="nb-side" id="nbRight"></aside></div>';

      injectStylesOnce('nb-styles', '' +
          // Wide layout: side panels
          '.nb-wrap{display:flex;justify-content:center;align-items:flex-start;gap:24px;width:100%;}' +
          '.nb-side{display:none;width:' + SIDE_W + 'px;flex:none;flex-direction:column;gap:12px;}' +
          '.nb-wrap.wide .nb-side{display:flex;}' +
          '.nb-wrap.wide .nb-shell{flex:none;width:360px;margin:0;}' +
          '.nb-wrap.wide .nb-lives,.nb-wrap.wide .nb-log{display:none;}' +
          '.nb-scard{padding:12px 14px;border-radius:var(--radius-sm);background:var(--bg);font-size:13px;}' +
          '.nb-slabel{display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;}' +
          '.nb-slabel span{font-weight:400;white-space:nowrap;}' +
          '.nb-sbig{font-size:32px;font-weight:900;font-variant-numeric:tabular-nums;font-family:SF Mono,Consolas,monospace;}' +
          '.nb-sbig.danger{color:#e74c3c;}' +
          '.nb-sbar{position:relative;height:10px;border-radius:5px;background:var(--surface);margin:10px 0 6px;overflow:hidden;}' +
          '.nb-sbar i{position:absolute;top:0;bottom:0;background:var(--accent);border-radius:5px;transition:left .4s,width .4s;}' +
          '.nb-sticks{display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);}' +
          '.nb-sturn{font-weight:700;}' +
          '.nb-sturn.me{color:var(--accent);}' +
          '.nb-hrow{padding:3px 0;line-height:1.5;word-break:break-word;}' +
          '.nb-hrow + .nb-hrow{border-top:1px solid var(--border);}' +
          '.nb-hrow.hit{color:#e74c3c;}' +
          '.nb-hrow .dir{font-weight:700;}' +
          '.nb-hrow .dir.up{color:#58d68d;}' +
          '.nb-hrow .dir.down{color:#e74c3c;}' +
          '.nb-prow{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;}' +
          '.nb-prow.me{background:var(--surface);font-weight:600;}' +
          '.nb-prow.turn{box-shadow:inset 3px 0 0 var(--accent);}' +
          '.nb-prow.out{color:var(--text-muted);}' +
          '.nb-pwho{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
          '.nb-tips ol{margin:0;padding-left:18px;display:grid;gap:6px;color:var(--text-muted);line-height:1.5;}' +
          // Shell
          '.nb-shell{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:360px;margin:0 auto;}' +
          // Lives row — pill badges
          '.nb-lives{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:36px;}' +
          '.nb-life-pill{padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;' +
            'background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-sm);' +
            'display:flex;align-items:center;gap:4px;transition:all .25s;}' +
          '.nb-life-pill.dead{opacity:.35;background:var(--bg);}' +
          '.nb-life-pill.dead .nb-life-hearts{text-decoration:line-through;}' +
          '.nb-life-pill.self{border-color:var(--accent);box-shadow:0 0 0 2px rgba(200,164,92,.2);}' +
          '.nb-life-pill.hit{animation:nbPillHit .6s ease;}' +
          // Card
          '.nb-card{background:linear-gradient(160deg,#1e1e24,#252830);border-radius:20px;padding:24px 20px 20px;' +
            'width:100%;display:flex;flex-direction:column;align-items:center;gap:14px;' +
            'box-shadow:0 6px 24px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.04);}' +
          // Icon — big emoji
          '.nb-icon{font-size:56px;line-height:1;transition:transform .3s;filter:drop-shadow(0 4px 8px rgba(0,0,0,.4));}' +
          '.nb-icon.win{animation:nbIconBounce .5s ease;}' +
          // Range display
          '.nb-range{font-size:28px;font-weight:900;color:#fff;letter-spacing:2px;' +
            'text-shadow:0 2px 8px rgba(200,164,92,.3);font-variant-numeric:tabular-nums;font-family:SF Mono,Consolas,monospace;}' +
          // Input
          '.nb-input-row{width:100%;}' +
          '.nb-input{width:100%;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.1);border-radius:14px;' +
            'padding:14px;font-size:24px;font-weight:900;color:#fff;text-align:center;outline:none;' +
            'transition:border-color .2s,box-shadow .2s;font-family:SF Mono,Consolas,monospace;}' +
          '.nb-input:focus{border-color:var(--accent);box-shadow:0 0 0 4px rgba(200,164,92,.15);}' +
          '.nb-input::placeholder{color:rgba(255,255,255,.15);font-size:20px;}' +
          // Number pad
          '.nb-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;max-width:240px;}' +
          '.nb-key{width:100%;aspect-ratio:1.2;border-radius:14px;border:none;' +
            'background:rgba(255,255,255,.08);color:#d5dbdb;font-size:22px;font-weight:800;' +
            'cursor:pointer;transition:background .12s,transform .1s;' +
            'display:flex;align-items:center;justify-content:center;' +
            'box-shadow:0 2px 6px rgba(0,0,0,.2);}' +
          '.nb-key:active{transform:scale(.9);background:rgba(255,255,255,.14);}' +
          '.nb-key-action{background:rgba(255,255,255,.04);font-size:18px;}' +
          '.nb-key-fire{background:linear-gradient(135deg,#c8a45c,#b8944c);color:#fff;font-size:17px;' +
            'box-shadow:0 2px 10px rgba(200,164,92,.3);}' +
          '.nb-key-fire:active{background:linear-gradient(135deg,#b8944c,#a07d3e);}' +
          // Status
          '.nb-status{text-align:center;font-size:15px;font-weight:700;min-height:22px;color:var(--accent);}' +
          '.nb-status.danger{color:#e74c3c;}' +
          '.nb-status.win{color:#58d68d;}' +
          '.nb-status.muted{color:var(--text-muted);}' +
          // Log
          '.nb-log{width:100%;max-height:140px;overflow-y:auto;font-size:13px;line-height:1.9;' +
            'padding:8px 12px;background:var(--surface);border-radius:14px;border:1px solid var(--border);min-height:44px;}' +
          '.nb-log-empty{color:var(--text-muted);text-align:center;padding:8px 0;}' +
          '.nb-log-row{padding:1px 0;}' +
          '.nb-log-row.hit{background:rgba(231,76,60,.08);border-radius:4px;padding:2px 6px;margin:2px -6px;animation:nbLogHit .6s ease;}' +
          '.nb-log-row .dir{font-weight:700;}' +
          '.nb-log-row .dir.up{color:#58d68d;}' +
          '.nb-log-row .dir.down{color:#e74c3c;}' +
          // Boom overlay
          '.nb-boom{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:300;pointer-events:none;}' +
          '.nb-boom-text{font-size:120px;animation:boomPop .7s ease forwards;filter:drop-shadow(0 0 40px rgba(255,80,40,.6));}' +
          // Animations
          '@keyframes boomPop{0%{transform:scale(.2);opacity:1;}40%{transform:scale(1.3);opacity:1;}100%{transform:scale(1.8);opacity:0;}}' +
          '@keyframes nbPillHit{0%{transform:scale(1);background:#ffe0e0;}30%{transform:scale(1.08);}100%{transform:scale(1);}}' +
          '@keyframes nbLogHit{0%{background:rgba(231,76,60,.25);}100%{background:rgba(231,76,60,.06);}}' +
          '@keyframes nbIconBounce{0%{transform:scale(1);}30%{transform:scale(1.2) rotate(-10deg);}60%{transform:scale(.9);}100%{transform:scale(1);}}' +
          '@media(max-width:400px){.nb-card{padding:18px 14px 16px;}.nb-range{font-size:24px;}.nb-key{font-size:19px;}.nb-icon{font-size:44px;}}');

      function fit() {
        var wrap = document.getElementById('nbWrap');
        if (!wrap) return;
        var f = window.boardFit ? window.boardFit(container) : { w: window.innerWidth - 32 };
        wrap.classList.toggle('wide', f.w >= 360 + SIDE_W * 2 + 48);
      }
      fit();
      if (window._nbResize) window.removeEventListener('resize', window._nbResize);
      window._nbResize = fit;
      window.addEventListener('resize', window._nbResize);

      var input = document.getElementById('nbInput');
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') window._nbGuess();
      });
      input.focus();
    },
    render: function(state, container, playerIndex, winner) {
      // Lives
      var livesEl = document.getElementById('nbLives');
      if (livesEl && state.lives) {
        var html = '';
        for (var i = 0; i < state.lives.length; i++) {
          var hearts = '';
          for (var h = 0; h < state.lives[i]; h++) hearts += '❤️';
          var isDead = state.lives[i] <= 0;
          var deadCls = isDead ? ' dead' : '';
          var selfCls = i === playerIndex ? ' self' : '';
          var hitCls = (state.lastGuess && state.lastGuess.hit && state.lastGuess.player === i) ? ' hit' : '';
          html += '<div class="nb-life-pill' + deadCls + selfCls + hitCls + '">' +
            '<span>P' + (i + 1) + '</span>' +
            '<span class="nb-life-hearts">' + (isDead ? '💀' : hearts) + '</span>' +
            '</div>';
        }
        livesEl.innerHTML = html;
      }

      // Range
      var rangeEl = document.getElementById('nbRange');
      if (rangeEl) {
        if (state.low === state.high) {
          rangeEl.textContent = state.low;
          rangeEl.style.color = '#e74c3c';
        } else {
          rangeEl.textContent = state.low + ' ~ ' + state.high;
          rangeEl.style.color = '#fff';
        }
      }

      // Message log
      var logEl = document.getElementById('nbLog');
      if (logEl && state.messages) {
        var logHtml = '';
        for (var m = 0; m < state.messages.length; m++) {
          var msg = state.messages[m];
          var rowCls = msg.bombHit ? ' hit' : '';
          // Parse direction arrows for styling
          var txt = msg.text;
          txt = txt.replace(/↓/g, '<span class="dir down">↓</span>');
          txt = txt.replace(/↑/g, '<span class="dir up">↑</span>');
          logHtml += '<div class="nb-log-row' + rowCls + '">' + txt + '</div>';
        }
        logEl.innerHTML = logHtml || '<div class="nb-log-empty">' + _t('nb_waiting_first_guess') + '</div>';
        logEl.scrollTop = logEl.scrollHeight;
      }

      // Status
      var statusEl = document.getElementById('nbStatus');
      if (statusEl) {
        statusEl.className = 'nb-status';
        if (winner !== null && winner !== undefined) {
          if (winner >= 0) {
            statusEl.textContent = '🏆 ' + (winner === playerIndex ? _t('nb_you_win') : _tf('nb_player_wins', winner + 1));
            statusEl.classList.add('win');
          } else if (winner === -1) {
            statusEl.textContent = _t('nb_draw');
            statusEl.classList.add('danger');
          }
        } else if (state.lives && state.lives[playerIndex] <= 0) {
          statusEl.textContent = _t('nb_eliminated');
          statusEl.classList.add('muted');
        } else if (state.currentPlayer === playerIndex) {
          if (state.low === state.high) {
            statusEl.textContent = _tf('nb_forced_guess', state.low);
            statusEl.classList.add('danger');
          } else {
            statusEl.textContent = _t('nb_your_turn');
          }
        } else {
          statusEl.textContent = _tf('nb_waiting_player', state.currentPlayer + 1);
          statusEl.classList.add('muted');
        }
      }

      // Bomb icon — swap on game end
      var iconEl = document.getElementById('nbBombIcon');
      if (iconEl && winner !== null && winner !== undefined) {
        iconEl.textContent = winner >= 0 ? '🎉' : '💀';
        iconEl.classList.add('win');
      }

      renderSides(state, playerIndex, winner);

      // Boom overlay
      if (state.lastGuess && state.lastGuess.hit) {
        var boom = document.getElementById('nbBoom');
        if (boom) {
          boom.style.display = 'flex';
          setTimeout(function() { boom.style.display = 'none'; }, 750);
        }
      }
    }
  });

  window._nbPad = function(n) {
    var input = document.getElementById('nbInput');
    if (!input) return;
    if (input.value.length < 3) input.value += n;
  };
  window._nbClear = function() {
    var input = document.getElementById('nbInput');
    if (!input) return;
    input.value = input.value.slice(0, -1);
  };
  window._nbGuess = function() {
    var input = document.getElementById('nbInput');
    if (!input) return;
    var v = parseInt(input.value);
    if (isNaN(v)) {
      var el = document.getElementById('nbStatus');
      if (el) { el.textContent = _t('nb_enter_number'); el.className = 'nb-status danger'; setTimeout(function() { el.className = 'nb-status'; }, 1500); }
      return;
    }
    window.makeGameMove({ guess: v });
    input.value = '';
  };
})();
