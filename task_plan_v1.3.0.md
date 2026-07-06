# GameNest v1.3.0 执行计划：经典棋盘包 + GitHub 涨星

> 本文件是自包含的执行计划，可直接转交 AI agent 按"执行顺序"逐步实现。
> 仓库：`D:\binbi\Documents\Code\project\game`（GitHub: absswds/GameNest）
> 参考文档：`AGENTS.md`（架构/坑点）、`CONTRIBUTING.md`（新游戏流程）、`docs/ARCHITECTURE.md`

---

## 总览

| 项 | 内容 |
|---|---|
| 版本 | v1.3.0 |
| 新增游戏 | 4 款：Chess（国际象棋）、Checkers（西洋跳棋）、Connect Four（四子棋）、Reversi（黑白棋） |
| 游戏总数 | 23 → 27 |
| 共性 | 全是 2 人 Canvas 棋盘 + minimax AI + 全公开信息（用 playerView 注入 legalMoves 做走法提示，模式同 chinesechess） |
| server.js | **零改动**（v1.2.0 重构后 `broadcastGameView` 通用分支自动处理 playerView） |
| room-client.js | **零改动**（完全通用，通过 `window.gameCatalog.byId(id)` 和 `window.gameRenderers.get(game)` 调度） |
| 复用 | 4 款渲染器/bot 共用 `public/js/renderers/chinesechess.js` 的 animState/drawFrame/init/render 骨架；Chess 额外 vendor chess.js v0.12.1 规则库 |
| 参考实现 | `games/chinesechess.js` / `bots/chinesechess.js` / `public/js/renderers/chinesechess.js`（最相似模板） |

---

## 关键架构事实（已核实，执行时务必遵守）

1. **server.js 无 per-player 硬编码分支**。`broadcastGameView`（server.js:255）按 `gameMod.playerView` / `gameMod.playerBoardView` 是否存在自动分发。新游戏只要导出 `playerView`，自动走通用分支。
2. **bot 自动注册**。server.js:40-50 自动扫描 `games/*.js` 和 `bots/*.js`，按 `exports.name` 匹配。新游戏无需手动注册。
3. **scheduleBotMove**（server.js:435）默认用 `state.currentPlayer` 查 bot；有三级容错（非法→`{pass:true}`→`{}`），保证回合推进不卡死。新游戏 `handleMove` 应让"空 data / pass"成为安全的推进操作。
4. **applyRuntimeState**（server.js:277）在 `start_game` / `game_restart` 后自动重注入 `_playerCount` / `_realPlayerCount` / `_hasBots` / `_options` / `_lang` 到 state。`createState()` 重置后这些字段会自动恢复，无需手动处理。
5. **Canvas 尺寸**：渲染器 resize 必须用 `window.innerWidth/innerHeight`，**不要用 `container.clientWidth`**（boardArea 无显式宽度，常读到 0）。不要在 `style.css` 给 canvas 设 `max-width`（会覆盖 JS inline 宽度）。
6. **渲染器模块级变量跨局持久**：渲染器是单例，`stopAnimLoop()` + 重置模块级变量（selRow/selCol/prevBoard 等）必须在 `init()` 开头执行。
7. **字体**：Canvas `ctx.font` 不要以 `system-ui` 开头（跨 OS 差异大）。Chess/Checkers/Connect4/Reversi 用 Unicode 棋子字符或几何图形，字体栈用系统符号字体。
8. **nodejs-mobile v18.20.4**：不能用依赖 Node 20+ 的库（如 js-chess-engine v2 要 Node 24）。Chess 规则库选 chess.js v0.12.1（纯 JS、零依赖、Node 18 安全）。
9. **Express 必须 4.x**，不能升级到 5.x（nodejs-mobile ICU 不支持 path-to-regexp 的 Unicode regex）。
10. **bot 的 getMove 不要 mutate server state**。用 `new Chess(fen)` / 深拷贝 board 创建独立实例。`[...hand].sort()` 而非 `hand.sort()`。

---

## 游戏 1：Chess 国际象棋（完整 FIDE 规则）

### 0. 许可证合规（先做）
- 下载 `https://cdn.jsdelivr.net/npm/chess.js@0.12.1/chess.js`（1971 行，BSD-2-Clause）→ `games/vendor/chessjs.js`
- 文件头保留原版权：`Copyright (c) 2021, Jeff Hlywa (jhlywa@gmail.com)`
- 仓库根新建 `NOTICE`（若不存在），追加：
  ```
  This product includes software developed by Jeff Hlywa (https://github.com/jhlywa/chess.js)
  - chess.js v0.12.1, BSD-2-Clause, vendored at games/vendor/chessjs.js
  ```
- Apache-2.0 要求保留第三方 NOTICE，BSD-2 要求保留版权声明，两者都满足

