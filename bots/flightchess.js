// bots/flightchess.js — AI for 飞行棋
// Simple greedy strategy: prioritize launching > capturing > advancing furthest plane

exports.name = 'flightchess';

exports.createBot = (playerIndex) => ({
  name: `电脑${playerIndex + 1}`,
  playerIndex,
  getMove(state) {
    const pData = state.players[playerIndex];
    const dice = state.dice;

    // If we haven't rolled yet, just roll
    if (!state.hasRolled) {
      return { action: 'roll' };
    }

    // Find the best plane to move
    // Priority: plane that can launch > plane that captures an opponent > furthest plane
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < 4; i++) {
      const pos = pData.planes[i];
      if (pos === 58) continue; // already home (HOME=58)

      let score = -1;

      if (pos === -1) {
        // In base — can only move with 6
        if (dice === 6) score = 100; // launch has high priority
      } else if (pos >= 52) {
        // Home stretch
        if (pos + dice === 58) score = 200; // reaching home!
      } else {
        // On main path
        const newPos = pos + dice;
        if (newPos >= 52) {
          score = 150; // entering home stretch
        } else if (newPos < 52) {
          // Check if landing on an opponent
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
          score = capturesOpponent ? 120 : newPos; // capture or just advance
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
