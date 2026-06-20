# Reliability, Rummikub, and Lobby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DrawGuess timers device-clock independent, let a player resume an active room, repair Rummikub table rearrangement, and organize the lobby by game category.

**Architecture:** The server provides a remaining-duration value with each DrawGuess player view so the browser starts a local countdown at receipt. Rooms retain disconnected player identities for a short grace period and rebind a reconnecting WebSocket using a stored resume token. Rummikub keeps its existing server validation and fixes the renderer's target-click event routing. The lobby adds semantic category headers and a deliberate card order without changing game identifiers.

**Tech Stack:** Node.js, ws, vanilla JavaScript/HTML/CSS, Node simulation scripts.

---

### Task 1: Device-independent DrawGuess result timer

**Files:**
- Modify: `games/drawguess.js`, `public/js/renderers/drawguess.js`, `scripts/sim-drawguess.js`

- [ ] Add a failing simulation asserting `playerView(...).stepRemainingMs` is positive and no greater than the server deadline delta.
- [ ] Compute `stepRemainingMs` server-side in `playerView` and never expose it as an absolute clock comparison.
- [ ] Change `startTimer` to receive remaining milliseconds and calculate a browser-local end time on message receipt.
- [ ] Run `node scripts/sim-drawguess.js`.

### Task 2: Resume an active room

**Files:**
- Modify: `server.js`, `public/index.html`, `public/js/room-client.js`
- Create: `scripts/sim-room-resume.js`

- [ ] Add a failing WebSocket integration simulation: create room, start game, disconnect player, reconnect using the original resume token, and assert playing state plus seat index survive.
- [ ] Give each player a random resume token; include it in created/joined responses and store it in session storage.
- [ ] On close, mark a player disconnected and keep state/seat for a five-minute grace window; on `join_room` with a matching token, replace the socket map key and cancel its expiry.
- [ ] Add a lobby "返回进行中的对局" action when stored room/token data exists; it uses the same resume token.
- [ ] Run `node scripts/sim-room-resume.js`.

### Task 3: Rummikub table rearrangement target routing

**Files:**
- Modify: `public/js/renderers/rummikub.js`
- Create: `scripts/sim-rummikub-ui.js`

- [ ] Add a failing source-level guard that a selected tile can be dropped onto a filled target group instead of always stopping propagation.
- [ ] In manipulation mode, route a click on an unselected tile to its containing target group whenever a selection exists; preserve click-to-select when no target drop is pending.
- [ ] Run the UI guard and existing game simulations.

### Task 4: Categorized lobby and accepted Sheep Tile change

**Files:**
- Modify: `public/index.html`, `public/style.css`, `public/js/renderers/sheeptile.js`

- [ ] Add category wrappers in this order: 棋类策略, 牌类推理, 聚会休闲, 竞技益智. Put chess games first and keep every existing game card identifier unchanged.
- [ ] Add compact category heading styles that preserve the existing Design C card system and mobile flow.
- [ ] Include the accepted Sheep Tile emoji visibility change in this scoped commit.

### Task 5: Verify, restart, and commit

- [ ] Run `node --check` for all changed JS plus all new simulations and `git diff --check`.
- [ ] Restart `node server.js` and request `http://localhost:3000/game.html`.
- [ ] Stage only this feature's files and commit with `fix: improve game recovery and lobby organization`.
