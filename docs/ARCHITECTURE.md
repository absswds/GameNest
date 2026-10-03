# 架构 / Architecture

GameNest 用一个 Node.js 进程同时负责 HTTP、WebSocket、房间管理、游戏规则和电脑调度。浏览器端用原生 JavaScript 模块渲染每款游戏。

GameNest uses one Node.js process for HTTP, WebSocket, room management, game rules, and bot scheduling. Browser clients render each game with plain JavaScript modules.

## 运行流程 / Runtime Flow

```text
浏览器大厅 / Browser lobby
  -> 通过 WebSocket 创建或加入房间 / create or join room over WebSocket
  -> 服务器在内存中保存房间状态 / server keeps room state in memory
  -> 游戏模块校验并执行出招 / game module validates and applies moves
  -> 服务器广播过滤后的状态 / server broadcasts filtered state
  -> 浏览器渲染器更新棋盘 / browser renderer updates the board
```

HTTP 和 WebSocket 共用 `3000` 端口。 / HTTP and WebSocket share port `3000`.

## 主要模块 / Main Pieces

| 路径 / Path | 职责 / Responsibility |
| --- | --- |
| `server.js` | Express 路由、WebSocket 消息、房间生命周期、座位、电脑调度、按玩家广播状态<br>Express routes, WebSocket messages, room lifecycle, player seats, bot scheduling, per-player state broadcasts |
| `games/` | 纯游戏规则与状态流转 / Pure game rules and state transitions |
| `bots/` | 各游戏的电脑出招 / AI move generation for supported games |
| `public/index.html` | 大厅与选游戏 / Lobby and game selection |
| `public/game.html` | 房间外壳与渲染器宿主 / Room shell and renderer host |
| `public/js/room-client.js` | WebSocket 客户端、等待室、游戏选项、渲染调度<br>WebSocket client, waiting room, game options, renderer scheduling |
| `public/js/renderers/` | 各游戏的 DOM 或 Canvas 渲染 / Game-specific DOM or Canvas rendering |
| `public/js/game-catalog.js` | 内置游戏元数据（大厅的唯一数据源）/ Built-in game metadata (single source of truth for lobby) |
| `public/js/lang/` | 浏览器语言包 / Browser language packs |
| `lang/` | 服务端文字包 / Server-side text packs |
| `tests/` | 规则、电脑、目录和客户端假设的回归测试 / Regression tests for rules, bots, catalog, and client assumptions |
| `android/` | 基于 nodejs-mobile 的 Android WebView 外壳 / Android WebView wrapper using nodejs-mobile |

## 房间生命周期 / Room Lifecycle

房间经历三个阶段 / Rooms move through three phases:

```text
lobby -> ready -> playing
```

玩家可以加入、重连、改名和换头像、换座、准备和开局。开局前房主可以添加电脑、修改游戏选项。

Players can join, reconnect, change names and avatars, swap seats, mark ready, and start games. The host can add bots and update game-specific options before play begins.

## 状态同步 / State Sync

客户端发送带有游戏专属内容的 `game_move` 消息。服务器把内容交给当前游戏的 `handleMove(data, state, playerIndex)`，它修改 `room.state` 并返回 `null` 或一个 i18n 错误键。出招合法后，服务器以 `game_state` 广播新状态。

Clients send `game_move` messages with game-specific payloads. The server passes each payload to the current game's `handleMove(data, state, playerIndex)`, which mutates `room.state` and returns `null` or an i18n error key. After a legal move the server broadcasts the new state as `game_state`.

## 按玩家视角 / Per-Player Views

任何有私密信息（手牌、身份、隐藏棋盘）的游戏都导出 `playerView(state, playerIndex)`。服务器发出的每份状态都经过它——广播时如此，加入和断线恢复时也如此——所以每个客户端只能看到自己座位能看的内容。加上这个钩子就够了，不需要改 `server.js`。`games/lib/hidden.js` 为纸牌游戏提供了 `maskView`，`tests/hidden-hands.test.js` 会检查隐藏数据有没有泄露。

Any game with private information (hands, roles, hidden boards) exports `playerView(state, playerIndex)`. The server sends every state through it — on broadcast and also on join and resume — so each client only sees what its seat may see. Adding the hook is enough; no `server.js` change is needed. `games/lib/hidden.js` has a `maskView` helper for card games, and `tests/hidden-hands.test.js` checks that hidden data does not leak.

大多数纸牌和身份类游戏都用到它（德州扑克、斗地主、UNO、麻将、狼人杀、三国杀……）。棋类游戏用它给当前玩家附上可走位置提示。唯一的例外是扫雷竞速：它用 `playerBoardView`，由 `server.js` 直接调用。

