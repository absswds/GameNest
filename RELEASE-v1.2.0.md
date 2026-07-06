# v1.2.0 — Codebase Refactor & Apache-2.0

## 🇨🇳 中文

### 服务端重构（修复性）

- **`broadcastGameView`** 把 3 处 ~110 行 per-player 视图广播级联合一，新增 per-player 视图游戏只需导出 `playerView`/`playerBoardView`，无需改 server.js
- **修复 `next_round` 泄露底牌**：24 点下一轮之前用 `broadcastRoom` 广播全状态，会让德州扑克对手看到上一轮底牌；现统一走 `broadcastGameView`
- **`applyRuntimeState`** 修了 AGENTS.md 已点名的 `_hasBots/_realPlayerCount` 跨事件丢失 bug
- **`clearAllRoomTimers`**：所有房间删除路径都清理 `_botTimer`/`_tfTimer`/`_dgTimer`/`_tfBotTimers[]`，修复内存泄漏 + 切游戏时旧回调崩溃
- **`getCurrentActor` hook**：骗子酒馆开枪阶段之前硬编码在 `scheduleBotMove`/`skipDisconnectedTurn`，现提取为游戏模块 hook

### 客户端清理

- 删除 `room-client.js` 与 `game-catalog.js` 重复的 `gameNames`/`NO_AI_GAMES`/`defaultSlots`（catalog 现为单源真相）
- 13 处 `ws.send(JSON.stringify(...))` 样板合并为 `send(type, data)` helper
- `onmessage` 8 个 if 链改为 `handlers` 对象 dispatch map
- DOM 查询缓存 `el = {...}`，~40 处 `getElementById` 合一

### 共享 util（新增）

- `bots/lib/cards.js` — bigtwo/doudizhu/texas 共享扑克牌助手
- `bots/lib/bot-name.js` — 19 个 bot 接入国际化命名（`botName(playerIndex, lang)`）
- `public/js/style-utils.js` — `injectStylesOnce`，10 个渲染器消费
- `public/js/action-registry.js` — `unregisterAllActions`，切游戏时清旧 onclick handler
- `public/style.css` 新增 `.is-active-turn` 类，4 个渲染器从 inline ternary 迁移
- `public/js/canvas-utils/` — animator/sizer/easing/board-diff 备 chinesechess/flightchess 迁移用（未加载入 game.html）
- `public/js/tutorials.js` — 46 个 `title` 字段删除，统一用 catalog 的 `name`

### 协议迁移

- **MIT → Apache-2.0**（含专利授权条款，更适合软件项目）
- LICENSE / package.json / 两份 README / Store Listing 同步更新

### 文档 + 工作流

- README 补 Node 18+ 前置说明 + `build:desktop` 命令 + 仓库结构条目
- CONTRIBUTING 新游戏清单与 AGENTS.md 对齐
- ARCHITECTURE 补 catalog 单源说明 + drawguess 加入 per-player view 列表
- 三个 workflow 加 concurrency（取消旧 run）+ Node matrix [18,20,22] + Gradle 缓存 + 权限声明

### 验证

- 27/27 测试全绿
- 116 个 JS 文件语法检查通过

---

## 🇺🇸 English

### Server refactor (fixes)

- **`broadcastGameView`** collapses 3 ~110-line per-player-view cascades (start_game/game_move/game_restart) into one helper; new per-player-view games just export `playerView`/`playerBoardView`, no server.js edit
- **Fix `next_round` leaking hole cards**: previously used `broadcastRoom` (full state), letting Texas Hold'em opponents see the previous round's cards; now routes through `broadcastGameView`
- **`applyRuntimeState`** fixes the `_hasBots/_realPlayerCount` cross-event drift bug previously cataloged in AGENTS.md
- **`clearAllRoomTimers`** runs before every `rooms.delete`; clears `_botTimer`/`_tfTimer`/`_dgTimer`/`_tfBotTimers[]` — fixes memory leak + post-deletion callback crash
- **`getCurrentActor` hook**: liarsbar's shooting phase was hardcoded inside `scheduleBotMove`/`skipDisconnectedTurn`; now extracted as a game-module hook

### Client cleanup

- Removed duplicate `gameNames`/`NO_AI_GAMES`/`defaultSlots` (catalog is the single source of truth)
- 13 `ws.send(JSON.stringify(...))` boilerplate calls consolidated into `send(type, data)`
- `onmessage` 8-branch if-chain converted to `handlers` object dispatch map
- DOM lookup cache `el = {...}` ~40 `getElementById` calls consolidated

### Shared utils (new)

- `bots/lib/cards.js` — shared poker helpers for bigtwo/doudizhu/texas
- `bots/lib/bot-name.js` — 19 bots wired to `botName(playerIndex, lang)`
- `public/js/style-utils.js` — `injectStylesOnce`; consumed by 10 renderers
- `public/js/action-registry.js` — `unregisterAllActions` clears stale handlers on game swap
- `public/style.css` adds `.is-active-turn`; 4 renderers migrated off inline ternary
- `public/js/canvas-utils/` — animator/sizer/easing/board-diff ready for chess/flightchess migration (not loaded in game.html yet)
- `public/js/tutorials.js` — 46 `title` fields removed; uses catalog `name` instead

### License

- **MIT → Apache-2.0** (patent grant clause better suited for software)
- LICENSE / package.json / both READMEs / Store Listing updated

### Docs + workflows

- README: add Node 18+ note + `build:desktop` cmd + repo layout entries
- CONTRIBUTING: align new-game list with AGENTS.md
- ARCHITECTURE: document catalog single source + add drawguess to per-player view list
- 3 workflows: add concurrency + Node matrix [18,20,22] + Gradle cache + permissions

### Verification

- 27/27 tests green
- 116 JS files pass syntax check

---

## Assets

| Asset | Link |
|-------|------|
| Windows EXE | `GameNest-Windows.exe` |
| Portable ZIP | `GameNest-Portable.zip` |
| Android APK | `app-debug.apk` |
| Web | `http://localhost:3000` |