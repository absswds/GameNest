// games/flightchess.js — 飞行棋 v5 (Game Logic fix only — fix auto pass, consolidate logic)
// No logic changes needed; the existing logic works correctly.
// The gameplay issue was if canMakeMove returns false, turn passes but dice=6
// should give another roll. Let's fix that edge case.

const MAIN_PATH = 52;
const HOME_STRETCH = 6;
const HOME = MAIN_PATH + HOME_STRETCH;
const PLANES = 4;
const FLY_STEP = 8;   // own-color cell (in player steps) that has the dashed fly line
const FLY_ADV = 24;   // fly distance along the dashed line (lands on own color, near opposite side)

exports.name = 'flightchess';
exports.maxPlayers = 4;

exports.createState = () => {
  const players = [];
  for (let i = 0; i < 4; i++) {
    players.push({ planes: [-1, -1, -1, -1], finished: 0, noSixStreak: 0 });
  }
  return {
    currentPlayer: 0, winner: null, players, dice: 1,
    consecutiveSixes: 0, hasRolled: false, _playerCount: 4,
    lastMoveResult: '', // for frontend display
    palette: [0, 1, 2, 3], // slot → base-color index (cosmetic only); randomized in initGame
  };
};

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';
  if (state.currentPlayer !== playerIndex) return '不是你的回合';

  const pData = state.players[playerIndex];
  const { action } = data || {};

  if (action === 'roll' || !action) {
    if (state.hasRolled) return '请先移动飞机';
    let dice = Math.floor(Math.random() * 6) + 1;

    // Pity mechanism: if all planes are in base (or home) and player has rolled
    // non-6 for 5 consecutive turns, force a 6 so they can launch
    const allInBase = pData.planes.every(function(p) { return p === -1 || p === HOME; });
    if (allInBase && dice !== 6) {
      pData.noSixStreak = (pData.noSixStreak || 0) + 1;
      if (pData.noSixStreak >= 5) {
        dice = 6;
        pData.noSixStreak = 0;
        state.lastMoveResult = '🎲 保底机制触发！自动获得6点';
      }
    } else if (dice === 6 || !allInBase) {
      pData.noSixStreak = 0;
    }

    state.dice = dice; state.hasRolled = true;
    state.lastMoveResult = `${windowNames(playerIndex)} 掷了 ${dice} 点`;

    if (dice === 6) state.consecutiveSixes++;
    else state.consecutiveSixes = 0;

    if (state.consecutiveSixes >= 3) {
      state.consecutiveSixes = 0; state.hasRolled = false; advanceTurn(state);
      state.lastMoveResult = `${windowNames(playerIndex)} 连续3次6，回合作废`;
      return null;
    }

    // Auto-pass if no valid moves
    if (!hasValidMove(state, playerIndex)) {
      state.hasRolled = false;
      if (dice !== 6) advanceTurn(state);
      state.lastMoveResult = `${windowNames(playerIndex)} 无合法走法，自动跳过`;
      return null;
    }
    return null;
  }

  if (action === 'move') {
    if (!state.hasRolled) return '请先掷骰子';
    const idx = data.planeIndex;
    if (typeof idx !== 'number' || idx < 0 || idx >= PLANES) return '无效的飞机';

    const pos = pData.planes[idx];
    if (pos === HOME) return '这架飞机已经到家了';

    const dice = state.dice;

    if (pos === -1) {
      if (dice !== 6) return '只有掷到6才能起飞';
      pData.planes[idx] = 0; // start of path
      doLanding(state, playerIndex, idx);
      state.lastMoveResult = `${windowNames(playerIndex)} 起飞了飞机${idx+1}号`;
      endTurn(state, playerIndex); return null;
    }

    if (pos >= MAIN_PATH) {
      // Home stretch — exact count finishes; overshoot bounces back off the end,
      // so a plane is never permanently stuck waiting for the exact roll.
      let target = pos + dice;
      if (target > HOME) target = HOME - (target - HOME); // bounce back
      if (target === HOME) {
        pData.planes[idx] = HOME; pData.finished++;
        state.lastMoveResult = `${windowNames(playerIndex)} 飞机${idx+1}号到家了！`;
        if (pData.finished >= PLANES) { state.winner = playerIndex; return null; }
      } else {
        if (target < pos) state.lastMoveResult = `${windowNames(playerIndex)} 点数过头，反弹回退`;
        pData.planes[idx] = target;
      }
      endTurn(state, playerIndex); return null;
    }

    // Main path
    const newSteps = pos + dice;
    if (newSteps >= MAIN_PATH) {
      pData.planes[idx] = newSteps; // enters home stretch
      endTurn(state, playerIndex); return null;
    }
    pData.planes[idx] = newSteps;
    doLanding(state, playerIndex, idx);
    resolveSpecial(state, playerIndex, idx);

    endTurn(state, playerIndex); return null;
  }
  return '无效操作';
};