### chess.js v0.12.1 API（已核实）
- `new Chess(fen?)` — 默认标准开局
- `.move(move, {sloppy:true})` — move 可为 SAN 字符串 `'e4'` 或对象 `{from:'e2',to:'e4',promotion:'q'}`；返回 move 对象或 `null`（非法）
- `.moves({verbose:true})` — 返回 `[{from,to,promotion,piece,captured,flags,...}]`；不带 verbose 返回 SAN 字符串数组
- `.fen()` → FEN 字符串
- `.board()` → 8×8 数组，元素为 `{type:'p'|'n'|'b'|'r'|'q'|'k', color:'w'|'b', square:'e4'}` 或 `null`
- `.turn()` → `'w'` 或 `'b'`
- `.game_over()` / `.in_checkmate()` / `.in_stalemate()` / `.in_draw()` / `.in_threefold_repetition()` / `.insufficient_material()` / `.in_check()`
- `.history({verbose:true})` / `.load(fen)` / `.get(square)` / `.put(piece,square)` / `.remove(square)` / `.undo()`

### 1.1 `games/chess.js`（新建，适配层）

**状态结构**（对齐项目约定）：
```js
exports.name = 'chess';
exports.maxPlayers = 2;

exports.createState = () => ({
  currentPlayer: 0,        // 0=白 1=黑，白先
  winner: null,            // null 进行中；0/1 获胜方；-1 和棋
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  board: null,             // 8×8 渲染用快照（每次走子后刷新）
  moveHistory: [],         // [{from,to,promotion,piece,captured,san}]
  _playerCount: 2,         // 运行时注入
});

exports.initGame = (state) => {
  const Chess = require('./vendor/chessjs').Chess;
  const c = new Chess(state.fen);
  state.board = snapshotBoard(c);   // 转成 renderer 期望的 {type:'P'|'N'|'B'|'R'|'Q'|'K', side:0|1} 格式
};
```

**handleMove(data, state, playerIndex)**：
1. `if (state.winner !== null) return '对局已结束';`
2. `if (state.currentPlayer !== playerIndex) return '不是你的回合';`
3. 解析 `data = { from:{row,col}, to:{row,col}, promote?:'Q'|'R'|'B'|'N' }`
4. 行列转棋盘坐标：`square = files[col] + (8-row)`（row 0=黑方第8排顶，col 0=a；`files = 'abcdefgh'`）
5. `const c = new Chess(state.fen);`
6. `const mv = c.move({from:sqFrom, to:sqTo, promotion:(data.promote||'q').toLowerCase()}, {sloppy:true});` → `if (!mv) return '非法走法';`
7. 更新 state：`state.fen = c.fen(); state.board = snapshotBoard(c); state.moveHistory.push({from:data.from, to:data.to, promotion:mv.promotion, piece:mv.piece, captured:mv.captured, san:mv.san});`
8. 判终局：
   - `c.in_checkmate()` → `state.winner = playerIndex`（将死，当前玩家胜）
   - `c.in_stalemate()` / `c.in_draw()` / `c.insufficient_material()` / `c.in_threefold_repetition()` → `state.winner = -1`（和棋）
   - 否则 `state.currentPlayer = 1 - state.currentPlayer`
9. return `null`（成功）

**playerView(state, playerIndex)** — 照搬中国象棋模式：
```js
exports.playerView = function(state, playerIndex) {
  const Chess = require('./vendor/chessjs').Chess;
  var view = {
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    fen: state.fen,
    board: state.board,
    moveHistory: state.moveHistory,
    _playerCount: state._playerCount
  };
  if (state.winner === null && state.currentPlayer === playerIndex) {
    const c = new Chess(state.fen);
    view.legalMoves = c.moves({verbose:true}).map(m => ({
      from: sqToCoord(m.from), to: sqToCoord(m.to),
      promotion: m.promotion || null
    }));
  } else {
    view.legalMoves = [];
  }
  return view;
};
```
**关键**：`legalMoves` 只注入给当前轮到的玩家。`broadcastGameView`（server.js:255）自动通过 `gameMod.playerView` 分发，**server.js 零改动**。

**辅助函数**：
- `snapshotBoard(c)` → 把 `c.board()` 的 `{type,color}` 转成 `{type:'P'|'N'|'B'|'R'|'Q'|'K', side:0|1}`（side = color==='w'?0:1），8×8 数组，row 0=黑方顶
- `sqToCoord(sq)` → `{row: 8 - parseInt(sq[1]), col: files.indexOf(sq[0])}`
- `const files = 'abcdefgh';`

### 1.2 `bots/chess.js`（新建，AI）

仿 `bots/chinesechess.js` 结构：
```js
const { botName } = require('./lib/bot-name');
exports.name = 'chess';
exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) { ... }
});
```

**getMove(state)**：
1. `const Chess = require('../games/vendor/chessjs').Chess;`
2. `const c = new Chess(state.fen);` `if (c.game_over()) return null;`
3. `const moves = c.moves({verbose:true});`
4. 吃子排序：`moves.sort((a,b) => pieceVal(b.captured) - pieceVal(a.captured))`
5. 对每个走法：`c.move(mv)` → `score = -negamax(c, 2, -INF, +INF)`（depth 3 = 根 + 2 层）→ `c.undo()`
6. 取最高分走法，返回 `{from:{row,col}, to:{row,col}, promote: mv.promotion ? mv.promotion.toUpperCase() : undefined}`

