// games/paodekuai.js
// 跑得快 (Run Fast) — 3-player 16-card climbing game. First to empty the hand wins the round;
// losers pay one point per card left (double when they never played), bombs pay 10 on the spot.

const P = require('../public/js/paodekuai-patterns');
const { maskView } = require('./lib/hidden');

exports.name = 'paodekuai';
exports.minPlayers = 2;
exports.maxPlayers = 3;

const HAND_SIZE = 16;
const BOMB_BONUS = 10;
const ROUND_CHOICES = [1, 3, 5, 8];
const TIME_CHOICES = [0, 15, 20, 30];
const DEFAULT_ROUNDS = 3;
const DEFAULT_TIME = 20;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}

function zeros(n) {
  return new Array(n).fill(0);
}

function copyCard(c) {
  return { rank: c.rank, suit: c.suit, id: c.id };
}

exports.createState = function () {
  return {
    phase: 'waiting',          // waiting | playing | roundEnd | matchEnd
    hands: [],
    currentPlayer: 0,
    lastPlay: null,            // { player, cards, play }
    lastPlayPlayer: -1,
    passed: [],
    played: [],                // who has played a card this round (spring check)
    bombs: [],                 // bombs played this round, per seat
    oneCard: [],               // seats with exactly one card left
    firstCard: null,           // card id the very first play of the match must contain
    winner: null,              // set when the whole match is over (-1 = tie)
    lastRoundWinner: -1,
    mustBeat: true,
    turnTime: DEFAULT_TIME,
    currentTurnDeadline: null,
    totalRounds: DEFAULT_ROUNDS,
    currentRound: 1,
    cumulativeScore: [],
    roundScores: [],           // this round's score changes (bombs live, cards at the end)
    roundResult: null,         // set while phase is roundEnd: revealed hands + settlement
    roundHistory: [],
  };
};

function readOptions(state) {
  const o = state._options || {};
  state.totalRounds = ROUND_CHOICES.indexOf(o.rounds) >= 0 ? o.rounds : DEFAULT_ROUNDS;
  state.mustBeat = o.mustBeat !== false;
  state.turnTime = TIME_CHOICES.indexOf(o.turnTime) >= 0 ? o.turnTime : DEFAULT_TIME;
}

function setTurnTimer(state) {
  state.currentTurnDeadline = state.turnTime > 0 && state.phase === 'playing'
    ? Date.now() + state.turnTime * 1000
    : null;
}

function refresh(state) {
  state.oneCard = state.hands.map(function (h) { return Array.isArray(h) && h.length === 1; });
}

function startRound(state, first) {
  const n = state.hands.length;
  const deck = P.createDeck();
  shuffle(deck);
  const hands = [];
  for (let i = 0; i < n; i++) hands.push(P.sortCards(deck.splice(0, HAND_SIZE)));
  state.hands = hands;
  state.lastPlay = null;
  state.lastPlayPlayer = -1;
  state.passed = new Array(n).fill(false);
  state.played = new Array(n).fill(false);
  state.bombs = zeros(n);
  state.roundScores = zeros(n);
  state.roundResult = null;
  state.phase = 'playing';
  state.firstCard = null;

  let leader = 0;
  if (first) {
    leader = -1;
    for (let i = 0; i < n; i++) {
      if (hands[i].some(function (c) { return c.id === '3s'; })) leader = i;
    }
    if (leader >= 0) {
      state.firstCard = '3s';
    } else {
      // Two players: the spade 3 was left out of the deal. The holder of the lowest card leads with it.
      let low = null;
      for (let i = 0; i < n; i++) {
        hands[i].forEach(function (c) {
          if (!low || P.cardKey(c) < P.cardKey(low)) { low = c; leader = i; }
        });
      }
      state.firstCard = low ? low.id : null;
    }
  } else {
    leader = state.lastRoundWinner >= 0 && state.lastRoundWinner < n ? state.lastRoundWinner : 0;
  }
  state.currentPlayer = leader;
  setTurnTimer(state);
  refresh(state);
}

