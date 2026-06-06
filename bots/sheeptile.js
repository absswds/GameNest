// bots/sheeptile.js — 羊了个羊 AI (简单贪心)
exports.name = 'sheeptile';
exports.createBot = (playerIndex) => ({
  name: '电脑' + (playerIndex + 1),
  getMove(state) {
    const board = state.boards && state.boards[playerIndex];
    const slot = state.slots && state.slots[playerIndex];
    if (!board || !slot) return { pass: true };
    if (state.eliminated && state.eliminated[playerIndex]) return { pass: true };

    // Find unblocked tiles
    const unblocked = board.filter(t => !t.removed && !isBlockedSimple(t, board));
    if (unblocked.length === 0) return { pass: true };

    // Prefer tiles that match something already in slot (will create triplet sooner)
    const slotPats = new Set(slot.map(s => s.pattern));
    const matching = unblocked.filter(t => slotPats.has(t.pattern));
    const pick = matching.length > 0
      ? matching[Math.floor(Math.random() * matching.length)]
      : unblocked[Math.floor(Math.random() * unblocked.length)];

    return { type: 'pick', tileId: pick.id };
  },
});

function isBlockedSimple(tile, allTiles) {
  for (const t of allTiles) {
    if (t.removed || t.layer <= tile.layer) continue;
    const dr = Math.abs(t.row - tile.row + 0.5 * (t.layer - tile.layer));
    const dc = Math.abs(t.col - tile.col + 0.5 * (t.layer - tile.layer));
    if (dr < 1 && dc < 1) return true;
  }
  return false;
}
