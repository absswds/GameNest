(function () {
  var W = 1000;
  var H = 500;
  var BALL_R = 14;
  var HEAD_STRING_X = 250;
  var FOOT_SPOT_X = 750;
  var FOOT_SPOT_Y = 250;
  var RAIL = 42;
  var CW = W + 2 * RAIL;
  var CH = H + 2 * RAIL;

  var POCKETS = [
    { id: 0, x: 0, y: 0, r: 28 },
    { id: 1, x: 500, y: -4, r: 25 },
    { id: 2, x: 1000, y: 0, r: 28 },
    { id: 3, x: 0, y: 500, r: 28 },
    { id: 4, x: 500, y: 504, r: 25 },
    { id: 5, x: 1000, y: 500, r: 28 },
  ];

  var BALL_COLORS = {
    0: '#fbfbf7',
    1: '#f4c430',
    2: '#1f5fd6',
    3: '#d62828',
    4: '#6b2fb3',
    5: '#eb6b1e',
    6: '#1d8a4e',
    7: '#7f1d1d',
    8: '#151518',
    9: '#f4c430',
    10: '#1f5fd6',
    11: '#d62828',
    12: '#6b2fb3',
    13: '#eb6b1e',
    14: '#1d8a4e',
    15: '#7f1d1d',
  };

  var STYLES = [
    '.pool-wrap { width:100%; max-width:920px; margin:0 auto; display:flex; flex-direction:column; align-items:center; gap:8px; box-sizing:border-box; user-select:none; }',
    '.pool-hud { width:100%; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:8px; }',
    '.pool-seat { display:flex; flex-direction:column; gap:3px; padding:6px 10px; border-radius:12px; background:var(--surface, #fff); border:2px solid var(--border, #e5e0d5); min-width:0; transition:border-color 0.2s, box-shadow 0.2s; }',
    '.pool-seat--right { align-items:flex-end; text-align:right; }',
    '.pool-seat--active { border-color:var(--accent, #c8a45c); box-shadow:0 0 0 2px rgba(200,164,92,0.22); }',
    '.pool-seat-top { display:flex; align-items:center; gap:6px; max-width:100%; }',
    '.pool-seat--right .pool-seat-top { flex-direction:row-reverse; }',
    '.pool-seat-name { font-size:13px; font-weight:700; color:var(--text, #1c1917); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    '.pool-group-badge { font-size:11px; font-weight:700; padding:1px 7px; border-radius:999px; background:rgba(148,163,184,0.16); color:var(--text-muted, #6a6257); white-space:nowrap; }',
    '.pool-group-badge--solid { background:rgba(244,196,48,0.22); color:#854d0e; }',
    '.pool-group-badge--stripe { background:rgba(31,95,214,0.16); color:#1e40af; }',
    '.pool-group-badge--eight { background:rgba(21,21,24,0.14); color:#151518; }',
    '.pool-dots { display:flex; align-items:center; gap:3px; flex-wrap:wrap; min-height:11px; }',
    '.pool-dot { width:9px; height:9px; border-radius:50%; border:1px solid rgba(0,0,0,0.25); box-sizing:border-box; }',
    '.pool-dot--stripe { background:linear-gradient(180deg, #fff 24%, currentColor 25%, currentColor 75%, #fff 76%) !important; }',
    '.pool-dot--potted { opacity:0.2; }',
    '.pool-status-pill { padding:5px 12px; border-radius:999px; font-size:12px; font-weight:700; background:var(--surface, #fff); border:1px solid var(--border, #e5e0d5); color:var(--text, #1c1917); white-space:nowrap; text-align:center; }',
    '.pool-status-pill--mine { background:rgba(200,164,92,0.18); border-color:var(--accent, #c8a45c); }',
    '.pool-main { width:100%; display:flex; flex-direction:column; align-items:center; gap:8px; }',
    '.pool-canvas-wrap { display:flex; align-items:center; justify-content:center; width:100%; }',
    '.pool-canvas { touch-action:none; display:block; border-radius:14px; box-shadow:0 10px 28px rgba(15,23,42,0.28); cursor:crosshair; }',
    '.pool-bar { width:100%; display:flex; align-items:center; justify-content:center; min-height:48px; }',
    '.pool-panel { width:100%; display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:10px; padding:6px 12px; border-radius:12px; background:var(--surface, #fff); border:1px solid var(--border, #e5e0d5); box-sizing:border-box; }',
    '.pool-power-wrap { display:flex; align-items:center; gap:8px; flex:1; min-width:130px; max-width:360px; }',
    '.pool-power-head { display:flex; align-items:center; gap:6px; flex-shrink:0; }',
    '.pool-power-label { font-size:13px; font-weight:700; color:var(--text, #1c1917); white-space:nowrap; }',
    '.pool-power-slider { flex:1; min-width:80px; accent-color:var(--accent, #c8a45c); cursor:pointer; height:24px; }',
    '.pool-power-val { font-size:13px; font-weight:700; min-width:34px; text-align:right; color:var(--text-muted, #6a6257); font-variant-numeric:tabular-nums; }',
    '.pool-btn { min-height:44px; padding:8px 20px; border-radius:10px; border:none; background:var(--accent, #c8a45c); color:#fff; font-size:14px; font-weight:700; cursor:pointer; }',
    '.pool-btn:disabled { opacity:0.45; cursor:not-allowed; }',
    '.pool-hint { font-size:12px; color:var(--text-muted, #6a6257); text-align:center; }',
    '.pool-wait-text { font-size:12px; color:var(--text-muted, #6a6257); text-align:center; }',
    '@media (max-width: 560px) {',
    '  .pool-wrap { gap:6px; }',
    '  .pool-main { gap:6px; }',
    '  .pool-hud { gap:5px; }',
    '  .pool-seat { padding:4px 7px; }',
    '  .pool-seat-name { font-size:12px; }',
    '  .pool-status-pill { padding:4px 8px; font-size:11px; }',
    '  .pool-panel { padding:5px 10px; gap:8px; }',
    '  .pool-hint { display:none; }',
    '}',
    '.pool-wrap.sideways { gap:4px; max-width:none; }',
    '.pool-wrap.sideways .pool-hud { gap:6px; }',
    '.pool-wrap.sideways .pool-seat { padding:2px 7px; border-radius:8px; border-width:1.5px; }',
    '.pool-wrap.sideways .pool-seat-name { font-size:11px; }',
    '.pool-wrap.sideways .pool-group-badge { font-size:10px; padding:0 5px; }',
    '.pool-wrap.sideways .pool-dots { display:none; }',
    '.pool-wrap.sideways .pool-status-pill { padding:2px 9px; font-size:11px; }',
    '.pool-wrap.sideways .pool-main { flex-direction:row; align-items:stretch; justify-content:center; gap:8px; width:100%; }',
    '.pool-wrap.sideways .pool-canvas-wrap { width:auto; flex:0 0 auto; }',
    '.pool-wrap.sideways .pool-bar { width:106px; flex:0 0 106px; min-height:0; align-items:stretch; }',
    '.pool-wrap.sideways .pool-panel { flex-direction:column; flex-wrap:nowrap; justify-content:space-between; align-items:center; padding:5px 6px; gap:4px; height:100%; overflow:hidden; }',
    '.pool-wrap.sideways .pool-power-wrap { flex-direction:column; flex:1; min-width:0; max-width:none; width:100%; gap:3px; justify-content:center; align-items:center; }',
    '.pool-wrap.sideways .pool-power-head { width:100%; justify-content:space-between; }',
    '.pool-wrap.sideways .pool-power-label, .pool-wrap.sideways .pool-power-val { font-size:11px; min-width:0; }',
    '.pool-wrap.sideways .pool-power-slider { writing-mode:vertical-lr; direction:rtl; width:28px; height:100%; min-height:36px; max-height:150px; min-width:0; flex:1; }',
    '.pool-wrap.sideways .pool-btn { width:100%; min-height:36px; padding:5px 6px; font-size:13px; white-space:nowrap; }',
    '.pool-wrap.sideways .pool-hint { display:none !important; }',
  ].join('\n');

  var containerEl = null;
  var wrapEl = null;
  var hudEl = null;
  var barEl = null;
  var canvas = null;
  var ctx = null;
  var seat0El = null;
  var seat1El = null;
  var statusEl = null;
  var shootBarEl = null;
  var placeBarEl = null;
  var waitBarEl = null;
  var powerInputEl = null;
  var powerValEl = null;
  var shootBtnEl = null;
  var confirmPlaceBtnEl = null;

  var currentState = null;
  var myPlayerIndex = 0;
  var displayBalls = [];
  var lastPlayedSeq = null;
  var lastAimInitSeq = -1;
  var lastTurnPhaseKey = '';
  var lastLayoutKey = '';
  var replaying = false;
  var rafId = null;

  var isPortrait = false;
  var isSideways = false;

  var aimAngle = 0;
  var aimPower = 0.58;
  var placeX = HEAD_STRING_X;
  var placeY = FOOT_SPOT_Y;
  var dragMode = null; // null | 'pull' | 'aim' | 'place'
  var pullDist = 0;

  function t(key) {
    return window._t ? window._t(key) : key;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function round1(v) {
    return Math.round(v * 10) / 10;
  }

  function isMyTurn() {
    return !!(currentState && currentState.winner === null && currentState.phase !== 'over' && currentState.currentPlayer === myPlayerIndex);
  }

  function ballType(id) {
    if (id === 0) return 'cue';
    if (id === 8) return 'eight';
    if (id >= 1 && id <= 7) return 'solid';
    return 'stripe';
  }

  function isValidCuePosLocal(balls, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < BALL_R + 1 || x > W - BALL_R - 1 || y < BALL_R + 1 || y > H - BALL_R - 1) return false;
    var minDist = 2 * BALL_R + 1;
    var minDist2 = minDist * minDist;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b || b.potted || b.id === 0) continue;
      var dx = x - b.x;
      var dy = y - b.y;
      if (dx * dx + dy * dy < minDist2) return false;
    }
    return true;
  }

  function findInitialPlaceSpot(balls) {
    if (isValidCuePosLocal(balls, HEAD_STRING_X, FOOT_SPOT_Y)) {
      return { x: HEAD_STRING_X, y: FOOT_SPOT_Y };
    }
    for (var y = BALL_R + 6; y <= H - BALL_R - 6; y += 20) {
      for (var x = BALL_R + 6; x <= W - BALL_R - 6; x += 20) {
        if (isValidCuePosLocal(balls, x, y)) return { x: x, y: y };
      }
    }
    return { x: HEAD_STRING_X, y: FOOT_SPOT_Y };
  }

  function sendMove(data) {
    if (typeof window.makeGameMove === 'function') {
      window.makeGameMove(data);
    }
  }

  function syncPowerUI() {
    if (powerInputEl) {
      powerInputEl.value = String(Math.round(aimPower * 100));
    }
    if (powerValEl) {
      powerValEl.textContent = Math.round(aimPower * 100) + '%';
    }
  }

  function pickDefaultAimAngle(state) {
    if (!state || !Array.isArray(state.balls)) return 0;
    var cue = null;
    for (var i = 0; i < state.balls.length; i++) {
      if (state.balls[i] && state.balls[i].id === 0 && !state.balls[i].potted) {
        cue = state.balls[i];
        break;
      }
    }
    if (!cue) return 0;
    if (state.isBreak) {
      return Math.atan2(FOOT_SPOT_Y - cue.y, FOOT_SPOT_X - cue.x);
    }
    var myGroup = state.groups ? state.groups[myPlayerIndex] : null;
    var ownCount = 0;
    var best = null;
    var bestD2 = Infinity;
    for (var j = 0; j < state.balls.length; j++) {
      var b = state.balls[j];
      if (!b || b.potted || b.id === 0) continue;
      if (myGroup && b.type === myGroup) ownCount++;
    }
    for (var k = 0; k < state.balls.length; k++) {
      var obj = state.balls[k];
      if (!obj || obj.potted || obj.id === 0) continue;
      if (!myGroup && obj.id === 8) continue;
      if (myGroup && ownCount > 0 && obj.type !== myGroup) continue;
      if (myGroup && ownCount === 0 && obj.id !== 8) continue;
      var d2 = (obj.x - cue.x) * (obj.x - cue.x) + (obj.y - cue.y) * (obj.y - cue.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = obj;
      }
    }
    if (best) return Math.atan2(best.y - cue.y, best.x - cue.x);
    return 0;
  }

  function resizeCanvas() {
    if (!canvas || !ctx || !containerEl) return;
    isSideways = window.innerHeight < 540 && window.innerWidth > window.innerHeight;
    isPortrait = !isSideways && window.innerHeight > window.innerWidth;

    if (wrapEl) {
      wrapEl.classList.toggle('sideways', isSideways);
      wrapEl.classList.toggle('portrait', isPortrait);
    }

    var fitEl = (isSideways && containerEl.closest && containerEl.closest('.board-wrap')) || containerEl;
    var fit = window.boardFit ? window.boardFit(fitEl) : { w: window.innerWidth - 24, h: window.innerHeight - 160 };
    var hudH = (hudEl && hudEl.offsetHeight) ? hudEl.offsetHeight : (isSideways ? 28 : 54);
    var dispW, dispH;

    if (isSideways) {
      var ga = document.getElementById('gameActions');
      var gaH = (ga && ga.offsetParent) ? ga.offsetHeight + 8 : 0;
      var sideBarW = 106 + 10;
      var availW = Math.max(180, fit.w - sideBarW);
      var availH = Math.max(100, fit.h - gaH - hudH - 10);
      var scaleS = Math.min(availW / CW, availH / CH);
      dispW = Math.max(180, Math.floor(CW * scaleS));
      dispH = Math.max(100, Math.floor(CH * scaleS));
      if (barEl) barEl.style.height = dispH + 'px';
    } else if (isPortrait) {
      if (barEl) barEl.style.height = '';
      var barH = (barEl && barEl.offsetHeight) ? barEl.offsetHeight : 58;
      var reserveP = hudH + Math.max(58, barH) + 16;
      var availWP = Math.max(160, fit.w);
      var availHP = Math.max(240, fit.h - reserveP);
      var scaleP = Math.min(availWP / CH, availHP / CW);
      dispW = Math.max(160, Math.floor(CH * scaleP));
      dispH = Math.max(240, Math.floor(CW * scaleP));
    } else {
      if (barEl) barEl.style.height = '';
      var barHL = (barEl && barEl.offsetHeight) ? barEl.offsetHeight : 54;
      var reserveL = hudH + Math.max(54, barHL) + 18;
      var availWL = Math.max(240, fit.w);
      var availHL = Math.max(130, fit.h - reserveL);
      var scaleL = Math.min(availWL / CW, availHL / CH);
      dispW = Math.max(240, Math.floor(CW * scaleL));
      dispH = Math.max(130, Math.floor(CH * scaleL));
    }

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(dispW * dpr);
    canvas.height = Math.round(dispH * dpr);
    canvas.style.width = dispW + 'px';
    canvas.style.height = dispH + 'px';

    lastLayoutKey = window.innerWidth + 'x' + window.innerHeight + ':' + (containerEl ? containerEl.clientWidth : 0);

    draw();
  }

  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  function drawTable() {
    // Outer mahogany wooden rail frame
    var woodGrad = ctx.createLinearGradient(0, 0, CW, CH);
    woodGrad.addColorStop(0, '#6e3a1f');
    woodGrad.addColorStop(0.5, '#532914');
    woodGrad.addColorStop(1, '#3d1c0c');
    roundRectPath(ctx, 0, 0, CW, CH, 22);
    ctx.fillStyle = woodGrad;
    ctx.fill();

    // Subtle outer rim highlight
    ctx.strokeStyle = 'rgba(255,220,175,0.18)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, 2, 2, CW - 4, CH - 4, 20);
    ctx.stroke();

    // Brass corner and side plates
    ctx.fillStyle = '#c8a252';
    var plates = [
      [10, 10, 44, 14],
      [CW - 54, 10, 44, 14],
      [10, CH - 24, 44, 14],
      [CW - 54, CH - 24, 44, 14],
      [CW / 2 - 22, 8, 44, 10],
      [CW / 2 - 22, CH - 18, 44, 10],
    ];
    for (var pi = 0; pi < plates.length; pi++) {
      roundRectPath(ctx, plates[pi][0], plates[pi][1], plates[pi][2], plates[pi][3], 5);
      ctx.fill();
    }

    // Rail diamond sights
    ctx.fillStyle = 'rgba(255,236,195,0.65)';
    var sx = [125, 250, 375, 625, 750, 875];
    for (var si = 0; si < sx.length; si++) {
      ctx.beginPath();
      ctx.arc(RAIL + sx[si], RAIL * 0.45, 3, 0, Math.PI * 2);
      ctx.arc(RAIL + sx[si], CH - RAIL * 0.45, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    var sy = [125, 250, 375];
    for (var sj = 0; sj < sy.length; sj++) {
      ctx.beginPath();
      ctx.arc(RAIL * 0.45, RAIL + sy[sj], 3, 0, Math.PI * 2);
      ctx.arc(CW - RAIL * 0.45, RAIL + sy[sj], 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dark inner cushion bevel
    roundRectPath(ctx, RAIL - 10, RAIL - 10, W + 20, H + 20, 12);
    ctx.fillStyle = '#113a26';
    ctx.fill();

    // Tournament green felt
    var feltGrad = ctx.createRadialGradient(CW / 2, CH / 2, 40, CW / 2, CH / 2, W * 0.62);
    feltGrad.addColorStop(0, '#1e6b48');
    feltGrad.addColorStop(1, '#144b32');
    ctx.fillStyle = feltGrad;
    ctx.fillRect(RAIL, RAIL, W, H);

    // Subtle inner cushion shadow along edges
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 6;
    ctx.strokeRect(RAIL + 3, RAIL + 3, W - 6, H - 6);

    // Baulk (head string) line & foot spot
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(RAIL + HEAD_STRING_X, RAIL + 4);
    ctx.lineTo(RAIL + HEAD_STRING_X, RAIL + H - 4);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.arc(RAIL + FOOT_SPOT_X, RAIL + FOOT_SPOT_Y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 6 dark recessed pockets
    for (var k = 0; k < POCKETS.length; k++) {
      var p = POCKETS[k];
      var px = RAIL + p.x;
      var py = RAIL + p.y;
      ctx.fillStyle = '#1b130d';
      ctx.beginPath();
      ctx.arc(px, py, p.r + 4, 0, Math.PI * 2);
      ctx.fill();

      var pGrad = ctx.createRadialGradient(px, py, p.r * 0.2, px, py, p.r);
      pGrad.addColorStop(0, '#040507');
      pGrad.addColorStop(1, '#14171c');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBall(b, alpha) {
    var cx = RAIL + b.x;
    var cy = RAIL + b.y;
    var color = BALL_COLORS[b.id] || '#ccc';
    var isStripe = b.id >= 9 && b.id <= 15;

    ctx.save();
    if (alpha !== undefined && alpha < 1) {
      ctx.globalAlpha = alpha;
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.arc(cx + 3, cy + 4, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // Clip to ball circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, BALL_R, 0, Math.PI * 2);
    ctx.clip();

    if (isStripe) {
      ctx.fillStyle = '#faf9f2';
      ctx.fillRect(cx - BALL_R, cy - BALL_R, BALL_R * 2, BALL_R * 2);
      ctx.fillStyle = color;
      ctx.fillRect(cx - BALL_R, cy - BALL_R * 0.56, BALL_R * 2, BALL_R * 1.12);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(cx - BALL_R, cy - BALL_R, BALL_R * 2, BALL_R * 2);
    }

    // 3D sphere shading
    var shade = ctx.createRadialGradient(cx - BALL_R * 0.35, cy - BALL_R * 0.35, 1, cx, cy, BALL_R);
    shade.addColorStop(0, 'rgba(255,255,255,0.36)');
    shade.addColorStop(0.55, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.36)');
    ctx.fillStyle = shade;
    ctx.fillRect(cx - BALL_R, cy - BALL_R, BALL_R * 2, BALL_R * 2);
    ctx.restore();

    // Crisp white number disk & black digit for 1..15
    if (b.id > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, BALL_R * 0.48, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      if (isPortrait) {
        ctx.rotate(Math.PI / 2);
      }
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(b.id), 0, 0.6);
      ctx.restore();
    }

    // Subtle specular dot
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(cx - BALL_R * 0.34, cy - BALL_R * 0.36, BALL_R * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Subtle outline
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, BALL_R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function raycastCue(cue, angle, balls) {
    var dx = Math.cos(angle);
    var dy = Math.sin(angle);
    var tx = dx > 1e-9 ? (W - BALL_R - cue.x) / dx : (dx < -1e-9 ? (BALL_R - cue.x) / dx : Infinity);
    var ty = dy > 1e-9 ? (H - BALL_R - cue.y) / dy : (dy < -1e-9 ? (BALL_R - cue.y) / dy : Infinity);
    var tMin = Math.max(0, Math.min(tx, ty));
    var hitBall = null;
    var r2 = 2 * BALL_R;
    var r2Sq = r2 * r2;

    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b || b.potted || b.id === 0) continue;
      var ox = b.x - cue.x;
      var oy = b.y - cue.y;
      var proj = ox * dx + oy * dy;
      if (proj <= 0) continue;
      var perp2 = ox * ox + oy * oy - proj * proj;
      if (perp2 < r2Sq) {
        var thc = Math.sqrt(r2Sq - perp2);
        var tHit = proj - thc;
        if (tHit >= 0 && tHit < tMin) {
          tMin = tHit;
          hitBall = b;
        }
      }
    }

    return {
      gx: cue.x + dx * tMin,
      gy: cue.y + dy * tMin,
      hitBall: hitBall,
    };
  }

  function drawAimGuide(cue, balls) {
    var hit = raycastCue(cue, aimAngle, balls);
    var cx = RAIL + cue.x;
    var cy = RAIL + cue.y;
    var gx = RAIL + hit.gx;
    var gy = RAIL + hit.gy;

    // Dotted aim line from cue to ghost ball center
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(gx, gy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Translucent ghost ball ring
    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(gx, gy, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Target deflection arrow when hitting an object ball
    if (hit.hitBall) {
      var nx = hit.hitBall.x - hit.gx;
      var ny = hit.hitBall.y - hit.gy;
      var len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      var tx0 = RAIL + hit.hitBall.x;
      var ty0 = RAIL + hit.hitBall.y;
      var tx1 = tx0 + nx * 68;
      var ty1 = ty0 + ny * 68;
      ctx.strokeStyle = 'rgba(253,224,71,0.9)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(tx0, ty0);
      ctx.lineTo(tx1, ty1);
      ctx.stroke();

      var ang = Math.atan2(ny, nx);
      ctx.fillStyle = 'rgba(253,224,71,0.9)';
      ctx.beginPath();
      ctx.moveTo(tx1, ty1);
      ctx.lineTo(tx1 - 9 * Math.cos(ang - 0.45), ty1 - 9 * Math.sin(ang - 0.45));
      ctx.lineTo(tx1 - 9 * Math.cos(ang + 0.45), ty1 - 9 * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
    }

    // Wooden cue stick behind cue ball, clamped to stay inside the canvas
    var backAngle = aimAngle + Math.PI;
    var bx = Math.cos(backAngle);
    var by = Math.sin(backAngle);
    var pad = 8;
    var maxX = bx > 1e-9 ? (CW - pad - cx) / bx : (bx < -1e-9 ? (pad - cx) / bx : Infinity);
    var maxY = by > 1e-9 ? (CH - pad - cy) / by : (by < -1e-9 ? (pad - cy) / by : Infinity);
    var maxStickReach = Math.max(14, Math.min(maxX, maxY));
    var desiredPull = 16 + aimPower * 65;
    var actualPull = Math.min(desiredPull, Math.max(6, maxStickReach * 0.35));
    var stickLen = Math.max(8, Math.min(175, maxStickReach - actualPull));

    var tipX = cx + bx * actualPull;
    var tipY = cy + by * actualPull;
    var buttX = tipX + bx * stickLen;
    var buttY = tipY + by * stickLen;

    // Stick shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tipX + 2, tipY + 3);
    ctx.lineTo(buttX + 2, buttY + 3);
    ctx.stroke();

    // Stick shaft gradient
    var stickGrad = ctx.createLinearGradient(tipX, tipY, buttX, buttY);
    stickGrad.addColorStop(0, '#f3e5c8');
    stickGrad.addColorStop(0.45, '#d6a662');
    stickGrad.addColorStop(0.5, '#3b2416');
    stickGrad.addColorStop(1, '#1e110a');
    ctx.strokeStyle = stickGrad;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(buttX, buttY);
    ctx.stroke();

    // Blue chalk tip
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 3.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBallInHandGhost() {
    var valid = isValidCuePosLocal(displayBalls, placeX, placeY);
    drawBall({ id: 0, x: placeX, y: placeY, potted: false, type: 'cue' }, 0.72);
    ctx.save();
    ctx.strokeStyle = valid ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(RAIL + placeX, RAIL + placeY, BALL_R + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isPortrait) {
      ctx.setTransform(canvas.width / CH, 0, 0, canvas.height / CW, 0, 0);
      ctx.translate(0, CW);
      ctx.rotate(-Math.PI / 2);
    } else {
      ctx.setTransform(canvas.width / CW, 0, 0, canvas.height / CH, 0, 0);
    }

    drawTable();

    var balls = displayBalls || [];
    var cue = null;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b || b.potted) continue;
      if (b.id === 0) cue = b;
      drawBall(b, 1);
    }

    if (currentState && isMyTurn() && !replaying) {
      if (currentState.phase === 'shoot' && cue) {
        drawAimGuide(cue, balls);
      } else if (currentState.phase === 'ball_in_hand') {
        drawBallInHandGhost();
      }
    }

    ctx.restore();
  }

  function buildDotsHtml(group, balls) {
    if (!group) return '';
    var ids = [];
    var ownLeft = 0;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b) continue;
      if (b.type === group) {
        ids.push(b);
        if (!b.potted) ownLeft++;
      }
    }
    if (ownLeft === 0) {
      var eight = null;
      for (var j = 0; j < balls.length; j++) {
        if (balls[j] && balls[j].id === 8) eight = balls[j];
      }
      if (eight) {
        return '<span class="pool-dot' + (eight.potted ? ' pool-dot--potted' : '') + '" style="background:' + BALL_COLORS[8] + '"></span>';
      }
      return '';
    }
    ids.sort(function (a, b) { return a.id - b.id; });
    return ids.map(function (b) {
      var isStripe = b.id >= 9;
      var cls = 'pool-dot' + (isStripe ? ' pool-dot--stripe' : '') + (b.potted ? ' pool-dot--potted' : '');
      var col = BALL_COLORS[b.id];
      return '<span class="' + cls + '" style="background:' + col + ';color:' + col + '"></span>';
    }).join('');
  }

  function updateSeatCard(el, seatIdx) {
    if (!el || !currentState) return;
    var name = window.getPlayerName ? window.getPlayerName(seatIdx) : ('P' + (seatIdx + 1));
    var group = currentState.groups ? currentState.groups[seatIdx] : null;
    var balls = currentState.balls || [];
    var ownLeft = 0;
    if (group) {
      for (var i = 0; i < balls.length; i++) {
        if (balls[i] && !balls[i].potted && balls[i].type === group) ownLeft++;
      }
    }
    var badgeText = t('pool_open_table');
    var badgeMod = '';
    if (group === 'solid') {
      if (ownLeft === 0) {
        badgeText = t('pool_on_eight');
        badgeMod = ' pool-group-badge--eight';
      } else {
        badgeText = t('pool_solids');
        badgeMod = ' pool-group-badge--solid';
      }
    } else if (group === 'stripe') {
      if (ownLeft === 0) {
        badgeText = t('pool_on_eight');
        badgeMod = ' pool-group-badge--eight';
      } else {
        badgeText = t('pool_stripes');
        badgeMod = ' pool-group-badge--stripe';
      }
    }

    var active = currentState.winner === null && currentState.phase !== 'over' && currentState.currentPlayer === seatIdx;
    el.className = 'pool-seat' + (seatIdx === 1 ? ' pool-seat--right' : '') + (active ? ' pool-seat--active' : '');
    el.innerHTML =
      '<div class="pool-seat-top">' +
        '<span class="pool-seat-name"></span>' +
        '<span class="pool-group-badge' + badgeMod + '"></span>' +
      '</div>' +
      '<div class="pool-dots">' + buildDotsHtml(group, balls) + '</div>';
    el.querySelector('.pool-seat-name').textContent = name;
    el.querySelector('.pool-group-badge').textContent = badgeText;
  }

  function updateHUD() {
    if (!currentState) return;
    updateSeatCard(seat0El, 0);
    updateSeatCard(seat1El, 1);

    if (!statusEl) return;
    var mine = isMyTurn();
    statusEl.className = 'pool-status-pill' + (mine ? ' pool-status-pill--mine' : '');
    if (currentState.phase === 'over' || currentState.winner !== null) {
      statusEl.textContent = currentState.winner === myPlayerIndex ? t('rv_you_win') : (currentState.winner === -1 ? t('rv_draw') : t('rv_you_lose'));
    } else if (currentState.phase === 'ball_in_hand') {
      statusEl.textContent = mine ? t('pool_place_cue') : t('pool_opp_place_cue');
    } else if (currentState.isBreak && mine) {
      statusEl.textContent = t('pool_break_shot');
    } else {
      statusEl.textContent = mine ? t('pool_your_turn') : t('pool_opp_turn');
    }
  }

  function updateBar() {
    if (!currentState) return;
    var mine = isMyTurn() && !replaying;
    if (mine && currentState.phase === 'shoot') {
      shootBarEl.style.display = 'flex';
      placeBarEl.style.display = 'none';
      waitBarEl.style.display = 'none';
      syncPowerUI();
    } else if (mine && currentState.phase === 'ball_in_hand') {
      shootBarEl.style.display = 'none';
      placeBarEl.style.display = 'flex';
      waitBarEl.style.display = 'none';
      if (confirmPlaceBtnEl) {
        confirmPlaceBtnEl.disabled = !isValidCuePosLocal(displayBalls, placeX, placeY);
      }
    } else {
      shootBarEl.style.display = 'none';
      placeBarEl.style.display = 'none';
      waitBarEl.style.display = 'flex';
      if (currentState.phase === 'over' || currentState.winner !== null) {
        waitBarEl.textContent = currentState.winner === myPlayerIndex ? t('rv_you_win') : (currentState.winner === -1 ? t('rv_draw') : t('rv_you_lose'));
      } else if (currentState.phase === 'ball_in_hand') {
        waitBarEl.textContent = t('pool_opp_place_cue');
      } else {
        waitBarEl.textContent = t('pool_opp_turn');
      }
    }
  }

  function announceShotOutcome(shot) {
    if (!shot || typeof window.showToast !== 'function') return;
    if (shot.respotEight) {
      window.showToast(t('pool_respot_eight'));
      return;
    }
    if (shot.foul === 'scratch') window.showToast(t('pool_foul_scratch'));
    else if (shot.foul === 'no_hit') window.showToast(t('pool_foul_no_hit'));
    else if (shot.foul === 'wrong_ball') window.showToast(t('pool_foul_wrong_ball'));
    else if (shot.foul === 'early_eight') window.showToast(t('pool_foul_early_eight'));
  }

  function parseFrame(flat) {
    var map = {};
    if (!Array.isArray(flat)) return map;
    for (var i = 0; i + 2 < flat.length; i += 3) {
      map[flat[i]] = { x: flat[i + 1], y: flat[i + 2] };
    }
    return map;
  }

  function finishReplay(shot) {
    replaying = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    displayBalls = (currentState && Array.isArray(currentState.balls)) ? currentState.balls : [];
    if (currentState && currentState.phase === 'ball_in_hand' && isMyTurn()) {
      var spot = findInitialPlaceSpot(displayBalls);
      placeX = spot.x;
      placeY = spot.y;
    }
    updateHUD();
    updateBar();
    draw();
    try {
      announceShotOutcome(shot);
    } catch (_e) {}
  }

  function startReplay(state) {
    var shot = state && state.lastShot;
    var frames = shot && shot.frames;
    if (!shot || !Array.isArray(frames) || frames.length < 2) {
      finishReplay(shot);
      return;
    }

    var parsed = [];
    for (var i = 0; i < frames.length; i++) {
      parsed.push(parseFrame(frames[i]));
    }
    if (parsed.length < 2) {
      finishReplay(shot);
      return;
    }

    var fps = shot.fps || 30;
    var frameDur = 1000 / fps;
    var totalDur = Math.max(1, (parsed.length - 1) * frameDur);
    var startTime = performance.now();
    replaying = true;
    updateBar();

    function step(now) {
      if (!currentState) {
        replaying = false;
        rafId = null;
        return;
      }
      try {
        var elapsed = Math.max(0, now - startTime);
        if (elapsed >= totalDur) {
          finishReplay(shot);
          return;
        }

        var pos = elapsed / frameDur;
        var k = clamp(Math.floor(pos), 0, parsed.length - 2);
        var alpha = clamp(pos - k, 0, 1);
        var f0 = parsed[k];
        var f1 = parsed[k + 1];
        if (!f0 || !f1) {
          finishReplay(shot);
          return;
        }
        var interp = [];
        for (var id = 0; id <= 15; id++) {
          var a = f0[id];
          var b = f1[id];
          if (a && b) {
            interp.push({
              id: id,
              x: a.x + (b.x - a.x) * alpha,
              y: a.y + (b.y - a.y) * alpha,
              potted: false,
              type: ballType(id),
            });
          }
        }
        displayBalls = interp;
        draw();
        rafId = requestAnimationFrame(step);
      } catch (_err) {
        finishReplay(shot);
      }
    }

    rafId = requestAnimationFrame(step);
  }

  function clientToTable(e) {
    var rect = canvas.getBoundingClientRect();
    if (isPortrait) {
      var px = ((e.clientX - rect.left) / (rect.width || 1)) * CH;
      var py = ((e.clientY - rect.top) / (rect.height || 1)) * CW;
      return { x: (CW - py) - RAIL, y: px - RAIL };
    }
    var lx = ((e.clientX - rect.left) / (rect.width || 1)) * CW;
    var ly = ((e.clientY - rect.top) / (rect.height || 1)) * CH;
    return { x: lx - RAIL, y: ly - RAIL };
  }

  function findDisplayCue() {
    for (var i = 0; i < displayBalls.length; i++) {
      if (displayBalls[i] && displayBalls[i].id === 0 && !displayBalls[i].potted) {
        return displayBalls[i];
      }
    }
    return null;
  }

  function onPointerDown(e) {
    if (!currentState || !isMyTurn() || replaying) return;
    var pt = clientToTable(e);

    if (currentState.phase === 'ball_in_hand') {
      dragMode = 'place';
      placeX = clamp(pt.x, BALL_R + 1, W - BALL_R - 1);
      placeY = clamp(pt.y, BALL_R + 1, H - BALL_R - 1);
      if (confirmPlaceBtnEl) {
        confirmPlaceBtnEl.disabled = !isValidCuePosLocal(displayBalls, placeX, placeY);
      }
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      draw();
      return;
    }

    if (currentState.phase === 'shoot') {
      var cue = findDisplayCue();
      if (!cue) return;
      var distCue = Math.hypot(pt.x - cue.x, pt.y - cue.y);
      if (distCue <= 4.5 * BALL_R) {
        dragMode = 'pull';
        pullDist = 0;
      } else {
        dragMode = 'aim';
        aimAngle = Math.atan2(pt.y - cue.y, pt.x - cue.x);
      }
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      draw();
    }
  }

  function onPointerMove(e) {
    if (!dragMode || !currentState || !isMyTurn() || replaying) return;
    var pt = clientToTable(e);

    if (dragMode === 'place') {
      placeX = clamp(pt.x, BALL_R + 1, W - BALL_R - 1);
      placeY = clamp(pt.y, BALL_R + 1, H - BALL_R - 1);
      if (confirmPlaceBtnEl) {
        confirmPlaceBtnEl.disabled = !isValidCuePosLocal(displayBalls, placeX, placeY);
      }
      draw();
      return;
    }

    var cue = findDisplayCue();
    if (!cue) return;

    if (dragMode === 'pull') {
      var dx = cue.x - pt.x;
      var dy = cue.y - pt.y;
      var dist = Math.hypot(dx, dy);
      pullDist = dist;
      if (dist >= 16) {
        aimAngle = Math.atan2(dy, dx);
        aimPower = clamp((dist - 14) / 200, 0.08, 1.0);
        syncPowerUI();
      }
      draw();
    } else if (dragMode === 'aim') {
      aimAngle = Math.atan2(pt.y - cue.y, pt.x - cue.x);
      draw();
    }
  }

  function onPointerUp(e) {
    if (!dragMode) return;
    var mode = dragMode;
    var dist = pullDist;
    dragMode = null;
    pullDist = 0;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

    if (e.type !== 'pointerup' || !currentState || !isMyTurn() || replaying) {
      draw();
      return;
    }

    if (mode === 'pull' && currentState.phase === 'shoot') {
      if (dist >= 18) {
        sendMove({ type: 'shot', angle: aimAngle, power: clamp(aimPower, 0.05, 1.0) });
      }
    } else if (mode === 'place' && currentState.phase === 'ball_in_hand') {
      if (isValidCuePosLocal(displayBalls, placeX, placeY)) {
        sendMove({ type: 'place', x: round1(placeX), y: round1(placeY) });
      }
    }
    draw();
  }

  function init(container) {
    containerEl = container;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    replaying = false;
    lastPlayedSeq = null;
    lastAimInitSeq = -1;
    lastTurnPhaseKey = '';
    lastLayoutKey = '';
    currentState = null;
    displayBalls = [];
    dragMode = null;
    pullDist = 0;
    aimPower = 0.58;

    if (window.injectStylesOnce) {
      window.injectStylesOnce('pool-styles', STYLES);
    }

    container.innerHTML =
      '<div class="pool-wrap" id="poolWrap">' +
        '<div class="pool-hud" id="poolHud">' +
          '<div id="poolSeat0" class="pool-seat"></div>' +
          '<div id="poolStatus" class="pool-status-pill"></div>' +
          '<div id="poolSeat1" class="pool-seat pool-seat--right"></div>' +
        '</div>' +
        '<div class="pool-main">' +
          '<div class="pool-canvas-wrap">' +
            '<canvas id="poolCanvas" class="pool-canvas"></canvas>' +
          '</div>' +
          '<div class="pool-bar" id="poolBar">' +
            '<div id="poolShootBar" class="pool-panel" style="display:none">' +
              '<div class="pool-power-wrap">' +
                '<div class="pool-power-head">' +
                  '<span class="pool-power-label" id="poolPowerLabel"></span>' +
                  '<span id="poolPowerVal" class="pool-power-val">58%</span>' +
                '</div>' +
                '<input type="range" id="poolPowerInput" class="pool-power-slider" min="5" max="100" value="58">' +
              '</div>' +
              '<button type="button" id="poolShootBtn" class="pool-btn"></button>' +
              '<span class="pool-hint" id="poolAimHint"></span>' +
            '</div>' +
            '<div id="poolPlaceBar" class="pool-panel" style="display:none">' +
              '<span class="pool-hint" style="display:inline" id="poolPlaceHint"></span>' +
              '<button type="button" id="poolConfirmPlaceBtn" class="pool-btn"></button>' +
            '</div>' +
            '<div id="poolWaitBar" class="pool-panel pool-wait-text" style="display:none"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    wrapEl = document.getElementById('poolWrap');
    hudEl = document.getElementById('poolHud');
    barEl = document.getElementById('poolBar');
    seat0El = document.getElementById('poolSeat0');
    seat1El = document.getElementById('poolSeat1');
    statusEl = document.getElementById('poolStatus');
    canvas = document.getElementById('poolCanvas');
    ctx = canvas.getContext('2d');
    shootBarEl = document.getElementById('poolShootBar');
    placeBarEl = document.getElementById('poolPlaceBar');
    waitBarEl = document.getElementById('poolWaitBar');
    powerInputEl = document.getElementById('poolPowerInput');
    powerValEl = document.getElementById('poolPowerVal');
    shootBtnEl = document.getElementById('poolShootBtn');
    confirmPlaceBtnEl = document.getElementById('poolConfirmPlaceBtn');

    document.getElementById('poolPowerLabel').textContent = t('pool_power');
    document.getElementById('poolAimHint').textContent = t('pool_aim_hint');
    document.getElementById('poolPlaceHint').textContent = t('pool_place_hint');
    shootBtnEl.textContent = t('pool_shoot');
    confirmPlaceBtnEl.textContent = t('pool_confirm_place');

    powerInputEl.addEventListener('input', function () {
      aimPower = clamp(Number(powerInputEl.value) / 100, 0.05, 1.0);
      syncPowerUI();
      draw();
    });

    shootBtnEl.addEventListener('click', function () {
      if (!currentState || !isMyTurn() || replaying || currentState.phase !== 'shoot') return;
      sendMove({ type: 'shot', angle: aimAngle, power: clamp(aimPower, 0.05, 1.0) });
    });

    confirmPlaceBtnEl.addEventListener('click', function () {
      if (!currentState || !isMyTurn() || replaying || currentState.phase !== 'ball_in_hand') return;
      if (isValidCuePosLocal(displayBalls, placeX, placeY)) {
        sendMove({ type: 'place', x: round1(placeX), y: round1(placeY) });
      }
    });

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    if (window._poolResizeHandler) {
      window.removeEventListener('resize', window._poolResizeHandler);
    }
    if (window._poolOrientHandler) {
      window.removeEventListener('orientationchange', window._poolOrientHandler);
    }
    window._poolResizeHandler = resizeCanvas;
    window._poolOrientHandler = function () { setTimeout(resizeCanvas, 80); };
    window.addEventListener('resize', window._poolResizeHandler);
    window.addEventListener('orientationchange', window._poolOrientHandler);

    resizeCanvas();
  }

  function render(state, container, playerIndex, _winner) {
    if (!state || !Array.isArray(state.balls)) return;
    if (!canvas || !containerEl) init(container);

    myPlayerIndex = typeof playerIndex === 'number' ? playerIndex : 0;
    currentState = state;

    var seq = (state.lastShot && typeof state.lastShot.seq === 'number') ? state.lastShot.seq : (state.shotSeq || 0);
    var turnPhaseKey = state.currentPlayer + ':' + state.phase + ':' + seq;
    var layoutKey = window.innerWidth + 'x' + window.innerHeight + ':' + (containerEl ? containerEl.clientWidth : 0);

    if (lastPlayedSeq === null) {
      lastPlayedSeq = seq;
      lastAimInitSeq = seq;
      lastTurnPhaseKey = turnPhaseKey;
      displayBalls = state.balls;
      if (state.phase === 'ball_in_hand' && isMyTurn()) {
        var initSpot = findInitialPlaceSpot(displayBalls);
        placeX = initSpot.x;
        placeY = initSpot.y;
      } else if (state.phase === 'shoot' && isMyTurn()) {
        aimAngle = pickDefaultAimAngle(state);
      }
      updateHUD();
      updateBar();
      resizeCanvas();
      return;
    }

    if (state.lastShot && state.lastShot.seq > lastPlayedSeq) {
      lastPlayedSeq = state.lastShot.seq;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      replaying = false;

      if (state.phase === 'shoot' && isMyTurn()) {
        aimAngle = pickDefaultAimAngle(state);
      }
      lastAimInitSeq = seq;
      lastTurnPhaseKey = turnPhaseKey;

      var reduced = window.Motion && window.Motion.reduced && window.Motion.reduced();
      var frames = state.lastShot.frames;
      if (reduced || !Array.isArray(frames) || frames.length < 2) {
        if (layoutKey !== lastLayoutKey) {
          resizeCanvas();
        }
        finishReplay(state.lastShot);
      } else {
        updateHUD();
        if (layoutKey !== lastLayoutKey) {
          resizeCanvas();
        }
        try {
          startReplay(state);
        } catch (_err) {
          finishReplay(state.lastShot);
        }
      }
      return;
    }

    // Same seq (e.g. ball_in_hand -> shoot transition after cue placement, or reset)
    if (seq < lastPlayedSeq) {
      lastPlayedSeq = seq;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      replaying = false;
    }

    if (!replaying) {
      displayBalls = state.balls;
      if (turnPhaseKey !== lastTurnPhaseKey) {
        lastTurnPhaseKey = turnPhaseKey;
        if (state.phase === 'ball_in_hand' && isMyTurn()) {
          var spot2 = findInitialPlaceSpot(displayBalls);
          placeX = spot2.x;
          placeY = spot2.y;
        } else if (state.phase === 'shoot' && isMyTurn()) {
          aimAngle = pickDefaultAimAngle(state);
          lastAimInitSeq = seq;
        }
      } else if (lastAimInitSeq !== seq && state.phase === 'shoot' && isMyTurn()) {
        aimAngle = pickDefaultAimAngle(state);
        lastAimInitSeq = seq;
      }
      updateHUD();
      updateBar();
      if (layoutKey !== lastLayoutKey) {
        resizeCanvas();
      } else {
        draw();
      }
    }
  }

  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('pool', { init: init, render: render });
})();
