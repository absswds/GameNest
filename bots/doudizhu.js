// bots/doudizhu.js
exports.name = 'doudizhu';

const { RANKS, rankGroups } = require('./lib/cards');
const { botName } = require('./lib/bot-name');

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

function findBeat(hand, lastPlay) {
  if (!lastPlay || !lastPlay.play) return null;
  const tp = lastPlay.play;
  const groups = rankGroups(hand);

  // Try same type with higher rank
  if (tp.type === 'single') {
    const singles = [];
    for (const c of hand) singles.push(c);
    singles.sort((a,b) => rankVal(a.rank) - rankVal(b.rank));
    const match = singles.find(c => rankVal(c.rank) > tp.rank && c.id !== 'SJ' && c.id !== 'BJ');
    if (match) return [match];
    // Try rocket or bomb
    const sj = hand.find(c => c.id === 'SJ');
    const bj = hand.find(c => c.id === 'BJ');
    if (sj && bj) return [sj, bj];
    for (const [rank, cards] of groups) {
      if (cards.length === 4) return cards.slice();
    }
    return null;
  }

  if (tp.type === 'pair') {
    for (const [rank, cards] of groups) {
      if (cards.length >= 2 && rankVal(rank) > tp.rank && rank !== '大王' && rank !== '小王')
        return cards.slice(0, 2);
    }
    // Try bomb
    for (const [rank, cards] of groups) {
      if (cards.length === 4) return cards.slice();
    }
    return null;
  }

  if (tp.type === 'triple' || tp.type === 'triple_one' || tp.type === 'triple_two') {
    for (const [rank, cards] of groups) {
      if (cards.length >= 3 && rankVal(rank) > tp.rank && rank !== '大王' && rank !== '小王')
        return cards.slice(0, 3);
    }
    for (const [rank, cards] of groups) {
      if (cards.length === 4) return cards.slice();
    }
    return null;
  }

  // For other complex types, try bomb
  for (const [rank, cards] of groups) {
    if (cards.length === 4 && rankVal(rank) > tp.rank) return cards.slice();
  }
  // Try rocket against bomb
  if (tp.type === 'bomb' || tp.type === 'rocket') {
    const sj = hand.find(c => c.id === 'SJ');
    const bj = hand.find(c => c.id === 'BJ');
    if (sj && bj) return [sj, bj];
  }

  return null;
}

exports.createBot = function(playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function(state) {
      if (state.phase === 'bidding') {
        const hand = state.hands[playerIndex];
        const bombs = countBombs(hand);
        const highCards = hand.filter(c => rankVal(c.rank) >= 12).length;
        let score = 0;
        if (bombs >= 2 || (bombs >= 1 && highCards >= 4)) score = 3;
        else if (bombs >= 1 || highCards >= 3) score = 2;
        else if (highCards >= 2) score = 1;
        if (score <= state.currentBid) score = 0;
        return { score };
      }

      // Playing phase
      const hand = state.hands[playerIndex];
      const lastPlay = state.lastPlay;
      const isFreePlay = !lastPlay || lastPlay.player === playerIndex;
      const groups = rankGroups(hand);

      if (isFreePlay) {
        // Lead with smallest single (copy to avoid mutating state)
        const sorted = [...hand].sort((a,b) => rankVal(a.rank) - rankVal(b.rank));
        return { cards: [sorted[0].id] };
      }

      // Try to beat
      const beat = findBeat(hand, lastPlay);
      if (beat) {
        return { cards: beat.map(c => c.id) };
      }

      // Pass
      return { cards: [] };
    }
  };
};
