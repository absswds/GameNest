// games/exploding-kittens.js
// 爆炸猫 — Russian roulette card game. Avoid drawing Exploding Kittens!

exports.name = 'exploding-kittens';
exports.maxPlayers = 6;

function createDeck(playerCount) {
  playerCount = playerCount || 2;
  const deck = [];
  // Scale deck size based on player count to ensure enough cards for gameplay
  // Base: 8 explodes, 8 defuses, 8 each for other types; scale non-explode/defuse cards by playerCount
  const scale = Math.max(1, Math.ceil(playerCount / 2));

  // 8 Exploding Kittens (fixed, always 8 regardless of player count)
  for (let i = 0; i < 8; i++) deck.push({ type: 'explode', id: 'explode-' + i });
  // 8 Defuses (fixed, each player gets one + buffer)
  for (let i = 0; i < 8; i++) deck.push({ type: 'defuse', id: 'defuse-' + i });
  // Attack (scaled by playerCount)
  for (let i = 0; i < 8 * scale; i++) deck.push({ type: 'attack', id: 'attack-' + i });
  // Skip (scaled)
  for (let i = 0; i < 8 * scale; i++) deck.push({ type: 'skip', id: 'skip-' + i });
  // See the Future (scaled)
  for (let i = 0; i < 10 * scale; i++) deck.push({ type: 'future', id: 'future-' + i });
  // Shuffle (scaled)
  for (let i = 0; i < 8 * scale; i++) deck.push({ type: 'shuffle', id: 'shuffle-' + i });
  // Favor (scaled)
  for (let i = 0; i < 8 * scale; i++) deck.push({ type: 'favor', id: 'favor-' + i });
  // Steal (scaled)
  for (let i = 0; i < 8 * scale; i++) deck.push({ type: 'steal', id: 'steal-' + i });
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

exports.createState = () => ({
  deck: [],           // draw pile
  discard: [],        // discard pile
  hands: [],          // per-player hand
  currentPlayer: 0,
  winner: null,
  alive: [],          // per-player: bool
  extraTurns: [],     // per-player: remaining extra turns
  futureCards: null,  // result of See the Future (visible only to current player)
  phase: 'play',      // 'play' | 'draw' | 'over'
  peekedCards: null,  // cards seen by current player via Future
  lastSteal: null,    // { stealer, victim, cardType } — shown as notification then cleared
  lastAction: null,   // { player, type, seq, target? } — public play/explosion log
  actionSeq: 0,       // increments on each lastAction (used to fire animations once)
});

// Record a public action so all clients can show what just happened.
function setAction(state, player, type, extra) {
  state.actionSeq = (state.actionSeq || 0) + 1;
  state.lastAction = Object.assign({ player, type, seq: state.actionSeq }, extra || {});
}

function initGame(state, playerCount) {
  const deck = createDeck(playerCount);
  // Remove all explode and defuse cards
  const explodes = deck.filter(c => c.type === 'explode');
  const defuses = deck.filter(c => c.type === 'defuse');
  let remaining = deck.filter(c => c.type !== 'explode' && c.type !== 'defuse');
  shuffle(remaining);

  // Deal 7 cards to each player
  state.hands = [];
  for (let i = 0; i < playerCount; i++) {
    state.hands[i] = remaining.splice(0, 7);
  }
  // Give each player 1 defuse
  for (let i = 0; i < playerCount; i++) {
    if (defuses.length > 0) state.hands[i].push(defuses.pop());
  }
  // Add (playerCount - 1) explodes back to deck
  for (let i = 0; i < playerCount - 1; i++) {
    remaining.push(explodes[i]);
  }
  // Shuffle remaining defuses into deck
  remaining.push(...defuses);
  shuffle(remaining);

  state.deck = remaining;
  state.discard = [];
  state.currentPlayer = 0;
  state.winner = null;
  state.alive = Array(playerCount).fill(true);
  state.extraTurns = Array(playerCount).fill(0);
  state.futureCards = null;
  state.peekedCards = null;
  state.phase = 'play';
  state.lastSteal = null;
  state.lastAction = null;
  state.actionSeq = 0;
}
exports.initGame = initGame;

function nextAlive(state, fromIdx) {
  const n = state.alive.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    if (state.alive[idx]) return idx;
  }
  return fromIdx;
}

