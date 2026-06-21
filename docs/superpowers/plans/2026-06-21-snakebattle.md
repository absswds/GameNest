# Multiplayer Snake Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-authoritative, 2–6 player Snake Battle game that can be created from the lobby and played on phone or desktop.

**Architecture:** `games/snakebattle.js` owns deterministic state transitions and exposes `tick(state)`. `server.js` owns a single room-level realtime timer for modules declaring `realtime: true`, runs bot direction selection before each tick, and broadcasts each authoritative snapshot. The browser renders snapshots on Canvas and only sends direction intents.

**Tech Stack:** Node.js CommonJS, Express, ws, browser Canvas, existing renderer registry, plain Node simulation scripts.

---

### Task 1: Prove the realtime rule contract with a failing simulation

**Files:**
- Create: `scripts/sim-snakebattle.js`
- Create later: `games/snakebattle.js`

- [ ] **Step 1: Write the failing test**

```js
const game = require('../games/snakebattle');
const state = game.createState();
game.initGame(state, 2);
assert.strictEqual(state.realtime, true);
assert.strictEqual(game.handleMove({ direction: 'left' }, state, 0), '不能立刻反向');
game.tick(state);
assert.strictEqual(state.snakes[0].alive, false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/sim-snakebattle.js`

Expected: `MODULE_NOT_FOUND` for `games/snakebattle`.

- [ ] **Step 3: Add additional expected behavior to the same test file**

```js
// set an adjacent food cell, tick once, assert body length grows by 1
// put both heads on a collision course, tick once, assert winner === -1
// create bot, call getMove and pass it through handleMove for 30 ticks
```

- [ ] **Step 4: Commit after the implementation and all tests are green**

```powershell
git add games/snakebattle.js bots/snakebattle.js scripts/sim-snakebattle.js
git commit -m "feat: add server-authoritative snake battle"
```

### Task 2: Implement the isolated game module and bot

**Files:**
- Create: `games/snakebattle.js`
- Create: `bots/snakebattle.js`
- Test: `scripts/sim-snakebattle.js`

- [ ] **Step 1: Implement the module API**

```js
exports.name = 'snakebattle';
exports.maxPlayers = 6;
exports.realtime = true;
exports.tickMs = 120;
exports.createState = () => ({ width: 28, height: 20, snakes: [], food: null, winner: null, realtime: true });
exports.initGame = (state, playerCount) => { /* deterministic spawn slots and one food */ };
exports.handleMove = (data, state, playerIndex) => { /* validate one non-opposite direction */ };
exports.tick = (state) => { /* calculate all heads, eliminate collisions, grow food eater, set winner */ };
```

- [ ] **Step 2: Implement the bot through the same input API**

```js
exports.createBot = (playerIndex) => ({
  name: `电脑${playerIndex + 1}`,
  getMove(state) { return { direction: chooseSafestDirection(state, playerIndex) }; },
});
```

The helper must score only legal non-reverse directions, reject walls and occupied cells, then use distance to food as a tie-breaker.

- [ ] **Step 3: Run the focused simulation and confirm green**

Run: `node scripts/sim-snakebattle.js`

Expected: `Snake Battle simulation passed`.

### Task 3: Add generic realtime room scheduling

**Files:**
- Modify: `server.js` (room shape, game start/restart paths, cleanup path, `scheduleBotMove`)
- Test: `scripts/sim-snakebattle.js`

- [ ] **Step 1: Extend new rooms with a timer field**

```js
_realtimeTimer: null,
```

- [ ] **Step 2: Add a bounded scheduler**

