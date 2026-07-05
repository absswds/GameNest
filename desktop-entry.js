#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');

var URL;

console.log('  ╔══════════════════════════════════════╗');
console.log('  ║     GameNest  -  starting server...  ║');
console.log('  ╚══════════════════════════════════════╝');

const serverMod = require('./server');
const serverInstance = serverMod.server;

serverInstance.on('listening', function() {
  URL = 'http://localhost:' + serverMod.getActivePort();
  setTimeout(poll, 500, 0);
});

function poll(n) {
  if (n > 40) return;
  var req = http.get(URL, function(res) {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      if (process.platform === 'win32') {
        spawn('cmd', ['/c', 'start', URL], { detached: true, stdio: 'ignore' });
      } else {
        spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [URL], { detached: true, stdio: 'ignore' });
      }
    } else {
      setTimeout(poll, 500, n + 1);
    }
  });
  req.on('error', function() { setTimeout(poll, 500, n + 1); });
  req.setTimeout(2000, function() { req.destroy(); });
}

process.on('SIGINT', function() { process.exit(0); });
process.on('SIGTERM', function() { process.exit(0); });
