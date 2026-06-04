// games/doudizhu.js
// 斗地主 - 3-player card game with landlord bidding and card combination play

const SUITS = ['s','h','c','d'];
const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

exports.name = 'doudizhu';
exports.maxPlayers = 3;

function rankVal(rank) {
  if (rank === '小王') return 13;
  if (rank === '大王') return 14;
  return RANKS.indexOf(rank);
}

function createDeck() {
  const deck = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck.push({ rank: r, suit: s, id: r + s });
    }
  }
  deck.push({ rank: '小王', suit: '', id: 'SJ' });
  deck.push({ rank: '大王', suit: '', id: 'BJ' });
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function sortHand(hand) {
  hand.sort((a, b) => rankVal(a.rank) - rankVal(b.rank));
}

// Sync board snapshot for client-side rendering (server.js only broadcasts
// {board, currentPlayer, winner} on human player moves)
function syncBoard(state) {
  return {
    phase: state.phase,
    hands: state.hands.map(h => h.map(c => ({ ...c }))),
    bottomCards: state.bottomCards.map(c => ({ ...c })),
    landlord: state.landlord,
    currentBidder: state.currentBidder,
    currentBid: state.currentBid,
    passCount: state.passCount,
    bids: state.bids ? { ...state.bids } : {},
    currentPlayer: state.currentPlayer,
    lastPlay: state.lastPlay ? {
      player: state.lastPlay.player,
      cards: state.lastPlay.cards.map(c => ({ ...c })),
      play: { ...state.lastPlay.play },
    } : null,
    passStreak: state.passStreak,
    passed: Array.isArray(state.passed) ? state.passed.slice() : [false, false, false],
    winner: state.winner,
  };
}

exports.createState = () => {
  const state = {
    board: null,
    phase: 'bidding',
    hands: [[], [], []],
    bottomCards: [],
    landlord: null,
    currentBidder: 0,
    currentBid: 0,
    passCount: 0,
    bids: {},
    currentPlayer: 0,
    lastPlay: null,
    passStreak: 0,
    passed: [false, false, false],
    winner: null,
  };
  dealCards(state);
  return state;
};

exports.initGame = function(state, playerCount) {
  dealCards(state);
};

function dealCards(state) {
  const deck = createDeck();
  shuffle(deck);
  state.hands[0] = deck.slice(0, 17);
  state.hands[1] = deck.slice(17, 34);
  state.hands[2] = deck.slice(34, 51);
  state.bottomCards = deck.slice(51, 54);
  for (const h of state.hands) sortHand(h);
  sortHand(state.bottomCards);
  state.phase = 'bidding';
  state.currentBidder = Math.floor(Math.random() * 3);
  state.currentBid = 0;
  state.passCount = 0;
  state.bids = {};
  state.landlord = null;
  state.currentPlayer = state.currentBidder;
  state.lastPlay = null;
  state.passStreak = 0;
  state.passed = [false, false, false];
  state.winner = null;
  state.board = syncBoard(state);
}

// Card type detection
function detectType(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;
  const rvals = cards.map(c => rankVal(c.rank)).sort((a,b) => a-b);

  // Rocket: SJ + BJ
  if (n === 2 && cards.some(c => c.id === 'SJ') && cards.some(c => c.id === 'BJ'))
    return { type: 'rocket', rank: 15 };

  // Check for bomb: 4 of same rank
  if (n === 4 && rvals[0] === rvals[3])
    return { type: 'bomb', rank: rvals[0] };

  // Count rank groups
  const countMap = new Map();
  for (const r of rvals) countMap.set(r, (countMap.get(r) || 0) + 1);
  const groups = { 1: [], 2: [], 3: [], 4: [] };
  for (const [r, c] of countMap) groups[c].push(r);
  for (const k of Object.keys(groups)) groups[k].sort((a,b) => a-b);

  // Single
  if (n === 1) return { type: 'single', rank: rvals[0] };

  // Pair
  if (n === 2 && rvals[0] === rvals[1])
    return { type: 'pair', rank: rvals[0] };

  // Triple
  if (groups[3].length === 1 && n === 3)
    return { type: 'triple', rank: groups[3][0] };

  // Triple + 1
  if (groups[3].length === 1 && n === 4)
    return { type: 'triple_one', rank: groups[3][0] };

  // Triple + 2
  if (groups[3].length === 1 && n === 5 && groups[2].length === 1)
    return { type: 'triple_two', rank: groups[3][0] };

  // Straight: >=5 consecutive singles, rank < 12 (not including 2)
  if (n >= 5 && groups[1].length === n && isConsecutive(groups[1], n) && groups[1][n-1] < 12)
    return { type: 'straight', rank: groups[1][0], length: n };

  // Consecutive pairs: >=3 consecutive pairs, rank < 12
  if (n >= 6 && n % 2 === 0 && groups[2].length === n/2 && isConsecutive(groups[2], n/2) && groups[2][n/2-1] < 12)
    return { type: 'consecutive_pairs', rank: groups[2][0], length: n/2 };

  // Airplane (consecutive triples) without wings
  if (n >= 6 && n % 3 === 0 && groups[3].length === n/3 && isConsecutive(groups[3], n/3) && groups[3][n/3-1] < 12)
    return { type: 'plane', rank: groups[3][0], length: n/3 };

  // Airplane with single wings
  if (groups[3].length >= 2 && isConsecutive(groups[3], groups[3].length) && groups[3][groups[3].length-1] < 12) {
    const triCount = groups[3].length;
    const remaining = n - triCount * 3;
    if (remaining === triCount) return { type: 'plane_wings_1', rank: groups[3][0], length: triCount };
    if (remaining === triCount * 2 && groups[2].length === triCount && n === triCount * 5) return { type: 'plane_wings_2', rank: groups[3][0], length: triCount };
  }

  // Four + 2 singles
  if (groups[4].length === 1 && n === 6)
    return { type: 'four_two', rank: groups[4][0] };

  // Four + 2 pairs
  if (groups[4].length === 1 && n === 8 && groups[2].length === 2)
    return { type: 'four_two_pairs', rank: groups[4][0] };

  return null;
}