**negamax(c, depth, alpha, beta)** — negamax + alpha-beta：
```js
function negamax(c, depth, alpha, beta) {
  if (depth === 0) return evaluate(c);
  if (c.game_over()) {
    if (c.in_checkmate()) return -MATE + (3 - depth);  // 被将死，当前方劣势
    return 0; // 和棋
  }
  const moves = c.moves({verbose:true});
  moves.sort((a,b) => pieceVal(b.captured) - pieceVal(a.captured));
  let best = -Infinity;
  for (const m of moves) {
    c.move(m);
    const val = -negamax(c, depth-1, -beta, -alpha);
    c.undo();
    if (val > best) best = val;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
```

**evaluate(c)** — 物质 + piece-square table：
- `PIECE_VAL = {p:100, n:320, b:330, r:500, q:900, k:20000}`
- 6 张 8×8 PST（pawn/knight/bishop/rook/queen/king），用国际象棋编程公开标准数据（白方视角，黑方翻转 row）。数据可从 chess programming wiki 公开表取。
- 遍历 `c.board()`，己方（当前 `c.turn()`）`+val+pst`，敌方 `-val-pst`
- 返回相对当前 `c.turn()` 的分数

**注意**：`getMove` 用 `new Chess(state.fen)` 创建独立实例，不 mutate server state。置换表 `>10000` 项时清空防膨胀。

### 1.3 `public/js/renderers/chess.js`（新建，渲染器）

复制 `public/js/renderers/chinesechess.js`（481 行）整体骨架，做以下替换：

| 改动点 | 中国象棋 | 国际象棋 |
|---|---|---|
| 棋盘尺寸 | ROWS=10, COLS=9 | ROWS=8, COLS=8 |
| 棋子字符 | PIECE_NAMES 汉字 | Unicode：白 `♔♕♖♗♘♙` 黑 `♚♛♜♝♞♟` |
| 字体栈 | `"Ma Shan Zheng",KaiTi,...` | `"Segoe UI Symbol","Apple Symbols","Noto Sans Symbols",sans-serif` |
| 背景 | 木纹+河界+九宫 | 黑白格交替（`#f0d9b5` 浅 / `#b58863` 深），无河界无九宫 |
| 合法走法指示 | 绿点/红圈 | 同上（保留） |
| 动画状态机 | animState(pickup/move) | 照搬 |
| 升变 UI | 无 | **新增** |

**模块级常量**：
```js
var ROWS = 8, COLS = 8;
var PIECE_GLYPH = { K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙' };  // 白
var PIECE_GLYPH_B = { K:'♚', Q:'♛', R:'♜', B:'♝', N:'♞', P:'♟' }; // 黑
```

**init(container)** — 照搬 chinesechess 的 canvas 创建 + resize（用 `window.innerWidth/innerHeight`，不用 `container.clientWidth`）+ click 事件。`init()` 开头必须 `stopAnimLoop(); selRow=-1; selCol=-1; prevBoard=null;`。click 坐标换算：`col=round((x-margin)/cs)`，`row=round((y-margin)/cs)`。

**render(state, container, playerIndex, winner)** — 职责分离照搬：
1. 保存 `window._chState`
2. `if (!animState.running && prevBoard && selRow === -1 && selCol === -1)` → `detectMove(prevBoard, state.board)` 检测对手走法，启动 move 动画
3. 保存 `prevBoard = cloneBoard(state.board)`
4. `if (animState.running) return;`（动画中，animTick 负责重绘）
5. 否则 `ctx.clearRect(...); drawFrame(null);`

**升变交互**（中国象棋没有的新逻辑）：在 click 处理里，找到匹配的 legalMove 后判断 `move.promotion`：
- 若 `promotion !== null`：弹一个浮层显示 4 个选项 Q/R/B/N（带 Unicode 图标），点击后 `window.makeGameMove({from, to, promote:'Q'})`
- 若 `promotion === null`：直接 `window.makeGameMove({from, to})`

**drawFrame()**：清屏 → 黑白格背景 → 合法走法指示（遍历 `state.legalMoves`，from 匹配 selRow/selCol 的，目标有子画红圈、空格画绿点）→ 棋子绘制（跳过动画中的棋子）→ 动画 overlay（pickup 放大选中子 / move 沿直线插值+正弦弧度）→ 状态栏（"轮到你走棋" / "对手回合" / 胜负面板）

注册：`window.gameRenderers.set('chess', { init, render });`

---

## 游戏 2：Checkers 西洋跳棋（English Draughts 规则）

