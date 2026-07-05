# GameNest

> 23 self-hosted LAN board, card, party, puzzle, and real-time games. Start one server, share one room code or QR code, and play from any browser on the same WiFi.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/absswds/GameNest/actions/workflows/ci.yml/badge.svg)](https://github.com/absswds/GameNest/actions/workflows/ci.yml)
[![Android APK](https://github.com/absswds/GameNest/actions/workflows/android-apk.yml/badge.svg)](https://github.com/absswds/GameNest/actions/workflows/android-apk.yml)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-43853d.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)

[简体中文](README.zh-CN.md) | English

GameNest is a lightweight open-source tabletop game room for family nights, dorm rooms, classrooms, offices, and small parties. One laptop or Android phone hosts the room, everyone else joins from a browser on the same local network, and the stack stays intentionally simple: Express 4, `ws`, and plain HTML/CSS/JavaScript.

## Highlights

- 23 built-in games covering classic boards, party cards, poker, deduction, puzzle races, and real-time battles.
- Local-first multiplayer: no account system, no cloud dependency, just one host and one shared WiFi.
- Room code and QR-code joining for phones, tablets, and laptops.
- Waiting-room flow with player names, emoji avatars, ready state, seat swaps, bots, and per-game options.
- AI opponents for most turn-based games, useful for solo testing or small groups.
- Browser-first renderers with hidden-information views, legal-move hints, canvas boards, and lightweight animations.
- Optional Android host wrapper powered by nodejs-mobile, so the same project can run as a portable local server.

## Screenshots

GameNest runs as a shared LAN lobby, a QR-code waiting room, and browser-based game boards:

![GameNest desktop lobby](docs/media/lobby.png)

![Waiting room with QR join](docs/media/room.png)

![Flight Chess in progress](docs/media/game-flightchess.png)

Mobile and join-flow previews:

![Mobile same-WiFi host address](docs/media/android-host.jpg)

![Create and join flow](docs/media/join-flow.gif)

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

1. Start GameNest on one computer or Android device.
2. Open the lobby and choose a game.
3. Create a room, then share the room code, host IP, or QR code.
4. In the waiting room, adjust seats, add bots, change avatars, and mark players ready.
5. Start the match and keep playing in the browser while state syncs over WebSocket.
6. If someone briefly leaves, they can return to the room from the lobby resume card.

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

- Requires Node.js `18+`
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

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the server, WebSocket, and renderer flow.
- [CONTRIBUTING.md](CONTRIBUTING.md) has the new-game checklist.
- [docs/STORE_LISTING.md](docs/STORE_LISTING.md) collects app-store copy and asset planning.

## Contributing

Bug reports, rules fixes, AI improvements, renderer polish, and new games are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
