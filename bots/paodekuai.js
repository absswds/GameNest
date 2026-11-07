// bots/paodekuai.js
// 跑得快 bot: enumerate every legal play, score it by how fast it empties the hand while keeping
// pairs / triples / straights / bombs together, and pick through the shared difficulty sampler.
exports.name = 'paodekuai';

const P = require('../public/js/paodekuai-patterns');
const { botName } = require('./lib/bot-name');
const { pickFor } = require('./lib/difficulty');

// Calibrated 2026-11-07 (bot-tier-eval paodekuai --n=300 --dup, 3 seats, 1 round): hard beats random
// 75% (n=40), hard vs easy 70.0%, normal vs easy 67.3%, hard vs normal 57.3%. The game is luck-driven,
// so the tiers sit close together; the sweep put easy at about random strength and the current
// values already give the ordering hard > normal > easy, so they were kept.
const PICK = {
  temp: { easy: 60, normal: 15 },
  maxLoss: { easy: 250, normal: 40 },
};

// Rough number of plays needed to empty `cards`: bombs, airplanes / triples (their extra cards come
// from the lowest leftovers), runs of pairs, straights, then pairs and singles.
function estimateTurns(cards) {
  const cnt = new Array(13).fill(0);
  for (const c of cards) cnt[P.rankVal(c.rank)]++;
  let turns = 0;
  for (let v = 0; v < 13; v++) if (cnt[v] === 4) { turns++; cnt[v] = 0; }

  let wings = 0;
  let v = 0;
  while (v < 13) {
    if (cnt[v] >= 3) {
      let e = v;
      while (e + 1 <= P.SEQ_MAX && cnt[e + 1] >= 3) e++;
      for (let i = v; i <= e; i++) cnt[i] -= 3;
      turns++;
      wings += 2 * (e - v + 1);
      v = e + 1;
    } else {
      v++;
    }
  }
  for (let pass = 1; pass <= 2 && wings > 0; pass++) {
    for (let u = 0; u < 13 && wings > 0; u++) {
      while (wings > 0 && cnt[u] > 0 && (pass === 2 || cnt[u] === 1)) { cnt[u]--; wings--; }
    }
  }

  // runs of at least three pairs
  for (let s = 0; s + 2 <= P.SEQ_MAX; s++) {
    let e = s;
    while (e <= P.SEQ_MAX && cnt[e] >= 2) e++;
    if (e - s >= 3) {
      for (let i = s; i < e; i++) cnt[i] -= 2;
      turns++;
    }
  }
  // straights of at least five
  for (let guard = 0; guard < 6; guard++) {
    let done = true;
    for (let s = 0; s + 4 <= P.SEQ_MAX; s++) {
      let e = s;
      while (e <= P.SEQ_MAX && cnt[e] >= 1) e++;
      if (e - s >= 5) {
        for (let i = s; i < e; i++) cnt[i]--;
        turns++;
        done = false;
        break;
      }
    }
    if (done) break;
  }
  for (let u = 0; u < 13; u++) if (cnt[u] > 0) turns++;
  return turns;
}

function without(hand, cards) {
  const gone = {};
  for (const c of cards) gone[c.id] = true;
  return hand.filter((c) => !gone[c.id]);
}

function scorePlay(cand, hand, ctx) {
  const rem = without(hand, cand.cards);
  if (!rem.length) return 10000;
  const p = cand.play;
  let s = -estimateTurns(rem) * 25;
  s += cand.cards.length * 2;
  let sum = 0;
  for (const c of cand.cards) sum += P.rankVal(c.rank);
  s -= (sum / cand.cards.length) * (ctx.leading ? 1.5 : 2.5);
  if (p.type === 'bomb') {
    // keep bombs for the race: spend one only when it takes the lead of a close finish
    s -= ctx.minOpp <= 3 || rem.length <= 5 ? 5 : 45;
  }
  if (ctx.leading && p.type === 'single' && ctx.minOpp <= 1) s -= 40;
  if (ctx.leading && p.type !== 'single' && ctx.minOpp <= 2) s += 8;
  if (!ctx.leading && ctx.minOpp <= 3) s += 20;
  return s;
}

exports.createBot = function (playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function (state) {
      if (state.phase === 'roundEnd') return { action: 'next_round' };
      const hand = state.hands && state.hands[playerIndex];
      if (!Array.isArray(hand) || hand.length === 0 || hand.some((c) => !c)) return { cards: [] };

      const n = state.hands.length;
      const leading = !state.lastPlay || state.lastPlay.player === playerIndex;
      const table = leading ? null : state.lastPlay.play;
      const next = state.hands[(playerIndex + 1) % n];
      let minOpp = 99;
      for (let i = 0; i < n; i++) {
        if (i !== playerIndex && Array.isArray(state.hands[i])) minOpp = Math.min(minOpp, state.hands[i].length);
      }
      const plays = P.enumerate(hand, table, {
        mustInclude: !table && state.firstCard && hand.some((c) => c.id === state.firstCard) ? state.firstCard : null,
        nextOneCard: Array.isArray(next) && next.length === 1,
      });
      if (!plays.length) return { cards: [] };

      const ctx = { leading, minOpp };
      const cands = plays.map((cand) => ({
        move: { cards: cand.cards.map((c) => c.id) },
        score: scorePlay(cand, hand, ctx),
      }));
      // Passing is only on the table when the room does not force a beating play
      if (!leading && state.mustBeat === false) {
        cands.push({ move: { cards: [] }, score: -estimateTurns(hand) * 25 - (minOpp <= 3 ? 60 : 0) });
      }
      const move = pickFor(state, cands, PICK);
      return move || cands[0].move;
    },
  };
};
