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

Clients send `game_move` messages with game-specific payloads. The server passes each payload to the current game's `handleMove(data, state, playerIndex)`, which mutates `room.state` and returns `null` or an i18n error key. After a legal move the server broadcasts the new state as `game_state`.

## Per-Player Views

Any game with private information (hands, roles, hidden boards) exports `playerView(state, playerIndex)`. The server sends every state through it — on broadcast and also on join and resume — so each client only sees what its seat may see. Adding the hook is enough; no `server.js` change is needed. `games/lib/hidden.js` has a `maskView` helper for card games, and `tests/hidden-hands.test.js` checks that hidden data does not leak.

Most card and role games use it (Texas Hold'em, Dou Dizhu, UNO, Mahjong, Werewolf, Three Kingdoms, …). Board games use it to attach legal-move hints for the current player. Minesweeper Race is the one exception: it uses `playerBoardView`, which `server.js` calls directly.

## Turn Flow and Timers

- **Normal turns**: the actor is `state.currentPlayer`. Games where someone else must answer (a responder, a shooter) export `getCurrentActor` / `setCurrentActor`.
- **Real-time games** export `realtime` and `tick`; the server calls `tick` on an interval.
- **Phase games** (Werewolf, Three Kingdoms) export `getPhaseDeadline`, `onTimeout` and `getPendingActors`; the generic `schedulePhaseGame` in `server.js` runs their deadlines and bot actions.
- A few older games still have their own branches in `server.js` (Battleship placement, 24 Game, Dou Dizhu turn timer, Mahjong round end, Liar's Bar pause).

## Matches and Results

Two-player board games (`MATCH_GAMES` in `server.js`) support best-of-1/3/5 through `games/lib/match.js`. Between games the seats swap so the first move alternates.

`state.winner` is a seat index, or a negative sentinel for team results (e.g. landlord vs farmers in Dou Dizhu, wolves vs village in Werewolf). `showResult` in `public/js/room-client.js` turns these into the result screen.

## Bots

Each `bots/<id>.js` exports `createBot(index)`, whose `getMove(state)` receives the full server state and must not mutate it. The server schedules bot moves; if a bot move is rejected it falls back to `{pass:true}` and then `{}`.

## MCP Server

`mcp/` is a separate package (own `package.json`, not bundled into the exe/APK) that lets an AI client play as an ordinary seat. It connects to a running GameNest server over the same WebSocket protocol as the browser, so it needs no server-side support beyond normal moves. It speaks stdio by default or Streamable HTTP (`--http=<port>`, stateless, no auth, rejects non-local `Origin`).

- `mcp/server.js` registers the tools (`create_room`, `wait_for_turn`, `make_move`, …) and reconnects with the resume token.
- `mcp/move-guides.js` holds the per-game move formats returned by `get_rules`.
- `suggest_move` runs the project's own bot on a state rebuilt from this seat's view (`toBotState`), so it never sees hidden cards.
- `mcp/draw.js` converts SVG to Draw & Guess strokes and renders strokes to PNG for `get_canvas`. Drawer fixes use the game moves `stage_undo` / `stage_clear`, which the web undo/clear buttons also send.

See `mcp/README.md` for client setup.

## Android Wrapper

The Android project copies the Node.js project into app assets and starts it through nodejs-mobile. The Android UI is a WebView pointed at the local server.

Before Android builds, run:

```powershell
cd android
.\copy-nodejs-project.ps1
```
