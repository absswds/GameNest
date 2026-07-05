const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

function loadCatalog() {
  const catalogPath = path.join(__dirname, '..', 'public', 'js', 'game-catalog.js');
  const source = fs.readFileSync(catalogPath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: catalogPath });
  return sandbox.window.gameCatalog.list();
}

test('every game in the lobby catalog has a cover asset', () => {
  const catalog = Array.from(loadCatalog());
  const missing = catalog
    .filter((game) => !game.cover)
    .map((game) => game.id);

  assert.deepEqual(missing, []);
});

test('every game in the lobby catalog points to an image cover asset', () => {
  const catalog = Array.from(loadCatalog());
  const nonImage = catalog
    .filter((game) => !/\.(svg|png|jpe?g|webp)$/i.test(game.cover || ''))
    .map((game) => ({ id: game.id, cover: game.cover }));

  assert.deepEqual(nonImage, []);
});

test('every configured cover file exists on disk', () => {
  const catalog = Array.from(loadCatalog());
  const missingFiles = catalog
    .filter((game) => game.cover)
    .filter((game) => !fs.existsSync(path.join(__dirname, '..', 'public', game.cover.replace(/^\//, '').replace(/\//g, path.sep))))
    .map((game) => game.cover);

  assert.deepEqual(missingFiles, []);
});
