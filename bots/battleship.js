// bots/battleship.js — AI for 战舰
// Easy: random | Normal: hunt/target | Hard: hunt/target + parity

const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'battleship';

const ROWS = 10;
const COLS = 10;

exports.createBot = function (playerIndex) {
  return {
    name: botName(playerIndex),
    getMove: function (state) {
      var difficulty = getDifficulty(state);
      if (state.phase === 'placing') {
        return getPlacementMove(state, playerIndex);
      }
      if (state.phase === 'shooting') {
        if (difficulty === 'easy') return getRandomShootMove(state, playerIndex);
        if (difficulty === 'hard') return getSmartShootMove(state, playerIndex, true);
        return getSmartShootMove(state, playerIndex, false);
      }
      return { pass: true };
    },
  };
};

function getPlacementMove(state, playerIndex) {
  var sizes = state.shipSizes;
  var placed = state.placedCount[playerIndex];
  if (placed >= sizes.length) return { pass: true };

  var size = sizes[placed];
  var ships = state.ships[playerIndex];

  // Try random placements until valid
  for (var attempt = 0; attempt < 200; attempt++) {
    var orientation = Math.random() < 0.5 ? 'h' : 'v';
    var r, c;
    if (orientation === 'h') {
      r = Math.floor(Math.random() * ROWS);
      c = Math.floor(Math.random() * (COLS - size + 1));
    } else {
      r = Math.floor(Math.random() * (ROWS - size + 1));
      c = Math.floor(Math.random() * COLS);
    }

    if (canPlace(ships, r, c, orientation, size)) {
      return { r: r, c: c, orientation: orientation, size: size };
    }
  }

  // Fallback: scan systematically
  for (var r2 = 0; r2 < ROWS; r2++) {
    for (var c2 = 0; c2 < COLS; c2++) {
      if (canPlace(ships, r2, c2, 'h', size)) {
        return { r: r2, c: c2, orientation: 'h', size: size };
      }
      if (canPlace(ships, r2, c2, 'v', size)) {
        return { r: r2, c: c2, orientation: 'v', size: size };
      }
    }
  }
  return { r: 0, c: 0, orientation: 'h', size: size };
}

function canPlace(ships, r, c, orientation, size) {
  for (var i = 0; i < size; i++) {
    var cr = orientation === 'v' ? r + i : r;
    var cc = orientation === 'h' ? c + i : c;
    if (cr < 0 || cr >= ROWS || cc < 0 || cc >= COLS) return false;
  }
  for (var s = 0; s < ships.length; s++) {
    var ship = ships[s];
    for (var j = 0; j < ship.cells.length; j++) {
      for (var k = 0; k < size; k++) {
        var tr = orientation === 'v' ? r + k : r;
        var tc = orientation === 'h' ? c + k : c;
        if (ship.cells[j].r === tr && ship.cells[j].c === tc) return false;
      }
    }
  }
  return true;
}

function getAlreadyShot(state, playerIndex) {
  var set = {};
  var shots = state.shots[playerIndex];
  for (var i = 0; i < shots.length; i++) {
    set[shots[i].r + ',' + shots[i].c] = true;
  }
  return set;
}

function getRandomShootMove(state, playerIndex) {
  var shot = getAlreadyShot(state, playerIndex);
  var candidates = [];
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (!shot[r + ',' + c]) candidates.push({ r: r, c: c });
    }
  }
  if (candidates.length === 0) return { pass: true };
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function getSmartShootMove(state, playerIndex, parity) {
  var shot = getAlreadyShot(state, playerIndex);

  // Hunt mode: look for unsunk hit cells to target
  var hits = [];
  var shots = state.shots[playerIndex];
  for (var i = 0; i < shots.length; i++) {
    if (shots[i].result === 'hit') {
      hits.push(shots[i]);
    }
  }

  // Target mode: if we have unsunk hits, try adjacent cells
  if (hits.length > 0) {
    var directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    var targets = [];

    // If multiple hits, try to find line direction
    if (hits.length >= 2) {
      // Check if hits form a line
      var sameRow = hits.every(function (h) { return h.r === hits[0].r; });
      var sameCol = hits.every(function (h) { return h.c === hits[0].c; });

      if (sameRow) {
        // Horizontal line - extend left and right
        var minC = Math.min.apply(null, hits.map(function (h) { return h.c; }));
        var maxC = Math.max.apply(null, hits.map(function (h) { return h.c; }));
        var row = hits[0].r;
        if (minC - 1 >= 0 && !shot[row + ',' + (minC - 1)]) {
          targets.push({ r: row, c: minC - 1 });
        }
        if (maxC + 1 < COLS && !shot[row + ',' + (maxC + 1)]) {
          targets.push({ r: row, c: maxC + 1 });
        }
      } else if (sameCol) {
        // Vertical line - extend up and down
        var minR = Math.min.apply(null, hits.map(function (h) { return h.r; }));
        var maxR = Math.max.apply(null, hits.map(function (h) { return h.r; }));
        var col = hits[0].c;
        if (minR - 1 >= 0 && !shot[(minR - 1) + ',' + col]) {
          targets.push({ r: minR - 1, c: col });
        }
        if (maxR + 1 < ROWS && !shot[(maxR + 1) + ',' + col]) {
          targets.push({ r: maxR + 1, c: col });
        }
      }
    }

    // Fallback: try all 4 directions from each hit
    if (targets.length === 0) {
      for (var h = 0; h < hits.length; h++) {
        for (var d = 0; d < directions.length; d++) {
          var nr = hits[h].r + directions[d][0];
          var nc = hits[h].c + directions[d][1];
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !shot[nr + ',' + nc]) {
            targets.push({ r: nr, c: nc });
          }
        }
      }
    }

    if (targets.length > 0) {
      return targets[Math.floor(Math.random() * targets.length)];
    }
  }

  // Hunt mode: pick random cell (parity on hard)
  var candidates = [];
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (shot[r + ',' + c]) continue;
      if (parity && (r + c) % 2 !== 0) continue;
      candidates.push({ r: r, c: c });
    }
  }

  // If parity leaves no candidates, relax
  if (candidates.length === 0) {
    for (var r2 = 0; r2 < ROWS; r2++) {
      for (var c2 = 0; c2 < COLS; c2++) {
        if (!shot[r2 + ',' + c2]) candidates.push({ r: r2, c: c2 });
      }
    }
  }

  if (candidates.length === 0) return { pass: true };
  return candidates[Math.floor(Math.random() * candidates.length)];
}
