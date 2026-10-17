// bots/hearts.js — AI for Hearts (红心大战)
// Easy: random legal play; Normal: avoid winning tricks with hearts, dump QS; Hard: track QoS position, shoot-the-moon detection

const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'hearts';

var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function rankVal(rank) { return RANKS.indexOf(rank); }

const hearts = require('../games/hearts');
const cardPoints = hearts.cardPoints;

function canPlayCard(card, state, playerIndex) {
  return hearts.canPlayCard(card, state, playerIndex, state.trickCount === 0);
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

// hard tier: card counting. `played` holds every card seen in completed or running tricks this round.
function observeTricks(mem, state) {
  if (state.phase === 'passing' || (mem.trickCount > state.trickCount)) mem.played = new Set();
  mem.trickCount = state.trickCount;
  (state.lastTrick || []).forEach(function(e) { mem.played.add(e.card.id); });
  (state.currentTrick || []).forEach(function(e) { mem.played.add(e.card.id); });
}

function trickWinnerEntry(trick) {
  var lead = trick[0].card.suit;
  var best = trick[0];
  for (var i = 1; i < trick.length; i++) {
    if (trick[i].card.suit === lead && rankVal(trick[i].card.rank) > rankVal(best.card.rank)) best = trick[i];
  }
  return best;
}

// unseen cards of `suit` ranked above/below `rv` (not in my hand, not yet played)
function unseenCount(mem, hand, suit, rv, above) {
  var n = 0;
  for (var r = 0; r < RANKS.length; r++) {
    if (above ? r <= rv : r >= rv) continue;
    var id = RANKS[r] + suit;
    if (mem.played.has(id) || hand.some(function(c) { return c.id === id; })) continue;
    n++;
  }
  return n;
}

function choosePlayHard(state, playerIndex, mem) {
  var moves = getLegalMoves(state, playerIndex);
  var hand = state.hands[playerIndex];
  if (moves.length === 0) return { card: hand[0].id };
  observeTricks(mem, state);
  var trick = state.currentTrick;
  var roundScores = state.roundScores;
  var totalPoints = roundScores.reduce(function(a, b) { return a + b; }, 0);
  var shooting = roundScores[playerIndex] >= 14 && totalPoints === roundScores[playerIndex];
  var qsSeen = mem.played.has('Qs') || hand.some(function(c) { return c.id === 'Qs'; });
  var best = null;
  var bestScore = Infinity;

  var leadSuit = trick.length ? trick[0].card.suit : null;
  var winnerEntry = trick.length ? trickWinnerEntry(trick) : null;
  var trickPts = trick.reduce(function(a, e) { return a + cardPoints(e.card); }, 0);
  var follows = leadSuit && moves.some(function(c) { return c.suit === leadSuit; });

  moves.forEach(function(c) {
    var rv = rankVal(c.rank);
    var score = 0;
    if (!trick.length) {
      // leading: low cards in suits where plenty of higher cards are still out
      var higher = unseenCount(mem, hand, c.suit, rv, true);
      var lower = unseenCount(mem, hand, c.suit, rv, false);
      score = rv * 1.2 - Math.min(higher, 6) * 1.5 + (c.suit === 'h' ? 14 : 0);
      if (c.id === 'Qs') score += 80;
      if (c.suit === 's' && !qsSeen && (c.rank === 'A' || c.rank === 'K')) score += 25;
      if (c.suit === 's' && !qsSeen && rv < 10 && !hand.some(function(h) { return h.id === 'Qs'; })) score -= 6; // draw the queen out
      if (higher === 0 && cardPoints(c) === 0) score += lower > 0 ? 0 : 3; // top card of an exhausted suit: free lead, but wasteful
      if (shooting) score = -rv - (c.suit === 'h' ? 20 : 0);
    } else if (follows) {
      var wins = c.suit === leadSuit && rv > rankVal(winnerEntry.card.rank);
      var lastToPlay = trick.length === 3;
      if (wins) {
        var higherOut = unseenCount(mem, hand, leadSuit, rv, true);
        var pTake = lastToPlay ? 1 : (higherOut === 0 ? 1 : 0.55);
        var future = lastToPlay ? 0 : (leadSuit === 'h' ? 1.5 : 0.6) * (3 - trick.length);
        score = (trickPts + future) * 10 * pTake - rv * 0.3;
        if (c.id === 'Qs') score += 130;
        if (shooting) score = -50 + rv * 0.1;
      } else {
        score = -rv; // duck with the highest card that stays under the winner
        if (c.id === 'Qs') score = -200; // dump the queen on someone else's trick
      }
    } else {
      // void: dump the most dangerous card
      score = -(cardPoints(c) * 12) - rv * 0.8;
      if (c.id === 'Qs') score = -400;
      if (c.suit === 'h' && winnerEntry && winnerEntry.player === playerIndex) score += 20; // never hand myself hearts
      if (shooting) score = rv;
    }
    if (score < bestScore) { bestScore = score; best = c; }
  });
  return { card: best.id };
}

// hard: pass the queen of spades (unless well guarded), top spades, high hearts, and thin short side suits
function choosePassHard(hand) {
  var counts = { s: 0, h: 0, c: 0, d: 0 };
  hand.forEach(function(c) { counts[c.suit]++; });
  var lowSpades = hand.filter(function(c) { return c.suit === 's' && rankVal(c.rank) < 10; }).length;
  var guarded = hand.some(function(c) { return c.id === 'Qs'; }) && lowSpades >= 4;
  var scored = hand.map(function(c) {
    var rv = rankVal(c.rank);
    var s = rv;
    if (c.id === 'Qs') s += guarded ? -20 : 100;
    else if (c.suit === 's' && rv >= 11 && !guarded) s += 30;
    else if (c.suit === 'h') s += rv >= 8 ? 35 : 6;
    if ((c.suit === 'c' || c.suit === 'd') && counts[c.suit] <= 3) s += 14 - counts[c.suit] * 3; // aim for a void
    return { c: c, s: s };
  });
  scored.sort(function(a, b) { return b.s - a.s; });
  return scored.slice(0, 3).map(function(x) { return x.c.id; });
}

exports.createBot = function(playerIndex) {
  var mem = { played: new Set(), trickCount: 0 };
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function(state) {
      // Handle passing phase
      if (state.phase === 'passing') {
        var hand = state.hands[playerIndex];
        if (!hand) return { cards: [] };
        if (getDifficulty(state) === 'hard') return { cards: choosePassHard(hand) };
        return { cards: choosePassCards(hand) };
      }

      // Playing phase
      var diff = getDifficulty(state);
      if (diff === 'hard') return choosePlayHard(state, playerIndex, mem);
      if (diff === 'normal') return choosePlayNormal(state, playerIndex);
      if (Math.random() < 0.5) return choosePlayNormal(state, playerIndex);
      return choosePlayEasy(state, playerIndex);
    }
  };
};
