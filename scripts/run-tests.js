const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testsDir = path.resolve(__dirname, '..', 'tests');
const files = fs.readdirSync(testsDir)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => path.join(testsDir, name));

if (files.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});

process.exit(result.status || 0);
