// games/hearts.js
// Hearts (红心大战) — 4-player trick-taking card game

const SUITS = ['s', 'h', 'c', 'd'];
const SUIT_SYMBOLS = { s: '♠', h: '♥', c: '♣', d: '♦' };
// Hearts uses A-high rank order: 2 < 3 < ... < K < A
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

exports.name = 'hearts';
exports.maxPlayers = 4;
exports.minPlayers = 4;

function rankVal(rank) {
  return RANKS.indexOf(rank);
}

function suitVal(suit) {
  return SUITS.indexOf(suit);
}

function createDeck() {
  var deck = [];
  for (var s = 0; s < SUITS.length; s++) {
    for (var r = 0; r < RANKS.length; r++) {
      deck.push({ rank: RANKS[r], suit: SUITS[s], id: RANKS[r] + SUITS[s] });
    }
  }
  return deck;
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function sortHand(hand) {
  hand.sort(function(a, b) {
    var sv = suitVal(a.suit) - suitVal(b.suit);
    if (sv !== 0) return sv;
    return rankVal(a.rank) - rankVal(b.rank);
  });
}

function cardPoints(card) {
  if (card.suit === 'h') return 1;
  if (card.suit === 's' && card.rank === 'Q') return 13;
  return 0;
}

function trickWinner(trick) {
  var leadSuit = trick[0].card.suit;
  var bestIdx = 0;
  var bestVal = rankVal(trick[0].card.rank);
  for (var i = 1; i < trick.length; i++) {
    if (trick[i].card.suit === leadSuit) {
      var rv = rankVal(trick[i].card.rank);
      if (rv > bestVal) { bestVal = rv; bestIdx = i; }
    }
  }
  return trick[bestIdx].player;
}

exports.createState = function() {
  return {
    phase: 'passing',
    currentPlayer: 0,
    winner: null,
    hands: [],
    passDirection: 'left',
    passRound: 0,
    passSubmissions: {},
    currentTrick: [],
    trickLeader: 0,
    heartsBroken: false,
    scores: [0, 0, 0, 0],
    roundScores: [0, 0, 0, 0],
    round: 1,
    targetScore: 100,
    lastTrick: null,
    trickCount: 0,
    _playerCount: 4,
  };
};

function dealCards(state) {
  var deck = shuffle(createDeck());
  state.hands = [];
  for (var i = 0; i < 4; i++) {
    state.hands.push(deck.splice(0, 13));
    sortHand(state.hands[i]);
  }
  // Find who has 2♣ to lead first trick
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < state.hands[i].length; j++) {
      if (state.hands[i][j].id === '2c') {
        state.currentPlayer = i;
        return;
      }
    }
  }
}

function getPassTarget(from, direction) {
  if (direction === 'none') return -1;
  if (direction === 'left') return (from + 1) % 4;
  if (direction === 'right') return (from + 3) % 4;
  // across
  if (from === 0) return 2;
  if (from === 2) return 0;
  if (from === 1) return 3;
  return 1;
}

function applyPass(state) {
  var dir = state.passDirection;
  if (dir === 'none') return;
  var newHands = [[], [], [], []];
  for (var i = 0; i < 4; i++) {
    var target = getPassTarget(i, dir);
    var cards = state.passSubmissions[i] || [];
    // Remove cards from current hand
    var hand = state.hands[i].slice();
    for (var c = 0; c < cards.length; c++) {
      var idx = -1;
      for (var h = 0; h < hand.length; h++) {
        if (hand[h].id === cards[c]) { idx = h; break; }
      }
      if (idx !== -1) hand.splice(idx, 1);
    }
    newHands[i] = hand;
  }
  // Add received cards
  for (var i = 0; i < 4; i++) {
    var source = -1;
    if (dir === 'left') source = (i + 3) % 4;
    else if (dir === 'right') source = (i + 1) % 4;
    else if (dir === 'across') {
      if (i === 0) source = 2; else if (i === 2) source = 0;
      else if (i === 1) source = 3; else source = 1;
    }
    if (source >= 0) {
      var received = state.passSubmissions[source] || [];
      for (var c = 0; c < received.length; c++) {
        for (var k = 0; k < state.hands[source].length; k++) {
          if (state.hands[source][k].id === received[c]) {
            newHands[i].push(state.hands[source][k]);
            break;
          }
        }
      }
    }
  }
  state.hands = newHands;
  for (var i = 0; i < 4; i++) sortHand(state.hands[i]);
}

