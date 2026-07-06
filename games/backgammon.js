// games/backgammon.js — 西洋双陆 (2 players)
// 24 triangular points, 15 pieces per side, dice-driven movement

exports.name = 'backgammon';
exports.maxPlayers = 2;

// ---- Starting Position ----
// Player 0 moves 23→0 (high to low), home = points 0-5
// Player 1 moves 0→23 (low to high), home = points 18-23
function setupStartPositions(state) {
  // Player 0: 2 on 23, 5 on 12, 3 on 7, 5 on 5
  state.points[23] = { side: 0, count: 2 };
  state.points[12] = { side: 0, count: 5 };
  state.points[7]  = { side: 0, count: 3 };
  state.points[5]  = { side: 0, count: 5 };
  // Player 1: 2 on 0, 5 on 11, 3 on 16, 5 on 18
  state.points[0]  = { side: 1, count: 2 };
  state.points[11] = { side: 1, count: 5 };
  state.points[16] = { side: 1, count: 3 };
  state.points[18] = { side: 1, count: 5 };
}

exports.createState = () => {
  const state = {
    currentPlayer: 0,
    winner: null,
    points: new Array(24).fill(null),
    bar: { 0: 0, 1: 0 },
    home: { 0: 0, 1: 0 },
    dice: [],
    remainingDice: [],
    hasRolled: false,
    _playerCount: 2,
  };
  setupStartPositions(state);
  return state;
};

// ---- Helpers ----

function canLand(state, side, target) {
  if (target < 0 || target > 23) return false;
  const pt = state.points[target];
  if (!pt) return true;
  if (pt.side === side) return true;
  if (pt.count === 1) return true; // blot — can hit
  return false; // blocked
}

function allInHome(state, side) {
  if (state.bar[side] > 0) return false;
  const start = side === 0 ? 0 : 18;
  const end = side === 0 ? 5 : 23;
  for (let p = 0; p < 24; p++) {
    if (p >= start && p <= end) continue;
    if (state.points[p] && state.points[p].side === side && state.points[p].count > 0) return false;
  }
  return true;
}

function hasPiecesAbove(state, side, point) {
  for (let p = point + 1; p <= 5; p++) {
    if (state.points[p] && state.points[p].side === side && state.points[p].count > 0) return true;
  }
  return false;
}

function hasPiecesBelow(state, side, point) {
  for (let p = 18; p < point; p++) {
    if (state.points[p] && state.points[p].side === side && state.points[p].count > 0) return true;
  }
  return false;
}

function entryPoint(side, die) {
  return side === 0 ? 24 - die : die - 1;
}

function bearOffDie(side, point) {
  return side === 0 ? point + 1 : 24 - point;
}

function diceSum(dice) {
  let s = 0;
  for (let i = 0; i < dice.length; i++) s += dice[i];
  return s;
}

// ---- Move Validation ----

function computeRequiredDie(state, side, from, to) {
  if (from === 'bar') {
    return entryPoint(side, 0) === to ? null : (side === 0 ? 24 - to : to + 1);
  }
  if (to === 'off') {
    return bearOffDie(side, from);
  }
  return side === 0 ? from - to : to - from;
}

function isValidDieForBearOff(state, side, from, die) {
  const exactDie = bearOffDie(side, from);
  if (die === exactDie) return true;
  if (die < exactDie) return false;
  // Overshoot: check no pieces on higher home points
  if (side === 0) {
    return !hasPiecesAbove(state, side, from);
  } else {
    return !hasPiecesBelow(state, side, from);
  }
}

function validateMove(state, side, from, to, dieUsed) {
  if (dieUsed < 1 || dieUsed > 6) return false;

  // Check die is available
  const dIdx = state.remainingDice.indexOf(dieUsed);
  if (dIdx === -1) return false;

  // Bar priority
  if (state.bar[side] > 0 && from !== 'bar') return false;
  if (from === 'bar' && state.bar[side] === 0) return false;

  // Bar entry
  if (from === 'bar') {
    const target = entryPoint(side, dieUsed);
    if (to !== target) return false;
    return canLand(state, side, target);
  }

  // Source must own the piece
  if (typeof from !== 'number' || from < 0 || from > 23) return false;
  const srcPt = state.points[from];
  if (!srcPt || srcPt.side !== side || srcPt.count < 1) return false;

  // Bear off
  if (to === 'off') {
    if (side === 0 && (from < 0 || from > 5)) return false;
    if (side === 1 && (from < 18 || from > 23)) return false;
    if (!allInHome(state, side)) return false;
    return isValidDieForBearOff(state, side, from, dieUsed);
  }

  // Regular move
  if (typeof to !== 'number' || to < 0 || to > 23) return false;
  const expectedDie = side === 0 ? from - to : to - from;
  if (dieUsed !== expectedDie) return false;
  if (expectedDie <= 0) return false;
  return canLand(state, side, to);
}

