// bots/bigtwo.js
exports.name = 'bigtwo';

const game = require('../games/bigtwo');
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

// All combinations of k cards from list.
function combos(list, k) {
  const out = [];
  const pick = (start, acc) => {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i <= list.length - (k - acc.length); i++) {
      acc.push(list[i]); pick(i + 1, acc); acc.pop();
    }
  };
  pick(0, []);
  return out;
}

// Every legal play for this player right now, as { cards, play }.
function legalPlays(state, playerIndex) {
  const hand = state.hands[playerIndex];
  const sizes = state.lastPlay && state.lastPlayPlayer !== playerIndex
    ? [state.lastPlay.cards.length] : [1, 2, 3, 5];
  const out = [];
  for (const k of sizes) {
    for (const cards of combos(hand, k)) {
      const r = game.checkPlay(state, playerIndex, cards);
      if (!r.error) out.push({ cards, play: r.play });
    }
  }
  return out;
}

// Weakest first: five-card kind, then rank, then suit.
function strength(play) {
  return (play.kind || 0) * 1000 + play.rank * 10 + (play.suit || 0);
}

exports.createBot = function(playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function(state) {
      const hand = state.hands[playerIndex];
      if (!hand || hand.length === 0) return { cards: [] };
      const plays = legalPlays(state, playerIndex);
      if (plays.length === 0) return { cards: [] };

      const isFreePlay = !state.lastPlay || state.lastPlayPlayer === playerIndex;
      const diff = getDifficulty(state);
      if (diff === 'easy') {
        // easy: no plan, a random legal play, and it often passes when it could beat
        if (!isFreePlay && Math.random() < 0.3) return { cards: [] };
        return { cards: plays[Math.floor(Math.random() * plays.length)].cards.map(c => c.id) };
      }
      let pick;
      if (isFreePlay) {
        // Lead with the biggest group that sheds the lowest card; otherwise the weakest legal play.
        const lowest = hand.reduce((a, b) => (game.cardVal(b) < game.cardVal(a) ? b : a));
        const withLowest = plays.filter(p => p.cards.indexOf(lowest) >= 0);
        const pool = withLowest.length ? withLowest : plays;
        pool.sort((a, b) => (b.cards.length - a.cards.length) || (strength(a.play) - strength(b.play)));
        pick = pool[0];
      } else {
        // Beat with the weakest play that does the job
        plays.sort((a, b) => strength(a.play) - strength(b.play));
        pick = plays[0];
        if (diff === 'hard') {
          // someone is nearly out: do not let a small play through, answer with the strongest
          const minOpp = Math.min(...state.hands.map((h, i) => (i === playerIndex ? 99 : h.length)));
          if (minOpp <= 2) pick = plays[plays.length - 1];
        }
      }
      return { cards: pick.cards.map(c => c.id) };
    }
  };
};
