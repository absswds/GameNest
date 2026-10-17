// public/js/session-store.js
// Resume credentials (roomId / resumeToken / playerIndex / game) live in localStorage with a saved-at
// timestamp so a closed tab or browser can resume the seat; they expire after 10 minutes.
// They are mirrored into sessionStorage because the renderers read playerIndex / roomId from there.
// Also remembers the player's name and avatar (gn_name / gn_avatar).
(function(root) {
  var KEY = 'gn_session';
  var TTL = 10 * 60 * 1000;
  var FIELDS = ['roomId', 'resumeToken', 'playerIndex', 'game'];
  var lastTouch = 0;

  function ls() { try { return root.localStorage; } catch (e) { return null; } }
  function ss() { try { return root.sessionStorage; } catch (e) { return null; } }

  function mirror(data) {
    var s = ss();
    if (!s) return;
    try {
      FIELDS.forEach(function(k) {
        if (data && data[k] != null && k !== 'resumeToken') s.setItem(k, String(data[k]));
        else s.removeItem(k);
      });
    } catch (e) {}
  }

  function read() {
    var l = ls();
    if (!l) return null;
    try {
      var d = JSON.parse(l.getItem(KEY));
      return d && typeof d === 'object' ? d : null;
    } catch (e) { return null; }
  }

  function write(d) {
    var l = ls();
    if (!l) return;
    try { l.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  var api = {
    TTL: TTL,
    // Returns { roomId, resumeToken, playerIndex, game } or null (expired data is cleared).
    get: function(now) {
      var d = read();
      if (!d) return null;
      if (typeof d.savedAt !== 'number' || (now || Date.now()) - d.savedAt > TTL) { api.clear(); return null; }
      mirror(d);
      return d;
    },
    set: function(fields) {
      var d = read() || {};
      FIELDS.forEach(function(k) { if (fields && fields[k] != null) d[k] = fields[k]; });
      d.savedAt = Date.now();
      write(d);
      mirror(d);
    },
    // Refresh the timestamp so a long game does not expire the seat; throttled to one write per 30s.
    touch: function() {
      var n = Date.now();
      if (n - lastTouch < 30000) return;
      lastTouch = n;
      var d = read();
      if (!d) return;
      d.savedAt = n;
      write(d);
    },
    clear: function() {
      var l = ls();
      if (l) { try { l.removeItem(KEY); } catch (e) {} }
      mirror(null);
    },
    // name 1-8 chars after trim, avatar 1-4 chars (mirrors the server's set_name / set_avatar rules)
    validName: function(v) { return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 8 ? v.trim() : null; },
    validAvatar: function(v) { return typeof v === 'string' && v.length > 0 && v.length <= 4 ? v : null; },
    getProfile: function() {
      var l = ls(), name = null, avatar = null;
      if (l) {
        try { name = api.validName(l.getItem('gn_name')); } catch (e) {}
        try { avatar = api.validAvatar(l.getItem('gn_avatar')); } catch (e) {}
      }
      return { name: name, avatar: avatar };
    },
    saveName: function(v) {
      var n = api.validName(v), l = ls();
      if (n && l) { try { l.setItem('gn_name', n); } catch (e) {} }
    },
    saveAvatar: function(v) {
      var a = api.validAvatar(v), l = ls();
      if (a && l) { try { l.setItem('gn_avatar', a); } catch (e) {} }
    },
    // Send the remembered profile for a seat that was just created (still has the server defaults).
    sendProfile: function(ws) {
      var p = api.getProfile();
      try {
        if (p.name) ws.send(JSON.stringify({ type: 'set_name', data: { name: p.name } }));
        if (p.avatar) ws.send(JSON.stringify({ type: 'set_avatar', data: { avatar: p.avatar } }));
      } catch (e) {}
    }
  };

  root.GNSession = api;
})(typeof window !== 'undefined' ? window : globalThis);
