// bots/mahjong-cantonese.js — AI for Cantonese Mahjong (鸡平胡)
// Strategy: keep tiles that connect toward a winning hand, discard isolated tiles.
// In claim phase: win if possible, else pung/kong number tiles, chow when beneficial.

const { botName } = require('./lib/bot-name');
const { pickFor } = require('./lib/difficulty');
const core = require('../games/lib/mahjong-core');
// 规则判定直接复用游戏模块，避免两边各写一份后不同步
const game = require('../games/mahjong-cantonese');
const { getCfg, findChowPairs, winAllowed } = game;

exports.name = 'mahjong-cantonese';

// calibrated 2026-10-28 (bot-tier-eval --calibrate --dup, lossK 4): hard>normal 75.6%, normal>easy 77.5%, hard>easy 95.0%
const PICK = { temp: { easy: 106, normal: 15 }, lossK: { easy: 4, normal: 4 } };

// Count tiles in hand matching (k, n).
function matchCount(hand, k, n) {
  let c = 0;
  for (const t of hand) if (t.k === k && t.n === n) c++;
  return c;
}

// Count copies of (k, n) visible in discard piles.
function seenInDiscards(discards, k, n) {
  let c = 0;
  for (const pile of discards || []) {
    if (Array.isArray(pile)) {
      for (const d of pile) if (d && d.k === k && d.n === n) c++;
    } else if (pile && pile.k === k && pile.n === n) {
      c++;
    }
  }
  return c;
}

// Connectivity score: how many tiles in hand are "useful" alongside this tile.
// Higher = more connected = keep. Honours with no pair score low (dump first).
function connectivity(hand, tile) {
  if (tile.k === 'feng' || tile.k === 'jian') {
    const m = matchCount(hand, tile.k, tile.n);
    if (m >= 3) return 6;     // triple → kong candidate
    if (m === 2) return 4;    // pair → keep (could be the pair / pung)
    return 1;                 // single honour → dump
  }
  let score = 0;
  const k = tile.k, n = tile.n;
  // duplicates
  const dup = matchCount(hand, k, n);
  if (dup >= 3) score += 6;
  else if (dup === 2) score += 4;
  // sequence neighbors (within ±2)
  for (let d = -2; d <= 2; d++) {
    if (d === 0) continue;
    const nn = n + d;
    if (nn < 1 || nn > 9) continue;
    if (matchCount(hand, k, nn)) score += (Math.abs(d) === 1 ? 2 : 1);
  }
  return score;
}

// Find a chow pair for `tile` (first valid one, rules shared with the game module).
function bestChowPair(hand, tile) {
  const pairs = findChowPairs(hand, tile);
  return pairs.length ? pairs[0] : null;
}

exports.createBot = function (playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),

    getMove: function (state) {
      const hand = state.hands[playerIndex];
      const cfg = getCfg(state);

      // ---- claim phase: only act if this bot is the current responder ----
      if (state.phase === 'claim' && state.claim) {
        const actor = state.claim.order[state.claim.idx];
        if (actor !== playerIndex) return { type: 'pass' };
        const tile = state.claim.tile;
        const n = state._playerCount;
        const isUpstream = playerIndex === (state.claim.discarder + 1) % n;

        // win if possible
        const test = hand.slice();
        test.push(tile);
        if (winAllowed(state, test, state.melds[playerIndex], false)) {
          return { type: 'win' };
        }

        const cands = [{ move: { type: 'pass' }, score: 0 }];
        const m = matchCount(hand, tile.k, tile.n);
        // kong: only for number tiles with 3 copies
        if (m >= 3 && tile.k !== 'feng' && tile.k !== 'jian') {
          cands.push({ move: { type: 'kong' }, score: 80 });
        }
        // pung: number tiles with a pair
        if (m >= 2 && tile.k !== 'feng' && tile.k !== 'jian') {
          cands.push({ move: { type: 'pung' }, score: 60 });
        }
        // chow: upstream only
        if (isUpstream) {
          const pair = bestChowPair(hand, tile);
          if (pair) cands.push({ move: { type: 'chow', tiles: pair.map(t => t.id) }, score: 45 });
        }
        if (cands.length === 1) return cands[0].move;
        cands.sort((a, b) => b.score - a.score);
        return pickFor(state, cands, PICK);
      }

      // ---- play phase ----
      if (state.phase === 'play' && state.currentPlayer === playerIndex) {
        const afterClaim = state._afterClaim === true;
        if (!afterClaim && winAllowed(state, hand, state.melds[playerIndex], true)) {
          return { type: 'win' };
        }
        if (!afterClaim) {
          const quadT = findQuad(hand);
          const addK = findAddKongTile(hand, state.melds[playerIndex]);
          const kongT = (quadT && quadT.k !== 'feng' && quadT.k !== 'jian') ? { t: quadT, type: 'selfkong' }
            : (addK && addK.k !== 'feng' && addK.k !== 'jian') ? { t: addK, type: 'addkong' } : null;
          if (kongT && !isTing(hand, state.melds[playerIndex], cfg)) {
            return { type: kongT.type, suit: kongT.t.k, num: kongT.t.n };
          }
        }
        // discard the least-connected tile（百搭红中不打）
        const wc = cfg.wildcard;
        const isWild = (t) => !!wc && t.k === wc.k && t.n === wc.n;
        const pool = hand.some(t => !isWild(t)) ? hand.filter(t => !isWild(t)) : hand;
        if (pool.length === 1) return { type: 'discard', tileId: pool[0].id };

        const discards = (state && state.discards) || [];
        const seenKeys = new Set();
        const cands = [];
        for (const t of pool) {
          const key = t.k + ':' + t.n;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          let sc = connectivity(hand, t);
          if (seenInDiscards(discards, t.k, t.n) >= 2) sc -= 1.5; // safer to discard
          cands.push({ move: { type: 'discard', tileId: t.id }, score: -sc * 10 });
        }
        if (cands.length === 1) return cands[0].move;
        cands.sort((a, b) => b.score - a.score);
        return pickFor(state, cands, PICK);
      }

      return { type: 'pass' };
    },
  };
};

// 找手中有 4 张相同的牌（用于暗杠）
function findQuad(hand) {
  const counts = {};
  for (const t of hand) {
    const key = t.k + ':' + t.n;
    counts[key] = (counts[key] || 0) + 1;
  }
  for (const key in counts) {
    if (counts[key] >= 4) {
      const [k, n] = key.split(':');
      return { k, n: parseInt(n, 10) };
    }
  }
  return null;
}

// 补杠：碰出的刻子 + 手中有第 4 张
function findAddKongTile(hand, melds) {
  if (!Array.isArray(melds)) return null;
  for (const m of melds) {
    if (m.type !== 'pung') continue;
    const r = m.tile || (m.tiles && m.tiles[0]);
    if (!r) continue;
    if (hand.some(t => t.k === r.k && t.n === r.n)) return { k: r.k, n: r.n };
  }
  return null;
}

// 是否已听牌：出牌阶段手里 3n+2 张，有任意一种打法打出后听牌（含字牌）即算听。
function isTing(hand, melds, cfg) {
  return hand.some((_, i) => core.isTenpai(hand.filter((__, j) => j !== i), melds, cfg));
}
