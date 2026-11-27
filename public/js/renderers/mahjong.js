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
  var _claimEffects = [];    // 碰杠吃胡动画效果 [{ pos, type, text, birth }]
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
    'body.gn-fs .mj-bar .mj-btn{padding:10px 20px;font-size:15px;border-radius:999px;white-space:nowrap;text-align:center;min-height:42px;box-shadow:0 6px 18px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.2);}' +
    '@media(max-height:430px){body.gn-fs .mj-bar{gap:6px;}body.gn-fs .mj-bar .mj-btn{padding:7px 15px;font-size:14px;min-height:36px;}}' +
    'body.gn-fs .mj-fs-wild-badge{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);left:calc(env(safe-area-inset-left,0px) + 64px);z-index:18;display:flex;align-items:center;gap:6px;padding:4px 10px 4px 6px;border-radius:12px;background:rgba(10,24,17,.8);border:1px solid rgba(200,164,92,.5);color:#ffe49c;font-size:12px;font-weight:700;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.3);}' +
    '@keyframes mjWildPop{from{opacity:0;transform:translate(-50%,-50%) scale(.9);}to{opacity:1;transform:translate(-50%,-50%) scale(1);}}' +
    'body.gn-fs .mj-fs-wild-card{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:30;padding:16px 26px;border-radius:18px;background:rgba(14,32,22,.95);border:2px solid rgba(200,164,92,.8);box-shadow:0 18px 44px rgba(0,0,0,.58);display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;color:#ffe49c;font-size:16px;font-weight:800;letter-spacing:.5px;animation:mjWildPop .24s ease-out;}' +
    'body.gn-fs .mj-fs-wild-card .mj-mini-tile{width:46px;height:64px;border-radius:8px;}' +
    'body.gn-fs .mj-fs-wild-card .mj-mini-tile.honour b{font-size:28px;}' +
    'body.gn-fs .mj-fs-wild-card .mj-mini-tile b{font-size:24px;}' +
    'body.gn-fs .mj-fs-wild-card .mj-mini-tile small{font-size:14px;}' +
    'body.gn-fs .mj-fs-tools{position:absolute;right:calc(env(safe-area-inset-right,0px) + 10px);top:calc(env(safe-area-inset-top,0px) + 12px);z-index:20;display:flex;flex-direction:column;align-items:center;gap:10px;}' +
    'body.gn-fs .mj-tool-item{display:flex;flex-direction:column;align-items:center;gap:3px;}' +
    'body.gn-fs .mj-tool-btn{position:relative;width:52px;height:52px;border-radius:50%;border:1.5px solid rgba(255,255,255,.22);background:rgba(12,28,20,.8);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);-webkit-tap-highlight-color:transparent;transition:transform .12s,border-color .15s,background .15s;}' +
    'body.gn-fs .mj-tool-btn:active{transform:scale(.93);}' +
    'body.gn-fs .mj-tool-btn.active{border-color:#c8a45c;background:rgba(48,38,14,.88);color:#ffe49c;}' +
    'body.gn-fs .mj-tool-btn.has-ready::after{content:"";position:absolute;top:5px;right:6px;width:9px;height:9px;border-radius:50%;background:#51cf66;border:1.5px solid #14281d;}' +
    'body.gn-fs .mj-tool-btn svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}' +
    'body.gn-fs .mj-tool-label{font-size:11px;font-weight:700;color:rgba(255,255,255,.92);text-shadow:0 1px 3px rgba(0,0,0,.75);line-height:1.1;pointer-events:none;}' +
    'body.gn-fs .mj-fs-panel{position:absolute;right:calc(env(safe-area-inset-right,0px) + 70px);top:calc(env(safe-area-inset-top,0px) + 12px);z-index:25;width:min(276px,46vw);max-height:calc(100% - 104px);display:flex;flex-direction:column;border-radius:14px;background:rgba(12,28,20,.95);border:1.5px solid rgba(200,164,92,.48);box-shadow:0 12px 32px rgba(0,0,0,.55);color:#fff;overflow:hidden;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}' +
    '.mj-fs-panel-hd{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1);font-size:13px;font-weight:800;color:#ffe49c;}' +
    '.mj-fs-panel-close{width:26px;height:26px;border:0;border-radius:50%;background:rgba(255,255,255,.1);color:#fff;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}' +
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
            '</div>' +
            '<div class="mj-fs-only mj-fs-panel" id="mjFsPanel" style="display:none"></div>' +
          '</div>';
        canvas = document.getElementById('mjCanvas');
        ctx = canvas.getContext('2d');
        // 强制拉取牌面字体（canvas 不触发懒加载），字体就绪后重绘一帧，
        // 避免开牌瞬间字牌/万条用回退字体渲染
        if (document.fonts && document.fonts.load) {
          try {
            document.fonts.load('32px "Ma Shan Zheng"').then(function() { draw(); }).catch(function() {});
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
        if (tenpaiBtn) tenpaiBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          toggleFsPanel('tenpai');
        });
        if (logBtn) logBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          toggleFsPanel('log');
        });
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseleave', function() { _hoverIdx = -1; draw(); });
        // 重置闭包状态：init 在跨局重启时会再次调用，必须清掉上一局残留
        _prevPhase = null;
        _swapSelected = [];
        _shownWinners = new Set();
        _prevMeldCounts = [];
        _claimEffects = [];
        _lastDiscardId = null;
        _drawPulse = 0;
        _activePanel = null;
        _discardHistory = [];
        _lastRoundMarker = null;
        _wildcardCardVisible = false;
        _wildcardShownKey = null;
        if (_wildcardTimer) { clearTimeout(_wildcardTimer); _wildcardTimer = null; }
        if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
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
        // 检测新弃牌 → 触发落点脉冲
        var ld = state && state.lastDiscard;
        if (ld && ld.id !== _lastDiscardId) {
          _lastDiscardId = ld.id;
          _lastDiscardPulse = 1;
          startAnimLoop();
        }
        // 检测新摸牌 → 触发青蓝脉冲（与黄色轮到你区分）
        var curDrawn = state && state.drawn;
        if (curDrawn && curDrawn !== _lastDrawnId && state.currentPlayer === _playerIndex && state.phase === 'play') {
          _lastDrawnId = curDrawn;
          _drawPulse = 1;
          startAnimLoop();
        }
        if (!curDrawn) { _lastDrawnId = null; _drawPulse = 0; }
        // 检测新增明牌 → 触发碰杠吃胡动画
        // init 后首帧（含重连）只记录现状，不把已有明牌/胡牌当新事件播放
        var firstFrame = _prevPhase === null;
        if (state && state.melds) {
          for (var i = 0; i < state.melds.length; i++) {
            var cnt = state.melds[i] ? state.melds[i].length : 0;
            var prev = _prevMeldCounts[i] || 0;
            if (!firstFrame && cnt > prev && cnt > 0) {
              var md = state.melds[i][cnt - 1];
              var type = md.type;
              var label = type === 'kong' ? t('mj_kong', '杠') : type === 'pung' ? t('mj_pung', '碰') : type === 'chow' ? t('mj_chow', '吃') : type === 'win' ? t('mj_win', '胡') : '';
              if (label) {
                _claimEffects.push({ player: i, type: type, label: label, birth: Date.now() });
                if (_claimEffects.length > 8) _claimEffects.shift();
              }
            }
            _prevMeldCounts[i] = cnt;
          }
        }
        // 胡牌效果（仅首次触发，避免血战到底反复弹出）
        var stWinners = winnersOf(state);
        if (stWinners.length > 0) {
          for (var w = 0; w < stWinners.length; w++) {
            var wPlayer = stWinners[w];
            if (!_shownWinners.has(wPlayer)) {
              _shownWinners.add(wPlayer);
              if (!firstFrame) _claimEffects.push({ player: wPlayer, type: 'win', label: t('mj_win', '胡') + '!', birth: Date.now() });
            }
          }
        }
        if (_claimEffects.length > 0 && !_animTimer) startAnimLoop();
        updateDiscardHistory();
        draw();
        drawControls();
        syncFsOverlays();
        syncCountdownTimer();
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

  // ---- 动画循环：弃牌脉冲 + 碰杠效果 + 新摸牌脉冲，空闲自动停 ----
  function startAnimLoop() {
    if (_animTimer) return;
    var tick = function () {
      var active = false;
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
      // 碰杠效果（2 秒生命周期）
      if (_claimEffects.length > 0) {
        var now = Date.now();
        _claimEffects = _claimEffects.filter(function(e){ return (now - e.birth) < 2000; });
        if (_claimEffects.length > 0) active = true;
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
      var wrap = board ? board.closest('.mj-wrap') : null;
      if (wrap) {
        wrap.style.setProperty('--mj-status-bottom', (TH + 12) + 'px');
        wrap.style.setProperty('--mj-actions-bottom', (TH + 12) + 'px');
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
        var neededH = H + (handRows - 1) * (TH + 12) + 20;
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
    // 恢复滚动位置
    if (board && board.scrollHeight > board.clientHeight) {
      board.scrollTop = oldScrollRatio * (board.scrollHeight - board.clientHeight);
    }
    if (shortLand) {
      var wrap = canvas.closest('.mj-wrap');
      if (wrap && wrap.getBoundingClientRect().top > 2) wrap.scrollIntoView({ block: 'start' });
    }
  }

  // ---- 牌面绘制 ----

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTileFace(x, y, w, h, tile, highlight) {
    // highlight: false/0 = none, 1/'hover' = 金色(悬停), 2/'drawn' = 青蓝(新摸, 与黄色轮提示区分)
    var isHover = highlight === 1 || highlight === true || highlight === 'hover';
    var isDrawn = highlight === 2 || highlight === 'drawn';
    ctx.save();
    // 投影：牌从台面浮起（自己手牌才画投影，牌河/明牌省略以保性能）
    if (w >= TW * 0.9) {
      ctx.shadowColor = 'rgba(0,0,0,.3)';
      ctx.shadowBlur = Math.max(3, w * 0.1);
      ctx.shadowOffsetY = Math.max(2, h * 0.05);
    }
    // 象牙白渐变（顶亮底暗，模拟顶光）
    var grad = ctx.createLinearGradient(x, y, x, y + h);
    if (isHover) {
      grad.addColorStop(0, '#fffef6');
      grad.addColorStop(1, '#f4eac4');
    } else if (isDrawn) {
      grad.addColorStop(0, '#ecfeff');
      grad.addColorStop(1, '#a5f3fc');
    } else {
      grad.addColorStop(0, '#fdfbf0');
      grad.addColorStop(0.45, '#f9f4e3');
      grad.addColorStop(1, '#efe6c8');
    }
    ctx.fillStyle = grad;
    roundRect(x, y, w, h, 5);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // 描边：悬停金色，新摸青蓝，普通灰
    if (isHover) ctx.strokeStyle = '#c8a45c';
    else if (isDrawn) ctx.strokeStyle = '#06b6d4';
    else ctx.strokeStyle = 'rgba(0,0,0,.16)';
    ctx.lineWidth = (isHover || isDrawn) ? 2.5 : 1;
    roundRect(x, y, w, h, 5);
    ctx.stroke();
    // 顶边高光（倒角反光）
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 1.5);
    ctx.lineTo(x + w - 5, y + 1.5);
    ctx.stroke();

    if (!tile || tile.k === undefined) { ctx.restore(); return; }

    var isHonour = (tile.k === 'feng' || tile.k === 'jian');
    var col = SUIT_COLOR[tile.k] || '#333';
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isHonour) {
      var name = HONOUR[tile.k] && HONOUR[tile.k][tile.n] || '';
      ctx.font = 'bold ' + Math.floor(h * 0.44) + 'px "Ma Shan Zheng","LXGW WenKai","KaiTi","Microsoft YaHei",serif';
      ctx.fillText(name, x + w / 2, y + h / 2 + 1);
      // 番子右上角小红点（中/发）
      if (tile.k === 'jian' && (tile.n === 1 || tile.n === 2)) {
        ctx.fillStyle = 'rgba(192,48,48,.7)';
        ctx.beginPath();
        ctx.arc(x + w - 5, y + 5, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.font = 'bold ' + Math.floor(h * 0.42) + 'px "Ma Shan Zheng","LXGW WenKai","KaiTi","Microsoft YaHei",serif';
      ctx.fillText(String(tile.n), x + w / 2, y + h * 0.35);
      ctx.font = Math.floor(h * 0.26) + 'px "Ma Shan Zheng","LXGW WenKai","KaiTi","Microsoft YaHei",serif';
      ctx.fillText(SUIT_GLYPH[tile.k] || '', x + w / 2, y + h * 0.72);
    }
    ctx.restore();
  }

  function drawTileBack(x, y, w, h) {
    ctx.save();
    // 牌背：深竹青渐变
    var grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#3a7d6e');
    grad.addColorStop(1, '#2a5c50');
    ctx.fillStyle = grad;
    roundRect(x, y, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, 5);
    ctx.stroke();
    // 背纹：内框+双菱形（经典麻将牌背纹样）
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1;
    roundRect(x + w * .16, y + h * .16, w * .68, h * .68, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * .3);
    ctx.lineTo(x + w * .7, y + h / 2);
    ctx.lineTo(x + w / 2, y + h * .7);
    ctx.lineTo(x + w * .3, y + h / 2);
    ctx.closePath();
    ctx.stroke();
    // 内菱形
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * .4);
    ctx.lineTo(x + w * .6, y + h / 2);
    ctx.lineTo(x + w / 2, y + h * .6);
    ctx.lineTo(x + w * .4, y + h / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
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

    // 背景：深墨绿
    ctx.fillStyle = '#14281d';
    ctx.fillRect(0, 0, W, H);
    VH = H;
    if (_portrait) {
      // 桌面区 = 手牌（和自己的明牌、定缺标签）上方的部分
      var myMelds = _state.melds && _state.melds[_playerIndex];
      VH = handTopY() - 26 - (myMelds && myMelds.length ? Math.round(TH * 0.3) + 8 : 0);
    }
    var cx = W / 2, cy = VH / 2;
    // 中央椭圆桌面（径向渐变，中心亮四周暗 = 聚光灯）
    var rx = Math.min(W, VH) * 0.46, ry = Math.min(W, VH) * 0.38;
    if (_portrait) { rx = W * 0.46; ry = VH * 0.42; }
    var felt = ctx.createRadialGradient(cx, cy * 0.92, ry * 0.1, cx, cy, Math.max(rx, ry));
    felt.addColorStop(0, '#2f5a40');
    felt.addColorStop(0.7, '#234731');
    felt.addColorStop(1, '#163020');
    ctx.save();
    ctx.fillStyle = felt;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // 金色双圈镶边
    ctx.strokeStyle = 'rgba(200,164,92,.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,164,92,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 5, ry + 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    drawOpponents();
    drawOwnHand();
    drawDiscards();
    drawMelds();
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
    var handBottomPad = 6;
    var handTop = H - TH - handBottomPad;
    var statusH = 24;
    var statusTop = handTop - statusH - 8;
    var rightToolsW = 68;
    var tableLeft = 10;
    var tableRight = W - rightToolsW;
    var tableCx = Math.round((tableLeft + tableRight) / 2);
    var hasWild = !!getWildcardTile(_state);
    var topLeftClear = hasWild ? 148 : 66;

    var oppTopW = clamp(Math.round(H * 0.05), 16, 28);
    var oppTopH = Math.round(oppTopW * 1.38);
    var oppTopY = 8;
    var topRowBottom = oppTopY + oppTopH;

    var cy = Math.round((topRowBottom + statusTop) / 2);
    var compassS = clamp(Math.round((statusTop - topRowBottom) * 0.31), 60, 114);
    var infoH = Math.max(14, Math.round(compassS * 0.22));

    var sideTileW = clamp(Math.round(H * 0.058), 20, 36);
    var leftTileX = tableLeft;
    var leftTileRight = leftTileX + sideTileW;
    var rightTileX = tableRight - sideTileW;
    var rightTileLeft = rightTileX;

    var hCardW = clamp(Math.round(W * 0.145), 112, 148);
    var hCardH = clamp(Math.round(H * 0.098), 34, 48);
    var sCardW = clamp(Math.round(W * 0.11), 84, 120);
    var sCardH = clamp(Math.round(H * 0.12), 44, 60);

    var meCard = { x: 12, y: handTop - hCardH - 8, w: hCardW, h: hCardH };
    var leftCard = { x: leftTileRight + 6, y: Math.round(cy - sCardH / 2), w: sCardW, h: sCardH };
    var rightCard = { x: rightTileLeft - sCardW - 6, y: Math.round(cy - sCardH / 2), w: sCardW, h: sCardH };
    var oppCard = { x: Math.min(tableCx + 150, tableRight - hCardW - 4), y: 6, w: hCardW, h: hCardH };

    return {
      handBottomPad: handBottomPad,
      handTopY: handTop,
      statusTopY: statusTop,
      rightToolsW: rightToolsW,
      tableLeft: tableLeft,
      tableRight: tableRight,
      tableCx: tableCx,
      topLeftClear: topLeftClear,
      oppTopW: oppTopW,
      oppTopH: oppTopH,
      oppTopY: oppTopY,
      topRowBottom: topRowBottom,
      cy: cy,
      compassS: compassS,
      infoH: infoH,
      sideTileW: sideTileW,
      leftTileX: leftTileX,
      leftTileRight: leftTileRight,
      rightTileX: rightTileX,
      rightTileLeft: rightTileLeft,
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

  function drawFsTable() {
    var m = _fsMetrics = computeFsMetrics();
    VH = m.handTopY;

    // 铺满视口的桌面渐变 + 柔和聚光灯
    ctx.fillStyle = '#13271c';
    ctx.fillRect(0, 0, W, H);
    var felt = ctx.createRadialGradient(m.tableCx, m.cy, 20, m.tableCx, m.cy, Math.max(W, H) * 0.62);
    felt.addColorStop(0, '#2c583e');
    felt.addColorStop(0.55, '#1f422d');
    felt.addColorStop(1, '#12261b');
    ctx.fillStyle = felt;
    ctx.fillRect(0, 0, W, H);

    // 桌面内框细金线（柔和边界）
    ctx.save();
    ctx.strokeStyle = 'rgba(200,164,92,.14)';
    ctx.lineWidth = 1.5;
    roundRect(6, 5, W - 12, m.handTopY - 8, 16);
    ctx.stroke();
    ctx.restore();

    drawFsOpponents(m);
    drawFsCompass(m);
    drawFsDiscards(m);
    drawFsOwnHandAndMelds(m);
    drawFsPlayerCards(m);
    drawClaimEffects();
    drawScorePanel();
  }

  function drawFsSideTileBack(x, y, w, h) {
    ctx.save();
    var grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, '#3a7d6e');
    grad.addColorStop(1, '#2a5c50');
    ctx.fillStyle = grad;
    roundRect(x, y, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, 3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    roundRect(x + w * 0.14, y + h * 0.2, w * 0.72, h * 0.6, 2);
    ctx.stroke();
    ctx.restore();
  }

  function meldGroupTiles(md) {
    var cnt = md.type === 'kong' ? 4 : 3;
    var out = [];
    for (var i = 0; i < cnt; i++) {
      out.push((md.tiles && md.tiles[i]) || md.tile || null);
    }
    return out;
  }

  function drawFsOpponents(m) {
    var seats = _state.hands.length;
    var gap = 2;
    for (var s = 0; s < seats; s++) {
      if (s === _playerIndex) continue;
      var pos = seatPos(s);
      var count = handCount(s);
      var melds = (_state.melds && _state.melds[s]) || [];

      if (pos === 'top') {
        var tw = m.oppTopW, th = m.oppTopH;
        var y0 = m.oppTopY;
        var mw = Math.max(13, Math.round(tw * 0.88));
        var mh = Math.round(mw * 1.38);
        var mGap = 2, groupGap = 5;
        var meldW = 0;
        for (var mg = 0; mg < melds.length; mg++) {
          meldW += (melds[mg].type === 'kong' ? 4 : 3) * (mw + mGap) - mGap + groupGap;
        }
        var backsW = count > 0 ? count * (tw + gap) - gap : 0;
        var x0 = Math.round(m.tableCx - backsW / 2);
        var leftEdge = x0 - (meldW > 0 ? meldW + 4 : 0);
        if (leftEdge < m.topLeftClear) {
          x0 += (m.topLeftClear - leftEdge);
        }
        var maxRight = m.tableRight - m.hCardW - 12;
        if (x0 + backsW > maxRight) x0 = Math.max(m.topLeftClear + meldW, maxRight - backsW);

        if (meldW > 0) {
          var mx = x0 - meldW - 4;
          var my = y0 + (th - mh);
          for (var g = 0; g < melds.length; g++) {
            var gt = meldGroupTiles(melds[g]);
            for (var k = 0; k < gt.length; k++) {
              if (melds[g].concealed || !gt[k]) drawTileBack(mx, my, mw, mh);
              else drawTileFace(mx, my, mw, mh, gt[k], false);
              mx += mw + mGap;
            }
            mx += groupGap - mGap;
          }
        }
        for (var i = 0; i < count; i++) {
          drawTileBack(x0 + i * (tw + gap), y0, tw, th);
        }
        m.oppRowRight = count > 0 ? (x0 + backsW) : (m.tableCx + 20);
        m.oppCard = {
          x: Math.min(m.oppRowRight + 8, m.tableRight - m.hCardW - 4),
          y: 6,
          w: m.hCardW,
          h: m.hCardH
        };
      } else {
        // 左右家：靠边单列竖排牌背 + 明牌紧邻卡片下方
        var minY = Math.max(m.topRowBottom + 8, 62);
        var maxY = m.meCard.y - 6;
        var availH = Math.max(60, maxY - minY);
        var sideGap = 1.5;
        var sideH = count > 0 ? Math.min(Math.round(m.sideTileW * 0.62), Math.floor((availH - (count - 1) * sideGap) / count)) : 12;
        sideH = Math.max(8, sideH);
        var totalH = count > 0 ? count * sideH + (count - 1) * sideGap : 0;
        var startY = Math.round(clamp(m.cy - totalH / 2, minY, maxY - totalH));
        var colX = pos === 'left' ? m.leftTileX : m.rightTileX;
        for (var j = 0; j < count; j++) {
          drawFsSideTileBack(colX, startY + j * (sideH + sideGap), m.sideTileW, sideH);
        }
        if (melds.length > 0) {
          var card = pos === 'left' ? m.leftCard : m.rightCard;
          var smw = Math.max(12, Math.min(18, Math.floor((m.sCardW - 10) / 4) - 1));
          var smh = Math.round(smw * 1.36);
          var smGap = 1.5;
          var myStart = card.y + card.h + 5;
          var myDir = 1;
          if (myStart + melds.length * (smh + 3) > m.meCard.y - 4) {
            myStart = card.y - 5 - smh;
            myDir = -1;
          }
          for (var sg = 0; sg < melds.length; sg++) {
            var sgt = meldGroupTiles(melds[sg]);
            var rowW = sgt.length * (smw + smGap) - smGap;
            var rx0 = pos === 'left' ? card.x : (card.x + card.w - rowW);
            var ry = myStart + sg * (smh + 3) * myDir;
            for (var sk = 0; sk < sgt.length; sk++) {
              if (melds[sg].concealed || !sgt[sk]) drawTileBack(rx0 + sk * (smw + smGap), ry, smw, smh);
              else drawTileFace(rx0 + sk * (smw + smGap), ry, smw, smh, sgt[sk], false);
            }
          }
        }
      }
    }
  }

  function drawFsCompass(m) {
    var S = m.compassS;
    var x = Math.round(m.tableCx - S / 2);
    var y = Math.round(m.cy - S / 2);
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
    // 中心罗盘圆角方块
    ctx.fillStyle = 'rgba(10, 26, 17, 0.88)';
    roundRect(x, y, S, S, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 164, 92, 0.42)';
    ctx.lineWidth = 1.5;
    roundRect(x, y, S, S, 12);
    ctx.stroke();

    // 内环细框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    roundRect(x + 4, y + 4, S - 8, S - 8, 9);
    ctx.stroke();

    // 当前行动方边栏高亮
    if (activePos) {
      ctx.fillStyle = '#f5c451';
      ctx.shadowColor = 'rgba(245, 196, 81, 0.75)';
      ctx.shadowBlur = 8;
      var barLen = Math.round(S * 0.48);
      var barT = 3.5;
      if (activePos === 'bottom') roundRect(m.tableCx - barLen / 2, y + S - barT - 1, barLen, barT, 2);
      else if (activePos === 'top') roundRect(m.tableCx - barLen / 2, y + 1, barLen, barT, 2);
      else if (activePos === 'left') roundRect(x + 1, m.cy - barLen / 2, barT, barLen, 2);
      else roundRect(x + S - barT - 1, m.cy - barLen / 2, barT, barLen, 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 东南西北方位字
    var windFont = Math.max(10, Math.round(S * 0.16));
    var wPad = Math.max(10, Math.round(S * 0.14));
    ctx.font = 'bold ' + windFont + 'px system-ui,"Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var dirs = [
      { key: 'top', px: m.tableCx, py: y + wPad },
      { key: 'bottom', px: m.tableCx, py: y + S - wPad },
      { key: 'left', px: x + wPad, py: m.cy },
      { key: 'right', px: x + S - wPad, py: m.cy }
    ];
    for (var d = 0; d < dirs.length; d++) {
      var dir = dirs[d];
      var isAct = activePos === dir.key;
      ctx.fillStyle = isAct ? '#ffd970' : 'rgba(255, 255, 255, 0.46)';
      ctx.fillText(sideWinds[dir.key], dir.px, dir.py);
    }

    // 中央：若有倒计时则大字显示秒数，下面小字显示余牌；无倒计时则只居中显示余牌
    var secLeft = getTurnSecondsLeft();
    var wallCount = getWallCount();
    var wallFont = Math.max(10, Math.round(S * 0.145));
    if (secLeft !== null) {
      var numFont = Math.max(18, Math.round(S * 0.30));
      ctx.font = '800 ' + numFont + 'px system-ui,"Microsoft YaHei",sans-serif';
      ctx.fillStyle = secLeft <= 5 ? '#ff7b7b' : '#ffe49c';
      ctx.fillText(String(secLeft), m.tableCx, m.cy - (wallCount !== null ? S * 0.05 : 0));
      if (wallCount !== null) {
        ctx.font = '600 ' + wallFont + 'px system-ui,"Microsoft YaHei",sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.fillText(t('mj_wall_short', '余') + ' ' + wallCount, m.tableCx, m.cy + S * 0.18);
      }
    } else if (wallCount !== null) {
      ctx.font = 'bold ' + Math.max(11, Math.round(S * 0.18)) + 'px system-ui,"Microsoft YaHei",sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
      ctx.fillText(t('mj_wall_short', '余') + ' ' + wallCount, m.tableCx, m.cy);
    }

    // 罗盘下方：第N局 · 底分 X
    var rn = _state.roundNumber || 1;
    var info = t('mj_round_label', '第') + rn + t('mj_round_unit', '局');
    var baseScore = typeof _state.baseScore === 'number' ? _state.baseScore
      : (typeof _state.basePoints === 'number' ? _state.basePoints
      : (typeof _state.ante === 'number' ? _state.ante
      : (_state.cfg && typeof _state.cfg.baseScore === 'number' ? _state.cfg.baseScore : null)));
    if (baseScore !== null) info += ' · ' + t('mj_base_score', '底分') + ' ' + baseScore;
    ctx.font = '600 ' + Math.max(10, Math.round(m.infoH * 0.72)) + 'px system-ui,"Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText(info, m.tableCx, y + S + m.infoH / 2 + 2);
    ctx.restore();
  }

  function drawFsDiscardPile(tiles, zoneX, zoneY, zoneW, zoneH, align, anchorBottom, vCenter) {
    if (!tiles || !tiles.length) return;
    var gap = 2;
    var dw = clamp(Math.round(H * 0.048), 15, 24);
    var dh = Math.round(dw * 1.38);
    var cols = Math.max(4, Math.floor((zoneW + gap) / (dw + gap)));
    var rows = Math.ceil(tiles.length / cols);
    while (dw > 12 && rows * (dh + gap) - gap > zoneH) {
      dw--;
      dh = Math.round(dw * 1.38);
      cols = Math.max(4, Math.floor((zoneW + gap) / (dw + gap)));
      rows = Math.ceil(tiles.length / cols);
    }
    var gridH = rows * (dh + gap) - gap;
    var startY = anchorBottom
      ? Math.max(zoneY, zoneY + zoneH - gridH)
      : (vCenter ? zoneY + Math.max(0, (zoneH - gridH) / 2) : zoneY);
    var lastId = _state.lastDiscard && _state.lastDiscard.id;

    for (var i = 0; i < tiles.length; i++) {
      var r = Math.floor(i / cols);
      var c = i % cols;
      var rowCount = Math.min(cols, tiles.length - r * cols);
      var rowW = rowCount * (dw + gap) - gap;
      var rx;
      if (align === 'right') rx = zoneX + zoneW - rowW + c * (dw + gap);
      else if (align === 'left') rx = zoneX + c * (dw + gap);
      else rx = zoneX + (zoneW - rowW) / 2 + c * (dw + gap);
      var ry = startY + r * (dh + gap);
      var tile = tiles[i];
      var isLast = !!(lastId && tile.id === lastId);

      if (isLast && _lastDiscardPulse > 0.01) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245,196,81,' + (0.7 * _lastDiscardPulse) + ')';
        ctx.lineWidth = 2 + 2 * _lastDiscardPulse;
        var pad = 2 + 4 * _lastDiscardPulse;
        roundRect(rx - pad, ry - pad, dw + pad * 2, dh + pad * 2, 5);
        ctx.stroke();
        ctx.restore();
      }
      if (isLast) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,140,40,.95)';
        ctx.lineWidth = 2;
        roundRect(rx - 1.5, ry - 1.5, dw + 3, dh + 3, 4);
        ctx.stroke();
        ctx.restore();
      }
      drawTileFace(rx, ry, dw, dh, tile, isLast);
    }
  }

  function drawFsDiscards(m) {
    if (!_state.discards) return;
    var cHalf = m.compassS / 2;
    var leftBound = m.leftCard.x + m.leftCard.w + 6;
    var rightBound = m.rightCard.x - 6;
    var sideTop = m.topRowBottom + 8;
    var sideH = Math.max(40, m.statusTopY - sideTop);

    for (var s = 0; s < _state.discards.length; s++) {
      var pile = _state.discards[s];
      if (!pile || pile.length === 0) continue;
      var pos = seatPos(s);
      if (pos === 'bottom') {
        var bTop = m.cy + cHalf + m.infoH + 6;
        var bH = Math.max(36, m.statusTopY - 4 - bTop);
        var bMinX = m.meCard.x + m.meCard.w + 12;
        var bW = clamp(Math.round(m.compassS * 2.4), 140, Math.max(140, (m.tableCx - bMinX) * 2));
        drawFsDiscardPile(pile, m.tableCx - bW / 2, bTop, bW, bH, 'center', false, false);
      } else if (pos === 'top') {
        var tTop = m.topRowBottom + 4;
        var tH = Math.max(36, (m.cy - cHalf - 4) - tTop);
        var tW = clamp(Math.round(m.compassS * 2.4), 140, rightBound - leftBound);
        drawFsDiscardPile(pile, m.tableCx - tW / 2, tTop, tW, tH, 'center', true, false);
      } else if (pos === 'left') {
        var lW = Math.max(54, (m.tableCx - cHalf - 6) - leftBound);
        drawFsDiscardPile(pile, leftBound, sideTop, lW, sideH, 'right', false, true);
      } else {
        var rX = m.tableCx + cHalf + 6;
        var rW = Math.max(54, rightBound - rX);
        drawFsDiscardPile(pile, rX, sideTop, rW, sideH, 'left', false, true);
      }
    }
  }

  function drawFsOwnHandAndMelds(m) {
    var hand = _state.hands[_playerIndex];
    var melds = (_state.melds && _state.melds[_playerIndex]) || [];
    var hasHand = Array.isArray(hand) && hand.length > 0;
    _layout = [];
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

    var startX = Math.round((W - dims.total) / 2);
    var baseY = H - th - m.handBottomPad;
    var curX = startX;

    for (var oi = 0; oi < order.length; oi++) {
      var idx = order[oi];
      if (oi === order.length - 1 && idx === drawnIdx && oi > 0) curX += drawnGap;
      var tile = hand[idx];
      var isDrawn = idx === drawnIdx;
      var isSwapSel = _state.phase === 'swap' && _swapSelected && _swapSelected.indexOf(tile.id) >= 0;
      var hover = _hoverIdx === idx;
      var lift = isSwapSel ? -12 : (hover ? -10 : (isDrawn ? -8 : 0));

      if (isSwapSel) {
        ctx.save();
        ctx.shadowColor = 'rgba(200,164,92,.7)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#c8a45c';
        ctx.lineWidth = 3;
        roundRect(curX - 3, baseY + lift - 3, tw + 6, th + 6, 8);
        ctx.stroke();
        ctx.restore();
      }
      if (isDrawn && _drawPulse > 0.01) {
        ctx.save();
        ctx.shadowColor = 'rgba(6,182,212,' + (0.65 * _drawPulse) + ')';
        ctx.shadowBlur = 14 + 8 * _drawPulse;
        ctx.fillStyle = 'rgba(6,182,212,' + (0.10 * _drawPulse) + ')';
        roundRect(curX - 4, baseY + lift - 4, tw + 8, th + 8, 8);
        ctx.fill();
        ctx.restore();
      }
      drawTileFace(curX, baseY + lift, tw, th, tile, hover ? 1 : (isDrawn ? 2 : 0));
      if (isDrawn) {
        ctx.save();
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(curX + tw - 8, baseY + lift + 8, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t('mj_new_tile', '新'), curX + tw - 8, baseY + lift + 8.5);
        ctx.restore();
      }
      _layout.push({ x: curX, y: baseY + lift, w: tw, h: th - lift, idx: idx });
      curX += tw + gap;
    }

    // 自己的明牌摆在手牌右侧，底部对齐
    if (melds.length > 0) {
      var mx = startX + dims.hw + (dims.hw > 0 ? handMeldGap : 0);
      var my = H - mh - m.handBottomPad;
      for (var mg = 0; mg < melds.length; mg++) {
        var gt = meldGroupTiles(melds[mg]);
        for (var gk = 0; gk < gt.length; gk++) {
          if (melds[mg].concealed || !gt[gk]) drawTileBack(mx, my, mw, mh);
          else drawTileFace(mx, my, mw, mh, gt[gk], false);
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
    // 对手牌背：对家横排在顶部；左右家打横、垂直向下延伸（2列多行网格）
    var tw = oppTW(), th = oppTH();
    var gap = 2;
    var sideCols = 2; // 左右家每行摆 2 张（打横），然后向下延伸
    for (var s = 0; s < seats; s++) {
      if (s === _playerIndex) continue;
      var count = handCount(s);
      if (count === 0) continue;
      var pos = seatPos(s);

      if (pos === 'top') {
        // 对家：顶部横排居中（单行）
        var totalW = count * (tw + gap);
        var x0 = (W - totalW) / 2;
        var y0 = 30;
        for (var i = 0; i < count; i++) drawTileBack(x0 + i * (tw + gap), y0, tw, th);
      } else if (pos === 'left') {
        // 左家：打横、垂直向下（2列多行，靠左对齐）
        var rowsL = Math.ceil(count / sideCols);
        var rowHL = th + gap;
        var gridHL = rowsL * rowHL;
        var startYL = (VH - gridHL) / 2;
        var startXL = 20;
        for (var k = 0; k < count; k++) {
          var rowL = Math.floor(k / sideCols);
          var colL = k % sideCols;
          drawTileBack(startXL + colL * (tw + gap), startYL + rowL * rowHL, tw, th);
        }
      } else {
        // 右家：打横、垂直向下（2列多行，靠右对齐）
        var rows = Math.ceil(count / sideCols);
        var rowH = th + gap;
        var gridH = rows * rowH;
        var startY = (VH - gridH) / 2;
        var gridW = sideCols * (tw + gap);
        var startX = W - gridW - 20;
        for (var j = 0; j < count; j++) {
          var row = Math.floor(j / sideCols);
          var col = j % sideCols;
          drawTileBack(startX + col * (tw + gap), startY + row * rowH, tw, th);
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
    return H - rows * (TH + 6) - handBottomPad();
  }
  // 手牌下沿留白：竖屏多留几像素，"第N局·余牌"不被轮到你的高亮框压住
  function handBottomPad() { return _portrait ? 22 : 14; }

  function drawOwnHand() {
    var hand = _state.hands[_playerIndex];
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
      if (isFs()) th = Math.round(tw * 1.4);
    }
    var totalW = (useMultiRow ? perRow : n) * (tw + 4);
    var startX = (W - totalW) / 2;
    // 垂直居中多行手牌
    var totalHandH = rows * (th + 6);
    var y = H - totalHandH - handBottomPad();
    _layout = [];
    for (var i = 0; i < n; i++) {
      var row = useMultiRow ? Math.floor(i / perRow) : 0;
      var col = useMultiRow ? (i % perRow) : i;
      var rowTiles = useMultiRow ? Math.min(perRow, n - row * perRow) : n;
      var rowW = rowTiles * (tw + 4);
      var rowStartX = (W - rowW) / 2;
      var x = rowStartX + col * (tw + 4);
      var tileY = y + row * (th + 6);
      var isDrawn = _state.drawn && hand[i].id === _state.drawn && _state.currentPlayer === _playerIndex && _state.phase === 'play';
      var isSwapSel = _state.phase === 'swap' && _swapSelected && _swapSelected.indexOf(hand[i].id) >= 0;
      var hover = _hoverIdx === i;
      var lift = isSwapSel ? -14 : (hover ? -12 : (isDrawn ? -10 : 0));
      // 换三张选中：金色粗边框 + 上浮
      if (isSwapSel) {
        ctx.save();
        ctx.shadowColor = 'rgba(200,164,92,.7)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#c8a45c';
        ctx.lineWidth = 3;
        roundRect(x - 3, tileY + lift - 3, tw + 6, th + 6, 8);
        ctx.stroke();
        ctx.restore();
      }
      // 新摸牌青蓝外发光
      if (isDrawn && _drawPulse > 0.01) {
        ctx.save();
        ctx.shadowColor = 'rgba(6,182,212,' + (0.65 * _drawPulse) + ')';
        ctx.shadowBlur = 16 + 10 * _drawPulse;
        ctx.fillStyle = 'rgba(6,182,212,' + (0.10 * _drawPulse) + ')';
        roundRect(x - 4, tileY + lift - 4, tw + 8, th + 8, 8);
        ctx.fill();
        ctx.restore();
      }
      var hl = hover ? 1 : (isDrawn ? 2 : 0);
      drawTileFace(x, tileY + lift, tw, th, hand[i], hl);
      // 新摸角标”新”
      if (isDrawn) {
        ctx.save();
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(x + tw - 9, tileY + lift + 9, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t('mj_new_tile', '新'), x + tw - 9, tileY + lift + 9.5);
        ctx.restore();
      }
      // 命中区向下延伸到原位：上浮后鼠标仍在牌下沿时不会失去悬停而来回闪
      _layout.push({ x: x, y: tileY + lift, w: tw, h: th - lift, idx: i });
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
    var oppTh = oppTH(); // same scale as drawOpponents (landscape phones are short, not narrow)
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
    } else if (isFs()) {
      var sideMargin = 20 + 2 * (oppTW() + 2) + 16;
      zoneW = Math.max(160, Math.min(W * 0.64, W - sideMargin * 2));
      var bottomLimit = handTopY() - 26;
      if (_state.melds && _state.melds[_playerIndex] && _state.melds[_playerIndex].length) {
        bottomLimit = Math.min(bottomLimit, H - TH - 28 - meldTH() - 8);
      }
      zoneH = Math.max(dh * 2, bottomLimit - topClear);
      while (dw > 14 && Math.ceil(allTiles.length / Math.max(6, Math.floor(zoneW / (dw + gap)))) * (dh + gap) > zoneH) {
        dw--; dh = Math.round(dw * 1.4);
      }
    }
    var perRow = Math.max(6, Math.floor(zoneW / (dw + gap)));
    if (_portrait) zoneX = (W - perRow * (dw + gap) + gap) / 2;
    else if (isFs()) {
      var fsRows = Math.ceil(allTiles.length / perRow);
      var fsGridH = fsRows * (dh + gap) - gap;
      zoneX = (W - perRow * (dw + gap) + gap) / 2;
      zoneY = topClear + Math.max(0, (zoneH - fsGridH) / 2);
    }
    // 中央网格：按全局时间从左到右、从上到下，新牌始终在末尾
    for (var idx = 0; idx < allTiles.length; idx++) {
      var row = Math.floor(idx / perRow);
      var col = idx % perRow;
      var x = zoneX + col * (dw + gap);
      var y = zoneY + row * (dh + gap);
      var dt = allTiles[idx];
      var isLast = _state.lastDiscard && dt.tile.id === _state.lastDiscard.id;
      // 落点脉冲光晕
      if (isLast && _lastDiscardPulse > 0.01) {
        ctx.save();
        ctx.strokeStyle = 'rgba(200,164,92,' + (0.6 * _lastDiscardPulse) + ')';
        ctx.lineWidth = 2 + 3 * _lastDiscardPulse;
        var pad = 3 + 6 * _lastDiscardPulse;
        roundRect(x - pad, y - pad, dw + pad * 2, dh + pad * 2, 6);
        ctx.stroke();
        ctx.restore();
      }
      // 刚出的牌持久高亮外框（亮橙色，区别于 hover 金色）
      if (isLast) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,140,40,.9)';
        ctx.lineWidth = 2.5;
        var lpad = 2;
        roundRect(x - lpad, y - lpad, dw + lpad * 2, dh + lpad * 2, 5);
        ctx.stroke();
        ctx.restore();
      }
      drawTileFace(x, y, dw, dh, dt.tile, isLast);
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
        for (var bg = 0; bg < groups.length; bg++) {
          for (var bk = 0; bk < groups[bg].count; bk++) {
            var bx = W / 2 - bRowW / 2 + bPlaced * (tw + gap) + bg * groupGap;
            var by = _portrait ? handTopY() - th - 26 : H - TH - 28 - th;
            var bt = (groups[bg].md.tiles && groups[bg].md.tiles[bk]) || groups[bg].md.tile;
            drawTileFace(bx, by, tw, th, bt, false);
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
            drawTileFace(tx, ty, tw, th, tt, false);
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
            drawTileFace(px0 + pk * (tw + gap), pY + pg * pRowH, tw, th, pt, false);
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
              drawTileFace(rx, ry, tw, th, rt, false);
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
              drawTileFace(lx, ly, tw, th, lt, false);
              lPlaced++;
            }
          }
        }
      }
    }
  }

  // ---- 碰杠吃胡动画效果 ----
  var CLAIM_COLORS = {
    pung: { bg: 'rgba(58,143,212,.9)', text: '#fff' },
    kong: { bg: 'rgba(155,109,222,.9)', text: '#fff' },
    chow: { bg: 'rgba(62,184,112,.9)', text: '#fff' },
    win:  { bg: 'rgba(224,80,80,.95)', text: '#fff' },
  };
  function drawClaimEffects() {
    if (_claimEffects.length === 0) return;
    var now = Date.now();
    for (var i = 0; i < _claimEffects.length; i++) {
      var e = _claimEffects[i];
      var age = (now - e.birth) / 1000;
      if (age > 2.0) continue; // 过期清理由动画循环 tick 负责，这里只跳过不画
      var progress = age / 2.0; // 0→1
      var alpha = 1 - progress;  // 渐隐
      var riseY = progress * 40; // 上浮
      var scale = 1 + progress * 0.3; // 放大
      // 效果位置：在该玩家牌背附近
      var pos = seatPos(e.player);
      var ex, ey;
      if (isFs() && _fsMetrics) {
        if (pos === 'bottom') { ex = _fsMetrics.tableCx; ey = _fsMetrics.handTopY - 36 - riseY; }
        else if (pos === 'top') { ex = _fsMetrics.tableCx; ey = _fsMetrics.topRowBottom + 24 + riseY; }
        else if (pos === 'left') { ex = _fsMetrics.leftCard.x + _fsMetrics.leftCard.w / 2; ey = _fsMetrics.cy - riseY; }
        else { ex = _fsMetrics.rightCard.x + _fsMetrics.rightCard.w / 2; ey = _fsMetrics.cy - riseY; }
      } else {
        if (pos === 'bottom') { ex = W / 2; ey = H - TH - 50 - riseY; }
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
      bx = W / 2 - 14 * (oppTW() + 2) / 2; by = 26; bw = 14 * (oppTW() + 2); bh = oppTH() + 8;
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

  function drawControls() {
    drawControlsInner();
    var fsOn = isFs();
    var bar = document.getElementById('mjActions');
    var status = document.getElementById('mjStatus');
    if (fsOn && bar && status) {
      var wrap = bar.closest('.mj-wrap');
      if (wrap) {
        var baseBottom = TH + 12;
        wrap.style.setProperty('--mj-actions-bottom', baseBottom + 'px');
        if (bar.children.length > 0 && status.textContent) {
          var sr = status.getBoundingClientRect();
          var br = bar.getBoundingClientRect();
          if (br.width > 0 && sr.width > 0 && br.left < sr.right + 10) {
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
        // 有可执行操作：显示对应按钮 + 过
        for (var c = 0; c < claims.length; c++) {
          var claim = claims[c];
          if (claim === 'win') bar.appendChild(btn(t('mj_win', '胡'), 'win', 'window._mjWin()'));
          else if (claim === 'kong') bar.appendChild(btn(t('mj_kong', '杠'), 'kong', 'window._mjKong()'));
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
      // 自摸：轮到自己且手牌已形成胡牌型（含副露）→ 显示"胡"按钮
      if (_state.currentPlayer === me) {
        var selfHand = _state.hands[me];
        // 自摸胡
        if (Array.isArray(selfHand) && huCheckSimple(selfHand, _state.melds[me]) && voidSatisfied(selfHand)) {
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
