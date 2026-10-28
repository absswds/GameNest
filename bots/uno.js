const { botName } = require('./lib/bot-name');
const { pickFor } = require('./lib/difficulty');

exports.name = 'uno';

const COLORS = ['red', 'blue', 'green', 'yellow'];

// Provisional values; will be set by scripts/bot-tier-eval.js --calibrate
const PICK = { temp: { easy: 40, normal: 12 }, maxLoss: { easy: 150, normal: 45 } };

// Remember which colours each opponent could not match (they had to draw) -- public info only.
function createMemory() {
  return { prevHands: null, prevColor: null, prevTop: null, prevDiscard: 0, lacks: {} };
}

function observe(mem, state) {
  const hands = (state.hands || []).map((h) => (h ? h.length : 0));
  const dl = (state.discard || []).length;
  const top = state.discard && state.discard[0];
  const total = hands.reduce((a, b) => a + b, 0);
  const prevTotal = mem.prevHands ? mem.prevHands.reduce((a, b) => a + b, 0) : -1;
  if (!mem.prevHands || mem.prevHands.length !== hands.length || dl < mem.prevDiscard - 1 && total > prevTotal + 3) {
    mem.lacks = {};
  } else {
    for (let p = 0; p < hands.length; p++) {
      if (hands[p] === mem.prevHands[p] + 1 && !(state.drawStack > 0) && mem.prevColor) {
        // drew exactly one card on a normal turn: had no card of the live colour
        (mem.lacks[p] = mem.lacks[p] || new Set()).add(mem.prevColor);
      }
      if (hands[p] < mem.prevHands[p] && top && top.color !== 'wild' && mem.lacks[p]) {
        mem.lacks[p].delete(top.color);
      }
      if (hands[p] < mem.prevHands[p] && top && top.color === 'wild' && mem.lacks[p]) {
        mem.lacks[p].clear();
      }
    }
  }
  mem.prevHands = hands;
  mem.prevColor = state.currentColor;
  mem.prevTop = top;
  mem.prevDiscard = dl;
}

exports.createBot = (playerIndex) => {
  const mem = createMemory();
  return {
    name: botName(playerIndex, 'zh'),
    getMove(state) {
      observe(mem, state);

      // Answer a pending +4 using public info only (the +4 player's hand is hidden).
      if (state.pendingChallenge) {
        const ch = state.pendingChallenge;
        const byHandSize = (state.hands && state.hands[ch.by] && state.hands[ch.by].length) || 0;
        const byLacks = mem.lacks[ch.by] && mem.lacks[ch.by].has(ch.priorColor);
        const seen = countSeen(state, (state.hands && state.hands[playerIndex]) || []);
        const unseenPrior = 25 - (seen[ch.priorColor] || 0);
        const challengeScore = byLacks ? -40 : (byHandSize * 4 + unseenPrior - 22);
        return pickFor(state, [
          { move: { challengeResponse: 'accept' }, score: 0 },
          { move: { challengeResponse: 'challenge' }, score: challengeScore },
        ], PICK);
      }

      const hand = state.hands[playerIndex];
      if (!hand || hand.length === 0) return {};

      if (hand.length === 1 && (!state.unoCalled || !state.unoCalled[playerIndex])) {
        return { uno: true };
      }

      const nextIndex = getNextPlayerIndex(state);
      const nextHand = (state.hands && state.hands[nextIndex]) || [];
      const nextHandSize = nextHand.length;
      const nextLacks = mem.lacks[nextIndex];

      if (state.drawStack > 0) {
        const stackable = hand.filter((card) => card.value === '+2' || card.value === '+4');
        if (stackable.length === 0) return {};
        const cands = [{ move: {}, score: -120 }];
        for (const card of stackable) {
          const remaining = countColors(hand, card);
          if (card.color === 'wild') {
            const [color, cVal] = bestColor(remaining, nextLacks);
            // keep the +4 while a +2 can answer the penalty
            const spare = stackable.some((c) => c.color !== 'wild') ? 70 : 0;
            cands.push({
              move: { cardId: card.id, chosenColor: color },
              score: 20 + cVal * 18 - spare,
            });
          } else {
            cands.push({
              move: { cardId: card.id },
              score: 40 + (remaining[card.color] || 0) * 18,
            });
          }
        }
        cands.sort((a, b) => b.score - a.score);
        return pickFor(state, cands, PICK);
      }

      const playable = hand.filter((card) => canPlay(card, state));
      if (playable.length === 0) return {};
      if (playable.length === 1 && playable[0].color !== 'wild') {
        return { cardId: playable[0].id };
      }

      const top = state.discard && state.discard[0];
      const seenColors = countSeen(state, hand);
      const cands = [];

      for (const card of playable) {
        let score = scoreCard(card, hand, top, nextHandSize, state);
        if (nextHandSize <= 2) {
          // High urgency to stop next player
          if (card.value === 'skip' || card.value === 'reverse') score += 50;
          if (card.value === '+2' || card.color === 'wild') score += 80;
        }
        // colour the next player already failed to match: they will probably have to draw
        if (card.color !== 'wild' && nextLacks && nextLacks.has(card.color)) score += 22;
        // dump colours that are nearly exhausted elsewhere (hard to get back into), keep long ones
        if (card.color !== 'wild' && seenColors) score += (seenColors[card.color] || 0) * 0.6;
        if (hand.length > 4 && card.color === 'wild') score -= 20;

        if (card.color === 'wild') {
          const [color, cVal] = bestColor(countColors(hand, card), nextLacks);
          // a wild is not spent while an ordinary card works (unless the next player has one card left)
          const spare = nextHandSize > 1 && playable.some((c) => c.color !== 'wild') ? 120 : 0;
          cands.push({
            move: { cardId: card.id, chosenColor: color },
            score: score + cVal * 18 - spare,
          });
        } else {
          cands.push({ move: { cardId: card.id }, score });
        }
      }

      cands.sort((a, b) => b.score - a.score);
      return pickFor(state, cands, PICK);
    },
  };
};

