# Findings

## 2026-06-20 — Monopoly / Sheep Tile / DrawGuess follow-up
- **Monopoly replay root cause:** the renderer snapshots `lastMove` by object reference. Every WebSocket `game_state` is newly deserialized, so purchasing a property makes the unchanged `lastMove` look new. `buildEvents()` then queues the previous move animation again. Fix direction: compare a stable move signature/value rather than object identity.
- **Sheep Tile visibility root cause:** covered tiles are deliberately rendered with `globalAlpha = 0.5` and a second dark overlay. They remain hard to read even though the game is functioning; interaction does not need to gate visual legibility. Fix direction: retain blocked styling and hit-test rules while using near-opaque symbols / a much lighter overlay.
- **Reference research:** the integrated web search is currently blocked by Cloudflare (403). A direct read-only Steam page request reaches the DrawGuess search result, so the next lookup will extract its public description and mechanics directly before changing the DrawGuess loop.

## 2026-06-20 — DrawGuess follow-up investigation
- **Mode-label sync root cause:** `room-client.js` only updates `roomOptions` when it receives `room_update`. The initial `room_created` / `room_joined` payloads do not include room options, although the server does retain and broadcast them later. A player joining after the host has selected `whisper` therefore defaults to the UI fallback `stage` until another room setting changes.
- **Current mode split:** `stage` already has the requested rotating drawer + accumulated score loop (one drawing round per player). `whisper` is a single chain: one player selects a word, then draw/guess steps alternate through the player list and finish on a reveal/vote screen. The requested change is to make that Whisper chain repeat as scored rounds, rather than end after its first reveal.
- **Open product decision:** the requested "first player chooses and draws, then passes onward" could mean a repeated Gartic-style chain where each player creates one chain per round, or a sequential single-chain round with an end-of-round score. Need confirm the intended scoring / completion rule before modifying game state or renderer.

## 2026-06-20 — DrawGuess relay implementation
- **Accepted design:** each Whisper round begins with the next player choosing a fresh word and drawing. The chain alternates draw/guess through all players, then everyone votes whether the final guess still matches the original. A majority match awards the round's initiating drawer 3 points. After every player has initiated one chain, highest score wins; seat order resolves ties.
- **Mode-sync repair:** `room_created` and both `room_joined` packets now carry `options`; the initial client handler stores them before rendering the lobby. This eliminates the missing-options fallback to Stage mode for joining players.

## 2026-06-20 — New multi-area investigation
- **DrawGuess mobile timer candidate root cause:** the renderer calculates remaining time from `serverAbsoluteDeadline - device Date.now()`. The server and each phone/PC need not have matching clocks, so a phone whose clock is ahead sees an already elapsed deadline even while a PC works. Need replace client clock comparison with a server-provided remaining duration or synchronized offset.
- **Rejoin root cause:** on WebSocket close, `server.js` immediately removes the player. If anyone remains it resets the game state to a fresh lobby, so the current room cannot be resumed after using the back-to-lobby button. A resume identity plus disconnect grace period is needed.
- **Rummikub scope:** the game already has a server-side `manipulate` workspace intended to combine table tiles with the current player's hand. The next diagnostic step is to compare its renderer messages and submit validation with an actual table-rearrangement simulation before proposing a rebuild.
- **Homepage scope:** category ordering is visual/information architecture work and should be designed separately from runtime bug fixes, then applied to the game-card data/order in the lobby.

## 2026-06-20 — Rummikub renderer root cause
- **Confirmed interaction failure:** in manipulation mode, every tile click calls `stopPropagation()`. Clicking a filled target group therefore toggles that target tile instead of reaching the group-level drop handler. The only drop area is a tiny blank margin, often unavailable, so selected table tiles cannot practically be moved into another existing group. The fix is to treat a click on any unselected tile in a different group as a drop target while a selection exists.

## Architecture Patterns (from existing code)
- Games export: { name, maxPlayers, createState(), handleMove(data, state, playerIndex) }
- Game modules may also export: { initGame(state, playerCount) }
- Renderers register via: window.gameRenderers.set('gamename', { init(container), render(state, container, playerIndex, winner) })
- Bots export: { name, createBot(playerIndex) → { name, getMove(state) } }
- All state lives on server, broadcast via WebSocket
- Lobby system: room.phase cycling through lobby → ready → playing
- Waiting room: slots, ready buttons, add bot, start game
