// public/js/renderers/uno.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var VALUE_LABELS = {
    '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
    'skip':'⊘', 'reverse':'↻', '+2':'+2',
    'wild':'★', '+4':'+4'
  };

  var COLOR_HEX = { red:'#e74c3c', blue:'#3498db', green:'#2ecc71', yellow:'#f1c40f', wild:'#555' };
  var COLOR_TEXT = { red:'#fff', blue:'#fff', green:'#fff', yellow:'#222', wild:'#fff' };
  var COLOR_NAMES = { red:'红', blue:'蓝', green:'绿', yellow:'黄' };
  var COLOR_ORDER = ['red','blue','green','yellow'];
  var lastDiscardKey = null;
  var lastHandSignature = null;

  var STYLES = '' +
    '.uno-table{width:100%;display:flex;flex-direction:column;gap:5px;}' +
    '.uno-opponents{display:flex;flex-wrap:wrap;gap:5px;}' +
    '.uno-opponent{flex:1;min-width:100px;display:flex;flex-direction:column;align-items:flex-start;padding:6px 10px;background:var(--bg);border-radius:12px;font-size:12px;font-weight:600;border:2px solid transparent;transition:border-color .25s;}' +
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
    '.uno-draw-pile{width:76px;height:110px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#2a2a2a;color:#fff;border:2px dashed #555;box-shadow:0 2px 10px rgba(0,0,0,.1);}' +
    '.uno-draw-pile .dc{font-size:22px;font-weight:800;}' +
    '.uno-draw-pile .dl{font-size:10px;color:#999;margin-top:1px;}' +
    '.uno-draw-stack{position:absolute;top:-6px;right:-6px;background:#e74c3c;color:#fff;font-size:11px;font-weight:700;padding:1px 7px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.2);}' +
    '.uno-dir-arrow{font-size:16px;margin:0 3px;}' +
    '.uno-hand-wrap{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;padding:4px 2px;margin:0 -4px;}' +
    '.uno-hand-wrap::-webkit-scrollbar{height:3px;}' +
    '.uno-hand-wrap::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px;}' +
    '.uno-hand{display:flex;gap:6px;padding:2px 4px;min-height:90px;}' +
    '.uno-card{width:60px;height:88px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,.13);cursor:pointer;transition:transform .15s,opacity .15s,box-shadow .15s;flex-shrink:0;position:relative;}' +
    '.uno-card.new-card{animation:unoNewCardIn .38s ease;}' +
    '.uno-card:active{transform:scale(.94);}' +
    '.uno-card.wild-rainbow{background:linear-gradient(135deg,#e74c3c 25%,#3498db 25%,#3498db 50%,#2ecc71 50%,#2ecc71 75%,#f1c40f 75%);color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.4);}' +
    '.uno-card .cv{font-size:22px;line-height:1;}' +
    '.uno-card .cl{font-size:8px;opacity:.8;margin-top:1px;text-transform:uppercase;}' +
    '.uno-card.not-playable{opacity:.35;cursor:default;}' +
    '.uno-card.not-playable:active{transform:none;}' +
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
      '.uno-discard-card{width:60px;height:88px;}' +
      '.uno-discard-card .dv{font-size:22px;}' +
      '.uno-draw-pile{width:60px;height:88px;}' +
      '.uno-draw-pile .dc{font-size:18px;}' +
      '.uno-play-area{gap:14px;}' +
      '.uno-card{width:44px;height:70px;border-radius:8px;}' +
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
      '.uno-discard-card,.uno-draw-pile{width:50px;height:74px;}' +
      '.uno-discard-card .dv{font-size:20px;}' +
      '.uno-draw-pile .dc{font-size:16px;}' +
      '.uno-card{width:40px;height:62px;border-radius:7px;}' +
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
      if (!document.getElementById('unoRendererStyles')) {
        var el = document.createElement('style');
        el.id = 'unoRendererStyles';
        el.textContent = STYLES;
        document.head.appendChild(el);
      }

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
                '<div class="dc">0</div><div class="dl">剩余</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="uno-hand-wrap" id="unoHandWrap"><div class="uno-hand" id="unoHand"></div></div>' +
          '<div id="unoScrollHint" style="display:none;text-align:center;font-size:11px;color:var(--text-muted);padding:2px 0;">👈 左右滑动查看全部手牌 →</div>' +
          '<div class="uno-actions">' +
            '<button class="btn btn-outline btn-sm" id="drawBtn">摸牌</button>' +
            '<button class="btn btn-outline btn-sm" id="unoBtn" style="display:none">UNO!</button>' +
          '</div>' +
        '</div>' +
        '<div class="overlay" id="unoColorPicker" style="display:none">' +
          '<div class="overlay-card">' +
            '<div style="font-size:18px;font-weight:700;margin-bottom:10px">选择颜色</div>' +
            '<div class="uno-color-picker-btns" id="unoColorBtns"></div>' +
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
      var drewCard = lastHandSignature !== null && handSignature !== lastHandSignature && (hands[playerIndex] || []).length > 0;

      renderOpponents(hands, currentPlayer, playerIndex, unoCalled);
      renderColorBadge(currentColor);
      renderDiscard(discard, discardChanged);
      renderDrawPile(deck, drawStack);
      renderHand(hands[playerIndex] || [], discard, currentColor, isMyTurn, drewCard);
      renderButtons(hands[playerIndex] || [], drawStack, isMyTurn, unoCalled[playerIndex]);
      lastDiscardKey = discardKey;
      lastHandSignature = handSignature;

      // Scroll hint for small screens with many cards
      var hand = hands[playerIndex] || [];
      var hintEl = document.getElementById('unoScrollHint');
      var handWrap = document.getElementById('unoHandWrap');
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
      var backs = '';
      for (var b = 0; b < Math.min(count, 15); b++) backs += '<div class="mini-back"></div>';
      html += '' +
        '<div class="uno-opponent' + active + '">' +
          '<div class="opp-top">' +
            '<span>' + ((window.gamePlayers && window.gamePlayers[i]) ? window.gamePlayers[i].name : ('玩家 ' + (i + 1))) +
              (called ? ' <span style="background:#2ecc71;color:#fff;font-size:9px;padding:1px 5px;border-radius:6px;font-weight:700;">UNO</span>' : '') +
              (notCalled ? ' <span style="color:#e74c3c;font-size:9px;font-weight:700;">⚠1张</span>' : '') +
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
      el.textContent = '当前' + (COLOR_NAMES[color] || color);
    } else {
      el.style.background = '#999';
      el.textContent = '游戏未开始';
    }
  }

  function renderDiscard(discard, discardChanged) {
    var el = document.getElementById('unoDiscardCard');
    if (!el) return;
    if (!discard || discard.length === 0) {
      el.style.background = '#ccc';
      el.style.color = '#666';
      el.innerHTML = '<div class="dv">-</div><div class="dl"></div>';
      return;
    }
    var top = discard[0];
    var bg = top.color === 'wild' ? '' : COLOR_HEX[top.color] || '#ccc';
    var fg = top.color === 'wild' ? '#fff' : COLOR_TEXT[top.color] || '#fff';
    var wildCls = top.color === 'wild' ? ' wild-card' : '';
    el.className = 'uno-discard-card' + wildCls;
    el.style.background = top.color !== 'wild' ? bg : '';
    el.style.color = fg;
    el.innerHTML = '<div class="dv">' + (VALUE_LABELS[top.value] || top.value) + '</div>' +
      '<div class="dl">' + (COLOR_NAMES[top.color] || top.color.toUpperCase()) + '</div>';
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
    el.innerHTML = '' +
      '<div class="dc">' + count + '</div>' +
      '<div class="dl">剩余</div>' +
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
      var wildCls = c.color === 'wild' ? ' wild-rainbow' : '';
      var notPlayableCls = playable ? '' : ' not-playable';
      var bg = c.color !== 'wild' ? 'background:' + (COLOR_HEX[c.color] || '#ccc') : '';
      var fg = c.color !== 'wild' ? 'color:' + (COLOR_TEXT[c.color] || '#fff') : '';
      var newCardCls = drewCard && i === hand.length - 1 ? ' new-card' : '';
      html += '' +
        '<div class="uno-card' + wildCls + notPlayableCls + newCardCls + '" data-card-id="' + c.id + '" style="' + bg + ';' + fg + '">' +
          '<div class="cv">' + (VALUE_LABELS[c.value] || c.value) + '</div>' +
          '<div class="cl">' + (COLOR_NAMES[c.color] || c.color.toUpperCase()) + '</div>' +
        '</div>';
    }
    el.innerHTML = html;

    // Click handlers
    var cards = el.children;
    for (var j = 0; j < cards.length; j++) {
      (function(cardEl, cardData) {
        cardEl.addEventListener('click', function() {
          if (!isMyTurn) {
            showToast('轮到对手');
            return;
          }
          if (!canPlayCard(cardData, top, currentColor)) {
            showToast('不能出这张牌');
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
      drawBtn.textContent = drawStack > 0 ? '摸牌 (+' + drawStack + ')' : '摸牌';
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
