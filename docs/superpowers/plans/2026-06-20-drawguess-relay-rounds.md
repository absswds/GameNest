# DrawGuess Relay Rounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn DrawGuess Whisper into a scored, rotating relay game and ensure every lobby client receives the selected mode.

**Architecture:** Whisper remains a private alternating draw/guess chain. A completed chain enters a player-voted reveal; the player who started that chain earns three points only when the majority says the final guess still matches. After the vote, the next player becomes the starter with a fresh word and chain; after every player has started one chain, the highest score wins. Stage mode remains unchanged.

**Tech Stack:** Node.js CommonJS game module, Express/WebSocket state sync, vanilla DOM renderer, Node simulation script.

---

### Task 1: Define relay-round behavior in the simulation

**Files:**
- Modify: `scripts/sim-drawguess.js`
- Test: `scripts/sim-drawguess.js`

- [ ] **Step 1: Write failing relay assertions**

```js
const relay = newGame(3, { mode: 'whisper', wordChoices: 1 });
assert(relay.round === 1 && relay.drawerIndex === 0, 'first relay starts with player 0');
// submit all three alternating chain steps, then cast three match votes
assert(relay.scores[0] === 3, 'matching relay awards its starting drawer three points');
assert(relay.phase === 'round_result', 'all votes enter the relay result screen');
assert(game.onTimeout(relay) === true && relay.drawerIndex === 1, 'result timeout starts the next player relay');
```

- [ ] **Step 2: Run the simulation and confirm it fails because Whisper has no round fields or score transition**

Run: `node scripts/sim-drawguess.js`

Expected: a relay assertion fails.

### Task 2: Implement server-authoritative Whisper relay state

**Files:**
- Modify: `games/drawguess.js`
- Test: `scripts/sim-drawguess.js`

- [ ] **Step 1: Add minimal Whisper relay state and initialization**

```js
state.drawerIndex = 0;
state.round = 1;
state.scores = Array(playerCount).fill(0);
state.roundResults = null;
```

- [ ] **Step 2: Build each chain from the active drawer**

```js
function startWhisperRound(state) {
  state.chain = Array.from({ length: state._playerCount }, (_, offset) => ({
    playerIndex: (state.drawerIndex + offset) % state._playerCount,
    type: offset % 2 === 0 ? 'draw' : 'guess', content: null, done: false,
  }));
  state.currentStep = 0;
  state.votes = {};
  state.transmissionResult = null;
}
```

- [ ] **Step 3: Resolve votes and enter a result state**

```js
if (allVotes) {
  const matches = Object.values(state.votes).filter(v => v === 'match').length;
  state.transmissionResult = matches * 2 >= state._playerCount ? 'match' : 'drift';
  if (state.transmissionResult === 'match') state.scores[state.drawerIndex] += 3;
  state.roundResults = { drawerIndex: state.drawerIndex, scoreAwarded: state.transmissionResult === 'match' ? 3 : 0 };
  state.phase = 'round_result';
}
```

- [ ] **Step 4: Advance results by timeout**

```js
if (state.phase === 'round_result') {
  if (state.round >= state._playerCount) { state.winner = highestScoreIndex(state.scores); state.phase = 'gameover'; }
  else { state.drawerIndex = (state.drawerIndex + 1) % state._playerCount; state.round++; startWhisperRound(state); }
  return true;
}
```

- [ ] **Step 5: Run the simulation**

Run: `node scripts/sim-drawguess.js`

Expected: `sim-drawguess: 全部通过`.

### Task 3: Sync lobby mode and show result/score progression

**Files:**
- Modify: `server.js`
- Modify: `public/js/room-client.js`
- Modify: `public/js/renderers/drawguess.js`

- [ ] **Step 1: Include options in initial room packets**

```js
options: currentRoom.options, // room_created
options: room.options,        // both room_joined packets
```

- [ ] **Step 2: Receive initial options client-side**

```js
if (msg.options) roomOptions = msg.options;
```

- [ ] **Step 3: Schedule Whisper round-result transitions**

```js
else if (state.phase === 'round_result') { seconds = 5; }
// reschedule for either DrawGuess mode while in round_result
```

- [ ] **Step 4: Render a scored relay result**

```js
// beneath the replay and vote verdict, show starter name, +3 / +0,
// and the current score table. In round_result, show the same data
// with a clear next-starter transition; gameover shows winner + final table.
```

### Task 4: Verify and commit only the accepted scope

**Files:**
- Modify: `docs/superpowers/plans/2026-06-20-drawguess-relay-rounds.md`
- Modify: `task_plan.md`, `findings.md`, `progress.md`

- [ ] **Step 1: Run syntax and simulation checks**

Run: `node --check games/drawguess.js; node --check public/js/renderers/drawguess.js; node --check public/js/room-client.js; node --check server.js; node scripts/sim-drawguess.js`

Expected: all checks exit zero and simulation reports all passing.

- [ ] **Step 2: Restart local server and verify its page**

Run: start `node server.js`, then request `http://localhost:3000/game.html`.

Expected: HTTP 200.

- [ ] **Step 3: Commit only DrawGuess scope**

Run: `git add games/drawguess.js public/js/renderers/drawguess.js public/js/room-client.js server.js scripts/sim-drawguess.js docs/superpowers/plans/2026-06-20-drawguess-relay-rounds.md findings.md progress.md && git commit -m "feat: add scored DrawGuess relay rounds"`

Expected: the commit excludes unrelated Sheep Tile changes.
