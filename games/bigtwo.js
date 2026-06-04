// games/bigtwo.js
// 大老二 (Big Two / 锄大地) — climbing card game

const SUITS = ['s','h','c','d'];
const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
// Suit order: ♠ > ♥ > ♣ > ♦  (s > h > c > d)
const SUIT_ORDER = { s: 3, h: 2, c: 1, d: 0 };

exports.name = 'bigtwo';
exports.maxPlayers = 4;

function rankVal(rank) {
  return RANKS.indexOf(rank);
}

function suitVal(suit) {
  return SUIT_ORDER[suit] || 0;
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
  hand.sort((a, b) => {
    const rv = rankVal(a.rank) - rankVal(b.rank);
    if (rv !== 0) return rv;
    return suitVal(a.suit) - suitVal(b.suit);
  });
}

// Compare two cards of the same rank — returns true if a beats b by suit
function cardBeats(a, b) {
  const rv = rankVal(a.rank) - rankVal(b.rank);
  if (rv !== 0) return rv > 0;
  return suitVal(a.suit) > suitVal(b.suit);
}

// Detect card combination type
function detectType(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;
  const rvals = cards.map(c => rankVal(c.rank)).sort((a,b) => a-b);

  // Count rank groups
  const countMap = new Map();
  for (const r of rvals) countMap.set(r, (countMap.get(r) || 0) + 1);
  const groups = { 1: [], 2: [], 3: [], 4: [] };
  for (const [r, c] of countMap) groups[c].push(r);
  for (const k of Object.keys(groups)) groups[k].sort((a,b) => a-b);

  // Single
  if (n === 1) return { type: 'single', rank: rvals[0], suit: suitVal(cards[0].suit) };

  // Pair
  if (n === 2 && rvals[0] === rvals[1])
    return { type: 'pair', rank: rvals[0], suit: Math.max(...cards.map(c => suitVal(c.suit))) };

  // Triple
  if (groups[3].length === 1 && n === 3)
    return { type: 'triple', rank: groups[3][0] };

  // Straight: >=5 consecutive singles, max 13
  if (n >= 5 && groups[1].length === n && isConsecutive(groups[1], n))
    return { type: 'straight', rank: groups[1][0], length: n };

  // Flush: 5 cards same suit, not consecutive
  if (n === 5 && new Set(cards.map(c => c.suit)).size === 1 && !isConsecutive(rvals, 5))
    return { type: 'flush', rank: rvals[4], suit: suitVal(cards[0].suit) };

  // Full house: triple + pair
  if (n === 5 && groups[3].length === 1 && groups[2].length === 1)
    return { type: 'full_house', rank: groups[3][0] };

  // Four of a kind + one
  if (n === 5 && groups[4].length === 1)
    return { type: 'four_one', rank: groups[4][0] };

  // Straight flush: 5 consecutive same suit
  if (n === 5 && new Set(cards.map(c => c.suit)).size === 1 && isConsecutive(rvals, 5))
    return { type: 'straight_flush', rank: rvals[0], suit: suitVal(cards[0].suit) };

  return null;
}

function isConsecutive(arr, len) {
  for (let i = 0; i < len - 1; i++) {
    if (arr[i + 1] - arr[i] !== 1) return false;
  }
  return true;
}

function canBeat(newPlay, lastPlay) {
  if (!lastPlay) return true;
  // Must be same type and length
  if (newPlay.type !== lastPlay.type) return false;
  if (newPlay.length !== lastPlay.length) return false;
  // Same type: compare rank, then suit for flush/straight_flush
  if (newPlay.rank !== lastPlay.rank) return newPlay.rank > lastPlay.rank;
  // Same rank: compare suit
  return (newPlay.suit || 0) > (lastPlay.suit || 0);
}

function findDiamond3Player(state) {
  const n = state.hands.length;
  for (let i = 0; i < n; i++) {
    if (state.hands[i] && state.hands[i].some(c => c.id === '3d')) return i;
  }
  return 0;
}

exports.createState = () => {
  return {
    hands: [],
    currentPlayer: 0,
    passCount: 0,
    passed: [],
    lastPlay: null,
    lastPlayPlayer: -1,
    winner: null,
    scores: [],
  };
};

exports.initGame = function(state, playerCount) {
  const deck = createDeck();
  shuffle(deck);

  const cardsPerPlayer = Math.floor(52 / playerCount);
  state.hands = [];
  for (let i = 0; i < playerCount; i++) {
    state.hands.push(deck.splice(0, cardsPerPlayer));
    sortHand(state.hands[i]);
  }
  // Remainder cards go to first players (unusual but simple)
  if (deck.length > 0) {
    for (let i = 0; i < deck.length; i++) {
      state.hands[i].push(deck[i]);
      sortHand(state.hands[i]);
    }
  }

  state.passCount = 0;
  state.passed = new Array(playerCount).fill(false);
  state.lastPlay = null;
  state.lastPlayPlayer = -1;
  state.winner = null;
  state.scores = new Array(playerCount).fill(0);

  // ♦3 holder starts first round
  state.currentPlayer = findDiamond3Player(state);
};

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';
  if (playerIndex !== state.currentPlayer) return '还没轮到你';

  const { cards: cardIds } = data;
  if (!Array.isArray(cardIds)) return '无效格式';

  // PASS
  if (cardIds.length === 0) {
    if (!state.lastPlay) return '本轮你是首家，必须出牌';
    if (state.lastPlayPlayer === playerIndex) return '你刚出了牌别人都没过，不能过';

    state.passCount++;
    state.passed[playerIndex] = true;
    state.currentPlayer = (state.currentPlayer + 1) % state.hands.length;

    // If everyone except lastPlayPlayer passed, reset
    const activePlayers = state.hands.filter(h => h && h.length > 0).length;
    const passedCount = state.passed.filter(Boolean).length;
    if (passedCount >= activePlayers - 1) {
      state.lastPlay = null;
      state.lastPlayPlayer = -1;
      state.passCount = 0;
      state.passed = new Array(state.hands.length).fill(false);
      state.currentPlayer = state.currentPlayer; // stays on the reset player
    }
    return null;
  }

  // Remove cards from hand
  const hand = state.hands[playerIndex];
  if (!hand) return '你没有手牌';
  const played = [];
  for (const id of cardIds) {
    const idx = hand.findIndex(c => c.id === id);
    if (idx === -1) {
      hand.push(...played); sortHand(hand);
      return '你手上没有这张牌: ' + id;
    }
    played.push(hand.splice(idx, 1)[0]);
  }

  const playType = detectType(played);
  if (!playType) {
    hand.push(...played); sortHand(hand);
    return '无效牌型';
  }

  // Check if this is a free play (new round after everyone passed, or first move)
  const isFreePlay = !state.lastPlay || state.lastPlayPlayer === playerIndex;
  if (!isFreePlay) {
    if (!canBeat(playType, state.lastPlay.play)) {
      hand.push(...played); sortHand(hand);
      return '打不过上家的牌';
    }
  }

  state.lastPlay = { player: playerIndex, cards: played.map(c => ({ ...c })), play: playType };
  state.lastPlayPlayer = playerIndex;
  state.passCount = 0;
  state.passed = new Array(state.hands.length).fill(false);

  // Check win
  if (hand.length === 0) {
    state.winner = playerIndex;
    // Calculate scores: others count remaining cards
    for (let i = 0; i < state.hands.length; i++) {
      if (i !== playerIndex && state.hands[i]) {
        state.scores[i] = state.hands[i].length;
      }
    }
    return null;
  }

  state.currentPlayer = (state.currentPlayer + 1) % state.hands.length;
  return null;
};
