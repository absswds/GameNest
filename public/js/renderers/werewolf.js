// public/js/renderers/werewolf.js
// 狼人杀 — the phone is the judge. Night is a dark palette, day a paper one;
// the role card stays face-down until tapped so neighbours can't peek.
(function() {
  function t(key) { return typeof _t === 'function' ? _t(key) : key; }
  function tf(key) { var args = Array.prototype.slice.call(arguments, 1); return String(t(key)).replace(/%s/g, function() { return args.shift(); }); }
  function esc(v) { return String(v).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var S = null, me = -1, sel = -1, showRole = false, timer = null, lastPhaseKey = '';

  function seat(i) { return tf('ww_seat', i + 1); }
  function who(i) { return i === me ? t('ww_you') : seat(i); }
  function roleName(r) { return r ? t('ww_role_' + r) : ''; }
  function amAlive() { return S && S.alive[me]; }
  function isWolf(r) { return r === 'wolf'; }

  function phaseKey() {
    if (!S) return '';
    if (S.phase === 'speech') return 'speech_' + S.speechKind;
    if (S.phase === 'vote') return 'vote_' + S.voteKind;
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

  function send(data) { sel = -1; window.makeGameMove(data); }

  function btn(label, onclick, kind, disabled) {
    return '<button class="ww-btn' + (kind ? ' ' + kind : '') + '"' + (disabled ? ' disabled' : '') + ' onclick="' + onclick + '">' + label + '</button>';
  }

  // The action area: what I should do now, or what the table is waiting on
  function actionHtml() {
    var ph = S.phase, r = S.myRole, hint = '', btns = '';
    if (S.winner !== null) return '<div class="ww-hint strong">' + t(S.winner === -2 ? 'ww_win_wolf' : 'ww_win_good') + '</div>';
    if (!amAlive() && ph !== 'hunter' && ph !== 'badge' && !(ph === 'speech' && S.speakers[S.speakerPos] === me)) {
      return '<div class="ww-hint">' + t('ww_you_are_out') + '</div>';
    }
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
      hint = S.lastNight.length ? tf('ww_dawn_deaths', S.lastNight.map(who).join('、')) : t('ww_dawn_peace');
      hint = '<span class="strong">' + hint + '</span>';
    } else if (ph === 'sheriff_sign') {
      if (S.runs[me] === undefined) {
        hint = t('ww_sign_q');
        btns = btn(t('ww_run'), 'window._wwAct(\'run\')', 'primary') + btn(t('ww_no_run'), 'window._wwAct(\'norun\')', 'ghost');
      } else hint = t('ww_answered');
    } else if (ph === 'speech') {
      var sp = S.speakers[S.speakerPos];
      if (sp === me) {
        hint = '<span class="strong">' + t(S.speechKind === 'last' ? 'ww_your_last_words' : 'ww_your_speech') + '</span>';
        btns = btn(t('ww_end_speech'), 'window._wwAct(\'end\')', 'primary');
      } else hint = '<span class="strong">' + tf('ww_speaking', seat(sp)) + '</span>';
    } else if (ph === 'vote') {
      if (S.voters.indexOf(me) < 0) hint = t('ww_cannot_vote');
      else if (S.votes[me] !== undefined) hint = t('ww_voted');
      else {
        hint = t(S.voteKind === 'sheriff' ? 'ww_pick_sheriff' : 'ww_pick_vote');
        btns = btn(t('ww_vote'), 'window._wwAct(\'vote\')', 'primary', sel < 0) + btn(t('ww_abstain'), 'window._wwAct(\'abstain\')', 'ghost');
      }
    } else if (ph === 'hunter' || ph === 'badge') {
      if (S.actor === me) {
        hint = t(ph === 'hunter' ? 'ww_pick_shoot' : 'ww_pick_badge');
        btns = ph === 'hunter'
          ? btn(t('ww_shoot'), 'window._wwAct(\'shoot\')', 'danger', sel < 0) + btn(t('ww_no_shoot'), 'window._wwAct(\'noshoot\')', 'ghost')
          : btn(t('ww_pass_badge'), 'window._wwAct(\'badge\')', 'primary', sel < 0) + btn(t('ww_tear_badge'), 'window._wwAct(\'tear\')', 'ghost');
      } else hint = tf(ph === 'hunter' ? 'ww_hunter_waiting' : 'ww_badge_waiting', seat(S.actor));
    }
    return '<div class="ww-hint">' + hint + '</div>' + (btns ? '<div class="ww-btns">' + btns + '</div>' : '');
  }

  function seatsHtml() {
    var tg = targets();
    var speaker = S.phase === 'speech' ? S.speakers[S.speakerPos] : -1;
    var pending = S.phase === 'vote' ? S.votes : S.phase === 'sheriff_sign' ? S.runs : null;
    var checked = {};
    (S.checks || []).forEach(function(c) { checked[c.target] = c.wolf; });
    var wolfPicks = {};
    Object.keys(S.wolfVotes || {}).forEach(function(k) { var v = S.wolfVotes[k]; if (v >= 0) wolfPicks[v] = (wolfPicks[v] || 0) + 1; });
    var h = '';
    for (var i = 0; i < S.n; i++) {
      var dead = !S.alive[i];
      var cls = 'ww-seat' + (dead ? ' dead' : '') + (i === me ? ' me' : '') + (i === speaker ? ' speaking' : '') +
        (tg.indexOf(i) >= 0 ? ' pickable' : '') + (i === sel ? ' selected' : '');
      var tags = '';
      if (S.sheriff === i) tags += '<span class="ww-tag gold">' + t('ww_sheriff') + '</span>';
      if (S.roles[i] && (i !== me || S.winner !== null)) tags += '<span class="ww-tag' + (isWolf(S.roles[i]) ? ' red' : '') + '">' + roleName(S.roles[i]) + '</span>';
      if (checked[i] !== undefined && !S.roles[i]) tags += '<span class="ww-tag ' + (checked[i] ? 'red' : 'green') + '">' + t(checked[i] ? 'ww_bad' : 'ww_good') + '</span>';
      if (wolfPicks[i] && S.phase === 'night_wolf') tags += '<span class="ww-tag red">🎯' + wolfPicks[i] + '</span>';
      if (pending && pending[i] !== undefined) tags += '<span class="ww-tag done">✓</span>';
      if (dead) tags += '<span class="ww-tag">' + t('ww_dead') + '</span>';
      h += '<button class="' + cls + '"' + (tg.indexOf(i) >= 0 ? ' onclick="window._wwPick(' + i + ')"' : ' tabindex="-1"') + '>' +
        '<span class="ww-no">' + (i + 1) + '</span>' +
        '<span class="ww-name">' + esc(i === me ? t('ww_you') : window.getPlayerName(i)) + '</span>' +
        '<span class="ww-tags">' + tags + '</span></button>';
    }
    return h;
  }

  function roleHtml() {
    var r = S.myRole;
    if (!r) return '';
    var mates = r === 'wolf' ? S.roles.map(function(x, i) { return x === 'wolf' && i !== me ? seat(i) : null; }).filter(Boolean) : [];
    var back = '<div class="ww-role-back">' + t('ww_tap_reveal') + '</div>';
    var face = '<div class="ww-role-face' + (isWolf(r) ? ' wolf' : '') + '"><div class="ww-role-name">' + roleName(r) + '</div>' +
      '<div class="ww-role-desc">' + t('ww_desc_' + r) + '</div>' +
      (mates.length ? '<div class="ww-role-desc">' + tf('ww_teammates', mates.join('、')) + '</div>' : '') +
      (r === 'witch' && S.potions ? '<div class="ww-role-desc">' + tf('ww_potions_left', t(S.potions.save ? 'ww_yes' : 'ww_no'), t(S.potions.poison ? 'ww_yes' : 'ww_no')) + '</div>' : '') +
      '</div>';
    return '<button class="ww-role" onclick="window._wwToggleRole()">' + (showRole || S.winner !== null ? face : back) + '</button>';
  }

  function logHtml() {
    var rows = [];
    (S.log || []).forEach(function(e) {
      var txt;
      if (e.t === 'deaths') txt = e.list.length ? tf('ww_log_deaths', e.day, e.list.map(seat).join('、')) : tf('ww_log_peace', e.day);
      else if (e.t === 'sheriff') txt = tf('ww_log_sheriff', seat(e.who));
      else if (e.t === 'no_sheriff') txt = t('ww_log_no_sheriff');
      else if (e.t === 'exile') txt = tf('ww_log_exile', seat(e.who));
      else if (e.t === 'no_exile') txt = t('ww_log_no_exile');
      else if (e.t === 'idiot') txt = tf('ww_log_idiot', seat(e.who));
      else if (e.t === 'shot') txt = tf('ww_log_shot', seat(e.by), seat(e.who));
      else if (e.t === 'badge') txt = e.who >= 0 ? tf('ww_log_badge', seat(e.by), seat(e.who)) : tf('ww_log_badge_torn', seat(e.by));
      if (txt) rows.push('<li>' + txt + '</li>');
    });
    var vote = '';
    var lv = S.lastVote;
    if (lv) {
      var byTarget = {};
      Object.keys(lv.votes).forEach(function(v) {
        var tgt = lv.votes[v];
        var key = tgt < 0 ? 'x' : tgt;
        (byTarget[key] = byTarget[key] || []).push(+v + 1);
      });
      vote = '<div class="ww-sub">' + t(lv.kind === 'sheriff' ? 'ww_vote_detail_sheriff' : 'ww_vote_detail') + '</div><ul class="ww-votes">' +
        Object.keys(byTarget).map(function(k) {
          return '<li><b>' + (k === 'x' ? t('ww_abstained') : seat(+k)) + '</b>' + (k !== 'x' && lv.tally[k] ? ' <em>' + lv.tally[k] + '</em>' : '') + ' ← ' + byTarget[k].join('、') + '</li>';
        }).join('') + '</ul>';
    }
    if (!rows.length && !vote) return '';
    return '<div class="ww-log"><div class="ww-sub">' + t('ww_log_title') + '</div><ul>' + rows.reverse().join('') + '</ul>' + vote + '</div>';
  }

  function tick() {
    var el = document.getElementById('wwTimer');
    if (!el || !S) return;
    var left = S.winner === null && S.deadline ? Math.max(0, Math.ceil((S.deadline - Date.now()) / 1000)) : 0;
    el.textContent = left ? left + 's' : '';
    el.classList.toggle('urgent', left > 0 && left <= 5);
  }

  function draw() {
    var root = document.getElementById('wwRoot');
    if (!root || !S) return;
    var night = S.phase === 'night_wolf' || S.phase === 'night_witch';
    root.classList.toggle('night', night);
    var title = t('ww_phase_' + phaseKey());
    var when = S.winner !== null ? '' : night ? tf('ww_night_n', S.night) : tf('ww_day_n', S.day);
    root.innerHTML =
      '<div class="ww-head"><div><div class="ww-when">' + when + '</div><div class="ww-title">' + title + '</div></div><div class="ww-timer" id="wwTimer"></div></div>' +
      roleHtml() +
      '<div class="ww-action">' + actionHtml() + '</div>' +
      '<div class="ww-seats">' + seatsHtml() + '</div>' +
      logHtml();
    tick();
  }

  window._wwPick = function(i) { sel = sel === i ? -1 : i; draw(); };
  window._wwToggleRole = function() { showRole = !showRole; draw(); };
  window._wwAct = function(a) {
    var map = {
      kill: { type: 'kill', target: sel }, nokill: { type: 'kill', target: -1 },
      check: { type: 'check', target: sel },
      save: { type: 'witch', save: true }, poison: { type: 'witch', poison: sel }, skip: { type: 'witch' },
      run: { type: 'run', run: true }, norun: { type: 'run', run: false },
      end: { type: 'end_speech' },
      vote: { type: 'vote', target: sel }, abstain: { type: 'vote', target: -1 },
      shoot: { type: 'shoot', target: sel }, noshoot: { type: 'shoot', target: -1 },
      badge: { type: 'badge', target: sel }, tear: { type: 'badge', target: -1 },
    };
    if (map[a]) send(map[a]);
  };

  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('werewolf', {
    init: function(container) {
      container.innerHTML = '<div class="ww" id="wwRoot"></div>';
      S = null; sel = -1; showRole = false; lastPhaseKey = '';
      clearInterval(timer);
      timer = setInterval(tick, 500);
      injectStylesOnce('ww-styles', '' +
        '.ww{--ww-bg:#f6f3ec;--ww-card:#fffdf8;--ww-ink:#2a2723;--ww-muted:#8a8378;--ww-line:rgba(42,39,35,.12);--ww-accent:#9a7b3f;--ww-red:#b23a30;--ww-green:#3f7d4e;' +
          'width:min(720px,calc(100vw - 32px));margin:0 auto;padding:14px;border-radius:18px;background:var(--ww-bg);color:var(--ww-ink);' +
          'display:flex;flex-direction:column;gap:12px;transition:background .32s cubic-bezier(.2,.8,.2,1),color .32s;box-sizing:border-box;}' +
        '.ww.night{--ww-bg:#161925;--ww-card:#1f2332;--ww-ink:#e7e4dc;--ww-muted:#8d93a6;--ww-line:rgba(231,228,220,.1);--ww-accent:#c9aa6a;--ww-red:#e0675c;--ww-green:#7cc08b;}' +
        '.ww-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;}' +
        '.ww-when{font-size:12px;color:var(--ww-muted);letter-spacing:.08em;}' +
        '.ww-title{font-size:20px;font-weight:700;margin-top:2px;}' +
        '.ww-timer{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ww-accent);min-width:48px;text-align:right;}' +
        '.ww-timer.urgent{color:var(--ww-red);}' +
        '.ww-role{all:unset;display:block;cursor:pointer;border-radius:14px;border:1px solid var(--ww-line);background:var(--ww-card);padding:12px 14px;}' +
        '.ww-role-back{font-size:14px;color:var(--ww-muted);text-align:center;letter-spacing:.1em;}' +
        '.ww-role-name{font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:26px;color:var(--ww-accent);}' +
        '.ww-role-face.wolf .ww-role-name{color:var(--ww-red);}' +
        '.ww-role-desc{font-size:13px;color:var(--ww-muted);margin-top:4px;line-height:1.5;}' +
        '.ww-action{border-radius:14px;background:var(--ww-card);border:1px solid var(--ww-line);padding:12px 14px;display:flex;flex-direction:column;gap:10px;}' +
        '.ww-hint{font-size:15px;line-height:1.5;}' +
        '.ww-hint .strong,.ww-hint.strong{font-weight:700;font-size:17px;}' +
        '.ww-check.good{color:var(--ww-green);font-weight:700;}.ww-check.bad{color:var(--ww-red);font-weight:700;}' +
        '.ww-btns{display:flex;flex-wrap:wrap;gap:8px;}' +
        '.ww-btn{min-height:44px;padding:0 18px;border-radius:12px;border:1px solid var(--ww-line);background:transparent;color:var(--ww-ink);font-size:15px;font-weight:600;cursor:pointer;transition:transform .12s,opacity .12s;}' +
        '.ww-btn:active{transform:scale(.97);}' +
        '.ww-btn:disabled{opacity:.4;cursor:default;}' +
        '.ww-btn.primary{background:var(--ww-accent);border-color:var(--ww-accent);color:#fff;}' +
        '.ww-btn.danger{background:var(--ww-red);border-color:var(--ww-red);color:#fff;}' +
        '.ww-seats{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;}' +
        '.ww-seat{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:4px;min-height:74px;padding:10px;border-radius:12px;background:var(--ww-card);border:1px solid var(--ww-line);position:relative;transition:transform .2s cubic-bezier(.2,.8,.2,1),border-color .2s,opacity .2s;}' +
        '.ww-seat.me{border-color:var(--ww-accent);}' +
        '.ww-seat.dead{opacity:.45;}' +
        '.ww-seat.speaking{box-shadow:0 0 0 2px var(--ww-accent);}' +
        '.ww-seat.pickable{cursor:pointer;}' +
        '.ww-seat.selected{border-color:var(--ww-red);box-shadow:0 0 0 2px var(--ww-red);transform:translateY(-2px);}' +
        '.ww-no{font-size:12px;font-weight:700;color:var(--ww-muted);font-variant-numeric:tabular-nums;}' +
        '.ww-name{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
        '.ww-tags{display:flex;flex-wrap:wrap;gap:4px;}' +
        '.ww-tag{font-size:11px;line-height:18px;padding:0 6px;border-radius:9px;border:1px solid var(--ww-line);color:var(--ww-muted);}' +
        '.ww-tag.gold{color:var(--ww-accent);border-color:var(--ww-accent);}' +
        '.ww-tag.red{color:var(--ww-red);border-color:var(--ww-red);}' +
        '.ww-tag.green{color:var(--ww-green);border-color:var(--ww-green);}' +
        '.ww-tag.done{color:var(--ww-green);}' +
        '.ww-log{font-size:13px;color:var(--ww-muted);}' +
        '.ww-log ul{list-style:none;margin:4px 0 8px;padding:0;display:flex;flex-direction:column;gap:3px;}' +
        '.ww-votes b{color:var(--ww-ink);font-weight:600;}.ww-votes em{font-style:normal;color:var(--ww-accent);}' +
        '.ww-sub{font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--ww-muted);}' +
        '@media (hover:hover){.ww-seat.pickable:hover{border-color:var(--ww-accent);}}' +
        '@media (max-width:560px){.ww{padding:10px;border-radius:14px;}.ww-seats{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}.ww-seat{min-height:64px;padding:8px;}.ww-title{font-size:18px;}}' +
        '@media (prefers-reduced-motion:reduce){.ww,.ww-seat{transition:none;}}');
    },
    render: function(state, container, playerIndex) {
      S = state;
      me = playerIndex;
      var key = phaseKey() + ':' + (state.speakerPos || 0) + ':' + state.day + ':' + state.night;
      if (key !== lastPhaseKey) { sel = -1; lastPhaseKey = key; }
      if (targets().indexOf(sel) < 0) sel = -1;
      draw();
    },
  });
})();
