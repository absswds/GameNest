# GameNest

> Self-hosted LAN multiplayer board, card, and party games. One server, browser UI, same WiFi.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-43853d.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-ws-111111.svg)](https://github.com/websockets/ws)

[简体中文](README.zh-CN.md) | English

GameNest is an open-source, self-hosted tabletop game room for family, friends, classrooms, and small gatherings. Start one Node.js server, open the lobby in a browser, and let other phones or laptops join from the same WiFi through a QR code or the host IP.

The project keeps the stack intentionally small: Express 4, `ws`, plain HTML/CSS/JavaScript, and optional Android packaging through nodejs-mobile.

## Highlights

- 23 built-in games across classic board games, cards, poker, deduction, party, puzzle racing, and real-time battle.
- Local-first multiplayer over one LAN server, with HTTP and WebSocket sharing port `3000`.
- AI opponents for most turn-based games, so solo testing and small rooms are still useful.
- Room lobby with ready state, host controls, seat swapping, QR-code sharing, reconnect support, and game options.
- Game-specific renderers, including Canvas boards, hidden-information player views, legal-move hints, and lightweight animations.
- Optional Android wrapper that runs the same Node.js project inside a WebView app.

## Quick Start

```bash
npm install
npm start
```

Open the lobby:

```text
http://localhost:3000
```

Other devices on the same WiFi can join with:

```text
http://<host-ip>:3000
```

## Games

| Category | Games |
| --- | --- |
| Classic board | Tic-Tac-Toe, Gomoku, Flight Chess, Chinese Chess, Go 9x9 |
| Party cards | UNO, Exploding Kittens, Number Bomb, Old Maid, Draw & Guess, Truth or Dare |
| Deduction | Davinci Code, Liar's Bar |
| Poker | Dou Dizhu, Big Two, Texas Hold'em |
| Tabletop strategy | Rummikub, Monopoly |
| Brain racing | 24 Game, Minesweeper Race, Sheep Tile |
| Real-time battle | Snake Battle, Suika Battle |

## Commands

```bash
npm start             # start the LAN server
npm test              # run regression tests
npm run check         # syntax-check project JavaScript
npm run test:monopoly # run focused Monopoly tests
```

On Windows, if port `3000` is still occupied by an old server run:

```powershell
taskkill /f /im node.exe
```

## Repository Layout

```text
.
|-- server.js                 # Express + WebSocket server, rooms, routing, bots
|-- main.js                   # nodejs-mobile entry point for Android
|-- games/                    # game rules and state transitions
|-- bots/                     # AI move generators
|-- lang/                     # server-side text
|-- public/                   # browser lobby, game shell, renderers, styles, assets
|-- scripts/                  # smoke simulations and maintenance helpers
|-- tests/                    # node:test regression suites
|-- android/                  # Android Studio wrapper project
`-- docs/                     # public architecture and development notes
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the server/client flow and [CONTRIBUTING.md](CONTRIBUTING.md) for the game-module checklist.

## Android

The Android project wraps the same Node.js game server with nodejs-mobile and a WebView. See [android/SETUP.md](android/SETUP.md) for the full setup.

Short version:

```powershell
cd android
.\copy-nodejs-project.ps1
```

Then open `android/` in Android Studio and run the app.

## Contributing

Bug reports, rules fixes, AI improvements, renderer polish, and new games are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
