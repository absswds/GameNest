// public/js/haptics.js
// Native Android haptics bridge (window.GameNestNative.haptic) with navigator.vibrate fallback.
(function(root) {
  var PATTERNS = {
    turn: [25, 60, 35],
    card: 15,
    win: [30, 50, 40, 60, 70],
    lose: [60, 80, 90],
    invalid: [25, 40, 25],
    dice: [15, 35, 15, 50, 20, 70, 35],
    tick: 12
  };

  function isEnabled() {
    try {
      return !root.localStorage || root.localStorage.getItem('gn_haptics') !== '0';
    } catch (e) {
      return true;
    }
  }

  function play(event) {
    if (!event || !Object.prototype.hasOwnProperty.call(PATTERNS, event)) return;
    if (!isEnabled()) return;
    try {
      if (root.GameNestNative && root.GameNestNative.haptic) {
        root.GameNestNative.haptic(event);
        return;
      }
    } catch (e) {}
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(PATTERNS[event]);
      }
    } catch (e) {}
  }

  root.GNHaptics = {
    play: play
  };
})(typeof window !== 'undefined' ? window : globalThis);
