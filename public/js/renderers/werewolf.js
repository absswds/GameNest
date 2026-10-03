// public/js/renderers/werewolf.js
// 狼人杀 — the phone is the judge. Two layouts, picked by the room's talkMode:
//   face: seats round a table with a moon/sun dial in the middle; talk happens out loud.
//   chat: seats in two side columns, a chat feed in the middle, typing at the bottom.
// Night is a starry palette, day a warm one. The role card stays hidden until tapped.
(function() {
  function t(key) { return typeof _t === 'function' ? _t(key) : key; }
  function tf(key) { var args = Array.prototype.slice.call(arguments, 1); return String(t(key)).replace(/%s/g, function() { return args.shift(); }); }
  function esc(v) { return String(v).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var COLORS = ['#c06c5b', '#5b8bc0', '#6aa36f', '#b08a3e', '#8a6bc0', '#c05b8f', '#4fa3a5', '#a5734f', '#7a8c4f', '#c0875b', '#5b6ac0', '#9b5bc0'];
  var S = null, me = -1, sel = -1, showRole = false, timer = null, lastPhaseKey = '';
  var host = null, root = null, mode = '', phaseTotal = 0, prevAlive = null, prevDone = {}, seenChat = 0, seenLog = 0;

  function seat(i) { return tf('ww_seat', i + 1); }
  function who(i) { return i === me ? t('ww_you') : seat(i); }
  function pname(i) { return i === me ? t('ww_you') : window.getPlayerName(i); }
  function roleName(r) { return r ? t('ww_role_' + r) : ''; }
  function amAlive() { return S && S.alive[me]; }
  function isWolf(r) { return r === 'wolf'; }
  function isNight() { return S && (S.phase === 'night_wolf' || S.phase === 'night_witch'); }
  function chatMode() { return S && S.talkMode === 'chat'; }
  function $(r) { return root && root.querySelector('[data-r="' + r + '"]'); }

  function phaseKey() {
    if (!S) return '';
    if (S.phase === 'speech') return 'speech_' + S.speechKind;
    if (S.phase === 'vote') return 'vote_' + S.voteKind + (S.votePk && S.voteKind === 'exile' ? '_pk' : '');
    return S.phase;
  }

  // Which seats can be picked right now, given my role and the phase
  function targets() {
    if (!S || S.winner !== null) return [];
    var alive = S.alive.map(function(a, i) { return a ? i : -1; }).filter(function(i) { return i >= 0; });
    var ph = S.phase;
    if (ph === 'night_wolf' && S.myRole === 'wolf' && amAlive()) return alive;
    if (ph === 'night_wolf' && S.myRole === 'seer' && amAlive() && !S.seerDone) return alive.filter(function(i) { return i !== me; });
    if (ph === 'night_witch' && S.myRole === 'witch' && amAlive() && !S.witchDone && S.potions && S.potions.poison) return alive.filter(function(i) { return i !== me; });
    if (ph === 'vote' && S.voters.indexOf(me) >= 0 && S.votes[me] === undefined) return S.voteCandidates.filter(function(i) { return i !== me; });
    if (ph === 'hunter' && S.actor === me) return alive.filter(function(i) { return i !== me; });
    if (ph === 'badge' && S.actor === me) return alive;
    return [];
  }

  // Mirrors games/werewolf.js chatChannel(): may I type now, and where does it go?
  function myChannel() {
    if (!chatMode() || S.winner !== null) return null;
    if (S.phase === 'speech') return S.speakers[S.speakerPos] === me ? 'all' : null;
    if (!amAlive()) return null;
    if (S.phase === 'discuss' || S.phase === 'vote') return 'all';
    if (S.phase === 'night_wolf' && S.myRole === 'wolf') return 'wolf';
    return null;
  }

  function send(data) { sel = -1; window.makeGameMove(data); }

  function btn(label, onclick, kind, disabled) {
    return '<button class="ww-btn' + (kind ? ' ' + kind : '') + '"' + (disabled ? ' disabled' : '') + ' onclick="' + onclick + '">' + label + '</button>';
  }

  // What I should do now, or what the table is waiting on: { hint, btns }
  function action() {
    var ph = S.phase, r = S.myRole, hint = '', btns = '';
    if (S.winner !== null) return { hint: '<b>' + t(S.winner === -2 ? 'ww_win_wolf' : 'ww_win_good') + '</b>', btns: '' };
    var speaker = ph === 'speech' ? S.speakers[S.speakerPos] : -1;
    if (!amAlive() && ph !== 'hunter' && ph !== 'badge' && speaker !== me) return { hint: t('ww_you_are_out'), btns: '' };
    if (ph === 'night_wolf') {
      if (r === 'wolf') {
        var mine = S.wolfVotes[me];
        hint = mine === undefined ? t('ww_pick_kill') : mine < 0 ? t('ww_kill_empty') : tf('ww_kill_picked', seat(mine));
        btns = btn(t('ww_kill'), 'window._wwAct(\'kill\')', 'danger', sel < 0) + btn(t('ww_no_kill'), 'window._wwAct(\'nokill\')', 'ghost');
      } else if (r === 'seer' && !S.seerDone) {
        hint = t('ww_pick_check');
        btns = btn(t('ww_check'), 'window._wwAct(\'check\')', 'primary', sel < 0);
      } else if (r === 'seer') {
        var c = S.checks[S.checks.length - 1];
        hint = '<span class="ww-check ' + (c.wolf ? 'bad' : 'good') + '">' + tf('ww_check_result', seat(c.target), t(c.wolf ? 'ww_bad' : 'ww_good')) + '</span>';
      } else hint = t('ww_close_eyes');
    } else if (ph === 'night_witch') {
      if (r === 'witch' && !S.witchDone) {
        hint = !S.potions.save ? t('ww_witch_unknown') : S.knife >= 0 ? tf('ww_witch_knife', who(S.knife)) : t('ww_witch_peace');
        var canSave = S.potions.save && S.knife >= 0 && S.knife !== me;
        if (S.potions.save && S.knife === me) hint += ' · ' + t('ww_witch_self');
        if (canSave) btns += btn(t('ww_save'), 'window._wwAct(\'save\')', 'primary');
        if (S.potions.poison) btns += btn(t('ww_poison'), 'window._wwAct(\'poison\')', 'danger', sel < 0);
        btns += btn(t('ww_no_potion'), 'window._wwAct(\'skip\')', 'ghost');
      } else hint = t('ww_close_eyes');
    } else if (ph === 'dawn') {
      hint = '<b>' + (S.lastNight.length ? tf('ww_dawn_deaths', S.lastNight.map(who).join('、')) : t('ww_dawn_peace')) + '</b>';
    } else if (ph === 'sheriff_sign') {
      if (S.runs[me] === undefined) {
        hint = t('ww_sign_q');
        btns = btn(t('ww_run'), 'window._wwAct(\'run\')', 'primary') + btn(t('ww_no_run'), 'window._wwAct(\'norun\')', 'ghost');
      } else hint = t('ww_answered');
    } else if (ph === 'speech') {
      if (speaker === me) {
        hint = '<b>' + t(chatMode() ? (S.speechKind === 'last' ? 'ww_your_last_words_chat' : 'ww_your_speech_chat') : (S.speechKind === 'last' ? 'ww_your_last_words' : 'ww_your_speech')) + '</b>';
        btns = btn(t('ww_end_speech'), 'window._wwAct(\'end\')', 'primary');
      } else {
        var rest = S.speakers.slice(S.speakerPos + 1).map(function(i) { return i === me ? t('ww_you') : tf('ww_seat', i + 1); });
        hint = '<b>' + tf('ww_speaking', seat(speaker)) + '</b>' + (rest.length ? '<small>' + tf('ww_next_speakers', rest.join(' → ')) + '</small>' : '');
      }
    } else if (ph === 'discuss') {
      var ready = Object.keys(S.ready || {}).length, total = S.alive.filter(Boolean).length;
      hint = '<b>' + t(chatMode() ? 'ww_discuss_hint_chat' : 'ww_discuss_hint') + '</b><small>' + tf('ww_ready_n', ready, total) + '</small>';
      btns = S.ready && S.ready[me] ? '' : btn(t('ww_ready'), 'window._wwAct(\'ready\')', 'primary');
      if (S.ready && S.ready[me]) hint += '<small>' + t('ww_ready_done') + '</small>';
    } else if (ph === 'vote') {
      if (S.voters.indexOf(me) < 0) hint = t('ww_cannot_vote');
      else if (S.votes[me] !== undefined) hint = t('ww_voted');
      else {
        hint = '<b>' + t(S.voteKind === 'sheriff' ? 'ww_pick_sheriff' : 'ww_pick_vote') + '</b>';
        btns = btn(t('ww_vote'), 'window._wwAct(\'vote\')', 'danger', sel < 0) + btn(t('ww_abstain'), 'window._wwAct(\'abstain\')', 'ghost');
      }
    } else if (ph === 'hunter' || ph === 'badge') {
      if (S.actor === me) {
        hint = '<b>' + t(ph === 'hunter' ? 'ww_pick_shoot' : 'ww_pick_badge') + '</b>';
        btns = ph === 'hunter'
          ? btn(t('ww_shoot'), 'window._wwAct(\'shoot\')', 'danger', sel < 0) + btn(t('ww_no_shoot'), 'window._wwAct(\'noshoot\')', 'ghost')
          : btn(t('ww_pass_badge'), 'window._wwAct(\'badge\')', 'primary', sel < 0) + btn(t('ww_tear_badge'), 'window._wwAct(\'tear\')', 'ghost');
      } else hint = tf(ph === 'hunter' ? 'ww_hunter_waiting' : 'ww_badge_waiting', seat(S.actor));
    }
    return { hint: hint, btns: btns };
  }

  // ---------- seats ----------
  function seatInfo(i) {
    var tg = targets(), speaker = S.phase === 'speech' ? S.speakers[S.speakerPos] : -1;
    var pending = S.phase === 'vote' ? S.votes : S.phase === 'sheriff_sign' ? S.runs : S.phase === 'discuss' ? S.ready : null;
    var checked = null;
    (S.checks || []).forEach(function(c) { if (c.target === i) checked = c.wolf; });
    var picks = 0;
    if (S.phase === 'night_wolf') Object.keys(S.wolfVotes || {}).forEach(function(k) { if (S.wolfVotes[k] === i) picks++; });
    var dead = !S.alive[i];
    var tags = [];
    if (S.sheriff === i) tags.push('<span class="t-gold">' + t('ww_sheriff') + '</span>');
    if (S.roles[i] && (i !== me || S.winner !== null)) tags.push('<span class="' + (isWolf(S.roles[i]) ? 't-wolf' : 't-plain') + '">' + roleName(S.roles[i]) + '</span>');
    if (checked !== null && !S.roles[i]) tags.push('<span class="' + (checked ? 't-bad' : 't-good') + '">' + t(checked ? 'ww_bad' : 'ww_good') + '</span>');
    if (dead) tags.push('<span class="t-out">' + t('ww_dead') + '</span>');
    return {
      cls: (dead ? ' dead' : '') + (prevAlive && prevAlive[i] && dead ? ' die' : '') + (i === me ? ' me' : '') + (i === speaker ? ' speaking' : '') +
        (tg.indexOf(i) >= 0 ? ' pickable' : '') + (i === sel ? ' sel' : ''),
      click: tg.indexOf(i) >= 0,
      corner: (picks ? '<span class="ww-picks">🎯' + picks + '</span>' : '') +
        (pending && pending[i] !== undefined ? '<span class="ww-done' + (prevDone[i] ? '' : ' pop') + '">✓</span>' : ''),
      tags: tags.join(''),
    };
  }

  function seatHtml(i, kind) {
    var s = seatInfo(i);
    var name = '<span class="ww-nm">' + esc(pname(i)) + '</span>';
    return '<button class="ww-seat ' + kind + s.cls + '" data-i="' + i + '" style="--c:' + COLORS[i % COLORS.length] + '"' +
      (s.click ? ' onclick="window._wwPick(' + i + ')"' : ' tabindex="-1"') + '>' +
      '<span class="ww-av">' + (i + 1) + s.corner + '</span>' +
      '<span class="ww-info">' + name + (s.tags ? '<span class="ww-tags">' + s.tags + '</span>' : '') + '</span></button>';
  }

  function placeRing() {
    var ring = $('ring');
    if (!ring) return;
    var w = ring.clientWidth, h = ring.clientHeight, n = S.n, mn = Math.min(w, h);
    var rx = 40, ry = 40;
    if (w > h) rx = Math.min(44, 40 * h / w * 1.25); else ry = Math.min(44, 40 * w / h * 1.6);
    ring.style.setProperty('--aw', Math.max(36, Math.min(72, mn * 0.13)) + 'px');
    ring.style.setProperty('--core', Math.max(104, Math.min(230, mn * 0.38)) + 'px');
    ring.querySelectorAll('.ww-seat').forEach(function(el) {
      var i = +el.dataset.i, a = Math.PI / 2 + (i - me) * 2 * Math.PI / n;
      el.style.left = (50 + rx * Math.cos(a)) + '%';
      el.style.top = (50 + ry * Math.sin(a)) + '%';
    });
  }

  // ---------- face layout pieces ----------
  function coreHtml() {
    var sub;
    if (S.winner !== null) sub = t(S.winner === -2 ? 'ww_win_wolf' : 'ww_win_good');
    else if (S.phase === 'speech') sub = tf('ww_speaking', seat(S.speakers[S.speakerPos]));
    else if (S.phase === 'vote') sub = tf('ww_voted_n', Object.keys(S.votes).length, S.voters.length);
    else if (S.phase === 'dawn') sub = S.lastNight.length ? tf('ww_dawn_deaths', S.lastNight.map(who).join('、')) : t('ww_dawn_peace');
    else if (S.phase === 'discuss') sub = tf('ww_ready_n', Object.keys(S.ready || {}).length, S.alive.filter(Boolean).length);
    else sub = t('ww_phase_' + phaseKey());
    return '<div class="ww-core"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="46"/><circle class="fg" id="wwArc" cx="50" cy="50" r="46"/></svg>' +
      '<div class="ww-orb"></div><div class="ww-sec" id="wwSec"></div><div class="ww-sub">' + sub + '</div></div>';
  }

  function roleCardHtml() {
    var r = S.myRole;
    if (!r) return '';
    var mates = r === 'wolf' ? S.roles.map(function(x, i) { return x === 'wolf' && i !== me ? seat(i) : null; }).filter(Boolean) : [];
    var open = showRole || S.winner !== null;
    return '<div class="in"><div class="b"><span class="moon">☾</span>' + t('ww_tap_reveal_short') + '</div>' +
      '<div class="f' + (isWolf(r) ? ' wolf' : '') + '"><span class="big">' + esc(roleName(r).charAt(0)) + '</span><span class="rn">' + roleName(r) + '</span>' +
      (mates.length ? '<span class="rd">' + tf('ww_teammates', mates.join('、')) + '</span>' : '') +
      (r === 'witch' && S.potions ? '<span class="rd">' + tf('ww_potions_left', t(S.potions.save ? 'ww_yes' : 'ww_no'), t(S.potions.poison ? 'ww_yes' : 'ww_no')) + '</span>' : '') +
      '</div></div>' + (open ? '' : '');
  }

  function logLine(e) {
    if (e.t === 'deaths') return e.list.length ? tf('ww_log_deaths', e.day, e.list.map(seat).join('、')) : tf('ww_log_peace', e.day);
    if (e.t === 'night') return tf('ww_log_night', e.night);
    if (e.t === 'dawn') return tf('ww_log_dawn', e.day) + ' · ' + t('ww_dawn_sheriff_first');
    if (e.t === 'sheriff') return tf('ww_log_sheriff', seat(e.who));
    if (e.t === 'no_sheriff') return t('ww_log_no_sheriff');
    if (e.t === 'exile') return tf('ww_log_exile', seat(e.who));
    if (e.t === 'no_exile') return t('ww_log_no_exile');
    if (e.t === 'idiot') return tf('ww_log_idiot', seat(e.who));
    if (e.t === 'shot') return tf('ww_log_shot', seat(e.by), seat(e.who));
    if (e.t === 'badge') return e.who >= 0 ? tf('ww_log_badge', seat(e.by), seat(e.who)) : tf('ww_log_badge_torn', seat(e.by));
    return '';
  }

  function voteHtml() {
    var lv = S.lastVote;
    if (!lv) return '';
    var byTarget = {};
    Object.keys(lv.votes).forEach(function(v) {
      var tgt = lv.votes[v], key = tgt < 0 ? 'x' : tgt;
      (byTarget[key] = byTarget[key] || []).push(+v + 1);
    });
    return '<div class="ww-vote"><div class="ww-vh">' + t(lv.kind === 'sheriff' ? 'ww_vote_detail_sheriff' : lv.pk ? 'ww_vote_detail_pk' : 'ww_vote_detail') + '</div>' +
      Object.keys(byTarget).map(function(k) {
        return '<div class="ww-vr"><b>' + (k === 'x' ? t('ww_abstained') : seat(+k)) + '</b>' + (k !== 'x' && lv.tally[k] ? '<em>' + lv.tally[k] + '</em>' : '') + '<span>← ' + byTarget[k].join(' ') + '</span></div>';
      }).join('') + '</div>';
  }

  function sideHtml() {
    var rows = (S.log || []).filter(function(e) { return e.t !== 'night'; }).map(logLine).filter(Boolean).reverse();
    var checks = (S.checks || []).map(function(c) { return '<li>' + tf('ww_check_result', seat(c.target), t(c.wolf ? 'ww_bad' : 'ww_good')) + '</li>'; }).join('');
    return '<h4>' + t('ww_log_title') + '</h4><ul>' + (rows.map(function(r) { return '<li>' + r + '</li>'; }).join('') || '<li class="muted">—</li>') + '</ul>' +
      (checks ? '<h4>' + t('ww_my_checks') + '</h4><ul>' + checks + '</ul>' : '') + voteHtml();
  }

  // ---------- chat layout pieces ----------
  function msgHtml(m, fresh) {
    var c = COLORS[m.p % COLORS.length];
    return '<div class="m' + (m.p === me ? ' me' : '') + (m.ch === 'wolf' ? ' wolf' : '') + (fresh ? ' new' : '') + '">' +
      '<span class="a" style="--c:' + c + '">' + (m.p + 1) + '</span><div class="b"><small>' + esc(tf('ww_seat', m.p + 1) + ' ' + pname(m.p)) +
      (m.ch === 'wolf' ? ' · ' + t('ww_ch_wolf') : '') + '</small>' + esc(m.text) + '</div></div>';
  }

  function sysHtml(e, fresh) {
    var big = e.t === 'night' || e.t === 'deaths' || e.t === 'dawn';
    // Day 1 with a sheriff election: dawn is announced first, the night's result only after the election
    var revealed = e.t === 'deaths' && (S.log || []).some(function(x) { return x.t === 'dawn' && x.day === e.day; });
    var result = e.t === 'deaths' ? (e.list.length ? tf('ww_dawn_deaths', e.list.map(seat).join('、')) : t('ww_dawn_peace')) : '';
    var txt = e.t === 'night' ? '🌙 ' + logLine(e)
      : e.t === 'dawn' ? '☀ ' + tf('ww_log_dawn', e.day) + ' · ' + t('ww_dawn_sheriff_first')
      : e.t === 'deaths' ? (revealed ? '📢 ' + t('ww_dawn_reveal') + ' · ' + result : '☀ ' + tf('ww_log_dawn', e.day) + ' · ' + result)
      : logLine(e);
    return '<div class="m sys' + (big ? ' big' : '') + (fresh ? ' new' : '') + '"><div class="b">' + txt + '</div></div>';
  }

  function feedHtml() {
    var log = S.log || [], chat = S.chat || [], out = '', ci = 0;
    var voteAt = -1;
    for (var k = log.length - 1; k >= 0; k--) if (/^(exile|no_exile|idiot|sheriff|no_sheriff)$/.test(log[k].t)) { voteAt = k; break; }
    for (k = 0; k <= log.length; k++) {
      while (ci < chat.length && chat[ci].at <= k) { out += msgHtml(chat[ci], ci >= seenChat); ci++; }
      if (k < log.length) {
        if (logLine(log[k])) out += sysHtml(log[k], k >= seenLog);
        if (k === voteAt && S.lastVote) out += '<div class="m sys"><div class="b wide">' + voteHtml() + '</div></div>';
      }
    }
    if (S.phase === 'speech' && S.winner === null) out += '<div class="ww-live">' + tf('ww_speaking', seat(S.speakers[S.speakerPos])) + '<i></i><i></i><i></i></div>';
    if (S.phase === 'discuss' && S.winner === null) out += '<div class="m sys"><div class="b">' + t('ww_phase_discuss') + '</div></div>';
    return out || '<div class="m sys"><div class="b">' + t('ww_close_eyes') + '</div></div>';
  }

  function quickHtml(ch) {
    if (!ch) return '';
    return String(t(ch === 'wolf' ? 'ww_quick_wolf' : 'ww_quick_day')).split('|').map(function(q) {
      return '<button onclick="window._wwQuick(this)">' + esc(q) + '</button>';
    }).join('');
  }

  // ---------- skeleton ----------
  function build() {
    mode = chatMode() ? 'chat' : 'face';
    if (mode === 'chat') {
      root.innerHTML = '<div class="ww wc"><div class="ww-head" data-r="head"></div>' +
        '<div class="wc-col l" data-r="L"></div><div class="wc-feed" data-r="feed"></div><div class="wc-col r" data-r="R"></div>' +
        '<div class="wc-bottom"><div class="ww-act" data-r="act"></div><div class="wc-quick" data-r="quick"></div>' +
          '<div class="wc-in"><button class="wc-role" data-r="role" onclick="window._wwToggleRole()"></button><span class="wc-ch" data-r="ch"></span>' +
          '<input id="wwChatIn" maxlength="120" autocomplete="off" enterkeyhint="send"><button class="wc-send" data-r="send" onclick="window._wwSend()">' + t('ww_send') + '</button></div>' +
          '<div data-r="tip"></div></div></div>';
      var input = document.getElementById('wwChatIn');
      input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); window._wwSend(); } });
    } else {
      root.innerHTML = '<div class="ww wf"><div class="ww-head" data-r="head"></div><div class="ww-ring" data-r="ring"></div>' +
        '<div class="ww-bottom"><button class="ww-role" data-r="role" onclick="window._wwToggleRole()"></button><div class="ww-act" data-r="act"></div></div>' +
        '<div class="ww-side" data-r="side"></div></div>';
    }
  }

  function fit() {
    if (!host || !root) return;
    var f = window.boardFit ? window.boardFit(host) : { w: window.innerWidth - 32, h: window.innerHeight - 200 };
    root.style.width = Math.max(300, f.w) + 'px';
    // Short screens (phone held sideways): the page header eats too much, so the table takes the
    // whole viewport height and the page scrolls it into view.
    var short = f.h < 440;
    root.style.height = (short ? window.innerHeight - 8 : Math.max(mode === 'chat' ? 520 : 480, Math.min(f.h, 1100))) + 'px';
    if (short && root.getBoundingClientRect().top > 4) root.scrollIntoView({ block: 'end' });
    if (mode === 'face') placeRing();
  }

  function draw() {
    if (!root || !S || !S.alive) return;
    if ((chatMode() ? 'chat' : 'face') !== mode) { build(); fit(); }
    var night = isNight(), ww = root.firstChild;
    var wasNight = ww.classList.contains('night');
    ww.classList.toggle('night', night);
    if (wasNight !== night) { ww.classList.remove('swap'); void ww.offsetWidth; ww.classList.add('swap'); }

    var when = S.winner !== null ? '' : night ? tf('ww_night_n', S.night) : tf('ww_day_n', S.day);
    $('head').innerHTML = '<div><div class="ww-when">' + when + '</div><div class="ww-title">' + t('ww_phase_' + phaseKey()) + '</div></div>' +
      '<div class="ww-timer" id="wwTimer"><i></i><span id="wwTimerTxt"></span></div>';

    var a = action();
    $('act').innerHTML = '<div class="ww-hint">' + a.hint + '</div>' + (a.btns ? '<div class="ww-btns">' + a.btns + '</div>' : '');
    var roleBtn = $('role');
    if (mode === 'chat') {
      var half = Math.ceil(S.n / 2), L = '', R = '';
      for (var i = 0; i < S.n; i++) (i < half ? (L += seatHtml(i, 'col')) : (R += seatHtml(i, 'col')));
      $('L').innerHTML = L;
      $('R').innerHTML = R;
      var feed = $('feed'), atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
      feed.innerHTML = feedHtml();
      if (atBottom || (S.chat || []).length > seenChat && (S.chat[S.chat.length - 1] || {}).p === me) feed.scrollTop = feed.scrollHeight;
      var ch = myChannel(), input = document.getElementById('wwChatIn');
      var chEl = $('ch');
      chEl.className = 'wc-ch' + (ch === 'wolf' ? ' wolf' : S.phase === 'speech' ? ' live' : '');
      chEl.textContent = ch === 'wolf' ? t('ww_ch_wolf') : S.phase === 'speech' && S.winner === null ? tf('ww_ch_live', S.speakers[S.speakerPos] + 1) : night ? t('ww_ch_night') : t('ww_ch_all');
      var ph = ch === 'wolf' ? 'ww_chat_ph_wolf' : ch ? (S.phase === 'speech' ? 'ww_chat_ph_speaker' : S.phase === 'vote' ? 'ww_chat_ph_vote' : 'ww_chat_ph_free')
        : !amAlive() && S.winner === null ? 'ww_chat_ph_dead' : night ? 'ww_chat_ph_night' : S.phase === 'speech' ? 'ww_chat_ph_wait' : 'ww_chat_ph_closed';
      input.placeholder = t(ph);
      input.disabled = !ch;
      $('send').disabled = !ch;
      $('quick').innerHTML = quickHtml(ch);
      roleBtn.className = 'wc-role' + (showRole ? ' open' + (isWolf(S.myRole) ? ' wolf' : '') : '');
      roleBtn.textContent = showRole && S.myRole ? roleName(S.myRole).charAt(0) : '?';
      $('tip').innerHTML = showRole && S.myRole ? '<div class="wc-tip">' + roleCardHtml() + '</div>' : '';
      seenChat = (S.chat || []).length;
      seenLog = (S.log || []).length;
    } else {
      var seats = '';
      for (var j = 0; j < S.n; j++) seats += seatHtml(j, 'ring');
      $('ring').innerHTML = seats + coreHtml();
      placeRing();
      roleBtn.className = 'ww-role' + (showRole || S.winner !== null ? ' open' : '');
      roleBtn.innerHTML = roleCardHtml();
      $('side').innerHTML = sideHtml();
    }
    // remember what was already shown, so only fresh changes animate
    prevAlive = S.alive.slice();
    prevDone = {};
    var pend = S.phase === 'vote' ? S.votes : S.phase === 'sheriff_sign' ? S.runs : S.phase === 'discuss' ? S.ready : null;
    if (pend) Object.keys(pend).forEach(function(k) { prevDone[k] = true; });
    tick();
  }

  function tick() {
    if (!root || !S) return;
    var left = S.winner === null && S.deadline ? Math.max(0, (S.deadline - Date.now()) / 1000) : 0;
    var sec = Math.ceil(left);
    var tm = document.getElementById('wwTimer'), txt = document.getElementById('wwTimerTxt');
    if (txt) txt.textContent = sec ? sec + 's' : '';
    if (tm) { tm.classList.toggle('on', sec > 0); tm.classList.toggle('urgent', sec > 0 && sec <= 5); }
    var secEl = document.getElementById('wwSec');
    if (secEl) secEl.textContent = sec ? sec : '';
    var arc = document.getElementById('wwArc');
    if (arc) {
      var frac = phaseTotal > 0 ? Math.max(0, Math.min(1, left / phaseTotal)) : 0;
      arc.style.strokeDashoffset = String(289 * (1 - frac));
      arc.classList.toggle('urgent', sec > 0 && sec <= 5);
    }
  }

  // ---------- actions ----------
  window._wwPick = function(i) { sel = sel === i ? -1 : i; draw(); };
  window._wwToggleRole = function() { showRole = !showRole; draw(); };
  window._wwAct = function(a) {
    var map = {
      kill: { type: 'kill', target: sel }, nokill: { type: 'kill', target: -1 },
      check: { type: 'check', target: sel },
      save: { type: 'witch', save: true }, poison: { type: 'witch', poison: sel }, skip: { type: 'witch' },
      run: { type: 'run', run: true }, norun: { type: 'run', run: false },
      end: { type: 'end_speech' }, ready: { type: 'ready' },
      vote: { type: 'vote', target: sel }, abstain: { type: 'vote', target: -1 },
      shoot: { type: 'shoot', target: sel }, noshoot: { type: 'shoot', target: -1 },
      badge: { type: 'badge', target: sel }, tear: { type: 'badge', target: -1 },
    };
    if (map[a]) send(map[a]);
  };
  window._wwSend = function(text) {
    var input = document.getElementById('wwChatIn');
    var v = (text !== undefined ? text : input && input.value || '').trim();
    var ch = myChannel();
    if (!v || !ch) return;
    window.makeGameMove({ type: 'chat', text: v.slice(0, 120), ch: ch });
    if (input && text === undefined) input.value = '';
  };
  window._wwQuick = function(el) { window._wwSend(el.textContent); };

  var CSS = '' +
    '.ww-root{position:relative;container-type:size;container-name:ww;margin:0 auto;border-radius:18px;overflow:hidden;max-width:100%}' +
    '.ww{--gold:#e2c27a;--red:#e0574a;--green:#5cc98a;--ink:#3a2a18;--muted:#8a7154;--card:rgba(255,255,255,.55);--line:rgba(90,60,30,.18);' +
      'position:absolute;inset:0;display:grid;color:var(--ink);overflow:hidden;font-family:inherit;' +
      'background:radial-gradient(ellipse 80% 60% at 50% 40%,#fff6df 0%,#f3dcb0 60%,#e2bd86 100%);transition:color .6s}' +
    '.ww::before,.ww::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .9s cubic-bezier(.2,.8,.2,1);z-index:0}' +
    '.ww::before{background:radial-gradient(ellipse 70% 50% at 50% 40%,#2a3566 0%,#161c3a 45%,#0a0d1e 100%)}' +
    '.ww::after{background-image:radial-gradient(1px 1px at 12% 18%,#fff,transparent),radial-gradient(1px 1px at 72% 12%,#fff,transparent),radial-gradient(1.5px 1.5px at 85% 40%,#fff,transparent),radial-gradient(1px 1px at 30% 70%,#fff,transparent),radial-gradient(1px 1px at 55% 88%,#fff,transparent),radial-gradient(1.5px 1.5px at 20% 45%,#fff,transparent),radial-gradient(1px 1px at 92% 78%,#fff,transparent),radial-gradient(1px 1px at 45% 25%,#fff,transparent),radial-gradient(1px 1px at 64% 58%,#fff,transparent)}' +
    '.ww.night{--gold:#e2c27a;--red:#e0675c;--green:#7cc08b;--ink:#eef0f7;--muted:#9aa3bd;--card:rgba(255,255,255,.07);--line:rgba(255,255,255,.14)}' +
    '.ww.night::before{opacity:1}.ww.night::after{opacity:.85;animation:ww-tw 4s ease-in-out infinite alternate}' +
    '@keyframes ww-tw{to{opacity:.4}}' +
    '.ww>*{position:relative;z-index:1;min-width:0;min-height:0}' +
    '.ww-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px 6px}' +
    '.ww-when{font-size:12px;color:var(--muted);letter-spacing:.12em}' +
    '.ww-title{font-size:20px;font-weight:700;line-height:1.25}' +
    '.ww-timer{display:flex;align-items:center;gap:6px;font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;opacity:0}' +
    '.ww-timer.on{opacity:1}.ww-timer i{width:10px;height:10px;border-radius:50%;background:var(--gold);box-shadow:0 0 10px var(--gold)}' +
    '.ww-timer.urgent{color:var(--red)}.ww-timer.urgent i{background:var(--red);box-shadow:0 0 10px var(--red);animation:ww-blink .5s infinite alternate}' +
    '@keyframes ww-blink{to{opacity:.3}}' +
    /* seats (shared) */
    '.ww-seat{all:unset;box-sizing:border-box;position:relative;display:flex;align-items:center;cursor:default;-webkit-tap-highlight-color:transparent}' +
    '.ww-av{position:relative;flex:none;border-radius:50%;background:var(--c);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;' +
      'box-shadow:0 0 0 2px rgba(255,255,255,.9),0 6px 14px rgba(120,80,30,.22);transition:box-shadow .25s,filter .4s,background .4s}' +
    '.ww.night .ww-av{box-shadow:0 0 0 2px rgba(255,255,255,.18),0 6px 14px rgba(0,0,0,.35)}' +
    '.ww-info{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0}' +
    '.ww-nm{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}' +
    '.ww-tags{display:flex;flex-wrap:wrap;gap:2px;justify-content:center}' +
    '.ww-tags span{font-size:10px;font-weight:700;line-height:15px;padding:0 5px;border-radius:8px;white-space:nowrap}' +
    '.t-gold{background:var(--gold);color:#2a1d0a}.t-good{background:var(--green);color:#fff}.t-bad,.t-out{background:var(--red);color:#fff}' +
    '.t-wolf{background:#7a1f2c;color:#ffd0d0}.t-plain{background:var(--card);border:1px solid var(--line)}' +
    '.ww-done{position:absolute;top:-3px;left:-5px;width:17px;height:17px;border-radius:50%;background:var(--green);color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px rgba(255,255,255,.7)}' +
    '.ww-done.pop{animation:ww-pop .32s cubic-bezier(.2,.8,.2,1)}' +
    '.ww-picks{position:absolute;top:-5px;right:-12px;font-size:10px;font-weight:800;padding:0 5px;border-radius:8px;background:var(--red);color:#fff;white-space:nowrap}' +
    '@keyframes ww-pop{from{transform:scale(.3);opacity:0}70%{transform:scale(1.2)}}' +
    '.ww-seat.me .ww-av{box-shadow:0 0 0 3px var(--gold),0 6px 14px rgba(0,0,0,.3)}' +
    '.ww-seat.pickable{cursor:pointer}' +
    '.ww-seat.pickable .ww-av{animation:ww-pulse 1.8s ease-in-out infinite}' +
    '@keyframes ww-pulse{50%{box-shadow:0 0 0 5px rgba(226,194,122,.45),0 6px 14px rgba(0,0,0,.3)}}' +
    '.ww-seat.sel .ww-av{animation:none;box-shadow:0 0 0 3px var(--red),0 0 22px 4px rgba(224,87,74,.55)}' +
    '.ww-seat.sel .ww-av::before{content:"";position:absolute;inset:-8px;border:2px dashed var(--red);border-radius:50%;animation:ww-spin 6s linear infinite}' +
    '@keyframes ww-spin{to{transform:rotate(360deg)}}' +
    '.ww-seat.speaking .ww-av{box-shadow:0 0 0 3px var(--gold),0 0 22px 6px rgba(226,194,122,.55)}' +
    '.ww-seat.speaking .ww-av::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid var(--gold);animation:ww-wave 1.4s ease-out infinite}' +
    '@keyframes ww-wave{from{transform:scale(1);opacity:.9}to{transform:scale(1.5);opacity:0}}' +
    '.ww-seat.dead .ww-av{background:#55585f;color:rgba(255,255,255,.35);box-shadow:none;opacity:.8}' +
    '.ww-seat.dead .ww-av::after{content:"";position:absolute;inset:14%;animation:none;border:0;' +
      'background:linear-gradient(45deg,transparent 44%,#e0574a 44% 56%,transparent 56%),linear-gradient(-45deg,transparent 44%,#e0574a 44% 56%,transparent 56%)}' +
    '.ww-seat.dead .ww-nm{opacity:.45}' +
    '.ww-seat.die .ww-av{animation:ww-die .9s cubic-bezier(.2,.8,.2,1)}' +
    '.ww-seat.die .ww-av::after{animation:ww-x .5s .35s cubic-bezier(.2,.8,.2,1) both}' +
    '@keyframes ww-die{0%{transform:scale(1);filter:none;background:var(--c)}25%{transform:scale(1.15) rotate(-6deg)}50%{transform:scale(.92) rotate(4deg)}100%{transform:none}}' +
    '@keyframes ww-x{from{transform:scale(2.2);opacity:0}}' +
    /* buttons & hint */
    '.ww-act{display:flex;flex-direction:column;justify-content:center;gap:8px;min-width:0}' +
    '.ww-hint{font-size:14px;line-height:1.45}.ww-hint b{font-size:15px}.ww-hint small{display:block;font-size:12px;color:var(--muted);margin-top:2px}' +
    '.ww-check.good{color:var(--green);font-weight:700}.ww-check.bad{color:var(--red);font-weight:700}' +
    '.ww-btns{display:flex;flex-wrap:wrap;gap:8px}' +
    '.ww-btn{min-height:42px;padding:0 18px;border-radius:21px;border:1px solid var(--line);background:transparent;color:var(--ink);font:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:transform .12s,opacity .2s,background .2s}' +
    '.ww-btn:active{transform:scale(.96)}.ww-btn:disabled{opacity:.4;cursor:default}' +
    '.ww-btn.primary{background:var(--gold);border-color:var(--gold);color:#22180a}' +
    '.ww-btn.danger{background:var(--red);border-color:var(--red);color:#fff}' +
    /* ---------- face layout ---------- */
    '.wf{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto}' +
    '.ww-ring{--aw:56px;--core:160px}' +
    '.ww-seat.ring{position:absolute;transform:translate(-50%,-50%);flex-direction:column;gap:3px;width:calc(var(--aw) + 26px);transition:left .4s cubic-bezier(.2,.8,.2,1),top .4s cubic-bezier(.2,.8,.2,1),transform .2s}' +
    '.ww-seat.ring .ww-av{width:var(--aw);height:var(--aw);font-size:calc(var(--aw) * .42)}' +
    '.ww-seat.ring.sel{transform:translate(-50%,-50%) scale(1.08)}' +
    '.ww-core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:var(--core);aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:2px}' +
    '.ww-core svg{position:absolute;inset:0;transform:rotate(-90deg)}' +
    '.ww-core circle{fill:none;stroke-width:3.5}.ww-core .bg{stroke:var(--line)}' +
    '.ww-core .fg{stroke:var(--gold);stroke-linecap:round;stroke-dasharray:289;stroke-dashoffset:289;transition:stroke-dashoffset .5s linear,stroke .3s}' +
    '.ww-core .fg.urgent{stroke:var(--red)}' +
    '.ww-orb{width:36%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#fff3c4,#f5b942 60%,#e08a1e);box-shadow:0 0 50px 16px rgba(245,185,66,.45);transition:background .8s,box-shadow .8s}' +
    '.ww.night .ww-orb{background:radial-gradient(circle at 35% 35%,#fffbe8,#e8dcae 55%,#b9ab78);box-shadow:0 0 40px 10px rgba(255,245,200,.22)}' +
    '.ww.swap .ww-orb{animation:ww-rise 1s cubic-bezier(.2,.8,.2,1)}' +
    '@keyframes ww-rise{from{transform:translateY(40%) scale(.6);opacity:0}}' +
    '.ww-sec{font-size:calc(var(--core) * .17);font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1;margin-top:4px;min-height:1.1em}' +
    '.ww-sub{font-size:12px;line-height:1.35;color:var(--muted);max-width:66%}' +
    '.ww-bottom{display:flex;gap:10px;align-items:stretch;padding:8px 12px 12px}' +
    '.ww-bottom .ww-act{flex:1;padding:10px 12px;border-radius:14px;background:var(--card);border:1px solid var(--line);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
    '.ww-role{all:unset;flex:none;width:clamp(74px,18cqmin,104px);aspect-ratio:3/4;perspective:600px;cursor:pointer}' +
    '.ww-role .in{position:relative;width:100%;height:100%;transition:transform .6s cubic-bezier(.2,.8,.2,1);transform-style:preserve-3d}' +
    '.ww-role.open .in{transform:rotateY(180deg)}' +
    '.ww-role .f,.ww-role .b{position:absolute;inset:0;border-radius:10px;-webkit-backface-visibility:hidden;backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:4px;box-sizing:border-box;box-shadow:0 6px 16px rgba(0,0,0,.35);text-align:center}' +
    '.ww-role .b{background:repeating-linear-gradient(45deg,#3b2b5a 0 6px,#33254f 6px 12px);border:2px solid #e2c27a;color:#e2c27a;font-size:11px;letter-spacing:.06em}' +
    '.ww-role .b .moon{font-size:26px}' +
    '.ww-role .f{transform:rotateY(180deg);background:linear-gradient(160deg,#2c3a75,#151b3a);border:2px solid #e2c27a;color:#f0e6c8}' +
    '.ww-role .f.wolf{background:linear-gradient(160deg,#7a1f2c,#2a0c12)}' +
    '.big{font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:clamp(30px,9cqmin,46px);color:#e2c27a;line-height:1}' +
    '.rn{font-size:13px;font-weight:700}.rd{font-size:10px;line-height:1.3;opacity:.8}' +
    '.ww-side{display:none}' +
    '.ww-vote{display:flex;flex-direction:column;gap:3px;font-size:13px}' +
    '.ww-vh{font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--muted)}' +
    '.ww-vr{display:flex;gap:8px;align-items:baseline}.ww-vr b{min-width:3em}.ww-vr em{font-style:normal;font-weight:800;color:var(--red)}.ww-vr span{color:var(--muted)}' +
    '@container ww (orientation:landscape) and (min-width:860px){' +
      '.wf{grid-template-columns:minmax(0,1fr) 280px;grid-template-rows:auto minmax(0,1fr) auto}' +
      '.wf .ww-head{grid-column:1/-1}.wf .ww-ring{grid-column:1;grid-row:2}.wf .ww-bottom{grid-column:1;grid-row:3}' +
      '.ww-side{display:flex;flex-direction:column;gap:8px;grid-column:2;grid-row:2/4;margin:4px 12px 12px 0;padding:12px 14px;border-radius:14px;background:var(--card);border:1px solid var(--line);overflow:auto;font-size:13px}' +
      '.ww-side h4{margin:0;font-size:11px;letter-spacing:.12em;color:var(--muted)}' +
      '.ww-side ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px}.ww-side .muted{color:var(--muted)}' +
    '}' +
    '@container ww (orientation:landscape) and (max-height:560px){' +
      '.wf{grid-template-columns:minmax(0,1fr) minmax(240px,36cqw);grid-template-rows:auto minmax(0,1fr)}' +
      '.wf .ww-head{grid-column:1/-1}.wf .ww-ring{grid-column:1;grid-row:2}' +
      '.wf .ww-bottom{grid-column:2;grid-row:2;flex-direction:column;padding-top:0}' +
      '.wf .ww-bottom .ww-act{flex:1}.ww-role{width:76px}.wf .ww-side{display:none}' +
    '}' +
    /* ---------- chat layout ---------- */
    '.wc{--col:70px;grid-template-columns:var(--col) minmax(0,1fr) var(--col);grid-template-rows:auto minmax(0,1fr) auto}' +
    '.wc .ww-head{grid-column:1/-1;border-bottom:1px solid var(--line);padding-bottom:8px}' +
    '.wc-col{display:flex;flex-direction:column;justify-content:space-evenly;padding:6px 3px;gap:2px}' +
    '.ww-seat.col{flex-direction:column;gap:2px;padding:4px 2px;border-radius:12px;transition:background .25s}' +
    '.ww-seat.col .ww-av{width:42px;height:42px;font-size:17px}' +
    '.ww-seat.col .ww-nm{font-size:11px;max-width:64px}' +
    '.ww-seat.col.speaking{background:rgba(226,194,122,.2)}.ww-seat.col.sel{background:rgba(224,87,74,.16)}' +
    '.wc-feed{overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:10px 6px;scrollbar-width:thin;overscroll-behavior:contain;' +
      '-webkit-mask-image:linear-gradient(transparent,#000 16px);mask-image:linear-gradient(transparent,#000 16px)}' +
    '.wc-feed>:first-child{margin-top:auto}' +
    '.m{display:flex;gap:6px;align-items:flex-start;max-width:100%}' +
    '.m.new{animation:ww-in .32s cubic-bezier(.2,.8,.2,1)}' +
    '@keyframes ww-in{from{transform:translateY(10px);opacity:0}}' +
    '.m .a{flex:none;width:24px;height:24px;border-radius:50%;background:var(--c);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center}' +
    '.m .b{min-width:0;padding:6px 10px;border-radius:4px 14px 14px 14px;background:var(--card);border:1px solid var(--line);font-size:14px;line-height:1.45;overflow-wrap:anywhere}' +
    '.m .b small{display:block;font-size:11px;color:var(--muted);margin-bottom:1px}' +
    '.m.me{flex-direction:row-reverse}' +
    '.m.me .b{border-radius:14px 4px 14px 14px;background:var(--gold);color:#22180a;border-color:transparent}.m.me .b small{color:rgba(34,24,10,.6)}' +
    '.m.wolf .b{background:rgba(160,30,45,.35);border-color:rgba(224,87,74,.45)}.m.wolf.me .b{background:#c4505a;color:#fff}.m.wolf.me .b small{color:rgba(255,255,255,.7)}' +
    '.m.sys{justify-content:center}' +
    '.m.sys .b{border-radius:12px;background:transparent;border:1px dashed var(--line);font-size:12px;color:var(--muted);text-align:center}' +
    '.m.sys .b.wide{width:100%;text-align:left;border-style:solid;background:var(--card)}' +
    '.m.sys.big .b{border-style:solid;font-size:13px;color:var(--ink);font-weight:700;background:var(--card)}' +
    '.m.sys.big.new .b{animation:ww-pop .45s cubic-bezier(.2,.8,.2,1)}' +
    '.ww-live{font-size:12px;color:var(--muted);text-align:center}' +
    '.ww-live i{display:inline-block;width:4px;height:4px;border-radius:50%;background:currentColor;margin-left:3px;animation:ww-blink .6s infinite alternate}' +
    '.ww-live i:nth-child(2){animation-delay:.2s}.ww-live i:nth-child(3){animation-delay:.4s}' +
    '.wc-bottom{grid-column:1/-1;display:flex;flex-direction:column;gap:8px;padding:8px 10px 10px;border-top:1px solid var(--line);background:rgba(255,250,238,.45)}' +
    '.ww.night .wc-bottom{background:rgba(0,0,0,.22)}' +
    '.wc-bottom .ww-act{flex-direction:row;flex-wrap:wrap;align-items:center}' +
    '.wc-bottom .ww-hint{flex:1;min-width:150px}.wc-bottom .ww-btn{min-height:38px;padding:0 16px;font-size:14px}' +
    '.wc-quick{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.wc-quick:empty{display:none}' +
    '.wc-quick button{all:unset;flex:none;font-size:12px;padding:0 10px;line-height:26px;border-radius:13px;border:1px solid var(--line);cursor:pointer;white-space:nowrap}' +
    '.wc-in{display:flex;gap:8px;align-items:center}' +
    '.wc-ch{flex:none;font-size:11px;font-weight:800;padding:0 8px;line-height:22px;border-radius:11px;background:var(--card);border:1px solid var(--line);color:var(--muted);white-space:nowrap}' +
    '.wc-ch.wolf{background:#7a1f2c;color:#ffd0d0;border-color:transparent}.wc-ch.live{background:var(--gold);color:#22180a;border-color:transparent}' +
    '#wwChatIn{flex:1;min-width:0;height:40px;box-sizing:border-box;border-radius:20px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:0 14px;font:inherit;font-size:16px;outline:none;transition:border-color .2s,opacity .2s}' +
    '#wwChatIn:focus{border-color:var(--gold)}#wwChatIn:disabled{opacity:.55}#wwChatIn::placeholder{color:var(--muted)}' +
    '.wc-send{all:unset;flex:none;height:40px;padding:0 16px;border-radius:20px;background:var(--gold);color:#22180a;font-weight:800;cursor:pointer;transition:opacity .2s,transform .12s}' +
    '.wc-send:active{transform:scale(.95)}.wc-send:disabled{opacity:.35;cursor:default}' +
    '.wc-role{all:unset;flex:none;cursor:pointer;width:40px;height:40px;border-radius:10px;border:1.5px solid #e2c27a;display:flex;align-items:center;justify-content:center;font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:22px;color:#e2c27a;' +
      'background:repeating-linear-gradient(45deg,#3b2b5a 0 5px,#33254f 5px 10px);transition:transform .35s cubic-bezier(.2,.8,.2,1)}' +
    '.wc-role.open{background:linear-gradient(160deg,#2c3a75,#151b3a);transform:rotateY(360deg)}.wc-role.open.wolf{background:linear-gradient(160deg,#7a1f2c,#2a0c12)}' +
    '.wc-tip{position:absolute;left:10px;bottom:calc(100% + 6px);width:120px;height:160px;perspective:600px;animation:ww-in .3s cubic-bezier(.2,.8,.2,1)}' +
    '.wc-tip .in{position:relative;width:100%;height:100%;transform:rotateY(180deg);transform-style:preserve-3d}' +
    '.wc-tip .f,.wc-tip .b{position:absolute;inset:0;border-radius:10px;-webkit-backface-visibility:hidden;backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px;box-sizing:border-box;text-align:center;box-shadow:0 8px 20px rgba(0,0,0,.4)}' +
    '.wc-tip .b{display:none}.wc-tip .f{transform:rotateY(180deg);background:linear-gradient(160deg,#2c3a75,#151b3a);border:2px solid #e2c27a;color:#f0e6c8}.wc-tip .f.wolf{background:linear-gradient(160deg,#7a1f2c,#2a0c12)}' +
    '@container ww (min-width:700px){' +
      '.wc{--col:clamp(150px,19cqw,230px)}' +
      '.ww-seat.col{flex-direction:row;justify-content:flex-start;gap:8px;padding:5px 8px}' +
      '.wc-col.r .ww-seat.col{flex-direction:row-reverse}' +
      '.ww-seat.col .ww-info{align-items:flex-start}.wc-col.r .ww-seat.col .ww-info{align-items:flex-end}' +
      '.ww-seat.col .ww-nm{font-size:13px;max-width:140px}.ww-seat.col .ww-tags{justify-content:flex-start}' +
      '.wc-feed{padding:12px max(18px,calc((100% - 720px) / 2))}' +
    '}' +
    '@container ww (orientation:landscape) and (max-height:560px){' +
      '.ww-seat.col .ww-av{width:30px;height:30px;font-size:13px}.ww-seat.col{padding:1px 6px}' +
      '.wc-quick{display:none}.wc-bottom{padding-top:6px;padding-bottom:6px;gap:6px}' +
    '}' +
    '@media (hover:hover){.ww-seat.pickable:hover .ww-av{box-shadow:0 0 0 3px var(--gold),0 6px 14px rgba(0,0,0,.3)}.wc-quick button:hover{border-color:var(--gold)}}' +
    '@media (prefers-reduced-motion:reduce){.ww *,.ww::before,.ww::after{animation:none!important;transition:none!important}}';

  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('werewolf', {
    init: function(container) {
      container.innerHTML = '<div class="ww-root" id="wwRoot"></div>';
      host = container;
      root = document.getElementById('wwRoot');
      S = null; sel = -1; showRole = false; lastPhaseKey = ''; mode = ''; prevAlive = null; prevDone = {}; seenChat = 0; seenLog = 0;
      clearInterval(timer);
      timer = setInterval(tick, 250);
      injectStylesOnce('ww-styles-v2', CSS);
      if (!window._wwResize) {
        window._wwResize = true;
        window.addEventListener('resize', function() { if (root && document.body.contains(root)) fit(); });
      }
    },
    render: function(state, container, playerIndex) {
      S = state;
      me = playerIndex;
      if (!S || !S.alive || !S.alive.length) return;
      var key = phaseKey() + ':' + (state.speakerPos || 0) + ':' + state.day + ':' + state.night;
      if (key !== lastPhaseKey) {
        sel = -1;
        lastPhaseKey = key;
        phaseTotal = S.deadline ? Math.max(1, (S.deadline - Date.now()) / 1000) : 0;
      }
      if (targets().indexOf(sel) < 0) sel = -1;
      if (!mode) {
        // first frame: don't replay old chat/log entries or deaths as "new"
        seenChat = (S.chat || []).length;
        seenLog = (S.log || []).length;
        prevAlive = S.alive.slice();
      }
      draw();
      if (!root.style.height) fit();
    },
  });
})();
