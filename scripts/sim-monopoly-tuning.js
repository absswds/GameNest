const assert = require('assert');
const fs = require('fs');
const game = require('../games/monopoly');

const board = game.createState().board;
assert.strictEqual(board[8].color, '#3F51B5', '南京路色组必须与蓝色玩家条明显区分');
assert.strictEqual(game.calculatePropertyRent(board[8], 0, false), 18, '南京路未盖房租金应从 $6 提升至 $18');
assert.strictEqual(game.calculatePropertyRent(board[8], 0, true), 36, '垄断但未盖房时仍应翻倍');
assert.strictEqual(game.calculatePropertyRent(board[8], 1, false), 45, '盖房后租金应保持加速节奏但不暴涨');

const renderer = fs.readFileSync('public/js/renderers/monopoly.js', 'utf8');
assert(renderer.includes('priceTextColor'), '价格文字必须按地块底色选择可读颜色');

console.log('Monopoly tuning contract passed');
