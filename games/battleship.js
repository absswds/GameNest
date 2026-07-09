// games/battleship.js — 战舰 (2 players)
// 10×10 board, 5 ships per player, per-player hidden view

const ROWS = 10;
const COLS = 10;
const SHIP_SIZES = [5, 4, 3, 3, 2];
const SHIP_NAMES = ['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer'];

exports.name = 'battleship';
exports.maxPlayers = 2;

exports.createState = function () {
  return {
    phase: 'placing',
    currentPlayer: 0,
    winner: null,
    ships: [[], []],
    shots: [[], []],
    shipSizes: SHIP_SIZES.slice(),
    placedCount: [0, 0],
    lastShotResult: null,
    _playerCount: 2,
  };
};

function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function getShipCells(r, c, orientation, size) {
  var cells = [];
  for (var i = 0; i < size; i++) {
    var cr = orientation === 'v' ? r + i : r;
    var cc = orientation === 'h' ? c + i : c;
    cells.push({ r: cr, c: cc });
  }
  return cells;
}

function canPlaceShip(ships, r, c, orientation, size) {
  var cells = getShipCells(r, c, orientation, size);
  for (var i = 0; i < cells.length; i++) {
    var cell = cells[i];
    if (!inBounds(cell.r, cell.c)) return false;
  }
  // Check overlap with existing ships
  for (var s = 0; s < ships.length; s++) {
    var ship = ships[s];
    for (var j = 0; j < ship.cells.length; j++) {
      for (var k = 0; k < cells.length; k++) {
        if (ship.cells[j].r === cells[k].r && ship.cells[j].c === cells[k].c) {
          return false;
        }
      }
    }
  }
  return true;
}

function isShipSunk(ship) {
  for (var i = 0; i < ship.cells.length; i++) {
    if (!ship.cells[i].hit) return false;
  }
  return true;
}

function allShipsSunk(ships) {
  for (var i = 0; i < ships.length; i++) {
    if (!isShipSunk(ships[i])) return false;
  }
  return ships.length > 0;
}

function findShipAt(ships, r, c) {
  for (var i = 0; i < ships.length; i++) {
    for (var j = 0; j < ships[i].cells.length; j++) {
      if (ships[i].cells[j].r === r && ships[i].cells[j].c === c) {
        return ships[i];
      }
    }
  }
  return null;
}

exports.handleMove = function (data, state, playerIndex) {
  if (state.winner !== null) return 'g_game_over';
  if (state.phase === 'placing') {
    return handlePlacing(data, state, playerIndex);
  } else if (state.phase === 'shooting') {
    return handleShooting(data, state, playerIndex);
  }
  return 'bs_invalid_phase';
};

function handlePlacing(data, state, playerIndex) {
  if (playerIndex !== 0 && playerIndex !== 1) return 'bs_invalid_player';
  if (data.pass) return null; // Already done placing — skip

  var r = data.r;
  var c = data.c;
  var orientation = data.orientation;
  var size = data.size;

  if (typeof r !== 'number' || typeof c !== 'number') return 'bs_invalid_coordinates';
  if (orientation !== 'h' && orientation !== 'v') return 'bs_invalid_orientation';

  var expectedSize = SHIP_SIZES[state.placedCount[playerIndex]];
  if (size !== expectedSize) return 'bs_wrong_ship_size';

  if (!canPlaceShip(state.ships[playerIndex], r, c, orientation, size)) {
    return 'bs_invalid_placement';
  }

  var cells = getShipCells(r, c, orientation, size).map(function (cell) {
    return { r: cell.r, c: cell.c, hit: false };
  });

  state.ships[playerIndex].push({
    type: SHIP_NAMES[state.placedCount[playerIndex]],
    cells: cells,
  });
  state.placedCount[playerIndex]++;

  // Both players placed all ships → transition to shooting
  if (state.placedCount[0] >= SHIP_SIZES.length && state.placedCount[1] >= SHIP_SIZES.length) {
    state.phase = 'shooting';
    state.currentPlayer = 0;
  }
  return null;
}

