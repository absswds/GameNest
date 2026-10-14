const assert = require('assert');
const fs = require('fs');
const game = require('../games/monopoly');

const board = game.createState().board;
assert.strictEqual(board[8].color, '#3F51B5', '南京路色组必须与蓝色玩家条明显区分');
assert.strictEqual(game.calculatePropertyRent(board[8], 0, false), 6, '南京路未盖房租金按卡面 $6');
assert.strictEqual(game.calculatePropertyRent(board[8], 0, true), 12, '垄断但未盖房时仍应翻倍');
assert.strictEqual(game.calculatePropertyRent(board[8], 1, false), 30, '盖房后租金按卡面');

const renderer = fs.readFileSync('public/js/renderers/monopoly.js', 'utf8');
assert(renderer.includes('priceTextColor'), '价格文字必须按地块底色选择可读颜色');

console.log('Monopoly tuning contract passed');