exports.initGame = function (state, playerCount) {
  const n = Math.max(2, Math.min(3, parseInt(playerCount, 10) || 3));
  readOptions(state);
  state.hands = new Array(n).fill(null).map(function () { return []; });
  state.currentRound = 1;
  state.cumulativeScore = zeros(n);
  state.roundHistory = [];
  state.winner = null;
  state.lastRoundWinner = -1;
  startRound(state, true);
};

function isLeading(state, idx) {
  return !state.lastPlay || state.lastPlay.player === idx;
}

// Every play the seat may make right now (pattern, beating, opening card and single-card rules applied).
function legalPlays(state, idx) {
  const hand = state.hands[idx] || [];
  const n = state.hands.length;
  const next = state.hands[(idx + 1) % n];
  const table = isLeading(state, idx) ? null : state.lastPlay.play;
  return P.enumerate(hand, table, {
    mustInclude: !table && state.firstCard ? state.firstCard : null,
    nextOneCard: Array.isArray(next) && next.length === 1,
  });
}
exports.legalPlays = legalPlays;

// Move for the current seat when its turn timer runs out (also the server's bot fallback):
// pass when allowed, otherwise the smallest legal play.
exports.timeoutMove = function (state) {
  const cp = state.currentPlayer;
  const plays = legalPlays(state, cp);
  if (!plays.length) return { cards: [] };
  if (!isLeading(state, cp) && !state.mustBeat) return { cards: [] };
  if (!isLeading(state, cp)) {
    // must beat and a beating play exists
    return { cards: plays[0].cards.map(function (c) { return c.id; }) };
  }
  return { cards: plays[0].cards.map(function (c) { return c.id; }) };
};

function addScore(state, idx, pts) {
  state.roundScores[idx] += pts;
  state.cumulativeScore[idx] += pts;
}

function endRound(state, winner) {
  const n = state.hands.length;
  const spring = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (i === winner) continue;
    spring[i] = !state.played[i];
    const pts = state.hands[i].length * (spring[i] ? 2 : 1);
    addScore(state, i, -pts);
    addScore(state, winner, pts);
  }
  state.roundResult = {
    winner: winner,
    remaining: state.hands.map(function (h) { return h.map(copyCard); }),
    spring: spring,
    bombs: state.bombs.slice(),
    scores: state.roundScores.slice(),
  };
  state.roundHistory.push({
    round: state.currentRound,
    winner: winner,
    remaining: state.hands.map(function (h) { return h.length; }),
    spring: spring.slice(),
    bombs: state.bombs.slice(),
    scores: state.roundScores.slice(),
    totals: state.cumulativeScore.slice(),
  });
  state.lastRoundWinner = winner;
  state.currentPlayer = winner;
  state.currentTurnDeadline = null;
  if (state.currentRound >= state.totalRounds) {
    state.phase = 'matchEnd';
    let best = -Infinity;
    for (let i = 0; i < n; i++) if (state.cumulativeScore[i] > best) best = state.cumulativeScore[i];
    const top = [];
    for (let i = 0; i < n; i++) if (state.cumulativeScore[i] === best) top.push(i);
    state.winner = top.length === 1 ? top[0] : -1;
  } else {
    state.phase = 'roundEnd';
  }
  refresh(state);
}

