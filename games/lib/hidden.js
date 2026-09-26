// Helpers for per-player state views. Hidden card arrays keep their length
// (filled with null) so renderers can still show counts / face-down backs.

function blank(arr) {
  return Array.isArray(arr) ? new Array(arr.length).fill(null) : arr;
}

// Returns a shallow copy of `state` where other players' hands and the listed
// hidden pile fields are replaced by null-filled arrays. Once the game has a
// winner everything is revealed.
function maskView(state, playerIndex, opts) {
  opts = opts || {};
  if (!state || (state.winner !== null && state.winner !== undefined && !opts.keepHiddenAfterWin)) return state;
  const view = Object.assign({}, state);
  const handsKey = opts.handsKey || 'hands';
  if (Array.isArray(state[handsKey])) {
    view[handsKey] = state[handsKey].map((h, i) => (i === playerIndex ? h : blank(h)));
  }
  for (const key of opts.piles || []) {
    if (Array.isArray(state[key])) view[key] = blank(state[key]);
  }
  return view;
}

module.exports = { maskView, blank };
