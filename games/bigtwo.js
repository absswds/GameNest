// games/bigtwo.js
// 大老二 (Big Two / 锄大地) — climbing card game, Hong Kong rules.
//
// - 3-4 players. 4 players: 13 cards each. 3 players: 17 each, the 52nd card
//   goes to whoever holds the 3 of diamonds (18 cards).
// - Plays are 1, 2, 3 or 5 cards. Five-card hands rank
//   straight < flush < full house < four of a kind + 1 < straight flush,
//   and a higher kind beats any lower kind.
// - Straights: A may only start (A-2-3-4-5, the lowest) or end (10-J-Q-K-A,
//   the highest) a straight. Straights compare by their top card, then its suit.
// - Flushes compare by their highest card, then suit.
// - Optional "next player has one card" rule (on by default): a single played
//   while the next player holds one card must be your highest card.
// - Scoring: each loser pays cards left x1 (under 10), x2 (10-12), x3 (13+);
//   the winner collects the total. cumulativeScore carries across rounds.

const SUITS = ['s','h','c','d'];
const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
// Suit order: ♠ > ♥ > ♣ > ♦  (s > h > c > d)
const SUIT_ORDER = { s: 3, h: 2, c: 1, d: 0 };
// Rank as it sits in a straight (A is high here; A-2-3-4-5 is handled separately)
const SEQ_VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
// Five-card hand kinds, weakest first; a higher kind beats any lower kind
const FIVE_KINDS = ['straight', 'flush', 'full_house', 'four_one', 'straight_flush'];

exports.name = 'bigtwo';
exports.minPlayers = 3;
exports.maxPlayers = 4;

function rankVal(rank) {
  return RANKS.indexOf(rank);
}

function suitVal(suit) {
  return SUIT_ORDER[suit] || 0;
}

