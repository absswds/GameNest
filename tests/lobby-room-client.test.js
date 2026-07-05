const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('resume room banner does not contain mojibake text', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const match = html.match(/<section class="hero-panel" id="resumeSection"[\s\S]*?<\/section>/);
  assert.ok(match, 'resumeSection should exist');
  assert.equal(/[馃鈿鉁]/.test(match[0]), false, 'resume banner should avoid mojibake glyphs');
});

test('seat swap player index update refreshes host controls', () => {
  const js = fs.readFileSync(path.join(root, 'public', 'js', 'room-client.js'), 'utf8');
  const match = js.match(/if \(msg\.type === 'player_index_updated'\) \{([\s\S]*?)\n      \}/);
  assert.ok(match, 'player_index_updated handler should exist');
  assert.ok(
    /updateWaitingRoom\(\)/.test(match[1]),
    'player_index_updated should rerender the waiting room after changing playerIndex'
  );
});

test('seat swap ready state logic does not toggle both seats', () => {
  const js = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const start = js.indexOf('// Swap ready states');
  const end = js.indexOf('// Transfer host', start);
  assert.ok(start >= 0 && end > start, 'swap ready states block should exist');
  const block = js.slice(start, end);
  assert.equal(/else currentRoom\.readyPlayers\.add/.test(block), false);
  assert.ok(/currentRoom\.readyPlayers\.add\(toIndex\)/.test(block));
  assert.ok(/currentRoom\.readyPlayers\.add\(fromIndex\)/.test(block));
});

test('lobby resume banner keeps the primary button compact', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'style.css'), 'utf8');
  const start = css.indexOf('.lobby-page .room-banner {');
  const end = css.indexOf('.lobby-page .wifi-note {', start);
  assert.ok(start >= 0 && end > start, 'lobby room banner block should exist');
  const block = css.slice(start, end);
  assert.ok(/grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto;/.test(block));
  assert.ok(/\.lobby-page \.room-banner-btn\s*\{[\s\S]*width:\s*auto;/.test(block));
});

test('truthdare catalog entry uses a real cover image', () => {
  const js = fs.readFileSync(path.join(root, 'public', 'js', 'game-catalog.js'), 'utf8');
  const match = js.match(/truthdare:\s*\{[\s\S]*?cover:\s*'([^']+)'/);
  assert.ok(match, 'truthdare entry should define a cover');
  assert.equal(match[1], '/assets/game-covers/truthdare.svg');
  assert.ok(fs.existsSync(path.join(root, 'public', match[1].replace(/^\//, ''))));
});

test('in-game player bar renders player avatars beside names', () => {
  const js = fs.readFileSync(path.join(root, 'public', 'js', 'room-client.js'), 'utf8');
  const match = js.match(/function updatePlayerBar\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(match, 'updatePlayerBar should exist');
  assert.ok(
    /player-tag-avatar/.test(match[1]) && /const avatar = p\.avatar \|\|/.test(match[1]),
    'player bar should render each player avatar with a fallback avatar value'
  );
});

test('shared room shell summary includes the room id', () => {
  const js = fs.readFileSync(path.join(root, 'public', 'js', 'room-client.js'), 'utf8');
  const match = js.match(/function updateSharedShell\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(match, 'updateSharedShell should exist');
  assert.ok(
    /setText\('activeGameSubtitle',\s*roomContextSummary\(\)\)/.test(match[1]),
    'top shell subtitle should explicitly include the current room id'
  );
});

test('stage room facts include both game name and room id', () => {
  const js = fs.readFileSync(path.join(root, 'public', 'js', 'room-client.js'), 'utf8');
  const match = js.match(/function updateSharedShell\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(match, 'updateSharedShell should exist');
  assert.ok(
    /setText\('stageRoomFacts',\s*roomContextSummary\(\)\s*\+/.test(match[1]),
    'stage room facts should include the active game name and current room id together'
  );
});

test('playing room updates refresh the shared shell and player bar', () => {
  const js = fs.readFileSync(path.join(root, 'public', 'js', 'room-client.js'), 'utf8');
  const match = js.match(/function updateWaitingRoom\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(match, 'updateWaitingRoom should exist');
  const playingBranch = match[1].match(/if \(roomPhase === 'playing'\) \{([\s\S]*?)return;/);
  assert.ok(playingBranch, 'playing branch should exist');
  assert.ok(/updateSharedShell\(\)/.test(playingBranch[1]), 'playing updates should refresh room title/facts');
  assert.ok(/updatePlayerBar\(\)/.test(playingBranch[1]), 'playing updates should refresh avatars and names');
});

test('resume joins broadcast a room update to other players', () => {
  const js = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const match = js.match(/if \(resumable\) \{([\s\S]*?)\n        return;/);
  assert.ok(match, 'resumable join branch should exist');
  assert.ok(
    /sendToRoom\(room,\s*\{[\s\S]*type:\s*'room_update'/.test(match[1]),
    'resuming a seat should notify other clients immediately'
  );
});

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    console.error('not ok - ' + name);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}
