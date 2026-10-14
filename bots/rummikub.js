// bots/rummikub.js — Rummikub AI with wild card support
const { botName } = require('./lib/bot-name');

exports.name = 'rummikub';

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  getMove(state) {
    // A pending initial meld (sets laid but total still < 30) must be finished, not ended.
    if (state.playedThisTurn[playerIndex] && !state.meldPending) return { endTurn: true };
    const hand = state.hands[playerIndex];
    if (!hand || hand.length === 0) return { pass: true };

    const requireBreak = (state._options && state._options.requireBreak !== undefined)
      ? state._options.requireBreak : true;
    const hasBroken = state.hasBroken[playerIndex];

    // Try to find valid sets in hand (including wild cards)
    if (!hasBroken && requireBreak) {
      // Initial meld: several disjoint sets may add up to 30; lay them one per call
      // (the server keeps them pending until the total is reached).
      const need = 30 - (state.meldPending ? state.meldPending.score : 0);
      const combo = findBreakCombo(hand, need);
      if (combo) return { tileIds: combo[0].map(t => t.id) };
      return { pass: true };
    }
    const candidates = findSets(hand, false);
    if (candidates.length > 0) {
      const best = candidates[0];
      return { tileIds: best.map(t => t.id) };
    }

    // Try to add a single tile to existing table sets
    if (hasBroken || !requireBreak) {
      for (let i = 0; i < hand.length; i++) {
        for (let j = 0; j < state.table.length; j++) {
          const test = [...state.table[j], hand[i]];
          if (isValidForBot(test)) {
            return { tileIds: [hand[i].id], targetSet: j };
          }
        }
      }
    }

    // Note: full table re-manipulation is intentionally not attempted by the bot —
    // a partial reform would drop existing table tiles (now rejected by the server).
    // The bot sticks to safe moves: play a hand set, append one tile, or draw.

    // Can't play, draw
    return { pass: true };
  },
});

function isValidForBot(tiles) {
  if (tiles.length < 3) return false;
  const nonWild = tiles.filter(t => !t.wild);
  if (nonWild.length === 0) return false;
  const colors = new Set(nonWild.map(t => t.color));
  const nums = new Set(nonWild.map(t => t.num));

  // Check duplicates in runs
  const sortedNums = [...nums].sort((a, b) => a - b);
  if (colors.size === 1) {
    if (tiles.length > 13) return false;
    const s = nonWild.map(t => t.num).sort((a, b) => a - b);
    for (let i = 1; i < s.length; i++) {
      if (s[i] === s[i-1]) return false;
    }
    let gaps = 0;
    for (let i = 1; i < s.length; i++) gaps += s[i] - s[i - 1] - 1;
    return gaps <= tiles.filter(t => t.wild).length;
  }

  if (nums.size === 1 && colors.size === nonWild.length && tiles.length <= 4 && nonWild.length >= 2) return true;
  return false;
}

function tileScore(tiles) {
  return tiles.reduce((sum, t) => sum + (t.wild ? 0 : t.num), 0);
}

// Meld value of a set the bot builds: jokers count as the tile they stand for.
function meldValue(tiles) {
  const nonWild = tiles.filter(t => !t.wild);
  if (nonWild.length === 0) return 0;
  if (new Set(nonWild.map(t => t.num)).size === 1) return nonWild[0].num * tiles.length;
  const nums = nonWild.map(t => t.num);
  const min = Math.min(...nums), max = Math.max(...nums);
  let sum = 0;
  for (let n = min; n <= max; n++) sum += n;
  return sum;
}

// Smallest list of disjoint sets from hand whose meld values total >= need, or null.
function findBreakCombo(hand, need) {
  const cands = findSets(hand, false).slice(0, 60)
    .map(set => ({ set, ids: set.map(t => t.id), val: meldValue(set) }));
  const dfs = (start, used, total, left, picked) => {
    if (total >= need) return picked;
    if (left === 0) return null;
    for (let i = start; i < cands.length; i++) {
      const c = cands[i];
      if (c.ids.some(id => used.has(id))) continue;
      const next = new Set(used); c.ids.forEach(id => next.add(id));
      const r = dfs(i + 1, next, total + c.val, left - 1, [...picked, c.set]);
      if (r) return r;
    }
    return null;
  };
  for (let depth = 1; depth <= 4; depth++) {
    const r = dfs(0, new Set(), 0, depth, []);
    if (r) return r;
  }
  return null;
}

function findSets(hand, needBreak) {
  const results = [];
  const wilds = hand.filter(t => t.wild);

  // Look for runs (same color, consecutive)
  const byColor = {};
  for (const t of hand) {
    if (t.wild) continue;
    if (!byColor[t.color]) byColor[t.color] = [];
    byColor[t.color].push(t);
  }
  for (const [, tiles] of Object.entries(byColor)) {
    tiles.sort((a, b) => a.num - b.num);
    for (let i = 0; i < tiles.length; i++) {
      const run = [tiles[i]];
      let wildsUsed = 0;
      for (let j = i + 1; j < tiles.length; j++) {
        const last = run[run.length - 1].wild ? run[run.length - 2] : run[run.length - 1];
        if (tiles[j].num === last.num) continue;
        const gap = tiles[j].num - last.num - 1;
        if (gap === 0) {
          run.push(tiles[j]);
        } else if (wildsUsed + gap <= wilds.length) {
          // Use wilds to fill gaps if available
          for (let w = 0; w < gap; w++) run.push(wilds[wildsUsed++]);
          run.push(tiles[j]);
        } else {
          break;
        }
      }
      if (run.length >= 3 && isValidForBot(run)) {
        if (!needBreak || tileScore(run) >= 30) {
          results.push(run);
        }
      }
    }
  }

  // Look for groups (same number, different colors) — include wilds as color-fillers
  const byNum = {};
  for (const t of hand) {
    if (t.wild) continue;
    if (!byNum[t.num]) byNum[t.num] = [];
    if (!byNum[t.num].find(x => x.color === t.color)) {
      byNum[t.num].push(t);
    }
  }
  // Check if wilds can complete groups
  for (const [, tiles] of Object.entries(byNum)) {
    const group = tiles.slice(0, 4);
    if (group.length >= 2) {
      const total = group.length + wilds.length;
      if (total >= 3 && total <= 4) {
        if (!needBreak || tileScore(group) >= 30) {
          const full = [...group];
          for (let w = 0; w < Math.min(wilds.length, 4 - group.length); w++) {
            full.push(wilds[w]);
          }
          results.push(full);
        }
      }
    }
    if (tiles.length >= 3) {
      if (!needBreak || tileScore(tiles.slice(0, 4)) >= 30) {
        results.push(tiles.slice(0, 4));
      }
    }
  }

  results.sort((a, b) => tileScore(b) - tileScore(a));
  return results;
}