function hasOnlyHearts(hand) {
  return hand.every(function(c) { return c.suit === 'h'; });
}

function canPlayCard(card, state, playerIndex, isFirstTrick) {
  var hand = state.hands[playerIndex];
  if (state.currentTrick.length === 0) {
    // Leading
    if (isFirstTrick && playerIndex === state.trickLeader) {
      // First trick: must play 2♣ if you have it
      for (var i = 0; i < hand.length; i++) {
        if (hand[i].id === '2c') return card.id === '2c';
      }
    }
    if (!state.heartsBroken) {
      // Cannot lead hearts unless only hearts remain
      if (card.suit === 'h' && !hasOnlyHearts(hand)) return false;
    }
    return true;
  }
  // Following
  var leadSuit = state.currentTrick[0].card.suit;
  if (card.suit === leadSuit) return true;
  // Must follow suit if possible
  var hasLead = hand.some(function(c) { return c.suit === leadSuit; });
  if (hasLead) return false;
  // Cannot play hearts or QS on first trick if possible
  if (isFirstTrick) {
    var hasNonPenalty = hand.some(function(c) {
      return cardPoints(c) === 0;
    });
    if (hasNonPenalty && cardPoints(card) > 0) return false;
  }
  return true;
}

exports.handleMove = function(data, state, playerIndex) {
  if (state.winner !== null) return 'Game is over';
  if (state.phase === 'over') return 'Game is over';

  // ---- PASSING PHASE ----
  if (state.phase === 'passing') {
    if (state.passDirection === 'none') {
      // No passing round: skip directly to playing
      state.phase = 'playing';
      state.passSubmissions = {};
      // Find 2♣ holder
      for (var i = 0; i < 4; i++) {
        for (var j = 0; j < state.hands[i].length; j++) {
          if (state.hands[i][j].id === '2c') { state.currentPlayer = i; break; }
        }
      }
      return null;
    }

    // Fallback: if pass:true or empty, auto-select 3 highest cards
    var cards = data.cards;
    if (data.pass || (!cards && !data.card)) {
      var hand = state.hands[playerIndex].slice();
      cards = hand.slice(-3).map(function(c) { return c.id; });
      data.cards = cards;
    }
    if (!Array.isArray(cards) || cards.length !== 3) return 'Select exactly 3 cards to pass';
    // Check no duplicates
    var seen = {};
    for (var i = 0; i < cards.length; i++) {
      if (seen[cards[i]]) return 'Cannot select the same card twice';
      seen[cards[i]] = true;
    }
    // Check cards in hand
    var hand = state.hands[playerIndex];
    for (var i = 0; i < cards.length; i++) {
      var found = false;
      for (var j = 0; j < hand.length; j++) {
        if (hand[j].id === cards[i]) { found = true; break; }
      }
      if (!found) return "You don't have " + cards[i];
    }
    state.passSubmissions[playerIndex] = cards;
    // Check if all 4 submitted
    var count = Object.keys(state.passSubmissions).length;
    if (count >= 4) {
      applyPass(state);
      state.passSubmissions = {};
      state.phase = 'playing';
      state.heartsBroken = false;
      state.trickCount = 0;
      state.currentTrick = [];
      // Find 2♣ holder
      for (var i = 0; i < 4; i++) {
        for (var j = 0; j < state.hands[i].length; j++) {
          if (state.hands[i][j].id === '2c') { state.currentPlayer = i; break; }
        }
      }
    } else {
      // Advance to next player so bot scheduler picks up the next bot
      state.currentPlayer = (state.currentPlayer + 1) % 4;
    }
    return null;
  }

  // ---- PLAYING PHASE ----
  if (state.phase !== 'playing') return 'Operation not allowed in current phase';

  var hand = state.hands[playerIndex];
  if (!hand || hand.length === 0) return 'No cards in hand';

  var cardId = data.card;
  if (!cardId) return 'Select a card';

  // Find card in hand
  var cardIdx = -1;
  for (var i = 0; i < hand.length; i++) {
    if (hand[i].id === cardId) { cardIdx = i; break; }
  }
  if (cardIdx === -1) return "You don't have this card";

  var card = hand[cardIdx];
  var isFirstTrick = state.trickCount === 0;

  if (!canPlayCard(card, state, playerIndex, isFirstTrick)) {
    return 'Illegal card';
  }

  // Play the card
  hand.splice(cardIdx, 1);
  state.currentTrick.push({ player: playerIndex, card: card });

  // Check hearts broken
  if (card.suit === 'h') state.heartsBroken = true;

  // If trick is complete (4 cards)
  if (state.currentTrick.length === 4) {
    var winner = trickWinner(state.currentTrick);
    state.lastTrick = state.currentTrick.slice();

    // Score the trick
    var pts = 0;
    for (var i = 0; i < state.currentTrick.length; i++) {
      pts += cardPoints(state.currentTrick[i].card);
    }
    state.roundScores[winner] += pts;
    state.trickCount++;
    state.currentTrick = [];

    // Check if round is over (13 tricks)
    if (state.trickCount >= 13) {
      // Check shooting the moon
      var moonShooter = -1;
      for (var i = 0; i < 4; i++) {
        if (state.roundScores[i] === 26) { moonShooter = i; break; }
      }
      if (moonShooter >= 0) {
        // Shooting the moon: shooter gets 0, others get 26 each
        for (var i = 0; i < 4; i++) {
          if (i === moonShooter) state.roundScores[i] = 0;
          else state.roundScores[i] = 26;
        }
      }
      // Add round scores to total
      for (var i = 0; i < 4; i++) {
        state.scores[i] += state.roundScores[i];
      }
      // Check if game over
      var minScore = Math.min.apply(null, state.scores);
      var maxScore = Math.max.apply(null, state.scores);
      if (maxScore >= state.targetScore) {
        state.phase = 'over';
        // Winner is player with lowest score
        var winnerIdx = 0;
        for (var i = 1; i < 4; i++) {
          if (state.scores[i] < state.scores[winnerIdx]) winnerIdx = i;
        }
        state.winner = winnerIdx;
      } else {
        // New round
        state.phase = 'passing';
        state.round++;
        state.roundScores = [0, 0, 0, 0];
        state.heartsBroken = false;
        state.trickCount = 0;
        state.currentTrick = [];
        state.passSubmissions = {};
        // Pass direction: left(0) → right(1) → across(2) → none(3) → left(0) ...
        var dirs = ['left', 'right', 'across', 'none'];
        state.passDirection = dirs[state.passRound % 4];
        state.passRound++;
        dealCards(state);
      }
    } else {
      state.currentPlayer = winner;
      state.trickLeader = winner;
    }
  } else {
    // Next player
    state.currentPlayer = (state.currentPlayer + 1) % 4;
  }
  return null;
};

