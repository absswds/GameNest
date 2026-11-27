// public/js/ui/segmented.js
(function() {
  window.GNUI = window.GNUI || {};

  function createSegmented(opts) {
    opts = opts || {};
    var options = Array.isArray(opts.options) ? opts.options : [];
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : null;

    var root = document.createElement('div');
    root.className = 'ui-seg';
    root.setAttribute('role', 'radiogroup');
    if (opts.id) root.id = opts.id;
    if (opts.label) root.setAttribute('aria-label', String(opts.label));

    var buttons = [];
    var selectedIdx = -1;
    var curVal = opts.value;

    function findIndex(val) {
      for (var i = 0; i < options.length; i++) {
        if (options[i].value === val) return i;
      }
      return -1;
    }

    // Sliding selection pill. It flows between options with the same liquid stretch as the lobby
    // category tabs: the leading edge runs ahead, then the trailing edge catches up (360 ms).
    var ind = document.createElement('span');
    ind.className = 'ui-seg-ind';
    ind.setAttribute('aria-hidden', 'true');
    root.appendChild(ind);
    var indPos = null;

    function reducedMotion() {
      if (window.Motion && typeof window.Motion.reduced === 'function') return window.Motion.reduced();
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function placeInd(animate) {
      var btn = buttons[selectedIdx];
      if (!btn) { ind.style.opacity = '0'; indPos = null; return; }
      if (btn.offsetWidth <= 0) return; // not laid out yet; the ResizeObserver places it later
      var to = { x: btn.offsetLeft, w: btn.offsetWidth };
      var from = indPos;
      ind.style.transform = 'translateX(' + to.x + 'px)';
      ind.style.width = to.w + 'px';
      ind.style.opacity = '1';
      indPos = to;
      if (!animate || !from || from.w <= 0 || reducedMotion() || typeof ind.animate !== 'function') return;
      if (from.x === to.x && from.w === to.w) return;
      var right = to.x > from.x, lead = 0.9, trail = 0.15;
      var L = from.x + (to.x - from.x) * (right ? trail : lead);
      var R = from.x + from.w + (to.x + to.w - from.x - from.w) * (right ? lead : trail);
      ind.animate([
        { transform: 'translateX(' + from.x + 'px)', width: from.w + 'px' },
        { transform: 'translateX(' + L + 'px)', width: Math.max(0, R - L) + 'px', offset: 0.4 },
        { transform: 'translateX(' + to.x + 'px)', width: to.w + 'px' }
      ], { duration: 360, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' });
    }

    function syncUI(animate) {
      for (var i = 0; i < buttons.length; i++) {
        var isSel = i === selectedIdx;
        buttons[i].classList.toggle('is-selected', isSel);
        buttons[i].setAttribute('aria-checked', isSel ? 'true' : 'false');
        buttons[i].tabIndex = isSel || (selectedIdx === -1 && i === 0) ? 0 : -1;
      }
      placeInd(!!animate);
    }

    function selectIndex(idx, silent) {
      if (idx < 0 || idx >= options.length) return;
      var changed = idx !== selectedIdx;
      selectedIdx = idx;
      curVal = options[idx].value;
      syncUI(changed);
      if (!silent && changed && onChange) {
        onChange(curVal);
      }
    }

    options.forEach(function(opt, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ui-seg-btn';
      btn.setAttribute('role', 'radio');
      btn.textContent = opt.label != null ? String(opt.label) : String(opt.value);

      btn.addEventListener('click', function() {
        selectIndex(idx, false);
      });

      btn.addEventListener('keydown', function(e) {
        var len = buttons.length;
        if (!len) return;
        var nextIdx = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          nextIdx = (idx + 1) % len;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          nextIdx = (idx - 1 + len) % len;
        } else if (e.key === 'Home') {
          nextIdx = 0;
        } else if (e.key === 'End') {
          nextIdx = len - 1;
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectIndex(idx, false);
          return;
        }
        if (nextIdx >= 0) {
          e.preventDefault();
          buttons[nextIdx].focus();
          selectIndex(nextIdx, false);
        }
      });

      buttons.push(btn);
      root.appendChild(btn);
    });

    selectedIdx = findIndex(opts.value);
    if (selectedIdx >= 0) curVal = options[selectedIdx].value;
    syncUI(false);
    // The root is measured only once it is in the DOM and laid out (e.g. inside a sheet that opens
    // later), so re-place the pill without animation whenever its size changes.
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(function() { indPos = null; placeInd(false); }).observe(root);
    }

    root.getValue = function() {
      return curVal;
    };

    root.setValue = function(nextVal, silent) {
      var idx = findIndex(nextVal);
      if (idx >= 0) {
        selectIndex(idx, !!silent);
      } else {
        var changed = curVal !== nextVal;
        selectedIdx = -1;
        curVal = nextVal;
        syncUI(false);
        if (!silent && changed && onChange) {
          onChange(curVal);
        }
      }
    };

    return root;
  }

  window.GNUI.segmented = createSegmented;
})();
