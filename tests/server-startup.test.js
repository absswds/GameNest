const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('server removes stale listening callback before retrying a new port', () => {
  const js = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const match = js.match(/function startServer\(port, attempt = 0\) \{[\s\S]*?\r?\n\}\r?\n\r?\nstartServer\(PORT\);/);
  assert.ok(match, 'startServer block should be found');
  const block = match[0];
  assert.ok(
    /server\.off\('listening',\s*onListening\)/.test(block),
    'retry should remove the previous listening callback so only the real active port is logged'
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