// ---- Move Execution ----

function executeMove(state, side, from, to) {
  const hitInfo = { hit: false, enemy: -1 };

  // Leave source
  if (from === 'bar') {
    state.bar[side]--;
  } else {
    const pt = state.points[from];
    pt.count--;
    if (pt.count === 0) state.points[from] = null;
  }

  // Land on target
  if (to === 'off') {
    state.home[side]++;
  } else {
    const tgt = state.points[to];
    if (!tgt) {
      state.points[to] = { side, count: 1 };
    } else if (tgt.side === side) {
      tgt.count++;
    } else if (tgt.count === 1) {
      // Hit blot
      const enemy = side === 0 ? 1 : 0;
      state.points[to] = { side, count: 1 };
      state.bar[enemy]++;
      hitInfo.hit = true;
      hitInfo.enemy = enemy;
    }
  }

  return hitInfo;
}

// ---- Legal Move Generation ----

function getLegalMovesForDie(state, side, die) {
  const moves = [];

  // Bar entry takes priority
  if (state.bar[side] > 0) {
    const target = entryPoint(side, die);
    if (canLand(state, side, target)) {
      moves.push({ from: 'bar', to: target, dieUsed: die });
    }
    return moves; // Must enter from bar first
  }

  for (let p = 0; p < 24; p++) {
    const pt = state.points[p];
    if (!pt || pt.side !== side || pt.count < 1) continue;

    if (side === 0) {
      const target = p - die;
      if (target >= 0) {
        if (canLand(state, side, target)) {
          moves.push({ from: p, to: target, dieUsed: die });
        }
      } else if (allInHome(state, side)) {
        if (isValidDieForBearOff(state, side, p, die)) {
          moves.push({ from: p, to: 'off', dieUsed: die });
        }
      }
    } else {
      const target = p + die;
      if (target <= 23) {
        if (canLand(state, side, target)) {
          moves.push({ from: p, to: target, dieUsed: die });
        }
      } else if (allInHome(state, side)) {
        if (isValidDieForBearOff(state, side, p, die)) {
          moves.push({ from: p, to: 'off', dieUsed: die });
        }
      }
    }
  }

  return moves;
}

function hasAnyLegalMove(state, side) {
  for (let d = 0; d < state.remainingDice.length; d++) {
    if (getLegalMovesForDie(state, side, state.remainingDice[d]).length > 0) return true;
  }
  return false;
}

// Generate all possible move sequences for a set of dice
function generateAllMoveSequences(state, side, dice) {
  if (dice.length === 0) return [[]];

  const results = [];
  const tried = new Set();

  for (let i = 0; i < dice.length; i++) {
    const die = dice[i];
    // Skip duplicate dice to avoid redundant sequences
    const dieKey = die + '_' + i;
    if (tried.has(die)) continue;
    tried.add(die);

    const moves = getLegalMovesForDie(state, side, die);
    if (moves.length === 0) {
      // Try with remaining dice (this die can't be used)
      const rest = dice.filter(function(_, j) { return j !== i; });
      const seqs = generateAllMoveSequences(state, side, rest);
      for (let s = 0; s < seqs.length; s++) {
        results.push(seqs[s]);
      }
    } else {
      for (let m = 0; m < moves.length; m++) {
        const move = moves[m];
        // Save state
        const savedBar = { 0: state.bar[0], 1: state.bar[1] };
        const savedHome = { 0: state.home[0], 1: state.home[1] };
        var savedFrom = null, savedTo = null;
        if (move.from === 'bar') {
          savedFrom = null;
        } else {
          const pt = state.points[move.from];
          savedFrom = pt ? { side: pt.side, count: pt.count } : null;
        }
        if (move.to === 'off') {
          savedTo = null;
        } else {
          const pt = state.points[move.to];
          savedTo = pt ? { side: pt.side, count: pt.count } : null;
        }

        // Apply
        executeMove(state, side, move.from, move.to);

        // Recurse
        const rest = dice.filter(function(_, j) { return j !== i; });
        const seqs = generateAllMoveSequences(state, side, rest);
        for (let s = 0; s < seqs.length; s++) {
          results.push([move].concat(seqs[s]));
        }

        // Restore
        state.bar[0] = savedBar[0]; state.bar[1] = savedBar[1];
        state.home[0] = savedHome[0]; state.home[1] = savedHome[1];
        if (move.from !== 'bar') {
          state.points[move.from] = savedFrom;
        }
        if (move.to !== 'off') {
          state.points[move.to] = savedTo;
        }
      }
    }
  }

  return results;
}

