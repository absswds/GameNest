const test = require('node:test');
const assert = require('node:assert/strict');
const ww = require('../games/werewolf');
const { createBot } = require('../bots/werewolf');

// Start a game with fixed roles (seat order) so scenarios are deterministic.
function start(roles, options) {
  const s = ww.createState();
  s._options = Object.assign({ sheriff: false, discussTime: 0 }, options);
  ww.initGame(s, roles.length);
  s.roles = roles.slice();
  return s;
}
const idx = (s, role) => s.roles.indexOf(role);
const move = (s, p, data) => {
  const err = ww.handleMove(data, s, p);
  assert.equal(err, null, 'move ' + JSON.stringify(data) + ' by ' + p + ' failed: ' + err);
};
// Everyone who still has to act in a speech/vote phase does the given thing.
function speakAll(s) { while (s.phase === 'speech') move(s, s.speakers[s.speakerPos], { type: 'end_speech' }); }
function voteAll(s, target) {
  for (const v of s.voters.slice()) if (s.phase === 'vote' && s.votes[v] === undefined) move(s, v, { type: 'vote', target: v === target ? -1 : target });
}
// Night where wolves knife `target`, seer checks `check`, witch does `witch`.
function night(s, target, check, witch) {
  for (const w of s.roles.map((r, i) => (r === 'wolf' && s.alive[i] ? i : -1)).filter((i) => i >= 0)) move(s, w, { type: 'kill', target });
  if (s.phase === 'night_wolf') move(s, idx(s, 'seer'), { type: 'check', target: check });
  if (s.phase === 'night_witch' && !s.witchDone) move(s, idx(s, 'witch'), Object.assign({ type: 'witch' }, witch));
  else if (s.phase === 'night_witch') ww.onTimeout(s);
}

const SIX = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];

test('werewolf: role setups match the player count', () => {
  for (let n = 6; n <= 12; n++) {
    const s = ww.createState();
    s._options = {};
    ww.initGame(s, n);
    assert.equal(s.roles.length, n);
    const wolves = s.roles.filter((r) => r === 'wolf').length;
    assert.equal(wolves, { 6: 2, 7: 2, 8: 3, 9: 3, 10: 3, 11: 3, 12: 4 }[n]);
    assert.equal(s.phase, 'night_wolf');
  }
  const twelve = ww.SETUPS[12];
  assert.deepEqual([twelve.seer, twelve.witch, twelve.hunter, twelve.idiot], [1, 1, 1, 1]);
});

test('werewolf: witch cannot save herself and cannot use both potions at once', () => {
  const s = start(SIX);
  move(s, 0, { type: 'kill', target: 3 });
  move(s, 1, { type: 'kill', target: 3 });
  move(s, 2, { type: 'check', target: 0 });
  assert.equal(s.phase, 'night_witch');
  assert.equal(ww.handleMove({ type: 'witch', save: true }, s, 3), 'ww_no_self_save');
  assert.equal(ww.handleMove({ type: 'witch', save: true, poison: 0 }, s, 3), 'ww_one_potion');
  move(s, 3, { type: 'witch', poison: 0 });
  assert.equal(s.alive[3], false);
  assert.equal(s.alive[0], false);
});

test('werewolf: a saved target survives and the seer learns the truth', () => {
  const s = start(SIX);
  night(s, 4, 1, { save: true });
  assert.equal(s.phase, 'dawn');
  assert.deepEqual(s.lastNight, []);
  assert.deepEqual(s.checks, [{ night: 1, target: 1, wolf: true }]);
  assert.equal(s.potions.save, false);
});

test('werewolf: a poisoned hunter cannot shoot, a knifed hunter can', () => {
  const roles = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager'];
  const a = start(roles);
  night(a, 5, 0, { poison: 4 });
  assert.equal(a.alive[4], false);
  ww.onTimeout(a); // dawn → first queued task
  assert.notEqual(a.phase, 'hunter');

  const b = start(roles);
  night(b, 4, 0, {});
  ww.onTimeout(b);
  assert.equal(b.phase, 'hunter');
  move(b, 4, { type: 'shoot', target: 0 });
  assert.equal(b.alive[0], false);
  assert.equal(b.revealed[4], true);
});

test('werewolf: a tied vote goes to a PK, a second tie exiles nobody', () => {
  const s = start(SIX);
  night(s, 4, 0, { save: true });
  ww.onTimeout(s); // dawn → speeches
  speakAll(s);
  assert.equal(s.phase, 'vote');
  // 0,1 vote for 2; 2,3 vote for 0; 4,5 abstain → tie between 0 and 2
  move(s, 0, { type: 'vote', target: 2 });
  move(s, 1, { type: 'vote', target: 2 });
  move(s, 2, { type: 'vote', target: 0 });
  move(s, 3, { type: 'vote', target: 0 });
  move(s, 4, { type: 'vote', target: -1 });
  move(s, 5, { type: 'vote', target: -1 });
  assert.equal(s.phase, 'speech');
  assert.equal(s.speechKind, 'pk');
  assert.deepEqual(s.speakers, [0, 2]);
  speakAll(s);
  assert.deepEqual(s.voters, [1, 3, 4, 5]);
  move(s, 1, { type: 'vote', target: 2 });
  move(s, 3, { type: 'vote', target: 0 });
  move(s, 4, { type: 'vote', target: -1 });
  move(s, 5, { type: 'vote', target: -1 });
  assert.equal(s.phase, 'night_wolf');
  assert.deepEqual(s.log.slice(-2).map((e) => e.t), ['no_exile', 'night']);
});

