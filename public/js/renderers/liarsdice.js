(function () {
  var STYLE_ID = 'ld-renderer-styles';
  var FACE_ORDER = [2, 3, 4, 5, 6, 1];
  var PIP_MASKS = {
    1: [4],
    2: [2, 6],
    3: [2, 4, 6],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  var STYLES = [
    '.ld-board { display:flex; flex-direction:column; gap:10px; max-width:760px; margin:0 auto; padding:8px; box-sizing:border-box; }',
    '.ld-topbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; background:var(--surface, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:8px 12px; }',
    '.ld-meta { display:flex; align-items:center; flex-wrap:wrap; gap:8px; font-size:13px; font-weight:600; }',
    '.ld-pill { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:999px; font-size:12px; font-weight:600; background:rgba(148,163,184,0.16); color:var(--text, #f8fafc); }',
    '.ld-pill--wild { background:rgba(245,158,11,0.2); color:#fbbf24; border:1px solid rgba(245,158,11,0.35); }',
    '.ld-pill--used { background:rgba(239,68,68,0.16); color:#f87171; }',
    '.ld-turn { font-size:13px; font-weight:700; color:var(--text, #f8fafc); }',
    '.ld-turn--mine { color:#34d399; }',
    '.ld-timer-wrap { width:100%; height:5px; border-radius:999px; background:rgba(148,163,184,0.2); overflow:hidden; }',
    '.ld-timer-fill { height:100%; border-radius:999px; background:linear-gradient(90deg, #38bdf8, #34d399); transition:width 0.1s linear; }',
    '.ld-timer-fill--low { background:linear-gradient(90deg, #f97316, #ef4444); }',
    '.ld-seats { display:grid; grid-template-columns:repeat(auto-fit, minmax(112px, 1fr)); gap:8px; }',
    '.ld-seat { display:flex; flex-direction:column; gap:4px; padding:8px 10px; border-radius:10px; background:var(--surface, #1e293b); border:1px solid var(--border, #334155); transition:border-color 0.2s, box-shadow 0.2s, opacity 0.2s; }',
    '.ld-seat--active { border-color:#38bdf8; box-shadow:0 0 0 2px rgba(56,189,248,0.25); }',
    '.ld-seat--out { opacity:0.45; }',
    '.ld-seat-head { display:flex; align-items:center; justify-content:space-between; gap:6px; font-size:13px; font-weight:600; }',
    '.ld-seat-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    '.ld-cup-row { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted, #94a3b8); }',
    '.ld-cup-icon { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:6px; background:rgba(56,189,248,0.14); font-size:13px; }',
    '.ld-seat-tag { font-size:11px; font-weight:700; color:#fbbf24; }',
    '.ld-left-col { display:flex; flex-direction:column; gap:10px; }',
    '.ld-arena { background:radial-gradient(circle at top, rgba(16,185,129,0.14), rgba(15,23,42,0.65)); border:1px solid var(--border, #334155); border-radius:14px; padding:14px; display:flex; flex-direction:column; align-items:center; gap:10px; }',
    '.ld-current-bid { display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap; }',
    '.ld-bid-qty { font-size:30px; font-weight:800; line-height:1; letter-spacing:-0.02em; }',
    '.ld-bid-x { font-size:20px; font-weight:700; color:var(--text-muted, #94a3b8); }',
    '.ld-bid-by { font-size:13px; color:var(--text-muted, #94a3b8); text-align:center; }',
    '.ld-history { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; }',
    '.ld-hist-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:999px; font-size:11px; background:rgba(15,23,42,0.55); border:1px solid rgba(148,163,184,0.2); color:var(--text-muted, #cbd5e1); }',
    '.ld-die { display:inline-grid; grid-template-columns:repeat(3, 1fr); grid-template-rows:repeat(3, 1fr); gap:2px; padding:5px; width:42px; height:42px; border-radius:9px; background:#f8fafc; border:2px solid #cbd5e1; box-sizing:border-box; box-shadow:0 2px 6px rgba(0,0,0,0.28); flex-shrink:0; }',
    '.ld-die--lg { width:48px; height:48px; padding:6px; border-radius:10px; }',
    '.ld-die--sm { width:30px; height:30px; padding:3px; border-radius:6px; gap:1px; }',
    '.ld-die--xs { width:22px; height:22px; padding:2px; border-radius:5px; gap:1px; border-width:1px; }',
    '.ld-die--match { border-color:#10b981; background:#ecfdf5; box-shadow:0 0 0 2px rgba(16,185,129,0.45); }',
    '.ld-die--wild { border-color:#f59e0b; background:#fffbeb; box-shadow:0 0 0 2px rgba(245,158,11,0.45); }',
    '.ld-die--dim { opacity:0.42; }',
    '.ld-pip { width:100%; height:100%; border-radius:50%; background:transparent; }',
    '.ld-pip--on { background:#0f172a; }',
    '.ld-die--one .ld-pip--on { background:#dc2626; }',
    '.ld-reveal-banner { font-size:15px; font-weight:700; text-align:center; }',
    '.ld-reveal-sub { font-size:13px; color:var(--text-muted, #cbd5e1); text-align:center; }',
    '.ld-reveal-grid { width:100%; display:flex; flex-direction:column; gap:6px; }',
    '.ld-reveal-row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 10px; border-radius:9px; background:rgba(15,23,42,0.55); border:1px solid rgba(148,163,184,0.18); }',
    '.ld-reveal-row--loser { border-color:rgba(239,68,68,0.65); background:rgba(239,68,68,0.12); }',
    '.ld-reveal-name { font-size:13px; font-weight:600; min-width:80px; }',
    '.ld-reveal-dice { display:flex; flex-wrap:wrap; gap:5px; justify-content:flex-end; }',
    '.ld-mine { background:var(--surface, #1e293b); border:1px solid var(--border, #334155); border-radius:14px; padding:12px; display:flex; flex-direction:column; gap:10px; }',
    '.ld-mine-head { display:flex; align-items:center; justify-content:space-between; font-size:13px; font-weight:600; }',
    '.ld-my-dice { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:8px; min-height:46px; }',
    '.ld-controls { display:flex; flex-direction:column; gap:10px; }',
    '.ld-picker-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }',
    '.ld-qty-box { display:inline-flex; align-items:center; gap:8px; background:rgba(15,23,42,0.45); padding:4px 8px; border-radius:10px; border:1px solid var(--border, #334155); }',
    '.ld-step-btn { min-width:44px; min-height:44px; border-radius:8px; border:1px solid var(--border, #475569); background:var(--surface-2, #334155); color:var(--text, #f8fafc); font-size:20px; font-weight:700; cursor:pointer; }',
    '.ld-step-btn:disabled { opacity:0.35; cursor:not-allowed; }',
    '.ld-qty-val { min-width:34px; text-align:center; font-size:22px; font-weight:800; }',
    '.ld-face-grid { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; flex:1; }',
    '.ld-face-btn { min-width:46px; min-height:46px; padding:4px; border-radius:10px; border:2px solid transparent; background:rgba(15,23,42,0.45); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; transition:border-color 0.15s, transform 0.12s; }',
    '.ld-face-btn--sel { border-color:#38bdf8; background:rgba(56,189,248,0.18); transform:translateY(-1px); }',
    '.ld-actions { display:flex; gap:10px; flex-wrap:wrap; }',
    '.ld-act-btn { flex:1; min-width:130px; min-height:46px; font-size:15px; font-weight:700; border-radius:10px; cursor:pointer; }',
    '.ld-btn-challenge { background:#ef4444; color:#fff; border:none; }',
    '.ld-btn-challenge:disabled { opacity:0.4; cursor:not-allowed; }',
    '.ld-btn-next { min-height:44px; min-width:160px; font-weight:700; }',
    '@media (orientation: landscape) and (max-height: 540px) {',
    '  .ld-board { display:grid; grid-template-columns:1fr 1.15fr; grid-template-rows:auto 1fr; gap:8px; max-width:960px; padding:6px; }',
    '  .ld-topbar { grid-column:1 / -1; padding:6px 10px; }',
    '  .ld-seats { grid-template-columns:repeat(auto-fit, minmax(96px, 1fr)); gap:6px; }',
    '  .ld-arena { padding:10px; gap:6px; }',
    '  .ld-mine { padding:9px; gap:8px; justify-content:space-between; }',
    '  .ld-die { width:36px; height:36px; padding:4px; }',
    '  .ld-die--sm { width:26px; height:26px; }',
    '  .ld-face-btn { min-width:44px; min-height:44px; }',
    '}',
  ].join('\n');

  var curState = null;
  var curContainer = null;
  var curPlayerIndex = 0;
  var selQty = 1;
  var selFace = 2;
  var lastBidKey = '';
  var prevKey = '';
  var deadlineKey = '';
  var localDeadline = 0;
  var totalMs = 20000;
  var timerRaf = 0;

  function t(key) {
    return typeof window._t === 'function' ? window._t(key) : key;
  }

  function tf(key) {
    if (typeof window._tf === 'function') {
      return window._tf.apply(null, arguments);
    }
    return key;
  }

  function playerName(idx) {
    if (typeof window.getPlayerName === 'function') return window.getPlayerName(idx);
    return 'Player ' + (idx + 1);
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function faceRank(f) {
    return f === 1 ? 7 : f;
  }

  function isLegalRaise(qty, face, currentBid) {
    if (!currentBid) return qty >= 1 && face >= 1 && face <= 6;
    if (qty > currentBid.qty) return true;
    return qty === currentBid.qty && faceRank(face) > faceRank(currentBid.face);
  }

  function minLegalQty(face, currentBid) {
    if (!currentBid) return 1;
    return faceRank(face) > faceRank(currentBid.face) ? currentBid.qty : currentBid.qty + 1;
  }

  function minimalRaise(currentBid) {
    if (!currentBid) return { qty: 1, face: 2 };
    var idx = FACE_ORDER.indexOf(currentBid.face);
    if (idx >= 0 && idx < FACE_ORDER.length - 1) {
      return { qty: currentBid.qty, face: FACE_ORDER[idx + 1] };
    }
    return { qty: currentBid.qty + 1, face: 2 };
  }

  function dieHtml(face, cls) {
    var pips = PIP_MASKS[face] || [];
    var extra = (face === 1 ? ' ld-die--one' : '') + (cls ? ' ' + cls : '');
    var html = '<span class="ld-die' + extra + '" aria-label="' + face + '">';
    for (var i = 0; i < 9; i++) {
      var on = pips.indexOf(i) !== -1;
      html += '<span class="ld-pip' + (on ? ' ld-pip--on' : '') + '"></span>';
    }
    html += '</span>';
    return html;
  }

  function stopTimer() {
    if (timerRaf) {
      cancelAnimationFrame(timerRaf);
      timerRaf = 0;
    }
  }

  function updateTimerBar() {
    if (!curContainer || !localDeadline) return;
    var fill = curContainer.querySelector('.ld-timer-fill');
    if (!fill) return;
    var left = Math.max(0, localDeadline - Date.now());
    var pct = totalMs > 0 ? Math.min(100, (left / totalMs) * 100) : 0;
    fill.style.width = pct.toFixed(1) + '%';
    if (pct < 25) fill.classList.add('ld-timer-fill--low');
    else fill.classList.remove('ld-timer-fill--low');
    if (left > 0) {
      timerRaf = requestAnimationFrame(updateTimerBar);
    }
  }

  function syncSelection(s) {
    var b = s.currentBid;
    var key = s.round + ':' + (b ? (b.qty + 'x' + b.face + '@' + b.player) : 'none');
    if (key !== lastBidKey) {
      lastBidKey = key;
      var def = minimalRaise(b);
      selQty = def.qty;
      selFace = def.face;
    } else {
      var minQ = minLegalQty(selFace, b);
      if (selQty < minQ) selQty = minQ;
    }
  }

  function draw() {
    var state = curState;
    var container = curContainer;
    if (!state || !container) return;
    stopTimer();

    var myIdx = curPlayerIndex;
    var counts = Array.isArray(state.diceCounts) ? state.diceCounts : [];
    var n = counts.length;
    var totalDice = counts.reduce(function (a, b) { return a + b; }, 0);
    var isMyTurn = state.phase === 'playing' && state.currentPlayer === myIdx && (counts[myIdx] || 0) > 0;

    var dKey = state.phase + ':' + state.round + ':' + state.currentPlayer + ':' + (state.bidHistory ? state.bidHistory.length : 0);
    if (dKey !== deadlineKey) {
      deadlineKey = dKey;
      if (state.turnMsLeft && state.turnMsLeft > 0) {
        localDeadline = Date.now() + state.turnMsLeft;
        totalMs = state.phase === 'reveal' ? 5000 : ((state.turnTime || 20) * 1000);
        if (state.turnMsLeft > totalMs) totalMs = state.turnMsLeft;
      } else {
        localDeadline = 0;
        totalMs = 0;
      }
    }

    var wildClass = 'ld-pill';
    var wildText = '';
    if (!state.onesWild) {
      wildText = t('ld_ones_wild_off');
    } else if (state.onesWildNow) {
      wildClass += ' ld-pill--wild';
      wildText = t('ld_ones_wild_on');
    } else {
      wildClass += ' ld-pill--used';
      wildText = t('ld_ones_wild_used');
    }

    var turnText = '';
    if (state.phase === 'playing') {
      turnText = isMyTurn ? t('your_turn') : tf('ld_waiting_turn', esc(playerName(state.currentPlayer)));
    } else if (state.phase === 'reveal') {
      turnText = t('ld_phase_reveal');
    } else if (state.phase === 'ended') {
      turnText = tf('ld_winner_banner', esc(playerName(state.winner)));
    }

    var topHtml =
      '<div class="ld-topbar">' +
        '<div class="ld-meta">' +
          '<span class="ld-pill">' + tf('ld_round_n', state.round || 1) + '</span>' +
          '<span class="ld-pill">' + tf('ld_total_dice_n', totalDice) + '</span>' +
          '<span class="' + wildClass + '">' + esc(wildText) + '</span>' +
        '</div>' +
        '<div class="ld-turn' + (isMyTurn ? ' ld-turn--mine' : '') + '">' + turnText + '</div>' +
        (localDeadline ? '<div class="ld-timer-wrap"><div class="ld-timer-fill" style="width:100%"></div></div>' : '') +
      '</div>';

    var seatsHtml = '<div class="ld-seats">';
    for (var step = 1; step < n; step++) {
      var idx = (myIdx + step) % n;
      var c = counts[idx] || 0;
      var active = state.phase === 'playing' && state.currentPlayer === idx;
      var isBidder = state.currentBid && state.currentBid.player === idx;
      var sCls = 'ld-seat' + (active ? ' ld-seat--active' : '') + (c <= 0 ? ' ld-seat--out' : '');
      seatsHtml +=
        '<div class="' + sCls + '">' +
          '<div class="ld-seat-head">' +
            '<span class="ld-seat-name">' + esc(playerName(idx)) + '</span>' +
            (c <= 0 ? '<span class="ld-seat-tag">' + t('ld_out') + '</span>' : '') +
          '</div>' +
          '<div class="ld-cup-row">' +
            '<span class="ld-cup-icon" aria-hidden="true">&#x1F3B2;</span>' +
            '<span>' + tf('ld_dice_left_n', c) + '</span>' +
            (isBidder ? '<span class="ld-seat-tag">' + state.currentBid.qty + '&times;' + state.currentBid.face + '</span>' : '') +
          '</div>' +
        '</div>';
    }
    seatsHtml += '</div>';

    var arenaHtml = '<div class="ld-arena">';
    if ((state.phase === 'reveal' || state.phase === 'ended') && state.lastReveal) {
      var rev = state.lastReveal;
      var rBid = rev.bid;
      var bidPassed = rev.count >= rBid.qty;
      var outcomeText = bidPassed
        ? tf('ld_challenge_fail', esc(playerName(rev.challenger)), rev.count, rBid.qty)
        : tf('ld_challenge_win', esc(playerName(rev.challenger)), esc(playerName(rev.bidder)), rev.count, rBid.qty);
      var wildMatch = state.onesWildNow && rBid.face !== 1;
      arenaHtml += '<div class="ld-reveal-banner">' + outcomeText + '</div>';
      arenaHtml += '<div class="ld-reveal-sub">' + tf('ld_bid_summary', esc(playerName(rev.bidder)), rBid.qty, rBid.face, rev.count) + '</div>';
      arenaHtml += '<div class="ld-reveal-grid">';
      for (var p = 0; p < rev.dice.length; p++) {
        var hand = rev.dice[p] || [];
        if (hand.length === 0) continue;
        var isLoser = p === rev.loser;
        arenaHtml += '<div class="ld-reveal-row' + (isLoser ? ' ld-reveal-row--loser' : '') + '">';
        arenaHtml += '<span class="ld-reveal-name">' + esc(playerName(p)) + (isLoser ? ' (-1)' : '') + '</span>';
        arenaHtml += '<div class="ld-reveal-dice">';
        for (var j = 0; j < hand.length; j++) {
          var d = hand[j];
          var dCls = 'ld-die--sm';
          if (d === rBid.face) dCls += ' ld-die--match';
          else if (wildMatch && d === 1) dCls += ' ld-die--wild';
          else dCls += ' ld-die--dim';
          arenaHtml += dieHtml(d, dCls);
        }
        arenaHtml += '</div></div>';
      }
      arenaHtml += '</div>';
      if (state.phase === 'reveal') {
        arenaHtml += '<button type="button" class="btn btn-primary ld-btn-next" data-ld-act="next">' + t('ld_continue') + '</button>';
      }
    } else {
      if (state.currentBid) {
        var cb = state.currentBid;
        arenaHtml +=
          '<div class="ld-current-bid">' +
            '<span class="ld-bid-qty">' + cb.qty + '</span>' +
            '<span class="ld-bid-x">&times;</span>' +
            dieHtml(cb.face, 'ld-die--lg') +
          '</div>' +
          '<div class="ld-bid-by">' + tf('ld_current_bid_by', esc(playerName(cb.player))) + '</div>';
      } else {
        arenaHtml += '<div class="ld-bid-by">' + t('ld_no_bid_yet') + '</div>';
      }
      var hist = Array.isArray(state.bidHistory) ? state.bidHistory.slice(-5) : [];
      if (hist.length > 0) {
        arenaHtml += '<div class="ld-history">';
        for (var h = 0; h < hist.length; h++) {
          var hb = hist[h];
          arenaHtml +=
            '<span class="ld-hist-chip">' +
              esc(playerName(hb.player)) + ': ' + hb.qty + '&times;' +
              dieHtml(hb.face, 'ld-die--xs') +
            '</span>';
        }
        arenaHtml += '</div>';
      }
    }
    arenaHtml += '</div>';

    var myDice = Array.isArray(state.dice) && Array.isArray(state.dice[myIdx]) ? state.dice[myIdx] : [];
    var myCount = counts[myIdx] || 0;
    var myHtml = '<div class="ld-mine">';
    myHtml += '<div class="ld-mine-head"><span>' + t('ld_your_dice') + '</span><span>' + tf('ld_dice_left_n', myCount) + '</span></div>';

    if (myCount > 0) {
      myHtml += '<div class="ld-my-dice">';
      for (var md = 0; md < myDice.length; md++) {
        if (myDice[md]) myHtml += dieHtml(myDice[md], '');
      }
      myHtml += '</div>';
    } else {
      myHtml += '<div class="ld-bid-by">' + t('ld_eliminated_note') + '</div>';
    }

    if (state.phase === 'playing' && myCount > 0) {
      var minQ = minLegalQty(selFace, state.currentBid);
      var canDec = isMyTurn && selQty > minQ;
      var canInc = isMyTurn && selQty < Math.max(99, totalDice + 5);
      var legalNow = isLegalRaise(selQty, selFace, state.currentBid);
      myHtml += '<div class="ld-controls">';
      myHtml += '<div class="ld-picker-row">';
      myHtml +=
        '<div class="ld-qty-box">' +
          '<button type="button" class="ld-step-btn" data-ld-step="-1"' + (canDec ? '' : ' disabled') + ' aria-label="-">&minus;</button>' +
          '<span class="ld-qty-val">' + selQty + '</span>' +
          '<button type="button" class="ld-step-btn" data-ld-step="1"' + (canInc ? '' : ' disabled') + ' aria-label="+">+</button>' +
        '</div>';
      myHtml += '<div class="ld-face-grid">';
      for (var fi = 0; fi < FACE_ORDER.length; fi++) {
        var f = FACE_ORDER[fi];
        var selCls = f === selFace ? ' ld-face-btn--sel' : '';
        myHtml +=
          '<button type="button" class="ld-face-btn' + selCls + '" data-ld-face="' + f + '"' + (isMyTurn ? '' : ' disabled') + '>' +
            dieHtml(f, 'ld-die--sm') +
          '</button>';
      }
      myHtml += '</div></div>';
      myHtml +=
        '<div class="ld-actions">' +
          '<button type="button" class="btn btn-primary ld-act-btn" data-ld-act="bid"' + (isMyTurn && legalNow ? '' : ' disabled') + '>' +
            tf('ld_bid_btn', selQty, selFace) +
          '</button>' +
          '<button type="button" class="btn ld-act-btn ld-btn-challenge" data-ld-act="challenge"' + (isMyTurn && state.currentBid ? '' : ' disabled') + '>' +
            t('ld_challenge_btn') +
          '</button>' +
        '</div>';
      myHtml += '</div>';
    }
    myHtml += '</div>';

    container.innerHTML =
      '<div class="ld-board">' +
        topHtml +
        '<div class="ld-left-col">' + seatsHtml + arenaHtml + '</div>' +
        myHtml +
      '</div>';

    var stepBtns = container.querySelectorAll('[data-ld-step]');
    for (var sb = 0; sb < stepBtns.length; sb++) {
      stepBtns[sb].addEventListener('click', function () {
        var delta = Number(this.getAttribute('data-ld-step'));
        var floor = minLegalQty(selFace, state.currentBid);
        selQty = Math.max(floor, selQty + delta);
        draw();
      });
    }

    var faceBtns = container.querySelectorAll('[data-ld-face]');
    for (var fb = 0; fb < faceBtns.length; fb++) {
      faceBtns[fb].addEventListener('click', function () {
        selFace = Number(this.getAttribute('data-ld-face'));
        var floor = minLegalQty(selFace, state.currentBid);
        if (selQty < floor) selQty = floor;
        draw();
      });
    }

    var bidBtn = container.querySelector('[data-ld-act="bid"]');
    if (bidBtn) {
      bidBtn.addEventListener('click', function () {
        if (!curState || curState.phase !== 'playing') return;
        window.makeGameMove({ type: 'bid', qty: selQty, face: selFace });
      });
    }

    var chalBtn = container.querySelector('[data-ld-act="challenge"]');
    if (chalBtn) {
      chalBtn.addEventListener('click', function () {
        if (!curState || curState.phase !== 'playing' || !curState.currentBid) return;
        window.makeGameMove({ type: 'challenge' });
      });
    }

    var nextBtn = container.querySelector('[data-ld-act="next"]');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (!curState || curState.phase !== 'reveal') return;
        window.makeGameMove({ type: 'next' });
      });
    }

    if (window.Motion && !(window.Motion.reduced && window.Motion.reduced())) {
      var curKey = state.phase + ':' + state.round + ':' + (state.bidHistory ? state.bidHistory.length : 0);
      if (curKey !== prevKey) {
        prevKey = curKey;
        var arenaEl = container.querySelector('.ld-arena');
        if (arenaEl && typeof window.Motion.pop === 'function') {
          window.Motion.pop(arenaEl);
        }
        if (state.phase === 'reveal' && state.lastReveal && typeof window.Motion.announce === 'function') {
          var revLoser = state.lastReveal.loser;
          window.Motion.announce(tf('ld_announce_lost_die', playerName(revLoser)), { tone: 'warn', ms: 1600 });
        }
      }
    }

    if (localDeadline) {
      updateTimerBar();
    }
  }

  function init(boardArea) {
    if (typeof window.injectStylesOnce === 'function') {
      window.injectStylesOnce(STYLE_ID, STYLES);
    } else if (!document.getElementById(STYLE_ID)) {
      var st = document.createElement('style');
      st.id = STYLE_ID;
      st.textContent = STYLES;
      document.head.appendChild(st);
    }
    curContainer = boardArea;
    selQty = 1;
    selFace = 2;
    lastBidKey = '';
    prevKey = '';
    deadlineKey = '';
    localDeadline = 0;
    stopTimer();
  }

  function render(state, boardArea, playerIndex) {
    curState = state;
    curContainer = boardArea;
    curPlayerIndex = typeof playerIndex === 'number' ? playerIndex : 0;
    syncSelection(state);
    draw();
  }

  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('liarsdice', { init: init, render: render });
})();
