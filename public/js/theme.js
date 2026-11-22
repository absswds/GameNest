(function(root) {
  var KEY = 'gn_theme';
  var BG = { light: '#f4f4f2', dark: '#0f1012' };
  var mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;

  function readPref() {
    try {
      var v = root.localStorage && root.localStorage.getItem(KEY);
      if (v === 'light' || v === 'dark' || v === 'auto') return v;
    } catch (e) {}
    return 'auto';
  }

  function writePref(v) {
    try {
      if (root.localStorage) root.localStorage.setItem(KEY, v);
    } catch (e) {}
  }

  function resolve(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return (mq && mq.matches) ? 'dark' : 'light';
  }

  function setThemeColor(theme) {
    var color = BG[theme] || BG.light;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta && document.head) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    if (meta) meta.setAttribute('content', color);
  }

  function apply(pref) {
    var theme = resolve(pref);
    document.documentElement.dataset.theme = theme;
    setThemeColor(theme);
    try {
      root.dispatchEvent(new CustomEvent('gnthemechange', { detail: { theme: theme, preference: pref } }));
    } catch (e) {}
    return theme;
  }

  apply(readPref());

  if (mq) {
    var onMediaChange = function() {
      if (readPref() === 'auto') {
        apply('auto');
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onMediaChange);
    else if (mq.addListener) mq.addListener(onMediaChange);
  }

  root.GNTheme = {
    get: function() {
      return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    },
    set: function(mode) {
      var pref = (mode === 'light' || mode === 'dark' || mode === 'auto') ? mode : 'auto';
      writePref(pref);
      return apply(pref);
    },
    toggle: function() {
      var next = this.get() === 'dark' ? 'light' : 'dark';
      return this.set(next);
    }
  };
})(window);