test('werewolf: wolves win by killing every god (屠边)', () => {
  const s = start(SIX);
  night(s, 2, 0, {}); // seer dies
  ww.onTimeout(s);
  speakAll(s); // last words
  speakAll(s);
  voteAll(s, 3); // witch exiled → no gods left
  assert.equal(s.winner, -2);
});

test('werewolf: good wins when the last wolf is exiled', () => {
  const s = start(SIX);
  s.alive[1] = false;
  night(s, 4, 0, { save: true });
  ww.onTimeout(s);
  speakAll(s);
  voteAll(s, 0);
  assert.equal(s.winner, -3);
});

test('werewolf: the idiot survives the vote once and loses his vote', () => {
  const roles = ['wolf', 'wolf', 'wolf', 'wolf', 'seer', 'witch', 'hunter', 'idiot', 'villager', 'villager', 'villager', 'villager'];
  const s = start(roles);
  night(s, 8, 0, { save: true });
  ww.onTimeout(s);
  speakAll(s);
  voteAll(s, 7);
  assert.equal(s.alive[7], true);
  assert.equal(s.revealed[7], true);
  night(s, 9, 1, {});
  ww.onTimeout(s);
  speakAll(s);
  assert.equal(s.voters.indexOf(7), -1);
});

test('werewolf: sheriff election, 1.5 votes and badge hand-over', () => {
  const s = start(['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager'], { sheriff: true });
  night(s, 5, 0, {});
  assert.equal(s.phase, 'sheriff_sign');
  for (let i = 0; i < 7; i++) move(s, i, { type: 'run', run: i === 2 || i === 3 });
  speakAll(s);
  assert.equal(s.voteKind, 'sheriff');
  for (const v of s.voters.slice()) move(s, v, { type: 'vote', target: 2 });
  assert.equal(s.sheriff, 2);
  assert.equal(s.phase, 'dawn');
  assert.equal(s.alive[5], false); // night death is announced after the election
  ww.onTimeout(s);
  speakAll(s); // last words
  assert.equal(s.speakers[s.speakers.length - 1], 2, 'sheriff speaks last');
  speakAll(s);
  // 2 (sheriff, 1.5) + 3 vote 0; 0,1,4,6 vote 2 → 2.5 vs 4 → seat 2 exiled
  for (const v of s.voters.slice()) move(s, v, { type: 'vote', target: v === 2 || v === 3 ? 0 : 2 });
  assert.equal(s.alive[2], false);
  assert.equal(s.phase, 'badge');
  move(s, 2, { type: 'badge', target: 3 });
  assert.equal(s.sheriff, 3);
});

test('werewolf: playerView hides roles and private night info', () => {
  const s = start(SIX);
  move(s, 0, { type: 'kill', target: 4 });
  const before = JSON.stringify(s);
  const villager = ww.playerView(s, 5);
  assert.equal(JSON.stringify(s), before, 'playerView must not mutate state');
  assert.deepEqual(villager.roles, [null, null, null, null, null, 'villager']);
  assert.deepEqual(villager.wolfVotes, {});
  const wolf = ww.playerView(s, 1);
  assert.deepEqual(wolf.roles.slice(0, 2), ['wolf', 'wolf']);
  assert.equal(wolf.wolfVotes[0], 4);
  move(s, 1, { type: 'kill', target: 4 });
  move(s, 2, { type: 'check', target: 0 });
  assert.equal(ww.playerView(s, 5).knife, -1);
  assert.deepEqual(ww.playerView(s, 5).checks, []);
  assert.equal(ww.playerView(s, 3).knife, 4);
  assert.equal(ww.playerView(s, 2).checks.length, 1);
  ww.onTimeout(s);
  assert.deepEqual(ww.playerView(s, 5).deathCause, [null, null, null, null, 'dead', null]);
});

test('werewolf: bots finish whole games for every table size', () => {
  for (let n = 6; n <= 12; n++) {
    for (let round = 0; round < 5; round++) {
      const s = ww.createState();
      s._options = { sheriff: round % 2 === 0 };
      ww.initGame(s, n);
      const bots = Array.from({ length: n }, (_, i) => createBot(i));
      let steps = 0;
      while (s.winner === null && steps++ < 2000) {
        const pending = ww.getPendingActors(s);
        if (!pending.length) { ww.onTimeout(s); continue; }
        const p = pending[0];
        if (ww.handleMove(bots[p].getMove(s, p), s, p)) ww.onTimeout(s);
      }
      assert.ok(s.winner === -2 || s.winner === -3, 'n=' + n + ' ended with ' + s.winner + ' in ' + s.phase);
    }
  }
});
