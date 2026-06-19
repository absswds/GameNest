# Findings

## 2026-06-20 — Monopoly / Sheep Tile / DrawGuess follow-up
- **Monopoly replay root cause:** the renderer snapshots `lastMove` by object reference. Every WebSocket `game_state` is newly deserialized, so purchasing a property makes the unchanged `lastMove` look new. `buildEvents()` then queues the previous move animation again. Fix direction: compare a stable move signature/value rather than object identity.
- **Sheep Tile visibility root cause:** covered tiles are deliberately rendered with `globalAlpha = 0.5` and a second dark overlay. They remain hard to read even though the game is functioning; interaction does not need to gate visual legibility. Fix direction: retain blocked styling and hit-test rules while using near-opaque symbols / a much lighter overlay.
- **Reference research:** the integrated web search is currently blocked by Cloudflare (403). A direct read-only Steam page request reaches the DrawGuess search result, so the next lookup will extract its public description and mechanics directly before changing the DrawGuess loop.

## Architecture Patterns (from existing code)
- Games export: { name, maxPlayers, createState(), handleMove(data, state, playerIndex) }
- Game modules may also export: { initGame(state, playerCount) }
- Renderers register via: window.gameRenderers.set('gamename', { init(container), render(state, container, playerIndex, winner) })
- Bots export: { name, createBot(playerIndex) → { name, getMove(state) } }
- All state lives on server, broadcast via WebSocket
- Lobby system: room.phase cycling through lobby → ready → playing
- Waiting room: slots, ready buttons, add bot, start game
