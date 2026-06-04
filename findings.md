# Findings

## Architecture Patterns (from existing code)
- Games export: { name, maxPlayers, createState(), handleMove(data, state, playerIndex) }
- Game modules may also export: { initGame(state, playerCount) }
- Renderers register via: window.gameRenderers.set('gamename', { init(container), render(state, container, playerIndex, winner) })
- Bots export: { name, createBot(playerIndex) → { name, getMove(state) } }
- All state lives on server, broadcast via WebSocket
- Lobby system: room.phase cycling through lobby → ready → playing
- Waiting room: slots, ready buttons, add bot, start game
