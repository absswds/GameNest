const test = require('node:test');
const assert = require('node:assert/strict');

const { getNextPort, isRecoverablePortError } = require('../startup-port');

test('increments by one when the port is already in use', () => {
  assert.equal(getNextPort('EADDRINUSE', 3000), 3001);
});

test('jumps by one hundred when access to the port is denied', () => {
  assert.equal(getNextPort('EACCES', 3000), 3100);
  assert.equal(getNextPort('EACCES', 3400), 3500);
});

test('can escape the excluded Windows 3000-range within a few retries', () => {
  let port = 3000;
  for (let i = 0; i < 5; i++) {
    port = getNextPort('EACCES', port);
  }
  assert.equal(port, 3500);
});

test('recognizes recoverable listener errors', () => {
  assert.equal(isRecoverablePortError({ code: 'EADDRINUSE' }), true);
  assert.equal(isRecoverablePortError({ code: 'EACCES' }), true);
  assert.equal(isRecoverablePortError({ code: 'ECONNRESET' }), false);
});