```js
function stopRealtimeGame(room) {
  if (room && room._realtimeTimer) clearInterval(room._realtimeTimer);
  if (room) room._realtimeTimer = null;
}
function scheduleRealtimeGame(room) {
  const gameMod = gameRegistry[room.game];
  if (!gameMod || !gameMod.realtime) return;
  stopRealtimeGame(room);
  room._realtimeTimer = setInterval(() => {
    if (!rooms.has(room._roomId) || room.phase !== 'playing' || room.state.winner != null) return stopRealtimeGame(room);
    for (const [index, bot] of room.bots) gameMod.handleMove(bot.getMove(room.state), room.state, index);
    gameMod.tick(room.state);
    broadcastRoom(room, { type: 'game_state', state: room.state, players: roomPlayersList(room) });
  }, gameMod.tickMs || 120);
}
```

- [ ] **Step 3: Invoke scheduler immediately after every successful generic `initGame` and stop it before restart/reset/deletion**

After existing `gameMod.initGame(...)` calls in start/restart paths, call `scheduleRealtimeGame(currentRoom)`. In `scheduleBotMove`, return early when `gameMod.realtime` is true to prevent the turn-based timer from moving a realtime bot.

- [ ] **Step 4: Run the focused simulation and existing bot smoke test**

Run: `node scripts/sim-snakebattle.js; node scripts/sim-ai-smoke.js`

Expected: both succeed; existing games still complete their smoke paths.

### Task 4: Register the game and provide its mobile UI/tutorial

**Files:**
- Create: `public/js/renderers/snakebattle.js`
- Modify: `public/game.html`
- Modify: `public/index.html`
- Modify: `public/js/room-client.js`
- Modify: `public/js/tutorials.js`

- [ ] **Step 1: Create the Canvas renderer**

The renderer must provide `init` and `render`, create a 28×20 aspect-ratio canvas, draw a colored rounded cell for each alive snake, draw `🍎` food, and include four large direction buttons. Keyboard arrows and swipe gestures invoke the same `sendDirection(direction)` helper. The helper calls `window.makeGameMove({ direction })` only while the local snake is alive and no winner exists.

- [ ] **Step 2: Register assets and display names**

```html
<script src="/js/renderers/snakebattle.js"></script>
```

```js
snakebattle: { name: '贪吃蛇大乱斗', icon: '🐍' },
```

Add a lobby option reading `2-6 人 · 约 5 分钟`, and a tutorial covering controls, food growth, collision elimination and winner rules.

- [ ] **Step 3: Syntax and coverage checks**

Run: `node --check games/snakebattle.js; node --check bots/snakebattle.js; node --check public/js/renderers/snakebattle.js; node scripts/sim-tutorial-coverage.js`

Expected: no output errors and tutorial coverage passes.

### Task 5: Full verification, manual launch, and release commit

**Files:**
- Test: `scripts/sim-snakebattle.js`
- Test: all existing `scripts/sim-*.js` relevant to games

- [ ] **Step 1: Run complete focused regression**

```powershell
node scripts/sim-snakebattle.js
node scripts/sim-ai-smoke.js
node scripts/sim-tutorial-coverage.js
node scripts/sim-drawguess.js
node scripts/sim-rummikub-rules.js
node scripts/sim-sheeptile.js
```

- [ ] **Step 2: Restart server and verify HTTP delivery**

```powershell
$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($listener) { Stop-Process -Id $listener[0].OwningProcess -Force }
Start-Process -FilePath node -ArgumentList '.\server.js' -WorkingDirectory (Get-Location) -WindowStyle Hidden
Start-Sleep -Seconds 2
(Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/' -TimeoutSec 5).StatusCode
```

Expected: `200`.

- [ ] **Step 3: Commit only Snake Battle files**

```powershell
git add games/snakebattle.js bots/snakebattle.js public/js/renderers/snakebattle.js public/game.html public/index.html public/js/room-client.js public/js/tutorials.js scripts/sim-snakebattle.js docs/superpowers
git commit -m "feat: add multiplayer snake battle"
```

Do not stage the pre-existing modified `CLAUDE.md`, root `task_plan.md`, `public/index.html` quick-create changes outside this game card, or `.playwright-mcp` artifacts.
