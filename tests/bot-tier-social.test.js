const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const werewolfBot = require('../bots/werewolf');
const sanguoBot = require('../bots/sanguo');

const wwState = (extra) => Object.assign({
  phase: 'night_wolf', night: 2, alive: [true, true, true, true, true, true, true, true],
  roles: ['wolf', 'wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager'],
  wolfVotes: {}, checks: [], potions: { save: true, poison: true }, knife: -1, sheriff: -1,
  revealed: {}, lastVote: null, voteCandidates: [], _options: { difficulty: 'hard' },
}, extra);

test('werewolf hard: seer checks someone unchecked, never itself', () => {
  const bot = werewolfBot.createBot(3);
  const s = wwState({ checks: [{ target: 0, wolf: true }, { target: 1, wolf: true }] });
  for (let i = 0; i < 20; i++) {
    const m = bot.getMove(s, 3);
    assert.equal(m.type, 'check');
    assert.ok(m.target !== 3 && m.target !== 0 && m.target !== 1);
  }
});

test('werewolf hard: wolves never knife a teammate and copy a teammate\'s pick', () => {
  const bot = werewolfBot.createBot(0);
  for (let i = 0; i < 20; i++) {
    const m = bot.getMove(wwState(), 0);
    assert.equal(m.type, 'kill');
    assert.ok(m.target >= 3);
  }
  assert.equal(bot.getMove(wwState({ wolfVotes: { 1: 5 } }), 0).target, 5);
});

test('werewolf witch: normal/hard save the knifed player, never poison before knowing anything on night 1', () => {
  for (const difficulty of ['normal', 'hard']) {
    const bot = werewolfBot.createBot(4);
    const m = bot.getMove(wwState({ phase: 'night_witch', night: 1, knife: 6, _options: { difficulty } }), 4);
    assert.deepEqual(m, { type: 'witch', save: true });
  }
});

test('werewolf hard: exiling vote targets a known wolf for the seer and avoids the seer for villagers', () => {
  const s = wwState({
    phase: 'vote', voteKind: 'exile', voteCandidates: [0, 1, 2, 3, 4, 5, 6, 7], sheriff: 3,
    checks: [{ target: 2, wolf: true }],
  });
  assert.equal(werewolfBot.createBot(3).getMove(s, 3).target, 2);
  for (let i = 0; i < 10; i++) assert.notEqual(werewolfBot.createBot(6).getMove(s, 6).target, 3);
});

const sgState = (role, difficulty) => {
  const mk = (r, hp = 4) => ({ role: r, hp, maxHp: 4, alive: true, hand: [], handCount: 0, equip: {}, judge: [], gender: 'm', general: 'zhangfei' });
  const players = [mk('lord'), mk('loyal'), mk('rebel'), mk('rebel'), mk('spy')];
  players[1].role = role;
  players[1].hand = [{ id: 1, name: 'sha', suit: 'S', rank: 7 }];
  return {
    n: 5, lord: 0, current: 1, players, log: [], winner: null, _options: { difficulty },
    ask: { type: 'play', to: 1 },
  };
};

test('sanguo bot: hard loyalist never attacks the lord, hard rebel goes for the lord', () => {
  const core = require('../games/lib/sanguo-core');
  const s = sgState('loyal', 'hard');
  s.players[0].equip = {};
  for (let i = 0; i < 10; i++) {
    const m = sanguoBot.createBot(1).getMove(s, 1);
    if (m.type === 'use') assert.notDeepEqual(m.targets, [0]);
  }
  const r = sgState('rebel', 'hard');
  const m = sanguoBot.createBot(1).getMove(r, 1);
  assert.equal(m.type, 'use');
  assert.deepEqual(m.targets, [0]);
  assert.ok(core.planUse(r, 1, m).err === undefined);
});

test('sanguo hard: attacks whoever hit the lord, ignores a player who saved him', () => {
  const s = sgState('loyal', 'hard');
  s.log = [
    { t: 'use', p: 2, name: 'sha', targets: [0] },
    { t: 'save', p: 4, who: 0 },
  ];
  const m = sanguoBot.createBot(1).getMove(s, 1);
  assert.equal(m.type, 'use');
  assert.deepEqual(m.targets, [2]);
});

test('sanguo hard: peach goes to an ally in the dying ask, easy often keeps it', () => {
  const s = sgState('loyal', 'hard');
  s.players[1].hand = [{ id: 9, name: 'tao', suit: 'H', rank: 3 }];
  s.ask = { type: 'respond', need: 'tao', to: 1, dying: 0 };
  assert.equal(sanguoBot.createBot(1).getMove(s, 1).type, 'respond');
  s.ask.dying = 2; // a stranger
  assert.equal(sanguoBot.createBot(1).getMove(s, 1).type, 'pass');
  s.ask.dying = 0;
  s._options.difficulty = 'easy';
  let saved = 0;
  for (let i = 0; i < 200; i++) if (sanguoBot.createBot(1).getMove(s, 1).type === 'respond') saved++;
  assert.ok(saved > 40 && saved < 160, `easy saved ${saved}/200`);
});

// Whole games through scripts/bot-tier-eval.js: legal moves only, correct ordering of the tiers.
test('eval: werewolf and sanguo tiers play legally and sanguo tiers are ordered', () => {
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'bot-tier-eval.js'), 'werewolf', 'sanguo', '--n=60', '--seed=1'], { encoding: 'utf8' });
  const rows = {};
  for (const line of out.split('\n')) {
    const c = line.split('|').map((x) => x.trim());
    if (c.length > 6 && (c[1] === 'werewolf' || c[1] === 'sanguo')) rows[c[1] + ' ' + c[2]] = { win: parseFloat(c[4]), errs: c[7] };
  }
  assert.ok(Object.keys(rows).length >= 6, out);
  for (const [k, r] of Object.entries(rows)) assert.equal(r.errs, '0', `${k} produced bot errors: ${r.errs}`);
  assert.ok(rows['sanguo hard vs easy'].win > 55, out);
  assert.ok(rows['sanguo normal vs easy'].win > 55, out);
  assert.ok(rows['sanguo hard vs normal'].win >= 48, out);
  assert.ok(rows['werewolf hard vs easy'].win >= 48, out);
});

test('getMove stays fast and does not mutate state', () => {
  const s = sgState('loyal', 'hard');
  const before = JSON.stringify(s);
  const t0 = Date.now();
  for (let i = 0; i < 200; i++) sanguoBot.createBot(1).getMove(s, 1);
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(JSON.stringify(s), before);
  const w = wwState({ phase: 'vote', voteKind: 'exile', voteCandidates: [0, 1, 2, 3] });
  const wb = JSON.stringify(w);
  werewolfBot.createBot(6).getMove(w, 6);
  assert.equal(JSON.stringify(w), wb);
});
