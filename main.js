// nodejs-mobile entry wrapper
// Called by node::Start() from the Kotlin/JNI layer.
// Sets the working directory to this script's folder, then loads server.js.
process.chdir(__dirname);
require('./server.js');
