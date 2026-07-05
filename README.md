# GameNest

> 23 self-hosted LAN board, card, and party games. Start one server, share one QR code, play from any browser on the same WiFi.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/absswds/GameNest/actions/workflows/ci.yml/badge.svg)](https://github.com/absswds/GameNest/actions/workflows/ci.yml)
[![Android APK](https://github.com/absswds/GameNest/actions/workflows/android-apk.yml/badge.svg)](https://github.com/absswds/GameNest/actions/workflows/android-apk.yml)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-43853d.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)

[简体中文](README.zh-CN.md) | English

GameNest is an open-source tabletop game room for family nights, dorms, classrooms, and small gatherings. One laptop or Android phone hosts the room, everyone else joins from a browser on the same WiFi, and the whole stack stays intentionally simple: Express 4, `ws`, and plain HTML/CSS/JavaScript.

## Why GameNest

- 23 built-in games across board games, cards, poker, deduction, party games, puzzle races, and real-time battles.
- Zero-account LAN flow: start the host, open the lobby, and let other devices join through the host IP or QR code.
- AI opponents for most turn-based games, so solo testing and small groups still work well.
- Browser-first UI with per-game renderers, hidden-information views, legal-move hints, and lightweight animations.
- Optional Android wrapper powered by nodejs-mobile, so the same project can be carried around as a local host app.

## Screenshots

Add these assets before the next release:

- `docs/media/lobby.png` - game selection lobby on desktop
- `docs/media/room.png` - waiting room with players, ready state, and QR join
- `docs/media/game-uno.png` - card game in progress
- `docs/media/game-chinesechess.png` - board game in progress
- `docs/media/android-host.jpg` - Android host screen or same-WiFi join flow
- `docs/media/join-flow.gif` - 15 to 30 second host-to-join demo

Once those files exist, place them here in the README.

## Quick Start

```bash
npm install
npm start
```

Open the lobby on the host machine:

```text
http://localhost:3000
```

Other phones, tablets, or laptops on the same WiFi can join with:

```text
http://<host-ip>:3000
```

If port `3000` is still occupied on Windows:

```powershell
taskkill /f /im node.exe
```

## How It Works

1. Start the GameNest server on one computer or Android device.
2. Open the lobby and create a room for the game you want.
3. Let other players join through the QR code or host IP.
4. Use the waiting room for seat swaps, bots, ready state, and game options.
5. Start the match and keep playing in the browser with synchronized game state over WebSocket.

## Game Catalog

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

CI currently runs `npm run check` and `npm test` on GitHub Actions.

## Platform Notes

### Browser host

- Node.js `18+`
- HTTP and WebSocket share port `3000`
- Best fit for laptops, desktops, classrooms, and home LAN play

### Android host

The Android project wraps the same Node.js server with nodejs-mobile and a WebView.

```powershell
cd android
.\copy-nodejs-project.ps1
```

Then open `android/` in Android Studio and run the app. Full setup details live in [android/SETUP.md](android/SETUP.md).

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
`-- docs/                     # architecture and release notes
```

More details:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the server/client flow
- [CONTRIBUTING.md](CONTRIBUTING.md) for the game-module checklist
- [docs/STORE_LISTING.md](docs/STORE_LISTING.md) for app-store copy and asset planning

## What Still Needs Polishing

- Final screenshots and one short GIF for the GitHub front page and release assets
- A cleaner release section with direct APK download instructions once the next release is published
- A short roadmap for upcoming games, mobile polish, and testing gaps
- More focused regression coverage for newer games and renderer-heavy flows

## Contributing

Bug reports, rules fixes, AI improvements, renderer polish, and new games are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