exports.playerView = function(state, playerIndex) {
  return {
    phase: state.phase,
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    passDirection: state.passDirection,
    passRound: state.passRound,
    currentTrick: state.currentTrick,
    trickLeader: state.trickLeader,
    heartsBroken: state.heartsBroken,
    scores: state.scores,
    roundScores: state.roundScores,
    round: state.round,
    targetScore: state.targetScore,
    lastTrick: state.lastTrick,
    trickCount: state.trickCount,
    myHand: state.hands[playerIndex] || [],
    handSizes: state.hands.map(function(h) { return h ? h.length : 0; }),
    myPassCards: state.passSubmissions[playerIndex] || null,
    passSubmitted: Object.keys(state.passSubmissions).map(function(k) { return parseInt(k); }),
  };
};

exports.initGame = function(state, playerCount) {
  state.phase = 'passing';
  state.currentPlayer = 0;
  state.winner = null;
  state.passSubmissions = {};
  state.currentTrick = [];
  state.trickLeader = 0;
  state.heartsBroken = false;
  state.scores = [0, 0, 0, 0];
  state.roundScores = [0, 0, 0, 0];
  state.round = 1;
  state.lastTrick = null;
  state.trickCount = 0;
  state.passDirection = 'left';
  state.passRound = 0;
  dealCards(state);
};
