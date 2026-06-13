// games/sheeptile.js — 羊了个羊（关卡制堆叠三消对战，重做）
// 共享布局几何 + per-player 进度。第1关送分热身，第2关高难。剥洋葱算法保证可解。
exports.name = 'sheeptile';
exports.maxPlayers = 6;

const SLOT_SIZE = 7;
const EMOJI_COUNT = 14; // 渲染器图案池上限

// 关卡配置
const LEVELS = [
  { patternCount: 6,  maxOpen: 2, build: buildLevel1 },
  { patternCount: 14, maxOpen: 4, build: buildLevel2 },
];
const MAX_LEVEL = LEVELS.length;

function rand(n) { return Math.floor(Math.random() * n); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- 布局生成 ----------
// 金字塔：每层居中堆叠，上层格数少 → 自动与下层错位 0.5 形成遮挡
function pyramid(out, cx, cy, layers, zBase, level) {
  layers.forEach((L, li) => {
    const z = zBase + li;
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        out.push({
          x: cx + (c - (L.cols - 1) / 2),
          y: cy + (r - (L.rows - 1) / 2),
          z, level, faceDown: false,
        });
      }
    }
  });
}
// 竖排平铺
function column(out, cx, cy, count, level) {
  for (let i = 0; i < count; i++) out.push({ x: cx, y: cy + i, z: 0, level, faceDown: false });
}
// 暗牌队列：横向重叠 0.5，z 递增 → 链式遮挡，仅末端可点
function queue(out, cx, cy, count, level) {
  for (let i = 0; i < count; i++) out.push({ x: cx + i * 0.5, y: cy, z: i + 1, level, faceDown: true });
}

function buildLevel1(out) {
  pyramid(out, 0, 0, [{ cols: 4, rows: 3 }, { cols: 3, rows: 2 }, { cols: 3, rows: 2 }], 0, 1); // 24
}

function buildLevel2(out) {
  pyramid(out, 0, 0, [{ cols: 6, rows: 5 }, { cols: 5, rows: 4 }, { cols: 4, rows: 3 }, { cols: 3, rows: 2 }, { cols: 2, rows: 1 }], 0, 2); // 70
  column(out, -5, -2.5, 6, 2); // 左翼 6
  column(out, 5, -2.5, 6, 2);  // 右翼 6
  queue(out, -4.5, 4.2, 10, 2); // 暗牌队列 10
  queue(out, 0.5, 4.2, 10, 2);  // 暗牌队列 10  → 共 102
}

// ---------- 遮挡判定（同层级内） ----------
function isBlockedAt(tile, levelTiles, removedSet) {
  for (const t of levelTiles) {
    if (t === tile || removedSet[t.id]) continue;
    if (t.z > tile.z && Math.abs(t.x - tile.x) < 1 && Math.abs(t.y - tile.y) < 1) return true;
  }
  return false;
}

// ---------- 剥洋葱：求一个合法移除序列 ----------
function peelOrder(levelTiles) {
  const removed = {};
  const order = [];
  const total = levelTiles.length;
  while (order.length < total) {
    const exposed = levelTiles.filter(t => !removed[t.id] && !isBlockedAt(t, levelTiles, removed));
    if (exposed.length === 0) break; // 理论不会发生（最高层永远暴露）
    const pick = exposed[rand(exposed.length)];
    removed[pick.id] = true;
    order.push(pick);
  }
  return order;
}

// 沿 order 点击，patternByTileId 给定，返回过程中槽位峰值；若中途爆槽返回 Infinity（不可解）
function simulateOrder(order, patternByTileId) {
  const slot = [];
  let peak = 0;
  for (const t of order) {
    slot.push(patternByTileId[t.id]);
    // 三连消除
    const counts = {};
    slot.forEach((p, i) => { (counts[p] = counts[p] || []).push(i); });
    for (const p in counts) {
      if (counts[p].length >= 3) {
        const idxs = counts[p].slice(0, 3).sort((a, b) => b - a);
        idxs.forEach(i => slot.splice(i, 1));
        break;
      }
    }
    if (slot.length > peak) peak = slot.length;
    if (slot.length >= SLOT_SIZE) return Infinity;
  }
  return peak;
}