### 规则
- 8×8 棋盘，**只用深色格**（32 格有效）
- 每方 12 子；红方(side=0)在底部 row 5-7，黑方(side=1)在顶部 row 0-2
- 棋子类型：`m`(man 普通) / `k`(king 王)
- **普通子**：向前斜走 1 格（红方向上 row 减小，黑方向下 row 增大）
- **王**：向前后斜走 1 格（四个对角方向均可）
- **吃子**：跳过相邻敌方子落到其后空格；**必须吃子**（有吃子选项时强制吃）；可连吃
- **升王**：普通子走到对方底线（红到 row 0，黑到 row 7）升为王
- **胜负**：一方无子或无合法走法则输；双方都无法走（罕见）和棋

### 2.1 `games/checkers.js`

```js
exports.name = 'checkers';
exports.maxPlayers = 2;
exports.createState = () => ({
  currentPlayer: 0,        // 0=红 1=黑，红先
  winner: null,            // null|0|1|-1(和棋)
  board: null,             // 8×8，元素 {type:'m'|'k', side:0|1} 或 null；仅深色格有子
  mustCapture: false,      // 当前是否处于强制连吃状态
  moveHistory: [],
  _playerCount: 2,
});
exports.initGame = (state) => { state.board = initialBoard(); };
```

**initialBoard()**：row 0-2 深色格放黑方 m，row 5-7 深色格放红方 m，其余 null。深色格判断：`(r+c) % 2 === 1`（或 0，取决于约定，统一即可）。

**handleMove(data, state, playerIndex)**：
1. 校验 winner/currentPlayer
2. 解析 `data = { from:{row,col}, to:{row,col} }`（**单步发送**，连吃由前端逐步发送）
3. 生成当前玩家所有合法走法：先找所有吃子走法，**若有吃子则只允许吃子**（强制吃子规则）；若无吃子则普通走法
4. 若 `state.mustCapture === true`，进一步限制只能从上次连吃落点继续吃
5. 验证 data 匹配合法走法
6. 执行走子：移动棋子，若吃子则移除被跳过的子
7. 若是吃子且落点后仍可继续吃同色子 → `mustCapture=true`，**不换人**（前端继续发下一步）
8. 否则 `mustCapture=false`，换人
9. 落点在底线（红到 row 0，黑到 row 7）则升王（type='k'）
10. 检测对方无子/无合法走法 → `winner=当前玩家`

**playerView**：
```js
exports.playerView = function(state, playerIndex) {
  var view = { currentPlayer, winner, board, mustCapture, moveHistory, _playerCount };
  if (state.winner === null && state.currentPlayer === playerIndex) {
    view.legalMoves = getLegalMoves(state.board, playerIndex, state.mustCapture);
    // [{from:{row,col}, to:{row,col}, captures:[{row,col}]}]
  } else view.legalMoves = [];
  return view;
};
```

### 2.2 `bots/checkers.js`
- minimax + alpha-beta，**depth 5**（强制吃子使分支因子小，可深搜）
- 评估：子数差（man=100，king=175）+ 前推进度（普通子越靠近升王线越值钱）+ 中心控制
- 走法生成复用 games/checkers.js 的逻辑（复制到 bot 文件，保持独立，仿 chinesechess bot 模式）
- getMove 返回单步走法（连吃由 server 反复调度 bot 实现）

### 2.3 `public/js/renderers/checkers.js`
- 复制 chinesechess 骨架，8×8 黑白格（浅 `#eeeed2`/深 `#769656`，标准国际跳棋配色）
- 棋子：圆形，红/黑两色，王加皇冠标记（小皇冠图标或双层圆环）
- 合法走法指示：吃子目标格红圈，普通走法绿点
- 动画：pickup + move（照搬）；连吃可做分段 move 动画（每段 250ms）
- 字体：系统字体

---

## 游戏 3：Connect Four 四子棋

### 规则
- 7 列 × 6 行网格（row 0=顶部，row 5=底部）
- 玩家选一列，棋子从顶部落到该列最低空位（重力）
- side=0 黄先，side=1 红
- **胜负**：横/竖/斜任意方向 4 子连珠
- 平局：棋盘满无连珠

### 3.1 `games/connect4.js`

```js
exports.name = 'connect4';
exports.maxPlayers = 2;
exports.createState = () => ({
  currentPlayer: 0,        // 0=黄 1=红，黄先
  winner: null,            // null|0|1|-1(平局)
  board: null,             // 6×7，元素 0|1|null（直接存 side 数字，空=null）
  lastMove: null,          // {row,col} 最近一步，用于渲染高亮和动画检测
  moveHistory: [],
  _playerCount: 2,
});
exports.initGame = (state) => {
  state.board = Array.from({length:6},()=>Array(7).fill(null));
};
```

**handleMove(data, state, playerIndex)**：
1. 校验 winner/currentPlayer
2. 解析 `data = { col }`（只需列号）
3. 校验 col 在 0-6 且该列未满（board[0][col] === null）
4. 从 row 5 向上找第一个空位 → 落子 `board[row][col] = playerIndex`
5. `lastMove = {row, col}`
6. 检测以该点为中心的 4 个方向（水平/垂直/两斜）是否有 4 连 → `winner=当前玩家`
7. 棋盘满（无 null）→ `winner=-1`
8. 否则 `currentPlayer = 1 - currentPlayer`

