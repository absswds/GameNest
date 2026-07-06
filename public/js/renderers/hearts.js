// public/js/renderers/hearts.js
// Hearts (红心大战) — 4-player trick-taking card game renderer
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var SUIT_SYMBOLS = { s: '♠', h: '♥', c: '♣', d: '♦' };
  var SUIT_COLORS = { s: '#1a1a2e', h: '#c0392b', c: '#1a1a2e', d: '#c0392b' };

  var STYLES = '' +
    '.ht-wrap{display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;max-width:480px;margin:0 auto;}' +
    '.ht-top{display:flex;gap:16px;justify-content:center;width:100%;}' +
    '.ht-scores{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:100%;}' +
    '.ht-score-card{background:linear-gradient(160deg,#2c2c30,#383840);border-radius:10px;padding:6px 12px;text-align:center;' +
      'min-width:60px;border:1px solid rgba(255,255,255,.06);box-shadow:0 2px 6px rgba(0,0,0,.2);}' +
    '.ht-score-card.me{border-color:var(--accent);box-shadow:0 0 0 2px rgba(200,164,92,.15);}' +
    '.ht-score-card .pname{font-size:11px;font-weight:700;color:rgba(255,255,255,.6);}' +
    '.ht-score-card .ptotal{font-size:18px;font-weight:900;color:rgba(255,255,255,.8);}' +
    '.ht-score-card .pround{font-size:11px;color:rgba(255,255,255,.4);}' +
    '.ht-score-card.me .ptotal{color:var(--accent);}' +
    '.ht-status{text-align:center;font-size:14px;font-weight:700;min-height:20px;letter-spacing:.3px;color:var(--text);}' +
    '.ht-direction{font-size:12px;color:var(--text-muted);margin-bottom:2px;}' +

    // === Trick area ===
    '.ht-trick-area{position:relative;width:100%;max-width:320px;height:200px;margin:4px 0;}' +
    '.ht-trick-slot{position:absolute;width:70px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;}' +
    '.ht-trick-slot.top{top:0;left:50%;transform:translateX(-50%);}' +
    '.ht-trick-slot.left{top:50%;left:0;transform:translateY(-50%);}' +
    '.ht-trick-slot.right{top:50%;right:0;transform:translateY(-50%);}' +
    '.ht-trick-slot.bottom{bottom:0;left:50%;transform:translateX(-50%);}' +
    '.ht-trick-card{width:60px;height:86px;border-radius:8px;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:linear-gradient(160deg,#fff,#f0ede8);box-shadow:0 3px 10px rgba(0,0,0,.2);' +
      'animation:htCardIn .3s ease;}' +
    '.ht-trick-card .rank{font-size:17px;font-weight:700;line-height:1;}' +
    '.ht-trick-card .suit{font-size:14px;line-height:1;}' +
    '.ht-trick-empty{width:60px;height:86px;border-radius:8px;border:2px dashed rgba(255,255,255,.1);}' +
    '.ht-trick-label{font-size:10px;color:rgba(255,255,255,.4);margin-top:2px;white-space:nowrap;}' +

    // === Last trick ===
    '.ht-last-trick{font-size:11px;color:var(--text-muted);text-align:center;min-height:16px;}' +

    // === My hand ===
    '.ht-hand-wrap{width:100%;padding:4px 0;}' +
    '.ht-hand-label{font-size:12px;font-weight:700;color:var(--text-muted);text-align:center;margin-bottom:4px;letter-spacing:1px;}' +
    '.ht-my-hand{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;min-height:40px;}' +

    // === Cards ===
    '.ht-card{width:54px;height:78px;border-radius:8px;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;cursor:pointer;transition:transform .12s,box-shadow .15s,opacity .2s,margin-top .15s;' +
      'position:relative;flex-shrink:0;' +
      'background:linear-gradient(160deg,#fff,#f0ede8);color:#1a1a1a;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.12),inset 0 0 0 1px rgba(0,0,0,.04);}' +
    '.ht-card::after{content:"";position:absolute;inset:3px;border:1px solid rgba(0,0,0,.06);border-radius:5px;pointer-events:none;}' +
    '.ht-card:hover{transform:translateY(-4px);box-shadow:0 8px 16px rgba(0,0,0,.2);}' +
    '.ht-card.selected{margin-top:-12px;box-shadow:0 0 0 2px var(--accent),0 8px 20px rgba(0,0,0,.25);}' +
    '.ht-card.illegal{opacity:.35;cursor:not-allowed;}' +
    '.ht-card.illegal:hover{transform:none;box-shadow:0 2px 8px rgba(0,0,0,.12);}' +
    '.ht-card .rank{font-size:16px;font-weight:700;line-height:1;}' +
    '.ht-card .suit{font-size:13px;line-height:1;}' +
    '.ht-card .corner{position:absolute;top:3px;left:4px;font-size:9px;display:flex;flex-direction:column;align-items:center;line-height:1;}' +

    // === Pass confirm ===
    '.ht-pass-bar{display:flex;gap:8px;justify-content:center;margin:6px 0;}' +
    '.ht-pass-btn{padding:8px 24px;border:none;border-radius:20px;font-size:14px;font-weight:700;cursor:pointer;' +
      'background:var(--accent);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);transition:opacity .2s;}' +
    '.ht-pass-btn:disabled{opacity:.4;cursor:not-allowed;}' +

    // === Game over ===
    '.ht-over{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:50;display:flex;align-items:center;justify-content:center;}' +
    '.ht-over-box{background:var(--surface);border-radius:16px;padding:28px 36px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.4);}' +
    '.ht-over-title{font-size:28px;font-weight:900;margin-bottom:8px;}' +
    '.ht-over-scores{font-size:15px;line-height:2;margin-bottom:16px;}' +

    // === Animations ===
    '@keyframes htCardIn{0%{transform:scale(.7) translateY(10px);opacity:0;}100%{transform:scale(1) translateY(0);opacity:1;}}' +

    // === Responsive ===
    '@media(max-width:400px){.ht-card{width:44px;height:66px;}.ht-card .rank{font-size:14px;}.ht-card .suit{font-size:11px;}' +
    '.ht-trick-card{width:50px;height:72px;}.ht-trick-card .rank{font-size:14px;}.ht-trick-slot{width:56px;height:80px;}}';

  var container = null;
  var selectedCards = [];
  var prevState = null;

  function injectStyles() {
    if (document.getElementById('ht-styles')) return;
    var s = document.createElement('style');
    s.id = 'ht-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function renderCardHtml(card, extraCls) {
    var suitSym = SUIT_SYMBOLS[card.suit] || '';
    var color = SUIT_COLORS[card.suit] || '#1a1a1a';
    var cls = 'ht-card' + (extraCls || '');
    return '<div class="' + cls + '" data-id="' + card.id + '">' +
      '<div class="corner"><span>' + card.rank + '</span><span style="font-size:7px;color:' + color + '">' + suitSym + '</span></div>' +
      '<span class="rank" style="color:' + color + '">' + card.rank + '</span>' +
      '<span class="suit" style="color:' + color + '">' + suitSym + '</span>' +
      '</div>';
  }

  function renderTrickCard(trickCard) {
    if (!trickCard) return '<div class="ht-trick-empty"></div>';
    var suitSym = SUIT_SYMBOLS[trickCard.card.suit] || '';
    var color = SUIT_COLORS[trickCard.card.suit] || '#1a1a1a';
    return '<div class="ht-trick-card">' +
      '<span class="rank" style="color:' + color + '">' + trickCard.card.rank + '</span>' +
      '<span class="suit" style="color:' + color + '">' + suitSym + '</span>' +
      '</div>';
  }

  function getPassDirName(dir) {
    var map = { left: window._t('ht_pass_left'), right: window._t('ht_pass_right'), across: window._t('ht_pass_across'), none: window._t('ht_pass_none') };
    return map[dir] || dir;
  }

  function render(state, containerEl, playerIndex, winner) {
    container = containerEl;
    var s = state || {};
    var myIdx = playerIndex || 0;

    // Detect phase transition to reset selection
    if (prevState && prevState.phase !== s.phase) {
      selectedCards = [];
    }
    prevState = s;

    var html = '<div class="ht-wrap">';

    // --- Scores ---
    html += '<div class="ht-scores">';
    var players = ['P1', 'P2', 'P3', 'P4'];
    for (var i = 0; i < 4; i++) {
      var isMe = i === myIdx;
      var cls = 'ht-score-card' + (isMe ? ' me' : '');
      html += '<div class="' + cls + '">' +
        '<div class="pname">' + players[i] + (isMe ? ' ' + window._t('ht_you') : '') + '</div>' +
        '<div class="ptotal">' + ((s.scores || [0,0,0,0])[i]) + '</div>' +
        '<div class="pround">+' + ((s.roundScores || [0,0,0,0])[i]) + '</div>' +
        '</div>';
    }
    html += '</div>';

    // --- Status ---
    var statusText = '';
    if (s.phase === 'over') {
      statusText = window._t('ht_game_over');
    } else if (s.phase === 'passing') {
      var dir = getPassDirName(s.passDirection);
      statusText = window._tf('ht_round_pass', s.round || 1, dir);
    } else if (s.phase === 'playing') {
      var whose = s.currentPlayer === myIdx ? window._t('ht_your_turn_s') : window._tf('ht_waiting_player', (s.currentPlayer || 0) + 1);
      statusText = window._tf('ht_round_play', s.round || 1, whose, s.heartsBroken ? window._t('ht_hearts_broken') : '');
    }
    html += '<div class="ht-status">' + statusText + '</div>';

    // --- Trick area ---
    html += '<div class="ht-trick-area">';
    var trick = s.currentTrick || [];
    var positions = ['top', 'right', 'bottom', 'left']; // P2, P3, P4 relative to P1
    var slotMap = {};
    for (var i = 0; i < trick.length; i++) {
      var rel = ((trick[i].player - myIdx + 4) % 4);
      slotMap[rel] = trick[i];
    }
    for (var r = 0; r < 4; r++) {
      var tc = slotMap[r] || null;
      html += '<div class="ht-trick-slot ' + positions[r] + '">' +
        renderTrickCard(tc) +
        '<div class="ht-trick-label">' + (r === 0 ? window._t('ht_you') : 'P' + (((r + myIdx) % 4) + 1)) + '</div>' +
        '</div>';
    }
    html += '</div>';

    // --- Last trick ---
    if (s.lastTrick && s.lastTrick.length === 4) {
      var pts = 0;
      var ltNames = [];
      for (var i = 0; i < s.lastTrick.length; i++) {
        pts += (s.lastTrick[i].card.suit === 'h' ? 1 : (s.lastTrick[i].card.suit === 's' && s.lastTrick[i].card.rank === 'Q' ? 13 : 0));
        ltNames.push(SUIT_SYMBOLS[s.lastTrick[i].card.suit] + s.lastTrick[i].card.rank);
      }
      html += '<div class="ht-last-trick">' + window._tf('ht_last_trick', ltNames.join(' '), pts) + '</div>';
    } else {
      html += '<div class="ht-last-trick"></div>';
    }

    // --- Pass confirm ---
    if (s.phase === 'passing' && s.passDirection !== 'none' && !s.myPassCards) {
      html += '<div class="ht-pass-bar">';
      html += '<button class="ht-pass-btn" id="ht-pass-btn"' + (selectedCards.length !== 3 ? ' disabled' : '') + '>' + window._tf('ht_confirm_pass', selectedCards.length) + '</button>';
      html += '</div>';
    } else if (s.myPassCards) {
      html += '<div class="ht-pass-bar"><span style="color:var(--accent);font-size:13px;font-weight:600;">' + window._tf('ht_pass_sent', s.myPassCards.length) + '</span></div>';
    }

    // --- My hand ---
    html += '<div class="ht-hand-wrap">';
    html += '<div class="ht-hand-label">' + window._tf('ht_hand', (s.myHand || []).length) + '</div>';
    html += '<div class="ht-my-hand">';
    var hand = s.myHand || [];
    if (hand.length === 0) {
      html += '<div style="color:var(--text-muted);font-size:13px;">' + window._t('ht_no_cards') + '</div>';
    }
    for (var i = 0; i < hand.length; i++) {
      var card = hand[i];
      var extraCls = '';
      if (selectedCards.indexOf(card.id) !== -1) extraCls += ' selected';
      // Mark illegal cards during playing phase
      if (s.phase === 'playing' && s.currentPlayer === myIdx) {
        var isLegal = false;
        if (s.currentTrick && s.currentTrick.length > 0) {
          var leadSuit = s.currentTrick[0].card.suit;
          if (card.suit === leadSuit) isLegal = true;
          else {
            var hasLead = hand.some(function(c) { return c.suit === leadSuit; });
            if (!hasLead) isLegal = true;
          }
        } else {
          // Leading
          if (!s.heartsBroken && card.suit === 'h') {
            var onlyHearts = hand.every(function(c) { return c.suit === 'h'; });
            if (!onlyHearts) isLegal = false;
            else isLegal = true;
          } else {
            isLegal = true;
          }
        }
        if (s.trickCount === 0 && s.trickLeader === myIdx) {
          var has2c = hand.some(function(c) { return c.id === '2c'; });
          if (has2c && card.id !== '2c') isLegal = false;
        }
        if (!isLegal && selectedCards.indexOf(card.id) === -1) extraCls += ' illegal';
      }
      html += renderCardHtml(card, extraCls);
    }
    html += '</div></div>';

    // --- Game over overlay ---
    if (s.phase === 'over' && s.winner !== null && s.winner !== undefined) {
      var isWinner = s.winner === myIdx;
      html += '<div class="ht-over" id="ht-over">' +
        '<div class="ht-over-box">' +
        '<div class="ht-over-title">' + (isWinner ? window._t('ht_you_win') : window._t('ht_you_lose')) + '</div>' +
        '<div class="ht-over-scores">';
      for (var i = 0; i < 4; i++) {
        html += '<div>' + players[i] + (i === myIdx ? ' ' + window._t('ht_you') : '') + ': ' + window._tf('ht_score', (s.scores || [0,0,0,0])[i]) +
          (i === s.winner ? window._t('ht_crown') : '') + '</div>';
      }
      html += '</div>';
      html += '<div style="font-size:13px;color:var(--text-muted);">' + window._t('ht_click_close') + '</div>';
      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // --- Bind events ---
    bindEvents(s, myIdx);
  }

  function bindEvents(state, myIdx) {
    if (!container) return;

    // Card clicks
    var cards = container.querySelectorAll('.ht-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function(e) {
        var cardId = this.getAttribute('data-id');
        if (!cardId) return;

        if (state.phase === 'passing' && state.passDirection !== 'none' && !state.myPassCards) {
          // Pass selection
          var idx = selectedCards.indexOf(cardId);
          if (idx !== -1) {
            selectedCards.splice(idx, 1);
          } else if (selectedCards.length < 3) {
            selectedCards.push(cardId);
          }
          // Re-render hand area only
          render(state, container, myIdx, state.winner);
          return;
        }

        if (state.phase === 'playing' && state.currentPlayer === myIdx) {
          window.makeGameMove({ card: cardId });
        }
      });
    }

    // Pass button
    var passBtn = container.querySelector('#ht-pass-btn');
    if (passBtn) {
      passBtn.addEventListener('click', function() {
        if (selectedCards.length === 3) {
          window.makeGameMove({ cards: selectedCards.slice() });
          selectedCards = [];
        }
      });
    }

    // Game over overlay click
    var overEl = container.querySelector('#ht-over');
    if (overEl) {
      overEl.addEventListener('click', function() {
        overEl.style.display = 'none';
      });
    }
  }

  function init(containerEl) {
    container = containerEl;
    selectedCards = [];
    prevState = null;
    injectStyles();
  }

  window.gameRenderers.set('hearts', {
    init: init,
    render: render
  });
})();
