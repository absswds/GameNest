# UI Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the LAN tabletop platform so the lobby, waiting room, and in-game shell feel like one polished product, with generated cover art replacing the weakest emoji-only presentation.

**Architecture:** Introduce a shared game catalog for descriptive metadata and cover assets, then rebuild the lobby and room shell around that catalog without changing server protocols. Keep renderer changes focused on shared chrome and representative games, so the first stage improves the whole platform before any deep per-game repaint.

**Tech Stack:** Static HTML, vanilla JS, shared CSS, WebSocket room client, AI-generated bitmap cover art.

---

### Task 1: Shared Catalog And Asset Foundation

**Files:**
- Create: `public/js/game-catalog.js`
- Create: `public/assets/game-covers/`
- Modify: `public/index.html`
- Modify: `public/js/room-client.js`
- Modify: `public/game.html`

- [ ] Define one shared catalog object with stable keys for `name`, `subtitle`, `duration`, `players`, `category`, `tags`, `cover`, `featured`, and `supportsAI`.
- [ ] Move lobby card content and room header lookups off hard-coded DOM text and onto the shared catalog.
- [ ] Load the shared catalog on both `/` and `/game.html` before page-specific scripts.
- [ ] Leave server message payloads unchanged; this task is front-end metadata only.
- [ ] Commit with `feat: add shared game catalog for lobby and room UI`.

### Task 2: Lobby Layout Rebuild

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Test: manual browser verification on `/`

- [ ] Replace the flat two-column card wall with a hero-style selection area, featured strip, filter controls, and denser browse grid.
- [ ] Keep quick join and resume visible near the top so returning players do not scroll through the catalog first.
- [ ] Support category filter and text search entirely client-side from the shared catalog.
- [ ] Keep the primary create action fixed and synced to the currently selected game.
- [ ] Commit with `feat: redesign lobby information architecture`.

### Task 3: Waiting Room And Game Shell Unification

**Files:**
- Modify: `public/game.html`
- Modify: `public/style.css`
- Modify: `public/js/room-client.js`

- [ ] Convert the waiting room into a desktop-friendly two-column layout while preserving a clean single-column mobile flow.
- [ ] Group room info, roster, readiness controls, QR join, and rule entry into distinct visual blocks using shared shell styles instead of inline styles.
- [ ] Add a stronger in-game top summary and bottom action shell so renderers sit inside a more coherent platform frame.
- [ ] Keep existing room actions and protocols intact: ready, add AI, start, swap, restart, return.
- [ ] Commit with `feat: unify waiting room and game shell`.

### Task 4: Generated Cover Art

**Files:**
- Create: `public/assets/game-covers/*.png`
- Modify: `public/index.html`
- Modify: `public/js/room-client.js`

- [ ] Generate a first-pass cover set for at least the featured games used in the refreshed lobby: Monopoly, Flight Chess, Sheep Tile, Suika Battle, Texas, and DrawGuess.
- [ ] Use a unified art direction: clean tabletop materials, bright readable compositions, no text, no watermark, crop-safe for cards.
- [ ] Persist final selected images inside `public/assets/game-covers/` and wire them into the shared catalog.
- [ ] Fall back gracefully to emoji/icon presentation if a cover path is missing.
- [ ] Commit with `feat: add generated cover art for featured games`.

### Task 5: Verification

**Files:**
- Test: manual verification on `/` and `/game.html`
- Test: `node tests/monopoly.test.js`

- [ ] Start the local server and verify the refreshed lobby on mobile-width and desktop-width screens.
- [ ] Verify resume, create room, join by code, QR visibility, ready flow, host controls, and transition into game state.
- [ ] Verify at least one representative game from the new featured set opens cleanly inside the updated shell.
- [ ] Run `node tests/monopoly.test.js` to ensure recent Monopoly-specific logic remains green after shell changes.
- [ ] Commit with `test: verify ui visual refresh stage one`.
