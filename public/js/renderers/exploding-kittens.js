// public/js/renderers/exploding-kittens.js
// 爆炸猫 — Exploding Kittens renderer
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var STYLES = '' +
    '.ek-game{width:100%;display:flex;flex-direction:column;gap:8px;}' +
    '.ek-opponents{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}' +
    '.ek-opp{background:var(--bg);border-radius:14px;padding:10px 14px;text-align:center;min-width:80px;border:2px solid transparent;transition:border-color .25s;}' +
    '.ek-opp.active{border-color:var(--accent);background:var(--surface);animation:pulse 2s ease infinite;}' +
    '.ek-opp.dead{opacity:.35;text-decoration:line-through;}' +
    '.ek-opp .name{font-size:13px;font-weight:600;}' +
    '.ek-opp .count{font-size:20px;font-weight:800;}' +
    '.ek-center{display:flex;gap:20px;justify-content:center;align-items:center;padding:8px 0;}' +
    '.ek-pile{width:80px;height:110px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;color:#fff;}' +
    '.ek-draw-pile{background:#c0392b;border:2px dashed #e74c3c;font-size:22px;position:relative;}' +
    '.ek-draw-pile .label{font-size:11px;opacity:.8;margin-top:2px;}' +
    '.ek-discard{background:#555;border:2px dashed #777;font-size:22px;}' +
    '.ek-future{background:var(--accent-dim);border-radius:14px;padding:10px;text-align:center;}' +
    '.ek-future .ftitle{font-size:12px;color:var(--text-muted);margin-bottom:4px;}' +
    '.ek-future .fcards{display:flex;gap:4px;justify-content:center;}' +
    '.ek-fcard{width:40px;height:56px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;}' +
    '.ek-hand-wrap{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;padding:4px 2px;margin:0 -4px;}' +
    '.ek-hand-wrap::-webkit-scrollbar{height:3px;}' +
    '.ek-hand-wrap::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px;}' +
    '.ek-hand{display:flex;gap:6px;min-height:90px;padding:2px 4px;}' +
    '.ek-card{width:64px;height:90px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.15);cursor:pointer;transition:transform .12s;flex-shrink:0;position:relative;color:#fff;}' +
    '.ek-card:active{transform:scale(.94);}' +
    '.ek-card .ekv{font-size:26px;line-height:1;}' +
    '.ek-card .ekl{font-size:10px;opacity:.8;margin-top:2px;}' +
    '.ek-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}' +
    '.ek-btn-favor{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}' +
    '.ek-status{text-align:center;font-size:14px;color:var(--text-muted);min-height:20px;}' +
    '.ek-target-picker{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;display:flex;align-items:center;justify-content:center;}' +
    '.ek-picker-card{background:var(--surface);border-radius:18px;padding:20px;text-align:center;min-width:220px;box-shadow:0 8px 30px rgba(0,0,0,.25);}' +
    '.ek-picker-title{font-size:15px;font-weight:700;margin-bottom:14px;}' +
    '.ek-picker-btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:12px;}' +
    '.ek-action-log{text-align:center;font-size:13px;font-weight:600;min-height:20px;padding:4px 0;transition:color .2s;}' +
    '.ek-explosion{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:300;pointer-events:none;}' +
    '.ek-boom{font-size:130px;animation:ekBoom 1.3s ease forwards;filter:drop-shadow(0 0 20px rgba(231,76,60,.7));}' +
    '@keyframes ekBoom{0%{transform:scale(.2) rotate(-12deg);opacity:0;}18%{transform:scale(1.5) rotate(8deg);opacity:1;}45%{transform:scale(1.1) rotate(-4deg);opacity:1;}100%{transform:scale(2.4);opacity:0;}}' +
    '.ek-shake{animation:ekShake .5s ease;}' +
    '@keyframes ekShake{0%,100%{transform:translateX(0);}20%{transform:translateX(-8px);}40%{transform:translateX(8px);}60%{transform:translateX(-6px);}80%{transform:translateX(6px);}}' +
    '.ek-opp.boom{animation:ekShake .5s ease;border-color:#e74c3c!important;}' +
    '@media(max-width:400px){.ek-card{width:54px;height:78px;}.ek-card .ekv{font-size:22px;}}';

  var CARD_ICONS = {
    explode: '💣', defuse: '🔧', attack: '⚔️',
    skip: '⏭️', future: '🔮', shuffle: '🔀', favor: '🎁',
    steal: '👋'
  };
  var CARD_NAME_KEYS = {
    explode: 'ek_card_explode', defuse: 'ek_card_defuse', attack: 'ek_card_attack',
    skip: 'ek_card_skip', future: 'ek_card_future', shuffle: 'ek_card_shuffle', favor: 'ek_card_steal',
    steal: 'ek_card_steal'
  };
  var CARD_COLORS = {
    explode: '#e74c3c', defuse: '#2ecc71', attack: '#c0392b',
    skip: '#3498db', future: '#9b59b6', shuffle: '#1abc9c', favor: '#f39c12',
    steal: '#2c3e50'
  };

  window.gameRenderers.set('exploding-kittens', {
    init: function(container) {
      if (!document.getElementById('ekStyles')) {
        var s = document.createElement('style');
        s.id = 'ekStyles'; s.textContent = STYLES;
        document.head.appendChild(s);
      }
      container.innerHTML =
        '<div class="ek-game">' +
          '<div class="ek-opponents" id="ekOpps"></div>' +
          '<div class="ek-action-log" id="ekActionLog"></div>' +
          '<div class="ek-center">' +
            '<div class="ek-pile ek-draw-pile" id="ekDrawPile"><span id="ekDrawCount">0</span><div class="label">' + _t('ek_draw_pile') + '</div></div>' +
            '<div class="ek-pile ek-discard" id="ekDiscard"><span id="ekDiscardCount">0</span><div class="label">' + _t('ek_discard') + '</div></div>' +
          '</div>' +
          '<div class="ek-future" id="ekFuture" style="display:none"></div>' +
          '<div class="ek-hand-wrap" id="ekHandWrap"><div class="ek-hand" id="ekHand"></div></div>' +
          '<div id="ekScrollHint" style="display:none;text-align:center;font-size:11px;color:var(--text-muted);padding:2px 0;">' + _t('ek_scroll_hint') + '</div>' +
          '<div id="ekStealMsg" style="text-align:center;font-size:13px;font-weight:600;min-height:20px;padding:2px 0;"></div>' +
          '<div class="ek-actions">' +
            '<button class="btn btn-primary btn-sm" id="ekDrawBtn">' + _t('ek_draw') + '</button>' +
          '</div>' +
          '<div class="ek-status" id="ekStatus"></div>' +
          '<div class="ek-target-picker" id="ekTargetPicker" style="display:none"></div>' +
        '</div>';

      document.getElementById('ekDrawBtn').addEventListener('click', function() {
        window.makeGameMove({});
      });
    },

    render: function(state, container, playerIndex, winner) {
      if (!state || !state.hands || state.hands.length === 0) return;

      renderOpponents(state, playerIndex);
      renderCenter(state);
      renderFuture(state, playerIndex);
      renderHand(state, playerIndex);
      renderActions(state, playerIndex);
      renderStatus(state, playerIndex);
      renderActionLog(state, playerIndex);
      maybeExplode(state);
    }
  });

  var _lastAnimSeq = -1;

  function renderActionLog(state, selfIdx) {
    var el = document.getElementById('ekActionLog');
    if (!el) return;
    var la = state.lastAction;
    if (!la) { el.textContent = ''; return; }
    var who = la.player === selfIdx ? _t('ek_you') : (window.getPlayerName ? window.getPlayerName(la.player) : (_t('ek_player_fallback') + (la.player + 1)));
    var msg = '', color = 'var(--text-muted)';
    switch (la.type) {
      case 'explode':
        msg = _tf('ek_msg_explode', who); color = '#e74c3c'; break;
      case 'defuse':
        msg = _tf('ek_msg_defuse', who); color = '#2ecc71'; break;
      case 'skip':
        msg = _tf('ek_msg_skip', who); break;
      case 'attack':
        var tgt = (la.target != null && la.target !== la.player) ? (window.getPlayerName ? window.getPlayerName(la.target) : (_t('ek_player_fallback') + (la.target + 1))) : _t('ek_next_player');
        msg = _tf('ek_msg_attack', who, tgt); color = '#c0392b'; break;
      case 'future':
        msg = _tf('ek_msg_future', who); break;
      case 'shuffle':
        msg = _tf('ek_msg_shuffle', who); break;
      case 'favor':
      case 'steal':
        msg = _tf('ek_msg_steal', who); break;
      case 'draw':
        msg = _tf('ek_msg_draw', who); break;
      default:
        msg = '';
    }
    el.textContent = msg;
    el.style.color = color;
  }

  function maybeExplode(state) {
    var la = state.lastAction;
    if (!la || la.type !== 'explode') { _lastAnimSeq = state.actionSeq || _lastAnimSeq; return; }
    if (la.seq === _lastAnimSeq) return;
    _lastAnimSeq = la.seq;
    playExplosion(la.player);
  }

  function playExplosion(victimIdx) {
    var ov = document.createElement('div');
    ov.className = 'ek-explosion';
    ov.innerHTML = '<div class="ek-boom">💥</div>';
    document.body.appendChild(ov);
    var board = document.querySelector('.ek-game');
    if (board) {
      board.classList.add('ek-shake');
      setTimeout(function() { board.classList.remove('ek-shake'); }, 600);
    }
    setTimeout(function() { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 1400);
  }

  function renderOpponents(state, selfIdx) {
    var el = document.getElementById('ekOpps');
    if (!el) return;
    var html = '';
    for (var i = 0; i < state.hands.length; i++) {
      if (i === selfIdx) continue;
      var count = state.hands[i] ? state.hands[i].length : 0;
      var active = i === state.currentPlayer ? ' active' : '';
      var dead = !state.alive[i] ? ' dead' : '';
      html += '<div class="ek-opp' + active + dead + '">' +
        '<div class="name">' + (window.getPlayerName ? window.getPlayerName(i) : (_t('ek_player_fallback') + (i + 1))) + (dead ? _t('ek_dead_indicator') : '') + '</div>' +
        '<div class="count">' + count + '</div><div style="font-size:11px;color:var(--text-muted)">' + _t('ek_cards_count') + '</div></div>';
    }
    el.innerHTML = html;
  }

  function renderCenter(state) {
    document.getElementById('ekDrawCount').textContent = state.deck ? state.deck.length : 0;
    document.getElementById('ekDiscardCount').textContent = state.discard ? state.discard.length : 0;
  }

  function renderFuture(state, selfIdx) {
    var el = document.getElementById('ekFuture');
    if (!el) return;
    if (state.peekedCards && state.currentPlayer === selfIdx && state.phase === 'play') {
      el.style.display = 'block';
      var html = '<div class="ftitle">' + _tf('ek_future_title', state.peekedCards.length) + '</div><div class="fcards">';
      for (var i = state.peekedCards.length - 1; i >= 0; i--) {
        var c = state.peekedCards[i];
        var bg = CARD_COLORS[c.type] || '#555';
        html += '<div class="ek-fcard" style="background:' + bg + '">' + (CARD_ICONS[c.type] || '?') + '</div>';
      }
      html += '</div>';
      el.innerHTML = html;
    } else {
      el.style.display = 'none';
    }
  }

  function renderHand(state, selfIdx) {
    var el = document.getElementById('ekHand');
    if (!el) return;
    var hand = state.hands[selfIdx];
    if (!hand || hand.length === 0) { el.innerHTML = ''; return; }
    var isMyTurn = state.currentPlayer === selfIdx && state.alive[selfIdx];
    var inPlay = state.phase === 'play' && isMyTurn;
    var html = '';
    for (var i = 0; i < hand.length; i++) {
      var c = hand[i];
      var bg = CARD_COLORS[c.type] || '#555';
      var icon = CARD_ICONS[c.type] || '?';
      var name = _t(CARD_NAME_KEYS[c.type]) || c.type;
      html += '<div class="ek-card" data-id="' + c.id + '" style="background:' + bg + '">' +
        '<div class="ekv">' + icon + '</div><div class="ekl">' + name + '</div></div>';
    }
    el.innerHTML = html;

    // Click handlers
    var cards = el.children;
    for (var j = 0; j < cards.length; j++) {
      (function(cardEl, card) {
        cardEl.addEventListener('click', function() {
          if (!inPlay) { showToast(_t('ek_toast_not_turn')); return; }
          if (card.type === 'steal' || card.type === 'favor' || card.type === 'attack') {
            var alive = [];
            state.alive.forEach(function(a, i) { if (a && i !== selfIdx) alive.push(i); });
            var noTargetMsg = card.type === 'attack' ? _t('ek_toast_no_attack_target') : _t('ek_toast_no_steal_target');
            if (alive.length === 0) {
              showToast(noTargetMsg);
            } else if (alive.length === 1) {
              window.makeGameMove({ cardId: card.id, targetPlayer: alive[0] });
            } else {
              showTargetPicker(card, alive);
            }
            return;
          }
          window.makeGameMove({ cardId: card.id });
        });
      })(cards[j], hand[j]);
    }

    // Scroll hint when hand > 5 cards
    var hintEl = document.getElementById('ekScrollHint');
    var handWrap = document.getElementById('ekHandWrap');
    if (hintEl && handWrap) {
      if (hand.length > 5 && isMyTurn) {
        hintEl.style.display = '';
        if (!handWrap.dataset.scrollWatched) {
          handWrap.dataset.scrollWatched = '1';
          handWrap.addEventListener('scroll', function() {
            hintEl.style.opacity = '0';
            hintEl.style.transition = 'opacity 0.5s';
            setTimeout(function() { hintEl.style.display = 'none'; }, 500);
          }, { once: true });
        }
      } else {
        hintEl.style.display = 'none';
      }
    }
  }

  function renderActions(state, selfIdx) {
    var drawBtn = document.getElementById('ekDrawBtn');
    if (!drawBtn) return;
    var isMyTurn = state.currentPlayer === selfIdx && state.alive[selfIdx];
    if (isMyTurn && state.phase === 'draw') {
      drawBtn.style.display = '';
      drawBtn.textContent = _t('ek_draw');
    } else if (isMyTurn && state.phase === 'play') {
      drawBtn.style.display = '';
      drawBtn.textContent = _t('ek_skip_to_draw');
    } else {
      drawBtn.style.display = 'none';
    }
  }

  function renderStatus(state, selfIdx) {
    var el = document.getElementById('ekStatus');
    if (!el) return;
    if (state.winner !== null) {
      el.textContent = state.winner === selfIdx ? _t('ek_you_win') : '💀 ' + (window.getPlayerName ? window.getPlayerName(state.winner) : (_t('ek_player_fallback') + (state.winner + 1))) + _t('ek_player_wins');
    } else if (!state.alive[selfIdx]) {
      el.textContent = _t('ek_you_eliminated');
    } else if (state.currentPlayer === selfIdx) {
      el.textContent = state.phase === 'play' ? _t('ek_play_or_skip') : _t('ek_please_draw');
    } else {
      el.textContent = _t('ek_waiting');
    }

    // Steal notification
    var stealEl = document.getElementById('ekStealMsg');
    if (stealEl) {
      if (state.lastSteal) {
        var ls = state.lastSteal;
        var cardName = _t(CARD_NAME_KEYS[ls.cardType]) || ls.cardType;
        var cardIcon = CARD_ICONS[ls.cardType] || '?';
        if (ls.stealer === selfIdx) {
          stealEl.textContent = _tf('ek_msg_stolen_you', cardIcon + ' ' + cardName);
          stealEl.style.color = '#2ecc71';
        } else if (ls.victim === selfIdx) {
          stealEl.textContent = _tf('ek_msg_stolen_victim', cardIcon + ' ' + cardName);
          stealEl.style.color = '#e74c3c';
        } else {
          stealEl.textContent = '';
        }
      } else {
        stealEl.textContent = '';
      }
    }
  }

  function showTargetPicker(card, targets) {
    var el = document.getElementById('ekTargetPicker');
    if (!el) return;
    var verb = card.type === 'attack' ? _t('ek_target_attack_verb') : _t('ek_target_steal_verb');
    var html = '<div class="ek-picker-card"><div class="ek-picker-title">' + verb + _t('ek_target_prompt') + '</div><div class="ek-picker-btns">';
    targets.forEach(function(i) {
      html += '<button class="btn btn-primary btn-sm" data-target="' + i + '">' + (window.getPlayerName ? window.getPlayerName(i) : (_t('ek_player_fallback') + ' ' + (i + 1))) + '</button>';
    });
    html += '</div><button class="btn btn-outline btn-sm ek-picker-cancel">' + _t('ek_cancel') + '</button></div>';
    el.innerHTML = html;
    el.style.display = 'flex';
    el.querySelectorAll('[data-target]').forEach(function(b) {
      b.addEventListener('click', function() {
        el.style.display = 'none';
        window.makeGameMove({ cardId: card.id, targetPlayer: parseInt(b.dataset.target, 10) });
      });
    });
    var cancel = el.querySelector('.ek-picker-cancel');
    if (cancel) cancel.addEventListener('click', function() { el.style.display = 'none'; });
    el.onclick = function(e) { if (e.target === el) el.style.display = 'none'; };
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.classList.remove('show'); }, 1800);
  }
})();
