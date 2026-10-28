const gameMod = require('../games/sheeptile');
const { botName } = require('./lib/bot-name');
const { pickFor } = require('./lib/difficulty');

function levelTiles(state, level) { return gameMod._internal.levelTiles(state, level); }
function isBlocked(tile, lvTiles, removed) { return gameMod._internal.isBlockedAt(tile, lvTiles, removed); }
function eff(state, pi, tile) { return gameMod._internal.effPattern(state, pi, tile); }

exports.name = 'sheeptile';

// Provisional values; will be set by scripts/bot-tier-eval.js --calibrate
const PICK = { temp: { easy: 80, normal: 25 }, maxLoss: { easy: 300, normal: 100 } };

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  getMove(state) {
    const me = state.players && state.players[playerIndex];
    if (!me || me.eliminated) return { pass: true };

    const lvTiles = levelTiles(state, me.level);
    const clickable = lvTiles.filter((tile) => !me.removed[tile.id] && !isBlocked(tile, lvTiles, me.removed));
    if (clickable.length === 0) return { pass: true };
    if (clickable.length === 1 && me.slot.length < 4) return { type: 'pick', tileId: clickable[0].id };

    const slotCount = {};
    me.slot.forEach((slotTile) => {
      slotCount[slotTile.pattern] = (slotCount[slotTile.pattern] || 0) + 1;
    });

    const cands = [];

    for (const tile of clickable) {
      let score = scorePick(state, playerIndex, tile, clickable, slotCount, me.slot.length);

      // Lookahead: bonus if removing this tile unblocks useful matching tiles below it
      const simulatedRemoved = { ...me.removed, [tile.id]: true };
      let unblockBonus = 0;
      for (const candidate of lvTiles) {
        if (simulatedRemoved[candidate.id]) continue;
        if (isBlocked(candidate, lvTiles, me.removed) && !isBlocked(candidate, lvTiles, simulatedRemoved)) {
          const candPat = eff(state, playerIndex, candidate);
          if (candPat === eff(state, playerIndex, tile) || slotCount[candPat]) {
            unblockBonus += 35;
          } else {
            unblockBonus += 10;
          }
        }
      }
      score += unblockBonus;

      // identical tiles (same pattern, same score) are the same move: keep the first only
      const pat = eff(state, playerIndex, tile);
      if (cands.some((c) => c.pat === pat && Math.abs(c.score - score) < 1e-9)) continue;
      cands.push({ move: { type: 'pick', tileId: tile.id }, score, pat, fills: fillsTray(state, playerIndex, slotCount, pat, me.slot.length) });
    }

    // A pick that fills the tray loses on the spot: drop it whenever a safe option exists.
    const safe = cands.filter((c) => !c.fills);
    if (safe.length && safe.length < cands.length) cands.splice(0, cands.length, ...safe);

    if (me.slot.length >= 4) {
      if (me.powers.pop3 > 0) cands.push({ move: { type: 'power_pop3' }, score: 85 });
      else if (me.powers.shuffle > 0) cands.push({ move: { type: 'power_shuffle' }, score: 85 });
      else if (me.powers.undo > 0) cands.push({ move: { type: 'power_undo' }, score: 85 });
    }

    cands.sort((a, b) => b.score - a.score);
    return pickFor(state, cands, PICK);
  },
});

function fillsTray(state, playerIndex, slotCount, pattern, slotLength) {
  return (slotCount[pattern] || 0) + 1 < 3 && slotLength + 1 >= (state.slotSize || 7);
}

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
    if (!clearsNow && !(resultingCount === 2 && futureCopies > 0) && (state.players[playerIndex].powers.pop3 > 0 || state.players[playerIndex].powers.shuffle > 0 || state.players[playerIndex].powers.undo > 0)) score -= 100;
  }

  const diversityPenalty = current === 0 ? 14 : 0;
  score -= diversityPenalty;

  return score;
}
