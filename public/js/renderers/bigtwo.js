// public/js/renderers/bigtwo.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var selected = {};
  var SUIT_SYMBOL = { s: '♠', h: '♥', c: '♣', d: '♦' };
  var SUIT_COLOR = { s: '#1a1a1a', h: '#e74c3c', c: '#1a1a1a', d: '#e74c3c' };
  var TYPE_NAMES = {
    single: 'bt_single', pair: 'bt_pair', triple: 'bt_triple',
    straight: 'bt_straight', flush: 'bt_flush', full_house: 'bt_full_house',
    four_one: 'bt_four_one', straight_flush: 'bt_straight_flush'
  };

  window.gameRenderers.set('bigtwo', {
    init: function(container) {
      container.innerHTML =
        '<div id="btWrap" style="width:100%;max-width:420px;display:flex;flex-direction:column;gap:10px;font-family:inherit;">' +
          '<div id="btOpponents" style="display:flex;justify-content:space-around;gap:8px;"></div>' +
          '<div id="btPlayArea" style="min-height:80px;background:var(--bg);border-radius:var(--radius-sm);padding:12px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;"></div>' +
          '<div id="btHint" style="display:none;text-align:center;font-size:13px;padding:4px 8px;background:var(--bg);border-radius:12px;"></div>' +
          '<div id="btHand" style="min-height:56px;display:flex;flex-wrap:wrap;justify-content:center;gap:4px;padding:8px 0;"></div>' +
          '<div id="btActions" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;"></div>' +
        '</div>';
    },

    render: function(state, container, playerIndex, winner) {
      if (!state || !state.hands) return;
      var s = state;

      this.renderOpponents(s, playerIndex);
      this.renderPlayArea(s, playerIndex);
      this.renderHand(s, playerIndex, winner);
      this.renderActions(s, playerIndex, winner);
    },

    renderOpponents: function(s, selfIdx) {
      var el = document.getElementById('btOpponents');
      if (!el) return;
      var html = '';
      for (var i = 0; i < s.hands.length; i++) {
        if (i === selfIdx) continue;
        var hand = s.hands[i] || [];
        var count = hand.length;
        var isActive = s.currentPlayer === i;
        var didPass = s.passed && s.passed[i];

        html +=
          '<div style="text-align:center;padding:8px 14px;background:var(--bg);border-radius:var(--radius-sm);' +
          (isActive ? 'border:2px solid var(--accent);animation:pulse 2s ease infinite;' : 'border:1px solid var(--border);') + '">' +
          '<div style="font-size:13px;font-weight:600;">' +
          (window.getPlayerName ? window.getPlayerName(i) : (_t('bt_player_fallback') + (i + 1))) +
          '</div>' +
          '<div style="font-size:22px;font-weight:800;margin-top:2px;">' + count + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);">' +
            (count === 0 ? _t('bt_finished') : _t('bt_cards_label')) +
            (didPass ? ' · <span style="color:#e74c3c;font-weight:700;">' + _t('bt_passed') + '</span>' : '') +
          '</div>' +
          '</div>';
      }
      el.innerHTML = html;
    },

    renderPlayArea: function(s, selfIdx) {
      var el = document.getElementById('btPlayArea');
      if (!el) return;

      if (s.winner != null) {
        var winnerName = window.getPlayerName ? window.getPlayerName(s.winner) : (_t('bt_player_fallback') + (s.winner + 1));
        el.innerHTML = '<div style="font-size:15px;font-weight:700;color:var(--success);">' + winnerName + _t('bt_wins') + '</div>';
        return;
      }

      var parts = [];

      // Last played cards
      if (s.lastPlay && s.lastPlay.cards) {
        var who = s.lastPlayPlayer === selfIdx ? _t('bt_you') :
          (window.getPlayerName ? window.getPlayerName(s.lastPlayPlayer) : (_t('bt_player_fallback') + (s.lastPlayPlayer + 1)));
        var lpType = s.lastPlay.play;
        var typeName = _t(TYPE_NAMES[lpType.type]) || lpType.type;
        parts.push('<div style="font-size:12px;color:var(--text-muted);">' + who + _t('bt_played') + typeName + '</div>');
        var cardsHtml = '<div style="display:flex;gap:3px;justify-content:center;flex-wrap:wrap;">';
        for (var i = 0; i < s.lastPlay.cards.length; i++) {
          cardsHtml += cardSpan(s.lastPlay.cards[i]);
        }
        cardsHtml += '</div>';
        parts.push(cardsHtml);
      } else {
        parts.push('<div style="font-size:13px;color:var(--text-muted);">' + _t('bt_new_round') + '</div>');
      }

      el.innerHTML = parts.join('');
    },

    renderHand: function(s, selfIdx, winner) {
      var el = document.getElementById('btHand');
      if (!el) return;
      var hand = s.hands[selfIdx] || [];
      if (hand.length === 0) { el.innerHTML = ''; return; }

      var myTurn = s.currentPlayer === selfIdx && winner == null;
      var html = '';
      for (var i = 0; i < hand.length; i++) {
        var c = hand[i];
        var isSel = selected[c.id] ? true : false;
        var style = 'display:inline-flex;align-items:center;justify-content:center;' +
          'width:48px;height:64px;border-radius:8px;' +
          'background:#fff;border:1px solid var(--border);' +
          'font-size:14px;font-weight:700;cursor:' + (myTurn ? 'pointer' : 'default') + ';' +
          'transition:transform 0.12s,box-shadow 0.12s;' +
          'box-shadow:0 1px 4px rgba(0,0,0,0.1);line-height:1;';
        if (isSel) {
          style += 'transform:translateY(-16px);box-shadow:0 4px 12px rgba(0,0,0,0.2);border-color:var(--accent);';
        }
        var color = SUIT_COLOR[c.suit] || '#1a1a1a';
        var label = SUIT_SYMBOL[c.suit] + c.rank;
        html += '<div class="bt-card" data-id="' + c.id + '" style="' + style + 'color:' + color + ';"';
        if (myTurn) {
          html += ' onclick="window._btToggleCard(\'' + c.id + '\')"';
        }
        html += '>' + label + '</div>';
      }
      el.innerHTML = html;
    },

    renderActions: function(s, selfIdx, winner) {
      var el = document.getElementById('btActions');
      if (!el) return;
      var myTurn = s.currentPlayer === selfIdx && winner == null;
      var html = '';

      if (myTurn) {
        html += '<button class="btn btn-sm btn-primary" onclick="window._btPlay()" style="min-width:80px;">' + _t('bt_play') + '</button>';
        if (s.lastPlay && s.lastPlayPlayer !== selfIdx) {
          html += '<button class="btn btn-sm btn-outline" onclick="window._btPass()" style="min-width:80px;">' + _t('bt_pass') + '</button>';
        }
      }

      el.innerHTML = html;
    }
  });

  function cardSpan(c) {
    var color = SUIT_COLOR[c.suit] || '#1a1a1a';
    var label = SUIT_SYMBOL[c.suit] + c.rank;
    return '<span style="display:inline-flex;align-items:center;justify-content:center;' +
      'width:38px;height:50px;border-radius:6px;' +
      'background:#fff;border:1px solid var(--border);' +
      'font-size:12px;font-weight:700;color:' + color + ';' +
      'box-shadow:0 1px 3px rgba(0,0,0,0.1);line-height:1;">' +
      label + '</span>';
  }

  // ---- Card type detection (client-side) ----
  function _rankVal(rank) {
    return ['3','4','5','6','7','8','9','10','J','Q','K','A','2'].indexOf(rank);
  }

  function _isConsecutive(arr, len) {
    for (var i = 0; i < len - 1; i++) {
      if (arr[i + 1] - arr[i] !== 1) return false;
    }
    return true;
  }

  function _detectType(cards) {
    if (!cards || cards.length === 0) return null;
    var n = cards.length;
    var rvals = cards.map(function(c) { return _rankVal(c.rank); }).sort(function(a,b) { return a-b; });

    var countMap = new Map();
    for (var i = 0; i < rvals.length; i++) {
      var r = rvals[i];
      countMap.set(r, (countMap.get(r) || 0) + 1);
    }
    var groups = { 1: [], 2: [], 3: [], 4: [] };
    countMap.forEach(function(c, r) { groups[c].push(r); });
    for (var k in groups) groups[k].sort(function(a,b) { return a-b; });

    var result = null, typeName = '';
    var suits = cards.map(function(c) { return c.suit; });
    var allSameSuit = new Set(suits).size === 1;

    if (n === 1) { typeName = _t('bt_single'); result = { type: 'single', rank: rvals[0], suit: Math.max.apply(null, suits.map(function(s) { return ({s:3,h:2,c:1,d:0})[s]||0; })) }; }
    else if (n === 2 && rvals[0] === rvals[1]) {
      typeName = _t('bt_pair');
      var maxSuit = Math.max.apply(null, cards.map(function(c) { return ({s:3,h:2,c:1,d:0})[c.suit]||0; }));
      result = { type: 'pair', rank: rvals[0], suit: maxSuit };
    }
    else if (groups[3].length === 1 && n === 3) { typeName = _t('bt_triple'); result = { type: 'triple', rank: groups[3][0] }; }
    else if (n >= 5 && groups[1].length === n && _isConsecutive(groups[1], n)) {
      typeName = _t('bt_straight'); result = { type: 'straight', rank: groups[1][0], length: n };
    }
    else if (n === 5 && allSameSuit && !_isConsecutive([...rvals].sort(function(a,b){return a-b;}), 5)) {
      typeName = _t('bt_flush');
      var maxSuit2 = Math.max.apply(null, cards.map(function(c) { return ({s:3,h:2,c:1,d:0})[c.suit]||0; }));
      result = { type: 'flush', rank: rvals[rvals.length-1], suit: maxSuit2 };
    }
    else if (n === 5 && groups[3].length === 1 && groups[2].length === 1) { typeName = _t('bt_full_house'); result = { type: 'full_house', rank: groups[3][0] }; }
    else if (n === 5 && groups[4].length === 1) { typeName = _t('bt_four_one'); result = { type: 'four_one', rank: groups[4][0] }; }
    else if (n === 5 && allSameSuit && _isConsecutive([...rvals].sort(function(a,b){return a-b;}), 5)) {
      typeName = _t('bt_straight_flush');
      result = { type: 'straight_flush', rank: groups[1][0], suit: Math.max.apply(null, cards.map(function(c) { return ({s:3,h:2,c:1,d:0})[c.suit]||0; })) };
    }

    if (result) { result.name = typeName; return result; }
    return null;
  }

  function _canBeat(newPlay, lastPlay) {
    if (!lastPlay) return true;
    if (newPlay.type !== lastPlay.type) return false;
    if ((newPlay.length || 0) !== (lastPlay.length || 0)) return false;
    if (newPlay.rank !== lastPlay.rank) return newPlay.rank > lastPlay.rank;
    return (newPlay.suit || 0) > (lastPlay.suit || 0);
  }

  function _getCardById(hand, id) {
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].id === id) return hand[i];
    }
    return null;
  }

  window._btToggleCard = function(id) {
    if (selected[id]) { delete selected[id]; }
    else { selected[id] = true; }
    // Re-render and update hint
    var state = window._btState;
    if (state) {
      var renderer = window.gameRenderers.get('bigtwo');
      var container = document.getElementById('boardArea');
      var playerIndex = parseInt(sessionStorage.getItem('playerIndex'));
      if (renderer && renderer.renderHand) {
        renderer.renderHand(state, playerIndex, state.winner);
      }
      updateHint(state, playerIndex);
    }
  };

  function updateHint(state, selfIdx) {
    var hintEl = document.getElementById('btHint');
    if (!hintEl) return;
    var hand = state.hands[selfIdx] || [];
    var selectedIds = Object.keys(selected);
    if (selectedIds.length === 0) { hintEl.style.display = 'none'; return; }

    var cards = [];
    for (var i = 0; i < selectedIds.length; i++) {
      var c = _getCardById(hand, selectedIds[i]);
      if (c) cards.push(c);
    }
    var playType = _detectType(cards);
    hintEl.style.display = '';
    if (!playType) {
      hintEl.innerHTML = '<span style="color:#e74c3c;">' + _t('bt_invalid_combo') + '</span>';
    } else {
      var lastPlay = state.lastPlay;
      var isFree = !lastPlay || lastPlay.player === selfIdx;
      var canBeat = isFree || (!lastPlay || _canBeat(playType, lastPlay.play));
      var html = '<span style="color:#5a9e6f;font-weight:600;">' + playType.name + '</span>';
      if (!lastPlay || lastPlay.player === selfIdx) {
        html += ' <span style="color:#5a9e6f;">' + _t('bt_hint_free') + '</span>';
      } else if (canBeat) {
        html += ' <span style="color:#5a9e6f;">' + _t('bt_hint_can_beat') + '</span>';
      } else {
        html += ' <span style="color:#e74c3c;">' + _t('bt_hint_cannot_beat') + '</span>';
      }
      hintEl.innerHTML = html;
    }
  }

  window._btPlay = function() {
    var ids = Object.keys(selected);
    if (ids.length === 0) { showToast(_t('bt_toast_select_first')); return; }
    selected = {};
    var h = document.getElementById('btHint'); if (h) h.style.display = 'none';
    window.makeGameMove({ cards: ids });
  };

  window._btPass = function() {
    selected = {};
    var h = document.getElementById('btHint'); if (h) h.style.display = 'none';
    window.makeGameMove({ cards: [] });
  };

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

  // Hook render to cache state
  var origRender = window.gameRenderers.get('bigtwo').render;
  window.gameRenderers.get('bigtwo').render = function(state, container, playerIndex, winner) {
    window._btState = state;
    origRender.call(this, state, container, playerIndex, winner);
  };
})();
