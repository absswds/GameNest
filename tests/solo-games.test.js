// Games the lobby lists as solo (window.SOLO_GAMES) must start with one player on the server,
// and a solo sheeptile run that fills the slot is a loss, not a win.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const catalogSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'game-catalog.js'), 'utf8');
const SOLO = JSON.parse(catalogSrc.match(/window\.SOLO_GAMES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));

test('every solo game allows one player on the server', () => {
  assert.ok(SOLO.includes('sheeptile'));
  for (const id of SOLO) {
    assert.equal(require('../games/' + id).minPlayers, 1, id + ' needs exports.minPlayers = 1');
  }
});

test('every game the server lets start alone is in the solo list', () => {
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'games')).filter(n => n.endsWith('.js'))) {
    const mod = require('../games/' + f);
    if (mod && mod.minPlayers === 1) assert.ok(SOLO.includes(mod.name || f.replace(/\.js$/, '')), f + ' missing from SOLO_GAMES');
  }
});

test('solo sheeptile: a full slot ends the game as a loss', () => {
  const st = require('../games/sheeptile');
  const s = st.createState();
  st.initGame(s, 1);
  // Pick open tiles until the slot overflows or the run is cleared
  for (let n = 0; n < 500 && s.phase === 'playing'; n++) {
    const me = s.players[0];
    const lv = st._internal.levelTiles(s, me.level);
    const open = lv.filter(t => !me.removed[t.id] && !st._internal.isBlockedAt(t, lv, me.removed));
    if (!open.length) break;
    // Take a different pattern each time so the slot fills instead of matching
    const seen = new Set(me.slot.map(x => x.pattern));
    const pick = open.find(t => !seen.has(st._internal.effPattern(s, 0, t))) || open[0];
    st.handleMove({ type: 'pick', tileId: pick.id }, s, 0);
  }
  assert.equal(s.phase, 'gameover');
  assert.ok(s.players[0].eliminated, 'the run fills the slot');
  if (s.players[0].eliminated) assert.equal(s.winner, -2, 'a failed solo run is not reported as a win');
  else assert.equal(s.winner, 0);
});
