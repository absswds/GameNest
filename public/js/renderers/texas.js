// public/js/renderers/texas.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var SUIT_SYMBOL = { s: '♠', h: '♥', c: '♣', d: '♦' };
  var SUIT_COLOR = { s: '#1a1a1a', h: '#e74c3c', c: '#1a1a1a', d: '#e74c3c' };

  var raiseAmount = 0;

  window.gameRenderers.set('texas', {
    init: function(container) {
      container.innerHTML =
        '<div id="txWrap" style="width:100%;max-width:420px;display:flex;flex-direction:column;gap:10px;font-family:inherit;">' +
          '<div id="txOpponents" style="display:flex;justify-content:space-around;gap:8px;flex-wrap:wrap;"></div>' +
          '<div id="txCommunity" style="min-height:80px;background:var(--bg);border-radius:var(--radius-sm);padding:12px 16px;display:flex;flex-direction:column;align-items:center;gap:8px;">' +
            '<div style="font-size:12px;color:var(--text-muted);">' + _t('tx_community') + '</div>' +
            '<div id="txCommunityCards" style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;"></div>' +
            '<div id="txPot" style="font-size:18px;font-weight:800;color:var(--accent);"></div>' +
            '<div id="txPhase" style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;"></div>' +
          '</div>' +
          '<div id="txHoleCards" style="display:flex;gap:6px;justify-content:center;padding:8px 0;"></div>' +
          '<div id="txChips" style="text-align:center;font-size:14px;font-weight:600;"></div>' +
          '<div id="txActions" style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;"></div>' +
          '<div id="txRaiseInput" style="display:none;text-align:center;gap:8px;">' +
            '<input id="txRaiseAmount" type="number" style="width:100px;text-align:center;background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:8px;font-size:14px;font-weight:600;" min="0">' +
            '<button class="btn btn-sm btn-accent" onclick="window._txConfirmRaise()">' + _t('tx_confirm_raise') + '</button>' +
          '</div>' +
          '<div id="txShowdown" style="display:none;background:var(--bg);border-radius:var(--radius-sm);padding:12px;"></div>' +
        '</div>';
    },

    render: function(state, container, playerIndex, winner) {
      if (!state) return;
      // Support per-player view or raw state
      var s = state.communityCards ? state : state;
      this.renderOpponents(s, playerIndex);
      this.renderCommunity(s);
      this.renderHoleCards(s, playerIndex, winner);
      this.renderChips(s, playerIndex);
      this.renderActions(s, playerIndex, winner);
      if (s.showdownHands && s.showdownHands.length > 0) this.renderShowdown(s, playerIndex);
    },

    renderOpponents: function(s, selfIdx) {
      var el = document.getElementById('txOpponents');
      if (!el) return;
      var html = '';
      var chips = s.chips || [];
      var folded = s.folded || [];
      var allIn = s.allIn || [];
      var bets = s.bets || [];

      for (var i = 0; i < chips.length; i++) {
        if (i === selfIdx) continue;
        var name = window.getPlayerName ? window.getPlayerName(i) : (_t('tx_player') + (i + 1));
        var isActive = s.currentPlayer === i;
        var isFolded = folded[i];
        var isAllIn = allIn[i];
        var isDealer = s.dealer === i;
        var isBB = s.bigBlind === i;
        var isSB = s.smallBlind === i;

        var statusTag = '';
        if (isFolded) statusTag = '<span style="font-size:10px;color:var(--danger);">' + _t('tx_folded') + '</span>';
        else if (isAllIn) statusTag = '<span style="font-size:10px;color:var(--accent);">ALL IN!</span>';
        else if (isDealer) statusTag = '<span style="font-size:10px;color:var(--text-muted);">' + _t('tx_dealer') + '</span>';

        var blindTag = '';
        if (isBB && !isFolded) blindTag = ' BB';
        if (isSB && !isFolded) blindTag = ' SB';

        html +=
          '<div class="' + (isActive ? 'is-active-turn' : '') + '" style="text-align:center;padding:6px 10px;background:var(--bg);border-radius:12px;' +
          (isActive ? '' : 'border:1px solid var(--border);') +
          (isFolded ? 'opacity:0.5;' : '') + '">' +
          '<div style="font-size:12px;font-weight:600;">' + name + blindTag + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);">$' + (chips[i] || 0) + '</div>' +
          (bets[i] > 0 ? '<div style="font-size:11px;color:var(--accent);font-weight:600;">' + _t('tx_bet') + bets[i] + '</div>' : '') +
          '<div>' + statusTag + '</div>' +
          '</div>';
      }
      el.innerHTML = html;
    },

    renderCommunity: function(s) {
      var el = document.getElementById('txCommunityCards');
      if (!el) return;
      var communityCards = s.communityCards || [];
      var html = '';
      for (var i = 0; i < 5; i++) {
        if (i < communityCards.length) {
          var c = communityCards[i];
          html += cardSpan(c);
        } else {
          html += cardBackSpan();
        }
      }
      el.innerHTML = html;

      var phaseNames = { preflop: _t('tx_phase_preflop'), flop: _t('tx_phase_flop'), turn: _t('tx_phase_turn'), river: _t('tx_phase_river'), showdown: _t('tx_showdown') };
      var phaseEl = document.getElementById('txPhase');
      if (phaseEl) phaseEl.textContent = phaseNames[s.phase] || s.phase;

      var potEl = document.getElementById('txPot');
      if (potEl) potEl.textContent = _t('tx_pot') + (s.pot || 0);
    },

    renderHoleCards: function(s, selfIdx, winner) {
      var el = document.getElementById('txHoleCards');
      if (!el) return;
      var holeCards = s.holeCards || (s.hands && s.hands[selfIdx]) || [];
      if (holeCards.length === 0) { el.innerHTML = ''; return; }

      var html = '<div style="font-size:12px;color:var(--text-muted);text-align:center;">' + _t('tx_your_hand') + '</div><div style="display:flex;gap:6px;">';
      for (var i = 0; i < holeCards.length; i++) {
        html += cardSpan(holeCards[i]);
      }
      html += '</div>';
      el.innerHTML = html;
    },

    renderChips: function(s, selfIdx) {
      var el = document.getElementById('txChips');
      if (!el) return;
      var myChips = (s.chips || [])[selfIdx] || 0;
      var myBet = (s.bets || [])[selfIdx] || 0;
      var isAllIn = (s.allIn || [])[selfIdx];
      var isFolded = (s.folded || [])[selfIdx];
      var text = _t('tx_your_chips') + myChips;
      if (myBet > 0) text += _t('tx_bet_appendix') + myBet + ')';
      if (isAllIn) text = 'ALL IN! 💎 ' + _t('tx_all_in_text');
      if (isFolded) text = _t('tx_folded');
      el.textContent = text;
    },

    renderActions: function(s, selfIdx, winner) {
      var el = document.getElementById('txActions');
      if (!el) return;
      var raiseInput = document.getElementById('txRaiseInput');
      var myTurn = s.currentPlayer === selfIdx && winner == null;
      var isFolded = (s.folded || [])[selfIdx];
      var isAllIn = (s.allIn || [])[selfIdx];

      if (!myTurn || isFolded || isAllIn || s.phase === 'showdown') {
        el.innerHTML = '';
        if (raiseInput) raiseInput.style.display = 'none';
        return;
      }

      var chips = (s.chips || [])[selfIdx] || 0;
      var myBet = (s.bets || [])[selfIdx] || 0;
      var toCall = (s.currentBet || 0) - myBet;
      var canCheck = toCall <= 0;
      var minRaise = s.currentBet + ((s.lastRaise || 0) > 0 ? s.lastRaise : s.currentBet > 0 ? s.currentBet : 10);

      var html = '';
      html += '<button class="btn btn-sm btn-outline" onclick="window._txFold()">' + _t('tx_fold') + '</button>';
      if (canCheck) {
        html += '<button class="btn btn-sm btn-primary" onclick="window._txCheck()">' + _t('tx_check') + '</button>';
        if (chips > 10) html += '<button class="btn btn-sm btn-accent" onclick="window._txShowRaise()">' + _t('tx_raise') + '</button>';
      } else {
        if (chips > toCall) {
          html += '<button class="btn btn-sm btn-primary" onclick="window._txCall()">' + _t('tx_call') + toCall + '</button>';
          if (chips > minRaise) html += '<button class="btn btn-sm btn-accent" onclick="window._txShowRaise()">' + _t('tx_raise') + '</button>';
        }
        html += '<button class="btn btn-sm" style="background:var(--danger);color:#fff;" onclick="window._txAllIn()">' + _t('tx_all_in') + '</button>';
      }

      el.innerHTML = html;
    },

    renderShowdown: function(s, selfIdx) {
      var el = document.getElementById('txShowdown');
      if (!el || !s.showdownHands) return;
      el.style.display = '';
      var html = '<div style="font-size:14px;font-weight:700;margin-bottom:8px;">' + _t('tx_showdown') + '</div>';
      var typeNames = { high_card: _t('tx_hand_high_card'), pair: _t('tx_hand_pair'), two_pair: _t('tx_hand_two_pair'), three: _t('tx_hand_three'), straight: _t('tx_hand_straight'), flush: _t('tx_hand_flush'), full_house: _t('tx_hand_full_house'), four: _t('tx_hand_four'), straight_flush: _t('tx_hand_straight_flush') };
      for (var i = 0; i < s.showdownHands.length; i++) {
        var h = s.showdownHands[i];
        var name = window.getPlayerName ? window.getPlayerName(h.player) : (_t('tx_player') + (h.player + 1));
        var isMe = h.player === selfIdx;
        var handType = typeNames[h.hand.type] || h.hand.type;
        var isWinner = s.showdownWinner === h.player;

        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;' + (isWinner ? 'background:#fef9e7;border-radius:8px;padding:8px;' : '') + '">';
        html += '<span style="font-size:13px;font-weight:600;">' + (isMe ? '⭐' : '') + name + '</span>';
        html += '<span style="font-size:11px;color:var(--text-muted);">' + handType + '</span>';
        html += '<div style="display:flex;gap:3px;">';
        for (var j = 0; j < h.cards.length; j++) {
          html += cardSpan(h.cards[j]);
        }
        html += '</div>';
        if (isWinner) html += '<span style="font-size:12px;color:var(--accent);font-weight:700;">' + _t('tx_winner') + '</span>';
        html += '</div>';
      }
      el.innerHTML = html;
    }
  });

  function cardSpan(c) {
    var color = SUIT_COLOR[c.suit] || '#1a1a1a';
    var label = SUIT_SYMBOL[c.suit] + c.rank;
    return '<span style="display:inline-flex;align-items:center;justify-content:center;' +
      'width:44px;height:58px;border-radius:8px;' +
      'background:#fff;border:1px solid var(--border);' +
      'font-size:14px;font-weight:700;color:' + color + ';' +
      'box-shadow:0 1px 4px rgba(0,0,0,0.1);line-height:1;">' +
      label + '</span>';
  }

  function cardBackSpan() {
    return '<span style="display:inline-flex;align-items:center;justify-content:center;' +
      'width:44px;height:58px;border-radius:8px;' +
      'background:linear-gradient(135deg,#1a1a1a 25%,#333 25%,#333 50%,#1a1a1a 50%,#1a1a1a 75%,#333 75%,#333 100%);background-size:10px 10px;' +
      'border:1px solid var(--border);' +
      'box-shadow:0 1px 4px rgba(0,0,0,0.1);opacity:0.5;">' +
      '</span>';
  }

  function showToast(msg) {
    var t = document.getElementById('toast') || (function() {
      var el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
      return el;
    })();
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2000);
  }

  window._txFold = function() { window.makeGameMove({ action: 'fold' }); };
  window._txCheck = function() { window.makeGameMove({ action: 'check' }); };
  window._txCall = function() { window.makeGameMove({ action: 'call' }); };
  window._txAllIn = function() { window.makeGameMove({ action: 'all_in' }); };

  window._txShowRaise = function() {
    var el = document.getElementById('txRaiseInput');
    if (el) el.style.display = 'flex';
    var input = document.getElementById('txRaiseAmount');
    if (input && window._txState) {
      var s = window._txState;
      var minRaise = s.currentBet + ((s.lastRaise || 0) > 0 ? s.lastRaise : 10);
      input.min = minRaise;
      input.value = minRaise;
    }
  };

  window._txConfirmRaise = function() {
    var input = document.getElementById('txRaiseAmount');
    var amount = parseInt(input.value);
    if (isNaN(amount) || amount <= 0) { showToast(_t('tx_invalid_amount')); return; }
    window.makeGameMove({ action: 'raise', amount: amount });
    var el = document.getElementById('txRaiseInput');
    if (el) el.style.display = 'none';
  };

  // Hook render to cache state
  var origRender = window.gameRenderers.get('texas').render;
  window.gameRenderers.get('texas').render = function(state, container, playerIndex, winner) {
    window._txState = state;
    origRender.call(this, state, container, playerIndex, winner);
  };
})();
