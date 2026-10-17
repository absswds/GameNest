// scripts/sim-monopoly.js — 大富翁逻辑 + bot 验证（含建房）
const game = require('../games/monopoly');
const botMod = require('../bots/monopoly');

let failures = 0;
function assert(cond, msg) { if (!cond) { failures++; console.error('FAIL:', msg); } }

// 棋盘结构断言
const B = game.createState().board;
assert(B.length === 28, '棋盘应为 28 格');
assert(B[0].type === 'go' && B[7].type === 'jail_visit' && B[14].type === 'free_parking' && B[21].type === 'go_to_jail', '四角应为 GO/监狱探视/免费停车/入狱');

let gameovers = 0, maxStepsHit = 0, builtHouses = 0, tradeOffers = 0, tradeAccepts = 0;
const TRIALS = 500;

for (let t = 0; t < TRIALS; t++) {
  const playerCount = 2 + Math.floor(Math.random() * 5); // 2-6
  const state = game.createState();
  state._playerCount = playerCount;
  state._options = { trading: true };
  game.initGame(state, playerCount);

  const bots = [];
  for (let i = 0; i < playerCount; i++) bots.push(botMod.createBot(i));

  let steps = 0;
  while (state.phase !== 'gameover' && steps < 5000) {
    steps++;
    const actor = game.getCurrentActor ? game.getCurrentActor(state) : state.currentPlayer;
    const move = bots[actor].getMove(state);
    if (move.type === 'build') builtHouses++;
    if (move.type === 'trade_offer') tradeOffers++;
    if (move.type === 'trade_accept') tradeAccepts++;
    const err = game.handleMove(move, state, actor);
    if (err) {
      if (state.tradeOffer) {
        // Trade error or decline fallback
        game.handleMove({ type: 'trade_decline' }, state, state.tradeOffer.to);
      } else {
        // 回退保证推进
        const fb = game.handleMove({ type: 'end_turn' }, state, actor);
        if (fb && state.phase === 'waiting') game.handleMove({ type: 'roll' }, state, actor);
      }
    }
    // cash 不应变 NaN
    for (let i = 0; i < playerCount; i++) {
      if (Number.isNaN(state.cash[i])) { assert(false, `trial${t} 玩家${i} cash 变 NaN`); steps = 5000; break; }
    }
    // 监狱位置一致性：inJail 的玩家应在 JAIL_INDEX(7)
    for (let i = 0; i < playerCount; i++) {
      if (state.inJail[i]) assert(state.positions[i] === 7, `trial${t} 入狱玩家${i}应在格7，实际${state.positions[i]}`);
    }
  }
  if (state.phase === 'gameover') {
    gameovers++;
    assert(state.winner !== null && state.winner !== undefined, `trial${t} gameover 应有 winner`);
  } else {
    maxStepsHit++;
  }
}

// 建房与交易统计
assert(builtHouses > 0, 'bot 应至少建过房（' + builtHouses + ' 次）');
console.log(`局数 ${TRIALS}：分出胜负 ${gameovers}，达步数上限 ${maxStepsHit}，bot 建房 ${builtHouses} 次，交易提议 ${tradeOffers} 次，达成交易 ${tradeAccepts} 次`);


if (failures === 0) {
  console.log('sim-monopoly: 全部通过 ✓');
} else {
  console.error(`sim-monopoly: ${failures} 处失败 ✗`);
  process.exit(1);
}
