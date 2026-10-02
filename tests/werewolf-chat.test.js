const test = require('node:test');
const assert = require('node:assert/strict');
const ww = require('../games/werewolf');

const SIX = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
function start(options) {
  const s = ww.createState();
  s._options = Object.assign({ sheriff: false, talkMode: 'chat' }, options);
  ww.initGame(s, SIX.length);
  s.roles = SIX.slice();
  return s;
}
const ok = (s, p, data) => assert.equal(ww.handleMove(data, s, p), null, JSON.stringify(data) + ' by ' + p);
const say = (s, p, text) => { s.chatAt[p] = 0; return ww.handleMove({ type: 'chat', text }, s, p); };
// Wolves knife the last villager, seer checks a wolf, witch passes → day 1 speeches.
function toDay(s) {
  ok(s, 0, { type: 'kill', target: 5 });
  ok(s, 1, { type: 'kill', target: 5 });
  ok(s, 2, { type: 'check', target: 0 });
  ok(s, 3, { type: 'witch' });
  ww.onTimeout(s); // dawn → speeches
  assert.equal(s.phase, 'speech');
}

test('werewolf chat: face-to-face rooms reject typed messages', () => {
  const s = start({ talkMode: 'face' });
  assert.equal(say(s, 0, 'hi'), 'ww_chat_closed');
});

test('werewolf chat: at night only wolves talk, and only wolves can read it', () => {
  const s = start();
  assert.equal(say(s, 0, '刀 5 号'), null);
  assert.equal(say(s, 2, '我是预言家'), 'ww_chat_closed');
  assert.equal(s.chat[0].ch, 'wolf');
  assert.equal(ww.playerView(s, 1).chat.length, 1);
  assert.equal(ww.playerView(s, 2).chat.length, 0);
  assert.equal(ww.playerView(s, 2).chatAt, undefined);
});

test('werewolf chat: during speeches only the current speaker may type', () => {
  const s = start();
  toDay(s);
  const sp = s.speakers[s.speakerPos];
  const other = s.speakers[s.speakerPos + 1];
  assert.equal(say(s, other, '插话'), 'ww_chat_closed');
  assert.equal(say(s, sp, '我是好人'), null);
  assert.equal(s.chat[s.chat.length - 1].ch, 'all');
  assert.equal(ww.playerView(s, 2).chat.length, 1);
});

test('werewolf chat: dead players are read-only, messages are trimmed and rate-limited', () => {
  const s = start();
  toDay(s);
  assert.equal(s.alive[5], false);
  while (s.phase === 'speech') ok(s, s.speakers[s.speakerPos], { type: 'end_speech' });
  assert.equal(s.phase, 'discuss');
  assert.equal(say(s, 5, '我死得冤'), 'ww_chat_closed');
  assert.equal(say(s, 4, '   '), 'ww_chat_empty');
  assert.equal(say(s, 4, 'x'.repeat(500)), null);
  assert.equal(s.chat[s.chat.length - 1].text.length, 120);
  assert.equal(ww.handleMove({ type: 'chat', text: 'again' }, s, 4), 'ww_chat_fast');
});

test('werewolf: free discussion follows the day speeches and ends when everyone is ready', () => {
  const s = start({ talkMode: 'face', discussTime: 60 });
  toDay(s);
  while (s.phase === 'speech') ok(s, s.speakers[s.speakerPos], { type: 'end_speech' });
  assert.equal(s.phase, 'discuss');
  assert.deepEqual(ww.getPendingActors(s), [0, 1, 2, 3, 4]);
  for (const p of [0, 1, 2, 3]) ok(s, p, { type: 'ready' });
  assert.equal(s.phase, 'discuss');
  ok(s, 4, { type: 'ready' });
  assert.equal(s.phase, 'vote');
  assert.equal(s.voteKind, 'exile');
});

test('werewolf: discussion timeout starts the vote; discussTime 0 skips it', () => {
  const a = start({ discussTime: 60 });
  toDay(a);
  while (a.phase === 'speech') ok(a, a.speakers[a.speakerPos], { type: 'end_speech' });
  ww.onTimeout(a);
  assert.equal(a.phase, 'vote');
  const b = start({ discussTime: 0 });
  toDay(b);
  while (b.phase === 'speech') ok(b, b.speakers[b.speakerPos], { type: 'end_speech' });
  assert.equal(b.phase, 'vote');
});

test('werewolf chat: a message typed for the wolf channel is refused once day has come', () => {
  const s = start();
  toDay(s);
  const sp = s.speakers[s.speakerPos];
  s.roles[sp] = 'wolf';
  assert.equal(ww.handleMove({ type: 'chat', text: '刀 2 号', ch: 'wolf' }, s, sp), 'ww_chat_moved');
  assert.equal(s.chat.length, 0);
});
