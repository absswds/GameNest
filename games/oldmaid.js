// games/oldmaid.js
// 抽鬼牌 (Old Maid) — Draw a specific card from opponent, discard pairs, don't end with the joker!

exports.name = 'oldmaid';
exports.maxPlayers = 6;
const { pick } = require('./lib/i18n');

const SUITS = ['s', 'h', 'c', 'd'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck.push({ rank: r, suit: s, id: r + s });
    }
  }
  deck.push({ rank: '👻', suit: '', id: 'J1' });
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function findPair(hand) {
  const byRank = {};
  for (let i = 0; i < hand.length; i++) {
    const card = hand[i];
    if (card.rank === '👻') continue;
    if (byRank[card.rank] !== undefined) return [byRank[card.rank], i];
    byRank[card.rank] = i;
  }
  return null;
}

// Returns array of discarded pairs: [{rank, cardA, cardB}, ...]
function discardAllPairsWithLog(hand) {
  const discarded = [];
  let pair;
  while ((pair = findPair(hand)) !== null) {
    const a = Math.max(pair[0], pair[1]);
    const b = Math.min(pair[0], pair[1]);
    const cardA = Object.assign({}, hand[a]);
    const cardB = Object.assign({}, hand[b]);
    discarded.push({ rank: cardA.rank, cardA: cardA, cardB: cardB });
    hand.splice(a, 1);
    hand.splice(b, 1);
  }
  return discarded;
}

// backwards compat
function discardAllPairs(hand) {
  discardAllPairsWithLog(hand);
}

exports.createState = () => ({
  hands: [],
  handSizes: [],
  currentPlayer: 0,
  winner: null,
  loser: null,
  lastDraw: null,       // { from, to, card }
  lastDiscards: null,   // { player, pairs: [{rank, cardA, cardB}, ...] }
  messages: [],         // log: [{text, time, highlight}]
});

exports.initGame = function (state, playerCount) {
  const deck = createDeck();
  shuffle(deck);

  state.hands = [];
  for (let i = 0; i < playerCount; i++) state.hands.push([]);
  for (let i = 0; i < deck.length; i++) {
    state.hands[i % playerCount].push(deck[i]);
  }

  // Log initial discards per player
  state.messages = [];
  for (let i = 0; i < playerCount; i++) {
    const discards = discardAllPairsWithLog(state.hands[i]);
    for (const d of discards) {
      state.messages.push({ text: pick(state, 'P' + (i + 1) + ' 开局弃掉对子: ' + d.rank + ' ' + d.rank, 'P' + (i + 1) + ' discarded pair: ' + d.rank + ' ' + d.rank), time: Date.now() });
    }
  }

  state.winner = null;
  state.loser = null;
  state.currentPlayer = 0;
  state.lastDraw = null;
  state.lastDiscards = null;
  state.handSizes = state.hands.map(h => h.length);
};

exports.handleMove = function (data, state, playerIndex) {
  if (state.winner !== null || state.loser !== null) return 'g_game_over';
  if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';
  if (state.hands[playerIndex].length === 0) return 'om_no_hand';

  // Allow _ping — a no-op move to trigger UI re-render
  if (data && data._ping === true) return null;

  const { drawFrom, cardIndex } = data || {};

  // Validate drawFrom
  if (typeof drawFrom !== 'number' || drawFrom < 0 || drawFrom >= state.hands.length) {
    return 'om_choose_player';
  }
  if (drawFrom === playerIndex) return 'om_cannot_draw_self';
  if (state.hands[drawFrom].length === 0) return 'om_player_no_cards';

  // Validate cardIndex — player picks a specific face-down card
  if (typeof cardIndex !== 'number' || cardIndex < 0 || cardIndex >= state.hands[drawFrom].length) {
    return 'om_invalid_draw_position';
  }

  // Draw the chosen card
  const drawnCard = state.hands[drawFrom].splice(cardIndex, 1)[0];
  state.hands[playerIndex].push(drawnCard);
  state.lastDraw = { from: drawFrom, to: playerIndex, card: drawnCard };

  // Log: who drew from whom
  var suitSymbols = { s: '♠', h: '♥', c: '♣', d: '♦' };
  var dispCard = drawnCard.rank + (drawnCard.suit ? suitSymbols[drawnCard.suit] : '');
  state.messages.push({
    text: pick(state, 'P' + (playerIndex + 1) + ' 从 P' + (drawFrom + 1) + ' 抽到了一张牌', 'P' + (playerIndex + 1) + ' drew a card from P' + (drawFrom + 1)),
    time: Date.now(),
    from: drawFrom,
    to: playerIndex,
    cardDrawn: dispCard,
  });

  // Discard any newly formed pairs + log them
  const discards = discardAllPairsWithLog(state.hands[playerIndex]);
  if (discards.length > 0) {
    for (const d of discards) {
      state.messages.push({
        text: pick(state, 'P' + (playerIndex + 1) + ' 弃掉对子: ' + d.rank + ' ' + d.rank + ' ✅', 'P' + (playerIndex + 1) + ' discarded pair: ' + d.rank + ' ' + d.rank + ' ✅'),
        time: Date.now(),
        highlight: true,
      });
    }
    state.lastDiscards = { player: playerIndex, pairs: discards };
  }

  // Trim log
  while (state.messages.length > 30) state.messages.shift();

  // Check if current player cleared all cards
  if (state.hands[playerIndex].length === 0) {
    state.messages.push({ text: pick(state, 'P' + (playerIndex + 1) + ' 手牌清空！', 'P' + (playerIndex + 1) + ' hand is empty!'), time: Date.now(), highlight: true });
    state.handSizes = state.hands.map(h => h.length);
    const withCards = [];
    for (let i = 0; i < state.hands.length; i++) {
      if (state.hands[i].length > 0) withCards.push(i);
    }
    if (withCards.length === 1) {
      state.loser = withCards[0];
      state.winner = -1;
      return null;
    }
  }

  // Move to next player with cards (skip empty hands)
  let turn = (playerIndex + 1) % state.hands.length;
  for (let i = 0; i < state.hands.length; i++) {
    if (state.hands[turn].length > 0) break;
    turn = (turn + 1) % state.hands.length;
  }
  state.currentPlayer = turn;
  state.drawingFrom = -1;
  state.handSizes = state.hands.map(h => h.length);

  return null;
};