**playerView**：
```js
exports.playerView = function(state, playerIndex) {
  var view = { currentPlayer, winner, board, lastMove, _playerCount };
  if (state.winner === null && state.currentPlayer === playerIndex) {
    view.legalMoves = []; for (var c=0;c<7;c++) if (state.board[0][c]===null) view.legalMoves.push(c);
  } else view.legalMoves = [];
  return view;
};
```

### 3.2 `bots/connect4.js`
- minimax + alpha-beta，**depth 6**（7 列分支因子小，可深搜）
- 评估函数：4 连窗口扫描法（标准启发式）——遍历所有 4 格窗口，己方 4 子=+10000，3子+空=+100，2子+2空=+10；中央列加权（中央列棋子参与最多窗口）
- 走法排序：中央列优先

### 3.3 `public/js/renderers/connect4.js`
- **Canvas**（非 DOM grid，为了重力下落动画）
- 蓝色棋盘背景 + 圆孔，黄/红圆形棋子
- **重力下落动画**：animState.type='drop'，从顶部落到目标行，ease-in 加速（重力感），~400ms，落地小弹跳
- 列高亮：鼠标 hover/触摸时该列顶部显示半透明预览棋子（监听 mousemove/touchmove）
- 4 连胜利时高亮连线（金色描边 4 格）
- 复用 animState 状态机模式（drop 替代 move）
- 尺寸：用 `window.innerWidth/innerHeight`（AGENTS.md 坑点），7 列宽适配竖屏

---

## 游戏 4：Reversi/Othello 黑白棋

### 规则
- 8×8 棋盘
- 开局：中心 4 格，row3-4 col3-4，黑(side=0)在 (3,4)&(4,3)，白(side=1)在 (3,3)&(4,4)（X 型），**黑先手**
- 落子规则：必须落在一个能"夹住"至少 1 个对方子的空格——从落子点出发 8 个方向，若该方向有连续对方子且尽头是己方子，则该方向上所有对方子翻转为己方
- **合法走法**：必须至少翻转 1 子，否则非法
- 无合法走法则 pass（跳过）；双方都 pass 或棋盘满 → 结束
- **胜负**：棋多者胜；平局 = 32:32

### 4.1 `games/reversi.js`

```js
exports.name = 'reversi';
exports.maxPlayers = 2;
exports.createState = () => ({
  currentPlayer: 0,        // 0=黑 1=白，黑先
  winner: null,            // null|0|1|-1(平局)
  board: null,             // 8×8，元素 0|1|null（直接存 side，空=null）
  passCount: 0,            // 连续 pass 次数，=2 时结束
  lastMove: null,          // {row,col} 用于高亮和翻转动画
  scores: {0:2, 1:2},      // 当前双方棋子数
  moveHistory: [],
  _playerCount: 2,
});
exports.initGame = (state) => {
  state.board = Array.from({length:8},()=>Array(8).fill(null));
  state.board[3][3]=1; state.board[4][4]=1; state.board[3][4]=0; state.board[4][3]=0;
  state.scores = {0:2, 1:2};
};
```

**handleMove(data, state, playerIndex)**：
1. 校验 winner/currentPlayer
2. 解析 `data = { row, col }` 或 `{ pass: true }`
3. 若 pass：`passCount++`；若 passCount=2 → 结束数子定胜负；否则换人
4. 否则：生成合法走法（遍历空格，每格检查 8 方向能否夹子），验证 data 匹配
5. 落子 + 翻转所有被夹子方向 + 更新 scores
6. `passCount=0`
7. 检测对方是否有合法走法：有→换人；无→对方 pass（不换人，前端由 legalMoves=[] 暗示后自动发 pass）

**playerView**：
```js
exports.playerView = function(state, playerIndex) {
  var view = { currentPlayer, winner, board, passCount, scores, lastMove, _playerCount };
  if (state.winner === null && state.currentPlayer === playerIndex) {
    view.legalMoves = getLegalMoves(state.board, playerIndex); // [{row,col, flips:[{row,col},...]}]
  } else view.legalMoves = [];
  return view;
};
```

### 4.2 `bots/reversi.js`
- minimax + alpha-beta，**depth 5**
- 评估函数（经典 Othello 启发式）：
  - **角落权重**：4 角 = ±25（占角极值钱）；角落相邻的 X-square = ±10（极危险）
  - **位置权重表**：8×8 标准 Othello PST（公开数据）
  - **机动性**：己方合法走法数 - 对方合法走法数（×5）
  - 终局（棋盘 >50 子）数子差

### 4.3 `public/js/renderers/reversi.js`
- 8×8 绿色毡布棋盘（`#2a8a3a`），黑白圆形棋子
- **翻转动画**：animState.type='flip'，被翻转的棋子做 Y 轴旋转（scaleX 1→0→1 中间换色），错开延迟（连翻多子时逐个翻转）~300ms/子
- 合法走法指示：空格显示半透明小圆点（当前玩家颜色）
- 棋盘侧边显示双方实时棋子数（scores）和当前回合指示
- lastMove 高亮（金色描边）

