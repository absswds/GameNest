// bots/hearts.js — AI for Hearts (红心大战)
// Easy: random legal play; Normal: avoid winning tricks with hearts, dump QS; Hard: track QoS position, shoot-the-moon detection

const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'hearts';

var SUITS = ['s', 'h', 'c', 'd'];
var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function rankVal(rank) { return RANKS.indexOf(rank); }

function cardPoints(card) {
  if (card.suit === 'h') return 1;
  if (card.suit === 's' && card.rank === 'Q') return 13;
  return 0;
}

function hasOnlyHearts(hand) {
  return hand.every(function(c) { return c.suit === 'h'; });
}

function canPlayCard(card, state, playerIndex) {
  var hand = state.hands[playerIndex];
  var isFirstTrick = state.trickCount === 0;
  if (state.currentTrick.length === 0) {
    // Leading
    if (isFirstTrick && playerIndex === state.trickLeader) {
      for (var i = 0; i < hand.length; i++) {
        if (hand[i].id === '2c') return card.id === '2c';
      }
    }
    if (!state.heartsBroken) {
      if (card.suit === 'h' && !hasOnlyHearts(hand)) return false;
    }
    return true;
  }
  // Following
  var leadSuit = state.currentTrick[0].card.suit;
  if (card.suit === leadSuit) return true;
  var hasLead = hand.some(function(c) { return c.suit === leadSuit; });
  if (hasLead) return false;
  if (isFirstTrick) {
    var hasNonPenalty = hand.some(function(c) { return cardPoints(c) === 0; });
    if (hasNonPenalty && cardPoints(card) > 0) return false;
  }
  return true;
}

function getLegalMoves(state, playerIndex) {
  var hand = state.hands[playerIndex];
  if (!hand) return [];
  return hand.filter(function(c) {
    return canPlayCard(c, state, playerIndex);
  });
}

function choosePassCards(hand) {
  // Pass 3 highest cards (simple strategy)
  var sorted = hand.slice().sort(function(a, b) {
    return rankVal(b.rank) - rankVal(a.rank);
  });
  // Prefer passing QS, high hearts, and high spades
  sorted.sort(function(a, b) {
    var pa = cardPoints(a), pb = cardPoints(b);
    if (pa !== pb) return pb - pa;
    return rankVal(b.rank) - rankVal(a.rank);
  });
  return sorted.slice(0, 3).map(function(c) { return c.id; });
}

function choosePlayEasy(state, playerIndex) {
  var moves = getLegalMoves(state, playerIndex);
  if (moves.length === 0) return { card: state.hands[playerIndex][0].id };
  // Random
  var m = moves[Math.floor(Math.random() * moves.length)];
  return { card: m.id };
}

function choosePlayNormal(state, playerIndex) {
  var moves = getLegalMoves(state, playerIndex);
  if (moves.length === 0) return { card: state.hands[playerIndex][0].id };
  var hand = state.hands[playerIndex];
  var trick = state.currentTrick;

  if (trick.length === 0) {
    // Leading: play lowest non-point card
    var safeMoves = moves.filter(function(c) { return cardPoints(c) === 0; });
    var pool = safeMoves.length > 0 ? safeMoves : moves;
    pool.sort(function(a, b) { return rankVal(a.rank) - rankVal(b.rank); });
    return { card: pool[0].id };
  }

  // Following: try to avoid winning with points
  var leadSuit = trick[0].card.suit;
  var leadCards = moves.filter(function(c) { return c.suit === leadSuit; });
  if (leadCards.length > 0) {
    // If we must follow suit, play lowest possible that won't win
    var leadWinner = trick[0];
    for (var i = 1; i < trick.length; i++) {
      if (trick[i].card.suit === leadSuit && rankVal(trick[i].card.rank) > rankVal(leadWinner.card.rank)) {
        leadWinner = trick[i];
      }
    }
    // Find cards lower than current winner
    var safe = leadCards.filter(function(c) {
      return rankVal(c.rank) < rankVal(leadWinner.card.rank);
    });
    if (safe.length > 0) {
      safe.sort(function(a, b) { return rankVal(b.rank) - rankVal(a.rank); }); // play highest safe
      return { card: safe[0].id };
    }
    // All following cards would win — play lowest
    leadCards.sort(function(a, b) { return rankVal(a.rank) - rankVal(b.rank); });
    return { card: leadCards[0].id };
  }

  // Can't follow suit: dump high-point cards
  var pointCards = moves.filter(function(c) { return cardPoints(c) > 0; });
  if (pointCards.length > 0) {
    pointCards.sort(function(a, b) { return cardPoints(b) - cardPoints(a); });
    return { card: pointCards[0].id };
  }
  // No point cards: dump highest
  moves.sort(function(a, b) { return rankVal(b.rank) - rankVal(a.rank); });
  return { card: moves[0].id };
}

