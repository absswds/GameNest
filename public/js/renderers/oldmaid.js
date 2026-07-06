// public/js/renderers/oldmaid.js
// 抽鬼牌 (Old Maid) — Draw a specific card from opponent, discard pairs, don't hold the joker!
// Aesthetic: refined parlor-game elegance — dark wood tones, gold accents, playing card realism
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var SUIT_SYMBOLS = { s: '♠', h: '♥', c: '♣', d: '♦' };
  var SUIT_COLORS = { s: '#2c3e50', h: '#d4695a', c: '#2c3e50', d: '#d4695a' };

  var STYLES = '' +
    // === Shell ===
    '.om-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;max-width:420px;margin:0 auto;}' +

    // === Others row ===
    '.om-others{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}' +
    '.om-other{background:linear-gradient(160deg,#2c2c30,#383840);border-radius:14px;padding:8px 14px;text-align:center;' +
      'min-width:68px;border:1px solid rgba(255,255,255,.06);box-shadow:0 2px 8px rgba(0,0,0,.2);' +
      'cursor:pointer;transition:transform .15s,border-color .2s,box-shadow .2s;}' +
    '.om-other:hover{transform:translateY(-2px);}' +
    '.om-other.active{border-color:var(--accent);box-shadow:0 0 0 3px rgba(200,164,92,.15),0 4px 16px rgba(0,0,0,.25);}' +
    '.om-other.picked{border-color:#e74c3c;box-shadow:0 0 0 3px rgba(231,76,60,.25),0 4px 12px rgba(0,0,0,.25);background:linear-gradient(160deg,#3d2828,#4a2c30);}' +
    '.om-other.out{opacity:.3;cursor:default;pointer-events:none;}' +
    '.om-other .name{font-size:12px;font-weight:700;color:rgba(255,255,255,.7);}' +
    '.om-other .count{font-size:22px;font-weight:900;color:rgba(255,255,255,.5);}' +
    '.om-other.active .count{color:var(--accent);}' +
    '.om-other.picked .count{color:#e74c3c;}' +

    // === Status ===
    '.om-status{text-align:center;font-size:15px;font-weight:700;min-height:20px;letter-spacing:.3px;}' +

    // === Log ===
    '.om-log{width:100%;max-height:120px;overflow-y:auto;font-size:12px;line-height:1.8;' +
      'padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:12px;min-height:36px;}' +
    '.om-log-item{padding:1px 0;color:var(--text-muted);}' +
    '.om-log-item.hl{background:rgba(200,164,92,.08);border-radius:4px;padding:2px 6px;margin:1px -4px;color:var(--accent);font-weight:600;}' +
    '.om-log-item.drawn{color:#5dade2;font-weight:600;}' +

    // === Action ===
    '.om-action{text-align:center;font-size:14px;color:var(--accent);font-weight:600;min-height:18px;}' +

    // === Opponent hand (face-down cards to pick from) ===
    '.om-opp-section{width:100%;text-align:center;}' +
    '.om-opp-hand{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:10px;' +
      'background:linear-gradient(160deg,#3a2a1a,#4a3828);border-radius:14px;min-height:50px;align-items:center;' +
      'box-shadow:inset 0 2px 8px rgba(0,0,0,.4);border:1px solid rgba(200,164,92,.1);}' +
    '.om-opp-card{width:50px;height:72px;border-radius:9px;display:flex;align-items:center;justify-content:center;' +
      'font-weight:700;cursor:pointer;transition:transform .12s,box-shadow .15s;' +
      'background:linear-gradient(145deg,#1a3a5c,#1e4470);color:rgba(255,255,255,.85);font-size:22px;' +
      'position:relative;box-shadow:0 3px 8px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.1);}' +
    '.om-opp-card::after{content:"";position:absolute;inset:3px;border:1px solid rgba(255,255,255,.1);border-radius:6px;pointer-events:none;}' +
    '.om-opp-card:hover{transform:translateY(-8px);box-shadow:0 10px 22px rgba(0,0,0,.4);}' +
    '.om-opp-card:active{transform:scale(.88);}' +

    // === Back button ===
    '.om-back-btn{display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;color:rgba(255,255,255,.6);' +
      'background:rgba(255,255,255,.06);padding:5px 14px;border-radius:20px;margin-bottom:8px;transition:background .15s;}' +
    '.om-back-btn:hover{background:rgba(255,255,255,.12);}' +

    // === My hand ===
    '.om-hand-title{font-size:13px;font-weight:700;color:var(--text-muted);margin-top:4px;letter-spacing:1px;}' +
    '.om-my-hand{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:100%;min-height:36px;padding:0 4px;}' +

    // === Cards — poker realism ===
    '.om-card{width:58px;height:84px;border-radius:10px;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;font-weight:700;transition:transform .12s,box-shadow .15s,opacity .3s;position:relative;' +
      'background:linear-gradient(160deg,#fff,#f0ede8);color:#1a1a1a;' +
      'box-shadow:0 3px 10px rgba(0,0,0,.15),inset 0 0 0 1px rgba(0,0,0,.04);flex-shrink:0;}' +
    '.om-card::after{content:"";position:absolute;inset:3px;border:1px solid rgba(0,0,0,.06);border-radius:7px;pointer-events:none;}' +
    '.om-card.joker{background:linear-gradient(160deg,#1a1a1a,#2d1a1a);color:#e74c3c;box-shadow:0 3px 12px rgba(180,0,0,.25);}' +
    '.om-card.joker::after{border-color:rgba(231,76,60,.2);}' +
    '.om-card.drawn{animation:omaDrawPulse .5s ease;}' +
    '.om-card .suit{font-size:15px;line-height:1;}' +
    '.om-card .rank{font-size:19px;line-height:1;}' +
    '.om-card .corner{position:absolute;top:4px;left:5px;font-size:10px;display:flex;flex-direction:column;align-items:center;line-height:1;}' +
    '.om-card.joker .rank{font-size:22px;}' +

    // === Empty message ===
    '.om-empty-hint{color:var(--text-muted);font-size:13px;font-style:italic;}' +

    // === Animations ===
    '@keyframes omaDrawPulse{0%{box-shadow:0 0 0 0 rgba(200,164,92,.5);}50%{box-shadow:0 0 0 14px rgba(200,164,92,0);}100%{box-shadow:0 3px 10px rgba(0,0,0,.15);}}' +
    '@keyframes omaPairPop{0%{transform:scale(1);}40%{transform:scale(1.15);}100%{transform:scale(1);}}' +

    // === Responsive ===
    '@media(max-width:400px){.om-card{width:46px;height:68px;border-radius:8px;}.om-card .rank{font-size:16px;}.om-card .suit{font-size:12px;}.om-opp-card{width:42px;height:60px;font-size:18px;}}';

  var RANK_DISPLAY = { 'A': 'A', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', '👻': '👻' };

  function renderCard(card, isDrawn) {
    var isJoker = card.rank === '👻';
    var suitSym = SUIT_SYMBOLS[card.suit] || '';
    var colorCls = isJoker ? 'joker' : ((card.suit === 'h' || card.suit === 'd') ? 'red' : 'black');
    var rankDisplay = RANK_DISPLAY[card.rank] || card.rank;
    var cls = 'om-card' + (isJoker ? ' joker' : '') + (isDrawn ? ' drawn' : '');
    return '<div class="' + cls + '">' +
      '<div class="corner"><span>' + rankDisplay + '</span><span style="font-size:8px;color:' + (SUIT_COLORS[card.suit] || '#1a1a1a') + '">' + suitSym + '</span></div>' +
      '<span class="rank" style="color:' + (isJoker ? '#e74c3c' : (SUIT_COLORS[card.suit] || '#1a1a1a')) + '">' + rankDisplay + '</span>' +
      (!isJoker ? '<span class="suit" style="color:' + (SUIT_COLORS[card.suit] || '#1a1a1a') + '">' + suitSym + '</span>' : '') +
      '</div>';
  }

  window.gameRenderers.set('oldmaid', {
    init: function(container) {
      injectStylesOnce('omStyles', STYLES);
      container.innerHTML = '' +
        '<div class="om-wrap">' +
          '<div class="om-others" id="omOthers"></div>' +
          '<div class="om-status" id="omStatus"></div>' +
          '<div class="om-action" id="omAction"></div>' +
          '<div id="omOppHand"></div>' +
          '<div class="om-log" id="omLog"></div>' +
          '<div class="om-hand-title">' + _t('om_my_hand') + '</div>' +
          '<div class="om-my-hand" id="omHand"></div>' +
        '</div>';
    },
    render: function(state, container, playerIndex, winner) {
      var hands = state.hands || [];
      var loser = state.loser;
      var currentPlayer = state.currentPlayer;
      var lastDraw = state.lastDraw;
      var messages = state.messages || [];
      var oppWrap = document.getElementById('omOppHand');
      var pickingFrom = oppWrap ? parseInt(oppWrap.dataset.pickingFrom || '') : -1;
      if (isNaN(pickingFrom)) pickingFrom = -1;

      // Other players — elegant pill badges
      var othersHtml = '';
      for (var i = 0; i < hands.length; i++) {
        if (i === playerIndex) continue;
        var hasCards = hands[i] && hands[i].length > 0;
        var isActive = currentPlayer === i;
        var isOut = !hasCards;
        var isMyTurn = currentPlayer === playerIndex && hands[playerIndex] && hands[playerIndex].length > 0;
        var cls = 'om-other' + (isActive ? ' active' : '') + (isOut ? ' out' : '') + (pickingFrom === i ? ' picked' : '');
        var clickable = isMyTurn && hasCards;
        othersHtml += '<div class="' + cls + '"' +
          (clickable ? ' onclick="window._omPickPlayer(' + i + ')"' : '') +
          '><div class="name">' + _t('om_player') + (i + 1) + '</div>' +
          '<div class="count">🃏×' + (hands[i] ? hands[i].length : 0) + '</div></div>';
      }
      var othersEl = document.getElementById('omOthers');
      if (othersEl) othersEl.innerHTML = othersHtml || '<div style="color:var(--text-muted);font-size:13px;">' + _t('om_waiting_for_players') + '</div>';

      // Status
      var statusEl = document.getElementById('omStatus');
      if (statusEl) {
        statusEl.style.color = '';
        if (loser !== undefined && loser !== null) {
          if (loser === -1) { statusEl.textContent = _t('om_draw'); statusEl.style.color = '#58d68d'; }
          else if (loser === playerIndex) { statusEl.textContent = _t('om_lost'); statusEl.style.color = '#e74c3c'; }
          else { statusEl.textContent = _t('om_won'); statusEl.style.color = '#58d68d'; }
        } else if (hands[playerIndex] && hands[playerIndex].length === 0) {
          statusEl.textContent = _t('om_no_cards');
          statusEl.style.color = 'var(--text-muted)';
        } else if (currentPlayer === playerIndex) {
          if (pickingFrom >= 0) {
            statusEl.textContent = _tf('om_pick_card', _t('om_player') + (pickingFrom + 1));
            statusEl.style.color = 'var(--accent)';
          } else {
            statusEl.textContent = _t('om_your_turn');
            statusEl.style.color = 'var(--accent)';
          }
        } else {
          statusEl.textContent = _tf('om_opponent_drawing', _t('om_player') + (currentPlayer + 1));
          statusEl.style.color = 'var(--text-muted)';
        }
      }

      // Action — show the drawn card name if I just drew from someone
      var actionEl = document.getElementById('omAction');
      if (actionEl) {
        if (lastDraw && lastDraw.to === playerIndex) {
          var drawnSym = lastDraw.card.suit ? SUIT_SYMBOLS[lastDraw.card.suit] : '';
          var drawnName = lastDraw.card.rank + drawnSym;
          actionEl.innerHTML = _tf('om_you_drew', _t('om_player') + (lastDraw.from + 1), drawnName);
        } else if (lastDraw && lastDraw.from === playerIndex) {
          actionEl.innerHTML = _tf('om_opponent_drew_from_you', _t('om_player') + (lastDraw.to + 1)) +
            (lastDraw.cardDrawn ? ' <span style="opacity:.7;">(' + lastDraw.cardDrawn + ')</span>' : '');
        } else if (lastDraw && lastDraw.from >= 0) {
          actionEl.textContent = _t('om_player') + (lastDraw.to + 1) + ' ← ' + _t('om_player') + (lastDraw.from + 1);
        } else {
          actionEl.textContent = '';
        }
      }

      // Message log — styled event list
      var logEl = document.getElementById('omLog');
      if (logEl && messages.length > 0) {
        var logHtml = '';
        for (var m = messages.length - 1; m >= 0; m--) {
          var msg = messages[m];
          var itemCls = 'om-log-item';
          if (msg.highlight) itemCls += ' hl';
          if (msg.cardDrawn) itemCls += ' drawn';
          logHtml += '<div class="' + itemCls + '">' + msg.text + '</div>';
        }
        logEl.innerHTML = logHtml;
        logEl.scrollTop = 0;
      }

      // Opponent's hand (face-down cards to pick from)
      if (oppWrap) {
        if (pickingFrom >= 0 && hands[pickingFrom] && hands[pickingFrom].length > 0) {
          var oppCards = hands[pickingFrom];
          var cardsHtml = '<div class="om-opp-section">' +
            '<span class="om-back-btn" onclick="window._omCancelPick()">' + _t('om_pick_another') + '</span>' +
            '<div class="om-opp-hand">';
          for (var c = 0; c < oppCards.length; c++) {
            cardsHtml += '<div class="om-opp-card" onclick="window._omDrawCard(' + c + ')">🂠</div>';
          }
          cardsHtml += '</div></div>';
          oppWrap.innerHTML = cardsHtml;
          oppWrap.style.display = 'block';
        } else {
          oppWrap.innerHTML = '';
          oppWrap.style.display = 'none';
        }
        oppWrap.dataset.pickingFrom = pickingFrom;
      }

      // My hand
      var handEl = document.getElementById('omHand');
      if (handEl && hands[playerIndex]) {
        var myHand = hands[playerIndex];
        var handHtml = '';
        for (var h = 0; h < myHand.length; h++) {
          var isDrawn = lastDraw && lastDraw.to === playerIndex && h === myHand.length - 1;
          handHtml += renderCard(myHand[h], isDrawn);
        }
        handEl.innerHTML = handHtml || '<div class="om-empty-hint">' + _t('om_hand_empty') + '</div>';
      }
    }
  });

  window._omPickPlayer = function(fromIndex) {
    var wrap = document.getElementById('omOppHand');
    if (wrap) { wrap.dataset.pickingFrom = fromIndex; }
    window.makeGameMove({ _ping: true });
  };

  window._omDrawCard = function(cardIndex) {
    var wrap = document.getElementById('omOppHand');
    if (!wrap) return;
    var fromIndex = parseInt(wrap.dataset.pickingFrom || '');
    if (isNaN(fromIndex)) return;
    wrap.dataset.pickingFrom = -1;
    window.makeGameMove({ drawFrom: fromIndex, cardIndex: cardIndex });
  };

  window._omCancelPick = function() {
    var wrap = document.getElementById('omOppHand');
    if (wrap) { wrap.dataset.pickingFrom = -1; }
    window.makeGameMove({ _ping: true });
  };
})();
