// public/js/renderers/sanguo.js
// 三国身份局 — seats on top, your hand at the bottom, one prompt in the middle.
// All card, skill and general names come from the lang pack; ids stay English.
(function() {
  function t(key) { return typeof _t === 'function' ? _t(key) : key; }
  function tf(key) { var args = Array.prototype.slice.call(arguments, 1); return String(t(key)).replace(/%s/g, function() { return args.shift(); }); }
  function esc(v) { return String(v).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var ACTIVE = { liubei: 'rende', sunquan: 'zhiheng', huatuo: 'qingnang', diaochan: 'lijian' };
  var SKILLS = {
    liubei: ['rende'], guanyu: ['wusheng'], zhangfei: ['paoxiao'], caocao: ['jianxiong'], simayi: ['fankui'], xiahoudun: ['ganglie'],
    sunquan: ['zhiheng'], ganning: ['qixi'], lvmeng: ['keji'], lvbu: ['wushuang'], huatuo: ['jijiu', 'qingnang'], diaochan: ['lijian', 'biyue'],
  };
  var SUIT = { S: '♠', H: '♥', C: '♣', D: '♦' };
  var RANK = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  var TARGETS_NEEDED = { sha: 1, guohe: 1, shunshou: 1, juedou: 1, lebu: 1, jiedao: 2 };
  var KIND = { sha: 'basic', shan: 'basic', tao: 'basic' };

  var S = null, me = -1, selCards = [], selTargets = [], timer = null, lastKey = '';

  function P(i) { return S.players[i]; }
  function gname(i) { return i === me ? t('sg_you') : t('sg_g_' + P(i).general); }
  function cname(c) { return t('sg_c_' + (c.name || c)); }
  function isRed(c) { return c.suit === 'H' || c.suit === 'D'; }
  function cardText(c) { return cname(c) + ' ' + SUIT[c.suit] + (RANK[c.rank] || c.rank); }
  function kindOf(name) {
    if (KIND[name]) return 'basic';
    if (['zhuge', 'qinggang', 'cixiong', 'hanbing', 'guanshi', 'qinglong', 'zhangba', 'fangtian', 'qilin', 'bagua', 'renwang', 'jueying', 'dilu', 'zhuahuang', 'chitu', 'dawan', 'zixing'].indexOf(name) >= 0) return 'equip';
    return 'trick';
  }
  function weaponName(i) { return P(i).equip.weapon && P(i).equip.weapon.name; }

  // Mirrors the engine: does this hand card count as `name` when answering?
  function counts(c, name) {
    var g = P(me).general;
    return c.name === name ||
      (name === 'sha' && g === 'guanyu' && isRed(c)) ||
      (name === 'tao' && g === 'huatuo' && isRed(c) && S.current !== me);
  }

  function myAsk() { return S && S.ask && S.ask.to === me && S.winner === null ? S.ask : null; }

  // Which hand/equip cards may be selected for the current question
  function cardEnabled(c) {
    var a = myAsk();
    if (!a) return false;
    if (a.type === 'play') return true;
    if (a.type === 'respond') return a.need === 'any' || counts(c, a.need) || (a.need === 'sha' && weaponName(me) === 'zhangba');
    if (a.type === 'discard') return true;
    return false;
  }
  function maxSelect() {
    var a = myAsk();
    if (!a) return 0;
    if (a.type === 'discard') return a.count;
    if (a.type === 'respond') return a.need === 'sha' && weaponName(me) === 'zhangba' ? 2 : 1;
    return 99;
  }

  function send(data) { selCards = []; selTargets = []; window.makeGameMove(data); }

  function handCard(id) {
    var h = P(me).hand;
    for (var i = 0; i < h.length; i++) if (h[i].id === id) return h[i];
    return null;
  }

  // What the current selection can do in my play phase
  function playOptions() {
    var opts = [], cards = selCards.map(handCard).filter(Boolean), g = P(me).general, used = P(me).used || {};
    if (!cards.length) return opts;
    var c = cards[0];
    if (cards.length === 1) {
      if (c.name !== 'shan' && c.name !== 'wuxie') opts.push({ label: t('sg_use'), need: TARGETS_NEEDED[c.name] || 0, data: { type: 'use', cardId: c.id } });
      if (g === 'guanyu' && isRed(c) && c.name !== 'sha') opts.push({ label: tf('sg_use_as', t('sg_c_sha')), need: 1, data: { type: 'use', cardId: c.id, as: 'sha' } });
      if (g === 'ganning' && !isRed(c) && c.name !== 'guohe') opts.push({ label: tf('sg_use_as', t('sg_c_guohe')), need: 1, data: { type: 'use', cardId: c.id, as: 'guohe' } });
    }
    if (cards.length === 2 && weaponName(me) === 'zhangba') opts.push({ label: tf('sg_use_as', t('sg_c_sha')), need: 1, data: { type: 'use', cardIds: selCards.slice(), as: 'sha' } });
    var sk = ACTIVE[g];
    if (sk === 'rende') opts.push({ label: t('sg_s_rende'), need: 1, data: { type: 'skill', skill: 'rende', cardIds: selCards.slice() } });
    if (sk === 'zhiheng') opts.push({ label: t('sg_s_zhiheng'), need: 0, off: used.zhiheng, data: { type: 'skill', skill: 'zhiheng', cardIds: selCards.slice() } });
    if (sk === 'qingnang' && cards.length === 1) opts.push({ label: t('sg_s_qingnang'), need: 0, off: used.qingnang, selfDefault: true, data: { type: 'skill', skill: 'qingnang', cardIds: selCards.slice() } });
    if (sk === 'lijian' && cards.length === 1) opts.push({ label: t('sg_s_lijian'), need: 2, off: used.lijian, data: { type: 'skill', skill: 'lijian', cardIds: selCards.slice() } });
    return opts;
  }

  function selectableSeat(i) {
    var a = myAsk();
    return !!a && a.type === 'play' && i !== me && P(i).alive && selCards.length > 0;
  }

  // ---------- html ----------
  function cardHtml(c, opts) {
    opts = opts || {};
    var cls = 'sg-card ' + kindOf(c.name) + (isRed(c) ? ' red' : '') + (opts.sel ? ' sel' : '') + (opts.off ? ' off' : '');
    var click = opts.click ? ' onclick="' + opts.click + '"' : '';
    return '<button class="' + cls + '"' + click + (opts.click ? '' : ' tabindex="-1"') + '>' +
      '<span class="sg-card-top">' + SUIT[c.suit] + (RANK[c.rank] || c.rank) + '</span>' +
      '<span class="sg-card-name">' + esc(cname(c)) + '</span></button>';
  }

  function hpHtml(p) {
    var h = '';
    for (var k = 0; k < p.maxHp; k++) h += '<i class="' + (k < p.hp ? 'on' : '') + (p.hp <= 1 && k < p.hp ? ' low' : '') + '"></i>';
    return '<span class="sg-hp">' + h + '</span>';
  }

  function equipHtml(p) {
    var out = '';
    ['weapon', 'armor', 'plus', 'minus'].forEach(function(slot) {
      if (p.equip && p.equip[slot]) out += '<span class="sg-eq" title="' + esc(t('sg_slot_' + slot)) + '">' + esc(cname(p.equip[slot])) + '</span>';
    });
    (p.judge || []).forEach(function(c) { out += '<span class="sg-eq judge" title="' + esc(t('sg_judge_zone')) + '">' + esc(cname(c)) + '</span>'; });
    return out;
  }

  function seatHtml(i) {
    var p = P(i), a = S.ask;
    var cls = 'sg-seat k-' + p.kingdom + (i === me ? ' me' : '') + (!p.alive ? ' dead' : '') + (S.current === i && S.winner === null ? ' turn' : '') +
      (a && a.to === i && S.winner === null ? ' asked' : '') + (selTargets.indexOf(i) >= 0 ? ' picked' : '') + (selectableSeat(i) ? ' pickable' : '');
    var role = p.role ? '<span class="sg-role r-' + p.role + '">' + t('sg_role_' + p.role) + '</span>' : '';
    var order = selTargets.indexOf(i) >= 0 && selTargets.length > 1 ? '<b class="sg-order">' + (selTargets.indexOf(i) + 1) + '</b>' : '';
    var click = selectableSeat(i) ? ' onclick="window._sgSeat(' + i + ')"' : ' tabindex="-1"';
    return '<button class="' + cls + '"' + click + '>' + order +
      '<span class="sg-seat-head"><span class="sg-gen">' + esc(t('sg_g_' + p.general)) + '</span><span class="sg-k">' + t('sg_k_' + p.kingdom) + '</span></span>' +
      hpHtml(p) +
      '<span class="sg-seat-foot">' + role + (p.alive ? '<span class="sg-cnt">▤ ' + p.handCount + '</span>' : '<span class="sg-cnt">' + t('sg_dead') + '</span>') + '</span>' +
      '<span class="sg-eqs">' + equipHtml(p) + '</span></button>';
  }

  function logLine(e) {
    var who = function(i) { return i >= 0 && S.players[i] ? gname(i) : '—'; };
    var cs = function(cards) { return (cards || []).map(cname).join('、'); };
    switch (e.t) {
      case 'turn': return tf('sg_log_turn', who(e.p));
      case 'use':
        if (e.targets && e.targets.length === 1 && e.targets[0] !== e.p) return tf('sg_log_use_to', who(e.p), who(e.targets[0]), t('sg_c_' + e.name));
        return tf('sg_log_use', who(e.p), t('sg_c_' + e.name));
      case 'respond': return tf('sg_log_respond', who(e.p), cs(e.cards));
      case 'dodged': return tf('sg_log_dodged', who(e.p));
      case 'damage': return tf('sg_log_damage', who(e.p), e.n);
      case 'dying': return tf('sg_log_dying', who(e.p));
      case 'save': return tf('sg_log_save', who(e.p), who(e.who));
      case 'death': return tf('sg_log_death', who(e.p), t('sg_role_' + e.role));
      case 'judge': return tf('sg_log_judge', who(e.p), cardText(e.card));
      case 'wuxie': return tf('sg_log_wuxie', who(e.p));
      case 'skill': return tf('sg_log_skill', who(e.p), t('sg_s_' + e.skill));
      case 'blocked': return tf('sg_log_blocked', who(e.p));
      case 'bagua': return tf('sg_log_bagua', who(e.p));
      case 'discard': return tf('sg_log_discard', who(e.p), (e.cards || []).length);
      case 'took': return tf('sg_log_took', who(e.p), who(e.target));
      case 'dismantled': return tf('sg_log_dismantled', who(e.p), who(e.target));
      case 'give_weapon': return tf('sg_log_give_weapon', who(e.p), who(e.to));
      case 'skip_play': return tf('sg_log_skip_play', who(e.p));
      case 'lord_penalty': return tf('sg_log_lord_penalty', who(e.p));
      case 'weapon': return tf('sg_log_weapon', who(e.p), t('sg_c_' + e.name));
      case 'over': return t('sg_log_over');
    }
    return '';
  }

  function btn(label, onclick, kind, disabled) {
    return '<button class="sg-btn' + (kind ? ' ' + kind : '') + '"' + (disabled ? ' disabled' : '') + ' onclick="' + onclick + '">' + label + '</button>';
  }

  // The middle panel: what is being asked, and the buttons that answer it
  function promptHtml() {
    if (S.winner !== null) {
      var key = S.winner === -2 ? 'sg_win_lord' : S.winner === -3 ? 'sg_win_rebel' : 'sg_win_spy';
      return '<div class="sg-hint strong">' + t(key) + '</div>';
    }
    var a = S.ask;
    if (!a) return '';
    if (a.to !== me) return '<div class="sg-hint">' + tf('sg_waiting', esc(t('sg_g_' + P(a.to).general))) + '</div>';
    var hint = '', btns = '', n = selCards.length;
    if (a.type === 'play') {
      hint = t('sg_ask_play');
      var opts = playOptions();
      opts.forEach(function(o, k) {
        var ok = !o.off && (o.selfDefault ? selTargets.length <= 1 : o.need === 0 || o.need === selTargets.length);
        btns += btn(esc(o.label) + (o.need > 1 ? ' (' + selTargets.length + '/' + o.need + ')' : ''), 'window._sgPlay(' + k + ')', 'primary', !ok);
      });
      if (selCards.length === 1 && handCard(selCards[0]) && handCard(selCards[0]).name === 'jiedao') hint = t('sg_hint_jiedao');
      if (opts.some(function(o) { return o.data.skill === 'lijian'; })) hint = t('sg_hint_lijian');
      btns += btn(t('sg_end_turn'), 'window._sgEnd()', 'ghost');
    } else if (a.type === 'respond') {
      if (a.need === 'wuxie') hint = tf('sg_ask_wuxie', esc(t('sg_c_' + a.trick)), esc(a.target >= 0 ? gname(a.target) : ''));
      else if (a.need === 'tao') hint = tf('sg_ask_tao', esc(gname(a.dying)));
      else if (a.need === 'any') hint = tf('sg_ask_any', esc(gname(a.from)));
      else if (a.reason === 'juedou') hint = t('sg_ask_juedou');
      else if (a.reason === 'jiedao') hint = tf('sg_ask_jiedao', esc(gname(a.from)));
      else hint = a.from >= 0 && a.from !== me ? tf('sg_ask_need_from', esc(gname(a.from)), esc(t('sg_c_' + a.need))) : tf('sg_ask_need', esc(t('sg_c_' + a.need)));
      var need2 = a.need === 'sha' && weaponName(me) === 'zhangba' && n === 2;
      btns = btn(t('sg_respond'), 'window._sgRespond()', 'primary', !(n === 1 || need2)) + btn(t('sg_pass'), 'window._sgPass()', 'ghost');
    } else if (a.type === 'discard') {
      hint = a.reason === 'limit' ? tf('sg_ask_limit', a.count) : a.reason === 'guanshi' ? t('sg_ask_guanshi') : a.reason === 'ganglie' ? t('sg_ask_ganglie') : tf('sg_ask_limit', a.count);
      btns = btn(t('sg_confirm') + ' (' + n + '/' + a.count + ')', 'window._sgDiscard()', 'primary', n !== a.count) + (a.optional ? btn(t('sg_pass'), 'window._sgPass()', 'ghost') : '');
    } else if (a.type === 'pick') {
      var T = P(a.target);
      hint = tf(a.mode === 'take' ? 'sg_ask_pick_take' : 'sg_ask_pick_discard', esc(gname(a.target)));
      if (T.handCount) btns += btn(t('sg_blind_hand'), 'window._sgPick(\'hand\')', 'primary');
      ['weapon', 'armor', 'plus', 'minus'].forEach(function(slot) {
        if (T.equip[slot]) btns += btn(esc(cname(T.equip[slot])), 'window._sgPick(\'table\',' + T.equip[slot].id + ')', 'primary');
      });
      (T.judge || []).forEach(function(c) { btns += btn(esc(cname(c)), 'window._sgPick(\'table\',' + c.id + ')', 'primary'); });
    } else if (a.type === 'wugu') {
      hint = t('sg_ask_wugu');
      a.cards.forEach(function(c) { btns += cardHtml(c, { click: 'window._sgWugu(' + c.id + ')' }); });
    } else if (a.type === 'confirm') {
      hint = tf('sg_ask_hanbing', esc(gname(a.target)));
      btns = btn(t('sg_yes'), 'window._sgConfirm(true)', 'primary') + btn(t('sg_no'), 'window._sgConfirm(false)', 'ghost');
    }
    return '<div class="sg-hint strong">' + hint + '</div><div class="sg-btns">' + btns + '</div>';
  }

  function myPanelHtml() {
    var p = P(me), a = myAsk();
    var skills = (SKILLS[p.general] || []).map(function(k) {
      return '<div class="sg-skill"><b>' + esc(t('sg_s_' + k)) + '</b><span>' + esc(t('sg_sd_' + k)) + '</span></div>';
    }).join('');
    var allowEquip = a && a.type === 'discard' && a.allowEquip;
    var equips = '';
    if (allowEquip) {
      ['weapon', 'armor', 'plus', 'minus'].forEach(function(slot) {
        var c = p.equip[slot];
        if (c && c.name !== 'guanshi') equips += cardHtml(c, { click: 'window._sgCard(' + c.id + ')', sel: selCards.indexOf(c.id) >= 0 });
      });
    }
    var hand = p.hand.map(function(c) {
      var en = cardEnabled(c);
      return cardHtml(c, { click: en ? 'window._sgCard(' + c.id + ')' : null, sel: selCards.indexOf(c.id) >= 0, off: !en && !!a });
    }).join('');
    var head = '<div class="sg-me-head"><span class="sg-gen">' + esc(t('sg_g_' + p.general)) + '</span><span class="sg-k">' + t('sg_k_' + p.kingdom) + '</span>' +
      (p.role ? '<span class="sg-role r-' + p.role + '">' + t('sg_role_' + p.role) + '</span>' : '') + hpHtml(p) +
      '<span class="sg-eqs">' + equipHtml(p) + '</span></div>';
    return '<div class="sg-me' + (S.current === me && S.winner === null ? ' turn' : '') + (!p.alive ? ' dead' : '') + '">' + head +
      '<div class="sg-hand">' + (hand || '<span class="sg-empty">' + tf('sg_hand', 0) + '</span>') + equips + '</div>' +
      '<div class="sg-skills">' + skills + '</div></div>';
  }

  function logHtml() {
    var rows = [];
    for (var i = S.log.length - 1; i >= 0 && rows.length < 10; i--) {
      var line = logLine(S.log[i]);
      if (line) rows.push('<li>' + esc(line) + '</li>');
    }
    return '<div class="sg-log"><div class="sg-sub">' + t('sg_log_title') + '</div><ul>' + rows.join('') + '</ul></div>';
  }

  function tick() {
    var el = document.getElementById('sgTimer');
    if (!el || !S) return;
    var left = S.winner === null && S.ask && S.ask.deadline ? Math.max(0, Math.ceil((S.ask.deadline - Date.now()) / 1000)) : 0;
    el.textContent = left ? left + 's' : '';
    el.classList.toggle('urgent', left > 0 && left <= 5 && S.ask.to === me);
  }

  function draw() {
    var root = document.getElementById('sgRoot');
    if (!root || !S || !S.players || !S.players.length || !S.players[me]) return;
    var others = [];
    for (var k = 1; k < S.n; k++) others.push((me + k) % S.n);
    var cur = S.ask ? S.ask.to : S.current;
    root.innerHTML =
      '<div class="sg-head"><div><div class="sg-when">' + tf('sg_round', S.round) + ' · ' + tf('sg_deck', S.deckCount) + '</div>' +
        '<div class="sg-title">' + (S.winner !== null ? t('sg_log_over') : cur === me ? t('sg_your_turn') : tf('sg_turn_of', esc(t('sg_g_' + P(S.current).general)))) + '</div></div>' +
        '<div class="sg-timer" id="sgTimer"></div></div>' +
      '<div class="sg-seats">' + others.map(seatHtml).join('') + '</div>' +
      '<div class="sg-prompt">' + promptHtml() + '</div>' +
      myPanelHtml() + logHtml();
    tick();
  }

  // ---------- actions ----------
  window._sgCard = function(id) {
    var i = selCards.indexOf(id), max = maxSelect();
    if (i >= 0) selCards.splice(i, 1);
    else if (max === 1) selCards = [id];
    else if (selCards.length < max) selCards.push(id);
    draw();
  };
  window._sgSeat = function(i) {
    var k = selTargets.indexOf(i);
    if (k >= 0) selTargets.splice(k, 1);
    else { selTargets.push(i); if (selTargets.length > 2) selTargets.shift(); }
    draw();
  };
  window._sgPlay = function(k) {
    var o = playOptions()[k];
    if (!o) return;
    var data = JSON.parse(JSON.stringify(o.data));
    if (o.selfDefault) data.targets = selTargets.length ? selTargets.slice() : [me];
    else if (o.need > 0) data.targets = selTargets.slice();
    send(data);
  };
  window._sgEnd = function() { send({ type: 'end' }); };
  window._sgRespond = function() { send(selCards.length === 2 ? { type: 'respond', cardIds: selCards.slice() } : { type: 'respond', cardId: selCards[0] }); };
  window._sgPass = function() { send({ type: 'pass' }); };
  window._sgDiscard = function() { send({ type: 'discard', cardIds: selCards.slice() }); };
  window._sgPick = function(zone, id) { send({ type: 'pick', zone: zone, cardId: id }); };
  window._sgWugu = function(id) { send({ type: 'wugu', cardId: id }); };
  window._sgConfirm = function(yes) { send({ type: 'confirm', yes: yes }); };

  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('sanguo', {
    init: function(container) {
      container.innerHTML = '<div class="sg" id="sgRoot"></div>';
      S = null; selCards = []; selTargets = []; lastKey = '';
      clearInterval(timer);
      timer = setInterval(tick, 500);
      injectStylesOnce('sg-styles', '' +
        '.sg{--sg-bg:#f6f1e8;--sg-card:#fffdf8;--sg-ink:#2a2420;--sg-muted:#8a8074;--sg-line:rgba(42,36,32,.13);--sg-accent:#a8432f;--sg-gold:#b08a3e;--sg-green:#3f7d4e;' +
          'width:min(960px,calc(100vw - 32px));margin:0 auto;padding:14px;border-radius:18px;background:var(--sg-bg);color:var(--sg-ink);display:flex;flex-direction:column;gap:12px;box-sizing:border-box;}' +
        '.sg-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;}' +
        '.sg-when{font-size:12px;color:var(--sg-muted);letter-spacing:.06em;}' +
        '.sg-title{font-size:20px;font-weight:700;margin-top:2px;}' +
        '.sg-timer{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--sg-gold);min-width:48px;text-align:right;}' +
        '.sg-timer.urgent{color:var(--sg-accent);}' +
        '.sg-seats{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px;}' +
        '.sg-seat{all:unset;box-sizing:border-box;position:relative;display:flex;flex-direction:column;gap:5px;padding:9px 10px;border-radius:12px;background:var(--sg-card);border:1px solid var(--sg-line);border-top:3px solid var(--sg-line);min-width:0;transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s,opacity .2s;}' +
        '.sg-seat.k-shu{border-top-color:#b5483a;}.sg-seat.k-wei{border-top-color:#3d6fa3;}.sg-seat.k-wu{border-top-color:#3f8a5a;}.sg-seat.k-qun{border-top-color:#8c7a4a;}' +
        '.sg-seat.turn{box-shadow:0 0 0 2px var(--sg-gold);}' +
        '.sg-seat.asked{box-shadow:0 0 0 2px var(--sg-accent);}' +
        '.sg-seat.pickable{cursor:pointer;}' +
        '.sg-seat.picked{box-shadow:0 0 0 2px var(--sg-accent);transform:translateY(-2px);}' +
        '.sg-seat.dead{opacity:.45;}' +
        '.sg-order{position:absolute;top:6px;right:6px;width:18px;height:18px;border-radius:9px;background:var(--sg-accent);color:#fff;font-size:11px;line-height:18px;text-align:center;}' +
        '.sg-seat-head,.sg-me-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}' +
        '.sg-gen{font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:20px;line-height:1.1;}' +
        '.sg-k{font-size:11px;padding:0 5px;line-height:17px;border-radius:9px;border:1px solid var(--sg-line);color:var(--sg-muted);}' +
        '.sg-hp{display:inline-flex;gap:3px;}' +
        '.sg-hp i{width:9px;height:9px;border-radius:50%;border:1.5px solid var(--sg-accent);box-sizing:border-box;}' +
        '.sg-hp i.on{background:var(--sg-accent);}.sg-hp i.on.low{animation:none;background:#d0352a;border-color:#d0352a;}' +
        '.sg-seat-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;color:var(--sg-muted);}' +
        '.sg-role{font-size:11px;padding:0 6px;line-height:17px;border-radius:9px;border:1px solid var(--sg-line);}' +
        '.sg-role.r-lord{color:var(--sg-gold);border-color:var(--sg-gold);}.sg-role.r-rebel{color:var(--sg-accent);border-color:var(--sg-accent);}.sg-role.r-loyal{color:var(--sg-green);border-color:var(--sg-green);}.sg-role.r-spy{color:#5a5f8a;border-color:#5a5f8a;}' +
        '.sg-eqs{display:flex;flex-wrap:wrap;gap:3px;min-height:0;}' +
        '.sg-eq{font-size:11px;line-height:16px;padding:0 5px;border-radius:5px;background:rgba(42,36,32,.07);}' +
        '.sg-eq.judge{background:rgba(168,67,47,.12);color:var(--sg-accent);}' +
        '.sg-prompt{border-radius:14px;background:var(--sg-card);border:1px solid var(--sg-line);padding:12px 14px;display:flex;flex-direction:column;gap:10px;min-height:44px;}' +
        '.sg-hint{font-size:14px;line-height:1.5;color:var(--sg-muted);}.sg-hint.strong{color:var(--sg-ink);font-weight:700;font-size:16px;}' +
        '.sg-btns{display:flex;flex-wrap:wrap;gap:8px;}' +
        '.sg-btn{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--sg-line);background:transparent;color:var(--sg-ink);font-size:15px;font-weight:600;cursor:pointer;transition:transform .12s,opacity .12s;}' +
        '.sg-btn:active{transform:scale(.97);}.sg-btn:disabled{opacity:.4;cursor:default;}' +
        '.sg-btn.primary{background:var(--sg-accent);border-color:var(--sg-accent);color:#fff;}' +
        '.sg-me{border-radius:14px;background:var(--sg-card);border:1px solid var(--sg-line);padding:10px 12px;display:flex;flex-direction:column;gap:10px;}' +
        '.sg-me.turn{box-shadow:0 0 0 2px var(--sg-gold);}.sg-me.dead{opacity:.55;}' +
        '.sg-hand{display:flex;flex-wrap:wrap;gap:6px;min-height:84px;}' +
        '.sg-empty{font-size:13px;color:var(--sg-muted);align-self:center;}' +
        '.sg-card{all:unset;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;width:62px;height:84px;padding:6px;border-radius:9px;background:#fffefb;border:1px solid var(--sg-line);border-left:4px solid #6b7c8a;cursor:default;transition:transform .15s cubic-bezier(.2,.8,.2,1),box-shadow .15s;}' +
        '.sg-card.basic{border-left-color:#a8432f;}.sg-card.trick{border-left-color:#3d6fa3;}.sg-card.equip{border-left-color:#8c7a4a;}' +
        '.sg-card[onclick]{cursor:pointer;}' +
        '.sg-card-top{font-size:13px;font-weight:700;color:#222;}.sg-card.red .sg-card-top{color:#c0392b;}' +
        '.sg-card-name{font-size:13px;font-weight:700;line-height:1.2;word-break:break-all;}' +
        '.sg-card.sel{transform:translateY(-8px);box-shadow:0 6px 14px rgba(0,0,0,.18);border-color:var(--sg-accent);}' +
        '.sg-card.off{opacity:.4;}' +
        '.sg-skills{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--sg-muted);line-height:1.5;}' +
        '.sg-skill b{color:var(--sg-ink);margin-right:6px;}' +
        '.sg-log{font-size:13px;color:var(--sg-muted);}.sg-log ul{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:3px;}' +
        '.sg-sub{font-size:12px;font-weight:700;letter-spacing:.08em;}' +
        '@media (hover:hover){.sg-seat.pickable:hover{box-shadow:0 0 0 2px var(--sg-accent);}.sg-card[onclick]:hover{transform:translateY(-4px);}}' +
        '@media (max-width:560px){.sg{padding:10px;border-radius:14px;}.sg-seats{grid-template-columns:repeat(2,minmax(0,1fr));}.sg-card{width:54px;height:76px;padding:5px;}.sg-hand{min-height:76px;}.sg-title{font-size:18px;}}' +
        '@media (prefers-reduced-motion:reduce){.sg-seat,.sg-card,.sg-btn{transition:none;}}');
    },
    render: function(state, container, playerIndex) {
      S = state;
      me = playerIndex;
      if (!S || !S.players || !S.players.length) return;
      var key = (S.ask ? S.ask.seq : 'x') + ':' + S.winner;
      if (key !== lastKey) { selCards = []; selTargets = []; lastKey = key; }
      var ids = (S.players[me] ? S.players[me].hand : []).map(function(c) { return c.id; });
      selCards = selCards.filter(function(id) { return ids.indexOf(id) >= 0 || (S.players[me] && Object.keys(S.players[me].equip).some(function(s) { return S.players[me].equip[s].id === id; })); });
      draw();
    },
  });
})();
