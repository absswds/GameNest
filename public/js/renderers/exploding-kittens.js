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
    '.ek-draw-pile{font-size:22px;position:relative;box-shadow:0 2px 8px rgba(0,0,0,.2);}' +
    '.ek-draw-pile .label{font-size:11px;opacity:.8;margin-top:2px;}' +
    '.ek-discard{background:transparent;border:1.5px dashed rgba(28,27,25,.25);color:var(--text-muted);font-size:22px;}' +
    '.ek-future{background:var(--accent-dim);border-radius:14px;padding:14px;text-align:center;}' +
    '.ek-future .ftitle{font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:6px;}' +
    '.ek-future .fcards{display:flex;gap:6px;justify-content:center;}' +
    '.ek-fcard{width:52px;height:70px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:11px;font-weight:700;color:#fff;word-break:keep-all;overflow:hidden;}' +
    '.ek-fcard .ekv{font-size:18px;line-height:1;}' +
    '.ek-fcard .ekl{font-size:9px;font-weight:600;opacity:.9;line-height:1.1;max-width:48px;text-align:center;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}' +
    '.ek-hand-wrap{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;padding:4px 2px;margin:0 -4px;}' +
    '.ek-hand-wrap::-webkit-scrollbar{height:3px;}' +
    '.ek-hand-wrap::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px;}' +
    '.ek-hand{display:flex;gap:6px;min-height:90px;padding:2px 4px;}' +
    '.ek-card{width:64px;height:90px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.15);cursor:pointer;transition:transform .12s;flex-shrink:0;position:relative;color:#fff;}' +
    '.ek-card:active{transform:scale(.94);}' +
    '.ek-card .ekv{font-size:22px;line-height:1;}' +
    '.ek-card .ekl{font-size:10px;font-weight:700;opacity:.85;margin-top:2px;line-height:1.2;word-break:keep-all;overflow:hidden;max-width:60px;text-align:center;}' +
    '.ek-card,.ek-fcard{position:relative;display:flex;flex-direction:column;background:#fffdf8 !important;color:var(--ek);border:1px solid rgba(28,27,25,.12);box-shadow:0 1px 2px rgba(0,0,0,.08),0 2px 6px rgba(0,0,0,.06);overflow:hidden;padding:0;justify-content:flex-start;align-items:stretch;}' +
    '.ek-card::after,.ek-fcard::after{content:"";position:absolute;inset:3px;border:1px solid color-mix(in srgb,var(--ek) 30%,transparent);border-radius:7px;pointer-events:none;}' +
    '.ek-band{background:var(--ek);color:#fff;font-size:10px;font-weight:800;text-align:center;padding:4px 2px 3px;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.ek-ico{flex:1;display:flex;align-items:center;justify-content:center;}' +
    '.ek-ico svg{width:56%;height:auto;}' +
    '.ek-card.ek-t-explode{background:#1f1d1b !important;color:#ff6b4a;}' +
    '.ek-fcard .ek-band{font-size:8px;padding:3px 1px 2px;}' +
    '@media (hover:hover){.ek-card:hover{transform:translateY(-6px);box-shadow:0 10px 20px rgba(0,0,0,.16);}}' +
    '.ek-pile-back{position:relative;background:linear-gradient(150deg,#2b2926,#161514) !important;color:#fff;overflow:hidden;}' +
    '.ek-pile-back::before{content:"";position:absolute;inset:4px;border:1px solid rgba(255,255,255,.14);border-radius:8px;}' +
    '.ek-flash{position:fixed;inset:0;z-index:300;pointer-events:none;background:radial-gradient(circle at 50% 50%,rgba(255,120,70,.55),rgba(192,57,43,.25) 35%,transparent 70%);animation:ekFlash .9s var(--ease,ease) forwards;}' +
    '.ek-ring{position:fixed;left:50%;top:50%;width:80px;height:80px;margin:-40px 0 0 -40px;border-radius:50%;border:6px solid #ff6b4a;z-index:301;pointer-events:none;animation:ekRing .8s cubic-bezier(.2,.8,.2,1) forwards;}' +
    '@keyframes ekFlash{0%{opacity:0;}15%{opacity:1;}100%{opacity:0;}}' +
    '@keyframes ekRing{0%{transform:scale(.2);opacity:1;}100%{transform:scale(6);opacity:0;border-width:1px;}}' +
    '@media (prefers-reduced-motion:reduce){.ek-ring{display:none;}.ek-shake{animation:none;}}' +
    '.ek-fslot{display:flex;flex-direction:column;align-items:center;gap:3px;}' +
    '.ek-fnum{font-size:11px;font-weight:800;color:var(--text-muted);}' +
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
    '@media(max-width:400px){.ek-card{width:54px;height:78px;}.ek-card .ekv{font-size:18px;}.ek-card .ekl{font-size:9px;}.ek-fcard{width:44px;height:60px;}.ek-fcard .ekv{font-size:16px;}}';

  // Line icons (24x24, stroke = currentColor) — replaces the old emoji faces
  var SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var CARD_SVG = {
    explode: '<circle cx="10.5" cy="14" r="6.5"/><path d="M15 9.5l2-2M17 7.5l1.2-1.2"/><path d="M19.5 3.5v1.6M21.5 5.5h-1.6M20.9 3.1l-1 1"/><path d="M7.6 12.2a3 3 0 0 1 2.4-1.6"/>',
    defuse: '<path d="M7 17 17 7"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M9 9l-3-3M15 15l3 3"/>',
    attack: '<path d="M13 2 5 13.5h6L10 22l9-12h-6z"/>',
    skip: '<path d="M5 6l6 6-6 6M12 6l6 6-6 6"/><path d="M20 6v12"/>',
    future: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
    shuffle: '<path d="M3 7h4c4 0 6 10 10 10h4M3 17h4c1.6 0 2.8-1.6 3.8-3.5M13.2 9.5C14.2 8 15.4 7 17 7h4"/><path d="M18.5 4.5 21 7l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5"/>',
    favor: '<rect x="4" y="3.5" width="9" height="13" rx="1.5"/><path d="M13 12h7M17 9l3 3-3 3"/>',
    steal: '<rect x="4" y="3.5" width="9" height="13" rx="1.5"/><path d="M13 12h7M17 9l3 3-3 3"/>',
    nope: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>'
  };
  function cardIcon(type) {
    return SVG_OPEN + (CARD_SVG[type] || '<circle cx="12" cy="12" r="6"/>') + '</svg>';
  }
  // Kept for the steal notice text, which is plain text (no HTML)
  var CARD_ICONS = {
    explode: '✹', defuse: '✂', attack: '⚡', skip: '⏭', future: '◉',
    shuffle: '⇄', favor: '→', steal: '→', nope: '⊘'
  };
  var CARD_NAME_KEYS = {
    explode: 'ek_card_explode', defuse: 'ek_card_defuse', attack: 'ek_card_attack',
    skip: 'ek_card_skip', future: 'ek_card_future', shuffle: 'ek_card_shuffle', favor: 'ek_card_steal',
    steal: 'ek_card_steal', nope: 'ek_card_nope'
  };
  var CARD_COLORS = {
    explode: '#c0392b', defuse: '#2c8a57', attack: '#b8552b',
    skip: '#2d6fb5', future: '#7a4fb0', shuffle: '#1f8a86', favor: '#b8862b',
    steal: '#3d4a5c', nope: '#8a2c4f'
  };

  // Paper card with coloured header band (name) and a line icon in the centre
  function cardHtml(c, cls, extraAttrs) {
    var color = CARD_COLORS[c.type] || '#555';
    var name = _t(CARD_NAME_KEYS[c.type]) || c.type;
    return '<div class="' + cls + ' ek-t-' + c.type + '" style="--ek:' + color + '"' + (extraAttrs || '') + '>' +
      '<div class="ek-band">' + name + '</div>' +
      '<div class="ek-ico">' + cardIcon(c.type) + '</div>' +
    '</div>';
  }

  window.gameRenderers.set('exploding-kittens', {
    init: function(container) {
      injectStylesOnce('ekStyles', STYLES);
      container.innerHTML =
        '<div class="ek-game">' +
          '<div class="ek-opponents" id="ekOpps"></div>' +
          '<div class="ek-action-log" id="ekActionLog"></div>' +
          '<div class="ek-center">' +
            '<div class="ek-pile ek-draw-pile ek-pile-back" id="ekDrawPile"><span id="ekDrawCount">0</span><div class="label">' + _t('ek_draw_pile') + '</div></div>' +
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
        window.makeGameMove({ draw: true });
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
    ov.innerHTML = '<div class="ek-flash"></div><div class="ek-ring"></div>';
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
      // peekedCards[0] is the top of the deck: show it first (left), numbered in draw order
      for (var i = 0; i < state.peekedCards.length; i++) {
        html += '<div class="ek-fslot"><span class="ek-fnum">' + (i + 1) + '</span>' + cardHtml(state.peekedCards[i], 'ek-fcard') + '</div>';
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
      html += cardHtml(c, 'ek-card', ' data-id="' + c.id + '"');
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
      drawBtn.textContent = _t('ek_draw');
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
