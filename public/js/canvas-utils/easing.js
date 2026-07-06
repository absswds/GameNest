(function() {
  window.Easing = {
    easeOutCubic: function(t) { return 1 - Math.pow(1 - t, 3); },
    easeInOutQuad: function(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    easeInCubic: function(t) { return t * t * t; },
    linear: function(t) { return t; }
  };
})();
