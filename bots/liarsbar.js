const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'liarsbar';

// Deck: 3 ranks x 8 copies, 4 wild, 1 ghost = 29 cards. Valid = theme rank or wild.
const DECK_SIZE = 29;
const TOTAL_VALID_BASE = 8 + 4;

function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
// P(exactly j valid in a hand of h drawn from pop with V valid)
function hyper(pop, V, h, j) {
  if (h > pop) h = pop;
  const d = choose(pop, h);
  return d === 0 ? 0 : (choose(V, j) * choose(pop - V, h - j)) / d;
}

// Probability that the last claim was a lie, from the bot's point of view.
// Opponents are modelled as honest-first: they claim exactly the valid cards they hold (up to 3) and
// bluff with a single card only when they hold none.
function lieProbability(state, me, myValid) {
  const claim = state.lastPlayedCards || [];
  const k = Math.max(1, claim.length);
  const claimantLeft = ((state.hands || [])[state.lastClaimant] || []).length;
  const earlier = Math.max(0, (state.pileCards || []).length - k);
  const myHand = (state.hands[me] || []).length;
  const pop = Math.max(1, DECK_SIZE - myHand - earlier);
  // earlier pile cards were mostly honest plays: they used up valid cards
  const V = Math.max(0, Math.min(pop, TOTAL_VALID_BASE - myValid - Math.round(earlier * 0.75)));
  const h0 = claimantLeft + k;
  if (k === 1) {
    const p0 = hyper(pop, V, h0, 0), p1 = hyper(pop, V, h0, 1);
    return p0 + p1 === 0 ? 0.3 : p0 / (p0 + p1);
  }
  if (k === 2) return 0.12 + 0.5 * hyper(pop, V, h0, 0);
  return 0.18;
}

// Chance that the next trigger pull kills: bullet is uniform over the 6 chambers not yet fired.
function deathRisk(state, i) {
  const fired = (state.firedShots || [])[i] || 0;
  return fired >= 5 ? 1 : 1 / (6 - fired);
}

function shouldSuspect(state, me, hand, myValid, diff) {
  if (state.lastClaimant < 0 || state.lastClaimant === me || state.phase !== 'playing') return false;
  const claimant = state.lastClaimant;
  const k = (state.lastPlayedCards || []).length;
  if (diff === 'easy') return Math.random() < 0.35; // paranoid beginner: calls a lot, whatever the odds

  // Holding more than the number of valid cards that can possibly be left makes the claim impossible.
  const validLeft = TOTAL_VALID_BASE - myValid;
  if (k > validLeft) return true;

  let p = lieProbability(state, me, myValid);
  const riskMe = deathRisk(state, me);
  const riskC = deathRisk(state, claimant);
  if (diff === 'normal') {
    p = Math.min(1, Math.max(0, p + (Math.random() - 0.5) * 0.35));
    return p * riskC * 4 > (1 - p) * riskMe;
  }
  // hard: expected-value comparison with the real shot risks (bullet uniform over unfired chambers).
  // Calling is rewarded 3x: killing a rival is worth more than the shot it costs to be wrong.
  const gain = p * riskC * 3;
  const loss = (1 - p) * riskMe;
  // a hand with no valid cards will have to bluff next turn: slight pull towards calling now
  const forced = myValid === 0 ? 0.03 : 0;
  return gain + forced > loss;
}

exports.createBot = function (playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function (state) {
      const hand = state.hands[playerIndex] || [];

      if (state.phase === 'shooting' && state.currentShooter === playerIndex) {
        return { action: 'shoot' };
      }

      // No cards left: the only legal move is to call the bluff
      if (hand.length === 0) return { action: 'suspect' };

      const diff = getDifficulty(state);
      const themeRank = state.themeRank;
      const exactThemeCards = hand.filter((card) => card.rank === themeRank);
      const wildCards = hand.filter((card) => card.suit === 'wild');
      const ghostCard = hand.find((card) => card.suit === 'ghost');
      const myValid = exactThemeCards.length + wildCards.length;

      if (shouldSuspect(state, playerIndex, hand, myValid, diff)) {
        return { action: 'suspect' };
      }

      if (diff === 'easy') {
        // naive: random 1-2 cards, whatever they are
        const n = Math.min(hand.length, Math.random() < 0.3 ? 2 : 1);
        const pool = hand.slice().sort(() => Math.random() - 0.5);
        return { action: 'play', cardIds: pool.slice(0, n).map((c) => c.id) };
      }

      const honest = exactThemeCards.length > 0 ? exactThemeCards : wildCards; // keep wilds for later
      if (honest.length > 0) {
        const count = Math.min(honest.length, 3);
        return { action: 'play', cardIds: honest.slice(0, count).map((c) => c.id) };
      }

      // Must bluff. The ghost is the safest bluff: if called, everybody else shoots.
      if (ghostCard && (diff === 'hard' || hand.length <= 2)) {
        return { action: 'play', cardIds: [ghostCard.id] };
      }

      const lieCards = hand.filter((card) => card.suit !== 'ghost');
      if (lieCards.length > 0) {
        return { action: 'play', cardIds: [chooseLeastCriticalCard(lieCards, hand).id] };
      }
      return { action: 'play', cardIds: [hand[0].id] };
    }
  };
};

function chooseLeastCriticalCard(candidates, fullHand) {
  let best = candidates[0];
  let bestScore = Infinity;
  for (const card of candidates) {
    const score = futureValue(card, fullHand);
    if (score < bestScore) { bestScore = score; best = card; }
  }
  return best;
}

function futureValue(card, hand) {
  let value = 0;
  for (const other of hand) {
    if (other.id === card.id) continue;
    if (other.suit === card.suit && other.rank === card.rank) value += 2;
    if (other.rank === card.rank) value += 3;
    if (other.suit === 'wild') value += 1;
  }
  return value;
}
