// bots/doudizhu.js
exports.name = 'doudizhu';

const { RANKS, rankGroups } = require('./lib/cards');
const { botName } = require('./lib/bot-name');
const ddz = require('../games/doudizhu');

function rankVal(rank) {
  if (rank === '小王') return 13;
  if (rank === '大王') return 14;
  return RANKS.indexOf(rank);
}

function countBombs(hand) {
  const m = new Map();
  for (const c of hand) m.set(c.rank, (m.get(c.rank)||0)+1);
  let bombs = 0;
  for (const [r, c] of m) if (c === 4) bombs++;
  if (hand.some(c => c.id === 'SJ') && hand.some(c => c.id === 'BJ')) bombs++;
  return bombs;
}

// Lowest play that beats lastPlay, or null. Candidates are validated with the server's own
// detectType/canBeat so the bot never proposes an illegal play (which would hang the room).
function findBeat(hand, lastPlay) {
  if (!lastPlay || !lastPlay.play) return null;
  const tp = lastPlay.play;
  const ok = (cards) => {
    const t = ddz.detectType(cards);
    return t && ddz.canBeat(t, tp) ? cards : null;
  };
  const sorted = [...hand].sort((a, b) => rankVal(a.rank) - rankVal(b.rank));
  const groups = [...rankGroups(hand)].sort((a, b) => rankVal(a[0]) - rankVal(b[0]));
  const byRank = new Map(groups);
  const normal = groups.filter(([r]) => r !== '大王' && r !== '小王');
  let found = null;

  if (tp.type === 'single') {
    for (const c of sorted) { if ((found = ok([c]))) return found; }
  } else if (tp.type === 'pair') {
    for (const [, cs] of normal) { if (cs.length >= 2 && (found = ok(cs.slice(0, 2)))) return found; }
  } else if (tp.type === 'triple' || tp.type === 'triple_one' || tp.type === 'triple_two') {
    for (const [r, cs] of normal) {
      if (cs.length < 3) continue;
      const tri = cs.slice(0, 3);
      if (tp.type === 'triple') found = ok(tri);
      else if (tp.type === 'triple_one') {
        const k = sorted.find(c => c.rank !== r);
        found = k && ok(tri.concat([k]));
      } else {
        const pr = normal.find(([r2, c2]) => r2 !== r && c2.length >= 2);
        found = pr && ok(tri.concat(pr[1].slice(0, 2)));
      }
      if (found) return found;
    }
  } else if (tp.type === 'straight' || tp.type === 'consecutive_pairs' || tp.type === 'plane') {
    const per = tp.type === 'straight' ? 1 : tp.type === 'consecutive_pairs' ? 2 : 3;
    const len = tp.length;
    // ranks 3..A (index 0..11) only; 2 and jokers cannot be part of a run
    for (let start = 0; start + len <= 12; start++) {
      const cards = [];
      for (let i = start; i < start + len; i++) {
        const cs = byRank.get(RANKS[i]);
        if (!cs || cs.length < per) { cards.length = 0; break; }
        cards.push(...cs.slice(0, per));
      }
      if (cards.length && (found = ok(cards))) return found;
    }
  }

  // A bomb beats any non-bomb play; a bigger bomb beats a bomb; the rocket beats everything.
  for (const [, cs] of groups) { if (cs.length === 4 && (found = ok(cs.slice()))) return found; }
  const sj = hand.find(c => c.id === 'SJ');
  const bj = hand.find(c => c.id === 'BJ');
  if (sj && bj && tp.type !== 'rocket') return [sj, bj];
  return null;
}


