// public/js/renderers/bigtwo.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var selected = {};
  var _lastHandLen = 0;
  var _lastHandHtml = '';
  var TYPE_NAMES = {
    single: 'bt_single', pair: 'bt_pair', triple: 'bt_triple',
    straight: 'bt_straight', flush: 'bt_flush', full_house: 'bt_full_house',
    four_one: 'bt_four_one', straight_flush: 'bt_straight_flush'
  };

  window.gameRenderers.set('bigtwo', {
    init: function(container) {
      container.innerHTML =
        '<div id="btWrap" style="width:100%;max-width:900px;display:flex;flex-direction:column;gap:10px;font-family:inherit;">' +
          '<div id="btOpponents" style="display:flex;justify-content:space-around;gap:8px;"></div>' +
          '<div id="btPlayArea" style="min-height:80px;background:var(--bg);border-radius:var(--radius-sm);padding:12px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;"></div>' +
          '<div id="btHint" style="display:none;text-align:center;font-size:13px;padding:4px 8px;background:var(--bg);border-radius:12px;"></div>' +
          '<div id="btHand" style="min-height:92px;padding:4px 0;"></div>' +
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
          '<div class="' + (isActive ? 'is-active-turn' : '') + '" style="text-align:center;padding:8px 14px;background:var(--bg);border-radius:var(--radius-sm);' +
          (isActive ? '' : 'border:1px solid var(--border);') + '">' +
          '<div style="font-size:13px;font-weight:600;">' +
          escHtml(window.getPlayerName ? window.getPlayerName(i) : (_t('bt_player_fallback') + (i + 1))) +
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
        el.innerHTML = '<div style="font-size:15px;font-weight:700;color:var(--success);">' + winnerName + _t('bt_wins') + '</div>' +
          scoreTable(s, selfIdx);
        return;
      }

      var parts = [];

      // Last played cards
      if (s.lastPlay && s.lastPlay.cards) {
        var who = s.lastPlayPlayer === selfIdx ? _t('bt_you') :
          escHtml(window.getPlayerName ? window.getPlayerName(s.lastPlayPlayer) : (_t('bt_player_fallback') + (s.lastPlayPlayer + 1)));
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
      // Drop selections for cards no longer in hand (e.g. after a restart)
      var inHand = {};
      hand.forEach(function(c) { inHand[c.id] = true; });
      Object.keys(selected).forEach(function(id) { if (!inHand[id]) delete selected[id]; });
      if (hand.length === 0) { el.innerHTML = ''; _lastHandLen = 0; _lastHandHtml = ''; return; }

      var myTurn = s.currentPlayer === selfIdx && winner == null;
      var deal = hand.length > _lastHandLen + 3;
      _lastHandLen = hand.length;
      var handHtml = window.CardUI.group(hand, {
        layout: 'hand',
        deal: deal,
        cardOpts: function(c) {
          return {
            selected: !!selected[c.id],
            className: myTurn ? 'pc-selectable bt-card' : 'bt-card',
            attrs: myTurn ? 'onclick="window._btToggleCard(\'' + c.id + '\')"' : ''
          };
        }
      });
      if (handHtml !== _lastHandHtml || !el.firstChild) { el.innerHTML = handHtml; _lastHandHtml = handHtml; }
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

  // Round result (cards left x multiplier) and running totals, shown once someone goes out.
  function scoreTable(s, selfIdx) {
    if (!s.roundResult) return '';
    var signed = function(v) { return v > 0 ? '+' + v : String(v); };
    var cell = 'padding:3px 8px;text-align:right;';
    var html = '<table style="margin-top:6px;font-size:12px;border-collapse:collapse;">' +
      '<tr style="color:var(--text-muted);"><th style="' + cell + 'text-align:left;"></th>' +
      '<th style="' + cell + '">' + _t('bt_score_left') + '</th>' +
      '<th style="' + cell + '">' + _t('bt_score_round') + '</th>' +
      '<th style="' + cell + '">' + _t('bt_score_total') + (s.roundNumber > 1 ? ' (' + s.roundNumber + ')' : '') + '</th></tr>';
    for (var i = 0; i < s.roundResult.length; i++) {
      var r = s.roundResult[i];
      var name = i === selfIdx ? _t('bt_you') : (window.getPlayerName ? window.getPlayerName(i) : (_t('bt_player_fallback') + (i + 1)));
      var total = s.cumulativeScore ? s.cumulativeScore[i] : r.points;
      html += '<tr' + (i === selfIdx ? ' style="font-weight:700;"' : '') + '>' +
        '<td style="' + cell + 'text-align:left;">' + escapeHtml(name) + '</td>' +
        '<td style="' + cell + '">' + (i === s.winner ? '—' : r.left + (r.mult > 1 ? ' ×' + r.mult : '')) + '</td>' +
        '<td style="' + cell + 'color:' + (r.points >= 0 ? 'var(--success)' : '#e74c3c') + ';">' + signed(r.points) + '</td>' +
        '<td style="' + cell + '">' + signed(total) + '</td></tr>';
    }
    return html + '</table>';
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function(ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function cardSpan(c) {
    return window.CardUI.render(c, { size: 'sm' });
  }

  // ---- Card type detection (client-side) ----
  // Mirrors detectType / canBeat in games/bigtwo.js (tests/bigtwo-renderer.test.js checks they agree).
  var RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
  var SUIT_ORDER = { s: 3, h: 2, c: 1, d: 0 };
  var SEQ_VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
  var FIVE_KINDS = ['straight', 'flush', 'full_house', 'four_one', 'straight_flush'];

  function _rankVal(rank) { return RANKS.indexOf(rank); }
  function _suitVal(suit) { return SUIT_ORDER[suit] || 0; }
  function _cardVal(c) { return _rankVal(c.rank) * 4 + _suitVal(c.suit); }

  function _straightTop(cards) {
    var seq = cards.map(function(c) { return { v: SEQ_VAL[c.rank], c: c }; }).sort(function(a, b) { return a.v - b.v; });
    function run(list) {
      for (var i = 1; i < list.length; i++) if (list[i].v - list[i - 1].v !== 1) return false;
      return true;
    }
    if (run(seq)) return { seq: seq[4].v, card: seq[4].c };
    if (seq[4].c.rank === 'A') {
      var low = [{ v: 1, c: seq[4].c }].concat(seq.slice(0, 4));
      if (run(low)) return { seq: 5, card: low[4].c };
    }
    return null;
  }

  function _detectType(cards) {
    if (!cards || cards.length === 0) return null;
    var n = cards.length;
    var rvals = cards.map(function(c) { return _rankVal(c.rank); }).sort(function(a, b) { return a - b; });
    var result = null;

    if (n === 1) result = { type: 'single', rank: rvals[0], suit: _suitVal(cards[0].suit) };
    else if (n === 2 && rvals[0] === rvals[1]) {
      result = { type: 'pair', rank: rvals[0], suit: Math.max(_suitVal(cards[0].suit), _suitVal(cards[1].suit)) };
    }
    else if (n === 3 && rvals[0] === rvals[2]) result = { type: 'triple', rank: rvals[0], suit: 0 };
    else if (n === 5) {
      var counts = {};
      rvals.forEach(function(r) { counts[r] = (counts[r] || 0) + 1; });
      var keys = Object.keys(counts);
      var withCount = function(k) { for (var i = 0; i < keys.length; i++) if (counts[keys[i]] === k) return +keys[i]; return -1; };
      var sameSuit = cards.every(function(c) { return c.suit === cards[0].suit; });
      var st = keys.length === 5 ? _straightTop(cards) : null;
      var five = function(type, rank, suit) { return { type: type, kind: FIVE_KINDS.indexOf(type), rank: rank, suit: suit }; };
      if (st) result = five(sameSuit ? 'straight_flush' : 'straight', st.seq, _suitVal(st.card.suit));
      else if (sameSuit) {
        var top = cards.reduce(function(a, b) { return _cardVal(b) > _cardVal(a) ? b : a; });
        result = five('flush', _rankVal(top.rank), _suitVal(top.suit));
      }
      else if (withCount(3) >= 0 && withCount(2) >= 0) result = five('full_house', withCount(3), 0);
      else if (withCount(4) >= 0) result = five('four_one', withCount(4), 0);
    }

    if (result && typeof _t === 'function') result.name = _t(TYPE_NAMES[result.type]);
    return result;
  }

  function _canBeat(newPlay, lastPlay) {
    if (!lastPlay) return true;
    if (newPlay.kind !== undefined && lastPlay.kind !== undefined) {
      if (newPlay.kind !== lastPlay.kind) return newPlay.kind > lastPlay.kind;
    } else if (newPlay.type !== lastPlay.type) {
      return false;
    }
    if (newPlay.rank !== lastPlay.rank) return newPlay.rank > lastPlay.rank;
    return (newPlay.suit || 0) > (lastPlay.suit || 0);
  }

  window._btRules = { detectType: _detectType, canBeat: _canBeat };

  function _getCardById(hand, id) {
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].id === id) return hand[i];
    }
    return null;
  }

  window._btToggleCard = function(id) {
    if (selected[id]) { delete selected[id]; }
    else { selected[id] = true; }
    var cardEl = document.querySelector('#btHand [data-id="' + id + '"]');
    if (cardEl) cardEl.classList.toggle('is-selected', !!selected[id]);
    var state = window._btState;
    if (state) {
      var playerIndex = parseInt(sessionStorage.getItem('playerIndex'));
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
      var canBeat = isFree || (cards.length === lastPlay.cards.length && _canBeat(playType, lastPlay.play));
      var next = state.hands[(selfIdx + 1) % state.hands.length] || [];
      var mustBeHighest = state.oneCardRule && playType.type === 'single' && next.length === 1 &&
        hand.some(function(h) { return _cardVal(h) > _cardVal(cards[0]); });
      var html = '<span style="color:#5a9e6f;font-weight:600;">' + playType.name + '</span>';
      if (mustBeHighest) {
        html += ' <span style="color:#e74c3c;">' + _t('bt_hint_must_highest') + '</span>';
      } else if (isFree) {
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

  function showToast(msg) { if (window.showToast) window.showToast(msg); }

  function escHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  // Hook render to cache state
  var origRender = window.gameRenderers.get('bigtwo').render;
  window.gameRenderers.get('bigtwo').render = function(state, container, playerIndex, winner) {
    window._btState = state;
    origRender.call(this, state, container, playerIndex, winner);
  };
})();
