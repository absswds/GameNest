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

    function syncUI() {
      for (var i = 0; i < buttons.length; i++) {
        var isSel = i === selectedIdx;
        buttons[i].classList.toggle('is-selected', isSel);
        buttons[i].setAttribute('aria-checked', isSel ? 'true' : 'false');
        buttons[i].tabIndex = isSel || (selectedIdx === -1 && i === 0) ? 0 : -1;
      }
    }

    function selectIndex(idx, silent) {
      if (idx < 0 || idx >= options.length) return;
      var changed = idx !== selectedIdx;
      selectedIdx = idx;
      curVal = options[idx].value;
      syncUI();
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
    syncUI();

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
        syncUI();
        if (!silent && changed && onChange) {
          onChange(curVal);
        }
      }
    };

    return root;
  }

  window.GNUI.segmented = createSegmented;
})();
