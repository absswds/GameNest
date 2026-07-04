# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
npm install                    # 安装依赖（仅首次）
node server.js                 # 启动服务器 → http://localhost:3000
taskkill -f -im node.exe       # Windows 杀掉占用端口的进程
```

## Android 构建

```bash
# Windows PowerShell — 复制 Node.js 项目到 Android assets（每次改完前后端都要跑）
cd android
.\copy-nodejs-project.ps1

# 打开 Android Studio，直接 Run（绿色三角）或 Build → Rebuild Project
# APK 输出: android/app/build/outputs/apk/debug/app-debug.apk

# 常见问题：
# - clean 失败 "Unable to delete app/build" → 关 Android Studio，taskkill /f /im java.exe，手动 rm -rf app/build
# - libc++_shared.so 冲突 → 检查 NDK 版本必须是 24.0.8215888（与 libnode.so 编译版本一致）
# - Express 必须用 4.x，不能用 5.x。nodejs-mobile v18.20.4 的 ICU 不支持 path-to-regexp 的 Unicode regex
```

**重要: 每次编译到手机前，必须先用以下命令清理锁定进程和旧构建文件，否则 Gradle clean 会因 Windows 文件锁定失败：**

```bash
taskkill /f /im studio64.exe 2>/dev/null; taskkill /f /im studio.exe 2>/dev/null
taskkill /f /im java.exe 2>/dev/null; taskkill /f /im javaw.exe 2>/dev/null
sleep 2
rm -rf android/app/build
```

然后再打开 Android Studio 编译。

## 架构概览

局域网联机桌游平台。Node.js + Express 4 + ws（WebSocket），HTTP 和 WS 共用 3000 端口。同一 WiFi 下打开浏览器即玩。

**目录结构：**
- `server.js` — 全部服务端逻辑（房间管理、消息路由、AI 调度、per-player 视图分支、drawguess 计时兜底）
- `main.js` — nodejs-mobile 入口 wrapper（仅 Android 用）
- `games/*.js` — 游戏模块（21 款，含 `drawguess-words.js` 词库数据文件不导出 name）
- `bots/*.js` — AI 机器人（19 款，扫雷、你画我猜无需 AI）
- `scripts/sim-*.js` — Node 模拟脚本（可解性验证/bot 对战/词泄漏断言，`node scripts/sim-xxx.js` 运行）
- `public/index.html` — 大厅（选游戏、创建/加入房间）
- `public/game.html` — 游戏壳（等待房间 + 棋盘容器 + 结束 overlay），新增渲染器要在此 `<script>` 引入
- `public/js/room-client.js` — WebSocket 客户端核心（状态同步、渲染调度、游戏设置 UI、gameNames 映射、maxSlots 逻辑）
- `public/js/renderers/*.js` — 各游戏前端渲染器（21 款）
- `public/js/tutorials.js` — 新手教程弹窗
- `public/style.css` — 全局样式（Design C 极简轻奢）
- `android/` — Android Studio 项目（详见 `android/SETUP.md`）

**新增一款游戏要改 5-6 处：**
1. `games/<name>.js` — 游戏逻辑（如需词库，参照 `drawguess-words.js` 单独数据文件）
2. `bots/<name>.js` — AI（纯 PvP 如扫雷/你画我猜可跳过）
3. `public/js/renderers/<name>.js` — 前端渲染器
4. `public/game.html` — `<script>` 引入渲染器
5. `public/js/room-client.js` — `gameNames` 映射 + 人数 + 房间设置 UI（如有 options）
6. `server.js` — 如果需要 per-player 视图（隐藏信息/合法走法），三个广播位置各加 else-if；如需服务端计时兜底，加 `scheduleXxxTimer` + 清理逻辑

教程加到 `tutorials.js`。

## 游戏模块接口（`games/*.js`）

```js
exports.name = 'gamename';          // 唯一标识
exports.maxPlayers = 2;             // 最大人数（上限）
exports.minPlayers = 1;             // 可选，最小人数（默认 2，你画我猜/合成大西瓜设 1 允许单人）
exports.createState = () => ({...}); // 返回初始状态
exports.handleMove = (data, state, playerIndex) => {...}; // 返回 null 或错误字符串
exports.initGame = (state, playerCount) => {...}; // 可选，用于开局初始化（接收 state._options 和 state._playerCount）
exports.onTimeout = (state) => {...}; // 可选，服务端计时器超时回调（你画我猜用：选词→自动选/作画→空提交/猜词→超时提交）
```

`state.currentPlayer` 和 `state.winner` 由服务端读取，其余字段游戏自定义。`handleMove` 直接修改 `state`。

**特殊模式:**
- 24 点游戏是同时竞速（非回合制），`scheduleBotMove` 和 `next_round` 有特殊处理分支。
- **per-player 视图**（隐藏对手信息 / 提供合法走法）：游戏导出 `exports.playerView(state, playerIndex)` 或 `exports.playerBoardView(...)`，server.js 在 `game_started`/`game_state`/`game_restart` 三处分别为每个玩家广播过滤后的 state。已用此模式：扫雷（`playerBoardView`，共享雷布局、独立 reveal/flag）、德州扑克（`playerView`，隐藏对手底牌）、中国象棋（`playerView`，向当前玩家提供 `legalMoves` 数组，非当前玩家为空）、你画我猜（`playerView`，隐藏 word/wordOptions，choosing 阶段只给 chooser 发 `myTask`）。新增需此模式的游戏照此扩展 server.js 的 `if (room.game === ...)` 分支。
- **魔力桥重组**：rummikub 有 `phase: 'manipulate'` 操作台——`start_manipulate` 把桌面+手牌快照进 workspace，submit 校验"桌面原有牌必须全部重新成组"（否则丢牌），cancel 还原快照。前端 `renderManipulate` 是分格牌桌交互。
- **飞行棋保底**：`noSixStreak` 字段存在每个 player 对象上，连续 5 次掷不出 6 且全部飞机在基地时自动给 6。
- **你画我猜服务端计时兜底**：`scheduleDrawguessTimer(room)` 存 `room._dgTimer`，按 phase 取时限写入 `state.stepDeadline`（绝对时间戳+2s 缓冲），超时回调校验 `room.state === 闭包捕获的 state`（防 game_restart 换 state 后旧 timer 乱触发），调 `onTimeout` 后走 playerView 逐人广播。每次 game_move/game_started/game_restart 重新 schedule。`game_restart` 开头 + 房间销毁路径必须 `clearTimeout(room._dgTimer)`。
- **合成大西瓜客户端物理**：suikabattle 服务端只存 scores/current/next/eliminated，物理引擎（Matter.js）完全在客户端运行。客户端通过 `drop`/`merge`/`gameover` 三种 move type 上报结果。支持单人模式（`minPlayers:1`）。

## AI 机器人接口（`bots/*.js`）

```js
exports.name = 'gamename';
exports.createBot = (playerIndex) => ({
  name: '电脑1',
  getMove(state) { return { ...moveData }; }
});
```

**注意:** `getMove` 不要直接 mutate `state`（如 `hand.sort()`），用 `[...hand].sort()` 复制后再排序。`getMove` 必须能处理任意合法局面并返回合法走法——边界局面（如棋盘接近满）忘记兜底会读到 undefined 而抛异常。

**容错不变量:** `scheduleBotMove` 在 bot 走非法步（`handleMove` 返回错误字符串）时，会回退到 `{pass:true}` 再 `{}`，保证回合一定推进、整局不卡死。新游戏的 `handleMove` 应让"空 data / pass"成为安全的推进操作（多数游戏=摸牌或跳过并换人）。

## 房间系统

房间对象：
```
room = {
  game, maxPlayers, phase,       // phase: 'lobby' → 'ready' → 'playing'
  players: Map<ws, {name, index, avatar}>,
  bots: Map<index, botInstance>,
  state,                         // 游戏模块拥有
  hostWS,                        // 房主连接
  readyPlayers: Set,             // 已准备的玩家索引
  options: {},                   // 游戏特定设置（如 {roundTime, requireBreak}）
  _roomId, _cleanupTimer, _botTimer, _tfTimer, _dgTimer,
}
```

**等待房间流程：** 建房 → lobby（加 AI / 等人加入 / 改名换头像）→ 准备 → ready → 房主点开始 → playing
**换位：** 房主或玩家可在 lobby/ready 阶段发送 `swap_seat` 交换位置
**断线：** 空房间 60s 后自动删除；断线玩家重连后恢复状态

## WebSocket 消息协议

| 客户端 → 服务端 | data | 说明 |
|---|---|---|
| `create_room` | `{ game }` | 创建房间 |
| `join_room` | `{ roomId }` | 加入房间（也用于重连） |
| `game_move` | 游戏自定义 | 路由到 handleMove |
| `game_restart` | — | 重置并重新发牌 |
| `next_round` | — | 24 点专用：进入下一轮 |
| `add_bot` | — | 房主添加 AI |
| `player_ready` | — | 切换准备状态 |
| `start_game` | — | 房主开始游戏 |
| `swap_seat` | `{ fromIndex, toIndex }` | 交换位置 |
| `set_option` | `{ key, value }` | 房主修改游戏设置 |
| `set_name` | `{ name }` | 修改昵称 |
| `set_avatar` | `{ avatar }` | 修改头像 emoji |

| 服务端 → 客户端 | payload | 说明 |
|---|---|---|
| `room_created` | `{ roomId, game, maxPlayers, playerIndex, players, phase }` | |
| `room_joined` | `{ roomId, game, maxPlayers, playerIndex, players, state, phase }` | |
| `game_state` | `{ state, players }` | 每次合法移动后 |
| `game_started` | `{ state, players }` | 房主开始游戏时 |
| `room_update` | `{ phase, players, options? }` | 房间状态变化 |
| `player_joined/left` | `{ players, phase }` | |
| `error` | `{ message }` | 中文错误信息 |

## 前端渲染器（`public/js/renderers/*.js`）

```js
window.gameRenderers.set('gamename', {
  init(container) { /* 创建 DOM，注册事件 */ },
  render(state, container, playerIndex, winner) { /* 更新 UI */ }
});
```

`room-client.js` 管理 WebSocket 连接、状态同步、等待房间 UI、玩家栏、渲染器调度。从 `sessionStorage` 读取 `roomId`/`playerIndex`/`game`。

**渲染器全局函数约定:** 通过 `window._函数名` 暴露 onclick 回调，前缀 `_` 避免冲突。

**Canvas 棋盘尺寸坑（飞行棋/象棋/围棋）:** 用 `window.innerWidth/innerHeight` 计算边长，**不要**用 `container.clientWidth`（`boardArea` 无显式宽度，常读到 0 / 极小值）。也不要在 `style.css` 给 canvas 设 `max-width`——CSS 会覆盖 JS 设的 inline 宽度，导致"改了没用"。resize 监听里要在尺寸变化后主动重渲染。

**逻辑/渲染常量同步:** 飞行棋的 `FLY_STEP`/`FLY_ADV`（跳棋+飞行落点）在 `games/flightchess.js` 与 `renderers/flightchess.js` 各有一份，改一处必须同步另一处，否则虚线画的位置和实际飞的位置对不上。

**Canvas 动画模式（象棋/飞行棋已用）:** 纯 Canvas 渲染器实现动画的通用模式：

```js
// 动画状态机 — 模块级变量
var animState = {
  running: false, rafId: null,
  type: 'none',        // 'none' | 'pickup' | 'move'
  startTime: 0,
  // 具体动画参数按需定义...
};

