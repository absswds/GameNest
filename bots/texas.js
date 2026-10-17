exports.name = 'texas';

const { botName } = require('./lib/bot-name');
const texas = require('../games/texas');

function rankVal(rank) {
  return ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'].indexOf(rank);
}

function handStrength(holeCards, communityCards) {
  const cards = [...holeCards, ...communityCards];
  const rvals = cards.map((card) => rankVal(card.rank)).sort((a, b) => b - a);

  const countMap = new Map();
  for (const rank of rvals) countMap.set(rank, (countMap.get(rank) || 0) + 1);

  let pairs = 0;
  let threes = 0;
  let fours = 0;
  for (const count of countMap.values()) {
    if (count === 4) fours++;
    if (count === 3) threes++;
    if (count === 2) pairs++;
  }

  let score = fours * 1000 + threes * 300 + pairs * 100;
  for (let i = 0; i < Math.min(3, rvals.length); i++) {
    score += rvals[i] * (5 - i);
  }
  if (holeCards.length >= 2 && holeCards[0].suit === holeCards[1].suit) score += 20;
  if (holeCards.length >= 2 && Math.abs(rankVal(holeCards[0].rank) - rankVal(holeCards[1].rank)) <= 2) score += 15;

  return score;
}


// ---- hard tier: Monte Carlo equity against random opponent hands (determinized sampling) ----
const SUITS = ['s', 'h', 'c', 'd'];

// Numeric 7-card strength: bigger is better. category * 13^5 + tie-break ranks.
function fastScore(cards) {
  const rc = new Array(13).fill(0);
  const sc = [[], [], [], []];
  const sidx = new Map();
  for (const c of cards) {
    const r = rankVal(c.rank);
    rc[r] += 1;
    if (!sidx.has(c.suit)) sidx.set(c.suit, sidx.size);
    sc[sidx.get(c.suit)].push(r);
  }
  const enc = (cat, arr) => {
    let v = cat;
    for (let i = 0; i < 5; i++) v = v * 13 + (arr[i] === undefined ? 0 : arr[i]);
    return v;
  };
  const straightHigh = (has) => {
    for (let hi = 12; hi >= 4; hi--) {
      let ok = true;
      for (let k = 0; k < 5; k++) if (!has[hi - k]) { ok = false; break; }
      if (ok) return hi;
    }
    return has[12] && has[0] && has[1] && has[2] && has[3] ? 3 : -1;
  };
  let flushRanks = null;
  for (const list of sc) if (list.length >= 5) flushRanks = list.slice().sort((a, b) => b - a);
  if (flushRanks) {
    const has = new Array(13).fill(false);
    for (const r of flushRanks) has[r] = true;
    const sh = straightHigh(has);
    if (sh >= 0) return enc(8, [sh]);
  }
  const quads = []; const trips = []; const pairs = []; const singles = [];
  for (let r = 12; r >= 0; r--) {
    if (rc[r] === 4) quads.push(r);
    else if (rc[r] === 3) trips.push(r);
    else if (rc[r] === 2) pairs.push(r);
    else if (rc[r] === 1) singles.push(r);
  }
  if (quads.length) return enc(7, [quads[0], Math.max(-1, ...trips, ...pairs, ...singles)]);
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pr = trips.length > 1 ? Math.max(trips[1], pairs[0] === undefined ? -1 : pairs[0]) : pairs[0];
    return enc(6, [trips[0], pr]);
  }
  if (flushRanks) return enc(5, flushRanks.slice(0, 5));
  const has = rc.map((x) => x > 0);
  const sh = straightHigh(has);
  if (sh >= 0) return enc(4, [sh]);
  if (trips.length) return enc(3, [trips[0], ...singles.concat(pairs).sort((a, b) => b - a).slice(0, 2)]);
  if (pairs.length >= 2) {
    const rest = [...pairs.slice(2), ...singles].sort((a, b) => b - a);
    return enc(2, [pairs[0], pairs[1], rest[0]]);
  }
  if (pairs.length === 1) return enc(1, [pairs[0], ...singles.slice(0, 3)]);
  return enc(0, singles.slice(0, 5));
}

