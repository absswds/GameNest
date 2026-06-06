// bots/suikabattle.js — 合成大西瓜 AI (stub: AI不适合此类物理游戏)
exports.name = 'suikabattle';
exports.createBot = (playerIndex) => ({
  name: '电脑' + (playerIndex + 1),
  getMove(state) { return { pass: true }; },
});