exports.handleMove = function (data, state, playerIndex) {
  data = data || {};
  if (state.winner !== null && state.winner !== undefined) return 'g_game_over';

  if (state.phase === 'roundEnd') {
    if (data.action === 'next_round') {
      state.currentRound += 1;
      startRound(state, false);
      return null;
    }
    return 'pdk_click_next_round';
  }
  if (state.phase !== 'playing') return 'g_invalid_action';
  // A second player's late "next round" click, after the round has already started
  if (data.action === 'next_round') return null;
  if (playerIndex !== state.currentPlayer) return 'g_not_your_turn';

  let ids = data.cards;
  if (!Array.isArray(ids)) {
    // Server bot fallback ({pass:true} / {}): same as the turn-timeout move
    if (data.pass === true || Object.keys(data).length === 0) ids = exports.timeoutMove(state).cards;
    else return 'pdk_invalid_format';
  }

  const n = state.hands.length;
  const hand = state.hands[playerIndex];

  // ---- Pass ----
  if (ids.length === 0) {
    if (isLeading(state, playerIndex)) return 'pdk_must_lead';
    if (state.mustBeat && legalPlays(state, playerIndex).length > 0) return 'pdk_must_beat';
    state.passed[playerIndex] = true;
    state.currentPlayer = (playerIndex + 1) % n;
    if (state.currentPlayer === state.lastPlay.player) {
      // Everyone else passed: the last player to play leads a fresh trick
      state.lastPlay = null;
      state.lastPlayPlayer = -1;
      state.passed = new Array(n).fill(false);
    }
    setTurnTimer(state);
    return null;
  }

  // ---- Play ----
  if (ids.length > hand.length) return 'pdk_card_not_in_hand';
  const cards = [];
  const used = {};
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (typeof id !== 'string' || used[id]) return 'pdk_card_not_in_hand';
    const card = hand.find(function (c) { return c.id === id; });
    if (!card) return 'pdk_card_not_in_hand';
    used[id] = true;
    cards.push(card);
  }
  const play = P.detect(cards, cards.length === hand.length);
  if (!play) return 'pdk_invalid_play';
  const leading = isLeading(state, playerIndex);
  if (!leading && !P.canBeat(play, state.lastPlay.play)) return 'pdk_doesnt_beat';
  if (state.firstCard && !used[state.firstCard]) return 'pdk_first_must_have_s3';
  if (play.type === 'single') {
    const next = state.hands[(playerIndex + 1) % n];
    if (Array.isArray(next) && next.length === 1 && play.rank !== P.maxRankOf(hand)) {
      return 'pdk_must_play_highest_single';
    }
  }

  state.hands[playerIndex] = hand.filter(function (c) { return !used[c.id]; });
  state.lastPlay = { player: playerIndex, cards: P.sortCards(cards.map(copyCard)), play: play };
  state.lastPlayPlayer = playerIndex;
  state.passed = new Array(n).fill(false);
  state.played[playerIndex] = true;
  state.firstCard = null;

  if (play.type === 'bomb') {
    state.bombs[playerIndex] += 1;
    for (let i = 0; i < n; i++) {
      if (i === playerIndex) continue;
      addScore(state, i, -BOMB_BONUS);
      addScore(state, playerIndex, BOMB_BONUS);
    }
  }

  if (state.hands[playerIndex].length === 0) {
    endRound(state, playerIndex);
    return null;
  }
  state.currentPlayer = (playerIndex + 1) % n;
  setTurnTimer(state);
  refresh(state);
  return null;
};

// Turn timer (generic phase-timer hooks in server.js)
exports.getPhaseDeadline = function (state) {
  if (!state || state.phase !== 'playing' || state.winner !== null) return 0;
  if (!state.turnTime || state.turnTime <= 0) return 0;
  return state.currentTurnDeadline || 0;
};

exports.onTimeout = function (state) {
  return exports.handleMove(exports.timeoutMove(state), state, state.currentPlayer);
};

// Between rounds nobody is "on turn": bots must not click next round for the humans.
exports.getCurrentActor = function (state) {
  return state.phase === 'playing' ? state.currentPlayer : -1;
};

exports.setCurrentActor = function (state, idx) {
  state.currentPlayer = idx;
};

// Hide other players' cards; once the match is over everything is shown.
exports.playerView = function (state, playerIndex) {
  const view = Object.assign({}, maskView(state, playerIndex));
  // Remaining ms at send time: the client counts down from this instead of a full
  // turnTime, so rejoining mid-turn doesn't restart the countdown (and phone clocks don't matter).
  if (state && state.currentTurnDeadline) view.turnMsLeft = Math.max(0, state.currentTurnDeadline - Date.now());
  return view;
};

exports.detectType = P.detect;
exports.canBeat = P.canBeat;
exports.HAND_SIZE = HAND_SIZE;
exports.BOMB_BONUS = BOMB_BONUS;
