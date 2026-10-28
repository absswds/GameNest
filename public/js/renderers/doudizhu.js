// public/js/renderers/doudizhu.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var selected = {}; // card id -> true
  var cardEls = {};  // card id -> DOM element
  var _prevDdzState = null;
  var _hintIndex = -1;
  var _hints = [];
  var _lastHandLen = 0;
  var _lastHandHtml = '';
  var _deadlineKey = null, _localDeadline = 0;

  // Phone held sideways: opponents go to the sides and everything shrinks so hand + buttons fit.
  // (The markup uses inline styles, hence !important.)
  var LANDSCAPE_CSS = '@media (orientation: landscape) and (max-height: 540px){' +
    '#ddzWrap{display:grid !important;grid-template-columns:minmax(0,110px) minmax(0,1fr) minmax(0,110px);gap:4px 8px !important;max-width:760px !important;}' +
    '#ddzOpponents{display:contents !important;}' +
    '#ddzOpponents>div{padding:4px 8px !important;align-self:start;min-width:0;}' +
    '#ddzOpponents>div:nth-child(1){grid-column:1;grid-row:1;}' +
    '#ddzOpponents>div:nth-child(2){grid-column:3;grid-row:1;}' +
    '#ddzOpponents>div>div:nth-child(2){font-size:18px !important;margin-top:0 !important;}' +
    '#ddzPlayArea{grid-column:2;grid-row:1;min-height:0 !important;padding:6px 10px !important;gap:2px !important;border-radius:16px !important;}' +
    '#ddzHint{grid-column:1/-1;grid-row:2;padding:2px 8px !important;}' +
    '#ddzHand{grid-column:1/-1;grid-row:3;min-height:0 !important;padding:0 !important;}' +
    '#ddzHand .pc-md{--w:40px;}' +
    '#ddzHand .pc-layout-hand{padding-top:12px;}' +
    '#ddzActions{grid-column:1/-1;grid-row:4;gap:8px !important;}' +
    '#ddzActions .btn{min-height:32px;padding-top:4px;padding-bottom:4px;}' +
  '}';

  window.gameRenderers.set('doudizhu', {
    init: function(container) {
      if (!document.getElementById('ddz-styles')) {
        var st = document.createElement('style');
        st.id = 'ddz-styles';
        st.textContent = LANDSCAPE_CSS;
        document.head.appendChild(st);
      }
      container.innerHTML =
        '<div id="ddzWrap" style="width:100%;max-width:640px;display:flex;flex-direction:column;gap:10px;font-family:inherit;">' +
          '<div id="ddzOpponents" style="display:flex;justify-content:space-around;gap:8px;"></div>' +
          '<div id="ddzPlayArea" style="min-height:80px;background:var(--bg,#f8f9fa);border-radius:var(--radius,24px);padding:12px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;"></div>' +
          '<div id="ddzHint" style="display:none;text-align:center;font-size:13px;padding:4px 8px;background:var(--bg,#f8f9fa);border-radius:12px;"></div>' +
          '<div id="ddzHand" style="min-height:92px;padding:4px 0;"></div>' +
          '<div id="ddzActions" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;"></div>' +
        '</div>';
    },
    render: function(state, container, playerIndex, winner) {
      // With the full state broadcast fix, state is always the complete game state.
      var s = state;
      if (!s || !s.hands) return;

      var currentPlayer = state.currentPlayer != null ? state.currentPlayer : s.currentPlayer;

      // Detect pass: currentPlayer changed but lastPlay didn't change from previous state
      // A pass either marks passed[] or (second pass in a row) clears lastPlay
      if (_prevDdzState && _prevDdzState.phase === 'playing' && s.phase === 'playing' &&
          _prevDdzState.currentPlayer !== currentPlayer) {
        var passer = _prevDdzState.currentPlayer;
        var lpKey = JSON.stringify(s.lastPlay);
        var didPass = (lpKey === _prevDdzState.lastPlay && s.passed && s.passed[passer]) ||
          (_prevDdzState.lastPlay !== 'null' && !s.lastPlay);
        if (didPass && passer !== playerIndex) {
          var passerName = (window.gamePlayers && window.gamePlayers[passer]) ? window.gamePlayers[passer].name : (_t('ddz_player_fallback') + ' ' + (passer + 1));
          showToast(passerName + _t('ddz_player_passed'));
        }
      }
      _prevDdzState = { phase: s.phase, currentPlayer: currentPlayer, lastPlay: JSON.stringify(s.lastPlay) };

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
          '<div class="' + (isActive ? 'is-active-turn' : '') + '" style="text-align:center;padding:8px 16px;background:var(--bg,#f8f9fa);border-radius:var(--radius-sm,16px);' +
          (isActive ? '' : 'border:1px solid var(--border,#eee);') + '">' +
          '<div style="font-size:13px;font-weight:600;">' +
          (isLandlord ? '<span style="color:#c0392b;">&#x1F451;</span> ' : '') +
          escHtml((window.gamePlayers && window.gamePlayers[i]) ? window.gamePlayers[i].name : (_t('ddz_player_fallback') + ' ' + (i + 1))) +
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
        var who = escHtml(s.lastPlay.player === selfIdx ? _t('ddz_you') : ((window.gamePlayers && window.gamePlayers[s.lastPlay.player]) ? window.gamePlayers[s.lastPlay.player].name : (_t('ddz_player_fallback') + ' ' + (s.lastPlay.player + 1))));
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
        var bidMode = s.bidMode || 'rob';
        if (bidMode === 'rob' && s.callPhase) {
          var bidInfo = '<div style="font-size:13px;color:var(--text-muted,#999);margin-bottom:6px;">' + _t('ddz_bidding_phase') + '</div>';
          for (var cr = 0; cr < (s._playerCount || 3); cr++) {
            var crName = escHtml((window.gamePlayers && window.gamePlayers[cr]) ? window.gamePlayers[cr].name : (_t('ddz_player_fallback') + ' ' + (cr + 1)));
            var crLabel = '';
            var crActive = s.currentBidder === cr;
            if (s.callPhase === 'call') {
              if (s.calledPlayers && s.calledPlayers.indexOf(cr) >= 0) crLabel = ' ✓ ' + _t('ddz_call_landlord');
              else if (s.passedCall && s.passedCall[cr]) crLabel = ' ✗ ' + _t('ddz_no_call');
              else crLabel = ' ...';
            } else if (s.callPhase === 'rob') {
              if (s.robAttempts && s.robAttempts.indexOf(cr) >= 0) crLabel = ' ✓ ' + _t('ddz_rob');
              else if (s.eligibleForRob && !s.eligibleForRob[cr]) crLabel = ' ✗ ' + _t('ddz_no_rob');
              else if (s.passedCall && s.passedCall[cr]) crLabel = ' ✗ ' + _t('ddz_no_call');
              else crLabel = ' ...';
            }
            if (s.landlordCandidate === cr) crLabel += ' 👑';
            var crColor = crActive ? '#c8a45c' : (crLabel.indexOf('✓') >= 0 ? '#5a9e6f' : (crLabel.indexOf('✗') >= 0 ? '#999' : '#666'));
            bidInfo += '<div style="font-size:12px;font-weight:' + (crActive ? '800' : '600') + ';color:' + crColor + ';margin:2px 0;">' +
              crName + crLabel + (crActive ? ' ◀' : '') + '</div>';
          }
          if (s.gameMultiplier > 1) bidInfo += '<div style="font-size:12px;font-weight:700;color:#c0392b;margin-top:4px;">×' + s.gameMultiplier + '</div>';
          parts.push(bidInfo);
        } else {
          // 叫分 mode (existing)
          var bidInfo = '<div style="font-size:13px;color:var(--text-muted,#999);margin-bottom:4px;">' + _t('ddz_bidding_phase') + '</div>';
          if (s.bids && Object.keys(s.bids).length > 0) {
            bidInfo += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
            for (var bi = 0; bi < (s._playerCount || 3); bi++) {
              var bidVal = s.bids[bi];
              var biName = escHtml((window.gamePlayers && window.gamePlayers[bi]) ? window.gamePlayers[bi].name : (_t('ddz_player_fallback') + ' ' + (bi + 1)));
              if (bidVal !== undefined) {
                var bidColor = bidVal === 0 ? 'var(--text-muted,#999)' : (bidVal === 3 ? '#c0392b' : 'var(--accent,#c8a45c)');
                bidInfo += '<span style="font-size:12px;font-weight:700;color:' + bidColor + ';">' + biName + ': ' + (bidVal === 0 ? _t('ddz_no_bid_display') : bidVal) + '</span>';
              }
            }
            bidInfo += '</div>';
          }
          parts.push(bidInfo);
        }
      }

      // Current round info
      if (s.landlord != null && s.phase === 'playing') {
        var landlordName = escHtml((window.gamePlayers && window.gamePlayers[s.landlord]) ? window.gamePlayers[s.landlord].name : (_t('ddz_player_fallback') + ' ' + (s.landlord + 1)));
        var landHtml = '<div style="font-size:12px;color:#c0392b;">&#x1F451; ' + _t('ddz_landlord_label') + ': ' + landlordName + '</div>';
        parts.push(landHtml);
      }

      // Multiplier display
      if (s.gameMultiplier > 1) {
        parts.push('<div style="font-size:12px;font-weight:700;color:#c0392b;">' + _t('ddz_multiplier') + ': ×' + s.gameMultiplier + '</div>');
      }

      // Countdown timer
      if (s.playTimeLimit > 0 && s.phase === 'playing' && s.currentTurnDeadline) {
        // Measure from when this deadline first arrived, not the server clock
        if (_deadlineKey !== s.currentTurnDeadline) {
          _deadlineKey = s.currentTurnDeadline;
          _localDeadline = Date.now() + s.playTimeLimit * 1000;
        }
        var elapsed = Date.now() - (_localDeadline - s.playTimeLimit * 1000);
        var pct = Math.max(0, Math.min(1, 1 - elapsed / (s.playTimeLimit * 1000)));
        var barColor = pct > 0.3 ? '#5a9e6f' : (pct > 0.15 ? '#e67e22' : '#e74c3c');
        var timeHtml = '<div style="width:100%;max-width:200px;">' +
          '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted,#999);margin-bottom:2px;">' +
          '<span>' + _t('ddz_time_left') + '</span><span id="ddzTimeTxt">' + Math.ceil(pct * s.playTimeLimit) + 's</span>' +
          '</div>' +
          '<div style="height:6px;background:#eee;border-radius:3px;overflow:hidden;">' +
          '<div id="ddzTimeBar" style="height:100%;width:' + (pct * 100) + '%;background:' + barColor + ';border-radius:3px;transition:width 0.3s;"></div>' +
          '</div>' +
          '</div>';
        parts.push(timeHtml);
      }

      // Round end
      if (s.phase === 'roundEnd') {
        var reHtml = '<div style="font-size:14px;font-weight:700;">' + _tf('ddz_round_end_title', s.currentRound || 1) + '</div>';
        if (s.scores) {
          reHtml += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:4px;font-size:13px;">';
          for (var ri = 0; ri < s.scores.length; ri++) {
            var riName = escHtml((window.gamePlayers && window.gamePlayers[ri]) ? window.gamePlayers[ri].name : (_t('ddz_player_fallback') + ' ' + (ri + 1)));
            var riScore = s.scores[ri] !== undefined ? s.scores[ri] : 0;
            reHtml += '<span style="font-weight:600;color:' + (riScore >= 0 ? '#5a9e6f' : '#e74c3c') + ';">' + riName + ': ' + (riScore >= 0 ? '+' : '') + riScore + '</span>';
          }
          reHtml += '</div>';
        }
        if (s.cumulativeScore) {
          reHtml += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:2px;font-size:12px;color:var(--text-muted,#999);">';
          for (var ci = 0; ci < s.cumulativeScore.length; ci++) {
            var ciName = escHtml((window.gamePlayers && window.gamePlayers[ci]) ? window.gamePlayers[ci].name : (_t('ddz_player_fallback') + ' ' + (ci + 1)));
            reHtml += '<span>' + ciName + ': ' + s.cumulativeScore[ci] + '</span>';
          }
          reHtml += '</div>';
        }
        parts.push(reHtml);
      }

      // Continue vote
      if (s.phase === 'continue_vote') {
        var cvHtml = '<div style="font-size:14px;font-weight:700;text-align:center;">' + _tf('ddz_continue_prompt', (s.currentRound || 0) + 1) + '</div>';
        if (s.cumulativeScore) {
          cvHtml += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:4px;font-size:13px;">';
          for (var vi = 0; vi < s.cumulativeScore.length; vi++) {
            var viName = escHtml((window.gamePlayers && window.gamePlayers[vi]) ? window.gamePlayers[vi].name : (_t('ddz_player_fallback') + ' ' + (vi + 1)));
            cvHtml += '<span style="font-weight:600;">' + viName + ': ' + s.cumulativeScore[vi] + '</span>';
          }
          cvHtml += '</div>';
        }
        // Check if self has already voted
        if (s.continueVoting && s.continueVoting.votes && s.continueVoting.votes[selfIdx] !== undefined) {
          cvHtml += '<div style="font-size:12px;color:var(--text-muted,#999);margin-top:4px;">' + _t('ddz_waiting_votes') + '</div>';
        }
        parts.push(cvHtml);
      }

      // Game over (final scoreboard)
      if (s.phase === 'over' && s.totalRounds > 1) {
        var goHtml = '<div style="font-size:15px;font-weight:700;color:var(--accent,#c8a45c);">' + _t('ddz_final_scores') + '</div>';
        if (s.cumulativeScore) {
          goHtml += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:6px;font-size:14px;">';
          var bestScore = Math.max.apply(null, s.cumulativeScore);
          for (var gi = 0; gi < s.cumulativeScore.length; gi++) {
            var giName = escHtml((window.gamePlayers && window.gamePlayers[gi]) ? window.gamePlayers[gi].name : (_t('ddz_player_fallback') + ' ' + (gi + 1)));
            var isWinner = s.cumulativeScore[gi] === bestScore;
            var crown = isWinner ? '&#x1F451; ' : '';
            goHtml += '<div style="font-weight:' + (isWinner ? '700' : '400') + ';color:' + (isWinner ? '#c0392b' : 'inherit') + ';text-align:center;">' +
              crown + giName + '<br><span style="font-size:18px;">' + s.cumulativeScore[gi] + '</span></div>';
          }
          goHtml += '</div>';
        }
        parts.push(goHtml);
      }

      el.innerHTML = parts.length > 0 ? parts.join('<div style="height:4px;"></div>') : '';

      // 倒计时实时刷新：只更新文字和进度条，重渲染时替换旧定时器
      if (window._ddzTimer) { clearInterval(window._ddzTimer); window._ddzTimer = null; }
      if (s.playTimeLimit > 0 && s.phase === 'playing' && s.currentTurnDeadline) {
        var total = s.playTimeLimit * 1000, deadline = _localDeadline;
        var tick = function() {
          var txt = document.getElementById('ddzTimeTxt'), bar = document.getElementById('ddzTimeBar');
          if (!txt || !bar) { clearInterval(window._ddzTimer); window._ddzTimer = null; return; }
          var left = Math.max(0, Math.min(1, (deadline - Date.now()) / total));
          txt.textContent = Math.ceil(left * s.playTimeLimit) + 's';
          bar.style.width = (left * 100) + '%';
          bar.style.background = left > 0.3 ? '#5a9e6f' : (left > 0.15 ? '#e67e22' : '#e74c3c');
          if (left <= 0) { clearInterval(window._ddzTimer); window._ddzTimer = null; }
        };
        window._ddzTimer = setInterval(tick, 250);
      }
    },

    renderHand: function(s, selfIdx, cp) {
      var el = document.getElementById('ddzHand');
      if (!el) return;
      var hand = s.hands[selfIdx];
      // Drop selections for cards no longer in hand (new round, timeout auto-play)
      var inHand = {};
      (hand || []).forEach(function(c) { if (c) inHand[c.id] = true; });
      Object.keys(selected).forEach(function(id) { if (!inHand[id]) delete selected[id]; });
      if (!hand || hand.length === 0) { el.innerHTML = ''; _lastHandLen = 0; _lastHandHtml = ''; return; }

      var myTurn = (cp === selfIdx && s.phase === 'playing');
      // Deal animation only when a fresh hand arrives (new round), not on every update
      var deal = hand.length > _lastHandLen + 3;
      _lastHandLen = hand.length;
      var handHtml = window.CardUI.group(hand, {
        layout: 'hand',
        deal: deal,
        cardOpts: function(c) {
          return {
            size: 'md',
            selected: !!selected[c.id],
            className: myTurn ? 'pc-selectable ddz-card' : 'ddz-card',
            jokerLabel: jokerLabel(c),
            attrs: myTurn ? 'onclick="window._ddzToggleCard(\'' + c.id + '\')"' : ''
          };
        }
      });
      if (handHtml === _lastHandHtml && el.firstChild) return;
      el.innerHTML = handHtml;
      _lastHandHtml = handHtml;

      cardEls = {};
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
      } else if (s.phase === 'continue_vote' && winner == null) {
        var voted = s.continueVoting && s.continueVoting.votes && s.continueVoting.votes[selfIdx] !== undefined;
        if (!voted) {
          html = '<button class="btn btn-sm btn-primary" onclick="window._ddzContinueVote(\'yes\')" style="min-width:80px;">' + _t('ddz_vote_yes') + '</button>' +
                 '<button class="btn btn-sm btn-outline" onclick="window._ddzContinueVote(\'no\')" style="min-width:80px;">' + _t('ddz_vote_no') + '</button>';
        }
      } else if (s.phase === 'roundEnd' && winner == null) {
        html = '<button class="btn btn-sm btn-primary" onclick="window._ddzNextRound()" style="min-width:100px;">' + _t('ddz_next_round') + '</button>';
      }

      el.innerHTML = html;
    }
  });

  // ---- Helpers ----

  function jokerLabel(c) {
    if (c.id === 'SJ') return _t('ddz_joker_small');
    if (c.id === 'BJ') return _t('ddz_joker_big');
    return '';
  }

  function cardSpan(c) {
    return window.CardUI.render(c, { size: 'sm', jokerLabel: jokerLabel(c) });
  }

  function renderBidButtons(s) {
    var bidMode = s.bidMode || 'rob';
    if (bidMode === 'rob') {
      if (s.callPhase === 'call' || !s.callPhase) {
        return '<button class="btn btn-sm btn-primary" onclick="window._ddzCall()" style="min-width:80px;">' + _t('ddz_call_landlord') + '</button>' +
               '<button class="btn btn-sm btn-outline" onclick="window._ddzNoCall()" style="min-width:80px;">' + _t('ddz_no_call') + '</button>';
      } else if (s.callPhase === 'rob') {
        return '<button class="btn btn-sm btn-primary" onclick="window._ddzRob()" style="min-width:80px;">' + _t('ddz_rob') + '</button>' +
               '<button class="btn btn-sm btn-outline" onclick="window._ddzNoRob()" style="min-width:80px;">' + _t('ddz_no_rob') + '</button>';
      }
      return '';
    }
    // Score-based bidding (default)
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
    var isFree = !s.lastPlay || s.lastPlay.player === selfIdx;
    var html = '<button class="btn btn-sm btn-primary" onclick="window._ddzPlay()" style="min-width:80px;">' + _t('ddz_play') + '</button>';
    if (!isFree) {
      html += '<button class="btn btn-sm btn-outline" onclick="window._ddzHint()" style="min-width:60px;">💡' + _t('ddz_hint') + '</button>';
    }
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
    if (cardEls[id]) cardEls[id].classList.toggle('is-selected', !!selected[id]);
    var state = getCurrentState();
    if (state) {
      var playerIndex = parseInt(sessionStorage.getItem('playerIndex'));
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
        var lastName = lastPlay.play.name || _t('ddz_' + lastPlay.play.type);
        html += ' <span style="color:#e74c3c;">' + _tf('ddz_cannot_beat', lastName) + '</span>';
      }
      hintEl.innerHTML = html;
    }
  }

  // ---- Hint generation ----

  function _groupCards(hand) {
    var g = {};
    for (var i = 0; i < hand.length; i++) {
      var r = hand[i].rank;
      if (!g[r]) g[r] = [];
      g[r].push(hand[i]);
    }
    return g;
  }

  function _sortedRanks(groups) {
    return Object.keys(groups).sort(function(a,b) { return _rankVal(a) - _rankVal(b); });
  }

  function _ids(cards) {
    return cards.map(function(c) { return c.id; });
  }

  function _findStraights(groups, minLen) {
    var ranks = _sortedRanks(groups);
    var straights = [];
    var seq = [];
    for (var i = 0; i < ranks.length; i++) {
      var rv = _rankVal(ranks[i]);
      if (rv >= 12) break;
      if (seq.length === 0 || rv === _rankVal(seq[seq.length-1]) + 1) {
        seq.push(ranks[i]);
      } else {
        if (seq.length >= minLen) straights.push(seq.slice());
        seq = [ranks[i]];
      }
    }
    if (seq.length >= minLen) straights.push(seq.slice());
    return straights;
  }

  // Every len-long window of each maximal run, so longer runs still yield hints
  function _windows(seqs, len) {
    var out = [];
    seqs.forEach(function(seq) {
      for (var i = 0; i + len <= seq.length; i++) out.push(seq.slice(i, i + len));
    });
    return out;
  }

  function _hasRank(groups, rank, count) {
    return groups[rank] && groups[rank].length >= count;
  }

  function generateHints(hand, lastPlay, selfIdx) {
    if (!hand || hand.length === 0) return [];
    var groups = _groupCards(hand);
    var hints = [];
    var ranks = _sortedRanks(groups);

    var isFree = !lastPlay || lastPlay.player === selfIdx;
    var lp = lastPlay ? lastPlay.play : null;

    function addHint(ids) {
      if (ids && ids.length > 0) hints.push(ids);
    }

    if (isFree) {
      // Singles
      for (var si = 0; si < ranks.length; si++)
        addHint([groups[ranks[si]][0].id]);
      // Pairs
      for (var pi = 0; pi < ranks.length; pi++)
        if (groups[ranks[pi]].length >= 2) addHint(_ids(groups[ranks[pi]].slice(0, 2)));
      // Triples
      for (var ti = 0; ti < ranks.length; ti++) {
        if (groups[ranks[ti]].length >= 3) {
          var triple = _ids(groups[ranks[ti]].slice(0, 3));
          addHint(triple);
          // Triple + 1 (use highest remaining single as kicker)
          for (var k1 = ranks.length - 1; k1 >= 0; k1--) {
            if (k1 !== ti && groups[ranks[k1]].length >= 1) {
              addHint(triple.concat([groups[ranks[k1]][0].id]));
              break;
            }
          }
          // Triple + 2
          for (var k2 = ranks.length - 1; k2 >= 0; k2--) {
            if (k2 !== ti && groups[ranks[k2]].length >= 2) {
              addHint(triple.concat(_ids(groups[ranks[k2]].slice(0, 2))));
              break;
            }
          }
        }
      }
      // Straights (5+)
      var straights = _findStraights(groups, 5);
      for (var st = 0; st < straights.length; st++) {
        if (straights[st].length >= 5) {
          addHint(straights[st].map(function(r) { return groups[r][0].id; }));
        }
      }
      // Consecutive pairs (3+)
      var pairSeqs = _findStraights(
        Object.keys(groups).reduce(function(acc, r) {
          if (groups[r].length >= 2) acc[r] = groups[r];
          return acc;
        }, {}), 3);
      for (var cp = 0; cp < pairSeqs.length; cp++) {
        var cpIds = [];
        for (var cpi = 0; cpi < pairSeqs[cp].length; cpi++)
          cpIds = cpIds.concat(_ids(groups[pairSeqs[cp][cpi]].slice(0, 2)));
        addHint(cpIds);
      }
      // Planes (2+ consecutive triples)
      var tripleSeqs = _findStraights(
        Object.keys(groups).reduce(function(acc, r) {
          if (groups[r].length >= 3) acc[r] = groups[r];
          return acc;
        }, {}), 2);
      for (var pl = 0; pl < tripleSeqs.length; pl++) {
        if (tripleSeqs[pl].length >= 2) {
          var plIds = [];
          for (var pli = 0; pli < tripleSeqs[pl].length; pli++)
            plIds = plIds.concat(_ids(groups[tripleSeqs[pl][pli]].slice(0, 3)));
          addHint(plIds);
        }
      }
    } else {
      if (!lp) return [];
      // Beating play: find same type with higher rank, plus bombs+rockets
      if (lp.type === 'single') {
        for (var bi = 0; bi < ranks.length; bi++)
          if (_rankVal(ranks[bi]) > lp.rank && groups[ranks[bi]].length >= 1)
            addHint([groups[ranks[bi]][0].id]);
      } else if (lp.type === 'pair') {
        for (var bj = 0; bj < ranks.length; bj++)
          if (_rankVal(ranks[bj]) > lp.rank && groups[ranks[bj]].length >= 2)
            addHint(_ids(groups[ranks[bj]].slice(0, 2)));
      } else if (lp.type === 'triple' || lp.type === 'triple_one' || lp.type === 'triple_two') {
        for (var bk = 0; bk < ranks.length; bk++) {
          if (_rankVal(ranks[bk]) > lp.rank && groups[ranks[bk]].length >= 3) {
            var t = _ids(groups[ranks[bk]].slice(0, 3));
            if (lp.type === 'triple') addHint(t);
            else if (lp.type === 'triple_one') {
              for (var k1 = 0; k1 < ranks.length; k1++)
                if (k1 !== bk && groups[ranks[k1]].length >= 1)
                  { addHint(t.concat([groups[ranks[k1]][0].id])); break; }
            } else {
              for (var k2 = 0; k2 < ranks.length; k2++)
                if (k2 !== bk && groups[ranks[k2]].length >= 2)
                  { addHint(t.concat(_ids(groups[ranks[k2]].slice(0, 2)))); break; }
            }
          }
        }
      } else if (lp.type === 'straight') {
        var straights2 = _windows(_findStraights(groups, lp.length), lp.length);
        for (var bs = 0; bs < straights2.length; bs++) {
          if (straights2[bs].length === lp.length && _rankVal(straights2[bs][0]) > lp.rank)
            addHint(straights2[bs].map(function(r) { return groups[r][0].id; }));
        }
      } else if (lp.type === 'consecutive_pairs') {
        var pairSeqs2 = _findStraights(
          Object.keys(groups).reduce(function(acc, r) {
            if (groups[r].length >= 2) acc[r] = groups[r];
            return acc;
          }, {}), lp.length);
        pairSeqs2 = _windows(pairSeqs2, lp.length);
        for (var bp = 0; bp < pairSeqs2.length; bp++) {
          if (pairSeqs2[bp].length === lp.length && _rankVal(pairSeqs2[bp][0]) > lp.rank) {
            var ids = [];
            for (var pp = 0; pp < pairSeqs2[bp].length; pp++)
              ids = ids.concat(_ids(groups[pairSeqs2[bp][pp]].slice(0, 2)));
            addHint(ids);
          }
        }
      } else if (lp.type === 'plane' || lp.type === 'plane_wings_1' || lp.type === 'plane_wings_2') {
        var planeSeqs = _findStraights(
          Object.keys(groups).reduce(function(acc, r) {
            if (groups[r].length >= 3) acc[r] = groups[r];
            return acc;
          }, {}), lp.length);
        planeSeqs = _windows(planeSeqs, lp.length);
        for (var bpl = 0; bpl < planeSeqs.length; bpl++) {
          if (planeSeqs[bpl].length === lp.length && _rankVal(planeSeqs[bpl][0]) > lp.rank) {
            var pids = [];
            for (var plj = 0; plj < planeSeqs[bpl].length; plj++)
              pids = pids.concat(_ids(groups[planeSeqs[bpl][plj]].slice(0, 3)));
            if (lp.type !== 'plane') {
              // Wings: one single or pair per triple, from ranks outside the plane
              var wingSize = lp.type === 'plane_wings_1' ? 1 : 2;
              var wings = [];
              for (var wr = 0; wr < ranks.length && wings.length < lp.length * wingSize; wr++) {
                if (planeSeqs[bpl].indexOf(ranks[wr]) !== -1 || groups[ranks[wr]].length < wingSize) continue;
                wings = wings.concat(_ids(groups[ranks[wr]].slice(0, wingSize)));
              }
              if (wings.length < lp.length * wingSize) continue;
              pids = pids.concat(wings);
            }
            addHint(pids);
          }
        }
      }
      // Bombs (always add)
      for (var bm = 0; bm < ranks.length; bm++) {
        if (groups[ranks[bm]].length === 4)
          addHint(_ids(groups[ranks[bm]].slice(0, 4)));
      }
      // Rocket
      var sj2 = hand.find(function(c) { return c.id === 'SJ'; });
      var bj2 = hand.find(function(c) { return c.id === 'BJ'; });
      if (sj2 && bj2) addHint([sj2.id, bj2.id]);
    }

    // Deduplicate
    var seen = {};
    return hints.filter(function(h) {
      var key = h.slice().sort().join(',');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  window._ddzHint = function() {
    var s = getCurrentState();
    if (!s) return;
    var pi = parseInt(sessionStorage.getItem('playerIndex'));
    if (!isFinite(pi) || pi < 0) return;
    var hand = s.hands[pi];
    if (!hand || hand.length === 0) return;
    var lastPlay = s.lastPlay;
    var isFree = !lastPlay || lastPlay.player === pi;

    _hints = generateHints(hand, lastPlay, pi);
    if (_hints.length === 0) return;

    _hintIndex = _hintIndex < 0 ? 0 : (_hintIndex + 1) % _hints.length;
    selected = {};
    var ids = _hints[_hintIndex];
    for (var h = 0; h < ids.length; h++) selected[ids[h]] = true;

    var renderer = window.gameRenderers.get('doudizhu');
    if (renderer && renderer.renderHand) renderer.renderHand(s, pi, s.currentPlayer);
    updateDdzHint(s, pi);

    // Ensure the hint element is visible
    var hintEl = document.getElementById('ddzHint');
    if (hintEl && hintEl.style.display !== 'none') {
      showToast(_t('ddz_hint') + ' (' + ids.length + ' ' + _t('ddz_cards_label') + ')');
    }
  };

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
    selected = {}; _hintIndex = -1; _hints = [];
    var h = document.getElementById('ddzHint'); if (h) h.style.display = 'none';
    window.makeGameMove({ cards: ids });
  };

  window._ddzPass = function() {
    selected = {}; _hintIndex = -1; _hints = [];
    var h = document.getElementById('ddzHint'); if (h) h.style.display = 'none';
    window.makeGameMove({ cards: [] });
  };

  window._ddzCall = function() { selected = {}; var h = document.getElementById('ddzHint'); if (h) h.style.display = 'none'; window.makeGameMove({ call: true }); };
  window._ddzNoCall = function() { selected = {}; var h = document.getElementById('ddzHint'); if (h) h.style.display = 'none'; window.makeGameMove({ pass: true }); };
  window._ddzRob = function() { selected = {}; var h = document.getElementById('ddzHint'); if (h) h.style.display = 'none'; window.makeGameMove({ rob: true }); };
  window._ddzNoRob = function() { selected = {}; var h = document.getElementById('ddzHint'); if (h) h.style.display = 'none'; window.makeGameMove({ passRob: true }); };
  window._ddzContinueVote = function(vote) { window.makeGameMove({ action: 'continue_vote', vote: vote }); };
  window._ddzNextRound = function() { window.makeGameMove({ action: 'next_round' }); };

  function getCurrentState() {
    // room-client stores state in closure; we expose it via window hook
    if (window._ddzState) return window._ddzState;
    return null;
  }

  function showToast(msg) { if (window.showToast) window.showToast(msg); }

  function escHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  // Cache the latest state for the hint button
  var origRendererRender = window.gameRenderers.get('doudizhu').render;
  window.gameRenderers.get('doudizhu').render = function(state, container, playerIndex, winner) {
    if (state !== window._ddzState) { _hintIndex = -1; _hints = []; }
    window._ddzState = state;
    origRendererRender.call(this, state, container, playerIndex, winner);
  };
})();
