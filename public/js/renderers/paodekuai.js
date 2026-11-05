// public/js/renderers/paodekuai.js
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var P = window.PaodekuaiPatterns;
  var selected = {};
  var cardEls = {};
  var _prevState = null;
  var _hintIndex = -1;
  var _hintKey = '';
  var _lastHandLen = 0;
  var _lastHandHtml = '';
  var _deadlineKey = null;
  var _localDeadline = 0;
  var _dragMode = null; // null | 'select' | 'deselect'

  var TYPE_KEYS = {
    single: 'pdk_single',
    pair: 'pdk_pair',
    pairs: 'pdk_pairs',
    triple: 'pdk_triple',
    plane: 'pdk_plane',
    straight: 'pdk_straight',
    bomb: 'pdk_bomb',
  };

  var STYLES =
    '.board-wrap:has(#pdkWrap){align-items:flex-start;}' +
    '#pdkWrap{width:100%;max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:10px;font-family:inherit;min-width:0;}' +
    '#pdkScoreStrip{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:6px 12px;background:var(--bg,#f8f9fa);border:1px solid var(--ge-line,rgba(28,27,25,0.12));border-radius:14px;font-size:12px;}' +
    '.pdk-strip-meta{display:flex;align-items:center;gap:8px;font-weight:700;color:var(--ge-ink,#1c1b19);}' +
    '.pdk-strip-pill{padding:2px 8px;border-radius:999px;background:rgba(185,149,79,0.16);color:#735c2c;font-size:11px;font-weight:700;}' +
    '.pdk-strip-scores{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-variant-numeric:tabular-nums;}' +
    '.pdk-strip-player{display:inline-flex;align-items:center;gap:4px;font-weight:600;}' +
    '.pdk-strip-player b{font-weight:800;}' +
    '#pdkOpponents{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;}' +
    '.pdk-opp-card{text-align:center;padding:8px 12px;background:var(--bg,#f8f9fa);border-radius:var(--radius-sm,16px);border:1px solid var(--border,#eee);display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;transition:border-color var(--dur,200ms) var(--ease),box-shadow var(--dur,200ms) var(--ease);}' +
    '.pdk-opp-card.is-active-turn{border-color:var(--ge-gold,#b9954f);box-shadow:0 0 0 2px rgba(185,149,79,0.25);}' +
    '.pdk-opp-name{font-size:13px;font-weight:700;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '.pdk-opp-count{font-size:22px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums;}' +
    '.pdk-opp-sub{display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;font-size:11px;color:var(--text-muted,#888);min-height:18px;}' +
    '.pdk-badge{display:inline-flex;align-items:center;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:800;line-height:1.4;}' +
    '.pdk-badge-warn{background:#c0392b;color:#fff;}' +
    '.pdk-badge-pass{background:rgba(28,27,25,0.12);color:var(--ge-ink,#1c1b19);}' +
    '.pdk-badge-bomb{background:rgba(185,149,79,0.22);color:#735c2c;}' +
    '#pdkPlayArea{min-height:92px;border-radius:var(--radius,22px);padding:12px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;}' +
    '#pdkHint{display:none;text-align:center;font-size:13px;padding:4px 10px;background:var(--bg,#f8f9fa);border-radius:12px;}' +
    '#pdkHand{min-height:92px;padding:4px 0;touch-action:pan-x;}' +
    '#pdkActions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;}' +
    '#pdkActions .btn{width:auto;flex:1 1 0;min-width:84px;max-width:160px;min-height:44px;margin:0;white-space:nowrap;}' +
    '#pdkHand .pc-layout-hand .pc-card + .pc-card{margin-left:var(--pdk-ml,calc(var(--w) * -0.3));}' +
    '@media (min-width: 900px) and (hover: hover){#pdkHand .pc-md{--w:56px;}}' +
    '@media (orientation: landscape) and (max-height: 540px){' +
      '#pdkWrap{display:grid !important;grid-template-columns:minmax(0,118px) minmax(0,1fr) minmax(0,118px);gap:4px 8px !important;max-width:780px !important;}' +
      '#pdkScoreStrip{grid-column:1/-1;grid-row:1;padding:3px 10px !important;font-size:11px !important;}' +
      '#pdkOpponents{display:contents !important;}' +
      '#pdkOpponents>.pdk-opp-card{padding:4px 8px !important;align-self: stretch;justify-content:center;}' +
      '#pdkOpponents>.pdk-opp-card:nth-child(1){grid-column:1;grid-row:2;}' +
      '#pdkOpponents>.pdk-opp-card:nth-child(2){grid-column:3;grid-row:2;}' +
      '.pdk-opp-count{font-size:18px !important;}' +
      '#pdkPlayArea{grid-column:2;grid-row:2;min-height:0 !important;padding:6px 10px !important;gap:3px !important;border-radius:16px !important;}' +
      '#pdkPlayArea.pdk-span-right{grid-column:2/4;}' +
      '#pdkHint{grid-column:1/-1;grid-row:3;padding:2px 8px !important;font-size:12px !important;}' +
      '#pdkHand{grid-column:1/-1;grid-row:4;min-height:0 !important;padding:0 !important;}' +
      '#pdkHand .pc-md{--w:42px;}' +
      '#pdkHand .pc-layout-hand{padding-top:12px;}' +
      '#pdkActions{grid-column:1/-1;grid-row:5;gap:8px !important;}' +
      '#pdkActions .btn{min-height:36px;padding-top:4px;padding-bottom:4px;}' +
    '}';

  // Overlap the hand more tightly when it would otherwise scroll sideways (16 cards on a phone).
  function fitHand(el) {
    var row = el.querySelector('.pc-layout-hand');
    if (!row) return;
    var cs = el.querySelectorAll('.pdk-card');
    el.style.removeProperty('--pdk-ml');
    if (cs.length < 2 || row.scrollWidth <= row.clientWidth + 1) return;
    var cw = cs[0].offsetWidth;
    var cst = getComputedStyle(row);
    var avail = row.clientWidth - parseFloat(cst.paddingLeft) - parseFloat(cst.paddingRight) - 2;
    var step = (avail - cw) / (cs.length - 1);
    if (step < cw * 0.18) step = cw * 0.18;
    el.style.setProperty('--pdk-ml', (step - cw).toFixed(2) + 'px');
  }

  function stopDrag() {
    _dragMode = null;
  }

  window.gameRenderers.set('paodekuai', {
    init: function (container) {
      if (!document.getElementById('pdk-styles')) {
        var st = document.createElement('style');
        st.id = 'pdk-styles';
        st.textContent = STYLES;
        document.head.appendChild(st);
      }
      if (!window._pdkDragBound) {
        window._pdkDragBound = true;
        window.addEventListener('pointerup', stopDrag);
        window.addEventListener('pointercancel', stopDrag);
        window.addEventListener('resize', function () {
          var h = document.getElementById('pdkHand');
          if (h) fitHand(h);
        });
      }
      selected = {};
      cardEls = {};
      _prevState = null;
      _hintIndex = -1;
      _hintKey = '';
      _lastHandLen = 0;
      _lastHandHtml = '';
      container.innerHTML =
        '<div id="pdkWrap">' +
          '<div id="pdkScoreStrip"></div>' +
          '<div id="pdkOpponents"></div>' +
          '<div id="pdkPlayArea" class="ge-felt"></div>' +
          '<div id="pdkHint"></div>' +
          '<div id="pdkHand"></div>' +
          '<div id="pdkActions"></div>' +
        '</div>';
    },

    render: function (state, container, playerIndex, winner) {
      if (!state || !state.hands) return;
      window._pdkState = state;
      var s = state;
      var cp = s.currentPlayer;

      // Toast when an opponent passes
      if (_prevState && _prevState.phase === 'playing' && s.phase === 'playing' &&
          _prevState.currentPlayer !== cp) {
        var passer = _prevState.currentPlayer;
        var lpKey = JSON.stringify(s.lastPlay);
        var didPass = (lpKey === _prevState.lastPlay && s.passed && s.passed[passer]) ||
          (_prevState.lastPlay !== 'null' && !s.lastPlay);
        if (didPass && passer !== playerIndex) {
          showToast(_tf('pdk_player_passed', playerName(passer)));
        }
      }
      _prevState = { phase: s.phase, currentPlayer: cp, lastPlay: JSON.stringify(s.lastPlay) };

      this.renderScoreStrip(s, playerIndex);
      this.renderOpponents(s, playerIndex, cp);
      this.renderPlayArea(s, playerIndex);
      this.renderHand(s, playerIndex, cp, winner);
      this.renderActions(s, playerIndex, cp, winner);
      updateHintBanner(s, playerIndex);
    },

    renderScoreStrip: function (s, selfIdx) {
      var el = document.getElementById('pdkScoreStrip');
      if (!el) return;
      var roundStr = _tf('pdk_round_of', s.currentRound || 1, s.totalRounds || 3);
      var ruleStr = s.mustBeat !== false ? _t('pdk_must_beat_on') : _t('pdk_must_beat_off');
      var scoresHtml = '';
      var n = s.hands ? s.hands.length : 0;
      for (var i = 0; i < n; i++) {
        var nm = i === selfIdx ? _t('pdk_you') : escHtml(playerName(i));
        var tot = (s.cumulativeScore && s.cumulativeScore[i]) || 0;
        var rsc = (s.roundScores && s.roundScores[i]) || 0;
        var rscStr = rsc ? ' <span style="font-size:11px;color:' + (rsc > 0 ? '#5a9e6f' : '#c0392b') + ';">(' + (rsc > 0 ? '+' + rsc : rsc) + ')</span>' : '';
        var oneTag = (i === selfIdx && s.oneCard && s.oneCard[i] && s.phase === 'playing')
          ? ' <span class="pdk-badge pdk-badge-warn">' + _t('pdk_last_card') + '</span>'
          : '';
        scoresHtml += '<span class="pdk-strip-player">' + nm + ': <b>' + (tot > 0 ? '+' + tot : tot) + '</b>' + rscStr + oneTag + '</span>';
      }
      el.innerHTML =
        '<div class="pdk-strip-meta">' +
          '<span>' + roundStr + '</span>' +
          '<span class="pdk-strip-pill">' + ruleStr + '</span>' +
        '</div>' +
        '<div class="pdk-strip-scores">' + scoresHtml + '</div>';
    },

    renderOpponents: function (s, selfIdx, cp) {
      var el = document.getElementById('pdkOpponents');
      if (!el) return;
      var n = s.hands.length;
      var html = '';
      // Order opponents clockwise starting from the next player
      for (var step = 1; step < n; step++) {
        var i = (selfIdx + step) % n;
        var hand = s.hands[i] || [];
        var count = hand.length;
        var isActive = s.phase === 'playing' && cp === i;
        var didPass = s.phase === 'playing' && s.passed && s.passed[i];
        var isOneCard = (s.oneCard && s.oneCard[i]) || count === 1;
        var bombs = (s.bombs && s.bombs[i]) || 0;

        var badges = '';
        if (isOneCard && count === 1) {
          badges += '<span class="pdk-badge pdk-badge-warn">' + _t('pdk_last_card') + '</span>';
        }
        if (didPass) {
          badges += '<span class="pdk-badge pdk-badge-pass">' + _t('pdk_passed_badge') + '</span>';
        }
        if (bombs > 0) {
          badges += '<span class="pdk-badge pdk-badge-bomb">💣×' + bombs + '</span>';
        }

        html +=
          '<div class="pdk-opp-card' + (isActive ? ' is-active-turn' : '') + '">' +
            '<div class="pdk-opp-name">' + escHtml(playerName(i)) + '</div>' +
            '<div class="pdk-opp-count">' + count + '</div>' +
            '<div class="pdk-opp-sub">' +
              '<span>' + (count === 0 ? _t('pdk_finished') : _tf('pdk_cards_label', count)) + '</span>' +
              badges +
            '</div>' +
          '</div>';
      }
      el.innerHTML = html;
      var playArea = document.getElementById('pdkPlayArea');
      if (playArea) playArea.classList.toggle('pdk-span-right', n === 2);
    },

    renderPlayArea: function (s, selfIdx) {
      var el = document.getElementById('pdkPlayArea');
      if (!el) return;
      var parts = [];

      // Round end settlement
      if (s.phase === 'roundEnd' && s.roundResult) {
        parts.push(renderRoundSettlement(s, selfIdx, false));
      } else if (s.phase === 'matchEnd' || s.winner != null) {
        parts.push(renderRoundSettlement(s, selfIdx, true));
      } else {
        // Playing phase: last play on the table
        if (s.lastPlay && s.lastPlay.cards && s.lastPlay.cards.length) {
          var who = s.lastPlay.player === selfIdx ? _t('pdk_you') : escHtml(playerName(s.lastPlay.player));
          var pType = s.lastPlay.play ? patternName(s.lastPlay.play) : '';
          parts.push(
            '<div style="font-size:12px;color:rgba(255,255,255,0.78);font-weight:600;">' +
              who + _t('pdk_played') + '<span style="color:#f3e6c8;font-weight:800;">' + escHtml(pType) + '</span>' +
            '</div>'
          );
          var cHtml = '<div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">';
          for (var i = 0; i < s.lastPlay.cards.length; i++) {
            cHtml += window.CardUI.render(s.lastPlay.cards[i], { size: 'sm' });
          }
          cHtml += '</div>';
          parts.push(cHtml);
        } else {
          parts.push('<div style="font-size:13px;color:rgba(255,255,255,0.78);font-weight:600;">' + _t('pdk_lead_prompt') + '</div>');
          if (s.firstCard) {
            parts.push('<div style="font-size:12px;color:#f3e6c8;font-weight:700;">' + _tf('pdk_first_card_hint', formatCardId(s.firstCard)) + '</div>');
          }
        }

        // Next player has 1 card warning
        var n = s.hands.length;
        var nextIdx = (s.currentPlayer + 1) % n;
        if (s.oneCard && s.oneCard[nextIdx] && s.currentPlayer === selfIdx) {
          parts.push('<div style="font-size:11px;color:#ffd2cc;font-weight:700;">' + _t('pdk_single_high_hint') + '</div>');
        }
      }

      // Turn countdown bar
      if (s.turnTime > 0 && s.phase === 'playing' && s.currentTurnDeadline && s.winner == null) {
        if (_deadlineKey !== s.currentTurnDeadline) {
          _deadlineKey = s.currentTurnDeadline;
          // Count down from the server's remaining time; a full turnTime here let players
          // reset the bar by leaving to the lobby and coming back
          _localDeadline = Date.now() + (typeof s.turnMsLeft === 'number' ? s.turnMsLeft : s.turnTime * 1000);
        }
        var elapsed = Date.now() - (_localDeadline - s.turnTime * 1000);
        var pct = Math.max(0, Math.min(1, 1 - elapsed / (s.turnTime * 1000)));
        var barColor = pct > 0.3 ? '#7bc694' : (pct > 0.15 ? '#f39c12' : '#e74c3c');
        parts.push(
          '<div style="width:100%;max-width:200px;margin-top:2px;">' +
            '<div style="display:flex;justify-content:center;font-size:11px;color:rgba(255,255,255,0.78);margin-bottom:2px;">' +
              '<span id="pdkTimeTxt">' + _tf('pdk_time_left', Math.ceil(pct * s.turnTime)) + '</span>' +
            '</div>' +
            '<div style="height:6px;background:rgba(255,255,255,0.2);border-radius:3px;overflow:hidden;">' +
              '<div id="pdkTimeBar" style="height:100%;width:' + (pct * 100) + '%;background:' + barColor + ';border-radius:3px;transition:width 0.25s;"></div>' +
            '</div>' +
          '</div>'
        );
      }

      el.innerHTML = parts.join('');

      if (window._pdkTimer) { clearInterval(window._pdkTimer); window._pdkTimer = null; }
      if (s.turnTime > 0 && s.phase === 'playing' && s.currentTurnDeadline && s.winner == null) {
        var total = s.turnTime * 1000;
        var deadline = _localDeadline;
        window._pdkTimer = setInterval(function () {
          var txt = document.getElementById('pdkTimeTxt');
          var bar = document.getElementById('pdkTimeBar');
          if (!txt || !bar) { clearInterval(window._pdkTimer); window._pdkTimer = null; return; }
          var left = Math.max(0, Math.min(1, (deadline - Date.now()) / total));
          txt.textContent = _tf('pdk_time_left', Math.ceil(left * s.turnTime));
          bar.style.width = (left * 100) + '%';
          bar.style.background = left > 0.3 ? '#7bc694' : (left > 0.15 ? '#f39c12' : '#e74c3c');
          if (left <= 0) { clearInterval(window._pdkTimer); window._pdkTimer = null; }
        }, 250);
      }
    },

    renderHand: function (s, selfIdx, cp, winner) {
      var el = document.getElementById('pdkHand');
      if (!el) return;
      var hand = (s.hands && s.hands[selfIdx]) || [];
      var inHand = {};
      hand.forEach(function (c) { if (c && c.id) inHand[c.id] = true; });
      Object.keys(selected).forEach(function (id) { if (!inHand[id]) delete selected[id]; });

      if (hand.length === 0 || hand.some(function (c) { return !c; })) {
        el.innerHTML = '';
        _lastHandLen = 0;
        _lastHandHtml = '';
        cardEls = {};
        return;
      }

      var myTurn = cp === selfIdx && s.phase === 'playing' && winner == null;
      var deal = hand.length > _lastHandLen + 3;
      _lastHandLen = hand.length;

      var handHtml = window.CardUI.group(hand, {
        layout: 'hand',
        deal: deal,
        cardOpts: function (c) {
          return {
            size: 'md',
            selected: !!selected[c.id],
            className: myTurn ? 'pc-selectable pdk-card' : 'pdk-card',
            attrs: myTurn
              ? 'onclick="window._pdkToggleCard(\'' + c.id + '\')" onpointerdown="window._pdkCardDown(event,\'' + c.id + '\')" onpointerenter="window._pdkCardEnter(\'' + c.id + '\')"'
              : '',
          };
        },
      });

      // Avoid rebuilding an unchanged hand so cards do not jump on broadcast
      if (handHtml === _lastHandHtml && el.firstChild) { fitHand(el); return; }
      el.innerHTML = handHtml;
      _lastHandHtml = handHtml;

      cardEls = {};
      var nodes = el.querySelectorAll('.pdk-card');
      for (var i = 0; i < nodes.length; i++) {
        cardEls[nodes[i].dataset.id] = nodes[i];
      }
      fitHand(el);
    },

    renderActions: function (s, selfIdx, cp, winner) {
      var el = document.getElementById('pdkActions');
      if (!el) return;
      var html = '';

      if (s.phase === 'playing' && cp === selfIdx && winner == null) {
        var isFree = !s.lastPlay || s.lastPlay.player === selfIdx;
        var plays = getLegalPlays(s, selfIdx);
        var mustBeatLocked = !isFree && s.mustBeat !== false && plays.length > 0;

        html += '<button class="btn btn-sm btn-primary" onclick="window._pdkPlay()">' + _t('pdk_play') + '</button>';
        html += '<button class="btn btn-sm btn-outline" onclick="window._pdkHint()">💡 ' + _t('pdk_hint') + '</button>';
        if (!isFree) {
          html += '<button class="btn btn-sm btn-outline" onclick="window._pdkPass()"' +
            (mustBeatLocked ? ' style="opacity:0.55;" title="' + escHtml(_t('pdk_must_beat_on')) + '"' : '') +
            '>' + _t('pdk_pass') + '</button>';
        }
      } else if (s.phase === 'roundEnd' && winner == null) {
        html = '<button class="btn btn-sm btn-primary" onclick="window._pdkNextRound()" style="min-width:120px;">' + _t('pdk_next_round') + '</button>';
      }

      el.innerHTML = html;
    },
  });

  function renderRoundSettlement(s, selfIdx, isMatchEnd) {
    var rr = s.roundResult;
    var title = isMatchEnd
      ? _t('pdk_match_end_title')
      : _tf('pdk_round_end_title', s.currentRound || 1);
    var html = '<div style="font-size:14px;font-weight:800;color:#f3e6c8;">' + escHtml(title) + '</div>';
    var headWinner = isMatchEnd ? s.winner : (rr && rr.winner);
    if (headWinner != null && headWinner >= 0) {
      var wName = headWinner === selfIdx ? _t('pdk_you') : playerName(headWinner);
      html += '<div style="font-size:12px;color:rgba(255,255,255,0.85);">' + escHtml(_tf(isMatchEnd ? 'pdk_match_winner' : 'pdk_round_winner', wName)) + '</div>';
    }
    var n = s.hands ? s.hands.length : 0;
    html += '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:4px;font-size:12px;">';
    for (var i = 0; i < n; i++) {
      var nm = i === selfIdx ? _t('pdk_you') : escHtml(playerName(i));
      var rsc = rr && rr.scores ? rr.scores[i] : ((s.roundScores && s.roundScores[i]) || 0);
      var tot = (s.cumulativeScore && s.cumulativeScore[i]) || 0;
      var remCount = rr && rr.remaining && rr.remaining[i] ? rr.remaining[i].length : ((s.hands[i] && s.hands[i].length) || 0);
      var isSpring = rr && rr.spring && rr.spring[i];
      var col = rsc >= 0 ? '#8ef0ab' : '#ffb4ab';
      html +=
        '<div style="background:rgba(0,0,0,0.22);padding:5px 10px;border-radius:10px;text-align:center;">' +
          '<div style="font-weight:700;">' + nm + '</div>' +
          '<div style="font-weight:800;color:' + col + ';">' + (rsc >= 0 ? '+' + rsc : rsc) + ' (' + _t('pdk_score_label') + ' ' + (tot >= 0 ? '+' + tot : tot) + ')</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,0.75);">' +
            (remCount > 0 ? _tf('pdk_remaining_n', remCount) : _t('pdk_finished')) +
            (isSpring ? ' · <span style="color:#ffd2cc;font-weight:700;">' + _t('pdk_spring') + '</span>' : '') +
          '</div>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function playerName(idx) {
    if (window.getPlayerName) return window.getPlayerName(idx);
    if (window.gamePlayers && window.gamePlayers[idx] && window.gamePlayers[idx].name) {
      return window.gamePlayers[idx].name;
    }
    return _tf('pdk_player_fallback', idx + 1);
  }

  function formatCardId(id) {
    if (!id) return '';
    var suit = id.slice(-1);
    var rank = id.slice(0, -1);
    var sym = (window.CardUI && window.CardUI.SUIT_SYMBOL && window.CardUI.SUIT_SYMBOL[suit]) || suit;
    return sym + rank;
  }

  function patternName(play) {
    if (!play) return '';
    var key = TYPE_KEYS[play.type];
    return key ? _t(key) : play.type;
  }

  function getLegalPlays(s, selfIdx) {
    if (!P || !s || !s.hands) return [];
    var hand = s.hands[selfIdx] || [];
    if (!hand.length || hand.some(function (c) { return !c; })) return [];
    var n = s.hands.length;
    var isFree = !s.lastPlay || s.lastPlay.player === selfIdx;
    var table = isFree ? null : s.lastPlay.play;
    var next = s.hands[(selfIdx + 1) % n];
    return P.enumerate(hand, table, {
      mustInclude: isFree && s.firstCard ? s.firstCard : null,
      nextOneCard: Array.isArray(next) && next.length === 1,
    });
  }

  function syncCardSelection(id) {
    if (cardEls[id]) cardEls[id].classList.toggle('is-selected', !!selected[id]);
    // Keep _lastHandHtml in sync with current selection so the next broadcast does not rebuild
    var s = window._pdkState;
    var el = document.getElementById('pdkHand');
    if (s && el && el.firstChild) {
      var pi = parseInt(sessionStorage.getItem('playerIndex'), 10);
      var hand = (s.hands && s.hands[pi]) || [];
      var myTurn = s.currentPlayer === pi && s.phase === 'playing' && s.winner == null;
      _lastHandHtml = window.CardUI.group(hand, {
        layout: 'hand',
        deal: false,
        cardOpts: function (c) {
          return {
            size: 'md',
            selected: !!selected[c.id],
            className: myTurn ? 'pc-selectable pdk-card' : 'pdk-card',
            attrs: myTurn
              ? 'onclick="window._pdkToggleCard(\'' + c.id + '\')" onpointerdown="window._pdkCardDown(event,\'' + c.id + '\')" onpointerenter="window._pdkCardEnter(\'' + c.id + '\')"'
              : '',
          };
        },
      });
    }
  }

  function updateHintBanner(state, selfIdx) {
    var hintEl = document.getElementById('pdkHint');
    if (!hintEl || !P || !state || !state.hands) return;
    var hand = state.hands[selfIdx] || [];
    var ids = Object.keys(selected);
    if (!ids.length || state.phase !== 'playing') {
      hintEl.style.display = 'none';
      return;
    }
    var cards = [];
    for (var i = 0; i < ids.length; i++) {
      var c = hand.find(function (x) { return x && x.id === ids[i]; });
      if (c) cards.push(c);
    }
    var play = P.detect(cards, cards.length === hand.length);
    hintEl.style.display = '';
    if (!play) {
      hintEl.innerHTML = '<span style="color:#c0392b;font-weight:600;">' + _t('pdk_invalid_type') + '</span>';
      return;
    }
    var isFree = !state.lastPlay || state.lastPlay.player === selfIdx;
    var n = state.hands.length;
    var next = state.hands[(selfIdx + 1) % n];
    var nextOne = Array.isArray(next) && next.length === 1;
    if (state.firstCard && !selected[state.firstCard]) {
      hintEl.innerHTML = '<span style="color:#c0392b;font-weight:600;">' + _tf('pdk_need_first_card', formatCardId(state.firstCard)) + '</span>';
      return;
    }
    if (nextOne && play.type === 'single' && play.rank !== P.maxRankOf(hand)) {
      hintEl.innerHTML = '<span style="color:#c0392b;font-weight:600;">' + _t('pdk_need_highest_single') + '</span>';
      return;
    }
    var beats = isFree || P.canBeat(play, state.lastPlay.play);
    var pName = patternName(play);
    if (isFree) {
      hintEl.innerHTML = '<span style="color:#2f5d4a;font-weight:700;">' + escHtml(pName) + ' · ✓ ' + _t('pdk_free_play') + '</span>';
    } else if (beats) {
      hintEl.innerHTML = '<span style="color:#2f5d4a;font-weight:700;">' + escHtml(pName) + ' · ✓ ' + _t('pdk_can_beat') + '</span>';
    } else {
      hintEl.innerHTML = '<span style="color:#c0392b;font-weight:600;">' + escHtml(pName) + ' · ' + _t('pdk_cannot_beat') + '</span>';
    }
  }

  window._pdkCardDown = function (ev, id) {
    if (ev && ev.pointerType === 'mouse' && ev.button === 0) {
      _dragMode = selected[id] ? 'deselect' : 'select';
    }
  };

  window._pdkCardEnter = function (id) {
    if (!_dragMode) return;
    var want = _dragMode === 'select';
    if (!!selected[id] === want) return;
    if (want) selected[id] = true;
    else delete selected[id];
    syncCardSelection(id);
    var s = window._pdkState;
    if (s) updateHintBanner(s, parseInt(sessionStorage.getItem('playerIndex'), 10));
  };

  window._pdkToggleCard = function (id) {
    if (selected[id]) delete selected[id];
    else selected[id] = true;
    syncCardSelection(id);
    var s = window._pdkState;
    if (s) updateHintBanner(s, parseInt(sessionStorage.getItem('playerIndex'), 10));
  };

  window._pdkHint = function () {
    var s = window._pdkState;
    if (!s) return;
    var pi = parseInt(sessionStorage.getItem('playerIndex'), 10);
    var plays = getLegalPlays(s, pi);
    if (!plays.length) {
      showToast(_t('pdk_no_legal_play'));
      return;
    }
    var key = plays.map(function (p) {
      return p.cards.map(function (c) { return c.id; }).join(',');
    }).join('|');
    if (key !== _hintKey) {
      _hintKey = key;
      _hintIndex = 0;
    } else {
      _hintIndex = (_hintIndex + 1) % plays.length;
    }
    selected = {};
    var pick = plays[_hintIndex].cards;
    for (var i = 0; i < pick.length; i++) selected[pick[i].id] = true;
    Object.keys(cardEls).forEach(syncCardSelection);
    updateHintBanner(s, pi);
  };

  window._pdkPlay = function () {
    var ids = Object.keys(selected);
    if (!ids.length) {
      showToast(_t('pdk_select_cards_first'));
      return;
    }
    selected = {};
    _hintIndex = -1;
    _hintKey = '';
    var h = document.getElementById('pdkHint');
    if (h) h.style.display = 'none';
    window.makeGameMove({ cards: ids });
  };

  window._pdkPass = function () {
    selected = {};
    _hintIndex = -1;
    _hintKey = '';
    var h = document.getElementById('pdkHint');
    if (h) h.style.display = 'none';
    window.makeGameMove({ cards: [] });
  };

  window._pdkNextRound = function () {
    selected = {};
    _hintIndex = -1;
    _hintKey = '';
    window.makeGameMove({ action: 'next_round' });
  };

  function showToast(msg) {
    if (window.showToast) window.showToast(msg);
  }

  function escHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
})();
