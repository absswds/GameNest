const game = require('../games/rummikub');
const state = game.createState();
state.hands = [[{ id: 'red-1-a', color: 'red', num: 1 }], []];
state.pool = [{ id: 'blue-2-a', color: 'blue', num: 2 }];
state.currentPlayer = 0;
state.hasBroken = [true, false];
state.playedThisTurn = [true, false];
const result = game.handleMove({ pass: true }, state, 0);
if (result === null) {
  console.error('FAIL: 玩家本回合出过牌后不应还能摸牌');
  process.exit(1);
}
console.log('sim-rummikub-rules: 出牌后不能摸牌 ✓');
