// games/texas.js
// Texas Hold'em Poker — community card poker game
const { pick } = require('./lib/i18n');

const SUITS = ['s','h','c','d'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

exports.name = 'texas';
exports.maxPlayers = 8;

function rankVal(rank) {
  return RANKS.indexOf(rank);
}

function createDeck() {
  const deck = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck.push({ rank: r, suit: s, id: r + s });
    }
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function nextActivePlayer(state, fromIndex) {
  const n = state.chips.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (!state.folded[idx] && !state.allIn[idx] && state.chips[idx] > 0) return idx;
  }
  return fromIndex;
}

// Evaluate a 7-card hand (2 hole + 5 community) to find best 5-card poker hand
function evaluateHand(cards) {
  if (!cards || cards.length < 5) return { type: 'high_card', rank: 0, cards: [] };

  const all = cards.map(c => ({ ...c }));

  // Generate all 5-card combinations
  const combos = [];
  function gen(start, chosen) {
    if (chosen.length === 5) { combos.push([...chosen]); return; }
    for (let i = start; i < all.length; i++) {
      gen(i + 1, [...chosen, all[i]]);
    }
  }
  gen(0, []);

  let best = null;
  for (const combo of combos) {
    const result = score5(combo);
    if (!best || compareHands(result, best) > 0) best = result;
  }
  return best;
}

function score5(cards) {
  const rvals = cards.map(c => rankVal(c.rank)).sort((a,b) => b-a);
  const suits = cards.map(c => c.suit);

  const isFlush = new Set(suits).size === 1;
  const straight = isStraight(rvals);
  const countMap = new Map();
  for (const r of rvals) countMap.set(r, (countMap.get(r) || 0) + 1);
  const groups = { 1: [], 2: [], 3: [], 4: [] };
  for (const [r, c] of countMap) groups[c].push(r);
  for (const k of Object.keys(groups)) groups[k].sort((a,b) => b-a);

  // Royal/Straight Flush
  if (isFlush && straight) {
    return { type: 'straight_flush', rank: straight, cards };
  }
  // Four of a kind
  if (groups[4].length === 1) {
    return { type: 'four', rank: groups[4][0], kicker: groups[1][0], cards };
  }
  // Full house
  if (groups[3].length === 1 && groups[2].length >= 1) {
    return { type: 'full_house', rank: groups[3][0], pair: groups[2][0], cards };
  }
  // Flush
  if (isFlush) {
    return { type: 'flush', ranks: rvals, cards };
  }
  // Straight
  if (straight) {
    return { type: 'straight', rank: straight, cards };
  }
  // Three of a kind
  if (groups[3].length === 1) {
    return { type: 'three', rank: groups[3][0], kickers: groups[1].slice(0, 2), cards };
  }
  // Two pair
  if (groups[2].length >= 2) {
    return { type: 'two_pair', high: groups[2][0], low: groups[2][1], kicker: groups[1][0], cards };
  }
  // One pair
  if (groups[2].length === 1) {
    return { type: 'pair', rank: groups[2][0], kickers: groups[1].slice(0, 3), cards };
  }
  // High card
  return { type: 'high_card', ranks: rvals.slice(0, 5), cards };
}

function isStraight(rvals) {
  // Check for A-2-3-4-5 (wheel)
  if (rvals[0] === 12 && rvals[1] === 3 && rvals[2] === 2 && rvals[3] === 1 && rvals[4] === 0) {
    return 3; // 5-high straight
  }
  for (let i = 0; i < 4; i++) {
    if (rvals[i] - rvals[i + 1] !== 1) return false;
  }
  return rvals[0];
}