Most card and role games use it (Texas Hold'em, Dou Dizhu, UNO, Mahjong, Werewolf, Three Kingdoms, …). Board games use it to attach legal-move hints for the current player. Minesweeper Race is the one exception: it uses `playerBoardView`, which `server.js` calls directly.

## 回合与计时 / Turn Flow and Timers

- **普通回合**：行动者是 `state.currentPlayer`。需要别人应答的游戏（响应者、开枪者）导出 `getCurrentActor` / `setCurrentActor`。
- **实时游戏**导出 `realtime` 和 `tick`，服务器按间隔调用 `tick`。
- **阶段制游戏**（狼人杀、三国杀）导出 `getPhaseDeadline`、`onTimeout` 和 `getPendingActors`；`server.js` 里通用的 `schedulePhaseGame` 负责它们的截止时间和电脑行动。
- 少数老游戏在 `server.js` 里还有专门分支（海战布阵、24 点、斗地主出牌计时、麻将局末、骗子酒馆暂停）。

- **Normal turns**: the actor is `state.currentPlayer`. Games where someone else must answer (a responder, a shooter) export `getCurrentActor` / `setCurrentActor`.
- **Real-time games** export `realtime` and `tick`; the server calls `tick` on an interval.
- **Phase games** (Werewolf, Three Kingdoms) export `getPhaseDeadline`, `onTimeout` and `getPendingActors`; the generic `schedulePhaseGame` in `server.js` runs their deadlines and bot actions.
- A few older games still have their own branches in `server.js` (Battleship placement, 24 Game, Dou Dizhu turn timer, Mahjong round end, Liar's Bar pause).

## 对局与结果 / Matches and Results

双人棋类游戏（`server.js` 里的 `MATCH_GAMES`）通过 `games/lib/match.js` 支持一局 / 三局两胜 / 五局三胜。每局之间交换座位，让先手轮流。

Two-player board games (`MATCH_GAMES` in `server.js`) support best-of-1/3/5 through `games/lib/match.js`. Between games the seats swap so the first move alternates.

`state.winner` 是座位号，团队结果则用负数标记（例如斗地主的地主对农民、狼人杀的狼人对好人）。`public/js/room-client.js` 里的 `showResult` 把它们转成结算界面。

`state.winner` is a seat index, or a negative sentinel for team results (e.g. landlord vs farmers in Dou Dizhu, wolves vs village in Werewolf). `showResult` in `public/js/room-client.js` turns these into the result screen.

## 电脑玩家 / Bots

每个 `bots/<id>.js` 导出 `createBot(index)`，其 `getMove(state)` 拿到完整的服务器状态且不能修改它。服务器负责调度电脑出招；电脑出招被拒绝时依次退回到 `{pass:true}` 和 `{}`。

Each `bots/<id>.js` exports `createBot(index)`, whose `getMove(state)` receives the full server state and must not mutate it. The server schedules bot moves; if a bot move is rejected it falls back to `{pass:true}` and then `{}`.

## MCP 服务 / MCP Server

`mcp/` 是一个独立的包（有自己的 `package.json`，不打进 exe/APK），让 AI 客户端以普通座位参与游戏。它和浏览器一样通过 WebSocket 协议连接正在运行的 GameNest 服务器，所以除了普通出招外不需要服务端额外支持。默认走 stdio，也支持 Streamable HTTP（`--http=<port>`，无状态、无鉴权、拒绝非本机 `Origin`）。

`mcp/` is a separate package (own `package.json`, not bundled into the exe/APK) that lets an AI client play as an ordinary seat. It connects to a running GameNest server over the same WebSocket protocol as the browser, so it needs no server-side support beyond normal moves. It speaks stdio by default or Streamable HTTP (`--http=<port>`, stateless, no auth, rejects non-local `Origin`).

- `mcp/server.js` 注册工具（`create_room`、`wait_for_turn`、`make_move`……），并用 resume token 断线重连。
- `mcp/move-guides.js` 存放 `get_rules` 返回的各游戏出招格式。
- `suggest_move` 在根据本座位视角重建的状态（`toBotState`）上运行项目自带的电脑，所以看不到隐藏的牌。
- `mcp/draw.js` 把 SVG 转成画我猜的笔画，并把笔画渲染成 PNG 供 `get_canvas` 使用。画家修正用游戏出招 `stage_undo` / `stage_clear`，网页上的撤销 / 清空按钮发的也是它们。

- `mcp/server.js` registers the tools (`create_room`, `wait_for_turn`, `make_move`, …) and reconnects with the resume token.
- `mcp/move-guides.js` holds the per-game move formats returned by `get_rules`.
- `suggest_move` runs the project's own bot on a state rebuilt from this seat's view (`toBotState`), so it never sees hidden cards.
- `mcp/draw.js` converts SVG to Draw & Guess strokes and renders strokes to PNG for `get_canvas`. Drawer fixes use the game moves `stage_undo` / `stage_clear`, which the web undo/clear buttons also send.

客户端配置见 / See [mcp/README.md](../mcp/README.md)（[中文](../mcp/README.zh-CN.md)）for client setup.

## Android 外壳 / Android Wrapper

Android 工程把 Node.js 项目复制进 App 资源，通过 nodejs-mobile 启动；界面是一个指向本机服务器的 WebView。

The Android project copies the Node.js project into app assets and starts it through nodejs-mobile. The Android UI is a WebView pointed at the local server.

Android 打包前运行 / Before Android builds, run:

```powershell
cd android
.\copy-nodejs-project.ps1
```
