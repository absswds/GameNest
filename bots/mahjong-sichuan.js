// bots/mahjong-sichuan.js
// Sichuan Mahjong AI — discard isolated tiles, keep toward a winning hand.
// Uses the shared mahjong engine (games/lib/mahjong-core.js) to detect wins.

const core = require('../games/lib/mahjong-core');
const { huCheck } = core;
const { botName } = require('./lib/bot-name');
const cantoneseBot = require('./mahjong-cantonese');

exports.name = 'mahjong-sichuan';

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
      return { type: 'swap', tileIds: chooseSwapTiles(hand) };
    }

    // Void phase: pick the suit we have the fewest of (easy to discard).
    if (phase === 'void') {
      return { type: 'void', suit: chooseVoid(hand) };
    }

    // Claim phase: decide whether to pung/kong/win/pass the last discard.
    if (phase === 'claim') {
      return claimDecision(state, playerIndex, hand, melds);
    }

    // Play phase (or blood-battle win continuation): discard, or win if possible.
    if (phase === 'play' || phase === 'win') {
      // Win if hand is complete (self-draw).
      const info = huCheck(hand, melds, state.cfg || core.SICHUAN);
      if (info && info.win) {
        if (voidSatisfied(hand, voidSuit)) {
          return { type: 'win' };
        }
      }
      // Self-kong (暗杠): if we have 4 identical tiles and rain is on
      if (state._rain) {
        const selfKong = chooseSelfKong(hand);
        if (selfKong) {
          return { type: 'selfkong', suit: selfKong.k, num: selfKong.n };
        }
      }
      return { type: 'discard', tileId: chooseDiscard(hand, voidSuit) };
    }

    return {};
  },
  };
};

function chooseVoid(hand) {
  const suits = ['wan', 'tong', 'tiao'];
  let best = suits[0], bestCount = Infinity;
  for (const s of suits) {
    const c = countSuit(hand, s);
    if (c < bestCount) { bestCount = c; best = s; }
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

function chooseDiscard(hand, voidSuit) {
  // Must discard void-suit tiles first.
  const voidTiles = voidSuit ? hand.filter(t => t.k === voidSuit) : [];
  const pool = voidTiles.length > 0 ? voidTiles : hand;

  // Among candidates, discard the least-connected tile (isolated).
  let best = pool[0], bestScore = Infinity;
  for (const tile of pool) {
    const score = tileConnectivity(hand, tile);
    if (score < bestScore) { bestScore = score; best = tile; }
  }
  return best.id;
}

// 换三张：选3张同色牌（优先选数目最多的花色中的孤张）
function chooseSwapTiles(hand) {
  const suits = ['wan', 'tong', 'tiao'];
  // 找数目最多的花色
  let bestSuit = suits[0], bestCount = 0;
  for (const s of suits) {
    const c = countSuit(hand, s);
    if (c > bestCount) { bestCount = c; bestSuit = s; }
  }
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
  const ld = state.lastDiscard;
  if (!ld) return { type: 'pass' };
  const voidSuit = state.voidSuit[playerIndex];

  // Win on discard if it completes the hand.
  const testHand = hand.concat([ld]);
  const info = huCheck(testHand, melds, state.cfg || core.SICHUAN);
  if (info && info.win && voidSatisfied(hand, voidSuit)) {
    return { type: 'win' };
  }

  // Pung if we have a pair of the discarded tile and it's not our void suit.
  if (ld.k !== voidSuit) {
    let c = 0;
    for (const tile of hand) {
      if (tile.k === ld.k && tile.n === ld.n) c++;
    }
    if (c >= 3 && (state.deck ? state.deck.length : state.deckCount) > 4) {
      // Kong when safe (keep a reserve of tiles) for extra fan.
      return { type: 'kong' };
    }
    if (c >= 2) {
      return { type: 'pung' };
    }
  }

  return { type: 'pass' };
}
