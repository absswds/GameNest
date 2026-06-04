// games/texas.js
// Texas Hold'em Poker — community card poker game

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

function showdown(state) {
  const active = [];
  for (let i = 0; i < state.hands.length; i++) {
    if (!state.folded[i]) active.push(i);
  }
  if (active.length === 0) return -1;

  let bestPlayer = active[0];
  let bestScore = evaluateHand([...state.hands[bestPlayer], ...state.communityCards]);

  for (let i = 1; i < active.length; i++) {
    const score = evaluateHand([...state.hands[active[i]], ...state.communityCards]);
    if (compareHands(score, bestScore) > 0) {
      bestPlayer = active[i];
      bestScore = score;
    } else if (compareHands(score, bestScore) === 0) {
      // Tie — split pot (simplified: first best wins, we handle split in pot distribution)
    }
  }

  // Simplified: winner takes main pot
  state.chips[bestPlayer] += state.pot;
  state.pot = 0;
  // Handle side pots roughly: give to same winner for now
  for (const sp of state.sidePots) {
    state.chips[bestPlayer] += sp.amount;
  }
  state.sidePots = [];

  // Eliminate players with 0 chips
  let alive = 0;
  for (let i = 0; i < state.chips.length; i++) {
    if (state.chips[i] > 0) alive++;
  }
  if (alive <= 1) {
    state.winner = bestPlayer;
  }

  return bestPlayer;
}

function advancePhase(state) {
  const activePlayers = state.chips.map((c, i) => {
    if (state.folded[i] || state.allIn[i] || c <= 0) return 0;
    return state.bets[i] < state.currentBet ? 1 : 0; // still needs to act
  }).reduce((a, b) => a + b, 0);

  if (activePlayers === 0) {
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
      state.showdownHands = [];
      for (let i = 0; i < state.hands.length; i++) {
        if (!state.folded[i]) {
          state.showdownHands.push({
            player: i,
            cards: state.hands[i].map(c => ({ ...c })),
            hand: evaluateHand([...state.hands[i], ...state.communityCards]),
          });
        }
      }
      return;
    }
    // Reset bets for new round
    for (let i = 0; i < state.bets.length; i++) state.bets[i] = 0;
    state.currentBet = 0;
    state.lastRaise = 0;
    state.currentPlayer = nextActivePlayerAfterDealer(state);
  }
}

function nextActivePlayerAfterDealer(state) {
  const n = state.chips.length;
  // In heads-up, dealer acts first preflop
  // Otherwise, start from player after dealer
  for (let i = 1; i <= n; i++) {
    const idx = (state.dealer + i) % n;
    if (!state.folded[idx] && state.chips[idx] > 0) return idx;
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
    folded: [],
    allIn: [],
    currentBet: 0,
    lastRaise: 0,
    dealer: 0,
    currentPlayer: 0,
    phase: 'preflop', // preflop | flop | turn | river | showdown
    smallBlind: 0,
    bigBlind: 0,
    winner: null,
    showdownWinner: null,
    showdownHands: [],
  };
};

