// Blackjack (二十一点) — 1-6 players vs the house dealer
// Multi-round chip game with simultaneous betting, sequential hit/stand/double,
// dealer stands on soft 17, natural blackjack pays 3:2 (rounded down).

const SUITS = ['s', 'h', 'c', 'd'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const DECK_CHOICES = [1, 2, 4];
const DEFAULT_DECKS = 2;
const ROUND_CHOICES = [5, 10, 15];
const DEFAULT_ROUNDS = 10;
const TIME_CHOICES = [0, 15, 20, 30];
const DEFAULT_TIME = 20;

const BET_CHOICES = [10, 25, 50, 100, 200];
const STARTING_CHIPS = 1000;
const BET_TIME = 20;
const SETTLE_TIME = 5;

function createShoe(decks = DEFAULT_DECKS) {
  const numDecks = DECK_CHOICES.includes(Number(decks)) ? Number(decks) : DEFAULT_DECKS;
  const shoe = [];
  for (let d = 0; d < numDecks; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        shoe.push({ rank: r, suit: s, id: r + s });
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

function cardPointValue(card) {
  if (!card || !card.rank) return 0;
  if (card.rank === 'A') return 11;
  if (card.rank === '10' || card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
  return parseInt(card.rank, 10) || 0;
}

function handValue(cards) {
  if (!Array.isArray(cards)) {
    return { total: 0, soft: false, low: 0, bust: false, blackjack: false, label: '0' };
  }
  const valid = cards.filter(c => c && c.rank);
  if (valid.length === 0) {
    return { total: 0, soft: false, low: 0, bust: false, blackjack: false, label: '0' };
  }
  let total = 0;
  let softAces = 0;
  for (const c of valid) {
    if (c.rank === 'A') {
      total += 11;
      softAces += 1;
    } else {
      total += cardPointValue(c);
    }
  }
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }
  const soft = softAces > 0 && total <= 21;
  const low = soft ? total - 10 : total;
  const bust = total > 21;
  const blackjack = valid.length === 2 && total === 21;
  const label = (soft && total < 21) ? (low + '/' + total) : String(total);
  return { total, soft, low, bust, blackjack, label };
}

function formatTotal(cards) {
  return handValue(cards).label;
}

function setDeadlineMs(state, durationMs) {
  if (!durationMs || durationMs <= 0) {
    state.deadline = 0;
    state.turnDeadline = 0;
    return;
  }
  let next = Date.now() + durationMs;
  if (next === state.deadline) next += 1;
  state.deadline = next;
  state.turnDeadline = next;
}

function drawCard(state) {
  if (!Array.isArray(state.shoe) || state.shoe.length === 0) {
    state.shoe = createShoe(state.decks || DEFAULT_DECKS);
    state.reshuffled = true;
  }
  return state.shoe.pop();
}

function createState() {
  return {
    shoe: [],
    shoeTotal: DEFAULT_DECKS * 52,
    decks: DEFAULT_DECKS,
    totalRounds: DEFAULT_ROUNDS,
    turnTime: DEFAULT_TIME,
    round: 0,
    phase: 'bet', // 'bet' | 'play' | 'settle' | 'over'
    playerCount: 0,
    chips: [],
    bets: [],
    hands: [],
    doubled: [],
    status: [], // 'betting' | 'playing' | 'stand' | 'double' | 'bust' | 'blackjack' | 'out'
    dealerHand: [],
    dealerRevealed: false,
    currentPlayer: -1,
    deadline: 0,
    turnDeadline: 0,
    lastResults: null,
    reshuffled: false,
    winner: null
  };
}

function startRound(state) {
  const n = state.playerCount;
  state.round = (state.round || 0) + 1;
  state.phase = 'bet';
  state.bets = Array(n).fill(0);
  state.hands = Array.from({ length: n }, () => []);
  state.doubled = Array(n).fill(false);
  state.status = state.chips.map(c => (c > 0 ? 'betting' : 'out'));
  state.dealerHand = [];
  state.dealerRevealed = false;
  state.currentPlayer = -1;
  state.lastResults = null;
  state.reshuffled = false;

  const activeCount = state.status.filter(s => s === 'betting').length;
  if (activeCount === 0) {
    finishGame(state);
    return;
  }
  setDeadlineMs(state, BET_TIME * 1000);
}

function finishGame(state) {
  state.phase = 'over';
  state.currentPlayer = -1;
  state.deadline = 0;
  state.turnDeadline = 0;
  const n = state.playerCount;
  const withChips = [];
  for (let i = 0; i < n; i++) {
    if ((state.chips[i] || 0) > 0) withChips.push(i);
  }
  if (n > 1 && withChips.length === 1) {
    state.winner = withChips[0];
    return;
  }
  let bestIdx = 0;
  let bestChips = -1;
  for (let i = 0; i < n; i++) {
    const c = state.chips[i] || 0;
    if (c > bestChips) {
      bestChips = c;
      bestIdx = i;
    }
  }
  state.winner = bestIdx;
}

function dealRound(state) {
  const n = state.playerCount;
  const threshold = (state.shoeTotal || (state.decks || DEFAULT_DECKS) * 52) * 0.25;
  if (!Array.isArray(state.shoe) || state.shoe.length < threshold) {
    state.shoe = createShoe(state.decks || DEFAULT_DECKS);
    state.shoeTotal = (state.decks || DEFAULT_DECKS) * 52;
    state.reshuffled = true;
  }

  for (let i = 0; i < n; i++) {
    if (state.bets[i] > 0) {
      state.hands[i] = [drawCard(state), drawCard(state)];
    } else {
      state.hands[i] = [];
      state.status[i] = 'out';
    }
  }
  state.dealerHand = [drawCard(state), drawCard(state)];
  state.dealerRevealed = false;

  const upCard = state.dealerHand[0];
  const upVal = cardPointValue(upCard);
  const dealerHV = handValue(state.dealerHand);

  for (let i = 0; i < n; i++) {
    if (state.bets[i] > 0) {
      if (handValue(state.hands[i]).blackjack) {
        state.status[i] = 'blackjack';
      } else {
        state.status[i] = 'playing';
      }
    }
  }

  // If dealer up-card is Ace (11) or ten-value (10) and dealer has natural blackjack,
  // reveal and settle immediately.
  if ((upVal === 11 || upVal === 10) && dealerHV.blackjack) {
    state.dealerRevealed = true;
    settleRound(state);
    return;
  }

  state.phase = 'play';
  state.currentPlayer = -1;
  advancePlayTurn(state);
}

function advancePlayTurn(state) {
  const n = state.playerCount;
  const start = state.currentPlayer + 1;
  let nextIdx = -1;
  for (let i = start; i < n; i++) {
    if (state.status[i] === 'playing') {
      nextIdx = i;
      break;
    }
  }
  if (nextIdx >= 0) {
    state.currentPlayer = nextIdx;
    if (state.turnTime > 0) {
      setDeadlineMs(state, state.turnTime * 1000);
    } else {
      state.deadline = 0;
      state.turnDeadline = 0;
    }
    return;
  }

  state.currentPlayer = -1;
  runDealerAndSettle(state);
}

function runDealerAndSettle(state) {
  state.dealerRevealed = true;
  // Dealer draws to 17 and stands on soft 17.
  while (handValue(state.dealerHand).total < 17) {
    state.dealerHand.push(drawCard(state));
  }
  settleRound(state);
}

function settleRound(state) {
  const n = state.playerCount;
  state.dealerRevealed = true;
  state.currentPlayer = -1;
  const dVal = handValue(state.dealerHand);
  const results = [];

  for (let i = 0; i < n; i++) {
    const bet = state.bets[i] || 0;
    if (bet <= 0) {
      results.push({
        outcome: 'out',
        bet: 0,
        payout: 0,
        net: 0,
        total: 0,
        label: '0',
        doubled: false
      });
      continue;
    }
    const pVal = handValue(state.hands[i]);
    let outcome = 'lose';
    let payout = 0;

    if (pVal.blackjack) {
      if (dVal.blackjack) {
        outcome = 'push';
        payout = bet;
      } else {
        outcome = 'blackjack';
        payout = bet + Math.floor(bet * 1.5);
      }
    } else if (pVal.bust) {
      outcome = 'bust';
      payout = 0;
    } else if (dVal.blackjack) {
      outcome = 'lose';
      payout = 0;
    } else if (dVal.bust) {
      outcome = 'win';
      payout = bet * 2;
    } else if (pVal.total > dVal.total) {
      outcome = 'win';
      payout = bet * 2;
    } else if (pVal.total === dVal.total) {
      outcome = 'push';
      payout = bet;
    } else {
      outcome = 'lose';
      payout = 0;
    }

    state.chips[i] += payout;
    results.push({
      outcome,
      bet,
      payout,
      net: payout - bet,
      total: pVal.total,
      label: pVal.label,
      doubled: !!state.doubled[i]
    });
  }

  state.lastResults = results;

  const withChips = [];
  for (let i = 0; i < n; i++) {
    if (state.chips[i] > 0) withChips.push(i);
  }
  const everyoneElseBroke =
    withChips.length === 0 || (n > 1 && withChips.length === 1);
  const lastRoundDone = state.round >= state.totalRounds;

  if (lastRoundDone || everyoneElseBroke) {
    finishGame(state);
  } else {
    state.phase = 'settle';
    setDeadlineMs(state, SETTLE_TIME * 1000);
  }
}

function initGame(state, playerCount) {
  const opts = state._options || {};
  const decks = Number(opts.decks);
  state.decks = DECK_CHOICES.includes(decks) ? decks : DEFAULT_DECKS;

  const rounds = Number(opts.rounds);
  state.totalRounds = ROUND_CHOICES.includes(rounds) ? rounds : DEFAULT_ROUNDS;

  const turnTime = Number(opts.turnTime);
  state.turnTime = TIME_CHOICES.includes(turnTime) ? turnTime : DEFAULT_TIME;

  state.playerCount = playerCount;
  state.chips = Array(playerCount).fill(STARTING_CHIPS);
  state.shoeTotal = state.decks * 52;
  state.shoe = createShoe(state.decks);
  state.round = 0;
  state.winner = null;
  state.lastResults = null;

  startRound(state);
}

function getPendingActors(state) {
  if (!state || state.winner !== null) return [];
  if (state.phase === 'bet') {
    const pending = [];
    for (let i = 0; i < state.playerCount; i++) {
      if (state.status[i] === 'betting' && state.bets[i] === 0 && state.chips[i] > 0) {
        pending.push(i);
      }
    }
    return pending;
  }
  if (state.phase === 'play') {
    if (state.currentPlayer >= 0 && state.currentPlayer < state.playerCount) {
      return [state.currentPlayer];
    }
    return [];
  }
  return [];
}

function getCurrentActor(state) {
  if (!state || state.winner !== null) return -1;
  if (state.phase === 'play') return state.currentPlayer;
  return -1;
}

function setCurrentActor(state, idx) {
  state.currentPlayer = idx;
}

function getPhaseDeadline(state) {
  if (!state || state.winner !== null) return 0;
  return state.deadline || 0;
}

function onTimeout(state) {
  if (!state || state.winner !== null) return false;

  if (state.phase === 'bet') {
    for (let i = 0; i < state.playerCount; i++) {
      if (state.status[i] === 'betting' && state.bets[i] === 0 && state.chips[i] > 0) {
        const minBet = Math.min(10, state.chips[i]);
        state.chips[i] -= minBet;
        state.bets[i] = minBet;
        state.status[i] = 'playing';
      }
    }
    dealRound(state);
    return true;
  }

  if (state.phase === 'play') {
    const idx = state.currentPlayer;
    if (idx >= 0 && idx < state.playerCount && state.status[idx] === 'playing') {
      state.status[idx] = 'stand';
      advancePlayTurn(state);
      return true;
    }
    return false;
  }

  if (state.phase === 'settle') {
    startRound(state);
    return true;
  }

  return false;
}

function botFallback(state, idx) {
  if (!state || state.winner !== null) return { type: 'stand' };
  if (state.phase === 'bet') {
    const chips = (state.chips && state.chips[idx]) || 0;
    return { type: 'bet', amount: Math.min(10, Math.max(1, chips)) };
  }
  if (state.phase === 'play') {
    return { type: 'stand' };
  }
  if (state.phase === 'settle') {
    return { type: 'next' };
  }
  return { type: 'stand' };
}

function handleMove(data, state, playerIndex) {
  if (!state || state.winner !== null || state.phase === 'over') return 'g_game_over';
  if (!data || typeof data !== 'object') return 'g_invalid_action';
  if (playerIndex < 0 || playerIndex >= state.playerCount) return 'g_invalid_action';

  if (state.phase === 'bet') {
    if (data.type === 'next') return null;
    if (data.type !== 'bet') return 'bj_wrong_phase';
    if (state.status[playerIndex] === 'out' || state.chips[playerIndex] <= 0) {
      return 'bj_out_of_chips';
    }
    if (state.bets[playerIndex] > 0) {
      return 'bj_already_bet';
    }

    const avail = state.chips[playerIndex];
    let amount;
    if (data.amount === 'all' || data.amount === 'allin' || data.allIn === true) {
      amount = avail;
    } else {
      amount = Number(data.amount);
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return 'bj_invalid_bet';
    }
    if (amount > avail) {
      return 'bj_not_enough_chips';
    }
    const isStandardChoice = BET_CHOICES.includes(amount);
    const isAllIn = amount === avail;
    if (!isStandardChoice && !isAllIn) {
      return 'bj_invalid_bet';
    }

    state.chips[playerIndex] -= amount;
    state.bets[playerIndex] = amount;
    state.status[playerIndex] = 'playing';

    if (getPendingActors(state).length === 0) {
      dealRound(state);
    }
    return null;
  }

  if (state.phase === 'play') {
    if (data.type === 'next') return null;
    if (playerIndex !== state.currentPlayer) return 'g_not_your_turn';
    if (state.status[playerIndex] !== 'playing') return 'g_not_your_turn';

    const action = data.type;
    if (action === 'hit') {
      state.hands[playerIndex].push(drawCard(state));
      const hv = handValue(state.hands[playerIndex]);
      if (hv.bust) {
        state.status[playerIndex] = 'bust';
        advancePlayTurn(state);
      } else if (state.turnTime > 0) {
        setDeadlineMs(state, state.turnTime * 1000);
      }
      return null;
    }

    if (action === 'stand' || data.pass === true) {
      state.status[playerIndex] = 'stand';
      advancePlayTurn(state);
      return null;
    }

    if (action === 'double') {
      if (state.hands[playerIndex].length !== 2) {
        return 'bj_cannot_double';
      }
      const bet = state.bets[playerIndex];
      if (state.chips[playerIndex] < bet) {
        return 'bj_not_enough_chips';
      }
      state.chips[playerIndex] -= bet;
      state.bets[playerIndex] += bet;
      state.doubled[playerIndex] = true;
      state.hands[playerIndex].push(drawCard(state));
      const hv = handValue(state.hands[playerIndex]);
      state.status[playerIndex] = hv.bust ? 'bust' : 'double';
      advancePlayTurn(state);
      return null;
    }

    return 'bj_invalid_action';
  }

  if (state.phase === 'settle') {
    if (data.type === 'next') {
      startRound(state);
      return null;
    }
    return 'bj_wrong_phase';
  }

  return 'g_invalid_action';
}

function copyCard(c) {
  return c ? { rank: c.rank, suit: c.suit, id: c.id } : null;
}

function playerView(state, playerIndex) {
  const n = state.playerCount || 0;
  const revealed = !!(state.dealerRevealed || state.phase === 'settle' || state.phase === 'over' || state.winner !== null);
  const rawDealer = Array.isArray(state.dealerHand) ? state.dealerHand : [];
  let dealerHand;
  if (rawDealer.length === 0) {
    dealerHand = [];
  } else if (revealed) {
    dealerHand = rawDealer.map(copyCard);
  } else {
    dealerHand = rawDealer.map((c, idx) => (idx === 0 ? copyCard(c) : null));
  }

  const dealerInfo = revealed
    ? handValue(rawDealer)
    : (rawDealer[0] ? handValue([rawDealer[0]]) : handValue([]));

  const hands = Array.isArray(state.hands)
    ? state.hands.map(h => (Array.isArray(h) ? h.map(copyCard) : []))
    : Array.from({ length: n }, () => []);

  const handTotals = hands.map(h => handValue(h));

  return {
    decks: state.decks || DEFAULT_DECKS,
    totalRounds: state.totalRounds || DEFAULT_ROUNDS,
    turnTime: state.turnTime !== undefined ? state.turnTime : DEFAULT_TIME,
    round: state.round || 0,
    phase: state.phase || 'bet',
    playerCount: n,
    chips: Array.isArray(state.chips) ? state.chips.slice() : [],
    bets: Array.isArray(state.bets) ? state.bets.slice() : [],
    hands,
    handTotals,
    doubled: Array.isArray(state.doubled) ? state.doubled.slice() : [],
    status: Array.isArray(state.status) ? state.status.slice() : [],
    dealerHand,
    dealerRevealed: revealed,
    dealerTotal: dealerInfo.total,
    dealerLabel: dealerInfo.label,
    dealerBust: revealed ? dealerInfo.bust : false,
    dealerBlackjack: revealed ? dealerInfo.blackjack : false,
    shoeRemaining: Array.isArray(state.shoe) ? state.shoe.length : 0,
    shoeTotal: state.shoeTotal || (state.decks || DEFAULT_DECKS) * 52,
    reshuffled: !!state.reshuffled,
    currentPlayer: state.currentPlayer !== undefined ? state.currentPlayer : -1,
    deadline: state.deadline || 0,
    turnDeadline: state.turnDeadline || 0,
    lastResults: Array.isArray(state.lastResults)
      ? state.lastResults.map(r => (r ? { ...r } : null))
      : null,
    myIndex: playerIndex,
    winner: state.winner !== undefined ? state.winner : null
  };
}

exports.name = 'blackjack';
exports.minPlayers = 1;
exports.maxPlayers = 6;
exports.DECK_CHOICES = DECK_CHOICES;
exports.DEFAULT_DECKS = DEFAULT_DECKS;
exports.ROUND_CHOICES = ROUND_CHOICES;
exports.DEFAULT_ROUNDS = DEFAULT_ROUNDS;
exports.TIME_CHOICES = TIME_CHOICES;
exports.DEFAULT_TIME = DEFAULT_TIME;
exports.BET_CHOICES = BET_CHOICES;
exports.STARTING_CHIPS = STARTING_CHIPS;
exports.BET_TIME = BET_TIME;
exports.SETTLE_TIME = SETTLE_TIME;
exports.createShoe = createShoe;
exports.cardPointValue = cardPointValue;
exports.handValue = handValue;
exports.formatTotal = formatTotal;
exports.createState = createState;
exports.initGame = initGame;
exports.handleMove = handleMove;
exports.playerView = playerView;
exports.getCurrentActor = getCurrentActor;
exports.setCurrentActor = setCurrentActor;
exports.getPhaseDeadline = getPhaseDeadline;
exports.onTimeout = onTimeout;
exports.getPendingActors = getPendingActors;
exports.botFallback = botFallback;
