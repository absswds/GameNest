// bots/backgammon.js — AI for 西洋双陆
// Heuristic evaluation: pip count, blot risk, building points, priming

const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');
const bg = require('../games/backgammon');

exports.name = 'backgammon';

// ---- Evaluation ----

function evaluate(state, side) {
  const enemy = side === 0 ? 1 : 0;
  let score = 0;

  // Pip count advantage (lower is better)
  var myPip = bg._pipCount(state, side);
  var enemyPip = bg._pipCount(state, enemy);
  score += (enemyPip - myPip) * 2;

  // Home board progress
  var myHome = state.home[side];
  var enemyHome = state.home[enemy];
  score += myHome * 15;
  score -= enemyHome * 15;

  // Bar penalty — pieces on bar are very bad
  score -= state.bar[side] * 30;
  score += state.bar[enemy] * 30;

  // Blot risk — lone pieces are vulnerable
  for (var p = 0; p < 24; p++) {
    var pt = state.points[p];
    if (!pt) continue;
    if (pt.side === side && pt.count === 1) {
      // Check if blot is in danger (opponent can reach it)
      var danger = false;
      for (var d = 1; d <= 6; d++) {
        var attackerPt = enemy === 0 ? p + d : p - d;
        if (attackerPt >= 0 && attackerPt <= 23) {
          var apt = state.points[attackerPt];
          if (apt && apt.side === enemy && apt.count >= 1) {
            danger = true;
            break;
          }
        }
      }
      if (danger) score -= 8;
      else score -= 2;
    }
    // Doubles/stacks are good — building primes
    if (pt.side === side && pt.count >= 2) {
      score += pt.count * 3;
    }
  }

  // Prime detection — consecutive points with 2+ pieces
  var primeLen = 0, maxPrime = 0;
  for (var p = 0; p < 24; p++) {
    var pt = state.points[p];
    if (pt && pt.side === side && pt.count >= 2) {
      primeLen++;
      if (primeLen > maxPrime) maxPrime = primeLen;
    } else {
      primeLen = 0;
    }
  }
  score += maxPrime * 10;

  // Back game — having anchors in opponent's home
  var anchors = 0;
  var oppHomeStart = enemy === 0 ? 0 : 18;
  var oppHomeEnd = enemy === 0 ? 5 : 23;
  for (var p = oppHomeStart; p <= oppHomeEnd; p++) {
    var pt = state.points[p];
    if (pt && pt.side === side && pt.count >= 2) anchors++;
  }
  score += anchors * 5;

  return score;
}

// ---- Move Selection ----

function selectBestMove(state, side, difficulty) {
  // Roll dice first
  var rollState = JSON.parse(JSON.stringify(state));
  rollState.hasRolled = false;
  rollState.dice = [];
  rollState.remainingDice = [];

  var d1 = Math.floor(Math.random() * 6) + 1;
  var d2 = Math.floor(Math.random() * 6) + 1;
  if (d1 === d2) {
    rollState.dice = [d1, d1, d1, d1];
    rollState.remainingDice = [d1, d1, d1, d1];
  } else {
    rollState.dice = [d1, d2];
    rollState.remainingDice = [d1, d2];
  }
  rollState.hasRolled = true;

  // Generate all possible move sequences
  var sequences = bg._generateAllMoveSequences(rollState, side, rollState.remainingDice.slice());

  if (sequences.length === 0) {
    // No legal moves — just pass
    return { roll: true, pass: true };
  }

  if (difficulty === 'easy') {
    // Random sequence
    var seq = sequences[Math.floor(Math.random() * sequences.length)];
    if (seq.length === 0) return { roll: true, pass: true };
    return { roll: true, moves: seq };
  }

  // Evaluate each sequence
  var bestScore = -Infinity;
  var bestSeq = sequences[0];
  var evalState = JSON.parse(JSON.stringify(state));

  for (var i = 0; i < sequences.length; i++) {
    var seq = sequences[i];
    // Apply sequence to a copy
    var testState = JSON.parse(JSON.stringify(evalState));
    testState.dice = rollState.dice;
    testState.remainingDice = rollState.remainingDice.slice();
    testState.hasRolled = true;

    for (var j = 0; j < seq.length; j++) {
      bg.handleMove(seq[j], testState, side);
    }

    var score = evaluate(testState, side);

    // Normal: add small random factor for variety
    if (difficulty === 'normal') {
      score += Math.random() * 4;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSeq = seq;
    }
  }

  if (bestSeq.length === 0) return { roll: true, pass: true };
  return { roll: true, moves: bestSeq };
}

// ---- Bot Interface ----

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    var diff = getDifficulty(state);
    var result = selectBestMove(state, playerIndex, diff);
    return result;
  },
});