---

## 共享部分：注册 / 封面 / 测试

### 注册点（每款游戏都做，共 4 套）

| 文件 | 行号定位 | 改动 |
|---|---|---|
| `public/game.html` | 156 行后（chinesechess.js 之后、go9.js 之前） | 加 4 行：`<script src="/js/renderers/chess.js"></script>` / checkers / connect4 / reversi。注意 game-catalog.js(163)/room-client.js(164) 必须在所有渲染器之后，当前安全 |
| `public/js/game-catalog.js` | 258 行后（chinesechess 块后） | 加 4 个条目（见下方示例） |
| `public/js/game-catalog.js` | 373 行后（`'chinesechess',` 之后） | order 数组加 4 行：`'chess',` `'checkers',` `'connect4',` `'reversi',`（紧邻 chinesechess，棋类聚集） |
| `public/js/lang/catalog-zh.js` | 157 行后（chinesechess 块后） | 加 4 个中文本地化条目 |
| `public/js/lang/catalog-en.js` | chinesechess 块后 | 加 4 个英文本地化条目 |
| `public/js/tutorials.js` | 162 行后（chinesechess zh 块后）+ ~386 行后（chinesechess en 块后） | zh + en 各加 4 个教程条目 |
| `scripts/generate-cover-art.js` | 32 行后（chinesechess 条目后） | 加 4 个 `{id, palette, motif}` 条目 |
| `scripts/generate-cover-art.js` | `case 'chinesechess':` 后 | 加 4 个 case 分支（画对应棋盘+棋子） |

### catalog 条目示例（game-catalog.js）
```js
chess: { id:'chess', name:'国际象棋', icon:'♟', subtitle:'王车易位，升变将军', description:'完整 FIDE 规则的双人国际象棋。', players:'2人', duration:'约15分钟', category:'经典棋盘', tags:['深度','经典'], featured:false, supportsAI:true, maxPlayers:2, cover:'' },
checkers: { id:'checkers', name:'西洋跳棋', icon:'◉', subtitle:'强制吃子，升王反击', description:'8×8 经典跳棋，连吃与升王。', players:'2人', duration:'约10分钟', category:'经典棋盘', tags:['经典','易学'], supportsAI:true, maxPlayers:2, cover:'' },
connect4: { id:'connect4', name:'四子棋', icon:'🔴', subtitle:'重力下落，四子连珠', description:'7×6 经典重力棋，全家欢乐。', players:'2人', duration:'约5分钟', category:'经典棋盘', tags:['亲子','快节奏'], supportsAI:true, maxPlayers:2, cover:'' },
reversi: { id:'reversi', name:'黑白棋', icon:'◐', subtitle:'翻转夹击，棋多者胜', description:'8×8 Othello，一步翻盘。', players:'2人', duration:'约10分钟', category:'经典棋盘', tags:['策略','反转'], supportsAI:true, maxPlayers:2, cover:'' },
```

### 测试 `tests/<name>.test.js`（4 个，用 node:test）

| 游戏 | 关键用例 |
|---|---|
| `tests/chess.test.js` | 开局合法走法数=20；Fool's mate（f3 e5 g4 Qh4#）；易位（清出棋子后 O-O 走法存在）；吃过路兵（e4 后 d5 可被 exd6 吃）；升变（兵到第 8 排 promotion:'q' 落子后该格为 Q）；将死判定 winner=当前玩家；困毙 winner=-1（和棋） |
| `tests/checkers.test.js` | 开局合法走法数（红方=7）；强制吃子（构造必吃局面验证只允许吃子）；连吃（构造可连吃局面验证 mustCapture 不换人）；升王（到底线 type 变 'k'）；无子判负 |
| `tests/connect4.test.js` | 满列拒绝（构造满列验证 col 拒绝）；4 连横/竖/斜判定；棋盘满平局 winner=-1；AI depth 6 不超时（<3s） |
| `tests/reversi.test.js` | 开局合法走法数=4（黑方）；翻转逻辑（单方向/多方向同时翻转）；pass 判定（无合法走法时 pass）；双方 pass 结束数子；角落权重（AI 优先占角） |

全部用 `node:test`，仿现有 `tests/*.test.js`。

### 封面生成
运行 `node scripts/generate-cover-art.js` 生成 4 张封面 png/svg 到 `public/assets/game-covers/`，然后回填 catalog 条目的 `cover` 字段为 `/assets/game-covers/<name>.png`。

### 全量验证（必做）
```bash
npm run check        # 语法检查（必须通过）
npm test             # 全量回归（含 4 个新测试文件）
node server.js       # 启动后双开浏览器 http://localhost:3000 对每款游戏对弈测试：
                     # Chess: 升变 UI、易位、吃过路兵、将死/和棋结算
                     # Checkers: 强制吃子、连吃不换人、升王
                     # Connect4: 重力下落动画、4 连高亮、平局
                     # Reversi: 翻转动画、pass、双方 pass 结束、实时比分
                     # 每款都测人 vs 人 + 人 vs AI
```
Android 构建前按 AGENTS.md 清理锁定进程后跑 `android/copy-nodejs-project.ps1`，确认 `games/vendor/chessjs.js` 被复制进 assets。

