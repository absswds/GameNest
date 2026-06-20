const fs = require('fs');

const games = {};
const bots = {};
for (const file of fs.readdirSync('games')) {
  if (!file.endsWith('.js')) continue;
  const mod = require('../games/' + file);
  if (mod.name) games[mod.name] = mod;
}
for (const file of fs.readdirSync('bots')) {
  if (!file.endsWith('.js')) continue;
  const mod = require('../bots/' + file);
  if (mod.name) bots[mod.name] = mod;
}

const terminalPhases = new Set(['over', 'gameover', 'round_end', 'showdown']);
const failures = [];

for (const name of Object.keys(bots).sort()) {
  const game = games[name];
  const playerCount = name === 'doudizhu' ? 3 : Math.min(2, game.maxPlayers);
  const state = game.createState();
  state._playerCount = playerCount;
  state._realPlayerCount = 0;
  state._hasBots = true;
  state._options = {};

  try {
    if (game.initGame) game.initGame(state, playerCount);
    for (let step = 0; step < 20; step++) {
      if ((state.winner !== null && state.winner !== undefined) || terminalPhases.has(state.phase)) break;
      const playerIndex = state.phase === 'shooting' && Number.isInteger(state.currentShooter)
        ? state.currentShooter
        : (Number.isInteger(state.currentPlayer) ? state.currentPlayer : 0);
      const move = bots[name].createBot(playerIndex).getMove(state);
      const error = game.handleMove(move, state, playerIndex);
      if (error) throw new Error(error);
    }
    console.log(name + ': ✓');
  } catch (error) {
    failures.push(name + ': ' + error.message);
    console.error(name + ': FAIL - ' + error.message);
  }
}

if (failures.length) process.exit(1);
console.log('sim-ai-smoke: 全部 AI 冒烟通过 ✓');
