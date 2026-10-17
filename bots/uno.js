const { botName } = require('./lib/bot-name');

exports.name = 'uno';

const { getDifficulty } = require('./lib/difficulty');

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  getMove(state) {
    const diff = getDifficulty(state);

    // Answer a pending +4. The +4 player's hand is hidden, so challenge now and then without peeking.
    if (state.pendingChallenge) {
      const chalProb = diff === 'hard' ? 0.35 : diff === 'easy' ? 0.15 : 0.25;
      return { challengeResponse: Math.random() < chalProb ? 'challenge' : 'accept' };
    }
    const hand = state.hands[playerIndex];
    if (!hand || hand.length === 0) return {};

    if (hand.length === 1 && (!state.unoCalled || !state.unoCalled[playerIndex])) {
      // In easy mode: 40% chance of forgetting to call UNO
      if (diff !== 'easy' || Math.random() >= 0.4) {
        return { uno: true };
      }
    }

    if (state.drawStack > 0) {
      const stackCard = chooseStackCard(hand);
      if (!stackCard) return {};
      return {
        cardId: stackCard.id,
        chosenColor: stackCard.color === 'wild' ? chooseColorAfterPlay(hand, stackCard) : undefined,
      };
    }

    const playable = hand.filter((card) => canPlay(card, state));
    if (playable.length === 0) return {};

    // In easy mode: 60% chance of picking a random playable card
    if (diff === 'easy' && Math.random() < 0.6) {
      const randomCard = playable[Math.floor(Math.random() * playable.length)];
      return {
        cardId: randomCard.id,
        chosenColor: randomCard.color === 'wild' ? chooseColorAfterPlay(hand, randomCard) : undefined,
      };
    }

    const nextIndex = getNextPlayerIndex(state);
    const nextHand = (state.hands && state.hands[nextIndex]) || [];
    const nextHandSize = nextHand.length;
    const top = state.discard && state.discard[0];

    let bestCard = playable[0];
    let bestScore = -Infinity;

    for (const card of playable) {
      let score = scoreCard(card, hand, top, nextHandSize, state);
      if (diff === 'hard' && nextHandSize <= 2) {
        // High urgency to stop next player
        if (card.value === 'skip' || card.value === 'reverse') score += 50;
        if (card.value === 'draw2' || card.color === 'wild') score += 80;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
      }
    }

    return {
      cardId: bestCard.id,
      chosenColor: bestCard.color === 'wild' ? chooseColorAfterPlay(hand, bestCard) : undefined,
    };
  },
});

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

function chooseColorAfterPlay(hand, playedCard) {
  const counts = countColors(hand, playedCard);
  let bestColor = 'red';
  let bestCount = -1;
  for (const color of ['red', 'blue', 'green', 'yellow']) {
    if ((counts[color] || 0) > bestCount) {
      bestCount = counts[color] || 0;
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
