// bots/lib/cards.js — Shared card helpers for poker-family bots

const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const RANK_VAL = {};
RANKS.forEach((r, i) => { RANK_VAL[r] = i; });

function rankVal(rank) {
  return RANK_VAL[rank] !== undefined ? RANK_VAL[rank] : -1;
}

function sortedHand(hand, cmp) {
  const copy = hand.slice();
  if (cmp) copy.sort(cmp);
  else copy.sort((a, b) => rankVal(a.rank || a) - rankVal(b.rank || b));
  return copy;
}

function rankGroups(hand) {
  const groups = new Map();
  for (const c of hand) {
    if (!groups.has(c.rank)) groups.set(c.rank, []);
    groups.get(c.rank).push(c);
  }
  return groups;
}

function passMove() { return { pass: true }; }

module.exports = { RANKS, RANK_VAL, rankVal, sortedHand, rankGroups, passMove };