function choosePlayHard(state, playerIndex) {
  var moves = getLegalMoves(state, playerIndex);
  if (moves.length === 0) return { card: state.hands[playerIndex][0].id };
  var hand = state.hands[playerIndex];
  var trick = state.currentTrick;
  var roundScores = state.roundScores;
  var totalPoints = roundScores.reduce(function(a, b) { return a + b; }, 0);

  // Check if someone might be shooting the moon
  var moonSuspect = -1;
  for (var i = 0; i < 4; i++) {
    if (i !== playerIndex && roundScores[i] >= 20) moonSuspect = i;
  }

  if (trick.length === 0) {
    // Leading
    var safeMoves = moves.filter(function(c) { return cardPoints(c) === 0; });
    var pool = safeMoves.length > 0 ? safeMoves : moves;

    // If we're close to 26 points, consider shooting
    if (roundScores[playerIndex] >= 20 && totalPoints === roundScores[playerIndex]) {
      // We might be shooting — play high hearts to collect
      var hearts = moves.filter(function(c) { return c.suit === 'h'; });
      if (hearts.length > 0) {
        hearts.sort(function(a, b) { return rankVal(b.rank) - rankVal(a.rank); });
        return { card: hearts[0].id };
      }
    }

    // If suspect is shooting, try to dodge by leading low
    if (moonSuspect >= 0) {
      pool.sort(function(a, b) { return rankVal(a.rank) - rankVal(b.rank); });
      return { card: pool[0].id };
    }

    // Normal: lead lowest safe card
    pool.sort(function(a, b) { return rankVal(a.rank) - rankVal(b.rank); });
    return { card: pool[0].id };
  }

  // Following
  var leadSuit = trick[0].card.suit;
  var leadCards = moves.filter(function(c) { return c.suit === leadSuit; });

  if (leadCards.length > 0) {
    var leadWinner = trick[0];
    for (var i = 1; i < trick.length; i++) {
      if (trick[i].card.suit === leadSuit && rankVal(trick[i].card.rank) > rankVal(leadWinner.card.rank)) {
        leadWinner = trick[i];
      }
    }
    var safe = leadCards.filter(function(c) {
      return rankVal(c.rank) < rankVal(leadWinner.card.rank);
    });

    // If shooting, try to win the trick
    if (roundScores[playerIndex] >= 20 && totalPoints === roundScores[playerIndex]) {
      var winners = leadCards.filter(function(c) {
        return rankVal(c.rank) > rankVal(leadWinner.card.rank);
      });
      if (winners.length > 0) {
        winners.sort(function(a, b) { return rankVal(a.rank) - rankVal(b.rank); });
        return { card: winners[0].id };
      }
    }

    if (safe.length > 0) {
      safe.sort(function(a, b) { return rankVal(b.rank) - rankVal(a.rank); });
      return { card: safe[0].id };
    }
    leadCards.sort(function(a, b) { return rankVal(a.rank) - rankVal(b.rank); });
    return { card: leadCards[0].id };
  }

  // Can't follow suit
  // Dump QS first if we have it
  var qs = moves.filter(function(c) { return c.suit === 's' && c.rank === 'Q'; });
  if (qs.length > 0) return { card: qs[0].id };

  // Dump high hearts
  var pointCards = moves.filter(function(c) { return cardPoints(c) > 0; });
  if (pointCards.length > 0) {
    pointCards.sort(function(a, b) { return cardPoints(b) - cardPoints(a); });
    return { card: pointCards[0].id };
  }

  // Dump highest
  moves.sort(function(a, b) { return rankVal(b.rank) - rankVal(a.rank); });
  return { card: moves[0].id };
}

exports.createBot = function(playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function(state) {
      // Handle passing phase
      if (state.phase === 'passing') {
        var hand = state.hands[playerIndex];
        if (!hand) return { cards: [] };
        return { cards: choosePassCards(hand) };
      }

      // Playing phase
      var diff = getDifficulty(state);
      if (diff === 'hard') return choosePlayHard(state, playerIndex);
      if (diff === 'normal') return choosePlayNormal(state, playerIndex);
      return choosePlayEasy(state, playerIndex);
    }
  };
};
