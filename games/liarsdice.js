// Liar's Dice (大话骰 / 吹牛骰) — 2-6 players

const FACE_ORDER = [2, 3, 4, 5, 6, 1];
const START_DICE_CHOICES = [3, 4, 5];
const TURN_TIME_CHOICES = [0, 15, 20, 30];
const REVEAL_MS = 5000;

function readOptions(opts) {
  const o = opts || {};
  const sd = Number(o.startDice);
  const startDice = START_DICE_CHOICES.includes(sd) ? sd : 5;
  const onesWild = o.onesWild !== false && o.onesWild !== 'false';
  const tt = o.turnTime === undefined ? 20 : Number(o.turnTime);
  const turnTime = TURN_TIME_CHOICES.includes(tt) ? tt : 20;
  return { startDice, onesWild, turnTime };
}

function faceRank(face) {
  return face === 1 ? 7 : face;
}

function isLegalRaise(qty, face, currentBid) {
  if (!Number.isInteger(qty) || qty < 1) return false;
  if (!Number.isInteger(face) || face < 1 || face > 6) return false;
  if (!currentBid) return true;
  if (qty > currentBid.qty) return true;
  if (qty === currentBid.qty && faceRank(face) > faceRank(currentBid.face)) return true;
  return false;
}

function minimalRaise(currentBid) {
  if (!currentBid) return { type: 'bid', qty: 1, face: 2 };
  const idx = FACE_ORDER.indexOf(currentBid.face);
  if (idx >= 0 && idx < FACE_ORDER.length - 1) {
    return { type: 'bid', qty: currentBid.qty, face: FACE_ORDER[idx + 1] };
  }
  return { type: 'bid', qty: currentBid.qty + 1, face: 2 };
}

function rollDice(count) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push(1 + Math.floor(Math.random() * 6));
  }
  return arr;
}

function nextAlive(diceCounts, from) {
  const n = diceCounts.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n;
    if (diceCounts[idx] > 0) return idx;
  }
  return from;
}

function countMatchingDice(allDice, face, onesWildNow) {
  let count = 0;
  const wild = Boolean(onesWildNow && face !== 1);
  for (const hand of allDice) {
    if (!Array.isArray(hand)) continue;
    for (const d of hand) {
      if (d === face || (wild && d === 1)) count++;
    }
  }
  return count;
}

function binomAtLeast(n, p, k) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let prob = 0;
  let comb = 1;
  for (let i = 0; i <= n; i++) {
    if (i >= k) {
      prob += comb * Math.pow(p, i) * Math.pow(1 - p, n - i);
    }
    comb = (comb * (n - i)) / (i + 1);
  }
  return prob;
}

function setTurnTimer(state) {
  state.phaseDeadline = state.turnTime > 0 ? Date.now() + state.turnTime * 1000 : 0;
}

function startRound(state, starter) {
  state.round += 1;
  state.onesWildNow = state.onesWild;
  state.currentBid = null;
  state.bidHistory = [];
  state.lastReveal = null;
  state.dice = state.diceCounts.map((c) => rollDice(c));
  state.phase = 'playing';
  state.roundStarter = starter;
  state.currentPlayer = starter;
  setTurnTimer(state);
}

function createState() {
  return {
    phase: 'waiting',
    dice: [],
    diceCounts: [],
    startDice: 5,
    onesWild: true,
    onesWildNow: true,
    turnTime: 20,
    round: 0,
    roundStarter: 0,
    nextStarter: 0,
    currentPlayer: 0,
    currentBid: null,
    bidHistory: [],
    lastReveal: null,
    phaseDeadline: 0,
    winner: null,
  };
}

function initGame(state, playerCount) {
  const opts = readOptions(state._options);
  state.startDice = opts.startDice;
  state.onesWild = opts.onesWild;
  state.turnTime = opts.turnTime;
  state.diceCounts = new Array(playerCount).fill(opts.startDice);
  state.round = 0;
  state.winner = null;
  const starter = Math.floor(Math.random() * playerCount);
  startRound(state, starter);
}