function compareHands(a, b) {
  // Returns positive if a > b, negative if b > a, 0 if tie
  const typeOrder = ['high_card', 'pair', 'two_pair', 'three', 'straight', 'flush', 'full_house', 'four', 'straight_flush'];
  const ta = typeOrder.indexOf(a.type);
  const tb = typeOrder.indexOf(b.type);
  if (ta !== tb) return ta - tb;

  // Same type — compare details
  if (a.type === 'straight_flush' || a.type === 'straight') {
    return a.rank - b.rank;
  }
  if (a.type === 'four') {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.kicker - b.kicker;
  }
  if (a.type === 'full_house') {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.pair - b.pair;
  }
  if (a.type === 'flush' || a.type === 'high_card') {
    for (let i = 0; i < 5; i++) {
      if (a.ranks[i] !== b.ranks[i]) return a.ranks[i] - b.ranks[i];
    }
    return 0;
  }
  if (a.type === 'three') {
    if (a.rank !== b.rank) return a.rank - b.rank;
    for (let i = 0; i < 2; i++) {
      if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
    }
    return 0;
  }
  if (a.type === 'two_pair') {
    if (a.high !== b.high) return a.high - b.high;
    if (a.low !== b.low) return a.low - b.low;
    return a.kicker - b.kicker;
  }
  if (a.type === 'pair') {
    if (a.rank !== b.rank) return a.rank - b.rank;
    for (let i = 0; i < 3; i++) {
      if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
    }
    return 0;
  }
  return 0;
}

const BIG_BLIND = 20;
const SMALL_BLIND = 10;

// state.pot holds every chip committed this hand, including the current street's bets
function canAct(state, i) {
  return !state.folded[i] && !state.allIn[i] && state.chips[i] > 0;
}

// Move `amount` (capped at the stack) from a player's chips into the pot; all-in when the stack hits 0.
function commit(state, i, amount) {
  const pay = Math.min(amount, state.chips[i]);
  state.chips[i] -= pay;
  state.bets[i] += pay;
  state.totalBet[i] += pay;
  state.pot += pay;
  if (state.chips[i] === 0) state.allIn[i] = true;
  return pay;
}

// Split the pot into layers by contribution (main pot + side pots), pay each layer to the best
// hand(s) among the players who put money into it. A layer with one eligible player is simply
// returned to him (an uncalled over-bet). Ties split evenly; odd chips go left of the dealer.
function showdown(state) {
  const n = state.hands.length;
  const scores = [];
  state.showdownHands = [];
  for (let i = 0; i < n; i++) {
    if (state.folded[i]) continue;
    const hand = evaluateHand([...state.hands[i], ...state.communityCards]);
    scores[i] = hand;
    state.showdownHands.push({ player: i, cards: state.hands[i].map(c => ({ ...c })), hand });
  }
  const alive = scores.map((s, i) => (s ? i : -1)).filter(i => i >= 0);
  if (alive.length === 0) return -1;

  const levels = [...new Set(alive.map(i => state.totalBet[i]).filter(v => v > 0))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (let i = 0; i < n; i++) amount += Math.max(0, Math.min(state.totalBet[i], level) - prev);
    const players = alive.filter(i => state.totalBet[i] >= level);
    if (amount > 0) pots.push({ amount, players });
    prev = level;
  }
  // Chips a folded player put in above every live player's total (cannot normally happen) stay in the last pot
  const paid = pots.reduce((a, p) => a + p.amount, 0);
  if (pots.length === 0) pots.push({ amount: state.pot, players: alive });
  else if (paid < state.pot) pots[pots.length - 1].amount += state.pot - paid;

  const winnersAll = new Set();
  for (const pot of pots) {
    let best = [pot.players[0]];
    for (const i of pot.players.slice(1)) {
      const c = compareHands(scores[i], scores[best[0]]);
      if (c > 0) best = [i];
      else if (c === 0) best.push(i);
    }
    const share = Math.floor(pot.amount / best.length);
    let odd = pot.amount - share * best.length;
    best.sort((a, b) => ((a - state.dealer + n - 1) % n) - ((b - state.dealer + n - 1) % n));
    for (const i of best) {
      state.chips[i] += share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd--;
      winnersAll.add(i);
    }
    pot.winners = best.slice();
  }
  state.pot = 0;
  state.sidePots = pots;
  state.showdownWinners = [...winnersAll].sort((a, b) => a - b);
  return state.showdownWinners[0];
}

// A hand is over. state.winner is set (the host's restart starts the next hand, see carryOver).
// When only one seat still holds chips the whole session is over and that seat is the champion.
function endHand(state, winner) {
  state.winner = winner;
  const alive = state.chips.map((c, i) => (c > 0 ? i : -1)).filter(i => i >= 0);
  if (alive.length === 1) {
    state.sessionOver = true;
    state.winner = alive[0];
  }
}