---

## GitHub 涨星（v1.3.0 配套）

### README 门面（文字/徽章为主，不加图片网格/GIF/Roadmap）

在 `README.md` 和 `README.zh-CN.md` 做以下改动（保留现有截图不动）：

1. **标题"23"→"27"**，引言行同步改（"23 built-in games" → "27 built-in games"）

2. **引言行下方**加 Live Demo 按钮（markdown 链接，非图片）：
   ```
   **[🚀 Live Demo](https://game-production-03da.up.railway.app/) — try it without installing.**
   ```
   中文版：`**[🚀 在线试玩](https://game-production-03da.up.railway.app/) — 无需安装，打开即玩。**`

3. **徽章行（第 5-9 行）后**追加特性徽章（shields.io 单行）：
   ```
   [![Games](https://img.shields.io/badge/Games-27-blue.svg)](#game-catalog)
   [![No account](https://img.shields.io/badge/Account-Not_Required-green.svg)](#highlights)
   [![Offline](https://img.shields.io/badge/Network-LAN/Offline-orange.svg)](#highlights)
   [![Android](https://img.shields.io/badge/Host-Android_✓-brightgreen.svg)](#android-host)
   ```

4. **Highlights 段末尾**加 star 引导语（一行文字）：
   ```
   > If GameNest saved your game night, please ⭐ it so others can find it.
   ```
   中文版：`> 如果 GameNest 让你的游戏之夜更开心，欢迎点个 ⭐ 让更多人看到。`

5. **Game Catalog 表格**：Classic board 行加 Chess/Checkers/Connect Four/Reversi：
   ```
   | Classic board | Tic-Tac-Toe, Gomoku, Flight Chess, Chinese Chess, Chess, Checkers, Connect Four, Reversi, Go 9x9 |
   ```

6. **License 段前**加 Star History 徽章：
   ```
   ## Star History
   
   [![Star History Chart](https://api.star-history.com/svg?repos=absswds/GameNest&type=Date)](https://star-history.com/#absswds/GameNest&Date)
   ```

### gh 设置命令

```bash
# 1. 修 description（去掉前导空格，27 款）
gh repo edit absswds/GameNest --description "Self-hosted LAN party hub: 27 board/card/party games. Browser-first, no account, works offline. Android host supported."

# 2. 扩 topics 到 20（GitHub 搜索入口）
gh repo edit absswds/GameNest \
  --add-topic board-games --add-topic multiplayer --add-topic party-games \
  --add-topic lan --add-topic browser-game --add-topic chess --add-topic checkers \
  --add-topic card-games --add-topic selfhosted --add-topic nodejs-mobile \
  --add-topic local-multiplayer --add-topic tabletop --add-topic family-games \
  --add-topic offline-first --add-topic open-source --add-topic websocket \
  --add-topic nodejs --add-topic express --add-topic android --add-topic game

# 3. 开启 Discussions
gh repo edit absswds/GameNest --enable-discussions

# 4. 发 Discussions 帖（网页操作或 gh api）
# - 欢迎帖 / 下一款游戏投票 / 路线图反馈

# 5. 建 4 个 good-first-issue（带 good first issue + enhancement 标签）
gh issue create -R absswds/GameNest --title "Add Backgammon (西洋双陆)" --label "good first issue,enhancement" --body "新游戏模板见 CONTRIBUTING.md..."
gh issue create -R absswds/GameNest --title "Add Battleship (战舰)" --label "good first issue,enhancement" --body "隐藏信息 2 人对战，复用 per-player view 模式..."
gh issue create -R absswds/GameNest --title "Add Hearts (红心大战)" --label "good first issue,enhancement" --body "..."
gh issue create -R absswds/GameNest --title "AI difficulty selector (Easy/Normal/Hard)" --label "good first issue,enhancement" --body "为现有 AI 游戏加难度选择..."
```

### RELEASE-v1.3.0.md（纯文字 release notes）
```
## GameNest v1.3.0 — Classic Board Pack

4 new classic board games:
- Chess (国际象棋) — full FIDE rules, castling/en passant/promotion, minimax AI (depth 3 + piece-square tables)
- Checkers (西洋跳棋) — English draughts, forced captures, king promotion, minimax AI (depth 5)
- Connect Four (四子棋) — gravity drop, 4-in-a-row, minimax AI (depth 6)
- Reversi/Othello (黑白棋) — flip mechanics, corner heuristic AI (depth 5)

Total games: 23 → 27.

Acknowledgements: Chess rules powered by chess.js v0.12.1 (Jeff Hlywa, BSD-2-Clause).
```

### 发布
```bash
# package.json "version": "1.3.0"
# git commit + push
git tag v1.3.0
git push origin v1.3.0
gh release create v1.3.0 -R absswds/GameNest --title "GameNest v1.3.0 — Classic Board Pack" --notes-file RELEASE-v1.3.0.md
```

