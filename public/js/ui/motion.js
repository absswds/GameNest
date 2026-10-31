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

  // A centred card that pops in to announce a game event ("Drew a card", "Go to jail"),
  // stays a moment and fades. Calls queue up; tapping the card skips it.
  // opts: { icon, sub, tone: 'info'|'gain'|'loss'|'warn', ms }
  var queue = [], showing = null;
  var TONES = {
    info: ['#fffdf8', '#b9954f', '#1c1b19'],
    gain: ['#eef8f1', '#3f9b68', '#1d4d33'],
    loss: ['#fdeeee', '#c0392b', '#6e1f17'],
    warn: ['#fff6e6', '#d98a1c', '#6b4210']
  };
  function ensureStyles() {
    if (document.getElementById('motionAnnounceStyles')) return;
    var s = document.createElement('style');
    s.id = 'motionAnnounceStyles';
    s.textContent = '.mo-announce{position:fixed;left:50%;top:42%;z-index:900;transform:translate(-50%,-50%);'
      + 'min-width:200px;max-width:min(86vw,360px);padding:18px 22px 16px;border-radius:20px;border:2px solid;'
      + 'box-shadow:0 4px 12px rgba(0,0,0,.12),0 18px 40px rgba(0,0,0,.22);text-align:center;cursor:pointer;'
      + 'font-family:inherit;user-select:none}'
      + '.mo-announce-icon{font-size:44px;line-height:1.1;margin-bottom:6px}'
      + '.mo-announce-title{font-size:20px;font-weight:800;line-height:1.3}'
      + '.mo-announce-sub{font-size:14px;margin-top:6px;line-height:1.45;opacity:.85}';
    document.head.appendChild(s);
  }
  function showNext() {
    if (showing || !queue.length) return;
    var a = queue.shift();
    ensureStyles();
    var t = TONES[a.tone] || TONES.info;
    var el = document.createElement('div');
    el.className = 'mo-announce';
    el.setAttribute('role', 'status');
    el.style.background = t[0]; el.style.borderColor = t[1]; el.style.color = t[2];
    el.innerHTML = (a.icon ? '<div class="mo-announce-icon"></div>' : '') + '<div class="mo-announce-title"></div>'
      + (a.sub ? '<div class="mo-announce-sub"></div>' : '');
    if (a.icon) el.querySelector('.mo-announce-icon').textContent = a.icon;
    el.querySelector('.mo-announce-title').textContent = a.title;
    if (a.sub) el.querySelector('.mo-announce-sub').textContent = a.sub;
    document.body.appendChild(el);
    showing = el;
    var done = false, timer;
    function close() {
      if (done) return;
      done = true; clearTimeout(timer);
      var finish = function () { el.remove(); showing = null; showNext(); };
      if (!canAnimate(el)) { finish(); return; }
      el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.94)' }],
        { duration: 220, easing: EASE, fill: 'forwards' }).onfinish = finish;
    }
    el.addEventListener('click', close);
    if (canAnimate(el)) {
      el.animate(reduced() ? [{ opacity: 0 }, { opacity: 1 }] : [
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1.06)', offset: 0.7 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }
      ], { duration: 320, easing: EASE });
    }
    timer = setTimeout(close, a.ms || 1700);
  }
  function announce(title, opts) {
    if (!title || !document.body) return;
    var a = Object.assign({ title: String(title) }, opts || {});
    queue.push(a);
    if (queue.length > 3) queue.shift(); // never build a long backlog
    showNext();
  }
  function clearAnnouncements() {
    queue = [];
    if (showing) { showing.remove(); showing = null; }
  }

  window.Motion = { flyFrom: flyFrom, fade: fade, pop: pop, countTo: countTo, announce: announce, clearAnnouncements: clearAnnouncements, reduced: reduced, EASE: EASE };
})();
