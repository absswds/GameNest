const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('public/index.html', 'utf8');
assert(!source.includes('id="scrollToJoin"'), 'fixed create button makes the separate join scroll button redundant');
assert(source.indexOf('id="joinSection"') < source.indexOf('id="gameOptions"'), 'join room section must appear before game selection');
assert(!source.includes('id="createBtn"'), 'the inline create button duplicates the fixed create button');
assert(source.includes('function createRoom()'), 'the fixed create button must retain a direct room creation handler');

console.log('Lobby layout contract passed');
