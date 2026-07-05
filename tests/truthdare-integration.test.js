const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    console.error('not ok - ' + name);
    throw err;
  }
}

test('truthdare is registered in lobby and game shell', () => {
  const catalog = read('public/js/game-catalog.js');
  assert.match(catalog, /truthdare:\s*\{/);
  assert.match(catalog, /id:\s*'truthdare'/);
  assert.match(read('public/game.html'), /\/js\/renderers\/truthdare\.js/);
  assert.ok(fs.existsSync(path.join(root, 'public/js/renderers/truthdare.js')));
});

test('truthdare has waiting-room options and disables AI', () => {
  const roomClient = read('public/js/room-client.js');
  assert.match(roomClient, /NO_AI_GAMES = new Set\(\[[^\]]*'truthdare'/);
  assert.match(roomClient, /game === 'truthdare'/);
  assert.match(roomClient, /_tdCollectDecks/);
});

test('truthdare has a tutorial entry for the game rules button', () => {
  const tutorials = read('public/js/tutorials.js');
  assert.match(tutorials, /truthdare:\s*\{/);
  assert.match(tutorials, /场外剪刀石头布/);
  assert.match(tutorials, /自定义牌库/);
});
