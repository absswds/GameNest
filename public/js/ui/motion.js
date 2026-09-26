// Small motion helpers shared by renderers. Transform/opacity only; honours
// prefers-reduced-motion (falls back to a plain fade).
(function() {
  var EASE = 'cubic-bezier(.2,.8,.2,1)';

  function reduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function canAnimate(el) {
    return el && typeof el.animate === 'function';
  }

  // FLIP: animate `el` (already at its final position) from `fromRect`.
  function flyFrom(el, fromRect, duration) {
    if (!canAnimate(el) || !fromRect) return;
    if (reduced()) { fade(el); return; }
    var to = el.getBoundingClientRect();
    var dx = fromRect.left - to.left;
    var dy = fromRect.top - to.top;
    var s = fromRect.width && to.width ? fromRect.width / to.width : 1;
    el.animate([
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')', opacity: 0.6 },
      { transform: 'none', opacity: 1 }
    ], { duration: duration || 320, easing: EASE });
  }

  function fade(el, duration) {
    if (!canAnimate(el)) return;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duration || 200, easing: EASE });
  }

  function pop(el) {
    if (!canAnimate(el)) return;
    if (reduced()) { fade(el); return; }
    el.animate([
      { transform: 'scale(.6)', opacity: 0 },
      { transform: 'scale(1.06)', opacity: 1, offset: 0.7 },
      { transform: 'scale(1)' }
    ], { duration: 260, easing: EASE });
  }

  // Tween a number displayed in `el` from its current text to `to`.
  function countTo(el, to, duration) {
    if (!el) return;
    var from = parseFloat(el.textContent) || 0;
    if (from === to || reduced()) { el.textContent = to; return; }
    var start = performance.now();
    var d = duration || 400;
    function step(now) {
      var t = Math.min((now - start) / d, 1);
      var e = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  window.Motion = { flyFrom: flyFrom, fade: fade, pop: pop, countTo: countTo, reduced: reduced, EASE: EASE };
})();
