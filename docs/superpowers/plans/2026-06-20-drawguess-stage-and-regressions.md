# DrawGuess Stage Mode and Game Regression Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a switchable, real-time Stage mode to You Draw I Guess while preserving Whisper, and fix the Monopoly replay and Sheep Tile visibility regressions.

**Architecture:** `games/drawguess.js` selects a mode at initialization and exposes a filtered player view for each mode. `server.js` remains the single timer/broadcast authority. The browser renderer changes screens based on the filtered state and sends small stroke/guess messages. Existing simulation scripts provide the deterministic test harness.

**Tech Stack:** Node.js CommonJS, Express/WebSocket state broadcasts, browser Canvas, vanilla JavaScript simulation scripts.

---

### Task 1: Stage game rules and privacy tests

**Files:**
- Modify: `scripts/sim-drawguess.js`
- Test: `scripts/sim-drawguess.js`

- [ ] **Step 1: Write failing Stage assertions**

```js
const stage = newGame(3, { mode: 'stage', wordChoices: 1, drawTime: 60 });
assert(stage.mode === 'stage' && stage.phase === 'playing', 'Stage should start a live round');
assert(game.handleMove({ type: 'stage_stroke', stroke }, stage, stage.drawerIndex) === null, 'drawer stroke should be accepted');
assert(game.handleMove({ type: 'stage_guess', text: stage.word }, stage, 1) === null, 'first correct guess should be accepted');
assert(stage.correct[1] && stage.scores[1] > stage.scores[2], 'earlier correct guess should score more');
assert(!JSON.stringify(game.playerView(stage, 2)).includes(stage.word), 'guesser view must not leak the word');
```

- [ ] **Step 2: Run the simulation to verify it fails**

Run: `node scripts/sim-drawguess.js`

Expected: FAIL because `mode`, `stage_stroke`, and `stage_guess` are not implemented.

### Task 2: Stage state machine in the game module

**Files:**
- Modify: `games/drawguess.js`
- Test: `scripts/sim-drawguess.js`

- [ ] **Step 1: Add mode-specific Stage state and initialization**

```js
state.mode = options.mode === 'whisper' ? 'whisper' : 'stage';
state.drawerIndex = 0;
state.round = 1;
state.scores = Array(playerCount).fill(0);
state.strokes = [];
state.correct = {};
```

- [ ] **Step 2: Implement `choose_word`, `stage_stroke`, and `stage_guess` for Stage**

```js
if (data.type === 'stage_guess') {
  const answer = normalize(data.text);
  if (playerIndex === state.drawerIndex || state.correct[playerIndex]) return '不能重复猜词';
  if (answer !== normalize(state.word)) return '不对，再试试';
  state.correct[playerIndex] = true;
  state.scores[playerIndex] += scoreForRemainingTime(state.stepDeadline);
  state.scores[state.drawerIndex] += 1;
  if (allGuessersCorrect(state)) finishStageRound(state);
  return null;
}
```

- [ ] **Step 3: Extend `onTimeout` and `playerView` without changing Whisper behavior**

```js
if (state.mode === 'stage' && state.phase === 'playing') {
  finishStageRound(state);
  return true;
}
```

- [ ] **Step 4: Run the simulation to verify Stage and Whisper both pass**

Run: `node scripts/sim-drawguess.js`

Expected: `sim-drawguess: 全部通过`.

### Task 3: Timer and per-player broadcasts

**Files:**
- Modify: `server.js`
- Test: `scripts/sim-drawguess.js`

- [ ] **Step 1: Use Stage draw timing without resetting it for strokes or guesses**

```js
const isDrawguessStroke = currentRoom.game === 'drawguess' && data.type === 'stage_stroke';
if (currentRoom.game === 'drawguess' && !isDrawguessStroke) scheduleDrawguessTimer(currentRoom);
```

- [ ] **Step 2: Broadcast the filtered Stage state after every accepted move**

```js
if (currentRoom.game === 'drawguess' && gameMod.playerView) {
  sendDrawguessViews(currentRoom);
  return;
}
```

- [ ] **Step 3: Run the simulation and local WebSocket smoke path**

Run: `node scripts/sim-drawguess.js`

Expected: `sim-drawguess: 全部通过`.

### Task 4: Room setting and Stage renderer

**Files:**
- Modify: `public/js/room-client.js`
- Modify: `public/js/renderers/drawguess.js`
- Test: local browser smoke test

- [ ] **Step 1: Add the host mode setting, defaulting to Stage**

```js
var dgMode = roomOptions.mode || 'stage';
window._setGameOption('mode', this.value);
```

- [ ] **Step 2: Render Stage header, shared live canvas, repeated guess input, and result card**

```js
function renderStage(container, task) {
  renderStageHeader(task);
  renderStageCanvas(task.canDraw ? localStrokes : task.strokes);
  if (!task.canDraw && !task.correct) renderStageGuessInput();
}
```

- [ ] **Step 3: Send each completed stroke and keep the canvas responsive on touch**

```js
if (state.mode === 'stage' && currentStroke.pts.length > 1) {
  wsSend({ type: 'stage_stroke', stroke: currentStroke });
}
```

- [ ] **Step 4: Start the local server and verify two players can choose Stage or Whisper**

Run: `node server.js`

Expected: the lobby exposes both modes; Stage shows live strokes and repeated guesses; Whisper remains selectable.

### Task 5: Monopoly and Sheep Tile regression tests

**Files:**
- Modify: `scripts/sim-monopoly.js`
- Modify: `scripts/sim-sheeptile.js`
- Modify: `public/js/renderers/monopoly.js`
- Modify: `public/js/renderers/sheeptile.js`

- [ ] **Step 1: Write failing regression assertions**

```js
assert(moveSignature(move) === moveSignature({ ...move }), 'equivalent moves need one stable signature');
assert(SHEEP_BLOCKED_ICON_ALPHA >= 0.85, 'blocked sheep tiles must remain legible');
```

- [ ] **Step 2: Replace Monopoly object-reference comparison with a value signature**

```js
function moveSignature(move) {
  return move ? [move.player, move.from, move.to, move.steps, move.kind].join('|') : '';
}
```

- [ ] **Step 3: Render blocked Sheep Tile icons at near-full opacity with a light overlay**

```js
if (blocked) ctx.globalAlpha = 0.9;
ctx.fillStyle = 'rgba(40,44,40,0.12)';
```

- [ ] **Step 4: Run all game simulations**

Run: `node scripts/sim-drawguess.js; node scripts/sim-monopoly.js; node scripts/sim-sheeptile.js`

Expected: all scripts exit 0.

### Task 6: Final browser verification and commit

**Files:**
- Modify: `findings.md`
- Modify: `progress.md`

- [ ] **Step 1: Exercise the Stage round through two browser clients**

Verify a drawer chooses a word, a second player sees strokes without the word, wrong guesses stay editable, a correct guess locks only that player, and the result advances to the next drawer.

- [ ] **Step 2: Verify Monopoly and Sheep Tile visually**

Verify buying an unowned property does not replay the token move and covered Sheep tiles are readable but non-interactive.

- [ ] **Step 3: Record test evidence and commit only task files**

```bash
git add games/drawguess.js server.js public/js/room-client.js public/js/renderers/drawguess.js public/js/renderers/monopoly.js public/js/renderers/sheeptile.js scripts/sim-drawguess.js scripts/sim-monopoly.js scripts/sim-sheeptile.js docs/superpowers
git commit -m "feat: add DrawGuess-style stage mode"
```
