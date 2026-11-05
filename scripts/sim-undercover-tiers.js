// Bot tier check for Who Is the Undercover: undercover tier x civilian tier matrix.
// node scripts/sim-undercover-tiers.js [--n=600] [--players=6] [--wordDiff=mixed] [--lang=zh]
// Reports, per (undercover tier, civilian tier): undercover win rate, mean rounds the
// undercover survived, and how often the undercover was voted out in round 1.
const undercover = require('../games/undercover');
const botMod = require('../bots/undercover');

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith('--' + k + '='));
  return m ? m.split('=')[1] : d;
};
const N = Number(arg('n', 600));
const PLAYERS = Number(arg('players', 6));
const WORD_DIFF = arg('wordDiff', 'mixed');
const LANG = arg('lang', 'zh');
const TIERS = ['easy', 'normal', 'hard'];

function playOne(ucTier, civTier) {
  const s = { _options: { talkMode: 'chat', speechTime: 0, wordDiff: WORD_DIFF, ucCount: 1 }, _lang: LANG };
  undercover.initGame(s, PLAYERS);
  const tierOf = (i) => (s.roles[i] === 'undercover' ? ucTier : civTier);
  const bots = Array.from({ length: PLAYERS }, (_, i) => botMod.createBot(i));
  let ucOut = null;
  for (let guard = 0; guard < 600 && s.winner === null; guard++) {
    const pending = undercover.getPendingActors(s);
    if (!pending.length) break;
    const actor = pending[0];
    const view = undercover.playerView(s, actor);
    view._options = { difficulty: tierOf(actor) };
    view._lang = LANG;
    const move = bots[actor].getMove(view, actor);
    const err = undercover.handleMove(move, s, actor);
    if (err) undercover.handleMove({ pass: true }, s, actor);
    if (ucOut === null) {
      const i = s.roles.indexOf('undercover');
      if (!s.alive[i]) ucOut = s.round;
    }
  }
  return { ucWin: s.winner === -3, survived: ucOut === null ? s.round : ucOut, caughtR1: ucOut === 1 };
}

console.log(`players=${PLAYERS} n=${N} wordDiff=${WORD_DIFF} lang=${LANG}`);
console.log('undercover\civilians  ucWin%   rounds survived   caught in round 1 %');
for (const u of TIERS) {
  for (const c of TIERS) {
    let win = 0, rounds = 0, r1 = 0;
    for (let k = 0; k < N; k++) {
      const r = playOne(u, c);
      if (r.ucWin) win += 1;
      rounds += r.survived;
      if (r.caughtR1) r1 += 1;
    }
    console.log(`${u.padEnd(7)} vs ${c.padEnd(7)}  ${(100 * win / N).toFixed(1).padStart(5)}   ${(rounds / N).toFixed(2).padStart(6)}            ${(100 * r1 / N).toFixed(1).padStart(5)}`);
  }
}