function cardVal(c) {
  return rankVal(c.rank) * 4 + suitVal(c.suit);
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

function sortHand(hand) {
  hand.sort((a, b) => cardVal(a) - cardVal(b));
}

// Top card of a 5-card straight ({ seq, card }), or null if the cards are not a straight.
function straightTop(cards) {
  const seq = cards.map(c => ({ v: SEQ_VAL[c.rank], c })).sort((a, b) => a.v - b.v);
  const run = (list) => list.every((x, i) => i === 0 || x.v - list[i - 1].v === 1);
  if (run(seq)) return { seq: seq[4].v, card: seq[4].c };
  // A-2-3-4-5: the ace counts as 1, so the 5 is the top card
  if (seq[4].c.rank === 'A') {
    const low = [{ v: 1, c: seq[4].c }].concat(seq.slice(0, 4));
    if (run(low)) return { seq: 5, card: low[4].c };
  }
  return null;
}

// Detect card combination type. Every result carries rank and suit so canBeat can
// compare plays of the same type; five-card kinds also carry `kind` (index in FIVE_KINDS).
function detectType(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;
  const rvals = cards.map(c => rankVal(c.rank)).sort((a, b) => a - b);

  if (n === 1) return { type: 'single', rank: rvals[0], suit: suitVal(cards[0].suit) };

  if (n === 2) {
    if (rvals[0] !== rvals[1]) return null;
    return { type: 'pair', rank: rvals[0], suit: Math.max(...cards.map(c => suitVal(c.suit))) };
  }

  if (n === 3) {
    if (rvals[0] !== rvals[2]) return null;
    return { type: 'triple', rank: rvals[0], suit: 0 };
  }

  if (n !== 5) return null;

  const counts = new Map();
  for (const r of rvals) counts.set(r, (counts.get(r) || 0) + 1);
  const rankWithCount = (k) => { for (const [r, c] of counts) if (c === k) return r; return -1; };
  const five = (type, rank, suit) => ({ type, kind: FIVE_KINDS.indexOf(type), rank, suit });

  const sameSuit = new Set(cards.map(c => c.suit)).size === 1;
  const st = counts.size === 5 ? straightTop(cards) : null;
  if (st) return five(sameSuit ? 'straight_flush' : 'straight', st.seq, suitVal(st.card.suit));
  if (sameSuit) {
    const top = cards.reduce((a, b) => (cardVal(b) > cardVal(a) ? b : a));
    return five('flush', rankVal(top.rank), suitVal(top.suit));
  }
  if (rankWithCount(3) >= 0 && rankWithCount(2) >= 0) return five('full_house', rankWithCount(3), 0);
  if (rankWithCount(4) >= 0) return five('four_one', rankWithCount(4), 0);
  return null;
}

// Five-card hand classes: straight < flush < full house < four-one < straight flush.
// A straight longer than 5 is a house extension and is only comparable with straights of its own length.
const FIVE_CLASS = { straight: 1, flush: 2, full_house: 3, four_one: 4, straight_flush: 5 };
function fiveClass(p) {
  if (!p || !FIVE_CLASS[p.type]) return 0;
  if (p.type === 'straight' && p.length !== 5) return 0;
  return FIVE_CLASS[p.type];
}

function canBeat(newPlay, lastPlay) {
  if (!lastPlay) return true;
  if (newPlay.kind !== undefined && lastPlay.kind !== undefined) {
    if (newPlay.kind !== lastPlay.kind) return newPlay.kind > lastPlay.kind;
  } else if (newPlay.type !== lastPlay.type) {
    return false;
  }
  if (newPlay.rank !== lastPlay.rank) return newPlay.rank > lastPlay.rank;
  return (newPlay.suit || 0) > (lastPlay.suit || 0);
}

function nextPlayer(state, i) {
  return (i + 1) % state.hands.length;
}

// Checks whether `cards` (card objects from the player's hand) is a legal play
// right now. Returns { play } or { error }. Does not change the state.
function checkPlay(state, playerIndex, cards) {
  const play = detectType(cards);
  if (!play) return { error: 'bt_invalid_play' };

  // First play of the game must contain the 3 of diamonds.
  if (!state._opened && !cards.some(c => c.id === '3d')) return { error: 'bt_first_must_have_d3' };

  const isFreePlay = !state.lastPlay || state.lastPlayPlayer === playerIndex;
  if (!isFreePlay) {
    if (cards.length !== state.lastPlay.cards.length) return { error: 'bt_doesnt_beat' };
    if (!canBeat(play, state.lastPlay.play)) return { error: 'bt_doesnt_beat' };
  }

  // Next player down to one card: a single must be your highest card.
  if (state.oneCardRule && play.type === 'single') {
    const next = state.hands[nextPlayer(state, playerIndex)];
    const hand = state.hands[playerIndex];
    if (next && next.length === 1 && hand.some(c => cardVal(c) > cardVal(cards[0]))) {
      return { error: 'bt_must_play_highest_single' };
    }
  }
  return { play };
}

// HK penalty multiplier for the cards a loser still holds.
function penaltyMultiplier(left) {
  if (left >= 13) return 3;
  if (left >= 10) return 2;
  return 1;
}

function settle(state, winner) {
  const n = state.hands.length;
  const result = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (i === winner) { result.push(null); continue; }
    const left = state.hands[i].length;
    const mult = penaltyMultiplier(left);
    result.push({ left, mult, points: -left * mult });
    total += left * mult;
  }
  result[winner] = { left: 0, mult: 0, points: total };
  state.roundResult = result;
  state.scores = result.map(r => r.points);
  if (!Array.isArray(state.cumulativeScore) || state.cumulativeScore.length !== n) state.cumulativeScore = new Array(n).fill(0);
  for (let i = 0; i < n; i++) state.cumulativeScore[i] += state.scores[i];
}

exports.createState = () => {
  return {
    hands: [],
    currentPlayer: 0,
    passed: [],
    lastPlay: null,
    lastPlayPlayer: -1,
    winner: null,
    scores: [],
    cumulativeScore: null,
    roundNumber: 1,
    roundResult: null,
    oneCardRule: true,
    _opened: false,
  };
};

