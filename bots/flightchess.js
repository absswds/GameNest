// bots/flightchess.js — AI for 飞行棋
// Simple greedy strategy: prioritize launching > capturing > advancing furthest plane

const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

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

    if (diff === 'easy' && Math.random() < 0.45) {
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
          score = capturesOpponent ? (diff === 'hard' ? 220 : 120) : newPos;
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