function startAnimLoop() { animState.running = true; animState.startTime = performance.now(); animTick(); }
function stopAnimLoop() { animState.running = false; animState.type = 'none'; if (animState.rafId) cancelAnimationFrame(animState.rafId); }

function animTick(now) {
  var elapsed = now - animState.startTime;
  // ease-out cubic: t = 1 - Math.pow(1 - Math.min(elapsed/duration, 1), 3)
  // ease-in-out quad: t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2
  // 动画进度更新 animState 字段 → drawFrame() → 完成后 running=false
  if (animState.running) animState.rafId = requestAnimationFrame(animTick);
}
```

**render() 职责分离：** `render()` 只做三件事：(1) 保存 state 到 `window._xSt`，(2) 检测对手走法（prev 快照对比），(3) 动画进行中直接 return（`animTick` 负责重绘），否则调用静态 `drawFrame()`。`drawFrame()` 包含完整绘制逻辑，在正常渲染和动画帧间共用。动画 overlay（被拿起的棋子/移动中的棋子）在 `drawFrame` 末尾绘制，正常棋子循环中 skip 被动画的棋子。

**对手走法检测：** 象棋用 `cloneBoard` + `detectMove()`（遍历 2D 数组找变化），飞行棋用 `prevPlanes` 快照（比较每个 `planes[j]` 数值变化）。检测到变化后自动启动画。

## 现有游戏（22 款）

| 游戏 | name | 人数 | AI | 特殊说明 |
|------|------|------|-----|----------|
| 井字棋 | tictactoe | 2 | ✅ | |
| 五子棋 | gomoku | 2 | ✅ | 模式评分 AI；边界局面已兜底防崩 |
| 达芬奇密码 | davinci | 2-6 | ✅ | 万能牌需手动选择插入位置 |
| UNO | uno | 2-6 | ✅ | 小屏自动缩小卡片，手牌 >5 张显示滑动提示 |
| 斗地主 | doudizhu | 2-3 | ✅ | 动态 `_playerCount`，前端实时牌型检测 + 出牌判定 |
| 爆炸猫 | exploding-kittens | 2-6 | ✅ | 已去掉猫咪卡，改为偷牌道具卡模式 |
| 贪吃蛇大乱斗 | snakebattle | 2-6 | ✅ | 实时对撞；同图生存淘汰制；120ms tick；客户端 Canvas 渲染 |
| 魔力桥 | rummikub | 2-4 | ✅ | `manipulate` 操作台可拿桌面牌重组；可设 `requireBreak`（破冰≥30） |
| 24点 | twentyfour | 不限 | ✅ | 同时竞速（非回合制）+ 排行榜 + 可设每轮限时 |
| 扫雷竞速 | minesweeper | 2-6 | ❌ | 纯 PvP；per-player 独立棋盘 (playerBoardView)；左键翻格右键/长按标旗 |
| 数字炸弹 | numberbomb | 2-10 | ✅ | 二分搜索 AI；数字键盘输入；踩雷爆炸动画 |
| 抽鬼牌 | oldmaid | 2-6 | ✅ | 两步选牌交互（先选对手再选牌） |
| 大老二 | bigtwo | 2-4 | ✅ | 花色比大小 + ♦3 先手；多种牌型 |
| 德州扑克 | texas | 2-8 | ✅ | 盲注 + 四轮下注 + 公共牌；per-player `playerView` 隐藏底牌 |
| 骗子酒馆 | liarsbar | 2-6 | ✅ | 面朝下出牌 + 声明 + 质疑；命数可设 |
| 飞行棋 | flightchess | 2-4 | ✅ | 掷6起飞/再掷；同色跳+4、虚线飞+24；`FLY_STEP/FLY_ADV` 常量双份须同步；`noSixStreak` 保底机制（per-player）；堆叠偏移+拿起走子动画 |
| 中国象棋 | chinesechess | 2 | ✅ | minimax + alpha-beta；Canvas 木纹棋盘；per-player view 提供 `legalMoves`；拿起/走子动画 + 合法走法绿点红圈指示 |
| 围棋(9×9) | go9 | 2 | ✅ | 提子/禁着/打劫；EMPTY=0/BLACK=1/WHITE=2（与 playerIndex 区分）；黑贴3.75子 |
| 合成大西瓜 | suikabattle | 1-4 | ❌ | 客户端 Matter.js 物理；服务端只存分数/出局；`minPlayers:1` 允许单人 |
| 你画我猜 | drawguess | 1-6 | ❌ | 传话链模式；首画家 3 选 1 选词；300+ 分类词库(`drawguess-words.js`)；房间设置(分类/时限/候选数/自定义词)；服务端计时兜底(`_dgTimer`+`onTimeout`)；per-player `playerView` 防词泄漏 |
| 大富翁 | monopoly | 2-6 | ✅ | 28 格对称棋盘(角 0/7/14/21)；骰子滚动+逐格移动+收租飘字动画；AI 建房；event queue+displayState/latestState 双轨 |
| 羊了个羊 | sheeptile | 2-6 | ✅ | 关卡制(1 易 2 难)；金字塔堆叠+暗牌队列；剥洋葱可解性生成(连续三元组保证 peak≤2)；道具限次(撤回/洗牌/移出 3 张)；飞入槽位+三消动画；sameBoard 房间设置 |

## 关键端点

- `GET /qr?room=XXX` — 生成房间二维码 PNG（自动使用 LAN IP，192.168.x.x 优先）

## 视觉规范

Design C 极简轻奢：浅灰底 `#f8f9fa`，白色卡片，金色点缀 `#c8a45c`，黑胶囊按钮。CSS 变量定义在 `style.css` 的 `:root` 中。

