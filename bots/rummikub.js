// bots/rummikub.js — Rummikub AI with wild card support
const { botName } = require('./lib/bot-name');

exports.name = 'rummikub';

const { getDifficulty } = require('./lib/difficulty');

exports.createBot = (playerIndex) => {
  let plan = null; // hard: table rearrangement prepared before entering manipulate mode
  return {
  name: botName(playerIndex, 'zh'),
  getMove(state) {
    const diff = getDifficulty(state);
    if (state.phase === 'manipulate') {
      const groups = plan;
      plan = null;
      return groups ? { action: 'submit', groups } : { action: 'cancel' };
    }
    plan = null;
    const acted = state.playedThisTurn[playerIndex] && !state.meldPending;
    // easy plays a single action per turn; normal/hard keep laying tiles until nothing is left to play
    if (acted && diff === 'easy') return { endTurn: true };
    const hand = state.hands[playerIndex];
    if (!hand || hand.length === 0) return { pass: true };
    const stop = () => (acted ? { endTurn: true } : { pass: true });

    if (diff === 'easy' && Math.random() < 0.35 && !state.meldPending) {
      return { pass: true };
    }

    const requireBreak = (state._options && state._options.requireBreak !== undefined)
      ? state._options.requireBreak : true;
    const hasBroken = state.hasBroken[playerIndex];

    // Try to find valid sets in hand (including wild cards)
    if (!hasBroken && requireBreak) {
      // Initial meld: several disjoint sets may add up to 30; lay them one per call
      // (the server keeps them pending until the total is reached).
      const need = 30 - (state.meldPending ? state.meldPending.score : 0);
      const combo = findBreakCombo(hand, need, diff === 'hard');
      if (combo) return { tileIds: combo[0].map(t => t.id) };
      return { pass: true };
    }

    if (diff === 'hard') {
      const move = hardMove(state, hand);
      if (move && move.groups) { plan = move.groups; return { action: 'start_manipulate' }; }
      return move || stop();
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

    // Can't play, draw (or just end the turn if something was already played)
    return stop();
  },
  };
};

// hard: how many tiles a greedy dump (longest set first) can still get rid of
function dumpCount(hand) {
  let h = hand, total = 0;
  for (let guard = 0; guard < 8; guard++) {
    const sets = findSets(h, false);
    if (!sets.length) break;
    let pick = sets[0];
    for (const x of sets) if (x.length > pick.length) pick = x;
    const ids = new Set(pick.map(t => t.id));
    h = h.filter(t => !ids.has(t.id));
    total += pick.length;
  }
  return total;
}

// hard: choose the play (hand set or table append) that leaves the best follow-up dump.
function hardMove(state, hand) {
  const options = [];
  for (const set of findSets(hand, false).slice(0, 40)) {
    const ids = new Set(set.map(t => t.id));
    const rest = hand.filter(t => !ids.has(t.id));
    const jokers = set.filter(t => t.wild).length;
    options.push({
      move: { tileIds: set.map(t => t.id) },
      value: set.length + dumpCount(rest) - jokers * 0.75,
      pts: tileScore(set),
    });
  }
  for (const t of hand) {
    for (let j = 0; j < state.table.length; j++) {
      if (!isValidForBot([...state.table[j], t])) continue;
      const rest = hand.filter(x => x.id !== t.id);
      options.push({
        move: { tileIds: [t.id], targetSet: j },
        value: 1 + dumpCount(rest) - (t.wild ? 0.75 : 0),
        pts: t.wild ? 0 : t.num,
      });
      break;
    }
  }
  // borrow a spare tile from the table (end of a 4+ run, or one tile of a 4-group) to build a new set
  if (state.hasBroken[state.currentPlayer]) {
    for (let j = 0; j < state.table.length; j++) {
      const S = state.table[j];
      if (S.length < 4 || S.some(t => t.wild)) continue;
      const cand = [];
      if (new Set(S.map(t => t.num)).size === 1) S.forEach((t, k) => cand.push([t, S.filter((_, m) => m !== k)]));
      else {
        const sorted = S.slice().sort((a, b) => a.num - b.num);
        cand.push([sorted[0], sorted.slice(1)], [sorted[sorted.length - 1], sorted.slice(0, -1)]);
      }
      for (const [t, restSet] of cand) {
        if (!isValidForBot(restSet)) continue;
        for (const set of findSets(hand.concat([t]), false).slice(0, 30)) {
          if (!set.includes(t)) continue;
          const ids = new Set(set.map(x => x.id));
          const rest = hand.filter(x => !ids.has(x.id));
          const used = set.length - 1;
          if (used < 1) continue;
          const groups = state.table.map((x, k) => (k === j ? restSet : x).map(y => y.id));
          groups.push(set.map(y => y.id));
          options.push({ move: { groups }, value: used + dumpCount(rest) - 0.25, pts: tileScore(set) });
        }
      }
    }
  }
  if (!options.length) return null;
  options.sort((x, y) => (y.value - x.value) || (y.pts - x.pts));
  return options[0].move;
}

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
function findBreakCombo(hand, need, preferMany) {
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
  if (preferMany) {
    // hard: among combos that reach the target, lay the one that gets rid of the most tiles
    let bestCombo = null, bestTiles = -1;
    const all = (start, used, total, left, picked) => {
      if (total >= need) {
        const n = picked.reduce((a, x) => a + x.length, 0);
        if (n > bestTiles) { bestTiles = n; bestCombo = picked; }
        return;
      }
      if (left === 0) return;
      for (let i = start; i < Math.min(cands.length, 30); i++) {
        const c = cands[i];
        if (c.ids.some(id => used.has(id))) continue;
        const next = new Set(used); c.ids.forEach(id => next.add(id));
        all(i + 1, next, total + c.val, left - 1, [...picked, c.set]);
      }
    };
    all(0, new Set(), 0, 3, []);
    if (bestCombo) return bestCombo;
  }
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