// opps: array of "range tightness" values (1 = random hand, k = best of k random hands, picked by preflop-ish strength)
function monteCarloEquity(hole, board, opps, samples) {
  const known = new Set([...hole, ...board].map((c) => c.rank + c.suit));
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']) {
      if (!known.has(rank + suit)) deck.push({ rank, suit });
    }
  }
  const need = 5 - board.length;
  let wins = 0;
  for (let s = 0; s < samples; s++) {
    // partial Fisher-Yates: draw need + 2*maxTries cards
    const picks = need + opps.length * 6;
    const d = deck.slice();
    for (let i = 0; i < picks && i < d.length; i++) {
      const j = i + Math.floor(Math.random() * (d.length - i));
      const t = d[i]; d[i] = d[j]; d[j] = t;
    }
    const full = board.concat(d.slice(0, need));
    const mine = fastScore(hole.concat(full));
    let beaten = 1;
    let at = need;
    for (const tight of opps) {
      let bestHand = null;
      let bestKey = -1;
      for (let k = 0; k < tight; k++) {
        const h = [d[at], d[at + 1]];
        at += 2;
        const key = rankVal(h[0].rank) + rankVal(h[1].rank) + (h[0].rank === h[1].rank ? 14 : 0) + (h[0].suit === h[1].suit ? 2 : 0);
        if (key > bestKey) { bestKey = key; bestHand = h; }
      }
      const theirs = fastScore(bestHand.concat(full));
      if (theirs > mine) { beaten = 0; break; }
      if (theirs === mine) beaten *= 0.5;
    }
    wins += beaten;
  }
  return wins / samples;
}

function hardDecide(state, playerIndex) {
  const chips = state.chips[playerIndex];
  const currentBet = state.currentBet || 0;
  const invested = state.bets[playerIndex] || 0;
  const toCall = currentBet - invested;
  const pot = state.pot || 0;
  const board = state.communityCards || [];
  const hole = state.hands[playerIndex] || [];
  const opps = [];
  for (let i = 0; i < state.chips.length; i++) {
    if (i === playerIndex || state.folded[i]) continue;
    // an opponent who has put in more than the blind-level this street shows strength: sample a tighter range
    const bet = state.bets[i] || 0;
    let tight = 1;
    if (bet > 20 && bet >= currentBet * 0.99) tight = currentBet > 60 ? 3 : 2;
    opps.push(tight);
  }
  if (!opps.length) return { action: toCall > 0 ? 'call' : 'check' };
  const eq = monteCarloEquity(hole, board, opps, 220);
  // equity of a random hand vs n random hands is ~1/(n+1); scale thresholds by field size
  const n = opps.length + 1;
  const base = 1 / n;
  const strong = Math.min(0.88, base + (1 - base) * 0.55);
  const good = Math.min(0.8, base + (1 - base) * 0.3);
  const raiseTo = (frac) => currentBet + Math.max(20, Math.floor(Math.max(pot, 40) * frac));
  const cap = (amt) => Math.min(invested + chips, amt);

  if (toCall <= 0) {
    if (eq >= strong) return { action: 'raise', amount: cap(raiseTo(0.75)) };
    if (eq >= good && chips > 90) return { action: 'raise', amount: cap(raiseTo(0.4)) };
    if (eq < base * 0.6 && Math.random() < 0.08 && chips > 90) return { action: 'raise', amount: cap(raiseTo(0.5)) };
    return { action: 'check' };
  }
  const odds = toCall / (pot + toCall);
  const need = odds + 0.04;
  if (toCall >= chips) return eq >= Math.max(need, good * 0.9) ? { action: 'all_in' } : { action: 'fold' };
  if (eq < need) return { action: 'fold' };
  if (eq >= strong && chips > toCall + 40) return { action: 'raise', amount: cap(raiseTo(0.7)) };
  return { action: 'call' };
}