## 已知 Bug 模式 / 易踩坑

**骗子酒馆 AI 开枪调度：** `scheduleBotMove` 默认用 `state.currentPlayer` 查 bot。骗子酒馆进入 `phase:'shooting'` 后控制权转给 `state.currentShooter`，两者不同会导致 bot 永远不被调度。已在 `server.js` 加特判，其他有自定义"当前行动者"字段的新游戏需同样处理。

**飞行棋四色跑道是核心机制：** `TK[i % 4]` 的四色循环不是装饰，是跳格逻辑（落在自己颜色格跳 +4）的视觉依据，**不能**按玩家颜色改色。

**飞行棋中心终点覆盖层次：** `center triangles` → `home stretch cells` → `hub circle` 必须按此顺序绘制（home stretch 盖在三角上），否则 home 最内侧格被三角遮住，棋子看起来"在终点范围内"。三角 `reach` 须 ≤ 0.6cs，避免盖过 home 格。

**Canvas 渲染器动画与走法检测：** `render()` 里的走法检测（prev 快照对比）必须在 `animState.type !== 'move'` 时才跳过，而非 `!animState.running`。否则玩家自己点击触发 pickup 动画期间 state 更新回来时，检测被跳过、prevPlanes 被覆盖，导致自己走棋没有滑行动画，只有对手有。

