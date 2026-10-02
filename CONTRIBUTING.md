# Contributing

Thanks for taking a look at GameNest. This project is intentionally small and browser-first, so most contributions should stay easy to run locally.

## Development Setup

```bash
npm install
npm start
```

Open `http://localhost:3000`.

Before sending changes:

```bash
npm run check
npm test
```

## Adding a Game

A normal game touches these places:

1. `games/<name>.js` — game rules and state transitions.
2. `bots/<name>.js` — AI bot (skip for pure PvP games).
3. `public/js/renderers/<name>.js` — browser renderer.
4. `public/game.html` — `<script>` tag for the renderer.
5. `public/js/game-catalog.js` + `public/js/lang/zh.js` + `public/js/lang/en.js` — lobby metadata and translations.
6. `public/js/tutorials.js` — the in-game rules text, in both `TUTORIALS_ZH` and `TUTORIALS_EN`.

Optional extras: `tests/` for focused coverage, and a lobby cover from `scripts/generate-cover-art.js <id>`. The generator writes a 1600×1200 PNG; the catalog expects `public/assets/game-covers/<id>.webp` at 1536×1024, so crop and convert it or `tests/game-catalog-covers.test.js` fails.

You normally don't need to touch `server.js`: it loads every module in `games/` and `bots/` automatically, and the optional hooks below cover hidden information, timers and real-time play.

## Game Module Contract

```js
exports.name = 'game-id';
exports.maxPlayers = 2;
exports.createState = () => ({});
exports.handleMove = (data, state, playerIndex) => null;
exports.initGame = (state, playerCount) => {};
```

`handleMove` mutates `state` directly and returns `null` for a legal move, or an i18n error key (add it to both `lang/server-zh.js` and `lang/server-en.js`) for an illegal move.

Optional hooks the server honours:

| Hook | Use it when |
| --- | --- |
| `playerView(state, idx)` | Players must not see each other's hands or roles. Required for any game with private information (`tests/hidden-hands.test.js` checks this). It can run before `initGame`, so guard against unset fields. `games/lib/hidden.js` has a `maskView` helper for card games. |
| `getCurrentActor` / `setCurrentActor` | The player who must act is not `state.currentPlayer` (e.g. a responder). |
| `realtime` + `tick` | The game advances on a timer instead of on moves. |
| `getPhaseDeadline` / `onTimeout` / `getPendingActors` | Phases with deadlines or simultaneous actions (see werewolf and sanguo). |

## Bot Contract

```js
exports.name = 'game-id';
exports.createBot = (playerIndex) => ({
  name: 'Bot',
  getMove(state) {
    return {};
  },
});
```

Bots receive the full server state and must not mutate it. Copy arrays before sorting or filtering shared data. If a bot move is rejected, the server falls back to `{pass:true}` and then `{}`.

## Android Notes

After web or server changes, run:

```powershell
cd android
.\copy-nodejs-project.ps1
```

Keep Express on `4.x`; the Android nodejs-mobile runtime is not compatible with the newer Express 5 dependency chain.

## Translations

UI text lives in `public/js/lang/zh.js` and `public/js/lang/en.js` (plus `catalog-*.js` for the lobby). Add every key to both files. The strings are single-quoted, so escape apostrophes in English text (`'don't'`) or `npm run check` fails.

## Pull Request Checklist

- The game can start from the lobby.
- Multiplayer state stays in sync after at least one move.
- AI games have a safe fallback for edge states.
- Rules text and UI strings exist in both Chinese and English.
- `npm run check` passes.
- Relevant tests pass, or the PR explains why a test could not be run.
