# DrawGuess-Style You Draw I Guess Design

## Goal

Keep the existing pass-the-message game as **Whisper**, and add a switchable **Stage** mode where one player draws live while everyone else guesses simultaneously.

## User flow

The host selects `舞台猜词（推荐）` or `悄悄话传画` in the existing You Draw I Guess room settings. The selected mode is displayed to every player in the lobby and carried into a restart.

Stage mode starts each round with the current drawer choosing one of the configured words. The drawer alone sees the word; all other players see its character-length mask and the live canvas. Drawing strokes are broadcast immediately. Guessers may submit repeatedly. A normalized exact match marks a guesser correct, awards a larger score to earlier correct guesses, and prevents duplicate score claims. The drawer earns a bonus for each correct guess. When the timer ends or every eligible guesser is correct, the server reveals the word, shows the per-round results, advances the drawer, and starts the next round. After every configured player has drawn once, the score board decides the winner.

Whisper mode keeps the existing private draw/guess chain and voting reveal. Its current room settings and output remain compatible.

## State and privacy

`games/drawguess.js` owns mode-specific state. Stage state includes the drawer index, round number, selected word/options, latest validated strokes, correct-guess map, score array, and a result phase. `playerView` gives the drawer the word and drawing permission; guessers get the strokes, word mask, their own correctness, and public score/progress only. Raw answers and the active word are never broadcast to other players.

The server remains timer-authoritative. It chooses the Stage timeout from `drawTime`, refreshes the deadline after a word choice, and asks the game module to advance safely on timeout. Stroke messages do not reset that deadline.

## Rendering

The renderer branches on `state.mode`. Stage renders a compact header (drawer, round, timer, masked word and correct-guess count), a live read-only/drawable canvas, a persistent guess input, feedback for correct answers, and a round-result card. Whisper keeps its existing screens under the explicit mode name.

## Regression fixes included in this delivery

- Monopoly detects a move by a stable value signature rather than JSON object identity, so purchase updates never replay movement.
- Sheep Tile keeps covered cards unavailable but renders their icon close to fully opaque with a light blocked overlay.

## Verification

Extend the Node simulation scripts to prove Stage privacy, live strokes, repeat guesses, score ordering, early round completion, timeout progression, drawer rotation, and Whisper compatibility. Add assertions for Monopoly move signature behavior and Sheep Tile drawing constants. Run the game simulations and a local browser smoke test with two clients.
