// games/suikabattle.js — 合成大西瓜对战版
// 服务端只保存每位玩家的分数、当前水果类型、下一个水果类型和出局状态
// 物理引擎（Matter.js）完全在客户端运行
exports.name = 'suikabattle';
exports.maxPlayers = 4;
exports.minPlayers = 1;

const FRUIT_COUNT = 11;

function randFruit() { return Math.floor(Math.random() * 5); } // 只随机小水果(0-4)

exports.createState = () => ({
  phase: 'playing',
  scores: [],
  current: [],   // current fruit type per player
  next: [],      // next fruit type per player
  eliminated: [],
  winner: null,
  _playerCount: 0,
});

exports.initGame = (state, playerCount) => {
  state._playerCount = playerCount;
  state.scores = [];
  state.current = [];
  state.next = [];
  state.eliminated = [];
  for (let i = 0; i < playerCount; i++) {
    state.scores.push(0);
    state.current.push(randFruit());
    state.next.push(randFruit());
    state.eliminated.push(false);
  }
  state.phase = 'playing';
  state.winner = null;
};

exports.handleMove = (data, state, playerIndex) => {
  if (state.phase !== 'playing') return 'g_game_over';
  if (state.eliminated[playerIndex]) return 'sk_you_are_out';

  if (data.type === 'drop') {
    // Client dropped a fruit, advance to next fruit
    state.current[playerIndex] = state.next[playerIndex];
    state.next[playerIndex] = randFruit();
    return null;
  }

  if (data.type === 'merge') {
    // Client reports a merge (two fruits combined)
    const points = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];
    state.scores[playerIndex] += points[data.fruitType] || 1;
    return null;
  }

  if (data.type === 'gameover') {
    // Client reports box overflow
    state.eliminated[playerIndex] = true;
    const alive = state.eliminated.filter(e => !e).length;
    if (alive === 0 || state._playerCount === 1) {
      let best = 0;
      for (let i = 1; i < state._playerCount; i++) {
        if (state.scores[i] > state.scores[best]) best = i;
      }
      state.winner = best;
      state.phase = 'gameover';
    } else if (alive === 1 && state._playerCount > 1) {
      state.winner = state.eliminated.indexOf(false);
      state.phase = 'gameover';
    }
    return null;
  }

  return 'g_unknown_action';
};
