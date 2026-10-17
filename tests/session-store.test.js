const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function mkStore() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}
function load() {
  const win = { localStorage: mkStore(), sessionStorage: mkStore() };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'session-store.js'), 'utf8'), { window: win, JSON, Date });
  return win;
}

test('session credentials: stored in localStorage, mirrored for renderers, expire after 10 minutes', () => {
  const w = load(), S = w.GNSession;
  S.set({ roomId: 'ABCD', playerIndex: 2, game: 'uno', resumeToken: 't1' });
  assert.strictEqual(w.sessionStorage.getItem('playerIndex'), '2');
  assert.strictEqual(w.sessionStorage.getItem('resumeToken'), null);
  const g = S.get();
  assert.strictEqual(g.roomId, 'ABCD');
  assert.strictEqual(g.resumeToken, 't1');
  assert.strictEqual(S.get(Date.now() + S.TTL + 1000), null);
  assert.strictEqual(w.localStorage.getItem('gn_session'), null);
  assert.strictEqual(w.sessionStorage.getItem('roomId'), null);
});

test('profile: invalid stored name / avatar are ignored', () => {
  const w = load(), S = w.GNSession;
  S.saveName('  Bob  '); S.saveAvatar('🦊');
  assert.deepStrictEqual({ ...S.getProfile() }, { name: 'Bob', avatar: '🦊' });
  w.localStorage.setItem('gn_name', 'waytoolongname');
  w.localStorage.setItem('gn_avatar', 'abcde');
  assert.deepStrictEqual({ ...S.getProfile() }, { name: null, avatar: null });
  const sent = [];
  S.sendProfile({ send: s => sent.push(s) });
  assert.strictEqual(sent.length, 0);
});
