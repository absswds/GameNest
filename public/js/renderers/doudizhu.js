// public/js/renderers/doudizhu.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var EASE_OUT = 'cubic-bezier(0.23,1,0.32,1)';
  var EASE_IN_OUT = 'cubic-bezier(0.77,0,0.175,1)';
  var EASE_POP = 'cubic-bezier(0.34,1.56,0.64,1)';
  var COUNTER_RANKS = ['大王','小王','2','A','K','Q','J','10','9','8','7','6','5','4','3'];
  var TIMER_RING_R = 21;
  var TIMER_RING_C = 2 * Math.PI * TIMER_RING_R;

  var selected = {}; // card id -> true
  var cardEls = {};  // card id -> DOM element
  var _prevDdzState = null;
  var _hintIndex = -1;
  var _hints = [];
  var _lastHandLen = 0;
  var _lastHandHtml = '';
  var _lastFsHandHtml = '';
  var _deadlineKey = null, _localDeadline = 0;

  var _lastContainer = null;
  var _lastPlayerIndex = 0;
  var _lastWinner = null;
  var _tableSlots = [null, null, null];
  var _seenPlayedIds = {};
  var _counterOpen = false;
  var _landlordPlayCount = 0;
  var _farmersPlayCount = 0;
  var _joinedMidRound = false;
  var _lastEventKey = null;
  var _springShownRound = null;
  var _pendingPlayRects = {};
  var _pendingPlayTime = 0;
  var _multRollRaf = 0;
  var _resizeRaf = 0;
  var _skipNextAnim = false;
  var _fsListenersBound = false;

  // Phone held sideways: opponents go to the sides and everything shrinks so hand + buttons fit.
  // (The markup uses inline styles, hence !important.)
  var LANDSCAPE_CSS = '@media (orientation: landscape) and (max-height: 540px){' +
    '#ddzWrap{display:grid !important;grid-template-columns:minmax(0,110px) minmax(0,1fr) minmax(0,110px);gap:4px 8px !important;max-width:760px !important;}' +
    '#ddzOpponents{display:contents !important;}' +
    '#ddzOpponents>div{padding:4px 8px !important;align-self:start;min-width:0;}' +
    '#ddzOpponents>div:nth-child(1){grid-column:1;grid-row:1;}' +
    '#ddzOpponents>div:nth-child(2){grid-column:3;grid-row:1;}' +
    '#ddzOpponents>div>div:nth-child(2){font-size:18px !important;margin-top:0 !important;}' +
    '#ddzPlayArea{grid-column:2;grid-row:1;min-height:0 !important;padding:6px 10px !important;gap:2px !important;border-radius:16px !important;}' +
    '#ddzHint{grid-column:1/-1;grid-row:2;padding:2px 8px !important;}' +
    '#ddzHand{grid-column:1/-1;grid-row:3;min-height:0 !important;padding:0 !important;}' +
    '#ddzHand .pc-md{--w:40px;}' +
    '#ddzHand .pc-layout-hand{padding-top:12px;}' +
    '#ddzActions{grid-column:1/-1;grid-row:4;gap:8px !important;}' +
    '#ddzActions .btn{min-height:32px;padding-top:4px;padding-bottom:4px;}' +
  '}';

  var FS_CSS =
    '#ddzFsStage{display:none;}' +
    'body.gn-fs #ddzWrap{display:none !important;}' +
    'body.gn-fs #gameStage{padding:0 !important;border:0 !important;border-radius:0 !important;display:flex;flex-direction:column;overflow:hidden;}' +
    'body.gn-fs #gameStage .board-wrap,body.gn-fs #gameStage #boardArea{flex:1 1 auto;width:100% !important;height:100% !important;max-width:none !important;min-width:0 !important;min-height:0 !important;padding:0 !important;margin:0 !important;display:flex;overflow:hidden;}' +
    'body.gn-fs #ddzFsStage{display:block;position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;box-sizing:border-box;font-family:inherit;color:var(--ge-paper,#fffdf8);background:radial-gradient(ellipse at 50% 38%,rgba(255,255,255,0.09),transparent 64%),linear-gradient(165deg,var(--ge-felt,#2f5d4a) 0%,var(--ge-felt-dark,#1f4032) 100%);user-select:none;-webkit-user-select:none;}' +
    'body.gn-fs #ddzFsTopHud{position:absolute;top:6px;left:50%;transform:translateX(-50%);max-width:calc(100% - 148px);z-index:12;display:flex;align-items:center;gap:10px;padding:4px 10px;border-radius:14px;background:rgba(18,36,28,0.74);border:1px solid rgba(255,253,248,0.15);box-shadow:0 4px 14px rgba(0,0,0,0.2);}' +
    'body.gn-fs #ddzFsBottomCards{display:flex;align-items:center;gap:4px;flex:0 0 auto;}' +
    'body.gn-fs #ddzFsBottomCards .pc-card{--w:var(--fs-mini-card-w,28px);}' +
    'body.gn-fs #ddzFsBottomCards .pc-corner-br{display:none;}' +
    'body.gn-fs .ddz-fs-hud-meta{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;white-space:nowrap;}' +
    'body.gn-fs .ddz-fs-hud-stat{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:rgba(255,253,248,0.1);font-variant-numeric:tabular-nums;}' +
    'body.gn-fs .ddz-fs-hud-mult{background:rgba(185,149,79,0.22);border:1px solid rgba(185,149,79,0.45);color:#ffe4a8;}' +
    'body.gn-fs .ddz-fs-hud-label{opacity:0.75;font-weight:600;}' +
    'body.gn-fs #ddzFsCounterBtn{position:absolute;top:8px;right:10px;z-index:25;min-width:44px;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,253,248,0.22);background:rgba(18,36,28,0.78);color:var(--ge-paper,#fffdf8);font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:4px;cursor:pointer;white-space:nowrap;transition:transform 120ms cubic-bezier(0.23,1,0.32,1),opacity 120ms cubic-bezier(0.23,1,0.32,1);}' +
    'body.gn-fs #ddzFsCounterBtn:active{transform:scale(0.97);}' +
    'body.gn-fs #ddzFsCounterBtn[aria-expanded="true"]{border-color:var(--ge-gold,#b9954f);background:rgba(32,56,44,0.92);}' +
    'body.gn-fs #ddzFsCounterPanel{position:absolute;top:56px;right:10px;z-index:30;max-width:min(360px,calc(100% - 80px));background:rgba(16,30,24,0.94);border:1px solid rgba(255,253,248,0.18);border-radius:14px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,0.36);}' +
    'body.gn-fs #ddzFsCounterPanel[hidden]{display:none;}' +
    'body.gn-fs .ddz-fs-counter-title{font-size:11px;font-weight:700;opacity:0.75;margin-bottom:6px;letter-spacing:0.03em;}' +
    'body.gn-fs .ddz-fs-counter-grid{display:grid;grid-template-columns:repeat(8,minmax(28px,1fr));gap:4px;}' +
    'body.gn-fs .ddz-fs-counter-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3px 2px;border-radius:8px;background:rgba(255,253,248,0.08);font-variant-numeric:tabular-nums;}' +
    'body.gn-fs .ddz-fs-counter-cell.is-empty{opacity:0.35;}' +
    'body.gn-fs .ddz-fs-counter-cell.is-full{border:1px solid rgba(185,149,79,0.55);color:#ffe4a8;}' +
    'body.gn-fs .ddz-fs-counter-rank{font-size:11px;font-weight:800;line-height:1.15;}' +
    'body.gn-fs .ddz-fs-counter-num{font-size:11px;font-weight:700;opacity:0.86;line-height:1.15;}' +
    'body.gn-fs .ddz-fs-opp{position:absolute;top:var(--fs-opp-top,68px);width:var(--fs-opp-w,104px);z-index:10;padding:6px 8px;border-radius:14px;background:rgba(18,36,28,0.74);border:1.5px solid rgba(255,253,248,0.16);display:flex;flex-direction:column;align-items:center;gap:4px;box-shadow:0 4px 12px rgba(0,0,0,0.22);}' +
    'body.gn-fs #ddzFsOppLeft{left:10px;}' +
    'body.gn-fs #ddzFsOppRight{right:10px;}' +
    'body.gn-fs .ddz-fs-opp.is-turn{border-color:var(--ge-gold,#b9954f);}' +
    'body.gn-fs .ddz-fs-opp.is-alarm{border-color:var(--ge-red,#c0392b);}' +
    'body.gn-fs .ddz-fs-opp-top{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;}' +
    'body.gn-fs .ddz-fs-avatar-wrap{position:relative;width:42px;height:42px;flex:0 0 42px;display:flex;align-items:center;justify-content:center;}' +
    'body.gn-fs .ddz-fs-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,253,248,0.14);border:1px solid rgba(255,253,248,0.22);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:var(--ge-paper,#fffdf8);}' +
    'body.gn-fs .ddz-fs-ring{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);pointer-events:none;}' +
    'body.gn-fs .ddz-fs-ring-bg{fill:none;stroke:rgba(255,253,248,0.14);stroke-width:3;}' +
    'body.gn-fs .ddz-fs-ring-fg{fill:none;stroke:var(--ge-gold,#b9954f);stroke-width:3.2;stroke-linecap:round;transition:stroke-dashoffset 180ms linear,stroke 180ms linear;}' +
    'body.gn-fs .ddz-fs-ring-txt{position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);padding:0 4px;border-radius:8px;background:rgba(16,30,24,0.92);font-size:10px;font-weight:800;line-height:1.3;font-variant-numeric:tabular-nums;color:#ffe4a8;}' +
    'body.gn-fs .ddz-fs-stack{position:relative;width:24px;height:34px;border-radius:4px;border:1px solid rgba(255,255,255,0.25);background:repeating-linear-gradient(45deg,rgba(255,255,255,0.07) 0 3px,transparent 3px 6px),linear-gradient(145deg,#2d3a4a,#1b2430);box-shadow:2px 2px 0 rgba(16,24,32,0.85),0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;font-variant-numeric:tabular-nums;flex:0 0 auto;}' +
    'body.gn-fs .ddz-fs-opp-name{width:100%;text-align:center;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    'body.gn-fs .ddz-fs-opp-meta{display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;width:100%;font-size:10px;font-weight:700;}' +
    'body.gn-fs .ddz-fs-role{padding:1px 6px;border-radius:999px;background:rgba(255,253,248,0.14);color:rgba(255,253,248,0.9);}' +
    'body.gn-fs .ddz-fs-role.is-landlord{background:var(--ge-gold,#b9954f);color:var(--ge-ink,#1c1b19);}' +
    'body.gn-fs .ddz-fs-score{font-variant-numeric:tabular-nums;opacity:0.82;}' +
    'body.gn-fs .ddz-fs-alarm{padding:1px 6px;border-radius:999px;background:var(--ge-red,#c0392b);color:#fff;font-size:10px;font-weight:800;animation:ddzAlarmPulse 1.1s ease-in-out infinite;}' +
    '@keyframes ddzAlarmPulse{0%,100%{opacity:1;}50%{opacity:0.62;}}' +
    'body.gn-fs .ddz-fs-play-slot{position:absolute;z-index:11;display:flex;align-items:center;pointer-events:none;}' +
    'body.gn-fs #ddzFsPlayLeft{left:calc(var(--fs-opp-w,104px) + 18px);top:calc(var(--fs-opp-top,68px) + 8px);max-width:calc(50% - var(--fs-opp-w,104px) - 24px);justify-content:flex-start;}' +
    'body.gn-fs #ddzFsPlayRight{right:calc(var(--fs-opp-w,104px) + 18px);top:calc(var(--fs-opp-top,68px) + 8px);max-width:calc(50% - var(--fs-opp-w,104px) - 24px);justify-content:flex-end;}' +
    'body.gn-fs #ddzFsPlayMe{left:50%;transform:translateX(-50%);bottom:var(--fs-playme-bottom,174px);max-width:min(560px,calc(100% - 40px));justify-content:center;}' +
    'body.gn-fs .ddz-fs-played-row{display:flex;align-items:flex-end;}' +
    'body.gn-fs .ddz-fs-played-row .pc-card{--w:var(--fs-table-card-w,39px);box-shadow:0 2px 8px rgba(0,0,0,0.32);}' +
    'body.gn-fs .ddz-fs-played-row .pc-card + .pc-card{margin-left:var(--fs-row-overlap,-18px);}' +
    'body.gn-fs .ddz-fs-played-row .pc-corner-br{display:none;}' +
    'body.gn-fs .ddz-fs-status-pill{padding:5px 12px;border-radius:999px;background:rgba(18,36,28,0.78);border:1px solid rgba(255,253,248,0.16);font-size:12px;font-weight:700;color:rgba(255,253,248,0.92);white-space:nowrap;}' +
    'body.gn-fs .ddz-fs-status-pill.is-bid{border-color:rgba(185,149,79,0.55);color:#ffe4a8;}' +
    'body.gn-fs #ddzFsMePill{position:absolute;left:10px;bottom:var(--fs-band-bottom,118px);z-index:16;max-width:190px;display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px;border-radius:999px;background:rgba(18,36,28,0.78);border:1.5px solid rgba(255,253,248,0.16);}' +
    'body.gn-fs #ddzFsMePill.is-turn{border-color:var(--ge-gold,#b9954f);}' +
    'body.gn-fs .ddz-fs-me-info{display:flex;flex-direction:column;min-width:0;gap:1px;}' +
    'body.gn-fs .ddz-fs-me-name{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    'body.gn-fs .ddz-fs-me-sub{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;}' +
    'body.gn-fs #ddzFsHint{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--fs-band-bottom,118px) + 52px);z-index:17;padding:4px 12px;border-radius:999px;background:rgba(16,30,24,0.9);border:1px solid rgba(255,253,248,0.18);font-size:12px;font-weight:700;white-space:nowrap;pointer-events:none;}' +
    'body.gn-fs #ddzFsActions{position:absolute;right:12px;bottom:var(--fs-band-bottom,116px);z-index:20;display:flex;align-items:center;gap:8px;flex-wrap:nowrap;}' +
    'body.gn-fs .ddz-fs-pill{min-height:44px;min-width:72px;padding:0 16px;border-radius:999px;font-size:14px;font-weight:800;border:1px solid rgba(255,253,248,0.24);background:rgba(20,24,22,0.72);color:var(--ge-paper,#fffdf8);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;font-family:inherit;transition:transform 120ms cubic-bezier(0.23,1,0.32,1),opacity 120ms cubic-bezier(0.23,1,0.32,1);}' +
    'body.gn-fs .ddz-fs-pill:active{transform:scale(0.97);}' +
    'body.gn-fs .ddz-fs-pill-primary{background:var(--ge-gold,#b9954f);color:var(--ge-ink,#1c1b19);border-color:transparent;box-shadow:0 4px 14px rgba(0,0,0,0.28);}' +
    'body.gn-fs #ddzFsHandWrap{position:absolute;left:0;right:0;bottom:0;padding:18px var(--fs-hand-pad-x,12px) 6px;display:flex;justify-content:center;align-items:flex-end;z-index:15;pointer-events:none;overflow:visible;}' +
    'body.gn-fs .ddz-fs-hand-row{display:flex;align-items:flex-end;justify-content:center;pointer-events:auto;max-width:100%;}' +
    'body.gn-fs .ddz-fs-hand-row .pc-card{--w:var(--fs-card-w,66px);transition:transform 180ms cubic-bezier(0.23,1,0.32,1),opacity 180ms cubic-bezier(0.23,1,0.32,1);box-shadow:-2px 2px 6px rgba(0,0,0,0.28);}' +
    'body.gn-fs .ddz-fs-hand-row .pc-card + .pc-card{margin-left:var(--fs-card-overlap,-28px);}' +
    'body.gn-fs .ddz-fs-hand-row .pc-corner{top:calc(var(--w) * 0.06);left:calc(var(--w) * 0.06);gap:1px;font-size:calc(var(--w) * 0.22);line-height:1;}' +
    'body.gn-fs .ddz-fs-hand-row .pc-corner-br{top:auto;left:auto;bottom:calc(var(--w) * 0.06);right:calc(var(--w) * 0.06);}' +
    'body.gn-fs .ddz-fs-hand-row .pc-corner .pc-rank{font-size:calc(var(--w) * 0.22);line-height:1;}' +
    'body.gn-fs .ddz-fs-hand-row .pc-corner .pc-suit{font-size:calc(var(--w) * 0.18);line-height:1;}' +
    'body.gn-fs .ddz-fs-hand-row .pc-joker .pc-joker-text{top:calc(var(--w) * 0.07);left:calc(var(--w) * 0.06);font-size:calc(var(--w) * 0.18);}' +
    'body.gn-fs .ddz-fs-hand-row .pc-card.is-selected{transform:translateY(-16px);border-color:var(--ge-gold,#b9954f);box-shadow:var(--ge-shadow-lift);}' +
    'body.gn-fs .ddz-fs-hand-row .pc-selectable:active{transform:translateY(-4px) scale(0.97);transition-duration:120ms;}' +
    'body.gn-fs .ddz-fs-hand-row .pc-selectable.is-selected:active{transform:translateY(-16px) scale(0.97);transition-duration:120ms;}' +
    'body.gn-fs #ddzFsCenterBanner{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);z-index:18;min-width:240px;max-width:min(86vw,440px);padding:14px 20px;border-radius:18px;background:rgba(16,30,24,0.92);border:1px solid rgba(255,253,248,0.2);text-align:center;box-shadow:0 12px 32px rgba(0,0,0,0.38);}' +
    'body.gn-fs #ddzFsCenterBanner[hidden]{display:none;}' +
    '.ddz-event-card{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:910;min-width:190px;max-width:min(82vw,320px);padding:14px 22px;border-radius:20px;background:var(--ge-paper,#fffdf8);color:var(--ge-ink,#1c1b19);border:2px solid var(--ge-gold,#b9954f);box-shadow:0 8px 28px rgba(0,0,0,0.28);text-align:center;cursor:pointer;user-select:none;font-family:inherit;}' +
    '.ddz-event-card.is-warn{border-color:var(--ge-red,#c0392b);}' +
    '.ddz-event-icon{font-size:36px;line-height:1.1;margin-bottom:4px;}' +
    '.ddz-event-title{font-size:20px;font-weight:800;line-height:1.25;}' +
    '.ddz-event-sub{font-size:13px;margin-top:4px;opacity:0.8;}' +
    '.ddz-event-dismiss{font-size:11px;margin-top:6px;opacity:0.5;}' +
    '.ddz-fly-ghost{position:fixed;z-index:905;pointer-events:none;margin:0 !important;}' +
    '@media (prefers-reduced-motion: reduce){' +
      'body.gn-fs .ddz-fs-alarm{animation:none;}' +
      'body.gn-fs .ddz-fs-hand-row .pc-card{transition:opacity 140ms linear;}' +
      'body.gn-fs .ddz-fs-hand-row .pc-selectable:active,body.gn-fs .ddz-fs-pill:active,body.gn-fs #ddzFsCounterBtn:active{transform:none;}' +
      'body.gn-fs .ddz-fs-hand-row .pc-selectable.is-selected:active{transform:translateY(-16px);}' +
    '}';

  function safeInjectStyles(id, css) {
    if (window.injectStylesOnce) {
      window.injectStylesOnce(id, css);
      return;
    }
    if (!document.getElementById(id)) {
      var st = document.createElement('style');
      st.id = id;
      st.textContent = css;
      document.head.appendChild(st);
    }
  }

  function isFs() {
    return !!(document.body && document.body.classList.contains('gn-fs'));
  }

  function isReducedMotion() {
    return !!((window.Motion && window.Motion.reduced && window.Motion.reduced()) ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  }

  function getPlayerInfo(idx) {
    var list = window.gamePlayers;
    var p = null;
    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].index === idx) { p = list[i]; break; }
      }
      if (!p && list[idx]) p = list[idx];
    }
    var name = (p && p.name) ? p.name : (_t('ddz_player_fallback') + ' ' + (idx + 1));
    var avatar = (p && p.avatar) ? p.avatar : '';
    var initial = String(name).trim().charAt(0).toUpperCase() || String(idx + 1);
    return { name: name, avatar: avatar, initial: initial, isBot: !!(p && p.isBot) };
  }

  function sameIdArray(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function bindFsListeners() {
    if (_fsListenersBound) return;
    _fsListenersBound = true;
    window.addEventListener('gn:fullscreen', function() {
      _lastHandHtml = '';
      _lastFsHandHtml = '';
      if (window._ddzState && _lastContainer) {
        var r = window.gameRenderers && window.gameRenderers.get('doudizhu');
        if (r && r.render) {
          _skipNextAnim = true;
          r.render(window._ddzState, _lastContainer, _lastPlayerIndex, _lastWinner);
        }
      }
      if (isFs()) {
        requestAnimationFrame(function() {
          var handEl = document.getElementById('ddzFsHand');
          var cnt = handEl ? handEl.querySelectorAll('.ddz-card').length : _lastHandLen;
          layoutFsMetrics(cnt);
        });
      }
    });
    window.addEventListener('resize', function() {
      if (!isFs()) return;
      if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
      _resizeRaf = requestAnimationFrame(function() {
        _resizeRaf = 0;
        var handEl = document.getElementById('ddzFsHand');
        var cnt = handEl ? handEl.querySelectorAll('.ddz-card').length : _lastHandLen;
        layoutFsMetrics(cnt);
        layoutFsPlayedRows();
      });
    });
  }

  window.gameRenderers.set('doudizhu', {
    init: function(container) {
      _prevDdzState = null;
      selected = {};
      cardEls = {};
      _hintIndex = -1;
      _hints = [];
      _lastHandLen = 0;
      _lastHandHtml = '';
      _lastFsHandHtml = '';
      _deadlineKey = null;
      _localDeadline = 0;
      _tableSlots = [null, null, null];
      _seenPlayedIds = {};
      _counterOpen = false;
      _landlordPlayCount = 0;
      _farmersPlayCount = 0;
      _joinedMidRound = false;
      _lastEventKey = null;
      _springShownRound = null;
      _pendingPlayRects = {};
      _pendingPlayTime = 0;
      _skipNextAnim = false;
      if (_multRollRaf) { cancelAnimationFrame(_multRollRaf); _multRollRaf = 0; }
      if (_resizeRaf) { cancelAnimationFrame(_resizeRaf); _resizeRaf = 0; }
      if (window._ddzTimer) { clearInterval(window._ddzTimer); window._ddzTimer = null; }

      safeInjectStyles('ddz-styles', LANDSCAPE_CSS);
      safeInjectStyles('ddz-fs-styles', FS_CSS);
      bindFsListeners();

      container.innerHTML =
        '<div id="ddzWrap" style="width:100%;max-width:640px;display:flex;flex-direction:column;gap:10px;font-family:inherit;">' +
          '<div id="ddzOpponents" style="display:flex;justify-content:space-around;gap:8px;"></div>' +
          '<div id="ddzPlayArea" style="min-height:80px;background:var(--bg,#f8f9fa);border-radius:var(--radius,24px);padding:12px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;"></div>' +
          '<div id="ddzHint" style="display:none;text-align:center;font-size:13px;padding:4px 8px;background:var(--bg,#f8f9fa);border-radius:12px;"></div>' +
          '<div id="ddzHand" style="min-height:92px;padding:4px 0;"></div>' +
          '<div id="ddzActions" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;"></div>' +
        '</div>' +
        '<div id="ddzFsStage">' +
          '<div id="ddzFsTopHud"></div>' +
          '<button type="button" id="ddzFsCounterBtn" aria-expanded="false"></button>' +
          '<div id="ddzFsCounterPanel" hidden></div>' +
          '<div id="ddzFsOppLeft" class="ddz-fs-opp"></div>' +
          '<div id="ddzFsOppRight" class="ddz-fs-opp"></div>' +
          '<div id="ddzFsPlayLeft" class="ddz-fs-play-slot"></div>' +
          '<div id="ddzFsPlayRight" class="ddz-fs-play-slot"></div>' +
          '<div id="ddzFsPlayMe" class="ddz-fs-play-slot"></div>' +
          '<div id="ddzFsCenterBanner" hidden></div>' +
          '<div id="ddzFsMePill"></div>' +
          '<div id="ddzFsHint" style="display:none;"></div>' +
          '<div id="ddzFsActions"></div>' +
          '<div id="ddzFsHandWrap"><div id="ddzFsHand" class="ddz-fs-hand-row"></div></div>' +
        '</div>';

      var cBtn = document.getElementById('ddzFsCounterBtn');
      if (cBtn) {
        cBtn.textContent = _t('ddz_card_counter');
        cBtn.addEventListener('click', function() {
          _counterOpen = !_counterOpen;
          cBtn.setAttribute('aria-expanded', _counterOpen ? 'true' : 'false');
          var panel = document.getElementById('ddzFsCounterPanel');
          if (panel) panel.hidden = !_counterOpen;
          if (_counterOpen && window._ddzState) {
            renderFsCounter(window._ddzState, _lastPlayerIndex);
          }
        });
      }
    },
    render: function(state, container, playerIndex, winner) {
      // With the full state broadcast fix, state is always the complete game state.
      var s = state;
      if (!s || !s.hands) return;

      _lastContainer = container;
      _lastPlayerIndex = playerIndex;
      _lastWinner = winner;

      var selfIdx = (isFinite(playerIndex) && playerIndex >= 0 && playerIndex < s.hands.length) ? playerIndex : 0;
      var currentPlayer = state.currentPlayer != null ? state.currentPlayer : s.currentPlayer;
      var prev = _prevDdzState;
      var isFirstRender = !prev;
      var skipAnim = _skipNextAnim;
      _skipNextAnim = false;

      var curLpKey = JSON.stringify(s.lastPlay);
      var curRound = s.currentRound || 1;
      var curHand = s.hands[selfIdx] || [];
      var curHandIds = curHand.map(function(c) { return c ? c.id : ''; }).filter(Boolean);
      var curMult = s.gameMultiplier || 1;

      var isNewRoundDeal = false;
      var isNewPlay = false;
      var isLandlordReveal = false;
      var isMultChange = false;
      var isRoundJustEnded = false;

      if (isFirstRender) {
        if (s.phase !== 'bidding' || s.lastPlay != null || (curHand.length !== 17 && s.phase === 'playing')) {
          _joinedMidRound = true;
        } else {
          _joinedMidRound = false;
        }
        _tableSlots = [null, null, null];
        if (s.lastPlay && s.lastPlay.player != null) {
          _tableSlots[s.lastPlay.player] = { type: 'play', cards: s.lastPlay.cards, play: s.lastPlay.play };
        }
        if (Array.isArray(s.passed) && s.phase === 'playing') {
          for (var pi0 = 0; pi0 < s.passed.length; pi0++) {
            if (s.passed[pi0]) _tableSlots[pi0] = { type: 'pass' };
          }
        }
        if (s.lastPlay && Array.isArray(s.lastPlay.cards)) {
          for (var sc0 = 0; sc0 < s.lastPlay.cards.length; sc0++) {
            var c0 = s.lastPlay.cards[sc0];
            if (c0 && c0.id) _seenPlayedIds[c0.id] = c0.rank;
          }
        }
      } else {
        if (prev.round !== curRound ||
            (prev.phase !== 'bidding' && s.phase === 'bidding') ||
            (prev.phase === 'bidding' && s.phase === 'bidding' && !sameIdArray(prev.handIds, curHandIds) && curHand.length >= 17)) {
          isNewRoundDeal = true;
          _tableSlots = [null, null, null];
          _seenPlayedIds = {};
          _landlordPlayCount = 0;
          _farmersPlayCount = 0;
          _joinedMidRound = false;
          _lastEventKey = null;
          _springShownRound = null;
          selected = {};
        }

        isLandlordReveal = (prev.phase === 'bidding' && s.phase === 'playing' && s.landlord != null);
        isMultChange = (prev.gameMultiplier !== curMult);

        // Detect pass: currentPlayer changed but lastPlay did not advance to a new play
        if (prev.phase === 'playing' && s.phase === 'playing' && prev.currentPlayer !== currentPlayer) {
          var passer = prev.currentPlayer;
          var didPass = (curLpKey === prev.lastPlay && s.passed && s.passed[passer]) ||
            (prev.lastPlay !== 'null' && !s.lastPlay);
          if (didPass) {
            _tableSlots[passer] = { type: 'pass' };
            if (s.lastPlay) _tableSlots[currentPlayer] = null;
            if (passer !== selfIdx) {
              var passerName = getPlayerInfo(passer).name;
              showToast(passerName + _t('ddz_player_passed'));
            }
          }
        }

        if (curLpKey !== prev.lastPlay && s.lastPlay && Array.isArray(s.lastPlay.cards) && s.lastPlay.cards.length > 0) {
          isNewPlay = true;
          for (var sc1 = 0; sc1 < s.lastPlay.cards.length; sc1++) {
            var c1 = s.lastPlay.cards[sc1];
            if (c1 && c1.id) _seenPlayedIds[c1.id] = c1.rank;
          }
          if (s.lastPlay.player === s.landlord) _landlordPlayCount++;
          else _farmersPlayCount++;

          if (prev.lastPlay === 'null') _tableSlots = [null, null, null];
          _tableSlots[s.lastPlay.player] = { type: 'play', cards: s.lastPlay.cards, play: s.lastPlay.play };
          if (s.phase === 'playing' && currentPlayer !== s.lastPlay.player) {
            _tableSlots[currentPlayer] = null;
          }
        }

        isRoundJustEnded = (prev.phase === 'playing' && (s.phase === 'roundEnd' || s.phase === 'continue_vote' || s.phase === 'over' || (prev.winner == null && winner != null)));
      }

      // Capture source rects BEFORE updating the DOM so FLIP animations know where cards came from
      var sourceRects = (!isFirstRender && !skipAnim && isNewPlay) ? capturePlaySourceRects(s, selfIdx) : null;

      if (isFs()) {
        this.renderFs(s, selfIdx, currentPlayer, winner, isNewRoundDeal, isMultChange && !isFirstRender && !skipAnim ? prev.gameMultiplier : curMult);
      } else {
        this.renderOpponents(s, selfIdx, currentPlayer);
        this.renderPlayArea(s, selfIdx);
        this.renderHand(s, selfIdx, currentPlayer, isNewRoundDeal);
        this.renderActions(s, selfIdx, currentPlayer, winner);
      }

      syncTurnTimer(s);

      if (!isFirstRender && !skipAnim) {
        if (isNewRoundDeal) {
          animateDealHand(isFs() ? '#ddzFsHand' : '#ddzHand');
        }
        if (isLandlordReveal) {
          animateLandlordReveal(s, selfIdx);
        }
        if (isNewPlay) {
          animatePlayedCards(s, selfIdx, sourceRects);
        }
        if (isMultChange && isFs()) {
          rollMultiplier(prev.gameMultiplier, curMult);
        }

        // Bomb / Rocket event card + table shake (once per event)
        if (isNewPlay && s.lastPlay && s.lastPlay.play) {
          var pType = s.lastPlay.play.type;
          if (pType === 'bomb' || pType === 'rocket') {
            var evKey = curRound + ':' + curLpKey;
            if (evKey !== _lastEventKey) {
              _lastEventKey = evKey;
              var lpPlayer = s.lastPlay.player;
              var lpWho = lpPlayer === selfIdx ? _t('ddz_you') : getPlayerInfo(lpPlayer).name;
              showDdzEventCard({
                icon: pType === 'rocket' ? '🚀' : '💣',
                title: pType === 'rocket' ? _t('ddz_ann_rocket') : _tf('ddz_ann_bomb', curMult),
                sub: lpWho,
                warn: true
              });
              shakeTable(isFs() ? document.getElementById('ddzFsStage') : (document.getElementById('ddzWrap') || container));
            }
          }
        }

        // Spring / Anti-Spring event card (no shake)
        if (isRoundJustEnded && _springShownRound !== curRound && s.landlord != null) {
          var landlordWon = (s.roundWinner === -2 || winner === -2 || (s.hands[s.landlord] && s.hands[s.landlord].length === 0));
          var farmersWon = (s.roundWinner === -3 || winner === -3 || (!landlordWon && s.hands.some(function(h, idx) { return idx !== s.landlord && h && h.length === 0; })));
          var allFarmersFull = true;
          for (var fi = 0; fi < s.hands.length; fi++) {
            if (fi !== s.landlord && (!s.hands[fi] || s.hands[fi].length !== 17)) {
              allFarmersFull = false;
              break;
            }
          }
          if (landlordWon && (allFarmersFull || (!_joinedMidRound && _farmersPlayCount === 0))) {
            _springShownRound = curRound;
            showDdzEventCard({
              icon: '🌸',
              title: _t('ddz_ann_spring'),
              sub: getPlayerInfo(s.landlord).name,
              warn: false
            });
          } else if (farmersWon && !_joinedMidRound && _landlordPlayCount <= 1) {
            _springShownRound = curRound;
            showDdzEventCard({
              icon: '🌸',
              title: _t('ddz_ann_anti_spring'),
              sub: '',
              warn: false
            });
          }
        }
      }

      _prevDdzState = {
        phase: s.phase,
        currentPlayer: currentPlayer,
        lastPlay: curLpKey,
        gameMultiplier: curMult,
        round: curRound,
        handIds: curHandIds,
        winner: winner
      };
    },

    renderOpponents: function(s, selfIdx, cp) {
      var el = document.getElementById('ddzOpponents');
      if (!el) return;
      var html = '';
      for (var i = 0; i < s.hands.length; i++) {
        if (i === selfIdx) continue;
        var count = s.hands[i] ? s.hands[i].length : 0;
        var isLandlord = s.landlord === i;
        var isActive = cp === i;
        var didPass = (s.passed && s.passed[i] && s.phase === 'playing') ? true : false;
        var passBadge = didPass
          ? '<span style="margin-left:6px;background:#e74c3c;color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;font-weight:700;vertical-align:middle;">' + _t('ddz_passed_badge') + '</span>'
          : '';
        html +=
          '<div class="' + (isActive ? 'is-active-turn' : '') + '" style="text-align:center;padding:8px 16px;background:var(--bg,#f8f9fa);border-radius:var(--radius-sm,16px);' +
          (isActive ? '' : 'border:1px solid var(--border,#eee);') + '">' +
          '<div style="font-size:13px;font-weight:600;">' +
          (isLandlord ? '<span style="color:#c0392b;">&#x1F451;</span> ' : '') +
          escHtml((window.gamePlayers && window.gamePlayers[i]) ? window.gamePlayers[i].name : (_t('ddz_player_fallback') + ' ' + (i + 1))) +
          '</div>' +
          '<div style="font-size:24px;font-weight:800;margin-top:4px;">' + count + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted,#999);">' + _t('ddz_cards_label') + passBadge + '</div>' +
          '</div>';
      }
      el.innerHTML = html;
    },

    renderPlayArea: function(s, selfIdx) {
      var el = document.getElementById('ddzPlayArea');
      if (!el) return;

      var parts = [];

      // Bottom cards (visible after deal/start)
      if (s.bottomCards && s.bottomCards.length > 0 && s.phase !== 'bidding') {
        var bcHtml = '<div style="font-size:12px;color:var(--text-muted,#999);margin-bottom:4px;">' + _t('ddz_bottom_cards') + '</div><div style="display:flex;gap:4px;justify-content:center;">';
        for (var b = 0; b < s.bottomCards.length; b++) {
          bcHtml += cardSpan(s.bottomCards[b]);
        }
        bcHtml += '</div>';
        parts.push(bcHtml);
      }

      // Last played cards
      if (s.lastPlay) {
        var who = escHtml(s.lastPlay.player === selfIdx ? _t('ddz_you') : ((window.gamePlayers && window.gamePlayers[s.lastPlay.player]) ? window.gamePlayers[s.lastPlay.player].name : (_t('ddz_player_fallback') + ' ' + (s.lastPlay.player + 1))));
        var lpHtml = '<div style="font-size:12px;color:var(--text-muted,#999);margin-bottom:4px;">' + who + ' ' + _t('ddz_played') + '</div>' +
          '<div data-ddz-lp-cards="1" style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">';
        for (var c = 0; c < s.lastPlay.cards.length; c++) {
          lpHtml += cardSpan(s.lastPlay.cards[c]);
        }
        lpHtml += '</div>';
        parts.push(lpHtml);
      }

      // Bidding info
      if (s.phase === 'bidding') {
        var bidMode = s.bidMode || 'rob';
        if (bidMode === 'rob' && s.callPhase) {
          var bidInfo = '<div style="font-size:13px;color:var(--text-muted,#999);margin-bottom:6px;">' + _t('ddz_bidding_phase') + '</div>';
          for (var cr = 0; cr < (s._playerCount || 3); cr++) {
            var crName = escHtml((window.gamePlayers && window.gamePlayers[cr]) ? window.gamePlayers[cr].name : (_t('ddz_player_fallback') + ' ' + (cr + 1)));
            var crLabel = '';
            var crActive = s.currentBidder === cr;
            if (s.callPhase === 'call') {
              if (s.calledPlayers && s.calledPlayers.indexOf(cr) >= 0) crLabel = ' ✓ ' + _t('ddz_call_landlord');
              else if (s.passedCall && s.passedCall[cr]) crLabel = ' ✗ ' + _t('ddz_no_call');
              else crLabel = ' ...';
            } else if (s.callPhase === 'rob') {
              if (s.robAttempts && s.robAttempts.indexOf(cr) >= 0) crLabel = ' ✓ ' + _t('ddz_rob');
              else if (s.eligibleForRob && !s.eligibleForRob[cr]) crLabel = ' ✗ ' + _t('ddz_no_rob');
              else if (s.passedCall && s.passedCall[cr]) crLabel = ' ✗ ' + _t('ddz_no_call');
              else crLabel = ' ...';
            }
            if (s.landlordCandidate === cr) crLabel += ' 👑';
            var crColor = crActive ? '#c8a45c' : (crLabel.indexOf('✓') >= 0 ? '#5a9e6f' : (crLabel.indexOf('✗') >= 0 ? '#999' : '#666'));
            bidInfo += '<div style="font-size:12px;font-weight:' + (crActive ? '800' : '600') + ';color:' + crColor + ';margin:2px 0;">' +
              crName + crLabel + (crActive ? ' ◀' : '') + '</div>';
          }
          if (s.gameMultiplier > 1) bidInfo += '<div style="font-size:12px;font-weight:700;color:#c0392b;margin-top:4px;">×' + s.gameMultiplier + '</div>';
          parts.push(bidInfo);
        } else {
          // 叫分 mode (existing)
          var bidInfo = '<div style="font-size:13px;color:var(--text-muted,#999);margin-bottom:4px;">' + _t('ddz_bidding_phase') + '</div>';
          if (s.bids && Object.keys(s.bids).length > 0) {
            bidInfo += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
            for (var bi = 0; bi < (s._playerCount || 3); bi++) {
              var bidVal = s.bids[bi];
              var biName = escHtml((window.gamePlayers && window.gamePlayers[bi]) ? window.gamePlayers[bi].name : (_t('ddz_player_fallback') + ' ' + (bi + 1)));
              if (bidVal !== undefined) {
                var bidColor = bidVal === 0 ? 'var(--text-muted,#999)' : (bidVal === 3 ? '#c0392b' : 'var(--accent,#c8a45c)');
                bidInfo += '<span style="font-size:12px;font-weight:700;color:' + bidColor + ';">' + biName + ': ' + (bidVal === 0 ? _t('ddz_no_bid_display') : bidVal) + '</span>';
              }
            }
            bidInfo += '</div>';
          }
          parts.push(bidInfo);
        }
      }

      // Current round info
      if (s.landlord != null && s.phase === 'playing') {
        var landlordName = escHtml((window.gamePlayers && window.gamePlayers[s.landlord]) ? window.gamePlayers[s.landlord].name : (_t('ddz_player_fallback') + ' ' + (s.landlord + 1)));
        var landHtml = '<div style="font-size:12px;color:#c0392b;">&#x1F451; ' + _t('ddz_landlord_label') + ': ' + landlordName + '</div>';
        parts.push(landHtml);
      }

      // Multiplier display
      if (s.gameMultiplier > 1) {
        parts.push('<div style="font-size:12px;font-weight:700;color:#c0392b;">' + _t('ddz_multiplier') + ': ×' + s.gameMultiplier + '</div>');
      }

      // Countdown timer
      if (s.playTimeLimit > 0 && s.phase === 'playing' && s.currentTurnDeadline) {
        // Measure from when this deadline first arrived, not the server clock
        if (_deadlineKey !== s.currentTurnDeadline) {
          _deadlineKey = s.currentTurnDeadline;
          _localDeadline = Date.now() + s.playTimeLimit * 1000;
        }
        var elapsed = Date.now() - (_localDeadline - s.playTimeLimit * 1000);
        var pct = Math.max(0, Math.min(1, 1 - elapsed / (s.playTimeLimit * 1000)));
        var barColor = pct > 0.3 ? '#5a9e6f' : (pct > 0.15 ? '#e67e22' : '#e74c3c');
        var timeHtml = '<div style="width:100%;max-width:200px;">' +
          '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted,#999);margin-bottom:2px;">' +
          '<span>' + _t('ddz_time_left') + '</span><span id="ddzTimeTxt">' + Math.ceil(pct * s.playTimeLimit) + 's</span>' +
          '</div>' +
          '<div style="height:6px;background:#eee;border-radius:3px;overflow:hidden;">' +
          '<div id="ddzTimeBar" style="height:100%;width:' + (pct * 100) + '%;background:' + barColor + ';border-radius:3px;transition:width 0.3s;"></div>' +
          '</div>' +
          '</div>';
        parts.push(timeHtml);
      }

      // Round end
      if (s.phase === 'roundEnd') {
        var reHtml = '<div style="font-size:14px;font-weight:700;">' + _tf('ddz_round_end_title', s.currentRound || 1) + '</div>';
        if (s.scores) {
          reHtml += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:4px;font-size:13px;">';
          for (var ri = 0; ri < s.scores.length; ri++) {
            var riName = escHtml((window.gamePlayers && window.gamePlayers[ri]) ? window.gamePlayers[ri].name : (_t('ddz_player_fallback') + ' ' + (ri + 1)));
            var riScore = s.scores[ri] !== undefined ? s.scores[ri] : 0;
            reHtml += '<span style="font-weight:600;color:' + (riScore >= 0 ? '#5a9e6f' : '#e74c3c') + ';">' + riName + ': ' + (riScore >= 0 ? '+' : '') + riScore + '</span>';
          }
          reHtml += '</div>';
        }
        if (s.cumulativeScore) {
          reHtml += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:2px;font-size:12px;color:var(--text-muted,#999);">';
          for (var ci = 0; ci < s.cumulativeScore.length; ci++) {
            var ciName = escHtml((window.gamePlayers && window.gamePlayers[ci]) ? window.gamePlayers[ci].name : (_t('ddz_player_fallback') + ' ' + (ci + 1)));
            reHtml += '<span>' + ciName + ': ' + s.cumulativeScore[ci] + '</span>';
          }
          reHtml += '</div>';
        }
        parts.push(reHtml);
      }

      // Continue vote
      if (s.phase === 'continue_vote') {
        var cvHtml = '<div style="font-size:14px;font-weight:700;text-align:center;">' + _tf('ddz_continue_prompt', (s.currentRound || 0) + 1) + '</div>';
        if (s.cumulativeScore) {
          cvHtml += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:4px;font-size:13px;">';
          for (var vi = 0; vi < s.cumulativeScore.length; vi++) {
            var viName = escHtml((window.gamePlayers && window.gamePlayers[vi]) ? window.gamePlayers[vi].name : (_t('ddz_player_fallback') + ' ' + (vi + 1)));
            cvHtml += '<span style="font-weight:600;">' + viName + ': ' + s.cumulativeScore[vi] + '</span>';
          }
          cvHtml += '</div>';
        }
        // Check if self has already voted
        if (s.continueVoting && s.continueVoting.votes && s.continueVoting.votes[selfIdx] !== undefined) {
          cvHtml += '<div style="font-size:12px;color:var(--text-muted,#999);margin-top:4px;">' + _t('ddz_waiting_votes') + '</div>';
        }
        parts.push(cvHtml);
      }

      // Game over (final scoreboard)
      if (s.phase === 'over' && s.totalRounds > 1) {
        var goHtml = '<div style="font-size:15px;font-weight:700;color:var(--accent,#c8a45c);">' + _t('ddz_final_scores') + '</div>';
        if (s.cumulativeScore) {
          goHtml += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:6px;font-size:14px;">';
          var bestScore = Math.max.apply(null, s.cumulativeScore);
          for (var gi = 0; gi < s.cumulativeScore.length; gi++) {
            var giName = escHtml((window.gamePlayers && window.gamePlayers[gi]) ? window.gamePlayers[gi].name : (_t('ddz_player_fallback') + ' ' + (gi + 1)));
            var isWinner = s.cumulativeScore[gi] === bestScore;
            var crown = isWinner ? '&#x1F451; ' : '';
            goHtml += '<div style="font-weight:' + (isWinner ? '700' : '400') + ';color:' + (isWinner ? '#c0392b' : 'inherit') + ';text-align:center;">' +
              crown + giName + '<br><span style="font-size:18px;">' + s.cumulativeScore[gi] + '</span></div>';
          }
          goHtml += '</div>';
        }
        parts.push(goHtml);
      }

      el.innerHTML = parts.length > 0 ? parts.join('<div style="height:4px;"></div>') : '';
    },

    renderHand: function(s, selfIdx, cp, isNewRoundDeal) {
      var el = document.getElementById('ddzHand');
      if (!el) return;
      var hand = sortHandDesc(s.hands[selfIdx]);
      // Drop selections for cards no longer in hand (new round, timeout auto-play)
      var inHand = {};
      (hand || []).forEach(function(c) { if (c) inHand[c.id] = true; });
      Object.keys(selected).forEach(function(id) { if (!inHand[id]) delete selected[id]; });
      if (!hand || hand.length === 0) { el.innerHTML = ''; _lastHandLen = 0; _lastHandHtml = ''; return; }

      var myTurn = (cp === selfIdx && s.phase === 'playing');
      _lastHandLen = hand.length;
      var handHtml = window.CardUI.group(hand, {
        layout: 'hand',
        deal: false,
        cardOpts: function(c) {
          return {
            size: 'md',
            selected: !!selected[c.id],
            className: myTurn ? 'pc-selectable ddz-card' : 'ddz-card',
            jokerLabel: jokerLabel(c),
            attrs: myTurn ? 'onclick="window._ddzToggleCard(\'' + c.id + '\')"' : ''
          };
        }
      });
      if (handHtml === _lastHandHtml && el.firstChild && !isNewRoundDeal) return;
      el.innerHTML = handHtml;
      _lastHandHtml = handHtml;

      cardEls = {};
      var cards = el.querySelectorAll('.ddz-card');
      for (var j = 0; j < cards.length; j++) {
        cardEls[cards[j].dataset.id] = cards[j];
      }
    },

    renderActions: function(s, selfIdx, cp, winner) {
      var el = document.getElementById('ddzActions');
      if (!el) return;
      var isMyTurn = (cp === selfIdx);

      var html = '';

      if (s.phase === 'bidding' && isMyTurn && winner == null) {
        html = renderBidButtons(s, false);
      } else if (s.phase === 'playing' && isMyTurn && winner == null) {
        html = renderPlayButtons(s, selfIdx, false);
      } else if (s.phase === 'continue_vote' && winner == null) {
        var voted = s.continueVoting && s.continueVoting.votes && s.continueVoting.votes[selfIdx] !== undefined;
        if (!voted) {
          html = '<button class="btn btn-sm btn-primary" onclick="window._ddzContinueVote(\'yes\')" style="min-width:80px;">' + _t('ddz_vote_yes') + '</button>' +
                 '<button class="btn btn-sm btn-outline" onclick="window._ddzContinueVote(\'no\')" style="min-width:80px;">' + _t('ddz_vote_no') + '</button>';
        }
      } else if (s.phase === 'roundEnd' && winner == null) {
        html = '<button class="btn btn-sm btn-primary" onclick="window._ddzNextRound()" style="min-width:100px;">' + _t('ddz_next_round') + '</button>';
      }

      el.innerHTML = html;
    },

    renderFs: function(s, selfIdx, cp, winner, isNewRoundDeal, displayMult) {
      var rightIdx = (selfIdx + 1) % 3;
      var leftIdx = (selfIdx + 2) % 3;

      renderFsTopHud(s, displayMult);
      renderFsCounterControl(s, selfIdx);
      renderFsOpponent('ddzFsOppLeft', s, leftIdx, cp, winner);
      renderFsOpponent('ddzFsOppRight', s, rightIdx, cp, winner);
      renderFsPlaySlot('ddzFsPlayLeft', s, leftIdx);
      renderFsPlaySlot('ddzFsPlayRight', s, rightIdx);
      renderFsPlaySlot('ddzFsPlayMe', s, selfIdx);
      renderFsCenterBanner(s, selfIdx, winner);
      renderFsMePill(s, selfIdx, cp, winner);
      this.renderFsActions(s, selfIdx, cp, winner);
      this.renderFsHand(s, selfIdx, cp, winner, isNewRoundDeal);
      layoutFsPlayedRows();
      updateDdzHint(s, selfIdx);
    },

    renderFsHand: function(s, selfIdx, cp, winner, isNewRoundDeal) {
      var el = document.getElementById('ddzFsHand');
      if (!el) return;
      var hand = sortHandDesc(s.hands[selfIdx]);
      var inHand = {};
      (hand || []).forEach(function(c) { if (c) inHand[c.id] = true; });
      Object.keys(selected).forEach(function(id) { if (!inHand[id]) delete selected[id]; });
      if (!hand || hand.length === 0) {
        el.innerHTML = '';
        _lastHandLen = 0;
        _lastFsHandHtml = '';
        cardEls = {};
        layoutFsMetrics(0);
        return;
      }

      var myTurn = (cp === selfIdx && s.phase === 'playing' && winner == null);
      _lastHandLen = hand.length;
      var html = '';
      for (var i = 0; i < hand.length; i++) {
        var c = hand[i];
        var attrs = 'data-mo-key="ddz:' + escHtml(c.id) + '"';
        if (myTurn) attrs += ' onclick="window._ddzToggleCard(\'' + escHtml(c.id) + '\')"';
        html += window.CardUI.render(c, {
          size: 'md',
          index: i,
          selected: !!selected[c.id],
          className: myTurn ? 'pc-selectable ddz-card' : 'ddz-card',
          jokerLabel: jokerLabel(c),
          attrs: attrs
        });
      }

      if (html === _lastFsHandHtml && el.firstChild && !isNewRoundDeal) {
        layoutFsMetrics(hand.length);
        return;
      }
      el.innerHTML = html;
      _lastFsHandHtml = html;

      cardEls = {};
      var cards = el.querySelectorAll('.ddz-card');
      for (var j = 0; j < cards.length; j++) {
        cardEls[cards[j].dataset.id] = cards[j];
      }
      layoutFsMetrics(hand.length);
      if (window.Motion && window.Motion.refreshGlow) window.Motion.refreshGlow(el);
    },

    renderFsActions: function(s, selfIdx, cp, winner) {
      var el = document.getElementById('ddzFsActions');
      if (!el) return;
      var isMyTurn = (cp === selfIdx);
      var html = '';

      if (s.phase === 'bidding' && isMyTurn && winner == null) {
        html = renderBidButtons(s, true);
      } else if (s.phase === 'playing' && isMyTurn && winner == null) {
        html = renderPlayButtons(s, selfIdx, true);
      } else if (s.phase === 'continue_vote' && winner == null) {
        var voted = s.continueVoting && s.continueVoting.votes && s.continueVoting.votes[selfIdx] !== undefined;
        if (!voted) {
          html = '<button type="button" class="ddz-fs-pill" onclick="window._ddzContinueVote(\'no\')">' + _t('ddz_vote_no') + '</button>' +
                 '<button type="button" class="ddz-fs-pill ddz-fs-pill-primary" onclick="window._ddzContinueVote(\'yes\')">' + _t('ddz_vote_yes') + '</button>';
        }
      } else if (s.phase === 'roundEnd' && winner == null) {
        html = '<button type="button" class="ddz-fs-pill ddz-fs-pill-primary" onclick="window._ddzNextRound()">' + _t('ddz_next_round') + '</button>';
      }

      el.innerHTML = html;
    }
  });

  // ---- Fullscreen layout & helpers ----

  function renderFsTopHud(s, displayMult) {
    var el = document.getElementById('ddzFsTopHud');
    if (!el) return;
    var bcHtml = '';
    var showFaceUp = (s.phase !== 'bidding' && s.bottomCards && s.bottomCards.length > 0);
    if (showFaceUp) {
      for (var b = 0; b < s.bottomCards.length; b++) {
        bcHtml += window.CardUI.render(s.bottomCards[b], { size: 'sm', jokerLabel: jokerLabel(s.bottomCards[b]) });
      }
    } else {
      for (var d = 0; d < 3; d++) {
        bcHtml += window.CardUI.render(null, { size: 'sm', faceDown: true });
      }
    }
    var roundHtml = '';
    if (s.totalRounds > 1) {
      roundHtml = '<span class="ddz-fs-hud-stat">' + escHtml(_tf('ddz_round_of', s.currentRound || 1, s.totalRounds)) + '</span>';
    }
    var multShown = displayMult != null ? displayMult : (s.gameMultiplier || 1);
    el.innerHTML =
      '<div id="ddzFsBottomCards">' + bcHtml + '</div>' +
      '<div class="ddz-fs-hud-meta">' +
        '<span class="ddz-fs-hud-stat"><span class="ddz-fs-hud-label">' + escHtml(_t('ddz_base_score')) + '</span> 100</span>' +
        '<span id="ddzFsMultPill" class="ddz-fs-hud-stat ddz-fs-hud-mult">×<span id="ddzFsMultVal">' + multShown + '</span></span>' +
        roundHtml +
      '</div>';
  }

  function renderFsCounterControl(s, selfIdx) {
    var btn = document.getElementById('ddzFsCounterBtn');
    var panel = document.getElementById('ddzFsCounterPanel');
    if (btn) {
      btn.textContent = _t('ddz_card_counter');
      btn.setAttribute('aria-expanded', _counterOpen ? 'true' : 'false');
    }
    if (panel) {
      panel.hidden = !_counterOpen;
      if (_counterOpen) renderFsCounter(s, selfIdx);
    }
  }

  function computeRemainingCounts(s, selfIdx) {
    var counts = {
      '大王': 1, '小王': 1,
      '2': 4, 'A': 4, 'K': 4, 'Q': 4, 'J': 4, '10': 4,
      '9': 4, '8': 4, '7': 4, '6': 4, '5': 4, '4': 4, '3': 4
    };
    var knownIds = {};
    var myHand = (s.hands && s.hands[selfIdx]) ? s.hands[selfIdx] : [];
    for (var i = 0; i < myHand.length; i++) {
      if (myHand[i] && myHand[i].id) knownIds[myHand[i].id] = myHand[i].rank;
    }
    var seenKeys = Object.keys(_seenPlayedIds);
    for (var j = 0; j < seenKeys.length; j++) {
      knownIds[seenKeys[j]] = _seenPlayedIds[seenKeys[j]];
    }
    if (s.lastPlay && Array.isArray(s.lastPlay.cards)) {
      for (var k = 0; k < s.lastPlay.cards.length; k++) {
        var c = s.lastPlay.cards[k];
        if (c && c.id) knownIds[c.id] = c.rank;
      }
    }
    var ids = Object.keys(knownIds);
    for (var m = 0; m < ids.length; m++) {
      var r = knownIds[ids[m]];
      if (counts[r] !== undefined && counts[r] > 0) counts[r]--;
    }
    return counts;
  }

  function renderFsCounter(s, selfIdx) {
    var panel = document.getElementById('ddzFsCounterPanel');
    if (!panel) return;
    var counts = computeRemainingCounts(s, selfIdx);
    var gridHtml = '';
    for (var i = 0; i < COUNTER_RANKS.length; i++) {
      var rank = COUNTER_RANKS[i];
      var n = counts[rank];
      var label = rank === '大王' ? _t('ddz_rank_bj') : (rank === '小王' ? _t('ddz_rank_sj') : rank);
      var cls = 'ddz-fs-counter-cell' + (n === 0 ? ' is-empty' : (n === 4 ? ' is-full' : ''));
      gridHtml += '<div class="' + cls + '"><span class="ddz-fs-counter-rank">' + escHtml(label) + '</span><span class="ddz-fs-counter-num">' + n + '</span></div>';
    }
    panel.innerHTML =
      '<div class="ddz-fs-counter-title">' + escHtml(_t('ddz_card_counter_title')) + '</div>' +
      '<div class="ddz-fs-counter-grid">' + gridHtml + '</div>';
  }

  function timerRingHtml(s, isTurn, initialPct, secsLeft) {
    if (!isTurn) return '';
    var hasTimer = (s.playTimeLimit > 0 && s.phase === 'playing' && s.currentTurnDeadline);
    var offset = hasTimer ? (TIMER_RING_C * (1 - initialPct)).toFixed(2) : '0';
    var stroke = !hasTimer ? '#b9954f' : (initialPct > 0.3 ? '#5a9e6f' : (initialPct > 0.15 ? '#e67e22' : '#e74c3c'));
    var txtHtml = hasTimer ? '<span id="ddzFsTimerTxt" class="ddz-fs-ring-txt">' + secsLeft + 's</span>' : '';
    return '<svg class="ddz-fs-ring" viewBox="0 0 48 48" aria-hidden="true">' +
      '<circle class="ddz-fs-ring-bg" cx="24" cy="24" r="' + TIMER_RING_R + '"></circle>' +
      '<circle id="ddzFsTimerRing" class="ddz-fs-ring-fg" cx="24" cy="24" r="' + TIMER_RING_R + '" ' +
        'stroke-dasharray="' + TIMER_RING_C.toFixed(2) + '" stroke-dashoffset="' + offset + '" style="stroke:' + stroke + ';"></circle>' +
      '</svg>' + txtHtml;
  }

  function getTurnTimeSnapshot(s) {
    if (!(s.playTimeLimit > 0 && s.phase === 'playing' && s.currentTurnDeadline)) {
      return { pct: 1, secs: 0 };
    }
    if (_deadlineKey !== s.currentTurnDeadline) {
      _deadlineKey = s.currentTurnDeadline;
      _localDeadline = Date.now() + s.playTimeLimit * 1000;
    }
    var total = s.playTimeLimit * 1000;
    var pct = Math.max(0, Math.min(1, (_localDeadline - Date.now()) / total));
    return { pct: pct, secs: Math.ceil(pct * s.playTimeLimit) };
  }

  function renderFsOpponent(elId, s, idx, cp, winner) {
    var el = document.getElementById(elId);
    if (!el) return;
    var info = getPlayerInfo(idx);
    var count = (s.hands && s.hands[idx]) ? s.hands[idx].length : 0;
    var isTurn = (winner == null) && ((s.phase === 'bidding' && s.currentBidder === idx) || (s.phase === 'playing' && cp === idx));
    var isAlarm = (s.phase === 'playing' && count > 0 && count <= 2);
    var roleDecided = (s.phase !== 'bidding' && s.landlord != null);
    var isLandlord = roleDecided && s.landlord === idx;
    var score = (s.cumulativeScore && s.cumulativeScore[idx] !== undefined) ? s.cumulativeScore[idx] : 0;
    var snap = isTurn ? getTurnTimeSnapshot(s) : { pct: 1, secs: 0 };

    el.className = 'ddz-fs-opp' + (isTurn ? ' is-turn' : '') + (isAlarm ? ' is-alarm' : '');
    var avatarText = info.avatar ? escHtml(info.avatar) : escHtml(info.initial);
    var roleHtml = roleDecided
      ? '<span class="ddz-fs-role' + (isLandlord ? ' is-landlord' : '') + '">' + escHtml(isLandlord ? _t('ddz_landlord_label') : _t('ddz_farmer_label')) + '</span>'
      : '';
    var alarmHtml = isAlarm ? '<span class="ddz-fs-alarm">' + escHtml(_t('ddz_alarm_badge')) + '</span>' : '';

    el.innerHTML =
      '<div class="ddz-fs-opp-top">' +
        '<div class="ddz-fs-avatar-wrap">' +
          timerRingHtml(s, isTurn, snap.pct, snap.secs) +
          '<div class="ddz-fs-avatar">' + avatarText + '</div>' +
        '</div>' +
        '<div class="ddz-fs-stack">' + count + '</div>' +
      '</div>' +
      '<div class="ddz-fs-opp-name">' + escHtml(info.name) + '</div>' +
      '<div class="ddz-fs-opp-meta">' +
        roleHtml +
        '<span class="ddz-fs-score">' + score + '</span>' +
        alarmHtml +
      '</div>';
  }

  function renderFsMePill(s, selfIdx, cp, winner) {
    var el = document.getElementById('ddzFsMePill');
    if (!el) return;
    var info = getPlayerInfo(selfIdx);
    var isTurn = (winner == null) && ((s.phase === 'bidding' && s.currentBidder === selfIdx) || (s.phase === 'playing' && cp === selfIdx));
    var roleDecided = (s.phase !== 'bidding' && s.landlord != null);
    var isLandlord = roleDecided && s.landlord === selfIdx;
    var score = (s.cumulativeScore && s.cumulativeScore[selfIdx] !== undefined) ? s.cumulativeScore[selfIdx] : 0;
    var snap = isTurn ? getTurnTimeSnapshot(s) : { pct: 1, secs: 0 };

    el.className = isTurn ? 'is-turn' : '';
    var avatarText = info.avatar ? escHtml(info.avatar) : escHtml(info.initial);
    var roleHtml = roleDecided
      ? '<span class="ddz-fs-role' + (isLandlord ? ' is-landlord' : '') + '">' + escHtml(isLandlord ? _t('ddz_landlord_label') : _t('ddz_farmer_label')) + '</span>'
      : '';

    el.innerHTML =
      '<div class="ddz-fs-avatar-wrap">' +
        timerRingHtml(s, isTurn, snap.pct, snap.secs) +
        '<div class="ddz-fs-avatar">' + avatarText + '</div>' +
      '</div>' +
      '<div class="ddz-fs-me-info">' +
        '<div class="ddz-fs-me-name">' + escHtml(info.name) + '</div>' +
        '<div class="ddz-fs-me-sub">' + roleHtml + '<span class="ddz-fs-score">' + score + '</span></div>' +
      '</div>';
  }

  function renderFsPlaySlot(elId, s, idx) {
    var el = document.getElementById(elId);
    if (!el) return;
    if (s.phase === 'bidding') {
      var bidMode = s.bidMode || 'rob';
      var text = '';
      var isBidHighlight = false;
      if (bidMode === 'score') {
        if (s.bids && s.bids[idx] !== undefined) {
          var bv = s.bids[idx];
          text = bv === 0 ? _t('ddz_no_bid_display') : (bv + ' ' + _t('ddz_bid_points'));
          isBidHighlight = bv > 0;
        } else if (s.currentBidder === idx) {
          text = _t('ddz_thinking');
        }
      } else {
        if (s.callPhase === 'call' || !s.callPhase) {
          if (s.calledPlayers && s.calledPlayers.indexOf(idx) >= 0) { text = _t('ddz_call_landlord'); isBidHighlight = true; }
          else if (s.passedCall && s.passedCall[idx]) text = _t('ddz_no_call');
          else if (s.currentBidder === idx) text = _t('ddz_thinking');
        } else if (s.callPhase === 'rob') {
          if (s.robAttempts && s.robAttempts.indexOf(idx) >= 0) { text = _t('ddz_rob'); isBidHighlight = true; }
          else if (s.eligibleForRob && !s.eligibleForRob[idx]) {
            text = (s.passedCall && s.passedCall[idx]) ? _t('ddz_no_call') : _t('ddz_no_rob');
          } else if (s.currentBidder === idx) {
            text = _t('ddz_thinking');
          }
        }
      }
      el.innerHTML = text ? '<span class="ddz-fs-status-pill' + (isBidHighlight ? ' is-bid' : '') + '">' + escHtml(text) + '</span>' : '';
      return;
    }

    var slot = _tableSlots[idx];
    if (!slot) { el.innerHTML = ''; return; }
    if (slot.type === 'pass') {
      el.innerHTML = '<span class="ddz-fs-status-pill">' + escHtml(_t('ddz_pass')) + '</span>';
      return;
    }
    if (slot.type === 'play' && Array.isArray(slot.cards)) {
      var cardsHtml = '';
      for (var i = 0; i < slot.cards.length; i++) {
        cardsHtml += window.CardUI.render(slot.cards[i], { size: 'sm', jokerLabel: jokerLabel(slot.cards[i]) });
      }
      el.innerHTML = '<div class="ddz-fs-played-row" data-count="' + slot.cards.length + '">' + cardsHtml + '</div>';
      return;
    }
    el.innerHTML = '';
  }

  function renderFsCenterBanner(s, selfIdx, winner) {
    var el = document.getElementById('ddzFsCenterBanner');
    if (!el) return;
    var html = '';
    if (s.phase === 'roundEnd') {
      html += '<div style="font-size:15px;font-weight:800;">' + escHtml(_tf('ddz_round_end_title', s.currentRound || 1)) + '</div>';
      if (s.scores) {
        html += '<div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:6px;font-size:13px;">';
        for (var ri = 0; ri < s.scores.length; ri++) {
          var riScore = s.scores[ri] !== undefined ? s.scores[ri] : 0;
          html += '<span style="font-weight:700;color:' + (riScore >= 0 ? '#8ae0a4' : '#f29086') + ';">' +
            escHtml(getPlayerInfo(ri).name) + ': ' + (riScore >= 0 ? '+' : '') + riScore + '</span>';
        }
        html += '</div>';
      }
      if (s.cumulativeScore) {
        html += '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:4px;font-size:12px;opacity:0.78;">';
        for (var ci = 0; ci < s.cumulativeScore.length; ci++) {
          html += '<span>' + escHtml(getPlayerInfo(ci).name) + ': ' + s.cumulativeScore[ci] + '</span>';
        }
        html += '</div>';
      }
    } else if (s.phase === 'continue_vote') {
      html += '<div style="font-size:15px;font-weight:800;">' + escHtml(_tf('ddz_continue_prompt', (s.currentRound || 0) + 1)) + '</div>';
      if (s.cumulativeScore) {
        html += '<div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:6px;font-size:13px;">';
        for (var vi = 0; vi < s.cumulativeScore.length; vi++) {
          html += '<span style="font-weight:700;">' + escHtml(getPlayerInfo(vi).name) + ': ' + s.cumulativeScore[vi] + '</span>';
        }
        html += '</div>';
      }
      if (s.continueVoting && s.continueVoting.votes && s.continueVoting.votes[selfIdx] !== undefined) {
        html += '<div style="font-size:12px;opacity:0.75;margin-top:6px;">' + escHtml(_t('ddz_waiting_votes')) + '</div>';
      }
    } else if (s.phase === 'over' && s.totalRounds > 1 && winner != null) {
      html += '<div style="font-size:15px;font-weight:800;color:#ffe4a8;">' + escHtml(_t('ddz_final_scores')) + '</div>';
      if (s.cumulativeScore) {
        var bestScore = Math.max.apply(null, s.cumulativeScore);
        html += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:8px;font-size:13px;">';
        for (var gi = 0; gi < s.cumulativeScore.length; gi++) {
          var isW = s.cumulativeScore[gi] === bestScore;
          html += '<div style="font-weight:' + (isW ? '800' : '600') + ';color:' + (isW ? '#ffe4a8' : '#fff') + ';">' +
            (isW ? '👑 ' : '') + escHtml(getPlayerInfo(gi).name) + '<br><span style="font-size:16px;">' + s.cumulativeScore[gi] + '</span></div>';
        }
        html += '</div>';
      }
    }

    if (html) {
      el.innerHTML = html;
      el.hidden = false;
    } else {
      el.innerHTML = '';
      el.hidden = true;
    }
  }

  function layoutFsMetrics(handCount) {
    var stage = document.getElementById('ddzFsStage');
    if (!stage) return;
    var rect = stage.getBoundingClientRect();
    var W = rect.width || window.innerWidth || 812;
    var H = rect.height || window.innerHeight || 375;

    var marginX = W >= 960 ? Math.round(W * 0.06) : 12;
    var availW = Math.max(240, W - marginX * 2);
    var cardW = Math.max(52, Math.min(168, Math.floor(H * 0.192)));
    var overlap = 0;

    if (handCount > 1) {
      var minVisible = Math.max(18, Math.round(cardW * 0.34));
      var idealStep = Math.round(cardW * 0.62);
      var maxStep = Math.floor((availW - cardW) / (handCount - 1));
      if (maxStep < minVisible) {
        cardW = Math.max(40, Math.floor(availW / (1 + (handCount - 1) * 0.38)));
        idealStep = Math.round(cardW * 0.62);
        maxStep = Math.floor((availW - cardW) / (handCount - 1));
      }
      var step = Math.max(16, Math.min(idealStep, maxStep));
      overlap = step - cardW;
    }

    var cardH = Math.round(cardW * 1.4);
    var bandGap = Math.max(30, Math.round(H * 0.048));
    var bandBottom = cardH + bandGap;
    var actionBandH = H >= 540 ? 58 : 52;
    var playMeBottom = bandBottom + actionBandH;
    var tableCardW = Math.max(34, Math.min(62, Math.floor(H * 0.105)));
    var miniCardW = Math.max(24, Math.min(42, Math.floor(H * 0.072)));
    var oppTop = Math.max(58, Math.min(180, Math.round((H - bandBottom - 130) * 0.36)));
    var oppW = W >= 1000 ? 128 : 104;

    stage.style.setProperty('--fs-hand-pad-x', marginX + 'px');
    stage.style.setProperty('--fs-card-w', cardW + 'px');
    stage.style.setProperty('--fs-card-h', cardH + 'px');
    stage.style.setProperty('--fs-card-overlap', overlap + 'px');
    stage.style.setProperty('--fs-table-card-w', tableCardW + 'px');
    stage.style.setProperty('--fs-mini-card-w', miniCardW + 'px');
    stage.style.setProperty('--fs-band-bottom', bandBottom + 'px');
    stage.style.setProperty('--fs-playme-bottom', playMeBottom + 'px');
    stage.style.setProperty('--fs-opp-top', oppTop + 'px');
    stage.style.setProperty('--fs-opp-w', oppW + 'px');
  }

  function layoutFsPlayedRows() {
    var stage = document.getElementById('ddzFsStage');
    if (!stage) return;
    var rect = stage.getBoundingClientRect();
    var W = rect.width || window.innerWidth || 812;
    var H = rect.height || window.innerHeight || 375;
    var tableCardW = Math.max(34, Math.min(62, Math.floor(H * 0.105)));
    var slots = [
      { id: 'ddzFsPlayLeft', maxW: Math.max(120, Math.floor(W * 0.33)) },
      { id: 'ddzFsPlayRight', maxW: Math.max(120, Math.floor(W * 0.33)) },
      { id: 'ddzFsPlayMe', maxW: Math.min(560, Math.max(200, Math.floor(W * 0.56))) }
    ];
    for (var i = 0; i < slots.length; i++) {
      var row = document.querySelector('#' + slots[i].id + ' .ddz-fs-played-row');
      if (!row) continue;
      var cnt = parseInt(row.getAttribute('data-count'), 10) || 1;
      if (cnt <= 1) {
        row.style.setProperty('--fs-row-overlap', '0px');
      } else {
        var idealStep = Math.round(tableCardW * 0.56);
        var maxStep = Math.floor((slots[i].maxW - tableCardW) / (cnt - 1));
        var step = Math.max(12, Math.min(idealStep, maxStep));
        row.style.setProperty('--fs-row-overlap', (step - tableCardW) + 'px');
      }
    }
  }

  function syncTurnTimer(s) {
    if (window._ddzTimer) { clearInterval(window._ddzTimer); window._ddzTimer = null; }
    if (!(s.playTimeLimit > 0 && s.phase === 'playing' && s.currentTurnDeadline)) return;
    if (_deadlineKey !== s.currentTurnDeadline) {
      _deadlineKey = s.currentTurnDeadline;
      _localDeadline = Date.now() + s.playTimeLimit * 1000;
    }
    var total = s.playTimeLimit * 1000;
    var deadline = _localDeadline;
    var tick = function() {
      var left = Math.max(0, Math.min(1, (deadline - Date.now()) / total));
      var color = left > 0.3 ? '#5a9e6f' : (left > 0.15 ? '#e67e22' : '#e74c3c');
      var secs = Math.ceil(left * s.playTimeLimit) + 's';

      var txt = document.getElementById('ddzTimeTxt');
      var bar = document.getElementById('ddzTimeBar');
      if (txt && bar) {
        txt.textContent = secs;
        bar.style.width = (left * 100) + '%';
        bar.style.background = color;
      }

      var fsRing = document.getElementById('ddzFsTimerRing');
      var fsTxt = document.getElementById('ddzFsTimerTxt');
      if (fsRing) {
        fsRing.style.strokeDashoffset = (TIMER_RING_C * (1 - left)).toFixed(2);
        fsRing.style.stroke = color;
      }
      if (fsTxt) fsTxt.textContent = secs;

      if ((!txt || !bar) && !fsRing && !fsTxt) {
        clearInterval(window._ddzTimer);
        window._ddzTimer = null;
        return;
      }
      if (left <= 0) {
        clearInterval(window._ddzTimer);
        window._ddzTimer = null;
      }
    };
    window._ddzTimer = setInterval(tick, isFs() ? 100 : 250);
  }

  // ---- Animations ----

  function capturePlaySourceRects(s, selfIdx) {
    if (!s.lastPlay) return null;
    var lp = s.lastPlay.player;
    var fs = isFs();
    if (lp === selfIdx) {
      var freshPending = (_pendingPlayTime && Date.now() - _pendingPlayTime < 3000) ? _pendingPlayRects : null;
      var handEl = document.getElementById(fs ? 'ddzFsHand' : 'ddzHand');
      var fallback = handEl ? handEl.getBoundingClientRect() : null;
      return { byId: freshPending || {}, fallback: fallback };
    }
    var srcEl = null;
    if (fs) {
      var rightIdx = (selfIdx + 1) % 3;
      var oppId = (lp === rightIdx) ? 'ddzFsOppRight' : 'ddzFsOppLeft';
      srcEl = document.querySelector('#' + oppId + ' .ddz-fs-stack') || document.getElementById(oppId);
    } else {
      srcEl = document.getElementById('ddzOpponents');
    }
    return { byId: {}, fallback: srcEl ? srcEl.getBoundingClientRect() : null };
  }

  function animatePlayedCards(s, selfIdx, sourceRects) {
    if (!s.lastPlay || !sourceRects) return;
    var fs = isFs();
    var targetSelector = '';
    if (fs) {
      var rightIdx = (selfIdx + 1) % 3;
      var slotId = s.lastPlay.player === selfIdx ? 'ddzFsPlayMe' : (s.lastPlay.player === rightIdx ? 'ddzFsPlayRight' : 'ddzFsPlayLeft');
      targetSelector = '#' + slotId + ' .pc-card';
    } else {
      targetSelector = '#ddzPlayArea [data-ddz-lp-cards] .pc-card';
    }
    var cards = document.querySelectorAll(targetSelector);
    if (!cards || cards.length === 0) return;

    var reduced = isReducedMotion();
    for (var i = 0; i < cards.length; i++) {
      var el = cards[i];
      if (!el || typeof el.animate !== 'function') continue;
      if (reduced) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: EASE_OUT, fill: 'backwards' });
        continue;
      }
      var cid = el.getAttribute('data-id');
      var fromRect = (cid && sourceRects.byId[cid]) ? sourceRects.byId[cid] : sourceRects.fallback;
      if (!fromRect) continue;
      var toRect = el.getBoundingClientRect();
      if (!toRect.width) continue;
      var dx = (fromRect.left + fromRect.width / 2) - (toRect.left + toRect.width / 2);
      var dy = (fromRect.top + fromRect.height / 2) - (toRect.top + toRect.height / 2);
      var sc = fromRect.width ? Math.max(0.55, Math.min(1.5, fromRect.width / toRect.width)) : 1;
      el.animate([
        { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')', opacity: 0.7 },
        { transform: 'translate(0,0) scale(1)', opacity: 1 }
      ], { duration: 280, easing: EASE_OUT, fill: 'backwards' });
    }
    _pendingPlayRects = {};
    _pendingPlayTime = 0;
  }

  function animateDealHand(containerSelector) {
    var cards = document.querySelectorAll(containerSelector + ' .ddz-card');
    if (!cards || cards.length === 0) return;
    var reduced = isReducedMotion();
    for (var i = 0; i < cards.length; i++) {
      var el = cards[i];
      if (!el || typeof el.animate !== 'function') continue;
      if (reduced) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: EASE_OUT, fill: 'backwards' });
      } else {
        var delay = Math.min(i, 8) * 50;
        el.animate([
          { opacity: 0, transform: 'translateY(-28px) scale(0.9)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], { duration: 220, delay: delay, easing: EASE_OUT, fill: 'backwards' });
      }
    }
  }

  function animateLandlordReveal(s, selfIdx) {
    var reduced = isReducedMotion();
    if (!isFs()) return;
    var bcWrap = document.getElementById('ddzFsBottomCards');
    if (!bcWrap) return;
    var cards = bcWrap.querySelectorAll('.pc-card');
    if (!cards || cards.length === 0) return;

    if (reduced) {
      bcWrap.animate && bcWrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: EASE_OUT, fill: 'backwards' });
      return;
    }

    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c && typeof c.animate === 'function') {
        c.animate([
          { transform: 'scaleX(1)' },
          { transform: 'scaleX(0)', offset: 0.48 },
          { transform: 'scaleX(1)' }
        ], { duration: 300, delay: i * 35, easing: EASE_IN_OUT, fill: 'backwards' });
      }
    }

    var targetSel = '';
    if (s.landlord === selfIdx) {
      targetSel = '#ddzFsHand';
    } else {
      var rightIdx = (selfIdx + 1) % 3;
      targetSel = (s.landlord === rightIdx ? '#ddzFsOppRight' : '#ddzFsOppLeft') + ' .ddz-fs-stack';
    }

    setTimeout(function() {
      var targetEl = document.querySelector(targetSel);
      var bcCur = document.querySelectorAll('#ddzFsBottomCards .pc-card');
      if (!targetEl || !bcCur.length) return;
      var toRect = targetEl.getBoundingClientRect();
      var toCx = toRect.left + toRect.width / 2;
      var toCy = toRect.top + toRect.height / 2;

      for (var j = 0; j < bcCur.length; j++) {
        var src = bcCur[j];
        var fromRect = src.getBoundingClientRect();
        if (!fromRect.width) continue;
        var ghost = src.cloneNode(true);
        ghost.classList.add('ddz-fly-ghost');
        ghost.style.left = fromRect.left + 'px';
        ghost.style.top = fromRect.top + 'px';
        ghost.style.width = fromRect.width + 'px';
        ghost.style.height = fromRect.height + 'px';
        document.body.appendChild(ghost);
        var dx = toCx - (fromRect.left + fromRect.width / 2);
        var dy = toCy - (fromRect.top + fromRect.height / 2);
        var anim = ghost.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 0.95 },
          { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(0.75)', opacity: 0 }
        ], { duration: 280, delay: j * 30, easing: EASE_OUT, fill: 'forwards' });
        (function(gEl) {
          anim.onfinish = function() { if (gEl.parentNode) gEl.parentNode.removeChild(gEl); };
        })(ghost);
      }

      if (s.landlord === selfIdx && window.Motion && window.Motion.markNew && Array.isArray(s.bottomCards)) {
        var keys = s.bottomCards.map(function(bc) { return bc && bc.id ? ('ddz:' + bc.id) : ''; }).filter(Boolean);
        setTimeout(function() { window.Motion.markNew(keys); }, 240);
      } else if (targetEl && typeof targetEl.animate === 'function') {
        targetEl.animate([
          { transform: 'scale(1)' },
          { transform: 'scale(1.12)', offset: 0.5 },
          { transform: 'scale(1)' }
        ], { duration: 260, delay: 220, easing: EASE_POP });
      }
    }, 310);
  }

  function rollMultiplier(fromVal, toVal) {
    var valEl = document.getElementById('ddzFsMultVal');
    var pillEl = document.getElementById('ddzFsMultPill');
    if (!valEl) return;
    if (_multRollRaf) { cancelAnimationFrame(_multRollRaf); _multRollRaf = 0; }
    if (isReducedMotion() || fromVal === toVal) {
      valEl.textContent = toVal;
      return;
    }
    if (pillEl && typeof pillEl.animate === 'function' && toVal > fromVal) {
      pillEl.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.12)', offset: 0.45 },
        { transform: 'scale(1)' }
      ], { duration: 260, easing: EASE_POP });
    }
    var start = performance.now();
    var dur = 600;
    function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      var cur = Math.round(fromVal + (toVal - fromVal) * eased);
      var elNow = document.getElementById('ddzFsMultVal');
      if (!elNow) { _multRollRaf = 0; return; }
      elNow.textContent = cur;
      if (t < 1) {
        _multRollRaf = requestAnimationFrame(step);
      } else {
        elNow.textContent = toVal;
        _multRollRaf = 0;
      }
    }
    _multRollRaf = requestAnimationFrame(step);
  }

  function shakeTable(el) {
    if (!el || typeof el.animate !== 'function' || isReducedMotion()) return;
    el.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(0)' }
    ], { duration: 300, easing: EASE_IN_OUT });
  }

  function showDdzEventCard(opts) {
    if (!document.body) return;
    var old = document.querySelectorAll('.ddz-event-card');
    for (var i = 0; i < old.length; i++) {
      if (old[i].parentNode) old[i].parentNode.removeChild(old[i]);
    }
    var card = document.createElement('div');
    card.className = 'ddz-event-card' + (opts.warn ? ' is-warn' : '');
    card.setAttribute('role', 'status');
    card.innerHTML =
      (opts.icon ? '<div class="ddz-event-icon">' + escHtml(opts.icon) + '</div>' : '') +
      '<div class="ddz-event-title">' + escHtml(opts.title) + '</div>' +
      (opts.sub ? '<div class="ddz-event-sub">' + escHtml(opts.sub) + '</div>' : '') +
      '<div class="ddz-event-dismiss">' + escHtml(_t('ddz_tap_dismiss')) + '</div>';
    document.body.appendChild(card);

    var reduced = isReducedMotion();
    var closed = false;
    var timer = null;

    function close() {
      if (closed) return;
      closed = true;
      if (timer) clearTimeout(timer);
      var removeCard = function() { if (card.parentNode) card.parentNode.removeChild(card); };
      if (typeof card.animate !== 'function') { removeCard(); return; }
      var exitAnim = card.animate(
        reduced
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(0.95)' }],
        { duration: 190, easing: EASE_OUT, fill: 'forwards' }
      );
      exitAnim.onfinish = removeCard;
    }

    card.addEventListener('click', close);
    if (typeof card.animate === 'function') {
      card.animate(
        reduced
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ opacity: 0, transform: 'translate(-50%,-50%) scale(0.72)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }],
        { duration: reduced ? 180 : 300, easing: reduced ? EASE_OUT : EASE_POP, fill: 'backwards' }
      );
    }
    timer = setTimeout(close, 1700);
  }

  // ---- Helpers ----

  function jokerLabel(c) {
    if (c.id === 'SJ') return _t('ddz_joker_small');
    if (c.id === 'BJ') return _t('ddz_joker_big');
    return '';
  }

  function cardSpan(c) {
    return window.CardUI.render(c, { size: 'sm', jokerLabel: jokerLabel(c) });
  }

  function renderBidButtons(s, useFs) {
    var bidMode = s.bidMode || 'rob';
    var pri = useFs ? 'ddz-fs-pill ddz-fs-pill-primary' : 'btn btn-sm btn-primary';
    var sec = useFs ? 'ddz-fs-pill' : 'btn btn-sm btn-outline';
    var sty = useFs ? '' : ' style="min-width:80px;"';
    if (bidMode === 'rob') {
      if (s.callPhase === 'call' || !s.callPhase) {
        var callBtn = '<button type="button" class="' + pri + '" onclick="window._ddzCall()"' + sty + '>' + _t('ddz_call_landlord') + '</button>';
        var noCallBtn = '<button type="button" class="' + sec + '" onclick="window._ddzNoCall()"' + sty + '>' + _t('ddz_no_call') + '</button>';
        return useFs ? (noCallBtn + callBtn) : (callBtn + noCallBtn);
      } else if (s.callPhase === 'rob') {
        var robBtn = '<button type="button" class="' + pri + '" onclick="window._ddzRob()"' + sty + '>' + _t('ddz_rob') + '</button>';
        var noRobBtn = '<button type="button" class="' + sec + '" onclick="window._ddzNoRob()"' + sty + '>' + _t('ddz_no_rob') + '</button>';
        return useFs ? (noRobBtn + robBtn) : (robBtn + noRobBtn);
      }
      return '';
    }
    // Score-based bidding (default)
    var noBidBtn = '<button type="button" class="' + sec + '" onclick="window._ddzBid(0)">' + _t('ddz_no_bid') + '</button>';
    var scoreCls = useFs ? 'ddz-fs-pill ddz-fs-pill-primary' : 'btn btn-sm';
    var scoreSty = useFs ? '' : ' style="min-width:56px;"';
    var scoresHtml = '';
    for (var sc = 1; sc <= 3; sc++) {
      if (sc <= s.currentBid) continue;
      scoresHtml += '<button type="button" class="' + scoreCls + '" onclick="window._ddzBid(' + sc + ')"' + scoreSty + '>' + sc + ' ' + _t('ddz_bid_points') + '</button>';
    }
    return useFs ? (noBidBtn + scoresHtml) : (scoresHtml + noBidBtn);
  }

  function renderPlayButtons(s, selfIdx, useFs) {
    var canPass = s.lastPlay && s.lastPlay.player !== selfIdx;
    var isFree = !s.lastPlay || s.lastPlay.player === selfIdx;
    var pri = useFs ? 'ddz-fs-pill ddz-fs-pill-primary' : 'btn btn-sm btn-primary';
    var sec = useFs ? 'ddz-fs-pill' : 'btn btn-sm btn-outline';
    var sty = useFs ? '' : ' style="min-width:80px;"';
    var hintSty = useFs ? '' : ' style="min-width:60px;"';
    if (useFs) {
      var fsHtml = '';
      if (canPass) {
        fsHtml += '<button type="button" class="' + sec + '" onclick="window._ddzPass()">' + _t('ddz_pass') + '</button>';
      }
      fsHtml += '<button type="button" class="' + sec + '" onclick="window._ddzHint()">' + _t('ddz_hint') + '</button>';
      fsHtml += '<button type="button" class="' + pri + '" onclick="window._ddzPlay()">' + _t('ddz_play') + '</button>';
      return fsHtml;
    }
    var html = '<button class="' + pri + '" onclick="window._ddzPlay()"' + sty + '>' + _t('ddz_play') + '</button>';
    if (!isFree) {
      html += '<button class="' + sec + '" onclick="window._ddzHint()"' + hintSty + '>💡' + _t('ddz_hint') + '</button>';
    }
    if (canPass) {
      html += '<button class="' + sec + '" onclick="window._ddzPass()"' + sty + '>' + _t('ddz_pass') + '</button>';
    }
    return html;
  }

  var SUIT_ORDER = { s: 0, h: 1, c: 2, d: 3 };

  function _cardSortRank(c) {
    if (!c) return -1;
    if (c.id === 'BJ' || c.rank === '大王') return 14;
    if (c.id === 'SJ' || c.rank === '小王') return 13;
    return _rankVal(c.rank);
  }

  // Show hand from HIGH to LOW left-to-right (jokers, 2, A ... 3), grouping same rank with stable suit order.
  function sortHandDesc(hand) {
    if (!Array.isArray(hand)) return [];
    return hand.slice().filter(Boolean).sort(function(a, b) {
      var dr = _cardSortRank(b) - _cardSortRank(a);
      if (dr !== 0) return dr;
      var sa = SUIT_ORDER[a.suit] !== undefined ? SUIT_ORDER[a.suit] : 9;
      var sb = SUIT_ORDER[b.suit] !== undefined ? SUIT_ORDER[b.suit] : 9;
      if (sa !== sb) return sa - sb;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  // ---- Card type detection (mirrors server-side logic) ----
  function _rankVal(rank) {
    if (rank === '小王') return 13;
    if (rank === '大王') return 14;
    return ['3','4','5','6','7','8','9','10','J','Q','K','A','2'].indexOf(rank);
  }

  function _isConsecutive(arr, len) {
    for (var i = 0; i < len - 1; i++) {
      if (arr[i + 1] - arr[i] !== 1) return false;
    }
    return true;
  }

  function _detectType(cards) {
    if (!cards || cards.length === 0) return null;
    var n = cards.length;
    var rvals = cards.map(function(c) { return _rankVal(c.rank); }).sort(function(a,b) { return a-b; });

    // Rocket
    if (n === 2 && cards.some(function(c) { return c.id === 'SJ'; }) && cards.some(function(c) { return c.id === 'BJ'; }))
      return { type: 'rocket', rank: 15, name: _t('ddz_rocket') };

    // Bomb
    if (n === 4 && rvals[0] === rvals[3])
      return { type: 'bomb', rank: rvals[0], name: _t('ddz_bomb') };

    // Count rank groups
    var countMap = new Map();
    for (var i = 0; i < rvals.length; i++) {
      var r = rvals[i];
      countMap.set(r, (countMap.get(r) || 0) + 1);
    }
    var groups = { 1: [], 2: [], 3: [], 4: [] };
    countMap.forEach(function(c, r) { groups[c].push(r); });
    for (var k in groups) groups[k].sort(function(a,b) { return a-b; });

    var typeName = '';
    var result;

    if (n === 1) { typeName = _t('ddz_single'); result = { type: 'single', rank: rvals[0] }; }
    else if (n === 2 && rvals[0] === rvals[1]) { typeName = _t('ddz_pair'); result = { type: 'pair', rank: rvals[0] }; }
    else if (groups[3].length === 1 && n === 3) { typeName = _t('ddz_triple'); result = { type: 'triple', rank: groups[3][0] }; }
    else if (groups[3].length === 1 && n === 4) { typeName = _t('ddz_triple_one'); result = { type: 'triple_one', rank: groups[3][0] }; }
    else if (groups[3].length === 1 && n === 5 && groups[2].length === 1) { typeName = _t('ddz_triple_two'); result = { type: 'triple_two', rank: groups[3][0] }; }
    else if (n >= 5 && groups[1].length === n && _isConsecutive(groups[1], n) && groups[1][n-1] < 12)
      { typeName = _t('ddz_straight'); result = { type: 'straight', rank: groups[1][0], length: n }; }
    else if (n >= 6 && n % 2 === 0 && groups[2].length === n/2 && _isConsecutive(groups[2], n/2) && groups[2][n/2-1] < 12)
      { typeName = _t('ddz_consecutive_pairs'); result = { type: 'consecutive_pairs', rank: groups[2][0], length: n/2 }; }
    else if (n >= 6 && n % 3 === 0 && groups[3].length === n/3 && _isConsecutive(groups[3], n/3) && groups[3][n/3-1] < 12)
      { typeName = _t('ddz_plane'); result = { type: 'plane', rank: groups[3][0], length: n/3 }; }
    else if (groups[3].length >= 2 && _isConsecutive(groups[3], groups[3].length) && groups[3][groups[3].length-1] < 12) {
      var triCount = groups[3].length;
      var remaining = n - triCount * 3;
      if (remaining === triCount) { typeName = _t('ddz_plane_wings_1'); result = { type: 'plane_wings_1', rank: groups[3][0], length: triCount }; }
      else if (remaining === triCount * 2 && groups[2].length === triCount && n === triCount * 5)
        { typeName = _t('ddz_plane_wings_2'); result = { type: 'plane_wings_2', rank: groups[3][0], length: triCount }; }
    }
    else if (groups[4].length === 1 && n === 6) { typeName = _t('ddz_four_two'); result = { type: 'four_two', rank: groups[4][0] }; }
    else if (groups[4].length === 1 && n === 8 && groups[2].length === 2) { typeName = _t('ddz_four_two_pairs'); result = { type: 'four_two_pairs', rank: groups[4][0] }; }

    if (result) { result.name = typeName; return result; }
    return null;
  }

  function _canBeat(newPlay, lastPlay) {
    if (!lastPlay) return true;
    if (newPlay.type === 'rocket') return true;
    if (newPlay.type === 'bomb') {
      if (lastPlay.type === 'rocket') return false;
      if (lastPlay.type === 'bomb') return newPlay.rank > lastPlay.rank;
      return true;
    }
    if (newPlay.type !== lastPlay.type) return false;
    if ((newPlay.length || 0) !== (lastPlay.length || 0)) return false;
    return newPlay.rank > lastPlay.rank;
  }

  function _getCardById(hand, id) {
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].id === id) return hand[i];
    }
    return null;
  }

  // ---- Global handlers (called from onclick) ----

  window._ddzToggleCard = function(id) {
    if (selected[id]) {
      delete selected[id];
    } else {
      selected[id] = true;
    }
    if (cardEls[id]) cardEls[id].classList.toggle('is-selected', !!selected[id]);
    var state = getCurrentState();
    if (state) {
      var playerIndex = parseInt(sessionStorage.getItem('playerIndex'));
      if (!isFinite(playerIndex) || playerIndex < 0) playerIndex = _lastPlayerIndex;
      // Show card type hint
      updateDdzHint(state, playerIndex);
    }
  };

  function hideDdzHints() {
    var h = document.getElementById('ddzHint');
    if (h) h.style.display = 'none';
    var fh = document.getElementById('ddzFsHint');
    if (fh) fh.style.display = 'none';
  }

  function updateDdzHint(state, selfIdx) {
    var hintEl = document.getElementById('ddzHint');
    var fsHintEl = document.getElementById('ddzFsHint');
    if (!hintEl && !fsHintEl) return;
    var hand = (state.hands && state.hands[selfIdx]) ? state.hands[selfIdx] : [];
    var selectedIds = Object.keys(selected);
    if (selectedIds.length === 0) {
      if (hintEl) hintEl.style.display = 'none';
      if (fsHintEl) fsHintEl.style.display = 'none';
      return;
    }
    // Build card array from selected IDs
    var cards = [];
    for (var i = 0; i < selectedIds.length; i++) {
      var c = _getCardById(hand, selectedIds[i]);
      if (c) cards.push(c);
    }
    var playType = _detectType(cards);
    function buildHtml(okColor, errColor) {
      if (!playType) {
        return '<span style="color:' + errColor + ';">' + _t('ddz_invalid_type') + '</span>';
      }
      var lastPlay = state.lastPlay;
      var isFree = !lastPlay || lastPlay.player === selfIdx;
      var canBeat = isFree || _canBeat(playType, lastPlay ? lastPlay.play : null);
      var out = '<span style="color:' + okColor + ';font-weight:700;">' + playType.name + '</span>';
      if (isFree) {
        out += ' <span style="color:' + okColor + ';">✓ ' + _t('ddz_free_play') + '</span>';
      } else if (canBeat) {
        out += ' <span style="color:' + okColor + ';">✓ ' + _t('ddz_can_beat') + '</span>';
      } else {
        var lastName = lastPlay.play.name || _t('ddz_' + lastPlay.play.type);
        out += ' <span style="color:' + errColor + ';">' + _tf('ddz_cannot_beat', lastName) + '</span>';
      }
      return out;
    }
    if (hintEl) {
      hintEl.style.display = '';
      hintEl.innerHTML = buildHtml('#5a9e6f', '#e74c3c');
    }
    if (fsHintEl) {
      fsHintEl.style.display = '';
      fsHintEl.innerHTML = buildHtml('#8ae0a4', '#f29086');
    }
  }

  // ---- Hint generation ----

  function _groupCards(hand) {
    var g = {};
    for (var i = 0; i < hand.length; i++) {
      var r = hand[i].rank;
      if (!g[r]) g[r] = [];
      g[r].push(hand[i]);
    }
    return g;
  }

  function _sortedRanks(groups) {
    return Object.keys(groups).sort(function(a,b) { return _rankVal(a) - _rankVal(b); });
  }

  function _ids(cards) {
    return cards.map(function(c) { return c.id; });
  }

  function _findStraights(groups, minLen) {
    var ranks = _sortedRanks(groups);
    var straights = [];
    var seq = [];
    for (var i = 0; i < ranks.length; i++) {
      var rv = _rankVal(ranks[i]);
      if (rv >= 12) break;
      if (seq.length === 0 || rv === _rankVal(seq[seq.length-1]) + 1) {
        seq.push(ranks[i]);
      } else {
        if (seq.length >= minLen) straights.push(seq.slice());
        seq = [ranks[i]];
      }
    }
    if (seq.length >= minLen) straights.push(seq.slice());
    return straights;
  }

  // Every len-long window of each maximal run, so longer runs still yield hints
  function _windows(seqs, len) {
    var out = [];
    seqs.forEach(function(seq) {
      for (var i = 0; i + len <= seq.length; i++) out.push(seq.slice(i, i + len));
    });
    return out;
  }

  function _hasRank(groups, rank, count) {
    return groups[rank] && groups[rank].length >= count;
  }

  function generateHints(hand, lastPlay, selfIdx) {
    if (!hand || hand.length === 0) return [];
    var groups = _groupCards(hand);
    var hints = [];
    var ranks = _sortedRanks(groups);

    var isFree = !lastPlay || lastPlay.player === selfIdx;
    var lp = lastPlay ? lastPlay.play : null;

    function addHint(ids) {
      if (ids && ids.length > 0) hints.push(ids);
    }

    if (isFree) {
      // Singles
      for (var si = 0; si < ranks.length; si++)
        addHint([groups[ranks[si]][0].id]);
      // Pairs
      for (var pi = 0; pi < ranks.length; pi++)
        if (groups[ranks[pi]].length >= 2) addHint(_ids(groups[ranks[pi]].slice(0, 2)));
      // Triples
      for (var ti = 0; ti < ranks.length; ti++) {
        if (groups[ranks[ti]].length >= 3) {
          var triple = _ids(groups[ranks[ti]].slice(0, 3));
          addHint(triple);
          // Triple + 1 (use highest remaining single as kicker)
          for (var k1 = ranks.length - 1; k1 >= 0; k1--) {
            if (k1 !== ti && groups[ranks[k1]].length >= 1) {
              addHint(triple.concat([groups[ranks[k1]][0].id]));
              break;
            }
          }
          // Triple + 2
          for (var k2 = ranks.length - 1; k2 >= 0; k2--) {
            if (k2 !== ti && groups[ranks[k2]].length >= 2) {
              addHint(triple.concat(_ids(groups[ranks[k2]].slice(0, 2))));
              break;
            }
          }
        }
      }
      // Straights (5+)
      var straights = _findStraights(groups, 5);
      for (var st = 0; st < straights.length; st++) {
        if (straights[st].length >= 5) {
          addHint(straights[st].map(function(r) { return groups[r][0].id; }));
        }
      }
      // Consecutive pairs (3+)
      var pairSeqs = _findStraights(
        Object.keys(groups).reduce(function(acc, r) {
          if (groups[r].length >= 2) acc[r] = groups[r];
          return acc;
        }, {}), 3);
      for (var cp = 0; cp < pairSeqs.length; cp++) {
        var cpIds = [];
        for (var cpi = 0; cpi < pairSeqs[cp].length; cpi++)
          cpIds = cpIds.concat(_ids(groups[pairSeqs[cp][cpi]].slice(0, 2)));
        addHint(cpIds);
      }
      // Planes (2+ consecutive triples)
      var tripleSeqs = _findStraights(
        Object.keys(groups).reduce(function(acc, r) {
          if (groups[r].length >= 3) acc[r] = groups[r];
          return acc;
        }, {}), 2);
      for (var pl = 0; pl < tripleSeqs.length; pl++) {
        if (tripleSeqs[pl].length >= 2) {
          var plIds = [];
          for (var pli = 0; pli < tripleSeqs[pl].length; pli++)
            plIds = plIds.concat(_ids(groups[tripleSeqs[pl][pli]].slice(0, 3)));
          addHint(plIds);
        }
      }
    } else {
      if (!lp) return [];
      // Beating play: find same type with higher rank, plus bombs+rockets
      if (lp.type === 'single') {
        for (var bi = 0; bi < ranks.length; bi++)
          if (_rankVal(ranks[bi]) > lp.rank && groups[ranks[bi]].length >= 1)
            addHint([groups[ranks[bi]][0].id]);
      } else if (lp.type === 'pair') {
        for (var bj = 0; bj < ranks.length; bj++)
          if (_rankVal(ranks[bj]) > lp.rank && groups[ranks[bj]].length >= 2)
            addHint(_ids(groups[ranks[bj]].slice(0, 2)));
      } else if (lp.type === 'triple' || lp.type === 'triple_one' || lp.type === 'triple_two') {
        for (var bk = 0; bk < ranks.length; bk++) {
          if (_rankVal(ranks[bk]) > lp.rank && groups[ranks[bk]].length >= 3) {
            var t = _ids(groups[ranks[bk]].slice(0, 3));
            if (lp.type === 'triple') addHint(t);
            else if (lp.type === 'triple_one') {
              for (var k1 = 0; k1 < ranks.length; k1++)
                if (k1 !== bk && groups[ranks[k1]].length >= 1)
                  { addHint(t.concat([groups[ranks[k1]][0].id])); break; }
            } else {
              for (var k2 = 0; k2 < ranks.length; k2++)
                if (k2 !== bk && groups[ranks[k2]].length >= 2)
                  { addHint(t.concat(_ids(groups[ranks[k2]].slice(0, 2)))); break; }
            }
          }
        }
      } else if (lp.type === 'straight') {
        var straights2 = _windows(_findStraights(groups, lp.length), lp.length);
        for (var bs = 0; bs < straights2.length; bs++) {
          if (straights2[bs].length === lp.length && _rankVal(straights2[bs][0]) > lp.rank)
            addHint(straights2[bs].map(function(r) { return groups[r][0].id; }));
        }
      } else if (lp.type === 'consecutive_pairs') {
        var pairSeqs2 = _findStraights(
          Object.keys(groups).reduce(function(acc, r) {
            if (groups[r].length >= 2) acc[r] = groups[r];
            return acc;
          }, {}), lp.length);
        pairSeqs2 = _windows(pairSeqs2, lp.length);
        for (var bp = 0; bp < pairSeqs2.length; bp++) {
          if (pairSeqs2[bp].length === lp.length && _rankVal(pairSeqs2[bp][0]) > lp.rank) {
            var ids = [];
            for (var pp = 0; pp < pairSeqs2[bp].length; pp++)
              ids = ids.concat(_ids(groups[pairSeqs2[bp][pp]].slice(0, 2)));
            addHint(ids);
          }
        }
      } else if (lp.type === 'plane' || lp.type === 'plane_wings_1' || lp.type === 'plane_wings_2') {
        var planeSeqs = _findStraights(
          Object.keys(groups).reduce(function(acc, r) {
            if (groups[r].length >= 3) acc[r] = groups[r];
            return acc;
          }, {}), lp.length);
        planeSeqs = _windows(planeSeqs, lp.length);
        for (var bpl = 0; bpl < planeSeqs.length; bpl++) {
          if (planeSeqs[bpl].length === lp.length && _rankVal(planeSeqs[bpl][0]) > lp.rank) {
            var pids = [];
            for (var plj = 0; plj < planeSeqs[bpl].length; plj++)
              pids = pids.concat(_ids(groups[planeSeqs[bpl][plj]].slice(0, 3)));
            if (lp.type !== 'plane') {
              // Wings: one single or pair per triple, from ranks outside the plane
              var wingSize = lp.type === 'plane_wings_1' ? 1 : 2;
              var wings = [];
              for (var wr = 0; wr < ranks.length && wings.length < lp.length * wingSize; wr++) {
                if (planeSeqs[bpl].indexOf(ranks[wr]) !== -1 || groups[ranks[wr]].length < wingSize) continue;
                wings = wings.concat(_ids(groups[ranks[wr]].slice(0, wingSize)));
              }
              if (wings.length < lp.length * wingSize) continue;
              pids = pids.concat(wings);
            }
            addHint(pids);
          }
        }
      }
      // Bombs (always add)
      for (var bm = 0; bm < ranks.length; bm++) {
        if (groups[ranks[bm]].length === 4)
          addHint(_ids(groups[ranks[bm]].slice(0, 4)));
      }
      // Rocket
      var sj2 = hand.find(function(c) { return c.id === 'SJ'; });
      var bj2 = hand.find(function(c) { return c.id === 'BJ'; });
      if (sj2 && bj2) addHint([sj2.id, bj2.id]);
    }

    // Deduplicate
    var seen = {};
    return hints.filter(function(h) {
      var key = h.slice().sort().join(',');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  window._ddzHint = function() {
    var s = getCurrentState();
    if (!s) return;
    var pi = parseInt(sessionStorage.getItem('playerIndex'));
    if (!isFinite(pi) || pi < 0) pi = _lastPlayerIndex;
    if (!isFinite(pi) || pi < 0) return;
    var hand = s.hands[pi];
    if (!hand || hand.length === 0) return;
    var lastPlay = s.lastPlay;

    _hints = generateHints(hand, lastPlay, pi);
    if (_hints.length === 0) return;

    _hintIndex = _hintIndex < 0 ? 0 : (_hintIndex + 1) % _hints.length;
    selected = {};
    var ids = _hints[_hintIndex];
    for (var h = 0; h < ids.length; h++) selected[ids[h]] = true;

    var renderer = window.gameRenderers.get('doudizhu');
    if (isFs()) {
      if (renderer && renderer.renderFsHand) renderer.renderFsHand(s, pi, s.currentPlayer, _lastWinner, false);
    } else {
      if (renderer && renderer.renderHand) renderer.renderHand(s, pi, s.currentPlayer, false);
    }
    updateDdzHint(s, pi);

    // Ensure the hint element is visible
    var hintEl = document.getElementById(isFs() ? 'ddzFsHint' : 'ddzHint');
    if (hintEl && hintEl.style.display !== 'none') {
      showToast(_t('ddz_hint') + ' (' + ids.length + ' ' + _t('ddz_cards_label') + ')');
    }
  };

  window._ddzBid = function(score) {
    selected = {};
    hideDdzHints();
    window.makeGameMove({ score: score });
  };

  window._ddzPlay = function() {
    var ids = Object.keys(selected);
    if (ids.length === 0) {
      showToast(_t('ddz_select_cards_first'));
      return;
    }
    _pendingPlayRects = {};
    for (var i = 0; i < ids.length; i++) {
      var ce = cardEls[ids[i]];
      if (ce && ce.getBoundingClientRect) _pendingPlayRects[ids[i]] = ce.getBoundingClientRect();
    }
    _pendingPlayTime = Date.now();
    selected = {}; _hintIndex = -1; _hints = [];
    hideDdzHints();
    window.makeGameMove({ cards: ids });
  };

  window._ddzPass = function() {
    selected = {}; _hintIndex = -1; _hints = [];
    hideDdzHints();
    window.makeGameMove({ cards: [] });
  };

  window._ddzCall = function() { selected = {}; hideDdzHints(); window.makeGameMove({ call: true }); };
  window._ddzNoCall = function() { selected = {}; hideDdzHints(); window.makeGameMove({ pass: true }); };
  window._ddzRob = function() { selected = {}; hideDdzHints(); window.makeGameMove({ rob: true }); };
  window._ddzNoRob = function() { selected = {}; hideDdzHints(); window.makeGameMove({ passRob: true }); };
  window._ddzContinueVote = function(vote) { window.makeGameMove({ action: 'continue_vote', vote: vote }); };
  window._ddzNextRound = function() { window.makeGameMove({ action: 'next_round' }); };

  function getCurrentState() {
    // room-client stores state in closure; we expose it via window hook
    if (window._ddzState) return window._ddzState;
    return null;
  }

  function showToast(msg) { if (window.showToast) window.showToast(msg); }

  function escHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  // Cache the latest state for the hint button
  var origRendererRender = window.gameRenderers.get('doudizhu').render;
  window.gameRenderers.get('doudizhu').render = function(state, container, playerIndex, winner) {
    if (state !== window._ddzState) { _hintIndex = -1; _hints = []; }
    window._ddzState = state;
    origRendererRender.call(this, state, container, playerIndex, winner);
  };
})();
