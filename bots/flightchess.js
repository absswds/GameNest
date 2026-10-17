// bots/flightchess.js — AI for 飞行棋
// Simple greedy strategy: prioritize launching > capturing > advancing furthest plane

const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');
const game = require('../games/flightchess');

exports.name = 'flightchess';

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const pData = state.players[playerIndex];
    const dice = state.dice;

    if (!state.hasRolled) {
      return { action: 'roll' };
    }

    const diff = getDifficulty(state);
    const movable = [];
    for (let i = 0; i < 4; i++) {
      const pos = pData.planes[i];
      if (pos === 58) continue;
      if (pos === -1 && dice !== 6) continue;
      movable.push(i);
    }
    if (movable.length === 0) return { pass: true };

    if (diff === 'hard') return { action: 'move', planeIndex: bestByLookahead(state, playerIndex, movable) };

    if (Math.random() < (diff === 'easy' ? 0.7 : 0.2)) {
      return { action: 'move', planeIndex: movable[Math.floor(Math.random() * movable.length)] };
    }

    let bestIdx = movable[0];
    let bestScore = -Infinity;

    for (const i of movable) {
      const pos = pData.planes[i];
      let score = -1;

      if (pos === -1) {
        score = 100;
      } else if (pos >= 52) {
        let target = pos + dice;
        if (target > 58) target = 58 - (target - 58);
        if (target === 58) score = 250;
        else if (target > pos) score = 50 + (target - pos);
        else score = target - pos;
      } else {
        const newPos = pos + dice;
        if (newPos >= 52) {
          score = 160;
        } else {
          const absPos = (playerIndex * 13 + newPos) % 52;
          let capturesOpponent = false;
          for (let pi = 0; pi < state.players.length; pi++) {
            if (pi === playerIndex) continue;
            for (let oi = 0; oi < 4; oi++) {
              const op = state.players[pi].planes[oi];
              if (op >= 0 && op < 52 && (pi * 13 + op) % 52 === absPos) {
                capturesOpponent = true;
              }
            }
          }
          score = capturesOpponent ? 120 : newPos;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      return { action: 'move', planeIndex: bestIdx };
    }

    // Fallback: try first available plane
    for (let i = 0; i < 4; i++) {
      if (pData.planes[i] >= 0 && pData.planes[i] < 52) {
        return { action: 'move', planeIndex: i };
      }
    }

    // No valid move — shouldn't happen (check would have prevented roll)
    return { action: 'move', planeIndex: 0 };
  },
});

// ---- Hard: play each candidate on a copy of the state (so captures, the +4 jump and the fly line are exact),
// then score the resulting position: progress, opponents sent home, and how exposed our planes are.
const HOME = 58;
const DW = 0.7, TW = 1; // weight of exposure to capture / of the opponents' progress
const LAUNCH_VALUE = 14; // a plane out of base is worth about a 6-roll
const absOf = (pi, step) => (pi * 13 + step) % 52;

function planeValue(step) {
  if (step < 0) return 0;
  if (step === HOME) return HOME + 30;
  return LAUNCH_VALUE + step;
}

function evaluate(planesByPlayer, me) {
  let mine = 0, theirs = 0;
  planesByPlayer.forEach((planes, pi) => {
    const v = planes.reduce((a, st) => a + planeValue(st), 0);
    if (pi === me) mine += v; else theirs += v;
  });
  const opps = planesByPlayer.length - 1;
  let danger = 0;
  planesByPlayer[me].forEach((st) => {
    if (st < 0 || st >= 52) return;
    const a = absOf(me, st);
    let hits = 0;
    planesByPlayer.forEach((planes, pi) => {
      if (pi === me) return;
      let seenBase = false;
      for (const ost of planes) {
        if (ost === -1) { seenBase = true; continue; }
        if (ost < 0 || ost >= 52) continue;
        const d = (a - absOf(pi, ost) + 52) % 52;
        if (d >= 1 && d <= 6) hits++;
      }
      if (seenBase && a === absOf(pi, 0)) hits++; // sits on an opponent's launch cell
    });
    danger += Math.min(1, hits / 6) * planeValue(st);
  });
  return mine - theirs * TW / Math.max(1, opps) - danger * DW;
}

function bestByLookahead(state, me, movable) {
  let best = movable[0], bestScore = -Infinity;
  for (const i of movable) {
    const sim = {
      players: state.players.map((p) => ({ planes: p.planes.slice(), finished: p.finished, noSixStreak: p.noSixStreak })),
      currentPlayer: me, winner: null, dice: state.dice, hasRolled: true,
      consecutiveSixes: state.consecutiveSixes || 0, _playerCount: state._playerCount, _lang: state._lang,
    };
    const err = game.handleMove({ action: 'move', planeIndex: i }, sim, me);
    if (err) continue;
    let score = evaluate(sim.players.map((p) => p.planes), me);
    if (sim.winner === me) score += 1000;
    if (sim.dice === 6 && sim.hasRolled === false && sim.currentPlayer === me) score += 8; // extra roll
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