// 为一个层级生成可解的 pattern 分配（剥洋葱基线：沿一个合法移除序列把连续三元组设为同图案）
// 这保证「存在一个点击顺序能全清」（严格可解）。难度来自几何（深堆叠 + 暗牌队列）与图案数，
// 而非沿固定序列打乱图案——后者会让该序列瞬间爆槽、破坏可解性。
// 返回 {map, order, peak}：order 为保证可解的点击序列（仅生成/测试用，不下发给客户端）。
function generateSolvableLevel(levelTiles, cfg) {
  const order = peelOrder(levelTiles);
  const groups = Math.floor(order.length / 3);
  const map = {};
  for (let k = 0; k < groups; k++) {
    const pat = k % cfg.patternCount;
    map[order[3 * k].id] = pat;
    map[order[3 * k + 1].id] = pat;
    map[order[3 * k + 2].id] = pat;
  }
  // 多出的尾牌（order 长度非 3 倍数时）并入最后一组图案
  for (let k = groups * 3; k < order.length; k++) map[order[k].id] = (groups - 1 >= 0 ? (groups - 1) % cfg.patternCount : 0);
  return { map, order, peak: simulateOrder(order, map) };
}

// ---------- 状态 ----------
exports.createState = () => ({
  phase: 'playing',
  winner: null,
  currentPlayer: 0,
  _playerCount: 0,
  sameBoard: true,
  layout: [],                 // [{id,x,y,z,level,faceDown}] 共享几何
  patterns: [],               // [boardIdx] -> {tileId: pattern}，sameBoard 时只用 [0]
  levelTileIds: { 1: [], 2: [] },
  maxOpen: { 1: 2, 2: 4 },
  slotSize: SLOT_SIZE,
  emojiCount: EMOJI_COUNT,
  players: [],
});

function buildLayout() {
  const layout = [];
  for (let lv = 0; lv < MAX_LEVEL; lv++) LEVELS[lv].build(layout);
  layout.forEach((t, i) => { t.id = i; });
  return layout;
}

exports.initGame = (state, playerCount) => {
  const options = state._options || {};
  state._playerCount = playerCount;
  state.sameBoard = options.sameBoard !== false; // 默认同一张棋盘
  state.phase = 'playing';
  state.winner = null;
  state.currentPlayer = 0;

  state.layout = buildLayout();
  state.levelTileIds = { 1: [], 2: [] };
  state.layout.forEach(t => state.levelTileIds[t.level].push(t.id));
  state.maxOpen = { 1: LEVELS[0].maxOpen, 2: LEVELS[1].maxOpen };

  const boards = state.sameBoard ? 1 : playerCount;
  state.patterns = [];
  for (let b = 0; b < boards; b++) {
    const pat = {};
    for (let lv = 0; lv < MAX_LEVEL; lv++) {
      const lt = state.layout.filter(t => t.level === lv + 1);
      Object.assign(pat, generateSolvableLevel(lt, LEVELS[lv]).map);
    }
    state.patterns.push(pat);
  }

  state.players = [];
  for (let i = 0; i < playerCount; i++) {
    state.players.push(newPlayerProgress());
  }
};

function newPlayerProgress() {
  return {
    level: 1,
    removed: {},
    slot: [],
    score: 0,
    eliminated: false,
    powers: { undo: 1, shuffle: 1, pop3: 1 },
    shuffleOverride: {},
  };
}

function patBoard(state, pi) { return state.sameBoard ? state.patterns[0] : state.patterns[pi]; }
function effPattern(state, pi, tile) {
  const p = state.players[pi];
  if (p.shuffleOverride && p.shuffleOverride[tile.id] !== undefined) return p.shuffleOverride[tile.id];
  return patBoard(state, pi)[tile.id];
}
function levelTiles(state, level) { return state.layout.filter(t => t.level === level); }

