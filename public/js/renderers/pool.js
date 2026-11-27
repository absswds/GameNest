(function () {
  var POOL_CFG = {
    W: 1000,
    H: 500,
    BALL_R: 14,
    HEAD_STRING_X: 250,
    FOOT_SPOT_X: 750,
    FOOT_SPOT_Y: 250,
    BAULK_X: 250,
    D_RADIUS: 0,
    CENTER_Y: 250,
    RAIL: 42,
    MAX_BALL_ID: 15,
    POCKETS: [
      { id: 0, x: 0, y: 0, r: 28 },
      { id: 1, x: 500, y: -4, r: 25 },
      { id: 2, x: 1000, y: 0, r: 28 },
      { id: 3, x: 0, y: 500, r: 28 },
      { id: 4, x: 500, y: 504, r: 25 },
      { id: 5, x: 1000, y: 500, r: 28 },
    ],
  };

  var SNOOKER_CFG = {
    W: 1200,
    H: 600,
    BALL_R: 11,
    HEAD_STRING_X: 250,
    FOOT_SPOT_X: 900,
    FOOT_SPOT_Y: 300,
    BAULK_X: 250,
    D_RADIUS: 100,
    CENTER_Y: 300,
    RAIL: 42,
    MAX_BALL_ID: 21,
    POCKETS: [
      { id: 0, x: 0, y: 0, r: 21 },
      { id: 1, x: 600, y: -3, r: 19 },
      { id: 2, x: 1200, y: 0, r: 21 },
      { id: 3, x: 0, y: 600, r: 21 },
      { id: 4, x: 600, y: 603, r: 19 },
      { id: 5, x: 1200, y: 600, r: 21 },
    ],
  };

  var isSnooker = false;
  var configInitialized = false;
  var W = POOL_CFG.W;
  var H = POOL_CFG.H;
  var BALL_R = POOL_CFG.BALL_R;
  var HEAD_STRING_X = POOL_CFG.HEAD_STRING_X;
  var FOOT_SPOT_X = POOL_CFG.FOOT_SPOT_X;
  var FOOT_SPOT_Y = POOL_CFG.FOOT_SPOT_Y;
  var BAULK_X = POOL_CFG.BAULK_X;
  var D_RADIUS = POOL_CFG.D_RADIUS;
  var CENTER_Y = POOL_CFG.CENTER_Y;
  var RAIL = POOL_CFG.RAIL;
  var CW = W + 2 * RAIL;
  var CH = H + 2 * RAIL;
  var MAX_BALL_ID = POOL_CFG.MAX_BALL_ID;
  var POCKETS = POOL_CFG.POCKETS;

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

  var SNOOKER_COLOURS = [
    { name: 'yellow', id: 16, value: 2, color: '#eab308', x: 250, y: 400 },
    { name: 'green', id: 17, value: 3, color: '#15803d', x: 250, y: 200 },
    { name: 'brown', id: 18, value: 4, color: '#7c3f18', x: 250, y: 300 },
    { name: 'blue', id: 19, value: 5, color: '#1d4ed8', x: 600, y: 300 },
    { name: 'pink', id: 20, value: 6, color: '#ec4899', x: 900, y: 300 },
    { name: 'black', id: 21, value: 7, color: '#141418', x: 1090, y: 300 },
  ];

  var SNOOKER_BALL_COLORS = {
    0: '#fbfbf7',
    1: '#c81e1e', 2: '#c81e1e', 3: '#c81e1e', 4: '#c81e1e', 5: '#c81e1e',
    6: '#c81e1e', 7: '#c81e1e', 8: '#c81e1e', 9: '#c81e1e', 10: '#c81e1e',
    11: '#c81e1e', 12: '#c81e1e', 13: '#c81e1e', 14: '#c81e1e', 15: '#c81e1e',
    16: '#eab308',
    17: '#15803d',
    18: '#7c3f18',
    19: '#1d4ed8',
    20: '#ec4899',
    21: '#141418',
  };

  var SNOOKER_COLOUR_HEX = {
    red: '#c81e1e',
    yellow: '#eab308',
    green: '#15803d',
    brown: '#7c3f18',
    blue: '#1d4ed8',
    pink: '#ec4899',
    black: '#141418',
  };

  var STYLES = [
    '.pool-wrap { position:relative; width:100%; max-width:920px; margin:0 auto; display:flex; flex-direction:column; align-items:center; gap:8px; box-sizing:border-box; user-select:none; }',
    '.pool-hud { width:100%; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:8px; }',
    '.pool-seat { display:flex; flex-direction:column; gap:3px; padding:6px 10px; border-radius:12px; background:var(--surface, #fff); border:2px solid var(--border, #e5e0d5); min-width:0; transition:border-color 0.2s, box-shadow 0.2s; }',
    '.pool-seat--right { align-items:flex-end; text-align:right; }',
    '.pool-seat--active { border-color:var(--accent, #c8a45c); box-shadow:0 0 0 2px rgba(200,164,92,0.22); }',
    '.pool-seat-top { display:flex; align-items:center; gap:6px; max-width:100%; width:100%; }',
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
    '.snooker-score { font-size:16px; font-weight:800; color:var(--text, #1c1917); font-variant-numeric:tabular-nums; margin-left:auto; }',
    '.pool-seat--right .snooker-score { margin-left:0; margin-right:auto; }',
    '.snooker-seat-meta { display:flex; align-items:center; gap:5px; min-height:14px; font-size:11px; font-weight:700; color:var(--text-muted, #6a6257); }',
    '.snooker-break-pill { padding:0 6px; border-radius:999px; background:rgba(200,164,92,0.22); color:#854d0e; font-size:11px; font-weight:700; white-space:nowrap; }',
    '.pool-status-pill { padding:5px 12px; border-radius:999px; font-size:12px; font-weight:700; background:var(--surface, #fff); border:1px solid var(--border, #e5e0d5); color:var(--text, #1c1917); white-space:nowrap; text-align:center; display:flex; flex-direction:column; align-items:center; gap:1px; }',
    '.pool-status-pill--mine { background:rgba(200,164,92,0.18); border-color:var(--accent, #c8a45c); }',
    '.snooker-status-sub { display:flex; align-items:center; justify-content:center; gap:5px; font-size:11px; font-weight:600; color:var(--text-muted, #6a6257); }',
    '.snooker-on-dot { display:inline-block; width:9px; height:9px; border-radius:50%; border:1px solid rgba(0,0,0,0.3); flex-shrink:0; }',
    '.snooker-nom-bar { width:100%; display:none; align-items:center; justify-content:center; flex-wrap:wrap; gap:6px; padding:5px 10px; border-radius:12px; background:var(--surface, #fff); border:1.5px solid var(--accent, #c8a45c); box-sizing:border-box; }',
    '.snooker-nom-label { font-size:12px; font-weight:700; color:var(--text, #1c1917); margin-right:2px; white-space:nowrap; }',
    '.snooker-nom-btn { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; min-height:28px; border-radius:999px; border:1.5px solid var(--border, #e5e0d5); background:var(--bg, #f8f9fa); color:var(--text, #1c1917); font-size:12px; font-weight:700; cursor:pointer; }',
    '.snooker-nom-btn--active { border-color:var(--accent, #c8a45c); background:rgba(200,164,92,0.22); box-shadow:0 0 0 2px rgba(200,164,92,0.22); }',
    '.snooker-nom-btn:disabled { opacity:0.35; cursor:not-allowed; }',
    '.snooker-nom-dot { width:10px; height:10px; border-radius:50%; border:1px solid rgba(0,0,0,0.25); flex-shrink:0; }',
    '.pool-main { width:100%; display:flex; flex-direction:column; align-items:center; gap:8px; }',
    '.pool-canvas-wrap { display:flex; align-items:center; justify-content:center; width:100%; }',
    '.pool-canvas { touch-action:none; display:block; border-radius:14px; box-shadow:0 10px 28px rgba(15,23,42,0.28); cursor:crosshair; }',
    '.pool-bar { width:100%; display:flex; align-items:center; justify-content:center; min-height:48px; }',
    '.pool-panel { width:100%; display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:10px; padding:6px 12px; border-radius:12px; background:var(--surface, #fff); border:1px solid var(--border, #e5e0d5); box-sizing:border-box; }',
    '.pool-power-wrap { display:flex; align-items:center; gap:8px; flex:1; min-width:130px; max-width:340px; }',
    '.pool-power-head { display:flex; align-items:center; gap:6px; flex-shrink:0; }',
    '.pool-power-label { font-size:13px; font-weight:700; color:var(--text, #1c1917); white-space:nowrap; }',
    '.pool-power-slider { flex:1; min-width:80px; accent-color:var(--accent, #c8a45c); cursor:pointer; height:24px; }',
    '.pool-power-val { font-size:13px; font-weight:700; min-width:34px; text-align:right; color:var(--text-muted, #6a6257); font-variant-numeric:tabular-nums; }',
    '.pool-spin-wrap { display:flex; align-items:center; gap:6px; flex-shrink:0; }',
    '.pool-spin-ball { position:relative; width:40px; height:40px; border-radius:50%; background:radial-gradient(circle at 34% 30%, #ffffff 0%, #f1f0e8 65%, #d6d3c9 100%); border:1.5px solid rgba(28,25,23,0.28); box-shadow:inset 0 -2px 4px rgba(0,0,0,0.16), 0 1px 3px rgba(0,0,0,0.14); touch-action:none; cursor:pointer; flex-shrink:0; }',
    '.pool-spin-ball::before { content:""; position:absolute; left:50%; top:4px; bottom:4px; width:1px; background:rgba(0,0,0,0.14); transform:translateX(-0.5px); pointer-events:none; }',
    '.pool-spin-ball::after { content:""; position:absolute; top:50%; left:4px; right:4px; height:1px; background:rgba(0,0,0,0.14); transform:translateY(-0.5px); pointer-events:none; }',
    '.pool-spin-dot { position:absolute; width:9px; height:9px; border-radius:50%; background:#dc2626; border:1.5px solid #fff; box-shadow:0 1px 2px rgba(0,0,0,0.45); transform:translate(-50%,-50%); left:50%; top:50%; pointer-events:none; }',
    '.pool-spin-meta { display:flex; flex-direction:column; align-items:flex-start; gap:2px; }',
    '.pool-spin-label { font-size:11px; font-weight:700; color:var(--text, #1c1917); line-height:1.1; white-space:nowrap; }',
    '.pool-spin-reset { font-size:11px; font-weight:700; padding:2px 7px; min-height:22px; border-radius:999px; border:1px solid var(--border, #e5e0d5); background:var(--bg, #f8f9fa); color:var(--text-muted, #6a6257); cursor:pointer; line-height:1.1; }',
    '.pool-spin-reset[data-zero="1"] { opacity:0.45; }',
    '.pool-btn { min-height:44px; padding:8px 20px; border-radius:10px; border:none; background:var(--accent, #c8a45c); color:#fff; font-size:14px; font-weight:700; cursor:pointer; }',
    '.pool-btn:disabled { opacity:0.45; cursor:not-allowed; }',
    '.pool-hint { font-size:12px; color:var(--text-muted, #6a6257); text-align:center; }',
    '.pool-wait-text { font-size:12px; color:var(--text-muted, #6a6257); text-align:center; }',
    '.pool-group-overlay { position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:45; min-width:230px; max-width:min(88vw, 340px); padding:16px 20px 14px; border-radius:18px; background:rgba(255,253,248,0.97); border:2px solid var(--accent, #c8a45c); box-shadow:0 12px 36px rgba(0,0,0,0.32); text-align:center; cursor:pointer; color:#1c1917; }',
    '.pool-group-title { font-size:16px; font-weight:800; margin-bottom:10px; }',
    '.pool-group-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:6px 10px; border-radius:10px; background:rgba(0,0,0,0.04); margin-bottom:6px; font-size:13px; font-weight:700; }',
    '.pool-group-who { text-align:left; white-space:nowrap; }',
    '.pool-group-balls { display:flex; align-items:center; gap:3px; flex-shrink:0; }',
    '.pool-group-ball { width:12px; height:12px; border-radius:50%; border:1px solid rgba(0,0,0,0.28); box-sizing:border-box; }',
    '.pool-group-ball--stripe { background:linear-gradient(180deg, #fff 24%, currentColor 25%, currentColor 75%, #fff 76%) !important; }',
    '.pool-group-tap { font-size:11px; color:#6a6257; margin-top:6px; }',
    '@media (max-width: 560px) {',
    '  .pool-wrap { gap:6px; }',
    '  .pool-main { gap:6px; }',
    '  .pool-hud { gap:5px; }',
    '  .pool-seat { padding:4px 7px; }',
    '  .pool-seat-name { font-size:12px; }',
    '  .snooker-score { font-size:14px; }',
    '  .pool-status-pill { padding:4px 8px; font-size:11px; }',
    '  .snooker-status-sub { font-size:10px; }',
    '  .snooker-nom-bar { padding:4px 6px; gap:4px; }',
    '  .snooker-nom-btn { padding:2px 7px; min-height:26px; font-size:11px; }',
    '  .pool-panel { padding:5px 10px; gap:8px; }',
    '  .pool-hint { display:none; }',
    '}',
    '#gameStage:has(.pool-wrap.sideways) .player-bar, #gameStage:has(.pool-wrap.sideways) .game-status { display:none !important; }',
    '#gameStage:has(.pool-wrap.sideways) .board-wrap { padding-bottom:0 !important; }',
    'body:has(.pool-wrap.sideways) { padding-top:4px !important; padding-bottom:4px !important; height:100dvh; max-height:100dvh; overflow:hidden; }',
    '.pool-wrap.sideways { gap:4px; max-width:none; }',
    '.pool-wrap.sideways .pool-hud { gap:6px; }',
    '.pool-wrap.sideways .pool-seat { padding:2px 7px; border-radius:8px; border-width:1.5px; }',
    '.pool-wrap.sideways .pool-seat-name { font-size:11px; }',
    '.pool-wrap.sideways .snooker-score { font-size:13px; }',
    '.pool-wrap.sideways .snooker-seat-meta { display:none; }',
    '.pool-wrap.sideways .pool-group-badge { font-size:10px; padding:0 5px; }',
    '.pool-wrap.sideways .pool-dots { display:none; }',
    '.pool-wrap.sideways .pool-status-pill { padding:2px 9px; font-size:11px; flex-direction:row; gap:6px; }',
    '.pool-wrap.sideways .snooker-status-sub { margin-top:0; font-size:10px; }',
    '.pool-wrap.sideways .snooker-nom-bar { padding:2px 6px; gap:4px; }',
    '.pool-wrap.sideways .snooker-nom-btn { padding:1px 6px; min-height:22px; font-size:10px; }',
    '.pool-wrap.sideways .pool-main { flex-direction:row; align-items:stretch; justify-content:center; gap:8px; width:100%; }',
    '.pool-wrap.sideways .pool-canvas-wrap { width:auto; flex:0 0 auto; }',
    '.pool-wrap.sideways .pool-bar { width:108px; flex:0 0 108px; min-height:0; align-items:stretch; }',
    '.pool-wrap.sideways .pool-panel { flex-direction:column; flex-wrap:nowrap; justify-content:space-between; align-items:center; padding:5px 6px; gap:4px; height:100%; overflow:hidden; }',
    '.pool-wrap.sideways .pool-power-wrap { flex-direction:column; flex:1 1 auto; min-width:0; max-width:none; width:100%; gap:2px; justify-content:center; align-items:center; min-height:0; }',
    '.pool-wrap.sideways .pool-power-head { width:100%; justify-content:space-between; }',
    '.pool-wrap.sideways .pool-power-label, .pool-wrap.sideways .pool-power-val { font-size:11px; min-width:0; }',
    '.pool-wrap.sideways .pool-power-slider { writing-mode:vertical-lr; direction:rtl; width:28px; height:100%; min-height:28px; max-height:130px; min-width:0; flex:1; }',
    '.pool-wrap.sideways .pool-spin-wrap { flex-direction:column; gap:3px; align-items:center; width:100%; }',
    '.pool-wrap.sideways .pool-spin-ball { width:36px; height:36px; }',
    '.pool-wrap.sideways .pool-spin-meta { flex-direction:row; align-items:center; gap:4px; }',
    '.pool-wrap.sideways .pool-spin-label { display:none; }',
    '.pool-wrap.sideways .pool-btn { width:100%; min-height:34px; padding:4px 6px; font-size:13px; white-space:nowrap; }',
    '.pool-wrap.sideways .pool-hint { display:none !important; }',
    '@media (prefers-reduced-motion: reduce) { .pool-group-overlay, .pool-seat { transition:none !important; animation:none !important; } }',
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
  var nomBarEl = null;
  var nomButtons = {};
  var shootBarEl = null;
  var placeBarEl = null;
  var waitBarEl = null;
  var powerInputEl = null;
  var powerValEl = null;
  var spinPadEl = null;
  var spinDotEl = null;
  var spinResetEl = null;
  var placeHintEl = null;
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
  var aimSpinX = 0;
  var aimSpinY = 0;
  var spinDragging = false;
  var selectedNominate = null;
  var lastNomSeq = -1;
  var placeX = HEAD_STRING_X;
  var placeY = FOOT_SPOT_Y;
  var dragMode = null; // null | 'pull' | 'aim' | 'place'
  var pullDist = 0;

  var oppAimPreview = null;
  var ballRoll = {};
  var prevBallPos = {};
  var prevGroups = null;
  var groupOverlayEl = null;
  var groupOverlayTimer = null;

  var poolAudioCtx = null;
  var lastClickMs = 0;
  var lastThudMs = 0;
  var lastPocketMs = 0;

  function applyVariantConfig(state) {
    var nextSnooker = !!(state && state.variant === 'snooker');
    if (configInitialized && nextSnooker === isSnooker) return false;
    configInitialized = true;
    isSnooker = nextSnooker;
    var cfg = isSnooker ? SNOOKER_CFG : POOL_CFG;
    W = cfg.W;
    H = cfg.H;
    BALL_R = cfg.BALL_R;
    HEAD_STRING_X = cfg.HEAD_STRING_X;
    FOOT_SPOT_X = cfg.FOOT_SPOT_X;
    FOOT_SPOT_Y = cfg.FOOT_SPOT_Y;
    BAULK_X = cfg.BAULK_X;
    D_RADIUS = cfg.D_RADIUS;
    CENTER_Y = cfg.CENTER_Y;
    RAIL = cfg.RAIL;
    CW = W + 2 * RAIL;
    CH = H + 2 * RAIL;
    MAX_BALL_ID = cfg.MAX_BALL_ID;
    POCKETS = cfg.POCKETS;
    lastLayoutKey = '';
    selectedNominate = null;
    lastNomSeq = -1;
    resetBallRoll();
    return true;
  }

  function isMuted() {
    try {
      return localStorage.getItem('gn_muted') === '1';
    } catch (_e) {
      return false;
    }
  }

  function ensureAudioCtxUnlocked() {
    if (window._poolAudioUnlock) return;
    window._poolAudioUnlock = function () {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!poolAudioCtx) poolAudioCtx = new AC();
        if (poolAudioCtx.state === 'suspended') {
          poolAudioCtx.resume().catch(function () {});
        }
      } catch (_e) {}
    };
    document.addEventListener('pointerdown', window._poolAudioUnlock, { passive: true });
    document.addEventListener('keydown', window._poolAudioUnlock, { passive: true });
  }

  function getReadyAudioCtx() {
    if (isMuted()) return null;
    if (!poolAudioCtx || poolAudioCtx.state !== 'running') return null;
    return poolAudioCtx;
  }

  function getNoiseBuffer(ac) {
    if (ac._poolNoiseBuf) return ac._poolNoiseBuf;
    var len = Math.floor(ac.sampleRate * 0.12);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    ac._poolNoiseBuf = buf;
    return buf;
  }

  function playCueStrike(power) {
    var ac = getReadyAudioCtx();
    if (!ac) return;
    try {
      var now = ac.currentTime;
      var p = clamp(Number(power) || 0.5, 0.05, 1);
      var vol = 0.18 + 0.42 * p;

      var osc = ac.createOscillator();
      var g = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190 + p * 80, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.055);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.07);

      var src = ac.createBufferSource();
      src.buffer = getNoiseBuffer(ac);
      var flt = ac.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(1600, now);
      flt.Q.setValueAtTime(2.2, now);
      var ng = ac.createGain();
      ng.gain.setValueAtTime(vol * 0.55, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
      src.connect(flt);
      flt.connect(ng);
      ng.connect(ac.destination);
      src.start(now);
      src.stop(now + 0.038);
    } catch (_e) {}
  }

  function playBallClick(intensity) {
    var ac = getReadyAudioCtx();
    if (!ac) return;
    var ms = performance.now();
    if (ms - lastClickMs < 32) return;
    lastClickMs = ms;
    try {
      var now = ac.currentTime;
      var amp = clamp(Number(intensity) || 0.4, 0.1, 1);
      var osc = ac.createOscillator();
      var g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2150 + amp * 550, now);
      osc.frequency.exponentialRampToValueAtTime(1150, now + 0.024);
      g.gain.setValueAtTime(0.12 + 0.28 * amp, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch (_e) {}
  }

  function playCushionThud(intensity) {
    var ac = getReadyAudioCtx();
    if (!ac) return;
    var ms = performance.now();
    if (ms - lastThudMs < 45) return;
    lastThudMs = ms;
    try {
      var now = ac.currentTime;
      var amp = clamp(Number(intensity) || 0.4, 0.1, 1);
      var osc = ac.createOscillator();
      var g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(125, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.075);
      g.gain.setValueAtTime(0.14 + 0.3 * amp, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (_e) {}
  }

  function playPocketDrop() {
    var ac = getReadyAudioCtx();
    if (!ac) return;
    var ms = performance.now();
    if (ms - lastPocketMs < 80) return;
    lastPocketMs = ms;
    try {
      var now = ac.currentTime;
      var osc = ac.createOscillator();
      var g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(92, now + 0.12);
      g.gain.setValueAtTime(0.26, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (_e) {}
  }

  function extractSoundEvents(parsed, fps) {
    var events = [];
    if (!parsed || parsed.length < 2) return events;
    var frameRate = fps || 30;
    for (var k = 0; k < parsed.length - 1; k++) {
      var fCurr = parsed[k];
      var fNext = parsed[k + 1];
      for (var id = 0; id <= MAX_BALL_ID; id++) {
        if (fCurr[id] && !fNext[id]) {
          events.push({ framePos: k + 0.35, type: 'pocket', intensity: 0.9 });
        }
      }
    }

    for (var f = 1; f < parsed.length - 1; f++) {
      var fPrev = parsed[f - 1];
      var fCur = parsed[f];
      var fNxt = parsed[f + 1];

      for (var bId = 0; bId <= MAX_BALL_ID; bId++) {
        var p0 = fPrev[bId];
        var p1 = fCur[bId];
        var p2 = fNxt[bId];
        if (!p0 || !p1 || !p2) continue;
        var vx0 = (p1.x - p0.x) * frameRate;
        var vy0 = (p1.y - p0.y) * frameRate;
        var vx1 = (p2.x - p1.x) * frameRate;
        var vy1 = (p2.y - p1.y) * frameRate;
        var hitX = (p1.x <= BALL_R + 4 && vx0 < -25 && vx1 > 10) || (p1.x >= W - BALL_R - 4 && vx0 > 25 && vx1 < -10);
        var hitY = (p1.y <= BALL_R + 4 && vy0 < -25 && vy1 > 10) || (p1.y >= H - BALL_R - 4 && vy0 > 25 && vy1 < -10);
        if (hitX || hitY) {
          var spd = Math.hypot(vx0, vy0);
          events.push({ framePos: f, type: 'cushion', intensity: clamp(spd / 900, 0.15, 1) });
        }
      }

      var bestClickIntensity = 0;
      for (var aId = 0; aId <= MAX_BALL_ID; aId++) {
        var a0 = fPrev[aId];
        var a1 = fCur[aId];
        var a2 = fNxt[aId];
        if (!a0 || !a1 || !a2) continue;
        var dvAx = (a2.x - 2 * a1.x + a0.x) * frameRate;
        var dvAy = (a2.y - 2 * a1.y + a0.y) * frameRate;
        var magA = Math.hypot(dvAx, dvAy);
        if (magA < 35) continue;
        for (var cId = aId + 1; cId <= MAX_BALL_ID; cId++) {
          var b0 = fPrev[cId];
          var b1 = fCur[cId];
          var b2 = fNxt[cId];
          if (!b0 || !b1 || !b2) continue;
          if (Math.hypot(b1.x - a1.x, b1.y - a1.y) > 2 * BALL_R + 60) continue;
          var dvBx = (b2.x - 2 * b1.x + b0.x) * frameRate;
          var dvBy = (b2.y - 2 * b1.y + b0.y) * frameRate;
          var magB = Math.hypot(dvBx, dvBy);
          if (magB < 35) continue;
          var dot = dvAx * dvBx + dvAy * dvBy;
          if (dot < -0.25 * magA * magB) {
            var inten = clamp((magA + magB) / 1400, 0.15, 1);
            if (inten > bestClickIntensity) bestClickIntensity = inten;
          }
        }
      }
      if (bestClickIntensity > 0) {
        events.push({ framePos: f, type: 'click', intensity: bestClickIntensity });
      }
    }

    events.sort(function (a, b) { return a.framePos - b.framePos; });
    return events;
  }

  function resetBallRoll() {
    ballRoll = {};
    for (var id = 0; id <= MAX_BALL_ID; id++) {
      ballRoll[id] = {
        p: { x: 0, y: 0, z: 1 },
        s: { x: 0, y: 1, z: 0 },
      };
    }
    prevBallPos = {};
  }

  function rotateVec(v, ax, ay, cosT, sinT) {
    var dot = ax * v.x + ay * v.y;
    var cx = ay * v.z;
    var cy = -ax * v.z;
    var cz = ax * v.y - ay * v.x;
    var nx = v.x * cosT + cx * sinT + ax * dot * (1 - cosT);
    var ny = v.y * cosT + cy * sinT + ay * dot * (1 - cosT);
    var nz = v.z * cosT + cz * sinT;
    var len = Math.hypot(nx, ny, nz) || 1;
    v.x = nx / len;
    v.y = ny / len;
    v.z = nz / len;
  }

  function advanceBallRoll(id, dx, dy) {
    var ds = Math.hypot(dx, dy);
    if (ds < 0.01) return;
    if (!ballRoll[id]) {
      ballRoll[id] = { p: { x: 0, y: 0, z: 1 }, s: { x: 0, y: 1, z: 0 } };
    }
    var theta = ds / BALL_R;
    var cosT = Math.cos(theta);
    var sinT = Math.sin(theta);
    var ax = -dy / ds;
    var ay = dx / ds;
    rotateVec(ballRoll[id].p, ax, ay, cosT, sinT);
    rotateVec(ballRoll[id].s, ax, ay, cosT, sinT);
  }

  function t(key) {
    return window._t ? window._t(key) : key;
  }

  function tf(key) {
    if (window._tf) return window._tf.apply(null, arguments);
    var args = Array.prototype.slice.call(arguments, 1);
    var s = t(key);
    var i = 0;
    return String(s).replace(/%s/g, function () { return args[i++] !== undefined ? args[i - 1] : '%s'; });
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

  function snookerBallType(id) {
    if (id === 0) return 'cue';
    if (id >= 1 && id <= 15) return 'red';
    for (var i = 0; i < SNOOKER_COLOURS.length; i++) {
      if (SNOOKER_COLOURS[i].id === id) return SNOOKER_COLOURS[i].name;
    }
    return 'red';
  }

  function ballTypeFor(id) {
    return isSnooker ? snookerBallType(id) : ballType(id);
  }

  function isKitchenPlace(state) {
    return !!(state && (state.isBreak || state.kitchenOnly || state.inDOnly));
  }

  function isInDLocal(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x > BAULK_X + 0.01) return false;
    var dx = x - BAULK_X;
    var dy = y - CENTER_Y;
    return dx * dx + dy * dy <= D_RADIUS * D_RADIUS + 0.01;
  }

  function clampPlacePos(x, y, kitchenOnly) {
    if (isSnooker) {
      var cx = clamp(x, BALL_R + 1, BAULK_X);
      var cy = clamp(y, BALL_R + 1, H - BALL_R - 1);
      var dx = cx - BAULK_X;
      var dy = cy - CENTER_Y;
      var d = Math.hypot(dx, dy);
      if (d > D_RADIUS - 0.5 && d > 1e-6) {
        cx = BAULK_X + (dx / d) * (D_RADIUS - 0.5);
        cy = CENTER_Y + (dy / d) * (D_RADIUS - 0.5);
      }
      return { x: clamp(cx, BALL_R + 1, BAULK_X), y: clamp(cy, BALL_R + 1, H - BALL_R - 1) };
    }
    var maxPlaceX = kitchenOnly ? HEAD_STRING_X : (W - BALL_R - 1);
    return {
      x: clamp(x, BALL_R + 1, maxPlaceX),
      y: clamp(y, BALL_R + 1, H - BALL_R - 1),
    };
  }

  function isValidCuePosLocal(balls, x, y, kitchenOnly) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (isSnooker) {
      if (!isInDLocal(x, y)) return false;
    } else if (kitchenOnly && x > HEAD_STRING_X) {
      return false;
    }
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

  function findInitialPlaceSpot(balls, kitchenOnly) {
    if (isSnooker) {
      var pref = [
        { x: 205, y: 340 },
        { x: 205, y: 260 },
        { x: 195, y: 300 },
        { x: 225, y: 345 },
        { x: 225, y: 255 },
        { x: 175, y: 300 },
      ];
      for (var p = 0; p < pref.length; p++) {
        if (isValidCuePosLocal(balls, pref[p].x, pref[p].y, true)) return pref[p];
      }
      for (var sx = BAULK_X; sx >= BAULK_X - D_RADIUS; sx -= 10) {
        for (var sy = CENTER_Y - D_RADIUS; sy <= CENTER_Y + D_RADIUS; sy += 10) {
          if (isValidCuePosLocal(balls, sx, sy, true)) return { x: sx, y: sy };
        }
      }
      return { x: 205, y: 340 };
    }
    if (isValidCuePosLocal(balls, HEAD_STRING_X, FOOT_SPOT_Y, kitchenOnly)) {
      return { x: HEAD_STRING_X, y: FOOT_SPOT_Y };
    }
    var maxX = kitchenOnly ? HEAD_STRING_X : (W - BALL_R - 6);
    for (var y = BALL_R + 6; y <= H - BALL_R - 6; y += 20) {
      for (var x = BALL_R + 6; x <= maxX; x += 20) {
        if (isValidCuePosLocal(balls, x, y, kitchenOnly)) return { x: x, y: y };
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

  function syncSpinUI() {
    if (spinDotEl) {
      spinDotEl.style.left = (50 + aimSpinX * 36) + '%';
      spinDotEl.style.top = (50 - aimSpinY * 36) + '%';
    }
    if (spinResetEl) {
      var isZero = Math.abs(aimSpinX) < 0.01 && Math.abs(aimSpinY) < 0.01;
      spinResetEl.dataset.zero = isZero ? '1' : '0';
    }
  }

  function updateSpinFromPointer(e) {
    if (!spinPadEl) return;
    var rect = spinPadEl.getBoundingClientRect();
    var r = (rect.width || 40) * 0.42;
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var nx = (e.clientX - cx) / r;
    var ny = -((e.clientY - cy) / r);
    var len = Math.hypot(nx, ny);
    if (len > 1) {
      nx /= len;
      ny /= len;
    } else if (len < 0.12) {
      nx = 0;
      ny = 0;
    }
    aimSpinX = Math.round(nx * 100) / 100;
    aimSpinY = Math.round(ny * 100) / 100;
    syncSpinUI();
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

    if (isSnooker) {
      if (state.isBreak) {
        return Math.atan2(CENTER_Y - cue.y, 924 - cue.x);
      }
      var targetType = state.ballOn;
      var bestS = null;
      var bestSD2 = Infinity;
      for (var si = 0; si < state.balls.length; si++) {
        var sb = state.balls[si];
        if (!sb || sb.potted || sb.id === 0) continue;
        if (targetType === 'red' && sb.type !== 'red') continue;
        if (targetType === 'colour') {
          if (selectedNominate) {
            if (sb.type !== selectedNominate) continue;
          } else if (sb.id < 16) {
            continue;
          }
        } else if (targetType !== 'red' && sb.type !== targetType) {
          continue;
        }
        var sd2 = (sb.x - cue.x) * (sb.x - cue.x) + (sb.y - cue.y) * (sb.y - cue.y);
        if (sd2 < bestSD2) {
          bestSD2 = sd2;
          bestS = sb;
        }
      }
      if (bestS) return Math.atan2(bestS.y - cue.y, bestS.x - cue.x);
      return 0;
    }

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
    var nomH = (nomBarEl && nomBarEl.style.display !== 'none' && nomBarEl.offsetHeight) ? (nomBarEl.offsetHeight + 4) : 0;
    var dispW, dispH;

    if (isSideways) {
      var ga = document.getElementById('gameActions');
      var gaH = (ga && ga.offsetParent) ? ga.offsetHeight + 6 : 0;
      var topY = containerEl ? Math.max(0, containerEl.getBoundingClientRect().top) : 44;
      var sideBarW = 108 + 8;
      var availW = Math.max(180, fit.w - sideBarW);
      var availH = Math.max(100, window.innerHeight - topY - hudH - nomH - gaH - 12);
      var scaleS = Math.min(availW / CW, availH / CH);
      dispW = Math.max(180, Math.floor(CW * scaleS));
      dispH = Math.max(100, Math.floor(CH * scaleS));
      if (barEl) barEl.style.height = dispH + 'px';
    } else if (isPortrait) {
      if (barEl) barEl.style.height = '';
      var barH = (barEl && barEl.offsetHeight) ? barEl.offsetHeight : 58;
      var reserveP = hudH + nomH + Math.max(58, barH) + 16;
      var availWP = Math.max(160, fit.w);
      var availHP = Math.max(240, fit.h - reserveP);
      var scaleP = Math.min(availWP / CH, availHP / CW);
      dispW = Math.max(160, Math.floor(CH * scaleP));
      dispH = Math.max(240, Math.floor(CW * scaleP));
    } else {
      if (barEl) barEl.style.height = '';
      var barHL = (barEl && barEl.offsetHeight) ? barEl.offsetHeight : 54;
      var reserveL = hudH + nomH + Math.max(54, barHL) + 18;
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

    lastLayoutKey = window.innerWidth + 'x' + window.innerHeight + ':' + (containerEl ? containerEl.clientWidth : 0) + ':' + (isSideways ? 's' : (isPortrait ? 'p' : 'l')) + ':' + (isSnooker ? 'sn' : '8b');

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
    var sx = [W * 0.125, W * 0.25, W * 0.375, W * 0.625, W * 0.75, W * 0.875];
    for (var si = 0; si < sx.length; si++) {
      ctx.beginPath();
      ctx.arc(RAIL + sx[si], RAIL * 0.45, 3, 0, Math.PI * 2);
      ctx.arc(RAIL + sx[si], CH - RAIL * 0.45, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    var sy = [H * 0.25, H * 0.5, H * 0.75];
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

    if (isSnooker) {
      // Baulk line and D semicircle
      ctx.strokeStyle = 'rgba(255,255,255,0.24)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(RAIL + BAULK_X, RAIL + 4);
      ctx.lineTo(RAIL + BAULK_X, RAIL + H - 4);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(RAIL + BAULK_X, RAIL + CENTER_Y, D_RADIUS, Math.PI / 2, Math.PI * 1.5, false);
      ctx.stroke();

      // Standard colour spots
      ctx.fillStyle = 'rgba(255,255,255,0.26)';
      for (var ci = 0; ci < SNOOKER_COLOURS.length; ci++) {
        var sp = SNOOKER_COLOURS[ci];
        ctx.beginPath();
        ctx.arc(RAIL + sp.x, RAIL + sp.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Head string line & foot spot
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
    }

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
    var color = isSnooker ? (SNOOKER_BALL_COLORS[b.id] || '#c81e1e') : (BALL_COLORS[b.id] || '#ccc');
    var isStripe = !isSnooker && b.id >= 9 && b.id <= 15;
    var roll = ballRoll[b.id] || { p: { x: 0, y: 0, z: 1 }, s: { x: 0, y: 1, z: 0 } };
    var p = roll.p;
    var s = roll.s;
    var vx = p.z >= 0 ? p.x : -p.x;
    var vy = p.z >= 0 ? p.y : -p.y;
    var vz = Math.abs(p.z);

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
      var sp = Math.hypot(s.x, s.y);
      var phi = sp > 1e-4 ? Math.atan2(s.y, s.x) - Math.PI / 2 : 0;
      var h = 0.56;
      var rc = Math.sqrt(1 - h * h);

      ctx.fillStyle = color;
      ctx.fillRect(cx - BALL_R, cy - BALL_R, BALL_R * 2, BALL_R * 2);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(phi);
      for (var sign = 1; sign >= -1; sign -= 2) {
        var pz = sign * s.z;
        var capCy = sign * h * sp * BALL_R;
        if (pz >= 0) {
          if (sp > h) {
            var yCut = (h / sp) * BALL_R;
            ctx.fillStyle = '#faf9f2';
            if (sign > 0) {
              ctx.fillRect(-BALL_R, yCut, BALL_R * 2, BALL_R - yCut);
            } else {
              ctx.fillRect(-BALL_R, -BALL_R, BALL_R * 2, BALL_R - yCut);
            }
          }
          ctx.fillStyle = '#faf9f2';
          ctx.beginPath();
          ctx.ellipse(0, capCy, rc * BALL_R, Math.max(0.4, rc * pz * BALL_R), 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (sp > h) {
          var yCutBack = (h / sp) * BALL_R;
          ctx.fillStyle = '#faf9f2';
          if (sign > 0) {
            ctx.fillRect(-BALL_R, yCutBack, BALL_R * 2, BALL_R - yCutBack);
          } else {
            ctx.fillRect(-BALL_R, -BALL_R, BALL_R * 2, BALL_R - yCutBack);
          }
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(0, capCy, rc * BALL_R, Math.max(0.4, rc * (-pz) * BALL_R), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(cx - BALL_R, cy - BALL_R, BALL_R * 2, BALL_R * 2);
    }

    // 3D sphere shading (fixed world light)
    var shade = ctx.createRadialGradient(cx - BALL_R * 0.35, cy - BALL_R * 0.35, 1, cx, cy, BALL_R);
    shade.addColorStop(0, 'rgba(255,255,255,0.36)');
    shade.addColorStop(0.55, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.36)');
    ctx.fillStyle = shade;
    ctx.fillRect(cx - BALL_R, cy - BALL_R, BALL_R * 2, BALL_R * 2);

    // Rolling marker clipped inside ball circle
    var ang = (vx !== 0 || vy !== 0) ? Math.atan2(vy, vx) : 0;
    if (b.id === 0) {
      ctx.save();
      ctx.translate(cx + vx * BALL_R * 0.82, cy + vy * BALL_R * 0.82);
      ctx.rotate(ang);
      ctx.scale(Math.max(0.3, vz), 1);
      ctx.fillStyle = 'rgba(200, 48, 48, 0.72)';
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (isSnooker) {
      // Subtle surface glint that rotates with ballRoll so snooker balls look rolling
      ctx.save();
      ctx.translate(cx + vx * BALL_R * 0.78, cy + vy * BALL_R * 0.78);
      ctx.rotate(ang);
      ctx.scale(Math.max(0.28, vz), 1);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, BALL_R * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      var fScale = Math.max(0.28, vz);
      ctx.save();
      ctx.translate(cx + vx * BALL_R * 0.86, cy + vy * BALL_R * 0.86);
      ctx.rotate(ang);
      ctx.scale(fScale, 1);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, BALL_R * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(-ang);
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

    ctx.restore();

    // Fixed specular dot
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

    // Highlight nominated colour ball
    if (
      isSnooker &&
      !replaying &&
      isMyTurn() &&
      currentState &&
      currentState.phase === 'shoot' &&
      currentState.ballOn === 'colour' &&
      selectedNominate &&
      b.type === selectedNominate
    ) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx, cy, BALL_R + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

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

  function drawAimGuide(cue, balls, angleOverride, powerOverride) {
    var angToUse = angleOverride !== undefined ? angleOverride : aimAngle;
    var pwrToUse = powerOverride !== undefined ? powerOverride : aimPower;
    var hit = raycastCue(cue, angToUse, balls);
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
    var backAngle = angToUse + Math.PI;
    var bx = Math.cos(backAngle);
    var by = Math.sin(backAngle);
    var pad = 8;
    var maxX = bx > 1e-9 ? (CW - pad - cx) / bx : (bx < -1e-9 ? (pad - cx) / bx : Infinity);
    var maxY = by > 1e-9 ? (CH - pad - cy) / by : (by < -1e-9 ? (pad - cy) / by : Infinity);
    var maxStickReach = Math.max(14, Math.min(maxX, maxY));
    var desiredPull = 16 + pwrToUse * 65;
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

  function drawPlaceArea(kitchenOnly) {
    ctx.save();
    if (isSnooker) {
      // Shade outside the D
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.rect(RAIL, RAIL, W, H);
      ctx.moveTo(RAIL + BAULK_X, RAIL + CENTER_Y + D_RADIUS);
      ctx.arc(RAIL + BAULK_X, RAIL + CENTER_Y, D_RADIUS, Math.PI / 2, Math.PI * 1.5, false);
      ctx.closePath();
      ctx.fill('evenodd');

      // Highlight inside the D
      ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
      ctx.beginPath();
      ctx.arc(RAIL + BAULK_X, RAIL + CENTER_Y, D_RADIUS, Math.PI / 2, Math.PI * 1.5, false);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(74, 222, 128, 0.88)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.arc(RAIL + BAULK_X, RAIL + CENTER_Y, D_RADIUS, Math.PI / 2, Math.PI * 1.5, false);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (kitchenOnly) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.14)';
      ctx.fillRect(RAIL, RAIL, HEAD_STRING_X, H);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
      ctx.fillRect(RAIL + HEAD_STRING_X, RAIL, W - HEAD_STRING_X, H);

      ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(RAIL + 2, RAIL + 2, HEAD_STRING_X - 2, H - 4);
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
      ctx.fillRect(RAIL, RAIL, W, H);

      ctx.strokeStyle = 'rgba(74, 222, 128, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(RAIL + 2, RAIL + 2, W - 4, H - 4);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawBallInHandGhost(kitchenOnly) {
    var valid = isValidCuePosLocal(displayBalls, placeX, placeY, kitchenOnly);
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

    var kitchenOnly = isKitchenPlace(currentState);
    if (currentState && currentState.phase === 'ball_in_hand' && !replaying) {
      drawPlaceArea(kitchenOnly);
    }

    var balls = displayBalls || [];
    var cue = null;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b || b.potted) continue;
      if (b.id === 0) cue = b;
      drawBall(b, 1);
    }

    if (oppAimPreview && cue) {
      var pElapsed = performance.now() - oppAimPreview.startTime;
      var pRatio = clamp(pElapsed / oppAimPreview.duration, 0, 1);
      var animPower = pRatio < 0.82
        ? oppAimPreview.power * (0.25 + 0.75 * (pRatio / 0.82))
        : oppAimPreview.power * Math.max(0, 1 - (pRatio - 0.82) / 0.18);
      drawAimGuide(cue, balls, oppAimPreview.angle, animPower);
    } else if (currentState && isMyTurn() && !replaying) {
      if (currentState.phase === 'shoot' && cue) {
        drawAimGuide(cue, balls);
      } else if (currentState.phase === 'ball_in_hand') {
        drawBallInHandGhost(kitchenOnly);
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
    var active = currentState.winner === null && currentState.phase !== 'over' && currentState.currentPlayer === seatIdx;
    el.className = 'pool-seat' + (seatIdx === 1 ? ' pool-seat--right' : '') + (active ? ' pool-seat--active' : '');

    if (isSnooker) {
      var score = (currentState.scores && currentState.scores[seatIdx]) || 0;
      var brk = active && currentState.currentBreak > 0 ? currentState.currentBreak : 0;
      el.innerHTML =
        '<div class="pool-seat-top">' +
          '<span class="pool-seat-name"></span>' +
          '<span class="snooker-score">' + score + '</span>' +
        '</div>' +
        '<div class="snooker-seat-meta">' +
          (brk > 0 ? '<span class="snooker-break-pill"></span>' : '') +
        '</div>';
      el.querySelector('.pool-seat-name').textContent = name;
      if (brk > 0) {
        el.querySelector('.snooker-break-pill').textContent = t('snooker_break') + ' ' + brk;
      }
      return;
    }

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

    var mainText;
    if (currentState.phase === 'over' || currentState.winner !== null) {
      mainText = currentState.winner === myPlayerIndex ? t('rv_you_win') : (currentState.winner === -1 ? t('rv_draw') : t('rv_you_lose'));
    } else if (currentState.phase === 'ball_in_hand') {
      mainText = mine ? t('pool_place_cue') : t('pool_opp_place_cue');
    } else if (currentState.isBreak && mine) {
      mainText = t('pool_break_shot');
    } else {
      mainText = mine ? t('pool_your_turn') : t('pool_opp_turn');
    }

    if (!isSnooker) {
      statusEl.textContent = mainText;
      return;
    }

    var ballOn = currentState.ballOn || 'red';
    var dotColor = ballOn === 'colour'
      ? (selectedNominate ? SNOOKER_COLOUR_HEX[selectedNominate] : 'linear-gradient(135deg,#eab308,#1d4ed8,#ec4899)')
      : (SNOOKER_COLOUR_HEX[ballOn] || '#c81e1e');
    var onLabel = ballOn === 'colour' && selectedNominate
      ? t('snooker_ball_' + selectedNominate)
      : t('snooker_ball_' + ballOn);
    var remPts = typeof currentState.pointsRemaining === 'number' ? currentState.pointsRemaining : 0;

    statusEl.innerHTML =
      '<span class="snooker-status-main"></span>' +
      '<span class="snooker-status-sub">' +
        '<span class="snooker-on-dot" style="background:' + dotColor + '"></span>' +
        '<span class="snooker-on-text"></span>' +
      '</span>';
    statusEl.querySelector('.snooker-status-main').textContent = mainText;
    statusEl.querySelector('.snooker-on-text').textContent =
      t('snooker_on') + ': ' + onLabel + ' · ' + t('snooker_left') + ': ' + remPts;
  }

  function closeGroupPopup() {
    if (groupOverlayTimer) {
      clearTimeout(groupOverlayTimer);
      groupOverlayTimer = null;
    }
    if (groupOverlayEl) {
      if (groupOverlayEl.parentNode) groupOverlayEl.parentNode.removeChild(groupOverlayEl);
      groupOverlayEl = null;
    }
  }

  function buildGroupBallsHtml(group) {
    var start = group === 'solid' ? 1 : 9;
    var html = '';
    for (var id = start; id < start + 7; id++) {
      var col = BALL_COLORS[id];
      var isStripe = id >= 9;
      html += '<span class="pool-group-ball' + (isStripe ? ' pool-group-ball--stripe' : '') + '" style="background:' + col + ';color:' + col + '"></span>';
    }
    return html;
  }

  function showGroupPopup(groups) {
    closeGroupPopup();
    if (!document.body || !groups) return;
    var myGroup = groups[myPlayerIndex];
    var oppGroup = groups[1 - myPlayerIndex];
    if (!myGroup || !oppGroup) return;

    var el = document.createElement('div');
    el.className = 'pool-group-overlay';
    el.setAttribute('role', 'status');

    var myLabel = myGroup === 'solid' ? t('pool_solids') : t('pool_stripes');
    var oppLabel = oppGroup === 'solid' ? t('pool_solids') : t('pool_stripes');

    el.innerHTML =
      '<div class="pool-group-title"></div>' +
      '<div class="pool-group-row">' +
        '<span class="pool-group-who" data-role="you"></span>' +
        '<span class="pool-group-balls">' + buildGroupBallsHtml(myGroup) + '</span>' +
      '</div>' +
      '<div class="pool-group-row">' +
        '<span class="pool-group-who" data-role="opp"></span>' +
        '<span class="pool-group-balls">' + buildGroupBallsHtml(oppGroup) + '</span>' +
      '</div>' +
      '<div class="pool-group-tap"></div>';

    el.querySelector('.pool-group-title').textContent = t('pool_groups_assigned');
    el.querySelector('[data-role="you"]').textContent = t('pool_group_you') + ': ' + myLabel;
    el.querySelector('[data-role="opp"]').textContent = t('pool_group_opp') + ': ' + oppLabel;
    el.querySelector('.pool-group-tap').textContent = t('pool_tap_close');
    el.addEventListener('click', closeGroupPopup);

    document.body.appendChild(el);
    groupOverlayEl = el;
    groupOverlayTimer = setTimeout(closeGroupPopup, 2500);
  }

  function maybeShowGroupPopup(state) {
    if (isSnooker) return;
    var g = (state && Array.isArray(state.groups)) ? [state.groups[0], state.groups[1]] : [null, null];
    if (prevGroups && prevGroups[0] === null && prevGroups[1] === null && g[0] !== null && g[1] !== null) {
      showGroupPopup(g);
    }
    prevGroups = g;
  }

  function syncNominateUI() {
    if (!nomBarEl) return;
    var mine = isMyTurn() && !replaying;
    var needNom = isSnooker && mine && currentState && currentState.phase === 'shoot' && currentState.ballOn === 'colour';
    var wasVisible = nomBarEl.style.display !== 'none';
    nomBarEl.style.display = needNom ? 'flex' : 'none';

    if (needNom) {
      var activeMap = {};
      var balls = currentState.balls || [];
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        if (b && !b.potted && b.id >= 16) activeMap[b.type] = true;
      }
      if (selectedNominate && !activeMap[selectedNominate]) {
        selectedNominate = null;
      }
      for (var c = 0; c < SNOOKER_COLOURS.length; c++) {
        var col = SNOOKER_COLOURS[c];
        var btn = nomButtons[col.name];
        if (!btn) continue;
        btn.disabled = !activeMap[col.name];
        btn.classList.toggle('snooker-nom-btn--active', selectedNominate === col.name);
      }
    }

    if (shootBtnEl) {
      shootBtnEl.disabled = !!(needNom && !selectedNominate);
    }

    var isVisibleNow = nomBarEl.style.display !== 'none';
    if (wasVisible !== isVisibleNow) {
      resizeCanvas();
    }
  }

  function updateBar() {
    if (!currentState) return;
    var mine = isMyTurn() && !replaying;
    var kitchenOnly = isKitchenPlace(currentState);
    if (mine && currentState.phase === 'shoot') {
      shootBarEl.style.display = 'flex';
      placeBarEl.style.display = 'none';
      waitBarEl.style.display = 'none';
      syncPowerUI();
      syncSpinUI();
    } else if (mine && currentState.phase === 'ball_in_hand') {
      shootBarEl.style.display = 'none';
      placeBarEl.style.display = 'flex';
      waitBarEl.style.display = 'none';
      if (placeHintEl) {
        placeHintEl.textContent = isSnooker
          ? t('snooker_place_d_hint')
          : (kitchenOnly ? t('pool_place_kitchen_hint') : t('pool_place_hint'));
      }
      if (confirmPlaceBtnEl) {
        confirmPlaceBtnEl.disabled = !isValidCuePosLocal(displayBalls, placeX, placeY, kitchenOnly);
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
    syncNominateUI();
  }

  function announceShotOutcome(shot) {
    if (!shot || typeof window.showToast !== 'function') return;
    if (isSnooker) {
      if (shot.respotBlackTie) {
        window.showToast(t('snooker_respot_black'));
        return;
      }
      if (shot.foul) {
        var reasonKey = 'snooker_foul_' + shot.foul;
        var reason = t(reasonKey);
        window.showToast(tf('snooker_foul_toast', reason, shot.foulPoints || 4));
      }
      return;
    }
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
    oppAimPreview = null;
    prevBallPos = {};
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    displayBalls = (currentState && Array.isArray(currentState.balls)) ? currentState.balls : [];
    if (currentState && currentState.phase === 'ball_in_hand' && isMyTurn()) {
      var spot = findInitialPlaceSpot(displayBalls, isKitchenPlace(currentState));
      placeX = spot.x;
      placeY = spot.y;
    }
    updateHUD();
    updateBar();
    draw();
    maybeShowGroupPopup(currentState);
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
    var soundEvents = extractSoundEvents(parsed, fps);
    var soundCursor = 0;

    prevBallPos = {};
    var fInit = parsed[0];
    var initialBalls = [];
    for (var id0 = 0; id0 <= MAX_BALL_ID; id0++) {
      if (fInit[id0]) {
        prevBallPos[id0] = { x: fInit[id0].x, y: fInit[id0].y };
        initialBalls.push({
          id: id0,
          x: fInit[id0].x,
          y: fInit[id0].y,
          potted: false,
          type: ballTypeFor(id0),
        });
      }
    }

    var ballStartTime = performance.now();
    replaying = true;

    function fireSound(ev) {
      if (ev.type === 'click') playBallClick(ev.intensity);
      else if (ev.type === 'cushion') playCushionThud(ev.intensity);
      else if (ev.type === 'pocket') playPocketDrop();
    }

    function ballStep(now) {
      if (!currentState) {
        replaying = false;
        oppAimPreview = null;
        rafId = null;
        return;
      }
      try {
        var elapsed = Math.max(0, now - ballStartTime);
        if (elapsed >= totalDur) {
          while (soundCursor < soundEvents.length) {
            fireSound(soundEvents[soundCursor++]);
          }
          finishReplay(shot);
          return;
        }

        var pos = elapsed / frameDur;
        while (soundCursor < soundEvents.length && soundEvents[soundCursor].framePos <= pos) {
          fireSound(soundEvents[soundCursor++]);
        }

        var k = clamp(Math.floor(pos), 0, parsed.length - 2);
        var alpha = clamp(pos - k, 0, 1);
        var f0 = parsed[k];
        var f1 = parsed[k + 1];
        if (!f0 || !f1) {
          finishReplay(shot);
          return;
        }
        var interp = [];
        for (var id = 0; id <= MAX_BALL_ID; id++) {
          var a = f0[id];
          var b = f1[id];
          if (a && b) {
            var nx = a.x + (b.x - a.x) * alpha;
            var ny = a.y + (b.y - a.y) * alpha;
            var prevP = prevBallPos[id];
            if (prevP) {
              advanceBallRoll(id, nx - prevP.x, ny - prevP.y);
            }
            prevBallPos[id] = { x: nx, y: ny };
            interp.push({
              id: id,
              x: nx,
              y: ny,
              potted: false,
              type: ballTypeFor(id),
            });
          }
        }
        displayBalls = interp;
        draw();
        rafId = requestAnimationFrame(ballStep);
      } catch (_err) {
        finishReplay(shot);
      }
    }

    var isOpponent = typeof shot.shooter === 'number' && shot.shooter !== myPlayerIndex;
    if (isOpponent) {
      displayBalls = initialBalls;
      oppAimPreview = {
        angle: Number.isFinite(shot.angle) ? shot.angle : 0,
        power: Number.isFinite(shot.power) ? shot.power : 0.5,
        startTime: performance.now(),
        duration: 1000,
      };
      updateBar();
      draw();

      function aimStep(now) {
        if (!currentState || !oppAimPreview) {
          oppAimPreview = null;
          replaying = false;
          rafId = null;
          return;
        }
        var aimElapsed = now - oppAimPreview.startTime;
        if (aimElapsed >= oppAimPreview.duration) {
          oppAimPreview = null;
          playCueStrike(shot.power);
          ballStartTime = now;
          rafId = requestAnimationFrame(ballStep);
          return;
        }
        draw();
        rafId = requestAnimationFrame(aimStep);
      }

      rafId = requestAnimationFrame(aimStep);
    } else {
      oppAimPreview = null;
      updateBar();
      playCueStrike(shot.power);
      ballStartTime = performance.now();
      rafId = requestAnimationFrame(ballStep);
    }
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

  function trySendShot() {
    if (!currentState || !isMyTurn() || replaying || currentState.phase !== 'shoot') return;
    if (isSnooker && currentState.ballOn === 'colour' && !selectedNominate) {
      if (typeof window.showToast === 'function') {
        window.showToast(t('snooker_pick_colour_first'));
      }
      return;
    }
    var mv = {
      type: 'shot',
      angle: aimAngle,
      power: clamp(aimPower, 0.05, 1.0),
      spinX: round2(aimSpinX),
      spinY: round2(aimSpinY),
    };
    if (isSnooker && currentState.ballOn === 'colour') {
      mv.nominate = selectedNominate;
    }
    sendMove(mv);
  }

  function onPointerDown(e) {
    if (!currentState || !isMyTurn() || replaying) return;
    var pt = clientToTable(e);

    if (currentState.phase === 'ball_in_hand') {
      var kitchenOnly = isKitchenPlace(currentState);
      var clamped = clampPlacePos(pt.x, pt.y, kitchenOnly);
      dragMode = 'place';
      placeX = clamped.x;
      placeY = clamped.y;
      if (confirmPlaceBtnEl) {
        confirmPlaceBtnEl.disabled = !isValidCuePosLocal(displayBalls, placeX, placeY, kitchenOnly);
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
      var kitchenOnly = isKitchenPlace(currentState);
      var clamped = clampPlacePos(pt.x, pt.y, kitchenOnly);
      placeX = clamped.x;
      placeY = clamped.y;
      if (confirmPlaceBtnEl) {
        confirmPlaceBtnEl.disabled = !isValidCuePosLocal(displayBalls, placeX, placeY, kitchenOnly);
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

  function round2(v) {
    return Math.round(v * 100) / 100;
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
        trySendShot();
      }
    } else if (mode === 'place' && currentState.phase === 'ball_in_hand') {
      if (isValidCuePosLocal(displayBalls, placeX, placeY, isKitchenPlace(currentState))) {
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
    oppAimPreview = null;
    closeGroupPopup();
    prevGroups = null;
    resetBallRoll();
    ensureAudioCtxUnlocked();

    lastPlayedSeq = null;
    lastAimInitSeq = -1;
    lastTurnPhaseKey = '';
    lastLayoutKey = '';
    currentState = null;
    displayBalls = [];
    dragMode = null;
    pullDist = 0;
    aimPower = 0.58;
    aimSpinX = 0;
    aimSpinY = 0;
    spinDragging = false;
    selectedNominate = null;
    lastNomSeq = -1;
    nomButtons = {};

    if (window.injectStylesOnce) {
      window.injectStylesOnce('pool-styles', STYLES);
    }

    var nomBtnsHtml = '';
    for (var c = 0; c < SNOOKER_COLOURS.length; c++) {
      var col = SNOOKER_COLOURS[c];
      nomBtnsHtml +=
        '<button type="button" class="snooker-nom-btn" data-nom="' + col.name + '">' +
          '<span class="snooker-nom-dot" style="background:' + col.color + '"></span>' +
          '<span class="snooker-nom-text"></span>' +
        '</button>';
    }

    container.innerHTML =
      '<div class="pool-wrap" id="poolWrap">' +
        '<div class="pool-hud" id="poolHud">' +
          '<div id="poolSeat0" class="pool-seat"></div>' +
          '<div id="poolStatus" class="pool-status-pill"></div>' +
          '<div id="poolSeat1" class="pool-seat pool-seat--right"></div>' +
        '</div>' +
        '<div class="snooker-nom-bar" id="snookerNomBar" style="display:none">' +
          '<span class="snooker-nom-label" id="snookerNomLabel"></span>' +
          nomBtnsHtml +
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
              '<div class="pool-spin-wrap" id="poolSpinWrap">' +
                '<div class="pool-spin-ball" id="poolSpinPad" role="slider" tabindex="0" aria-label="Spin">' +
                  '<span class="pool-spin-dot" id="poolSpinDot"></span>' +
                '</div>' +
                '<div class="pool-spin-meta">' +
                  '<span class="pool-spin-label" id="poolSpinLabel"></span>' +
                  '<button type="button" class="pool-spin-reset" id="poolSpinReset"></button>' +
                '</div>' +
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
    nomBarEl = document.getElementById('snookerNomBar');
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
    spinPadEl = document.getElementById('poolSpinPad');
    spinDotEl = document.getElementById('poolSpinDot');
    spinResetEl = document.getElementById('poolSpinReset');
    placeHintEl = document.getElementById('poolPlaceHint');
    shootBtnEl = document.getElementById('poolShootBtn');
    confirmPlaceBtnEl = document.getElementById('poolConfirmPlaceBtn');

    document.getElementById('snookerNomLabel').textContent = t('snooker_pick_colour');
    var nomBtnEls = nomBarEl.querySelectorAll('.snooker-nom-btn');
    for (var nb = 0; nb < nomBtnEls.length; nb++) {
      (function (btnEl) {
        var cName = btnEl.getAttribute('data-nom');
        var meta = SNOOKER_COLOURS.filter(function (x) { return x.name === cName; })[0];
        nomButtons[cName] = btnEl;
        btnEl.querySelector('.snooker-nom-text').textContent =
          t('snooker_ball_' + cName) + ' ' + (meta ? meta.value : '');
        btnEl.addEventListener('click', function () {
          if (!currentState || !isMyTurn() || replaying || currentState.phase !== 'shoot' || currentState.ballOn !== 'colour') return;
          selectedNominate = cName;
          aimAngle = pickDefaultAimAngle(currentState);
          syncNominateUI();
          updateHUD();
          draw();
        });
      })(nomBtnEls[nb]);
    }

    document.getElementById('poolPowerLabel').textContent = t('pool_power');
    document.getElementById('poolSpinLabel').textContent = t('pool_spin');
    spinResetEl.textContent = t('pool_spin_reset');
    document.getElementById('poolAimHint').textContent = t('pool_aim_hint');
    placeHintEl.textContent = t('pool_place_hint');
    shootBtnEl.textContent = t('pool_shoot');
    confirmPlaceBtnEl.textContent = t('pool_confirm_place');
    syncSpinUI();

    powerInputEl.addEventListener('input', function () {
      aimPower = clamp(Number(powerInputEl.value) / 100, 0.05, 1.0);
      syncPowerUI();
      draw();
    });

    spinPadEl.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      spinDragging = true;
      updateSpinFromPointer(e);
      try { spinPadEl.setPointerCapture(e.pointerId); } catch (_) {}
    });
    spinPadEl.addEventListener('pointermove', function (e) {
      if (!spinDragging) return;
      updateSpinFromPointer(e);
    });
    function endSpinDrag(e) {
      if (!spinDragging) return;
      spinDragging = false;
      try { spinPadEl.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    spinPadEl.addEventListener('pointerup', endSpinDrag);
    spinPadEl.addEventListener('pointercancel', endSpinDrag);

    spinResetEl.addEventListener('click', function () {
      aimSpinX = 0;
      aimSpinY = 0;
      syncSpinUI();
    });

    shootBtnEl.addEventListener('click', function () {
      trySendShot();
    });

    confirmPlaceBtnEl.addEventListener('click', function () {
      if (!currentState || !isMyTurn() || replaying || currentState.phase !== 'ball_in_hand') return;
      if (isValidCuePosLocal(displayBalls, placeX, placeY, isKitchenPlace(currentState))) {
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

    applyVariantConfig(state);
    myPlayerIndex = typeof playerIndex === 'number' ? playerIndex : 0;
    currentState = state;

    var seq = (state.lastShot && typeof state.lastShot.seq === 'number') ? state.lastShot.seq : (state.shotSeq || 0);
    var turnPhaseKey = state.currentPlayer + ':' + state.phase + ':' + seq + ':' + (state.ballOn || '');
    if (seq !== lastNomSeq || !isSnooker || state.ballOn !== 'colour' || !isMyTurn()) {
      selectedNominate = null;
      lastNomSeq = seq;
    }

    var curSideways = window.innerHeight < 540 && window.innerWidth > window.innerHeight;
    var curPortrait = !curSideways && window.innerHeight > window.innerWidth;
    var layoutKey = window.innerWidth + 'x' + window.innerHeight + ':' + (containerEl ? containerEl.clientWidth : 0) + ':' + (curSideways ? 's' : (curPortrait ? 'p' : 'l')) + ':' + (isSnooker ? 'sn' : '8b');

    if (lastPlayedSeq === null) {
      lastPlayedSeq = seq;
      lastAimInitSeq = seq;
      lastTurnPhaseKey = turnPhaseKey;
      prevGroups = Array.isArray(state.groups) ? [state.groups[0], state.groups[1]] : [null, null];
      displayBalls = state.balls;
      if (state.phase === 'ball_in_hand' && isMyTurn()) {
        var initSpot = findInitialPlaceSpot(displayBalls, isKitchenPlace(state));
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
      oppAimPreview = null;
      aimSpinX = 0;
      aimSpinY = 0;
      syncSpinUI();

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
      oppAimPreview = null;
      closeGroupPopup();
      prevGroups = [null, null];
      resetBallRoll();
      aimSpinX = 0;
      aimSpinY = 0;
      syncSpinUI();
    }

    if (!replaying) {
      displayBalls = state.balls;
      if (turnPhaseKey !== lastTurnPhaseKey) {
        lastTurnPhaseKey = turnPhaseKey;
        if (state.phase === 'ball_in_hand' && isMyTurn()) {
          var spot2 = findInitialPlaceSpot(displayBalls, isKitchenPlace(state));
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
      maybeShowGroupPopup(state);
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