// A raise the table would reject (short stack, below the minimum raise, betting closed) becomes
// a call/check/all-in. The rules live in games/texas.js so the bot cannot drift from the server.
function legalRaise(state, playerIndex, move) {
  if (!move || move.action !== 'raise') return move;
  const chips = state.chips[playerIndex];
  const bet = state.bets[playerIndex] || 0;
  const amount = Math.min(move.amount, bet + chips); // amount is the street total, not extra chips
  if (!texas.checkRaise(state, playerIndex, amount)) return { action: 'raise', amount };
  const toCall = (state.currentBet || 0) - bet;
  if (toCall <= 0) return { action: 'check' };
  return chips <= toCall ? { action: 'all_in' } : { action: 'call' };
}

const { getDifficulty } = require('./lib/difficulty');

exports.createBot = function(playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function(state) {
      return legalRaise(state, playerIndex, this._decide(state));
    },
    _decide: function(state) {
      const diff = getDifficulty(state);
      if (diff === 'hard') return hardDecide(state, playerIndex);
      const chips = state.chips[playerIndex];
      const currentBet = state.currentBet || 0;
      const invested = (state.bets[playerIndex] || 0);
      const toCall = currentBet - invested;
      const pot = state.pot || 0;
      const strength = handStrength(state.hands[playerIndex] || [], state.communityCards || []);
      const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

      // Easy mode: loose passive calling station (rarely folds, rarely raises)
      if (diff === 'easy') {
        if (toCall <= 0) return { action: 'check' };
        if (toCall >= chips) return strength >= 120 ? { action: 'all_in' } : { action: 'fold' };
        if (toCall > chips * 0.6 && strength < 90) return { action: 'fold' };
        return { action: 'call' };
      }

      if (toCall <= 0) {
        const raiseThresh = diff === 'hard' ? 180 : 220;
        if (strength >= raiseThresh && chips > 100) {
          const raiseTo = currentBet + Math.max(20, Math.floor(Math.max(pot, 40) * (diff === 'hard' ? 0.75 : 0.6)));
          return { action: 'raise', amount: Math.min(invested + chips, raiseTo) };
        }
        if (strength >= 170 && chips > 90) {
          const raiseTo = currentBet + Math.max(12, Math.floor(Math.max(pot, 30) * 0.35));
          return { action: 'raise', amount: Math.min(invested + chips, raiseTo) };
        }
        return { action: 'check' };
      }

      if (toCall >= chips) {
        const callShove = strength >= (diff === 'hard' ? 190 : 160) || (strength >= 130 && Math.random() < 0.4);
        return callShove ? { action: 'all_in' } : { action: 'fold' };
      }

      // Hard mode: tight folds on weak hands facing high bets
      if (diff === 'hard') {
        if (strength < 80 && toCall > 20) return { action: 'fold' };
        if (strength < 140 && potOdds > 0.35) return { action: 'fold' };
      }

      // Bluff chance
      const bluffProb = diff === 'hard' ? 0.15 : 0.1;
      if (strength < 50 && Math.random() < bluffProb && chips > toCall + 40) {
        const raiseTo = currentBet + Math.max(20, Math.floor(Math.max(pot, 35) * 0.55));
        return { action: 'raise', amount: Math.min(invested + chips, raiseTo) };
      }

      if (toCall > chips * 0.45 && strength < 180) {
        return { action: 'fold' };
      }

      if (strength < 70 && potOdds > 0.28) {
        return { action: 'fold' };
      }

      if (strength < 120 && potOdds > 0.42) {
        return { action: 'fold' };
      }

      if (strength >= 240 && chips > toCall + 40) {
        const raiseTo = currentBet + Math.max(24, Math.floor(Math.max(pot, 50) * 0.7));
        return { action: 'raise', amount: Math.min(invested + chips, raiseTo) };
      }

      if (strength >= 200 && toCall <= Math.max(30, Math.floor(chips * 0.2))) {
        const raiseTo = currentBet + Math.max(18, Math.floor(Math.max(pot, 40) * 0.45));
        return { action: 'raise', amount: Math.min(invested + chips, raiseTo) };
      }

      return { action: 'call' };
    }
  };
};
