// bots/mahjong-sichuan.js
// Sichuan Mahjong AI — discard isolated tiles, keep toward a winning hand.
// Uses the shared mahjong engine (games/lib/mahjong-core.js) to detect wins.

const core = require('../games/lib/mahjong-core');
const { huCheck } = core;
const { botName } = require('./lib/bot-name');
const { pickFor } = require('./lib/difficulty');
const cantoneseBot = require('./mahjong-cantonese');

exports.name = 'mahjong-sichuan';

// calibrated 2026-10-28 (bot-tier-eval --calibrate --dup, lossK 4): hard>normal 62.5%, normal>easy 81.5%, hard>easy 94.8%
const PICK = { temp: { easy: 2000, normal: 172 }, lossK: { easy: 4, normal: 4 } };

exports.createBot = (playerIndex) => {
  // Cantonese bot is reused lazily: when the unified entry routes to Cantonese,
  // delegate decision-making to the Cantonese AI.
  const cantBot = cantoneseBot.createBot(playerIndex);
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex,
    getMove(state) {
      // Cantonese mode (router set state._variants, or wall present)
      if (state._variants === 'cantonese' || state.wall) {
        return cantBot.getMove(state);
      }

      const hand = state.hands[playerIndex] || [];
      const melds = state.melds[playerIndex] || [];
      const voidSuit = state.voidSuit[playerIndex];
      const phase = state.phase;

      // Swap phase (换三张): select 3 same-suit tiles to swap.
      if (phase === 'swap') {
        return { type: 'swap', tileIds: chooseSwapTiles(hand, chooseVoidSmart(hand, melds)) };
      }

      // Void phase: score each suit by resulting shanten and tile count.
      if (phase === 'void') {
        const cands = SUITS3.map((suit) => {
          const n = countSuit(hand, suit);
          const sh = shanten(toCounts(hand, suit), melds.length);
          return { move: { type: 'void', suit }, score: -sh * 400 - n * 60 };
        });
        return pickFor(state, cands, PICK);
      }

      // Claim phase: decide whether to pung/kong/win/pass the last discard.
      if (phase === 'claim') {
        return claimDecision(state, playerIndex, hand, melds);
      }

      // Play phase: discard, or win if possible.
      if (phase === 'play') {
        // 碰牌后没有摸牌（_noDraw）：不能自摸，也不能暗杠/补杠，只能出牌。
        const noDraw = state._noDraw === true;
        // Win if hand is complete (self-draw).
        const info = noDraw ? null : huCheck(hand, melds, state.cfg || core.SICHUAN);
        if (info && info.win) {
          if (voidSatisfied(hand, voidSuit)) {
            return { type: 'win' };
          }
        }
        // Self-kong (暗杠): if we have 4 identical tiles and rain is on
        if (state._rain && !noDraw) {
          const selfKong = chooseSelfKong(hand);
          if (selfKong) {
            return { type: 'selfkong', suit: selfKong.k, num: selfKong.n };
          }
        }
        return chooseDiscard(hand, voidSuit, state, playerIndex);
      }

      return {};
    },
  };
};

// Give up the suit whose removal hurts the shape least
function chooseVoidSmart(hand, melds) {
  let best = null, bestS = Infinity, bestN = Infinity;
  for (const suit of SUITS3) {
    const n = countSuit(hand, suit);
    const sh = shanten(toCounts(hand, suit), (melds || []).length);
    if (sh < bestS || (sh === bestS && n < bestN)) { bestS = sh; bestN = n; best = suit; }
  }
  return best;
}

function countSuit(hand, suit) {
  let c = 0;
  for (const t of hand) if (t.k === suit) c++;
  return c;
}

function voidSatisfied(hand, voidSuit) {
  if (!voidSuit) return true;
  return countSuit(hand, voidSuit) === 0;
}

// Score how "connected" a tile is to others in the hand. Higher = more useful.
function tileConnectivity(hand, tile) {
  let score = 0;
  for (const o of hand) {
    if (o.id === tile.id) continue;
    if (o.k !== tile.k) continue;
    const diff = Math.abs(o.n - tile.n);
    if (diff === 0) score += 3;       // pair/potential pung
    else if (diff === 1) score += 2;  // adjacent (sequence)
    else if (diff === 2) score += 1;  // near (gap sequence)
  }
  return score;
}

// ---- shanten engine ----
const SUITS3 = ['wan', 'tong', 'tiao'];
const idxOf = (t) => SUITS3.indexOf(t.k) * 9 + (t.n - 1);

function toCounts(hand, skipSuit) {
  const c = new Array(27).fill(0);
  for (const t of hand) { if (t.k !== skipSuit) c[idxOf(t)]++; }
  return c;
}

// shanten of a hand (counts) with `fixed` exposed melds; -1 = complete
function shanten(c, fixed) {
  let best = 8 - 2 * fixed;
  let m = fixed, t = 0, pair = 0;
  function go(i) {
    while (i < 27 && c[i] === 0) i++;
    if (i >= 27) {
      const s = 8 - 2 * m - Math.min(t, 4 - m) - pair;
      if (s < best) best = s;
      return;
    }
    if (best <= -1) return;
    const pos = i % 9;
    if (c[i] >= 3) { c[i] -= 3; m++; go(i); m--; c[i] += 3; }
    if (pos <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; m++; go(i); m--; c[i]++; c[i + 1]++; c[i + 2]++; }
    if (!pair && c[i] >= 2) { pair = 1; c[i] -= 2; go(i); c[i] += 2; pair = 0; }
    if (c[i] >= 2) { c[i] -= 2; t++; go(i); t--; c[i] += 2; }
    if (pos <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; t++; go(i); t--; c[i]++; c[i + 1]++; }
    if (pos <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; t++; go(i); t--; c[i]++; c[i + 2]++; }
    c[i]--; go(i); c[i]++;
  }
  go(0);
  if (fixed === 0) {
    let pairs = 0, kinds = 0;
    for (let i = 0; i < 27; i++) { if (c[i] >= 1) kinds++; if (c[i] >= 2) pairs++; }
    const q = 6 - pairs + Math.max(0, 7 - kinds);
    if (q < best) best = q;
  }
  return best;
}

