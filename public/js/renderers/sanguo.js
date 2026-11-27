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

  var EASE_OUT = 'cubic-bezier(0.23,1,0.32,1)';
  var EASE_IN_OUT = 'cubic-bezier(0.77,0,0.175,1)';
  var EASE_POP = 'cubic-bezier(0.34,1.56,0.64,1)';

  var S = null, me = -1, selCards = [], selTargets = [], timer = null, lastKey = '';
  var host = null, root = null, askTotal = 0, showLog = false, openSkill = '', openSeat = -1, openCard = null, cardIndex = {};
  var prev = null, cramped = false, lastHandHtml = '', rafId = 0, lastPlayRect = null;
  var eventQueue = [], activeEvent = null, eventTimer = null;

  function isFs() { return !!(document.body && document.body.classList.contains('gn-fs')); }
  function isReduced() {
    return (window.Motion && typeof window.Motion.reduced === 'function' && window.Motion.reduced()) ||
      !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function playerName(i) {
    var list = window._players;
    if (!Array.isArray(list)) return '';
    for (var k = 0; k < list.length; k++) {
      if (list[k] && list[k].index === i) return list[k].name || '';
    }
    return '';
  }

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
  var SLOT_ICON = { weapon: '⚔', armor: '🛡', plus: '+1', minus: '-1' };
  function cdesc(c) { return t('sg_cd_' + (c.name || c)); }
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
    if (!a || a.type !== 'play' || !P(i).alive || !selCards.length) return false;
    var c = selCards.length === 1 && handCard(selCards[0]);
    // Jiedao's second target (who gets attacked) may be myself.
    if (i === me) return !!c && c.name === 'jiedao' && selTargets.length === 1;
    return playOptions().some(function(o) { return o.need > 0 || o.selfDefault; });
  }

  // ---------- pieces ----------
  function cardHtml(c, opts) {
    opts = opts || {};
    var name = cname(c), long = name.length > 2;
    var cls = 'sg-card ' + kindOf(c.name) + (isRed(c) ? ' red' : '') + (opts.sel ? ' sel' : '') + (opts.off ? ' off' : '') + (opts.cls || '');
    cardIndex[c.id] = c;
    var click = ' onclick="' + (opts.click || 'window._sgCardInfo(' + c.id + ')') + '"';
    return '<button class="' + cls + (opts.click ? ' act' : '') + '"' + click + ' title="' + esc(name + '：' + cdesc(c)) + '"' + (opts.id !== undefined ? ' data-c="' + opts.id + '"' : '') + '>' +
      '<span class="r">' + rank(c) + '<small>' + SUIT[c.suit] + '</small></span>' +
      '<span class="n' + (long ? ' long' : '') + '">' + esc(name) + '</span><span class="v">' + esc(name) + '</span>' +
      '<span class="k">' + t('sg_kind_' + kindOf(c.name)) + '</span></button>';
  }

  function hpHtml(p) {
    var h = '', cls = p.hp <= 1 ? ' low' : p.hp * 2 <= p.maxHp ? ' mid' : '';
    for (var k = 0; k < p.maxHp; k++) h += '<i class="' + (k < p.hp ? 'on' : '') + '" data-hp="' + k + '"><b></b></i>';
    return '<span class="sg-hp' + cls + '">' + h + '</span>';
  }

  function equipHtml(p, clickable) {
    var out = '';
    var tag = clickable ? 'button' : 'span';
    ['weapon', 'armor', 'plus', 'minus'].forEach(function(slot) {
      var c = p.equip && p.equip[slot];
      if (!c) return;
      cardIndex[c.id] = c;
      var click = clickable ? ' type="button" onclick="window._sgCardInfo(' + c.id + ')"' : '';
      out += '<' + tag + ' class="eq-' + slot + '"' + click + ' title="' + esc(cname(c) + '：' + cdesc(c)) + '"><i>' + SLOT_ICON[slot] + '</i><em>' + esc(cname(c)) + '</em></' + tag + '>';
    });
    (p.judge || []).forEach(function(c) {
      cardIndex[c.id] = c;
      var click = clickable ? ' type="button" onclick="window._sgCardInfo(' + c.id + ')"' : '';
      out += '<' + tag + ' class="jd"' + click + ' title="' + esc(t('sg_judge_zone') + '：' + cname(c)) + '">' + esc(cname(c).charAt(0)) + '</' + tag + '>';
    });
    return out ? '<span class="sg-eq">' + out + '</span>' : '';
  }

  function seatHtml(i, x, y, fsMode) {
    var p = P(i), a = S.ask, mine = i === me;
    var cls = 'sg-seat' + (mine ? ' mine' : '') + (!p.alive ? ' dead' : '') + (S.current === i && S.winner === null ? ' turn' : '') +
      (a && a.to === i && S.winner === null && (!mine || fsMode) ? ' asked' : '') + (selTargets.indexOf(i) >= 0 ? ' picked' : '') + (selectableSeat(i) ? ' pickable' : '') +
      (selCards.length && myAsk() && myAsk().type === 'play' && !mine && !selectableSeat(i) ? ' off' : '');
    var role = p.role ? '<span class="rl r-' + p.role + '">' + t('sg_role_' + p.role) + '</span>' : '';
    var order = selTargets.indexOf(i) >= 0 ? '<b class="sg-order">' + (selTargets.length > 1 ? (selTargets.indexOf(i) + 1) : t('sg_target')) + '</b>' : '';
    var click = selectableSeat(i) || selTargets.indexOf(i) >= 0 ? ' onclick="window._sgSeat(' + i + ')"' : ' onclick="window._sgInfo(' + i + ')"';
    var gn = t('sg_g_' + p.general);
    var pn = fsMode ? playerName(i) : '';
    var pnHtml = pn ? '<span class="pn">' + esc(pn) + '</span>' : '';
    var pos = x !== undefined ? (fsMode ? ' style="--x:' + Math.round(x) + 'px;--y:' + Math.round(y) + 'px"' : ' style="--x:' + x + '%;--y:' + y + '%"') : '';
    var eqBlock = fsMode && mine ? '' : equipHtml(p, false);
    return '<button class="' + cls + ' k-' + p.kingdom + '" data-i="' + i + '"' + pos + click + '>' + order +
      '<span class="sg-port" data-dead="' + esc(t('sg_dead')) + '"><span class="sg-flash-ov" aria-hidden="true"></span><span class="kd">' + t('sg_k_' + p.kingdom) + '</span>' + role +
        '<span class="ch">' + esc(gn.charAt(0)) + '</span><span class="nm">' + esc(gn) + '</span></span>' +
      '<span class="sg-meta">' + pnHtml + hpHtml(p) + (p.alive ? '<span class="hc">' + p.handCount + '</span>' : '') + '</span>' +
      eqBlock + '</button>';
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

  function centerHtml(fsMode, pr) {
    var a = myAsk();
    var st = settlement(), out = '';
    var one = selCards.length === 1 && (handCard(selCards[0]) || cardIndex[selCards[0]]);
    if (fsMode) {
      var meta = '<div class="sg-fs-meta">' +
        '<span class="sg-chip rd">' + tf('sg_round', S.round) + '</span>' +
        '<span class="sg-chip" data-r="deck">' + tf('sg_deck', S.deckCount) + '</span>' +
        '<span class="sg-chip">' + tf('sg_discard', S.discardCount || 0) + '</span>' +
        '<span class="sg-fs-timer"><span class="sg-fs-bar"><i data-r="fsBar"></i></span><span class="sg-fs-sec" data-r="fsSec"></span></span>' +
        '</div>';
      var stage = '';
      if (a && (a.type === 'wugu' || a.type === 'pick')) {
        var body = '';
        if (a.type === 'wugu') a.cards.forEach(function(c) { body += cardHtml(c, { click: 'window._sgWugu(' + c.id + ')' }); });
        else {
          var T = P(a.target);
          if (T.handCount) body += '<button class="sg-back" onclick="window._sgPick(\'hand\')"><span>' + t('sg_blind_hand') + '</span><b>' + T.handCount + '</b></button>';
          ['weapon', 'armor', 'plus', 'minus'].forEach(function(slot) { if (T.equip[slot]) body += cardHtml(T.equip[slot], { click: 'window._sgPick(\'table\',' + T.equip[slot].id + ')' }); });
          if (!a.noJudge) (T.judge || []).forEach(function(c) { body += cardHtml(c, { click: 'window._sgPick(\'table\',' + c.id + ')' }); });
        }
        stage = '<div class="sg-choice"><div class="cards">' + body + '</div></div>';
      } else {
        var played = '';
        if (st && st.items.length) {
          var show = st.items.slice(-5), hidden = st.items.length - show.length;
          played += '<div class="cards pz">' + (hidden ? '<span class="pz-more">+' + hidden + '</span>' : '') + show.map(function(it) {
            return '<div class="pz-it" data-k="' + it.k + '" data-p="' + it.p + '">' + cardHtml(it.c) +
              '<span class="who">' + esc(gname(it.p)) + (it.as ? '→' + esc(t('sg_c_' + it.as)) : it.judge ? '·' + esc(t('sg_judge_zone')) : '') + '</span></div>';
          }).join('') + '</div>';
          played += '<span class="cap">' + esc(logLine(st.head)) + '</span>';
        }
        var desc = one ? '<div class="sg-desc-inline"><b>' + esc(cname(one)) + '</b><span>' + esc(cdesc(one)) + '</span></div>' : '';
        stage = '<div class="sg-fs-played" data-r="played">' + played + '</div>' + desc;
      }
      var askLine = pr && pr.hint ? '<div class="sg-fs-ask' + (pr.wait ? ' wait' : '') + '">' + pr.hint + '</div>' : '';
      return meta + '<div class="sg-fs-stage"><div class="sg-fs-sc">' + stage + '</div></div>' +
        '<div class="sg-fs-act">' + askLine + '<div class="sg-fs-btns">' + ((pr && pr.fsCenter) || '') + '</div></div>';
    }
    // A choice the engine needs from me (五谷 / which card to take) replaces the settlement view.
    if (a && (a.type === 'wugu' || a.type === 'pick')) {
      var body2 = '';
      if (a.type === 'wugu') a.cards.forEach(function(c) { body2 += cardHtml(c, { click: 'window._sgWugu(' + c.id + ')' }); });
      else {
        var T2 = P(a.target);
        if (T2.handCount) body2 += '<button class="sg-back" onclick="window._sgPick(\'hand\')"><span>' + t('sg_blind_hand') + '</span><b>' + T2.handCount + '</b></button>';
        ['weapon', 'armor', 'plus', 'minus'].forEach(function(slot) { if (T2.equip[slot]) body2 += cardHtml(T2.equip[slot], { click: 'window._sgPick(\'table\',' + T2.equip[slot].id + ')' }); });
        if (!a.noJudge) (T2.judge || []).forEach(function(c) { body2 += cardHtml(c, { click: 'window._sgPick(\'table\',' + c.id + ')' }); });
      }
      return '<div class="sg-choice"><div class="cards">' + body2 + '</div></div>';
    }
    // One card picked from my hand: say what it does (tapping it selects it, so it can't open the info box)
    if (one) return '<div class="sg-desc"><b>' + esc(cname(one)) + '</b>' + esc(cdesc(one)) + '</div>';
    if (st && st.items.length) {
      var show2 = st.items.slice(-5), hidden2 = st.items.length - show2.length;
      out += '<div class="cards pz">' + (hidden2 ? '<span class="pz-more">+' + hidden2 + '</span>' : '') + show2.map(function(it) {
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

  // The prompt line and the buttons that answer it: { hint, btns, mainBtns, subBtns, rightHint }
  function prompt() {
    if (S.winner !== null) {
      var key = S.winner === -2 ? 'sg_win_lord' : S.winner === -3 ? 'sg_win_rebel' : 'sg_win_spy';
      return { hint: '<em>' + t(key) + '</em>', btns: '', mainBtns: '', subBtns: '', rightHint: '' };
    }
    var a = S.ask;
    if (!a) return { hint: '', btns: '', mainBtns: '', subBtns: '', rightHint: '' };
    if (a.to !== me) {
      var turnHint = S.current >= 0 && S.players[S.current] ? tf('sg_turn_of', esc(gname(S.current))) : '';
      return { hint: tf('sg_waiting', esc(t('sg_g_' + P(a.to).general))), btns: '', mainBtns: '', subBtns: '', wait: true, rightHint: turnHint };
    }
    var hint = '', mainBtns = '', subBtns = '', rightHint = '', n = selCards.length, centerSub = '', endBtn = '';
    if (a.type === 'play') {
      var opts = playOptions();
      var c0 = n === 1 && handCard(selCards[0]);
      hint = t('sg_ask_play');
      if (c0 && TARGETS_NEEDED[c0.name] === 1) hint = selTargets.length ? tf('sg_confirm_to', esc(gname(selTargets[0]))) : tf('sg_pick_target', esc(cname(c0)));
      opts.forEach(function(o, k) {
        var ok = !o.off && (o.selfDefault ? selTargets.length <= 1 : o.need === 0 || o.need === selTargets.length);
        mainBtns += btn(esc(o.label) + (o.need > 1 ? ' ' + selTargets.length + '/' + o.need : ''), 'window._sgPlay(' + k + ')', 'ok', !ok);
      });
      if (c0 && c0.name === 'jiedao') hint = t('sg_hint_jiedao');
      if (opts.some(function(o) { return o.data.skill === 'lijian'; }) && n === 1) hint = t('sg_hint_lijian');
      if (n) centerSub = btn(t('sg_cancel'), 'window._sgClear()');
      endBtn = btn(t('sg_end_turn'), 'window._sgEnd()');
      subBtns = centerSub + endBtn;

      if (!n) rightHint = t('sg_your_turn');
      else if (c0 && c0.name === 'jiedao') rightHint = selTargets.length < 2 ? tf('sg_target_progress', selTargets.length, 2) : tf('sg_confirm_to', esc(gname(selTargets[0])));
      else if (opts.some(function(o) { return o.data.skill === 'lijian' && o.need === 2; }) && n === 1 && selTargets.length < 2) rightHint = tf('sg_target_progress', selTargets.length, 2);
      else if (c0 && TARGETS_NEEDED[c0.name] === 1) rightHint = selTargets.length ? tf('sg_confirm_to', esc(gname(selTargets[0]))) : tf('sg_pick_target', esc(cname(c0)));
      else if (c0) rightHint = esc(cname(c0));
      else rightHint = esc(tf('sg_hand', n));
    } else if (a.type === 'respond') {
      if (a.need === 'wuxie') hint = tf('sg_ask_wuxie', esc(t('sg_c_' + a.trick)), esc(a.target >= 0 ? gname(a.target) : ''));
      else if (a.need === 'tao') hint = tf('sg_ask_tao', esc(gname(a.dying)));
      else if (a.need === 'any') hint = tf('sg_ask_any', esc(gname(a.from)));
      else if (a.reason === 'juedou') hint = t('sg_ask_juedou');
      else if (a.reason === 'jiedao') hint = tf('sg_ask_jiedao', esc(gname(a.from)));
      else hint = a.from >= 0 && a.from !== me ? tf('sg_ask_need_from', esc(gname(a.from)), esc(t('sg_c_' + a.need))) : tf('sg_ask_need', esc(t('sg_c_' + a.need)));
      var spear = a.need === 'sha' && weaponName(me) === 'zhangba', need2 = spear && n === 2;
      var one = n === 1 && (!spear || (cardIndex[selCards[0]] && counts(cardIndex[selCards[0]], 'sha')));
      mainBtns = btn(t('sg_respond'), 'window._sgRespond()', 'ok', !(one || need2));
      subBtns = btn(t('sg_pass'), 'window._sgPass()');
      rightHint = a.need === 'any' ? esc(t('sg_respond')) : esc(tf('sg_ask_need', t('sg_c_' + a.need)));
    } else if (a.type === 'discard') {
      hint = a.reason === 'guanshi' ? t('sg_ask_guanshi') : a.reason === 'ganglie' ? t('sg_ask_ganglie') : tf('sg_ask_limit', a.count);
      mainBtns = btn(t('sg_confirm') + ' ' + n + '/' + a.count, 'window._sgDiscard()', 'ok', n !== a.count);
      subBtns = a.optional ? btn(t('sg_pass'), 'window._sgPass()') : '';
      rightHint = esc(n + '/' + a.count);
    } else if (a.type === 'pick') {
      hint = tf(a.mode === 'take' ? 'sg_ask_pick_take' : 'sg_ask_pick_discard', esc(gname(a.target)));
      rightHint = esc(gname(a.target));
    } else if (a.type === 'wugu') {
      hint = t('sg_ask_wugu');
      rightHint = esc(t('sg_c_wugu'));
    } else if (a.type === 'confirm') {
      hint = tf('sg_ask_hanbing', esc(gname(a.target)));
      mainBtns = btn(t('sg_yes'), 'window._sgConfirm(true)', 'ok');
      subBtns = btn(t('sg_no'), 'window._sgConfirm(false)');
      rightHint = esc(t('sg_c_hanbing'));
    }
    if (a.type !== 'play') centerSub = subBtns;
    return { hint: hint, btns: mainBtns + subBtns, mainBtns: mainBtns, subBtns: subBtns, rightHint: rightHint, fsCenter: mainBtns + centerSub, fsMe: endBtn };
  }

  function handHtml() {
    var p = P(me), a = myAsk();
    var cards = p.hand.map(function(c) {
      var en = cardEnabled(c);
      return cardHtml(c, { id: c.id, click: en ? 'window._sgCard(' + c.id + ')' : null, sel: selCards.indexOf(c.id) >= 0, off: !en && !!a });
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

  function logDrawerHtml() {
    var rows = [];
    for (var i = (S.log || []).length - 1; i >= 0 && rows.length < 40; i--) {
      var l = logLine(S.log[i]);
      if (l) rows.push('<li>' + esc(l) + '</li>');
    }
    return '<div class="sg-log-hd"><b>' + esc(t('sg_log_title')) + '</b>' +
      '<button type="button" class="sg-log-close" onclick="window._sgLog()" aria-label="' + esc(t('sg_log_close')) + '">✕</button></div>' +
      '<ul class="sg-log-list">' + (rows.length ? rows.join('') : '<li class="empty">' + esc(t('sg_log_empty')) + '</li>') + '</ul>';
  }

  function popoverHtml(fsMode) {
    if (openCard) {
      return '<div class="sg-pop" onclick="window._sgCardInfo()"><b>' + esc(cname(openCard)) + ' <small>' + SUIT[openCard.suit] + rank(openCard) + ' · ' + t('sg_kind_' + kindOf(openCard.name)) + '</small></b>' + esc(cdesc(openCard)) + '</div>';
    }
    if (openSeat >= 0 && S.players[openSeat]) {
      var q = P(openSeat), body = '<div class="sec">' + t('sg_info_skills') + '</div>';
      (SKILLS[q.general] || []).forEach(function(k) { body += '<p><em>' + esc(t('sg_s_' + k)) + '</em>' + esc(t('sg_sd_' + k)) + '</p>'; });
      var eq = ['weapon', 'armor', 'plus', 'minus'].filter(function(slot) { return q.equip && q.equip[slot]; });
      if (eq.length) {
        body += '<div class="sec">' + t('sg_info_equip') + '</div>';
        eq.forEach(function(slot) { body += '<p><em>' + SLOT_ICON[slot] + ' ' + esc(cname(q.equip[slot])) + '</em>' + esc(cdesc(q.equip[slot])) + '</p>'; });
      }
      if (q.judge && q.judge.length) {
        body += '<div class="sec">' + t('sg_info_judge') + '</div>';
        q.judge.forEach(function(c) { body += '<p><em>' + esc(cname(c)) + '</em>' + esc(cdesc(c)) + '</p>'; });
      }
      return '<div class="sg-pop info" onclick="window._sgInfo(' + openSeat + ')"><b>' + esc(t('sg_g_' + q.general)) + (openSeat === me ? ' <small>' + esc(t('sg_you')) + '</small>' : '') + '</b>' + body + '</div>';
    }
    if (openSkill) return '<div class="sg-pop" onclick="window._sgSkill(\'\')"><b>' + esc(t('sg_s_' + openSkill)) + '</b>' + esc(t('sg_sd_' + openSkill)) + '</div>';
    if (showLog && !fsMode) {
      var rows = [];
      for (var i = (S.log || []).length - 1; i >= 0 && rows.length < 40; i--) { var l = logLine(S.log[i]); if (l) rows.push('<li>' + esc(l) + '</li>'); }
      return '<div class="sg-pop log" onclick="window._sgLog()"><b>' + t('sg_log_title') + '</b><ul>' + rows.join('') + '</ul></div>';
    }
    return '';
  }

  // ---------- skeleton & draw ----------
  function build() {
    root.innerHTML = '<div class="sg"><div class="sg-table" data-r="table"><div class="sg-seats" data-r="seats"></div>' +
      '<div class="sg-center" data-r="center"></div><svg class="sg-lines" data-r="lines"></svg><div data-r="pop"></div>' +
      '<button class="sg-log-fab" data-r="logFab" type="button" onclick="window._sgLog()" aria-label="' + esc(t('sg_log_title')) + '">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>' +
      '</button></div>' +
      '<div class="sg-dash"><div class="sg-prompt"><span class="txt" data-r="hint"></span><span class="sg-chips" data-r="chips"></span><span class="sg-bar"><i id="sgBar"></i></span><span class="sg-sec" id="sgSec"></span></div>' +
      '<div class="sg-me"><div class="sg-me-eq" data-r="meEq"></div><div class="sg-me-seat" data-r="me"></div><div class="sg-skills" data-r="skills"></div></div>' +
      '<div class="sg-hand" data-r="hand"></div>' +
      '<div class="sg-right"><div class="sg-right-hint" data-r="rightHint"></div><div class="sg-btns" data-r="btns"></div></div></div>' +
      '<aside class="sg-log-drawer" data-r="logDrawer" aria-hidden="true"></aside>' +
      '<div class="sg-events" data-r="events"></div></div>';
  }

  function fit() {
    if (!host || !root) return;
    if (isFs()) {
      root.style.width = window.innerWidth + 'px';
      root.style.height = window.innerHeight + 'px';
      if (S) draw();
      return;
    }
    var f = window.boardFit ? window.boardFit(host) : { w: window.innerWidth - 32, h: window.innerHeight - 200 };
    root.style.width = Math.max(300, f.w) + 'px';
    var short = f.h < 440;
    root.style.height = (short ? window.innerHeight - 8 : Math.min(f.h, 1000)) + 'px';
    if (short && root.getBoundingClientRect().top > 4) root.scrollIntoView({ block: 'end' });
    if (S) draw();
  }

  function draw(retry) {
    if (!root || !S || !S.players || !S.players[me]) return;
    if (!retry) cramped = false;
    if (!root.firstChild) build();
    var fs = isFs();
    var w = root.clientWidth, h = root.clientHeight, portrait = h > w, short = !portrait && h < 560;
    var pr = prompt();
    $('hint').innerHTML = pr.hint;
    $('hint').classList.toggle('wait', !!pr.wait);
    $('chips').innerHTML = '<span class="sg-chip rd">' + tf('sg_round', S.round) + '</span><span class="sg-chip" data-r="deck">' + tf('sg_deck', S.deckCount) + '</span>' +
      '<button class="sg-chip btn" onclick="window._sgLog()">' + t('sg_log_title') + '</button>';
    $('meEq').innerHTML = fs ? equipHtml(P(me), true) : '';
    $('me').innerHTML = seatHtml(me, undefined, undefined, fs);
    $('skills').innerHTML = skillsHtml();
    $('rightHint').innerHTML = fs ? (pr.rightHint || '') : '';
    $('btns').innerHTML = fs ? (pr.fsMe || '') : pr.btns;
    var hh = handHtml();
    if (hh !== lastHandHtml) { $('hand').innerHTML = hh; lastHandHtml = hh; }
    fitHand();

    var others = [];
    for (var k = 1; k < S.n; k++) others.push((me + k) % S.n);
    var seatsEl = $('seats');
    if (fs) {
      seatsEl.innerHTML = others.map(function(i) { return seatHtml(i, undefined, undefined, true); }).join('');
      root.firstChild.classList.remove('cramped');
      $('center').innerHTML = centerHtml(true, pr);
      var dashEl = root.querySelector('.sg-dash'), meBox = $('me');
      if (dashEl && meBox) dashEl.style.setProperty('--meh', Math.max(meBox.offsetHeight, 60) + 'px');
      placeCenterFs();
    } else {
      var pos = positions(others.length, portrait, short || cramped);
      seatsEl.innerHTML = others.map(function(i, j) { return seatHtml(i, pos[j][0], pos[j][1], false); }).join('');
      // Two seats per side don't fit on a low table (e.g. tablet landscape): fall back to one per side.
      if (!portrait && !short && !cramped && others.length >= 6) {
        var lo = seatEl(others[0]).getBoundingClientRect(), hi = seatEl(others[1]).getBoundingClientRect();
        if (lo.top < hi.bottom + 6) { cramped = true; return draw(true); }
      }
      root.firstChild.classList.toggle('cramped', cramped);
      $('center').innerHTML = centerHtml(false, pr);
      placeCenter();
    }
    $('pop').innerHTML = popoverHtml(fs);
    var fab = $('logFab'), drawer = $('logDrawer');
    if (fab && drawer) {
      fab.setAttribute('aria-expanded', fs && showLog ? 'true' : 'false');
      if (fs) {
        drawer.innerHTML = logDrawerHtml();
        drawer.classList.toggle('open', !!showLog);
        drawer.setAttribute('aria-hidden', showLog ? 'false' : 'true');
      } else {
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
      }
    }
    tick();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function() { drawLines(); effects(); });
  }

  // Shrink the played cards (not the buttons) to fit the stage when the centre is short.
  function placeCenterFs() {
    var c = $('center'), st = c && c.querySelector('.sg-fs-stage'), sc = st && st.querySelector('.sg-fs-sc');
    if (!c) return;
    c.style.top = ''; c.style.transform = '';
    if (!sc) return;
    sc.style.transform = '';
    var h = sc.offsetHeight, H = st.clientHeight;
    if (!h || !H || h <= H) return;
    sc.style.transform = 'scale(' + Math.max(0.55, H / h).toFixed(3) + ')';
  }

  // The CSS top is only a preference: seats are positioned in % of the table, so on some sizes (e.g. 800x600)
  // the upper seats reach into the middle. Move the pile into the nearest vertical gap between the seats that
  // overlap its column, and shrink it when no gap is tall enough. (Raising its z-index would hide seat HP.)
  function placeCenter() {
    var c = $('center'), tb = $('table');
    c.style.top = ''; c.style.transform = '';
    var h = c.offsetHeight, w = c.offsetWidth, H = tb.clientHeight, W = tb.clientWidth, pad = 6;
    if (!h || !H) return;
    var want = c.offsetTop, t0 = tb.getBoundingClientRect(), x0 = (W - w) / 2, x1 = (W + w) / 2;
    var busy = [].map.call(root.querySelectorAll('.sg-seats .sg-seat'), function(s) {
      var r = s.getBoundingClientRect();
      return r.right - t0.left > x0 && r.left - t0.left < x1 ? [r.top - t0.top - pad, r.bottom - t0.top + pad] : null;
    }).filter(Boolean).sort(function(a, b) { return a[0] - b[0]; });
    var gaps = [], y = pad;
    busy.forEach(function(b) { if (b[0] > y) gaps.push([y, b[0]]); y = Math.max(y, b[1]); });
    if (H - pad > y) gaps.push([y, H - pad]);
    if (!gaps.length) return;
    var best = null, dist = Infinity, big = gaps[0];
    gaps.forEach(function(g) {
      if (g[1] - g[0] > big[1] - big[0]) big = g;
      if (g[1] - g[0] < h) return;
      var cy = Math.min(Math.max(want, g[0] + h / 2), g[1] - h / 2);
      if (Math.abs(cy - want) < dist) { dist = Math.abs(cy - want); best = cy; }
    });
    if (best !== null) { if (Math.abs(best - want) > 0.5) c.style.top = best + 'px'; return; }
    var k = Math.max(0.55, (big[1] - big[0]) / h);
    c.style.top = (big[0] + big[1]) / 2 + 'px';
    c.style.transform = 'translate(-50%,-50%) scale(' + k.toFixed(3) + ')';
  }

  // Hand: overlap only as much as needed to fit; below ~30% visible width, scroll instead.
  function fitHand() {
    var hand = $('hand'), cs = hand.querySelectorAll('.sg-card'), n = cs.length;
    if (!n) return;
    var fs = isFs();
    var cw = cs[0].offsetWidth, W = hand.clientWidth - (fs ? 36 : 8), portrait = root.clientHeight > root.clientWidth;
    var step = fs
      ? Math.max(Math.min(cw * 1.04, n > 1 ? (W - cw) / (n - 1) : cw), Math.min(cw, 36))
      : Math.max(Math.min(cw * (portrait ? 0.74 : 0.88), n > 1 ? (W - cw) / (n - 1) : cw), cw * 0.3);
    for (var i = 0; i < n; i++) {
      cs[i].style.marginLeft = i ? (step - cw) + 'px' : '0';
      if (fs) {
        var u = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
        var rot = u * Math.min(7, n * 1.1);
        var arc = u * u * Math.min(9, n * 1.4);
        cs[i].style.setProperty('--fan-rot', rot.toFixed(2) + 'deg');
        cs[i].style.setProperty('--fan-y', arc.toFixed(1) + 'px');
      } else {
        cs[i].style.removeProperty('--fan-rot');
        cs[i].style.removeProperty('--fan-y');
      }
    }
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

  function clearEventCards() {
    clearTimeout(eventTimer);
    eventTimer = null;
    eventQueue = [];
    if (activeEvent && activeEvent.parentNode) activeEvent.parentNode.removeChild(activeEvent);
    activeEvent = null;
  }

  function showNextEvent() {
    if (activeEvent || !eventQueue.length) return;
    var hostEl = $('events');
    if (!hostEl) return;
    var ev = eventQueue.shift();
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'sg-event-card tone-' + (ev.tone || 'death');
    card.setAttribute('role', 'status');
    card.innerHTML = '<span class="ev-badge">' + esc(ev.badge) + '</span>' +
      '<strong class="ev-title">' + esc(ev.title) + '</strong>' +
      (ev.sub ? '<span class="ev-sub">' + esc(ev.sub) + '</span>' : '');
    hostEl.appendChild(card);
    activeEvent = card;
    var reduced = isReduced(), done = false;
    function dismiss() {
      if (done) return;
      done = true;
      clearTimeout(eventTimer);
      eventTimer = null;
      var finish = function() {
        if (card.parentNode) card.parentNode.removeChild(card);
        if (activeEvent === card) activeEvent = null;
        showNextEvent();
      };
      if (!card.animate) { finish(); return; }
      var ex = card.animate(
        reduced
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.92)' }],
        { duration: 190, easing: EASE_OUT, fill: 'forwards' }
      );
      ex.onfinish = finish;
      setTimeout(finish, 240);
    }
    card.addEventListener('click', dismiss);
    if (card.animate) {
      card.animate(
        reduced
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ opacity: 0, transform: 'scale(0.76)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: reduced ? 180 : 300, easing: reduced ? EASE_OUT : EASE_POP, fill: 'backwards' }
      );
    }
    eventTimer = setTimeout(dismiss, 1800);
  }

  function settleKeyOf(st) {
    if (!st || !st.head) return '';
    var h = st.head;
    var cids = h.cards ? h.cards.map(function(c) { return c.id; }).join(',') : (h.card ? String(h.card.id) : '');
    return h.t + ':' + h.p + ':' + (h.name || '') + ':' + cids;
  }

  function snapshot() {
    var log = S.log || [];
    var st = settlement();
    var pz = root && root.querySelector('.pz');
    return {
      hp: S.players.map(function(p) { return p.hp; }),
      alive: S.players.map(function(p) { return p.alive; }),
      winner: S.winner,
      logSig: log.length ? JSON.stringify(log[log.length - 1]) : null,
      logLen: log.length,
      handIds: P(me).hand.map(function(c) { return c.id; }),
      settleHeadKey: settleKeyOf(st),
      settleHtml: pz ? pz.outerHTML : '',
    };
  }

  // Animate only when a snapshot value changes; skip animations on first render after join/reconnect.
  function effects() {
    if (!prev) { prev = snapshot(); lastPlayRect = null; return; }
    var reduced = isReduced();
    var log = S.log || [], fresh = -1;
    if (prev.logSig && log.length > prev.logLen && JSON.stringify(log[prev.logLen - 1]) === prev.logSig) fresh = prev.logLen;
    else if (prev.logSig) {
      for (var k = log.length - 1; k >= 0; k--) {
        if (JSON.stringify(log[k]) === prev.logSig) { fresh = k + 1; break; }
      }
    } else if (log.length) {
      fresh = 0;
    }

    // 1) Fade out previous played cards when a new settlement replaces them
    var st = settlement(), newHeadKey = settleKeyOf(st);
    if (prev.settleHeadKey && prev.settleHtml && newHeadKey !== prev.settleHeadKey && fresh >= 0) {
      var stageEl = isFs() ? root.querySelector('.sg-fs-stage') : $('center');
      if (stageEl) {
        var ghost = document.createElement('div');
        ghost.className = 'sg-pz-ghost';
        ghost.innerHTML = prev.settleHtml;
        stageEl.appendChild(ghost);
        var rmGhost = function() { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); };
        if (ghost.animate) {
          var ga = ghost.animate(
            reduced
              ? [{ opacity: 0.85, transform: 'translate(-50%,-50%)' }, { opacity: 0, transform: 'translate(-50%,-50%)' }]
              : [{ opacity: 0.85, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(0.92)' }],
            { duration: 185, easing: EASE_OUT, fill: 'forwards' }
          );
          ga.onfinish = rmGhost;
        }
        setTimeout(rmGhost, 240);
      }
    }

    // 2) Fly newly played/responded cards from user's seat (or selected card) to center in 280 ms
    if (fresh >= 0) {
      root.querySelectorAll('.pz-it').forEach(function(it) {
        if (+it.dataset.k < fresh || !it.animate) return;
        var pid = +it.dataset.p;
        var srcEl = seatEl(pid);
        var from = (pid === me && lastPlayRect) ? lastPlayRect : (srcEl && srcEl.getBoundingClientRect());
        if (!from) return;
        if (reduced) {
          it.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: EASE_OUT, fill: 'backwards' });
        } else {
          var to = it.getBoundingClientRect();
          var dx = (from.left + from.width / 2) - (to.left + to.width / 2);
          var dy = (from.top + from.height / 2) - (to.top + to.height / 2);
          it.animate(
            [{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.76)', opacity: 0.2 }, { transform: 'translate(0,0) scale(1)', opacity: 1 }],
            { duration: 280, easing: EASE_OUT, fill: 'backwards' }
          );
        }
      });
    }
    lastPlayRect = null;

    // 3) Damage (red flash + +-4px 250ms shake + 200ms pip fade) & Healing (pip pop) & Death
    S.players.forEach(function(p, i) {
      var el = seatEl(i), d = p.hp - prev.hp[i];
      if (!el) return;
      if (d < 0) {
        var ov = el.querySelector('.sg-flash-ov');
        if (ov && ov.animate) ov.animate([{ opacity: 0.88 }, { opacity: 0 }], { duration: 250, easing: EASE_OUT });
        if (!reduced && el.animate) {
          var inRing = !!el.closest('.sg-seats');
          var picked = el.classList.contains('picked');
          var base = inRing ? (isFs() ? (picked ? 'translateY(-4px) ' : '') : (picked ? 'translate(-50%,-56%) ' : 'translate(-50%,-50%) ')) : '';
          el.animate([
            { transform: base + 'translateX(0)' },
            { transform: base + 'translateX(-4px)' },
            { transform: base + 'translateX(4px)' },
            { transform: base + 'translateX(-4px)' },
            { transform: base + 'translateX(3px)' },
            { transform: base + 'translateX(0)' }
          ], { duration: 250, easing: EASE_OUT });
        }
        for (var pk = Math.max(0, p.hp); pk < Math.min(p.maxHp, prev.hp[i]); pk++) {
          var lostPip = el.querySelector('.sg-hp i[data-hp="' + pk + '"] b');
          if (lostPip && lostPip.animate) {
            lostPip.animate(
              [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: reduced ? 'scale(1)' : 'scale(0.65)' }],
              { duration: 200, easing: EASE_OUT }
            );
          }
        }
        floatText(el, String(d), 'dmg');
      }
      if (d > 0) {
        for (var hk = Math.max(0, prev.hp[i]); hk < Math.min(p.maxHp, p.hp); hk++) {
          var gainPip = el.querySelector('.sg-hp i[data-hp="' + hk + '"] b');
          if (gainPip && gainPip.animate) {
            gainPip.animate(
              reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(0.35)' }, { opacity: 1, transform: 'scale(1)' }],
              { duration: reduced ? 180 : 300, easing: reduced ? EASE_OUT : EASE_POP, fill: 'backwards' }
            );
          }
        }
        floatText(el, '+' + d, 'heal');
      }
      if (prev.alive[i] && !p.alive) {
        el.classList.add('die');
        eventQueue.push({
          tone: 'death',
          badge: t('sg_dead'),
          title: tf('sg_event_death', gname(i)),
          sub: p.role ? tf('sg_event_role', t('sg_role_' + p.role)) : '',
        });
      }
    });

    // 4) Draw cards: slide from deck to hand with 50 ms stagger (first 8 staggered)
    var drawnIds = P(me).hand.map(function(c) { return c.id; }).filter(function(id) { return prev.handIds.indexOf(id) < 0; });
    if (drawnIds.length) {
      var deckEl = root.querySelector('[data-r="deck"]') || $('center');
      var deckRect = deckEl && deckEl.getBoundingClientRect();
      drawnIds.forEach(function(id, idx) {
        var cardEl = root.querySelector('.sg-hand .sg-card[data-c="' + id + '"]');
        if (!cardEl || !cardEl.animate) return;
        var delay = Math.min(idx, 7) * 50;
        if (reduced || !deckRect) {
          cardEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: EASE_OUT, fill: 'backwards' });
          return;
        }
        var to = cardEl.getBoundingClientRect();
        var dx = (deckRect.left + deckRect.width / 2) - (to.left + to.width / 2);
        var dy = (deckRect.top + deckRect.height / 2) - (to.top + to.height / 2);
        var restTf = getComputedStyle(cardEl).transform;
        var endTf = restTf && restTf !== 'none' ? restTf : 'none';
        cardEl.animate(
          [{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.55)', opacity: 0 }, { transform: endTf, opacity: 1 }],
          { duration: 220, delay: delay, easing: EASE_OUT, fill: 'backwards' }
        );
      });
    }

    // 5) Win event card
    if (prev.winner === null && S.winner !== null) {
      var wkey = S.winner === -2 ? 'sg_win_lord' : S.winner === -3 ? 'sg_win_rebel' : 'sg_win_spy';
      var iWon = Array.isArray(S.winners) && S.winners.indexOf(me) >= 0;
      eventQueue.push({
        tone: iWon ? 'win' : 'lose',
        badge: iWon ? t('sg_event_victory') : t('sg_event_defeat'),
        title: t(wkey),
        sub: t('sg_tap_dismiss'),
      });
    }
    if (eventQueue.length) showNextEvent();

    prev = snapshot();
  }

  function tick() {
    if (!S) return;
    var left = S.winner === null && S.ask && S.ask.deadline ? Math.max(0, (S.ask.deadline - Date.now()) / 1000) : 0;
    var frac = askTotal > 0 ? Math.min(1, left / askTotal) : 0;
    var urgent = left > 0 && left <= 5 && S.ask.to === me;
    var bar = document.getElementById('sgBar'), sec = document.getElementById('sgSec');
    if (bar && sec) {
      bar.style.width = (frac * 100) + '%';
      bar.classList.toggle('urgent', urgent);
      sec.textContent = left ? Math.ceil(left) + 's' : '';
      sec.classList.toggle('urgent', urgent);
    }
    var fsBar = $('fsBar'), fsSec = $('fsSec');
    if (fsBar && fsSec) {
      fsBar.style.transform = 'scaleX(' + frac.toFixed(4) + ')';
      fsBar.classList.toggle('urgent', urgent);
      fsSec.textContent = left ? Math.ceil(left) + 's' : '';
      fsSec.classList.toggle('urgent', urgent);
    }
  }

  // ---------- actions ----------
  function capturePlayOrigin() {
    var originEl = root && (root.querySelector('.sg-hand .sg-card.sel') || seatEl(me));
    lastPlayRect = originEl ? originEl.getBoundingClientRect() : null;
  }
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
  // Tapping a seat (when it is not a target) shows that general's skills, gear and judgement zone
  window._sgInfo = function(i) {
    openSeat = openSeat === i ? -1 : i;
    openSkill = ''; openCard = null; showLog = false;
    draw();
  };
  window._sgCardInfo = function(id) {
    openCard = id !== undefined && cardIndex[id] && !(openCard && openCard.id === id) ? cardIndex[id] : null;
    openSkill = ''; openSeat = -1; showLog = false;
    draw();
  };
  window._sgSkill = function(k) { openSkill = openSkill === k ? '' : k; openSeat = -1; openCard = null; showLog = false; draw(); };
  window._sgLog = function() { showLog = !showLog; openSkill = ''; openSeat = -1; openCard = null; draw(); };
  window._sgClear = function() { selCards = []; selTargets = []; draw(); };
  window._sgPlay = function(k) {
    var o = playOptions()[k];
    if (!o) return;
    capturePlayOrigin();
    var data = JSON.parse(JSON.stringify(o.data));
    if (o.selfDefault) data.targets = selTargets.length ? selTargets.slice() : [me];
    else if (o.need > 0) data.targets = selTargets.slice();
    send(data);
  };
  window._sgEnd = function() { send({ type: 'end' }); };
  window._sgRespond = function() {
    capturePlayOrigin();
    send(selCards.length === 2 ? { type: 'respond', cardIds: selCards.slice() } : { type: 'respond', cardId: selCards[0] });
  };
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
      'background:linear-gradient(160deg,#6b5236,#2c2016);box-shadow:0 6px 16px rgba(0,0,0,.45);transition:transform 200ms cubic-bezier(0.23,1,0.32,1),box-shadow 200ms cubic-bezier(0.23,1,0.32,1),filter 250ms cubic-bezier(0.23,1,0.32,1)}' +
    '.sg-seats .sg-seat{position:absolute;transform:translate(-50%,-50%);z-index:2;' +
      'left:clamp(calc(var(--sw) / 2 + 8px),var(--x),calc(100% - var(--sw) / 2 - 8px));top:clamp(calc(var(--sw) * .8 + 6px),var(--y),calc(100% - var(--sw) * .8 - 6px))}' +
    '.sg-port{position:relative;display:flex;align-items:center;justify-content:center;aspect-ratio:3/3.4;border-radius:7px;overflow:hidden;background:linear-gradient(160deg,var(--kc),#1a120c)}' +
    '.k-shu{--kc:var(--shu)}.k-wei{--kc:var(--wei)}.k-wu{--kc:var(--wu)}.k-qun{--kc:var(--qun)}' +
    '.sg-port::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.28),transparent 60%),linear-gradient(transparent 55%,rgba(0,0,0,.55))}' +
    '.sg-flash-ov{position:absolute;inset:0;z-index:2;pointer-events:none;background:rgba(255,40,30,.72);opacity:0;border-radius:inherit}' +
    '.sg-port .ch{font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:calc(var(--sw) * .52);color:rgba(255,248,230,.92);text-shadow:0 2px 6px rgba(0,0,0,.4);line-height:1;transform:translateY(-6%)}' +
    '.sg-port .nm{position:absolute;left:0;right:0;bottom:3px;text-align:center;font-size:calc(var(--sw) * .15);font-weight:700;color:#fff;z-index:1;letter-spacing:.05em;white-space:nowrap;overflow:hidden}' +
    '.sg-port .kd{position:absolute;left:3px;top:3px;width:calc(var(--sw) * .22);height:calc(var(--sw) * .22);border-radius:50%;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.5);font-size:calc(var(--sw) * .13);display:flex;align-items:center;justify-content:center;z-index:1;font-family:"Ma Shan Zheng","LXGW WenKai",serif}' +
    '.sg-port .rl{position:absolute;right:3px;top:3px;z-index:1;font-size:11px;line-height:17px;padding:0 5px;border-radius:4px;background:#ddd;color:var(--ink);font-weight:700}' +
    '.rl.r-lord{background:var(--gold)}.rl.r-rebel{background:#d24a3a;color:#fff}.rl.r-loyal{background:#e6d6a8}.rl.r-spy{background:#5a5f8a;color:#fff}' +
    '.sg-meta{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:4px 2px 1px}' +
    '.sg-hp{display:flex;gap:2px;flex-wrap:wrap;min-width:0}' +
    '.sg-hp i{position:relative;overflow:hidden;width:max(6px,calc(var(--sw) * .085));height:max(8px,calc(var(--sw) * .115));border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:#3a3a3a;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}' +
    '.sg-hp i b{display:block;width:100%;height:100%;border-radius:inherit;opacity:0;background:radial-gradient(circle at 35% 30%,#9cf09a,#2e9b45 60%,#1c6b2c);transition:opacity 200ms cubic-bezier(0.23,1,0.32,1)}' +
    '.sg-hp.mid i b{background:radial-gradient(circle at 35% 30%,#ffe28a,#d9a21c 60%,#9a6d0b)}' +
    '.sg-hp.low i b{background:radial-gradient(circle at 35% 30%,#ff9d8a,#d0352a 60%,#8a1a12)}' +
    '.sg-hp i.on b{opacity:1}' +
    '.sg-hp.low i.on{animation:sg-beat 1.2s infinite}' +
    '@keyframes sg-beat{50%{transform:scale(1.18)}}' +
    '.hc{font-size:12px;font-weight:700;min-width:22px;height:20px;padding:0 4px;box-sizing:border-box;border-radius:5px;background:#f3e6c8;color:var(--ink);display:flex;align-items:center;justify-content:center;box-shadow:1px 1px 0 #a68b5b}' +
    '.sg-eq{display:flex;flex-wrap:wrap;gap:2px;padding:2px 1px 1px}' +
    '.sg-eq span{display:flex;align-items:center;gap:3px;font-size:11px;line-height:17px;padding:0 5px 0 3px;border-radius:4px;background:linear-gradient(#5d4526,#3a2a17);border:1px solid rgba(217,180,106,.55);color:#f6e7c1;white-space:nowrap;max-width:100%;overflow:hidden;box-sizing:border-box}' +
    '.sg-eq span i{font-style:normal;font-size:10px;color:var(--gold2);flex:none}.sg-eq span em{font-style:normal;overflow:hidden;text-overflow:ellipsis}' +
    '.sg-eq span.eq-plus i,.sg-eq span.eq-minus i{font-weight:800;font-size:9px}' +
    '.sg-eq span.jd{background:#7a1f18;border-color:#d0574a;color:#ffd9cf;padding:0 5px;font-family:"Ma Shan Zheng","LXGW WenKai",serif}' +
    '.sg-seat.turn{box-shadow:0 0 0 2px var(--gold2),0 0 18px 4px rgba(241,213,149,.55);animation:sg-glow 2s ease-in-out infinite}' +
    '@keyframes sg-glow{50%{box-shadow:0 0 0 2px var(--gold2),0 0 26px 8px rgba(241,213,149,.35)}}' +
    '.sg-seat.asked{box-shadow:0 0 0 2px #ff7a5c,0 0 16px 3px rgba(255,122,92,.5)}' +
    '.sg-seat.pickable{box-shadow:0 0 0 2px rgba(255,255,255,.6),0 6px 16px rgba(0,0,0,.45)}' +
    '.sg-seats .sg-seat.picked{box-shadow:0 0 0 3px #ff5a45,0 0 22px 6px rgba(255,90,69,.6);transform:translate(-50%,-56%)}' +
    '.sg-order{position:absolute;left:50%;top:-11px;transform:translateX(-50%);z-index:3;background:#ff5a45;color:#fff;font-size:11px;font-weight:700;padding:1px 8px;border-radius:9px;white-space:nowrap}' +
    '.sg-seat.off{filter:saturate(.4) brightness(.7)}' +
    '.sg-seat.dead{filter:grayscale(1) brightness(.6)}' +
    '.sg-seat.dead .sg-port::before{content:attr(data-dead);position:absolute;z-index:2;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-18deg);font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:calc(var(--sw) * .3);color:#ff6b5a;border:2px solid #ff6b5a;padding:0 6px;border-radius:6px;white-space:nowrap}' +
    '.sg-seat.die .sg-port::before{animation:sg-stamp .5s cubic-bezier(0.23,1,0.32,1)}' +
    '@keyframes sg-stamp{from{transform:translate(-50%,-50%) rotate(-18deg) scale(2.4);opacity:0}}' +
    '.sg-float{position:absolute;left:50%;top:30%;z-index:5;font-size:calc(var(--sw) * .34);font-weight:900;pointer-events:none;transform:translateX(-50%);animation:sg-up 1.2s cubic-bezier(0.23,1,0.32,1) forwards;text-shadow:0 2px 6px rgba(0,0,0,.6)}' +
    '.sg-float.dmg{color:#ff6b5a}.sg-float.heal{color:#8cf08a}' +
    '@keyframes sg-up{from{opacity:0;transform:translate(-50%,10px) scale(.6)}20%{opacity:1;transform:translate(-50%,0) scale(1.1)}to{opacity:0;transform:translate(-50%,-40px)}}' +
    /* center */
    '.sg-center{position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:6px;z-index:1;max-width:70%}' +
    '.sg-chips{display:flex;gap:6px;flex:none}' +
    '.sg.cramped .sg-center{top:66%}.sg.cramped .sg-log div:nth-child(2){display:none}' +
    '.sg-chip{all:unset;font-size:12px;line-height:24px;padding:0 10px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid rgba(217,180,106,.35);color:var(--gold2);white-space:nowrap}' +
    '@media(pointer:coarse){.sg-chip.btn{position:relative;cursor:pointer}.sg-chip.btn::after{content:"";position:absolute;left:50%;top:50%;width:max(100%,44px);height:44px;transform:translate(-50%,-50%)}}' +
    '.sg-chip.btn{cursor:pointer}' +
    '.sg-center .cards{display:flex;gap:6px;justify-content:center}' +
    '.sg-center .cap{font-size:12px;color:var(--gold2);background:rgba(0,0,0,.35);padding:2px 10px;border-radius:10px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}' +
    '.pz{align-items:flex-start}.pz,.pz .sg-card{--cw:clamp(44px,7.5cqw,68px)}' +
    '.pz-it{display:flex;flex-direction:column;align-items:center;gap:3px;margin-left:calc(var(--cw) * -.28)}' +
    '.pz-it:first-child,.pz-more+.pz-it{margin-left:0}' +
    '.pz-it .who{font-size:11px;color:#f3e6c8;background:rgba(0,0,0,.5);padding:0 6px;border-radius:8px;white-space:nowrap}' +
    '.pz-it:not(:last-child) .sg-card{filter:brightness(.82)}' +
    '.pz-more{align-self:center;margin-right:6px;font-size:12px;color:var(--gold2);background:rgba(0,0,0,.45);border:1px solid rgba(217,180,106,.4);border-radius:10px;padding:2px 8px}' +
    '.sg-pz-ghost{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:2}' +
    '.sg-desc{max-width:340px;padding:8px 12px;border-radius:12px;background:rgba(0,0,0,.5);border:1px solid rgba(217,180,106,.35);font-size:13px;line-height:1.55;color:#f3e6c8;text-align:center}' +
    '.sg-desc b{display:block;font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-weight:400;font-size:18px;color:var(--gold2)}' +
    '.sg-log{display:flex;flex-direction:column;align-items:center;gap:3px}' +
    '.sg-log div{font-size:12px;background:rgba(0,0,0,.4);padding:2px 9px;border-radius:9px;color:#e8d7b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}' +
    '.sg-log div:nth-child(2){opacity:.7}.sg-log div:nth-child(3){opacity:.45}' +
    '.sg-choice{padding:12px;border-radius:14px;background:rgba(20,12,8,.85);border:1px solid rgba(217,180,106,.5);box-shadow:0 10px 30px rgba(0,0,0,.5);animation:sg-in2 .3s cubic-bezier(0.23,1,0.32,1)}' +
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
      'background:rgba(20,12,8,.94);border:1px solid rgba(217,180,106,.55);box-shadow:0 10px 30px rgba(0,0,0,.55);font-size:13px;line-height:1.6;color:#f3e6c8;animation:sg-in .25s cubic-bezier(0.23,1,0.32,1)}' +
    '.sg-pop b{display:block;font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:20px;color:var(--gold2);font-weight:400;margin-bottom:4px}' +
    '.sg-pop b small{font-family:inherit;font-size:12px;color:#cdbb95;margin-left:6px}' +
    '.sg-pop .sec{margin:8px 0 2px;font-size:11px;color:#cdbb95;letter-spacing:.1em}.sg-pop p{margin:0 0 4px}.sg-pop p em{font-style:normal;color:var(--gold2);font-weight:700;margin-right:6px}' +
    '.sg-pop ul{margin:0;padding:0;list-style:none}.sg-pop li{padding:2px 0;border-bottom:1px solid rgba(217,180,106,.12)}' +
    '@keyframes sg-in{from{opacity:0;transform:translate(-50%,-46%) scale(.96)}}' +
    '@keyframes sg-in2{from{opacity:0;transform:scale(.94)}}' +
    /* cards */
    '.sg-card{--cw:clamp(60px,9.5cqw,84px);all:unset;box-sizing:border-box;position:relative;flex:none;width:var(--cw);height:calc(var(--cw) * 1.4);border-radius:7px;cursor:default;color:var(--ink);' +
      'background:linear-gradient(170deg,#fbf3df,#ecdcb6);box-shadow:0 3px 8px rgba(0,0,0,.45),inset 0 0 0 1px rgba(120,90,50,.35),inset 0 0 0 4px #fbf3df,inset 0 0 0 5px rgba(150,110,60,.35);' +
      'transition:transform 180ms cubic-bezier(0.23,1,0.32,1),box-shadow 180ms cubic-bezier(0.23,1,0.32,1),opacity 180ms cubic-bezier(0.23,1,0.32,1)}' +
    '.sg-card[onclick]{cursor:pointer}.sg-card:not(.act){cursor:help}' +
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
    '.sg-me-eq,.sg-right-hint,.sg-log-fab,.sg-log-drawer{display:none}' +
    '.sg-me-seat,.sg-right{display:contents}' +
    '.sg-me .sg-seat{--sw:clamp(74px,11cqw,104px);cursor:pointer}' +
    '.sg-me .sg-seat.turn{animation:none}' +
    '.sg-skills{display:flex;flex-direction:column;gap:5px;justify-content:center}' +
    '.sg-skill{all:unset;cursor:pointer;font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:17px;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
      'background:radial-gradient(circle at 40% 35%,#5a4126,#2c1f14);border:1.5px solid var(--gold);color:var(--gold2);box-shadow:0 2px 6px rgba(0,0,0,.5);transition:transform 120ms cubic-bezier(0.23,1,0.32,1)}' +
    '.sg-skill:active{transform:scale(.97)}' +
    '.sg-skill.passive{border-style:dashed;opacity:.85}.sg-skill.open{transform:scale(1.08);box-shadow:0 0 0 2px var(--gold2)}' +
    '.sg-hand{display:flex;align-items:flex-end;justify-content:safe center;min-width:0;overflow-x:auto;overflow-y:visible;padding:16px 4px 2px;scrollbar-width:none}' +
    '.sg-hand.tight .sg-card .v{display:block}' +
    '.sg-hand.tight .sg-card:not(:last-child):not(.sel) .n{visibility:hidden}' +
    '.sg-empty{font-size:13px;color:#a8977a;align-self:center;padding:20px 0}' +
    '.sg-btns{display:flex;flex-direction:column;gap:6px;justify-content:center}' +
    '.sgb{all:unset;cursor:pointer;min-width:84px;height:42px;padding:0 14px;box-sizing:border-box;border-radius:21px;text-align:center;font-size:15px;font-weight:700;letter-spacing:.1em;line-height:42px;white-space:nowrap;' +
      'background:linear-gradient(#4b3a2a,#2d2117);color:#e8d7b0;border:1px solid rgba(217,180,106,.5);transition:transform 120ms cubic-bezier(0.23,1,0.32,1),opacity 180ms cubic-bezier(0.23,1,0.32,1)}' +
    '.sgb.ok{background:linear-gradient(#d4453a,#9a2219);color:#fff;border-color:#f1a08f;box-shadow:0 3px 10px rgba(184,50,42,.5)}' +
    '.sgb:active{transform:scale(.97)}.sgb:disabled{opacity:.4;cursor:default}' +
    /* event overlay */
    '.sg-events{position:absolute;inset:0;pointer-events:none;z-index:15;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.sg-event-card{all:unset;box-sizing:border-box;pointer-events:auto;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:210px;max-width:min(82vw,340px);padding:16px 24px;border-radius:18px;text-align:center;' +
      'background:var(--ge-paper,#fffdf8);color:var(--ge-ink,#1c1b19);border:2px solid var(--ge-gold,#b9954f);box-shadow:var(--ge-shadow-lift,0 16px 32px rgba(0,0,0,.35))}' +
    '.sg-event-card.tone-death{background:#231412;color:#f7e8d8;border-color:#c0392b}' +
    '.sg-event-card.tone-win{background:#fbf5e4;color:#2a1d14;border-color:#d9b46a}' +
    '.sg-event-card.tone-lose{background:#241c1a;color:#efe2d1;border-color:#8d7a52}' +
    '.sg-event-card .ev-badge{font-size:11px;font-weight:800;letter-spacing:.12em;padding:2px 10px;border-radius:999px;background:rgba(185,149,79,.22);color:var(--ge-gold,#b9954f)}' +
    '.sg-event-card.tone-death .ev-badge{background:rgba(192,57,43,.28);color:#ff8676}' +
    '.sg-event-card .ev-title{font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:26px;font-weight:400;line-height:1.2}' +
    '.sg-event-card .ev-sub{font-size:13px;opacity:.8}' +
    '@media (hover:hover){.sg-hand .sg-card[onclick]:not(.sel):hover{transform:translateY(-6px)}.sg-seats .sg-seat.pickable:hover{transform:translate(-50%,-53%)}body.gn-fs .sg-hand .sg-card[onclick]:not(.sel):hover{transform:translateY(calc(var(--fan-y,0px) - 8px)) rotate(var(--fan-rot,0deg))}}' +
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
      '.sg-prompt{gap:6px}.sg-prompt .txt{font-size:14px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.sg-chip{font-size:11px;padding:0 7px;line-height:22px}.sg-bar{width:48px}' +
      '.sg-center{top:50%;max-width:56%}.sg-log,.sg-chip.rd{display:none}.hc{min-width:18px;height:18px;font-size:11px}' +
    '}' +
    '@container sg (orientation:landscape) and (max-height:560px){' +
      '.sg{--sw:clamp(54px,18cqh,96px)}' +
      '.sg-seats .sg-port{aspect-ratio:1/1}.sg-seats .sg-eq span em{display:none}.sg-seats .sg-eq span{padding:0 4px}' +
      '.sg-card{--cw:clamp(46px,14cqh,72px)}' +
      '.sg-me .sg-seat{--sw:clamp(54px,15cqh,80px)}.sg-me .sg-port{aspect-ratio:1/1}' +
      '.sg-dash{padding-top:4px;padding-bottom:6px;gap:4px 8px}.sg-hand{padding-top:10px}' +
      '.sgb{height:34px;line-height:34px;min-width:72px;font-size:14px}' +
      '.sg-skill{width:36px;height:36px;font-size:14px}.sg-prompt .txt{font-size:14px}' +
      '.sg-log,.sg-chip.rd{display:none}.sg-center{top:66%}.pz,.pz .sg-card{--cw:clamp(38px,11cqh,58px)}' +
    '}' +
    /* -------- fullscreen landscape mode (body.gn-fs only) -------- */
    'body.gn-fs .board-wrap:has(.sg-root){padding:0;width:100%;height:100%;max-width:none;align-items:stretch}' +
    'body.gn-fs #boardArea:has(.sg-root){width:100%;height:100%;max-width:none}' +
    'body.gn-fs .sg-root{width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;border-radius:0;margin:0}' +
    'body.gn-fs .sg{display:block;--mw:clamp(132px,17cqw,190px);--mp:clamp(52px,12cqh,76px);--ch:28cqh;--hz:calc(var(--ch) + 36px);--rw:calc(var(--mw) + 56px)}' +
    /* table: one row of others on top, play area in the middle, hand + my general below */
    'body.gn-fs .sg-table{position:absolute;inset:0;display:flex;flex-direction:column;padding:10px 0 var(--hz)}' +
    'body.gn-fs .sg-seats{position:relative;flex:none;display:flex;justify-content:center;align-items:flex-start;gap:6px;margin:0 60px 0 64px;z-index:2}' +
    'body.gn-fs .sg-seat{--pw:clamp(40px,8cqh,58px);--sw:calc(var(--pw) * 1.6);position:relative;left:auto;top:auto;transform:none;flex:1 1 0;min-width:0;max-width:150px;width:auto;' +
      'display:grid;grid-template-columns:var(--pw) minmax(0,1fr);grid-template-rows:auto auto;gap:3px 5px;align-items:center;padding:4px}' +
    'body.gn-fs .sg-seat.mine{--pw:var(--mp);max-width:none;width:100%;grid-template-rows:auto}' +
    'body.gn-fs .sg-seats .sg-seat.picked{transform:translateY(-4px)}' +
    'body.gn-fs .sg-order{top:-6px}' +
    'body.gn-fs .sg-seat .sg-port{grid-row:1;grid-column:1;width:var(--pw);height:var(--pw);aspect-ratio:1/1}' +
    'body.gn-fs .sg-seat .sg-port .ch{font-size:calc(var(--pw) * .52);transform:translateY(-8%)}' +
    'body.gn-fs .sg-seat .sg-port .nm{font-size:max(9px,calc(var(--pw) * .2));bottom:1px}' +
    'body.gn-fs .sg-seat .sg-port .kd{width:calc(var(--pw) * .32);height:calc(var(--pw) * .32);font-size:calc(var(--pw) * .2);left:2px;top:2px}' +
    'body.gn-fs .sg-seat .sg-port .rl{font-size:max(8px,calc(var(--pw) * .2));line-height:1.45;padding:0 3px;right:2px;top:2px}' +
    'body.gn-fs .sg-seat.dead .sg-port::before{font-size:calc(var(--pw) * .3);padding:0 3px;border-width:1.5px}' +
    'body.gn-fs .sg-seat .sg-meta{grid-row:1;grid-column:2;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 3px;align-items:center;padding:0;min-width:0}' +
    'body.gn-fs .sg-seat .sg-meta .pn{grid-column:1;grid-row:1;font-size:11px;color:#e0cfa8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    'body.gn-fs .sg-seat.mine .sg-meta .pn{font-size:13px;font-weight:700;color:#fff3d6}' +
    'body.gn-fs .sg-seat .sg-meta .hc{grid-column:2;grid-row:1;min-width:18px;height:18px;font-size:11px;padding:0 4px}' +
    'body.gn-fs .sg-seat .sg-meta .sg-hp{grid-column:1/-1;grid-row:2;gap:2px}' +
    'body.gn-fs .sg-seat .sg-meta .sg-hp i{width:max(7px,calc(var(--pw) * .15));height:max(9px,calc(var(--pw) * .2))}' +
    'body.gn-fs .sg-seat .sg-eq{grid-row:2;grid-column:1/-1;padding:1px 0 0}' +
    'body.gn-fs .sg-seat .sg-eq span{font-size:10px;line-height:15px;padding:0 4px}' +
    /* play area */
    'body.gn-fs .sg-center{position:relative;left:auto;top:auto;transform:none;flex:1 1 0;min-height:0;width:auto;max-width:none;margin:0 var(--rw);gap:4px;z-index:2}' +
    'body.gn-fs .sg-fs-meta{flex:none;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:5px}' +
    'body.gn-fs .sg-fs-timer{display:inline-flex;align-items:center;gap:5px;padding:0 8px;height:24px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid rgba(217,180,106,.35)}' +
    'body.gn-fs .sg-fs-bar{width:68px;height:5px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden;display:block}' +
    'body.gn-fs .sg-fs-bar i{display:block;width:100%;height:100%;transform-origin:0 50%;transform:scaleX(0);background:linear-gradient(90deg,var(--gold),var(--gold2));transition:transform 250ms linear}' +
    'body.gn-fs .sg-fs-bar i.urgent{background:#ff5a45}' +
    'body.gn-fs .sg-fs-sec{font-size:11px;color:var(--gold2);font-variant-numeric:tabular-nums;min-width:24px;text-align:right}' +
    'body.gn-fs .sg-fs-sec.urgent{color:#ff7a5c;font-weight:800}' +
    'body.gn-fs .sg-fs-stage{position:relative;flex:1 1 0;min-height:0;width:100%;display:flex;align-items:center;justify-content:center}' +
    'body.gn-fs .sg-fs-sc{display:flex;flex-direction:column;align-items:center;gap:4px;max-width:100%;transform-origin:50% 50%}' +
    'body.gn-fs .sg-fs-played{display:flex;flex-direction:column;align-items:center;gap:3px}' +
    'body.gn-fs .sg-fs-act{flex:none;display:flex;flex-direction:column;align-items:center;gap:6px}' +
    'body.gn-fs .sg-fs-ask{font-size:13px;font-weight:700;color:#fff3d6;background:rgba(20,12,8,.65);border:1px solid rgba(217,180,106,.4);padding:3px 12px;border-radius:12px;text-align:center;max-width:100%}' +
    'body.gn-fs .sg-fs-ask.wait{font-weight:500;color:#cdbb95}' +
    'body.gn-fs .sg-fs-ask em{font-style:normal;color:var(--gold2)}' +
    'body.gn-fs .sg-fs-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}' +
    'body.gn-fs .sg-fs-btns:empty{display:none}' +
    'body.gn-fs .sg-desc-inline{display:flex;align-items:center;gap:6px;padding:3px 10px;border-radius:10px;background:rgba(0,0,0,.58);border:1px solid rgba(217,180,106,.38);font-size:12px;line-height:1.35;max-width:100%;color:#f3e6c8}' +
    'body.gn-fs .sg-desc-inline b{font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-weight:400;font-size:16px;color:var(--gold2);flex:none}' +
    'body.gn-fs .sg-card{--cw:clamp(52px,10cqh,76px)}' +
    'body.gn-fs .pz,body.gn-fs .pz .sg-card{--cw:clamp(44px,9.5cqh,66px)}' +
    /* dashboard layer: hand along the bottom, my general bottom-right, end-turn beside it */
    'body.gn-fs .sg-prompt{display:none}' +
    'body.gn-fs .sg-dash{position:absolute;inset:0;display:block;padding:0;border:0;background:none;pointer-events:none}' +
    'body.gn-fs .sg-dash>*{pointer-events:auto}' +
    'body.gn-fs .sg-hand{position:absolute;left:8px;right:calc(var(--rw) + 4px);bottom:0;min-height:0;padding:20px 8px 16px;align-items:flex-end;overflow-y:hidden}' +
    'body.gn-fs .sg-hand .sg-card{--cw:calc(var(--ch) / 1.4);transform:translateY(var(--fan-y,0px)) rotate(var(--fan-rot,0deg));transform-origin:50% 100%}' +
    'body.gn-fs .sg-hand .sg-card.sel{transform:translateY(calc(var(--fan-y,0px) - 16px)) rotate(0deg) scale(1.04);z-index:4}' +
    'body.gn-fs .sg-hand .sg-card:active{transform:translateY(calc(var(--fan-y,0px) - 4px)) scale(.97)}' +
    'body.gn-fs .sg-me{position:absolute;right:8px;bottom:6px;display:grid;grid-template-columns:auto var(--mw);grid-template-areas:". eq" "sk me";gap:4px 6px;align-items:end;min-width:0;max-width:none}' +
    'body.gn-fs .sg-me-eq{grid-area:eq;display:flex;min-height:0;min-width:0;justify-content:flex-end}' +
    'body.gn-fs .sg-me-eq .sg-eq{flex-wrap:wrap;justify-content:flex-end;gap:4px;padding:0}' +
    'body.gn-fs .sg-me-eq button{all:unset;position:relative;cursor:pointer;display:inline-flex;align-items:center;gap:3px;font-size:11px;line-height:20px;padding:0 6px;border-radius:5px;background:linear-gradient(#5d4526,#3a2a17);border:1px solid rgba(217,180,106,.55);color:#f6e7c1;white-space:nowrap;transition:transform 120ms cubic-bezier(0.23,1,0.32,1)}' +
    'body.gn-fs .sg-me-eq button i{font-style:normal;font-size:10px;color:var(--gold2)}' +
    'body.gn-fs .sg-me-eq button em{font-style:normal}' +
    'body.gn-fs .sg-me-eq button.jd{background:#7a1f18;border-color:#d0574a;color:#ffd9cf;font-family:"Ma Shan Zheng","LXGW WenKai",serif}' +
    'body.gn-fs .sg-me-eq button:active{transform:scale(.97)}' +
    'body.gn-fs .sg-me-seat{grid-area:me;display:block;min-width:0}' +
    'body.gn-fs .sg-skills{grid-area:sk;display:flex;flex-direction:column;gap:5px;justify-content:flex-end}' +
    'body.gn-fs .sg-skill{flex:none;width:auto;min-width:44px;height:44px;border-radius:10px;font-size:15px;padding:0 8px}' +
    'body.gn-fs .sg-right{position:absolute;right:8px;bottom:calc(var(--meh,100px) + 12px);display:flex;flex-direction:column;align-items:flex-end;gap:5px}' +
    'body.gn-fs .sg-right-hint{display:block;font-size:12px;font-weight:700;color:var(--gold2);text-align:center;background:rgba(0,0,0,.35);border:1px solid rgba(217,180,106,.3);border-radius:10px;padding:4px 8px;line-height:1.3;max-width:calc(var(--mw) + 50px)}' +
    'body.gn-fs .sg-right-hint:empty{display:none}' +
    'body.gn-fs .sg-btns{display:flex;flex-direction:row;gap:6px}' +
    'body.gn-fs .sgb{flex:none;min-width:84px;height:44px;min-height:44px;line-height:44px;padding:0 14px;font-size:14px;border-radius:12px;letter-spacing:.04em}' +
    'body.gn-fs .sg-log-fab{position:absolute;top:8px;right:8px;z-index:8;width:44px;height:44px;border:1px solid rgba(217,180,106,.55);border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(28,19,13,.84);color:var(--gold2);cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);transition:transform 120ms cubic-bezier(0.23,1,0.32,1),opacity 180ms cubic-bezier(0.23,1,0.32,1)}' +
    'body.gn-fs .sg-log-fab:active{transform:scale(.97)}' +
    'body.gn-fs .sg-log-drawer{position:absolute;top:0;right:0;bottom:0;width:min(270px,44vw);z-index:12;display:flex;flex-direction:column;background:rgba(20,13,9,.94);border-left:1px solid rgba(217,180,106,.45);box-shadow:-10px 0 28px rgba(0,0,0,.55);transform:translateX(100%);opacity:0;pointer-events:none;transition:transform 150ms cubic-bezier(0.23,1,0.32,1),opacity 150ms cubic-bezier(0.23,1,0.32,1)}' +
    'body.gn-fs .sg-log-drawer.open{transform:translateX(0);opacity:1;pointer-events:auto;transition-duration:220ms}' +
    'body.gn-fs .sg-log-hd{display:flex;align-items:center;justify-content:space-between;padding:8px 8px 8px 14px;border-bottom:1px solid rgba(217,180,106,.25)}' +
    'body.gn-fs .sg-log-hd b{font-family:"Ma Shan Zheng","LXGW WenKai",serif;font-size:20px;font-weight:400;color:var(--gold2)}' +
    'body.gn-fs .sg-log-close{all:unset;cursor:pointer;min-width:44px;min-height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--gold2);font-size:18px;background:rgba(255,255,255,.06);transition:transform 120ms cubic-bezier(0.23,1,0.32,1)}' +
    'body.gn-fs .sg-log-close:active{transform:scale(.97)}' +
    'body.gn-fs .sg-log-list{flex:1;overflow-y:auto;margin:0;padding:8px 12px;list-style:none;font-size:12px;line-height:1.5;color:#f3e6c8}' +
    'body.gn-fs .sg-log-list li{padding:4px 0;border-bottom:1px solid rgba(217,180,106,.12)}' +
    'body.gn-fs .sg-log-list li.empty{color:#a8977a;border:0;text-align:center;padding:24px 0}' +
    '@media(pointer:coarse){body.gn-fs .sg-me-eq button::after{content:"";position:absolute;left:50%;top:50%;width:max(100%,44px);height:44px;transform:translate(-50%,-50%)}}' +
    'body.gn-fs .sg-chip.rd{display:inline-block}' +
    '@media (hover:hover){body.gn-fs .sg-seats .sg-seat.pickable:hover{transform:translateY(-3px)}}' +
    '@container sg (max-height:500px){' +
      'body.gn-fs .sg{--ch:30cqh}' +
      'body.gn-fs .sg-seats .sg-eq span em{display:none}' +
      'body.gn-fs .pz,body.gn-fs .pz .sg-card{--cw:clamp(36px,10.5cqh,54px)}' +
      'body.gn-fs .sg-fs-act{flex-direction:row;flex-wrap:wrap;justify-content:center;gap:4px 8px}' +
      'body.gn-fs .sg-fs-ask{font-size:12px;padding:2px 10px}' +
      'body.gn-fs .sg-chip{font-size:11px;line-height:22px;padding:0 8px}' +
      'body.gn-fs .sg-fs-timer{height:22px}' +
      'body.gn-fs .sgb{font-size:13px}' +
    '}' +
    '@media (prefers-reduced-motion:reduce){' +
      '.sg-seat.turn,.sg-hp.low i.on,.sg-lines path,.sg-seat.die .sg-port::before,.sg-float,.sg-choice,.sg-pop{animation:none!important}' +
      '.sg-seat,.sg-card,.sgb,.sg-skill,.sg-me-eq button,.sg-log-fab,.sg-log-drawer,.sg-log-close{transition:opacity 120ms linear!important}' +
    '}';

  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('sanguo', {
    init: function(container) {
      container.innerHTML = '<div class="sg-root" id="sgRoot"></div>';
      host = container;
      root = document.getElementById('sgRoot');
      S = null; selCards = []; selTargets = []; lastKey = ''; showLog = false; openSkill = ''; openSeat = -1; openCard = null; cardIndex = {};
      prev = null; lastHandHtml = ''; lastPlayRect = null; cancelAnimationFrame(rafId); clearEventCards();
      clearInterval(timer);
      timer = setInterval(tick, 250);
      injectStylesOnce('sg-styles-v4', CSS);
      if (!window._sgResize) {
        window._sgResize = true;
        window.addEventListener('resize', function() { if (root && document.body.contains(root)) fit(); });
        window.addEventListener('gn:fullscreen', function() { if (root && document.body.contains(root)) fit(); });
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
