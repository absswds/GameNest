const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('public/js/renderers/snakebattle.js', 'utf8');
assert(source.includes('requestAnimationFrame'), 'renderer must animate between server snapshots');
assert(source.includes('interpolateBody'), 'renderer must interpolate body cells instead of snapping to a new snapshot');
assert(source.includes('animationStart'), 'renderer must track the arrival time of the latest server snapshot');

console.log('Snake Battle renderer interpolation contract passed');
