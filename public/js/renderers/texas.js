// public/js/renderers/texas.js
(function() {
  var EASE_OUT = 'cubic-bezier(0.23,1,0.32,1)';
  var EASE_INOUT = 'cubic-bezier(0.77,0,0.175,1)';
  var EASE_POP = 'cubic-bezier(0.34,1.56,0.64,1)';

  var _lastHoleKey = '';
  var _lastCommunityCount = 0;
  var _prevAllIn = null, _prevHandNo = null;
  var _raiseSlider = null;
  var _fsRaiseSlider = null;

  // Fullscreen state & snapshot diffing (reset on init)
  var _prev = null;
  var _allInAnnounced = {};
  var _turnKey = '';
  var _numTweens = {};
  var _raiseOpen = false;
  var _skipNextAnim = false;
  var _lastState = null;
  var _lastSelf = 0;
  var _lastWinner = null;
  var _container = null;
  var _lastSeatCount = 0;
  var _lastSelfIdx = -1;
  var _lastActionSig = '';
  var _eventsBound = false;
  var _fsGeometry = null;
  var _eventTimer = null;
  var _activeEventEl = null;

  var STYLES = [
    '#txFs{display:none;}',
    'body.gn-fs #txWrap{display:none !important;}',
    'body.gn-fs #boardArea{width:100%;height:100%;max-width:none;min-width:0;min-height:0;display:flex;flex-direction:column;align-items:stretch;justify-content:stretch;overflow:hidden;}',
    'body.gn-fs #txFs{position:relative;display:grid;grid-template-columns:minmax(0,1fr) clamp(118px,15.5vw,164px);flex:1 1 auto;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:radial-gradient(ellipse at 44% 48%,#1d3228 0%,#111c17 72%,#0b120f 100%);color:var(--ge-paper,#fffdf8);user-select:none;-webkit-user-select:none;box-sizing:border-box;--tx-comm-w:50px;--tx-hole-w:60px;--tx-opp-w:24px;--tx-rev-w:36px;}',
    'body.gn-fs #txFs.is-compact{--tx-comm-w:44px;--tx-hole-w:52px;--tx-opp-w:21px;--tx-rev-w:31px;}',
    '@media (min-height:580px){body.gn-fs #txFs{--tx-comm-w:62px;--tx-hole-w:74px;--tx-opp-w:28px;--tx-rev-w:44px;}}',
    'body.gn-fs #txFs *{box-sizing:border-box;}',
    'body.gn-fs #txFsStage{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;}',
    'body.gn-fs #txFsHud{position:absolute;top:8px;right:8px;z-index:6;display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(12,18,15,0.72);border:1px solid rgba(255,253,248,0.14);font-size:11px;font-weight:700;letter-spacing:0.4px;color:rgba(255,253,248,0.86);pointer-events:none;font-variant-numeric:tabular-nums;}',
    'body.gn-fs #txFsHudPhase{color:#f4cc62;text-transform:uppercase;letter-spacing:0.8px;}',
    'body.gn-fs #txFsTable{position:absolute;border-radius:999px;background:radial-gradient(ellipse at 50% 42%,rgba(255,255,255,0.11),transparent 62%),linear-gradient(160deg,var(--ge-felt,#2f5d4a) 0%,var(--ge-felt-dark,#1f4032) 100%);border:clamp(6px,1.4vh,11px) solid #3b281c;box-shadow:inset 0 0 0 2px rgba(185,149,79,0.42),inset 0 14px 36px rgba(0,0,0,0.44),0 14px 34px rgba(0,0,0,0.46);z-index:1;pointer-events:none;}',
    'body.gn-fs #txFsTable::after{content:"";position:absolute;inset:8px;border-radius:999px;border:1px solid rgba(255,253,248,0.13);pointer-events:none;}',
    'body.gn-fs #txFsCenter{position:absolute;transform:translate(-50%,-50%);z-index:3;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;max-width:86%;}',
    'body.gn-fs #txFs.is-compact #txFsCenter{gap:4px;}',
    'body.gn-fs #txFsPotArea{display:flex;flex-direction:column;align-items:center;gap:4px;}',
    'body.gn-fs #txFsPotPill{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:rgba(10,16,13,0.78);border:1px solid rgba(185,149,79,0.52);box-shadow:0 3px 10px rgba(0,0,0,0.32);font-size:13px;font-weight:800;color:#f4cc62;font-variant-numeric:tabular-nums;}',
    'body.gn-fs #txFs.is-compact #txFsPotPill{padding:3px 10px;font-size:12px;}',
    'body.gn-fs #txFsPotLabel{color:rgba(255,253,248,0.72);font-weight:700;font-size:11px;}',
    'body.gn-fs #txFsSidePots{display:flex;flex-wrap:wrap;justify-content:center;gap:4px;}',
    'body.gn-fs .tx-fs-sidepot{padding:2px 8px;border-radius:999px;background:rgba(10,16,13,0.68);border:1px solid rgba(255,253,248,0.16);font-size:10px;font-weight:700;color:rgba(255,253,248,0.88);font-variant-numeric:tabular-nums;}',
    'body.gn-fs #txFsCommunity{display:flex;align-items:center;justify-content:center;gap:clamp(4px,0.7vw,8px);perspective:700px;}',
    'body.gn-fs .tx-fs-comm-slot{position:relative;flex:0 0 auto;transform-style:preserve-3d;}',
    'body.gn-fs #txFsCommunity .pc-card{--w:var(--tx-comm-w);transition:transform 220ms ' + EASE_OUT + ',opacity 220ms ' + EASE_OUT + ',box-shadow 220ms ' + EASE_OUT + ';}',
    'body.gn-fs .pc-card.tx-win-card{transform:translateY(-6px) scale(1.05);box-shadow:0 0 0 2.5px #f4cc62,0 0 16px rgba(244,204,98,0.72),0 6px 14px rgba(0,0,0,0.45);z-index:2;}',
    'body.gn-fs .pc-card.tx-dim-card{opacity:0.42;}',
    'body.gn-fs #txFsBets{position:absolute;inset:0;pointer-events:none;z-index:4;}',
    'body.gn-fs .tx-fs-bet{position:absolute;transform:translate(-50%,-50%);display:none;flex-direction:column;align-items:center;gap:2px;}',
    'body.gn-fs .tx-fs-bet.is-shown{display:flex;}',
    'body.gn-fs .tx-fs-bet-pile{display:flex;flex-direction:column-reverse;align-items:center;}',
    'body.gn-fs .tx-chip{width:16px;height:6px;border-radius:999px;border:1.5px dashed rgba(255,255,255,0.65);box-shadow:0 1px 2px rgba(0,0,0,0.5);margin-top:-2px;background:#c0392b;}',
    'body.gn-fs .tx-chip.is-blue{background:#2d6ca2;}',
    'body.gn-fs .tx-chip.is-green{background:#2f7d52;}',
    'body.gn-fs .tx-chip.is-gold{background:#c8a45c;border-color:rgba(28,27,25,0.6);}',
    'body.gn-fs .tx-fs-bet-amt{padding:1px 6px;border-radius:999px;background:rgba(10,16,13,0.82);border:1px solid rgba(255,253,248,0.18);font-size:10px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap;}',
    'body.gn-fs #txFsSeats{position:absolute;inset:0;pointer-events:none;z-index:5;}',
    'body.gn-fs .tx-fs-seat{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;display:flex;align-items:center;justify-content:center;}',
    'body.gn-fs .tx-fs-seat.is-me{gap:8px;align-items:flex-end;}',
    'body.gn-fs .tx-fs-seat-card{position:relative;display:flex;align-items:center;gap:6px;width:clamp(96px,12.2vw,132px);padding:5px 7px;border-radius:12px;background:rgba(16,22,19,0.88);border:1.5px solid rgba(255,253,248,0.16);box-shadow:0 4px 14px rgba(0,0,0,0.38);transition:opacity 200ms ' + EASE_OUT + ',transform 200ms ' + EASE_OUT + ',border-color 200ms ' + EASE_OUT + ';}',
    'body.gn-fs #txFs.is-compact .tx-fs-seat-card{width:94px;padding:4px 6px;gap:5px;border-radius:10px;}',
    'body.gn-fs #txFs.is-dense .tx-fs-seat-card{width:86px;padding:3px 5px;gap:4px;}',
    'body.gn-fs .tx-fs-seat.is-me .tx-fs-seat-card{border-color:rgba(200,164,92,0.48);background:rgba(20,30,25,0.92);}',
    'body.gn-fs .tx-fs-seat.is-active-turn .tx-fs-seat-card{border-color:#f4cc62;box-shadow:0 0 0 2px rgba(244,204,98,0.34),0 6px 18px rgba(0,0,0,0.46);}',
    'body.gn-fs .tx-fs-seat.is-winner .tx-fs-seat-card{border-color:#f4cc62;box-shadow:0 0 0 2.5px rgba(244,204,98,0.68),0 0 18px rgba(244,204,98,0.42);}',
    'body.gn-fs .tx-fs-seat.is-folded .tx-fs-seat-card{opacity:0.44;}',
    'body.gn-fs .tx-fs-seat.is-out .tx-fs-seat-card{opacity:0.30;filter:grayscale(1);}',
    'body.gn-fs .tx-fs-avatar-wrap{position:relative;flex:0 0 auto;width:34px;height:34px;display:flex;align-items:center;justify-content:center;}',
    'body.gn-fs #txFs.is-compact .tx-fs-avatar-wrap{width:28px;height:28px;}',
    'body.gn-fs .tx-fs-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(145deg,#33423a,#1b241f);border:1px solid rgba(255,253,248,0.2);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fffdf8;line-height:1;}',
    'body.gn-fs #txFs.is-compact .tx-fs-avatar{width:23px;height:23px;font-size:12px;}',
    'body.gn-fs .tx-fs-timer-svg{position:absolute;inset:-2px;width:calc(100% + 4px);height:calc(100% + 4px);transform:rotate(-90deg);pointer-events:none;opacity:0;transition:opacity 160ms ' + EASE_OUT + ';}',
    'body.gn-fs .tx-fs-seat.is-active-turn .tx-fs-timer-svg{opacity:1;}',
    'body.gn-fs .tx-fs-timer-track{fill:none;stroke:rgba(255,253,248,0.14);stroke-width:3;}',
    'body.gn-fs .tx-fs-timer-arc{fill:none;stroke:#f4cc62;stroke-width:3;stroke-linecap:round;stroke-dasharray:113.1;stroke-dashoffset:0;}',
    'body.gn-fs .tx-fs-seat.is-active-turn .tx-fs-timer-arc.is-running{animation:txTimerSweep 30s linear forwards;}',
    '@keyframes txTimerSweep{0%{stroke-dashoffset:0;stroke:#f4cc62;}65%{stroke:#e08c2e;}100%{stroke-dashoffset:113.1;stroke:#e0483a;}}',
    'body.gn-fs .tx-fs-meta{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px;}',
    'body.gn-fs .tx-fs-name{font-size:11px;font-weight:700;color:#fffdf8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;}',
    'body.gn-fs #txFs.is-compact .tx-fs-name{font-size:10px;}',
    'body.gn-fs .tx-fs-chips{font-size:11px;font-weight:800;color:#f4cc62;font-variant-numeric:tabular-nums;line-height:1.2;white-space:nowrap;}',
    'body.gn-fs #txFs.is-compact .tx-fs-chips{font-size:10px;}',
    'body.gn-fs .tx-fs-status{font-size:9px;font-weight:700;color:rgba(255,253,248,0.68);line-height:1.1;white-space:nowrap;}',
    'body.gn-fs .tx-fs-badges{position:absolute;top:-8px;right:-4px;display:flex;align-items:center;gap:3px;z-index:2;}',
    'body.gn-fs .tx-fs-dealer-btn{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fffdf8,#e6d4a2);border:1.5px solid #8a6b2e;color:#1c1b19;font-size:10px;font-weight:900;display:none;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.45);}',
    'body.gn-fs .tx-fs-dealer-btn.is-shown{display:inline-flex;}',
    'body.gn-fs .tx-fs-blind{padding:1px 5px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:0.3px;box-shadow:0 2px 5px rgba(0,0,0,0.4);display:none;}',
    'body.gn-fs .tx-fs-blind.is-sb{display:inline-flex;background:#2d6ca2;color:#fff;border:1px solid rgba(255,255,255,0.35);}',
    'body.gn-fs .tx-fs-blind.is-bb{display:inline-flex;background:#c8a45c;color:#1c1b19;border:1px solid rgba(255,255,255,0.45);}',
    'body.gn-fs .tx-fs-allin-badge{position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);padding:1px 7px;border-radius:999px;background:linear-gradient(135deg,#d4493a,#a62418);border:1px solid rgba(255,214,138,0.7);color:#fffdf8;font-size:9px;font-weight:900;letter-spacing:0.6px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.45);display:none;}',
    'body.gn-fs .tx-fs-allin-badge.is-shown{display:inline-flex;}',
    'body.gn-fs .tx-fs-rank-pill{position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);padding:1px 7px;border-radius:999px;background:rgba(16,22,19,0.94);border:1px solid rgba(244,204,98,0.65);color:#f4cc62;font-size:9px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:none;z-index:3;}',
    'body.gn-fs .tx-fs-rank-pill.is-shown{display:inline-flex;}',
    'body.gn-fs .tx-fs-opp-cards{position:absolute;display:flex;align-items:center;pointer-events:none;z-index:2;}',
    'body.gn-fs .tx-fs-opp-cards .tx-fs-card-wrap + .tx-fs-card-wrap{margin-left:-8px;}',
    'body.gn-fs .tx-fs-opp-cards.is-revealed .tx-fs-card-wrap + .tx-fs-card-wrap{margin-left:3px;}',
    'body.gn-fs .tx-fs-opp-cards .pc-card{--w:var(--tx-opp-w);}',
    'body.gn-fs .tx-fs-opp-cards.is-revealed .pc-card{--w:var(--tx-rev-w);}',
    'body.gn-fs .tx-fs-seat[data-side="bottom"] .tx-fs-opp-cards{top:calc(100% + 4px);left:50%;transform:translateX(-50%);}',
    'body.gn-fs .tx-fs-seat[data-side="top"] .tx-fs-opp-cards{bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);}',
    'body.gn-fs .tx-fs-seat[data-side="right"] .tx-fs-opp-cards{left:calc(100% + 5px);top:50%;transform:translateY(-50%);}',
    'body.gn-fs .tx-fs-seat[data-side="left"] .tx-fs-opp-cards{right:calc(100% + 5px);top:50%;transform:translateY(-50%);}',
    'body.gn-fs #txFsMyCards{display:flex;align-items:flex-end;gap:5px;pointer-events:none;}',
    'body.gn-fs #txFsMyCards .pc-card{--w:var(--tx-hole-w);box-shadow:0 6px 18px rgba(0,0,0,0.46);}',
    'body.gn-fs #txFsMyCards .tx-fs-card-wrap:first-child .pc-card{transform:rotate(-3deg);}',
    'body.gn-fs #txFsMyCards .tx-fs-card-wrap:last-child .pc-card{transform:rotate(3deg);}',
    'body.gn-fs #txFsMyCards .tx-fs-card-wrap .pc-card.tx-win-card{transform:translateY(-6px) scale(1.05);}',
    'body.gn-fs #txFsFx{position:absolute;inset:0;pointer-events:none;z-index:12;overflow:hidden;}',
    'body.gn-fs .tx-fs-fly-chips{position:absolute;left:0;top:0;transform:translate(-50%,-50%);display:flex;flex-direction:column-reverse;align-items:center;pointer-events:none;}',
    'body.gn-fs #txFsRight{position:relative;display:flex;flex-direction:column;justify-content:flex-end;align-items:stretch;gap:8px;padding:10px 8px;background:linear-gradient(90deg,rgba(10,16,13,0) 0%,rgba(10,16,13,0.72) 18%,rgba(10,16,13,0.90) 100%);z-index:8;min-width:0;}',
    'body.gn-fs #txFsTurnNote{margin-bottom:auto;padding:8px;border-radius:12px;background:rgba(255,253,248,0.08);border:1px solid rgba(255,253,248,0.12);font-size:12px;font-weight:700;text-align:center;color:rgba(255,253,248,0.82);line-height:1.3;}',
    'body.gn-fs #txFsTurnNote.is-mine{background:rgba(200,164,92,0.18);border-color:rgba(244,204,98,0.45);color:#f4cc62;}',
    'body.gn-fs #txFsTurnNote:empty{display:none;}',
    'body.gn-fs #txFsActions{display:flex;flex-direction:column;gap:8px;width:100%;}',
    'body.gn-fs .tx-fs-btn{width:100%;min-height:46px;padding:8px 10px;border-radius:14px;border:1px solid transparent;font-family:inherit;font-size:14px;font-weight:800;line-height:1.15;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-align:center;white-space:nowrap;transition:transform 120ms ' + EASE_OUT + ',opacity 140ms ' + EASE_OUT + ';-webkit-tap-highlight-color:transparent;}',
    '@media (min-height:580px){body.gn-fs .tx-fs-btn{min-height:52px;font-size:15px;}}',
    'body.gn-fs .tx-fs-btn:active{transform:scale(0.97);}',
    'body.gn-fs .tx-fs-btn.is-fold{background:rgba(255,253,248,0.08);border-color:rgba(212,105,90,0.45);color:#f29b8e;}',
    'body.gn-fs .tx-fs-btn.is-call{background:linear-gradient(135deg,#3e8d61,#256341);border-color:rgba(255,255,255,0.22);color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.34);}',
    'body.gn-fs .tx-fs-btn.is-raise{background:linear-gradient(135deg,#d6af60,#a98137);border-color:rgba(255,244,214,0.38);color:#1c1b19;box-shadow:0 4px 14px rgba(200,164,92,0.32);}',
    'body.gn-fs .tx-fs-btn.is-allin{background:linear-gradient(135deg,#d4493a,#a62418);border-color:rgba(255,214,138,0.45);color:#fff;box-shadow:0 4px 14px rgba(212,73,58,0.35);}',
    'body.gn-fs #txFsRaisePanel{position:absolute;right:8px;top:8px;bottom:8px;width:clamp(174px,25vw,222px);z-index:15;display:none;flex-direction:column;gap:8px;padding:10px;border-radius:18px;background:rgba(16,24,20,0.96);border:1.5px solid rgba(185,149,79,0.5);box-shadow:-10px 0 32px rgba(0,0,0,0.55);}',
    'body.gn-fs #txFsRaisePanel.is-open{display:flex;}',
    'body.gn-fs #txFsRaiseSlider{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;}',
    'body.gn-fs #txFsRaisePanel .ui-ss{display:grid;grid-template-columns:minmax(0,1fr) 48px;grid-template-rows:auto minmax(0,1fr);gap:8px;flex:1 1 auto;min-height:0;height:100%;}',
    'body.gn-fs #txFsRaisePanel .ui-ss-head{grid-column:1 / -1;grid-row:1;align-items:center;}',
    'body.gn-fs #txFsRaisePanel .ui-ss-label{color:rgba(255,253,248,0.72);font-size:12px;}',
    'body.gn-fs #txFsRaisePanel .ui-ss-val{color:#f4cc62;font-size:17px;font-weight:800;}',
    'body.gn-fs #txFsRaisePanel .ui-ss-presets{grid-column:1;grid-row:2;display:flex;flex-direction:column;justify-content:center;gap:6px;min-width:0;}',
    'body.gn-fs #txFsRaisePanel .ui-ss-preset{flex:0 0 auto;width:100%;min-height:44px;padding:6px 8px;border-radius:12px;background:rgba(255,253,248,0.08);border:1px solid rgba(255,253,248,0.16);color:#fffdf8;font-size:12px;font-weight:700;}',
    'body.gn-fs #txFsRaisePanel .ui-ss-preset.is-active{background:rgba(200,164,92,0.28);border-color:#f4cc62;color:#f4cc62;}',
    'body.gn-fs #txFsRaisePanel .ui-ss-row{grid-column:2;grid-row:2;display:flex;flex-direction:column-reverse;align-items:center;justify-content:space-between;gap:6px;min-height:0;height:100%;}',
    'body.gn-fs #txFsRaisePanel .ui-ss-btn{flex:0 0 44px;width:44px;height:44px;min-width:44px;min-height:44px;background:rgba(255,253,248,0.1);border:1px solid rgba(255,253,248,0.22);color:#fffdf8;}',
    'body.gn-fs #txFsRaisePanel .ui-ss-range{writing-mode:vertical-lr;direction:rtl;width:44px;height:100%;min-height:68px;flex:1 1 auto;margin:0;}',
    'body.gn-fs #txFsRaisePanel .ui-ss-range::-webkit-slider-runnable-track{width:6px;height:100%;border-radius:999px;background:rgba(255,253,248,0.22);}',
    'body.gn-fs #txFsRaisePanel .ui-ss-range::-webkit-slider-thumb{margin-top:0;margin-left:-11px;width:28px;height:28px;}',
    'body.gn-fs #txFsRaisePanel .ui-ss-range::-moz-range-track{width:6px;height:100%;border-radius:999px;background:rgba(255,253,248,0.22);}',
    'body.gn-fs #txFsRaiseFooter{display:flex;gap:6px;flex:0 0 auto;}',
    'body.gn-fs #txFsCancelRaiseBtn{flex:0 0 44px;width:44px;min-width:44px;min-height:44px;border-radius:12px;border:1px solid rgba(255,253,248,0.2);background:rgba(255,253,248,0.08);color:#fffdf8;font-size:18px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;}',
    'body.gn-fs #txFsConfirmRaiseBtn{flex:1 1 auto;min-height:44px;padding:6px 10px;border-radius:12px;border:1px solid rgba(255,244,214,0.4);background:linear-gradient(135deg,#d6af60,#a98137);color:#1c1b19;font-size:13px;font-weight:800;cursor:pointer;font-variant-numeric:tabular-nums;}',
    'body.gn-fs #txFsCancelRaiseBtn:active,body.gn-fs #txFsConfirmRaiseBtn:active{transform:scale(0.97);}',
    'body.gn-fs #txFsEventHost{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);z-index:25;pointer-events:none;}',
    'body.gn-fs .tx-fs-event-card{pointer-events:auto;min-width:190px;max-width:290px;padding:14px 20px;border-radius:18px;background:linear-gradient(155deg,#2b1714 0%,#181311 100%);border:2px solid #f4cc62;box-shadow:0 14px 36px rgba(0,0,0,0.58),0 0 24px rgba(212,73,58,0.38);text-align:center;cursor:pointer;}',
    'body.gn-fs .tx-fs-event-kicker{font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#f4cc62;margin-bottom:4px;}',
    'body.gn-fs .tx-fs-event-title{font-size:20px;font-weight:800;color:#fffdf8;line-height:1.2;}',
    'body.gn-fs .tx-fs-event-sub{font-size:11px;color:rgba(255,253,248,0.68);margin-top:6px;}',
    '@media (prefers-reduced-motion: reduce){',
    '  body.gn-fs #txFs .tx-fs-seat-card,body.gn-fs #txFs .tx-fs-btn,body.gn-fs #txFsCommunity .pc-card{transition:opacity 120ms linear !important;}',
    '  body.gn-fs #txFs .tx-fs-seat.is-active-turn .tx-fs-timer-arc.is-running{animation:none !important;stroke-dashoffset:0;stroke:#f4cc62;}',
    '  body.gn-fs #txFs .tx-fs-btn:active,body.gn-fs #txFsCancelRaiseBtn:active,body.gn-fs #txFsConfirmRaiseBtn:active{transform:none;}',
    '}'
  ].join('\n');

  window.gameRenderers = window.gameRenderers || new Map();

  // Smallest legal raise target; mirrors games/texas.js handleMove 'raise'
  function minRaiseTo(s) {
    return (s.currentBet || 0) + (s.lastRaise || 20);
  }

  function isFs() {
    return !!(document.body && document.body.classList && document.body.classList.contains('gn-fs'));
  }

  function isReduced() {
    if (window.Motion && typeof window.Motion.reduced === 'function' && window.Motion.reduced()) return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function escHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function cardSpan(c) {
    return window.CardUI.render(c, { size: 'md' });
  }

  function cardBackSpan() {
    return window.CardUI.render(null, { size: 'md', faceDown: true, className: 'tx-slot' });
  }

  function showToast(msg) { if (window.showToast) window.showToast(msg); }

  function getPlayerMeta(idx) {
    var list = window.gamePlayers || window._players || [];
    var p = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].index === idx) { p = list[i]; break; }
    }
    if (!p && list[idx]) p = list[idx];
    var name = (p && p.name) || (window.getPlayerName ? window.getPlayerName(idx) : (_t('tx_player') + (idx + 1)));
    var avatar = (p && p.avatar) ? String(p.avatar) : '';
    var initial = String(name).trim().charAt(0).toUpperCase() || String(idx + 1);
    return { name: name, avatar: avatar, initial: initial };
  }

  function phaseLabel(phase) {
    var map = {
      preflop: _t('tx_phase_preflop'),
      flop: _t('tx_phase_flop'),
      turn: _t('tx_phase_turn'),
      river: _t('tx_phase_river'),
      showdown: _t('tx_showdown')
    };
    return map[phase] || phase || '';
  }

  function handTypeLabel(type) {
    var map = {
      high_card: _t('tx_hand_high_card'),
      pair: _t('tx_hand_pair'),
      two_pair: _t('tx_hand_two_pair'),
      three: _t('tx_hand_three'),
      straight: _t('tx_hand_straight'),
      flush: _t('tx_hand_flush'),
      full_house: _t('tx_hand_full_house'),
      four: _t('tx_hand_four'),
      straight_flush: _t('tx_hand_straight_flush')
    };
    return map[type] || type || '';
  }

  function displayPotTotal(s) {
    if (!s) return 0;
    if ((s.pot || 0) > 0) return s.pot;
    if (Array.isArray(s.sidePots) && s.sidePots.length > 0) {
      var total = 0;
      for (var i = 0; i < s.sidePots.length; i++) total += (s.sidePots[i].amount || 0);
      return total;
    }
    return 0;
  }

  function cloneSnapshot(s, selfIdx) {
    var comm = s.communityCards || [];
    var hole = s.holeCards || (s.hands && s.hands[selfIdx]) || [];
    var pots = s.sidePots || [];
    var totalSidePot = 0;
    for (var i = 0; i < pots.length; i++) totalSidePot += (pots[i].amount || 0);
    return {
      handNumber: s.handNumber || 1,
      phase: s.phase,
      pot: s.pot || 0,
      displayPot: (s.pot || 0) > 0 ? s.pot : totalSidePot,
      chips: (s.chips || []).slice(),
      bets: (s.bets || []).slice(),
      allIn: (s.allIn || []).slice(),
      folded: (s.folded || []).slice(),
      winner: s.winner,
      communityIds: comm.map(function(c) { return c.id; }),
      holeKey: hole.map(function(c) { return c.id; }).join(',')
    };
  }

  function rollNumber(key, el, from, to, duration) {
    if (!el) return;
    if (_numTweens[key]) {
      cancelAnimationFrame(_numTweens[key]);
      delete _numTweens[key];
    }
    if (from === to || isReduced()) {
      el.textContent = String(to);
      return;
    }
    var start = performance.now();
    var dur = duration || 600;
    function step(now) {
      var t = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (t < 1) {
        _numTweens[key] = requestAnimationFrame(step);
      } else {
        el.textContent = String(to);
        delete _numTweens[key];
      }
    }
    _numTweens[key] = requestAnimationFrame(step);
  }

  function buildChipPileHtml(amount) {
    var count = amount >= 400 ? 4 : amount >= 100 ? 3 : amount >= 30 ? 2 : 1;
    var cls = amount >= 500 ? 'is-gold' : amount >= 200 ? 'is-green' : amount >= 50 ? 'is-blue' : '';
    var html = '';
    for (var i = 0; i < count; i++) {
      html += '<span class="tx-chip ' + cls + '"></span>';
    }
    return html;
  }

  function spawnFlyingChips(fromPt, toPt, amount, duration, delay, easing) {
    var fx = document.getElementById('txFsFx');
    if (!fx || !fromPt || !toPt || isReduced()) return;
    var el = document.createElement('div');
    el.className = 'tx-fs-fly-chips';
    el.innerHTML = buildChipPileHtml(amount);
    fx.appendChild(el);
    if (typeof el.animate !== 'function') { el.remove(); return; }
    var anim = el.animate([
      { transform: 'translate(' + fromPt.x + 'px,' + fromPt.y + 'px) translate(-50%,-50%) scale(0.92)', opacity: 0.95 },
      { transform: 'translate(' + toPt.x + 'px,' + toPt.y + 'px) translate(-50%,-50%) scale(1)', opacity: 1 }
    ], {
      duration: duration,
      delay: delay || 0,
      easing: easing || EASE_OUT,
      fill: 'both'
    });
    anim.onfinish = function() { el.remove(); };
    anim.oncancel = function() { el.remove(); };
  }

  function animateFlyFrom(el, fromRect, duration, delay, easing) {
    if (!el || !fromRect || typeof el.animate !== 'function') return;
    if (isReduced()) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: EASE_OUT });
      return;
    }
    var to = el.getBoundingClientRect();
    if (!to.width || !to.height) return;
    var fromCx = fromRect.left + fromRect.width / 2;
    var fromCy = fromRect.top + fromRect.height / 2;
    var toCx = to.left + to.width / 2;
    var toCy = to.top + to.height / 2;
    var dx = fromCx - toCx;
    var dy = fromCy - toCy;
    var s = fromRect.width ? Math.max(0.35, Math.min(1.1, fromRect.width / to.width)) : 0.6;
    el.animate([
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')', opacity: 0.15 },
      { transform: 'none', opacity: 1 }
    ], {
      duration: duration,
      delay: delay || 0,
      easing: easing || EASE_OUT,
      fill: 'backwards'
    });
  }

  function animateFlipCard(el, delay) {
    if (!el || typeof el.animate !== 'function') return;
    if (isReduced()) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: delay || 0, easing: EASE_OUT, fill: 'backwards' });
      return;
    }
    el.animate([
      { transform: 'rotateY(90deg) scale(0.94)', opacity: 0.2 },
      { transform: 'rotateY(-6deg) scale(1.02)', opacity: 1, offset: 0.78 },
      { transform: 'rotateY(0deg) scale(1)', opacity: 1 }
    ], {
      duration: 300,
      delay: delay || 0,
      easing: EASE_OUT,
      fill: 'backwards'
    });
  }

  function triggerTableShake() {
    if (isReduced()) return;
    var tbl = document.getElementById('txFsTable');
    if (!tbl || typeof tbl.animate !== 'function') return;
    tbl.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)', offset: 0.2 },
      { transform: 'translateX(6px)', offset: 0.45 },
      { transform: 'translateX(-4px)', offset: 0.7 },
      { transform: 'translateX(4px)', offset: 0.85 },
      { transform: 'translateX(0)' }
    ], { duration: 300, easing: EASE_OUT });
  }

  function clearEventCard() {
    if (_eventTimer) { clearTimeout(_eventTimer); _eventTimer = null; }
    if (_activeEventEl) { _activeEventEl.remove(); _activeEventEl = null; }
  }

  function showAllInEventCard(playerName) {
    var host = document.getElementById('txFsEventHost');
    if (!host) return;
    clearEventCard();
    var card = document.createElement('div');
    card.className = 'tx-fs-event-card';
    card.setAttribute('role', 'status');
    card.innerHTML =
      '<div class="tx-fs-event-kicker">' + escHtml(_t('tx_all_in_badge')) + '</div>' +
      '<div class="tx-fs-event-title">' + escHtml(_tf('tx_ann_all_in', playerName)) + '</div>' +
      '<div class="tx-fs-event-sub">' + escHtml(_t('tx_tap_dismiss')) + '</div>';
    host.appendChild(card);
    _activeEventEl = card;

    var closing = false;
    function dismiss() {
      if (closing) return;
      closing = true;
      if (_eventTimer) { clearTimeout(_eventTimer); _eventTimer = null; }
      var done = function() {
        if (card.parentNode) card.remove();
        if (_activeEventEl === card) _activeEventEl = null;
      };
      if (typeof card.animate !== 'function') { done(); return; }
      var outAnim = card.animate(isReduced()
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.92)' }],
        { duration: 200, easing: EASE_OUT, fill: 'forwards' });
      outAnim.onfinish = done;
      outAnim.oncancel = done;
    }

    card.addEventListener('click', dismiss);
    if (typeof card.animate === 'function') {
      if (isReduced()) {
        card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: EASE_OUT });
      } else {
        card.animate([
          { opacity: 0, transform: 'scale(0.68)' },
          { opacity: 1, transform: 'scale(1.06)', offset: 0.72 },
          { opacity: 1, transform: 'scale(1)' }
        ], { duration: 300, easing: EASE_POP, fill: 'backwards' });
      }
    }
    triggerTableShake();
    _eventTimer = setTimeout(dismiss, 1750);
  }

  function layoutFs() {
    if (!isFs()) return;
    var root = document.getElementById('txFs');
    var stage = document.getElementById('txFsStage');
    var table = document.getElementById('txFsTable');
    var center = document.getElementById('txFsCenter');
    var seatsEl = document.getElementById('txFsSeats');
    if (!root || !stage || !table || !center || !seatsEl) return;

    var rect = stage.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    if (w < 50 || h < 50) {
      requestAnimationFrame(layoutFs);
      return;
    }

    var n = _lastState && _lastState.chips ? _lastState.chips.length : 0;
    var compact = h <= 440;
    var dense = compact && n >= 7;
    root.classList.toggle('is-compact', compact);
    root.classList.toggle('is-dense', dense);

    var seatHalfW = dense ? 44 : (compact ? 50 : 66);
    var seatHalfH = compact ? 24 : 30;
    var cx = w * 0.50;
    var cy = h * 0.48;

    var orbitRx = Math.max(116, Math.min(w * 0.50 - seatHalfW - 8, h * 0.94));
    var orbitRy = Math.max(82, h * 0.50 - seatHalfH - (compact ? 14 : 20));

    var tableW = Math.max(210, orbitRx * 1.94);
    var tableH = Math.max(150, orbitRy * 1.84);
    table.style.width = Math.round(tableW) + 'px';
    table.style.height = Math.round(tableH) + 'px';
    table.style.left = Math.round(cx - tableW / 2) + 'px';
    table.style.top = Math.round(cy - tableH / 2) + 'px';

    center.style.left = Math.round(cx) + 'px';
    center.style.top = Math.round(cy - (compact ? 4 : 6)) + 'px';

    if (n <= 0) return;

    // Sample 360 polyline points around the oval starting at bottom center (t = PI/2), clockwise
    var steps = 360;
    var pts = [];
    var cum = [0];
    var totalLen = 0;
    for (var i = 0; i <= steps; i++) {
      var theta = Math.PI / 2 + (i / steps) * Math.PI * 2;
      var px = cx + orbitRx * Math.cos(theta);
      var py = cy + orbitRy * Math.sin(theta);
      pts.push({ x: px, y: py, theta: theta });
      if (i > 0) {
        totalLen += Math.hypot(px - pts[i - 1].x, py - pts[i - 1].y);
        cum.push(totalLen);
      }
    }

    function pointAtArc(target) {
      for (var j = 1; j < cum.length; j++) {
        if (cum[j] >= target) {
          var seg = cum[j] - cum[j - 1];
          var frac = seg > 0 ? (target - cum[j - 1]) / seg : 0;
          return {
            x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * frac,
            y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * frac,
            theta: pts[j - 1].theta + (pts[j].theta - pts[j - 1].theta) * frac
          };
        }
      }
      return pts[0];
    }

    var selfIdx = _lastSelf >= 0 && _lastSelf < n ? _lastSelf : 0;
    var seatPos = {};
    var betPos = {};

    for (var idx = 0; idx < n; idx++) {
      var k = (idx - selfIdx + n) % n;
      var p = pointAtArc((totalLen * k) / n);
      var sx = p.x;
      var sy = p.y;

      if (k === 0) {
        // Keep my seat + large hole cards centered near bottom center
        sx = cx;
        sy = Math.min(cy + orbitRy, h - (compact ? 40 : 54));
      } else {
        // Clamp within stage bounds
        sx = Math.max(seatHalfW + 6, Math.min(w - seatHalfW - 6, sx));
        sy = Math.max(seatHalfH + 6, Math.min(h - seatHalfH - 6, sy));
        // Keep top-left 64x64 px clear for the fixed back button
        if (sx - seatHalfW < 68 && sy - seatHalfH < 68) {
          var pushX = 68 + seatHalfW - sx;
          var pushY = 68 + seatHalfH - sy;
          if (pushX <= pushY) sx = 68 + seatHalfW;
          else sy = 68 + seatHalfH;
        }
      }

      var seatNode = document.getElementById('txFsSeat' + idx);
      if (seatNode) {
        seatNode.style.left = Math.round(sx) + 'px';
        seatNode.style.top = Math.round(sy) + 'px';
        if (k > 0) {
          var side = 'bottom';
          if (sy > cy + orbitRy * 0.44) side = 'top';
          else if (sy < cy - orbitRy * 0.44) side = 'bottom';
          else if (sx < cx) side = 'right';
          else side = 'left';
          seatNode.setAttribute('data-side', side);
        } else {
          seatNode.removeAttribute('data-side');
        }
      }

      var bx = cx + orbitRx * 0.64 * Math.cos(p.theta);
      var by = cy + orbitRy * 0.56 * Math.sin(p.theta);
      if (k === 0) {
        bx = cx;
        by = Math.min(sy - (compact ? 42 : 52), cy + orbitRy * 0.62);
      }
      var betNode = document.getElementById('txFsBet' + idx);
      if (betNode) {
        betNode.style.left = Math.round(bx) + 'px';
        betNode.style.top = Math.round(by) + 'px';
      }

      seatPos[idx] = { x: sx, y: sy };
      betPos[idx] = { x: bx, y: by };
    }

    var potEl = document.getElementById('txFsPotPill');
    var potPt = { x: cx, y: cy - (compact ? 26 : 34) };
    if (potEl) {
      var pr = potEl.getBoundingClientRect();
      if (pr.width > 0) {
        potPt = { x: pr.left - rect.left + pr.width / 2, y: pr.top - rect.top + pr.height / 2 };
      }
    }
    _fsGeometry = { seatPos: seatPos, betPos: betPos, potPos: potPt };
  }

  function ensureSeatsBuilt(n, selfIdx) {
    var seatsEl = document.getElementById('txFsSeats');
    var betsEl = document.getElementById('txFsBets');
    if (!seatsEl || !betsEl) return;
    if (_lastSeatCount === n && _lastSelfIdx === selfIdx && seatsEl.children.length === n) return;
    _lastSeatCount = n;
    _lastSelfIdx = selfIdx;

    var seatHtml = '';
    var betHtml = '';
    for (var i = 0; i < n; i++) {
      var isMe = i === selfIdx;
      seatHtml +=
        '<div id="txFsSeat' + i + '" class="tx-fs-seat' + (isMe ? ' is-me' : '') + '">' +
          '<div class="tx-fs-seat-card">' +
            '<div class="tx-fs-avatar-wrap">' +
              '<svg class="tx-fs-timer-svg" viewBox="0 0 40 40">' +
                '<circle class="tx-fs-timer-track" cx="20" cy="20" r="18"></circle>' +
                '<circle class="tx-fs-timer-arc" cx="20" cy="20" r="18"></circle>' +
              '</svg>' +
              '<div class="tx-fs-avatar" id="txFsAvatar' + i + '"></div>' +
            '</div>' +
            '<div class="tx-fs-meta">' +
              '<div class="tx-fs-name" id="txFsName' + i + '"></div>' +
              '<div class="tx-fs-chips">$<span class="tx-fs-chips-val" id="txFsChips' + i + '">0</span></div>' +
              '<div class="tx-fs-status" id="txFsStatus' + i + '"></div>' +
            '</div>' +
            '<div class="tx-fs-badges">' +
              '<span class="tx-fs-blind" id="txFsBlind' + i + '"></span>' +
              '<span class="tx-fs-dealer-btn" id="txFsDealer' + i + '" data-tx-dealer="0">D</span>' +
            '</div>' +
            '<span class="tx-fs-allin-badge" id="txFsAllIn' + i + '">' + escHtml(_t('tx_all_in_badge')) + '</span>' +
            '<span class="tx-fs-rank-pill" id="txFsRank' + i + '"></span>' +
          '</div>' +
          (isMe
            ? '<div id="txFsMyCards"><div class="tx-fs-card-wrap" id="txFsMyCard0"></div><div class="tx-fs-card-wrap" id="txFsMyCard1"></div></div>'
            : '<div class="tx-fs-opp-cards" id="txFsOppCards' + i + '"></div>') +
        '</div>';

      betHtml +=
        '<div id="txFsBet' + i + '" class="tx-fs-bet">' +
          '<div class="tx-fs-bet-pile" id="txFsBetPile' + i + '"></div>' +
          '<div class="tx-fs-bet-amt" id="txFsBetAmt' + i + '"></div>' +
        '</div>';
    }
    seatsEl.innerHTML = seatHtml;
    betsEl.innerHTML = betHtml;
  }

  function collectWinningCardIds(s) {
    var winIds = {};
    if (!s || !Array.isArray(s.showdownHands) || s.showdownHands.length === 0) return winIds;
    var winners = (s.showdownWinners && s.showdownWinners.length)
      ? s.showdownWinners
      : (s.showdownWinner != null ? [s.showdownWinner] : []);
    for (var i = 0; i < s.showdownHands.length; i++) {
      var h = s.showdownHands[i];
      if (!h || winners.indexOf(h.player) < 0) continue;
      var bestCards = h.hand && Array.isArray(h.hand.cards) ? h.hand.cards : [];
      for (var j = 0; j < bestCards.length; j++) {
        if (bestCards[j] && bestCards[j].id) winIds[bestCards[j].id] = true;
      }
    }
    return winIds;
  }

  function applyWinDimClass(cardEl, cardId, hasShowdown, winIds) {
    if (!cardEl) return;
    if (!hasShowdown) {
      cardEl.classList.remove('tx-win-card', 'tx-dim-card');
      return;
    }
    var isWinCard = !!(cardId && winIds[cardId]);
    cardEl.classList.toggle('tx-win-card', isWinCard);
    cardEl.classList.toggle('tx-dim-card', !isWinCard);
  }

  function renderFsActions(s, selfIdx, winner) {
    var el = document.getElementById('txFsActions');
    var noteEl = document.getElementById('txFsTurnNote');
    if (!el || !noteEl) return;

    var myTurn = s.currentPlayer === selfIdx && winner == null;
    var isFolded = (s.folded || [])[selfIdx];
    var isAllIn = (s.allIn || [])[selfIdx];
    var isOut = (s.out || [])[selfIdx];
    var chips = (s.chips || [])[selfIdx] || 0;
    var myBet = (s.bets || [])[selfIdx] || 0;
    var toCall = Math.max(0, (s.currentBet || 0) - myBet);
    var canCheck = toCall <= 0;
    var raiseCost = minRaiseTo(s) - myBet;
    var someoneElseCanAct = (s.chips || []).some(function(c, i) {
      return i !== selfIdx && !(s.folded || [])[i] && !(s.allIn || [])[i] && c > 0;
    });
    var canRaise = !s.raiseClosed && chips >= raiseCost && someoneElseCanAct;

    if (!myTurn || isFolded || isAllIn || isOut || s.phase === 'showdown') {
      if (_raiseOpen) window._txHideRaise();
      var noteText = '';
      if (isOut) noteText = _t('tx_you_out');
      else if (isFolded) noteText = _t('tx_folded');
      else if (isAllIn) noteText = _t('tx_all_in_text');
      else if (s.phase === 'showdown') noteText = _t('tx_showdown');
      else if (s.currentPlayer != null && winner == null) {
        noteText = _tf('tx_waiting_turn', getPlayerMeta(s.currentPlayer).name);
      }
      noteEl.textContent = noteText;
      noteEl.classList.remove('is-mine');
      if (_lastActionSig !== 'none') {
        _lastActionSig = 'none';
        el.innerHTML = '';
      }
      return;
    }

    noteEl.textContent = _t('your_turn');
    noteEl.classList.add('is-mine');

    var canAllIn = !canRaise && (chips <= toCall || (!s.raiseClosed && chips > 0 && someoneElseCanAct));
    if (!canRaise && _raiseOpen) window._txHideRaise();

    var sig = [canCheck ? 1 : 0, toCall, canRaise ? 1 : 0, canAllIn ? 1 : 0, chips].join(':');
    if (sig === _lastActionSig) return;
    _lastActionSig = sig;

    var html = '';
    if (canRaise) {
      html += '<button type="button" class="tx-fs-btn is-raise" onclick="window._txShowRaise()">' + escHtml(_t('tx_raise')) + '</button>';
    } else if (canAllIn) {
      html += '<button type="button" class="tx-fs-btn is-allin" onclick="window._txAllIn()">' + escHtml(_t('tx_all_in')) + '</button>';
    }
    if (canCheck) {
      html += '<button type="button" class="tx-fs-btn is-call" onclick="window._txCheck()">' + escHtml(_t('tx_check')) + '</button>';
    } else if (chips > toCall) {
      html += '<button type="button" class="tx-fs-btn is-call" onclick="window._txCall()">' + escHtml(_t('tx_call') + toCall) + '</button>';
    }
    html += '<button type="button" class="tx-fs-btn is-fold" onclick="window._txFold()">' + escHtml(_t('tx_fold')) + '</button>';
    el.innerHTML = html;
  }

  function renderFs(s, selfIdx, winner) {
    var chips = s.chips || [];
    var n = chips.length;
    if (n === 0) return;

    var prevSnap = _prev;
    var skipAnim = _skipNextAnim || !prevSnap;
    _skipNextAnim = false;

    var prevGeom = _fsGeometry;
    var dealerElPrev = document.querySelector('#txFsSeats [data-tx-dealer="1"]');
    var prevDealerRect = dealerElPrev ? dealerElPrev.getBoundingClientRect() : null;

    if (prevSnap && s.handNumber !== prevSnap.handNumber) {
      _allInAnnounced = {};
    }

    ensureSeatsBuilt(n, selfIdx);

    // HUD
    var handEl = document.getElementById('txFsHudHand');
    var phaseEl = document.getElementById('txFsHudPhase');
    if (handEl) handEl.textContent = _t('tx_hand_no').replace('%s', s.handNumber || 1);
    if (phaseEl) phaseEl.textContent = phaseLabel(s.phase);

    var showdownMap = {};
    var hasShowdown = Array.isArray(s.showdownHands) && s.showdownHands.length > 0;
    if (hasShowdown) {
      for (var sh = 0; sh < s.showdownHands.length; sh++) {
        showdownMap[s.showdownHands[sh].player] = s.showdownHands[sh];
      }
    }
    var winIds = collectWinningCardIds(s);
    var winSet = {};
    if (hasShowdown) {
      var winnersArr = (s.showdownWinners && s.showdownWinners.length)
        ? s.showdownWinners
        : (s.showdownWinner != null ? [s.showdownWinner] : []);
      for (var wi = 0; wi < winnersArr.length; wi++) winSet[winnersArr[wi]] = true;
    } else if (winner != null) {
      winSet[winner] = true;
    }

    // Turn timer ring reset check
    var newTurnKey = (s.handNumber || 1) + ':' + s.phase + ':' + s.currentPlayer + ':' + (s.currentBet || 0) + ':' + (s.pot || 0);
    var turnChanged = newTurnKey !== _turnKey;
    if (turnChanged) _turnKey = newTurnKey;

    var folded = s.folded || [];
    var allIn = s.allIn || [];
    var bets = s.bets || [];
    var out = s.out || [];
    var oppCounts = s.opponentHoleCounts || [];

    // Update seats & bets
    for (var i = 0; i < n; i++) {
      var seatEl = document.getElementById('txFsSeat' + i);
      if (!seatEl) continue;
      var meta = getPlayerMeta(i);
      var isOut = !!out[i];
      var isFolded = !!folded[i] && !isOut;
      var isAllIn = !!allIn[i] && !isOut && !isFolded;
      var isActive = s.currentPlayer === i && winner == null && s.phase !== 'showdown' && !isFolded && !isOut && !isAllIn;
      var isWinner = !!winSet[i];

      seatEl.classList.toggle('is-active-turn', isActive);
      seatEl.classList.toggle('is-folded', isFolded);
      seatEl.classList.toggle('is-out', isOut);
      seatEl.classList.toggle('is-winner', isWinner);

      var avEl = document.getElementById('txFsAvatar' + i);
      if (avEl) avEl.textContent = meta.avatar || meta.initial;
      var nmEl = document.getElementById('txFsName' + i);
      if (nmEl) nmEl.textContent = i === selfIdx ? (meta.name + ' (' + _t('you') + ')') : meta.name;

      var chipsEl = document.getElementById('txFsChips' + i);
      var targetChips = chips[i] || 0;
      if (chipsEl) {
        if (!skipAnim && prevSnap && s.handNumber === prevSnap.handNumber && targetChips !== (prevSnap.chips[i] || 0)) {
          rollNumber('chips_' + i, chipsEl, prevSnap.chips[i] || 0, targetChips, 600);
        } else if (!_numTweens['chips_' + i]) {
          chipsEl.textContent = String(targetChips);
        }
      }

      var statusEl = document.getElementById('txFsStatus' + i);
      if (statusEl) {
        statusEl.textContent = isOut ? _t('tx_out') : isFolded ? _t('tx_folded') : '';
      }

      var dealerEl = document.getElementById('txFsDealer' + i);
      if (dealerEl) {
        var isDealer = s.dealer === i;
        dealerEl.classList.toggle('is-shown', isDealer);
        dealerEl.setAttribute('data-tx-dealer', isDealer ? '1' : '0');
      }

      var blindEl = document.getElementById('txFsBlind' + i);
      if (blindEl) {
        var isBB = s.bigBlind === i && !isOut;
        var isSB = s.smallBlind === i && !isOut;
        blindEl.className = 'tx-fs-blind' + (isBB ? ' is-bb' : isSB ? ' is-sb' : '');
        blindEl.textContent = isBB ? 'BB' : isSB ? 'SB' : '';
      }

      var allInEl = document.getElementById('txFsAllIn' + i);
      if (allInEl) allInEl.classList.toggle('is-shown', isAllIn);

      var rankEl = document.getElementById('txFsRank' + i);
      if (rankEl) {
        var sdInfo = showdownMap[i];
        if (sdInfo && sdInfo.hand) {
          rankEl.textContent = (isWinner ? '★ ' : '') + handTypeLabel(sdInfo.hand.type);
          rankEl.classList.add('is-shown');
        } else {
          rankEl.textContent = '';
          rankEl.classList.remove('is-shown');
        }
      }

      // Restart turn timer arc cleanly on turn change
      var arcEl = seatEl.querySelector('.tx-fs-timer-arc');
      if (arcEl) {
        if (isActive) {
          if (turnChanged || !arcEl.classList.contains('is-running')) {
            arcEl.classList.remove('is-running');
            void arcEl.offsetWidth;
            arcEl.classList.add('is-running');
          }
        } else {
          arcEl.classList.remove('is-running');
        }
      }

      // Opponent hole cards (face-down during play, revealed at showdown)
      if (i !== selfIdx) {
        var oppWrap = document.getElementById('txFsOppCards' + i);
        if (oppWrap) {
          var sdOpp = showdownMap[i];
          if (sdOpp && sdOpp.cards && sdOpp.cards.length > 0) {
            var revKey = 'rev:' + sdOpp.cards.map(function(c) { return c.id; }).join(',');
            if (oppWrap.getAttribute('data-card-key') !== revKey) {
              oppWrap.setAttribute('data-card-key', revKey);
              oppWrap.classList.add('is-revealed');
              var revHtml = '';
              for (var rc = 0; rc < sdOpp.cards.length; rc++) {
                revHtml += '<div class="tx-fs-card-wrap">' + window.CardUI.render(sdOpp.cards[rc], { size: 'sm' }) + '</div>';
              }
              oppWrap.innerHTML = revHtml;
            }
            var revCards = oppWrap.querySelectorAll('.pc-card');
            for (var rci = 0; rci < revCards.length; rci++) {
              applyWinDimClass(revCards[rci], sdOpp.cards[rci] && sdOpp.cards[rci].id, true, winIds);
            }
          } else {
            var cnt = isFolded || isOut ? 0 : (oppCounts[i] || 0);
            var backKey = 'back:' + cnt;
            if (oppWrap.getAttribute('data-card-key') !== backKey) {
              oppWrap.setAttribute('data-card-key', backKey);
              oppWrap.classList.remove('is-revealed');
              var bHtml = '';
              for (var bc = 0; bc < cnt; bc++) {
                bHtml += '<div class="tx-fs-card-wrap">' + window.CardUI.render(null, { size: 'sm', faceDown: true }) + '</div>';
              }
              oppWrap.innerHTML = bHtml;
            }
          }
        }
      }

      // Bet chip pile
      var betEl = document.getElementById('txFsBet' + i);
      var betPileEl = document.getElementById('txFsBetPile' + i);
      var betAmtEl = document.getElementById('txFsBetAmt' + i);
      var bAmt = bets[i] || 0;
      if (betEl && betPileEl && betAmtEl) {
        if (bAmt > 0) {
          betEl.classList.add('is-shown');
          if (betEl.getAttribute('data-amt') !== String(bAmt)) {
            betEl.setAttribute('data-amt', String(bAmt));
            betPileEl.innerHTML = buildChipPileHtml(bAmt);
            betAmtEl.textContent = '$' + bAmt;
          }
        } else {
          betEl.classList.remove('is-shown');
          betEl.removeAttribute('data-amt');
        }
      }
    }

    // My large hole cards
    var holeCards = s.holeCards || (s.hands && s.hands[selfIdx]) || [];
    var holeKey = holeCards.map(function(c) { return c.id; }).join(',');
    var myCardsChanged = holeKey && (!prevSnap || holeKey !== prevSnap.holeKey || s.handNumber !== prevSnap.handNumber);
    for (var hc = 0; hc < 2; hc++) {
      var myWrap = document.getElementById('txFsMyCard' + hc);
      if (!myWrap) continue;
      var cardObj = holeCards[hc];
      if (!cardObj) {
        myWrap.innerHTML = '';
        myWrap.removeAttribute('data-card-id');
      } else {
        if (myWrap.getAttribute('data-card-id') !== cardObj.id) {
          myWrap.setAttribute('data-card-id', cardObj.id);
          myWrap.innerHTML = window.CardUI.render(cardObj, { size: 'lg' });
        }
        applyWinDimClass(myWrap.firstElementChild, cardObj.id, hasShowdown, winIds);
      }
    }

    // Pot & side pots
    var dispPot = displayPotTotal(s);
    var potValEl = document.getElementById('txFsPotVal');
    if (potValEl) {
      if (!skipAnim && prevSnap && dispPot !== prevSnap.displayPot) {
        rollNumber('pot', potValEl, prevSnap.displayPot, dispPot, 600);
      } else if (!_numTweens.pot) {
        potValEl.textContent = String(dispPot);
      }
    }
    var sidePotsEl = document.getElementById('txFsSidePots');
    if (sidePotsEl) {
      var sp = s.sidePots || [];
      if (sp.length > 1) {
        var spHtml = '';
        for (var spi = 0; spi < sp.length; spi++) {
          var lbl = spi === 0 ? _t('tx_main_pot') : _tf('tx_side_pot', spi);
          spHtml += '<span class="tx-fs-sidepot">' + escHtml(lbl) + ' $' + (sp[spi].amount || 0) + '</span>';
        }
        sidePotsEl.innerHTML = spHtml;
      } else {
        sidePotsEl.innerHTML = '';
      }
    }

    // Community cards (5 slots)
    var comm = s.communityCards || [];
    var prevCommCount = prevSnap && s.handNumber === prevSnap.handNumber ? prevSnap.communityIds.length : 0;
    for (var ci = 0; ci < 5; ci++) {
      var slotEl = document.getElementById('txFsComm' + ci);
      if (!slotEl) continue;
      var cObj = comm[ci];
      if (cObj) {
        if (slotEl.getAttribute('data-card-id') !== cObj.id) {
          slotEl.setAttribute('data-card-id', cObj.id);
          slotEl.innerHTML = cardSpan(cObj);
        }
        applyWinDimClass(slotEl.firstElementChild, cObj.id, hasShowdown, winIds);
      } else {
        if (slotEl.getAttribute('data-card-id') !== '__empty') {
          slotEl.setAttribute('data-card-id', '__empty');
          slotEl.innerHTML = cardBackSpan();
        }
      }
    }

    // Right column actions
    renderFsActions(s, selfIdx, winner);

    // Measure & position seats, bets, table before running FLIP/WAAPI animations
    layoutFs();

    if (!skipAnim && prevSnap) {
      var stageEl = document.getElementById('txFsStage');
      var stageRect = stageEl ? stageEl.getBoundingClientRect() : null;

      // 1. Dealing hole cards from dealer button to each seat (220ms, 60ms stagger, max first 8)
      if (s.handNumber !== prevSnap.handNumber || myCardsChanged) {
        var dealerBtn = document.querySelector('#txFsSeats [data-tx-dealer="1"]');
        var dealerRect = dealerBtn ? dealerBtn.getBoundingClientRect() : prevDealerRect;
        if (dealerRect && dealerRect.width > 0) {
          var dealTargets = [];
          var startSeat = Number.isInteger(s.dealer) ? s.dealer : selfIdx;
          for (var pass = 0; pass < 2; pass++) {
            for (var step = 1; step <= n; step++) {
              var sIdx = (startSeat + step) % n;
              if (out[sIdx] || folded[sIdx]) continue;
              var targetEl = sIdx === selfIdx
                ? document.getElementById('txFsMyCard' + pass)
                : (function(oppEl, idx2) {
                    return oppEl ? oppEl.children[idx2] : null;
                  })(document.getElementById('txFsOppCards' + sIdx), pass);
              if (targetEl) dealTargets.push(targetEl);
            }
          }
          for (var di = 0; di < dealTargets.length; di++) {
            var staggerDelay = Math.min(di, 7) * 60;
            animateFlyFrom(dealTargets[di], dealerRect, 220, staggerDelay, EASE_OUT);
          }
        }
      }

      // 2. Community cards flip (300ms; flop 60ms stagger, turn/river single)
      if (s.handNumber === prevSnap.handNumber && comm.length > prevCommCount) {
        for (var fk = prevCommCount; fk < comm.length; fk++) {
          var flipSlot = document.getElementById('txFsComm' + fk);
          if (flipSlot) animateFlipCard(flipSlot, (fk - prevCommCount) * 60);
        }
      }

      // 3. Bets slide from seat to bet spot (260ms)
      if (s.handNumber === prevSnap.handNumber && _fsGeometry) {
        for (var bi = 0; bi < n; bi++) {
          if ((bets[bi] || 0) > (prevSnap.bets[bi] || 0)) {
            var bEl = document.getElementById('txFsBet' + bi);
            var sPt = _fsGeometry.seatPos[bi];
            if (bEl && stageRect && sPt) {
              var seatRect = { left: stageRect.left + sPt.x - 10, top: stageRect.top + sPt.y - 10, width: 20, height: 20 };
              animateFlyFrom(bEl, seatRect, 260, 0, EASE_OUT);
            }
          }
        }
      }

      // 4. End of betting round: bets slide into pot (300ms ease-in-out)
      var roundAdvanced = s.handNumber === prevSnap.handNumber && (s.phase !== prevSnap.phase || (winner != null && prevSnap.winner == null));
      var sweptAnyBet = false;
      if (roundAdvanced && _fsGeometry && prevGeom) {
        for (var si = 0; si < n; si++) {
          if ((prevSnap.bets[si] || 0) > 0 && (bets[si] || 0) === 0) {
            sweptAnyBet = true;
            spawnFlyingChips(prevGeom.betPos[si] || _fsGeometry.betPos[si], _fsGeometry.potPos, prevSnap.bets[si], 300, 0, EASE_INOUT);
          }
        }
      }

      // 5. Winner: pot chips slide to winner (400ms ease-in-out)
      if (winner != null && prevSnap.winner == null && _fsGeometry) {
        var winList = (s.showdownWinners && s.showdownWinners.length) ? s.showdownWinners : [winner];
        var winDelay = sweptAnyBet ? 180 : 0;
        for (var wl = 0; wl < winList.length; wl++) {
          var wSeat = winList[wl];
          if (_fsGeometry.seatPos[wSeat]) {
            spawnFlyingChips(_fsGeometry.potPos, _fsGeometry.seatPos[wSeat], Math.max(20, prevSnap.displayPot || 40), 400, winDelay, EASE_INOUT);
            var wCard = document.querySelector('#txFsSeat' + wSeat + ' .tx-fs-seat-card');
            if (wCard && typeof wCard.animate === 'function' && !isReduced()) {
              wCard.animate([
                { transform: 'scale(1)' },
                { transform: 'scale(1.07)', offset: 0.55 },
                { transform: 'scale(1)' }
              ], { duration: 360, delay: winDelay + 260, easing: EASE_POP });
            }
          }
        }
      }

      // 6. All-in event card (once per player per hand)
      if (s.handNumber === prevSnap.handNumber) {
        for (var ai = 0; ai < n; ai++) {
          if (allIn[ai] && !prevSnap.allIn[ai] && !_allInAnnounced[ai]) {
            _allInAnnounced[ai] = true;
            var aiName = ai === selfIdx ? _t('mp_you') : getPlayerMeta(ai).name;
            showAllInEventCard(aiName);
          }
        }
      }
    }
  }

  function bindGlobalEvents() {
    if (_eventsBound) return;
    _eventsBound = true;
    window.addEventListener('resize', function() {
      if (!_container || !_container.isConnected) return;
      if (isFs()) layoutFs();
    });
    window.addEventListener('gn:fullscreen', function() {
      if (!_container || !_container.isConnected) return;
      if (_raiseOpen) window._txHideRaise();
      _skipNextAnim = true;
      if (_lastState) {
        window.gameRenderers.get('texas').render(_lastState, _container, _lastSelf, _lastWinner);
      }
      requestAnimationFrame(layoutFs);
    });
  }

  window.gameRenderers.set('texas', {
    init: function(container) {
      if (typeof window.injectStylesOnce === 'function') {
        window.injectStylesOnce('txFsStyles', STYLES);
      }
      _lastHoleKey = '';
      _lastCommunityCount = 0;
      _prevAllIn = null;
      _prevHandNo = null;
      _raiseSlider = null;
      _fsRaiseSlider = null;
      _prev = null;
      _allInAnnounced = {};
      _turnKey = '';
      _raiseOpen = false;
      _skipNextAnim = false;
      _lastState = null;
      _lastWinner = null;
      _container = container;
      _lastSeatCount = 0;
      _lastSelfIdx = -1;
      _lastActionSig = '';
      _fsGeometry = null;
      Object.keys(_numTweens).forEach(function(k) { cancelAnimationFrame(_numTweens[k]); });
      _numTweens = {};
      clearEventCard();

      container.innerHTML =
        '<div id="txWrap" style="width:100%;max-width:560px;display:flex;flex-direction:column;gap:10px;font-family:inherit;">' +
          '<div id="txOpponents" style="display:flex;justify-content:space-around;gap:8px;flex-wrap:wrap;"></div>' +
          '<div id="txCommunity" class="ge-felt" style="min-height:80px;border-radius:var(--radius-sm);padding:14px 16px;display:flex;flex-direction:column;align-items:center;gap:8px;">' +
            '<div style="font-size:12px;color:var(--text-muted);">' + _t('tx_community') + '</div>' +
            '<div id="txCommunityCards" style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;"></div>' +
            '<div id="txPot" style="font-size:18px;font-weight:800;color:var(--accent);"></div>' +
            '<div id="txPhase" style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;"></div>' +
          '</div>' +
          '<div id="txHoleCards" style="display:flex;gap:6px;justify-content:center;padding:8px 0;"></div>' +
          '<div id="txChips" style="text-align:center;font-size:14px;font-weight:600;"></div>' +
          '<div id="txActions" style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;"></div>' +
          '<div id="txRaiseInput" style="display:none;flex-direction:column;align-items:stretch;gap:10px;width:100%;">' +
            '<div id="txRaiseSlider"></div>' +
            '<button id="txConfirmRaiseBtn" class="btn btn-sm btn-accent" style="min-height:44px;" onclick="window._txConfirmRaise()">' + _t('tx_confirm_raise') + '</button>' +
          '</div>' +
          '<div id="txShowdown" style="display:none;background:var(--bg);border-radius:var(--radius-sm);padding:12px;"></div>' +
        '</div>' +
        '<div id="txFs">' +
          '<div id="txFsStage">' +
            '<div id="txFsHud"><span id="txFsHudHand"></span><span>·</span><span id="txFsHudPhase"></span></div>' +
            '<div id="txFsTable"></div>' +
            '<div id="txFsCenter">' +
              '<div id="txFsPotArea">' +
                '<div id="txFsPotPill"><span id="txFsPotLabel">' + escHtml(_t('tx_pot_short')) + '</span><span>$<span id="txFsPotVal">0</span></span></div>' +
                '<div id="txFsSidePots"></div>' +
              '</div>' +
              '<div id="txFsCommunity">' +
                '<div class="tx-fs-comm-slot" id="txFsComm0"></div>' +
                '<div class="tx-fs-comm-slot" id="txFsComm1"></div>' +
                '<div class="tx-fs-comm-slot" id="txFsComm2"></div>' +
                '<div class="tx-fs-comm-slot" id="txFsComm3"></div>' +
                '<div class="tx-fs-comm-slot" id="txFsComm4"></div>' +
              '</div>' +
            '</div>' +
            '<div id="txFsBets"></div>' +
            '<div id="txFsSeats"></div>' +
            '<div id="txFsFx"></div>' +
            '<div id="txFsEventHost"></div>' +
          '</div>' +
          '<div id="txFsRight">' +
            '<div id="txFsTurnNote"></div>' +
            '<div id="txFsActions"></div>' +
          '</div>' +
          '<div id="txFsRaisePanel">' +
            '<div id="txFsRaiseSlider"></div>' +
            '<div id="txFsRaiseFooter">' +
              '<button type="button" id="txFsCancelRaiseBtn" aria-label="' + escHtml(_t('cancel')) + '" onclick="window._txHideRaise()">✕</button>' +
              '<button type="button" id="txFsConfirmRaiseBtn" onclick="window._txConfirmRaise()">' + escHtml(_t('tx_confirm_raise')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var stageEl = document.getElementById('txFsStage');
      if (stageEl) {
        stageEl.addEventListener('click', function() {
          if (_raiseOpen) window._txHideRaise();
        });
      }
      bindGlobalEvents();
    },

    render: function(state, container, playerIndex, winner) {
      if (!state) return;
      var s = state;
      _lastState = s;
      _lastSelf = playerIndex;
      _lastWinner = winner;
      _container = container;
      window._txState = s;
      window._txSelf = playerIndex;

      if (isFs()) {
        renderFs(s, playerIndex, winner);
        _prev = cloneSnapshot(s, playerIndex);
        return;
      }

      var curAllIn = s.allIn || [];
      if (_prevAllIn === null || s.handNumber !== _prevHandNo || _prevAllIn.length !== curAllIn.length) {
        _prevAllIn = curAllIn.slice();
        _prevHandNo = s.handNumber;
      } else {
        for (var ai = 0; ai < curAllIn.length; ai++) {
          if (curAllIn[ai] && !_prevAllIn[ai] && window.Motion && window.Motion.announce) {
            var aiWho = ai === playerIndex ? _t('mp_you') : (window.getPlayerName ? window.getPlayerName(ai) : (_t('tx_player') + (ai + 1)));
            window.Motion.announce(_tf('tx_ann_all_in', aiWho), { icon: '🔥', tone: 'warn' });
          }
        }
        _prevAllIn = curAllIn.slice();
      }
      this.renderOpponents(s, playerIndex);
      this.renderCommunity(s);
      this.renderHoleCards(s, playerIndex, winner);
      this.renderChips(s, playerIndex);
      this.renderActions(s, playerIndex, winner);
      if (s.showdownHands && s.showdownHands.length > 0) this.renderShowdown(s, playerIndex);
      else { var sd = document.getElementById('txShowdown'); if (sd) sd.style.display = 'none'; }
      _prev = cloneSnapshot(s, playerIndex);
    },

    renderOpponents: function(s, selfIdx) {
      var el = document.getElementById('txOpponents');
      if (!el) return;
      var html = '';
      var chips = s.chips || [];
      var folded = s.folded || [];
      var allIn = s.allIn || [];
      var bets = s.bets || [];
      var out = s.out || [];

      for (var i = 0; i < chips.length; i++) {
        if (i === selfIdx) continue;
        var name = window.getPlayerName ? window.getPlayerName(i) : (_t('tx_player') + (i + 1));
        var isActive = s.currentPlayer === i;
        var isOut = out[i];
        var isFolded = folded[i] && !isOut;
        var isAllIn = allIn[i];
        var isDealer = s.dealer === i;
        var isBB = s.bigBlind === i;
        var isSB = s.smallBlind === i;

        var statusTag = '';
        if (isOut) statusTag = '<span style="font-size:10px;color:var(--danger);">' + _t('tx_out') + '</span>';
        else if (isFolded) statusTag = '<span style="font-size:10px;color:var(--danger);">' + _t('tx_folded') + '</span>';
        else if (isAllIn) statusTag = '<span style="font-size:10px;color:var(--accent);">ALL IN!</span>';
        else if (isDealer) statusTag = '<span style="font-size:10px;color:var(--text-muted);">' + _t('tx_dealer') + '</span>';

        var blindTag = '';
        if (isBB && !isFolded) blindTag = ' BB';
        if (isSB && !isFolded) blindTag = ' SB';

        html +=
          '<div class="' + (isActive ? 'is-active-turn' : '') + '" style="text-align:center;padding:6px 10px;background:var(--bg);border-radius:12px;' +
          (isActive ? '' : 'border:1px solid var(--border);') +
          (isFolded || isOut ? 'opacity:0.5;' : '') + (isOut ? 'filter:grayscale(1);' : '') + '">' +
          '<div style="font-size:12px;font-weight:600;">' + escHtml(name) + blindTag + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);">$' + (chips[i] || 0) + '</div>' +
          (bets[i] > 0 ? '<div style="font-size:11px;color:var(--accent);font-weight:600;">' + _t('tx_bet') + bets[i] + '</div>' : '') +
          '<div>' + statusTag + '</div>' +
          '</div>';
      }
      el.innerHTML = html;
    },

    renderCommunity: function(s) {
      var el = document.getElementById('txCommunityCards');
      if (!el) return;
      var communityCards = s.communityCards || [];
      var html = '';
      for (var i = 0; i < 5; i++) {
        if (i < communityCards.length) {
          var c = communityCards[i];
          html += cardSpan(c);
        } else {
          html += cardBackSpan();
        }
      }
      el.innerHTML = html;
      // Reveal animation for newly dealt community cards (flop/turn/river)
      if (communityCards.length > _lastCommunityCount && window.Motion) {
        var faces = el.children;
        for (var k = _lastCommunityCount; k < communityCards.length; k++) {
          if (faces[k]) window.Motion.pop(faces[k]);
        }
      }
      _lastCommunityCount = communityCards.length;

      var phaseEl = document.getElementById('txPhase');
      if (phaseEl) phaseEl.textContent = phaseLabel(s.phase);

      var potEl = document.getElementById('txPot');
      if (potEl) potEl.textContent = _t('tx_pot') + (s.pot || 0);
    },

    renderHoleCards: function(s, selfIdx) {
      var el = document.getElementById('txHoleCards');
      if (!el) return;
      var holeCards = s.holeCards || (s.hands && s.hands[selfIdx]) || [];
      if (holeCards.length === 0) { el.innerHTML = ''; return; }

      var key = holeCards.map(function(c) { return c.id; }).join(',');
      var html = '<div style="font-size:12px;color:var(--text-muted);text-align:center;">' + _t('tx_your_hand') + '</div>' + window.CardUI.group(holeCards, { size: 'lg', deal: key !== _lastHoleKey });
      _lastHoleKey = key;
      el.innerHTML = html;
    },

    renderChips: function(s, selfIdx) {
      var el = document.getElementById('txChips');
      if (!el) return;
      var myChips = (s.chips || [])[selfIdx] || 0;
      var myBet = (s.bets || [])[selfIdx] || 0;
      var isAllIn = (s.allIn || [])[selfIdx];
      var isFolded = (s.folded || [])[selfIdx];
      var isOut = (s.out || [])[selfIdx];
      var text = _t('tx_your_chips') + myChips;
      if (myBet > 0) text += _t('tx_bet_appendix') + myBet + ')';
      if (isAllIn) text = 'ALL IN! 💎 ' + _t('tx_all_in_text');
      if (isFolded) text = _t('tx_folded');
      if (isOut) text = _t('tx_you_out');
      if (s.handNumber) text = _t('tx_hand_no').replace('%s', s.handNumber) + ' · ' + text;
      el.textContent = text;
    },

    renderActions: function(s, selfIdx, winner) {
      var el = document.getElementById('txActions');
      if (!el) return;
      var raiseInput = document.getElementById('txRaiseInput');
      var myTurn = s.currentPlayer === selfIdx && winner == null;
      var isFolded = (s.folded || [])[selfIdx];
      var isAllIn = (s.allIn || [])[selfIdx];

      if (!myTurn || isFolded || isAllIn || s.phase === 'showdown') {
        el.innerHTML = '';
        if (raiseInput) raiseInput.style.display = 'none';
        return;
      }

      var chips = (s.chips || [])[selfIdx] || 0;
      var myBet = (s.bets || [])[selfIdx] || 0;
      var toCall = (s.currentBet || 0) - myBet;
      var canCheck = toCall <= 0;
      var raiseCost = minRaiseTo(s, selfIdx) - myBet;
      var canRaise = !s.raiseClosed && chips >= raiseCost;

      var html = '';
      html += '<button class="btn btn-sm btn-outline" onclick="window._txFold()">' + _t('tx_fold') + '</button>';
      if (canCheck) {
        html += '<button class="btn btn-sm btn-primary" onclick="window._txCheck()">' + _t('tx_check') + '</button>';
        if (canRaise) html += '<button class="btn btn-sm btn-accent" onclick="window._txShowRaise()">' + _t('tx_raise') + '</button>';
        if (chips > 0) html += '<button class="btn btn-sm" style="background:var(--danger);color:#fff;" onclick="window._txAllIn()">' + _t('tx_all_in') + '</button>';
      } else {
        if (chips > toCall) {
          html += '<button class="btn btn-sm btn-primary" onclick="window._txCall()">' + _t('tx_call') + toCall + '</button>';
          if (canRaise) html += '<button class="btn btn-sm btn-accent" onclick="window._txShowRaise()">' + _t('tx_raise') + '</button>';
        }
        if (!s.raiseClosed || chips <= toCall) html += '<button class="btn btn-sm" style="background:var(--danger);color:#fff;" onclick="window._txAllIn()">' + _t('tx_all_in') + '</button>';
      }

      el.innerHTML = html;
    },

    renderShowdown: function(s, selfIdx) {
      var el = document.getElementById('txShowdown');
      if (!el || !s.showdownHands) return;
      el.style.display = '';
      var html = '<div style="font-size:14px;font-weight:700;margin-bottom:8px;">' + _t('tx_showdown') + '</div>';
      for (var i = 0; i < s.showdownHands.length; i++) {
        var h = s.showdownHands[i];
        var name = window.getPlayerName ? window.getPlayerName(h.player) : (_t('tx_player') + (h.player + 1));
        var isMe = h.player === selfIdx;
        var handType = handTypeLabel(h.hand.type);
        var isWinner = (s.showdownWinners && s.showdownWinners.length ? s.showdownWinners.indexOf(h.player) >= 0 : s.showdownWinner === h.player);

        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;' + (isWinner ? 'background:#fef9e7;border-radius:8px;padding:8px;' : '') + '">';
        html += '<span style="font-size:13px;font-weight:600;">' + (isMe ? '⭐' : '') + escHtml(name) + '</span>';
        html += '<span style="font-size:11px;color:var(--text-muted);">' + handType + '</span>';
        html += '<div style="display:flex;gap:3px;">';
        for (var j = 0; j < h.cards.length; j++) {
          html += cardSpan(h.cards[j]);
        }
        html += '</div>';
        if (isWinner) html += '<span style="font-size:12px;color:var(--accent);font-weight:700;">' + _t('tx_winner') + '</span>';
        html += '</div>';
      }
      el.innerHTML = html;
    }
  });

  window._txFold = function() { window.makeGameMove({ action: 'fold' }); };
  window._txCheck = function() { window.makeGameMove({ action: 'check' }); };
  window._txCall = function() { window.makeGameMove({ action: 'call' }); };
  window._txAllIn = function() { window.makeGameMove({ action: 'all_in' }); };

  function computeRaiseParams(s, idx) {
    var myChips = (s.chips && s.chips[idx]) || 0;
    var myBet = (s.bets && s.bets[idx]) || 0;
    var curBet = s.currentBet || 0;
    var pot = s.pot || 0;
    var min = minRaiseTo(s, idx);
    var max = myBet + myChips;
    var step = 10;
    var callAmt = Math.max(0, curBet - myBet);
    var halfPot = Math.min(max, Math.max(min, Math.round(curBet + (pot + callAmt) * 0.5)));
    var fullPot = Math.min(max, Math.max(min, Math.round(curBet + pot + callAmt)));
    var presets = [
      { label: _t('ui_half_pot'), value: halfPot },
      { label: _t('ui_pot'), value: fullPot },
      { label: _t('tx_all_in'), value: max }
    ];
    var initVal = Math.min(max, min);
    return { min: min, max: max, step: step, presets: presets, initVal: initVal };
  }

  function syncFsConfirmLabel(val) {
    var btn = document.getElementById('txFsConfirmRaiseBtn');
    if (btn) btn.textContent = _t('tx_raise') + ' $' + val;
  }

  window._txHideRaise = function() {
    _raiseOpen = false;
    var panel = document.getElementById('txFsRaisePanel');
    if (!panel) return;
    if (panel.classList.contains('is-open')) {
      if (typeof panel.animate === 'function' && !isReduced()) {
        var anim = panel.animate([
          { opacity: 1, transform: 'translateX(0)' },
          { opacity: 0, transform: 'translateX(16px)' }
        ], { duration: 140, easing: EASE_OUT });
        anim.onfinish = function() { if (!_raiseOpen) panel.classList.remove('is-open'); };
        anim.oncancel = function() { if (!_raiseOpen) panel.classList.remove('is-open'); };
      } else {
        panel.classList.remove('is-open');
      }
    }
  };

  window._txShowRaise = function() {
    var s = window._txState, idx = window._txSelf;
    if (!s) return;
    var rp = computeRaiseParams(s, idx);

    if (isFs()) {
      var panel = document.getElementById('txFsRaisePanel');
      var fsHost = document.getElementById('txFsRaiseSlider');
      if (!panel || !fsHost) return;
      _raiseOpen = true;
      panel.classList.add('is-open');
      if (_fsRaiseSlider && _fsRaiseSlider.parentNode === fsHost) {
        _fsRaiseSlider.setBounds({ min: rp.min, max: rp.max, step: rp.step, value: rp.initVal, presets: rp.presets });
      } else if (window.GNUI && window.GNUI.sliderSteps) {
        fsHost.innerHTML = '';
        _fsRaiseSlider = window.GNUI.sliderSteps({
          id: 'txFsRaiseAmount',
          label: _t('tx_raise'),
          min: rp.min,
          max: rp.max,
          step: rp.step,
          value: rp.initVal,
          presets: rp.presets,
          onChange: syncFsConfirmLabel
        });
        fsHost.appendChild(_fsRaiseSlider);
      }
      syncFsConfirmLabel(_fsRaiseSlider ? _fsRaiseSlider.getValue() : rp.initVal);
      if (typeof panel.animate === 'function' && !isReduced()) {
        panel.animate([
          { opacity: 0, transform: 'translateX(18px)' },
          { opacity: 1, transform: 'translateX(0)' }
        ], { duration: 200, easing: EASE_OUT });
      }
      return;
    }

    var el = document.getElementById('txRaiseInput');
    if (el) el.style.display = 'flex';
    var host = document.getElementById('txRaiseSlider');
    if (!host) return;
    if (_raiseSlider && _raiseSlider.parentNode === host) {
      _raiseSlider.setBounds({ min: rp.min, max: rp.max, step: rp.step, value: rp.initVal, presets: rp.presets });
    } else if (window.GNUI && window.GNUI.sliderSteps) {
      host.innerHTML = '';
      _raiseSlider = window.GNUI.sliderSteps({
        id: 'txRaiseAmount',
        label: _t('tx_raise'),
        min: rp.min,
        max: rp.max,
        step: rp.step,
        value: rp.initVal,
        presets: rp.presets
      });
      host.appendChild(_raiseSlider);
    }
  };

  window._txConfirmRaise = function() {
    var slider = isFs() ? _fsRaiseSlider : _raiseSlider;
    var amount = slider ? slider.getValue() : 0;
    if (isNaN(amount) || amount <= 0) { showToast(_t('tx_invalid_amount')); return; }
    window.makeGameMove({ action: 'raise', amount: amount });
    var el = document.getElementById('txRaiseInput');
    if (el) el.style.display = 'none';
    if (isFs()) window._txHideRaise();
  };
})();
