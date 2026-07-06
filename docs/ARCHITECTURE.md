# Architecture

GameNest uses one Node.js process for HTTP, WebSocket, room management, game rules, and bot scheduling. Browser clients render each game with plain JavaScript modules.

## Runtime Flow

```text
Browser lobby
  -> create or join room over WebSocket
  -> server keeps room state in memory
  -> game module validates and applies moves
  -> server broadcasts filtered state
  -> browser renderer updates the board
```

HTTP and WebSocket share port `3000`.

## Main Pieces

| Path | Responsibility |
| --- | --- |
| `server.js` | Express routes, WebSocket messages, room lifecycle, player seats, bot scheduling, per-player state broadcasts |
| `games/` | Pure game rules and state transitions |
| `bots/` | AI move generation for supported games |
| `public/index.html` | Lobby and game selection |
| `public/game.html` | Room shell and renderer host |
| `public/js/room-client.js` | WebSocket client, waiting room, game options, renderer scheduling |
| `public/js/renderers/` | Game-specific DOM or Canvas rendering |
| `public/js/game-catalog.js` | Built-in game metadata (single source of truth for lobby) |
| `public/js/lang/` | Browser language packs |
| `lang/` | Server-side text packs |
| `tests/` | Regression tests for rules, bots, catalog, and client assumptions |
| `android/` | Android WebView wrapper using nodejs-mobile |

## Room Lifecycle

Rooms move through three phases:

```text
lobby -> ready -> playing
```

Players can join, reconnect, change names and avatars, swap seats, mark ready, and start games. The host can add bots and update game-specific options before play begins.

## State Sync

Clients send `game_move` messages with game-specific payloads. The server passes those payloads to the current game's `handleMove(data, state, playerIndex)`.

After a legal move, the server broadcasts `game_state`. Some games expose a per-player state view to hide private information or include legal moves only for the active player.

Examples:

- Minesweeper Race uses per-player board views.
- Texas Hold'em hides opponents' hole cards.
- Chinese Chess sends legal move hints to the current player.
- Draw & Guess hides the drawing stroke endpoint from guessing players.

Games export `playerView(state, playerIndex)` or `playerBoardView(state, playerIndex)`; the server's `broadcastGameView` helper dispatches the right view to each client. Adding a new per-player-view game only requires exporting the hook — no server.js edits needed.

## Per-Player Views

Some games hide private information or show legal-move hints only to the active player. These games export `playerView(state, playerIndex)` or `playerBoardView(state, playerIndex)` from their module in `games/`. The server calls these functions before broadcasting `game_state`, `game_started`, and `game_restart`, so each client receives a filtered view of the shared state.

Current games using per-player views:

- **Minesweeper Race** — `playerBoardView` shares the mine layout but gives each player independent reveal and flag state.
- **Texas Hold'em** — `playerView` hides opponents' hole cards.
- **Chinese Chess** — `playerView` attaches a `legalMoves` array for the current player.
- **Draw & Guess** — `playerView` hides the drawing stroke endpoint from guessing players.

## Android Wrapper

The Android project copies the Node.js project into app assets and starts it through nodejs-mobile. The Android UI is a WebView pointed at the local server.

Before Android builds, run:

```powershell
cd android
.\copy-nodejs-project.ps1
```