function advancePhase(state) {
  for (;;) {
    const able = state.chips.map((c, i) => i).filter(i => canAct(state, i));
    // Everyone who can still bet must have acted this street and matched the bet;
    // a lone player facing only all-ins just needs to match.
    const pending = able.filter(i => state.bets[i] < state.currentBet || (able.length > 1 && !state.acted[i]));
    if (pending.length > 0) return;
    // All bets matched — advance
    if (state.phase === 'preflop') {
      state.phase = 'flop';
      dealCommunity(state, 3);
    } else if (state.phase === 'flop') {
      state.phase = 'turn';
      dealCommunity(state, 1);
    } else if (state.phase === 'turn') {
      state.phase = 'river';
      dealCommunity(state, 1);
    } else if (state.phase === 'river') {
      const winner = showdown(state);
      state.phase = 'showdown';
      state.showdownWinner = winner;
      endHand(state, winner);
      return;
    }
    // Reset bets for new round (the chips are already in state.pot)
    for (let i = 0; i < state.bets.length; i++) state.bets[i] = 0;
    state.acted = state.bets.map(() => false);
    state.raiseClosed = state.bets.map(() => false);
    state.currentBet = 0;
    state.lastRaise = BIG_BLIND;
    state.currentPlayer = nextActivePlayerAfterDealer(state);
    // Fewer than two players can still bet: deal the next street straight away
    if (able.length > 1) return;
  }
}

function markActed(state, playerIndex, raised) {
  if (raised) {
    state.acted = state.acted.map(() => false);
    state.raiseClosed = state.raiseClosed.map(() => false);
  }
  state.acted[playerIndex] = true;
}

// First to act after the flop: the first live seat left of the dealer (heads-up: the big blind)
function nextActivePlayerAfterDealer(state) {
  const n = state.chips.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.dealer + i) % n;
    if (canAct(state, idx)) return idx;
  }
  return state.dealer;
}

function dealCommunity(state, count) {
  for (let i = 0; i < count; i++) {
    if (state.deck.length > 0) {
      state.communityCards.push(state.deck.pop());
    }
  }
}

exports.createState = () => {
  return {
    hands: [],
    communityCards: [],
    deck: [],
    pot: 0,
    sidePots: [],
    chips: [],
    bets: [],
    totalBet: [],
    folded: [],
    allIn: [],
    acted: [],
    raiseClosed: [],
    currentBet: 0,
    lastRaise: BIG_BLIND, // size of the last full raise this street (big blind if none) = minimum raise increment
    dealer: null, // null = pick a random dealer in initGame
    currentPlayer: 0,
    phase: 'preflop', // preflop | flop | turn | river | showdown
    smallBlind: 0,
    bigBlind: 0,
    winner: null,
    showdownWinner: null,
    showdownWinners: [],
    showdownHands: [],
    out: [], // out[i]: seat i is busted (no chips at the start of the hand) and sits out the rest of the session
    handNumber: 1,
    sessionOver: false,
  };
};

// Continuous session: the next hand keeps the stacks and moves the button on. Call it on the fresh
// state (createState) BEFORE initGame, with the previous state and the new seat count. It does
// nothing (fresh session: 1000 each, random dealer, hand 1) unless the previous hand finished,
// the session is not over, the seat count is unchanged (seats can be compacted, so chips are
// mapped by seat index only then) and at least two seats still have chips.
// Dealer = the next seat clockwise (higher index, wrapping) that still has chips.
exports.carryOver = function(prev, next, playerCount) {
  if (!prev || !next || prev.sessionOver || prev.winner == null) return false;
  if (!Array.isArray(prev.chips) || prev.chips.length !== playerCount) return false;
  if (prev.chips.filter(c => c > 0).length < 2) return false;
  next.chips = prev.chips.slice();
  const d = Number.isInteger(prev.dealer) ? prev.dealer : 0;
  for (let i = 1; i <= playerCount; i++) {
    const idx = (d + i) % playerCount;
    if (next.chips[idx] > 0) { next.dealer = idx; break; }
  }
  next.handNumber = (prev.handNumber || 1) + 1;
  return true;
};