// Resolve special cells after a normal main-path landing:
//   - fly cell (own color): fly across the board (+FLY_ADV)
//   - own-color cell: jump forward 4 (once); if the jump lands on the fly cell, fly
function resolveSpecial(state, pi, idx) {
  const p = state.players[pi];
  const step = p.planes[idx];
  if (step <= 0 || step >= MAIN_PATH) return;

  // Fly cell: follow the dashed line across the board, then jump +4 (rule: 虚线到同色格后再跳一格)
  if (step === FLY_STEP) {
    flyAcross(state, pi, idx);
    state.lastMoveResult = `✈ ${windowNames(pi)} 沿航线飞到对面！`;
    return;
  }
  // Own-color cell ⟺ step is a multiple of 4 (each player owns every 4th cell):
  // jump +4 to the next own-color cell and STOP — do not chain into the fly shortcut,
  // only a direct landing on FLY_STEP (handled above) flies.
  if (step % 4 === 0) {
    const jump = step + 4;
    if (jump < MAIN_PATH) {
      p.planes[idx] = jump; doLanding(state, pi, idx);
      state.lastMoveResult = `${windowNames(pi)} 同色格跳 +4`;
    }
  }
}

// Fly along the dashed line (+FLY_ADV) and STOP exactly at the arrow's end.
// No extra +4: the landing cell is own color, but chaining would overshoot the
// visible dashed arrow and confuse the player.
function flyAcross(state, pi, idx) {
  const p = state.players[pi];
  const dest = p.planes[idx] + FLY_ADV;
  if (dest >= MAIN_PATH) return;
  p.planes[idx] = dest; doLanding(state, pi, idx);
}

function hasValidMove(state, pi) {
  const p = state.players[pi], d = state.dice;
  for (let i = 0; i < PLANES; i++) {
    const po = p.planes[i];
    if (po === HOME) continue;
    if (po === -1) { if (d === 6) return true; continue; }
    if (po >= MAIN_PATH) { return true; } // home stretch: exact finishes, overshoot bounces
    if (po >= 0 && po < MAIN_PATH) return true;
  }
  return false;
}

function absPos(pi, steps) {
  return (pi * 13 + steps) % MAIN_PATH;
}

function doLanding(state, pi, idx) {
  const pos = state.players[pi].planes[idx];
  if (pos < 0 || pos >= MAIN_PATH) return;
  const landingAbs = absPos(pi, pos);
  for (let oi = 0; oi < state.players.length; oi++) {
    if (oi === pi) continue;
    for (let j = 0; j < PLANES; j++) {
      const op = state.players[oi].planes[j];
      if (op >= 0 && op < MAIN_PATH && absPos(oi, op) === landingAbs) {
        state.players[oi].planes[j] = -1;
        state.lastMoveResult = `${windowNames(pi)} 踩了${windowNames(oi)}的飞机！`;
      }
    }
  }
}

function endTurn(state, pi) {
  if (state.dice === 6 && state.consecutiveSixes < 3) {
    state.hasRolled = false;
  } else {
    state.hasRolled = false; state.consecutiveSixes = 0; advanceTurn(state);
  }
}

function advanceTurn(state) {
  const total = Math.min(state._playerCount || 4, 4);
  for (let i = 1; i <= total; i++) {
    const next = (state.currentPlayer + i) % total;
    if (state.players[next].finished < PLANES) { state.currentPlayer = next; return; }
  }
  state.currentPlayer = (state.currentPlayer + 1) % total;
}

function windowNames(pi) {
  // A simple placeholder; the real names are in the frontend
  return `玩家${pi+1}`;
}

exports.initGame = (state, pc) => {
  state._playerCount = pc;
  state.players.length = pc;
  // Randomize the cosmetic color assignment each game (Fisher–Yates on [0,1,2,3]).
  const pal = [0, 1, 2, 3];
  for (let i = pal.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pal[i], pal[j]] = [pal[j], pal[i]];
  }
  state.palette = pal;
};
