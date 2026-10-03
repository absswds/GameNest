# 贡献指南 / Contributing

感谢关注 GameNest。这个项目刻意保持小巧、以浏览器为先，所以大多数贡献都应该能在本地轻松跑起来。

Thanks for taking a look at GameNest. This project is intentionally small and browser-first, so most contributions should stay easy to run locally.

## 开发环境 / Development Setup

```bash
npm install
npm start
```

打开 / Open `http://localhost:3000`.

提交改动前 / Before sending changes:

```bash
npm run check
npm test
```

## 新增游戏 / Adding a Game

一款普通游戏要改这些地方：

A normal game touches these places:

1. `games/<name>.js` — 游戏规则和状态流转 / game rules and state transitions.
2. `bots/<name>.js` — 电脑玩家（纯真人对战可跳过）/ AI bot (skip for pure PvP games).
3. `public/js/renderers/<name>.js` — 浏览器渲染器 / browser renderer.
4. `public/game.html` — 渲染器的 `<script>` 标签 / `<script>` tag for the renderer.
5. `public/js/game-catalog.js` + `public/js/lang/zh.js` + `public/js/lang/en.js` — 大厅元数据和翻译 / lobby metadata and translations.
6. `public/js/tutorials.js` — 游戏内规则说明，`TUTORIALS_ZH` 和 `TUTORIALS_EN` 都要写 / the in-game rules text, in both `TUTORIALS_ZH` and `TUTORIALS_EN`.
7. `mcp/move-guides.js` — 给 AI（MCP 客户端）看的出招格式，`get_rules` 会返回它；游戏的出招结构改了也要同步更新 / the move format shown to AI agents (MCP clients) via `get_rules`; update it whenever a game's move shape changes.

可选：在 `tests/` 里加针对性测试；用 `scripts/generate-cover-art.js <id>` 生成大厅封面。生成器输出 1600×1200 的 PNG，而目录要求 `public/assets/game-covers/<id>.webp` 为 1536×1024，所以要裁剪并转换格式，否则 `tests/game-catalog-covers.test.js` 会失败。

Optional extras: `tests/` for focused coverage, and a lobby cover from `scripts/generate-cover-art.js <id>`. The generator writes a 1600×1200 PNG; the catalog expects `public/assets/game-covers/<id>.webp` at 1536×1024, so crop and convert it or `tests/game-catalog-covers.test.js` fails.

一般不需要改 `server.js`：它会自动加载 `games/` 和 `bots/` 下的所有模块，下面的可选钩子已经覆盖了隐藏信息、计时和实时游戏。

You normally don't need to touch `server.js`: it loads every module in `games/` and `bots/` automatically, and the optional hooks below cover hidden information, timers and real-time play.

## 游戏模块约定 / Game Module Contract

```js
exports.name = 'game-id';
exports.maxPlayers = 2;
exports.createState = () => ({});
exports.handleMove = (data, state, playerIndex) => null;
exports.initGame = (state, playerCount) => {};
```

`handleMove` 直接修改 `state`；合法出招返回 `null`，非法出招返回一个 i18n 错误键（要同时加到 `lang/server-zh.js` 和 `lang/server-en.js`）。

`handleMove` mutates `state` directly and returns `null` for a legal move, or an i18n error key (add it to both `lang/server-zh.js` and `lang/server-en.js`) for an illegal move.

服务器支持的可选钩子 / Optional hooks the server honours:

| 钩子 / Hook | 何时使用 / Use it when |
| --- | --- |
| `playerView(state, idx)` | 玩家之间不能看到彼此的手牌或身份。任何有私密信息的游戏都必须实现（`tests/hidden-hands.test.js` 会检查）；它可能在 `initGame` 之前被调用，要防范未初始化的字段；`games/lib/hidden.js` 为纸牌游戏提供了 `maskView`。<br>Players must not see each other's hands or roles. Required for any game with private information (`tests/hidden-hands.test.js` checks this). It can run before `initGame`, so guard against unset fields. `games/lib/hidden.js` has a `maskView` helper for card games. |
| `getCurrentActor` / `setCurrentActor` | 需要行动的人不是 `state.currentPlayer`（例如响应者）。<br>The player who must act is not `state.currentPlayer` (e.g. a responder). |
| `realtime` + `tick` | 游戏按计时器推进，而不是按出招推进。<br>The game advances on a timer instead of on moves. |
| `getPhaseDeadline` / `onTimeout` / `getPendingActors` | 有截止时间的阶段或同时行动（参考 werewolf 和 sanguo）。<br>Phases with deadlines or simultaneous actions (see werewolf and sanguo). |

## 电脑玩家约定 / Bot Contract

```js
exports.name = 'game-id';
exports.createBot = (playerIndex) => ({
  name: 'Bot',
  getMove(state) {
    return {};
  },
});
```

电脑拿到的是完整的服务器状态，不能修改它；对共享数据排序或过滤前先复制数组。电脑的出招被拒绝时，服务器会依次退回到 `{pass:true}` 和 `{}`。

Bots receive the full server state and must not mutate it. Copy arrays before sorting or filtering shared data. If a bot move is rejected, the server falls back to `{pass:true}` and then `{}`.

## Android 注意事项 / Android Notes

改了网页或服务器代码后运行 / After web or server changes, run:

```powershell
cd android
.\copy-nodejs-project.ps1
```

Express 保持在 `4.x`；Android 上的 nodejs-mobile 运行时不兼容 Express 5 的依赖链。

Keep Express on `4.x`; the Android nodejs-mobile runtime is not compatible with the newer Express 5 dependency chain.

## 翻译 / Translations

界面文字在 `public/js/lang/zh.js` 和 `public/js/lang/en.js`（大厅还有 `catalog-*.js`），每个键两个文件都要加。字符串用单引号包裹，英文里的撇号要转义（`'don\'t'`），否则 `npm run check` 会失败。

UI text lives in `public/js/lang/zh.js` and `public/js/lang/en.js` (plus `catalog-*.js` for the lobby). Add every key to both files. The strings are single-quoted, so escape apostrophes in English text (`'don\'t'`) or `npm run check` fails.

## PR 检查清单 / Pull Request Checklist

- 能从大厅开局。 / The game can start from the lobby.
- 至少走一步后，多人状态保持同步。 / Multiplayer state stays in sync after at least one move.
- 有电脑的游戏在边界状态下有安全的兜底。 / AI games have a safe fallback for edge states.
- 规则说明和界面文字中英文都有。 / Rules text and UI strings exist in both Chinese and English.
- `npm run check` 通过。 / `npm run check` passes.
- 相关测试通过，或在 PR 里说明为什么没法跑。 / Relevant tests pass, or the PR explains why a test could not be run.
