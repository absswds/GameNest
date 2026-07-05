// public/js/renderers/monopoly.js — 大富翁（视觉重做 + 动画）
// 棋盘元数据从 state.board 读取（不再镜像常量）。动画：骰子滚动/棋子逐格移动/收租飘字/机会卡。
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var PLAYER_COLORS = ['#E74C3C','#3498DB','#2ECC71','#F39C12','#9B59B6','#1ABC9C'];
  var PLAYER_EMOJIS = ['🔴','🔵','🟢','🟡','🟣','🩵'];
  var DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

  var canvas, ctx, playerIndex, winnerIdx = null;
  var W, H, CS, CO;        // 画布尺寸、边格短边、角格边长
  var cells = [];          // 28 个格子的几何
  var latestState = null;  // 最新服务端 state
  var displayState = null;  // 当前展示用 state（动画期间滞后于 latest）
  var prevSnap = null;     // {lastMove, lastCard, lastRent, dice}
  var eventLog = [];       // 中央事件 log（最近 3 条）

  // 动画状态机
  var anim = { running: false, rafId: null, queue: [], cur: null, startTime: 0, moving: null, floats: [], dice: null };

  function wsSend(data) { window.makeGameMove && window.makeGameMove(data); }
  function priceTextColor(color) {
    var hex = (color || '').replace('#', '');
    if (hex.length !== 6) return '#2d2114';
    var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 156 ? '#2d2114' : '#fffdf7';
  }
  function nameOf(i) { return (window._players && window._players[i]) ? window._players[i].name : _t('mp_player') + ' ' + (i + 1); }
  function spName(sp) { return (window.__ACTIVE_LANG === 'en' && sp && sp.nameEn) ? sp.nameEn : (sp ? sp.name : ''); }

  // ---------- 布局 ----------
  function computeSize() {
    var availW = Math.min(window.innerWidth - 12, window.innerHeight - 200, 680);
    W = Math.max(300, availW);
    CS = W / 8.6;            // 6 边格 + 2 角格(1.3) = 6 + 2.6 = 8.6
    CO = CS * 1.3;
    W = Math.round(CO * 2 + CS * 6);
    H = W;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    cells = layoutCells();
  }

  // 角: 0(右下) 7(左下) 14(左上) 21(右上)
  function layoutCells() {
    var c = [];
    function put(i, x, y, w, h, side, corner) { c[i] = { x: x, y: y, w: w, h: h, side: side, corner: !!corner }; }
    put(0, W - CO, H - CO, CO, CO, 'corner', true);                       // GO 右下
    for (var k = 1; k <= 6; k++) put(k, W - CO - k * CS, H - CO, CS, CO, 'bottom'); // 底边 右→左
    put(7, 0, H - CO, CO, CO, 'corner', true);                            // 左下
    for (var k2 = 8; k2 <= 13; k2++) put(k2, 0, H - CO - (k2 - 7) * CS, CO, CS, 'left'); // 左边 下→上
    put(14, 0, 0, CO, CO, 'corner', true);                               // 左上
    for (var k3 = 15; k3 <= 20; k3++) put(k3, CO + (k3 - 15) * CS, 0, CS, CO, 'top'); // 顶边 左→右
    put(21, W - CO, 0, CO, CO, 'corner', true);                          // 右上
    for (var k4 = 22; k4 <= 27; k4++) put(k4, W - CO, CO + (k4 - 22) * CS, CO, CS, 'right'); // 右边 上→下
    return c;
  }

  function cellCenter(i) { var g = cells[i]; return { x: g.x + g.w / 2, y: g.y + g.h / 2 }; }

  // ---------- 绘制 ----------
  function drawFrame(st) {
    if (!st) return;
    var board = st.board || [];
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#efe7d8'; ctx.fillRect(0, 0, W, H);

    drawCenter(st);
    for (var i = 0; i < 28; i++) drawCell(st, board, i);
    drawTokens(st);
    drawFloats();
  }

  function drawCenter(st) {
    var x = CO, y = CO, w = W - 2 * CO, h = H - 2 * CO;
    // 中央底板
    ctx.fillStyle = '#fbf7ee';
    roundRect(x + 4, y + 4, w - 8, h - 8, 10); ctx.fill();
    ctx.strokeStyle = '#d8cbb0'; ctx.lineWidth = 1; ctx.stroke();

    // 斜向标题缎带
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 9);
    ctx.fillStyle = '#c8a45c';
    ctx.font = 'bold ' + Math.floor(CO * 0.62) + 'px "Ma Shan Zheng", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(_t('mp_title'), 0, -h * 0.18);
    ctx.restore();

    // 骰子
    var dice = anim.dice ? anim.dice.faces : st.dice;
    if (dice && (dice[0] || dice[1])) {
      var ds = CO * 0.62, gap = CO * 0.2;
      var dx = W / 2 - ds - gap / 2, dy = H / 2 - ds * 0.2;
      drawDie(dx, dy, ds, dice[0]);
      drawDie(dx + ds + gap, dy, ds, dice[1]);
    }

    // 当前玩家
    ctx.fillStyle = '#5a4a32';
    ctx.font = Math.floor(CS * 0.3) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (winnerIdx === null || winnerIdx === undefined) {
      ctx.fillText(_tf('mp_turn_prefix', nameOf(st.currentPlayer)), W / 2, H / 2 + h * 0.16);
    }

    // 事件 log
    ctx.font = Math.floor(CS * 0.24) + 'px sans-serif';
    ctx.fillStyle = '#8a7a5e';
    for (var i = 0; i < eventLog.length; i++) {
      ctx.fillText(eventLog[i], W / 2, H / 2 + h * 0.27 + i * (CS * 0.3));
    }
  }

  function drawDie(x, y, s, val) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c8a45c'; ctx.lineWidth = 2;
    roundRect(x, y, s, s, s * 0.18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#333';
    var v = Math.max(1, Math.min(6, val || 1));
    var r = s * 0.09, q = s * 0.26;
    var pips = {
      1: [[0.5, 0.5]], 2: [[0.3, 0.3], [0.7, 0.7]],
      3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
      4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
      5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
      6: [[0.3, 0.28], [0.7, 0.28], [0.3, 0.5], [0.7, 0.5], [0.3, 0.72], [0.7, 0.72]]
    }[v];
    pips.forEach(function (p) { ctx.beginPath(); ctx.arc(x + p[0] * s, y + p[1] * s, r, 0, Math.PI * 2); ctx.fill(); });
  }

  function drawCell(st, board, idx) {
    var g = cells[idx]; if (!g) return;
    var sp = board[idx] || {};
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = '#cbbfa6'; ctx.lineWidth = 1;
    ctx.strokeRect(g.x, g.y, g.w, g.h);

    if (g.corner) { drawCorner(g, sp, idx); return; }

    // 色带（内缘）
    var bar = (g.side === 'bottom' || g.side === 'top') ? g.w : g.h;
    var bt = Math.min(g.w, g.h) * 0.26;
    if (sp.type === 'property' && sp.color) {
      ctx.fillStyle = sp.color;
      if (g.side === 'bottom') ctx.fillRect(g.x, g.y, g.w, bt);
      else if (g.side === 'top') ctx.fillRect(g.x, g.y + g.h - bt, g.w, bt);
      else if (g.side === 'left') ctx.fillRect(g.x + g.w - bt, g.y, bt, g.h);
      else ctx.fillRect(g.x, g.y, bt, g.h);
    }

    // 类型图标 + 名称 + 价格
    var cx = g.x + g.w / 2, cy = g.y + g.h / 2;
    var icon = typeIcon(sp);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (icon) {
      ctx.font = Math.floor(Math.min(g.w, g.h) * 0.34) + 'px serif';
      ctx.fillText(icon, cx, g.y + g.h * 0.42);
    }
    ctx.fillStyle = '#3a3020';
    var fs = Math.max(9, Math.floor(Math.min(g.w, g.h) * 0.2));
    ctx.font = fs + 'px sans-serif';
    var label = spName(sp) || (sp.type === 'chance' ? _t('mp_chance') : '');
    if (label) {
      var lines = wrapLabel(label, 4);
      lines.forEach(function (ln, li) {
        ctx.fillText(ln, cx, g.y + g.h * (icon ? 0.7 : 0.42) + (li - (lines.length - 1) / 2) * (fs + 1));
      });
    }
    if (sp.price) {
      ctx.fillStyle = g.side === 'top' ? priceTextColor(sp.color) : '#6b5537';
      ctx.font = '700 ' + Math.floor(fs * 0.9) + 'px sans-serif';
      ctx.fillText('$' + sp.price, cx, g.y + g.h * 0.9);
    }

    // 所有权 + 房子
    var prop = st.properties && st.properties[idx];
    if (prop) {
      var oc = PLAYER_COLORS[prop.owner % PLAYER_COLORS.length];
      // 内缘 owner 条
      ctx.fillStyle = oc;
      var ob = bt * 0.45;
      if (g.side === 'bottom') ctx.fillRect(g.x, g.y + bt, g.w, ob);
      else if (g.side === 'top') ctx.fillRect(g.x, g.y + g.h - bt - ob, g.w, ob);
      else if (g.side === 'left') ctx.fillRect(g.x + g.w - bt - ob, g.y, ob, g.h);
      else ctx.fillRect(g.x + bt, g.y, ob, g.h);
      // 房子/旅馆
      var houses = prop.houses || 0;
      if (houses > 0) {
        var hy = g.y + g.h * 0.5;
        if (houses >= 5) {
          ctx.font = Math.floor(Math.min(g.w, g.h) * 0.3) + 'px serif';
          ctx.fillText('🏨', cx, hy);
        } else {
          ctx.font = Math.floor(Math.min(g.w, g.h) * 0.2) + 'px serif';
          var s = '';
          for (var h = 0; h < houses; h++) s += '🏠';
          ctx.fillText(s, cx, hy);
        }
      }
    }
  }

  function drawCorner(g, sp, idx) {
    var cx = g.x + g.w / 2, cy = g.y + g.h / 2;
    var bg = { go: '#d6f0d8', jail_visit: '#e8e8e8', free_parking: '#dff3df', go_to_jail: '#f6dcdc' }[sp.type] || '#f0ece0';
    ctx.fillStyle = bg; ctx.fillRect(g.x + 1, g.y + 1, g.w - 2, g.h - 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = Math.floor(g.w * 0.36) + 'px serif';
    var icon = { go: '▶', jail_visit: '👮', free_parking: '🅿️', go_to_jail: '🚓' }[sp.type] || '';
    ctx.fillText(icon, cx, cy - g.h * 0.12);
    ctx.fillStyle = '#5a4a32'; ctx.font = 'bold ' + Math.floor(g.w * 0.17) + 'px sans-serif';
    var labelMap = { go: _t('mp_go'), jail_visit: _t('mp_jail_visit'), free_parking: _t('mp_free_parking'), go_to_jail: _t('mp_go_to_jail') };
    var label = labelMap[sp.type] || '';
    ctx.fillText(label, cx, cy + g.h * 0.26);
  }

  function typeIcon(sp) {
    return { railroad: '🚂', utility: '⚡', chance: '❓', tax: '💰' }[sp.type] || '';
  }

  function wrapLabel(s, per) {
    if (s.length <= per) return [s];
    return [s.slice(0, per), s.slice(per, per * 2)];
  }

  function drawTokens(st) {
    var n = st._playerCount || 0;
    for (var p = 0; p < n; p++) {
      if (st.eliminated && st.eliminated[p]) continue;
      if (anim.moving && anim.moving.player === p) continue; // 移动中的棋子由 overlay 画
      var pos = st.positions[p];
      if (pos === undefined || !cells[pos]) continue;
      var ctr = cellCenter(pos);
      drawToken(ctr.x + tokenOffX(p), ctr.y + tokenOffY(p), p, st.currentPlayer === p && (winnerIdx === null || winnerIdx === undefined));
    }
    // 移动中的棋子
    if (anim.moving) {
      var m = anim.moving;
      drawToken(m.x, m.y, m.player, false, m.alpha);
    }
  }

  function tokenOffX(p) { return (p % 2 === 0 ? -1 : 1) * CS * 0.16; }
  function tokenOffY(p) { return (p < 2 ? -1 : (p < 4 ? 1 : 0)) * CS * 0.16; }

  function drawToken(x, y, p, pulse, alpha) {
    var r = CS * 0.2;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (pulse) {
      var t = (Date.now() % 1000) / 1000;
      ctx.beginPath(); ctx.arc(x, y, r + 3 + Math.sin(t * Math.PI * 2) * 2, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLORS[p % 6] + '44'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = PLAYER_COLORS[p % 6]; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.floor(r * 1.1) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('' + (p + 1), x, y);
    ctx.restore();
  }

  function drawFloats() {
    var now = Date.now();
    for (var i = 0; i < anim.floats.length; i++) {
      var f = anim.floats[i];
      var prog = (now - f.start) / f.dur;
      if (prog >= 1) continue;
      ctx.save();
      ctx.globalAlpha = 1 - prog;
      ctx.fillStyle = f.color;
      ctx.font = 'bold ' + Math.floor(CS * 0.34) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.text, f.x, f.y - prog * CS * 1.2);
      ctx.restore();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- 动画运行 ----------
  function startAnim() {
    if (anim.running) return;
    anim.running = true;
    tick();
  }
  function stopAnim() {
    anim.running = false;
    if (anim.rafId) cancelAnimationFrame(anim.rafId);
    anim.rafId = null;
    anim.cur = null; anim.moving = null; anim.dice = null;
  }

  function tick() {
    var now = Date.now();
    // 清理过期 float
    anim.floats = anim.floats.filter(function (f) { return now - f.start < f.dur; });

    if (!anim.cur) {
      if (anim.queue.length === 0) {
        // 动画全部完成 → 对齐到最新 state
        if (anim.floats.length === 0) {
          anim.running = false;
          displayState = latestState;
          drawFrame(displayState);
          buildPanel(displayState);
          return;
        }
        drawFrame(displayState);
        anim.rafId = requestAnimationFrame(tick);
        return;
      }
      anim.cur = anim.queue.shift();
      anim.cur.startTime = now;
      beginEvent(anim.cur);
    }

    var ev = anim.cur;
    var elapsed = now - ev.startTime;
    var p = Math.min(elapsed / ev.dur, 1);

    if (ev.type === 'dice') {
      anim.dice = { faces: p < 1 ? [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)] : ev.final };
    } else if (ev.type === 'move') {
      updateMove(ev, p);
    }

    drawFrame(displayState);

    if (p >= 1) {
      finishEvent(ev);
      anim.cur = null;
    }
    anim.rafId = requestAnimationFrame(tick);
  }

  function beginEvent(ev) {
    if (ev.type === 'move' && ev.kind !== 'teleport') {
      // 构造路径
      var path = [ev.from];
      var hops = ev.steps >= 0 ? ev.steps : ev.steps; // steps 已带符号
      var dir = ev.steps >= 0 ? 1 : -1;
      var n = Math.abs(ev.steps);
      var cur = ev.from;
      for (var k = 0; k < n; k++) { cur = (cur + dir + 28) % 28; path.push(cur); }
      ev.path = path;
      ev.dur = Math.max(400, n * 130);
    }
  }

  function updateMove(ev, p) {
    if (ev.kind === 'teleport') {
      var ctr = cellCenter(p < 0.5 ? ev.from : ev.to);
      anim.moving = { player: ev.player, x: ctr.x + tokenOffX(ev.player), y: ctr.y + tokenOffY(ev.player), alpha: Math.abs(p - 0.5) * 2 };
      return;
    }
    var hops = ev.path.length - 1;
    var fp = p * hops;
    var seg = Math.min(Math.floor(fp), hops - 1);
    var lt = fp - seg;
    var a = cellCenter(ev.path[seg]), b = cellCenter(ev.path[seg + 1]);
    var arc = -Math.sin(lt * Math.PI) * CS * 0.3;
    anim.moving = {
      player: ev.player,
      x: a.x + (b.x - a.x) * lt + tokenOffX(ev.player),
      y: a.y + (b.y - a.y) * lt + tokenOffY(ev.player) + arc
    };
  }

  function finishEvent(ev) {
    if (ev.type === 'move') {
      anim.moving = null;
      // 移动结束后，把展示 state 的该玩家位置推进到终点（其余仍为旧值）
      if (displayState && displayState.positions) displayState.positions[ev.player] = ev.to;
      if (ev.passedGo) spawnFloat(cellCenter(0), '+200', '#27ae60');
    } else if (ev.type === 'dice') {
      anim.dice = { faces: ev.final };
    } else if (ev.type === 'rent') {
      var c = cellCenter(ev.space);
      spawnFloat(c, '-' + ev.amount, '#e74c3c');
    }
  }

  function spawnFloat(ctr, text, color) {
    anim.floats.push({ x: ctr.x, y: ctr.y, text: text, color: color, start: Date.now(), dur: 1000 });
  }

  // ---------- diff → 事件 ----------
  function buildEvents(st) {
    var evs = [];
    if (st.lastMove && moveSignature(st.lastMove) !== (prevSnap && prevSnap.lastMove)) {
      var dchanged = !prevSnap || st.dice[0] !== prevSnap.dice[0] || st.dice[1] !== prevSnap.dice[1];
      if (dchanged && st.lastMove.kind === 'walk' && st.lastMove.steps === (st.dice[0] + st.dice[1])) {
        evs.push({ type: 'dice', dur: 700, final: [st.dice[0], st.dice[1]] });
      }
      evs.push({ type: 'move', player: st.lastMove.player, from: st.lastMove.from, to: st.lastMove.to, steps: st.lastMove.steps, kind: st.lastMove.kind, passedGo: st.lastMove.passedGo, dur: 600 });
    }
    if (st.lastRent && st.lastRent !== (prevSnap && prevSnap.lastRent) && st.lastRent.amount > 0) {
      evs.push({ type: 'rent', space: st.lastRent.space, amount: st.lastRent.amount, owner: st.lastRent.owner, dur: 300 });
      pushLog(_tf('mp_pay_rent', nameOf(st.lastRent.payer), st.lastRent.amount, nameOf(st.lastRent.owner)));
    }
    if (st.lastCard && st.lastCard !== (prevSnap && prevSnap.lastCard)) {
      pushLog('🎴 ' + st.lastCard.text);
    }
    return evs;
  }

  function pushLog(s) { eventLog.push(s); if (eventLog.length > 3) eventLog.shift(); }

  function getBuildableSpaces(st, pi) {
    var board = st.board || [];
    var buildable = [];
    for (var i = 0; i < board.length; i++) {
      var s = board[i];
      if (!s || s.type !== 'property') continue;
      var prop = st.properties[i];
      if (!prop || prop.owner !== pi || (prop.houses || 0) >= 5) continue;
      var grp = s.group;
      var gs = [];
      board.forEach(function (b, j) { if (b && b.group === grp) gs.push(j); });
      if (gs.every(function (j) { return st.properties[j] && st.properties[j].owner === pi; })) buildable.push(i);
    }
    return buildable;
  }

  function cardEffectPalette(tone) {
    if (tone === 'gain') return { bg: '#e8f6ee', border: '#43a36d', text: '#205f3d' };
    if (tone === 'loss') return { bg: '#fbeaea', border: '#d76b6b', text: '#7a2727' };
    return { bg: '#f6efe2', border: '#c8a45c', text: '#6b5537' };
  }

  function buildCardEffectBanner(st, pi) {
    var effect = st.lastCardEffect;
    if (!effect) return null;
    var palette = cardEffectPalette(effect.tone);
    var box = document.createElement('div');
    var actorName = effect.player === pi ? _t('mp_you') : nameOf(effect.player);
    var prefix = effect.player === pi ? _t('mp_you_drew_card') : _tf('mp_drew_card', actorName);
    box.style.cssText = 'width:100%;padding:10px 12px;border-radius:12px;border:1px solid ' + palette.border + ';background:' + palette.bg + ';color:' + palette.text + ';box-shadow:0 6px 18px rgba(90,74,50,.08);';

    var title = document.createElement('div');
    title.style.cssText = 'font-size:13px;font-weight:800;margin-bottom:4px;';
    title.textContent = prefix;
    box.appendChild(title);

    var summary = document.createElement('div');
    summary.style.cssText = 'font-size:12px;line-height:1.45;';
    summary.textContent = effect.summary || (st.lastCard && st.lastCard.text) || '';
    box.appendChild(summary);

    return box;
  }

  function snapOf(st) {
    return { lastMove: moveSignature(st.lastMove), lastCard: st.lastCard, lastRent: st.lastRent, dice: st.dice ? [st.dice[0], st.dice[1]] : [0, 0] };
  }

  function moveSignature(move) {
    return move ? [move.player, move.from, move.to, move.steps, move.kind, move.passedGo ? 1 : 0].join('|') : '';
  }

  function cloneForDisplay(st) {
    // 仅克隆动画会改写的字段，其余引用共享
    var c = Object.assign({}, st);
    c.positions = st.positions ? st.positions.slice() : [];
    return c;
  }

  // ---------- 操作面板 ----------
  function buildPanel(st) {
    var panel = document.getElementById('mono-panel');
    if (!panel || !st) return;
    panel.innerHTML = '';
    var pi = playerIndex;
    var board = st.board || [];
    var isMyTurn = st.currentPlayer === pi && (winnerIdx === null || winnerIdx === undefined);
    var animating = anim.running;
    var cash = (st.cash && st.cash[pi] !== undefined) ? st.cash[pi] : 0;
    var effectBanner = buildCardEffectBanner(st, pi);

    var cashEl = document.createElement('div');
    cashEl.style.cssText = 'font-size:15px;font-weight:800;color:#5a4a32;';
    cashEl.textContent = _tf('mp_cash', cash);
    panel.appendChild(cashEl);

    if (effectBanner) panel.appendChild(effectBanner);

    if (!isMyTurn) {
      var w = document.createElement('div');
      w.style.cssText = 'color:var(--text-muted);font-size:13px;';
      w.textContent = animating ? '…' : _tf('mp_waiting', nameOf(st.currentPlayer));
      panel.appendChild(w);
      return;
    }
    if (animating) { var d = document.createElement('div'); d.style.cssText = 'color:var(--text-muted);font-size:13px;'; d.textContent = '…'; panel.appendChild(d); return; }

    if (st.inJail && st.inJail[pi]) {
      var jl = document.createElement('div');
      jl.style.cssText = 'font-size:12px;color:#e74c3c;width:100%;text-align:center;';
      jl.textContent = _tf('mp_in_jail', (st.jailTurns[pi] || 0));
      panel.appendChild(jl);
    }

    if (st.phase === 'waiting') {
      addBtn(panel, _t('mp_roll_dice'), 'btn-primary', function () { wsSend({ type: 'roll' }); });
    } else if (st.phase === 'landed' && st.pendingAction === 'can_buy') {
      var sp = board[st.positions[pi]] || {};
      addBtn(panel, _tf('mp_buy', spName(sp), (sp.price || 0)), 'btn-primary', function () { wsSend({ type: 'buy' }); });
      addBtn(panel, _t('mp_skip'), '', function () { wsSend({ type: 'skip_buy' }); });
    } else if (st.phase === 'landed' && st.pendingAction === 'can_build') {
      var ownSpace = board[st.positions[pi]] || {};
      var ownProp = st.properties[st.positions[pi]] || { houses: 0 };
      addBtn(panel, _tf('mp_upgrade', spName(ownSpace), ownProp.houses, ownProp.houses + 1, ((ownSpace.price || 0) / 2)), 'btn-primary', function () {
        wsSend({ type: 'build' });
      });
      addBtn(panel, _t('mp_skip_upgrade'), '', function () { wsSend({ type: 'skip_buy' }); });
    } else if (st.phase === 'end_turn') {
      // 可建房的垄断地产
      var buildable = getBuildableSpaces(st, pi);
      buildable.forEach(function (i) {
        var s = board[i];
        addBtn(panel, '🏗 ' + spName(s) + ' (' + (st.properties[i].houses || 0) + '→' + ((st.properties[i].houses || 0) + 1) + ') $' + (s.price / 2), '', function () { wsSend({ type: 'build', spaceIndex: i }); }, '11px');
      });
      addBtn(panel, _t('mp_end_turn'), 'btn-primary', function () { wsSend({ type: 'end_turn' }); });
    }
  }

  function addBtn(panel, text, cls, onclick, fontSize) {
    var b = document.createElement('button');
    b.className = 'btn ' + (cls || '');
    b.textContent = text;
    if (fontSize) b.style.fontSize = fontSize;
    b.onclick = onclick;
    panel.appendChild(b);
  }

  function buildLegend(st) {
    var legend = document.getElementById('mono-legend');
    if (!legend || !st) return;
    legend.innerHTML = '';
    for (var p = 0; p < (st._playerCount || 0); p++) {
      var chip = document.createElement('div');
      var elim = st.eliminated && st.eliminated[p];
      chip.style.cssText = 'padding:3px 10px;border-radius:12px;background:' + PLAYER_COLORS[p] + '22;border:1px solid ' + PLAYER_COLORS[p] + ';color:#333;' + (elim ? 'opacity:0.4;text-decoration:line-through;' : '');
      chip.textContent = (p + 1) + '·' + nameOf(p) + ' $' + (st.cash[p] || 0);
      if (p === playerIndex) chip.style.fontWeight = '700';
      legend.appendChild(chip);
    }
  }

  // ---------- 渲染入口 ----------
  window.gameRenderers.set('monopoly', {
    init: function (container) {
      container.innerHTML = '';
      latestState = displayState = prevSnap = null; eventLog = [];
      stopAnim(); anim.queue = []; anim.floats = [];
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:6px;';
      container.appendChild(wrap);
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'border-radius:10px;box-shadow:0 4px 20px rgba(90,74,50,.18);';
      wrap.appendChild(canvas);
      ctx = canvas.getContext('2d');
      computeSize();
      window.addEventListener('resize', function () { computeSize(); if (displayState) drawFrame(displayState); });
      var panel = document.createElement('div');
      panel.id = 'mono-panel';
      panel.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;max-width:' + W + 'px;justify-content:center;';
      wrap.appendChild(panel);
      var legend = document.createElement('div');
      legend.id = 'mono-legend';
      legend.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;font-size:12px;justify-content:center;max-width:' + W + 'px;';
      wrap.appendChild(legend);
    },

    render: function (st, container, pi, winner) {
      playerIndex = pi;
      winnerIdx = (winner === null || winner === undefined) ? null : winner;
      if (!st || !st.positions) return;

      var firstOrNewGame = !displayState || !prevSnap;
      latestState = st;

      if (firstOrNewGame) {
        displayState = cloneForDisplay(st);
        prevSnap = snapOf(st);
        eventLog = [];
        drawFrame(displayState);
        buildPanel(displayState);
        buildLegend(st);
        updateStatus(st, winner);
        return;
      }

      var evs = buildEvents(st);
      prevSnap = snapOf(st);

      if (evs.length > 0) {
        // 队列过长则快进
        if (anim.queue.length > 3) {
          anim.queue = []; stopAnim();
          displayState = cloneForDisplay(st);
          drawFrame(displayState); buildPanel(displayState);
        } else {
          // 把当前 displayState 作为动画起点（其 positions 仍是动画前的旧值）
          for (var i = 0; i < evs.length; i++) anim.queue.push(evs[i]);
          buildPanel(displayState); // 动画中禁用按钮
          startAnim();
        }
      } else {
        displayState = cloneForDisplay(st);
        drawFrame(displayState);
        buildPanel(displayState);
      }
      buildLegend(st);
      updateStatus(st, winner);
    },
  });

  function updateStatus(st, winner) {
    var statusEl = document.getElementById('status');
    if (!statusEl) return;
    if (winner !== null && winner !== undefined) {
      statusEl.textContent = winner === playerIndex ? _t('mp_you_win') : nameOf(winner) + _t('mp_wins');
    } else {
      statusEl.textContent = '';
    }
  }
})();