exports.initGame = function(state, playerCount) {
  const startingChips = 1000;
  const deck = createDeck();
  shuffle(deck);

  state.deck = deck;
  state.communityCards = [];
  state.pot = 0;
  state.sidePots = [];
  state.bets = new Array(playerCount).fill(0);
  state.folded = new Array(playerCount).fill(false);
  state.allIn = new Array(playerCount).fill(false);
  state.chips = new Array(playerCount).fill(startingChips);
  state.currentBet = 0;
  state.lastRaise = 0;
  state.winner = null;
  state.showdownWinner = null;
  state.showdownHands = [];

  // Rotate dealer
  state.dealer = (state.dealer || 0) % playerCount;

  // Deal 2 hole cards each
  state.hands = [];
  for (let i = 0; i < playerCount; i++) {
    state.hands.push([state.deck.pop(), state.deck.pop()]);
  }

  state.phase = 'preflop';
  state.currentBet = 0;

  // Post blinds
  const bbIndex = (state.dealer + 2) % playerCount;
  const sbIndex = (state.dealer + 1) % playerCount;
  const bb = 20;
  const sb = 10;

  state.smallBlind = sbIndex;
  state.bigBlind = bbIndex;
  state.currentBet = bb;

  // Post small blind
  if (state.chips[sbIndex] <= sb) {
    state.bets[sbIndex] = state.chips[sbIndex];
    state.chips[sbIndex] = 0;
    state.allIn[sbIndex] = true;
  } else {
    state.chips[sbIndex] -= sb;
    state.bets[sbIndex] = sb;
  }

  // Post big blind
  if (state.chips[bbIndex] <= bb) {
    state.bets[bbIndex] = state.chips[bbIndex];
    state.pot += state.bets[bbIndex];
    state.chips[bbIndex] = 0;
    state.allIn[bbIndex] = true;
  } else {
    state.chips[bbIndex] -= bb;
    state.bets[bbIndex] = bb;
  }

  state.pot += sb + (state.allIn[bbIndex] ? state.chips[bbIndex] : bb);

  // First to act: player after big blind (or dealer+3 for 2 players, meaning dealer acts first)
  const n = playerCount;
  let firstToAct = (bbIndex + 1) % n;
  if (playerCount === 2) firstToAct = state.dealer; // dealer acts first preflop heads-up
  state.currentPlayer = firstToAct;

  // Skip folded/all-in/bust players
  while (state.folded[state.currentPlayer] || state.allIn[state.currentPlayer] || state.chips[state.currentPlayer] <= 0) {
    state.currentPlayer = (state.currentPlayer + 1) % n;
  }
};

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';
  if (state.phase === 'showdown') return '已经摊牌，请重新开始';
  if (playerIndex !== state.currentPlayer) return '还没轮到你';
  if (state.folded[playerIndex]) return '你已经弃牌';
  if (state.allIn[playerIndex]) return '你已经全下';

  const { action, amount } = data;
  const n = state.chips.length;

  if (action === 'fold') {
    state.folded[playerIndex] = true;
    // Move pot amounts
    for (let i = 0; i < n; i++) {
      state.pot += state.bets[i];
      state.bets[i] = 0;
      state.allIn[i] = false;
    }

    // Check if only one player left
    const notFolded = [];
    for (let i = 0; i < n; i++) {
      if (!state.folded[i]) notFolded.push(i);
    }
    if (notFolded.length === 1) {
      state.chips[notFolded[0]] += state.pot;
      state.pot = 0;
      state.winner = notFolded[0];
      return null;
    }

    state.currentPlayer = nextActivePlayer(state, playerIndex);
    advancePhase(state);
    return null;
  }

  if (action === 'check') {
    if (state.currentBet > state.bets[playerIndex]) return '必须先跟注';

    state.currentPlayer = nextActivePlayer(state, playerIndex);
    advancePhase(state);
    return null;
  }

  if (action === 'call') {
    const toCall = state.currentBet - state.bets[playerIndex];
    if (toCall <= 0) return '你可以过牌';
    if (state.chips[playerIndex] < toCall) return '筹码不足，请全下';

    state.chips[playerIndex] -= toCall;
    state.bets[playerIndex] = state.currentBet;

    state.currentPlayer = nextActivePlayer(state, playerIndex);
    advancePhase(state);
    return null;
  }

  if (action === 'raise') {
    const minRaise = state.lastRaise > 0 ? state.lastRaise : state.currentBet > 0 ? state.currentBet - state.bets[playerIndex] : 10;
    if (typeof amount !== 'number' || amount < (state.currentBet + minRaise)) {
      return '加注至少需要 ' + (state.currentBet + minRaise) + ' 筹码';
    }
    if (amount > state.chips[playerIndex]) return '筹码不足';

    state.chips[playerIndex] -= (amount - state.bets[playerIndex]);
    state.bets[playerIndex] = amount;
    state.currentBet = amount;
    state.lastRaise = amount - state.bets[playerIndex]; // simplified

    state.currentPlayer = nextActivePlayer(state, playerIndex);
    return null;
  }

  if (action === 'all_in') {
    const toCall = state.currentBet - state.bets[playerIndex];
    const remaining = state.chips[playerIndex];
    state.bets[playerIndex] += remaining;
    state.chips[playerIndex] = 0;
    state.allIn[playerIndex] = true;

    if (remaining > toCall) {
      // This is a raise — handle side pot later
      state.currentBet = state.bets[playerIndex];
    }

    state.currentPlayer = nextActivePlayer(state, playerIndex);
    advancePhase(state);
    return null;
  }

  return '无效操作';
};

// Per-player view: show only the player's hole cards
exports.playerView = function(state, playerIndex) {
  const view = {
    phase: state.phase,
    communityCards: state.communityCards.map(c => ({ ...c })),
    pot: state.pot,
    sidePots: state.sidePots ? state.sidePots.map(s => ({ ...s })) : [],
    chips: state.chips ? state.chips.slice() : [],
    bets: state.bets ? state.bets.slice() : [],
    currentBet: state.currentBet,
    lastRaise: state.lastRaise,
    dealer: state.dealer,
    currentPlayer: state.currentPlayer,
    folded: state.folded ? state.folded.slice() : [],
    allIn: state.allIn ? state.allIn.slice() : [],
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    winner: state.winner,
    showdownWinner: state.showdownWinner,
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
