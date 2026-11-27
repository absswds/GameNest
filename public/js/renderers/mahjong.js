// public/js/renderers/mahjong.js
// Mahjong (四川 / 广东 unified) — Canvas renderer.
// 环形桌布局：自己的手牌在底部（大、可点），对手手牌(牌背)环绕上/左/右，
// 各家牌河集中在中央。番子(广东音牌)用大字绘制。
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  // 字牌（广东）显示名：feng=风牌 东南西北, jian=箭牌 中发白
  var HONOUR = { 'feng': ['', '东', '南', '西', '北'], 'jian': ['', '中', '发', '白'] };
  var SUIT_GLYPH = { wan: '万', tong: '筒', tiao: '条' };
  var SUIT_COLOR = {
    wan: '#c0392b', tong: '#2c3e50', tiao: '#1e8449',
    feng: '#2c3e50', jian: '#8e44ad',
  };

  var canvas, ctx, W, H, TW, TH, DPR;
  var _portrait = false;    // 手机竖屏：手牌两行占底部，桌面只用上面那块
  var VH = 0;               // 桌面区高度（对手、弃牌、椭圆在这块里居中）；非竖屏 = H
  var _playerIndex = 0;
  var _hoverIdx = -1;       // hovered own-hand tile index
  var _layout = [];         // hit-test rects for own hand
  var _state = null;
