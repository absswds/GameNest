// What to do when a bot's own move is refused: never let a bad bot move stall the game.
// Order: the game's own `botFallback(state, idx)` hook (for games where passing can be illegal,
// e.g. bigtwo when leading), then {pass:true}, then an empty move (most games draw + advance).
// Returns null on success, otherwise the last error key.
exports.applyBotFallback = (gameMod, state, idx) => {
  let err = 'no_fallback';
  if (typeof gameMod.botFallback === 'function') {
    try {
      const mv = gameMod.botFallback(state, idx);
      if (mv) err = gameMod.handleMove(mv, state, idx);
    } catch (e) { err = 'fallback_exception'; }
  }
  if (err) { try { err = gameMod.handleMove({ pass: true }, state, idx); } catch (e) { err = 'pass_exception'; } }
  if (err) { try { err = gameMod.handleMove({}, state, idx); } catch (e) { err = 'empty_exception'; } }
  return err || null;
};
