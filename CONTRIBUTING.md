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
6. `server.js` — only if the game needs per-player hidden information or special scheduling.

Optional extras: `public/js/tutorials.js` for the rules button, `tests/` for focused coverage.

## Game Module Contract

```js
exports.name = 'game-id';
exports.maxPlayers = 2;
exports.createState = () => ({});
exports.handleMove = (data, state, playerIndex) => null;
exports.initGame = (state, playerCount) => {};
```

`handleMove` mutates `state` directly and returns `null` for a legal move or a user-facing error string for an illegal move.

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

Bots should not mutate `state`. Copy arrays before sorting or filtering shared data.

## Android Notes

After web or server changes, run:

```powershell
cd android
.\copy-nodejs-project.ps1
```

Keep Express on `4.x`; the Android nodejs-mobile runtime is not compatible with the newer Express 5 dependency chain.

## Pull Request Checklist

- The game can start from the lobby.
- Multiplayer state stays in sync after at least one move.
- AI games have a safe fallback for edge states.
- `npm run check` passes.
- Relevant tests pass, or the PR explains why a test could not be run.
