const gameMod = require('../games/sheeptile');

function levelTiles(state, level) { return gameMod._internal.levelTiles(state, level); }
function isBlocked(tile, lvTiles, removed) { return gameMod._internal.isBlockedAt(tile, lvTiles, removed); }
function eff(state, pi, tile) { return gameMod._internal.effPattern(state, pi, tile); }

exports.name = 'sheeptile';

exports.createBot = (playerIndex) => ({
  name: '电脑' + (playerIndex + 1),
  getMove(state) {
    const me = state.players && state.players[playerIndex];
    if (!me || me.eliminated) return { pass: true };

    const lvTiles = levelTiles(state, me.level);
    const clickable = lvTiles.filter((tile) => !me.removed[tile.id] && !isBlocked(tile, lvTiles, me.removed));
    if (clickable.length === 0) return { pass: true };

    const slotCount = {};
    me.slot.forEach((slotTile) => {
      slotCount[slotTile.pattern] = (slotCount[slotTile.pattern] || 0) + 1;
    });

    let bestTile = null;
    let bestScore = -Infinity;

    for (const tile of clickable) {
      const score = scorePick(state, playerIndex, tile, clickable, slotCount, me.slot.length);
      if (score > bestScore) {
        bestScore = score;
        bestTile = tile;
      }
    }

    if (me.slot.length >= 5 && bestScore < 75) {
      if (me.powers.pop3 > 0) return { type: 'power_pop3' };
      if (me.powers.shuffle > 0) return { type: 'power_shuffle' };
      if (me.powers.undo > 0) return { type: 'power_undo' };
    }

    return { type: 'pick', tileId: bestTile.id };
  },
});

function scorePick(state, playerIndex, tile, clickable, slotCount, slotLength) {
  const pattern = eff(state, playerIndex, tile);
  const current = slotCount[pattern] || 0;
  const exposedMatches = clickable.filter((candidate) => eff(state, playerIndex, candidate) === pattern).length;
  const futureCopies = Math.max(0, exposedMatches - 1);
  const resultingCount = current + 1;
  const resultingLength = resultingCount === 3 ? slotLength - 2 : slotLength + 1;
  const clearsNow = resultingCount === 3;

  let score = 0;

  if (clearsNow) score += 220;
  else if (resultingCount === 2) score += 85;
  else score += 10;

  score += futureCopies * 28;
  score -= resultingLength * 6;

  if (slotLength >= 5) {
    if (clearsNow) score += 120;
    else if (resultingCount === 2 && futureCopies > 0) score += 70;
    else if (resultingLength >= 7) score -= 200;
    else if (resultingLength === 6) score -= 26;
  }

  const diversityPenalty = current === 0 ? 14 : 0;
  score -= diversityPenalty;

  return score;
}
