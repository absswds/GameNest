// public/js/renderers/sanguo.js
// 三国身份局 — a lacquered table: other generals sit round the edge (right column, top row,
// left column, counter-clockwise from your right), the current settlement shows in the middle,
// and your dashboard (general, skills, hand, buttons) is pinned to the bottom.
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
  var EQUIPS = ['zhuge', 'qinggang', 'cixiong', 'hanbing', 'guanshi', 'qinglong', 'zhangba', 'fangtian', 'qilin', 'bagua', 'renwang', 'jueying', 'dilu', 'zhuahuang', 'chitu', 'dawan', 'zixing'];

  var S = null, me = -1, selCards = [], selTargets = [], timer = null, lastKey = '';
  var host = null, root = null, askTotal = 0, showLog = false, openSkill = '';
  var prevHp = null, prevAlive = null, lastSig = null, prevHand = null, cramped = false;

  function P(i) { return S.players[i]; }
  function gname(i) { return i === me ? t('sg_you') : t('sg_g_' + P(i).general); }
  function cname(c) { return t('sg_c_' + (c.name || c)); }
  function isRed(c) { return c.suit === 'H' || c.suit === 'D'; }
  function rank(c) { return RANK[c.rank] || c.rank; }
  function cardText(c) { return cname(c) + ' ' + SUIT[c.suit] + rank(c); }
  function kindOf(name) {
    if (name === 'sha' || name === 'shan' || name === 'tao') return 'basic';
    return EQUIPS.indexOf(name) >= 0 ? 'equip' : 'trick';
  }
  function weaponName(i) { return P(i).equip.weapon && P(i).equip.weapon.name; }
  function $(r) { return root && root.querySelector('[data-r="' + r + '"]'); }
  function seatEl(i) { return root && root.querySelector('.sg-seat[data-i="' + i + '"]'); }

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

  // ---------- pieces ----------
  function cardHtml(c, opts) {
    opts = opts || {};
    var name = cname(c), long = name.length > 2;
    var cls = 'sg-card ' + kindOf(c.name) + (isRed(c) ? ' red' : '') + (opts.sel ? ' sel' : '') + (opts.off ? ' off' : '') + (opts.cls || '');
    var click = opts.click ? ' onclick="' + opts.click + '"' : ' tabindex="-1"';
    return '<button class="' + cls + '"' + click + (opts.id !== undefined ? ' data-c="' + opts.id + '"' : '') + '>' +
      '<span class="r">' + rank(c) + '<small>' + SUIT[c.suit] + '</small></span>' +
      '<span class="n' + (long ? ' long' : '') + '">' + esc(name) + '</span><span class="v">' + esc(name) + '</span>' +
      '<span class="k">' + t('sg_kind_' + kindOf(c.name)) + '</span></button>';
  }

  function hpHtml(p) {
    var h = '', cls = p.hp <= 1 ? ' low' : p.hp * 2 <= p.maxHp ? ' mid' : '';
    for (var k = 0; k < p.maxHp; k++) h += '<i class="' + (k < p.hp ? 'on' : '') + '"></i>';
    return '<span class="sg-hp' + cls + '">' + h + '</span>';
  }

  function equipHtml(p) {
    var out = '';
    ['weapon', 'armor', 'plus', 'minus'].forEach(function(slot) {
      if (p.equip && p.equip[slot]) out += '<span title="' + esc(t('sg_slot_' + slot)) + '">' + esc(cname(p.equip[slot])) + (slot === 'plus' ? ' +1' : slot === 'minus' ? ' -1' : '') + '</span>';
    });
    (p.judge || []).forEach(function(c) { out += '<span class="jd" title="' + esc(t('sg_judge_zone')) + '">' + esc(cname(c).charAt(0)) + '</span>'; });
    return out ? '<span class="sg-eq">' + out + '</span>' : '';
  }

  function seatHtml(i, x, y) {
    var p = P(i), a = S.ask, mine = i === me;
    var cls = 'sg-seat' + (mine ? ' mine' : '') + (!p.alive ? ' dead' : '') + (S.current === i && S.winner === null ? ' turn' : '') +
      (a && a.to === i && S.winner === null && !mine ? ' asked' : '') + (selTargets.indexOf(i) >= 0 ? ' picked' : '') + (selectableSeat(i) ? ' pickable' : '') +
      (selCards.length && myAsk() && myAsk().type === 'play' && !mine && !selectableSeat(i) ? ' off' : '');
    var role = p.role ? '<span class="rl r-' + p.role + '">' + t('sg_role_' + p.role) + '</span>' : '';
    var order = selTargets.indexOf(i) >= 0 ? '<b class="sg-order">' + (selTargets.length > 1 ? (selTargets.indexOf(i) + 1) : t('sg_target')) + '</b>' : '';
    var click = selectableSeat(i) || selTargets.indexOf(i) >= 0 ? ' onclick="window._sgSeat(' + i + ')"' : ' onclick="window._sgInfo(' + i + ')"';
    var gn = t('sg_g_' + p.general);
    var pos = x !== undefined ? ' style="--x:' + x + '%;--y:' + y + '%"' : '';
    return '<button class="' + cls + ' k-' + p.kingdom + '" data-i="' + i + '"' + pos + click + '>' + order +
      '<span class="sg-port" data-dead="' + esc(t('sg_dead')) + '"><span class="kd">' + t('sg_k_' + p.kingdom) + '</span>' + role +
        '<span class="ch">' + esc(gn.charAt(0)) + '</span><span class="nm">' + esc(gn) + '</span></span>' +
      '<span class="sg-meta">' + hpHtml(p) + (p.alive ? '<span class="hc">' + p.handCount + '</span>' : '') + '</span>' +
      equipHtml(p) + '</button>';
  }

  // Seats go round the table counter-clockwise from my right: right edge, top edge, left edge.
  function positions(m, portrait, short) {
    var side = portrait ? (m <= 2 ? 0 : m <= 4 ? 1 : 2) : short ? (m <= 2 ? 0 : 1) : (m <= 2 ? 0 : m <= 5 ? 1 : 2);
    var top = m - 2 * side, pos = [], i;
    var ys = side === 1 ? [50] : [portrait ? 76 : 68, portrait ? 44 : 34];
    for (i = 0; i < side; i++) pos.push([96, ys[i]]);
    for (i = 0; i < top; i++) {
      var span = side ? (top > 3 ? 64 : 56) : 44;
      pos.push([top === 1 ? 50 : 50 + span / 2 - i * (span / (top - 1)), portrait ? 12 : 10]);
    }
    for (i = side - 1; i >= 0; i--) pos.push([4, ys[i]]);
    return pos;
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

  // The current settlement: the last card used this turn plus every answer / judgement after it.
  function settlement() {
    var log = S.log || [], start = -1;
    for (var k = log.length - 1; k >= 0; k--) {
      if (log[k].t === 'turn') break;
      if (log[k].t === 'use' || (log[k].t === 'judge' && start < 0)) { start = k; if (log[k].t === 'use') break; }
    }
    if (start < 0) return null;
    var items = [];
    for (k = start; k < log.length; k++) {
      var e = log[k];
      if (e.t === 'turn') break;
      if (e.t === 'use' || e.t === 'respond') (e.cards || []).forEach(function(c) { items.push({ c: c, p: e.p, k: k, as: e.t === 'use' && c.name !== e.name ? e.name : null }); });
      if (e.t === 'judge') items.push({ c: e.card, p: e.p, k: k, judge: true });
    }
    return { head: log[start], items: items };
  }

  function centerHtml() {
    var a = myAsk();
    // A choice the engine needs from me (五谷 / which card to take) replaces the settlement view.
    if (a && (a.type === 'wugu' || a.type === 'pick')) {
      var body = '';
      if (a.type === 'wugu') a.cards.forEach(function(c) { body += cardHtml(c, { click: 'window._sgWugu(' + c.id + ')' }); });
      else {
        var T = P(a.target);
        if (T.handCount) body += '<button class="sg-back" onclick="window._sgPick(\'hand\')"><span>' + t('sg_blind_hand') + '</span><b>' + T.handCount + '</b></button>';
        ['weapon', 'armor', 'plus', 'minus'].forEach(function(slot) { if (T.equip[slot]) body += cardHtml(T.equip[slot], { click: 'window._sgPick(\'table\',' + T.equip[slot].id + ')' }); });
        if (!a.noJudge) (T.judge || []).forEach(function(c) { body += cardHtml(c, { click: 'window._sgPick(\'table\',' + c.id + ')' }); });
      }
      return '<div class="sg-choice"><div class="cards">' + body + '</div></div>';
    }
    var st = settlement(), out = '';
    if (st && st.items.length) {
      var show = st.items.slice(-5), hidden = st.items.length - show.length;
      out += '<div class="cards pz">' + (hidden ? '<span class="pz-more">+' + hidden + '</span>' : '') + show.map(function(it) {
        return '<div class="pz-it" data-k="' + it.k + '" data-p="' + it.p + '">' + cardHtml(it.c) +
          '<span class="who">' + esc(gname(it.p)) + (it.as ? '→' + esc(t('sg_c_' + it.as)) : it.judge ? '·' + esc(t('sg_judge_zone')) : '') + '</span></div>';
      }).join('') + '</div>';
      var h = st.head;
      out += '<span class="cap">' + esc(logLine(h)) + '</span>';
    }
    var rows = [];
    for (var i = (S.log || []).length - 1; i >= 0 && rows.length < 2; i--) {
      var line = logLine(S.log[i]);
      if (line && S.log[i].t !== 'use') rows.push('<div>' + esc(line) + '</div>');
    }
    return out + '<div class="sg-log">' + rows.join('') + '</div>';
  }

  function btn(label, onclick, kind, disabled) {
    return '<button class="sgb' + (kind ? ' ' + kind : '') + '"' + (disabled ? ' disabled' : '') + ' onclick="' + onclick + '">' + label + '</button>';
  }

  // The prompt line and the buttons that answer it: { hint, btns }
  function prompt() {
    if (S.winner !== null) {
      var key = S.winner === -2 ? 'sg_win_lord' : S.winner === -3 ? 'sg_win_rebel' : 'sg_win_spy';
      return { hint: '<em>' + t(key) + '</em>', btns: '' };
    }
    var a = S.ask;
    if (!a) return { hint: '', btns: '' };
    if (a.to !== me) return { hint: tf('sg_waiting', esc(t('sg_g_' + P(a.to).general))), btns: '', wait: true };
    var hint = '', btns = '', n = selCards.length;
    if (a.type === 'play') {
      var opts = playOptions();
      hint = t('sg_ask_play');
      if (n === 1 && handCard(selCards[0]) && TARGETS_NEEDED[handCard(selCards[0]).name] === 1) hint = selTargets.length ? tf('sg_confirm_to', esc(gname(selTargets[0]))) : tf('sg_pick_target', esc(cname(handCard(selCards[0]))));
      opts.forEach(function(o, k) {
        var ok = !o.off && (o.selfDefault ? selTargets.length <= 1 : o.need === 0 || o.need === selTargets.length);
        btns += btn(esc(o.label) + (o.need > 1 ? ' ' + selTargets.length + '/' + o.need : ''), 'window._sgPlay(' + k + ')', 'ok', !ok);
      });
      if (n === 1 && handCard(selCards[0]) && handCard(selCards[0]).name === 'jiedao') hint = t('sg_hint_jiedao');
      if (opts.some(function(o) { return o.data.skill === 'lijian'; }) && n === 1) hint = t('sg_hint_lijian');
      if (n) btns += btn(t('sg_cancel'), 'window._sgClear()');
      btns += btn(t('sg_end_turn'), 'window._sgEnd()');
    } else if (a.type === 'respond') {
      if (a.need === 'wuxie') hint = tf('sg_ask_wuxie', esc(t('sg_c_' + a.trick)), esc(a.target >= 0 ? gname(a.target) : ''));
      else if (a.need === 'tao') hint = tf('sg_ask_tao', esc(gname(a.dying)));
      else if (a.need === 'any') hint = tf('sg_ask_any', esc(gname(a.from)));
      else if (a.reason === 'juedou') hint = t('sg_ask_juedou');
      else if (a.reason === 'jiedao') hint = tf('sg_ask_jiedao', esc(gname(a.from)));
      else hint = a.from >= 0 && a.from !== me ? tf('sg_ask_need_from', esc(gname(a.from)), esc(t('sg_c_' + a.need))) : tf('sg_ask_need', esc(t('sg_c_' + a.need)));
      var need2 = a.need === 'sha' && weaponName(me) === 'zhangba' && n === 2;
      btns = btn(t('sg_respond'), 'window._sgRespond()', 'ok', !(n === 1 || need2)) + btn(t('sg_pass'), 'window._sgPass()');
    } else if (a.type === 'discard') {
      hint = a.reason === 'guanshi' ? t('sg_ask_guanshi') : a.reason === 'ganglie' ? t('sg_ask_ganglie') : tf('sg_ask_limit', a.count);
      btns = btn(t('sg_confirm') + ' ' + n + '/' + a.count, 'window._sgDiscard()', 'ok', n !== a.count) + (a.optional ? btn(t('sg_pass'), 'window._sgPass()') : '');
    } else if (a.type === 'pick') {
      hint = tf(a.mode === 'take' ? 'sg_ask_pick_take' : 'sg_ask_pick_discard', esc(gname(a.target)));
    } else if (a.type === 'wugu') {
      hint = t('sg_ask_wugu');
    } else if (a.type === 'confirm') {
      hint = tf('sg_ask_hanbing', esc(gname(a.target)));
      btns = btn(t('sg_yes'), 'window._sgConfirm(true)', 'ok') + btn(t('sg_no'), 'window._sgConfirm(false)');
    }
    return { hint: hint, btns: btns };
  }

  function handHtml() {
    var p = P(me), a = myAsk();
    var cards = p.hand.map(function(c) {
      var en = cardEnabled(c);
      return cardHtml(c, { id: c.id, click: en ? 'window._sgCard(' + c.id + ')' : null, sel: selCards.indexOf(c.id) >= 0, off: !en && !!a, cls: prevHand && prevHand.indexOf(c.id) < 0 ? ' drawn' : '' });
    }).join('');
    if (a && a.type === 'discard' && a.allowEquip) {
      ['weapon', 'armor', 'plus', 'minus'].forEach(function(slot) {
        var c = p.equip[slot];
        if (c && c.name !== 'guanshi') cards += cardHtml(c, { id: c.id, click: 'window._sgCard(' + c.id + ')', sel: selCards.indexOf(c.id) >= 0, cls: ' eqc' });
      });
    }
    return cards || '<span class="sg-empty">' + tf('sg_hand', 0) + '</span>';
  }

  function skillsHtml() {
    var p = P(me);
    return (SKILLS[p.general] || []).map(function(k) {
      return '<button class="sg-skill' + (ACTIVE[p.general] === k ? '' : ' passive') + (openSkill === k ? ' open' : '') + '" onclick="window._sgSkill(\'' + k + '\')">' + esc(t('sg_s_' + k)) + '</button>';
    }).join('');
  }

  function popoverHtml() {
    if (openSkill) return '<div class="sg-pop" onclick="window._sgSkill(\'\')"><b>' + esc(t('sg_s_' + openSkill)) + '</b>' + esc(t('sg_sd_' + openSkill)) + '</div>';
    if (showLog) {
      var rows = [];
      for (var i = (S.log || []).length - 1; i >= 0 && rows.length < 40; i--) { var l = logLine(S.log[i]); if (l) rows.push('<li>' + esc(l) + '</li>'); }
      return '<div class="sg-pop log" onclick="window._sgLog()"><b>' + t('sg_log_title') + '</b><ul>' + rows.join('') + '</ul></div>';
    }
    return '';
  }

  // ---------- skeleton & draw ----------
  function build() {
    root.innerHTML = '<div class="sg"><div class="sg-table" data-r="table"><div class="sg-seats" data-r="seats"></div>' +
      '<div class="sg-center" data-r="center"></div><svg class="sg-lines" data-r="lines"></svg><div data-r="pop"></div></div>' +
      '<div class="sg-dash"><div class="sg-prompt"><span class="txt" data-r="hint"></span><span class="sg-chips" data-r="chips"></span><span class="sg-bar"><i id="sgBar"></i></span><span class="sg-sec" id="sgSec"></span></div>' +
      '<div class="sg-me"><div data-r="me"></div><div class="sg-skills" data-r="skills"></div></div>' +
      '<div class="sg-hand" data-r="hand"></div><div class="sg-btns" data-r="btns"></div></div></div>';
  }

  function fit() {
    if (!host || !root) return;
    var f = window.boardFit ? window.boardFit(host) : { w: window.innerWidth - 32, h: window.innerHeight - 200 };
    root.style.width = Math.max(300, f.w) + 'px';
    cramped = false;
    var short = f.h < 440;
    root.style.height = (short ? window.innerHeight - 8 : Math.max(560, Math.min(f.h, 1000))) + 'px';
    if (short && root.getBoundingClientRect().top > 4) root.scrollIntoView({ block: 'end' });
    if (S) draw();
  }

  function draw() {
    if (!root || !S || !S.players || !S.players[me]) return;
    if (!root.firstChild) build();
    var w = root.clientWidth, h = root.clientHeight, portrait = h > w, short = !portrait && h < 560;
    var others = [];
    for (var k = 1; k < S.n; k++) others.push((me + k) % S.n);
    var pos = positions(others.length, portrait, short || cramped);
    $('seats').innerHTML = others.map(function(i, j) { return seatHtml(i, pos[j][0], pos[j][1]); }).join('');
    // Two seats per side don't fit on a low table (e.g. tablet landscape): fall back to one per side.
    if (!portrait && !short && !cramped && others.length >= 6) {
      var lo = seatEl(others[0]).getBoundingClientRect(), hi = seatEl(others[1]).getBoundingClientRect();
      if (lo.top < hi.bottom + 6) { cramped = true; return draw(); }
    }
    root.firstChild.classList.toggle('cramped', cramped);
    $('center').innerHTML = centerHtml();
    $('pop').innerHTML = popoverHtml();
    var pr = prompt();
    $('hint').innerHTML = pr.hint;
    $('hint').classList.toggle('wait', !!pr.wait);
    $('chips').innerHTML = '<span class="sg-chip rd">' + tf('sg_round', S.round) + '</span><span class="sg-chip">' + tf('sg_deck', S.deckCount) + '</span>' +
      '<button class="sg-chip btn" onclick="window._sgLog()">' + t('sg_log_title') + '</button>';
    $('btns').innerHTML = pr.btns;
    $('me').innerHTML = seatHtml(me);
    $('skills').innerHTML = skillsHtml();
    $('hand').innerHTML = handHtml();
    fitHand();
    tick();
    requestAnimationFrame(function() { drawLines(); effects(); });
  }

  // Hand: overlap only as much as needed to fit; below ~30% visible width, scroll instead.
  function fitHand() {
    var hand = $('hand'), cs = hand.querySelectorAll('.sg-card'), n = cs.length;
    if (!n) return;
    var cw = cs[0].offsetWidth, W = hand.clientWidth - 8, portrait = root.clientHeight > root.clientWidth;
    var step = Math.min(cw * (portrait ? 0.74 : 0.88), n > 1 ? (W - cw) / (n - 1) : cw);
    step = Math.max(step, cw * 0.3);
    for (var i = 0; i < n; i++) cs[i].style.marginLeft = i ? (step - cw) + 'px' : '0';
    hand.classList.toggle('tight', step < cw * 0.62);
  }

  function centerOf(el, box) {
    var r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    return [r.left + r.width / 2 - b.left, r.top + r.height / 2 - b.top];
  }
  function curve(a, b) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 40;
    return 'M' + a[0] + ',' + a[1] + ' Q' + mx + ',' + my + ' ' + b[0] + ',' + b[1];
  }
  function drawLines() {
    var svg = $('lines'), table = $('table');
    if (!svg) return;
    var out = '', st = settlement();
    if (st && st.head.t === 'use' && st.head.targets) {
      var from = seatEl(st.head.p);
      st.head.targets.forEach(function(ti) {
        var to = seatEl(ti);
        if (from && to && ti !== st.head.p) out += '<path class="hit" d="' + curve(centerOf(from, table), centerOf(to, table)) + '"/>';
      });
    }
    var origin = root.querySelector('.sg-hand .sg-card.sel') || seatEl(me);
    selTargets.forEach(function(ti) {
      var to = seatEl(ti);
      if (origin && to) out += '<path class="aim" d="' + curve(centerOf(origin, table), centerOf(to, table)) + '"/>';
    });
    svg.innerHTML = out;
  }

  function floatText(el, text, cls) {
    if (!el) return;
    var f = document.createElement('span');
    f.className = 'sg-float ' + cls;
    f.textContent = text;
    el.appendChild(f);
    setTimeout(function() { if (f.parentNode) f.parentNode.removeChild(f); }, 1300);
  }

  // Animate what changed since the last frame: hp, deaths, newly played cards.
  function effects() {
    if (prevHp) {
      S.players.forEach(function(p, i) {
        var el = seatEl(i), d = p.hp - prevHp[i];
        if (!el) return;
        if (d < 0) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); floatText(el, String(d), 'dmg'); }
        if (d > 0) floatText(el, '+' + d, 'heal');
        if (prevAlive[i] && !p.alive) el.classList.add('die');
      });
    }
    var log = S.log || [], fresh = -1;
    if (lastSig) for (var k = log.length - 1; k >= 0; k--) if (JSON.stringify(log[k]) === lastSig) { fresh = k + 1; break; }
    if (fresh >= 0 && window.Motion) {
      root.querySelectorAll('.pz-it').forEach(function(it) {
        if (+it.dataset.k < fresh) return;
        var src = seatEl(+it.dataset.p);
        if (src) window.Motion.flyFrom(it, src.getBoundingClientRect(), 380);
      });
    }
    prevHp = S.players.map(function(p) { return p.hp; });
    prevAlive = S.players.map(function(p) { return p.alive; });
    lastSig = log.length ? JSON.stringify(log[log.length - 1]) : null;
    prevHand = P(me).hand.map(function(c) { return c.id; });
  }

  function tick() {
    var bar = document.getElementById('sgBar'), sec = document.getElementById('sgSec');
    if (!bar || !S) return;
    var left = S.winner === null && S.ask && S.ask.deadline ? Math.max(0, (S.ask.deadline - Date.now()) / 1000) : 0;
    var frac = askTotal > 0 ? Math.min(1, left / askTotal) : 0;
    bar.style.width = (frac * 100) + '%';
    var urgent = left > 0 && left <= 5 && S.ask.to === me;
    bar.classList.toggle('urgent', urgent);
    sec.textContent = left ? Math.ceil(left) + 's' : '';
    sec.classList.toggle('urgent', urgent);
  }

  // ---------- actions ----------
  window._sgCard = function(id) {
    var i = selCards.indexOf(id), max = maxSelect();
    if (i >= 0) selCards.splice(i, 1);
    else if (max === 1) selCards = [id];
    else if (selCards.length < max) selCards.push(id);
    if (!selCards.length) selTargets = [];
    draw();
  };
  window._sgSeat = function(i) {
    var k = selTargets.indexOf(i);
    if (k >= 0) selTargets.splice(k, 1);
    else { selTargets.push(i); if (selTargets.length > 2) selTargets.shift(); }
    draw();
  };
  window._sgInfo = function(i) {
    var g = P(i).general;
    openSkill = openSkill === (SKILLS[g] || [])[0] ? '' : (SKILLS[g] || [])[0] || '';
    showLog = false;
    draw();
  };
  window._sgSkill = function(k) { openSkill = openSkill === k ? '' : k; showLog = false; draw(); };
  window._sgLog = function() { showLog = !showLog; openSkill = ''; draw(); };
  window._sgClear = function() { selCards = []; selTargets = []; draw(); };
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

  var CSS = '' +
    '.sg-root{position:relative;container-type:size;container-name:sg;margin:0 auto;border-radius:18px;overflow:hidden;max-width:100%}' +
    '.sg{--gold:#d9b46a;--gold2:#f1d595;--ink:#2a1d14;--shu:#c0392b;--wei:#2f6db5;--wu:#2e8b57;--qun:#8d7a52;--sw:clamp(70px,12cqw,112px);' +
      'position:absolute;inset:0;display:grid;grid-template-rows:minmax(0,1fr) auto;color:#f3e6c8;font-family:inherit;' +
      'background:radial-gradient(ellipse 80% 60% at 50% 45%,#4a3324 0%,#2b1d15 55%,#160f0b 100%)}' +
    '.sg::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.18;' +
      'background:repeating-linear-gradient(90deg,transparent 0 3px,rgba(255,255,255,.04) 3px 4px),repeating-linear-gradient(0deg,transparent 0 7px,rgba(0,0,0,.08) 7px 8px)}' +
    '.sg-table{position:relative;min-height:0}' +
    /* seats */
    '.sg-seat{all:unset;box-sizing:border-box;position:relative;display:block;width:var(--sw);border-radius:10px;padding:3px;cursor:pointer;-webkit-tap-highlight-color:transparent;' +
      'background:linear-gradient(160deg,#6b5236,#2c2016);box-shadow:0 6px 16px rgba(0,0,0,.45);transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s,filter .3s}' +
    '.sg-seats .sg-seat{position:absolute;transform:translate(-50%,-50%);z-index:2;' +
      'left:clamp(calc(var(--sw) / 2 + 8px),var(--x),calc(100% - var(--sw) / 2 - 8px));top:clamp(calc(var(--sw) * .8 + 6px),var(--y),calc(100% - var(--sw) * .8 - 6px))}' +
    '.sg-port{position:relative;display:flex;align-items:center;justify-content:center;aspect-ratio:3/3.4;border-radius:7px;overflow:hidden;background:linear-gradient(160deg,var(--kc),#1a120c)}' +
    '.k-shu{--kc:var(--shu)}.k-wei{--kc:var(--wei)}.k-wu{--kc:var(--wu)}.k-qun{--kc:var(--qun)}' +
    '.sg-port::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.28),transparent 60%),linear-gradient(transparent 55%,rgba(0,0,0,.55))}' +
    '.sg-port .ch{font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:calc(var(--sw) * .52);color:rgba(255,248,230,.92);text-shadow:0 2px 6px rgba(0,0,0,.4);line-height:1;transform:translateY(-6%)}' +
    '.sg-port .nm{position:absolute;left:0;right:0;bottom:3px;text-align:center;font-size:calc(var(--sw) * .15);font-weight:700;color:#fff;z-index:1;letter-spacing:.05em;white-space:nowrap;overflow:hidden}' +
    '.sg-port .kd{position:absolute;left:3px;top:3px;width:calc(var(--sw) * .22);height:calc(var(--sw) * .22);border-radius:50%;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.5);font-size:calc(var(--sw) * .13);display:flex;align-items:center;justify-content:center;z-index:1;font-family:"Ma Shan Zheng","LXGW WenKai",serif}' +
    '.sg-port .rl{position:absolute;right:3px;top:3px;z-index:1;font-size:11px;line-height:17px;padding:0 5px;border-radius:4px;background:#ddd;color:var(--ink);font-weight:700}' +
    '.rl.r-lord{background:var(--gold)}.rl.r-rebel{background:#d24a3a;color:#fff}.rl.r-loyal{background:#e6d6a8}.rl.r-spy{background:#5a5f8a;color:#fff}' +
    '.sg-meta{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:4px 2px 1px}' +
    '.sg-hp{display:flex;gap:2px;flex-wrap:wrap;min-width:0}' +
    '.sg-hp i{width:max(6px,calc(var(--sw) * .085));height:max(8px,calc(var(--sw) * .115));border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:#3a3a3a;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15);transition:background .4s}' +
    '.sg-hp i.on{background:radial-gradient(circle at 35% 30%,#9cf09a,#2e9b45 60%,#1c6b2c)}' +
    '.sg-hp.mid i.on{background:radial-gradient(circle at 35% 30%,#ffe28a,#d9a21c 60%,#9a6d0b)}' +
    '.sg-hp.low i.on{background:radial-gradient(circle at 35% 30%,#ff9d8a,#d0352a 60%,#8a1a12);animation:sg-beat 1.2s infinite}' +
    '@keyframes sg-beat{50%{transform:scale(1.18)}}' +
    '.hc{font-size:12px;font-weight:700;min-width:22px;height:20px;padding:0 4px;box-sizing:border-box;border-radius:5px;background:#f3e6c8;color:var(--ink);display:flex;align-items:center;justify-content:center;box-shadow:1px 1px 0 #a68b5b}' +
    '.sg-eq{display:flex;flex-wrap:wrap;gap:2px;padding:2px 1px 1px}' +
    '.sg-eq span{font-size:10px;line-height:15px;padding:0 4px;border-radius:3px;background:rgba(0,0,0,.4);color:#e8d7b0;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}' +
    '.sg-eq span.jd{background:#7a1f18;color:#ffd9cf;font-family:"Ma Shan Zheng","LXGW WenKai",serif}' +
    '.sg-seat.turn{box-shadow:0 0 0 2px var(--gold2),0 0 18px 4px rgba(241,213,149,.55);animation:sg-glow 2s ease-in-out infinite}' +
    '@keyframes sg-glow{50%{box-shadow:0 0 0 2px var(--gold2),0 0 26px 8px rgba(241,213,149,.35)}}' +
    '.sg-seat.asked{box-shadow:0 0 0 2px #ff7a5c,0 0 16px 3px rgba(255,122,92,.5)}' +
    '.sg-seat.pickable{box-shadow:0 0 0 2px rgba(255,255,255,.6),0 6px 16px rgba(0,0,0,.45)}' +
    '.sg-seats .sg-seat.picked{box-shadow:0 0 0 3px #ff5a45,0 0 22px 6px rgba(255,90,69,.6);transform:translate(-50%,-56%)}' +
    '.sg-order{position:absolute;left:50%;top:-11px;transform:translateX(-50%);z-index:3;background:#ff5a45;color:#fff;font-size:11px;font-weight:700;padding:1px 8px;border-radius:9px;white-space:nowrap}' +
    '.sg-seat.off{filter:saturate(.4) brightness(.7)}' +
    '.sg-seat.dead{filter:grayscale(1) brightness(.6)}' +
    '.sg-seat.dead .sg-port::before{content:attr(data-dead);position:absolute;z-index:2;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-18deg);font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:calc(var(--sw) * .3);color:#ff6b5a;border:2px solid #ff6b5a;padding:0 6px;border-radius:6px;white-space:nowrap}' +
    '.sg-seat.die .sg-port::before{animation:sg-stamp .5s cubic-bezier(.2,.8,.2,1)}' +
    '@keyframes sg-stamp{from{transform:translate(-50%,-50%) rotate(-18deg) scale(2.4);opacity:0}}' +
    '.sg-seat.hit{animation:sg-shake .45s}' +
    '.sg-seat.hit .sg-port::after{animation:sg-flash .6s}' +
    '@keyframes sg-shake{20%{translate:-5px 0}40%{translate:5px 0}60%{translate:-3px 0}80%{translate:2px 0}}' +
    '@keyframes sg-flash{0%,40%{background:rgba(255,40,30,.55)}}' +
    '.sg-float{position:absolute;left:50%;top:30%;z-index:5;font-size:calc(var(--sw) * .34);font-weight:900;pointer-events:none;transform:translateX(-50%);animation:sg-up 1.2s cubic-bezier(.2,.8,.2,1) forwards;text-shadow:0 2px 6px rgba(0,0,0,.6)}' +
    '.sg-float.dmg{color:#ff6b5a}.sg-float.heal{color:#8cf08a}' +
    '@keyframes sg-up{from{opacity:0;transform:translate(-50%,10px) scale(.6)}20%{opacity:1;transform:translate(-50%,0) scale(1.1)}to{opacity:0;transform:translate(-50%,-40px)}}' +
    /* center */
    '.sg-center{position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:6px;z-index:1;max-width:70%}' +
    '.sg-chips{display:flex;gap:6px;flex:none}' +
    '.sg.cramped .sg-center{top:66%}.sg.cramped .sg-log div:nth-child(2){display:none}' +
    '.sg-chip{all:unset;font-size:12px;line-height:24px;padding:0 10px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid rgba(217,180,106,.35);color:var(--gold2);white-space:nowrap}' +
    '.sg-chip.btn{cursor:pointer}' +
    '.sg-center .cards{display:flex;gap:6px;justify-content:center}' +
    '.sg-center .cap{font-size:12px;color:var(--gold2);background:rgba(0,0,0,.35);padding:2px 10px;border-radius:10px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}' +
    '.pz{align-items:flex-start}.pz,.pz .sg-card{--cw:clamp(44px,7.5cqw,68px)}' +
    '.pz-it{display:flex;flex-direction:column;align-items:center;gap:3px;margin-left:calc(var(--cw) * -.28)}' +
    '.pz-it:first-child,.pz-more+.pz-it{margin-left:0}' +
    '.pz-it .who{font-size:11px;color:#f3e6c8;background:rgba(0,0,0,.5);padding:0 6px;border-radius:8px;white-space:nowrap}' +
    '.pz-it:not(:last-child) .sg-card{filter:brightness(.82)}' +
    '.pz-more{align-self:center;margin-right:6px;font-size:12px;color:var(--gold2);background:rgba(0,0,0,.45);border:1px solid rgba(217,180,106,.4);border-radius:10px;padding:2px 8px}' +
    '.sg-log{display:flex;flex-direction:column;align-items:center;gap:3px}' +
    '.sg-log div{font-size:12px;background:rgba(0,0,0,.4);padding:2px 9px;border-radius:9px;color:#e8d7b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}' +
    '.sg-log div:nth-child(2){opacity:.7}.sg-log div:nth-child(3){opacity:.45}' +
    '.sg-choice{padding:12px;border-radius:14px;background:rgba(20,12,8,.85);border:1px solid rgba(217,180,106,.5);box-shadow:0 10px 30px rgba(0,0,0,.5);animation:sg-in .3s cubic-bezier(.2,.8,.2,1)}' +
    '.sg-choice .cards{flex-wrap:wrap}' +
    '.sg-back{all:unset;cursor:pointer;width:var(--cw,64px);--cw:clamp(56px,9cqw,80px);height:calc(var(--cw) * 1.4);border-radius:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;' +
      'background:repeating-linear-gradient(45deg,#7a2a1c 0 6px,#6a2216 6px 12px);border:2px solid var(--gold);color:var(--gold2);font-size:11px;text-align:center}' +
    '.sg-back b{font-size:20px}' +
    '.sg-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;overflow:visible}' +
    '.sg-lines path{fill:none;stroke-width:2.5;stroke-linecap:round}' +
    '.sg-lines .hit{stroke:rgba(241,213,149,.7);stroke-dasharray:6 6;animation:sg-dash 1s linear infinite}' +
    '.sg-lines .aim{stroke:#ff5a45;stroke-width:3;stroke-dasharray:10 8;animation:sg-dash .6s linear infinite}' +
    '@keyframes sg-dash{to{stroke-dashoffset:-24}}' +
    '.sg-pop{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6;width:min(320px,80%);max-height:70%;overflow:auto;padding:12px 14px;border-radius:14px;cursor:pointer;' +
      'background:rgba(20,12,8,.94);border:1px solid rgba(217,180,106,.55);box-shadow:0 10px 30px rgba(0,0,0,.55);font-size:13px;line-height:1.6;color:#f3e6c8;animation:sg-in .25s cubic-bezier(.2,.8,.2,1)}' +
    '.sg-pop b{display:block;font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:20px;color:var(--gold2);font-weight:400;margin-bottom:4px}' +
    '.sg-pop ul{margin:0;padding:0;list-style:none}.sg-pop li{padding:2px 0;border-bottom:1px solid rgba(217,180,106,.12)}' +
    '@keyframes sg-in{from{opacity:0;transform:translate(-50%,-46%) scale(.96)}}' +
    '.sg-choice{animation-name:sg-in2}@keyframes sg-in2{from{opacity:0;transform:scale(.94)}}' +
    /* cards */
    '.sg-card{--cw:clamp(60px,9.5cqw,84px);all:unset;box-sizing:border-box;position:relative;flex:none;width:var(--cw);height:calc(var(--cw) * 1.4);border-radius:7px;cursor:default;color:var(--ink);' +
      'background:linear-gradient(170deg,#fbf3df,#ecdcb6);box-shadow:0 3px 8px rgba(0,0,0,.45),inset 0 0 0 1px rgba(120,90,50,.35),inset 0 0 0 4px #fbf3df,inset 0 0 0 5px rgba(150,110,60,.35);' +
      'transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s,opacity .18s,margin .2s}' +
    '.sg-card[onclick]{cursor:pointer}' +
    '.sg-card .r{position:absolute;left:6px;top:5px;font-size:calc(var(--cw) * .17);font-weight:700;line-height:1;text-align:center}.sg-card .r small{display:block;font-size:.85em}' +
    '.sg-card.red .r{color:#c0281c}' +
    '.sg-card .n{position:absolute;left:0;right:0;top:36%;text-align:center;font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:calc(var(--cw) * .27);line-height:1.05;padding:0 4px}' +
    '.sg-card .n.long{font-size:calc(var(--cw) * .25);width:2.1em;margin:0 auto;padding:0;top:28%;word-break:break-all}' +
    '.sg-card .v{display:none;position:absolute;left:4px;top:calc(var(--cw) * .44);writing-mode:vertical-rl;font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:calc(var(--cw) * .17);line-height:1}' +
    '.sg-card .k{position:absolute;left:5px;right:5px;bottom:5px;height:calc(var(--cw) * .16);border-radius:3px;font-size:calc(var(--cw) * .12);color:#fff;display:flex;align-items:center;justify-content:center;letter-spacing:.2em}' +
    '.sg-card.basic .k{background:#a5352a}.sg-card.trick .k{background:#2f6a8f}.sg-card.equip .k{background:#8a6a2c}' +
    '.sg-card.sel{transform:translateY(-14px);box-shadow:0 0 0 2px var(--gold2),0 10px 18px rgba(0,0,0,.55),inset 0 0 0 4px #fbf3df;z-index:2}' +
    '.sg-card.off{opacity:.38}' +
    '.sg-card.eqc{outline:2px dashed rgba(217,180,106,.7);outline-offset:-3px}' +
    '.sg-card.drawn{animation:sg-draw .45s cubic-bezier(.2,.8,.2,1)}' +
    '@keyframes sg-draw{from{transform:translateY(-40px) scale(.8);opacity:0}}' +
    /* dashboard */
    '.sg-dash{position:relative;z-index:4;display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:auto auto;gap:6px 10px;padding:8px 10px 10px;' +
      'background:linear-gradient(90deg,#2a1d14,#3a2a1d 50%,#2a1d14);border-top:1px solid rgba(217,180,106,.4)}' +
    '.sg-prompt{grid-column:1/-1;display:flex;align-items:center;gap:10px;min-width:0}' +
    '.sg-prompt .txt{flex:1;min-width:0;font-size:15px;font-weight:700;color:#fff3d6;line-height:1.35}' +
    '.sg-prompt .txt.wait{font-weight:400;color:#cdbb95}.sg-prompt .txt em{font-style:normal;color:var(--gold2)}' +
    '.sg-bar{width:90px;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;flex:none}' +
    '.sg-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--gold),var(--gold2));transition:width .5s linear}' +
    '.sg-bar i.urgent{background:#ff5a45}' +
    '.sg-sec{font-size:13px;color:var(--gold2);font-variant-numeric:tabular-nums;width:28px;text-align:right}.sg-sec.urgent{color:#ff7a5c;font-weight:800}' +
    '.sg-me{display:flex;gap:8px;align-items:center}' +
    '.sg-me .sg-seat{--sw:clamp(74px,11cqw,104px);cursor:pointer}' +
    '.sg-me .sg-seat.turn{animation:none}' +
    '.sg-skills{display:flex;flex-direction:column;gap:5px;justify-content:center}' +
    '.sg-skill{all:unset;cursor:pointer;font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:17px;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
      'background:radial-gradient(circle at 40% 35%,#5a4126,#2c1f14);border:1.5px solid var(--gold);color:var(--gold2);box-shadow:0 2px 6px rgba(0,0,0,.5);transition:transform .15s}' +
    '.sg-skill.passive{border-style:dashed;opacity:.85}.sg-skill.open{transform:scale(1.08);box-shadow:0 0 0 2px var(--gold2)}' +
    '.sg-hand{display:flex;align-items:flex-end;justify-content:safe center;min-width:0;overflow-x:auto;overflow-y:visible;padding:16px 4px 2px;scrollbar-width:none}' +
    '.sg-hand.tight .sg-card .v{display:block}' +
    '.sg-hand.tight .sg-card:not(:last-child):not(.sel) .n{visibility:hidden}' +
    '.sg-empty{font-size:13px;color:#a8977a;align-self:center;padding:20px 0}' +
    '.sg-btns{display:flex;flex-direction:column;gap:6px;justify-content:center}' +
    '.sgb{all:unset;cursor:pointer;min-width:84px;height:42px;padding:0 14px;box-sizing:border-box;border-radius:21px;text-align:center;font-size:15px;font-weight:700;letter-spacing:.1em;line-height:42px;white-space:nowrap;' +
      'background:linear-gradient(#4b3a2a,#2d2117);color:#e8d7b0;border:1px solid rgba(217,180,106,.5);transition:transform .12s,opacity .2s}' +
    '.sgb.ok{background:linear-gradient(#d4453a,#9a2219);color:#fff;border-color:#f1a08f;box-shadow:0 3px 10px rgba(184,50,42,.5)}' +
    '.sgb:active{transform:scale(.96)}.sgb:disabled{opacity:.4;cursor:default}' +
    '@media (hover:hover){.sg-hand .sg-card[onclick]:not(.sel):hover{transform:translateY(-6px)}.sg-seats .sg-seat.pickable:hover{transform:translate(-50%,-53%)}}' +
    '@container sg (orientation:portrait){' +
      '.sg{--sw:clamp(62px,18cqw,120px)}' +
      '.sg-seats .sg-port{aspect-ratio:1/1}' +
      '.sg-dash{grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto auto}' +
      '.sg-hand{grid-row:2;grid-column:1/-1}' +
      '.sg-me{grid-row:3;grid-column:1}' +
      '.sg-me .sg-seat{--sw:132px;display:grid;grid-template-columns:44px 1fr;grid-template-rows:auto auto;column-gap:6px;align-items:center;padding:4px}' +
      '.sg-me .sg-port{grid-row:1/3;aspect-ratio:1;width:44px}' +
      '.sg-me .sg-port .ch{font-size:28px}.sg-me .sg-port .nm,.sg-me .sg-port .kd,.sg-me .sg-port .rl{display:none}' +
      '.sg-me .sg-hp i{width:9px;height:12px}.sg-me .sg-meta,.sg-me .sg-eq{padding:0}' +
      '.sg-btns{grid-row:3;grid-column:2;flex-direction:row;justify-content:flex-end;align-items:center;gap:5px}' +
      '.sgb{min-width:0;flex:1 1 0;max-width:110px;padding:0 4px;letter-spacing:0;font-size:14px}' +
      '.sg-me{gap:5px}.sg-me .sg-seat{--sw:118px}.sg-skills{flex-direction:column;gap:3px}.sg-skill{width:32px;height:32px;font-size:13px}' +
      '.sg-card{--cw:clamp(54px,15cqw,92px)}' +
      '.sg-prompt{gap:6px}.sg-prompt .txt{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-chip{font-size:11px;padding:0 7px;line-height:22px}.sg-bar{width:48px}' +
      '.sg-center{top:50%;max-width:56%}.sg-log,.sg-chip.rd{display:none}.hc{min-width:18px;height:18px;font-size:11px}' +
    '}' +
    '@container sg (orientation:landscape) and (max-height:560px){' +
      '.sg{--sw:clamp(54px,18cqh,96px)}' +
      '.sg-seats .sg-port{aspect-ratio:1/1}.sg-seats .sg-eq{display:none}' +
      '.sg-card{--cw:clamp(46px,14cqh,72px)}' +
      '.sg-me .sg-seat{--sw:clamp(54px,15cqh,80px)}.sg-me .sg-port{aspect-ratio:1/1}' +
      '.sg-dash{padding-top:4px;padding-bottom:6px;gap:4px 8px}.sg-hand{padding-top:10px}' +
      '.sgb{height:34px;line-height:34px;min-width:72px;font-size:14px}' +
      '.sg-skill{width:36px;height:36px;font-size:14px}.sg-prompt .txt{font-size:14px}' +
      '.sg-log,.sg-chip.rd{display:none}.sg-center{top:66%}.pz,.pz .sg-card{--cw:clamp(38px,11cqh,58px)}' +
    '}' +
    '@media (prefers-reduced-motion:reduce){.sg *{animation:none!important;transition:none!important}}';

  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('sanguo', {
    init: function(container) {
      container.innerHTML = '<div class="sg-root" id="sgRoot"></div>';
      host = container;
      root = document.getElementById('sgRoot');
      S = null; selCards = []; selTargets = []; lastKey = ''; showLog = false; openSkill = '';
      prevHp = null; prevAlive = null; lastSig = null; prevHand = null;
      clearInterval(timer);
      timer = setInterval(tick, 250);
      injectStylesOnce('sg-styles-v2', CSS);
      if (!window._sgResize) {
        window._sgResize = true;
        window.addEventListener('resize', function() { if (root && document.body.contains(root)) fit(); });
      }
    },
    render: function(state, container, playerIndex) {
      S = state;
      me = playerIndex;
      if (!S || !S.players || !S.players.length || !S.players[me]) return;
      var key = (S.ask ? S.ask.seq : 'x') + ':' + S.winner;
      if (key !== lastKey) {
        selCards = []; selTargets = []; lastKey = key;
        askTotal = S.ask && S.ask.deadline ? Math.max(1, (S.ask.deadline - Date.now()) / 1000) : 0;
      }
      var ids = S.players[me].hand.map(function(c) { return c.id; });
      selCards = selCards.filter(function(id) { return ids.indexOf(id) >= 0 || Object.keys(S.players[me].equip).some(function(s) { return S.players[me].equip[s].id === id; }); });
      if (!root.style.height) { fit(); return; }
      draw();
    },
  });
})();