// tiles of each kind that are visible to this seat (own hand excluded): discards + all melds
function visibleCounts(state, playerIndex) {
  const v = new Array(27).fill(0);
  for (const pile of state.discards || []) for (const t of pile) if (t && SUITS3.indexOf(t.k) >= 0) v[idxOf(t)]++;
  (state.melds || []).forEach((ms) => {
    for (const mm of ms || []) {
      if (!mm || !mm.tile || SUITS3.indexOf(mm.tile.k) < 0) continue;
      v[idxOf(mm.tile)] += mm.type === 'kong' ? 4 : 3;
    }
  });
  return v;
}

// Score all unique candidate discards in `hand` and pick via pickFor.
function chooseDiscard(hand, voidSuit, state, playerIndex) {
  if (hand.length === 1) return { type: 'discard', tileId: hand[0].id };

  const fixed = (state.melds[playerIndex] || []).length;
  const c = toCounts(hand, voidSuit);
  const vis = visibleCounts(state, playerIndex);
  const act = [];
  for (let o = 0; o < (state.hands || []).length; o++) {
    if (o !== playerIndex && !(state.winners || []).includes(o)) act.push(o);
  }

  const seen = new Set();
  const cands = [];
  for (const tile of hand) {
    const key = tile.k + tile.n;
    if (seen.has(key)) continue;
    seen.add(key);

    if (tile.k === voidSuit) {
      cands.push({
        move: { type: 'discard', tileId: tile.id },
        score: 3000 - tileConnectivity(hand, tile),
      });
      continue;
    }

    const i = idxOf(tile);
    c[i]--;
    const s0 = shanten(c, fixed);
    let ukeire = 0;
    for (let j = 0; j < 27; j++) {
      if (j === i || SUITS3[(j / 9) | 0] === voidSuit) continue;
      const near = c[j] > 0 || (j % 9 > 0 && c[j - 1] > 0) || (j % 9 < 8 && c[j + 1] > 0)
        || (j % 9 > 1 && c[j - 2] > 0) || (j % 9 < 7 && c[j + 2] > 0);
      if (!near && s0 > 0) continue;
      const avail = 4 - c[j] - vis[j];
      if (avail <= 0) continue;
      c[j]++;
      if (shanten(c, fixed) < s0) ukeire += avail;
      c[j]--;
    }
    c[i]++;
    let score = -s0 * 1000 + ukeire * 10 - tileConnectivity(hand, tile);
    if (s0 >= 1) {
      // safety: a suit an opponent gave up cannot be won on by them
      let safe = 0;
      for (const o of act) if (state.voidSuit[o] === tile.k) safe++;
      score += safe * 12;
      score += vis[i] * 2;
    }
    cands.push({ move: { type: 'discard', tileId: tile.id }, score });
  }

  if (cands.length === 1) return cands[0].move;
  return pickFor(state, cands, PICK);
}

// 换三张：选3张同色牌（优先选数目最多的花色中的孤张）
function chooseSwapTiles(hand, prefer) {
  const suits = ['wan', 'tong', 'tiao'];
  // 找数目最多的花色
  let bestSuit = suits[0], bestCount = 0;
  for (const s of suits) {
    const c = countSuit(hand, s);
    if (c > bestCount) { bestCount = c; bestSuit = s; }
  }
  if (prefer && countSuit(hand, prefer) >= 3) bestSuit = prefer;
  // 从该花色中选3张（优先孤张/边张）
  const suitTiles = hand.filter(t => t.k === bestSuit);
  // 按连接度排序，选最不重要的3张
  suitTiles.sort((a, b) => tileConnectivity(hand, a) - tileConnectivity(hand, b));
  return suitTiles.slice(0, 3).map(t => t.id);
}

// 暗杠：找手中有4张相同的牌
function chooseSelfKong(hand) {
  const counts = {};
  for (const t of hand) {
    const key = t.k + ':' + t.n;
    counts[key] = (counts[key] || 0) + 1;
  }
  for (const key in counts) {
    if (counts[key] === 4) {
      const parts = key.split(':');
      return { k: parts[0], n: parseInt(parts[1]) };
    }
  }
  return null;
}

function claimDecision(state, playerIndex, hand, melds) {
  const ld = state.claim ? state.claim.tile : state.lastDiscard;
  if (!ld) return { type: 'pass' };
  const voidSuit = state.voidSuit[playerIndex];

  // Win on discard if it completes the hand.
  const testHand = hand.concat([ld]);
  const info = huCheck(testHand, melds, state.cfg || core.SICHUAN);
  if (info && info.win && voidSatisfied(hand, voidSuit)) {
    return { type: 'win' };
  }

  const cands = [{ move: { type: 'pass' }, score: 0 }];

  // Pung/kong if we have a pair/triplet of the discarded tile and it's not our void suit.
  if (ld.k !== voidSuit) {
    let c = 0;
    for (const tile of hand) {
      if (tile.k === ld.k && tile.n === ld.n) c++;
    }
    if (c >= 3 && (state.deck ? state.deck.length : state.deckCount) > 4) {
      cands.push({ move: { type: 'kong' }, score: 800 });
    }
    if (c >= 2) {
      cands.push({ move: { type: 'pung' }, score: 600 });
    }
  }

  if (cands.length === 1) return cands[0].move;
  return pickFor(state, cands, PICK);
}