// Greedy decomposition of a hand into plays, lowest first: runs of pairs / singles, triples with a kicker,
// pairs, singles. Bombs and the rocket are kept apart. Leading the lowest whole group sheds cards faster
// than a lone low card.
function buildPlan(hand) {
  const byRank = new Map();
  for (const c of [...hand].sort((a, b) => rankVal(a.rank) - rankVal(b.rank))) {
    const v = rankVal(c.rank);
    if (!byRank.has(v)) byRank.set(v, []);
    byRank.get(v).push(c);
  }
  const bombs = [];
  for (const [v, cs] of [...byRank]) {
    if (cs.length === 4) { bombs.push(cs.slice()); byRank.delete(v); }
  }
  let rocket = null;
  if (byRank.has(13) && byRank.has(14)) {
    rocket = [byRank.get(13)[0], byRank.get(14)[0]];
    byRank.delete(13); byRank.delete(14);
  }
  const cnt = (v) => (byRank.has(v) ? byRank.get(v).length : 0);
  const take = (v, n) => { const out = byRank.get(v).splice(0, n); if (!byRank.get(v).length) byRank.delete(v); return out; };
  const plays = [];
  while (byRank.size) {
    const v = Math.min(...byRank.keys());
    const n = cnt(v);
    // runs only inside 3..A
    if (v <= 11) {
      let pairRun = 0;
      while (v + pairRun <= 11 && cnt(v + pairRun) === 2) pairRun++;
      if (pairRun >= 3) {
        const cards = [];
        for (let k = 0; k < pairRun; k++) cards.push(...take(v + k, 2));
        plays.push({ cards, rank: v, size: cards.length });
        continue;
      }
      let run = 0;
      while (v + run <= 11 && cnt(v + run) >= 1 && (run === 0 ? cnt(v) === 1 : cnt(v + run) <= 2)) run++;
      if (run >= 5 && cnt(v) === 1) {
        const cards = [];
        for (let k = 0; k < run; k++) cards.push(...take(v + k, 1));
        plays.push({ cards, rank: v, size: cards.length });
        continue;
      }
    }
    if (n === 3) {
      const cards = take(v, 3);
      // kicker: lowest lone card, else lowest pair
      let kv = -1;
      for (const [q, cs] of byRank) if (cs.length === 1 && (kv < 0 || q < kv)) kv = q;
      if (kv >= 0) cards.push(...take(kv, 1));
      else {
        for (const [q, cs] of byRank) if (cs.length === 2 && (kv < 0 || q < kv)) kv = q;
        if (kv >= 0) cards.push(...take(kv, 2));
      }
      plays.push({ cards, rank: v, size: cards.length });
    } else if (n === 2) {
      plays.push({ cards: take(v, 2), rank: v, size: 2 });
    } else {
      plays.push({ cards: take(v, 1), rank: v, size: 1 });
    }
  }
  return { plays, bombs, rocket };
}

// hard bidding: honest hand value (big cards, bombs) minus the number of turns needed to go out
function handValue(hand) {
  const { plays, bombs, rocket } = buildPlan(hand);
  let v = 0;
  for (const c of hand) {
    if (c.id === 'BJ') v += 2;
    else if (c.id === 'SJ') v += 1.5;
    else if (c.rank === '2') v += 1;
    else if (c.rank === 'A') v += 0.4;
  }
  v += bombs.length * 2 + (rocket ? 1.5 : 0);
  v -= (plays.length + bombs.length + (rocket ? 1 : 0) - 8) * 0.6;
  return v;
}

const HT = 2.5;
function isBombPlay(tp) {
  return tp && (tp.type === 'bomb' || tp.type === 'rocket');
}

const { getDifficulty } = require('./lib/difficulty');

function findFreePlay(hand, diff, state, playerIndex) {
  const sorted = [...hand].sort((a, b) => rankVal(a.rank) - rankVal(b.rank));
  if (diff === 'easy') return [sorted[0]];
  const { plays, bombs, rocket } = buildPlan(hand);
  if (!plays.length) {
    if (bombs.length) return bombs[0];
    if (rocket) return rocket;
    return [sorted[0]];
  }
  let pick = plays[0];
  if (diff === 'hard') {
    const opp = (state.hands || []).map((h, i) => (i === playerIndex ? 99 : h.length));
    // enemies: the landlord for a farmer, both farmers for the landlord
    const foes = (state.landlord === playerIndex || state.landlord == null)
      ? opp.filter((n) => n < 99)
      : [opp[state.landlord]];
    const minFoe = Math.min(...foes);
    const total = plays.length + bombs.length + (rocket ? 1 : 0);
    if (total <= 2) {
      // out in two plays: lead the one the enemy is least likely to answer, finish with the rest
      const extra = [...plays.map((pl) => pl.cards), ...bombs, ...(rocket ? [rocket] : [])];
      if (extra.length === 2) {
        const strong = extra.find((cs) => { const t = ddz.detectType(cs); return t && (isBombPlay(t) || t.rank >= 12); });
        if (strong) return extra.find((cs) => cs !== strong);
        const top = plays.slice().sort((a, b) => b.rank - a.rank)[0];
        return top.cards;
      }
    }
    if (minFoe <= 2) {
      // an enemy is nearly out: small singles would be answered at once, so lead groups first
      const groups = plays.filter((pl) => pl.size > 1);
      if (groups.length) pick = groups[0];
      else pick = plays[plays.length - 1];
    } else {
      // prefer shedding multi-card plays early while the enemy has to answer them
      const multi = plays.filter((pl) => pl.size >= 3 && pl.rank <= 9);
      if (multi.length) pick = multi[0];
    }
  }
  return ddz.detectType(pick.cards) ? pick.cards : [sorted[0]];
}

