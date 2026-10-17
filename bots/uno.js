const { botName } = require('./lib/bot-name');

exports.name = 'uno';

const { getDifficulty } = require('./lib/difficulty');

const COLORS = ['red', 'blue', 'green', 'yellow'];

// hard tier: remember which colours each opponent could not match (they had to draw) -- public info only.
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
    const diff = getDifficulty(state);
    if (diff === 'hard') observe(mem, state);

    // Answer a pending +4. The +4 player's hand is hidden, so challenge now and then without peeking.
    if (state.pendingChallenge) {
      const chalProb = diff === 'hard' ? 0.5 : diff === 'easy' ? 0.15 : 0.25;
      return { challengeResponse: Math.random() < chalProb ? 'challenge' : 'accept' };
    }
    const hand = state.hands[playerIndex];
    if (!hand || hand.length === 0) return {};

    if (hand.length === 1 && (!state.unoCalled || !state.unoCalled[playerIndex])) {
      // In easy mode: 40% chance of forgetting to call UNO
      if (diff !== 'easy' || Math.random() >= 0.3) {
        return { uno: true };
      }
    }

    if (state.drawStack > 0) {
      const stackCard = chooseStackCard(hand);
      if (!stackCard) return {};
      return {
        cardId: stackCard.id,
        chosenColor: stackCard.color === 'wild' ? chooseColorAfterPlay(hand, stackCard, diff === 'hard' ? mem.lacks[getNextPlayerIndex(state)] : null) : undefined,
      };
    }

    const playable = hand.filter((card) => canPlay(card, state));
    if (playable.length === 0) return {};

    const nextIndex = getNextPlayerIndex(state);
    const nextHand = (state.hands && state.hands[nextIndex]) || [];
    const nextHandSize = nextHand.length;
    const top = state.discard && state.discard[0];

    const nextLacks = diff === 'hard' ? mem.lacks[nextIndex] : null;
    const seenColors = diff === 'hard' ? countSeen(state, hand) : null;

    let bestCard = playable[0];
    let bestScore = -Infinity;
    const scored = [];

    for (const card of playable) {
      // easy: does not look at the opponent's hand size
      let score = scoreCard(card, hand, top, diff === 'easy' ? 7 : nextHandSize, state);
      if (diff === 'hard') {
        if (nextHandSize <= 2) {
          // High urgency to stop next player
          if (card.value === 'skip' || card.value === 'reverse') score += 50;
          if (card.value === '+2' || card.color === 'wild') score += 80;
        }
        // colour the next player already failed to match: they will probably have to draw
        if (card.color !== 'wild' && nextLacks && nextLacks.has(card.color)) score += 22;
                // dump colours that are nearly exhausted elsewhere (hard to get back into), keep long ones
        if (card.color !== 'wild' && seenColors) score += (seenColors[card.color] || 0) * 0.6;
        // others are close to winning: shed points-like/dangerous cards less greedily is irrelevant, play fast
        if (hand.length > 4 && card.color === 'wild') score -= 20;
      }
      scored.push([card, score]);
      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
      }
    }

    if (diff === 'easy') bestCard = softPick(scored, 28, 70);

    return {
      cardId: bestCard.id,
      chosenColor: bestCard.color === 'wild'
        ? chooseColorAfterPlay(hand, bestCard, nextLacks)
        : undefined,
    };
  },
  };
};

// number of cards of each colour already visible in the discard pile (hard only)
function countSeen(state, hand) {
  const seen = { red: 0, blue: 0, green: 0, yellow: 0 };
  for (const c of state.discard || []) if (seen[c.color] !== undefined) seen[c.color] += 1;
  for (const c of hand) if (seen[c.color] !== undefined) seen[c.color] += 1;
  return seen;
}

// softmax pick over [item, score]; options scoring more than cap below the best are never chosen
function softPick(scored, temp, cap) {
  let best = -Infinity;
  for (const [, s] of scored) if (s > best) best = s;
  const pool = scored.filter(([, s]) => s >= best - cap);
  let total = 0;
  const w = pool.map(([, s]) => { const x = Math.exp((s - best) / temp); total += x; return x; });
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i][0]; }
  return pool[pool.length - 1][0];
}

function canPlay(card, state) {
  const top = state.discard && state.discard[0];
  if (!card) return false;
  if (card.color === 'wild') return true;
  if (!top) return true;
  return card.value === top.value || card.color === state.currentColor;
}

function chooseStackCard(hand) {
  return hand.find((card) => card.value === '+2')
    || hand.find((card) => card.value === '+4')
    || null;
}

function getNextPlayerIndex(state) {
  const hands = state.hands || [];
  if (!hands.length) return 0;
  const direction = state.direction || 1;
  return ((state.currentPlayer + direction) % hands.length + hands.length) % hands.length;
}

function chooseColorAfterPlay(hand, playedCard, nextLacks) {
  const counts = countColors(hand, playedCard);
  let bestColor = 'red';
  let bestCount = -1;
  for (const color of COLORS) {
    // hard: a colour the next player lacks is worth about a card
    const c = (counts[color] || 0) + (nextLacks && nextLacks.has(color) ? 1.5 : 0);
    if (c > bestCount) {
      bestCount = c;
      bestColor = color;
    }
  }
  return bestColor;
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
    ? Math.max(remainingColors.red, remainingColors.blue, remainingColors.green, remainingColors.yellow)
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
