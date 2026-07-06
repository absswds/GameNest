(function() {
  window.createAnimator = function(opts) {
    var state = { running: false, rafId: null, type: 'none', startTime: 0 };
    var tickFn = opts.tick;
    var drawFn = opts.drawFrame;
    var onDoneFn = opts.onDone;

    function start(type, extra) {
      state.running = true;
      state.type = type || 'none';
      state.startTime = performance.now();
      if (extra) Object.assign(state, extra);
      tick();
    }

    function stop() {
      state.running = false;
      state.type = 'none';
      if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    }

    function tick(now) {
      if (!state.running) return;
      var elapsed = (now || performance.now()) - state.startTime;
      if (tickFn) {
        var stillRunning = tickFn(elapsed, state);
        if (!stillRunning) { state.running = false; state.type = 'none'; if (onDoneFn) onDoneFn(); return; }
      }
      if (drawFn) drawFn(state);
      state.rafId = requestAnimationFrame(tick);
    }

    return {
      start: start,
      stop: stop,
      isRunning: function() { return state.running; },
      getState: function() { return state; }
    };
  };
})();