// ---- Pip Count ----

function pipCount(state, side) {
  let count = state.bar[side] * 25; // bar pieces cost 25 pips to re-enter
  for (let p = 0; p < 24; p++) {
    const pt = state.points[p];
    if (pt && pt.side === side) {
      if (side === 0) {
        count += pt.count * (p + 1); // distance from bear-off
      } else {
        count += pt.count * (24 - p);
      }
    }
  }
  return count;
}

// ---- Handle Move ----

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';
  if (state.currentPlayer !== playerIndex) return '不是你的回合';

  // Pass / end turn
  if (!data || data.pass) {
    state.currentPlayer = 1 - playerIndex;
    state.hasRolled = false;
    state.dice = [];
    state.remainingDice = [];
    return null;
  }

  // Roll dice
  if (data.roll) {
    if (state.hasRolled) return '已经掷过骰子了';
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    if (d1 === d2) {
      state.dice = [d1, d1, d1, d1];
      state.remainingDice = [d1, d1, d1, d1];
    } else {
      state.dice = [d1, d2];
      state.remainingDice = [d1, d2];
    }
    state.hasRolled = true;

    // Check if any legal move exists
    if (!hasAnyLegalMove(state, playerIndex)) {
      state.currentPlayer = 1 - playerIndex;
      state.hasRolled = false;
      state.dice = [];
      state.remainingDice = [];
    }
    return null;
  }

  // Move piece
  if (!state.hasRolled) return '请先掷骰子';

  const { from, to } = data;
  if (from === undefined || to === undefined) return '无效的操作';

  // Auto-determine die value if not specified
  var dieUsed = data.dieUsed;
  if (!dieUsed) {
    if (from === 'bar') {
      dieUsed = playerIndex === 0 ? 24 - to : to + 1;
    } else if (to === 'off') {
      dieUsed = bearOffDie(playerIndex, from);
    } else {
      dieUsed = playerIndex === 0 ? from - to : to - from;
    }
  }

  if (!validateMove(state, playerIndex, from, to, dieUsed)) return '不合法的走法';

  // Execute
  executeMove(state, playerIndex, from, to);

  // Remove used die
  const dIdx = state.remainingDice.indexOf(dieUsed);
  state.remainingDice.splice(dIdx, 1);

  // Check win
  if (state.home[playerIndex] >= 15) {
    state.winner = playerIndex;
    return null;
  }

  // Check if turn should end
  if (state.remainingDice.length === 0 || !hasAnyLegalMove(state, playerIndex)) {
    state.currentPlayer = 1 - playerIndex;
    state.hasRolled = false;
    state.dice = [];
    state.remainingDice = [];
  }

  return null;
};

// ---- Player View ----

function getAllLegalMoves(state, side) {
  const moves = [];
  for (let d = 0; d < state.remainingDice.length; d++) {
    const mvs = getLegalMovesForDie(state, side, state.remainingDice[d]);
    for (let m = 0; m < mvs.length; m++) {
      moves.push(mvs[m]);
    }
  }
  return moves;
}

exports.playerView = function(state, playerIndex) {
  var view = {
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    points: state.points,
    bar: state.bar,
    home: state.home,
    dice: state.dice,
    remainingDice: state.remainingDice,
    hasRolled: state.hasRolled,
    _playerCount: state._playerCount,
  };
  if (state.winner === null && state.currentPlayer === playerIndex && state.hasRolled) {
    view.legalMoves = getAllLegalMoves(state, playerIndex);
  } else {
    view.legalMoves = [];
  }
  return view;
};

// ---- Exports for bot ----
exports._pipCount = pipCount;
exports._generateAllMoveSequences = generateAllMoveSequences;
exports._getLegalMovesForDie = getLegalMovesForDie;
exports._hasAnyLegalMove = hasAnyLegalMove;
exports._allInHome = allInHome;
