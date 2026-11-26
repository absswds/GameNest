// public/js/ui/slider-steps.js
(function() {
  window.GNUI = window.GNUI || {};

  function defaultFormat(v) {
    return '$' + v;
  }

  function createSliderSteps(opts) {
    opts = opts || {};
    var min = opts.min !== undefined ? Number(opts.min) : 0;
    var max = opts.max !== undefined ? Number(opts.max) : 100;
    var step = opts.step !== undefined && Number(opts.step) > 0 ? Number(opts.step) : 1;
    var formatValue = typeof opts.formatValue === 'function' ? opts.formatValue : defaultFormat;
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
    var presets = Array.isArray(opts.presets) ? opts.presets.slice() : [];

    var root = document.createElement('div');
    root.className = 'ui-ss';
    if (opts.id) root.id = opts.id;

    var head = document.createElement('div');
    head.className = 'ui-ss-head';

    var labelEl = null;
    if (opts.label) {
      labelEl = document.createElement('span');
      labelEl.className = 'ui-ss-label';
      labelEl.textContent = String(opts.label);
      head.appendChild(labelEl);
    }

    var outputEl = document.createElement('output');
    outputEl.className = 'ui-ss-val';
    head.appendChild(outputEl);
    root.appendChild(head);

    var row = document.createElement('div');
    row.className = 'ui-ss-row';

    var decBtn = document.createElement('button');
    decBtn.type = 'button';
    decBtn.className = 'ui-ss-btn ui-ss-dec';
    decBtn.setAttribute('aria-label', '-');
    decBtn.textContent = '−';

    var range = document.createElement('input');
    range.type = 'range';
    range.className = 'ui-ss-range';
    range.step = '1';
    if (opts.label) range.setAttribute('aria-label', String(opts.label));

    var incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.className = 'ui-ss-btn ui-ss-inc';
    incBtn.setAttribute('aria-label', '+');
    incBtn.textContent = '+';

    row.appendChild(decBtn);
    row.appendChild(range);
    row.appendChild(incBtn);
    root.appendChild(row);

    var presetsRow = document.createElement('div');
    presetsRow.className = 'ui-ss-presets';
    presetsRow.hidden = true;
    root.appendChild(presetsRow);

    var presetButtons = [];
    var curVal = min;

    function clamp(v) {
      var n = Number(v);
      if (isNaN(n)) n = min;
      if (min >= max) return min;
      return Math.min(max, Math.max(min, n));
    }

    function snapRaw(raw) {
      if (min >= max) return min;
      var n = clamp(raw);
      if (n >= max - step / 2) return max;
      var snapped = min + Math.round((n - min) / step) * step;
      return clamp(snapped);
    }

    function syncPresetActive() {
      for (var i = 0; i < presetButtons.length; i++) {
        var entry = presetButtons[i];
        var target = clamp(entry.preset.value);
        entry.btn.classList.toggle('is-active', !entry.btn.disabled && curVal === target);
      }
    }

    function syncUI(syncRangeValue) {
      var locked = min >= max;
      range.min = String(min);
      range.max = String(locked ? min : max);
      range.step = '1';
      range.setAttribute('aria-valuemin', String(min));
      range.setAttribute('aria-valuemax', String(locked ? min : max));
      range.setAttribute('aria-valuenow', String(curVal));
      range.disabled = locked;
      if (syncRangeValue) {
        range.value = String(curVal);
      }
      outputEl.textContent = formatValue(curVal);
      decBtn.disabled = locked || curVal <= min;
      incBtn.disabled = locked || curVal >= max;
      syncPresetActive();
    }

    function buildPresets() {
      presetsRow.innerHTML = '';
      presetButtons = [];
      if (!presets || presets.length === 0) {
        presetsRow.hidden = true;
        return;
      }
      presetsRow.hidden = false;
      var locked = min >= max;
      presets.forEach(function(p) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ui-ss-preset';
        btn.textContent = p.label != null ? String(p.label) : formatValue(clamp(p.value));
        btn.disabled = !!p.disabled || locked;
        btn.addEventListener('click', function() {
          if (btn.disabled) return;
          setValue(clamp(p.value), false);
        });
        presetButtons.push({ btn: btn, preset: p });
        presetsRow.appendChild(btn);
      });
      syncPresetActive();
    }

    function setValue(v, silent, keepRangeRaw) {
      var prev = curVal;
      curVal = clamp(v);
      syncUI(!keepRangeRaw);
      if (!silent && curVal !== prev && onChange) {
        onChange(curVal);
      }
    }

    range.addEventListener('input', function() {
      var snapped = snapRaw(range.value);
      setValue(snapped, false, true);
    });

    range.addEventListener('change', function() {
      range.value = String(curVal);
    });

    decBtn.addEventListener('click', function() {
      if (min >= max) return;
      setValue(Math.max(min, curVal - step), false);
    });

    incBtn.addEventListener('click', function() {
      if (min >= max) return;
      setValue(Math.min(max, curVal + step), false);
    });

    curVal = clamp(opts.value !== undefined ? opts.value : min);
    buildPresets();
    syncUI(true);

    root.getValue = function() {
      return curVal;
    };

    root.setValue = function(v, silent) {
      setValue(v, !!silent, false);
    };

    root.setBounds = function(next) {
      next = next || {};
      if (next.min !== undefined) min = Number(next.min);
      if (next.max !== undefined) max = Number(next.max);
      if (next.step !== undefined && Number(next.step) > 0) step = Number(next.step);
      if ('presets' in next) {
        presets = Array.isArray(next.presets) ? next.presets.slice() : [];
      }
      curVal = clamp('value' in next ? next.value : curVal);
      buildPresets();
      syncUI(true);
    };

    return root;
  }

  window.GNUI.sliderSteps = createSliderSteps;
})();