exports.initGame = function(state, playerCount) {
  const startingChips = 1000;
  const deck = createDeck();
  shuffle(deck);

  // carryOver() presets chips (and the dealer) for a continuing session; otherwise a fresh session
  const carried = Array.isArray(state.chips) && state.chips.length === playerCount && state.chips.some(c => c > 0);
  if (!carried) {
    state.chips = new Array(playerCount).fill(startingChips);
    state.handNumber = 1;
  }
  state.sessionOver = false;
  state.out = state.chips.map(c => !(c > 0));

  state.deck = deck;
  state.communityCards = [];
  state.pot = 0;
  state.sidePots = [];
  state.bets = new Array(playerCount).fill(0);
  state.totalBet = new Array(playerCount).fill(0);
  // Busted seats count as folded from the start: dealt nothing, skipped by blinds, action and showdown
  state.folded = state.out.slice();
  state.allIn = new Array(playerCount).fill(false);
  state.acted = new Array(playerCount).fill(false);
  state.raiseClosed = new Array(playerCount).fill(false);
  state.currentBet = 0;
  state.lastRaise = BIG_BLIND;
  state.winner = null;
  state.showdownWinner = null;
  state.showdownWinners = [];
  state.showdownHands = [];

  const seated = [];
  for (let i = 0; i < playerCount; i++) if (!state.out[i]) seated.push(i);

  // Fresh session: random button among the seats; a preset dealer must hold chips (else next one that does)
  let dealer = Number.isInteger(state.dealer) ? state.dealer % playerCount : seated[Math.floor(Math.random() * seated.length)];
  while (state.out[dealer]) dealer = (dealer + 1) % playerCount;
  state.dealer = dealer;
  const after = (from) => {
    for (let i = 1; i <= playerCount; i++) {
      const idx = (from + i) % playerCount;
      if (!state.out[idx]) return idx;
    }
    return from;
  };

  // Deal 2 hole cards to every seat that still has chips
  state.hands = [];
  for (let i = 0; i < playerCount; i++) {
    state.hands.push(state.out[i] ? [] : [state.deck.pop(), state.deck.pop()]);
  }

  state.phase = 'preflop';

  // Heads-up the dealer posts the small blind and the other player the big blind
  const sbIndex = seated.length === 2 ? state.dealer : after(state.dealer);
  const bbIndex = after(sbIndex);
  state.smallBlind = sbIndex;
  state.bigBlind = bbIndex;
  commit(state, sbIndex, SMALL_BLIND);
  commit(state, bbIndex, BIG_BLIND);
  state.currentBet = BIG_BLIND;

  // First to act preflop: left of the big blind (heads-up that is the dealer / small blind)
  const n = playerCount;
  state.currentPlayer = bbIndex;
  for (let k = 0; k < n; k++) {
    state.currentPlayer = (state.currentPlayer + 1) % n;
    if (canAct(state, state.currentPlayer)) break;
  }
  // Short stacks may have gone all-in on the blinds: nobody (or nobody who still has to decide) can act
  advancePhase(state);
};

// null if `amount` (the total bet for this street) is a legal raise for the player, else an error key.
// Standard no-limit: the raise must be at least the last raise increment (big blind if none); a bet that
// uses the whole stack is always allowed; a short all-in does not reopen the betting for players who
// already acted.
exports.checkRaise = function(state, playerIndex, amount) {
  if (!Number.isInteger(amount) || amount <= state.currentBet) return 'tx_raise_too_low';
  const need = amount - state.bets[playerIndex];
  if (need > state.chips[playerIndex]) return 'tx_not_enough_chips';
  if (state.raiseClosed[playerIndex] || !state.chips.some((c, i) => i !== playerIndex && canAct(state, i))) return 'tx_raise_closed';
  if (need < state.chips[playerIndex] && amount < state.currentBet + state.lastRaise) return 'tx_raise_too_low';
  return null;
};

