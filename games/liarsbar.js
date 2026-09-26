// games/liarsbar.js
// 骗子酒馆 — Liar's Bar with Russian Roulette
// Deck: J/Q/K (multi-suit) + wild cards + 1 ghost
// Russian roulette: each player has a fixed bullet chamber (1-6), hidden from all.
// Click fire → server rolls 1/6 vs the bullet. Only reveal dead/alive, NOT bullet position.

const SUITS = ['s','h','c','d'];
const RANKS = ['J','Q','K'];
const SUIT_SYMBOL = { s: '♠', h: '♥', c: '♣', d: '♦' };
const { pick } = require('./lib/i18n');

exports.name = 'liarsbar';
exports.maxPlayers = 6;

function createDeck() {
  const deck = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const r of RANKS) {
      for (const s of SUITS) {
        deck.push({ rank: r, suit: s, id: r + s + '-' + copy });
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ rank: '★', suit: 'wild', id: 'wild-' + i });
  }
  deck.push({ rank: '👻', suit: 'ghost', id: 'ghost' });
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function nextAlive(state, fromIndex) {
  const n = state.alive.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (state.alive[idx]) return idx;
  }
  return fromIndex;
}

// Next player to act after `fromIndex` plays: players with empty hands are skipped.
// If nobody else holds cards any more, the next living player must call the bluff.
function nextTurn(state, fromIndex) {
  const n = state.alive.length;
  for (let i = 1; i < n; i++) {
    const idx = (fromIndex + i) % n;
    if (state.alive[idx] && (state.hands[idx] || []).length > 0) return idx;
  }
  return nextAlive(state, fromIndex);
}

function startNewRound(state) {
  const playerCount = state.alive.length;
  const deck = createDeck();
  shuffle(deck);

  state.hands = [];
  for (let i = 0; i < playerCount; i++) {
    if (state.alive[i]) {
      state.hands.push(deck.splice(0, Math.min(5, deck.length)));
    } else {
      state.hands.push([]);
    }
  }

  state.themeRank = RANKS[Math.floor(Math.random() * RANKS.length)];
  state.pileCards = [];
  state.pileClaims = [];
  state.lastClaimant = -1;
  state.lastPlayedCards = [];
  state.phase = 'playing';

  state.currentPlayer = nextAlive(state, state.roundStarter || 0);
  state.roundStarter = state.currentPlayer;
}

exports.createState = () => {
  return {
    hands: [],
    currentPlayer: 0,
    themeRank: 'J',
    pileCards: [],
    pileClaims: [],
    lastClaimant: -1,
    lastPlayedCards: [],   // cards played in the last turn (for challenge checking)
    alive: [],
    firedShots: [],          // [per player] how many times they've fired (0-6)
    roundStarter: 0,
    roundMessage: '',
    phase: 'playing',
    winner: null,
    revealedPile: null,
    shootQueue: [],
    currentShooter: -1,
    lastShotResults: [],     // [{player, dead, firedCount}] — only dead/alive and shot #
  };
};

exports.initGame = (state, playerCount) => {
  state.alive = new Array(playerCount).fill(true);
  // hidden: bullet chamber per player (1-6) — NEVER sent to client
  state._bulletChamber = [];
  state.firedShots = [];
  for (let i = 0; i < playerCount; i++) {
    state._bulletChamber.push(Math.floor(Math.random() * 6) + 1);
    state.firedShots.push(0);
  }
  state.roundStarter = Math.floor(Math.random() * playerCount);
  state.winner = null;
  state.shootQueue = [];
  state.currentShooter = -1;
  state.lastShotResults = [];
  startNewRound(state);
};

