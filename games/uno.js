// games/uno.js
// UNO - 2-4 player card game with color/number matching and action cards

const COLORS = ['red', 'blue', 'green', 'yellow'];

exports.name = 'uno';
exports.maxPlayers = 6;

function createDeck() {
  const deck = [];
  for (const c of COLORS) {
    deck.push({ color: c, value: '0', id: c + '-0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color: c, value: String(i), id: c + '-' + i + '-a' });
      deck.push({ color: c, value: String(i), id: c + '-' + i + '-b' });
    }
    deck.push({ color: c, value: 'skip', id: c + '-skip-a' });
    deck.push({ color: c, value: 'skip', id: c + '-skip-b' });
    deck.push({ color: c, value: 'reverse', id: c + '-reverse-a' });
    deck.push({ color: c, value: 'reverse', id: c + '-reverse-b' });
    deck.push({ color: c, value: '+2', id: c + '-+2-a' });
    deck.push({ color: c, value: '+2', id: c + '-+2-b' });
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', value: 'wild', id: 'wild-' + i });
    deck.push({ color: 'wild', value: '+4', id: '+4-' + i });
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

exports.createState = () => ({
  deck: [],
  discard: [],
  hands: [],
  currentColor: null,
  currentPlayer: 0,
  direction: 1,
  winner: null,
  drawStack: 0,
  unoCalled: [],     // per-player: has called UNO when at 1 card
});

function initGame(state, playerCount) {
  const deck = createDeck();
  shuffle(deck);
  state.hands = [];
  for (let i = 0; i < playerCount; i++) {
    state.hands[i] = deck.splice(0, 7);
  }
  // First discard must not be wild
  let firstIdx = deck.findIndex(c => c.color !== 'wild');
  if (firstIdx === -1) firstIdx = 0;
  state.discard = [deck.splice(firstIdx, 1)[0]];
  state.deck = deck;
  state.currentColor = state.discard[0].color;
  state.currentPlayer = 0;
  state.direction = 1;
  state.winner = null;
  state.drawStack = 0;
  state.unoCalled = Array(playerCount).fill(true); // start true (no need at game start)
}
exports.initGame = initGame;

function nextPlayer(state) {
  const n = state.hands.length;
  return ((state.currentPlayer + state.direction) % n + n) % n;
}

function canPlay(card, state) {
  const top = state.discard[0];
  if (card.color === 'wild') return true;
  if (card.value === top.value) return true;
  if (card.color === state.currentColor) return true;
  return false;
}

function drawCards(hand, count, state) {
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      if (state.discard.length <= 1) break;
      const top = state.discard.shift();
      state.deck = state.discard;
      shuffle(state.deck);
      state.discard = [top];
    }
    if (state.deck.length > 0) hand.push(state.deck.pop());
  }
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';

  // Initialize if first move
  if (state.hands.length === 0) {
    const count = state._playerCount || 2;
    initGame(state, count);
  }

  if (playerIndex !== state.currentPlayer) return '还没轮到你';

  const hand = state.hands[playerIndex];
  const { cardId, chosenColor, uno } = data || {};

  // ---- UNO call ----
  if (uno) {
    state.unoCalled[playerIndex] = true;
    return null;
  }

  if (!cardId) {
    // Draw a card
    if (state.drawStack > 0) {
      // Must draw accumulated penalty
      const count = state.drawStack;
      state.drawStack = 0;
      drawCards(hand, count, state);
      state.currentPlayer = nextPlayer(state);
      return null;
    }
    // Check if player has playable cards
    const hasPlayable = hand.some(c => canPlay(c, state));
    if (hasPlayable) return '你有可出的牌';
    drawCards(hand, 1, state);
    state.currentPlayer = nextPlayer(state);
    return null;
  }

  const cardIdx = hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return '手上没有这张牌';
  const card = hand[cardIdx];

  // UNO penalty: playing last card without calling UNO → instant loss
  if (hand.length === 1 && !state.unoCalled[playerIndex]) {
    hand.splice(cardIdx, 1);
    state.discard.unshift(card);
    state.winner = nextPlayer(state); // opponent wins
    state.phase = 'over';
    return null;
  }

  if (state.drawStack > 0 && card.value !== '+2' && card.value !== '+4') return '必须先摸牌或出+2/+4叠加';
  if (!canPlay(card, state) && state.drawStack === 0) return '不能出这张牌';

  hand.splice(cardIdx, 1);

  // If player now has 1 card, reset UNO call (must call before next play)
  if (hand.length === 1) {
    state.unoCalled[playerIndex] = false;
  }

  // If player played last card with UNO, no need to reset
  if (hand.length === 0) {
    state.unoCalled[playerIndex] = true;
  }
  state.discard.unshift(card);

  // Apply card effect
  switch (card.value) {
    case 'skip':
      state.currentPlayer = nextPlayer(state); // advance
      state.currentPlayer = nextPlayer(state); // skip one
      break;
    case 'reverse':
      if (state.hands.length === 2) {
        state.currentPlayer = playerIndex; // same as skip in 2p
      } else {
        state.direction *= -1;
      }
      break;
    case '+2':
      state.drawStack += 2;
      break;
    case '+4':
      state.drawStack += 4;
      break;
    case 'wild':
      break;
    default:
      break;
  }

  state.currentColor = card.color === 'wild' ? (chosenColor || 'red') : card.color;

  if (card.value !== 'skip' && card.value !== 'reverse') {
    state.currentPlayer = nextPlayer(state);
  }

  if (hand.length === 0) {
    state.winner = playerIndex;
    return null;
  }

  return null;
};
