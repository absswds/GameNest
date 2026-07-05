// nodejs-mobile entry wrapper
// Called by node::Start() from the Kotlin/JNI layer.
// Sets the working directory to this script's folder, then loads server.js.
const fs = require('fs');
const path = require('path');
const startupLog = path.join(__dirname, 'android-startup.log');
function logStep(message) {
  fs.appendFileSync(startupLog, message + '\n');
}
logStep('[android-node] main.js start');
process.chdir(__dirname);
logStep('[android-node] cwd=' + __dirname);
logStep('[android-node] requiring server.js');
require('./server.js');
logStep('[android-node] server.js loaded');