exports.initGame = function(state, playerCount) {
  const deck = createDeck();
  shuffle(deck);

  const perPlayer = Math.floor(52 / playerCount);
  state.hands = [];
  for (let i = 0; i < playerCount; i++) state.hands.push(deck.splice(0, perPlayer));
  // 3 players: the leftover card goes to the holder of the 3 of diamonds
  // (or to a random player when the leftover card is the 3 of diamonds itself).
  for (const card of deck) {
    let to = state.hands.findIndex(h => h.some(c => c.id === '3d'));
    if (to < 0) to = Math.floor(Math.random() * playerCount);
    state.hands[to].push(card);
  }
  state.hands.forEach(sortHand);

  const opts = state._options || {};
  state.oneCardRule = opts.oneCardRule !== false;
  state.passed = new Array(playerCount).fill(false);
  state.lastPlay = null;
  state.lastPlayPlayer = -1;
  state.winner = null;
  state.scores = new Array(playerCount).fill(0);
  state.roundResult = null;
  if (!Array.isArray(state.cumulativeScore) || state.cumulativeScore.length !== playerCount) {
    state.cumulativeScore = new Array(playerCount).fill(0);
  }
  if (!state.roundNumber) state.roundNumber = 1;

  // ♦3 holder starts and must play it
  state._opened = false;
  state.currentPlayer = state.hands.findIndex(h => h.some(c => c.id === '3d'));
};

// Server bot fallback (used before the generic {pass:true} / {}): passing is illegal when leading,
// so lead the lowest legal single instead; otherwise pass.
exports.botFallback = (state, playerIndex) => {
  const mustLead = !state.lastPlay || state.lastPlayPlayer === playerIndex;
  if (!mustLead) return { pass: true };
  const lead = (state.hands[playerIndex] || []).find(c => !checkPlay(state, playerIndex, [c]).error);
  return lead ? { cards: [lead.id] } : null;
};

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return 'g_game_over';
  if (playerIndex !== state.currentPlayer) return 'g_not_your_turn';
  if (!data || typeof data !== 'object') return 'bt_invalid_format';

  const cardIds = data.pass === true ? [] : data.cards;
  if (!Array.isArray(cardIds)) return 'bt_invalid_format';

  // PASS
  if (cardIds.length === 0) {
    if (!state.lastPlay || state.lastPlayPlayer === playerIndex) return 'bt_must_lead';

    state.passed[playerIndex] = true;
    state.currentPlayer = nextPlayer(state, playerIndex);

    // Everyone else passed in a row: the turn is back with the last player, who leads freely.
    if (state.currentPlayer === state.lastPlayPlayer) {
      state.lastPlay = null;
      state.lastPlayPlayer = -1;
      state.passed = new Array(state.hands.length).fill(false);
    }
    return null;
  }

  const hand = state.hands[playerIndex];
  if (!hand) return 'bt_no_hand';
  if (new Set(cardIds).size !== cardIds.length) return 'bt_invalid_format';
  const played = [];
  for (const id of cardIds) {
    const card = hand.find(c => c.id === id);
    if (!card) return 'bt_card_not_in_hand';
    played.push(card);
  }

  const check = checkPlay(state, playerIndex, played);
  if (check.error) return check.error;

  state.hands[playerIndex] = hand.filter(c => played.indexOf(c) < 0);
  sortHand(played);
  state._opened = true;
  state.lastPlay = { player: playerIndex, cards: played.map(c => ({ ...c })), play: check.play };
  state.lastPlayPlayer = playerIndex;
  state.passed = new Array(state.hands.length).fill(false);

  if (state.hands[playerIndex].length === 0) {
    state.winner = playerIndex;
    settle(state, playerIndex);
    return null;
  }

  state.currentPlayer = nextPlayer(state, playerIndex);
  return null;
};

// Rule helpers shared with the bot and tests.
exports.detectType = detectType;
exports.canBeat = canBeat;
exports.checkPlay = checkPlay;
exports.cardVal = cardVal;
exports.penaltyMultiplier = penaltyMultiplier;

// Hide other players' cards (and draw piles) from each client.
const { maskView } = require('./lib/hidden');
exports.playerView = function (state, playerIndex) {
  return maskView(state, playerIndex);
};

exports.detectType = detectType;
exports.canBeat = canBeat;
exports.fiveClass = fiveClass;