function isConsecutive(arr, len) {
  for (let i = 0; i < len - 1; i++) {
    if (arr[i + 1] - arr[i] !== 1) return false;
  }
  return true;
}

function canBeat(newPlay, lastPlay) {
  if (!lastPlay) return true; // free play
  if (newPlay.type === 'rocket') return true;
  if (newPlay.type === 'bomb') {
    if (lastPlay.type === 'rocket') return false;
    if (lastPlay.type === 'bomb') return newPlay.rank > lastPlay.rank;
    return true;
  }
  // Non-bomb must match type and length, and have higher rank
  if (newPlay.type !== lastPlay.type) return false;
  if ((newPlay.length || 0) !== (lastPlay.length || 0)) return false;
  return newPlay.rank > lastPlay.rank;
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';

  // ---- BIDDING PHASE ----
  if (state.phase === 'bidding') {
    if (playerIndex !== state.currentBidder) return '还没轮到你叫地主';
    const { score } = data;
    if (typeof score !== 'number' || score < 0 || score > 3) return '叫分必须是 0-3';
    // Record this player's bid (0 = pass)
    state.bids[playerIndex] = score;
    // First player to reach a higher bid becomes landlord (ties go to earlier bidder)
    if (score > state.currentBid) {
      state.currentBid = score;
      state.landlord = playerIndex;
    }
    state.passCount++;

    // Early termination: if max bid (3) reached, assign landlord immediately
    if (score === 3) {
      state.phase = 'playing';
      state.currentPlayer = state.landlord;
      state.hands[state.landlord].push(...state.bottomCards);
      sortHand(state.hands[state.landlord]);
      state.board = syncBoard(state);
      return null;
    }

    state.currentBidder = (state.currentBidder + 1) % state._playerCount;
    state.currentPlayer = state.currentBidder;

    if (state.passCount === state._playerCount) {
      if (state.landlord === null) {
        dealCards(state);
        return null;
      }
      state.phase = 'playing';
      state.currentPlayer = state.landlord;
      // Give bottom cards to landlord
      state.hands[state.landlord].push(...state.bottomCards);
      sortHand(state.hands[state.landlord]);
    }
    state.board = syncBoard(state);
    return null;
  }

  // ---- PLAYING PHASE ----
  if (state.phase === 'playing') {
    if (playerIndex !== state.currentPlayer) return '还没轮到你';
    const { cards: cardIds } = data;
    if (!Array.isArray(cardIds)) return '无效格式';

    // PASS
    if (cardIds.length === 0) {
      if (!state.lastPlay || state.lastPlay.player === playerIndex) return '本轮你是首家，不能过';
      if (!Array.isArray(state.passed)) state.passed = [false, false, false];
      state.passStreak++;
      state.passed[playerIndex] = true;
      state.currentPlayer = (state.currentPlayer + 1) % state._playerCount;
      // New trick begins — clear pass markers
      if (state.passStreak >= 2) { state.lastPlay = null; state.passStreak = 0; state.passed = [false, false, false]; }
      state.board = syncBoard(state);
      return null;
    }

    // Remove cards from hand
    const hand = state.hands[playerIndex];
    const played = [];
    for (const id of cardIds) {
      const idx = hand.findIndex(c => c.id === id);
      if (idx === -1) { hand.push(...played); sortHand(hand); return '你手上没有这张牌: ' + id; }
      played.push(hand.splice(idx, 1)[0]);
    }

    const playType = detectType(played);
    if (!playType) { hand.push(...played); sortHand(hand); return '无效牌型'; }

    if (!canBeat(playType, state.lastPlay ? state.lastPlay.play : null)) {
      hand.push(...played); sortHand(hand); return '打不过上家的牌';
    }

    state.lastPlay = { player: playerIndex, cards: played, play: playType };
    state.passStreak = 0;
    state.passed = [false, false, false];

    // Check win
    if (hand.length === 0) {
      if (playerIndex === state.landlord) {
        state.winner = -2; // landlord wins (farmers lose)
      } else {
        state.winner = -3; // farmers win (landlord loses)
      }
      state.board = syncBoard(state);
      return null;
    }

    state.currentPlayer = (state.currentPlayer + 1) % state._playerCount;
    state.board = syncBoard(state);
    return null;
  }

  return '未知阶段';
};
