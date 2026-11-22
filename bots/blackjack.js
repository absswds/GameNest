// Blackjack bot — basic strategy (dealer stands on soft 17) + stack-scaled betting
// Works on both raw server state and playerView(state, idx); never mutates state.

const { handValue, cardPointValue, BET_CHOICES } = require('../games/blackjack');
const { pickFor } = require('./lib/difficulty');

const PICK = {
  temp: { easy: 60, normal: 15 },
  maxLoss: { easy: 250, normal: 40 }
}; // Provisional

function chooseBetMove(state, me) {
  const chips = (state.chips && state.chips[me]) || 0;
  if (chips <= 0) return { type: 'bet', amount: 0 };

  const legal = BET_CHOICES.filter(b => b <= chips);
  if (legal.length === 0) {
    return { type: 'bet', amount: chips };
  }

  // Scale target bet with current chip stack:
  // small stack -> small bet (10-25), healthy stack -> medium bet (50), big stack -> 100
  let target = 50;
  if (chips < 250) target = 10;
  else if (chips < 600) target = 25;
  else if (chips <= 1300) target = 50;
  else target = 100;

  const cands = legal.map(amount => {
    const ratioDist = Math.abs(Math.log2(amount / target));
    const score = Math.round(100 - ratioDist * 35);
    return { move: { type: 'bet', amount }, score };
  });

  return pickFor(state, cands, PICK);
}

function basicStrategyDecision(hv, upVal, canDouble) {
  const total = hv.total;
  const soft = hv.soft;

  if (total >= 21) {
    return { best: 'stand', second: 'stand' };
  }

  if (soft) {
    if (total >= 19) return { best: 'stand', second: 'hit' };
    if (total === 18) {
      if (upVal >= 3 && upVal <= 6) {
        return { best: canDouble ? 'double' : 'stand', second: 'stand' };
      }
      if (upVal === 2 || upVal === 7 || upVal === 8) {
        return { best: 'stand', second: 'hit' };
      }
      return { best: 'hit', second: 'stand' };
    }
    if (total === 17) {
      if (upVal >= 3 && upVal <= 6) {
        return { best: canDouble ? 'double' : 'hit', second: 'hit' };
      }
      return { best: 'hit', second: 'stand' };
    }
    if (total === 15 || total === 16) {
      if (upVal >= 4 && upVal <= 6) {
        return { best: canDouble ? 'double' : 'hit', second: 'hit' };
      }
      return { best: 'hit', second: 'stand' };
    }
    // Soft 12-14
    if (upVal === 5 || upVal === 6) {
      return { best: canDouble ? 'double' : 'hit', second: 'hit' };
    }
    return { best: 'hit', second: 'stand' };
  }

  // Hard totals
  if (total >= 17) return { best: 'stand', second: 'stand' };
  if (total >= 13 && total <= 16) {
    if (upVal >= 2 && upVal <= 6) return { best: 'stand', second: 'hit' };
    return { best: 'hit', second: 'stand' };
  }
  if (total === 12) {
    if (upVal >= 4 && upVal <= 6) return { best: 'stand', second: 'hit' };
    return { best: 'hit', second: 'stand' };
  }
  if (total === 11) {
    if (upVal >= 2 && upVal <= 10) {
      return { best: canDouble ? 'double' : 'hit', second: 'hit' };
    }
    return { best: 'hit', second: canDouble ? 'double' : 'stand' };
  }
  if (total === 10) {
    if (upVal >= 2 && upVal <= 9) {
      return { best: canDouble ? 'double' : 'hit', second: 'hit' };
    }
    return { best: 'hit', second: 'stand' };
  }
  if (total === 9) {
    if (upVal >= 3 && upVal <= 6) {
      return { best: canDouble ? 'double' : 'hit', second: 'hit' };
    }
    return { best: 'hit', second: 'stand' };
  }
  return { best: 'hit', second: 'stand' };
}

function choosePlayMove(state, me) {
  const hand = (state.hands && state.hands[me]) || [];
  const chips = (state.chips && state.chips[me]) || 0;
  const bet = (state.bets && state.bets[me]) || 0;
  const canDouble = hand.length === 2 && bet > 0 && chips >= bet;

  const upCard = state.dealerHand && state.dealerHand[0];
  const upVal = cardPointValue(upCard) || 10;
  const hv = handValue(hand);

  const { best, second } = basicStrategyDecision(hv, upVal, canDouble);
  const actions = canDouble ? ['hit', 'stand', 'double'] : ['hit', 'stand'];

  const cands = actions.map(act => {
    let score = 0;
    if (act === best) {
      score = 100;
    } else if (act === second) {
      score = 65;
    } else if (!hv.soft && hv.total >= 18 && act === 'hit') {
      score = -120;
    } else if (!hv.soft && hv.total <= 10 && act === 'stand') {
      score = -80;
    } else {
      score = 10;
    }
    return { move: { type: act }, score };
  });

  return pickFor(state, cands, PICK);
}

function createBot(playerIndex) {
  return {
    getMove(state, idxArg) {
      if (!state || state.winner !== null) return null;
      const me = typeof idxArg === 'number'
        ? idxArg
        : (typeof playerIndex === 'number'
          ? playerIndex
          : (typeof state.myIndex === 'number' ? state.myIndex : state.currentPlayer));

      if (state.phase === 'bet') {
        return chooseBetMove(state, me);
      }
      if (state.phase === 'play') {
        return choosePlayMove(state, me);
      }
      if (state.phase === 'settle') {
        return { type: 'next' };
      }
      return null;
    }
  };
}

exports.name = 'blackjack';
exports.createBot = createBot;
