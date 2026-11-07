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
  // opts: { icon, faces, sub, tone: 'info'|'gain'|'loss'|'warn', ms, onClose }
  // faces: trusted HTML built by the renderer (card faces), shown in place of the icon.
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
      + '.mo-announce-faces{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:2px 0 10px}'
      + '.mo-announce-faces>*{flex-shrink:0;position:relative}'
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
    el.innerHTML = (a.faces ? '<div class="mo-announce-faces">' + a.faces + '</div>' : a.icon ? '<div class="mo-announce-icon"></div>' : '')
      + '<div class="mo-announce-title"></div>' + (a.sub ? '<div class="mo-announce-sub"></div>' : '');
    if (a.icon && !a.faces) el.querySelector('.mo-announce-icon').textContent = a.icon;
    el.querySelector('.mo-announce-title').textContent = a.title;
    if (a.sub) el.querySelector('.mo-announce-sub').textContent = a.sub;
    document.body.appendChild(el);
    showing = el;
    var done = false, timer;
    function close() {
      if (done) return;
      done = true; clearTimeout(timer);
      var finish = function () { el.remove(); showing = null; if (a.onClose) a.onClose(); showNext(); };
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
    if (queue.length > 3) { // never build a long backlog
      var dropped = queue.shift();
      if (dropped.onClose) dropped.onClose();
    }
    showNext();
  }
  function clearAnnouncements() {
    queue = [];
    if (showing) { showing.remove(); showing = null; }
  }

  // "Just arrived" glow for cards in a hand. Renderers rebuild the hand on every broadcast, so the
  // glow is keyed, not tied to one element: give each card data-mo-key="<game>:<id>", call
  // markNew(keys) when the cards arrive and refreshGlow(root) after every render. A rebuilt card
  // resumes the glow at the same point in time instead of restarting it.
  var GLOW_MS = 2100;
  // A filter, not box-shadow, so the card keeps its own shadow while it glows; `translate`
  // lifts it without touching the card's own transform (hover, selected)
  var RING = 'drop-shadow(0 0 1.5px #ffcf4a) drop-shadow(0 0 1.5px #ffcf4a) drop-shadow(0 0 10px rgba(255,190,60,.95))';
  var NO_RING = 'drop-shadow(0 0 0 rgba(255,207,74,0)) drop-shadow(0 0 0 rgba(255,207,74,0)) drop-shadow(0 0 0 rgba(255,190,60,0))';
  var glowing = {};
  function markNew(keys) {
    var now = performance.now();
    (keys || []).forEach(function (k) { glowing[k] = now; });
    refreshGlow();
  }
  function refreshGlow(root) {
    var now = performance.now(), live = false;
    Object.keys(glowing).forEach(function (k) {
      if (now - glowing[k] > GLOW_MS) delete glowing[k]; else live = true;
    });
    if (!live) return;
    var els = (root || document).querySelectorAll('[data-mo-key]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], start = glowing[el.getAttribute('data-mo-key')];
      if (start === undefined || el._moGlow === start || !canAnimate(el)) continue;
      el._moGlow = start;
      var anim = reduced()
        ? el.animate([{ filter: RING }, { filter: RING }], { duration: GLOW_MS })
        : el.animate([{ filter: NO_RING, translate: '0 0' }, { filter: RING, translate: '0 -5px', offset: 0.5 }, { filter: NO_RING, translate: '0 0' }],
          { duration: GLOW_MS / 3, iterations: 3, easing: 'ease-in-out' });
      anim.currentTime = now - start;
    }
  }

  // Remembers a hand's card ids between renders and returns the ones that just arrived.
  // The first call (after a join, reconnect or reset) and a fresh deal (a non-empty hand, every id new) return [].
  function handTracker() {
    var prev = null;
    return {
      reset: function () { prev = null; },
      diff: function (ids) {
        var before = prev;
        prev = ids.slice();
        if (!before) return [];
        var seen = {};
        before.forEach(function (id) { seen[id] = true; });
        var fresh = ids.filter(function (id) { return !seen[id]; });
        // A hand that was empty can only fill up by drawing; a full hand that is all new is a fresh deal
        return before.length && fresh.length === ids.length ? [] : fresh;
      }
    };
  }

  // Pop the drawn cards up in the middle, then make them glow in the hand.
  // facesHtml: the card faces (trusted HTML); keys: their data-mo-key values in the hand.
  function showDrawn(title, facesHtml, keys, sub) {
    announce(title, { faces: facesHtml, sub: sub, ms: 1400, onClose: function () { markNew(keys); } });
  }

  window.Motion = { flyFrom: flyFrom, fade: fade, pop: pop, countTo: countTo, announce: announce, clearAnnouncements: clearAnnouncements,
    markNew: markNew, refreshGlow: refreshGlow, handTracker: handTracker, showDrawn: showDrawn, reduced: reduced, EASE: EASE };
})();