function handleShooting(data, state, playerIndex) {
  if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';

  var r = data.r;
  var c = data.c;

  if (typeof r !== 'number' || typeof c !== 'number') return 'bs_invalid_coordinates';
  if (!inBounds(r, c)) return 'bs_out_of_bounds';

  // Check if already shot at this position
  var myShots = state.shots[playerIndex];
  for (var i = 0; i < myShots.length; i++) {
    if (myShots[i].r === r && myShots[i].c === c) {
      return 'bs_already_shot';
    }
  }

  var enemyIdx = 1 - playerIndex;
  var enemyShips = state.ships[enemyIdx];
  var ship = findShipAt(enemyShips, r, c);

  var result;
  var shot = { r: r, c: c };
  if (ship) {
    // Mark cell as hit
    for (var j = 0; j < ship.cells.length; j++) {
      if (ship.cells[j].r === r && ship.cells[j].c === c) {
        ship.cells[j].hit = true;
        break;
      }
    }

    if (isShipSunk(ship)) {
      result = 'sunk';
      shot.result = 'sunk';
      shot.shipType = ship.type;
    } else {
      result = 'hit';
      shot.result = 'hit';
    }
  } else {
    result = 'miss';
    shot.result = 'miss';
  }

  state.shots[playerIndex].push(shot);
  state.lastShotResult = {
    player: playerIndex,
    r: r,
    c: c,
    result: result,
    shipType: shot.shipType || null,
  };

  // Check win
  if (allShipsSunk(enemyShips)) {
    state.winner = playerIndex;
    state.phase = 'over';
  } else {
    state.currentPlayer = 1 - playerIndex;
  }

  return null;
}

// Per-player view: hide opponent ship positions unless game is over
exports.playerView = function (state, playerIndex) {
  var enemyIdx = 1 - playerIndex;
  var enemyShips = state.ships[enemyIdx];

  // Build enemy board: only show shot results, not ship positions
  var enemyBoard = [];
  for (var r = 0; r < ROWS; r++) {
    enemyBoard[r] = [];
    for (var c = 0; c < COLS; c++) {
      var shotAt = null;
      var myShots = state.shots[playerIndex];
      for (var i = 0; i < myShots.length; i++) {
        if (myShots[i].r === r && myShots[i].c === c) {
          shotAt = myShots[i].result;
          break;
        }
      }
      enemyBoard[r][c] = {
        shot: shotAt, // 'hit' | 'miss' | 'sunk' | null
        shipType: null,
      };
      // If game over, reveal ship types
      if (state.winner !== null && shotAt === 'sunk') {
        var ship = findShipAt(enemyShips, r, c);
        if (ship) enemyBoard[r][c].shipType = ship.type;
      }
    }
  }

  // Build my board: show my ships and opponent shots on them
  var myBoard = [];
  for (var r2 = 0; r2 < ROWS; r2++) {
    myBoard[r2] = [];
    for (var c2 = 0; c2 < COLS; c2++) {
      myBoard[r2][c2] = { hasShip: false, shipType: null, shot: null };
    }
  }
  var myShips = state.ships[playerIndex];
  for (var s = 0; s < myShips.length; s++) {
    var sh = myShips[s];
    for (var j = 0; j < sh.cells.length; j++) {
      var cell = sh.cells[j];
      myBoard[cell.r][cell.c].hasShip = true;
      myBoard[cell.r][cell.c].shipType = sh.type;
      if (cell.hit) myBoard[cell.r][cell.c].shot = 'hit';
    }
  }
  // Opponent's shots on my board
  var enemyShots = state.shots[enemyIdx];
  for (var k = 0; k < enemyShots.length; k++) {
    var es = enemyShots[k];
    if (!myBoard[es.r][es.c].shot) {
      myBoard[es.r][es.c].shot = es.result;
    }
  }

  return {
    phase: state.phase,
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    myShips: myShips,
    myShots: state.shots[playerIndex],
    enemyBoard: enemyBoard,
    myBoard: myBoard,
    shipSizes: state.shipSizes,
    placedCount: state.placedCount,
    lastShotResult: state.lastShotResult,
    enemyShips: state.winner !== null ? enemyShips : null,
  };
};
