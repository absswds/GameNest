const game = require('../games/rummikub');
const bot = require('../bots/rummikub').createBot(0);

const state = game.createState();
state.hands = [[{ id: 'red-1-a', color: 'red', num: 1 }], []];
state.pool = [];
state.currentPlayer = 0;
state.hasBroken = [true, true];
state.playedThisTurn = [true, false];

const move = bot.getMove(state);
if (!move.endTurn) {
  console.error('FAIL: 魔力桥 AI 出牌后应结束回合，而不是继续摸牌');
  process.exit(1);
}
const result = game.handleMove(move, state, 0);
if (result !== null || state.currentPlayer !== 1) {
  console.error('FAIL: 魔力桥 AI 无法正常结束已出牌的回合');
  process.exit(1);
}
console.log('sim-rummikub-bot: AI 出牌后结束回合 ✓');
