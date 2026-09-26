// public/js/renderers/uno.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  function t(key) { return typeof _t === 'function' ? _t(key) : key; }
  function tf(key) { var args = Array.prototype.slice.call(arguments, 1); return String(t(key)).replace(/%s/g, function() { return args.shift(); }); }

  var VALUE_LABELS = {
    '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
    'skip':'⊘', 'reverse':'↻', '+2':'+2',
    'wild':'★', '+4':'+4'
  };

  var COLOR_HEX = { red:'#e74c3c', blue:'#3498db', green:'#2ecc71', yellow:'#f1c40f', wild:'#555' };
  var COLOR_TEXT = { red:'#fff', blue:'#fff', green:'#fff', yellow:'#222', wild:'#fff' };
  var COLOR_NAMES = { red: t('uno_red'), blue: t('uno_blue'), green: t('uno_green'), yellow: t('uno_yellow') };
  var COLOR_ORDER = ['red','blue','green','yellow'];
  var CARD_COLOR = { red:'#d63a2f', blue:'#1f6fd1', green:'#2c9a55', yellow:'#f2b705' };

  // Inline SVG glyphs for action cards (currentColor so they tint per card)
  var ICONS = {
    skip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M6.2 17.8 17.8 6.2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    reverse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9.5h11l-3-3M19 14.5H8l3 3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wild: '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-28 12 12)"><path d="M12 3a6 9 0 0 0-6 9h6z" fill="#d63a2f"/><path d="M12 3a6 9 0 0 1 6 9h-6z" fill="#1f6fd1"/><path d="M12 21a6 9 0 0 1-6-9h6z" fill="#f2b705"/><path d="M12 21a6 9 0 0 0 6-9h-6z" fill="#2c9a55"/></g></svg>'
  };

  function valueGlyph(value) {
    if (ICONS[value]) return ICONS[value];
    if (value === '+2' || value === '+4') return '<span class="uf-num uf-plus">' + value + '</span>';
    return '<span class="uf-num">' + value + '</span>';
  }

  function cornerLabel(value) {
    if (value === 'skip') return '⊘';
    if (value === 'reverse') return '⇄';
    if (value === 'wild') return '';
    return value;
  }

  // Full card face: solid body, white inset border, tilted white oval, corner indices
  function cardFace(card) {
    var bg = card.color === 'wild' ? '#1c1b19' : (CARD_COLOR[card.color] || '#888');
    var corner = cornerLabel(card.value);
    var center = card.value === '+4'
      ? ICONS.wild + '<span class="uf-num uf-plus uf-over">+4</span>'
      : valueGlyph(card.value);
    return '<div class="uf" style="--uc:' + bg + '">' +
      '<span class="uf-oval">' + center + '</span>' +
      (corner ? '<span class="uf-corner">' + corner + '</span><span class="uf-corner uf-br">' + corner + '</span>' : '') +
    '</div>';
  }

  function cardBack() {
    return '<div class="uf uf-back" style="--uc:#1c1b19"><span class="uf-oval">' + ICONS.wild + '</span></div>';
  }
  var lastDiscardKey = null;
  var lastHandSignature = null;
  var lastHandLen = 0;
  var lastChallengeKey = null; // detects when a challenge resolves, to toast the result

  var STYLES = '' +
    '.uno-table{width:100%;display:flex;flex-direction:column;gap:5px;}' +
    '.uno-opponents{display:flex;flex-wrap:wrap;gap:5px;max-height:22vh;overflow-y:auto;flex-shrink:0;align-items:flex-start;align-content:flex-start;}' +
    '.uno-opponent{flex:0 1 auto;min-width:70px;max-width:140px;display:flex;flex-direction:column;align-items:flex-start;padding:4px 6px;background:var(--bg);border-radius:10px;font-size:10px;font-weight:600;border:2px solid transparent;transition:border-color .25s;overflow:hidden;}' +
    '.uno-opponent.active-turn{border-color:var(--accent);background:var(--surface);animation:pulse 2s ease infinite;}' +
    '.uno-opponent .opp-top{display:flex;justify-content:space-between;align-items:center;width:100%;}' +
    '.uno-opponent .card-count{font-size:11px;color:var(--text-muted);}' +
    '.uno-opponent .card-backs{display:flex;gap:1px;}' +
    '.uno-opponent .mini-back{width:10px;height:15px;background:linear-gradient(135deg,#c8a45c,#a8863a);border-radius:2px;}' +
    '.uno-center{display:flex;flex-direction:column;align-items:center;gap:3px;margin:2px 0;}' +
    '.uno-color-badge{font-size:12px;font-weight:700;padding:3px 14px;border-radius:20px;color:#fff;transition:background .3s;}' +
    '.uno-play-area{display:flex;gap:20px;align-items:center;justify-content:center;padding:4px 0;}' +
    '.uno-discard-card{width:76px;height:110px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;box-shadow:0 2px 10px rgba(0,0,0,.15);position:relative;transition:transform .2s;}' +
    '.uno-discard-card.play-flash{animation:unoDiscardPop .42s ease;}' +
    '.uno-discard-card .dv{font-size:28px;line-height:1;}' +
    '.uno-discard-card .dl{font-size:9px;opacity:.8;margin-top:1px;text-transform:uppercase;}' +
    '.uno-discard-card.wild-card{background:linear-gradient(135deg,#e74c3c 25%,#3498db 25%,#3498db 50%,#2ecc71 50%,#2ecc71 75%,#f1c40f 75%);}' +
    '.uno-draw-pile{width:76px;height:110px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#2a2a2a;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.1);}' +
    '.uno-draw-pile .dc{font-size:22px;font-weight:800;}' +
    '.uno-draw-pile .dl{font-size:10px;color:#999;margin-top:1px;}' +
    '.uno-draw-stack{position:absolute;top:-6px;right:-6px;background:#e74c3c;color:#fff;font-size:11px;font-weight:700;padding:1px 7px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.2);}' +
    '.uno-dir-arrow{font-size:16px;margin:0 3px;}' +
    '.uno-hand-wrap{padding:4px 2px;margin:0 -4px;}' +
    '.uno-hand-wrap::-webkit-scrollbar{height:3px;}' +
    '.uno-hand-wrap::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px;}' +
    '.uno-hand{display:flex;flex-wrap:wrap;gap:6px;padding:2px 4px;justify-content:center;}' +
    '.uno-card{width:48px;height:72px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,.13);cursor:pointer;transition:transform .15s,opacity .15s,box-shadow .15s;flex-shrink:0;position:relative;}' +
    '.uno-card.new-card{animation:unoNewCardIn .38s ease;}' +
    '.uno-card:active{transform:scale(.94);}' +
    '.uno-card.wild-rainbow{background:linear-gradient(135deg,#e74c3c 25%,#3498db 25%,#3498db 50%,#2ecc71 50%,#2ecc71 75%,#f1c40f 75%);color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.4);}' +
    '.uno-card .cv{font-size:18px;line-height:1;}' +
    '.uno-card .cl{font-size:8px;opacity:.8;margin-top:1px;text-transform:uppercase;}' +
    '.uno-card.not-playable{opacity:.35;cursor:default;}' +
    '.uno-card.not-playable:active{transform:none;}' +
    '.uf{position:absolute;inset:0;border-radius:inherit;background:var(--uc);box-shadow:inset 0 0 0 3px #fff;overflow:hidden;color:var(--uc);}' +
    '.uf-oval{position:absolute;left:50%;top:50%;width:74%;height:62%;transform:translate(-50%,-50%) rotate(-28deg);background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;}' +
    '.uf-oval>*{transform:rotate(28deg);}' +
    '.uf-oval svg{width:58%;height:auto;}' +
    '.uf-num{font-weight:900;font-size:calc(var(--cw) * .44);line-height:1;letter-spacing:-1px;text-shadow:1px 1px 0 rgba(0,0,0,.18);}' +
    '.uf-plus{font-size:calc(var(--cw) * .32);}' +
    '.uf-over{position:absolute;color:#fff;-webkit-text-stroke:1px #1c1b19;}' +
    '.uf-corner{position:absolute;top:5%;left:9%;font-weight:900;font-size:calc(var(--cw) * .2);line-height:1;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.35);}' +
    '.uf-br{top:auto;left:auto;bottom:5%;right:9%;transform:rotate(180deg);}' +
    '.uf-back .uf-oval{background:#d63a2f;}' +
    '.uf-back .uf-oval svg{width:70%;}' +
    '.uno-card,.uno-discard-card,.uno-draw-pile{--cw:48px;position:relative;background:#fff !important;padding:0;border:none;}' +
    '.uno-discard-card,.uno-draw-pile{--cw:76px;}' +
    '.uno-draw-pile .uno-pile-count{position:absolute;bottom:-20px;left:0;right:0;text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);white-space:nowrap;}' +
    '.uno-play-area{padding-bottom:18px;}' +
    '.uno-card.not-playable{opacity:.72;filter:saturate(.45) brightness(.97);}' +
    '@media (hover:hover){.uno-card.playable:hover{transform:translateY(-6px);box-shadow:0 10px 20px rgba(0,0,0,.18);}}' +
    '.uno-card.playable{box-shadow:0 2px 6px rgba(0,0,0,.13),0 0 0 2px #fff,0 0 0 4px rgba(28,27,25,.2);}' +
    '.uno-actions{display:flex;gap:8px;justify-content:center;}' +
    '#unoBtn.uno-btn-warn{background:#e74c3c;color:#fff;border-color:#e74c3c;}' +
    '.uno-color-picker-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:2px 0;}' +
    '.uno-color-picker-btn{width:48px;height:48px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.2);cursor:pointer;font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .15s;}' +
    '.uno-color-picker-btn:active{transform:scale(.9);}' +
    '@keyframes unoDiscardPop{' +
      '0%{transform:translateY(12px) scale(.92) rotate(-6deg);opacity:.55;}' +
      '60%{transform:translateY(-4px) scale(1.03) rotate(1deg);opacity:1;}' +
      '100%{transform:translateY(0) scale(1) rotate(0deg);opacity:1;}' +
    '}' +
    '@keyframes unoNewCardIn{' +
      '0%{transform:translateY(22px) scale(.88);opacity:0;}' +
      '100%{transform:translateY(0) scale(1);opacity:1;}' +
    '}' +
    // Narrow screens (sub-360px phones)
    '@media(max-width:380px){' +
      '.uno-opponent{font-size:11px;padding:5px 8px;gap:0;}' +
      '.uno-opponent .mini-back{width:8px;height:12px;}' +
      '.uno-discard-card{width:60px;height:88px;--cw:60px;}' +
      '.uno-discard-card .dv{font-size:22px;}' +
      '.uno-draw-pile{width:60px;height:88px;--cw:60px;}' +
      '.uno-draw-pile .dc{font-size:18px;}' +
      '.uno-play-area{gap:14px;}' +
      '.uno-card{width:44px;height:66px;border-radius:8px;--cw:44px;}' +
      '.uno-card .cv{font-size:17px;}' +
      '.uno-card .cl{font-size:7px;}' +
      '.uno-hand{gap:3px;min-height:72px;}' +
      '.uno-actions{gap:6px;}' +
      '.uno-actions .btn{font-size:13px;padding:8px 14px;}' +
    '}' +
    // Landscape mode — side-by-side layout
    '@media(orientation:landscape) and (max-height:450px){' +
      '.uno-table{flex-direction:row;gap:6px;align-items:flex-start;}' +
      '.uno-opponents{flex:0 0 auto;flex-direction:column;max-width:140px;}' +
      '.uno-center{flex:0 0 auto;}' +
      '.uno-discard-card,.uno-draw-pile{width:50px;height:74px;--cw:50px;}' +
      '.uno-discard-card .dv{font-size:20px;}' +
      '.uno-draw-pile .dc{font-size:16px;}' +
      '.uno-card{width:40px;height:60px;border-radius:7px;--cw:40px;}' +
      '.uno-card .cv{font-size:16px;}' +
      '.uno-card .cl{font-size:6px;}' +
      '.uno-hand{gap:2px;min-height:0;padding:0 2px;}' +
      '.uno-hand-wrap{flex:1;min-width:0;}' +
      '.uno-actions{flex:0 0 auto;flex-direction:column;gap:4px;}' +
      '.uno-actions .btn{font-size:12px;padding:6px 10px;}' +
      '.uno-color-badge{font-size:10px;padding:2px 10px;}' +
      '.uno-play-area{gap:8px;}' +
    '}';

  // ---- Renderer Registration ----

  window.gameRenderers.set('uno', {

    init: function(container) {
      // Inject styles once
      injectStylesOnce('unoRendererStyles', STYLES);

      container.innerHTML = '' +
        '<div class="uno-table">' +
          '<div class="uno-opponents" id="unoOpponents"></div>' +
          '<div class="uno-center">' +
            '<div class="uno-color-badge" id="unoColorBadge">-</div>' +
            '<div class="uno-play-area">' +
              '<div class="uno-discard-card" id="unoDiscardCard" style="background:#ccc;color:#666">' +
                '<div class="dv">-</div><div class="dl"></div>' +
              '</div>' +
              '<div class="uno-draw-pile" id="unoDrawPile">' +
                '<div class="dc">0</div><div class="dl">' + t('uno_remaining') + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="uno-hand-wrap" id="unoHandWrap"><div class="uno-hand" id="unoHand"></div></div>' +
          '<div id="unoScrollHint" style="display:none;text-align:center;font-size:11px;color:var(--text-muted);padding:2px 0;">' + t('uno_scroll_hint') + '</div>' +
          '<div class="uno-actions">' +
            '<button class="btn btn-outline btn-sm" id="drawBtn">' + t('uno_draw') + '</button>' +
            '<button class="btn btn-outline btn-sm" id="unoBtn" style="display:none">UNO!</button>' +
          '</div>' +
        '</div>' +
        '<div class="overlay" id="unoColorPicker" style="display:none">' +
          '<div class="overlay-card">' +
            '<div style="font-size:18px;font-weight:700;margin-bottom:10px">' + t('uno_choose_color') + '</div>' +
            '<div class="uno-color-picker-btns" id="unoColorBtns"></div>' +
          '</div>' +
        '</div>' +
        '<div class="overlay" id="unoChallenge" style="display:none">' +
          '<div class="overlay-card">' +
            '<div style="font-size:18px;font-weight:700;margin-bottom:6px">' + t('uno_challenge_title') + '</div>' +
            '<div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">' + t('uno_challenge_hint') + '</div>' +
            '<div style="display:flex;gap:10px;justify-content:center">' +
              '<button class="btn btn-sm" id="unoChallengeAccept">' + t('uno_challenge_accept') + '</button>' +
              '<button class="btn btn-sm uno-btn-warn" id="unoChallengeCall">' + t('uno_challenge_call') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      // Color picker buttons
      var cbox = document.getElementById('unoColorBtns');
      for (var ci = 0; ci < COLOR_ORDER.length; ci++) {
        (function(col) {
          var btn = document.createElement('button');
          btn.className = 'uno-color-picker-btn';
          btn.style.background = COLOR_HEX[col];
          btn.textContent = COLOR_NAMES[col];
          btn.addEventListener('click', function() {
            document.getElementById('unoColorPicker').style.display = 'none';
            if (window._pendingWildCard) {
              window.makeGameMove({ cardId: window._pendingWildCard, chosenColor: col });
              window._pendingWildCard = null;
            }
          });
          cbox.appendChild(btn);
        })(COLOR_ORDER[ci]);
      }

      // Draw button
      document.getElementById('drawBtn').addEventListener('click', function() {
        window.makeGameMove({});
      });

      // UNO button
      document.getElementById('unoBtn').addEventListener('click', function() {
        window.makeGameMove({ uno: true });
      });

      // +4 Challenge buttons (shown to the target player)
      document.getElementById('unoChallengeAccept').addEventListener('click', function() {
        document.getElementById('unoChallenge').style.display = 'none';
        window.makeGameMove({ challengeResponse: 'accept' });
      });
      document.getElementById('unoChallengeCall').addEventListener('click', function() {
        document.getElementById('unoChallenge').style.display = 'none';
        window.makeGameMove({ challengeResponse: 'challenge' });
      });

    },

    render: function(state, container, playerIndex, winner) {
      var hands = state.hands || [];
      var discard = state.discard || [];
      var deck = state.deck || [];
      var currentColor = state.currentColor;
      var currentPlayer = state.currentPlayer;
      var drawStack = state.drawStack || 0;
      var unoCalled = state.unoCalled || [];
      var isMyTurn = (currentPlayer === playerIndex) && (winner === null || winner === undefined);
      var topCard = discard[0] || null;
      var discardKey = topCard ? topCard.id + ':' + currentColor : null;
      var discardChanged = !!discardKey && lastDiscardKey !== null && discardKey !== lastDiscardKey;
      var handSignature = (hands[playerIndex] || []).map(function(card) { return card.id; }).join('|');
      var currentLen = (hands[playerIndex] || []).length;
      var drewCard = lastHandSignature !== null && handSignature !== lastHandSignature && currentLen > lastHandLen;

      renderOpponents(hands, currentPlayer, playerIndex, unoCalled);
      renderColorBadge(currentColor);
      renderDiscard(discard, discardChanged);
      renderDrawPile(deck, drawStack);
      renderHand(hands[playerIndex] || [], discard, currentColor, isMyTurn, drewCard);
      renderButtons(hands[playerIndex] || [], drawStack, isMyTurn, unoCalled[playerIndex]);
      renderChallenge(state, playerIndex);
      lastDiscardKey = discardKey;
      lastHandSignature = handSignature;
      lastHandLen = currentLen;

      // Scroll hint for small screens with many cards
      var hand = hands[playerIndex] || [];
      // Swipe hint removed - cards now wrap into multiple rows on mobile.
      var hintEl = document.getElementById('unoScrollHint');
      if (hintEl) hintEl.style.display = 'none';
    }
  });

  // ---- Internal Render Helpers ----

  function renderOpponents(hands, currentPlayer, selfIndex, unoCalled) {
    var el = document.getElementById('unoOpponents');
    if (!el) return;
    var html = '';
    for (var i = 0; i < hands.length; i++) {
      if (i === selfIndex) continue;
      var count = (hands[i] && hands[i].length) || 0;
      var active = i === currentPlayer ? ' active-turn' : '';
      var called = unoCalled && unoCalled[i] && count === 1;
      var notCalled = count === 1 && !called;
      // Show at most 7 card backs; add a "+N" chip for the rest so the
      // opponent area doesn't stretch tall when someone holds many cards.
      var maxBacks = 7;
      var backs = '';
      for (var b = 0; b < Math.min(count, maxBacks); b++) backs += '<div class="mini-back"></div>';
      if (count > maxBacks) backs += '<span style="font-size:10px;color:var(--text-muted);align-self:center;">+' + (count - maxBacks) + '</span>';
      html += '' +
        '<div class="uno-opponent' + active + '">' +
          '<div class="opp-top">' +
            '<span>' + ((window.gamePlayers && window.gamePlayers[i]) ? window.gamePlayers[i].name : tf('uno_player', i+1)) +
              (called ? ' <span style="background:#2ecc71;color:#fff;font-size:9px;padding:1px 5px;border-radius:6px;font-weight:700;">UNO</span>' : '') +
              (notCalled ? ' <span style="color:#e74c3c;font-size:9px;font-weight:700;">' + t('uno_uno_warning') + '</span>' : '') +
            '</span>' +
            '<span class="card-count">×' + count + '</span>' +
          '</div>' +
          '<div class="card-backs">' + backs + '</div>' +
        '</div>';
    }
    el.innerHTML = html;
  }

  function renderColorBadge(color) {
    var el = document.getElementById('unoColorBadge');
    if (!el) return;
    if (color && COLOR_HEX[color]) {
      el.style.background = COLOR_HEX[color];
      el.style.color = COLOR_TEXT[color];
      el.textContent = tf('uno_current', COLOR_NAMES[color] || color);
    } else {
      el.style.background = '#999';
      el.textContent = t('uno_not_started');
    }
  }

  function renderDiscard(discard, discardChanged) {
    var el = document.getElementById('unoDiscardCard');
    if (!el) return;
    if (!discard || discard.length === 0) {
      el.innerHTML = '';
      return;
    }
    var top = discard[0];
    el.className = 'uno-discard-card';
    el.style.background = '';
    el.innerHTML = cardFace(top);
    if (discardChanged) {
      void el.offsetWidth;
      el.classList.add('play-flash');
      clearTimeout(el._animTimer);
      el._animTimer = setTimeout(function() {
        el.classList.remove('play-flash');
      }, 460);
    }
  }

  function renderDrawPile(deck, drawStack) {
    var el = document.getElementById('unoDrawPile');
    if (!el) return;
    var count = (deck && deck.length) || 0;
    el.innerHTML = cardBack() +
      '<div class="uno-pile-count">' + count + ' ' + t('uno_remaining') + '</div>' +
      (drawStack > 0 ? '<div class="uno-draw-stack">+' + drawStack + '</div>' : '');
  }

  function renderHand(hand, discard, currentColor, isMyTurn, drewCard) {
    var el = document.getElementById('unoHand');
    if (!el) return;
    if (!hand || hand.length === 0) {
      el.innerHTML = '';
      return;
    }
    var top = (discard && discard[0]) || null;
    var html = '';
    for (var i = 0; i < hand.length; i++) {
      var c = hand[i];
      var playable = isMyTurn && canPlayCard(c, top, currentColor);
      // Off-turn the whole hand is dimmed; on your turn only the unplayable cards are
      var stateCls = isMyTurn ? (playable ? ' playable' : ' not-playable') : ' not-playable';
      var newCardCls = drewCard && i === hand.length - 1 ? ' new-card' : '';
      html += '<div class="uno-card' + stateCls + newCardCls + '" data-card-id="' + c.id + '">' + cardFace(c) + '</div>';
    }
    el.innerHTML = html;

    // Click handlers
    var cards = el.children;
    for (var j = 0; j < cards.length; j++) {
      (function(cardEl, cardData) {
        cardEl.addEventListener('click', function() {
          if (!isMyTurn) {
            showToast(t('uno_opponent_turn'));
            return;
          }
          if (!canPlayCard(cardData, top, currentColor)) {
            showToast(t('uno_cannot_play'));
            return;
          }
          if (cardData.color === 'wild') {
            window._pendingWildCard = cardData.id;
            document.getElementById('unoColorPicker').style.display = 'flex';
          } else {
            window.makeGameMove({ cardId: cardData.id });
          }
        });
      })(cards[j], hand[j]);
    }
  }

  function renderButtons(hand, drawStack, isMyTurn, unoCalled) {
    var drawBtn = document.getElementById('drawBtn');
    var unoBtn = document.getElementById('unoBtn');
    if (!drawBtn || !unoBtn) return;

    if (isMyTurn) {
      drawBtn.style.display = '';
      drawBtn.textContent = drawStack > 0 ? tf('uno_draw_stack', drawStack) : t('uno_draw');
      drawBtn.disabled = false;

      if (hand && hand.length === 1) {
        unoBtn.style.display = '';
        if (unoCalled) {
          unoBtn.className = 'btn btn-sm';
          unoBtn.style.background = '#2ecc71';
          unoBtn.style.color = '#fff';
          unoBtn.style.border = 'none';
          unoBtn.textContent = 'UNO ✅';
        } else {
          unoBtn.className = 'btn btn-sm uno-btn-warn';
          unoBtn.textContent = 'UNO!';
        }
      } else {
        unoBtn.style.display = 'none';
      }
    } else {
      drawBtn.style.display = 'none';
      unoBtn.style.display = 'none';
    }
  }

  // Tracks the last challenge so we can reveal the result AFTER it resolves.
  var lastChallengeState = null;

  function renderChallenge(state, playerIndex) {
    var overlay = document.getElementById('unoChallenge');
    if (!overlay) return;
    var ch = state.pendingChallenge;

    // Challenge resolved: reveal whether the +4 player held a matching card.
    if (!ch && lastChallengeState) {
      var prev = lastChallengeState;
      lastChallengeState = null;
      var hadMatch = (prev.handSnapshot || []).some(function(c) { return c.color === prev.priorColor; });
      var byName = (window.gamePlayers && window.gamePlayers[prev.by]) ? window.gamePlayers[prev.by].name : tf('uno_player', prev.by + 1);
      if (hadMatch) {
        showToast(tf('uno_challenge_result_cheat', byName)); // +4 player cheated, they draw 4
      } else {
        showToast(tf('uno_challenge_result_clean', byName)); // +4 was legal, challenger draws 6
      }
      overlay.style.display = 'none';
      return;
    }

    if (!ch) { overlay.style.display = 'none'; return; }
    lastChallengeState = ch;

    // Only the target player decides; others see a waiting note.
    // IMPORTANT: do NOT reveal the hand here — the challenge must be a blind
    // decision. The hand is only shown after the challenge resolves.
    var isTarget = ch.target === playerIndex;
    var byName = (window.gamePlayers && window.gamePlayers[ch.by]) ? window.gamePlayers[ch.by].name : tf('uno_player', ch.by + 1);

    var titleEl = overlay.querySelector('.overlay-card > div:first-child');
    var hintEl = overlay.querySelector('.overlay-card > div:nth-child(2)');
    var btns = overlay.querySelector('#unoChallengeAccept').parentNode;

    if (isTarget) {
      if (titleEl) titleEl.textContent = t('uno_challenge_title');
      if (hintEl) hintEl.textContent = tf('uno_challenge_hint', byName);
      btns.style.display = '';
    } else {
      if (titleEl) titleEl.textContent = tf('uno_challenge_wait_title', byName);
      if (hintEl) hintEl.textContent = t('uno_challenge_wait_hint');
      btns.style.display = 'none';
    }
    overlay.style.display = 'flex';
  }

  function canPlayCard(card, topCard, currentColor) {
    if (!card) return false;
    if (card.color === 'wild') return true;
    if (!topCard) return true;
    if (card.value === topCard.value) return true;
    if (card.color === currentColor) return true;
    return false;
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.classList.remove('show'); }, 1800);
  }
})();