// ---------- 走子 ----------
exports.handleMove = (data, state, playerIndex) => {
  if (state.phase !== 'playing') return '游戏已结束';
  const me = state.players[playerIndex];
  if (!me) return '无此玩家';
  if (me.eliminated) { state.currentPlayer = nextAlive(state, playerIndex); return '你已出局'; }

  const lvTiles = levelTiles(state, me.level);
  // 推进 currentPlayer（跳过已出局者）以驱动 bot 调度
  const advance = () => { state.currentPlayer = nextAlive(state, playerIndex); };

  if (data.type === 'pick') {
    const tile = state.layout.find(t => t.id === data.tileId);
    if (!tile) return '找不到此牌';
    if (tile.level !== me.level) return '不是当前关卡的牌';
    if (me.removed[tile.id]) return '已移除';
    if (isBlockedAt(tile, lvTiles, me.removed)) return '被遮挡，无法点击';

    me.removed[tile.id] = true;
    me.slot.push({ pattern: effPattern(state, playerIndex, tile), fromId: tile.id });

    // 三连消除
    const counts = {};
    me.slot.forEach((s, i) => { (counts[s.pattern] = counts[s.pattern] || []).push(i); });
    for (const pat in counts) {
      if (counts[pat].length >= 3) {
        const idxs = counts[pat].slice(0, 3).sort((a, b) => b - a);
        idxs.forEach(i => me.slot.splice(i, 1));
        me.score += 3;
        break;
      }
    }

    // 爆槽出局
    if (me.slot.length >= SLOT_SIZE) {
      me.eliminated = true;
      settle(state);
      advance();
      return null;
    }

    // 当前关卡清空 → 进下一关 / 通关
    const cleared = lvTiles.every(t => me.removed[t.id]);
    if (cleared) {
      if (me.level < MAX_LEVEL) {
        me.level++;
        me.slot = [];
        me.powers = { undo: 1, shuffle: 1, pop3: 1 };
        me.shuffleOverride = {};
      } else {
        state.winner = playerIndex;
        state.phase = 'gameover';
        return null;
      }
    }

    settle(state);
    advance();
    return null;
  }

  if (data.type === 'power_undo') {
    if (me.powers.undo <= 0) return '撤回次数已用完';
    if (me.slot.length === 0) return '槽位为空';
    const last = me.slot.pop();
    delete me.removed[last.fromId];
    me.powers.undo--;
    advance();
    return null;
  }

  if (data.type === 'power_shuffle') {
    if (me.powers.shuffle <= 0) return '洗牌次数已用完';
    const remain = lvTiles.filter(t => !me.removed[t.id]);
    const pats = shuffle(remain.map(t => effPattern(state, playerIndex, t)));
    remain.forEach((t, i) => { me.shuffleOverride[t.id] = pats[i]; });
    me.powers.shuffle--;
    advance();
    return null;
  }

  if (data.type === 'power_pop3') {
    if (me.powers.pop3 <= 0) return '移出次数已用完';
    if (me.slot.length === 0) return '槽位为空';
    me.slot.splice(0, Math.min(3, me.slot.length)); // 移出槽位前 3 张（出局）
    me.powers.pop3--;
    advance();
    return null;
  }

  return '未知操作';
};

// 下一个未出局玩家（无则 +1）
function nextAlive(state, from) {
  for (let k = 1; k <= state._playerCount; k++) {
    const idx = (from + k) % state._playerCount;
    if (!state.players[idx].eliminated) return idx;
  }
  return (from + 1) % state._playerCount;
}

// 结算：最后存活 / 全部出局
function settle(state) {
  if (state.phase === 'gameover') return;
  const alive = [];
  for (let i = 0; i < state._playerCount; i++) if (!state.players[i].eliminated) alive.push(i);
  if (state._playerCount > 1 && alive.length === 1) {
    state.winner = alive[0];
    state.phase = 'gameover';
  } else if (alive.length === 0) {
    // 全部爆槽：得分最高者胜
    let best = 0, bs = -1;
    for (let i = 0; i < state._playerCount; i++) {
      if (state.players[i].score > bs) { bs = state.players[i].score; best = i; }
    }
    state.winner = best;
    state.phase = 'gameover';
  }
}

// 导出给 bot/测试用
exports._internal = { peelOrder, simulateOrder, generateSolvableLevel, isBlockedAt, effPattern, levelTiles, buildLayout, LEVELS };
