(function () {
  var POOL_CFG = {
    W: 1000,
    H: 500,
    BALL_R: 14,
    HEAD_STRING_X: 177,
    FOOT_SPOT_X: 750,
    FOOT_SPOT_Y: 250,
    BAULK_X: 177,
    D_RADIUS: 0,
    CENTER_Y: 250,
    RAIL: 42,
    MAX_BALL_ID: 15,
    POCKETS: [
      { id: 0, x: 0, y: 0, r: 23 },
      { id: 1, x: 500, y: -3, r: 20 },
      { id: 2, x: 1000, y: 0, r: 23 },
      { id: 3, x: 0, y: 500, r: 23 },
      { id: 4, x: 500, y: 503, r: 20 },
      { id: 5, x: 1000, y: 500, r: 23 },
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
    '.pool-canvas-wrap { position:relative; display:flex; align-items:center; justify-content:center; width:100%; }',
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
    '.pool-shot-banner { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); z-index:35; display:inline-flex; flex-direction:column; align-items:center; gap:3px; max-width:min(86%, 340px); padding:9px 16px; border-radius:14px; background:rgba(17,24,21,0.92); color:#fffdf8; border:1.5px solid rgba(200,164,92,0.75); box-shadow:0 10px 28px rgba(0,0,0,0.42); backdrop-filter:blur(6px); text-align:center; cursor:pointer; user-select:none; }',
    '.pool-shot-banner--foul { border-color:rgba(248,113,113,0.82); background:rgba(38,16,18,0.93); }',
    '.pool-shot-banner--top { top:18%; }',
    '.pool-shot-banner-row { display:inline-flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:6px; }',
    '.pool-shot-banner-main { font-size:14px; font-weight:800; line-height:1.25; letter-spacing:0.01em; }',
    '.pool-shot-banner-sub { font-size:11px; font-weight:600; color:rgba(255,253,248,0.76); line-height:1.2; }',
    '.pool-shot-banner-chips { display:inline-flex; align-items:center; gap:4px; }',
    '.pool-shot-banner-chip { display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; border:1.5px solid rgba(255,255,255,0.45); font-size:10px; font-weight:800; color:#111827; box-sizing:border-box; flex-shrink:0; }',
    '.pool-shot-banner-chip--stripe { background:linear-gradient(180deg, #fff 20%, currentColor 21%, currentColor 79%, #fff 80%) !important; }',
    '.pool-shot-banner-chip-num { display:inline-flex; align-items:center; justify-content:center; width:12px; height:12px; border-radius:50%; background:rgba(255,255,255,0.92); color:#111827; font-size:9px; font-weight:800; line-height:1; }',
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
    '.pool-fs-only { display:none; }',
    'body.gn-fs:has(.pool-wrap) { overflow:hidden; height:100dvh; max-height:100dvh; padding:0 !important; }',
    'body.gn-fs:has(.pool-wrap) #gameStage { width:100%; height:100%; max-width:none !important; padding:0 !important; margin:0 !important; }',
    'body.gn-fs:has(.pool-wrap) .board-wrap { width:100%; height:100%; padding:0 !important; margin:0 !important; }',
    'body.gn-fs:has(.pool-wrap) #boardArea { width:100%; height:100%; padding:0 !important; margin:0 !important; max-width:none !important; }',
    'body.gn-fs .pool-wrap { width:100vw; height:100dvh; max-width:none; padding:4px 6px 6px; box-sizing:border-box; overflow:hidden; background:radial-gradient(ellipse at 50% 54%, #1f2b25 0%, #111815 100%); color:var(--ge-paper, #fffdf8); display:grid; grid-template-columns:var(--pool-fs-left, 70px) minmax(0, 1fr) var(--pool-fs-right, 102px); grid-template-rows:var(--pool-fs-top, 56px) minmax(0, 1fr); column-gap:6px; row-gap:4px; align-items:stretch; }',
    'body.gn-fs .pool-wrap #poolHud, body.gn-fs .pool-wrap #poolBar { display:none !important; }',
    'body.gn-fs .pool-wrap .pool-main { display:contents; }',
    'body.gn-fs .pool-wrap .pool-fs-top { grid-column:1 / -1; grid-row:1; display:grid; grid-template-columns:minmax(0, 1fr) auto minmax(0, 1fr); align-items:center; gap:8px; padding:2px 6px 2px 68px; min-width:0; box-sizing:border-box; }',
    'body.gn-fs .pool-wrap .pool-fs-side { display:flex; align-items:center; gap:8px; min-width:0; }',
    'body.gn-fs .pool-wrap .pool-fs-side--opp { flex-direction:row-reverse; text-align:right; }',
    'body.gn-fs .pool-wrap .pool-fs-avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:rgba(255,253,248,0.12); border:2px solid rgba(255,253,248,0.18); font-size:18px; font-weight:800; color:var(--ge-paper, #fffdf8); box-sizing:border-box; transition:box-shadow 220ms cubic-bezier(0.23,1,0.32,1), border-color 220ms cubic-bezier(0.23,1,0.32,1); }',
    'body.gn-fs .pool-wrap .pool-fs-avatar--active { border-color:var(--ge-gold, #c8a45c); box-shadow:0 0 0 2.5px var(--ge-gold, #c8a45c), 0 0 12px rgba(200,164,92,0.5); }',
    'body.gn-fs .pool-wrap .pool-fs-info { display:flex; flex-direction:column; gap:3px; min-width:0; flex:1 1 auto; }',
    'body.gn-fs .pool-wrap .pool-fs-side--opp .pool-fs-info { align-items:flex-end; }',
    'body.gn-fs .pool-wrap .pool-fs-name { font-size:13px; font-weight:700; color:var(--ge-paper, #fffdf8); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; line-height:1.15; }',
    'body.gn-fs .pool-wrap .pool-fs-rack { display:flex; align-items:center; gap:4px; min-height:18px; }',
    'body.gn-fs .pool-wrap .pool-fs-side--opp .pool-fs-rack { flex-direction:row-reverse; }',
    'body.gn-fs .pool-wrap .pool-fs-bdot { position:relative; width:15px; height:15px; border-radius:50%; background:rgba(148,163,184,0.28); border:1.5px solid rgba(255,253,248,0.24); box-sizing:border-box; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; }',
    'body.gn-fs .pool-wrap .pool-fs-bdot-fill { position:absolute; inset:0; border-radius:50%; opacity:1; transition:opacity 200ms cubic-bezier(0.23,1,0.32,1); }',
    'body.gn-fs .pool-wrap .pool-fs-bdot-fill--stripe { background:linear-gradient(180deg, #fff 24%, currentColor 25%, currentColor 75%, #fff 76%) !important; }',
    'body.gn-fs .pool-wrap .pool-fs-bdot.is-potted .pool-fs-bdot-fill { opacity:0; }',
    'body.gn-fs .pool-wrap .pool-fs-bdot.is-unknown { background:transparent; border:1.5px dashed rgba(255,253,248,0.45); }',
    'body.gn-fs .pool-wrap .pool-fs-bdot.is-unknown .pool-fs-bdot-fill { opacity:0; }',
    'body.gn-fs .pool-wrap .pool-fs-bdot-q { position:relative; z-index:1; font-size:10px; font-weight:800; line-height:1; color:rgba(255,253,248,0.78); display:none; }',
    'body.gn-fs .pool-wrap .pool-fs-bdot.is-unknown .pool-fs-bdot-q { display:block; }',
    'body.gn-fs .pool-wrap .pool-fs-rack.no-anim .pool-fs-bdot-fill { transition:none !important; }',
    'body.gn-fs .pool-wrap .pool-fs-eight-dot { width:16px; height:16px; border-radius:50%; background:#151518; border:1.5px solid rgba(255,253,248,0.75); box-shadow:0 0 0 1px rgba(0,0,0,0.4); color:#fff; font-size:9px; font-weight:800; display:none; align-items:center; justify-content:center; flex-shrink:0; }',
    'body.gn-fs .pool-wrap .pool-fs-eight-dot.is-visible { display:inline-flex; }',
    'body.gn-fs .pool-wrap .pool-fs-eight-dot.is-potted { opacity:0.25; }',
    'body.gn-fs .pool-wrap .pool-fs-snooker { display:none; align-items:center; gap:6px; min-height:18px; }',
    'body.gn-fs .pool-wrap .pool-fs-side--opp .pool-fs-snooker { flex-direction:row-reverse; }',
    'body.gn-fs .pool-wrap .pool-fs-score { font-size:16px; font-weight:800; font-variant-numeric:tabular-nums; color:var(--ge-paper, #fffdf8); line-height:1; }',
    'body.gn-fs .pool-wrap .pool-fs-break { display:none; padding:1px 7px; border-radius:999px; background:rgba(200,164,92,0.24); border:1px solid rgba(200,164,92,0.55); color:#fde68a; font-size:11px; font-weight:700; white-space:nowrap; }',
    'body.gn-fs .pool-wrap .pool-fs-break.is-visible { display:inline-flex; align-items:center; }',
    'body.gn-fs .pool-wrap .pool-fs-mid { display:flex; align-items:center; justify-content:center; min-width:0; }',
    'body.gn-fs .pool-wrap .pool-fs-turn-pill { padding:4px 12px; border-radius:999px; background:rgba(255,253,248,0.1); border:1px solid rgba(255,253,248,0.18); font-size:12px; font-weight:700; color:var(--ge-paper, #fffdf8); white-space:nowrap; }',
    'body.gn-fs .pool-wrap .pool-fs-turn-pill--mine { background:rgba(200,164,92,0.24); border-color:var(--ge-gold, #c8a45c); color:#fef3c7; }',
    'body.gn-fs .pool-wrap .pool-fs-snooker-mid { display:none; align-items:center; gap:8px; padding:4px 12px; border-radius:999px; background:rgba(255,253,248,0.1); border:1px solid rgba(255,253,248,0.18); font-size:12px; font-weight:700; white-space:nowrap; }',
    'body.gn-fs .pool-wrap .pool-fs-snooker-mid--mine { background:rgba(200,164,92,0.22); border-color:var(--ge-gold, #c8a45c); }',
    'body.gn-fs .pool-wrap .pool-fs-on-wrap { display:inline-flex; align-items:center; gap:5px; }',
    'body.gn-fs .pool-wrap .pool-fs-on-dot { width:11px; height:11px; border-radius:50%; border:1px solid rgba(255,255,255,0.45); flex-shrink:0; }',
    'body.gn-fs .pool-wrap .pool-fs-rem-wrap { display:inline-flex; align-items:center; gap:3px; color:rgba(255,253,248,0.82); font-variant-numeric:tabular-nums; }',
    'body.gn-fs .pool-wrap .pool-fs-snooker-phase { color:#fde68a; font-size:11px; font-weight:700; }',
    'body.gn-fs .pool-wrap .pool-fs-left { grid-column:1; grid-row:2; display:flex; flex-direction:column; align-items:center; padding:8px 2px 4px; min-height:0; box-sizing:border-box; }',
    'body.gn-fs .pool-wrap .pool-fs-cue-track { position:relative; width:100%; min-width:52px; flex:1 1 auto; min-height:0; border-radius:16px; background:rgba(12,18,15,0.78); border:1.5px solid rgba(255,253,248,0.15); box-shadow:inset 0 2px 10px rgba(0,0,0,0.55); overflow:hidden; touch-action:none; cursor:ns-resize; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; }',
    'body.gn-fs .pool-wrap .pool-fs-cue-track.is-disabled { opacity:0.36; cursor:default; }',
    'body.gn-fs .pool-wrap .pool-fs-cue-fill { position:absolute; inset:0; background:linear-gradient(180deg, rgba(34,197,94,0.42) 0%, rgba(234,179,8,0.48) 55%, rgba(239,68,68,0.56) 100%); transform-origin:top center; transform:scaleY(0); pointer-events:none; }',
    'body.gn-fs .pool-wrap .pool-fs-cue-scale { position:absolute; top:10px; bottom:10px; right:5px; width:8px; pointer-events:none; background:repeating-linear-gradient(180deg, rgba(255,253,248,0.34) 0 1.5px, transparent 1.5px 12px); opacity:0.75; }',
    'body.gn-fs .pool-wrap .pool-fs-cue-stick { position:relative; z-index:2; margin-top:10px; width:14px; height:64%; min-height:92px; display:flex; flex-direction:column; align-items:center; pointer-events:none; will-change:transform; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.55)); }',
    'body.gn-fs .pool-wrap .pool-fs-cue-tip { width:7px; height:5px; border-radius:3px 3px 1px 1px; background:#38bdf8; flex-shrink:0; }',
    'body.gn-fs .pool-wrap .pool-fs-cue-ferrule { width:7px; height:6px; background:#f8fafc; flex-shrink:0; }',
    'body.gn-fs .pool-wrap .pool-fs-cue-shaft { width:8px; flex:1 1 0; background:linear-gradient(90deg, #e7d1a8 0%, #f5e6c8 45%, #c79a5b 100%); }',
    'body.gn-fs .pool-wrap .pool-fs-cue-wrap { width:10px; height:22%; background:linear-gradient(90deg, #3b2416 0%, #5c3924 50%, #24140c 100%); border-radius:1px; flex-shrink:0; }',
    'body.gn-fs .pool-wrap .pool-fs-cue-butt { width:12px; height:26%; background:linear-gradient(90deg, #1e110a 0%, #3d2417 45%, #120905 100%); border-radius:2px 2px 5px 5px; flex-shrink:0; border-top:2px solid #c8a252; }',
    'body.gn-fs .pool-wrap .pool-fs-cue-badge { position:absolute; left:4px; right:4px; bottom:6px; z-index:3; padding:3px 4px; border-radius:8px; background:rgba(12,18,15,0.82); border:1px solid rgba(255,253,248,0.16); color:var(--ge-paper, #fffdf8); font-size:10px; font-weight:800; text-align:center; line-height:1.15; font-variant-numeric:tabular-nums; pointer-events:none; }',
    'body.gn-fs .pool-wrap .pool-fs-cue-badge.is-cancel { color:#fca5a5; border-color:rgba(248,113,113,0.45); }',
    'body.gn-fs .pool-wrap .pool-canvas-wrap { grid-column:2; grid-row:2; position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; min-width:0; min-height:0; }',
    'body.gn-fs .pool-wrap .pool-canvas { box-shadow:0 14px 36px rgba(0,0,0,0.52); }',
    'body.gn-fs .pool-wrap .snooker-nom-bar { grid-column:2; grid-row:2; align-self:center; justify-self:center; z-index:25; width:auto; max-width:calc(100% - 16px); padding:8px 12px; gap:6px; border-radius:16px; background:rgba(255,253,248,0.96); box-shadow:0 12px 32px rgba(0,0,0,0.42); }',
    'body.gn-fs .pool-wrap .snooker-nom-bar.snooker-nom-bar--picked { align-self:start; margin-top:8px; }',
    'body.gn-fs .pool-wrap .snooker-nom-btn { min-height:44px; padding:6px 11px; font-size:12px; transition:transform 120ms cubic-bezier(0.23,1,0.32,1); }',
    'body.gn-fs .pool-wrap .snooker-nom-btn:active:not(:disabled) { transform:scale(0.97); }',
    'body.gn-fs .pool-wrap .pool-fs-right { grid-column:3; grid-row:2; display:flex; flex-direction:column; align-items:center; gap:8px; padding:2px 2px 4px; min-height:0; box-sizing:border-box; }',
    'body.gn-fs .pool-wrap .pool-fs-spin-ball { position:relative; width:var(--pool-fs-spin, 86px); height:var(--pool-fs-spin, 86px); min-width:84px; min-height:84px; border-radius:50%; background:radial-gradient(circle at 32% 28%, #ffffff 0%, #f1efe7 62%, #d2cec2 100%); border:2px solid rgba(255,253,248,0.55); box-shadow:inset 0 -4px 8px rgba(0,0,0,0.22), 0 4px 14px rgba(0,0,0,0.38); touch-action:none; cursor:pointer; flex-shrink:0; box-sizing:border-box; }',
    'body.gn-fs .pool-wrap .pool-fs-spin-ball::before { content:""; position:absolute; left:50%; top:8px; bottom:8px; width:1px; background:rgba(28,25,23,0.16); transform:translateX(-0.5px); pointer-events:none; }',
    'body.gn-fs .pool-wrap .pool-fs-spin-ball::after { content:""; position:absolute; top:50%; left:8px; right:8px; height:1px; background:rgba(28,25,23,0.16); transform:translateY(-0.5px); pointer-events:none; }',
    'body.gn-fs .pool-wrap .pool-fs-spin-ring { position:absolute; inset:13%; border-radius:50%; border:1px dashed rgba(28,25,23,0.18); pointer-events:none; }',
    'body.gn-fs .pool-wrap .pool-fs-spin-ball.is-offset { border-color:var(--ge-gold, #c8a45c); box-shadow:inset 0 -4px 8px rgba(0,0,0,0.22), 0 0 0 2px rgba(200,164,92,0.45); }',
    'body.gn-fs .pool-wrap .pool-fs-spin-dot { position:absolute; width:13px; height:13px; border-radius:50%; background:#dc2626; border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,0.5); transform:translate(-50%,-50%); left:50%; top:50%; pointer-events:none; }',
    'body.gn-fs .pool-wrap .pool-fs-ruler { position:relative; flex:1 1 auto; width:100%; min-width:52px; min-height:80px; border-radius:16px; background:rgba(12,18,15,0.78); border:1.5px solid rgba(255,253,248,0.15); box-shadow:inset 0 2px 10px rgba(0,0,0,0.55); overflow:hidden; touch-action:none; cursor:ns-resize; }',
    'body.gn-fs .pool-wrap .pool-fs-ruler.is-disabled { opacity:0.36; cursor:default; }',
    'body.gn-fs .pool-wrap .pool-fs-ruler-ticks { position:absolute; left:0; right:0; top:-40px; height:960px; pointer-events:none; will-change:transform; display:flex; flex-direction:column; align-items:flex-end; padding-right:10px; box-sizing:border-box; }',
    'body.gn-fs .pool-wrap .pool-fs-rtick { height:8px; width:18px; position:relative; flex-shrink:0; }',
    'body.gn-fs .pool-wrap .pool-fs-rtick::after { content:""; position:absolute; right:0; top:3px; height:1.5px; width:14px; border-radius:1px; background:rgba(255,253,248,0.34); }',
    'body.gn-fs .pool-wrap .pool-fs-rtick--major::after { width:30px; height:2px; background:rgba(255,253,248,0.72); }',
    'body.gn-fs .pool-wrap .pool-fs-rtick--mid::after { width:21px; background:rgba(255,253,248,0.52); }',
    'body.gn-fs .pool-wrap .pool-fs-ruler-marker { position:absolute; left:8px; right:8px; top:50%; height:2px; transform:translateY(-50%); background:var(--ge-gold, #c8a45c); box-shadow:0 0 8px rgba(200,164,92,0.7); pointer-events:none; }',
    'body.gn-fs .pool-wrap .pool-fs-ruler-marker::before { content:""; position:absolute; left:-2px; top:50%; transform:translateY(-50%); border-top:5px solid transparent; border-bottom:5px solid transparent; border-left:7px solid var(--ge-gold, #c8a45c); }',
    'body.gn-fs .pool-wrap .pool-fs-ruler-label { position:absolute; left:4px; right:4px; bottom:5px; text-align:center; font-size:10px; font-weight:700; color:rgba(255,253,248,0.68); pointer-events:none; }',
    'body.gn-fs .pool-wrap .pool-fs-place-wrap { display:none; flex:1 1 auto; width:100%; flex-direction:column; align-items:center; justify-content:center; gap:8px; }',
    'body.gn-fs .pool-wrap .pool-fs-confirm-btn { width:100%; min-height:52px; padding:10px 6px; border-radius:14px; border:none; background:var(--ge-gold, #c8a45c); color:#fff; font-size:14px; font-weight:800; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,0.36); transition:transform 120ms cubic-bezier(0.23,1,0.32,1), opacity 160ms ease; }',
    'body.gn-fs .pool-wrap .pool-fs-confirm-btn:active:not(:disabled) { transform:scale(0.97); }',
    'body.gn-fs .pool-wrap .pool-fs-confirm-btn:disabled { opacity:0.38; cursor:not-allowed; }',
    'body.gn-fs .pool-wrap .pool-fs-place-hint { font-size:11px; font-weight:600; color:rgba(255,253,248,0.78); text-align:center; line-height:1.25; }',
    '@media (min-height: 600px) {',
    '  body.gn-fs .pool-wrap .pool-fs-avatar { width:42px; height:42px; font-size:20px; }',
    '  body.gn-fs .pool-wrap .pool-fs-name { font-size:14px; }',
    '  body.gn-fs .pool-wrap .pool-fs-bdot { width:18px; height:18px; }',
    '  body.gn-fs .pool-wrap .pool-fs-score { font-size:19px; }',
    '}',
    '@media (prefers-reduced-motion: reduce) { .pool-group-overlay, .pool-shot-banner, .pool-seat, body.gn-fs .pool-wrap .pool-fs-avatar, body.gn-fs .pool-wrap .snooker-nom-btn, body.gn-fs .pool-wrap .pool-fs-confirm-btn { transition:none !important; animation:none !important; } }',
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

  var fsTopBarEl = null;
  var fsMeEl = null;
  var fsOppEl = null;
  var fsMidEl = null;
  var fsLeftEl = null;
  var fsCueTrackEl = null;
  var fsCueFillEl = null;
  var fsCueStickEl = null;
  var fsCueBadgeEl = null;
  var fsRightEl = null;
  var fsSpinPadEl = null;
  var fsSpinDotEl = null;
  var fsRulerEl = null;
  var fsRulerTicksEl = null;
  var fsPlaceWrapEl = null;
  var fsConfirmPlaceBtnEl = null;
  var fsPlaceHintEl = null;
  var fsSideRefs = null;
  var fsMidRefs = null;

  var currentState = null;
  var latestState = null;
  var myPlayerIndex = 0;
  var displayBalls = [];
  var shotQueue = [];
  var lastQueuedSeq = null;
  var lastAimInitSeq = -1;
  var lastTurnPhaseKey = '';
  var lastLayoutKey = '';
  var replaying = false;
  var rafId = null;
  var postShotPauseTimer = null;
  var POST_SHOT_PAUSE_MS = 1000;

  var isPortrait = false;
  var isSideways = false;

  var aimAngle = 0;
  var aimPower = 0.58;
  var aimSpinX = 0;
  var aimSpinY = 0;
  var spinDragging = false;
  var fsSpinDragging = false;
  var lastSpinTapMs = 0;
  var lastSpinTapX = 0;
  var lastSpinTapY = 0;
  var fsSpinMoved = false;
  var selectedNominate = null;
  var lastNomSeq = -1;
  var placeX = HEAD_STRING_X;
  var placeY = FOOT_SPOT_Y;
  var placeGrabDx = 0;
  var placeGrabDy = 0;
  var dragMode = null; // null | 'aim' | 'place'

  var fsCharging = false;
  var fsChargePower = 0;
  var fsCuePointerId = null;
  var fsCueStartY = 0;
  var fsCueMaxDrag = 160;

  var fineDragging = false;
  var finePointerId = null;
  var fineLastY = 0;
  var fineRulerScrollPx = 0;

  var myStrikeAnim = null;
  var strikeRafId = null;
  var awaitingShotSeq = null;
  var awaitingShotTimer = null;

  var oppAimPreview = null;
  var lastSeatCueAngle = {};
  var reducedTimerId = null;
  var pocketEffects = [];
  var pocketFxRafId = null;
  var shotBannerEl = null;
  var shotBannerTimer = null;
  var ballRoll = {};
  var prevBallPos = {};
  var prevGroups = null;
  var prevSnapshot = null;
  var scoreRollRafs = {};
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

  function findNearestPocket(x, y) {
    var best = POCKETS[0];
    var bestD2 = Infinity;
    for (var i = 0; i < POCKETS.length; i++) {
      var p = POCKETS[i];
      var dx = x - p.x;
      var dy = y - p.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = p;
      }
    }
    return best;
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
          events.push({
            framePos: k + 0.35,
            type: 'pocket',
            intensity: 0.9,
            ballId: id,
            pocket: findNearestPocket(fCurr[id].x, fCurr[id].y),
          });
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
    var leftPct = (50 + aimSpinX * 36) + '%';
    var topPct = (50 - aimSpinY * 36) + '%';
    var isZero = Math.abs(aimSpinX) < 0.01 && Math.abs(aimSpinY) < 0.01;
    if (spinDotEl) {
      spinDotEl.style.left = leftPct;
      spinDotEl.style.top = topPct;
    }
    if (spinResetEl) {
      spinResetEl.dataset.zero = isZero ? '1' : '0';
    }
    if (fsSpinDotEl) {
      fsSpinDotEl.style.left = leftPct;
      fsSpinDotEl.style.top = topPct;
    }
    if (fsSpinPadEl) {
      fsSpinPadEl.classList.toggle('is-offset', !isZero);
    }
  }

  function updateSpinFromElement(e, el) {
    if (!el) return;
    var rect = el.getBoundingClientRect();
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

  function updateSpinFromPointer(e) {
    updateSpinFromElement(e, spinPadEl);
  }

  function syncFsCueUI() {
    var p = clamp(fsChargePower, 0, 1);
    if (fsCueFillEl) {
      fsCueFillEl.style.transform = 'scaleY(' + p + ')';
    }
    if (fsCueStickEl) {
      var trackH = fsCueTrackEl ? fsCueTrackEl.clientHeight : 220;
      var stickH = fsCueStickEl.offsetHeight || 120;
      var maxTravel = Math.max(24, trackH - stickH - 28);
      var pullPx = Math.round(p * maxTravel);
      fsCueStickEl.style.transform = 'translateY(' + pullPx + 'px)';
    }
    if (fsCueBadgeEl) {
      if (fsCharging && p < 0.05) {
        fsCueBadgeEl.textContent = t('pool_cue_cancel');
        fsCueBadgeEl.classList.add('is-cancel');
      } else if (fsCharging) {
        fsCueBadgeEl.textContent = Math.round(p * 100) + '%';
        fsCueBadgeEl.classList.remove('is-cancel');
      } else {
        fsCueBadgeEl.textContent = t('pool_cue_pull_hint');
        fsCueBadgeEl.classList.remove('is-cancel');
      }
    }
  }

  function updateFsControlsEnabled() {
    var canShoot = !!(currentState && isMyTurn() && !replaying && shotQueue.length === 0 && !myStrikeAnim && awaitingShotSeq === null && currentState.phase === 'shoot');
    if (fsCueTrackEl) fsCueTrackEl.classList.toggle('is-disabled', !canShoot);
    if (fsRulerEl) fsRulerEl.classList.toggle('is-disabled', !canShoot);
  }

  function getPlayerInfo(seatIdx) {
    var list = window.gamePlayers || window._players;
    var p = null;
    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].index === seatIdx) {
          p = list[i];
          break;
        }
      }
      if (!p && list[seatIdx]) p = list[seatIdx];
    }
    var name = (p && p.name) ? p.name : (window.getPlayerName ? window.getPlayerName(seatIdx) : ('P' + (seatIdx + 1)));
    var avatar = (p && p.avatar) ? p.avatar : (p && p.isBot ? '🤖' : String(name || 'P').trim().charAt(0).toUpperCase());
    return { name: name, avatar: avatar, isBot: !!(p && p.isBot) };
  }

  function rollNumber(el, key, fromVal, toVal, durationMs) {
    if (!el) return;
    if (scoreRollRafs[key]) {
      cancelAnimationFrame(scoreRollRafs[key]);
      delete scoreRollRafs[key];
    }
    if (fromVal === null || fromVal === undefined || fromVal === toVal || isReducedMotion()) {
      el.textContent = String(toVal);
      return;
    }
    var start = performance.now();
    var dur = durationMs || 600;
    function step(now) {
      var u = clamp((now - start) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - u, 3);
      el.textContent = String(Math.round(fromVal + (toVal - fromVal) * eased));
      if (u < 1) {
        scoreRollRafs[key] = requestAnimationFrame(step);
      } else {
        delete scoreRollRafs[key];
        el.textContent = String(toVal);
      }
    }
    scoreRollRafs[key] = requestAnimationFrame(step);
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

  function isFullscreenMode() {
    return !!(document.body && document.body.classList.contains('gn-fs'));
  }

  function isReducedMotion() {
    return !!((window.Motion && window.Motion.reduced && window.Motion.reduced()) ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  }

  function shortestAngleDiff(from, to) {
    var d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function easeOutBezier(u) {
    var x = clamp(u, 0, 1);
    if (x <= 0 || x >= 1) return x;
    var t = x;
    for (var i = 0; i < 5; i++) {
      var mt = 1 - t;
      var bx = 3 * mt * mt * t * 0.23 + 3 * mt * t * t * 0.32 + t * t * t;
      var dx = 3 * mt * mt * 0.23 + 6 * mt * t * (0.32 - 0.23) + 3 * t * t * (1 - 0.32);
      if (Math.abs(dx) < 1e-6) break;
      t = clamp(t - (bx - x) / dx, 0, 1);
    }
    var m = 1 - t;
    return 3 * m * m * t + 3 * m * t * t + t * t * t;
  }

  function popOvershootScale(u) {
    var x = clamp(u, 0, 1);
    if (x < 0.65) {
      return 0.72 + 0.40 * easeOutBezier(x / 0.65);
    }
    return 1.12 - 0.12 * easeOutBezier((x - 0.65) / 0.35);
  }

  function resizeCanvas() {
    if (!canvas || !ctx || !containerEl) return;
    var isFs = isFullscreenMode();
    if (isFs) {
      isSideways = false;
      isPortrait = false;
    } else {
      isSideways = window.innerHeight < 540 && window.innerWidth > window.innerHeight;
      isPortrait = !isSideways && window.innerHeight > window.innerWidth;
    }

    if (wrapEl) {
      wrapEl.classList.toggle('fs', isFs);
      wrapEl.classList.toggle('sideways', !isFs && isSideways);
      wrapEl.classList.toggle('portrait', !isFs && isPortrait);
      if (!isFs) {
        wrapEl.style.removeProperty('--pool-fs-top');
        wrapEl.style.removeProperty('--pool-fs-left');
        wrapEl.style.removeProperty('--pool-fs-right');
        wrapEl.style.removeProperty('--pool-fs-spin');
      }
    }

    var fitEl = (isSideways && containerEl.closest && containerEl.closest('.board-wrap')) || containerEl;
    var fit = window.boardFit ? window.boardFit(fitEl) : { w: window.innerWidth - 24, h: window.innerHeight - 160 };
    var hudH = (hudEl && hudEl.offsetHeight) ? hudEl.offsetHeight : (isSideways ? 28 : 54);
    var nomH = (nomBarEl && nomBarEl.style.display !== 'none' && nomBarEl.offsetHeight) ? (nomBarEl.offsetHeight + 4) : 0;
    var dispW, dispH;

    if (isFs) {
      var vw = window.innerWidth || 640;
      var vh = window.innerHeight || 360;
      var topH = vh >= 560 ? 64 : 56;
      var leftW = clamp(Math.round(vw * 0.085), 68, 84);
      var rightW = clamp(Math.round(vw * 0.12), 96, 124);
      var spinSize = clamp(Math.min(rightW - 10, Math.round(vh * 0.23)), 84, 108);
      if (wrapEl) {
        wrapEl.style.setProperty('--pool-fs-top', topH + 'px');
        wrapEl.style.setProperty('--pool-fs-left', leftW + 'px');
        wrapEl.style.setProperty('--pool-fs-right', rightW + 'px');
        wrapEl.style.setProperty('--pool-fs-spin', spinSize + 'px');
      }
      var availWFs = Math.max(200, vw - leftW - rightW - 24);
      var availHFs = Math.max(120, vh - topH - 14);
      var scaleFs = Math.min(availWFs / CW, availHFs / CH);
      dispW = Math.max(200, Math.floor(CW * scaleFs));
      dispH = Math.max(100, Math.floor(CH * scaleFs));
      if (barEl) barEl.style.height = '';
    } else if (isSideways) {
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

    lastLayoutKey = window.innerWidth + 'x' + window.innerHeight + ':' + (containerEl ? containerEl.clientWidth : 0) + ':' + (isFs ? 'fs' : (isSideways ? 's' : (isPortrait ? 'p' : 'l'))) + ':' + (isSnooker ? 'sn' : '8b');

    if (isFs) syncFsCueUI();
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

  function drawAimGuide(cue, balls, angleOverride, powerOverride, guideOpts) {
    var angToUse = angleOverride !== undefined ? angleOverride : aimAngle;
    var pwrToUse = powerOverride !== undefined ? powerOverride : aimPower;
    var hit = raycastCue(cue, angToUse, balls);
    var cx = RAIL + cue.x;
    var cy = RAIL + cue.y;
    var gx = RAIL + hit.gx;
    var gy = RAIL + hit.gy;
    var highlightTarget = !!(guideOpts && guideOpts.highlightTarget);
    var fadeAlpha = (guideOpts && guideOpts.fadeAlpha !== undefined) ? guideOpts.fadeAlpha : 1;

    ctx.save();
    if (highlightTarget && fadeAlpha < 1) {
      ctx.globalAlpha = fadeAlpha;
    }

    // Dotted aim line from cue to ghost ball center
    ctx.strokeStyle = highlightTarget ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.75)';
    ctx.lineWidth = highlightTarget ? 2.3 : 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(gx, gy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Translucent hollow ghost ball ring
    ctx.strokeStyle = highlightTarget ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.88)';
    ctx.fillStyle = highlightTarget ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = highlightTarget ? 2 : 1.8;
    ctx.beginPath();
    ctx.arc(gx, gy, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pulsing ring around the first object ball hit during opponent aim animation
    if (highlightTarget && hit.hitBall) {
      var hbx = RAIL + hit.hitBall.x;
      var hby = RAIL + hit.hitBall.y;
      ctx.save();
      if (guideOpts && guideOpts.reduced) {
        ctx.strokeStyle = 'rgba(253,224,71,0.92)';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(hbx, hby, BALL_R + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(253,224,71,0.32)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hbx, hby, BALL_R + 10, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        var nowMs = (guideOpts && guideOpts.now) || performance.now();
        var pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.011);
        var rippleU = (nowMs % 750) / 750;
        var rippleE = easeOutBezier(rippleU);
        ctx.strokeStyle = 'rgba(253,224,71,0.95)';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(hbx, hby, BALL_R + 4.5 + 2.2 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(253,224,71,' + (0.7 * (1 - rippleU)).toFixed(3) + ')';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(hbx, hby, BALL_R + 5 + 12 * rippleE, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Target deflection arrow + cue ball deflection path when hitting an object ball
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
      ctx.strokeStyle = 'rgba(253,224,71,0.92)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(tx0, ty0);
      ctx.lineTo(tx1, ty1);
      ctx.stroke();

      var ang = Math.atan2(ny, nx);
      ctx.fillStyle = 'rgba(253,224,71,0.92)';
      ctx.beginPath();
      ctx.moveTo(tx1, ty1);
      ctx.lineTo(tx1 - 9 * Math.cos(ang - 0.45), ty1 - 9 * Math.sin(ang - 0.45));
      ctx.lineTo(tx1 - 9 * Math.cos(ang + 0.45), ty1 - 9 * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();

      // Cue ball post-impact deflection path (tangential component)
      var ax = Math.cos(angToUse);
      var ay = Math.sin(angToUse);
      var dot = ax * nx + ay * ny;
      var cxDef = ax - dot * nx;
      var cyDef = ay - dot * ny;
      var cLen = Math.hypot(cxDef, cyDef);
      if (cLen >= 0.06) {
        var cux = cxDef / cLen;
        var cuy = cyDef / cLen;
        var defLen = 20 + 32 * clamp(cLen, 0, 1);
        var cdx = gx + cux * defLen;
        var cdy = gy + cuy * defLen;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.78)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(cdx, cdy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.beginPath();
        ctx.arc(cdx, cdy, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
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
    var cx = RAIL + placeX;
    var cy = RAIL + placeY;
    var handleR = BALL_R * 2.8;
    ctx.save();
    ctx.fillStyle = valid ? 'rgba(34, 197, 94, 0.16)' : 'rgba(239, 68, 68, 0.20)';
    ctx.strokeStyle = valid ? 'rgba(255, 255, 255, 0.78)' : 'rgba(248, 113, 113, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, handleR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4 subtle directional pips on the drag handle rim
    ctx.fillStyle = valid ? 'rgba(255, 255, 255, 0.78)' : 'rgba(248, 113, 113, 0.9)';
    var pipR = handleR - 6;
    for (var d = 0; d < 4; d++) {
      var a = d * Math.PI * 0.5;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * pipR, cy + Math.sin(a) * pipR, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawBall({ id: 0, x: placeX, y: placeY, potted: false, type: 'cue' }, 0.78);
    ctx.save();
    ctx.strokeStyle = valid ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, BALL_R + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function snookerBallValueLocal(id) {
    if (id === 0) return 0;
    if (id >= 1 && id <= 15) return 1;
    for (var i = 0; i < SNOOKER_COLOURS.length; i++) {
      if (SNOOKER_COLOURS[i].id === id) return SNOOKER_COLOURS[i].value;
    }
    return 1;
  }

  function startPocketFxLoop() {
    if (pocketFxRafId || replaying || pocketEffects.length === 0) return;
    function tickPocketFx() {
      pocketFxRafId = null;
      if (replaying || pocketEffects.length === 0) {
        draw();
        return;
      }
      draw();
      if (pocketEffects.length > 0 && !replaying) {
        pocketFxRafId = requestAnimationFrame(tickPocketFx);
      }
    }
    pocketFxRafId = requestAnimationFrame(tickPocketFx);
  }

  function spawnPocketEffect(ballId, pocket, now, isFoul) {
    if (!pocket) return;
    var tNow = now || performance.now();
    var stackIndex = 0;
    for (var i = 0; i < pocketEffects.length; i++) {
      var fx = pocketEffects[i];
      if (fx.pocket && fx.pocket.id === pocket.id && tNow - fx.startTime < fx.duration) {
        stackIndex++;
      }
    }
    pocketEffects.push({
      ballId: ballId,
      pocket: pocket,
      startTime: tNow,
      ringDur: 420,
      chipDur: 880,
      duration: 880,
      stackIndex: stackIndex,
      isFoul: !!isFoul,
      reduced: isReducedMotion(),
    });
    startPocketFxLoop();
  }

  function drawPocketEffects(now) {
    if (!pocketEffects.length) return;
    var active = [];
    for (var i = 0; i < pocketEffects.length; i++) {
      var fx = pocketEffects[i];
      if (now - fx.startTime < fx.duration) {
        active.push(fx);
      }
    }
    pocketEffects = active;
    if (!active.length) return;

    for (var j = 0; j < active.length; j++) {
      var item = active[j];
      var elapsed = Math.max(0, now - item.startTime);
      var px = RAIL + item.pocket.x;
      var py = RAIL + item.pocket.y;
      var ringColor = item.ballId === 0 ? '248,113,113' : '253,224,71';

      if (elapsed < item.ringDur) {
        var rt = clamp(elapsed / item.ringDur, 0, 1);
        var re = easeOutBezier(rt);
        ctx.save();
        if (item.reduced) {
          ctx.strokeStyle = 'rgba(' + ringColor + ',' + ((1 - re) * 0.85).toFixed(3) + ')';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px, py, item.pocket.r + 6, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          var rad = item.pocket.r * 0.85 + (item.pocket.r + 22 - item.pocket.r * 0.85) * re;
          var fillGrad = ctx.createRadialGradient(px, py, 2, px, py, item.pocket.r);
          fillGrad.addColorStop(0, 'rgba(' + ringColor + ',' + ((1 - rt) * 0.28).toFixed(3) + ')');
          fillGrad.addColorStop(1, 'rgba(' + ringColor + ',0)');
          ctx.fillStyle = fillGrad;
          ctx.beginPath();
          ctx.arc(px, py, item.pocket.r, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(' + ringColor + ',' + ((1 - rt) * 0.92).toFixed(3) + ')';
          ctx.lineWidth = Math.max(1.2, 4.5 - 3.2 * re);
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (elapsed < item.chipDur) {
        var ct = clamp(elapsed / item.chipDur, 0, 1);
        var alpha = ct < 0.12 ? ct / 0.12 : (ct < 0.72 ? 1 : (1 - ct) / 0.28);
        var dx = CW / 2 - px;
        var dy = CH / 2 - py;
        var dLen = Math.hypot(dx, dy) || 1;
        var ux = dx / dLen;
        var uy = dy / dLen;
        var baseDist = item.pocket.r + 26 + item.stackIndex * 28;
        var drift = item.reduced ? 0 : (16 * easeOutBezier(ct));
        var sc = item.reduced ? 1 : popOvershootScale(elapsed / 200);
        var lx = clamp(px + ux * (baseDist + drift), 42, CW - 42);
        var ly = clamp(py + uy * (baseDist + drift), 24, CH - 24);

        var labelText;
        if (item.ballId === 0) {
          labelText = t('pool_chip_cue');
        } else if (isSnooker) {
          labelText = item.isFoul ? t('snooker_ball_' + snookerBallType(item.ballId)) : ('+' + snookerBallValueLocal(item.ballId));
        } else {
          labelText = String(item.ballId);
        }
        var ballCol = isSnooker ? (SNOOKER_BALL_COLORS[item.ballId] || '#c81e1e') : (BALL_COLORS[item.ballId] || '#ccc');
        var isStripe = !isSnooker && item.ballId >= 9 && item.ballId <= 15;

        ctx.save();
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.translate(lx, ly);
        if (isPortrait) ctx.rotate(Math.PI / 2);
        ctx.scale(sc, sc);
        ctx.font = '800 12px sans-serif';
        var tw = ctx.measureText(labelText).width;
        var dotR = 6.5;
        var padX = 8;
        var pillW = Math.max(40, padX * 2 + dotR * 2 + 6 + tw);
        var pillH = 24;
        roundRectPath(ctx, -pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);
        ctx.fillStyle = item.ballId === 0 ? 'rgba(42,16,18,0.94)' : 'rgba(17,24,21,0.92)';
        ctx.fill();
        ctx.strokeStyle = item.ballId === 0 ? 'rgba(248,113,113,0.85)' : 'rgba(200,164,92,0.85)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        var dotX = -pillW / 2 + padX + dotR;
        ctx.save();
        ctx.beginPath();
        ctx.arc(dotX, 0, dotR, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = ballCol;
        ctx.fillRect(dotX - dotR, -dotR, dotR * 2, dotR * 2);
        if (isStripe) {
          ctx.fillStyle = '#faf9f2';
          ctx.fillRect(dotX - dotR, -dotR, dotR * 2, dotR * 0.45);
          ctx.fillRect(dotX - dotR, dotR * 0.55, dotR * 2, dotR * 0.45);
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(dotX, 0, dotR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = item.ballId === 0 ? '#fca5a5' : '#fffdf8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, dotX + dotR + 5, 0.5);
        ctx.restore();
      }
    }
  }

  function draw() {
    if (!ctx || !canvas) return;
    var now = performance.now();
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
    if (currentState && currentState.phase === 'ball_in_hand' && !replaying && shotQueue.length === 0) {
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
      var curAng = oppAimPreview.angle;
      var curPwr = oppAimPreview.power;
      var oppFadeAlpha = 1;
      if (oppAimPreview.reduced) {
        oppFadeAlpha = clamp((now - oppAimPreview.startTime) / 140, 0, 1);
      } else {
        var pElapsed = Math.max(0, now - oppAimPreview.startTime);
        var rotEnd = oppAimPreview.rotateDur;
        var holdEnd = rotEnd + oppAimPreview.holdDur;
        var pullEnd = holdEnd + oppAimPreview.pullDur;
        var strikeEnd = pullEnd + oppAimPreview.strikeDur;
        if (pElapsed < rotEnd) {
          var uRot = clamp(pElapsed / rotEnd, 0, 1);
          var easeRot = easeOutBezier(uRot);
          curAng = oppAimPreview.fromAngle + oppAimPreview.angleDelta * easeRot;
          curPwr = 0;
        } else if (pElapsed < holdEnd) {
          curAng = oppAimPreview.angle;
          curPwr = 0;
        } else if (pElapsed < pullEnd) {
          var uPull = clamp((pElapsed - holdEnd) / oppAimPreview.pullDur, 0, 1);
          curAng = oppAimPreview.angle;
          curPwr = oppAimPreview.power * easeOutBezier(uPull);
        } else {
          var uStrike = clamp((pElapsed - pullEnd) / Math.max(1, strikeEnd - pullEnd), 0, 1);
          curAng = oppAimPreview.angle;
          curPwr = oppAimPreview.power * (1 - uStrike);
        }
      }
      drawAimGuide(cue, balls, curAng, curPwr, {
        highlightTarget: true,
        now: now,
        reduced: !!oppAimPreview.reduced,
        fadeAlpha: oppFadeAlpha,
      });
    } else if (myStrikeAnim && cue) {
      var sElapsed = Math.max(0, now - myStrikeAnim.startTime);
      var su = clamp(sElapsed / myStrikeAnim.duration, 0, 1);
      var sPwr = myStrikeAnim.fromPower * (1 - su * su);
      drawAimGuide(cue, balls, myStrikeAnim.angle, sPwr);
    } else if (currentState && isMyTurn() && !replaying && shotQueue.length === 0) {
      if (currentState.phase === 'shoot' && cue) {
        var guidePwr = isFullscreenMode() ? (fsCharging ? fsChargePower : 0) : aimPower;
        drawAimGuide(cue, balls, aimAngle, guidePwr);
      } else if (currentState.phase === 'ball_in_hand') {
        drawBallInHandGhost(kitchenOnly);
      }
    }

    drawPocketEffects(now);

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

  function updateFsSide(sideKey, seatIdx, state, ballById, activeSeat) {
    var refs = fsSideRefs && fsSideRefs[sideKey];
    if (!refs) return;
    var info = getPlayerInfo(seatIdx);
    refs.avatar.textContent = info.avatar;
    refs.avatar.classList.toggle('pool-fs-avatar--active', activeSeat === seatIdx);
    refs.name.textContent = info.name;

    if (isSnooker) {
      refs.rack.style.display = 'none';
      refs.snooker.style.display = 'flex';
      var score = (state.scores && typeof state.scores[seatIdx] === 'number') ? state.scores[seatIdx] : 0;
      var prevScore = (prevSnapshot && prevSnapshot.variant === 'snooker' && prevSnapshot.scores) ? prevSnapshot.scores[seatIdx] : null;
      rollNumber(refs.score, 'score_' + sideKey, prevScore, score, 600);
      var brk = (activeSeat === seatIdx && state.currentBreak > 0) ? state.currentBreak : 0;
      refs.brk.classList.toggle('is-visible', brk > 0);
      if (brk > 0) {
        refs.brk.textContent = t('snooker_break') + ' ' + brk;
      }
      return;
    }

    refs.rack.style.display = 'flex';
    refs.snooker.style.display = 'none';
    var group = state.groups ? state.groups[seatIdx] : null;
    var isFirstSnap = !prevSnapshot || prevSnapshot.variant !== '8ball';
    if (isFirstSnap) refs.rack.classList.add('no-anim');

    if (!group) {
      for (var u = 0; u < 7; u++) {
        refs.dots[u].className = 'pool-fs-bdot is-unknown';
        refs.fills[u].className = 'pool-fs-bdot-fill';
        refs.fills[u].style.background = '';
        refs.fills[u].style.color = '';
      }
      refs.eightDot.classList.remove('is-visible', 'is-potted');
    } else {
      var startId = group === 'solid' ? 1 : 9;
      var ownLeft = 0;
      for (var d = 0; d < 7; d++) {
        var bid = startId + d;
        var b = ballById[bid];
        var potted = !!(b && b.potted);
        if (!potted) ownLeft++;
        var isStripe = bid >= 9;
        var col = BALL_COLORS[bid];
        refs.dots[d].className = 'pool-fs-bdot' + (potted ? ' is-potted' : '');
        refs.fills[d].className = 'pool-fs-bdot-fill' + (isStripe ? ' pool-fs-bdot-fill--stripe' : '');
        refs.fills[d].style.background = col;
        refs.fills[d].style.color = col;
      }
      var eight = ballById[8];
      refs.eightDot.classList.toggle('is-visible', ownLeft === 0);
      refs.eightDot.classList.toggle('is-potted', !!(eight && eight.potted));
    }

    if (isFirstSnap) {
      void refs.rack.offsetWidth;
      refs.rack.classList.remove('no-anim');
    }
  }

  function updateFsTopBar(state) {
    if (!fsTopBarEl || !fsSideRefs || !fsMidRefs || !state) return;
    var meIdx = myPlayerIndex;
    var oppIdx = 1 - meIdx;
    var activeSeat = (state.winner === null && state.phase !== 'over') ? state.currentPlayer : -1;
    var ballById = {};
    var balls = state.balls || [];
    for (var i = 0; i < balls.length; i++) {
      if (balls[i]) ballById[balls[i].id] = balls[i];
    }

    updateFsSide('me', meIdx, state, ballById, activeSeat);
    updateFsSide('opp', oppIdx, state, ballById, activeSeat);

    var mine = isMyTurn();
    var mainText;
    if (state.phase === 'over' || state.winner !== null) {
      mainText = state.winner === myPlayerIndex ? t('rv_you_win') : (state.winner === -1 ? t('rv_draw') : t('rv_you_lose'));
    } else if (state.phase === 'ball_in_hand') {
      mainText = mine ? t('pool_place_cue') : t('pool_opp_place_cue');
    } else if (state.isBreak && mine) {
      mainText = t('pool_break_shot');
    } else {
      mainText = mine ? t('pool_your_turn') : t('pool_opp_turn');
    }

    if (!isSnooker) {
      fsMidRefs.turnPill.style.display = 'inline-flex';
      fsMidRefs.snookerMid.style.display = 'none';
      fsMidRefs.turnPill.className = 'pool-fs-turn-pill' + (mine ? ' pool-fs-turn-pill--mine' : '');
      fsMidRefs.turnPill.textContent = mainText;
    } else {
      fsMidRefs.turnPill.style.display = 'none';
      fsMidRefs.snookerMid.style.display = 'inline-flex';
      fsMidRefs.snookerMid.className = 'pool-fs-snooker-mid' + (mine ? ' pool-fs-snooker-mid--mine' : '');
      var ballOn = state.ballOn || 'red';
      var dotColor = ballOn === 'colour'
        ? (selectedNominate ? SNOOKER_COLOUR_HEX[selectedNominate] : 'linear-gradient(135deg,#eab308,#1d4ed8,#ec4899)')
        : (SNOOKER_COLOUR_HEX[ballOn] || '#c81e1e');
      var onLabel = ballOn === 'colour' && selectedNominate
        ? t('snooker_ball_' + selectedNominate)
        : t('snooker_ball_' + ballOn);
      var remPts = typeof state.pointsRemaining === 'number' ? state.pointsRemaining : 0;
      fsMidRefs.onDot.style.background = dotColor;
      fsMidRefs.onText.textContent = t('snooker_on') + ': ' + onLabel;
      fsMidRefs.remLbl.textContent = ' · ' + t('snooker_left') + ': ';
      var prevRem = (prevSnapshot && prevSnapshot.variant === 'snooker') ? prevSnapshot.pointsRemaining : null;
      rollNumber(fsMidRefs.remVal, 'snooker_rem', prevRem, remPts, 600);
      var showPhase = state.phase === 'ball_in_hand' || state.phase === 'over' || state.winner !== null;
      fsMidRefs.snookerPhase.style.display = showPhase ? 'inline' : 'none';
      if (showPhase) {
        fsMidRefs.snookerPhase.textContent = ' · ' + mainText;
      }
    }

    prevSnapshot = {
      variant: isSnooker ? 'snooker' : '8ball',
      scores: isSnooker && state.scores ? [state.scores[0] || 0, state.scores[1] || 0] : [0, 0],
      pointsRemaining: isSnooker && typeof state.pointsRemaining === 'number' ? state.pointsRemaining : 0,
    };
  }

  function updateHUD() {
    if (!currentState) return;
    updateSeatCard(seat0El, 0);
    updateSeatCard(seat1El, 1);
    updateFsTopBar(currentState);

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

  function closeGroupPopup(immediate) {
    if (groupOverlayTimer) {
      clearTimeout(groupOverlayTimer);
      groupOverlayTimer = null;
    }
    var oldEl = groupOverlayEl;
    groupOverlayEl = null;
    if (!oldEl) return;
    if (immediate || typeof oldEl.animate !== 'function' || isReducedMotion()) {
      if (oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
      return;
    }
    var removed = false;
    function finishRemove() {
      if (removed) return;
      removed = true;
      if (oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
    }
    try {
      var anim = oldEl.animate([
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(0.94)' },
      ], { duration: 190, easing: 'cubic-bezier(0.23,1,0.32,1)', fill: 'forwards' });
      anim.onfinish = finishRemove;
    } catch (_e) {
      finishRemove();
    }
    setTimeout(finishRemove, 220);
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
    closeGroupPopup(true);
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
    el.addEventListener('click', function () { closeGroupPopup(false); });

    if (isFullscreenMode() && canvas) {
      var rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        el.style.left = Math.round(rect.left + rect.width / 2) + 'px';
        el.style.top = Math.round(rect.top + rect.height / 2) + 'px';
      }
    }

    document.body.appendChild(el);
    groupOverlayEl = el;
    if (typeof el.animate === 'function') {
      if (isReducedMotion()) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'cubic-bezier(0.23,1,0.32,1)', fill: 'backwards' });
      } else {
        el.animate([
          { opacity: 0, transform: 'translate(-50%,-50%) scale(0.88)' },
          { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
        ], { duration: 300, easing: 'cubic-bezier(0.34,1.56,0.64,1)', fill: 'backwards' });
      }
    }
    groupOverlayTimer = setTimeout(function () { closeGroupPopup(false); }, 2500);
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
    var mine = isMyTurn() && !replaying && shotQueue.length === 0;
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

    nomBarEl.classList.toggle('snooker-nom-bar--picked', !!(needNom && selectedNominate));

    if (shootBtnEl) {
      shootBtnEl.disabled = !!(needNom && !selectedNominate);
    }
    updateFsControlsEnabled();

    var isVisibleNow = nomBarEl.style.display !== 'none';
    if (wasVisible !== isVisibleNow) {
      resizeCanvas();
    }
  }

  function updateBar() {
    if (!currentState) return;
    var mine = isMyTurn() && !replaying && shotQueue.length === 0;
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

    if (fsRulerEl && fsPlaceWrapEl) {
      var showFsPlace = mine && currentState.phase === 'ball_in_hand';
      fsRulerEl.style.display = showFsPlace ? 'none' : 'block';
      fsPlaceWrapEl.style.display = showFsPlace ? 'flex' : 'none';
      if (fsConfirmPlaceBtnEl) {
        fsConfirmPlaceBtnEl.disabled = !isValidCuePosLocal(displayBalls, placeX, placeY, kitchenOnly);
      }
      if (fsPlaceHintEl) {
        fsPlaceHintEl.textContent = t('pool_drag_cue_ball');
      }
    }
    syncSpinUI();
    syncFsCueUI();
    updateFsControlsEnabled();
    syncNominateUI();
  }

  function closeShotBanner(immediate) {
    if (shotBannerTimer) {
      clearTimeout(shotBannerTimer);
      shotBannerTimer = null;
    }
    var oldEl = shotBannerEl;
    shotBannerEl = null;
    if (!oldEl) return;
    if (immediate || typeof oldEl.animate !== 'function') {
      if (oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
      return;
    }
    var removed = false;
    function finishRemove() {
      if (removed) return;
      removed = true;
      if (oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
    }
    try {
      var anim = isReducedMotion()
        ? oldEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'cubic-bezier(0.23,1,0.32,1)', fill: 'forwards' })
        : oldEl.animate([
            { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
            { opacity: 0, transform: 'translate(-50%,-50%) scale(0.95)' },
          ], { duration: 160, easing: 'cubic-bezier(0.23,1,0.32,1)', fill: 'forwards' });
      anim.onfinish = finishRemove;
    } catch (_e) {
      finishRemove();
    }
    setTimeout(finishRemove, 180);
  }

  function buildShotBannerData(shot) {
    if (!shot) return null;
    var shooter = typeof shot.shooter === 'number' ? shot.shooter : -1;
    var isMe = shooter === myPlayerIndex;
    var who = isMe ? t('pool_group_you') : (shooter >= 0 ? getPlayerInfo(shooter).name : t('pool_group_opp'));
    var potted = Array.isArray(shot.potted) ? shot.potted : [];
    var objIds = [];
    for (var i = 0; i < potted.length; i++) {
      if (potted[i] !== 0) objIds.push(potted[i]);
    }

    if (isSnooker) {
      if (shot.respotBlackTie) {
        return { text: t('snooker_banner_respot_black'), sub: '', isFoul: false, chipIds: [21] };
      }
      if (shot.foul) {
        var pts = shot.foulPoints || 4;
        var fText = isMe ? tf('snooker_banner_foul_you', pts) : tf('snooker_banner_foul_opp', who, pts);
        var fSub = t('snooker_foul_' + shot.foul);
        return { text: fText, sub: fSub, isFoul: true, chipIds: potted.indexOf(0) >= 0 ? [0] : [] };
      }
      if (shot.pointsScored > 0 && objIds.length > 0) {
        var seenTypes = {};
        var names = [];
        for (var j = 0; j < objIds.length; j++) {
          var bt = snookerBallType(objIds[j]);
          if (!seenTypes[bt]) {
            seenTypes[bt] = true;
            names.push(t('snooker_ball_' + bt));
          }
        }
        return {
          text: tf('snooker_banner_pot', shot.pointsScored, names.join(t('pool_list_sep'))),
          sub: who,
          isFoul: false,
          chipIds: objIds,
        };
      }
      return null;
    }

    if (shot.illegalBreak) {
      return { text: tf('pool_banner_illegal_break', who), sub: '', isFoul: true, chipIds: [] };
    }
    if (shot.respotEight) {
      var rKey = shot.foul === 'scratch' ? 'pool_banner_respot_eight_foul' : 'pool_banner_respot_eight';
      return { text: tf(rKey, who), sub: '', isFoul: !!shot.foul, chipIds: [8] };
    }
    if (shot.foul) {
      var foulKey = 'pool_banner_foul_' + shot.foul;
      var chipIds = shot.foul === 'scratch' ? [0] : (shot.foul === 'early_eight' ? [8] : []);
      return { text: tf(foulKey, who), sub: '', isFoul: true, chipIds: chipIds };
    }
    if (objIds.length > 0) {
      var nums = objIds.map(function (id) { return String(id); }).join(t('pool_list_sep'));
      var pText = isMe ? tf('pool_banner_you_potted', nums) : tf('pool_banner_opp_potted', who, nums);
      return { text: pText, sub: '', isFoul: false, chipIds: objIds };
    }
    return null;
  }

  function showShotBanner(shot) {
    closeShotBanner(true);
    var data = buildShotBannerData(shot);
    if (!data) return;
    var host = canvas && canvas.parentNode;
    if (!host) return;

    var el = document.createElement('div');
    el.className = 'pool-shot-banner' +
      (data.isFoul ? ' pool-shot-banner--foul' : '') +
      (groupOverlayEl ? ' pool-shot-banner--top' : '');
    el.setAttribute('role', 'status');

    var row = document.createElement('div');
    row.className = 'pool-shot-banner-row';

    if (data.chipIds && data.chipIds.length > 0) {
      var chips = document.createElement('span');
      chips.className = 'pool-shot-banner-chips';
      for (var i = 0; i < data.chipIds.length && i < 6; i++) {
        var bid = data.chipIds[i];
        var chip = document.createElement('span');
        var isStripe = !isSnooker && bid >= 9 && bid <= 15;
        var col = isSnooker ? (SNOOKER_BALL_COLORS[bid] || '#c81e1e') : (BALL_COLORS[bid] || '#ccc');
        chip.className = 'pool-shot-banner-chip' + (isStripe ? ' pool-shot-banner-chip--stripe' : '');
        chip.style.background = col;
        chip.style.color = col;
        if (!isSnooker && bid > 0) {
          var num = document.createElement('span');
          num.className = 'pool-shot-banner-chip-num';
          num.textContent = String(bid);
          chip.appendChild(num);
        }
        chips.appendChild(chip);
      }
      row.appendChild(chips);
    }

    var mainEl = document.createElement('span');
    mainEl.className = 'pool-shot-banner-main';
    mainEl.textContent = data.text;
    row.appendChild(mainEl);
    el.appendChild(row);

    if (data.sub) {
      var subEl = document.createElement('div');
      subEl.className = 'pool-shot-banner-sub';
      subEl.textContent = data.sub;
      el.appendChild(subEl);
    }

    el.addEventListener('click', function () { closeShotBanner(false); });
    host.appendChild(el);
    shotBannerEl = el;

    if (typeof el.animate === 'function') {
      if (isReducedMotion()) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'cubic-bezier(0.23,1,0.32,1)', fill: 'backwards' });
      } else {
        el.animate([
          { opacity: 0, transform: 'translate(-50%,-50%) scale(0.86)' },
          { opacity: 1, transform: 'translate(-50%,-50%) scale(1.06)', offset: 0.68 },
          { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
        ], { duration: 240, easing: 'cubic-bezier(0.23,1,0.32,1)', fill: 'backwards' });
      }
    }

    shotBannerTimer = setTimeout(function () { closeShotBanner(false); }, 1600);
  }

  function parseFrame(flat) {
    var map = {};
    if (!Array.isArray(flat)) return map;
    for (var i = 0; i + 2 < flat.length; i += 3) {
      map[flat[i]] = { x: flat[i + 1], y: flat[i + 2] };
    }
    return map;
  }

  function clearPostShotPause() {
    if (postShotPauseTimer) {
      clearTimeout(postShotPauseTimer);
      postShotPauseTimer = null;
    }
  }

  function clearStrikeAndPending() {
    myStrikeAnim = null;
    awaitingShotSeq = null;
    if (awaitingShotTimer) {
      clearTimeout(awaitingShotTimer);
      awaitingShotTimer = null;
    }
    if (strikeRafId) {
      cancelAnimationFrame(strikeRafId);
      strikeRafId = null;
    }
  }

  function cancelActiveFsInputs() {
    fsCharging = false;
    fsChargePower = 0;
    fsCuePointerId = null;
    fineDragging = false;
    finePointerId = null;
    fsSpinDragging = false;
    syncFsCueUI();
  }

  function syncIdleState() {
    if (!latestState) return;
    currentState = latestState;
    if (replaying || shotQueue.length > 0 || myStrikeAnim) return;
    var seq = (currentState.lastShot && typeof currentState.lastShot.seq === 'number') ? currentState.lastShot.seq : (currentState.shotSeq || 0);
    var turnPhaseKey = currentState.currentPlayer + ':' + currentState.phase + ':' + seq + ':' + (currentState.ballOn || '');
    displayBalls = currentState.balls;
    if (turnPhaseKey !== lastTurnPhaseKey) {
      lastTurnPhaseKey = turnPhaseKey;
      if (currentState.phase === 'ball_in_hand' && isMyTurn() && dragMode !== 'place') {
        var spot2 = findInitialPlaceSpot(displayBalls, isKitchenPlace(currentState));
        placeX = spot2.x;
        placeY = spot2.y;
      } else if (currentState.phase === 'shoot' && isMyTurn() && dragMode === null) {
        aimAngle = pickDefaultAimAngle(currentState);
        lastAimInitSeq = seq;
      }
    } else if (lastAimInitSeq !== seq && currentState.phase === 'shoot' && isMyTurn() && dragMode === null) {
      aimAngle = pickDefaultAimAngle(currentState);
      lastAimInitSeq = seq;
    }
    updateHUD();
    updateBar();
    maybeShowGroupPopup(currentState);
    var curFs = isFullscreenMode();
    var curSideways = !curFs && window.innerHeight < 540 && window.innerWidth > window.innerHeight;
    var curPortrait = !curFs && !curSideways && window.innerHeight > window.innerWidth;
    var layoutKey = window.innerWidth + 'x' + window.innerHeight + ':' + (containerEl ? containerEl.clientWidth : 0) + ':' + (curFs ? 'fs' : (curSideways ? 's' : (curPortrait ? 'p' : 'l'))) + ':' + (isSnooker ? 'sn' : '8b');
    if (layoutKey !== lastLayoutKey) {
      resizeCanvas();
    } else {
      draw();
    }
  }

  function finishReplay(entry) {
    var shot = (entry && entry.shot) ? entry.shot : entry;
    var entryState = (entry && entry.state) ? entry.state : latestState;
    replaying = false;
    oppAimPreview = null;
    clearStrikeAndPending();
    prevBallPos = {};
    if (reducedTimerId) {
      clearTimeout(reducedTimerId);
      reducedTimerId = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    currentState = shotQueue.length > 0 ? entryState : (latestState || entryState);
    displayBalls = (entryState && Array.isArray(entryState.balls))
      ? entryState.balls
      : ((currentState && Array.isArray(currentState.balls)) ? currentState.balls : []);
    if (shotQueue.length === 0 && currentState) {
      if (currentState.phase === 'ball_in_hand' && isMyTurn() && dragMode !== 'place') {
        var spot = findInitialPlaceSpot(displayBalls, isKitchenPlace(currentState));
        placeX = spot.x;
        placeY = spot.y;
      } else if (currentState.phase === 'shoot' && isMyTurn() && dragMode === null) {
        aimAngle = pickDefaultAimAngle(currentState);
      }
    }
    updateHUD();
    updateBar();
    draw();
    if (pocketEffects.length > 0) {
      startPocketFxLoop();
    }
    maybeShowGroupPopup(entryState || currentState);
    try {
      showShotBanner(shot);
    } catch (_e) {}

    clearPostShotPause();
    postShotPauseTimer = setTimeout(function () {
      postShotPauseTimer = null;
      if (shotQueue.length > 0) {
        drainShotQueue();
      } else if (latestState) {
        syncIdleState();
      }
    }, POST_SHOT_PAUSE_MS);
  }

  function startReducedOppPreview(entry) {
    var state = entry && entry.state;
    var shot = entry && entry.shot;
    var targetAngle = shot && Number.isFinite(shot.angle) ? shot.angle : 0;
    var frames = shot && shot.frames;
    if (!shot || !Array.isArray(frames) || frames.length < 1) {
      finishReplay(entry);
      return;
    }
    var fInit = parseFrame(frames[0]);
    var initialBalls = [];
    for (var id0 = 0; id0 <= MAX_BALL_ID; id0++) {
      if (fInit[id0]) {
        initialBalls.push({
          id: id0,
          x: fInit[id0].x,
          y: fInit[id0].y,
          potted: false,
          type: ballTypeFor(id0),
        });
      }
    }
    displayBalls = initialBalls;
    replaying = true;
    oppAimPreview = {
      reduced: true,
      angle: targetAngle,
      power: clamp(Number(shot.power) || 0.5, 0.05, 1),
      startTime: performance.now(),
    };
    updateBar();
    draw();

    function fadeStep(now) {
      if (!replaying || !oppAimPreview || !oppAimPreview.reduced) {
        rafId = null;
        return;
      }
      draw();
      if (now - oppAimPreview.startTime < 150) {
        rafId = requestAnimationFrame(fadeStep);
      } else {
        rafId = null;
      }
    }
    rafId = requestAnimationFrame(fadeStep);

    if (reducedTimerId) clearTimeout(reducedTimerId);
    reducedTimerId = setTimeout(function () {
      reducedTimerId = null;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      playCueStrike(shot.power);
      var spawnedAny = false;
      if (frames.length >= 2) {
        var parsed = [];
        for (var i = 0; i < frames.length; i++) parsed.push(parseFrame(frames[i]));
        var evs = extractSoundEvents(parsed, shot.fps || 30);
        for (var j = 0; j < evs.length; j++) {
          if (evs[j].type === 'pocket' && evs[j].pocket) {
            if (!spawnedAny) playPocketDrop();
            spawnPocketEffect(evs[j].ballId, evs[j].pocket, performance.now(), !!shot.foul);
            spawnedAny = true;
          }
        }
      }
      if (!spawnedAny && Array.isArray(shot.potted) && shot.potted.length > 0) {
        playPocketDrop();
        for (var k = 0; k < shot.potted.length; k++) {
          var pid = shot.potted[k];
          if (fInit[pid]) {
            spawnPocketEffect(pid, findNearestPocket(fInit[pid].x, fInit[pid].y), performance.now(), !!shot.foul);
          }
        }
      }
      finishReplay(entry);
    }, 520);
  }

  function startReplay(entry) {
    var state = entry && entry.state;
    var shot = entry && entry.shot;
    var prevAngle = entry && entry.prevAngle;
    var frames = shot && shot.frames;
    if (!shot || !Array.isArray(frames) || frames.length < 2) {
      finishReplay(entry);
      return;
    }

    var parsed = [];
    for (var i = 0; i < frames.length; i++) {
      parsed.push(parseFrame(frames[i]));
    }
    if (parsed.length < 2) {
      finishReplay(entry);
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
      else if (ev.type === 'pocket') {
        playPocketDrop();
        if (ev.pocket) {
          spawnPocketEffect(ev.ballId, ev.pocket, performance.now(), !!shot.foul);
        }
      }
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
          finishReplay(entry);
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
          finishReplay(entry);
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
        finishReplay(entry);
      }
    }

    var isOpponent = typeof shot.shooter === 'number' && shot.shooter !== myPlayerIndex;
    if (isOpponent) {
      displayBalls = initialBalls;
      var targetAngle = Number.isFinite(shot.angle) ? shot.angle : 0;
      var targetPower = clamp(Number(shot.power) || 0.5, 0.05, 1);
      var fromAngle = Number.isFinite(prevAngle) ? prevAngle : 0;
      oppAimPreview = {
        reduced: false,
        fromAngle: fromAngle,
        angleDelta: shortestAngleDiff(fromAngle, targetAngle),
        angle: targetAngle,
        power: targetPower,
        startTime: performance.now(),
        rotateDur: 700,
        holdDur: 500,
        pullDur: 250,
        strikeDur: 70,
        duration: 1520,
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

  function playQueuedShot(entry) {
    if (!entry || !entry.shot) return;
    var shot = entry.shot;
    var frames = shot.frames;
    var reduced = isReducedMotion();
    dragMode = null;
    cancelActiveFsInputs();
    if (!entry.isOpponent) {
      aimSpinX = 0;
      aimSpinY = 0;
      syncSpinUI();
    }
    if (reduced) {
      clearStrikeAndPending();
      if (entry.isOpponent && Array.isArray(frames) && frames.length >= 1) {
        try {
          startReducedOppPreview(entry);
        } catch (_errR) {
          finishReplay(entry);
        }
      } else {
        finishReplay(entry);
      }
      return;
    }
    if (!Array.isArray(frames) || frames.length < 2) {
      clearStrikeAndPending();
      finishReplay(entry);
      return;
    }
    try {
      startReplay(entry);
    } catch (_err) {
      finishReplay(entry);
    }
  }

  function drainShotQueue() {
    if (replaying || postShotPauseTimer || myStrikeAnim || shotQueue.length === 0) return;
    var next = shotQueue.shift();
    playQueuedShot(next);
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
    if (!currentState || !isMyTurn() || replaying || shotQueue.length > 0 || currentState.phase !== 'shoot') return false;
    if (isSnooker && currentState.ballOn === 'colour' && !selectedNominate) {
      if (typeof window.showToast === 'function') {
        window.showToast(t('snooker_pick_colour_first'));
      }
      return false;
    }
    clearPostShotPause();
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
    return true;
  }

  function launchFullscreenShot(shotAngle, shotPower) {
    if (!trySendShot()) return;
    awaitingShotSeq = (currentState.lastShot && typeof currentState.lastShot.seq === 'number')
      ? currentState.lastShot.seq : (currentState.shotSeq || 0);
    if (awaitingShotTimer) clearTimeout(awaitingShotTimer);
    awaitingShotTimer = setTimeout(function () {
      awaitingShotSeq = null;
      awaitingShotTimer = null;
      updateFsControlsEnabled();
    }, 2500);

    if (isReducedMotion()) {
      updateFsControlsEnabled();
      draw();
      return;
    }

    if (strikeRafId) {
      cancelAnimationFrame(strikeRafId);
      strikeRafId = null;
    }
    myStrikeAnim = {
      angle: shotAngle,
      fromPower: clamp(shotPower, 0.05, 1.0),
      startTime: performance.now(),
      duration: 90,
    };
    updateFsControlsEnabled();

    function strikeStep(now) {
      if (!myStrikeAnim) {
        strikeRafId = null;
        return;
      }
      var elapsed = now - myStrikeAnim.startTime;
      if (elapsed >= myStrikeAnim.duration) {
        myStrikeAnim = null;
        strikeRafId = null;
        if (shotQueue.length > 0) {
          drainShotQueue();
        } else {
          draw();
        }
        return;
      }
      draw();
      strikeRafId = requestAnimationFrame(strikeStep);
    }

    draw();
    strikeRafId = requestAnimationFrame(strikeStep);
  }

  function syncPlaceConfirmDisabled(kitchenOnly) {
    var invalid = !isValidCuePosLocal(displayBalls, placeX, placeY, kitchenOnly);
    if (confirmPlaceBtnEl) confirmPlaceBtnEl.disabled = invalid;
    if (fsConfirmPlaceBtnEl) fsConfirmPlaceBtnEl.disabled = invalid;
  }

  function submitCuePlacement() {
    if (!currentState || !isMyTurn() || replaying || shotQueue.length > 0 || currentState.phase !== 'ball_in_hand') return;
    if (isValidCuePosLocal(displayBalls, placeX, placeY, isKitchenPlace(currentState))) {
      clearPostShotPause();
      sendMove({ type: 'place', x: round1(placeX), y: round1(placeY) });
    }
  }

  function onPointerDown(e) {
    if (!currentState || !isMyTurn() || replaying || shotQueue.length > 0 || myStrikeAnim || awaitingShotSeq !== null) return;
    var pt = clientToTable(e);

    if (currentState.phase === 'ball_in_hand') {
      var kitchenOnly = isKitchenPlace(currentState);
      var dist = Math.hypot(pt.x - placeX, pt.y - placeY);
      if (dist <= BALL_R * 3.2) {
        placeGrabDx = placeX - pt.x;
        placeGrabDy = placeY - pt.y;
      } else {
        placeGrabDx = 0;
        placeGrabDy = 0;
      }
      var clamped = clampPlacePos(pt.x + placeGrabDx, pt.y + placeGrabDy, kitchenOnly);
      dragMode = 'place';
      placeX = clamped.x;
      placeY = clamped.y;
      syncPlaceConfirmDisabled(kitchenOnly);
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      draw();
      return;
    }

    if (currentState.phase === 'shoot') {
      var cue = findDisplayCue();
      if (!cue) return;
      dragMode = 'aim';
      var distCue = Math.hypot(pt.x - cue.x, pt.y - cue.y);
      if (distCue > 1e-3) {
        aimAngle = Math.atan2(pt.y - cue.y, pt.x - cue.x);
      }
      var curSeq = (currentState.lastShot && typeof currentState.lastShot.seq === 'number')
        ? currentState.lastShot.seq : (currentState.shotSeq || 0);
      lastAimInitSeq = curSeq;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      draw();
    }
  }

  function onPointerMove(e) {
    if (!dragMode || !currentState || !isMyTurn() || replaying || shotQueue.length > 0) return;
    var pt = clientToTable(e);

    if (dragMode === 'place') {
      var kitchenOnly = isKitchenPlace(currentState);
      var clamped = clampPlacePos(pt.x + placeGrabDx, pt.y + placeGrabDy, kitchenOnly);
      placeX = clamped.x;
      placeY = clamped.y;
      syncPlaceConfirmDisabled(kitchenOnly);
      draw();
      return;
    }

    var cue = findDisplayCue();
    if (!cue) return;

    if (dragMode === 'aim') {
      if (Math.hypot(pt.x - cue.x, pt.y - cue.y) > 1e-3) {
        aimAngle = Math.atan2(pt.y - cue.y, pt.x - cue.x);
      }
      draw();
    }
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  function onPointerUp(e) {
    if (!dragMode) return;
    dragMode = null;
    placeGrabDx = 0;
    placeGrabDy = 0;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    draw();
  }

  function buildFsSideHtml(sideKey) {
    var cap = sideKey === 'me' ? 'Me' : 'Opp';
    var dotsHtml = '';
    for (var i = 0; i < 7; i++) {
      dotsHtml +=
        '<span class="pool-fs-bdot is-unknown" data-dot-idx="' + i + '">' +
          '<span class="pool-fs-bdot-fill"></span>' +
          '<span class="pool-fs-bdot-q">?</span>' +
        '</span>';
    }
    dotsHtml += '<span class="pool-fs-eight-dot" id="poolFsEight' + cap + '">8</span>';
    return (
      '<div class="pool-fs-side pool-fs-side--' + sideKey + '" id="poolFsSide' + cap + '">' +
        '<div class="pool-fs-avatar" id="poolFsAvatar' + cap + '"></div>' +
        '<div class="pool-fs-info">' +
          '<div class="pool-fs-name" id="poolFsName' + cap + '"></div>' +
          '<div class="pool-fs-rack" id="poolFsRack' + cap + '">' + dotsHtml + '</div>' +
          '<div class="pool-fs-snooker" id="poolFsSnooker' + cap + '">' +
            '<span class="pool-fs-score" id="poolFsScore' + cap + '">0</span>' +
            '<span class="pool-fs-break" id="poolFsBreak' + cap + '"></span>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function cacheFsSideRefs(sideKey) {
    var cap = sideKey === 'me' ? 'Me' : 'Opp';
    var rack = document.getElementById('poolFsRack' + cap);
    var dotEls = rack ? rack.querySelectorAll('.pool-fs-bdot') : [];
    var dots = [];
    var fills = [];
    for (var i = 0; i < dotEls.length; i++) {
      dots.push(dotEls[i]);
      fills.push(dotEls[i].querySelector('.pool-fs-bdot-fill'));
    }
    return {
      root: document.getElementById('poolFsSide' + cap),
      avatar: document.getElementById('poolFsAvatar' + cap),
      name: document.getElementById('poolFsName' + cap),
      rack: rack,
      dots: dots,
      fills: fills,
      eightDot: document.getElementById('poolFsEight' + cap),
      snooker: document.getElementById('poolFsSnooker' + cap),
      score: document.getElementById('poolFsScore' + cap),
      brk: document.getElementById('poolFsBreak' + cap),
    };
  }

  function cancelAllScoreRolls() {
    var keys = Object.keys(scoreRollRafs);
    for (var i = 0; i < keys.length; i++) {
      cancelAnimationFrame(scoreRollRafs[keys[i]]);
    }
    scoreRollRafs = {};
  }

  function init(container) {
    containerEl = container;
    if (reducedTimerId) {
      clearTimeout(reducedTimerId);
      reducedTimerId = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (pocketFxRafId) {
      cancelAnimationFrame(pocketFxRafId);
      pocketFxRafId = null;
    }
    clearPostShotPause();
    clearStrikeAndPending();
    cancelAllScoreRolls();
    replaying = false;
    oppAimPreview = null;
    lastSeatCueAngle = {};
    pocketEffects = [];
    closeShotBanner(true);
    closeGroupPopup(true);
    prevGroups = null;
    prevSnapshot = null;
    resetBallRoll();
    ensureAudioCtxUnlocked();

    latestState = null;
    shotQueue = [];
    lastQueuedSeq = null;
    lastAimInitSeq = -1;
    lastTurnPhaseKey = '';
    lastLayoutKey = '';
    currentState = null;
    displayBalls = [];
    dragMode = null;
    placeGrabDx = 0;
    placeGrabDy = 0;
    aimPower = 0.58;
    aimSpinX = 0;
    aimSpinY = 0;
    spinDragging = false;
    fsSpinDragging = false;
    lastSpinTapMs = 0;
    lastSpinTapX = 0;
    lastSpinTapY = 0;
    fsSpinMoved = false;
    fsCharging = false;
    fsChargePower = 0;
    fsCuePointerId = null;
    fineDragging = false;
    finePointerId = null;
    fineRulerScrollPx = 0;
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

    var rulerTicksHtml = '';
    for (var rt = 0; rt < 120; rt++) {
      var tickMod = rt % 5 === 0 ? ' pool-fs-rtick--major' : (rt % 5 === 2 ? ' pool-fs-rtick--mid' : '');
      rulerTicksHtml += '<div class="pool-fs-rtick' + tickMod + '"></div>';
    }

    container.innerHTML =
      '<div class="pool-wrap" id="poolWrap">' +
        '<div class="pool-fs-top pool-fs-only" id="poolFsTopBar">' +
          buildFsSideHtml('me') +
          '<div class="pool-fs-mid" id="poolFsMid">' +
            '<div class="pool-fs-turn-pill" id="poolFsTurnPill"></div>' +
            '<div class="pool-fs-snooker-mid" id="poolFsSnookerMid">' +
              '<span class="pool-fs-on-wrap">' +
                '<span class="pool-fs-on-dot" id="poolFsOnDot"></span>' +
                '<span id="poolFsOnText"></span>' +
              '</span>' +
              '<span class="pool-fs-rem-wrap">' +
                '<span id="poolFsRemLbl"></span>' +
                '<span id="poolFsRemVal">0</span>' +
              '</span>' +
              '<span class="pool-fs-snooker-phase" id="poolFsSnookerPhase"></span>' +
            '</div>' +
          '</div>' +
          buildFsSideHtml('opp') +
        '</div>' +
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
          '<div class="pool-fs-left pool-fs-only" id="poolFsLeft">' +
            '<div class="pool-fs-cue-track" id="poolFsCueTrack" role="slider" aria-label="Shot power">' +
              '<div class="pool-fs-cue-fill" id="poolFsCueFill"></div>' +
              '<div class="pool-fs-cue-scale"></div>' +
              '<div class="pool-fs-cue-stick" id="poolFsCueStick">' +
                '<div class="pool-fs-cue-tip"></div>' +
                '<div class="pool-fs-cue-ferrule"></div>' +
                '<div class="pool-fs-cue-shaft"></div>' +
                '<div class="pool-fs-cue-wrap"></div>' +
                '<div class="pool-fs-cue-butt"></div>' +
              '</div>' +
              '<div class="pool-fs-cue-badge" id="poolFsCueBadge"></div>' +
            '</div>' +
          '</div>' +
          '<div class="pool-canvas-wrap">' +
            '<canvas id="poolCanvas" class="pool-canvas"></canvas>' +
          '</div>' +
          '<div class="pool-fs-right pool-fs-only" id="poolFsRight">' +
            '<div class="pool-fs-spin-ball" id="poolFsSpinPad" role="slider" tabindex="0" aria-label="Spin">' +
              '<div class="pool-fs-spin-ring"></div>' +
              '<span class="pool-fs-spin-dot" id="poolFsSpinDot"></span>' +
            '</div>' +
            '<div class="pool-fs-ruler" id="poolFsFineRuler" aria-label="Fine aim">' +
              '<div class="pool-fs-ruler-ticks" id="poolFsRulerTicks">' + rulerTicksHtml + '</div>' +
              '<div class="pool-fs-ruler-marker"></div>' +
              '<div class="pool-fs-ruler-label" id="poolFsRulerLabel"></div>' +
            '</div>' +
            '<div class="pool-fs-place-wrap" id="poolFsPlaceWrap">' +
              '<button type="button" class="pool-fs-confirm-btn" id="poolFsConfirmPlaceBtn"></button>' +
              '<div class="pool-fs-place-hint" id="poolFsPlaceHint"></div>' +
            '</div>' +
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

    fsTopBarEl = document.getElementById('poolFsTopBar');
    fsMidEl = document.getElementById('poolFsMid');
    fsMeEl = document.getElementById('poolFsSideMe');
    fsOppEl = document.getElementById('poolFsSideOpp');
    fsLeftEl = document.getElementById('poolFsLeft');
    fsCueTrackEl = document.getElementById('poolFsCueTrack');
    fsCueFillEl = document.getElementById('poolFsCueFill');
    fsCueStickEl = document.getElementById('poolFsCueStick');
    fsCueBadgeEl = document.getElementById('poolFsCueBadge');
    fsRightEl = document.getElementById('poolFsRight');
    fsSpinPadEl = document.getElementById('poolFsSpinPad');
    fsSpinDotEl = document.getElementById('poolFsSpinDot');
    fsRulerEl = document.getElementById('poolFsFineRuler');
    fsRulerTicksEl = document.getElementById('poolFsRulerTicks');
    fsPlaceWrapEl = document.getElementById('poolFsPlaceWrap');
    fsConfirmPlaceBtnEl = document.getElementById('poolFsConfirmPlaceBtn');
    fsPlaceHintEl = document.getElementById('poolFsPlaceHint');

    fsSideRefs = {
      me: cacheFsSideRefs('me'),
      opp: cacheFsSideRefs('opp'),
    };
    fsMidRefs = {
      turnPill: document.getElementById('poolFsTurnPill'),
      snookerMid: document.getElementById('poolFsSnookerMid'),
      onDot: document.getElementById('poolFsOnDot'),
      onText: document.getElementById('poolFsOnText'),
      remLbl: document.getElementById('poolFsRemLbl'),
      remVal: document.getElementById('poolFsRemVal'),
      snookerPhase: document.getElementById('poolFsSnookerPhase'),
    };

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
          if (!currentState || !isMyTurn() || replaying || shotQueue.length > 0 || currentState.phase !== 'shoot' || currentState.ballOn !== 'colour') return;
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
    fsConfirmPlaceBtnEl.textContent = t('pool_confirm_place');
    fsPlaceHintEl.textContent = t('pool_drag_cue_ball');
    document.getElementById('poolFsRulerLabel').textContent = t('pool_fine_aim');
    syncSpinUI();
    syncFsCueUI();

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

    var fsSpinStartX = 0;
    var fsSpinStartY = 0;
    fsSpinPadEl.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      fsSpinDragging = true;
      fsSpinMoved = false;
      fsSpinStartX = e.clientX;
      fsSpinStartY = e.clientY;
      updateSpinFromElement(e, fsSpinPadEl);
      try { fsSpinPadEl.setPointerCapture(e.pointerId); } catch (_) {}
    });
    fsSpinPadEl.addEventListener('pointermove', function (e) {
      if (!fsSpinDragging) return;
      if (Math.hypot(e.clientX - fsSpinStartX, e.clientY - fsSpinStartY) > 6) {
        fsSpinMoved = true;
      }
      updateSpinFromElement(e, fsSpinPadEl);
    });
    function endFsSpinDrag(e) {
      if (!fsSpinDragging) return;
      fsSpinDragging = false;
      try { fsSpinPadEl.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!fsSpinMoved && e.type === 'pointerup') {
        var nowMs = performance.now();
        if (nowMs - lastSpinTapMs < 320 && Math.hypot(e.clientX - lastSpinTapX, e.clientY - lastSpinTapY) < 18) {
          aimSpinX = 0;
          aimSpinY = 0;
          syncSpinUI();
          lastSpinTapMs = 0;
          return;
        }
        lastSpinTapMs = nowMs;
        lastSpinTapX = e.clientX;
        lastSpinTapY = e.clientY;
      }
    }
    fsSpinPadEl.addEventListener('pointerup', endFsSpinDrag);
    fsSpinPadEl.addEventListener('pointercancel', endFsSpinDrag);
    fsSpinPadEl.addEventListener('dblclick', function (e) {
      e.preventDefault();
      aimSpinX = 0;
      aimSpinY = 0;
      syncSpinUI();
    });

    fsCueTrackEl.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (!isFullscreenMode() || !currentState || !isMyTurn() || replaying || shotQueue.length > 0 || myStrikeAnim || awaitingShotSeq !== null) return;
      if (currentState.phase !== 'shoot') return;
      if (isSnooker && currentState.ballOn === 'colour' && !selectedNominate) {
        if (typeof window.showToast === 'function') {
          window.showToast(t('snooker_pick_colour_first'));
        }
        return;
      }
      var rect = fsCueTrackEl.getBoundingClientRect();
      fsCharging = true;
      fsCuePointerId = e.pointerId;
      fsCueStartY = e.clientY;
      fsCueMaxDrag = Math.max(70, (rect.height || 180) * 0.68);
      fsChargePower = 0;
      try { fsCueTrackEl.setPointerCapture(e.pointerId); } catch (_) {}
      syncFsCueUI();
      draw();
    });
    fsCueTrackEl.addEventListener('pointermove', function (e) {
      if (!fsCharging || e.pointerId !== fsCuePointerId) return;
      var dy = e.clientY - fsCueStartY;
      var raw = clamp(dy / fsCueMaxDrag, 0, 1);
      fsChargePower = raw < 0.05 ? 0 : raw;
      syncFsCueUI();
      draw();
    });
    function endFsCueDrag(e) {
      if (!fsCharging || e.pointerId !== fsCuePointerId) return;
      var pwr = fsChargePower;
      fsCharging = false;
      fsCuePointerId = null;
      fsChargePower = 0;
      try { fsCueTrackEl.releasePointerCapture(e.pointerId); } catch (_) {}
      syncFsCueUI();
      if (e.type === 'pointerup' && pwr >= 0.05) {
        aimPower = clamp(pwr, 0.05, 1.0);
        syncPowerUI();
        launchFullscreenShot(aimAngle, aimPower);
      } else {
        draw();
      }
    }
    fsCueTrackEl.addEventListener('pointerup', endFsCueDrag);
    fsCueTrackEl.addEventListener('pointercancel', endFsCueDrag);

    fsRulerEl.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (!isFullscreenMode() || !currentState || !isMyTurn() || replaying || shotQueue.length > 0 || myStrikeAnim || awaitingShotSeq !== null) return;
      if (currentState.phase !== 'shoot') return;
      fineDragging = true;
      finePointerId = e.pointerId;
      fineLastY = e.clientY;
      var curSeq = (currentState.lastShot && typeof currentState.lastShot.seq === 'number')
        ? currentState.lastShot.seq : (currentState.shotSeq || 0);
      lastAimInitSeq = curSeq;
      try { fsRulerEl.setPointerCapture(e.pointerId); } catch (_) {}
    });
    fsRulerEl.addEventListener('pointermove', function (e) {
      if (!fineDragging || e.pointerId !== finePointerId) return;
      if (!currentState || !isMyTurn() || replaying || shotQueue.length > 0 || currentState.phase !== 'shoot') return;
      var dy = e.clientY - fineLastY;
      fineLastY = e.clientY;
      aimAngle += dy * 0.0018;
      fineRulerScrollPx += dy;
      if (fsRulerTicksEl) {
        var modOffset = ((fineRulerScrollPx % 40) + 40) % 40;
        fsRulerTicksEl.style.transform = 'translateY(' + modOffset + 'px)';
      }
      draw();
    });
    function endFineDrag(e) {
      if (!fineDragging || e.pointerId !== finePointerId) return;
      fineDragging = false;
      finePointerId = null;
      try { fsRulerEl.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    fsRulerEl.addEventListener('pointerup', endFineDrag);
    fsRulerEl.addEventListener('pointercancel', endFineDrag);

    shootBtnEl.addEventListener('click', function () {
      trySendShot();
    });

    confirmPlaceBtnEl.addEventListener('click', submitCuePlacement);
    fsConfirmPlaceBtnEl.addEventListener('click', submitCuePlacement);

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
    if (window._poolFsHandler) {
      window.removeEventListener('gn:fullscreen', window._poolFsHandler);
    }
    window._poolResizeHandler = resizeCanvas;
    window._poolOrientHandler = function () { setTimeout(resizeCanvas, 80); };
    window._poolFsHandler = function () {
      cancelActiveFsInputs();
      lastLayoutKey = '';
      updateHUD();
      updateBar();
      resizeCanvas();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(resizeCanvas);
      }
    };
    window.addEventListener('resize', window._poolResizeHandler);
    window.addEventListener('orientationchange', window._poolOrientHandler);
    window.addEventListener('gn:fullscreen', window._poolFsHandler);

    resizeCanvas();
  }

  function render(state, container, playerIndex, _winner) {
    if (!state || !Array.isArray(state.balls)) return;
    if (!canvas || !containerEl) init(container);

    applyVariantConfig(state);
    myPlayerIndex = typeof playerIndex === 'number' ? playerIndex : 0;
    latestState = state;

    var seq = (state.lastShot && typeof state.lastShot.seq === 'number') ? state.lastShot.seq : (state.shotSeq || 0);
    var turnPhaseKey = state.currentPlayer + ':' + state.phase + ':' + seq + ':' + (state.ballOn || '');
    if (seq !== lastNomSeq || !isSnooker || state.ballOn !== 'colour' || state.currentPlayer !== myPlayerIndex) {
      selectedNominate = null;
      lastNomSeq = seq;
    }

    var curFs = isFullscreenMode();
    var curSideways = !curFs && window.innerHeight < 540 && window.innerWidth > window.innerHeight;
    var curPortrait = !curFs && !curSideways && window.innerHeight > window.innerWidth;
    var layoutKey = window.innerWidth + 'x' + window.innerHeight + ':' + (containerEl ? containerEl.clientWidth : 0) + ':' + (curFs ? 'fs' : (curSideways ? 's' : (curPortrait ? 'p' : 'l'))) + ':' + (isSnooker ? 'sn' : '8b');

    if (lastQueuedSeq === null) {
      currentState = state;
      lastQueuedSeq = seq;
      lastAimInitSeq = seq;
      lastTurnPhaseKey = turnPhaseKey;
      prevGroups = Array.isArray(state.groups) ? [state.groups[0], state.groups[1]] : [null, null];
      if (state.lastShot && typeof state.lastShot.shooter === 'number' && Number.isFinite(state.lastShot.angle)) {
        lastSeatCueAngle[state.lastShot.shooter] = state.lastShot.angle;
      }
      displayBalls = state.balls;
      if (state.phase === 'ball_in_hand' && isMyTurn() && dragMode !== 'place') {
        var initSpot = findInitialPlaceSpot(displayBalls, isKitchenPlace(state));
        placeX = initSpot.x;
        placeY = initSpot.y;
      } else if (state.phase === 'shoot' && isMyTurn() && dragMode === null) {
        aimAngle = pickDefaultAimAngle(state);
      }
      updateHUD();
      updateBar();
      resizeCanvas();
      return;
    }

    if (state.lastShot && typeof state.lastShot.seq === 'number' && state.lastShot.seq > lastQueuedSeq) {
      var shot = state.lastShot;
      lastQueuedSeq = shot.seq;
      awaitingShotSeq = null;
      if (awaitingShotTimer) {
        clearTimeout(awaitingShotTimer);
        awaitingShotTimer = null;
      }

      var shooter = typeof shot.shooter === 'number' ? shot.shooter : -1;
      var targetAngle = Number.isFinite(shot.angle) ? shot.angle : 0;
      var prevAngle = (shooter >= 0 && lastSeatCueAngle[shooter] !== undefined) ? lastSeatCueAngle[shooter] : 0;
      if (shooter >= 0) {
        lastSeatCueAngle[shooter] = targetAngle;
      }
      var isOpponent = shooter >= 0 && shooter !== myPlayerIndex;

      shotQueue.push({
        state: state,
        shot: shot,
        seq: shot.seq,
        prevAngle: prevAngle,
        isOpponent: isOpponent,
      });

      if (!replaying && !postShotPauseTimer && !myStrikeAnim) {
        currentState = state;
        if (layoutKey !== lastLayoutKey) {
          resizeCanvas();
        }
      }
      drainShotQueue();
      return;
    }

    // Same seq (e.g. ball_in_hand -> shoot transition after cue placement, or reset)
    if (seq < lastQueuedSeq) {
      currentState = state;
      lastQueuedSeq = seq;
      shotQueue = [];
      clearPostShotPause();
      closeShotBanner(true);
      pocketEffects = [];
      if (pocketFxRafId) {
        cancelAnimationFrame(pocketFxRafId);
        pocketFxRafId = null;
      }
      if (reducedTimerId) {
        clearTimeout(reducedTimerId);
        reducedTimerId = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      clearStrikeAndPending();
      cancelActiveFsInputs();
      cancelAllScoreRolls();
      replaying = false;
      oppAimPreview = null;
      lastSeatCueAngle = {};
      closeGroupPopup(true);
      prevGroups = [null, null];
      prevSnapshot = null;
      resetBallRoll();
      aimSpinX = 0;
      aimSpinY = 0;
      syncSpinUI();
    }

    if (!replaying && !postShotPauseTimer && shotQueue.length === 0 && !myStrikeAnim) {
      syncIdleState();
    }
  }

  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('pool', { init: init, render: render });
})();