function aliveCount(state) {
  return state.alive.filter(a => a).length;
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';
  if (!state.alive[playerIndex]) return '你已经出局了';

  // Lazy init
  if (state.hands.length === 0) {
    const count = state._playerCount || 2;
    initGame(state, count);
    return null;
  }

  const { cardId, targetPlayer } = data || {};
  const hand = state.hands[playerIndex];

  if (playerIndex !== state.currentPlayer) return '还没轮到你';

  // ---- DRAW phase ----
  if (state.phase === 'draw') {
    // Must draw a card
    if (state.deck.length === 0) return '牌堆已空';
    const card = state.deck.pop();
    if (card.type === 'explode') {
      // Check for defuse
      const defuseIdx = hand.findIndex(c => c.type === 'defuse');
      if (defuseIdx >= 0) {
        // Defuse! Remove defuse, place explode back secretly
        hand.splice(defuseIdx, 1);
        state.discard.push({ type: 'defuse', id: 'defuse-used' });
        // Let player choose where to put explode back
        if (state.deck.length === 0) {
          state.deck.push(card); // only position available
        } else if (data.position !== undefined) {
          state.deck.splice(Math.min(data.position, state.deck.length), 0, card);
        } else {
          state.deck.splice(Math.floor(Math.random() * (state.deck.length + 1)), 0, card);
        }
        state.peekedCards = null;
        // Public: player used a defuse to survive
        setAction(state, playerIndex, 'defuse', { defused: true });
      } else {
        // BOOM! Eliminated
        state.alive[playerIndex] = false;
        state.discard.push(card);
        state.discard.push(...hand);
        state.hands[playerIndex] = [];
        setAction(state, playerIndex, 'explode', { exploded: true });
        if (aliveCount(state) <= 1) {
          state.winner = state.alive.findIndex(a => a);
          state.phase = 'over';
          return null;
        }
        state.currentPlayer = nextAlive(state, playerIndex);
        state.phase = 'play';
        state.peekedCards = null;
        state.extraTurns = Array(state.alive.length).fill(0);
        return null;
      }
    } else {
      hand.push(card);
      // Normal draw: contents stay secret, but the turn-ending draw is public
      setAction(state, playerIndex, 'draw');
    }

    state.phase = 'play';
    state.peekedCards = null;
    state.lastSteal = null;

    // Check extra turns
    if (state.extraTurns[playerIndex] > 0) {
      state.extraTurns[playerIndex]--;
      state.phase = 'play';
    } else {
      state.currentPlayer = nextAlive(state, playerIndex);
    }
    return null;
  }

  // ---- PLAY phase ----
  if (state.phase === 'play') {
    // Player can play cards or pass to draw

    // Play a single card
    if (cardId) {
      const idx = hand.findIndex(c => c.id === cardId);
      if (idx === -1) return '手上没有这张牌';
      const card = hand.splice(idx, 1)[0];
      state.discard.push(card);
      // Public: reveal which card was played (so others can see defuse/skip/etc.)
      setAction(state, playerIndex, card.type);

      switch (card.type) {
        case 'skip':
          // End turn without drawing
          if (state.extraTurns[playerIndex] > 0) {
            state.extraTurns[playerIndex]--;
          }
          state.currentPlayer = nextAlive(state, playerIndex);
          state.phase = 'play';
          return null;

        case 'attack':
          // 甩锅：指定目标玩家接 2 个回合（不指定则默认下家）
          {
            let target = nextAlive(state, playerIndex);
            if (targetPlayer !== undefined &&
                targetPlayer !== playerIndex &&
                state.alive[targetPlayer]) {
              target = targetPlayer;
            }
            state.currentPlayer = target;
            state.extraTurns[target] = (state.extraTurns[target] || 0) + 1;
            state.phase = 'play';
            if (state.lastAction) state.lastAction.target = target;
          }
          return null;

        case 'future':
          // See top 3 cards
          state.peekedCards = state.deck.slice(-Math.min(3, state.deck.length)).reverse();
          // Player can still play more cards or proceed to draw
          return null;

        case 'shuffle':
          // Shuffle the deck
          shuffle(state.deck);
          state.peekedCards = null;
          return null;

        case 'favor':
          // 偷牌 — directly steal a random card from the target player
          if (targetPlayer === undefined || targetPlayer === playerIndex) {
            hand.push(card); state.discard.pop(); return '必须指定目标玩家';
          }
          if (!state.alive[targetPlayer]) {
            hand.push(card); state.discard.pop(); return '目标玩家已出局';
          }
          {
            const targetHand = state.hands[targetPlayer];
            if (targetHand && targetHand.length > 0) {
              const rIdx = Math.floor(Math.random() * targetHand.length);
              const stolen = targetHand.splice(rIdx, 1)[0];
              hand.push(stolen);
              state.lastSteal = { stealer: playerIndex, victim: targetPlayer, cardType: stolen.type };
            }
          }
          state.phase = 'draw';
          return null;

        case 'steal':
          if (targetPlayer === undefined || targetPlayer === playerIndex) {
            hand.push(card); state.discard.pop(); return '必须指定目标玩家';
          }
          if (!state.alive[targetPlayer]) {
            hand.push(card); state.discard.pop(); return '目标玩家已出局';
          }
          {
            const targetHand = state.hands[targetPlayer];
            if (targetHand && targetHand.length > 0) {
              const rIdx = Math.floor(Math.random() * targetHand.length);
              const stolen = targetHand.splice(rIdx, 1)[0];
              hand.push(stolen);
              state.lastSteal = { stealer: playerIndex, victim: targetPlayer, cardType: stolen.type };
            }
          }
          state.phase = 'draw';
          return null;

        default:
          // Other cards: no special effect alone
          break;
      }
    }

    // Player passes → draw
    state.phase = 'draw';
    return null;
  }

  return '未知阶段';
};