exports.createBot = function(playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function(state) {
      // ---- continue_vote phase ----
      if (state.phase === 'continue_vote') {
        return { action: 'continue_vote', vote: 'yes' };
      }

      // ---- roundEnd phase ----
      if (state.phase === 'roundEnd') {
        return { action: 'next_round' };
      }

      const diff = getDifficulty(state);


      // ---- bidding phase ----
      if (state.phase === 'bidding') {
        const hand = state.hands[playerIndex];
        const bombs = countBombs(hand);
        const highCards = hand.filter(c => rankVal(c.rank) >= 12).length;
        let strong = (bombs >= 1 && highCards >= 3) || bombs >= 2;
        const hv = diff === 'hard' ? handValue(hand) : 0;
        if (diff === 'hard') strong = hv >= HT;

        if (diff === 'easy') {
          // Easy: erratic bidding
          if (Math.random() < 0.3) strong = !strong;
        }

        // 叫抢 mode (state.bidMode === 'score' uses the 0-3 bids below)
        if (state.bidMode !== 'score' && state.callPhase === 'call') {
          return strong ? { call: true } : { pass: true };
        }
        if (state.bidMode !== 'score' && state.callPhase === 'rob') {
          if (!state.eligibleForRob || !state.eligibleForRob[playerIndex]) return { passRob: true };
          if (state.robAttempts && state.robAttempts.indexOf(playerIndex) >= 0) return { passRob: true };
          if (diff === 'hard' ? hv >= HT + 1.5 : strong) return { rob: true };
          return { passRob: true };
        }

        // 叫分 mode
        let score = 0;
        if (bombs >= 2 || (bombs >= 1 && highCards >= 4)) score = 3;
        else if (bombs >= 1 || highCards >= 3) score = 2;
        else if (highCards >= 2) score = 1;
        if (diff === 'hard') score = hv >= HT + 2.5 ? 3 : hv >= HT + 1 ? 2 : hv >= HT - 1 ? 1 : 0;
        if (diff === 'easy' && Math.random() < 0.3) score = Math.floor(Math.random() * 4);
        if (score <= state.currentBid) score = 0;
        return { score };
      }

      // ---- playing phase ----
      const hand = state.hands[playerIndex];
      const lastPlay = state.lastPlay;
      const isFreePlay = !lastPlay || lastPlay.player === playerIndex;

      if (isFreePlay) {
        const toPlay = findFreePlay(hand, diff, state, playerIndex);
        return { cards: toPlay.map(c => c.id) };
      }

      if (diff === 'easy' && Math.random() < 0.25) return { cards: [] };

      // Going out beats everything else
      const outType = ddz.detectType(hand);
      if (outType && ddz.canBeat(outType, lastPlay.play)) return { cards: hand.map(c => c.id) };

      const isFarmer = state.landlord !== undefined && state.landlord !== null && playerIndex !== state.landlord;
      if (diff === 'hard' && isFarmer && lastPlay.player !== state.landlord) {
        // farmer cooperation: let the partner keep control unless the partner's play is weak and cheap to improve
        const partnerHand = state.hands[lastPlay.player] || [];
        const tpPartner = lastPlay.play;
        if (partnerHand.length <= 4 || (tpPartner && tpPartner.rank >= 9)) return { cards: [] };
        if (tpPartner && !isBombPlay(tpPartner) && tpPartner.rank >= 6 && hand.length > 4) return { cards: [] };
      }

      let beat = findBeat(hand, lastPlay);
      if (beat && diff === 'hard') {
        const bt = ddz.detectType(beat);
        if (isBombPlay(bt) && !isBombPlay(lastPlay.play)) {
          // hard spends a bomb only when it matters: the opponent is close to out or our own hand is nearly done
          const foeCards = isFarmer ? (state.hands[state.landlord] || []).length
            : Math.min(...state.hands.map((h, i) => (i === playerIndex ? 99 : h.length)));
          const rest = hand.length - beat.length;
          const urgent = foeCards <= 4 || rest <= 5;
          if (!urgent) beat = null;
        }
      }
      if (beat) return { cards: beat.map(c => c.id) };

      return { cards: [] };
    }
  };
};