---

## v1.4.0 草案：Codenames 代码名（本次只规划不实现）

### 为什么单开 v1.4.0
- 现代聚会爆款（2015 出版，BoardGameGeek 长期 Top 20），社媒晒图率高，传播属性强
- 和 v1.3.0 经典棋盘包错位（聚会词游 vs 棋类对弈），覆盖不同受众
- 需 zh/en 词库，独立工作量，不和棋类复用代码

### 规则
- 5×5 词卡网格（25 个常见词，随机抽自词库）
- 2 队（红/蓝），每队 1 名 Spymaster + 若干 Field Operatives
- 卡片身份：红队 9 张、蓝队 8 张（红先）、中立 7 张、刺客 1 张
- Spymaster 给出"1 个提示词 + 数字 N"（提示词不能是卡面上的词），表示有 N 张己方卡与该提示相关
- 队员讨论后点选卡牌：翻到己方色可继续（最多 N+1 次）、对方色则轮到对方、中立则轮到对方、**刺客则该队立即输**
- 先翻完己方所有卡的队伍胜

### 实现要点
- **per-player view**：Spymaster 看到所有卡的颜色身份，Operatives 只看到词和已翻开的颜色 → 复用 `playerView` 模式（server.js 零改动）
- **角色分配**：房间设置里选 Spymaster/Operative + 队伍；或 server 随机分配
- **词库**：`lang/codenames-words-zh.js` + `lang/codenames-words-en.js`，各 ~200 词（公开词表，可从开源 Codenames clone 取）
- **人数**：2-8 人（最少 2 人 = 每队 1 个 Spymaster 兼 Operative；标准 4 人+）
- **AI**：Spymaster AI 难度大（需词向量相似度找关联词）。**建议 v1.4.0 先做纯 PvP，AI 作为 v1.4.1**
- **渲染器**：5×5 词卡 DOM 网格，翻牌动画，Spymaster 视角卡片有颜色边框
- **状态**：`state = { grid:[{word, color, revealed}], turn:'red'|'blue', phase:'clue'|'guess', clue:{word,count}, guessesLeft, winner, assassinRevealed }`

### 注册点（同其他游戏 5 处）
- 新增 `games/codenames.js` + `public/js/renderers/codenames.js` + `lang/codenames-words-*.js`
- 无 bot（v1.4.0 纯 PvP）→ `bots/` 跳过
- playerView 隐藏颜色身份给 Operatives

### 风险
- 词库维护（zh 词的关联性比 en 难，中文一词多义）
- Spymaster AI 若做需词向量模型（太重），所以先纯 PvP
- 社交传播强但 GitHub 开发者受众稍弱于棋类

---

## 执行顺序（v1.3.0）

1. **许可证合规**：下载 chess.js v0.12.1 → `games/vendor/chessjs.js` + 新建 `NOTICE`
2. **Chess**：`games/chess.js` + `tests/chess.test.js` → `npm run check && npm test` 验证规则正确
3. **bots/chess.js** → 启动 server 加 AI bot 单人测试
4. **renderers/chess.js**（含升变 UI）→ 双开浏览器对弈测试
5. **Checkers**：games + bots + renderer + tests → 验证强制吃子/连吃/升王
6. **Connect Four**：games + bots + renderer（重力动画）+ tests → 验证 4 连
7. **Reversi**：games + bots + renderer（翻转动画）+ tests → 验证翻转/pass
8. **注册 4 套**：game.html / game-catalog.js / lang ×2 / tutorials / 封面生成
9. **全量验证**：`npm run check && npm test` + 4 款手动对弈（人 vs 人 + 人 vs AI）
10. **README 门面**（文字改动，23→27）
11. **gh 设置命令** + 开 Discussions + 建 good-first-issue
12. **RELEASE-v1.3.0.md** + tag + push + `gh release create`

---

## 注意事项汇总（执行者必读）

1. **不要动 server.js 和 room-client.js**（v1.2.0 重构后完全通用）
2. **不要新增 npm 依赖**（vendor chess.js 是单文件复制，不影响 package.json）
3. **不要用 Node 20+ only 的 API**（nodejs-mobile v18.20.4 必须能跑）
4. **渲染器 Canvas 尺寸用 `window.innerWidth/innerHeight`**，不要用 `container.clientWidth`
5. **渲染器 init() 开头必须重置模块级状态**（stopAnimLoop + selRow=-1 + prevBoard=null）
6. **bot 的 getMove 不要 mutate server state**，用 `new Chess(fen)` / 深拷贝创建独立实例
7. **每改一个文件都跑 `npm run check`**，全部完成跑 `npm test`
8. **保留 chess.js v0.12.1 原版权头**（BSD-2-Clause 要求）
9. **commit message 风格**：`feat: add chess game` / `feat: add checkers game` / `docs: update README for v1.3.0` 等（仿现有 `git log --oneline`）
10. **不要 commit secrets / 不要改 git config / 不要 force-push**（除非用户明确要求）
