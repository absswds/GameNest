const { pickFor } = require('./lib/difficulty');

// Provisional: tune after running scripts/bot-tier-eval.js
const PICK = { normalTemp: 4, easyLoss: 18, easyK: 3.0 };

const FACE_ORDER = [2, 3, 4, 5, 6, 1];

function faceRank(face) {
  return face === 1 ? 7 : face;
}

function isLegalRaise(qty, face, currentBid) {
  if (!Number.isInteger(qty) || qty < 1) return false;
  if (!Number.isInteger(face) || face < 1 || face > 6) return false;
  if (!currentBid) return true;
  if (qty > currentBid.qty) return true;
  return qty === currentBid.qty && faceRank(face) > faceRank(currentBid.face);
}

function minimalRaise(currentBid) {
  if (!currentBid) return { type: 'bid', qty: 1, face: 2 };
  const idx = FACE_ORDER.indexOf(currentBid.face);
  if (idx >= 0 && idx < FACE_ORDER.length - 1) {
    return { type: 'bid', qty: currentBid.qty, face: FACE_ORDER[idx + 1] };
  }
  return { type: 'bid', qty: currentBid.qty + 1, face: 2 };
}

function binomAtLeast(n, p, k) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let prob = 0;
  let comb = 1;
  for (let i = 0; i <= n; i++) {
    if (i >= k) {
      prob += comb * Math.pow(p, i) * Math.pow(1 - p, n - i);
    }
    comb = (comb * (n - i)) / (i + 1);
  }
  return prob;
}

function countOwnMatching(myDice, face, onesWildNow) {
  const wild = Boolean(onesWildNow && face !== 1);
  let count = 0;
  for (const d of myDice) {
    if (d === face || (wild && d === 1)) count++;
  }
  return count;
}

function getTotalDice(state) {
  if (Array.isArray(state.diceCounts) && state.diceCounts.length > 0) {
    return state.diceCounts.reduce((s, c) => s + c, 0);
  }
  if (Array.isArray(state.dice)) {
    return state.dice.reduce((s, d) => s + (Array.isArray(d) ? d.length : 0), 0);
  }
  return 0;
}

function buildCandidates(state, playerIndex) {
  const rawMine = Array.isArray(state.dice) && Array.isArray(state.dice[playerIndex])
    ? state.dice[playerIndex]
    : [];
  const myDice = rawMine.filter((d) => Number.isInteger(d) && d >= 1 && d <= 6);
  const totalDice = Math.max(myDice.length, getTotalDice(state));
  const unknownDice = Math.max(0, totalDice - myDice.length);
  const onesWildNow = Boolean(state.onesWildNow);
  const bid = state.currentBid || null;

  const cands = [];

  if (bid) {
    const ownForBid = countOwnMatching(myDice, bid.face, onesWildNow);
    const pBid = (onesWildNow && bid.face !== 1) ? 1 / 3 : 1 / 6;
    const pBidTrue = binomAtLeast(unknownDice, pBid, Math.max(0, bid.qty - ownForBid));
    const pChallengeWin = 1 - pBidTrue;
    cands.push({
      move: { type: 'challenge' },
      score: (pChallengeWin - 0.44) * 100,
    });
  }

  const minQty = bid ? bid.qty : 1;
  const maxQty = Math.max(minQty + 1, Math.min(totalDice + 1, minQty + 3));

  for (let qty = minQty; qty <= maxQty; qty++) {
    for (const face of FACE_ORDER) {
      if (!isLegalRaise(qty, face, bid)) continue;
      const ownM = countOwnMatching(myDice, face, onesWildNow);
      const pFace = (onesWildNow && face !== 1) ? 1 / 3 : 1 / 6;
      const pSafe = binomAtLeast(unknownDice, pFace, Math.max(0, qty - ownM));
      // Mild bonus for concealing dice / small qty jumps, slight penalty for burning wild 1s early
      const jump = qty - minQty;
      const wildBurn = (onesWildNow && face === 1 && !bid) ? -3 : 0;
      const score = (pSafe - 0.36) * 90 + ownM * 2.5 - jump * 6 + wildBurn;
      cands.push({
        move: { type: 'bid', qty, face },
        score,
      });
    }
  }

  if (cands.length === 0) {
    if (bid && bid.qty >= totalDice) {
      cands.push({ move: { type: 'challenge' }, score: 10 });
    } else {
      cands.push({ move: minimalRaise(bid), score: 0 });
    }
  }

  return cands;
}

function createBot(playerIndex) {
  return {
    getMove(state) {
      if (!state) return null;
      if (state.phase === 'reveal') return { type: 'next' };
      if (state.phase !== 'playing') return null;
      const cands = buildCandidates(state, playerIndex);
      return pickFor(state, cands, PICK);
    },
  };
}

module.exports = {
  name: 'liarsdice',
  createBot,
};