// Fire: currentShooter pulls trigger. Server compares fired count vs hidden bullet.
function fire(state, playerIndex) {
  state.firedShots[playerIndex]++;
  const count = state.firedShots[playerIndex];
  const bullet = state._bulletChamber[playerIndex];
  const dead = count === bullet;

  if (dead) {
    state.alive[playerIndex] = false;
  }

  return { player: playerIndex, dead, firedCount: count };
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return 'g_game_over';
  if (!state.alive[playerIndex]) return 'lb_you_are_out';

  const { action, cardId } = data;

  // --- Shooting: one click → one trigger pull ---
  if (action === 'shoot') {
    if (state.currentShooter !== playerIndex) return 'lb_not_your_shot';

    const result = fire(state, playerIndex);

    if (!state.lastShotResults) state.lastShotResults = [];
    state.lastShotResults.push(result);

    // Remove this player from queue
    state.shootQueue = state.shootQueue.filter(i => i !== playerIndex);

    if (state.shootQueue.length > 0) {
      state.currentShooter = state.shootQueue[0];
      state.roundMessage = pick(state, result.dead ? '下一个...' : '下一个开枪的人...', result.dead ? 'Next...' : 'Next shooter...');
      return null;
    }

    // All done shooting
    state.currentShooter = -1;
    state.shootQueue = [];

    const aliveNow = [];
    for (let i = 0; i < state.alive.length; i++) {
      if (state.alive[i]) aliveNow.push(i);
    }
    if (aliveNow.length <= 1) {
      state.winner = aliveNow[0] !== undefined ? aliveNow[0] : -1;
      state.phase = 'round_end';
      return null;
    }

    state.roundStarter = nextAlive(state, state.lastClaimant);
    startNewRound(state);
    return null;
  }

  // --- Normal gameplay ---
  if (state.phase === 'shooting') return 'lb_shooting_in_progress';
  if (state.phase !== 'playing') return 'lb_wrong_phase';
  if (playerIndex !== state.currentPlayer) return 'g_not_your_turn';

  if (action === 'play') {
    const cardIds = data.cardIds;
    if (!Array.isArray(cardIds) || cardIds.length === 0) return 'lb_select_a_card';
    if (cardIds.length > 3) return 'lb_max_three_cards';

    const hand = state.hands[playerIndex];
    if (!hand || hand.length === 0) return 'lb_no_hand';

    const played = [];
    for (const id of cardIds) {
      const idx = hand.findIndex(c => c.id === id);
      if (idx === -1) return 'lb_card_not_in_hand';
      played.push(hand.splice(idx, 1)[0]);
    }

    for (const card of played) state.pileCards.push(card);
    state.lastPlayedCards = played.map(c => ({ ...c }));
    state.pileClaims.push({ playerIndex, cardIds: played.map(c => c.id), claimedRank: state.themeRank });
    state.lastClaimant = playerIndex;
    state.roundMessage = '';
    state.revealedPile = null;
    state.lastShotResults = [];

    state.currentPlayer = nextTurn(state, playerIndex);
    return null;
  }

  if (action === 'suspect') {
    if (state.lastClaimant < 0) return 'lb_nothing_to_challenge';
    if (state.lastClaimant === playerIndex) return 'lb_cannot_challenge_self';

    const played = state.lastPlayedCards || [];
    const claimedRank = state.themeRank;

    state.revealedPile = state.pileCards.map(c => ({ ...c }));
    state.lastShotResults = [];

    let shooterIndices = [];
    let msg = '';

    // Check all cards played in the last turn
    const hasGhost = played.some(c => c.suit === 'ghost');
    const hasLie = played.some(c => c.suit !== 'wild' && c.suit !== 'ghost' && c.rank !== claimedRank);

    if (hasGhost) {
      for (let i = 0; i < state.alive.length; i++) {
        if (state.alive[i] && i !== state.lastClaimant) shooterIndices.push(i);
      }
      msg = pick(state, '是鬼牌👻！除了出牌者，所有人都要开一枪', '👻 Ghost card! Everyone except the player takes a shot');
    } else if (!hasLie) {
      // All cards match the claim (wild counts as any rank)
      shooterIndices.push(playerIndex);
      msg = pick(state, '质疑失败！出的都是 ' + claimedRank + '（含万能牌）', 'Challenge failed! They were all ' + claimedRank + ' (or wild)');
    } else {
      // At least one card is a lie
      shooterIndices.push(state.lastClaimant);
      const lieCard = played.find(c => c.suit !== 'wild' && c.suit !== 'ghost' && c.rank !== claimedRank);
      const sym = SUIT_SYMBOL[lieCard.suit] || '';
      msg = pick(state, '质疑成功！出的是 ' + sym + lieCard.rank + '，不是 ' + claimedRank, 'Challenge successful! They played ' + sym + lieCard.rank + ', not ' + claimedRank);
    }

    state.roundMessage = msg;
    state.shootQueue = shooterIndices;
    state.phase = 'shooting';
    state.currentShooter = shooterIndices[0];

    return null;
  }

  return 'g_invalid_action';
};

exports.SUIT_SYMBOL = SUIT_SYMBOL;

exports.getCurrentActor = (state) => {
  return state.phase === 'shooting' && Number.isInteger(state.currentShooter) && state.currentShooter >= 0
    ? state.currentShooter
    : state.currentPlayer;
};

exports.setCurrentActor = (state, index) => {
  if (state.phase === 'shooting' && Number.isInteger(state.currentShooter) && state.currentShooter >= 0) {
    state.currentShooter = index;
  } else {
    state.currentPlayer = index;
  }
};

// Hide other players' cards (and draw piles) from each client.
const { maskView } = require('./lib/hidden');
exports.playerView = function (state, playerIndex) {
  return maskView(state, playerIndex, { piles: ['pileCards', 'lastPlayedCards'] });
};