function handleMove(move, state, playerIndex) {
  if (!move || typeof move !== 'object') return 'ld_invalid_action';
  const n = state.diceCounts.length;
  if (playerIndex < 0 || playerIndex >= n) return 'ld_invalid_action';

  if (move.type === 'next') {
    if (state.phase !== 'reveal') return 'ld_wrong_phase';
    startRound(state, state.nextStarter);
    return null;
  }

  if (state.phase !== 'playing') {
    return state.phase === 'reveal' ? 'ld_reveal_wait' : 'ld_wrong_phase';
  }
  if (playerIndex !== state.currentPlayer) return 'not_your_turn';
  if (state.diceCounts[playerIndex] <= 0) return 'ld_player_out';

  if (move.type === 'bid') {
    const qty = Number(move.qty);
    const face = Number(move.face);
    if (!Number.isInteger(qty) || qty < 1 || !Number.isInteger(face) || face < 1 || face > 6) {
      return 'ld_invalid_bid';
    }
    if (!isLegalRaise(qty, face, state.currentBid)) {
      return 'ld_bid_too_low';
    }
    if (face === 1) state.onesWildNow = false;
    const bid = { qty, face, player: playerIndex };
    state.currentBid = bid;
    state.bidHistory.push(bid);
    state.currentPlayer = nextAlive(state.diceCounts, playerIndex);
    setTurnTimer(state);
    return null;
  }

  if (move.type === 'challenge') {
    if (!state.currentBid) return 'ld_nothing_to_challenge';
    const bid = state.currentBid;
    const revealDice = state.dice.map((d) => d.slice());
    const count = countMatchingDice(revealDice, bid.face, state.onesWildNow);
    const loser = count >= bid.qty ? playerIndex : bid.player;

    state.lastReveal = {
      dice: revealDice,
      bid: { qty: bid.qty, face: bid.face, player: bid.player },
      bidder: bid.player,
      challenger: playerIndex,
      count,
      loser,
    };

    if (state.dice[loser] && state.dice[loser].length > 0) {
      state.dice[loser].pop();
    }
    state.diceCounts[loser] = state.dice[loser] ? state.dice[loser].length : 0;

    let aliveCount = 0;
    let lastAlive = 0;
    for (let i = 0; i < n; i++) {
      if (state.diceCounts[i] > 0) {
        aliveCount++;
        lastAlive = i;
      }
    }

    if (aliveCount <= 1) {
      state.winner = lastAlive;
      state.phase = 'ended';
      state.currentPlayer = -1;
      state.phaseDeadline = 0;
    } else {
      state.phase = 'reveal';
      state.nextStarter = state.diceCounts[loser] > 0 ? loser : nextAlive(state.diceCounts, loser);
      state.currentPlayer = -1;
      state.phaseDeadline = Date.now() + REVEAL_MS;
    }
    return null;
  }

  return 'ld_invalid_action';
}

function getCurrentActor(state) {
  if (state.phase === 'playing') return state.currentPlayer;
  return -1;
}

function setCurrentActor(state, idx) {
  state.currentPlayer = idx;
}

function getPhaseDeadline(state) {
  if (state.phase === 'ended' || state.phase === 'waiting') return 0;
  if (state.phase === 'playing' && state.turnTime === 0) return 0;
  return state.phaseDeadline || 0;
}

function onTimeout(state) {
  if (state.phase === 'reveal') {
    startRound(state, state.nextStarter);
    return true;
  }
  if (state.phase === 'playing') {
    const cp = state.currentPlayer;
    if (!state.currentBid) {
      return !handleMove({ type: 'bid', qty: 1, face: 2 }, state, cp);
    }
    const bid = state.currentBid;
    const totalDice = state.diceCounts.reduce((sum, c) => sum + c, 0);
    const p = (state.onesWildNow && bid.face !== 1) ? 1 / 3 : 1 / 6;
    if (binomAtLeast(totalDice, p, bid.qty) < 0.25) {
      return !handleMove({ type: 'challenge' }, state, cp);
    }
    return !handleMove(minimalRaise(bid), state, cp);
  }
  return false;
}

function botFallback(state) {
  if (state.phase === 'reveal') return { type: 'next' };
  if (!state.currentBid) return { type: 'bid', qty: 1, face: 2 };
  const totalDice = state.diceCounts.reduce((sum, c) => sum + c, 0);
  if (state.currentBid.qty >= totalDice) return { type: 'challenge' };
  return minimalRaise(state.currentBid);
}

function playerView(state, playerIndex) {
  if (!state || !Array.isArray(state.dice)) return state;
  const turnMsLeft = state.phaseDeadline && state.phaseDeadline > 0
    ? Math.max(0, state.phaseDeadline - Date.now())
    : 0;

  if (state.winner !== null && state.winner !== undefined) {
    return Object.assign({}, state, { turnMsLeft });
  }

  const maskedDice = state.dice.map((hand, idx) => {
    if (!Array.isArray(hand)) return [];
    if (idx === playerIndex) return hand.slice();
    return new Array(hand.length).fill(null);
  });

  const lastReveal = state.phase === 'reveal' && state.lastReveal
    ? {
        dice: state.lastReveal.dice.map((d) => d.slice()),
        bid: Object.assign({}, state.lastReveal.bid),
        bidder: state.lastReveal.bidder,
        challenger: state.lastReveal.challenger,
        count: state.lastReveal.count,
        loser: state.lastReveal.loser,
      }
    : null;

  return Object.assign({}, state, {
    dice: maskedDice,
    lastReveal,
    turnMsLeft,
  });
}

module.exports = {
  name: 'liarsdice',
  minPlayers: 2,
  maxPlayers: 6,
  createState,
  initGame,
  handleMove,
  playerView,
  getCurrentActor,
  setCurrentActor,
  getPhaseDeadline,
  onTimeout,
  botFallback,
  FACE_ORDER,
  faceRank,
  isLegalRaise,
  minimalRaise,
  countMatchingDice,
};
