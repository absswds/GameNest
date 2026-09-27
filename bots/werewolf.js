// bots/werewolf.js — filler players for testing a table; they act on what they
// know (wolves avoid teammates, the seer votes out wolves it found) and guess the rest.
const { botName } = require('./lib/bot-name');

exports.name = 'werewolf';

const pick = (a) => (a.length ? a[Math.floor(Math.random() * a.length)] : -1);

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(s, idx) {
    const me = Number.isInteger(idx) ? idx : playerIndex;
    const role = s.roles[me];
    const alive = s.alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
    const others = alive.filter((i) => i !== me);
    const nonWolf = others.filter((i) => s.roles[i] !== 'wolf');
    const knownWolves = (s.checks || []).filter((c) => c.wolf && s.alive[c.target]).map((c) => c.target);
    const suspects = role === 'wolf' ? nonWolf : role === 'seer' && knownWolves.length ? knownWolves : others;

    switch (s.phase) {
      case 'night_wolf':
        if (role === 'wolf') {
          const mate = Object.keys(s.wolfVotes).map((k) => s.wolfVotes[k]).find((t) => t >= 0);
          return { type: 'kill', target: mate !== undefined ? mate : pick(nonWolf) };
        }
      {
        const unchecked = others.filter((i) => !s.checks.some((c) => c.target === i));
        return { type: 'check', target: pick(unchecked.length ? unchecked : others) };
      }
      case 'night_witch':
        if (s.knife >= 0 && s.knife !== me && s.potions.save) return { type: 'witch', save: true };
        if (s.potions.poison && s.night > 1 && Math.random() < 0.25) return { type: 'witch', poison: pick(others) };
        return { type: 'witch' };
      case 'sheriff_sign': return { type: 'run', run: Math.random() < 0.35 };
      case 'speech': return { type: 'end_speech' };
      case 'vote': {
        const pool = s.voteCandidates.filter((i) => i !== me);
        const pref = pool.filter((i) => suspects.indexOf(i) >= 0);
        return { type: 'vote', target: pick(pref.length ? pref : pool) };
      }
      case 'hunter': return { type: 'shoot', target: role === 'hunter' && Math.random() < 0.5 ? pick(others) : -1 };
      case 'badge': return { type: 'badge', target: pick(others.filter((i) => s.roles[i] !== 'wolf' || role === 'wolf')) };
    }
    return { type: 'end_speech' };
  },
});