var _resizeBound = false;  // 渲染器是单例，init 会跨局重复调用，resize 只能挂一次
  var _lastDiscardPulse = 0; // 弃牌落点脉冲相位(0..1)
  var _lastDiscardId = null; // 上次弃牌 id（检测变化触发脉冲）
  var _lastDrawnId = null;   // 上次新摸牌 id
  var _drawPulse = 0;        // 新摸牌脉冲(0..1) 青蓝高亮
  var _animTimer = null;     // 动画循环句柄
  var _claimEffects = [];    // 碰杠吃胡动画效果 [{ player, type, label, birth }]
  var _shownWinners = new Set(); // 已触发过胡牌动画的玩家（避免血战到底反复弹出）
  var _swapSelected = [];         // 换三张：当前玩家已选中的牌 id
  var _prevPhase = null;          // 上一帧 phase（用于检测进入 swap 阶段时清空选择）
  var _prevMeldCounts = []; // 每家上一帧的明牌数（检测新增）
  var _autoPassKey = null;   // 已排过自动过的 claim 时机（弃牌 id + 响应位）
  var _prevHandSize = 0;     // 上一帧自己手牌数（手机端动态调 canvas 高度）
  var _activePanel = null;        // 全屏右侧浮层：null | 'tenpai' | 'log'
  var _discardHistory = [];       // 本局出牌顺序记录 [{ id, tile, player, seq }]
  var _lastRoundMarker = null;    // 局次标识，跨局清空记录与鬼牌提示
  var _wildcardTimer = null;      // 鬼牌开局提示定时器
  var _wildcardCardVisible = false;
  var _wildcardShownKey = null;
  var _countdownTimer = null;     // 全屏罗盘倒计时刷新定时器
  var _fsMetrics = null;          // 全屏布局几何缓存
  var _fsTableCache = null;       // { key, canvas } static trapezoid table + rim cache
  var _scoreFloats = [];          // [{ seat, delta, text, birth, duration }]
  var _scoreFloatRoundKey = null; // ensures floating score changes trigger once per round
  var _autoDiscard = false;       // client-side 自动摸打 toggle
  var _autoDiscardTimer = null;
  var _autoDiscardKey = null;

  // ---- 传统牌面 SVG 资源预加载 + 离屏缓存 + 动画状态 ----
  var TILE_SVG_MAP = {
    'wan:1': 'Man1.svg', 'wan:2': 'Man2.svg', 'wan:3': 'Man3.svg',
    'wan:4': 'Man4.svg', 'wan:5': 'Man5.svg', 'wan:6': 'Man6.svg',
    'wan:7': 'Man7.svg', 'wan:8': 'Man8.svg', 'wan:9': 'Man9.svg',
    'tong:1': 'Pin1.svg', 'tong:2': 'Pin2.svg', 'tong:3': 'Pin3.svg',
    'tong:4': 'Pin4.svg', 'tong:5': 'Pin5.svg', 'tong:6': 'Pin6.svg',
    'tong:7': 'Pin7.svg', 'tong:8': 'Pin8.svg', 'tong:9': 'Pin9.svg',
    'tiao:1': 'Sou1.svg', 'tiao:2': 'Sou2.svg', 'tiao:3': 'Sou3.svg',
    'tiao:4': 'Sou4.svg', 'tiao:5': 'Sou5.svg', 'tiao:6': 'Sou6.svg',
    'tiao:7': 'Sou7.svg', 'tiao:8': 'Sou8.svg', 'tiao:9': 'Sou9.svg',
    'feng:1': 'Ton.svg', 'feng:2': 'Nan.svg', 'feng:3': 'Shaa.svg', 'feng:4': 'Pei.svg',
    'jian:1': 'Chun.svg', 'jian:2': 'Hatsu.svg', 'jian:3': 'Haku.svg'
  };
  var _tileImgs = {};
  var _tileImgState = {}; // 'loading' | 'ready' | 'error'
  var _tilePreloadStarted = false;
  var _artRedrawPending = false;

  var _tileCache = new Map();
  var MAX_TILE_CACHE = 150;
  var _lastCacheW = 0;
  var _lastCacheH = 0;
  var _lastCacheDPR = 0;

  var _prevSnapshot = null;
  var _discardFly = null;       // { tile, tileId, fromSeat, fromRect, target, start, duration }
  var _discardFlyMatched = false;
  var _drawSlide = null;        // { tileId, start, duration }
  var _lastHandTileRects = {};  // tileId -> { x, y, w, h }

  function tileArtKey(tile) {
    if (!tile || tile.k === undefined || tile.n === undefined) return '';
    return tile.k + ':' + tile.n;
  }

  function clearTileCache() {
    _tileCache.clear();
  }

  function putTileCache(key, entry) {
    if (_tileCache.size >= MAX_TILE_CACHE) {
      var deleted = 0;
      _tileCache.forEach(function(_v, k) {
        if (deleted < 80) {
          _tileCache.delete(k);
          deleted++;
        }
      });
    }
    _tileCache.set(key, entry);
  }

  function scheduleArtRedraw() {
    if (_artRedrawPending) return;
    _artRedrawPending = true;
    var raf = window.requestAnimationFrame || function(fn) { return setTimeout(fn, 16); };
    raf(function() {
      _artRedrawPending = false;
      if (canvas && canvas.isConnected && _state) draw();
    });
  }

  function preloadTileArt() {
    if (_tilePreloadStarted) return;
    _tilePreloadStarted = true;
    for (var key in TILE_SVG_MAP) {
      if (!Object.prototype.hasOwnProperty.call(TILE_SVG_MAP, key)) continue;
      (function(k, file) {
        _tileImgState[k] = 'loading';
        var img = new Image();
        img.onload = function() {
          _tileImgState[k] = 'ready';
          clearTileCache();
          scheduleArtRedraw();
        };
        img.onerror = function() {
          _tileImgState[k] = 'error';
        };
        img.src = '/assets/mahjong-tiles/' + file;
        _tileImgs[k] = img;
      })(key, TILE_SVG_MAP[key]);
    }
  }

  function getTileArtImg(tile) {
    var key = tileArtKey(tile);
    if (!key || _tileImgState[key] !== 'ready') return null;
    var img = _tileImgs[key];
    return (img && img.complete && img.naturalWidth > 0) ? img : null;
  }

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  // Exact cubic-bezier(x1, y1, x2, y2) solver for 0 <= t <= 1
  function cubicBezier(x1, y1, x2, y2, t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var cx = 3 * x1;
    var bx = 3 * (x2 - x1) - cx;
    var ax = 1 - cx - bx;
    var cy = 3 * y1;
    var by = 3 * (y2 - y1) - cy;
    var ay = 1 - cy - by;
    var u = t;
    for (var i = 0; i < 5; i++) {
      var xErr = ((ax * u + bx) * u + cx) * u - t;
      if (Math.abs(xErr) < 1e-4) break;
      var dx = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(dx) < 1e-6) break;
      u -= xErr / dx;
      if (u < 0) u = 0;
      else if (u > 1) u = 1;
    }
    var lo = 0, hi = 1;
    var xCur = ((ax * u + bx) * u + cx) * u;
    if (Math.abs(xCur - t) > 1e-3) {
      u = t;
      for (var j = 0; j < 10; j++) {
        xCur = ((ax * u + bx) * u + cx) * u;
        if (Math.abs(xCur - t) < 1e-4) break;
        if (t > xCur) lo = u;
        else hi = u;
        u = (lo + hi) * 0.5;
      }
    }
    return ((ay * u + by) * u + cy) * u;
  }

  function easeOutDiscard(t) {
    return cubicBezier(0.23, 1, 0.32, 1, t);
  }

  // Pop easing with mild overshoot (<= 1.15)
  function easeOutPop(t) {
    var s = 1.70158;
    var u = clamp(t, 0, 1) - 1;
    return 1 + (s + 1) * u * u * u + s * u * u;
  }

  function buildStateSnapshot(state) {
    var snap = {
      roundNumber: state ? (state.roundNumber || 1) : 1,
      phase: state ? state.phase : null,
      currentPlayer: state ? state.currentPlayer : -1,
      drawn: state ? state.drawn : null,
      lastDiscardId: (state && state.lastDiscard) ? state.lastDiscard.id : null,
      discardIds: {},
      totalDiscards: 0,
      meldCounts: [],
      totalMelds: 0,
      winners: winnersOf(state).slice(),
      cumulativeScore: Array.isArray(state && state.cumulativeScore) ? state.cumulativeScore.slice() : null
    };
    if (state && state.discards) {
      for (var s = 0; s < state.discards.length; s++) {
        var pile = state.discards[s] || [];
        snap.totalDiscards += pile.length;
        for (var j = 0; j < pile.length; j++) {
          if (pile[j] && pile[j].id) snap.discardIds[pile[j].id] = s;
        }
      }
    }
    if (state && state.melds) {
      for (var m = 0; m < state.melds.length; m++) {
        var mc = state.melds[m] ? state.melds[m].length : 0;
        snap.meldCounts.push(mc);
        snap.totalMelds += mc;
      }
    }
    return snap;
  }

  // 是否广东（带番子）：四川 playerView 总带 cfg，广东不带
  function isCantonese() { return _state && _state.cfg === undefined; }
  // 赢家列表：四川下发 winners 数组，广东只下发 winner 单值（-1 = 荒庄）
  function winnersOf(s) {
    if (!s) return [];
    if (s.winners) return s.winners;
    return (typeof s.winner === 'number' && s.winner >= 0) ? [s.winner] : [];
  }
  function isFs() {
    return !!(document.body && document.body.classList.contains('gn-fs'));
  }

  // i18n helper (mirrors other renderers: _t(key) with hardcoded fallback).
  function t(key, fallback) {
    var v = window._t ? window._t(key) : key;
    return v === key ? fallback : v;
  }

  function tf(key, fallback, arg) {
    return String(t(key, fallback)).replace('%s', arg === undefined || arg === null ? '' : String(arg));
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function getSeatPlayer(idx) {
    if (!window.gamePlayers) return null;
    for (var i = 0; i < window.gamePlayers.length; i++) {
      var p = window.gamePlayers[i];
      if (p && p.index === idx) return p;
    }
    return window.gamePlayers[idx] || null;
  }

  function getSeatName(idx) {
    var p = getSeatPlayer(idx);
    if (p && p.name) return p.name;
    return t('mj_player', '玩家') + (idx + 1);
  }

  function getSeatAvatar(idx) {
    var p = getSeatPlayer(idx);
    if (p && p.avatar) return { text: String(p.avatar), isEmoji: true };
    if (p && p.isBot) return { text: '🤖', isEmoji: true };
    var nm = String(getSeatName(idx) || '').trim();
    return { text: nm ? nm.charAt(0).toUpperCase() : String(idx + 1), isEmoji: false };
  }

  function getDealerIndex() {
    if (!_state) return 0;
    if (typeof _state.dealerIndex === 'number') return _state.dealerIndex;
    if (typeof _state.dealer === 'number') return _state.dealer;
    return 0;
  }

  function getActiveActor() {
    if (!_state || _state.phase === 'over') return -1;
    if (_state.phase === 'claim' && _state.claim && Array.isArray(_state.claim.order)) {
      var act = _state.claim.order[_state.claim.idx];
      if (typeof act === 'number') return act;
    }
    return typeof _state.currentPlayer === 'number' ? _state.currentPlayer : -1;
  }

  function getWallCount() {
    if (!_state) return null;
    if (typeof _state.deckCount === 'number') return _state.deckCount;
    if (Array.isArray(_state.deck)) return _state.deck.length;
    if (typeof _state.wall === 'number') return _state.wall;
    return null;
  }

  function getTurnSecondsLeft() {
    if (!_state || _state.phase === 'over') return null;
    var dl = _state.turnDeadline || _state.deadline || _state.turnEndsAt || _state.actionDeadline;
    if (typeof dl === 'number' && isFinite(dl)) {
      var ms = dl > 1e12 ? (dl - Date.now()) : dl * 1000;
      return Math.max(0, Math.ceil(ms / 1000));
    }
    if (typeof _state.turnTimeLeft === 'number' && isFinite(_state.turnTimeLeft)) {
      return Math.max(0, Math.ceil(_state.turnTimeLeft));
    }
    return null;
  }

  function getWildcardTile(s) {
    if (!s) return null;
    if (s.wildcardTile && s.wildcardTile.k) return s.wildcardTile;
    if (s.wildcard && s.wildcard.k) return s.wildcard;
    if (s._wildcard) return { k: 'jian', n: 1 };
    return null;
  }

  function isWildcardTile(tile) {
    if (!tile || tile.k === undefined) return false;
    var w = getWildcardTile(_state);
    return !!(w && tile.k === w.k && tile.n === w.n);
  }

  function miniTileHtml(tile, extraClass) {
    if (!tile || tile.k === undefined) return '';
    var col = SUIT_COLOR[tile.k] || '#2c3e50';
    var isHonour = tile.k === 'feng' || tile.k === 'jian';
    var cls = 'mj-mini-tile' + (extraClass ? ' ' + extraClass : '');
    if (isHonour) {
      var nm = (HONOUR[tile.k] && HONOUR[tile.k][tile.n]) || '';
      var dot = (tile.k === 'jian' && (tile.n === 1 || tile.n === 2)) ? '<i class="mj-mini-dot"></i>' : '';
      return '<span class="' + cls + ' honour" style="color:' + col + '">' + dot + '<b>' + escapeHtml(nm) + '</b></span>';
    }
    return '<span class="' + cls + '" style="color:' + col + '"><b>' + escapeHtml(String(tile.n)) + '</b><small>' + escapeHtml(SUIT_GLYPH[tile.k] || '') + '</small></span>';
  }

  var STYLES = '' +
    '.mj-wrap{display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;height:100%;flex:1;min-height:0;overflow:hidden;}' +
    '.mj-board-mobile{overflow-y:auto;-webkit-overflow-scrolling:touch;}' +
    '.mj-status{text-align:center;font-size:13px;font-weight:700;min-height:18px;color:var(--text-muted);letter-spacing:.3px;padding:0 8px;}' +
    '.mj-bar{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center;min-height:50px;padding:4px 0;}' +
    '.mj-btn{border:0;border-radius:16px;padding:12px 22px;font-size:15px;font-weight:800;cursor:pointer;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.15);transition:transform .12s,box-shadow .12s;letter-spacing:1px;position:relative;}' +
    '.mj-btn:active{transform:scale(.93);box-shadow:0 2px 6px rgba(0,0,0,.3);}' +
    '.mj-btn.pung{background:linear-gradient(135deg,#3a8fd4,#1e5fa0);}' +
    '.mj-btn.kong{background:linear-gradient(135deg,#9b6dde,#6a3fb5);}' +
    '.mj-btn.win{background:linear-gradient(135deg,#e05050,#b02020);box-shadow:0 4px 18px rgba(224,60,60,.4),inset 0 1px 0 rgba(255,255,255,.2);}' +
    '.mj-btn.chow{background:linear-gradient(135deg,#3eb870,#1f8c4f);}' +
    '.mj-btn.pass{background:linear-gradient(135deg,#777,#444);}' +
    '.mj-btn.void-suit{border:1px solid var(--border);background:var(--surface);color:var(--text);font-weight:700;padding:10px 18px;box-shadow:0 2px 8px rgba(0,0,0,.08);}' +
    '.mj-btn.void-suit .g{font-size:18px;margin-right:4px;}' +
    '.mj-fs-only{display:none;}' +
    '@media(max-width:500px){' +
      '.mj-btn{padding:11px 18px;font-size:15px;}' +
      '.mj-status{font-size:12px;}' +
    '}' +
    'body.gn-fs .mj-wrap{position:relative;display:block;width:100%;height:100%;background:#14281d;overflow:hidden;}' +
    'body.gn-fs .mj-board{position:relative;width:100%!important;height:100%;overflow:hidden!important;}' +
    'body.gn-fs .mj-status{position:absolute;left:50%;transform:translateX(-50%);bottom:var(--mj-status-bottom,86px);z-index:12;min-height:0;padding:4px 14px;border-radius:999px;background:rgba(10,24,17,.84);border:1px solid rgba(255,255,255,.16);color:rgba(255,255,255,.94);font-size:12px;font-weight:700;line-height:1.35;pointer-events:none;max-width:min(280px,46vw);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 12px rgba(0,0,0,.32);}' +
    'body.gn-fs .mj-status.mj-status-mine{border-color:rgba(200,164,92,.8);color:#ffe49c;background:rgba(16,38,26,.9);}' +
    'body.gn-fs .mj-status:empty{display:none;}' +
    'body.gn-fs .mj-bar{position:absolute;right:14px;bottom:var(--mj-actions-bottom,86px);z-index:16;display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:flex-end;align-items:center;gap:8px;min-height:0;height:auto;padding:0;background:transparent;border:0;max-width:calc(100% - 144px);overflow:visible;}' +
    'body.gn-fs .mj-bar:empty{display:none;}' +
    'body.gn-fs .mj-bar .mj-btn{padding:10px 20px;font-size:15px;border-radius:999px;white-space:nowrap;text-align:center;min-height:44px;min-width:44px;box-shadow:0 6px 18px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.2);}' +
    '@media(max-height:430px){body.gn-fs .mj-bar{gap:6px;}body.gn-fs .mj-bar .mj-btn{padding:8px 16px;font-size:14px;min-height:44px;min-width:44px;}}' +
    'body.gn-fs .mj-fs-win-panel{position:absolute;right:calc(env(safe-area-inset-right,0px) + 14px);bottom:var(--mj-actions-bottom,86px);z-index:18;display:flex;align-items:center;gap:10px;padding:6px 8px 6px 10px;border-radius:16px;background:rgba(12,30,21,.92);border:1.5px solid rgba(245,196,81,.72);box-shadow:0 8px 24px rgba(0,0,0,.48),0 0 18px rgba(224,80,80,.22);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);max-width:min(320px,58vw);}' +
    '.mj-win-tiles{display:flex;align-items:center;gap:5px;overflow-x:auto;max-width:210px;scrollbar-width:none;}' +
    '.mj-win-tiles::-webkit-scrollbar{display:none;}' +
    '.mj-win-chip{display:flex;flex-direction:column;align-items:center;gap:2px;padding:3px 4px;border-radius:7px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);flex-shrink:0;}' +
    '.mj-win-chip.hot{border-color:rgba(245,196,81,.85);background:rgba(245,196,81,.16);}' +
    '.mj-win-chip.zero{opacity:.45;}' +
    '.mj-win-chip span.cnt{font-size:10px;font-weight:700;color:#ffe49c;line-height:1;white-space:nowrap;}' +
    '.mj-win-big{min-width:58px;min-height:48px;padding:8px 18px!important;font-size:20px!important;font-weight:900!important;border-radius:12px!important;letter-spacing:1px;flex-shrink:0;}' +
    '@media(max-height:430px){body.gn-fs .mj-fs-win-panel{padding:5px 6px 5px 8px;gap:8px;}.mj-win-big{min-width:52px;min-height:44px;padding:6px 14px!important;font-size:18px!important;}}' +
    'body.gn-fs .mj-fs-wild-badge{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);left:calc(env(safe-area-inset-left,0px) + 64px);z-index:18;display:flex;align-items:center;gap:6px;padding:4px 10px 4px 6px;border-radius:12px;background:rgba(10,24,17,.8);border:1px solid rgba(200,164,92,.5);color:#ffe49c;font-size:12px;font-weight:700;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.3);}' +
    '@keyframes mjWildPop{from{opacity:0;transform:translate(-50%,-50%) scale(.9);}to{opacity:1;transform:translate(-50%,-50%) scale(1);}}' +
    'body.gn-fs .mj-fs-wild-card{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:30;padding:16px 26px;border-radius:18px;background:rgba(14,32,22,.95);border:2px solid rgba(200,164,92,.8);box-shadow:0 18px 44px rgba(0,0,0,.58);display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;color:#ffe49c;font-size:16px;font-weight:800;letter-spacing:.5px;animation:mjWildPop .24s ease-out;}' +
    'body.gn-fs .mj-fs-wild-card .mj-mini-tile{width:46px;height:64px;border-radius:8px;}' +
    'body.gn-fs .mj-fs-wild-card .mj-mini-tile.honour b{font-size:28px;}' +
    'body.gn-fs .mj-fs-wild-card .mj-mini-tile b{font-size:24px;}' +
    'body.gn-fs .mj-fs-wild-card .mj-mini-tile small{font-size:14px;}' +
    'body.gn-fs .mj-fs-tools{position:absolute;right:calc(env(safe-area-inset-right,0px) + 10px);top:calc(env(safe-area-inset-top,0px) + 12px);z-index:20;display:flex;flex-direction:column;align-items:center;gap:10px;}' +
    'body.gn-fs .mj-tool-item{display:flex;flex-direction:column;align-items:center;gap:3px;}' +
    'body.gn-fs .mj-tool-btn{position:relative;width:48px;height:48px;border-radius:50%;border:1.5px solid rgba(255,255,255,.22);background:rgba(12,28,20,.8);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);-webkit-tap-highlight-color:transparent;transition:transform .12s,border-color .15s,background .15s;}' +
    'body.gn-fs .mj-tool-btn:active{transform:scale(.93);}' +
    'body.gn-fs .mj-tool-btn.active{border-color:#c8a45c;background:rgba(48,38,14,.88);color:#ffe49c;}' +
    'body.gn-fs .mj-tool-btn.has-ready::after{content:"";position:absolute;top:5px;right:6px;width:9px;height:9px;border-radius:50%;background:#51cf66;border:1.5px solid #14281d;}' +
    'body.gn-fs .mj-tool-btn svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}' +
    'body.gn-fs .mj-tool-label{font-size:11px;font-weight:700;color:rgba(255,255,255,.92);text-shadow:0 1px 3px rgba(0,0,0,.75);line-height:1.1;pointer-events:none;}' +
    '@media(max-height:430px){body.gn-fs .mj-fs-tools{top:calc(env(safe-area-inset-top,0px) + 8px);gap:6px;}body.gn-fs .mj-tool-btn{width:44px;height:44px;}body.gn-fs .mj-tool-label{font-size:10px;}}' +
    'body.gn-fs .mj-fs-panel{position:absolute;right:calc(env(safe-area-inset-right,0px) + 70px);top:calc(env(safe-area-inset-top,0px) + 12px);z-index:25;width:min(276px,46vw);max-height:calc(100% - 104px);display:flex;flex-direction:column;border-radius:14px;background:rgba(12,28,20,.95);border:1.5px solid rgba(200,164,92,.48);box-shadow:0 12px 32px rgba(0,0,0,.55);color:#fff;overflow:hidden;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}' +
    '.mj-fs-panel-hd{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1);font-size:13px;font-weight:800;color:#ffe49c;}' +
    '.mj-fs-panel-close{width:44px;height:44px;margin:-9px -10px -9px 0;border:0;border-radius:50%;background:transparent;color:#fff;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}' +
    '.mj-fs-panel-bd{overflow-y:auto;overscroll-behavior:contain;padding:8px 10px 10px;font-size:12px;}' +
    '.mj-mini-tile{position:relative;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:24px;height:33px;border-radius:4px;background:linear-gradient(180deg,#fdfbf0 0%,#efe6c8 100%);border:1px solid rgba(0,0,0,.22);box-shadow:0 1px 2px rgba(0,0,0,.28);font-family:"Ma Shan Zheng","LXGW WenKai","KaiTi","Microsoft YaHei",serif;line-height:1;flex-shrink:0;}' +
    '.mj-mini-tile b{font-size:13px;font-weight:800;display:block;}' +
    '.mj-mini-tile small{font-size:9px;font-weight:700;display:block;margin-top:1px;}' +
    '.mj-mini-tile.honour b{font-size:15px;}' +
    '.mj-mini-dot{position:absolute;top:2px;right:2px;width:3.5px;height:3.5px;border-radius:50%;background:rgba(192,48,48,.8);}' +
    '.mj-tenpai-empty,.mj-log-empty{padding:16px 8px;text-align:center;color:rgba(255,255,255,.68);font-size:13px;font-weight:600;}' +
    '.mj-tenpai-sub{font-size:11px;color:rgba(255,255,255,.72);margin-bottom:8px;font-weight:600;}' +
    '.mj-tenpai-grid{display:flex;flex-wrap:wrap;gap:6px;}' +
    '.mj-tenpai-chip{display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 6px;border-radius:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);}' +
    '.mj-tenpai-chip.zero{opacity:.42;}' +
    '.mj-tenpai-chip span.cnt{font-size:10px;color:#ffe49c;font-weight:700;white-space:nowrap;}' +
    '.mj-tenpai-chip.zero span.cnt{color:rgba(255,255,255,.6);}' +
    '.mj-tenpai-row{display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08);}' +
    '.mj-tenpai-row:last-child{border-bottom:0;}' +
    '.mj-tenpai-disc{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:rgba(255,255,255,.8);flex-shrink:0;padding-top:2px;}' +
    '.mj-tenpai-arrow{color:#c8a45c;font-weight:800;padding-top:7px;}' +
    '.mj-log-list{display:flex;flex-direction:column;gap:5px;}' +
    '.mj-log-row{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:8px;background:rgba(255,255,255,.05);}' +
    '.mj-log-row.me{background:rgba(200,164,92,.16);}' +
    '.mj-log-seq{font-size:10px;color:rgba(255,255,255,.5);min-width:18px;text-align:right;font-variant-numeric:tabular-nums;}' +
    '.mj-log-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:rgba(255,255,255,.92);}' +
    '.mj-log-tile-lbl{font-size:11px;color:rgba(255,255,255,.7);font-weight:700;}' +
    '@media(prefers-reduced-motion:reduce){body.gn-fs .mj-fs-wild-card{animation:none!important;transition:none!important;}}';

  var mahjongRenderer = {
    init: function(container) {
      try {
        // 注入样式（仅一次）
        if (typeof injectStylesOnce === 'function') injectStylesOnce('mjStyles', STYLES);
        // 让容器撑满父级（桌面大屏时棋盘铺满可用宽度，而非缩成一个小格）
        container.style.width = '100%';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.flex = '1';
        container.innerHTML = '' +
          '<div class="mj-wrap">' +
            '<div class="mj-status" id="mjStatus"></div>' +
            '<div class="mj-board" id="mjBoard" style="position:relative;flex:1;min-height:0;width:100%;">' +
              '<canvas id="mjCanvas"></canvas>' +
            '</div>' +
            '<div class="mj-bar" id="mjActions"></div>' +
            '<div class="mj-fs-only mj-fs-win-panel" id="mjWinPanel" style="display:none"></div>' +
            '<div class="mj-fs-only mj-fs-wild-badge" id="mjWildBadge" style="display:none"></div>' +
            '<div class="mj-fs-only mj-fs-wild-card" id="mjWildCard" style="display:none"></div>' +
            '<div class="mj-fs-only mj-fs-tools" id="mjFsTools">' +
              '<div class="mj-tool-item">' +
                '<button type="button" class="mj-tool-btn" id="mjTenpaiBtn" aria-label="' + escapeHtml(t('mj_btn_tenpai', '听牌')) + '">' +
                  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9.5 9.5h5M9.5 13.5h5M12 7v10"/></svg>' +
                '</button>' +
                '<span class="mj-tool-label">' + escapeHtml(t('mj_btn_tenpai', '听牌')) + '</span>' +
              '</div>' +
              '<div class="mj-tool-item">' +
                '<button type="button" class="mj-tool-btn" id="mjLogBtn" aria-label="' + escapeHtml(t('mj_btn_log', '记录')) + '">' +
                  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M3.5 6h.5M3.5 12h.5M3.5 18h.5"/></svg>' +
                '</button>' +
                '<span class="mj-tool-label">' + escapeHtml(t('mj_btn_log', '记录')) + '</span>' +
              '</div>' +
              '<div class="mj-tool-item">' +
                '<button type="button" class="mj-tool-btn" id="mjAutoDiscardBtn" aria-label="' + escapeHtml(t('mj_auto_discard_label', '自动摸打')) + '">' +
                  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/><polygon points="10.5,9 15.5,12 10.5,15" fill="currentColor" stroke="none"/></svg>' +
                '</button>' +
                '<span class="mj-tool-label">' + escapeHtml(t('mj_btn_auto_discard', '摸打')) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="mj-fs-only mj-fs-panel" id="mjFsPanel" style="display:none"></div>' +
          '</div>';
        canvas = document.getElementById('mjCanvas');
        ctx = canvas.getContext('2d');
        preloadTileArt();
        // 强制拉取牌面字体（canvas 不触发懒加载），字体就绪后重绘一帧，
        // 避免开牌瞬间字牌/万条用回退字体渲染
        if (document.fonts && document.fonts.load) {
          try {
            document.fonts.load('32px "Ma Shan Zheng"').then(function() { clearTileCache(); draw(); }).catch(function() {});
          } catch (e) {}
        }
        sizeCanvas();
        // 设置 canvas.width 会清空画布，必须紧接着重绘，否则旋转屏幕后白屏
        if (!_resizeBound) {
          var onLayoutChange = function() {
            // 离开麻将后旧 canvas 已脱离页面，不再白白重绘
            if (!canvas || !canvas.isConnected) return;
            if (!isFs()) _activePanel = null;
            sizeCanvas();
            draw();
            drawControls();
            syncFsOverlays();
          };
          window.addEventListener('resize', onLayoutChange);
          window.addEventListener('gn:fullscreen', onLayoutChange);
          _resizeBound = true;
        }
        var tenpaiBtn = document.getElementById('mjTenpaiBtn');
        var logBtn = document.getElementById('mjLogBtn');
        var autoBtn = document.getElementById('mjAutoDiscardBtn');
        if (tenpaiBtn) tenpaiBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          toggleFsPanel('tenpai');
        });
        if (logBtn) logBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          toggleFsPanel('log');
        });
        if (autoBtn) autoBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          _autoDiscard = !_autoDiscard;
          autoBtn.classList.toggle('active', _autoDiscard);
          if (!_autoDiscard) {
            if (_autoDiscardTimer) { clearTimeout(_autoDiscardTimer); _autoDiscardTimer = null; }
          } else {
            maybeScheduleAutoDiscard();
          }
        });
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseleave', function() { _hoverIdx = -1; draw(); });
        // 重置闭包状态：init 在跨局重启时会再次调用，必须清掉上一局残留
        if (_animTimer) { cancelAnimationFrame(_animTimer); _animTimer = null; }
        _prevPhase = null;
        _prevSnapshot = null;
        _discardFly = null;
        _discardFlyMatched = false;
        _drawSlide = null;
        _lastHandTileRects = {};
        _swapSelected = [];
        _shownWinners = new Set();
        _prevMeldCounts = [];
        _claimEffects = [];
        _lastDiscardId = null;
        _lastDiscardPulse = 0;
        _lastDrawnId = null;
        _drawPulse = 0;
        _activePanel = null;
        _discardHistory = [];
        _lastRoundMarker = null;
        _wildcardCardVisible = false;
        _wildcardShownKey = null;
        _fsTableCache = null;
        _scoreFloats = [];
        _scoreFloatRoundKey = null;
        _autoDiscard = false;
        _autoDiscardKey = null;
        clearTileCache();
        if (_wildcardTimer) { clearTimeout(_wildcardTimer); _wildcardTimer = null; }
        if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
        if (_autoDiscardTimer) { clearTimeout(_autoDiscardTimer); _autoDiscardTimer = null; }
      } catch (e) {
        console.error('[mahjong] init error:', e);
        // 兜底：至少显示一个提示
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#fff;">' + (typeof getLang === 'function' && getLang() === 'en' ? 'Renderer failed to start: ' : '渲染器初始化失败: ') + e.message + '</div>';
      }
    },

    render: function(state, container, playerIndex) {
      try {
        _state = state;
        _playerIndex = playerIndex;
        if (!ctx) return;
        // 手机端：手牌数变化时重新计算 canvas 高度（支持多行滚动）
        if (state && state.hands && state.hands[_playerIndex]) {
          var curSize = state.hands[_playerIndex].length || 0;
          if (!isFs() && curSize !== _prevHandSize && W < 500) {
            _prevHandSize = curSize;
            sizeCanvas();
          }
          _prevHandSize = curSize;
        }
        // 新局开始（定缺阶段）→ 重置胡牌动画记录
        if (state && state.phase === 'void') _shownWinners.clear();

        var curSnap = buildStateSnapshot(state);
        var isFirstRender = (_prevSnapshot === null);
        var isNewRound = !isFirstRender && (
          _prevSnapshot.roundNumber !== curSnap.roundNumber ||
          (curSnap.totalDiscards === 0 && curSnap.totalMelds === 0 && _prevSnapshot.totalDiscards > 0)
        );
        if (isNewRound) {
          _discardFly = null;
          _discardFlyMatched = false;
          _drawSlide = null;
          _lastHandTileRects = {};
          _claimEffects = [];
          _shownWinners.clear();
          _lastDiscardPulse = 0;
          _drawPulse = 0;
          _scoreFloats = [];
          _scoreFloatRoundKey = null;
          _autoDiscardKey = null;
          if (_autoDiscardTimer) { clearTimeout(_autoDiscardTimer); _autoDiscardTimer = null; }
        }
        var skipAnim = isFirstRender || isNewRound;

        if (skipAnim) {
          // init 后首帧（含加入/重连）或跨局首帧只记录现状，不播飞牌/摸牌/碰杠胡动画
          _lastDiscardId = curSnap.lastDiscardId;
          _lastDrawnId = curSnap.drawn;
          _prevMeldCounts = curSnap.meldCounts.slice();
          for (var sw = 0; sw < curSnap.winners.length; sw++) {
            _shownWinners.add(curSnap.winners[sw]);
          }
        } else {
          // 检测新弃牌 → 触发飞牌动画 + 落点脉冲
          var newDiscardTile = null;
          var fromSeat = -1;
          var ld = state && state.lastDiscard;
          if (ld && ld.id && ld.id !== _prevSnapshot.lastDiscardId && !_prevSnapshot.discardIds[ld.id]) {
            newDiscardTile = ld;
          } else if (state && state.discards) {
            var bestSeq = -1;
            for (var ds = 0; ds < state.discards.length; ds++) {
              var dpile = state.discards[ds] || [];
              for (var di = 0; di < dpile.length; di++) {
                var dt = dpile[di];
                if (dt && dt.id && !_prevSnapshot.discardIds[dt.id]) {
                  var dseq = dt._discardSeq || 0;
                  if (!newDiscardTile || dseq >= bestSeq) {
                    newDiscardTile = dt;
                    bestSeq = dseq;
                    fromSeat = ds;
                  }
                }
              }
            }
          }
          if (newDiscardTile) {
            if (fromSeat < 0) {
              if (ld && typeof ld.player === 'number') fromSeat = ld.player;
              else if (state.claim && typeof state.claim.discarder === 'number') fromSeat = state.claim.discarder;
              else if (state.discards) {
                for (var fsSeat = 0; fsSeat < state.discards.length; fsSeat++) {
                  var fpile = state.discards[fsSeat] || [];
                  for (var fi = 0; fi < fpile.length; fi++) {
                    if (fpile[fi] && fpile[fi].id === newDiscardTile.id) { fromSeat = fsSeat; break; }
                  }
                  if (fromSeat >= 0) break;
                }
              }
              if (fromSeat < 0 && typeof _prevSnapshot.currentPlayer === 'number') fromSeat = _prevSnapshot.currentPlayer;
            }
            var fromRect = null;
            if (fromSeat === _playerIndex && _lastHandTileRects[newDiscardTile.id]) {
              var hr = _lastHandTileRects[newDiscardTile.id];
              fromRect = { x: hr.x, y: hr.y, w: hr.w, h: hr.h };
            } else {
              fromRect = getSeatHandOrigin(fromSeat);
            }
            _discardFly = {
              tile: newDiscardTile,
              tileId: newDiscardTile.id,
              fromSeat: fromSeat,
              fromRect: fromRect,
              target: null,
              start: nowMs(),
              duration: 280
            };
            _lastDiscardId = newDiscardTile.id;
            _lastDiscardPulse = 1;
          }

          // 检测新摸牌 → 触发滑入 + 青蓝脉冲
          var curDrawn = curSnap.drawn;
          if (curDrawn && curDrawn !== _prevSnapshot.drawn && state.currentPlayer === _playerIndex && state.phase === 'play') {
            _lastDrawnId = curDrawn;
            _drawPulse = 1;
            _drawSlide = { tileId: curDrawn, start: nowMs(), duration: 220 };
          }
          if (!curDrawn) { _lastDrawnId = null; _drawPulse = 0; }

          // 检测新增明牌 → 触发碰杠吃胡动画
          if (state && state.melds) {
            for (var i = 0; i < state.melds.length; i++) {
              var cnt = curSnap.meldCounts[i] || 0;
              var prev = _prevSnapshot.meldCounts[i] || 0;
              if (cnt > prev && cnt > 0) {
                var md = state.melds[i][cnt - 1];
                var type = md.type;
                var label = type === 'kong' ? t('mj_kong', '杠') : type === 'pung' ? t('mj_pung', '碰') : type === 'chow' ? t('mj_chow', '吃') : type === 'win' ? t('mj_win', '胡') : '';
                if (label) {
                  _claimEffects.push({ player: i, type: type, label: label, birth: nowMs() });
                  if (_claimEffects.length > 8) _claimEffects.shift();
                }
              }
              _prevMeldCounts[i] = cnt;
            }
          }

          // 胡牌效果（仅首次触发，避免血战到底反复弹出）
          if (curSnap.winners.length > 0) {
            for (var w = 0; w < curSnap.winners.length; w++) {
              var wPlayer = curSnap.winners[w];
              if (!_shownWinners.has(wPlayer)) {
                _shownWinners.add(wPlayer);
                _claimEffects.push({ player: wPlayer, type: 'win', label: t('mj_win', '胡') + '!', birth: nowMs() });
              }
            }
          }
        }

        if (!skipAnim && state && state.phase === 'over' && _prevSnapshot && _prevSnapshot.phase !== 'over') {
          triggerEndOfRoundScoreFloats(state, _prevSnapshot);
        }

        _prevSnapshot = curSnap;
        if (_discardFly || _drawSlide || _lastDiscardPulse > 0.01 || _drawPulse > 0.01 || _claimEffects.length > 0 || _scoreFloats.length > 0) {
          startAnimLoop();
        }
        updateDiscardHistory();
        draw();
        drawControls();
        syncFsOverlays();
        syncCountdownTimer();
        maybeScheduleAutoDiscard();
        // 换三张：进入 swap 阶段时清空选择（防止重启后残留上一轮的选择）；
        // 离开 swap 阶段时也清空（服务端已推进到下一家或进入定缺）
        if (state && _prevPhase !== 'swap' && state.phase === 'swap') {
          _swapSelected = [];
        } else if (state && state.phase !== 'swap' && _swapSelected && _swapSelected.length) {
          _swapSelected = [];
        }
        if (state) _prevPhase = state.phase;
      } catch (e) {
        console.error('[mahjong] render error:', e);
      }
    },
  };

  // 四川/广东共用同一渲染器：通过 isCantonese()（state.cfg === undefined）区分
  window.gameRenderers.set('mahjong-sichuan', mahjongRenderer);
  window.gameRenderers.set('mahjong-cantonese', mahjongRenderer);

  // ---- 动画循环：飞牌 + 摸牌滑入 + 弃牌脉冲 + 碰杠效果，空闲自动停 ----
  function startAnimLoop() {
    if (_animTimer) return;
    var tick = function () {
      var active = false;
      var now = nowMs();
      if (_discardFly) {
        if ((now - _discardFly.start) >= _discardFly.duration) {
          _discardFly = null;
        } else {
          active = true;
        }
      }
      if (_drawSlide) {
        if ((now - _drawSlide.start) >= _drawSlide.duration) {
          _drawSlide = null;
        } else {
          active = true;
        }
      }
      // 弃牌脉冲
      if (_lastDiscardPulse > 0.01) {
        _lastDiscardPulse *= 0.92;
        if (_lastDiscardPulse < 0.02) _lastDiscardPulse = 0;
        active = true;
      }
      // 新摸牌青蓝脉冲
      if (_drawPulse > 0.01) {
        _drawPulse *= 0.88;
        if (_drawPulse < 0.02) _drawPulse = 0;
        active = true;
      }
      // 碰杠效果（300ms 弹出 + ~1.5s 停留 + 淡出）
      if (_claimEffects.length > 0) {
        _claimEffects = _claimEffects.filter(function(e){ return (now - e.birth) < 1800; });
        if (_claimEffects.length > 0) active = true;
      }
      // 局末分数飘字（900ms）
      if (_scoreFloats.length > 0) {
        _scoreFloats = _scoreFloats.filter(function(f){ return (now - f.birth) < f.duration; });
        if (_scoreFloats.length > 0) active = true;
      }
      if (!active) {
        _animTimer = null;
        draw(); // 最后一帧
        return;
      }
      draw();
      _animTimer = requestAnimationFrame(tick);
    };
    _animTimer = requestAnimationFrame(tick);
  }

  function sizeCanvas() {
    var board = document.getElementById('mjBoard');
    if (isFs()) {
      _portrait = false;
      var fsW = board ? board.clientWidth : 0;
      var fsH = board ? board.clientHeight : 0;
      if (!fsW || fsW < 50) fsW = window.innerWidth || 812;
      if (!fsH || fsH < 50) fsH = window.innerHeight || 375;
      W = fsW;
      H = fsH;
      DPR = Math.min(window.devicePixelRatio || 1, 3);
      var byWidth = Math.floor((W - 24 - 13 * 2 - 10) / 14);
      var byHeight = Math.round((H * 0.195) / 1.4);
      TW = Math.max(28, Math.min(92, byWidth, byHeight));
      TH = Math.round(TW * 1.4);
      var fsSlab = Math.max(3, Math.round(TH * 0.12));
      var wrap = board ? board.closest('.mj-wrap') : null;
      if (wrap) {
        wrap.style.setProperty('--mj-status-bottom', (TH + fsSlab + 10) + 'px');
        wrap.style.setProperty('--mj-actions-bottom', (TH + fsSlab + 10) + 'px');
      }
      if (board) board.classList.remove('mj-board-mobile');
      var fcw = Math.round(W * DPR), fch = Math.round(H * DPR);
      if (canvas.width !== fcw) canvas.width = fcw;
      if (canvas.height !== fch) canvas.height = fch;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      canvas.style.display = 'block';
      canvas.style.margin = '0';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (W !== _lastCacheW || H !== _lastCacheH || DPR !== _lastCacheDPR) {
        _lastCacheW = W; _lastCacheH = H; _lastCacheDPR = DPR;
        _fsTableCache = null;
        clearTileCache();
      }
      return;
    }
    var bw = board ? board.clientWidth : 0;
    // 防御：flex 容器子项在首次布局前 clientWidth 可能为 0，用窗口宽兜底
    if (!bw || bw < 50) bw = window.innerWidth || 375;
    bw = Math.min(bw, 1100);
    var bh = board ? board.clientHeight : 0;
    if (!bh || bh < 50) bh = Math.round(window.innerHeight * 0.5) || 400;
    var isMobile = bw < 500;
    // 高度：桌面饱满；手机用更高比例（出牌区需要纵向空间）
    if (isMobile) {
      H = Math.max(bh, Math.round(bw * 0.85));
    } else if (bw > 600) {
      H = Math.max(bh, Math.round(bw * 0.62));
    } else {
      H = Math.max(bh, 360);
    }
    W = Math.max(bw, 320);
    H = Math.min(H, 900);
    // DPR 适配：高分屏用更多物理像素渲染，画面更清晰
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    // 牌尺寸：手机用 W/8 更大易点；桌面 W/11；限制在合理范围
    if (isMobile) {
      TW = Math.max(36, Math.min(58, W / 8));
    } else {
      TW = Math.max(38, Math.min(64, W / 11));
    }
    TH = Math.round(TW * 1.4);
    // 手机横屏（视口矮）：画布 = 视口高度减去状态行和操作栏，整块滚到视口里，
    // 手牌和碰/杠/胡按钮不用再滚页面；牌按画布高度缩小
    var shortLand = !isMobile && window.innerHeight < 500 && window.innerWidth > window.innerHeight;
    if (shortLand) {
      var sBar = document.getElementById('mjActions');
      var sStatus = document.getElementById('mjStatus');
      H = window.innerHeight - (sStatus ? Math.max(sStatus.offsetHeight, 18) : 18)
        - (sBar ? Math.max(sBar.offsetHeight, 54) : 54) - 8 - 6;
      H = Math.max(240, H);
      TW = Math.max(30, Math.min(TW, Math.floor(H * 0.2 / 1.4)));
      TH = Math.round(TW * 1.4);
    }
    // 手机竖屏：画布高度 = 剩余视口高度，整张桌子 + 两行手牌一屏放下，不用滚页面找手牌
    var portrait = _portrait = isMobile && window.innerHeight > window.innerWidth;
    if (portrait) {
      var bar = document.getElementById('mjActions');
      var top = board ? board.getBoundingClientRect().top + window.scrollY : 200;
      H = Math.max(400, Math.min(900, window.innerHeight - top - (bar ? Math.max(bar.offsetHeight, 50) : 50) - 12));
      // 每行 7 张，14 张正好两行；画布矮时再缩，保证两行手牌不超过画布高度的 40%
      TW = Math.floor((W - 20) / 7) - 4;
      TW = Math.max(32, Math.min(58, TW, Math.floor((H * 0.4 / 2 - 6) / 1.4)));
      TH = Math.round(TW * 1.4);
    }
    // 手机端：手牌多行时动态加高 canvas，允许 mjBoard 滚动
    if (isMobile && !portrait && _state && _state.hands && _state.hands[_playerIndex]) {
      var handN = _state.hands[_playerIndex].length || 0;
      // 与 drawOwnHand 的换行规则一致
      var handRows = 1;
      if (handN * (TW + 4) > W - 20) handRows = Math.ceil(handN / Math.max(4, Math.floor((W - 20) / (TW + 4))));
      if (handRows > 1) {
        var mobSlab = Math.max(3, Math.round(TH * 0.12));
        var neededH = H + (handRows - 1) * (TH + mobSlab + 10) + 20;
        H = Math.min(neededH, 1600);
      }
    }
    // 保留滚动位置（canvas 高度变化后 scrollTop 会失效）
    var board = document.getElementById('mjBoard');
    var oldScrollRatio = 0;
    if (board && board.scrollHeight > board.clientHeight) {
      oldScrollRatio = board.scrollTop / (board.scrollHeight - board.clientHeight || 1);
    }
    // 手机端允许 mjBoard 上下滚动（手牌多行时）；与上面加高画布用同一判断
    if (board) board.classList.toggle('mj-board-mobile', isMobile);
    // 尺寸没变就不重设缓冲区（重设会清空并重新分配，低端 WebView 上每回合卡顿）
    var cw = Math.round(W * DPR), ch = Math.round(H * DPR);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.style.display = 'block';
    canvas.style.margin = 'auto';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (W !== _lastCacheW || H !== _lastCacheH || DPR !== _lastCacheDPR) {
      _lastCacheW = W; _lastCacheH = H; _lastCacheDPR = DPR;
      clearTileCache();
    }
    // 恢复滚动位置
    if (board && board.scrollHeight > board.clientHeight) {
      board.scrollTop = oldScrollRatio * (board.scrollHeight - board.clientHeight);
    }
    if (shortLand) {
      var wrap = canvas.closest('.mj-wrap');
      if (wrap && wrap.getBoundingClientRect().top > 2) wrap.scrollIntoView({ block: 'start' });
    }
  }

  // ---- 牌面绘制（SVG 传统牌面 + 2.5D 立体厚度 + 离屏缓存）----

  function roundRectCtx(c, x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function roundRect(x, y, w, h, r) {
    roundRectCtx(ctx, x, y, w, h, r);
  }

  function tileSlabH(h, ratio) {
    return Math.max(2, Math.round(h * (ratio || 0.12)));
  }

  function drawTileTextFallback(c, x, y, w, h, tile) {
    if (!tile || tile.k === undefined) return;
    var isHonour = (tile.k === 'feng' || tile.k === 'jian');
    var col = SUIT_COLOR[tile.k] || '#333';
    c.fillStyle = col;
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    if (isHonour) {
      var name = (HONOUR[tile.k] && HONOUR[tile.k][tile.n]) || '';
      c.font = 'bold ' + Math.max(8, Math.floor(h * 0.44)) + 'px "Ma Shan Zheng","LXGW WenKai","KaiTi","Microsoft YaHei",serif';
      c.fillText(name, x + w / 2, y + h / 2 + 1);
      // 番子右上角小红点（中/发）
      if (tile.k === 'jian' && (tile.n === 1 || tile.n === 2)) {
        c.fillStyle = 'rgba(192,48,48,.7)';
        c.beginPath();
        c.arc(x + w - Math.max(3, w * 0.14), y + Math.max(3, h * 0.1), Math.max(1.4, w * 0.055), 0, Math.PI * 2);
        c.fill();
      }
    } else {
      c.font = 'bold ' + Math.max(7, Math.floor(h * 0.42)) + 'px "Ma Shan Zheng","LXGW WenKai","KaiTi","Microsoft YaHei",serif';
      c.fillText(String(tile.n), x + w / 2, y + h * 0.35);
      c.font = Math.max(6, Math.floor(h * 0.26)) + 'px "Ma Shan Zheng","LXGW WenKai","KaiTi","Microsoft YaHei",serif';
      c.fillText(SUIT_GLYPH[tile.k] || '', x + w / 2, y + h * 0.72);
    }
  }

  function renderTileFaceSprite(rw, rh, slabH, tile, hlCode, isWild, artImg, dpr, rot) {
    var pad = 2;
    var cw = rw + pad * 2;
    var ch = rh + slabH + pad * 2;
    var off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(cw * dpr));
    off.height = Math.max(1, Math.round(ch * dpr));
    var c = off.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    var x = pad, y = pad;
    var r = Math.max(2, Math.min(6, Math.round(Math.min(rw, rh) * 0.11)));

    // 2.5D 立体牌身厚度：后半截墨绿竹青底 + 前半截象牙侧壁（始终朝下）
    var backGrad = c.createLinearGradient(x, y + rh * 0.4, x, y + rh + slabH);
    backGrad.addColorStop(0, '#2e6f5f');
    backGrad.addColorStop(1, '#1c493d');
    c.fillStyle = backGrad;
    roundRectCtx(c, x, y + slabH, rw, rh, r);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.3)';
    c.lineWidth = 0.8;
    c.stroke();

    var ivoryOff = Math.max(1, Math.round(slabH * 0.5));
    var sideGrad = c.createLinearGradient(x, y + rh - ivoryOff, x, y + rh + ivoryOff);
    sideGrad.addColorStop(0, '#e3d8b8');
    sideGrad.addColorStop(1, '#c8ba92');
    c.fillStyle = sideGrad;
    roundRectCtx(c, x, y + ivoryOff, rw, rh, r);
    c.fill();
    c.strokeStyle = 'rgba(42,36,20,.16)';
    c.lineWidth = 0.7;
    c.stroke();

    // 象牙白牌面主体（顶亮底暗模拟顶光）
    var faceGrad = c.createLinearGradient(x, y, x, y + rh);
    faceGrad.addColorStop(0, '#fefcf3');
    faceGrad.addColorStop(0.5, '#f8f2df');
    faceGrad.addColorStop(1, '#ece2c4');
    c.fillStyle = faceGrad;
    roundRectCtx(c, x, y, rw, rh, r);
    c.fill();
    c.strokeStyle = 'rgba(42,36,20,.24)';
    c.lineWidth = 1;
    c.stroke();

    // 顶边倒角高光
    if (rw >= 14) {
      c.strokeStyle = 'rgba(255,255,255,.72)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + r, y + 1.1);
      c.lineTo(x + rw - r, y + 1.1);
      c.stroke();
    }

    // 牌面图案：优先用预加载 SVG，未就绪时用文字兜底（支持 0/90/180/-90 旋转）
    if (tile && tile.k !== undefined) {
      var angle = rot || 0;
      var swapped = (angle === 90 || angle === -90);
      var aw = swapped ? rh : rw;
      var ah = swapped ? rw : rh;
      var ax = angle ? (-aw / 2) : x;
      var ay = angle ? (-ah / 2) : y;

      c.save();
      if (angle) {
        c.translate(x + rw / 2, y + rh / 2);
        c.rotate(angle * Math.PI / 180);
      }
      if (artImg) {
        var insetX = aw * 0.08;
        var insetY = ah * 0.08;
        var boxW = Math.max(2, aw - insetX * 2);
        var boxH = Math.max(2, ah - insetY * 2);
        var ar = (artImg.naturalWidth && artImg.naturalHeight) ? (artImg.naturalWidth / artImg.naturalHeight) : 0.75;
        var dw = boxW;
        var dh = dw / ar;
        if (dh > boxH) {
          dh = boxH;
          dw = dh * ar;
        }
        var dx = ax + insetX + (boxW - dw) / 2;
        var dy = ay + insetY + (boxH - dh) / 2;
        c.drawImage(artImg, dx, dy, dw, dh);

        // 白板（Haku.svg 原图为空白图层）：补刻传统蓝边双框以防误认未加载
        if (tile.k === 'jian' && tile.n === 3) {
          var fx = ax + aw * 0.18;
          var fy = ay + ah * 0.16;
          var fw = aw * 0.64;
          var fh = ah * 0.68;
          c.strokeStyle = '#1d4e89';
          c.lineWidth = Math.max(1.2, aw * 0.055);
          roundRectCtx(c, fx, fy, fw, fh, Math.max(1.5, r * 0.6));
          c.stroke();
          if (aw >= 20) {
            c.strokeStyle = 'rgba(29,78,137,.55)';
            c.lineWidth = 0.8;
            roundRectCtx(c, fx + fw * 0.12, fy + fh * 0.1, fw * 0.76, fh * 0.8, Math.max(1, r * 0.4));
            c.stroke();
          }
        }
      } else {
        drawTileTextFallback(c, ax, ay, aw, ah, tile);
      }
      c.restore();
    }

    // 鬼牌（百搭）叠加标识：金色微染色 + 金框 + 左上角鬼牌徽标
    if (isWild) {
      c.fillStyle = 'rgba(245,196,81,.16)';
      roundRectCtx(c, x, y, rw, rh, r);
      c.fill();
      c.strokeStyle = '#d99b26';
      c.lineWidth = Math.min(rw, rh) >= 26 ? 2 : 1.4;
      roundRectCtx(c, x + 0.5, y + 0.5, rw - 1, rh - 1, r);
      c.stroke();

      c.save();
      roundRectCtx(c, x, y, rw, rh, r);
      c.clip();
      var badgeS = Math.max(6, Math.round(Math.min(rw, rh) * 0.28));
      c.fillStyle = '#d99b26';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + badgeS, y);
      c.lineTo(x, y + badgeS);
      c.closePath();
      c.fill();
      if (Math.min(rw, rh) >= 24) {
        c.fillStyle = '#fff9db';
        c.font = 'bold ' + Math.max(7, Math.round(Math.min(rw, rh) * 0.18)) + 'px system-ui,"Microsoft YaHei",sans-serif';
        c.textAlign = 'left';
        c.textBaseline = 'top';
        c.fillText('★', x + 1.5, y + 0.5);
      }
      c.restore();
    }

    // 状态高亮（叠在图案上方，确保悬停 / 新摸 / 最新弃牌清晰可见）
    if (hlCode === 1) {
      c.fillStyle = 'rgba(245,200,80,.14)';
      roundRectCtx(c, x, y, rw, rh, r);
      c.fill();
      c.strokeStyle = '#d4a843';
      c.lineWidth = 2.4;
      roundRectCtx(c, x + 0.5, y + 0.5, rw - 1, rh - 1, r);
      c.stroke();
    } else if (hlCode === 2) {
      c.fillStyle = 'rgba(6,182,212,.15)';
      roundRectCtx(c, x, y, rw, rh, r);
      c.fill();
      c.strokeStyle = '#06b6d4';
      c.lineWidth = 2.4;
      roundRectCtx(c, x + 0.5, y + 0.5, rw - 1, rh - 1, r);
      c.stroke();
    } else if (hlCode === 3) {
      c.fillStyle = 'rgba(255,140,40,.13)';
      roundRectCtx(c, x, y, rw, rh, r);
      c.fill();
      c.strokeStyle = '#ef7d22';
      c.lineWidth = 1.8;
      roundRectCtx(c, x + 0.5, y + 0.5, rw - 1, rh - 1, r);
      c.stroke();
    }

    return { canvas: off, pad: pad, drawW: cw, drawH: ch };
  }

  function drawTileFace(x, y, w, h, tile, highlight, opts) {
    // highlight: 0/false = none, 1/true/'hover' = 金色悬停, 2/'drawn' = 青蓝新摸, 3/'last' = 橙色最新弃牌
    var hlCode = (highlight === 2 || highlight === 'drawn') ? 2
      : (highlight === 3 || highlight === 'last') ? 3
      : (highlight === 1 || highlight === true || highlight === 'hover') ? 1 : 0;
    var rw = Math.max(6, Math.round(w));
    var rh = Math.max(8, Math.round(h));
    var slabRatio = (opts && opts.slabRatio !== undefined) ? opts.slabRatio : 0.12;
    var slabH = tileSlabH(rh, slabRatio);
    var rot = (opts && opts.rot) ? opts.rot : 0;
    var isWild = isWildcardTile(tile);
    var artImg = getTileArtImg(tile);
    var cacheDpr = Math.min(DPR || 1, 2.5);
    var dprKey = Math.round(cacheDpr * 2);
    var key = 'F|' + tileArtKey(tile) + '|' + rw + 'x' + rh + '|' + slabH + '|' + hlCode + '|' + (isWild ? 1 : 0) + '|' + (artImg ? 1 : 0) + '|' + rot + '|' + dprKey;

    var entry = _tileCache.get(key);
    if (!entry) {
      entry = renderTileFaceSprite(rw, rh, slabH, tile, hlCode, isWild, artImg, cacheDpr, rot);
      putTileCache(key, entry);
    }

    var r = Math.max(2, Math.min(6, Math.round(Math.min(rw, rh) * 0.11)));
    // 桌面接地面投影（上浮牌把投影留在原桌面位置，增强悬浮高度感）
    if (opts && opts.lift && opts.lift < 0) {
      var restY = y - opts.lift;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.32)';
      roundRect(x + 2, restY + rh + Math.round(slabH * 0.35), rw - 2, Math.max(3, Math.round(slabH * 0.85)), r);
      ctx.fill();
      ctx.restore();
    } else if ((opts && opts.shadow) || rw >= TW * 0.85) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      roundRect(x + 1.5, y + slabH + 2.5, rw, rh, r);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.20)';
      roundRect(x + 1, y + slabH + 1.5, rw, rh, r);
      ctx.fill();
      ctx.restore();
    }

    ctx.drawImage(entry.canvas, x - entry.pad, y - entry.pad, entry.drawW, entry.drawH);
  }

  function drawWallTileSprite(x, y, w, h, orient) {
    var rw = Math.max(5, Math.round(w));
    var rh = Math.max(5, Math.round(h));
    var slabH = Math.max(2, Math.round(rh * 0.36));
    var cacheDpr = Math.min(DPR || 1, 2.5);
    var key = 'W|' + orient + '|' + rw + 'x' + rh + '|' + slabH + '|' + Math.round(cacheDpr * 2);
    var entry = _tileCache.get(key);
    if (!entry) {
      var pad = 1.5;
      var cw = rw + pad * 2;
      var ch = rh + slabH + pad * 2;
      var off = document.createElement('canvas');
      off.width = Math.max(1, Math.round(cw * cacheDpr));
      off.height = Math.max(1, Math.round(ch * cacheDpr));
      var c = off.getContext('2d');
      c.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0);

      var px = pad, py = pad;
      var r = Math.max(1.5, Math.min(3.5, Math.round(Math.min(rw, rh) * 0.16)));

      // 投影
      c.fillStyle = 'rgba(0,0,0,.28)';
      roundRectCtx(c, px + 0.5, py + slabH + 1, rw, rh, r);
      c.fill();

      // 象牙侧面厚度
      var iGrad = c.createLinearGradient(px, py + rh * 0.5, px, py + rh + slabH);
      iGrad.addColorStop(0, '#e8dfc2');
      iGrad.addColorStop(1, '#bfb187');
      c.fillStyle = iGrad;
      roundRectCtx(c, px, py + slabH, rw, rh, r);
      c.fill();
      c.strokeStyle = 'rgba(18,28,20,.32)';
      c.lineWidth = 0.6;
      c.stroke();

      // 绿色牌背顶面
      var bGrad = c.createLinearGradient(px, py, px, py + rh);
      bGrad.addColorStop(0, '#459683');
      bGrad.addColorStop(1, '#265c4e');
      c.fillStyle = bGrad;
      roundRectCtx(c, px, py, rw, rh, r);
      c.fill();
      c.strokeStyle = 'rgba(10,30,22,.58)';
      c.lineWidth = 0.8;
      c.stroke();

      // 顶缘高光
      c.strokeStyle = 'rgba(255,255,255,.24)';
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(px + r, py + 0.9);
      c.lineTo(px + rw - r, py + 0.9);
      c.stroke();

      entry = { canvas: off, pad: pad, drawW: cw, drawH: ch };
      putTileCache(key, entry);
    }
    ctx.drawImage(entry.canvas, x - entry.pad, y - entry.pad, entry.drawW, entry.drawH);
  }

  function drawWallStack(x, y, w, h, count, orient) {
    if (count <= 0) return;
    drawWallTileSprite(x, y, w, h, orient);
    if (count >= 2) {
      var stackLift = Math.max(2, Math.round(h * 0.36));
      drawWallTileSprite(x, y - stackLift, w, h, orient);
    }
  }

  function renderTileBackSprite(rw, rh, slabH, dpr) {
    var pad = 2;
    var cw = rw + pad * 2;
    var ch = rh + slabH + pad * 2;
    var off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(cw * dpr));
    off.height = Math.max(1, Math.round(ch * dpr));
    var c = off.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    var x = pad, y = pad;
    var r = Math.max(2, Math.min(5, Math.round(rw * 0.12)));

    // 底部 2.5D 厚度（象牙前层 + 深绿牌背底沿）
    c.fillStyle = '#d5caa6';
    roundRectCtx(c, x, y + slabH, rw, rh, r);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.26)';
    c.lineWidth = 0.8;
    c.stroke();

    var sideOff = Math.max(1, Math.round(slabH * 0.45));
    c.fillStyle = '#1d493e';
    roundRectCtx(c, x, y + sideOff, rw, rh, r);
    c.fill();

    // 牌背：深竹青渐变
    var grad = c.createLinearGradient(x, y, x, y + rh);
    grad.addColorStop(0, '#3d8474');
    grad.addColorStop(1, '#28584d');
    c.fillStyle = grad;
    roundRectCtx(c, x, y, rw, rh, r);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.16)';
    c.lineWidth = 1;
    c.stroke();

    // 背纹：内框 + 双菱形
    c.strokeStyle = 'rgba(255,255,255,.22)';
    c.lineWidth = 0.9;
    roundRectCtx(c, x + rw * 0.16, y + rh * 0.16, rw * 0.68, rh * 0.68, Math.max(1.5, r * 0.6));
    c.stroke();
    if (rw >= 14) {
      c.beginPath();
      c.moveTo(x + rw / 2, y + rh * 0.3);
      c.lineTo(x + rw * 0.7, y + rh / 2);
      c.lineTo(x + rw / 2, y + rh * 0.7);
      c.lineTo(x + rw * 0.3, y + rh / 2);
      c.closePath();
      c.stroke();
      c.beginPath();
      c.moveTo(x + rw / 2, y + rh * 0.4);
      c.lineTo(x + rw * 0.6, y + rh / 2);
      c.lineTo(x + rw / 2, y + rh * 0.6);
      c.lineTo(x + rw * 0.4, y + rh / 2);
      c.closePath();
      c.stroke();
    }
    return { canvas: off, pad: pad, drawW: cw, drawH: ch };
  }

  function drawTileBack(x, y, w, h) {
    var rw = Math.max(6, Math.round(w));
    var rh = Math.max(8, Math.round(h));
    var slabH = tileSlabH(rh, 0.11);
    var cacheDpr = Math.min(DPR || 1, 2.5);
    var key = 'B|' + rw + 'x' + rh + '|' + slabH + '|' + Math.round(cacheDpr * 2);
    var entry = _tileCache.get(key);
    if (!entry) {
      entry = renderTileBackSprite(rw, rh, slabH, cacheDpr);
      putTileCache(key, entry);
    }
    ctx.drawImage(entry.canvas, x - entry.pad, y - entry.pad, entry.drawW, entry.drawH);
  }

  // 对家直立手牌（从斜上方看：顶面竹青+象牙厚度条 + 正面立面牌背）
  function drawTopTileBack25D(x, y, w, h) {
    var rw = Math.max(6, Math.round(w));
    var rh = Math.max(8, Math.round(h));
    var cacheDpr = Math.min(DPR || 1, 2.5);
    var key = 'BT|' + rw + 'x' + rh + '|' + Math.round(cacheDpr * 2);
    var entry = _tileCache.get(key);
    if (!entry) {
      var pad = 2;
      var cw = rw + pad * 2;
      var ch = rh + 4 + pad * 2;
      var off = document.createElement('canvas');
      off.width = Math.max(1, Math.round(cw * cacheDpr));
      off.height = Math.max(1, Math.round(ch * cacheDpr));
      var c = off.getContext('2d');
      c.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0);

      var px = pad, py = pad;
      var r = Math.max(2, Math.min(4, Math.round(rw * 0.14)));
      var topRim = Math.max(3, Math.round(rh * 0.22));
      var ivoryLip = Math.max(1.5, Math.round(topRim * 0.42));

      // 桌面投下的微弱底影
      c.fillStyle = 'rgba(0,0,0,.28)';
      roundRectCtx(c, px + 0.5, py + 2.5, rw, rh, r);
      c.fill();

      // 立牌主体背面
      var bodyGrad = c.createLinearGradient(px, py + topRim, px, py + rh);
      bodyGrad.addColorStop(0, '#357465');
      bodyGrad.addColorStop(1, '#214d42');
      c.fillStyle = bodyGrad;
      roundRectCtx(c, px, py, rw, rh, r);
      c.fill();

      // 牌顶面（远侧象牙唇边 + 近侧竹青倒角顶）
      c.fillStyle = '#e8dfc2';
      roundRectCtx(c, px, py, rw, ivoryLip + 2, r);
      c.fill();
      c.fillStyle = '#4c9986';
      roundRectCtx(c, px, py + ivoryLip, rw, topRim - ivoryLip + 1.5, Math.max(1, r - 1));
      c.fill();

      // 立面微弱高光边与背框
      c.strokeStyle = 'rgba(255,255,255,.16)';
      c.lineWidth = 0.8;
      roundRectCtx(c, px, py, rw, rh, r);
      c.stroke();
      if (rw >= 14) {
        c.strokeStyle = 'rgba(255,255,255,.16)';
        roundRectCtx(c, px + rw * 0.18, py + topRim + 2, rw * 0.64, Math.max(3, rh - topRim - 5), 1.5);
        c.stroke();
      }

      entry = { canvas: off, pad: pad, drawW: cw, drawH: ch };
      putTileCache(key, entry);
    }
    ctx.drawImage(entry.canvas, x - entry.pad, y - entry.pad, entry.drawW, entry.drawH);
  }

  // 左右家透视立牌（外侧为牌背竹青，内侧露出象牙白牌面半边，底部带暗色厚度块）
  function drawSideTileBack25D(x, y, w, h, side) {
    var rw = Math.max(8, Math.round(w));
    var rh = Math.max(6, Math.round(h));
    var slabH = Math.max(2, Math.round(rh * 0.24));
    var cacheDpr = Math.min(DPR || 1, 2.5);
    var key = 'BS|' + side + '|' + rw + 'x' + rh + '|' + slabH + '|' + Math.round(cacheDpr * 2);
    var entry = _tileCache.get(key);
    if (!entry) {
      var pad = 2;
      var cw = rw + pad * 2;
      var ch = rh + slabH + pad * 2;
      var off = document.createElement('canvas');
      off.width = Math.max(1, Math.round(cw * cacheDpr));
      off.height = Math.max(1, Math.round(ch * cacheDpr));
      var c = off.getContext('2d');
      c.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0);

      var px = pad, py = pad;
      var r = Math.max(2, Math.min(3.5, Math.round(rh * 0.18)));
      var ivoryW = Math.max(3, Math.round(rw * 0.28));
      var backW = rw - ivoryW;

      // 底部阴影 + 2.5D 侧厚
      c.fillStyle = 'rgba(0,0,0,.26)';
      roundRectCtx(c, px + 0.5, py + slabH + 1.5, rw, rh, r);
      c.fill();
      c.fillStyle = '#1b4338';
      roundRectCtx(c, px, py + slabH, rw, rh, r);
      c.fill();
      c.fillStyle = '#c5b890';
      if (side === 'left') {
        roundRectCtx(c, px + backW - 1, py + slabH, ivoryW + 1, rh, r);
      } else {
        roundRectCtx(c, px, py + slabH, ivoryW + 1, rh, r);
      }
      c.fill();

      // 牌身顶面：竹青牌背 + 朝向桌心的象牙侧面
      var bGrad = c.createLinearGradient(px, py, px + rw, py);
      if (side === 'left') {
        bGrad.addColorStop(0, '#3e8574');
        bGrad.addColorStop(1, '#295b4e');
        c.fillStyle = bGrad;
        roundRectCtx(c, px, py, rw, rh, r);
        c.fill();
        var iGradL = c.createLinearGradient(px + backW, py, px + rw, py);
        iGradL.addColorStop(0, '#efe6c9');
        iGradL.addColorStop(1, '#d8cca6');
        c.fillStyle = iGradL;
        roundRectCtx(c, px + backW, py, ivoryW, rh, Math.max(1.5, r - 0.5));
        c.fill();
      } else {
        bGrad.addColorStop(0, '#295b4e');
        bGrad.addColorStop(1, '#3e8574');
        c.fillStyle = bGrad;
        roundRectCtx(c, px, py, rw, rh, r);
        c.fill();
        var iGradR = c.createLinearGradient(px, py, px + ivoryW, py);
        iGradR.addColorStop(0, '#d8cca6');
        iGradR.addColorStop(1, '#efe6c9');
        c.fillStyle = iGradR;
        roundRectCtx(c, px, py, ivoryW, rh, Math.max(1.5, r - 0.5));
        c.fill();
      }

      c.strokeStyle = 'rgba(255,255,255,.16)';
      c.lineWidth = 0.8;
      roundRectCtx(c, px, py, rw, rh, r);
      c.stroke();

      entry = { canvas: off, pad: pad, drawW: cw, drawH: ch };
      putTileCache(key, entry);
    }
    ctx.drawImage(entry.canvas, x - entry.pad, y - entry.pad, entry.drawW, entry.drawH);
  }

  // ---- 座位映射：以自己为基准，逆时针排列（真实麻将顺序）----
  // rel=0 自己(下), rel=1 下家(右), rel=2 对家(上), rel=3 上家(左)
  // 出牌顺序：自己(下) → 下家(右) → 对家(上) → 上家(左) → 自己...（俯视逆时针）

  function seatPos(idx) {
    var n = _state.hands.length;
    var rel = (idx - _playerIndex + n) % n;
    if (rel === 0) return 'bottom';
    if (rel === 1) return 'right';
    if (rel === 2) return 'top';
    return 'left';
  }

  function handCount(idx) {
    var h = _state.hands[idx];
    // 四川：数组; 广东：数字(count)或数组
    return Array.isArray(h) ? h.length : (h || 0);
  }

  // ---- 布局绘制 ----

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (!_state || !_state.hands) return;

    if (isFs()) {
      drawFsTable();
      return;
    }

    // 背景：深墨绿 + 中心聚光 + 四角暗角
    ctx.fillStyle = '#102419';
    ctx.fillRect(0, 0, W, H);
    VH = H;
    if (_portrait) {
      // 桌面区 = 手牌（和自己的明牌、定缺标签）上方的部分
      var myMelds = _state.melds && _state.melds[_playerIndex];
      VH = handTopY() - 26 - (myMelds && myMelds.length ? Math.round(TH * 0.3) + 8 : 0);
    }
    var cx = W / 2, cy = VH / 2;
    var bgLight = ctx.createRadialGradient(cx, cy * 0.92, Math.min(W, VH) * 0.08, cx, cy, Math.max(W, H) * 0.72);
    bgLight.addColorStop(0, '#1f4530');
    bgLight.addColorStop(0.55, '#153121');
    bgLight.addColorStop(1, '#0b1a12');
    ctx.fillStyle = bgLight;
    ctx.fillRect(0, 0, W, H);

    // 中央椭圆桌面（聚光灯 + 立起细边框）
    var rx = Math.min(W, VH) * 0.46, ry = Math.min(W, VH) * 0.38;
    if (_portrait) { rx = W * 0.46; ry = VH * 0.42; }
    var felt = ctx.createRadialGradient(cx, cy * 0.92, ry * 0.08, cx, cy, Math.max(rx, ry));
    felt.addColorStop(0, '#336447');
    felt.addColorStop(0.68, '#234932');
    felt.addColorStop(1, '#152f20');
    ctx.save();
    ctx.fillStyle = felt;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // 凸起桌沿与内倒角高光
    ctx.strokeStyle = 'rgba(0,0,0,.42)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = '#254a35';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,164,92,.32)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(4, rx - 2), Math.max(4, ry - 2), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,164,92,.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 5, ry + 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    _discardFlyMatched = false;
    drawOpponents();
    drawOwnHand();
    drawDiscards();
    drawMelds();
    drawDiscardFly();
    drawClaimEffects();
    drawTurnIndicator();
    drawPlayerNames();
    drawWallCount();
    drawScorePanel();
  }

  // ---- 全屏横屏麻将桌布局（仅 body.gn-fs 时启用）----

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function truncText(text, maxW) {
    var s = String(text || '');
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  function computeFsMetrics() {
    var handBottomPad = 4;
    var handSlabH = tileSlabH(TH, 0.12);
    var handTop = H - TH - handSlabH - handBottomPad;
    var statusH = 24;
    var statusTop = handTop - statusH - 6;
    var rightToolsW = 66;
    var tableLeft = 10;
    var tableRight = W - rightToolsW;
    var hasWild = !!getWildcardTile(_state);
    var topLeftClear = hasWild ? 148 : 66;

    var sFar = 0.72;
    var sNear = 1.0;
    var topY = clamp(Math.round(H * 0.036), 12, 22);
    var botY = Math.max(topY + 140, handTop - 8);
    var tableH = botY - topY;
    var tableCx = Math.round((W - 56) / 2);
    var nearW = clamp(Math.round(tableH * 1.80), 340, W - 150);

    var zFar = 1 / sFar;
    var zNear = 1 / sNear;
    var sCenter = 1 / (zFar + (zNear - zFar) * 0.5);
    var tCenter = (sCenter - sFar) / (sNear - sFar);
    var cy = Math.round(topY + tableH * tCenter);

    var baseOppW = clamp(Math.round(nearW * 0.036), 14, 34);
    var baseSideRiverH = clamp(Math.round(tableH * 0.056), 11, 28);
    var oppTopW = clamp(Math.round(baseOppW * sFar), 13, 28);
    var oppTopH = Math.round(oppTopW * 1.24);
    var oppTopY = topY + 2;
    var topRowBottom = oppTopY + oppTopH;

    var compassS = clamp(Math.round(tableH * 0.25), 58, 120);
    var infoH = 18;
    var sideTileW = clamp(Math.round(baseOppW * 1.05), 14, 36);
    var leftTileX = Math.round(tableCx - 0.5 * nearW * sCenter);
    var rightTileX = Math.round(tableCx + 0.5 * nearW * sCenter - sideTileW);

    var hCardW = clamp(Math.round(W * 0.14), 102, 146);
    var hCardH = clamp(Math.round(H * 0.092), 34, 46);
    var sCardW = clamp(Math.round(W * 0.105), 72, 114);
    var sCardH = clamp(Math.round(H * 0.12), 44, 58);

    var sMid = 1 / (zFar + (zNear - zFar) * 0.48);
    var leftRimMidX = tableCx - 0.542 * nearW * sMid;
    var rightRimMidX = tableCx + 0.542 * nearW * sMid;

    var meCard = { x: 8, y: handTop - hCardH - 6, w: hCardW, h: hCardH };
    var leftCard = { x: Math.max(4, Math.round(leftRimMidX - sCardW - 10)), y: Math.round(cy - sCardH / 2), w: sCardW, h: sCardH };
    var rightCard = { x: Math.min(tableRight - sCardW - 4, Math.round(rightRimMidX + 10)), y: Math.round(cy - sCardH / 2), w: sCardW, h: sCardH };
    var oppCard = { x: Math.min(tableRight - hCardW - 4, Math.round(tableCx + 0.542 * nearW * sFar + 8)), y: 6, w: hCardW, h: hCardH };

    return {
      handBottomPad: handBottomPad,
      handSlabH: handSlabH,
      handTopY: handTop,
      statusTopY: statusTop,
      rightToolsW: rightToolsW,
      tableLeft: tableLeft,
      tableRight: tableRight,
      tableCx: tableCx,
      topLeftClear: topLeftClear,
      sFar: sFar,
      sNear: sNear,
      topY: topY,
      botY: botY,
      tableH: tableH,
      nearW: nearW,
      baseOppW: baseOppW,
      baseSideRiverH: baseSideRiverH,
      oppTopW: oppTopW,
      oppTopH: oppTopH,
      oppTopY: oppTopY,
      topRowBottom: topRowBottom,
      cy: cy,
      compassS: compassS,
      infoH: infoH,
      sideTileW: sideTileW,
      leftTileX: leftTileX,
      leftTileRight: leftTileX + sideTileW,
      rightTileX: rightTileX,
      rightTileLeft: rightTileX,
      hCardW: hCardW,
      hCardH: hCardH,
      sCardW: sCardW,
      sCardH: sCardH,
      meCard: meCard,
      leftCard: leftCard,
      rightCard: rightCard,
      oppCard: oppCard,
      oppRowRight: tableCx + 120
    };
  }

  function project(x, y) {
    var m = _fsMetrics;
    var sFar = m.sFar;
    var sNear = m.sNear;
    var zFar = 1 / sFar;
    var zNear = 1 / sNear;
    var z = zFar + (zNear - zFar) * y;
    var s = 1 / z;
    var tY = (s - sFar) / (sNear - sFar);
    return {
      x: m.tableCx + (x - 0.5) * m.nearW * s,
      y: m.topY + m.tableH * tY,
      s: s
    };
  }

  function traceQuad(c, p0, p1, p2, p3) {
    c.beginPath();
    c.moveTo(p0.x, p0.y);
    c.lineTo(p1.x, p1.y);
    c.lineTo(p2.x, p2.y);
    c.lineTo(p3.x, p3.y);
    c.closePath();
  }

  function getFsTableLayer(m) {
    var cacheDpr = Math.min(DPR || 1, 2.5);
    var key = W + 'x' + H + '@' + Math.round(cacheDpr * 2) + ':' + m.topY + ':' + m.botY + ':' + m.nearW + ':' + m.tableCx;
    if (_fsTableCache && _fsTableCache.key === key) return _fsTableCache.canvas;

    var off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(W * cacheDpr));
    off.height = Math.max(1, Math.round(H * cacheDpr));
    var c = off.getContext('2d');
    c.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0);

    // 1. 房间背景：深墨绿渐变
    var bgGrad = c.createRadialGradient(m.tableCx, m.cy, 20, m.tableCx, m.cy, Math.max(W, H) * 0.72);
    bgGrad.addColorStop(0, '#132b1e');
    bgGrad.addColorStop(0.58, '#0c1c14');
    bgGrad.addColorStop(1, '#06100b');
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, W, H);

    var iTL = project(0, 0), iTR = project(1, 0), iBR = project(1, 1), iBL = project(0, 1);
    var oTL = project(-0.042, -0.045), oTR = project(1.042, -0.045), oBR = project(1.042, 1.045), oBL = project(-0.042, 1.045);
    var skirtH = clamp(Math.round(m.tableH * 0.036), 6, 14);

    // 2. 整张桌台地面软阴影
    c.save();
    traceQuad(c,
      { x: oTL.x, y: oTL.y + skirtH + 6 },
      { x: oTR.x, y: oTR.y + skirtH + 6 },
      { x: oBR.x + 4, y: oBR.y + skirtH + 8 },
      { x: oBL.x - 4, y: oBL.y + skirtH + 8 }
    );
    c.fillStyle = 'rgba(0,0,0,.52)';
    c.fill();
    c.restore();

    // 3. 桌台近侧立面裙边（立体厚桌沿）
    var skirtGrad = c.createLinearGradient(0, oBL.y, 0, oBL.y + skirtH);
    skirtGrad.addColorStop(0, '#183b2a');
    skirtGrad.addColorStop(1, '#091710');
    traceQuad(c, oBL, oBR, { x: oBR.x, y: oBR.y + skirtH }, { x: oBL.x, y: oBL.y + skirtH });
    c.fillStyle = skirtGrad;
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.5)';
    c.lineWidth = 1;
    c.stroke();

    // 4. 四周抬起边框（北/南/西/东四面斜边）
    // 远边（顶框）
    var topRimGrad = c.createLinearGradient(0, oTL.y, 0, iTL.y);
    topRimGrad.addColorStop(0, '#2c5c44');
    topRimGrad.addColorStop(1, '#183728');
    traceQuad(c, oTL, oTR, iTR, iTL);
    c.fillStyle = topRimGrad;
    c.fill();

    // 近边（底框）
    var botRimGrad = c.createLinearGradient(0, iBL.y, 0, oBL.y);
    botRimGrad.addColorStop(0, '#2c5f47');
    botRimGrad.addColorStop(1, '#1a3c2c');
    traceQuad(c, iBL, iBR, oBR, oBL);
    c.fillStyle = botRimGrad;
    c.fill();

    // 左框
    var leftRimGrad = c.createLinearGradient(oBL.x, 0, iBL.x, 0);
    leftRimGrad.addColorStop(0, '#1c4230');
    leftRimGrad.addColorStop(1, '#2a5a43');
    traceQuad(c, oTL, iTL, iBL, oBL);
    c.fillStyle = leftRimGrad;
    c.fill();

    // 右框
    var rightRimGrad = c.createLinearGradient(iBR.x, 0, oBR.x, 0);
    rightRimGrad.addColorStop(0, '#2a5a43');
    rightRimGrad.addColorStop(1, '#163526');
    traceQuad(c, iTR, oTR, oBR, iBR);
    c.fillStyle = rightRimGrad;
    c.fill();

    // 边框外沿高光与内嵌细金线
    traceQuad(c, oTL, oTR, oBR, oBL);
    c.strokeStyle = 'rgba(255,248,220,.18)';
    c.lineWidth = 1.2;
    c.stroke();

    var gTL = project(-0.021, -0.022), gTR = project(1.021, -0.022), gBR = project(1.021, 1.022), gBL = project(-0.021, 1.022);
    traceQuad(c, gTL, gTR, gBR, gBL);
    c.strokeStyle = 'rgba(200,164,92,.34)';
    c.lineWidth = 1;
    c.stroke();

    // 5. 内部凹陷梯形台呢：中心微亮、四周暗角
    c.save();
    traceQuad(c, iTL, iTR, iBR, iBL);
    c.clip();

    var centerPt = project(0.5, 0.48);
    var feltGrad = c.createRadialGradient(centerPt.x, centerPt.y, 12, centerPt.x, centerPt.y, Math.max(m.nearW, m.tableH) * 0.64);
    feltGrad.addColorStop(0, '#347253');
    feltGrad.addColorStop(0.45, '#22523a');
    feltGrad.addColorStop(0.82, '#163928');
    feltGrad.addColorStop(1, '#0e261a');
    c.fillStyle = feltGrad;
    c.fillRect(0, 0, W, H);

    // 自研几何底纹：罗盘下方透视双菱形（无文字水印）
    var dO = [project(0.5, 0.17), project(0.83, 0.50), project(0.5, 0.83), project(0.17, 0.50)];
    traceQuad(c, dO[0], dO[1], dO[2], dO[3]);
    c.strokeStyle = 'rgba(200,164,92,.10)';
    c.lineWidth = 1.2;
    c.stroke();

    var dI = [project(0.5, 0.25), project(0.75, 0.50), project(0.5, 0.75), project(0.25, 0.50)];
    traceQuad(c, dI[0], dI[1], dI[2], dI[3]);
    c.strokeStyle = 'rgba(255,255,255,.045)';
    c.lineWidth = 1;
    c.stroke();

    // 台呢内凹边缘阴影（模拟边框遮光）
    c.strokeStyle = 'rgba(0,0,0,.38)';
    c.lineWidth = 8;
    traceQuad(c, iTL, iTR, iBR, iBL);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.08)';
    c.lineWidth = 1;
    traceQuad(c, iTL, iTR, iBR, iBL);
    c.stroke();

    c.restore();

    _fsTableCache = { key: key, canvas: off };
    return off;
  }

  function drawFsTable() {
    var m = _fsMetrics = computeFsMetrics();
    VH = m.handTopY;

    var layer = getFsTableLayer(m);
    ctx.drawImage(layer, 0, 0, W, H);

    _discardFlyMatched = false;
    drawFsOpponentsTop(m);
    drawFsWalls(m, 'top');
    drawFsWalls(m, 'sides');
    drawFsCompass(m);
    drawFsDiscards(m);
    drawFsOpponentsSides(m);
    drawFsWalls(m, 'bottom');
    drawFsOwnHandAndMelds(m);
    drawFsPlayerCards(m);
    drawDiscardFly();
    drawClaimEffects();
    drawScorePanel();
    drawFsScoreFloats(m);
  }

  function drawFsSideTileBack(x, y, w, h, side) {
    drawSideTileBack25D(x, y, w, h, side || 'left');
  }

  function meldGroupTiles(md) {
    var cnt = md.type === 'kong' ? 4 : 3;
    var out = [];
    for (var i = 0; i < cnt; i++) {
      out.push((md.tiles && md.tiles[i]) || md.tile || null);
    }
    return out;
  }

  function rowPerspective(yNorm, fsMode) {
    var t = clamp(yNorm, 0, 1);
    if (fsMode) {
      return { sx: 0.84 + 0.18 * t, sy: 0.76 + 0.24 * t };
    }
    return { sx: 0.90 + 0.12 * t, sy: 0.84 + 0.16 * t };
  }

  function drawFsOpponentsTop(m) {
    var seats = _state.hands.length;
    var gap = 2;
    for (var s = 0; s < seats; s++) {
      if (s === _playerIndex) continue;
      if (seatPos(s) !== 'top') continue;
      var count = handCount(s);
      var melds = (_state.melds && _state.melds[s]) || [];
      var pt = project(0.5, 0.025);
      var tw = clamp(Math.round(m.baseOppW * pt.s), 13, 28);
      var th = Math.round(tw * 1.24);
      var y0 = Math.round(pt.y - th * 0.2);

      // 对家明牌（比河牌大，紧邻对家暗牌左侧，180° 倒置朝向桌面）
      var mw = Math.max(14, Math.round(tw * 1.08));
      var mh = Math.round(mw * 1.22);
      var mGap = 2, groupGap = 5;
      var meldW = 0;
      for (var mg = 0; mg < melds.length; mg++) {
        meldW += (melds[mg].type === 'kong' ? 4 : 3) * (mw + mGap) - mGap + groupGap;
      }
      var backsW = count > 0 ? count * (tw + gap) - gap : 0;
      var x0 = Math.round(pt.x - backsW / 2);
      var leftEdge = x0 - (meldW > 0 ? meldW + 6 : 0);
      if (leftEdge < m.topLeftClear) x0 += (m.topLeftClear - leftEdge);
      var maxRight = m.oppCard.x - 6;
      if (x0 + backsW > maxRight) x0 = Math.max(m.topLeftClear + meldW, maxRight - backsW);

      if (meldW > 0) {
        var mx = x0 - meldW - 4;
        var my = y0 + Math.round((th - mh) * 0.5);
        for (var g = 0; g < melds.length; g++) {
          var gt = meldGroupTiles(melds[g]);
          for (var k = 0; k < gt.length; k++) {
            if (melds[g].concealed || !gt[k]) drawWallTileSprite(mx, my, mw, mh, 'h');
            else drawTileFace(mx, my, mw, mh, gt[k], false, { slabRatio: 0.14, rot: 180 });
            mx += mw + mGap;
          }
          mx += groupGap - mGap;
        }
      }
      for (var i = 0; i < count; i++) {
        drawTopTileBack25D(x0 + i * (tw + gap), y0, tw, th);
      }
      m.oppTopY = y0;
      m.topRowBottom = y0 + th;
      m.oppRowRight = count > 0 ? (x0 + backsW) : (m.tableCx + 20);
    }
  }

  function drawFsOpponentsSides(m) {
    var seats = _state.hands.length;
    for (var s = 0; s < seats; s++) {
      if (s === _playerIndex) continue;
      var pos = seatPos(s);
      if (pos !== 'left' && pos !== 'right') continue;
      var count = handCount(s);
      var melds = (_state.melds && _state.melds[s]) || [];
      var txNorm = pos === 'left' ? 0.044 : 0.956;
      var rot = pos === 'left' ? 90 : -90;

      // 统一自远及近排列：暗手立牌在前，明牌组紧邻近端
      var items = [];
      for (var i = 0; i < count; i++) {
        items.push({ kind: 'back', weight: 0.78 });
      }
      if (count > 0 && melds.length > 0) {
        items.push({ kind: 'gap', weight: 0.55 });
      }
      for (var g = 0; g < melds.length; g++) {
        if (g > 0) items.push({ kind: 'gap', weight: 0.36 });
        var gt = meldGroupTiles(melds[g]);
        for (var k = 0; k < gt.length; k++) {
          items.push({ kind: 'meld', concealed: !!melds[g].concealed, tile: gt[k], weight: 1.05 });
        }
      }
      if (items.length === 0) continue;

      var totalWeight = 0;
      for (var wi = 0; wi < items.length; wi++) totalWeight += items[wi].weight;
      var minY = 0.14, maxY = 0.88;
      var spanY = maxY - minY;
      var stepUnit = Math.min(0.036, spanY / Math.max(1, totalWeight));
      var usedSpan = totalWeight * stepUnit;
      var curY = minY + (spanY - usedSpan) * 0.5;

      for (var idx = 0; idx < items.length; idx++) {
        var it = items[idx];
        var centerY = curY + it.weight * stepUnit * 0.5;
        curY += it.weight * stepUnit;
        if (it.kind === 'gap') continue;

        var pt = project(txNorm, centerY);
        if (it.kind === 'back') {
          var tw_j = Math.max(12, Math.round(m.baseOppW * 1.04 * pt.s));
          var th_j = Math.max(7, Math.round(m.baseSideRiverH * 0.88 * pt.s));
          var bx = pos === 'left' ? Math.round(pt.x - tw_j * 0.42) : Math.round(pt.x - tw_j * 0.58);
          var by = Math.round(pt.y - th_j * 0.5);
          drawFsSideTileBack(bx, by, tw_j, th_j, pos);
        } else {
          // 明牌比侧边河牌大
          var mh = Math.max(11, Math.round(m.baseSideRiverH * 1.18 * pt.s));
          var mw = Math.max(15, Math.round(mh * 1.32));
          var mx = pos === 'left' ? Math.round(pt.x - mw * 0.35) : Math.round(pt.x - mw * 0.65);
          var my = Math.round(pt.y - mh * 0.5);
          if (it.concealed || !it.tile) drawWallTileSprite(mx, my, mw, mh, 'v');
          else drawTileFace(mx, my, mw, mh, it.tile, false, { slabRatio: 0.14, rot: rot });
        }
      }
    }
  }

  function computeWallDistribution() {
    var wallCount = getWallCount();
    if (wallCount === null || wallCount <= 0) {
      return { counts: [0, 0, 0, 0], sideCap: 0, startStack: [0, 0, 0, 0], endStack: [0, 0, 0, 0], leadSingle: [false, false, false, false] };
    }
    var sideCap = Math.max(isCantonese() ? 17 : 14, Math.ceil(wallCount / 8));
    var sideTiles = sideCap * 2;
    var totalCap = sideTiles * 4;
    var drawn = Math.max(0, totalCap - wallCount);

    var dPos = seatPos(getDealerIndex());
    var sideIdxMap = { bottom: 0, left: 1, top: 2, right: 3 };
    var dealerSide = sideIdxMap[dPos] !== undefined ? sideIdxMap[dPos] : 0;
    var breakKeep = Math.min(3, Math.floor(sideCap / 3));
    var headTiles = (sideCap - breakKeep) * 2;

    var segments = [
      { side: dealerSide, len: headTiles, fromEnd: false },
      { side: (dealerSide + 1) % 4, len: sideTiles, fromEnd: false },
      { side: (dealerSide + 2) % 4, len: sideTiles, fromEnd: false },
      { side: (dealerSide + 3) % 4, len: sideTiles, fromEnd: false },
      { side: dealerSide, len: breakKeep * 2, fromEnd: true }
    ];

    var startRemoved = [0, 0, 0, 0];
    var tailRemoved = [0, 0, 0, 0];
    var remDrawn = drawn;
    for (var si = 0; si < segments.length && remDrawn > 0; si++) {
      var seg = segments[si];
      var take = Math.min(remDrawn, seg.len);
      if (seg.fromEnd) tailRemoved[seg.side] += take;
      else startRemoved[seg.side] += take;
      remDrawn -= take;
    }

    var counts = [0, 0, 0, 0];
    var startStack = [0, 0, 0, 0];
    var endStack = [0, 0, 0, 0];
    var leadSingle = [false, false, false, false];
    for (var s = 0; s < 4; s++) {
      var sr = startRemoved[s];
      var tr = tailRemoved[s];
      var left = Math.max(0, sideTiles - sr - tr);
      counts[s] = left;
      startStack[s] = Math.floor(sr / 2);
      leadSingle[s] = (sr % 2 === 1) && left > 0;
      endStack[s] = sideCap - Math.ceil(tr / 2);
    }
    return { counts: counts, sideCap: sideCap, startStack: startStack, endStack: endStack, leadSingle: leadSingle };
  }

  function drawFsWalls(m, which) {
    var dist = computeWallDistribution();
    var cap = dist.sideCap;
    if (!cap) return;

    function stackTileCount(side, idx) {
      if (idx < dist.startStack[side] || idx >= dist.endStack[side]) return 0;
      if (idx === dist.startStack[side] && dist.leadSingle[side]) return 1;
      return 2;
    }

    if (which === 'top') {
      // 对家牌墙 (side = 2): 从右到左顺时针推进
      for (var ti = cap - 1; ti >= 0; ti--) {
        var tc = stackTileCount(2, ti);
        if (!tc) continue;
        var tx = 0.78 - (cap > 1 ? (ti / (cap - 1)) * 0.56 : 0.28);
        var ptT = project(tx, 0.106);
        var tw = Math.max(9, Math.round(m.baseOppW * 0.78 * ptT.s));
        var th = Math.max(7, Math.round(tw * 0.92));
        drawWallStack(Math.round(ptT.x - tw * 0.5), Math.round(ptT.y - th * 0.5), tw, th, tc, 'h');
      }
    } else if (which === 'bottom') {
      // 己方牌墙 (side = 0): 从左到右顺时针推进
      for (var bi = 0; bi < cap; bi++) {
        var bc = stackTileCount(0, bi);
        if (!bc) continue;
        var bx = 0.22 + (cap > 1 ? (bi / (cap - 1)) * 0.56 : 0.28);
        var ptB = project(bx, 0.945);
        var bw = Math.max(10, Math.round(m.baseOppW * 0.78 * ptB.s));
        var bh = Math.max(8, Math.round(bw * 0.92));
        drawWallStack(Math.round(ptB.x - bw * 0.5), Math.round(ptB.y - bh * 0.5), bw, bh, bc, 'h');
      }
    } else if (which === 'sides') {
      // 左右两侧牌墙：统一按远到近 (y 小到大) 绘制，保证正确的遮挡顺序
      for (var step = 0; step < cap; step++) {
        var yNorm = 0.19 + (cap > 1 ? (step / (cap - 1)) * 0.64 : 0.32);
        // 左墙 (side = 1): 顺时针方向为从近到远，即 step 对应 (cap - 1 - step)
        var lc = stackTileCount(1, cap - 1 - step);
        if (lc) {
          var ptL = project(0.145, yNorm);
          var lw = Math.max(10, Math.round(m.baseOppW * 0.88 * ptL.s));
          var lh = Math.max(7, Math.round(m.baseSideRiverH * 0.72 * ptL.s));
          drawWallStack(Math.round(ptL.x - lw * 0.5), Math.round(ptL.y - lh * 0.5), lw, lh, lc, 'v');
        }
        // 右墙 (side = 3): 顺时针方向为从远到近，即 step 对应 step
        var rc = stackTileCount(3, step);
        if (rc) {
          var ptR = project(0.855, yNorm);
          var rw = Math.max(10, Math.round(m.baseOppW * 0.88 * ptR.s));
          var rh = Math.max(7, Math.round(m.baseSideRiverH * 0.72 * ptR.s));
          drawWallStack(Math.round(ptR.x - rw * 0.5), Math.round(ptR.y - rh * 0.5), rw, rh, rc, 'v');
        }
      }
    }
  }

  function drawFsCompass(m) {
    var cw = 0.094;
    var ch = 0.130;
    var bw = 0.011;
    var bh = 0.015;

    var oTL = project(0.5 - cw, 0.5 - ch);
    var oTR = project(0.5 + cw, 0.5 - ch);
    var oBR = project(0.5 + cw, 0.5 + ch);
    var oBL = project(0.5 - cw, 0.5 + ch);
    var iTL = project(0.5 - cw + bw, 0.5 - ch + bh);
    var iTR = project(0.5 + cw - bw, 0.5 - ch + bh);
    var iBR = project(0.5 + cw - bw, 0.5 + ch - bh);
    var iBL = project(0.5 - cw + bw, 0.5 + ch - bh);
    var C = project(0.5, 0.5);

    var dealerIdx = getDealerIndex();
    var myWind = ((_playerIndex - dealerIdx) % 4 + 4) % 4;
    var WINDS = ['东', '南', '西', '北'];
    var sideWinds = {
      bottom: WINDS[myWind],
      right: WINDS[(myWind + 1) % 4],
      top: WINDS[(myWind + 2) % 4],
      left: WINDS[(myWind + 3) % 4]
    };
    var activeActor = getActiveActor();
    var activePos = activeActor >= 0 ? seatPos(activeActor) : null;

    ctx.save();
    // 罗盘外阴影与立体斜边底座
    traceQuad(ctx,
      { x: oTL.x, y: oTL.y + 4 },
      { x: oTR.x, y: oTR.y + 4 },
      { x: oBR.x, y: oBR.y + 5 },
      { x: oBL.x, y: oBL.y + 5 }
    );
    ctx.fillStyle = 'rgba(0,0,0,.46)';
    ctx.fill();

    traceQuad(ctx, oTL, oTR, oBR, oBL);
    var rimGrad = ctx.createLinearGradient(0, oTL.y, 0, oBL.y);
    rimGrad.addColorStop(0, '#2a5a44');
    rimGrad.addColorStop(1, '#10281c');
    ctx.fillStyle = rimGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,164,92,.58)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 四个斜切面微弱高光
    traceQuad(ctx, oTL, oTR, iTR, iTL);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fill();
    traceQuad(ctx, iBL, iBR, oBR, oBL);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fill();

    // 四个三角形方位区（轮到的玩家扇区高亮发光，其余暗底）
    var segs = [
      { key: 'top', p1: iTL, p2: iTR, wx: 0.5, wy: 0.5 - ch * 0.68 },
      { key: 'right', p1: iTR, p2: iBR, wx: 0.5 + cw * 0.68, wy: 0.5 },
      { key: 'bottom', p1: iBR, p2: iBL, wx: 0.5, wy: 0.5 + ch * 0.68 },
      { key: 'left', p1: iBL, p2: iTL, wx: 0.5 - cw * 0.68, wy: 0.5 }
    ];

    for (var si = 0; si < segs.length; si++) {
      var seg = segs[si];
      var isAct = activePos === seg.key;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(C.x, C.y);
      ctx.lineTo(seg.p1.x, seg.p1.y);
      ctx.lineTo(seg.p2.x, seg.p2.y);
      ctx.closePath();
      if (isAct) {
        var actGrad = ctx.createLinearGradient(C.x, seg.p1.y, C.x, seg.p2.y);
        actGrad.addColorStop(0, '#f7d568');
        actGrad.addColorStop(1, '#d89b26');
        ctx.fillStyle = actGrad;
        ctx.shadowColor = 'rgba(245,196,81,.75)';
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = '#0e2218';
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isAct ? 'rgba(255,248,210,.65)' : 'rgba(200,164,92,.28)';
      ctx.lineWidth = 1;
      ctx.stroke();

      var wp = project(seg.wx, seg.wy);
      var wFont = Math.max(9, Math.round((oBR.x - oBL.x) * 0.13));
      ctx.font = 'bold ' + wFont + 'px system-ui,"Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isAct ? '#1b1404' : 'rgba(218,236,225,.52)';
      ctx.fillText(sideWinds[seg.key], wp.x, wp.y);
      ctx.restore();
    }

    // 中央嵌入数字显示屏（倒计时 / 余牌数）
    var sw = cw * 0.44;
    var sh = ch * 0.44;
    var sTL = project(0.5 - sw, 0.5 - sh);
    var sTR = project(0.5 + sw, 0.5 - sh);
    var sBR = project(0.5 + sw, 0.5 + sh);
    var sBL = project(0.5 - sw, 0.5 + sh);
    traceQuad(ctx, sTL, sTR, sBR, sBL);
    ctx.fillStyle = '#07140e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,164,92,.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    var dispW = sBR.x - sBL.x;
    var secLeft = getTurnSecondsLeft();
    var wallCount = getWallCount();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (secLeft !== null) {
      var numFont = Math.max(13, Math.round(dispW * 0.44));
      ctx.font = '700 ' + numFont + 'px ui-monospace,"SFMono-Regular","Cascadia Mono","Consolas",monospace';
      ctx.fillStyle = secLeft <= 5 ? '#ff7b7b' : '#ffe49c';
      ctx.fillText(String(secLeft), C.x, C.y - (wallCount !== null ? dispW * 0.10 : 0));
      if (wallCount !== null) {
        var subFont = Math.max(8, Math.round(dispW * 0.21));
        ctx.font = '700 ' + subFont + 'px ui-monospace,"SFMono-Regular","Cascadia Mono","Consolas",monospace';
        ctx.fillStyle = 'rgba(180,235,205,.78)';
        ctx.fillText(String(wallCount), C.x, C.y + dispW * 0.24);
      }
    } else if (wallCount !== null) {
      var wOnlyFont = Math.max(12, Math.round(dispW * 0.40));
      ctx.font = '700 ' + wOnlyFont + 'px ui-monospace,"SFMono-Regular","Cascadia Mono","Consolas",monospace';
      ctx.fillStyle = '#a8f5ce';
      ctx.fillText(String(wallCount), C.x, C.y);
    }

    // 局数 · 底分 放在左上角（64px 返回按钮下方，不遮挡桌面）
    var rn = _state.roundNumber || 1;
    var info = t('mj_round_label', '第') + rn + t('mj_round_unit', '局');
    var baseScore = typeof _state.baseScore === 'number' ? _state.baseScore
      : (typeof _state.basePoints === 'number' ? _state.basePoints
      : (typeof _state.ante === 'number' ? _state.ante
      : (_state.cfg && typeof _state.cfg.baseScore === 'number' ? _state.cfg.baseScore : null)));
    if (baseScore !== null) info += ' · ' + t('mj_base_score', '底分') + ' ' + baseScore;
    ctx.font = '600 11px system-ui,"Microsoft YaHei",sans-serif';
    var infoW = Math.ceil(ctx.measureText(info).width) + 16;
    ctx.fillStyle = 'rgba(10,24,17,.74)';
    roundRect(10, 60, infoW, 22, 11);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,164,92,.32)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.textAlign = 'left';
    ctx.fillText(info, 18, 71);
    ctx.restore();
  }

  function drawFsDiscards(m) {
    if (!_state.discards) return;
    var COLS = 6;
    var lastId = _state.lastDiscard && _state.lastDiscard.id;
    var reduced = prefersReducedMotion();
    var lastMarker = null;

    function drawRiverTile(tile, tx, ty, rot) {
      var pt = project(tx, ty);
      var rw, rh;
      if (rot === 90 || rot === -90) {
        rh = Math.max(9, Math.round(m.baseSideRiverH * pt.s));
        rw = Math.max(12, Math.round(rh * 1.30));
      } else {
        rw = Math.max(10, Math.round(0.0365 * m.nearW * pt.s));
        rh = Math.max(12, Math.round(rw * 1.24));
      }
      var rx = Math.round(pt.x - rw * 0.5);
      var ry = Math.round(pt.y - rh * 0.5);
      var isLast = !!(lastId && tile.id === lastId);
      var isFlying = !!(_discardFly && _discardFly.tileId === tile.id);
      if (isFlying) {
        _discardFlyMatched = true;
        _discardFly.target = { x: rx, y: ry, w: rw, h: rh, rot: rot };
        if (!reduced) return;
      }

      ctx.save();
      if (isFlying && reduced) {
        ctx.globalAlpha = clamp((nowMs() - _discardFly.start) / _discardFly.duration, 0, 1);
      }
      if (isLast && _lastDiscardPulse > 0.01) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245,196,81,' + (0.72 * _lastDiscardPulse) + ')';
        ctx.lineWidth = 2 + 2 * _lastDiscardPulse;
        var pad = 2 + 3.5 * _lastDiscardPulse;
        roundRect(rx - pad, ry - pad, rw + pad * 2, rh + tileSlabH(rh, 0.14) + pad * 2, 5);
        ctx.stroke();
        ctx.restore();
      }
      drawTileFace(rx, ry, rw, rh, tile, isLast ? 3 : 0, { slabRatio: 0.14, rot: rot });
      ctx.restore();

      if (isLast && !isFlying) {
        lastMarker = { x: rx + rw * 0.5, y: ry - 4 };
      }
    }

    // 1. 对家牌河（上方，180° 倒置，自远行向近行绘制）
    for (var sTop = 0; sTop < _state.discards.length; sTop++) {
      if (seatPos(sTop) !== 'top') continue;
      var tPile = _state.discards[sTop] || [];
      if (!tPile.length) continue;
      var tRows = Math.ceil(tPile.length / COLS);
      var tRowH = tRows > 3 ? Math.min(0.074, 0.20 / tRows) : 0.074;
      for (var tr = tRows - 1; tr >= 0; tr--) {
        var tRowCount = Math.min(COLS, tPile.length - tr * COLS);
        for (var tc = 0; tc < tRowCount; tc++) {
          var tIdx = tr * COLS + tc;
          drawRiverTile(tPile[tIdx], 0.5 + (2.5 - tc) * 0.039, 0.335 - tr * tRowH, 180);
        }
      }
    }

    // 2. 左右家牌河（同时按从远到近的列索引绘制）
    var leftPile = null, rightPile = null;
    for (var sSide = 0; sSide < _state.discards.length; sSide++) {
      var sp = seatPos(sSide);
      if (sp === 'left') leftPile = _state.discards[sSide] || [];
      else if (sp === 'right') rightPile = _state.discards[sSide] || [];
    }
    var lRows = leftPile && leftPile.length ? Math.ceil(leftPile.length / COLS) : 0;
    var rRows = rightPile && rightPile.length ? Math.ceil(rightPile.length / COLS) : 0;
    var lStepX = lRows > 3 ? Math.min(0.052, 0.17 / lRows) : 0.052;
    var rStepX = rRows > 3 ? Math.min(0.052, 0.17 / rRows) : 0.052;
    for (var step = 0; step < COLS; step++) {
      var tySide = 0.375 + step * 0.050;
      if (lRows > 0) {
        for (var lr = 0; lr < lRows; lr++) {
          var lIdx = lr * COLS + step;
          if (lIdx < leftPile.length) {
            drawRiverTile(leftPile[lIdx], 0.365 - lr * lStepX, tySide, 90);
          }
        }
      }
      if (rRows > 0) {
        var rCol = COLS - 1 - step;
        for (var rr = 0; rr < rRows; rr++) {
          var rIdx = rr * COLS + rCol;
          if (rIdx < rightPile.length) {
            drawRiverTile(rightPile[rIdx], 0.635 + rr * rStepX, tySide, -90);
          }
        }
      }
    }

    // 3. 己方牌河（下方，0° 正立，自近罗盘向自己增长）
    for (var sBot = 0; sBot < _state.discards.length; sBot++) {
      if (seatPos(sBot) !== 'bottom') continue;
      var bPile = _state.discards[sBot] || [];
      if (!bPile.length) continue;
      var bRows = Math.ceil(bPile.length / COLS);
      var bRowH = bRows > 3 ? Math.min(0.078, 0.23 / bRows) : 0.078;
      for (var br = 0; br < bRows; br++) {
        var bRowCount = Math.min(COLS, bPile.length - br * COLS);
        for (var bc = 0; bc < bRowCount; bc++) {
          var bIdx = br * COLS + bc;
          drawRiverTile(bPile[bIdx], 0.5 + (bc - 2.5) * 0.039, 0.665 + br * bRowH, 0);
        }
      }
    }

    // 最新弃牌上方小指针
    if (lastMarker) {
      ctx.save();
      ctx.fillStyle = '#f5c451';
      ctx.strokeStyle = 'rgba(10,24,17,.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lastMarker.x, lastMarker.y + 2);
      ctx.lineTo(lastMarker.x - 4.5, lastMarker.y - 5);
      ctx.lineTo(lastMarker.x + 4.5, lastMarker.y - 5);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFsOwnHandAndMelds(m) {
    var hand = _state.hands[_playerIndex];
    var melds = (_state.melds && _state.melds[_playerIndex]) || [];
    var hasHand = Array.isArray(hand) && hand.length > 0;
    _layout = [];
    _lastHandTileRects = {};
    if (!hasHand && melds.length === 0) return;

    var n = hasHand ? hand.length : 0;
    var gap = 2;
    var drawnGap = 8;
    var meldScale = 0.72;
    var meldGap = 2;
    var groupGap = 6;
    var handMeldGap = 12;

    // 计算手牌（新摸牌放最右并留出间隔）与右侧明牌的总宽度
    var drawnIdx = -1;
    var order = [];
    if (hasHand) {
      var drawnId = (_state.currentPlayer === _playerIndex && _state.phase === 'play') ? _state.drawn : null;
      for (var i = 0; i < n; i++) {
        if (drawnId && hand[i].id === drawnId && drawnIdx === -1) drawnIdx = i;
        else order.push(i);
      }
      if (drawnIdx >= 0) order.push(drawnIdx);
    }

    var meldTileCount = 0;
    for (var g = 0; g < melds.length; g++) {
      meldTileCount += melds[g].type === 'kong' ? 4 : 3;
    }

    var tw = TW, th = TH;
    var mw = Math.round(tw * meldScale);
    var mh = Math.round(th * meldScale);
    var availW = W - 20;

    function calcTotalW(curTw, curMw) {
      var hw = n > 0 ? n * curTw + Math.max(0, n - 1) * gap + (drawnIdx >= 0 && n > 1 ? drawnGap : 0) : 0;
      var mWidth = melds.length > 0
        ? meldTileCount * curMw + Math.max(0, meldTileCount - melds.length) * meldGap + Math.max(0, melds.length - 1) * groupGap
        : 0;
      return { hw: hw, mw: mWidth, total: hw + (hw > 0 && mWidth > 0 ? handMeldGap : 0) + mWidth };
    }

    var dims = calcTotalW(tw, mw);
    if (dims.total > availW) {
      var ratio = availW / dims.total;
      tw = Math.max(24, Math.floor(tw * ratio));
      th = Math.round(tw * 1.4);
      mw = Math.max(18, Math.round(tw * meldScale));
      mh = Math.round(mw * 1.4);
      dims = calcTotalW(tw, mw);
    }

    var slabH = tileSlabH(th, 0.12);
    var startX = Math.round((W - dims.total) / 2);
    var baseY = H - th - slabH - m.handBottomPad;
    var curX = startX;
    var reduced = prefersReducedMotion();

    for (var oi = 0; oi < order.length; oi++) {
      var idx = order[oi];
      if (oi === order.length - 1 && idx === drawnIdx && oi > 0) curX += drawnGap;
      var tile = hand[idx];
      var isDrawn = idx === drawnIdx;
      var isSwapSel = _state.phase === 'swap' && _swapSelected && _swapSelected.indexOf(tile.id) >= 0;
      var hover = _hoverIdx === idx;
      var lift = isSwapSel ? -Math.round(th * 0.14) : (hover ? -Math.round(th * 0.12) : (isDrawn ? -Math.round(th * 0.09) : 0));

      var slideDx = 0;
      var slideAlpha = 1;
      if (_drawSlide && _drawSlide.tileId === tile.id) {
        var st = clamp((nowMs() - _drawSlide.start) / _drawSlide.duration, 0, 1);
        if (st < 1) {
          if (reduced) {
            slideAlpha = st;
          } else {
            var sp = easeOutDiscard(st);
            slideDx = Math.round((1 - sp) * (tw * 1.15 + 16));
            slideAlpha = Math.min(1, 0.25 + 0.75 * sp);
          }
        }
      }

      var drawX = curX + slideDx;
      var drawY = baseY + lift;

      ctx.save();
      if (slideAlpha < 1) ctx.globalAlpha = slideAlpha;
      if (isSwapSel) {
        ctx.save();
        ctx.shadowColor = 'rgba(200,164,92,.7)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#c8a45c';
        ctx.lineWidth = 3;
        roundRect(drawX - 3, drawY - 3, tw + 6, th + slabH + 6, 8);
        ctx.stroke();
        ctx.restore();
      }
      if (isDrawn && _drawPulse > 0.01) {
        ctx.save();
        ctx.shadowColor = 'rgba(6,182,212,' + (0.65 * _drawPulse) + ')';
        ctx.shadowBlur = 14 + 8 * _drawPulse;
        ctx.fillStyle = 'rgba(6,182,212,' + (0.10 * _drawPulse) + ')';
        roundRect(drawX - 4, drawY - 4, tw + 8, th + slabH + 8, 8);
        ctx.fill();
        ctx.restore();
      }
      drawTileFace(drawX, drawY, tw, th, tile, hover ? 1 : (isDrawn ? 2 : 0), { shadow: true, lift: lift, slabRatio: 0.12 });
      if (isDrawn) {
        ctx.save();
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(drawX + tw - 8, drawY + 8, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t('mj_new_tile', '新'), drawX + tw - 8, drawY + 8.5);
        ctx.restore();
      }
      ctx.restore();

      if (tile && tile.id) _lastHandTileRects[tile.id] = { x: curX, y: drawY, w: tw, h: th };
      _layout.push({ x: curX, y: drawY, w: tw, h: th + slabH - lift, idx: idx });
      curX += tw + gap;
    }

    // 自己的明牌摆在手牌右侧，底部对齐
    if (melds.length > 0) {
      var mx = startX + dims.hw + (dims.hw > 0 ? handMeldGap : 0);
      var mSlab = tileSlabH(mh, 0.11);
      var my = H - mh - mSlab - m.handBottomPad;
      for (var mg = 0; mg < melds.length; mg++) {
        var gt = meldGroupTiles(melds[mg]);
        for (var gk = 0; gk < gt.length; gk++) {
          if (melds[mg].concealed || !gt[gk]) drawTileBack(mx, my, mw, mh);
          else drawTileFace(mx, my, mw, mh, gt[gk], false, { slabRatio: 0.11 });
          mx += mw + meldGap;
        }
        mx += groupGap - meldGap;
      }
    }
  }

  function drawFsPlayerCards(m) {
    var n = _state.hands.length;
    var dealerIdx = getDealerIndex();
    var activeActor = getActiveActor();
    var winners = winnersOf(_state);
    var cumScore = Array.isArray(_state.cumulativeScore) ? _state.cumulativeScore : [];

    for (var s = 0; s < n; s++) {
      var pos = seatPos(s);
      var card = pos === 'bottom' ? m.meCard
        : pos === 'left' ? m.leftCard
        : pos === 'top' ? m.oppCard
        : m.rightCard;
      if (!card) continue;

      var isActive = s === activeActor;
      var isDealer = s === dealerIdx;
      var isWinner = winners.indexOf(s) >= 0;
      var score = typeof cumScore[s] === 'number' ? cumScore[s] : 0;
      var name = getSeatName(s);
      var av = getSeatAvatar(s);
      var vs = !isCantonese() && _state.voidSuit ? _state.voidSuit[s] : null;
      var compact = pos === 'left' || pos === 'right';

      ctx.save();
      // 卡片底色
      ctx.fillStyle = isActive ? 'rgba(22, 46, 32, 0.94)' : 'rgba(10, 24, 17, 0.84)';
      roundRect(card.x, card.y, card.w, card.h, 10);
      ctx.fill();

      // 回合高亮环 / 赢家 / 普通边框
      if (isActive) {
        ctx.shadowColor = 'rgba(245, 196, 81, 0.72)';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#f5c451';
        ctx.lineWidth = 2.2;
      } else if (isWinner) {
        ctx.strokeStyle = '#e05050';
        ctx.lineWidth = 1.8;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 1;
      }
      roundRect(card.x, card.y, card.w, card.h, 10);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 头像圆圈
      var avR = compact ? Math.min(12, Math.floor(card.h * 0.27)) : Math.min(14, Math.floor(card.h * 0.34));
      var avX = card.x + 8 + avR;
      var avY = compact ? (card.y + 8 + avR) : (card.y + card.h / 2);
      ctx.fillStyle = s === _playerIndex ? 'rgba(200, 164, 92, 0.28)' : 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.arc(avX, avY, avR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isActive ? 'rgba(245, 196, 81, 0.8)' : 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = (av.isEmoji ? '' : 'bold ') + Math.round(avR * 1.15) + 'px system-ui,"Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(av.text, avX, avY + 0.5);

      // 庄 / Dealer 角标
      var badgeW = 0;
      if (isDealer) {
        var bTxt = t('mj_dealer_badge', '庄');
        ctx.font = 'bold 10px system-ui,"Microsoft YaHei",sans-serif';
        badgeW = Math.ceil(ctx.measureText(bTxt).width) + 8;
        var bx = card.x + card.w - badgeW - 5;
        var by = card.y + 4;
        ctx.fillStyle = '#d97706';
        roundRect(bx, by, badgeW, 15, 5);
        ctx.fill();
        ctx.fillStyle = '#fff8dc';
        ctx.fillText(bTxt, bx + badgeW / 2, by + 8);
      }

      // 四川定缺小标
      var vsW = 0;
      if (vs) {
        var vsTxt = SUIT_GLYPH[vs] || '';
        var vsCol = vs === 'wan' ? '#e05050' : vs === 'tong' ? '#3a8fd4' : '#3eb870';
        vsW = 16;
        var vx = card.x + card.w - vsW - 5;
        var vy = card.y + card.h - 19;
        ctx.fillStyle = vsCol;
        roundRect(vx, vy, 15, 15, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px system-ui,"Microsoft YaHei",sans-serif';
        ctx.fillText(vsTxt, vx + 7.5, vy + 8);
      }

      // 名字与积分
      var textX = avX + avR + 6;
      var textMaxW = Math.max(24, card.x + card.w - textX - 6 - (isDealer ? badgeW + 2 : 0));
      ctx.textAlign = 'left';
      ctx.fillStyle = isWinner ? '#ff8787' : '#ffffff';
      ctx.font = 'bold 11px system-ui,"Microsoft YaHei",sans-serif';
      if (compact) {
        ctx.fillText(truncText(name, textMaxW), textX, avY);
        var scoreMaxW = Math.max(30, card.w - 14 - (vsW ? vsW + 4 : 0));
        ctx.fillStyle = '#ffe49c';
        ctx.font = 'bold 12px system-ui,"Microsoft YaHei",sans-serif';
        ctx.fillText((score > 0 ? '+' : '') + score + t('mj_score', '分'), card.x + 8, card.y + card.h - 11, scoreMaxW);
      } else {
        ctx.fillText(truncText(name, textMaxW), textX, card.y + Math.round(card.h * 0.34));
        ctx.fillStyle = '#ffe49c';
        ctx.font = 'bold 11px system-ui,"Microsoft YaHei",sans-serif';
        var scMax = Math.max(30, card.x + card.w - textX - 6 - (vsW ? vsW + 4 : 0));
        ctx.fillText((score > 0 ? '+' : '') + score + t('mj_score', '分'), textX, card.y + Math.round(card.h * 0.72), scMax);
      }
      ctx.restore();
    }
  }

  function triggerEndOfRoundScoreFloats(state, prevSnap) {
    if (!isFs() || !state || !state.hands) return;
    var rn = state.roundNumber || 1;
    var key = 'r' + rn;
    if (_scoreFloatRoundKey === key) return;
    _scoreFloatRoundKey = key;

    var rs = state.roundScores;
    var curCum = Array.isArray(state.cumulativeScore) ? state.cumulativeScore : null;
    var prevCum = prevSnap && Array.isArray(prevSnap.cumulativeScore) ? prevSnap.cumulativeScore : null;
    var now = nowMs();

    for (var s = 0; s < state.hands.length; s++) {
      var delta = 0;
      if (rs && typeof rs[s] === 'number' && rs[s] !== 0) {
        delta = rs[s];
      } else if (curCum && prevCum && typeof curCum[s] === 'number' && typeof prevCum[s] === 'number') {
        delta = curCum[s] - prevCum[s];
      }
      if (!delta) continue;
      var val = Math.round(delta * 10) / 10;
      if (val === 0) continue;
      _scoreFloats.push({
        seat: s,
        delta: val,
        text: (val > 0 ? '+' : '') + val,
        birth: now,
        duration: 900
      });
    }
  }

  function drawFsScoreFloats(m) {
    if (!_scoreFloats.length) return;
    var now = nowMs();
    var reduced = prefersReducedMotion();
    for (var i = 0; i < _scoreFloats.length; i++) {
      var f = _scoreFloats[i];
      var t = clamp((now - f.birth) / f.duration, 0, 1);
      if (t >= 1) continue;
      var pos = seatPos(f.seat);
      var card = pos === 'bottom' ? m.meCard
        : pos === 'left' ? m.leftCard
        : pos === 'top' ? m.oppCard
        : m.rightCard;
      if (!card) continue;
      var p = easeOutDiscard(t);
      var rise = reduced ? 0 : Math.round(p * 34);
      var alpha = t < 0.15 ? (t / 0.15) : (t > 0.72 ? (1 - t) / 0.28 : 1);
      var fx = Math.round(card.x + card.w * 0.5);
      var fy = Math.round(card.y - 6 - rise);

      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.font = '800 18px system-ui,"Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(6,16,10,.88)';
      ctx.strokeText(f.text, fx, fy);
      ctx.fillStyle = f.delta > 0 ? '#51cf66' : '#ff6b6b';
      ctx.fillText(f.text, fx, fy);
      ctx.restore();
    }
  }

  // 牌库余量显示：四川读 deck，广东读 wall（数字），显示在玩家右下角
  function drawWallCount() {
    var count = typeof _state.deckCount === 'number' ? _state.deckCount
      : _state.deck ? _state.deck.length
      : typeof _state.wall === 'number' ? _state.wall : null;
    var line = t('mj_round_label', '第') + (_state.roundNumber || 1) + t('mj_round_unit', '局');
    if (_state && _state._wildcard) line += ' · ' + t('mj_rule_wildcard', '红中百搭');
    if (count !== null) line += ' · ' + t('mj_wall_left', '余牌: ') + count;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '12px system-ui,"Microsoft YaHei",sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(line, W - 12, H - 6);
    ctx.restore();
  }

  // 对手牌背尺寸（与 drawOpponents 一致，高亮框和名字跟着它走）
  function oppScale() {
    if (isFs()) {
      var maxOppH = Math.max(16, (VH - 70) / 7 - 2);
      return Math.min((W < 500 || H < 500) ? 0.3 : 0.44, maxOppH / TH);
    }
    return (W < 500 || H < 500) ? 0.28 : 0.5;
  }
  function oppTW() { return Math.round(TW * oppScale()); }
  function oppTH() { return Math.round(TH * oppScale()); }

  function drawOpponents() {
    var seats = _state.hands.length;
    // 对手牌背：对家横排立牌；左右家 2.5D 透视两列纵排（远端略窄）
    var tw = oppTW(), th = oppTH();
    var topTh = Math.max(10, Math.round(th * 0.86));
    var gap = 2;
    var sideCols = 2; // 左右家每行摆 2 张（打横），然后向下延伸
    for (var s = 0; s < seats; s++) {
      if (s === _playerIndex) continue;
      var count = handCount(s);
      if (count === 0) continue;
      var pos = seatPos(s);

      if (pos === 'top') {
        // 对家：顶部横排居中（单行立牌）
        var totalW = count * (tw + gap) - gap;
        var x0 = (W - totalW) / 2;
        var y0 = 30;
        for (var i = 0; i < count; i++) drawTopTileBack25D(x0 + i * (tw + gap), y0, tw, topTh);
      } else if (pos === 'left') {
        // 左家：2.5D 透视纵列（顶部远端略窄、向内微收）
        var rowsL = Math.ceil(count / sideCols);
        var rowHL = th + gap;
        var gridHL = rowsL * rowHL;
        var startYL = (VH - gridHL) / 2;
        var startXL = 20;
        for (var k = 0; k < count; k++) {
          var rowL = Math.floor(k / sideCols);
          var colL = k % sideCols;
          var rtL = rowsL > 1 ? rowL / (rowsL - 1) : 0.5;
          var twL = Math.max(10, Math.round(tw * (0.84 + 0.18 * rtL)));
          var thL = Math.max(8, Math.round(th * (0.86 + 0.14 * rtL)));
          var inL = Math.round((1 - rtL) * tw * 0.25);
          drawSideTileBack25D(startXL + inL + colL * (twL + gap), startYL + rowL * rowHL, twL, thL, 'left');
        }
      } else {
        // 右家：2.5D 透视纵列（顶部远端略窄、向内微收）
        var rows = Math.ceil(count / sideCols);
        var rowH = th + gap;
        var gridH = rows * rowH;
        var startY = (VH - gridH) / 2;
        var gridW = sideCols * (tw + gap);
        var startX = W - gridW - 20;
        for (var j = 0; j < count; j++) {
          var row = Math.floor(j / sideCols);
          var col = j % sideCols;
          var rtR = rows > 1 ? row / (rows - 1) : 0.5;
          var twR = Math.max(10, Math.round(tw * (0.84 + 0.18 * rtR)));
          var thR = Math.max(8, Math.round(th * (0.86 + 0.14 * rtR)));
          var rowGridW = sideCols * (twR + gap) - gap;
          var inR = Math.round((1 - rtR) * tw * 0.25);
          var baseRX = (W - rowGridW - 20) - inR;
          if (baseRX < 0) baseRX = startX;
          drawSideTileBack25D(baseRX + col * (twR + gap), startY + row * rowH, twR, thR, 'right');
        }
      }
    }
  }


  // 自己手牌第一行的 y（与 drawOwnHand 的排法一致）
  function handTopY() {
    var hand = _state.hands[_playerIndex];
    var n = Array.isArray(hand) ? hand.length : 0;
    if (!n) return H;
    var rows = 1;
    if (W < 500 && n * (TW + 4) > W - 20) rows = Math.ceil(n / Math.max(4, Math.floor((W - 20) / (TW + 4))));
    var slabH = tileSlabH(TH, 0.12);
    return H - rows * (TH + slabH + 5) - handBottomPad();
  }
  // 手牌下沿留白：竖屏多留几像素，"第N局·余牌"不被轮到你的高亮框压住
  function handBottomPad() { return _portrait ? 22 : 14; }

  function drawOwnHand() {
    var hand = _state.hands[_playerIndex];
    _lastHandTileRects = {};
    if (!Array.isArray(hand) || hand.length === 0) return;
    var n = hand.length;
    var tw = TW, th = TH;
    var maxW = W - 20;
    var _isMobile = !isFs() && W < 500;
    // 多行布局（手机端手牌过多时换行，不压缩牌面大小）
    var useMultiRow = _isMobile && n * (tw + 4) > maxW;
    var rows = 1, perRow = n;
    if (useMultiRow) {
      perRow = Math.floor(maxW / (tw + 4));
      if (perRow < 4) perRow = 4;
      rows = Math.ceil(n / perRow);
    } else if (n * (tw + 4) > maxW) {
      tw = Math.floor((maxW - n * 4) / n); // 桌面端仍用压缩
      th = Math.round(tw * 1.4);
    }
    var slabH = tileSlabH(th, 0.12);
    var rowStep = th + slabH + 5;
    var totalW = (useMultiRow ? perRow : n) * (tw + 4);
    var startX = (W - totalW) / 2;
    // 垂直居中多行手牌
    var totalHandH = rows * rowStep;
    var y = H - totalHandH - handBottomPad();
    _layout = [];
    var reduced = prefersReducedMotion();
    for (var i = 0; i < n; i++) {
      var row = useMultiRow ? Math.floor(i / perRow) : 0;
      var col = useMultiRow ? (i % perRow) : i;
      var rowTiles = useMultiRow ? Math.min(perRow, n - row * perRow) : n;
      var rowW = rowTiles * (tw + 4);
      var rowStartX = (W - rowW) / 2;
      var x = rowStartX + col * (tw + 4);
      var tileY = y + row * rowStep;
      var isDrawn = _state.drawn && hand[i].id === _state.drawn && _state.currentPlayer === _playerIndex && _state.phase === 'play';
      var isSwapSel = _state.phase === 'swap' && _swapSelected && _swapSelected.indexOf(hand[i].id) >= 0;
      var hover = _hoverIdx === i;
      var lift = isSwapSel ? -Math.round(th * 0.14) : (hover ? -Math.round(th * 0.12) : (isDrawn ? -Math.round(th * 0.09) : 0));

      var slideDx = 0;
      var slideAlpha = 1;
      if (_drawSlide && _drawSlide.tileId === hand[i].id) {
        var st = clamp((nowMs() - _drawSlide.start) / _drawSlide.duration, 0, 1);
        if (st < 1) {
          if (reduced) {
            slideAlpha = st;
          } else {
            var sp = easeOutDiscard(st);
            slideDx = Math.round((1 - sp) * (tw * 1.15 + 16));
            slideAlpha = Math.min(1, 0.25 + 0.75 * sp);
          }
        }
      }

      var drawX = x + slideDx;
      var drawY = tileY + lift;

      ctx.save();
      if (slideAlpha < 1) ctx.globalAlpha = slideAlpha;
      // 换三张选中：金色粗边框 + 上浮
      if (isSwapSel) {
        ctx.save();
        ctx.shadowColor = 'rgba(200,164,92,.7)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#c8a45c';
        ctx.lineWidth = 3;
        roundRect(drawX - 3, drawY - 3, tw + 6, th + slabH + 6, 8);
        ctx.stroke();
        ctx.restore();
      }
      // 新摸牌青蓝外发光
      if (isDrawn && _drawPulse > 0.01) {
        ctx.save();
        ctx.shadowColor = 'rgba(6,182,212,' + (0.65 * _drawPulse) + ')';
        ctx.shadowBlur = 16 + 10 * _drawPulse;
        ctx.fillStyle = 'rgba(6,182,212,' + (0.10 * _drawPulse) + ')';
        roundRect(drawX - 4, drawY - 4, tw + 8, th + slabH + 8, 8);
        ctx.fill();
        ctx.restore();
      }
      var hl = hover ? 1 : (isDrawn ? 2 : 0);
      drawTileFace(drawX, drawY, tw, th, hand[i], hl, { shadow: true, lift: lift, slabRatio: 0.12 });
      // 新摸角标”新”
      if (isDrawn) {
        ctx.save();
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(drawX + tw - 9, drawY + 9, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t('mj_new_tile', '新'), drawX + tw - 9, drawY + 9.5);
        ctx.restore();
      }
      ctx.restore();
      if (hand[i] && hand[i].id) _lastHandTileRects[hand[i].id] = { x: x, y: drawY, w: tw, h: th };
      // 命中区向下延伸到原位：上浮后鼠标仍在牌下沿时不会失去悬停而来回闪
      _layout.push({ x: x, y: drawY, w: tw, h: th + slabH - lift, idx: i });
    }
    // 定缺花色（自己）：钉在手牌区左上角，缺什么就亮什么（仅四川）
    if (!isCantonese()) {
    var vs = _state.voidSuit && _state.voidSuit[_playerIndex];
    if (vs) {
      var vsLabel = vs === 'wan' ? '万' : vs === 'tong' ? '筒' : '条';
      var vsColor = vs === 'wan' ? '#ff6b6b' : vs === 'tong' ? '#4dabf7' : '#51cf66';
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#fff8dc';
      ctx.font = 'bold 13px system-ui,"Microsoft YaHei",sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      // x 留出左边距（色点不被画布裁掉），且躲开左家牌背那一列；竖屏左家在桌面区，不会碰到
      var vsX = Math.max(startX, _portrait ? 24 : 20 + 2 * (oppTW() + 2) + 24);
      var vsY = _portrait ? y - 18 : y - 22;
      ctx.fillText(t('mj_void_label', '定缺:') + ' ' + vsLabel, vsX, vsY);
      ctx.shadowColor = 'transparent';
      // 小色点（亮色描边）— 与文字垂直居中对齐
      ctx.fillStyle = vsColor;
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(vsX - 10, vsY, 6, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    } // end if (!isCantonese())
  }

  // 公共出牌区：中央一堆，按全局出牌时间顺序追加（每张新牌都在末尾，不插入中间，不按花色归类）
  function buildDiscardSequence() {
    var seq = [];
    if (!_state.discards) return seq;
    for (var s = 0; s < _state.discards.length; s++) {
      for (var i = 0; i < _state.discards[s].length; i++) {
        var t = _state.discards[s][i];
        seq.push({ tile: t, player: s, seq: t._discardSeq || 0 });
      }
    }
    // 按全局时间排序：保证每张新出的牌都在中央末尾，不会插入中间，也不按花色归类
    seq.sort(function(a, b) { return a.seq - b.seq; });
    return seq;
  }

  function drawDiscards() {
    var allTiles = buildDiscardSequence();
    if (allTiles.length === 0) return;
    var isMobile = W < 500;
    var dw = Math.round(TW * (isMobile ? 0.4 : 0.52)), dh = Math.round(TH * (isMobile ? 0.4 : 0.52)); // 小屏缩小弃牌，大屏原样
    var gap = 3;
    var zoneW = W * (isMobile ? 0.88 : 0.56);
    var zoneH = H * (isMobile ? 0.40 : 0.34);
    var zoneX = (W - zoneW) / 2;
    // 弃牌区整体上移：手机 +15%（腾出底部手牌空间）；横屏大屏（W>=500）+10%，
    // 更高会贴到对家牌
    var zoneY = (H - zoneH) / 2 - (H * (isMobile ? 0.15 : 0.1));
    // 钳制：顶部永远给对家牌背 + 名牌留出空间，横屏/矮画布下不再压住对家
    var oppTh = Math.round(oppTH() * 0.86);
    var topClear = 30 + oppTh + 16;
    // 对家有明牌时，弃牌区从明牌行下方开始，不压在明牌上
    if (seatHasMelds('top')) topClear = Math.max(topClear, topMeldY() + meldTH() + 8);
    zoneY = Math.max(zoneY, topClear);
    if (_portrait) {
      // 竖屏：夹在左右家牌背（及其明牌）之间，在桌面区（VH）里居中
      var sideW = Math.max(20 + 2 * (oppTW() + 2) + 8, SIDE_MELD_X + sideMeldWidth() + 6);
      zoneW = W - sideW * 2;
      // 下沿停在左右家名字标签上方（名字伸进了弃牌区的横向范围）
      var zoneBottom = VH - 10;
      for (var ss = 0; ss < _state.hands.length; ss++) {
        var sp = ss === _playerIndex ? '' : seatPos(ss);
        if ((sp === 'left' || sp === 'right') && handCount(ss) > 0) zoneBottom = Math.min(zoneBottom, sideMeldTop(ss) - 26 - 4);
      }
      zoneH = Math.max(dh * 3, zoneBottom - topClear);
      zoneY = topClear;
      // 牌多到放不下时缩小弃牌（每次缩 1px，最小 12px）
      while (dw > 12 && Math.ceil(allTiles.length / Math.max(6, Math.floor(zoneW / (dw + gap)))) * (dh + gap) > zoneH) {
        dw--; dh = Math.round(dw * 1.4);
      }
    }
    var perRow = Math.max(6, Math.floor(zoneW / (dw + gap)));
    var rows = Math.ceil(allTiles.length / perRow);
    var reduced = prefersReducedMotion();
    var rowMeta = [];
    var curY = zoneY;
    for (var mr = 0; mr < rows; mr++) {
      var rt = rows > 1 ? mr / (rows - 1) : 0.5;
      var p = rowPerspective(rt, false);
      var rdw = Math.max(10, Math.round(dw * p.sx));
      var rdh = Math.max(12, Math.round(dh * p.sy));
      rowMeta.push({ dw: rdw, dh: rdh, y: curY });
      curY += rdh + gap;
    }

    // 中央网格：按全局时间从左到右、从上到下，带轻微远小近大透视
    for (var idx = 0; idx < allTiles.length; idx++) {
      var row = Math.floor(idx / perRow);
      var col = idx % perRow;
      var rm = rowMeta[row];
      var rdw = rm.dw, rdh = rm.dh;
      var rowTotalW = perRow * (rdw + gap) - gap;
      var rowStartX = _portrait ? (W - rowTotalW) / 2 : (zoneX + (zoneW - rowTotalW) / 2);
      var x = rowStartX + col * (rdw + gap);
      var y = rm.y;
      var dt = allTiles[idx];
      var isLast = _state.lastDiscard && dt.tile.id === _state.lastDiscard.id;

      var isFlying = !!(_discardFly && _discardFly.tileId === dt.tile.id);
      if (isFlying) {
        _discardFlyMatched = true;
        _discardFly.target = { x: x, y: y, w: rdw, h: rdh };
        if (!reduced) continue;
      }

      ctx.save();
      if (isFlying && reduced) {
        ctx.globalAlpha = clamp((nowMs() - _discardFly.start) / _discardFly.duration, 0, 1);
      }
      // 落点脉冲光晕
      if (isLast && _lastDiscardPulse > 0.01) {
        ctx.save();
        ctx.strokeStyle = 'rgba(200,164,92,' + (0.6 * _lastDiscardPulse) + ')';
        ctx.lineWidth = 2 + 3 * _lastDiscardPulse;
        var pad = 3 + 6 * _lastDiscardPulse;
        roundRect(x - pad, y - pad, rdw + pad * 2, rdh + tileSlabH(rdh, 0.11) + pad * 2, 6);
        ctx.stroke();
        ctx.restore();
      }
      drawTileFace(x, y, rdw, rdh, dt.tile, isLast ? 3 : 0, { slabRatio: 0.11 });
      ctx.restore();
    }
  }

  // 明牌尺寸（与 drawMelds 一致）
  function meldTW() { return Math.round(TW * (W < 500 ? 0.3 : 0.36)); }
  function meldTH() { return Math.round(TH * (W < 500 ? 0.3 : 0.36)); }
  // 对家明牌行：紧贴对家牌背下方
  function topMeldY() { return 30 + oppTH() + 6; }
  function seatHasMelds(pos) {
    if (!_state.melds) return false;
    for (var s = 0; s < _state.melds.length; s++) {
      if (s !== _playerIndex && _state.melds[s] && _state.melds[s].length && seatPos(s) === pos) return true;
    }
    return false;
  }
  // 竖屏左右家明牌：x 边距、起始 y（牌背 + 名字标签下方）、占用宽度（弃牌区要让开）
  var SIDE_MELD_X = 8;
  function sideMeldTop(s) {
    var gh = Math.ceil(handCount(s) / 2) * (oppTH() + 2);
    return (VH - gh) / 2 + gh + 4 + 20 + 6;
  }
  function sideMeldWidth() {
    var maxCnt = 0;
    for (var s = 0; s < (_state.melds || []).length; s++) {
      if (s === _playerIndex || !_state.melds[s]) continue;
      var pos = seatPos(s);
      if (pos !== 'left' && pos !== 'right') continue;
      for (var m = 0; m < _state.melds[s].length; m++) maxCnt = Math.max(maxCnt, _state.melds[s][m].type === 'kong' ? 4 : 3);
    }
    return maxCnt ? maxCnt * (meldTW() + 2) - 2 : 0;
  }

  // 明牌布局：按组排列（3个/4个一组，不拆散），左上/右上，放满换行
  function drawMelds() {
    if (!_state.melds) return;
    var seats = _state.melds.length;
    var tw = meldTW(), th = meldTH(); // 小屏缩小明牌，大屏原样
    var gap = 2;
    var groupGap = 8;
    var maxPerRow = 6; // 每行最多 6 张（约 2 组）
    for (var s = 0; s < seats; s++) {
      var melds = _state.melds[s];
      if (!melds || melds.length === 0) continue;
      var pos = seatPos(s);
      // 解析每组
      var groups = [];
      for (var m = 0; m < melds.length; m++) {
        var md = melds[m];
        // 数量按 meld 类型固定（碰/吃=3，杠=4）。四川的 meld 通常只存 0~1 张代表牌
        //（md.tile），广东存真实牌（md.tiles）；用类型决定张数，绘制时再用 md.tile 补齐。
        var cnt = md.type === 'kong' ? 4 : 3;
        groups.push({ md: md, count: cnt });
      }
      if (pos === 'bottom') {
        // 自己：手牌上方横排居中，按组排列
        var bTotal = 0;
        for (var bi = 0; bi < groups.length; bi++) bTotal += groups[bi].count;
        var bRowW = bTotal * (tw + gap) + (groups.length - 1) * groupGap;
        var bPlaced = 0;
        var bY = _portrait ? handTopY() - th - 26 : H - TH - tileSlabH(TH, 0.12) - 24 - th;
        for (var bg = 0; bg < groups.length; bg++) {
          for (var bk = 0; bk < groups[bg].count; bk++) {
            var bx = W / 2 - bRowW / 2 + bPlaced * (tw + gap) + bg * groupGap;
            var bt = (groups[bg].md.tiles && groups[bg].md.tiles[bk]) || groups[bg].md.tile;
            drawTileFace(bx, bY, tw, th, bt, false, { slabRatio: 0.11 });
            bPlaced++;
          }
        }
      } else if (pos === 'top') {
        // 对家：牌背下方横排居中，按组排列
        var tTotal = 0;
        for (var ti = 0; ti < groups.length; ti++) tTotal += groups[ti].count;
        var tRowW = tTotal * (tw + gap) + (groups.length - 1) * groupGap;
        var tPlaced = 0;
        for (var tg = 0; tg < groups.length; tg++) {
          for (var tk = 0; tk < groups[tg].count; tk++) {
            var tx = W / 2 - tRowW / 2 + tPlaced * (tw + gap) + tg * groupGap;
            var ty = topMeldY();
            var tt = (groups[tg].md.tiles && groups[tg].md.tiles[tk]) || groups[tg].md.tile;
            drawTileFace(tx, ty, tw, th, tt, false, { slabRatio: 0.11 });
            tPlaced++;
          }
        }
      } else if (_portrait) {
        // 竖屏：左右家明牌贴在自家牌背 + 名字下方，一组一行（左家靠左、右家靠右），
        // 不跑到顶角去和对家牌背挤在一起，也不伸进中间弃牌区
        var pRowH = th + 4;
        var pY = Math.min(sideMeldTop(s), VH - groups.length * pRowH);
        for (var pg = 0; pg < groups.length; pg++) {
          var pw = groups[pg].count * (tw + gap) - gap;
          var px0 = pos === 'left' ? SIDE_MELD_X : W - SIDE_MELD_X - pw;
          for (var pk = 0; pk < groups[pg].count; pk++) {
            var pt = (groups[pg].md.tiles && groups[pg].md.tiles[pk]) || groups[pg].md.tile;
            drawTileFace(px0 + pk * (tw + gap), pY + pg * pRowH, tw, th, pt, false, { slabRatio: 0.11 });
          }
        }
      } else if (pos === 'right') {
        // 右家：右上角，按组排列，放满换行
        var rRows = [];
        var rCurRow = [];
        var rCurCount = 0;
        for (var rg = 0; rg < groups.length; rg++) {
          if (rCurCount + groups[rg].count > maxPerRow && rCurRow.length > 0) {
            rRows.push(rCurRow);
            rCurRow = [];
            rCurCount = 0;
          }
          rCurRow.push(groups[rg]);
          rCurCount += groups[rg].count;
        }
        if (rCurRow.length > 0) rRows.push(rCurRow);
        // 绘制：从右上角开始，向下排列
        var rStartX = W - 12;
        var rStartY = 28;
        for (var rri = 0; rri < rRows.length; rri++) {
          var row = rRows[rri];
          var rowTiles = 0;
          for (var rgi = 0; rgi < row.length; rgi++) rowTiles += row[rgi].count;
          var rowW = rowTiles * (tw + gap) + (row.length - 1) * groupGap;
          var rPlaced = 0;
          for (var rgi2 = 0; rgi2 < row.length; rgi2++) {
            for (var gk = 0; gk < row[rgi2].count; gk++) {
              var rx = rStartX - rowW + rPlaced * (tw + gap) + rgi2 * groupGap;
              var ry = rStartY + rri * (th + gap + 4);
              var rt = (row[rgi2].md.tiles && row[rgi2].md.tiles[gk]) || row[rgi2].md.tile;
              drawTileFace(rx, ry, tw, th, rt, false, { slabRatio: 0.11 });
              rPlaced++;
            }
          }
        }
      } else {
        // 左家：左上角，按组排列，放满换行
        var lRows = [];
        var lCurRow = [];
        var lCurCount = 0;
        for (var lg = 0; lg < groups.length; lg++) {
          if (lCurCount + groups[lg].count > maxPerRow && lCurRow.length > 0) {
            lRows.push(lCurRow);
            lCurRow = [];
            lCurCount = 0;
          }
          lCurRow.push(groups[lg]);
          lCurCount += groups[lg].count;
        }
        if (lCurRow.length > 0) lRows.push(lCurRow);
        // 绘制：从左上角开始，向下排列
        var lStartX = 12;
        var lStartY = isFs() ? 64 : 28;
        for (var lri = 0; lri < lRows.length; lri++) {
          var lRow = lRows[lri];
          var lPlaced = 0;
          for (var lgi = 0; lgi < lRow.length; lgi++) {
            for (var lgk = 0; lgk < lRow[lgi].count; lgk++) {
              var lx = lStartX + lPlaced * (tw + gap) + lgi * groupGap;
              var ly = lStartY + lri * (th + gap + 4);
              var lt = (lRow[lgi].md.tiles && lRow[lgi].md.tiles[lgk]) || lRow[lgi].md.tile;
              drawTileFace(lx, ly, tw, th, lt, false, { slabRatio: 0.11 });
              lPlaced++;
            }
          }
        }
      }
    }
  }

  // ---- 弃牌飞入动画 + 碰杠吃胡弹出效果 ----

  function getSeatHandOrigin(seat) {
    var pos = seat >= 0 ? seatPos(seat) : 'bottom';
    var w = clamp(Math.round((TW || 42) * 0.48), 16, 28);
    var h = Math.round(w * 1.38);
    if (isFs() && _fsMetrics) {
      if (pos === 'bottom') return { x: _fsMetrics.tableCx - w / 2, y: _fsMetrics.handTopY, w: w, h: h };
      if (pos === 'top') {
        var ptTop = project(0.5, 0.025);
        return { x: ptTop.x - w / 2, y: ptTop.y, w: w, h: h };
      }
      if (pos === 'left') {
        var ptLeft = project(0.044, 0.50);
        return { x: ptLeft.x - h / 2, y: ptLeft.y - w / 2, w: h, h: w };
      }
      var ptRight = project(0.956, 0.50);
      return { x: ptRight.x - h / 2, y: ptRight.y - w / 2, w: h, h: w };
    }
    var deskH = VH || H;
    if (pos === 'bottom') return { x: W / 2 - w / 2, y: H - TH - 14, w: w, h: h };
    if (pos === 'top') return { x: W / 2 - w / 2, y: 30, w: w, h: h };
    if (pos === 'left') return { x: 24, y: deskH / 2 - h / 2, w: w, h: h };
    return { x: W - 24 - w, y: deskH / 2 - h / 2, w: w, h: h };
  }

  function drawDiscardFly() {
    if (!_discardFly) return;
    if (!_discardFlyMatched || !_discardFly.target || !_discardFly.fromRect) {
      _discardFly = null;
      return;
    }
    if (prefersReducedMotion()) return;
    var t = clamp((nowMs() - _discardFly.start) / _discardFly.duration, 0, 1);
    if (t >= 1) {
      _discardFly = null;
      return;
    }
    var p = easeOutDiscard(t);
    var f = _discardFly.fromRect;
    var trg = _discardFly.target;
    var ix = f.x + (trg.x - f.x) * p;
    var iy = f.y + (trg.y - f.y) * p;
    var iw = f.w + (trg.w - f.w) * p;
    var ih = f.h + (trg.h - f.h) * p;

    ctx.save();
    var shadowAlpha = (1 - p) * 0.34;
    if (shadowAlpha > 0.02) {
      ctx.fillStyle = 'rgba(0,0,0,' + shadowAlpha.toFixed(3) + ')';
      roundRect(ix + 3 * (1 - p), iy + ih * 0.12 + 6 * (1 - p), iw, ih, Math.max(2, Math.round(Math.min(iw, ih) * 0.11)));
      ctx.fill();
    }
    drawTileFace(ix, iy, iw, ih, _discardFly.tile, 3, { slabRatio: 0.13, rot: trg.rot || 0 });
    ctx.restore();
  }

  var CLAIM_COLORS = {
    pung: { bg: 'rgba(58,143,212,.92)', text: '#fff' },
    kong: { bg: 'rgba(155,109,222,.92)', text: '#fff' },
    chow: { bg: 'rgba(62,184,112,.92)', text: '#fff' },
    win:  { bg: 'rgba(224,80,80,.95)', text: '#fff' },
  };
  function drawClaimEffects() {
    if (_claimEffects.length === 0) return;
    var now = nowMs();
    var reduced = prefersReducedMotion();
    for (var i = 0; i < _claimEffects.length; i++) {
      var e = _claimEffects[i];
      var ageMs = now - e.birth;
      if (ageMs < 0 || ageMs >= 1800) continue; // 过期清理由动画循环 tick 负责，这里只跳过不画
      var alpha, scale, riseY;
      if (reduced) {
        scale = 1;
        riseY = 0;
        alpha = ageMs < 200 ? (ageMs / 200) : (ageMs > 1500 ? (1800 - ageMs) / 300 : 1);
      } else {
        if (ageMs < 300) {
          var popT = ageMs / 300;
          scale = 0.35 + 0.65 * easeOutPop(popT); // peak ~1.065 (<= 1.15)
          alpha = Math.min(1, popT * 2.5);
          riseY = 0;
        } else if (ageMs < 1500) {
          scale = 1;
          alpha = 1;
          riseY = 0;
        } else {
          scale = 1;
          alpha = (1800 - ageMs) / 300;
          riseY = ((ageMs - 1500) / 300) * 10;
        }
      }
      alpha = clamp(alpha, 0, 1);
      // 效果位置：在该玩家牌背附近
      var pos = seatPos(e.player);
      var ex, ey;
      if (isFs() && _fsMetrics) {
        if (pos === 'bottom') { ex = _fsMetrics.tableCx; ey = _fsMetrics.handTopY - 38 - riseY; }
        else if (pos === 'top') { var pT = project(0.5, 0.14); ex = pT.x; ey = pT.y + riseY; }
        else if (pos === 'left') { var pL = project(0.22, 0.50); ex = pL.x; ey = pL.y - riseY; }
        else { var pR = project(0.78, 0.50); ex = pR.x; ey = pR.y - riseY; }
      } else {
        if (pos === 'bottom') { ex = W / 2; ey = H - TH - 54 - riseY; }
        else if (pos === 'top') { ex = W / 2; ey = 30 + Math.round(TH * 0.5) + 20 + riseY; }
        else if (pos === 'left') { ex = 80; ey = VH / 2 - riseY; }
        else { ex = W - 80; ey = VH / 2 - riseY; }
      }
      var col = CLAIM_COLORS[e.type] || CLAIM_COLORS.pung;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(ex, ey);
      ctx.scale(scale, scale);
      // 圆角背景
      var padX = 14, padY = 8;
      var fontSize = 22;
      ctx.font = 'bold ' + fontSize + 'px system-ui,"Microsoft YaHei",sans-serif';
      var metrics = ctx.measureText(e.label);
      var bw = metrics.width + padX * 2;
      var bh = fontSize + padY * 2;
      ctx.fillStyle = col.bg;
      roundRect(-bw / 2, -bh / 2, bw, bh, 12);
      ctx.fill();
      // 发光外圈
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * alpha) + ')';
      ctx.lineWidth = 2;
      roundRect(-bw / 2, -bh / 2, bw, bh, 12);
      ctx.stroke();
      // 文字
      ctx.fillStyle = col.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.label, 0, 1);
      ctx.restore();
    }
  }

  // ---- 当前玩家指示：明显发光边框 + 外面空白处显示名字 ----
  function drawTurnIndicator() {
    if (!_state || _state.phase === 'over') return;
    var cp = _state.currentPlayer;
    if (cp === undefined || cp === null) return;
    var pos = seatPos(cp);
    var t = (Date.now() % 1000) / 1000;
    var glow = 0.5 + 0.5 * Math.sin(t * Math.PI * 2); // 0..1 呼吸
    // 在该玩家区域画发光边框
    var pad = 6;
    var bx, by, bw, bh;
    if (pos === 'bottom' && _portrait) {
      var hy = handTopY();
      bx = 6; by = hy - 8; bw = W - 12; bh = H - hy - 12; // 下沿停在 H-20，留出余牌那行字
    } else if (pos === 'bottom' && _layout.length) {
      // 按实际手牌（含压缩、多行）的命中区包住整手牌
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (var li = 0; li < _layout.length; li++) {
        var r = _layout[li];
        x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
        x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
      }
      bx = x0 - pad; by = y0 - pad; bw = x1 - x0 + pad * 2; bh = y1 - y0 + pad * 2;
    } else if (pos === 'bottom') {
      bx = W / 2 - 14 * (TW + 4) / 2; by = H - TH - 22; bw = 14 * (TW + 4); bh = TH + 8;
    } else if (pos === 'top') {
      bx = W / 2 - 14 * (oppTW() + 2) / 2; by = 26; bw = 14 * (oppTW() + 2); bh = Math.round(oppTH() * 0.86) + 8;
    } else if (pos === 'left') {
      var lCount = handCount(cp);
      var lRows = Math.ceil(lCount / 2);
      var lTileH = lRows * (oppTH() + 2);
      bx = 20 - pad;
      by = (VH - lTileH) / 2 - pad;
      bw = 2 * (oppTW() + 2) + pad * 2;
      bh = lTileH + pad * 2;
    } else {
      var rCount = handCount(cp);
      var rRows = Math.ceil(rCount / 2);
      var rTileH = rRows * (oppTH() + 2);
      bx = W - 20 - 2 * (oppTW() + 2) - pad;
      by = (VH - rTileH) / 2 - pad;
      bw = 2 * (oppTW() + 2) + pad * 2;
      bh = rTileH + pad * 2;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(255,200,' + Math.round(60 + 100 * glow) + ',' + (0.6 + 0.4 * glow) + ')';
    ctx.lineWidth = 3 + 2 * glow;
    ctx.shadowColor = 'rgba(255,200,60,' + (0.5 * glow) + ')';
    ctx.shadowBlur = 12 + 8 * glow;
    roundRect(bx, by, bw, bh, 8);
    ctx.stroke();
    ctx.restore();
  }

  // ---- 三家对手：名字放在牌背前面 ----
  function drawPlayerNames() {
    if (!_state || !_state.hands) return;
    var n = _state.hands.length;
    var fontSize = 12;
    ctx.font = 'bold ' + fontSize + 'px system-ui,"Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < n; i++) {
      if (i === _playerIndex) continue;
      var pos = seatPos(i);
      var isActive = _state.currentPlayer === i;
      var isWinner = winnersOf(_state).includes(i);
      var name = t('mj_player', '玩家') + (i + 1);
      if (window.gamePlayers && window.gamePlayers[i]) name = window.gamePlayers[i].name;
      var count = handCount(i);
      var label = name + ' (' + count + t('mj_tiles', '张') + ')';
      if (isWinner) label = '🏆 ' + name;
      var textW = ctx.measureText(label).width;
      var padX = 8, padY = 4;
      var bw = textW + padX * 2;
      var bh = fontSize + padY * 2;
      var nx, ny;
      if (pos === 'top') {
        // 对家：名字在顶部中央、牌背上方
        nx = W / 2;
        ny = 10;
      } else if (pos === 'left') {
        // 左家：名字在牌背右侧（靠中央）
        var lTileRows = Math.ceil(count / 2);
        var lTileH = lTileRows * (oppTH() + 2);
        var lTileTop = (VH - lTileH) / 2;
        nx = 20 + 2 * (oppTW() + 2) + bw / 2 + 6;
        ny = _portrait ? lTileTop + lTileH + bh / 2 + 4 : lTileTop - bh / 2 - 4;
        if (_portrait) nx = 20 + bw / 2;
      } else {
        // 右家：名字在牌背左侧（靠中央）
        var rTileRows = Math.ceil(count / 2);
        var rTileH = rTileRows * (oppTH() + 2);
        var rTileTop = (VH - rTileH) / 2;
        nx = W - 20 - 2 * (oppTW() + 2) - bw / 2 - 6;
        ny = _portrait ? rTileTop + rTileH + bh / 2 + 4 : rTileTop - bh / 2 - 4;
        if (_portrait) nx = W - 20 - bw / 2;
      }
      ctx.save();
      if (isWinner) ctx.fillStyle = 'rgba(224,80,80,.9)';
      else if (isActive) ctx.fillStyle = 'rgba(200,164,92,.85)';
      else ctx.fillStyle = 'rgba(0,0,0,.5)';
      roundRect(nx - bw / 2, ny - bh / 2, bw, bh, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, nx, ny);
      ctx.restore();
    }
  }

  // ---- 控件 ----

  function tileLabel(tile) {
    if (!tile || tile.k === undefined) return '';
    if (tile.k === 'feng' || tile.k === 'jian') return HONOUR[tile.k][tile.n] || tile.k;
    return tile.n + SUIT_GLYPH[tile.k];
  }

  function canSelfDrawWin() {
    if (!_state || _state.phase !== 'play' || _state.currentPlayer !== _playerIndex) return false;
    if (_state._noDraw || _state._afterClaim) return false;
    var hand = _state.hands && _state.hands[_playerIndex];
    if (!Array.isArray(hand)) return false;
    return huCheckSimple(hand, _state.melds && _state.melds[_playerIndex]) && voidSatisfied(hand);
  }

  function getWinPanelState() {
    if (!isFs() || !_state || _state.phase === 'over') return { canWin: false, waits: [] };
    var me = _playerIndex;
    var hand = _state.hands && _state.hands[me];
    if (!Array.isArray(hand) || hand.length === 0) return { canWin: false, waits: [] };
    var melds = (_state.melds && _state.melds[me]) || [];
    var vs = !isCantonese() && _state.voidSuit ? _state.voidSuit[me] : null;

    if (canSelfDrawWin()) {
      var seen = countSeenTiles();
      var remIdx = -1;
      if (_state.drawn) {
        for (var i = 0; i < hand.length; i++) {
          if (hand[i].id === _state.drawn) { remIdx = i; break; }
        }
      }
      if (remIdx < 0) remIdx = hand.length - 1;
      var winTile = hand[remIdx];
      var base13 = hand.slice(0, remIdx).concat(hand.slice(remIdx + 1));
      var rawWaits = computeWaitsForHand(base13, melds, vs, seen);
      var waits = [];
      for (var wi = 0; wi < rawWaits.length; wi++) {
        var rw = rawWaits[wi];
        waits.push({
          tile: rw.tile,
          unseen: rw.unseen,
          hot: !!(winTile && rw.tile.k === winTile.k && rw.tile.n === winTile.n)
        });
      }
      if (waits.length === 0 && winTile) {
        waits.push({ tile: winTile, unseen: 0, hot: true });
      }
      return { canWin: true, waits: waits };
    }

    if (_state.phase === 'claim' && _state.lastDiscard) {
      var discarder = _state.claim ? _state.claim.discarder : _state.currentPlayer;
      var isActor = (me !== discarder) && (((_state.claim && _state.claim.order && _state.claim.order[_state.claim.idx] === me) || !_state.claim));
      if (isActor && !winnersOf(_state).includes(me) && getAvailableClaims().indexOf('win') >= 0) {
        var seenC = countSeenTiles();
        var ld = _state.lastDiscard;
        var rawC = computeWaitsForHand(hand, melds, vs, seenC);
        var waitsC = [];
        for (var ci = 0; ci < rawC.length; ci++) {
          var cw = rawC[ci];
          waitsC.push({
            tile: cw.tile,
            unseen: cw.unseen,
            hot: !!(ld && cw.tile.k === ld.k && cw.tile.n === ld.n)
          });
        }
        if (waitsC.length === 0 && ld) {
          waitsC.push({ tile: ld, unseen: Math.max(0, 4 - (seenC[ld.k + ':' + ld.n] || 0)), hot: true });
        }
        return { canWin: true, waits: waitsC };
      }
    }
    return { canWin: false, waits: [] };
  }

  function syncWinPanel() {
    var panel = document.getElementById('mjWinPanel');
    if (!panel) return null;
    var wp = getWinPanelState();
    if (!wp.canWin) {
      panel.style.display = 'none';
      panel.innerHTML = '';
      return null;
    }
    var chips = '';
    for (var i = 0; i < wp.waits.length; i++) {
      var w = wp.waits[i];
      chips += '<div class="mj-win-chip' + (w.hot ? ' hot' : '') + (w.unseen === 0 ? ' zero' : '') + '">' +
        miniTileHtml(w.tile) +
        '<span class="cnt">' + escapeHtml(tf('mj_tenpai_unseen', '剩%s张', w.unseen)) + '</span></div>';
    }
    panel.innerHTML = '<div class="mj-win-tiles">' + chips + '</div>' +
      '<button type="button" class="mj-btn win mj-win-big" onclick="window._mjWin()">' + escapeHtml(t('mj_win', '胡')) + '</button>';
    panel.style.display = 'flex';
    return wp;
  }

  function maybeScheduleAutoDiscard() {
    var autoBtn = document.getElementById('mjAutoDiscardBtn');
    if (autoBtn) autoBtn.classList.toggle('active', _autoDiscard);
    if (!_autoDiscard || !isFs() || !_state || _state.phase !== 'play' || _state.currentPlayer !== _playerIndex || !_state.drawn) {
      if (_autoDiscardTimer) { clearTimeout(_autoDiscardTimer); _autoDiscardTimer = null; }
      return;
    }
    if (canSelfDrawWin()) {
      if (_autoDiscardTimer) { clearTimeout(_autoDiscardTimer); _autoDiscardTimer = null; }
      return;
    }
    var key = (_state.roundNumber || 1) + ':' + _state.drawn;
    if (_autoDiscardKey === key) return;
    _autoDiscardKey = key;
    if (_autoDiscardTimer) clearTimeout(_autoDiscardTimer);
    var drawnId = _state.drawn;
    _autoDiscardTimer = setTimeout(function() {
      _autoDiscardTimer = null;
      if (!_autoDiscard || !isFs() || !_state || _state.phase !== 'play' || _state.currentPlayer !== _playerIndex) return;
      if (_state.drawn !== drawnId || canSelfDrawWin()) return;
      if (window.makeGameMove) window.makeGameMove({ type: 'discard', tileId: drawnId });
    }, 380);
  }

  function drawControls() {
    drawControlsInner();
    var fsOn = isFs();
    var winInfo = fsOn ? syncWinPanel() : (syncWinPanel(), null);
    var bar = document.getElementById('mjActions');
    var status = document.getElementById('mjStatus');
    var winPanelEl = document.getElementById('mjWinPanel');
    if (fsOn && bar) {
      if (winInfo && winPanelEl && winPanelEl.style.display !== 'none') {
        var wpW = Math.ceil(winPanelEl.getBoundingClientRect().width || 120);
        bar.style.right = (wpW + 24) + 'px';
        bar.style.maxWidth = 'calc(100% - ' + (wpW + 150) + 'px)';
      } else {
        bar.style.right = '';
        bar.style.maxWidth = '';
      }
      var wrap = bar.closest('.mj-wrap');
      if (wrap) {
        var baseBottom = TH + tileSlabH(TH, 0.12) + 10;
        wrap.style.setProperty('--mj-actions-bottom', baseBottom + 'px');
        if (status && status.textContent) {
          var sr = status.getBoundingClientRect();
          var br = bar.children.length > 0 ? bar.getBoundingClientRect() : null;
          var wr = (winInfo && winPanelEl && winPanelEl.style.display !== 'none') ? winPanelEl.getBoundingClientRect() : null;
          var leftMost = Infinity;
          if (br && br.width > 0) leftMost = Math.min(leftMost, br.left);
          if (wr && wr.width > 0) leftMost = Math.min(leftMost, wr.left);
          if (sr.width > 0 && leftMost < sr.right + 10) {
            wrap.style.setProperty('--mj-actions-bottom', (baseBottom + Math.ceil(sr.height) + 8) + 'px');
          }
        }
      }
    }
    if (fsOn && canvas && canvas.isConnected) {
      var board = document.getElementById('mjBoard');
      if (board && (Math.abs(board.clientWidth - W) > 1 || Math.abs(board.clientHeight - H) > 1)) {
        sizeCanvas();
        draw();
      }
    }
  }

  function drawControlsInner() {
    var bar = document.getElementById('mjActions');
    var status = document.getElementById('mjStatus');
    if (!bar) return;
    bar.innerHTML = '';
    if (status) status.classList.remove('mj-status-mine');
    if (!_state) return;
    var me = _playerIndex;
    var fs = isFs();

    if (_state.phase === 'swap') {
      // 换三张：轮流选 3 张同花色牌与对家交换
      if (_state.currentPlayer !== me) {
        // 换三张按座位轮流进行，没轮到的人不一定已选过
        status.textContent = fs
          ? tf('mj_wait_player_swap', '等待 %s 换牌', getSeatName(_state.currentPlayer))
          : t('mj_waiting', '等待其他玩家…');
        return;
      }
      if (!_swapSelected) _swapSelected = [];
      var hand = Array.isArray(_state.hands[me]) ? _state.hands[me] : [];
      // 顶部提示
      if (status) {
        status.textContent = t('mj_swap_title', '换三张：选 3 张同花色牌') + ' (' + _swapSelected.length + '/3)';
        if (fs) status.classList.add('mj-status-mine');
      }
      // 已选牌直接展示为牌面按钮
      for (var s = 0; s < _swapSelected.length; s++) {
        var id = _swapSelected[s];
        var idx = hand.findIndex(function(t) { return t.id === id; });
        (function(tile, sid) {
          var b = document.createElement('button');
          b.className = 'mj-btn void-suit';
          b.textContent = tileLabel(tile);
          b.style.minWidth = '48px';
          b.onclick = function() {
            _swapSelected.splice(_swapSelected.indexOf(sid), 1);
            drawControlsInner();
          };
          bar.appendChild(b);
        })(hand[idx], id);
      }
      // 确认按钮：始终显示，未满 3 张时禁用
      var confirm = document.createElement('button');
      confirm.className = 'mj-btn win';
      confirm.textContent = t('mj_swap_confirm', '确认换牌') + ' (' + _swapSelected.length + '/3)';
      if (_swapSelected.length === 3) {
        confirm.onclick = function() {
          if (window.makeGameMove) window.makeGameMove({ type: 'swap', tileIds: _swapSelected.slice() });
          _swapSelected = [];
        };
      } else {
        confirm.style.opacity = '0.4';
        confirm.disabled = true;
      }
      bar.appendChild(confirm);
      return;
    }

    if (_state.phase === 'void') {
      // 广东没有定缺，直接跳过
      if (isCantonese()) {
        status.textContent = t('mj_swap_wait', '准备开始...');
        return;
      }
      // 定缺按座位轮流选，没轮到时点按钮会被服务端拒绝
      if (_state.currentPlayer !== me) {
        status.textContent = fs
          ? tf('mj_wait_player_void', '等待 %s 定缺', getSeatName(_state.currentPlayer))
          : t('mj_waiting', '等待其他玩家…');
        return;
      }
      if (status) {
        status.textContent = t('mj_void_title', '定缺：选择一门花色，打完该门才能胡牌');
        if (fs) status.classList.add('mj-status-mine');
      }
      var suits = [{ k: 'wan' }, { k: 'tong' }, { k: 'tiao' }];
      for (var i = 0; i < suits.length; i++) {
        (function(suit) {
          var b = document.createElement('button');
          b.className = 'mj-btn void-suit';
          b.innerHTML = '<span class="g">' + SUIT_GLYPH[suit.k] + '</span>' + suitCount(_state.hands[me], suit.k);
          b.onclick = function() { window._mjVoid(suit.k); };
          bar.appendChild(b);
        })(suits[i]);
      }
      return;
    }

    if (_state.phase === 'claim' && _state.lastDiscard) {
      // 只对当前 claim 响应者显示按钮（非响应者点按钮会被服务端拒绝）
      // 广东：严格顺序（_state.claim.order），只有当前响应者能操作；
      // 四川：自由响应（_claimPending 计数、一炮多响），无 _state.claim，
      //       任何能吃的玩家都能发起碰/杠/胡，不能的操作则自动过。
      // 出牌者：广东在 claim.discarder；四川 claim 阶段 currentPlayer 仍是出牌者
      var discarder = _state.claim ? _state.claim.discarder : _state.currentPlayer;
      if (me === discarder) {
        status.textContent = fs
          ? tf('mj_wait_player_claim', '等待 %s 响应', getSeatName(getActiveActor()))
          : t('mj_waiting', '等待其他玩家…');
        return;
      }
      var isActor = (_state.claim && _state.claim.order && _state.claim.order[_state.claim.idx] === me)
        || !_state.claim;
      if (!isActor) {
        // 广东：还没轮到我响应，不能提前排自动过，否则轮到我时旧计时器会替我过
        status.textContent = fs
          ? tf('mj_wait_player_claim', '等待 %s 响应', getSeatName(getActiveActor()))
          : t('mj_waiting', '等待其他玩家…');
        return;
      }
      var claims = [];
      if (isActor && me !== undefined && !winnersOf(_state).includes(me)) {
        claims = getAvailableClaims();
      }
      if (claims.length > 0) {
        if (fs && status) {
          status.textContent = t('mj_choose_action', '请选择吃碰杠或过');
          status.classList.add('mj-status-mine');
        }
        // 有可执行操作：显示对应按钮 + 过（全屏时胡按钮由右下角胡牌面板承接）
        for (var c = 0; c < claims.length; c++) {
          var claim = claims[c];
          if (claim === 'win') {
            if (!fs) bar.appendChild(btn(t('mj_win', '胡'), 'win', 'window._mjWin()'));
          } else if (claim === 'kong') bar.appendChild(btn(t('mj_kong', '杠'), 'kong', 'window._mjKong()'));
          else if (claim === 'pung') bar.appendChild(btn(t('mj_pung', '碰'), 'pung', 'window._mjPung()'));
          else if (claim === 'chow') bar.appendChild(btn(t('mj_chow', '吃'), 'chow', 'window._mjChow()'));
        }
        bar.appendChild(btn(t('mj_pass', '过'), 'pass', 'window._mjPass()'));
      } else {
        // 无操作可执行：自动跳过（不需要显示"过"按钮）
        // 但给玩家一个视觉反馈：短暂显示弃牌信息
        status.textContent = tileLabel(_state.lastDiscard) + t('mj_no_action', ' — 无操作');
        // 自动 pass（1.2 秒后）：同一次弃牌/同一响应位只发一次，触发时仍需是同一时机
        var passKey = _state.lastDiscard.id + ':' + (_state.claim ? _state.claim.idx : '');
        if (_autoPassKey !== passKey) {
          _autoPassKey = passKey;
          setTimeout(function () {
            if (!_state || _state.phase !== 'claim' || !_state.lastDiscard) return;
            if (_state.lastDiscard.id + ':' + (_state.claim ? _state.claim.idx : '') !== passKey) return;
            if (window.makeGameMove) window.makeGameMove({ type: 'pass' });
          }, 1200);
        }
      }
      return;
    }

    if (_state.phase === 'play' || _state.phase === 'win') {
      if (_state.currentPlayer === me) {
        if (fs && status) {
          status.textContent = t('mj_your_turn_play', '轮到你出牌');
          status.classList.add('mj-status-mine');
        } else if (status) {
          status.textContent = '';
        }
      } else if (status) {
        status.textContent = fs
          ? tf('mj_wait_player_play', '等待 %s 出牌', getSeatName(_state.currentPlayer))
          : t('mj_waiting', '等待其他玩家…');
      }
      // 自摸：轮到自己且手牌已形成胡牌型（含副露）→ 显示"胡"按钮（全屏由胡牌面板承接）
      if (_state.currentPlayer === me) {
        var selfHand = _state.hands[me];
        // 自摸胡
        if (!fs && canSelfDrawWin()) {
          bar.appendChild(btn(t('mj_win', '胡'), 'win', 'window._mjWin()'));
        }
        // 暗杠：手中有 4 张相同牌时可杠（四川 selfkong / 广东 selfkong）
        if (Array.isArray(selfHand)) {
          var quad = findQuadTile(selfHand);
          if (quad) {
            bar.appendChild(btn(t('mj_kong', '杠'), 'kong', "window._mjSelfKong('" + quad.k + "'," + quad.n + ")"));
          }
          // 补杠：有碰的刻子 + 摸到第 4 张
          var addKongTile = findAddKongTile(selfHand, _state.melds[me]);
          if (addKongTile) {
            bar.appendChild(btn(t('mj_addkong', '补杠'), 'kong', "window._mjAddKong('" + addKongTile.k + "'," + addKongTile.n + ")"));
          }
        }
      }
      return;
    }
    if (_state.phase === 'over') { status.textContent = t('mj_game_over', '本局结束'); return; }
    status.textContent = '';
  }

  // ---- 客户端听牌分析 / 本局记录 / 广东鬼牌提示（全屏模式）----

  var TENPAI_SUIT_ORDER = { wan: 0, tong: 1, tiao: 2, feng: 3, jian: 4 };
  function tileKeyOrd(key) {
    var idx = key.indexOf(':');
    var k = key.slice(0, idx);
    var n = parseInt(key.slice(idx + 1), 10);
    return (TENPAI_SUIT_ORDER[k] !== undefined ? TENPAI_SUIT_ORDER[k] : 9) * 10 + n;
  }

  function isShisanyaoClient(counts) {
    var terms = ['wan:1','wan:9','tong:1','tong:9','tiao:1','tiao:9',
      'feng:1','feng:2','feng:3','feng:4','jian:1','jian:2','jian:3'];
    var total = 0, pairCount = 0, zeroCount = 0;
    for (var i = 0; i < terms.length; i++) {
      var c = counts[terms[i]] || 0;
      total += c;
      if (c === 0) zeroCount++;
      else if (c >= 2) pairCount++;
    }
    return total === 14 && zeroCount === 0 && pairCount === 1;
  }

  function canFormMeldsExact(counts, wildcards) {
    var key = null, best = Infinity;
    for (var k in counts) {
      if (counts[k] > 0) {
        var o = tileKeyOrd(k);
        if (o < best) { best = o; key = k; }
      }
    }
    if (key === null) return true;
    var parts = key.split(':');
    var suit = parts[0], num = parseInt(parts[1], 10);
    var cnt = counts[key];

    if (cnt >= 3) {
      var n1 = Object.assign({}, counts);
      n1[key] -= 3;
      if (n1[key] === 0) delete n1[key];
      if (canFormMeldsExact(n1, wildcards)) return true;
    }
    var wildPung = Math.max(0, 3 - cnt);
    if (wildPung > 0 && wildPung <= wildcards) {
      var n2 = Object.assign({}, counts);
      delete n2[key];
      if (canFormMeldsExact(n2, wildcards - wildPung)) return true;
    }
    if (suit !== 'feng' && suit !== 'jian') {
      for (var s = Math.max(1, num - 2); s <= Math.min(num, 7); s++) {
        var n3 = Object.assign({}, counts);
        var need = 0;
        for (var p = s; p < s + 3; p++) {
          var kp = suit + ':' + p;
          if (n3[kp] > 0) {
            n3[kp]--;
            if (n3[kp] === 0) delete n3[kp];
          } else {
            need++;
          }
        }
        if (need <= wildcards && canFormMeldsExact(n3, wildcards - need)) return true;
      }
    }
    return false;
  }

  function huCheckAccurate(tiles, melds) {
    var wildTile = getWildcardTile(_state);
    var wildcards = 0;
    var counts = {};
    for (var i = 0; i < tiles.length; i++) {
      var tl = tiles[i];
      if (wildTile && tl.k === wildTile.k && tl.n === wildTile.n) {
        wildcards++;
      } else {
        var key = tl.k + ':' + tl.n;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    var exposedMelds = melds ? melds.length : 0;
    if (isCantonese() && wildcards === 0 && isShisanyaoClient(counts)) return true;
    if (exposedMelds === 0 && tiles.length === 14) {
      var singles = 0;
      for (var sk in counts) if (counts[sk] % 2 !== 0) singles++;
      if (singles <= wildcards) return true;
    }
    var keys = Object.keys(counts).sort(function(a, b) { return tileKeyOrd(a) - tileKeyOrd(b); });
    for (var pi = 0; pi < keys.length; pi++) {
      var pk = keys[pi];
      if (counts[pk] >= 2) {
        var tc = Object.assign({}, counts);
        tc[pk] -= 2;
        if (tc[pk] === 0) delete tc[pk];
        if (canFormMeldsExact(tc, wildcards)) return true;
      }
    }
    if (wildcards >= 1) {
      for (var pw = 0; pw < keys.length; pw++) {
        var pk2 = keys[pw];
        var tc2 = Object.assign({}, counts);
        tc2[pk2] -= 1;
        if (tc2[pk2] === 0) delete tc2[pk2];
        if (canFormMeldsExact(tc2, wildcards - 1)) return true;
      }
    }
    if (wildcards >= 2 && canFormMeldsExact(counts, wildcards - 2)) return true;
    return false;
  }

  function countSeenTiles() {
    var seen = {};
    var add = function(tl, n) {
      if (!tl || tl.k === undefined) return;
      var k = tl.k + ':' + tl.n;
      seen[k] = (seen[k] || 0) + (n || 1);
    };
    var myHand = _state && _state.hands && _state.hands[_playerIndex];
    if (Array.isArray(myHand)) {
      for (var i = 0; i < myHand.length; i++) add(myHand[i], 1);
    }
    if (_state && _state.discards) {
      for (var s = 0; s < _state.discards.length; s++) {
        var pile = _state.discards[s] || [];
        for (var j = 0; j < pile.length; j++) add(pile[j], 1);
      }
    }
    if (_state && _state.melds) {
      for (var ms = 0; ms < _state.melds.length; ms++) {
        var mList = _state.melds[ms] || [];
        for (var mi = 0; mi < mList.length; mi++) {
          var md = mList[mi];
          if (!md || md.concealed) continue;
          if (md.type === 'chow' && Array.isArray(md.tiles)) {
            for (var ci = 0; ci < md.tiles.length; ci++) add(md.tiles[ci], 1);
          } else {
            var rep = md.tile || (md.tiles && md.tiles[0]);
            if (rep && rep.k !== undefined) add(rep, md.type === 'kong' ? 4 : 3);
          }
        }
      }
    }
    return seen;
  }

  function buildTenpaiCandidates(excludeSuit) {
    var cands = [];
    var suits = ['wan', 'tong', 'tiao'];
    for (var si = 0; si < suits.length; si++) {
      if (suits[si] === excludeSuit) continue;
      for (var n = 1; n <= 9; n++) cands.push({ k: suits[si], n: n });
    }
    if (isCantonese()) {
      for (var fn = 1; fn <= 4; fn++) cands.push({ k: 'feng', n: fn });
      for (var jn = 1; jn <= 3; jn++) cands.push({ k: 'jian', n: jn });
    }
    return cands;
  }

  function computeWaitsForHand(handTiles, melds, excludeSuit, seen) {
    if (excludeSuit) {
      for (var i = 0; i < handTiles.length; i++) {
        if (handTiles[i].k === excludeSuit) return [];
      }
    }
    var cands = buildTenpaiCandidates(excludeSuit);
    var waits = [];
    for (var ci = 0; ci < cands.length; ci++) {
      var c = cands[ci];
      var test = handTiles.concat([{ k: c.k, n: c.n, id: 'tp#' + ci }]);
      if (huCheckAccurate(test, melds)) {
        var key = c.k + ':' + c.n;
        waits.push({ tile: c, unseen: Math.max(0, 4 - (seen[key] || 0)) });
      }
    }
    return waits;
  }

  function computeTenpai() {
    if (!_state || !_state.hands || _state.phase === 'over') return { mode: 'none' };
    var hand = _state.hands[_playerIndex];
    if (!Array.isArray(hand) || hand.length === 0) return { mode: 'none' };
    var melds = (_state.melds && _state.melds[_playerIndex]) || [];
    var vs = !isCantonese() && _state.voidSuit ? _state.voidSuit[_playerIndex] : null;
    var seen = countSeenTiles();

    if (hand.length % 3 === 1) {
      var waits = computeWaitsForHand(hand, melds, vs, seen);
      return waits.length ? { mode: 'wait', waits: waits } : { mode: 'none' };
    }
    if (hand.length % 3 === 2) {
      var canWinNow = (!vs || hand.every(function(tl) { return tl.k !== vs; })) && huCheckAccurate(hand, melds);
      var tried = {};
      var options = [];
      for (var i = 0; i < hand.length; i++) {
        var dTile = hand[i];
        var dKey = dTile.k + ':' + dTile.n;
        if (tried[dKey]) continue;
        tried[dKey] = true;
        var rem = hand.slice(0, i).concat(hand.slice(i + 1));
        var wList = computeWaitsForHand(rem, melds, vs, seen);
        if (wList.length > 0) options.push({ discard: dTile, waits: wList });
      }
      if (!canWinNow && options.length === 0) return { mode: 'none' };
      return { mode: 'discard', canWinNow: canWinNow, options: options };
    }
    return { mode: 'none' };
  }

  function updateDiscardHistory() {
    if (!_state || !_state.discards) return;
    var rn = _state.roundNumber || 1;
    var totalD = 0, totalM = 0;
    for (var s = 0; s < _state.discards.length; s++) totalD += (_state.discards[s] || []).length;
    if (_state.melds) for (var m = 0; m < _state.melds.length; m++) totalM += (_state.melds[m] || []).length;
    if ((_lastRoundMarker !== null && _lastRoundMarker !== rn) || (totalD === 0 && totalM === 0 && _discardHistory.length > 0)) {
      _discardHistory = [];
    }
    _lastRoundMarker = rn;

    var byId = {};
    for (var i = 0; i < _discardHistory.length; i++) byId[_discardHistory[i].id] = true;
    var seqList = buildDiscardSequence();
    for (var j = 0; j < seqList.length; j++) {
      var entry = seqList[j];
      var tid = entry.tile && entry.tile.id;
      if (tid && !byId[tid]) {
        byId[tid] = true;
        _discardHistory.push({ id: tid, tile: entry.tile, player: entry.player, seq: entry.seq });
      }
    }
    _discardHistory.sort(function(a, b) { return a.seq - b.seq; });
  }

  function toggleFsPanel(name) {
    _activePanel = (_activePanel === name) ? null : name;
    syncFsOverlays();
  }

  function renderFsPanel() {
    var panel = document.getElementById('mjFsPanel');
    var tenpaiBtn = document.getElementById('mjTenpaiBtn');
    var logBtn = document.getElementById('mjLogBtn');
    if (tenpaiBtn) tenpaiBtn.classList.toggle('active', _activePanel === 'tenpai');
    if (logBtn) logBtn.classList.toggle('active', _activePanel === 'log');
    if (!panel) return;
    if (!isFs() || !_activePanel) {
      panel.style.display = 'none';
      panel.innerHTML = '';
      return;
    }
    var title = _activePanel === 'tenpai' ? t('mj_tenpai_title', '听牌提示') : t('mj_log_title', '本局出牌记录');
    var bodyHtml = '';
    if (_activePanel === 'tenpai') {
      var tp = computeTenpai();
      if (tp.mode === 'wait') {
        var totalUnseen = 0;
        for (var wi = 0; wi < tp.waits.length; wi++) totalUnseen += tp.waits[wi].unseen;
        bodyHtml += '<div class="mj-tenpai-sub">' + escapeHtml(tf('mj_tenpai_total', '共%s张', totalUnseen)) + '</div><div class="mj-tenpai-grid">';
        for (var wj = 0; wj < tp.waits.length; wj++) {
          var wItem = tp.waits[wj];
          bodyHtml += '<div class="mj-tenpai-chip' + (wItem.unseen === 0 ? ' zero' : '') + '">' +
            miniTileHtml(wItem.tile) +
            '<span class="cnt">' + escapeHtml(tf('mj_tenpai_unseen', '剩%s张', wItem.unseen)) + '</span></div>';
        }
        bodyHtml += '</div>';
      } else if (tp.mode === 'discard') {
        if (tp.canWinNow) {
          bodyHtml += '<div class="mj-tenpai-sub" style="color:#ffe49c">' + escapeHtml(t('mj_tenpai_can_win', '当前手牌可胡')) + '</div>';
        }
        for (var oi = 0; oi < tp.options.length; oi++) {
          var opt = tp.options[oi];
          bodyHtml += '<div class="mj-tenpai-row"><div class="mj-tenpai-disc">' +
            escapeHtml(t('mj_tenpai_discard_prefix', '打')) + miniTileHtml(opt.discard) +
            '</div><span class="mj-tenpai-arrow">→</span><div class="mj-tenpai-grid">';
          for (var ok = 0; ok < opt.waits.length; ok++) {
            var ow = opt.waits[ok];
            bodyHtml += '<div class="mj-tenpai-chip' + (ow.unseen === 0 ? ' zero' : '') + '">' +
              miniTileHtml(ow.tile) +
              '<span class="cnt">' + escapeHtml(tf('mj_tenpai_unseen', '剩%s张', ow.unseen)) + '</span></div>';
          }
          bodyHtml += '</div></div>';
        }
      } else {
        bodyHtml = '<div class="mj-tenpai-empty">' + escapeHtml(t('mj_tenpai_not_ready', '未听牌')) + '</div>';
      }
    } else {
      if (_discardHistory.length === 0) {
        bodyHtml = '<div class="mj-log-empty">' + escapeHtml(t('mj_log_empty', '暂无出牌记录')) + '</div>';
      } else {
        bodyHtml = '<div class="mj-log-list">';
        for (var li = 0; li < _discardHistory.length; li++) {
          var rec = _discardHistory[li];
          var isMe = rec.player === _playerIndex;
          bodyHtml += '<div class="mj-log-row' + (isMe ? ' me' : '') + '">' +
            '<span class="mj-log-seq">' + (li + 1) + '</span>' +
            '<span class="mj-log-name">' + escapeHtml(getSeatName(rec.player)) + '</span>' +
            miniTileHtml(rec.tile) +
            '<span class="mj-log-tile-lbl">' + escapeHtml(tileLabel(rec.tile)) + '</span>' +
          '</div>';
        }
        bodyHtml += '</div>';
      }
    }

    panel.innerHTML = '<div class="mj-fs-panel-hd"><span>' + escapeHtml(title) + '</span>' +
      '<button type="button" class="mj-fs-panel-close" id="mjPanelClose" aria-label="Close">×</button></div>' +
      '<div class="mj-fs-panel-bd" id="mjPanelBody">' + bodyHtml + '</div>';
    panel.style.display = 'flex';
    var closeBtn = document.getElementById('mjPanelClose');
    if (closeBtn) closeBtn.onclick = function(e) { e.stopPropagation(); _activePanel = null; syncFsOverlays(); };
    if (_activePanel === 'log') {
      var bd = document.getElementById('mjPanelBody');
      if (bd) bd.scrollTop = bd.scrollHeight;
    }
  }

  function syncWildcardUi() {
    var badge = document.getElementById('mjWildBadge');
    var card = document.getElementById('mjWildCard');
    var wild = getWildcardTile(_state);
    if (!isFs() || !wild) {
      if (badge) badge.style.display = 'none';
      if (card) card.style.display = 'none';
      _wildcardCardVisible = false;
      if (_wildcardTimer) { clearTimeout(_wildcardTimer); _wildcardTimer = null; }
      return;
    }
    if (badge) {
      badge.innerHTML = miniTileHtml(wild) + '<span>' + escapeHtml(t('mj_wild_label', '鬼牌')) + '</span>';
    }
    var totalD = 0, totalM = 0;
    if (_state.discards) for (var s = 0; s < _state.discards.length; s++) totalD += (_state.discards[s] || []).length;
    if (_state.melds) for (var m = 0; m < _state.melds.length; m++) totalM += (_state.melds[m] || []).length;
    var myHand = _state.hands && _state.hands[_playerIndex];
    var hPrefix = Array.isArray(myHand) ? myHand.slice(0, 3).map(function(tl) { return tl.id; }).join(',') : '';
    var wildKey = 'r' + (_state.roundNumber || 1) + ':' + hPrefix;
    var seenBefore = _wildcardShownKey === wildKey;
    try { if (sessionStorage.getItem('mj_wild_shown') === wildKey) seenBefore = true; } catch (e) {}

    if (totalD === 0 && totalM === 0 && _state.phase === 'play' && !seenBefore && !_wildcardCardVisible) {
      _wildcardShownKey = wildKey;
      try { sessionStorage.setItem('mj_wild_shown', wildKey); } catch (e) {}
      _wildcardCardVisible = true;
      if (card) {
        card.innerHTML = '<div>' + escapeHtml(t('mj_wild_confirmed', '鬼牌确定')) + '</div>' + miniTileHtml(wild);
        if (prefersReducedMotion()) card.style.animation = 'none';
        card.style.display = 'flex';
      }
      if (badge) badge.style.display = 'none';
      if (_wildcardTimer) clearTimeout(_wildcardTimer);
      _wildcardTimer = setTimeout(function() {
        _wildcardTimer = null;
        _wildcardCardVisible = false;
        var c = document.getElementById('mjWildCard');
        var b = document.getElementById('mjWildBadge');
        if (c) c.style.display = 'none';
        if (b && isFs() && getWildcardTile(_state)) b.style.display = 'flex';
      }, 1500);
    } else if (_wildcardCardVisible) {
      if (card) card.style.display = 'flex';
      if (badge) badge.style.display = 'none';
    } else {
      if (card) card.style.display = 'none';
      if (badge) badge.style.display = 'flex';
    }
  }

  function syncFsOverlays() {
    var tenpaiBtn = document.getElementById('mjTenpaiBtn');
    if (tenpaiBtn) {
      var ready = false;
      if (isFs() && _state && _state.phase !== 'over') {
        var tp = computeTenpai();
        ready = tp.mode !== 'none';
      }
      tenpaiBtn.classList.toggle('has-ready', ready);
    }
    var autoBtn = document.getElementById('mjAutoDiscardBtn');
    if (autoBtn) autoBtn.classList.toggle('active', _autoDiscard);
    syncWinPanel();
    syncWildcardUi();
    renderFsPanel();
  }

  function syncCountdownTimer() {
    var needsTick = isFs() && getTurnSecondsLeft() !== null && _state && _state.phase !== 'over';
    if (needsTick && !_countdownTimer) {
      _countdownTimer = setInterval(function() {
        if (!canvas || !canvas.isConnected || !isFs() || getTurnSecondsLeft() === null || !_state || _state.phase === 'over') {
          clearInterval(_countdownTimer);
          _countdownTimer = null;
          return;
        }
        draw();
      }, 250);
    } else if (!needsTick && _countdownTimer) {
      clearInterval(_countdownTimer);
      _countdownTimer = null;
    }
  }

  function canChow() {
    // 只有广东可吃；四川不吃。用 state.cfg 判断：四川 cfg.allowChow=false
    if (_state.cfg && _state.cfg.allowChow === false) return false;
    return true;
  }

  // ---- 客户端判断可操作的吃碰杠胡（镜像服务端逻辑）----
  function countMatching(hand, k, n) {
    var c = 0;
    for (var i = 0; i < hand.length; i++) if (hand[i].k === k && hand[i].n === n) c++;
    return c;
  }

  // 找手中有 4 张相同的牌（用于暗杠按钮）
  function findQuadTile(hand) {
    var counts = {};
    for (var i = 0; i < hand.length; i++) {
      var key = hand[i].k + ':' + hand[i].n;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (var key in counts) {
      if (counts[key] >= 4) {
        var parts = key.split(':');
        return { k: parts[0], n: parseInt(parts[1], 10) };
      }
    }
    return null;
  }

  // 补杠：已有的碰（pung）副露 + 手中摸到第 4 张同牌
  function findAddKongTile(hand, melds) {
    if (!Array.isArray(melds)) return null;
    for (var i = 0; i < melds.length; i++) {
      var m = melds[i];
      if (m.type !== 'pung') continue;
      var r = m.tile || (m.tiles && m.tiles[0]);
      if (!r) continue;
      if (countMatching(hand, r.k, r.n) >= 1) return { k: r.k, n: r.n };
    }
    return null;
  }

  // 简化的胡牌判断（标准型 + 七对），与 games/lib/mahjong-core 一致
  // 红中百搭感知的胡牌判断（用于前端显示"胡"按钮）
  function huCheckSimple(tiles, melds) {
    // 分离百搭牌
    var isWild = _state && _state._wildcard;
    var wildcards = 0;
    var counts = {};
    for (var i = 0; i < tiles.length; i++) {
      if (isWild && tiles[i].k === 'jian' && tiles[i].n === 1) { wildcards++; }
      else {
        var key = tiles[i].k + ':' + tiles[i].n;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    var exposedMelds = melds ? melds.length : 0;
    var keys = Object.keys(counts);
    // 对子 + 面子（含百搭辅助）
    for (var pi = 0; pi < keys.length; pi++) {
      if (counts[keys[pi]] >= 2) {
        var tc = Object.assign({}, counts);
        tc[keys[pi]] -= 2;
        if (tc[keys[pi]] === 0) delete tc[keys[pi]];
        if (canFormMeldsWild(tc, wildcards)) return true;
      }
    }
    // 百搭做雀头：1张普通牌 + 1百搭，或2百搭
    if (wildcards >= 1) {
      for (var pw = 0; pw < keys.length; pw++) {
        if (counts[keys[pw]] >= 1) {
          var tc2 = Object.assign({}, counts);
          tc2[keys[pw]] -= 1;
          if (tc2[keys[pw]] === 0) delete tc2[keys[pw]];
          if (canFormMeldsWild(tc2, wildcards - 1)) return true;
        }
      }
    }
    if (wildcards >= 2) {
      if (canFormMeldsWild(counts, wildcards - 2)) return true;
    }
    // 七对（无副露时）
    if (exposedMelds === 0 && tiles.length === 14) {
      // 与服务端一致：4 张相同算两对（龙七对），单张可用百搭补成对子
      var pairs = 0, singles = 0;
      for (var j = 0; j < keys.length; j++) {
        pairs += Math.floor(counts[keys[j]] / 2);
        singles += counts[keys[j]] % 2;
      }
      if (singles <= wildcards && pairs + singles + Math.floor((wildcards - singles) / 2) >= 7) return true;
    }
    return false;
  }

  // 百搭面子递归（与 games/lib/mahjong-core 的 canFormMeldsWild 一致）
  function canFormMeldsWild(counts, wildcards) {
    var keys = Object.keys(counts).filter(function(k){return counts[k]>0;});
    if (keys.length === 0) return true;
    var key = keys[0];
    var parts = key.split(':');
    var k = parts[0], n = parseInt(parts[1]);
    var cnt = counts[key];
    // 刻子
    if (cnt >= 3) {
      var next = Object.assign({}, counts);
      next[key] -= 3;
      if (next[key] === 0) delete next[key];
      if (canFormMeldsWild(next, wildcards)) return true;
    }
    var wildForPung = Math.max(0, 3 - cnt);
    if (wildForPung > 0 && wildForPung <= wildcards) {
      var next2 = Object.assign({}, counts);
      delete next2[key];
      if (canFormMeldsWild(next2, wildcards - wildForPung)) return true;
    }
    // 顺子（仅数牌）
    if (k !== 'feng' && k !== 'jian' && n <= 7) {
      var k2 = k + ':' + (n+1), k3 = k + ':' + (n+2);
      var has2 = counts[k2] || 0, has3 = counts[k3] || 0;
      if (has2 > 0 && has3 > 0) {
        var next3 = Object.assign({}, counts);
        next3[key]--; if (next3[key] === 0) delete next3[key];
        next3[k2]--; if (next3[k2] === 0) delete next3[k2];
        next3[k3]--; if (next3[k3] === 0) delete next3[k3];
        if (canFormMeldsWild(next3, wildcards)) return true;
      }
      var need = (has2 > 0 ? 0 : 1) + (has3 > 0 ? 0 : 1);
      if (need > 0 && need <= wildcards) {
        var next4 = Object.assign({}, counts);
        next4[key]--; if (next4[key] === 0) delete next4[key];
        if (has2 > 0) { next4[k2]--; if (next4[k2] === 0) delete next4[k2]; }
        if (has3 > 0) { next4[k3]--; if (next4[k3] === 0) delete next4[k3]; }
        if (canFormMeldsWild(next4, wildcards - need)) return true;
      }
    }
    return false;
  }

  // 定缺是否已满足（手里没有缺门花色）
  function voidSatisfied(hand) {
    var vs = _state.voidSuit && _state.voidSuit[_playerIndex];
    if (!vs) return true;
    for (var i = 0; i < hand.length; i++) if (hand[i].k === vs) return false;
    return true;
  }

  // 检查是否能吃（需要手中有能与弃牌组成顺子的两张牌）
  function canChowTile(hand, tile) {
    if (tile.k === 'feng' || tile.k === 'jian') return false;
    var k = tile.k, n = tile.n;
    var has = function(num) { return hand.some(function(t){return t.k===k&&t.n===num;}); };
    if (n-2 >= 1 && has(n-2) && has(n-1)) return true;
    if (n-1 >= 1 && n+1 <= 9 && has(n-1) && has(n+1)) return true;
    if (n+2 <= 9 && has(n+1) && has(n+2)) return true;
    return false;
  }

  // 返回当前玩家对 lastDiscard 可执行的操作列表
  function getAvailableClaims() {
    var claims = [];
    var ld = _state.lastDiscard;
    if (!ld) return claims;
    var hand = _state.hands[_playerIndex];
    if (!Array.isArray(hand)) return claims;
    var mc = countMatching(hand, ld.k, ld.n);
    // 胡（需满足定缺：手里不能有缺门花色）
    var testHand = hand.concat([ld]);
    if (huCheckSimple(testHand, _state.melds[_playerIndex]) && voidSatisfied(hand)) claims.push('win');
    // 杠（手中有 3 张）
    if (mc >= 3) claims.push('kong');
    // 碰（手中有 2 张）
    if (mc >= 2) claims.push('pung');
    // 吃（广东：只能吃上家，且能组成顺子）
    if (canChow()) {
      var n = _state._playerCount || 4;
      var discarder = _state.claim ? _state.claim.discarder : -1;
      var isUpstream = discarder >= 0 && _playerIndex === (discarder + 1) % n;
      if (isUpstream && canChowTile(hand, ld)) claims.push('chow');
    }
    return claims;
  }


  function suitCount(hand, suit) {
    if (!Array.isArray(hand)) return '0' + t('mj_tiles', '张');
    var c = 0;
    for (var i = 0; i < hand.length; i++) if (hand[i].k === suit) c++;
    return c + t('mj_tiles', '张');
  }

  function btn(label, cls, fn) {
    var b = document.createElement('button');
    b.className = 'mj-btn ' + cls;
    b.textContent = label;
    b.setAttribute('onclick', fn);
    return b;
  }

  // ---- 交互 ----

  function hitTile(px, py) {
    for (var i = 0; i < _layout.length; i++) {
      var r = _layout[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r.idx;
    }
    return -1;
  }

  function getScorePanelMetrics() {
    var hasBuy = Array.isArray(_state.buyTiles) && _state.buyTiles.length > 0;
    var playerCount = _state.hands.length;
    var compact = isFs() && H < 460;
    var panelW = Math.min(380, W - 40);
    var rowH = compact ? 26 : 36;
    var listStart = compact ? 74 : 100;
    var buyH = hasBuy ? (compact ? 48 : 60) : 0;
    var btnBlock = compact ? 78 : 100;
    var panelH = listStart + (playerCount > 0 ? playerCount * rowH : 240) + buyH + btnBlock;
    var px = (W - panelW) / 2;
    var py = Math.max(8, (H - panelH) / 2);
    return {
      hasBuy: hasBuy,
      compact: compact,
      panelW: panelW,
      panelH: panelH,
      rowH: rowH,
      listStart: listStart,
      px: px,
      py: py,
      nextY: py + panelH - (compact ? 74 : 90),
      nextH: compact ? 30 : 36,
      subY: py + panelH - (compact ? 36 : 42),
      subH: compact ? 26 : 28
    };
  }

  function onClick(e) {
    if (isFs() && _activePanel) {
      _activePanel = null;
      syncFsOverlays();
      return;
    }
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) * (W / rect.width);
    var y = (e.clientY - rect.top) * (H / rect.height);
    var me = _playerIndex;
    // 结算界面：本局结算面板内三按钮（下一局/返回房间/返回大厅）
    if (_state && _state.phase === 'over') {
      var sm = getScorePanelMetrics();
      // 下一局
      if (x >= W/2 - 60 && x <= W/2 + 60 && y >= sm.nextY && y <= sm.nextY + sm.nextH) {
        if (window.doNextRound) window.doNextRound();
        else if (window.doRestart) window.doRestart();
        else if (window.makeGameMove) window.makeGameMove({ type: 'restart' });
        return;
      }
      // 返回房间
      if (x >= W/2 - 115 && x <= W/2 - 15 && y >= sm.subY && y <= sm.subY + sm.subH) {
        if (window.doReturnToRoom) window.doReturnToRoom();
        return;
      }
      // 返回大厅
      if (x >= W/2 + 15 && x <= W/2 + 115 && y >= sm.subY && y <= sm.subY + sm.subH) {
        if (window.doLeaveRoom) window.doLeaveRoom();
        return;
      }
      return;
    }
    // 换三张：点击手牌选中/取消（轮到自己时才能选）
    if (_state && _state.phase === 'swap' && _state.currentPlayer === me) {
      if (!_layout.length) return;
      var idx = hitTile(x, y);
      if (idx < 0) return;
      var hand = _state.hands[me];
      var tile = hand[idx];
      if (!tile) return;
      if (!_swapSelected) _swapSelected = [];
      var existIdx = _swapSelected.indexOf(tile.id);
      if (existIdx >= 0) {
        _swapSelected.splice(existIdx, 1);
      } else {
        if (_swapSelected.length >= 3) return;
        // 必须同花色（字牌不能换）
        if (tile.k === 'feng' || tile.k === 'jian') return;
        if (_swapSelected.length > 0) {
          var first = hand.find(function(t) { return t.id === _swapSelected[0]; });
          if (first && first.k !== tile.k) return;
        }
        _swapSelected.push(tile.id);
      }
      drawControls();
      draw();
      return;
    }

    // 只有自己的出牌回合才能点牌出牌，其它时候误点不发请求
    if (!_state || _state.phase !== 'play' || _state.currentPlayer !== me) return;
    if (!_layout.length) return;
    var idx = hitTile(x, y);
    if (idx < 0) return;
    window._mjDiscard(idx);
  }

  function onMouseMove(e) {
    if (!_layout.length) return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) * (W / rect.width);
    var y = (e.clientY - rect.top) * (H / rect.height);
    var idx = hitTile(x, y);
    if (idx !== _hoverIdx) { _hoverIdx = idx; draw(); }
  }

  // ---- 积分面板（Canvas 结算界面，phase === 'over' 时绘制）----
  function drawScorePanel() {
    if (!_state || _state.phase !== 'over') return;
    var sm = getScorePanelMetrics();
    var panelW = sm.panelW;
    var panelH = sm.panelH;
    var px = sm.px;
    var py = sm.py;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(0, 0, W, H);

    // 面板
    ctx.fillStyle = '#1a2a1a';
    roundRect(px, py, panelW, panelH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,164,92,.5)';
    ctx.lineWidth = 2;
    roundRect(px, py, panelW, panelH, 16);
    ctx.stroke();

    // 标题
    ctx.fillStyle = '#c8a45c';
    ctx.font = 'bold ' + (sm.compact ? 17 : 20) + 'px system-ui,"Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('mj_settlement', '本局结算'), W / 2, py + (sm.compact ? 22 : 32));
    // 局数小字 — 与标题拉大间隔
    var rn = _state.roundNumber || 1;
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '12px system-ui,"Microsoft YaHei",sans-serif';
    ctx.fillText(t('mj_round_label', '第') + rn + t('mj_round_unit', '局'), W / 2, py + (sm.compact ? 40 : 56));

    // 赢家：四川用 winners 数组（血战可多人胡）；广东用 winner 单值（-1 = 荒庄）
    var winnerList = Array.isArray(_state.winners) ? _state.winners
      : (typeof _state.winner === 'number' && _state.winner >= 0 ? [_state.winner] : []);
    // 结果状态条：胡 / 未胡 / 平局（流局）
    var iWon = winnerList.indexOf(_playerIndex) >= 0;
    var resultText = winnerList.length === 0 ? t('mj_result_draw', '流局 · 平局')
      : (iWon ? t('mj_result_win', '你胡了！') : t('mj_result_lose', '本局未胡'));
    ctx.fillStyle = iWon ? '#e05050' : 'rgba(255,255,255,.72)';
    ctx.font = 'bold ' + (sm.compact ? 13 : 14) + 'px system-ui,"Microsoft YaHei",sans-serif';
    ctx.fillText(resultText, W / 2, py + (sm.compact ? 56 : 78));

    // 玩家列表
    var cumScore = _state.cumulativeScore || [0,0,0,0];
    var dealerIdx = _state.dealerIndex || 0;
    ctx.font = (sm.compact ? 13 : 14) + 'px system-ui,"Microsoft YaHei",sans-serif';
    var roundScores = _state.roundScores;
    for (var i = 0; i < _state.hands.length; i++) {
      var yy = py + sm.listStart + i * sm.rowH;
      var isDealer = (i === dealerIdx);
      var isWinner = winnerList.indexOf(i) >= 0;
      ctx.fillStyle = isWinner ? '#e05050' : (isDealer ? '#c8a45c' : 'rgba(255,255,255,.85)');
      ctx.textAlign = 'left';
      var pName = (window.gamePlayers && window.gamePlayers[i] && window.gamePlayers[i].name) || (t('mj_player', '玩家') + (i + 1));
      var label = pName + (isDealer ? t('mj_dealer', ' (庄)') : '') + (i === _playerIndex ? t('mj_you', ' (你)') : '');
      if (isWinner) label += t('mj_hu', ' 胡!');
      ctx.fillText(label, px + 20, yy);
      // 累计分
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText(cumScore[i] + t('mj_score', '分'), px + panelW - 20, yy);
      // 本局变动（紧贴累计分左侧）
      if (roundScores && typeof roundScores[i] === 'number' && roundScores[i] !== 0) {
        var delta = roundScores[i];
        var deltaText = (delta > 0 ? '+' : '') + Math.round(delta * 10) / 10;
        ctx.fillStyle = delta > 0 ? '#51cf66' : '#ff6b6b';
        ctx.font = '12px system-ui,"Microsoft YaHei",sans-serif';
        ctx.fillText(deltaText, px + panelW - 70, yy);
        ctx.font = (sm.compact ? 13 : 14) + 'px system-ui,"Microsoft YaHei",sans-serif';
      }
    }

    // 买马（广东）：胡牌后从牌尾买的牌 + 加番
    var buyTiles = _state.buyTiles;
    if (Array.isArray(buyTiles) && buyTiles.length > 0) {
      var byY = py + sm.listStart + _state.hands.length * sm.rowH + 4;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,.65)';
      ctx.font = '12px system-ui,"Microsoft YaHei",sans-serif';
      var buyFan = _state.buyFan || 0;
      ctx.fillText(t('mj_buy_prefix', '买码: ') + buyTiles.length + t('mj_tiles', '张')
        + (buyFan > 0 ? '  +' + buyFan + t('mj_fan_unit', '番') : ''), W / 2, byY);
      // 买到的牌面
      var btw = sm.compact ? 22 : 26, bth = sm.compact ? 28 : 34, bgap = 5;
      var btotal = buyTiles.length * (btw + bgap) - bgap;
      var bsx = W / 2 - btotal / 2;
      for (var b = 0; b < buyTiles.length; b++) {
        drawTileFace(bsx + b * (btw + bgap), byY + 6, btw, bth, buyTiles[b], 0);
      }
    }

    // 下一局按钮（主）
    ctx.fillStyle = '#c8a45c';
    roundRect(W/2 - 60, sm.nextY, 120, sm.nextH, 10);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 14px system-ui,"Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('mj_next_round', '下一局'), W / 2, sm.nextY + sm.nextH / 2 + 4);
    // 返回房间 / 返回大厅（次级，置于面板内）— 间隔拉大不拥挤
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    roundRect(W/2 - 115, sm.subY, 100, sm.subH, 8);
    ctx.fill(); ctx.stroke();
    roundRect(W/2 + 15, sm.subY, 100, sm.subH, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.font = '12px system-ui,"Microsoft YaHei",sans-serif';
    ctx.fillText(t('mj_return_room', '返回房间'), W/2 - 65, sm.subY + sm.subH / 2 + 4);
    ctx.fillText(t('mj_return_lobby', '返回大厅'), W/2 + 65, sm.subY + sm.subH / 2 + 4);
  }

  // 回调：接线到 makeGameMove（与 room-client 的 webSocket 通信）
  window._mjVoid = function(suit) { if (window.makeGameMove) window.makeGameMove({ type: 'void', suit: suit }); };
  window._mjDiscard = function(idx) {
    var hand = _state && Array.isArray(_state.hands[_playerIndex]) ? _state.hands[_playerIndex] : [];
    if (idx >= 0 && idx < hand.length && window.makeGameMove) {
      window.makeGameMove({ type: 'discard', tileId: hand[idx].id });
    }
  };
  window._mjPung = function() { if (window.makeGameMove) window.makeGameMove({ type: 'pung' }); };
  window._mjKong = function() { if (window.makeGameMove) window.makeGameMove({ type: 'kong' }); };
  window._mjSelfKong = function(suit, num) { if (window.makeGameMove) window.makeGameMove({ type: 'selfkong', suit: suit, num: num }); };
  window._mjAddKong = function(suit, num) { if (window.makeGameMove) window.makeGameMove({ type: 'addkong', suit: suit, num: num }); };
  // 调试用：暴露内部状态到全局（便于 F12 Console 排查）
  window._mjGetState = function() { return _state; };
  window._mjGetPlayerIndex = function() { return _playerIndex; };
  window._mjWin = function() { if (window.makeGameMove) window.makeGameMove({ type: 'win' }); };
  window._mjPass = function() { if (window.makeGameMove) window.makeGameMove({ type: 'pass' }); };
  window._mjChow = function() {
    // 吃：广东才有。取最近的能吃组合（简化：让服务器校验，这里只发 type）
    if (window.makeGameMove) window.makeGameMove({ type: 'chow', tiles: [] });
  };
})();
