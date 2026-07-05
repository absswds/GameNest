// public/js/renderers/doudizhu.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var selected = {}; // card id -> true
  var cardEls = {};  // card id -> DOM element
  var _prevDdzState = null;

  window.gameRenderers.set('doudizhu', {
    init: function(container) {
      container.innerHTML =
        '<div id="ddzWrap" style="width:100%;max-width:420px;display:flex;flex-direction:column;gap:10px;font-family:inherit;">' +
          '<div id="ddzOpponents" style="display:flex;justify-content:space-around;gap:8px;"></div>' +
          '<div id="ddzPlayArea" style="min-height:80px;background:var(--bg,#f8f9fa);border-radius:var(--radius,24px);padding:12px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;"></div>' +
          '<div id="ddzHint" style="display:none;text-align:center;font-size:13px;padding:4px 8px;background:var(--bg,#f8f9fa);border-radius:12px;"></div>' +
          '<div id="ddzHand" style="min-height:56px;display:flex;flex-wrap:wrap;justify-content:center;gap:4px;padding:8px 0;"></div>' +
          '<div id="ddzActions" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;"></div>' +
        '</div>';
    },
    render: function(state, container, playerIndex, winner) {
      // With the full state broadcast fix, state is always the complete game state.
      var s = state;
      if (!s || !s.hands) return;

      var currentPlayer = state.currentPlayer != null ? state.currentPlayer : s.currentPlayer;

      // Detect pass: currentPlayer changed but lastPlay didn't change from previous state
      if (_prevDdzState && _prevDdzState.phase === 'playing' && s.phase === 'playing' &&
          _prevDdzState.currentPlayer !== currentPlayer &&
          JSON.stringify(_prevDdzState.lastPlay) === JSON.stringify(s.lastPlay) &&
          _prevDdzState.currentPlayer !== s.landlord) {
        // Someone passed — show toast
        var passer = _prevDdzState.currentPlayer;
        if (passer !== playerIndex) {
          var toast = document.getElementById('toast');
          if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.className = 'toast'; document.body.appendChild(toast); }
          var passerName = (window.gamePlayers && window.gamePlayers[passer]) ? window.gamePlayers[passer].name : (_t('ddz_player_fallback') + ' ' + (passer + 1));
          toast.textContent = passerName + _t('ddz_player_passed');
          toast.classList.add('show');
          clearTimeout(toast._timer);
          toast._timer = setTimeout(function() { toast.classList.remove('show'); }, 2000);
        }
      }
      _prevDdzState = JSON.parse(JSON.stringify(s));

      this.renderOpponents(s, playerIndex, currentPlayer);
      this.renderPlayArea(s, playerIndex);
      this.renderHand(s, playerIndex, currentPlayer);
      this.renderActions(s, playerIndex, currentPlayer, winner);
    },

    renderOpponents: function(s, selfIdx, cp) {
      var el = document.getElementById('ddzOpponents');
      if (!el) return;
      var html = '';
      for (var i = 0; i < s.hands.length; i++) {
        if (i === selfIdx) continue;
        var count = s.hands[i] ? s.hands[i].length : 0;
        var isLandlord = s.landlord === i;
        var isActive = cp === i;
        var didPass = (s.passed && s.passed[i] && s.phase === 'playing') ? true : false;
        var passBadge = didPass
          ? '<span style="margin-left:6px;background:#e74c3c;color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;font-weight:700;vertical-align:middle;">' + _t('ddz_passed_badge') + '</span>'
          : '';
        html +=
          '<div style="text-align:center;padding:8px 16px;background:var(--bg,#f8f9fa);border-radius:var(--radius-sm,16px);' +
          (isActive ? 'border:2px solid var(--accent,#c8a45c);animation:pulse 2s ease infinite;' : 'border:1px solid var(--border,#eee);') + '">' +
          '<div style="font-size:13px;font-weight:600;">' +
          (isLandlord ? '<span style="color:#c0392b;">&#x1F451;</span> ' : '') +
          ((window.gamePlayers && window.gamePlayers[i]) ? window.gamePlayers[i].name : (_t('ddz_player_fallback') + ' ' + (i + 1))) +
          '</div>' +
          '<div style="font-size:24px;font-weight:800;margin-top:4px;">' + count + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted,#999);">' + _t('ddz_cards_label') + passBadge + '</div>' +
          '</div>';
      }
      el.innerHTML = html;
    },

    renderPlayArea: function(s, selfIdx) {
      var el = document.getElementById('ddzPlayArea');
      if (!el) return;

      var parts = [];

      // Bottom cards (visible after deal/start)
      if (s.bottomCards && s.bottomCards.length > 0 && s.phase !== 'bidding') {
        var bcHtml = '<div style="font-size:12px;color:var(--text-muted,#999);margin-bottom:4px;">' + _t('ddz_bottom_cards') + '</div><div style="display:flex;gap:4px;justify-content:center;">';
        for (var b = 0; b < s.bottomCards.length; b++) {
          bcHtml += cardSpan(s.bottomCards[b]);
        }
        bcHtml += '</div>';
        parts.push(bcHtml);
      }

      // Last played cards
      if (s.lastPlay) {
        var who = s.lastPlay.player === selfIdx ? _t('ddz_you') : ((window.gamePlayers && window.gamePlayers[s.lastPlay.player]) ? window.gamePlayers[s.lastPlay.player].name : (_t('ddz_player_fallback') + ' ' + (s.lastPlay.player + 1)));
        var lpHtml = '<div style="font-size:12px;color:var(--text-muted,#999);margin-bottom:4px;">' + who + ' ' + _t('ddz_played') + '</div>' +
          '<div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">';
        for (var c = 0; c < s.lastPlay.cards.length; c++) {
          lpHtml += cardSpan(s.lastPlay.cards[c]);
        }
        lpHtml += '</div>';
        parts.push(lpHtml);
      }

      // Bidding info
      if (s.phase === 'bidding') {
        var bidInfo = '<div style="font-size:13px;color:var(--text-muted,#999);margin-bottom:4px;">' + _t('ddz_bidding_phase') + '</div>';
        if (s.bids && Object.keys(s.bids).length > 0) {
          bidInfo += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
          for (var bi = 0; bi < (s._playerCount || 3); bi++) {
            var bidVal = s.bids[bi];
            var biName = (window.gamePlayers && window.gamePlayers[bi]) ? window.gamePlayers[bi].name : (_t('ddz_player_fallback') + ' ' + (bi + 1));
            if (bidVal !== undefined) {
              var bidColor = bidVal === 0 ? 'var(--text-muted,#999)' : (bidVal === 3 ? '#c0392b' : 'var(--accent,#c8a45c)');
              bidInfo += '<span style="font-size:12px;font-weight:700;color:' + bidColor + ';">' + biName + ': ' + (bidVal === 0 ? _t('ddz_no_bid_display') : bidVal) + '</span>';
            }
          }
          bidInfo += '</div>';
        }
        parts.push(bidInfo);
      }

      // Current round info
      if (s.landlord != null && s.phase === 'playing') {
        var landlordName = (window.gamePlayers && window.gamePlayers[s.landlord]) ? window.gamePlayers[s.landlord].name : (_t('ddz_player_fallback') + ' ' + (s.landlord + 1));
        var landHtml = '<div style="font-size:12px;color:#c0392b;">&#x1F451; ' + _t('ddz_landlord_label') + ': ' + landlordName + '</div>';
        parts.push(landHtml);
      }

      el.innerHTML = parts.length > 0 ? parts.join('<div style="height:4px;"></div>') : '';
    },

    renderHand: function(s, selfIdx, cp) {
      var el = document.getElementById('ddzHand');
      if (!el) return;
      var hand = s.hands[selfIdx];
      if (!hand || hand.length === 0) { el.innerHTML = ''; return; }

      var myTurn = (cp === selfIdx && s.phase === 'playing');
      var html = '';
      cardEls = {};
      for (var i = 0; i < hand.length; i++) {
        var c = hand[i];
        var isSel = selected[c.id] ? true : false;
        var style = 'display:inline-flex;align-items:center;justify-content:center;' +
          'width:48px;height:64px;border-radius:8px;' +
          'background:#fff;border:1px solid var(--border,#eee);' +
          'font-size:15px;font-weight:700;cursor:' + (myTurn ? 'pointer' : 'default') + ';' +
          'transition:transform 0.12s,box-shadow 0.12s;' +
          'box-shadow:0 1px 4px rgba(0,0,0,0.1);' +
          'line-height:1;';
        if (isSel) {
          style += 'transform:translateY(-16px);box-shadow:0 4px 12px rgba(0,0,0,0.2);border-color:var(--accent,#c8a45c);';
        }
        var color = getCardColor(c);
        var label = getCardLabel(c);
        html += '<div class="ddz-card" data-id="' + c.id + '" style="' + style + 'color:' + color + ';"';
        if (myTurn) {
          html += ' onclick="window._ddzToggleCard(\'' + c.id + '\')"';
        }
        html += '>' + label + '</div>';
      }
      el.innerHTML = html;

      // Store references
      var cards = el.querySelectorAll('.ddz-card');
      for (var j = 0; j < cards.length; j++) {
        cardEls[cards[j].dataset.id] = cards[j];
      }
    },

    renderActions: function(s, selfIdx, cp, winner) {
      var el = document.getElementById('ddzActions');
      if (!el) return;
      var isMyTurn = (cp === selfIdx);

      var html = '';

      if (s.phase === 'bidding' && isMyTurn && winner == null) {
        html = renderBidButtons(s);
      } else if (s.phase === 'playing' && isMyTurn && winner == null) {
        html = renderPlayButtons(s, selfIdx);
      }

      el.innerHTML = html;
    }
  });

  // ---- Helpers ----

  function getCardColor(c) {
    if (c.rank === '小王' || c.rank === '大王') return '#e74c3c';
    if (c.suit === 'h' || c.suit === 'd') return '#e74c3c';
    return '#1a1a1a';
  }

  function getCardLabel(c) {
    if (c.id === 'SJ') return '&#x2605;小';  // ★小
    if (c.id === 'BJ') return '&#x2605;大';  // ★大
    var suitChar = '';
    if (c.suit === 's') suitChar = '&#9824;';   // ♠
    else if (c.suit === 'h') suitChar = '&#9829;'; // ♥
    else if (c.suit === 'c') suitChar = '&#9827;'; // ♣
    else if (c.suit === 'd') suitChar = '&#9830;'; // ♦
    return suitChar + c.rank;
  }

  function cardSpan(c) {
    var color = getCardColor(c);
    var label = getCardLabel(c);
    return '<span style="display:inline-flex;align-items:center;justify-content:center;' +
      'width:40px;height:52px;border-radius:6px;' +
      'background:#fff;border:1px solid var(--border,#eee);' +
      'font-size:13px;font-weight:700;color:' + color + ';' +
      'box-shadow:0 1px 3px rgba(0,0,0,0.1);line-height:1;">' +
      label + '</span>';
  }

  function renderBidButtons(s) {
    var html = '';
    for (var sc = 1; sc <= 3; sc++) {
      if (sc <= s.currentBid) continue;
      html += '<button class="btn btn-sm" onclick="window._ddzBid(' + sc + ')" style="min-width:56px;">' + sc + ' ' + _t('ddz_bid_points') + '</button>';
    }
    html += '<button class="btn btn-sm btn-outline" onclick="window._ddzBid(0)">' + _t('ddz_no_bid') + '</button>';
    return html;
  }

  function renderPlayButtons(s, selfIdx) {
    var canPass = s.lastPlay && s.lastPlay.player !== selfIdx;
    var html = '<button class="btn btn-sm btn-primary" onclick="window._ddzPlay()" style="min-width:80px;">' + _t('ddz_play') + '</button>';
    if (canPass) {
      html += '<button class="btn btn-sm btn-outline" onclick="window._ddzPass()" style="min-width:80px;">' + _t('ddz_pass') + '</button>';
    }
    return html;
  }

  // ---- Card type detection (mirrors server-side logic) ----
  function _rankVal(rank) {
    if (rank === '小王') return 13;
    if (rank === '大王') return 14;
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

    // Rocket
    if (n === 2 && cards.some(function(c) { return c.id === 'SJ'; }) && cards.some(function(c) { return c.id === 'BJ'; }))
      return { type: 'rocket', rank: 15, name: _t('ddz_rocket') };

    // Bomb
    if (n === 4 && rvals[0] === rvals[3])
      return { type: 'bomb', rank: rvals[0], name: _t('ddz_bomb') };

    // Count rank groups
    var countMap = new Map();
    for (var i = 0; i < rvals.length; i++) {
      var r = rvals[i];
      countMap.set(r, (countMap.get(r) || 0) + 1);
    }
    var groups = { 1: [], 2: [], 3: [], 4: [] };
    countMap.forEach(function(c, r) { groups[c].push(r); });
    for (var k in groups) groups[k].sort(function(a,b) { return a-b; });

    var typeName = '';
    var result;

    if (n === 1) { typeName = _t('ddz_single'); result = { type: 'single', rank: rvals[0] }; }
    else if (n === 2 && rvals[0] === rvals[1]) { typeName = _t('ddz_pair'); result = { type: 'pair', rank: rvals[0] }; }
    else if (groups[3].length === 1 && n === 3) { typeName = _t('ddz_triple'); result = { type: 'triple', rank: groups[3][0] }; }
    else if (groups[3].length === 1 && n === 4) { typeName = _t('ddz_triple_one'); result = { type: 'triple_one', rank: groups[3][0] }; }
    else if (groups[3].length === 1 && n === 5 && groups[2].length === 1) { typeName = _t('ddz_triple_two'); result = { type: 'triple_two', rank: groups[3][0] }; }
    else if (n >= 5 && groups[1].length === n && _isConsecutive(groups[1], n) && groups[1][n-1] < 12)
      { typeName = _t('ddz_straight'); result = { type: 'straight', rank: groups[1][0], length: n }; }
    else if (n >= 6 && n % 2 === 0 && groups[2].length === n/2 && _isConsecutive(groups[2], n/2) && groups[2][n/2-1] < 12)
      { typeName = _t('ddz_consecutive_pairs'); result = { type: 'consecutive_pairs', rank: groups[2][0], length: n/2 }; }
    else if (n >= 6 && n % 3 === 0 && groups[3].length === n/3 && _isConsecutive(groups[3], n/3) && groups[3][n/3-1] < 12)
      { typeName = _t('ddz_plane'); result = { type: 'plane', rank: groups[3][0], length: n/3 }; }
    else if (groups[3].length >= 2 && _isConsecutive(groups[3], groups[3].length) && groups[3][groups[3].length-1] < 12) {
      var triCount = groups[3].length;
      var remaining = n - triCount * 3;
      if (remaining === triCount) { typeName = _t('ddz_plane_wings_1'); result = { type: 'plane_wings_1', rank: groups[3][0], length: triCount }; }
      else if (remaining === triCount * 2 && groups[2].length === triCount && n === triCount * 5)
        { typeName = _t('ddz_plane_wings_2'); result = { type: 'plane_wings_2', rank: groups[3][0], length: triCount }; }
    }
    else if (groups[4].length === 1 && n === 6) { typeName = _t('ddz_four_two'); result = { type: 'four_two', rank: groups[4][0] }; }
    else if (groups[4].length === 1 && n === 8 && groups[2].length === 2) { typeName = _t('ddz_four_two_pairs'); result = { type: 'four_two_pairs', rank: groups[4][0] }; }

    if (result) { result.name = typeName; return result; }
    return null;
  }

  function _canBeat(newPlay, lastPlay) {
    if (!lastPlay) return true;
    if (newPlay.type === 'rocket') return true;
    if (newPlay.type === 'bomb') {
      if (lastPlay.type === 'rocket') return false;
      if (lastPlay.type === 'bomb') return newPlay.rank > lastPlay.rank;
      return true;
    }
    if (newPlay.type !== lastPlay.type) return false;
    if ((newPlay.length || 0) !== (lastPlay.length || 0)) return false;
    return newPlay.rank > lastPlay.rank;
  }

  function _getCardById(hand, id) {
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].id === id) return hand[i];
    }
    return null;
  }

  // ---- Global handlers (called from onclick) ----

  window._ddzToggleCard = function(id) {
    if (selected[id]) {
      delete selected[id];
    } else {
      selected[id] = true;
    }
    // Re-render hand
    var state = getCurrentState();
    if (state) {
      var renderer = window.gameRenderers.get('doudizhu');
      var container = document.getElementById('boardArea');
      var playerIndex = parseInt(sessionStorage.getItem('playerIndex'));
      if (renderer && renderer.renderHand) {
        var s = state;
        var cp = state.currentPlayer != null ? state.currentPlayer : (s ? s.currentPlayer : 0);
        renderer.renderHand(s, playerIndex, cp);
      }
      // Show card type hint
      updateDdzHint(state, playerIndex);
    }
  };

  function updateDdzHint(state, selfIdx) {
    var hintEl = document.getElementById('ddzHint');
    if (!hintEl) return;
    var hand = state.hands[selfIdx] || [];
    var selectedIds = Object.keys(selected);
    if (selectedIds.length === 0) {
      hintEl.style.display = 'none';
      return;
    }
    // Build card array from selected IDs
    var cards = [];
    for (var i = 0; i < selectedIds.length; i++) {
      var c = _getCardById(hand, selectedIds[i]);
      if (c) cards.push(c);
    }
    var playType = _detectType(cards);
    hintEl.style.display = '';
    if (!playType) {
      hintEl.innerHTML = '<span style="color:#e74c3c;">' + _t('ddz_invalid_type') + '</span>';
    } else {
      var lastPlay = state.lastPlay;
      var isFree = !lastPlay || lastPlay.player === selfIdx;
      var canBeat = isFree || _canBeat(playType, lastPlay ? lastPlay.play : null);
      var html = '<span style="color:#5a9e6f;font-weight:600;">' + playType.name + '</span>';
      if (isFree) {
        html += ' <span style="color:#5a9e6f;">✓ ' + _t('ddz_free_play') + '</span>';
      } else if (canBeat) {
        html += ' <span style="color:#5a9e6f;">✓ ' + _t('ddz_can_beat') + '</span>';
      } else {
        var lastName = lastPlay.play.name || lastPlay.play.type;
        html += ' <span style="color:#e74c3c;">' + _tf('ddz_cannot_beat', lastName) + '</span>';
      }
      hintEl.innerHTML = html;
    }
  }

  window._ddzBid = function(score) {
    selected = {};
    var h = document.getElementById('ddzHint'); if (h) h.style.display = 'none';
    window.makeGameMove({ score: score });
  };

  window._ddzPlay = function() {
    var ids = Object.keys(selected);
    if (ids.length === 0) {
      showToast(_t('ddz_select_cards_first'));
      return;
    }
    selected = {};
    var h = document.getElementById('ddzHint'); if (h) h.style.display = 'none';
    window.makeGameMove({ cards: ids });
  };

  window._ddzPass = function() {
    selected = {};
    var h = document.getElementById('ddzHint'); if (h) h.style.display = 'none';
    window.makeGameMove({ cards: [] });
  };

  function getCurrentState() {
    // room-client stores state in closure; we expose it via window hook
    if (window._ddzState) return window._ddzState;
    return null;
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

  // Hook into room-client's state updates
  var origConnect = null;
  var checkInterval = setInterval(function() {
    if (typeof window.makeGameMove === 'function') {
      clearInterval(checkInterval);
      // Patch WebSocket message handler to expose state
      var origSend = window.makeGameMove;
      // Keep track — the renderer reads window._ddzState
      var origOnBefore = null;

      // We intercept after each game render to keep selected cards in sync
      var origRendererRender = window.gameRenderers.get('doudizhu').render;
      var patchedRender = function(state, container, playerIndex, winner) {
        window._ddzState = state;
        origRendererRender.call(this, state, container, playerIndex, winner);
      };
      window.gameRenderers.get('doudizhu').render = patchedRender;
    }
  }, 100);
})();