**象棋/跨端字体统一：** Canvas `ctx.font` 不能以 `system-ui` 开头（不同 OS 字体差异大）。`game.html` 已加载 Google Fonts `Ma Shan Zheng`，象棋渲染器字体栈以 `"Ma Shan Zheng"` 开头保证跨端一致。

**24 点 bot solver 对象/基值混用：** `bots/twentyfour.js` 的 `genResults` 接收 `{val, expr}` 对象数组。运算时必须用 `a.val + b.val`，表达式用 `a.expr + '+' + b.expr`；基准情况直接 `return [nums[0]]`（不能再包一层 `{val: nums[0], ...}`）。历史上这里用了 `a + b`（对象加法→字符串拼接 `[object Object]`），导致 solver 从未真正找到过解。

**24 点竞速游戏的"一次性调度"陷阱：** `scheduleTwentyFourBots` 只在 `start_game` / `next_round` / `game_restart` 时各调度一次。若调度触发时 `state.phase !== 'playing'`（开局时序问题），原来直接 return 导致 bot 永远不提交。现已改为最多重试 3 次（每次 300ms 间隔）。

**`_hasBots`/`_realPlayerCount` 跨事件丢失：** server.js 在 `start_game` 和 `next_round` 里向 state 写入 `_hasBots`、`_realPlayerCount`，但 `game_restart` 用 `createState()` 重建 state 后会丢失这两个字段，导致前端判断逻辑回退默认值。凡是调用 `createState()` 重置 state 的路径，都要重新写入这类"运行时注入"字段。

**前端渲染器模块级变量跨局持久：** 渲染器是单例，`_lastTimedNumsKey`、`_hintLevel` 等模块级变量在同一页面会话内跨局保留。依赖这些变量判断"新一局"时，需确认重置逻辑（如 `resetHintForRound`）一定被触发，而不依赖页面刷新。

## Android 已知坑

- **NDK 版本:** 必须用 NDK 24.0.8215888（`app/build.gradle` 中 `ndkVersion`），与 nodejs-mobile v18.20.4 的 libnode.so 编译版本一致
- **Express 版本:** 必须用 Express 4.x。Express 5 依赖新版 path-to-regexp，其 Unicode property escapes（`\p{ID_Start}`）不被 nodejs-mobile 的 ICU 支持，启动即崩溃
- **文件锁定:** Windows 上 Gradle clean 常因文件锁失败，关 Android Studio + 杀 java 进程后手动删 `app/build`
- **16 KB page:** 构建会警告 "APK not compatible with 16 KB devices"，来自预编译的 libnode.so 无法修复，不影响本地安装使用
- **状态栏遮挡:** `MainActivity.kt` 已加 `WindowInsetsCompat` 处理 notch
