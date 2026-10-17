const test = require('node:test');
const assert = require('node:assert/strict');

// Card-game bots: every tier plays legal moves without touching the state, and the tiers use information differently.
const GAMES = [
  ['uno', 4, {}],
  ['texas', 4, {}],
  ['bigtwo', 4, {}],
  ['hearts', 4, {}],
  ['doudizhu', 3, { totalRounds: 1 }],
  ['mahjong-sichuan', 4, { mahjongMode: 'sichuan' }],
  ['rummikub', 3, {}],
];

function over(id, s) {
  if (id === 'mahjong-sichuan') return s.phase === 'over';
  if (id === 'texas') return s.phase === 'showdown' || s.phase === 'over' || s.winner !== null && s.winner !== undefined;
  return s.winner !== null && s.winner !== undefined;
}

function playGame(id, n, opts, tiers) {
  const g = require('../games/' + id);
  const b = require('../bots/' + id);
  const s = g.createState();
  s._playerCount = n; s._realPlayerCount = 0; s._hasBots = true; s._lang = 'zh';
  s._options = Object.assign({}, opts);
  if (id === 'mahjong-sichuan') { s.cumulativeScore = new Array(n).fill(0); s.dealerIndex = 0; s.roundNumber = 1; }
  if (g.initGame) g.initGame(s, n);
  const bots = [...Array(n).keys()].map((i) => b.createBot(i));
  for (let step = 0; step < 4000 && !over(id, s); step++) {
    const p = typeof g.getCurrentActor === 'function' ? g.getCurrentActor(s) : s.currentPlayer;
    s._options.difficulty = tiers[p % tiers.length];
    const before = JSON.stringify(s);
    const mv = bots[p].getMove(s, p) || { pass: true };
    assert.equal(JSON.stringify(s), before, id + ' bot mutated the state');
    const err = g.handleMove(mv, s, p);
    assert.equal(err, null, id + ' (' + tiers[p % tiers.length] + ') rejected ' + JSON.stringify(mv) + ': ' + err);
  }
  return s;
}

for (const [id, n, opts] of GAMES) {
  test(id + ': easy / normal / hard bots play legal moves and never mutate state', () => {
    for (const tiers of [['easy', 'normal', 'hard'], ['hard', 'hard', 'normal'], ['easy', 'easy', 'easy']]) {
      for (let i = 0; i < 2; i++) assert.ok(over(id, playGame(id, n, opts, tiers)), id + ' did not finish');
    }
  });
}

test('mahjong-sichuan: normal and hard keep a tenpai hand by discarding the isolated tile', () => {
  const bot = require('../bots/mahjong-sichuan').createBot(0);
  const t = (k, num, i) => ({ k, n: num, id: k + num + '#' + i });
  const hand = [];
  for (let num = 1; num <= 9; num++) hand.push(t('wan', num, 0));
  hand.push(t('tong', 5, 0), t('tong', 5, 1), t('tong', 7, 0), t('tong', 8, 0), t('tong', 1, 0));
  for (const difficulty of ['normal', 'hard']) {
    const state = {
      phase: 'play', hands: [hand, [], [], []], melds: [[], [], [], []], voidSuit: ['tiao', 'tiao', 'tiao', 'tiao'],
      discards: [[], [], [], []], winners: [], _options: { difficulty },
    };
    assert.equal(bot.getMove(state).tileId, 'tong1#0', difficulty + ' should drop the lone tong 1');
  }
});

test('rummikub: hard bot borrows a spare tile from a long table run to build a new set', () => {
  const bot = require('../bots/rummikub').createBot(0);
  const tile = (color, num, s) => ({ color, num, id: color + '-' + num + '-' + s });
  const table = [[tile('red', 3, 'a'), tile('red', 4, 'a'), tile('red', 5, 'a'), tile('red', 6, 'a')]];
  const hand = [tile('blue', 6, 'a'), tile('black', 6, 'a'), tile('orange', 12, 'a')];
  const state = {
    phase: 'play', hands: [hand, [], []], table, hasBroken: [true, true, true], playedThisTurn: [false, false, false],
    meldPending: null, currentPlayer: 0, _options: { difficulty: 'hard' },
  };
  assert.deepEqual(bot.getMove(state), { action: 'start_manipulate' });
  state.phase = 'manipulate';
  const move = bot.getMove(state);
  assert.equal(move.action, 'submit');
  const sets = move.groups.map((g) => g.slice().sort().join(','));
  assert.ok(sets.includes('red-3-a,red-4-a,red-5-a'), 'run keeps its first three tiles');
  assert.ok(sets.includes('black-6-a,blue-6-a,red-6-a'), 'borrowed 6 forms a group with the hand tiles');
});