function applyRaiseTo(state, playerIndex, amount) {
  const increment = amount - state.currentBet;
  commit(state, playerIndex, amount - state.bets[playerIndex]);
  state.currentBet = amount;
  const full = increment >= state.lastRaise;
  if (full) state.lastRaise = increment;
  markActed(state, playerIndex, full);
  if (!full) {
    // Short all-in: everyone who already acted must still call it, but may not raise again
    for (let i = 0; i < state.acted.length; i++) {
      if (i !== playerIndex && state.acted[i]) state.raiseClosed[i] = true;
    }
  }
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return 'g_game_over';
  if (state.phase === 'showdown') return 'tx_showdown_start_new';
  if (playerIndex !== state.currentPlayer) return 'g_not_your_turn';
  if (state.folded[playerIndex]) return 'tx_you_folded';
  if (state.allIn[playerIndex]) return 'tx_you_all_in';

  let { action, amount } = data;
  const n = state.chips.length;
  // Server bot fallback ({pass:true} / {}): check if free, otherwise fold
  if (action === undefined && (data.pass === true || Object.keys(data).length === 0)) {
    action = state.currentBet > state.bets[playerIndex] ? 'fold' : 'check';
  }

  if (action === 'fold') {
    state.folded[playerIndex] = true;

    // Check if only one player left
    const notFolded = [];
    for (let i = 0; i < n; i++) {
      if (!state.folded[i]) notFolded.push(i);
    }
    if (notFolded.length === 1) {
      state.chips[notFolded[0]] += state.pot;
      state.pot = 0;
      endHand(state, notFolded[0]);
      state.currentPlayer = notFolded[0];
      state.bets = state.bets.map(() => 0);
      return null;
    }

    state.currentPlayer = nextActivePlayer(state, playerIndex);
    advancePhase(state);
    return null;
  }

  if (action === 'check') {
    if (state.currentBet > state.bets[playerIndex]) return 'tx_must_call';

    markActed(state, playerIndex, false);
    state.currentPlayer = nextActivePlayer(state, playerIndex);
    advancePhase(state);
    return null;
  }

  if (action === 'call') {
    const toCall = state.currentBet - state.bets[playerIndex];
    if (toCall <= 0) return 'tx_you_can_check';
    if (state.chips[playerIndex] < toCall) return 'tx_not_enough_chips_go_allin';

    commit(state, playerIndex, toCall);
    markActed(state, playerIndex, false);

    state.currentPlayer = nextActivePlayer(state, playerIndex);
    advancePhase(state);
    return null;
  }

  if (action === 'raise') {
    const err = exports.checkRaise(state, playerIndex, amount);
    if (err) return err;
    applyRaiseTo(state, playerIndex, amount);

    state.currentPlayer = nextActivePlayer(state, playerIndex);
    advancePhase(state);
    return null;
  }

  if (action === 'all_in') {
    const total = state.bets[playerIndex] + state.chips[playerIndex];
    if (total > state.currentBet) {
      if (state.raiseClosed[playerIndex]) return 'tx_raise_closed';
      applyRaiseTo(state, playerIndex, total);
    } else {
      commit(state, playerIndex, state.chips[playerIndex]);
      markActed(state, playerIndex, false);
    }

    state.currentPlayer = nextActivePlayer(state, playerIndex);
    advancePhase(state);
    return null;
  }

  return 'g_invalid_action';
};

// Per-player view: show only the player's hole cards
exports.playerView = function(state, playerIndex) {
  const view = {
    phase: state.phase,
    communityCards: state.communityCards.map(c => ({ ...c })),
    pot: state.pot,
    sidePots: state.sidePots ? state.sidePots.map(s => ({ ...s, players: s.players.slice(), winners: s.winners ? s.winners.slice() : [] })) : [],
    chips: state.chips ? state.chips.slice() : [],
    bets: state.bets ? state.bets.slice() : [],
    currentBet: state.currentBet,
    lastRaise: state.lastRaise,
    raiseClosed: !!(state.raiseClosed && state.raiseClosed[playerIndex]),
    dealer: state.dealer,
    currentPlayer: state.currentPlayer,
    folded: state.folded ? state.folded.slice() : [],
    allIn: state.allIn ? state.allIn.slice() : [],
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    out: state.out ? state.out.slice() : [],
    handNumber: state.handNumber || 1,
    sessionOver: !!state.sessionOver,
    winner: state.winner,
    showdownWinner: state.showdownWinner,
    showdownWinners: state.showdownWinners ? state.showdownWinners.slice() : [],
    showdownHands: state.showdownHands ? state.showdownHands.map(h => ({
      player: h.player,
      cards: h.cards.map(c => ({ ...c })),
      hand: { ...h.hand },
    })) : [],
    // Only show current player their hole cards
    holeCards: (state.hands && state.hands[playerIndex]) ? state.hands[playerIndex].map(c => ({ ...c })) : [],
    // Other players' card counts
    opponentHoleCounts: state.hands ? state.hands.map((h, i) => {
      if (i === playerIndex || !h) return 0;
      if (state.folded && state.folded[i]) return 0;
      return h.length;
    }) : [],
  };
  return view;
};