// Wild colour is not a difficulty knob: most held colour, nextLacks bonus as tiebreak.
function bestColor(remaining, nextLacks) {
  let best = COLORS[0];
  let bestVal = -Infinity;
  for (const color of COLORS) {
    const v = (remaining[color] || 0) + (nextLacks && nextLacks.has(color) ? 1.5 : 0);
    if (v > bestVal) { best = color; bestVal = v; }
  }
  return [best, bestVal];
}

// number of cards of each colour already visible in the discard pile and own hand
function countSeen(state, hand) {
  const seen = { red: 0, blue: 0, green: 0, yellow: 0 };
  for (const c of state.discard || []) if (seen[c.color] !== undefined) seen[c.color] += 1;
  for (const c of hand) if (seen[c.color] !== undefined) seen[c.color] += 1;
  return seen;
}

function canPlay(card, state) {
  const top = state.discard && state.discard[0];
  if (!card) return false;
  if (card.color === 'wild') return true;
  if (!top) return true;
  return card.value === top.value || card.color === state.currentColor;
}

function getNextPlayerIndex(state) {
  const hands = state.hands || [];
  if (!hands.length) return 0;
  const direction = state.direction || 1;
  return ((state.currentPlayer + direction) % hands.length + hands.length) % hands.length;
}

function countColors(hand, excludeCard) {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  for (const card of hand) {
    if (excludeCard && card.id === excludeCard.id) continue;
    if (counts[card.color] !== undefined) counts[card.color] += 1;
  }
  return counts;
}

function scoreCard(card, hand, top, nextHandSize, state) {
  const remainingColors = countColors(hand, card);
  const dominantColorCount = card.color === 'wild'
    ? 0
    : (remainingColors[card.color] || 0);

  let score = 0;

  if (hand.length === 1) score += 1000;
  if (hand.length === 2) score += 160;

  score += dominantColorCount * 18;

  if (card.color !== 'wild' && top && card.value === top.value) score += 8;
  if (card.color !== 'wild' && top && card.color === top.color) score += 10;

  if (card.value === 'skip' || card.value === 'reverse') score += 18;
  if (card.value === '+2') score += 24;
  if (card.value === '+4') score += 10;

  if (nextHandSize <= 2) {
    if (card.value === 'skip' || card.value === 'reverse') score += 55;
    if (card.value === '+2') score += 50;
    if (card.value === '+4') score += 35;
  }

  if (card.color === 'wild') score -= 36;
  if (card.value === '+4' && hand.some((candidate) => candidate.id !== card.id && candidate.color !== 'wild' && canPlay(candidate, { discard: [top], currentColor: state.currentColor }))) {
    score -= 28;
  }

  return score;
}
