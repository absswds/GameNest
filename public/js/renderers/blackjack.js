// Blackjack (二十一点) renderer — casino felt table with dealer zone, player seats,
// chip betting controls, sequential play actions (Hit/Stand/Double), and round settlement.
(function () {
  var STYLES = `
.bj-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  max-width: 960px;
  margin: 0 auto;
  user-select: none;
  color: #f4f7f5;
}
.bj-hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 12px;
  background: rgba(10, 26, 18, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 0.85rem;
}
.bj-hud-left, .bj-hud-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.bj-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-weight: 700;
  font-size: 0.78rem;
  color: #e2ece6;
}
.bj-pill.is-gold {
  background: rgba(245, 196, 81, 0.2);
  border: 1px solid rgba(245, 196, 81, 0.45);
  color: #ffd97d;
}
.bj-pill.is-alert {
  background: rgba(56, 189, 248, 0.2);
  border: 1px solid rgba(56, 189, 248, 0.45);
  color: #bae6fd;
}
.bj-status-banner {
  font-weight: 800;
  color: #ffd97d;
  font-size: 0.9rem;
}
.bj-timer-badge {
  min-width: 44px;
  text-align: center;
  padding: 3px 9px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  background: rgba(245, 196, 81, 0.22);
  border: 1px solid rgba(245, 196, 81, 0.5);
  color: #ffe08a;
}
.bj-timer-badge.is-urgent {
  background: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.7);
  color: #fecaca;
}
.bj-felt {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  min-height: 410px;
  padding: 16px 14px;
  border-radius: 22px;
  box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.45), 0 10px 28px rgba(0, 0, 0, 0.35);
  border: 3px solid rgba(212, 175, 55, 0.32);
  overflow: hidden;
}
.bj-dealer-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.16);
}
.bj-dealer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
.bj-dealer-title {
  font-weight: 800;
  font-size: 0.92rem;
  letter-spacing: 0.04em;
  color: #fef3c7;
  text-transform: uppercase;
}
.bj-dealer-rule {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.65);
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.26);
}
.bj-total-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.24);
  color: #fff;
}
.bj-total-pill.is-bj {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border-color: #fde68a;
  color: #1c1917;
}
.bj-total-pill.is-bust {
  background: rgba(220, 38, 38, 0.85);
  border-color: #fca5a5;
  color: #fff;
}
.bj-dealer-cards {
  min-height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bj-empty-slot {
  width: 58px;
  height: 82px;
  border-radius: 8px;
  border: 1.5px dashed rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.35);
}
.bj-seats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  gap: 10px;
  align-items: stretch;
}
.bj-seat {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  gap: 7px;
  padding: 10px 8px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.28);
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}
.bj-seat.is-me {
  background: rgba(16, 48, 32, 0.58);
  border-color: rgba(245, 196, 81, 0.42);
}
.bj-seat.is-active-turn {
  border-color: #fbbf24;
  box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.35), 0 8px 20px rgba(0, 0, 0, 0.35);
  transform: translateY(-2px);
}
.bj-seat.is-out {
  opacity: 0.55;
}
.bj-seat-top {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  font-size: 0.78rem;
}
.bj-seat-name {
  font-weight: 700;
  color: #f8fafc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 105px;
}
.bj-me-tag {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.66rem;
  font-weight: 800;
  background: #fbbf24;
  color: #1c1917;
}
.bj-seat-chips {
  font-weight: 800;
  font-size: 0.76rem;
  color: #fde68a;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.bj-seat-cards {
  min-height: 78px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 0;
}
.bj-seat-foot {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 5px;
  min-height: 26px;
}
.bj-bet-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 0.75rem;
  background: radial-gradient(circle at 30% 30%, #fbbf24, #b45309);
  color: #111827;
  border: 1.5px dashed rgba(255, 255, 255, 0.75);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}
.bj-outcome-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 800;
  font-size: 0.72rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.bj-outcome-badge.is-win, .bj-outcome-badge.is-blackjack {
  background: rgba(34, 197, 94, 0.25);
  border: 1px solid rgba(74, 222, 128, 0.65);
  color: #bbf7d0;
}
.bj-outcome-badge.is-blackjack {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.35), rgba(217, 119, 6, 0.35));
  border-color: #fde68a;
  color: #fef08a;
}
.bj-outcome-badge.is-push {
  background: rgba(148, 163, 184, 0.25);
  border: 1px solid rgba(203, 213, 225, 0.5);
  color: #e2e8f0;
}
.bj-outcome-badge.is-lose, .bj-outcome-badge.is-bust {
  background: rgba(239, 68, 68, 0.24);
  border: 1px solid rgba(248, 113, 113, 0.55);
  color: #fecaca;
}
.bj-outcome-badge.is-info {
  background: rgba(59, 130, 246, 0.22);
  border: 1px solid rgba(96, 165, 250, 0.45);
  color: #bfdbfe;
}
.bj-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(10, 26, 18, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.bj-controls-hint {
  font-size: 0.82rem;
  color: #cbd5e1;
  text-align: center;
}
.bj-btn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}
.bj-chip-btn {
  min-width: 56px;
  min-height: 46px;
  padding: 6px 12px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 0.86rem;
  cursor: pointer;
  border: 2px dashed rgba(255, 255, 255, 0.75);
  color: #fff;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
  transition: transform 0.14s ease, opacity 0.14s ease, box-shadow 0.14s ease;
}
.bj-chip-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}
.bj-chip-btn:active:not(:disabled) {
  transform: translateY(0);
}
.bj-chip-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.bj-chip-10 { background: radial-gradient(circle at 30% 30%, #3b82f6, #1d4ed8); }
.bj-chip-25 { background: radial-gradient(circle at 30% 30%, #22c55e, #15803d); }
.bj-chip-50 { background: radial-gradient(circle at 30% 30%, #ef4444, #b91c1c); }
.bj-chip-100 { background: radial-gradient(circle at 30% 30%, #334155, #0f172a); }
.bj-chip-200 { background: radial-gradient(circle at 30% 30%, #a855f7, #6b21a8); }
.bj-chip-all {
  background: linear-gradient(135deg, #f59e0b, #b45309);
  color: #111827;
  border-style: solid;
  border-color: #fde68a;
}
.bj-action-btn {
  min-width: 112px;
  min-height: 46px;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.14s ease, opacity 0.14s ease, background-color 0.14s ease;
}
.bj-action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.bj-action-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
.bj-btn-hit {
  background: linear-gradient(135deg, #10b981, #059669);
}
.bj-btn-stand {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #111827;
}
.bj-btn-double {
  background: linear-gradient(135deg, #6366f1, #4338ca);
}
.bj-btn-next {
  background: linear-gradient(135deg, #fbbf24, #d97706);
  color: #111827;
  min-width: 160px;
}
@media (max-width: 560px) {
  .bj-wrap { padding: 6px; gap: 8px; }
  .bj-felt { padding: 12px 8px; min-height: 350px; }
  .bj-seats { grid-template-columns: repeat(auto-fit, minmax(126px, 1fr)); gap: 7px; }
  .bj-action-btn { min-width: 92px; padding: 8px 14px; font-size: 0.88rem; }
}
@media (orientation: landscape) and (max-height: 540px) {
  .bj-wrap { padding: 4px 8px; gap: 6px; }
  .bj-felt { min-height: 240px; padding: 8px 10px; gap: 8px; }
  .bj-dealer-cards, .bj-seat-cards { min-height: 62px; }
}
`;

  var BET_AMOUNTS = [10, 25, 50, 100, 200];

  var container = null;
  var onMove = null;
  var timerId = null;
  var currentDeadline = 0;
  var prev = null;

  function tr(key, fallback) {
    var fn = window._t || window.t;
    if (typeof fn === 'function') {
      var res = fn(key);
      if (res && res !== key) return res;
    }
    return fallback !== undefined ? fallback : key;
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function seatName(idx) {
    var fn = window.getPlayerName || window.playerName;
    if (typeof fn === 'function') {
      return fn(idx);
    }
    return tr('bj_seat', 'Seat') + ' ' + (idx + 1);
  }

  function sendMove(data) {
    var fn = onMove || window.makeGameMove;
    if (typeof fn === 'function') fn(data);
  }

  function cardSig(cards) {
    if (!Array.isArray(cards) || cards.length === 0) return '';
    return cards.map(function (c) {
      return c && c.id ? c.id : 'back';
    }).join(',');
  }

  function renderHandHtml(cards, prevCards, size) {
    if (!Array.isArray(cards) || cards.length === 0) {
      return '<div class="bj-empty-slot">' + esc(tr('bj_no_cards', '—')) + '</div>';
    }
    var prevLen = Array.isArray(prevCards) ? prevCards.length : 0;
    var hadHidden = Array.isArray(prevCards) && prevCards.length > 1 && !prevCards[1];
    var html = '<div class="pc-group" style="--pc-overlap:-20px">';
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var isNewlyDealt = i >= prevLen || (i === 1 && hadHidden && !!c);
      if (window.CardUI && typeof window.CardUI.render === 'function') {
        html += window.CardUI.render(c, {
          size: size || 'md',
          faceDown: !c,
          deal: isNewlyDealt
        });
      } else {
        html += '<span class="bj-pill">' + esc(c ? c.rank + c.suit : '?') + '</span>';
      }
    }
    html += '</div>';
    return html;
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function updateTimerDom() {
    if (!container) return;
    var badge = container.querySelector('#bj-timer-badge');
    if (!badge) return;
    if (!currentDeadline || currentDeadline <= 0) {
      badge.style.display = 'none';
      return;
    }
    var remSec = Math.max(0, Math.ceil((currentDeadline - Date.now()) / 1000));
    badge.style.display = 'inline-block';
    badge.textContent = remSec + 's';
    badge.classList.toggle('is-urgent', remSec <= 5);
  }

  function startTimer(deadline) {
    currentDeadline = deadline || 0;
    stopTimer();
    updateTimerDom();
    if (currentDeadline > Date.now()) {
      timerId = setInterval(updateTimerDom, 250);
    }
  }

  function buildSkeleton(n) {
    var seatsHtml = '';
    for (var i = 0; i < n; i++) {
      seatsHtml +=
        '<div class="bj-seat" data-seat="' + i + '">' +
          '<div class="bj-seat-top">' +
            '<span class="bj-seat-name" data-role="name"></span>' +
            '<span class="bj-seat-chips" data-role="chips"></span>' +
          '</div>' +
          '<div class="bj-seat-cards" data-role="cards"></div>' +
          '<div class="bj-seat-foot" data-role="foot"></div>' +
        '</div>';
    }

    container.innerHTML =
      '<div class="bj-wrap">' +
        '<div class="bj-hud">' +
          '<div class="bj-hud-left">' +
            '<span class="bj-pill is-gold" id="bj-round-pill"></span>' +
            '<span class="bj-pill" id="bj-shoe-pill"></span>' +
            '<span class="bj-pill is-alert" id="bj-reshuffle-pill" style="display:none"></span>' +
          '</div>' +
          '<div class="bj-hud-right">' +
            '<span class="bj-status-banner" id="bj-status-banner"></span>' +
            '<span class="bj-timer-badge" id="bj-timer-badge" style="display:none"></span>' +
          '</div>' +
        '</div>' +
        '<div class="ge-felt bj-felt">' +
          '<div class="bj-dealer-zone">' +
            '<div class="bj-dealer-header">' +
              '<span class="bj-dealer-title">' + esc(tr('bj_dealer', 'Dealer')) + '</span>' +
              '<span class="bj-dealer-rule">' + esc(tr('bj_dealer_rule', 'Stands on soft 17')) + '</span>' +
              '<span class="bj-total-pill" id="bj-dealer-total">—</span>' +
            '</div>' +
            '<div class="bj-dealer-cards" id="bj-dealer-cards"></div>' +
          '</div>' +
          '<div class="bj-seats" id="bj-seats">' + seatsHtml + '</div>' +
        '</div>' +
        '<div class="bj-controls" id="bj-controls"></div>' +
      '</div>';
  }

  function formatStatusBanner(state, playerIndex) {
    if (state.phase === 'bet') {
      if (state.bets[playerIndex] > 0) {
        return tr('bj_waiting_others_bet', 'Waiting for other players to bet...');
      }
      if ((state.chips[playerIndex] || 0) <= 0) {
        return tr('bj_you_are_out', 'Out of chips');
      }
      return tr('bj_place_your_bet', 'Place your bet');
    }
    if (state.phase === 'play') {
      if (state.currentPlayer === playerIndex) {
        return tr('bj_your_turn', 'Your turn — Hit, Stand, or Double');
      }
      if (state.currentPlayer >= 0) {
        return seatName(state.currentPlayer) + ' ' + tr('bj_is_acting', 'is acting...');
      }
      return tr('bj_dealer_turn', 'Dealer turn');
    }
    if (state.phase === 'settle') {
      return tr('bj_round_settled', 'Round settled');
    }
    if (state.phase === 'over') {
      return tr('bj_game_over', 'Game Over');
    }
    return '';
  }

  function renderSeatFoot(state, i) {
    var parts = [];
    var hand = (state.hands && state.hands[i]) || [];
    var hv = (state.handTotals && state.handTotals[i]) || { total: 0, label: '0', blackjack: false, bust: false };
    var bet = (state.bets && state.bets[i]) || 0;
    var doubled = !!(state.doubled && state.doubled[i]);
    var status = (state.status && state.status[i]) || '';
    var res = state.lastResults && state.lastResults[i];

    if (hand.length > 0) {
      var pillCls = 'bj-total-pill';
      if (hv.blackjack) pillCls += ' is-bj';
      else if (hv.bust) pillCls += ' is-bust';
      parts.push('<span class="' + pillCls + '">' + esc(hv.label) + '</span>');
    }

    if (bet > 0) {
      var betLabel = '$' + bet + (doubled ? ' (2x)' : '');
      parts.push('<span class="bj-bet-chip" data-role="bet-chip">' + esc(betLabel) + '</span>');
    }

    if ((state.phase === 'settle' || state.phase === 'over') && res && res.outcome !== 'out') {
      var netStr = res.net > 0 ? '+$' + res.net : (res.net < 0 ? '-$' + Math.abs(res.net) : '±$0');
      var outKey = 'bj_outcome_' + res.outcome;
      var outText = tr(outKey, res.outcome.toUpperCase()) + ' ' + netStr;
      parts.push('<span class="bj-outcome-badge is-' + esc(res.outcome) + '" data-role="outcome">' + esc(outText) + '</span>');
    } else if (state.phase === 'bet') {
      if (status === 'out') {
        parts.push('<span class="bj-outcome-badge is-lose">' + esc(tr('bj_status_out', 'OUT')) + '</span>');
      } else if (bet > 0) {
        parts.push('<span class="bj-outcome-badge is-info">' + esc(tr('bj_status_ready', 'LOCKED')) + '</span>');
      } else {
        parts.push('<span class="bj-outcome-badge is-push">' + esc(tr('bj_status_betting', 'BETTING')) + '</span>');
      }
    } else if (state.phase === 'play') {
      if (status === 'blackjack') {
        parts.push('<span class="bj-outcome-badge is-blackjack">' + esc(tr('bj_outcome_blackjack', 'BLACKJACK')) + '</span>');
      } else if (status === 'bust') {
        parts.push('<span class="bj-outcome-badge is-bust">' + esc(tr('bj_outcome_bust', 'BUST')) + '</span>');
      } else if (status === 'double') {
        parts.push('<span class="bj-outcome-badge is-info">' + esc(tr('bj_status_doubled', 'DOUBLED')) + '</span>');
      } else if (status === 'stand') {
        parts.push('<span class="bj-outcome-badge is-push">' + esc(tr('bj_status_stood', 'STOOD')) + '</span>');
      } else if (i === state.currentPlayer) {
        parts.push('<span class="bj-outcome-badge is-win">' + esc(tr('bj_status_acting', 'ACTING')) + '</span>');
      }
    }

    return parts.join('');
  }

  function renderControls(state, playerIndex) {
    var controlsEl = container.querySelector('#bj-controls');
    if (!controlsEl) return;

    var myChips = (state.chips && state.chips[playerIndex]) || 0;
    var myBet = (state.bets && state.bets[playerIndex]) || 0;
    var myHand = (state.hands && state.hands[playerIndex]) || [];
    var myStatus = (state.status && state.status[playerIndex]) || '';

    if (state.phase === 'bet') {
      if (myStatus === 'out' || myChips <= 0) {
        controlsEl.innerHTML =
          '<div class="bj-controls-hint">' + esc(tr('bj_you_are_out', 'You are out of chips for this round.')) + '</div>';
        return;
      }
      if (myBet > 0) {
        controlsEl.innerHTML =
          '<div class="bj-controls-hint">' +
            esc(tr('bj_bet_locked_msg', 'Bet locked')) + ': <strong>$' + esc(myBet) + '</strong> — ' +
            esc(tr('bj_waiting_others_bet', 'Waiting for other players...')) +
          '</div>';
        return;
      }

      var btns = '';
      for (var i = 0; i < BET_AMOUNTS.length; i++) {
        var amt = BET_AMOUNTS[i];
        var dis = amt > myChips ? ' disabled' : '';
        btns +=
          '<button type="button" class="bj-chip-btn bj-chip-' + amt + '" data-bet="' + amt + '"' + dis + '>' +
            '$' + amt +
          '</button>';
      }
      btns +=
        '<button type="button" class="bj-chip-btn bj-chip-all" data-bet="' + myChips + '">' +
          esc(tr('bj_all_in', 'All-in')) + ' ($' + myChips + ')' +
        '</button>';

      controlsEl.innerHTML =
        '<div class="bj-controls-hint">' +
          esc(tr('bj_choose_bet_hint', 'Select a chip to place your bet')) +
          ' (' + esc(tr('bj_chips', 'Chips')) + ': <strong>$' + esc(myChips) + '</strong>)' +
        '</div>' +
        '<div class="bj-btn-row">' + btns + '</div>';

      var chipBtns = controlsEl.querySelectorAll('[data-bet]');
      chipBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var amount = Number(btn.getAttribute('data-bet'));
          if (amount > 0) {
            sendMove({ type: 'bet', amount: amount });
          }
        });
      });
      return;
    }

    if (state.phase === 'play') {
      if (state.currentPlayer !== playerIndex) {
        var actorText = state.currentPlayer >= 0
          ? (seatName(state.currentPlayer) + ' ' + tr('bj_is_acting', 'is acting...'))
          : tr('bj_dealer_turn', 'Dealer turn...');
        controlsEl.innerHTML = '<div class="bj-controls-hint">' + esc(actorText) + '</div>';
        return;
      }

      var canDouble = myHand.length === 2 && myChips >= myBet && myBet > 0;
      var dblDis = canDouble ? '' : ' disabled';

      controlsEl.innerHTML =
        '<div class="bj-controls-hint">' + esc(tr('bj_your_turn', 'Your turn — choose an action')) + '</div>' +
        '<div class="bj-btn-row">' +
          '<button type="button" class="bj-action-btn bj-btn-hit" data-act="hit">' +
            esc(tr('bj_hit', 'Hit')) +
          '</button>' +
          '<button type="button" class="bj-action-btn bj-btn-stand" data-act="stand">' +
            esc(tr('bj_stand', 'Stand')) +
          '</button>' +
          '<button type="button" class="bj-action-btn bj-btn-double" data-act="double"' + dblDis + '>' +
            esc(tr('bj_double', 'Double')) +
          '</button>' +
        '</div>';

      var actBtns = controlsEl.querySelectorAll('[data-act]');
      actBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var act = btn.getAttribute('data-act');
          if (act) {
            sendMove({ type: act });
          }
        });
      });
      return;
    }

    if (state.phase === 'settle') {
      var myRes = state.lastResults && state.lastResults[playerIndex];
      var summary = tr('bj_round_settled', 'Round settled');
      if (myRes && myRes.outcome !== 'out') {
        var sign = myRes.net > 0 ? '+$' + myRes.net : (myRes.net < 0 ? '-$' + Math.abs(myRes.net) : '±$0');
        summary = tr('bj_outcome_' + myRes.outcome, myRes.outcome.toUpperCase()) + ' (' + sign + ')';
      }
      controlsEl.innerHTML =
        '<div class="bj-controls-hint"><strong>' + esc(summary) + '</strong></div>' +
        '<div class="bj-btn-row">' +
          '<button type="button" class="bj-action-btn bj-btn-next" id="bj-next-btn">' +
            esc(tr('bj_next_round', 'Next Round')) +
          '</button>' +
        '</div>';

      var nextBtn = controlsEl.querySelector('#bj-next-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          sendMove({ type: 'next' });
        });
      }
      return;
    }

    controlsEl.innerHTML =
      '<div class="bj-controls-hint">' + esc(tr('bj_game_over', 'Game Over')) + '</div>';
  }

  function init(el, moveCb) {
    if (typeof window.injectStylesOnce === 'function') {
      window.injectStylesOnce('bj-styles', STYLES);
    }
    stopTimer();
    container = el;
    onMove = moveCb || null;
    prev = null;
  }

  function render(state, arg2, arg3) {
    var playerIndex = 0;
    if (arg2 && typeof arg2 === 'object' && arg2.nodeType) {
      container = arg2;
      playerIndex = typeof arg3 === 'number' ? arg3 : (state && typeof state.myIndex === 'number' ? state.myIndex : 0);
    } else if (typeof arg2 === 'number') {
      playerIndex = arg2;
    } else if (state && typeof state.myIndex === 'number') {
      playerIndex = state.myIndex;
    }
    if (!container || !state) return;
    var n = state.playerCount || 1;

    if (!prev || prev.playerCount !== n || !container.querySelector('.bj-wrap')) {
      buildSkeleton(n);
      prev = {
        playerCount: n,
        round: 0,
        phase: '',
        dealerSig: null,
        dealerCards: [],
        seatSigs: Array(n).fill(null),
        seatCards: Array.from({ length: n }, function () { return []; }),
        bets: Array(n).fill(0)
      };
    }

    // Update HUD
    var roundPill = container.querySelector('#bj-round-pill');
    if (roundPill) {
      roundPill.textContent = tr('bj_round', 'Round') + ' ' + (state.round || 1) + ' / ' + (state.totalRounds || 10);
    }
    var shoePill = container.querySelector('#bj-shoe-pill');
    if (shoePill) {
      shoePill.textContent =
        tr('bj_shoe', 'Shoe') + ': ' + (state.shoeRemaining || 0) + '/' + (state.shoeTotal || 104);
    }
    var reshufflePill = container.querySelector('#bj-reshuffle-pill');
    if (reshufflePill) {
      reshufflePill.style.display = state.reshuffled ? 'inline-flex' : 'none';
      reshufflePill.textContent = tr('bj_reshuffled', 'Shoe reshuffled');
    }
    var banner = container.querySelector('#bj-status-banner');
    if (banner) {
      banner.textContent = formatStatusBanner(state, playerIndex);
    }

    startTimer(state.deadline || 0);

    // Update Dealer Total Pill
    var dealerTotalEl = container.querySelector('#bj-dealer-total');
    if (dealerTotalEl) {
      var dHand = state.dealerHand || [];
      dealerTotalEl.className = 'bj-total-pill';
      if (dHand.length === 0) {
        dealerTotalEl.textContent = '—';
      } else if (!state.dealerRevealed) {
        dealerTotalEl.textContent = (state.dealerLabel || '?') + ' + ?';
      } else if (state.dealerBlackjack) {
        dealerTotalEl.className = 'bj-total-pill is-bj';
        dealerTotalEl.textContent = 'BJ 21';
      } else if (state.dealerBust) {
        dealerTotalEl.className = 'bj-total-pill is-bust';
        dealerTotalEl.textContent = tr('bj_outcome_bust', 'BUST') + ' ' + state.dealerLabel;
      } else {
        dealerTotalEl.textContent = state.dealerLabel || String(state.dealerTotal || 0);
      }
    }

    // Update Dealer Hand only when signature changes
    var newDealerSig = cardSig(state.dealerHand);
    var dealerCardsEl = container.querySelector('#bj-dealer-cards');
    if (dealerCardsEl && prev.dealerSig !== newDealerSig) {
      dealerCardsEl.innerHTML = renderHandHtml(state.dealerHand, prev.dealerCards, 'md');
      prev.dealerSig = newDealerSig;
      prev.dealerCards = (state.dealerHand || []).map(function (c) { return c ? { id: c.id } : null; });
    }

    // Update Seats
    var cardSize = n > 3 ? 'sm' : 'md';
    for (var i = 0; i < n; i++) {
      var seatEl = container.querySelector('.bj-seat[data-seat="' + i + '"]');
      if (!seatEl) continue;

      var isMe = i === playerIndex;
      var isTurn =
        (state.phase === 'play' && state.currentPlayer === i) ||
        (state.phase === 'bet' && state.status && state.status[i] === 'betting' && !(state.bets && state.bets[i] > 0));
      var isOut = state.status && state.status[i] === 'out';

      seatEl.classList.toggle('is-me', isMe);
      seatEl.classList.toggle('is-active-turn', !!isTurn);
      seatEl.classList.toggle('is-out', !!isOut);

      var nameEl = seatEl.querySelector('[data-role="name"]');
      if (nameEl) {
        nameEl.innerHTML =
          esc(seatName(i)) +
          (isMe ? ' <span class="bj-me-tag">' + esc(tr('bj_you', 'YOU')) + '</span>' : '');
      }

      var chipsEl = seatEl.querySelector('[data-role="chips"]');
      if (chipsEl) {
        chipsEl.textContent = '$' + ((state.chips && state.chips[i]) || 0);
      }

      var seatHand = (state.hands && state.hands[i]) || [];
      var newSeatSig = cardSig(seatHand);
      var seatCardsEl = seatEl.querySelector('[data-role="cards"]');
      if (seatCardsEl && prev.seatSigs[i] !== newSeatSig) {
        seatCardsEl.innerHTML = renderHandHtml(seatHand, prev.seatCards[i], isMe ? 'md' : cardSize);
        prev.seatSigs[i] = newSeatSig;
        prev.seatCards[i] = seatHand.map(function (c) { return c ? { id: c.id } : null; });
      }

      var footEl = seatEl.querySelector('[data-role="foot"]');
      if (footEl) {
        var prevBet = prev.bets[i] || 0;
        var curBet = (state.bets && state.bets[i]) || 0;
        footEl.innerHTML = renderSeatFoot(state, i);
        if (curBet > prevBet && window.Motion && typeof window.Motion.pop === 'function') {
          var chipNode = footEl.querySelector('[data-role="bet-chip"]');
          if (chipNode) window.Motion.pop(chipNode);
        }
        if (prev.phase !== state.phase && (state.phase === 'settle' || state.phase === 'over')) {
          var outNode = footEl.querySelector('[data-role="outcome"]');
          if (outNode && window.Motion && typeof window.Motion.pop === 'function') {
            window.Motion.pop(outNode);
          }
        }
        prev.bets[i] = curBet;
      }
    }

    renderControls(state, playerIndex);
    prev.round = state.round;
    prev.phase = state.phase;
  }

  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('blackjack', { init: init, render: render });
})();
