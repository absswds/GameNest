#!/usr/bin/env node
const http = require('http');
const { spawn } = require('child_process');

var PORT = process.env.PORT || 3000;
var URL = 'http://localhost:' + PORT;

console.log('  ╔══════════════════════════════════════╗');
console.log('  ║     GameNest  -  starting server...  ║');
console.log('  ╚══════════════════════════════════════╝');

require('./server');

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
  req.setTimeout(2000, function() { req.destroy(); setTimeout(poll, 500, n + 1); });
}

setTimeout(poll, 1500, 0);

process.on('SIGINT', function() { process.exit(0); });
process.on('SIGTERM', function() { process.exit(0); });
