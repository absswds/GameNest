#!/usr/bin/env node
// scripts/launch-desktop.js
// Desktop launcher — starts the server and opens the browser.

const { spawn } = require('child_process');
const http = require('http');

const PORT = process.env.PORT || 3000;
const SERVER_URL = 'http://localhost:' + PORT;

console.log('🎲 GameNest — starting server...');

const server = spawn(process.execPath, [require('path').join(__dirname, '..', 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, PORT: String(PORT) },
});

function poll() {
  const req = http.get(SERVER_URL, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      console.log('✅ Server ready at ' + SERVER_URL);
      const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      spawn(cmd, [SERVER_URL], { detached: true, stdio: 'ignore' });
    } else {
      setTimeout(poll, 500);
    }
  });
  req.on('error', () => setTimeout(poll, 500));
  req.setTimeout(2000, () => { req.destroy(); setTimeout(poll, 500); });
}

setTimeout(poll, 1000);

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill();
  process.exit(0);
});
