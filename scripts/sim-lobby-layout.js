const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('public/index.html', 'utf8');
assert(!source.includes('id="scrollToJoin"'), 'fixed create button makes the separate join scroll button redundant');
assert(source.indexOf('id="joinSection"') < source.indexOf('id="gameOptions"'), 'join room section must appear before game selection');

console.log('Lobby layout contract passed');
