// Flight Chess v11 — stacking + pickup/move animations
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  // Player colors: red, green, blue, yellow
  var CO  = ['#e63535','#22b06b','#3a7ee0','#e8b81c'];
  var COL = ['#fbe4e4','#dff5ec','#e2edfb','#faf2cf']; // light base panel bg
  var COD = ['#b71f1f','#177a48','#1d5bb0','#b08810']; // dark accent

  var SZ=15, PP=4;
  // Main track: 52 cells. Player p enters at index p*13. Cell color = index % 4.
  var TK=[
    [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
    [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
    [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[6,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
    [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0]
  ];
  // Home stretch: 6 cells each, from arm edge inward to center (matches travel direction)
  var HM=[
    [7,1],[7,2],[7,3],[7,4],[7,5],[7,6],       // p0 red  — left arm → center
    [13,7],[12,7],[11,7],[10,7],[9,7],[8,7],    // p1 green — bottom arm → center
    [7,13],[7,12],[7,11],[7,10],[7,9],[7,8],    // p2 blue  — right arm → center
    [1,7],[2,7],[3,7],[4,7],[5,7],[6,7]         // p3 yellow— top arm → center
  ];
  var BS=[{r:0,c:9},{r:9,c:9},{r:9,c:0},{r:0,c:0}]; // base corners: red,green,blue,yellow
  var LAUNCH=[0,13,26,39];          // launch cell index of each player (own color)
  var FLY_STEP=8, FLY_ADV=24;       // must match games/flightchess.js
  var HOME_ARROW=['▶','▲','◀','▼'];

  var cvs,ctx,W,cnt;

  function cellSize(){return W/SZ;}
  function gp(gx,gy){var cs=cellSize();return{x:gx*cs+cs/2,y:gy*cs+cs/2};}
  function rr(x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
  function tile(gx,gy,color){var cs=cellSize(),g=cs*.07;ctx.fillStyle=color;ctx.beginPath();rr(gx*cs+g,gy*cs+g,cs-2*g,cs-2*g,cs*.24);ctx.fill();}

  // ---- Animation state ----
  var animState = {
    running: false,
    rafId: null,
    type: 'none',     // 'none' | 'pickup' | 'move'
    startTime: 0,
    // Pickup
    pickupPli: -1, pickupPlane: -1,
    pickupScale: 1.0,
    pickupX: 0, pickupY: 0,
    // Move
    movePli: -1, movePlane: -1,
    moveFromX: 0, moveFromY: 0,
    moveToX: 0, moveToY: 0,
    moveProgress: 0,
  };

  // Previous plane positions for opponent move detection
  var prevPlanes = null; // [{planes: [4]}, ...]

  function startAnimLoop() {
    if (animState.running) return;
    animState.running = true;
    animState.startTime = performance.now();
    animTick();
  }

  function stopAnimLoop() {
    animState.running = false;
    animState.type = 'none';
    if (animState.rafId) {
      cancelAnimationFrame(animState.rafId);
      animState.rafId = null;
    }
  }

  function animTick(now) {
    if (!animState.running) return;
    now = now || performance.now();
    var elapsed = now - animState.startTime;

    if (animState.type === 'pickup') {
      var t = Math.min(elapsed / 150, 1.0);
      t = 1 - Math.pow(1 - t, 3); // ease-out cubic
      animState.pickupScale = 1.0 + 0.2 * t;
      if (t >= 1.0) {
        animState.pickupScale = 1.2;
        animState.running = false;
      }
    } else if (animState.type === 'move') {
      var t2 = Math.min(elapsed / 300, 1.0);
      t2 = t2 < 0.5 ? 2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 2) / 2; // ease-in-out quad
      animState.moveProgress = t2;
      if (t2 >= 1.0) {
        animState.moveProgress = 1.0;
        animState.type = 'none';
        animState.running = false;
      }
    }

    // Re-render during animation
    var s = window._fcSt;
    if (s) {
      doRender(s, parseInt(sessionStorage.getItem('playerIndex')), s.winner);
    }

    if (animState.running) {
      animState.rafId = requestAnimationFrame(animTick);
    } else {
      animState.rafId = null;
    }
  }

  // ---- Get pixel position for a plane ----
  function getPlanePos(pli, i, pos) {
    var cs = cellSize();
    if (pos === -1) {
      var bc2 = BS[pli];
      return { x: bc2.c * cs + 6 * cs * (.22 + (i % 2) * .56),
               y: bc2.r * cs + 6 * cs * (.22 + (i < 2 ? 0 : .56)) };
    } else if (pos >= 58) {
      var bc3 = BS[pli];
      return { x: bc3.c * cs + 3 * cs, y: bc3.r * cs + 3 * cs };
    } else if (pos >= 52) {
      var hi2 = pos - 52;
      var hc2 = hi2 < 6 ? HM[pli * 6 + hi2] : [7, 7];
      var hp2 = gp(hc2[0], hc2[1]);
      return { x: hp2.x, y: hp2.y };
    } else {
      var ab = (pli * 13 + pos) % 52;
      var tp = gp(TK[ab][0], TK[ab][1]);
      return { x: tp.x, y: tp.y };
    }
  }

  // ---- Main render (called from both render() and animTick) ----
  function doRender(s, pi, wr) {
    if (!cvs) return;
    ctx.clearRect(0, 0, W, W);
    window._fcHb = [];
    var cs = cellSize();

    // === Background ===
    ctx.fillStyle = '#1a2540'; ctx.fillRect(0, 0, W, W);

    // === Track cells ===
    TK.forEach(function(tc, i) {
      tile(tc[0], tc[1], CO[i % 4]);
    });

    // === Launch cells ===
    LAUNCH.forEach(function(li, p) {
      var pt = gp(TK[li][0], TK[li][1]);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = (cs * .55) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✈', pt.x, pt.y);
    });

    // === Fly-across paths ===
    for (var p = 0; p < 4; p++) {
      var fromAbs = (p * 13 + FLY_STEP) % 52, toAbs = (p * 13 + FLY_STEP + FLY_ADV) % 52;
      var a = gp(TK[fromAbs][0], TK[fromAbs][1]), b = gp(TK[toAbs][0], TK[toAbs][1]);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = cs * .16;
      ctx.setLineDash([cs * .26, cs * .2]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = CO[p]; ctx.lineWidth = cs * .09;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      var ang = Math.atan2(b.y - a.y, b.x - a.x), ah = cs * .34;
      ctx.fillStyle = CO[p];
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - ah * Math.cos(ang - 0.4), b.y - ah * Math.sin(ang - 0.4));
      ctx.lineTo(b.x - ah * Math.cos(ang + 0.4), b.y - ah * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(a.x, a.y, cs * .32, 0, 6.28); ctx.fill();
      ctx.strokeStyle = CO[p]; ctx.lineWidth = cs * .08; ctx.beginPath(); ctx.arc(a.x, a.y, cs * .32, 0, 6.28); ctx.stroke();
      ctx.fillStyle = CO[p]; ctx.font = 'bold ' + (cs * .4) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✈', a.x, a.y);
    }

    // === Home stretch cells ===
    for (var p2 = 0; p2 < 4; p2++) {
      for (var h = 0; h < 6; h++) {
        var hc = HM[p2 * 6 + h]; tile(hc[0], hc[1], CO[p2]);
        if (h === 0) {
          var pt2 = gp(hc[0], hc[1]);
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold ' + (cs * .44) + 'px system-ui';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(HOME_ARROW[p2], pt2.x, pt2.y);
        }
      }
    }

    // === Bases ===
    BS.forEach(function(bc, bi) {
      var bx = bc.c * cs, by = bc.r * cs, bw = 6 * cs, bh = 6 * cs, g = cs * .12;
      ctx.fillStyle = COL[bi];
      ctx.beginPath(); rr(bx + g, by + g, bw - 2 * g, bh - 2 * g, cs * .55); ctx.fill();
      ctx.strokeStyle = CO[bi]; ctx.lineWidth = cs * .1;
      ctx.beginPath(); rr(bx + g, by + g, bw - 2 * g, bh - 2 * g, cs * .55); ctx.stroke();
      for (var si = 0; si < 4; si++) {
        var sx = bx + bw * (.22 + (si % 2) * .56), sy = by + bh * (.22 + (si < 2 ? 0 : .56));
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(sx, sy, cs * .4, 0, 6.28); ctx.fill();
        ctx.strokeStyle = CO[bi]; ctx.lineWidth = cs * .06; ctx.beginPath(); ctx.arc(sx, sy, cs * .4, 0, 6.28); ctx.stroke();
      }
    });

    // === Center triangles + hub ===
    var ccx = 7.5 * cs, ccy = 7.5 * cs, reach = cs * 1.5;
    var corners = [{x: ccx + reach, y: ccy - reach}, {x: ccx + reach, y: ccy + reach}, {x: ccx - reach, y: ccy + reach}, {x: ccx - reach, y: ccy - reach}];
    var triEdges = [[0, 1], [1, 2], [2, 3], [3, 0]];
    for (var t = 0; t < 4; t++) {
      var e = triEdges[t]; ctx.fillStyle = CO[t];
      ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(corners[e[0]].x, corners[e[0]].y); ctx.lineTo(corners[e[1]].x, corners[e[1]].y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ccx, ccy, cs * .34, 0, 6.28); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ccx, ccy, cs * .34, 0, 6.28); ctx.stroke();

    // === Build position occupancy map for stacking ===
    var pR = cs * .4;
    var posMap = {}; // key: "x,y" → [{pli, idx, pos, x, y}]

    for (var pli = 0; pli < s._playerCount; pli++) {
      var pd = s.players[pli]; if (!pd) continue;
      for (var i = 0; i < PP; i++) {
        var pos = pd.planes[i];
        // Skip the plane being animated (drawn in overlay)
        if (animState.type === 'pickup' && pli === animState.pickupPli && i === animState.pickupPlane) continue;
        if (animState.type === 'move' && pli === animState.movePli && i === animState.movePlane) continue;

        var pp = getPlanePos(pli, i, pos);
        var key = Math.round(pp.x) + ',' + Math.round(pp.y);
        if (!posMap[key]) posMap[key] = [];
        posMap[key].push({ pli: pli, idx: i, pos: pos, x: pp.x, y: pp.y });
      }
    }

    // === Draw planes with stacking offsets ===
    for (var key in posMap) {
      if (!posMap.hasOwnProperty(key)) continue;
      var stack = posMap[key];

      for (var si = 0; si < stack.length; si++) {
        var p = stack[si];
        // Compute stacking offset: stagger diagonally for N>1
        var offX = 0, offY = 0;
        if (stack.length > 1) {
          offX = (si - (stack.length - 1) / 2) * pR * 0.55;
          offY = (si - (stack.length - 1) / 2) * pR * 0.55;
        }
        var ppX = p.x + offX;
        var ppY = p.y + offY;

        // Plane shadow
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.arc(ppX + 2.5, ppY + 3.5, pR, 0, 6.28); ctx.fill();

        // Plane body radial gradient
        var pgr = ctx.createRadialGradient(ppX - pR * .3, ppY - pR * .3, pR * .05, ppX, ppY, pR);
        pgr.addColorStop(0, '#fff'); pgr.addColorStop(0.5, CO[p.pli]); pgr.addColorStop(1, COD[p.pli]);
        ctx.fillStyle = pgr; ctx.strokeStyle = '#fff'; ctx.lineWidth = cs * .05;
        ctx.beginPath(); ctx.arc(ppX, ppY, pR, 0, 6.28); ctx.fill(); ctx.stroke();

        // Plane emoji
        ctx.fillStyle = '#fff'; ctx.font = (pR * .95) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✈', ppX, ppY);

        // Selection ring (for movable pieces)
        if (p.pli === parseInt(sessionStorage.getItem('playerIndex')) &&
            s.hasRolled && s.currentPlayer === p.pli && p.pos !== 58) {
          ctx.strokeStyle = '#ffe24d'; ctx.lineWidth = cs * .08; ctx.setLineDash([cs * .16, cs * .1]);
          ctx.beginPath(); ctx.arc(ppX, ppY, pR + cs * .14, 0, 6.28); ctx.stroke(); ctx.setLineDash([]);
          window._fcHb.push({x: ppX, y: ppY, r: pR + cs * .14, pi: p.pli, idx: p.idx});
        }
      }
    }

    // === Animation overlay: picked-up plane ===
    if (animState.type === 'pickup') {
      var pickupPos = s.players[animState.pickupPli] && s.players[animState.pickupPli].planes[animState.pickupPlane];
      if (typeof pickupPos === 'number') {
        var ap = getPlanePos(animState.pickupPli, animState.pickupPlane, pickupPos);
        var ascale = animState.pickupScale;
        var ar = pR * ascale;
        var ashadowOff = 2.5 + 6 * (ascale - 1);

        // Enhanced shadow for lifted piece
        ctx.fillStyle = 'rgba(0,0,0,' + (0.28 + (ascale - 1) * 0.8) + ')';
        ctx.beginPath(); ctx.arc(ap.x + ashadowOff, ap.y + ashadowOff + 2, ar, 0, 6.28); ctx.fill();

        // Lifted body
        var agr = ctx.createRadialGradient(ap.x - ar * .3, ap.y - ar * .4, ar * .05, ap.x, ap.y, ar);
        agr.addColorStop(0, '#ffffff'); agr.addColorStop(0.5, CO[animState.pickupPli]); agr.addColorStop(1, COD[animState.pickupPli]);
        ctx.fillStyle = agr; ctx.strokeStyle = '#fff'; ctx.lineWidth = cs * .05;
        ctx.beginPath(); ctx.arc(ap.x, ap.y, ar, 0, 6.28); ctx.fill(); ctx.stroke();

        // Lifted emoji (slightly larger)
        ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (ar * .95) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✈', ap.x, ap.y);

        // Golden glow ring for lifted piece
        var glowR = ar + cs * .14;
        var glow = ctx.createRadialGradient(ap.x, ap.y, ar * 0.7, ap.x, ap.y, glowR);
        glow.addColorStop(0, 'rgba(255,215,0,0.5)'); glow.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(ap.x, ap.y, glowR, 0, 6.28); ctx.fill();
        ctx.strokeStyle = '#f0c040'; ctx.lineWidth = cs * .08; ctx.setLineDash([cs * .12, cs * .08]);
        ctx.beginPath(); ctx.arc(ap.x, ap.y, glowR, 0, 6.28); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // === Animation overlay: moving plane ===
    if (animState.type === 'move') {
      var progress = animState.moveProgress;
      var mx = animState.moveFromX + (animState.moveToX - animState.moveFromX) * progress;
      var my = animState.moveFromY + (animState.moveToY - animState.moveFromY) * progress;
      // Slight arc
      var arcOff = Math.sin(progress * Math.PI) * cs * 0.22;
      my -= arcOff;
      var mScale = 1.0 + 0.06 * Math.sin(progress * Math.PI);
      var mr = pR * mScale;
      var mShadowOff = 3 + 3 * Math.sin(progress * Math.PI);

      ctx.fillStyle = 'rgba(0,0,0,' + (0.28 + 0.1 * Math.sin(progress * Math.PI)) + ')';
      ctx.beginPath(); ctx.arc(mx + mShadowOff, my + mShadowOff + 2, mr, 0, 6.28); ctx.fill();

      var mgr = ctx.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .05, mx, my, mr);
      mgr.addColorStop(0, '#ffffff'); mgr.addColorStop(0.5, CO[animState.movePli]); mgr.addColorStop(1, COD[animState.movePli]);
      ctx.fillStyle = mgr; ctx.strokeStyle = '#fff'; ctx.lineWidth = cs * .05;
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.28); ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (mr * .95) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✈', mx, my);

      // Trail dots behind during move
      if (progress > 0.1 && progress < 0.9) {
        for (var dot = 1; dot <= 2; dot++) {
          var dt = Math.max(0, progress - 0.06 * dot);
          var dtx = animState.moveFromX + (animState.moveToX - animState.moveFromX) * dt;
          var dty = animState.moveFromY + (animState.moveToY - animState.moveFromY) * dt;
          dty -= Math.sin(dt * Math.PI) * cs * 0.22;
          ctx.fillStyle = 'rgba(255,255,255,' + (0.3 - 0.1 * dot) + ')';
          ctx.beginPath(); ctx.arc(dtx, dty, mr * 0.4, 0, 6.28); ctx.fill();
        }
      }
    }

    // === DICE display ===
    var diceEl = document.getElementById('fcDice');
    if (diceEl) {
      var dv = s.dice;
      if (s.hasRolled && dv) {
        var who = s.currentPlayer, wc = CO[who] || '#333';
        var wn = (window.gamePlayers && window.gamePlayers[who]) ? window.gamePlayers[who].name : '玩家' + (who + 1);
        diceEl.innerHTML = dieBox(dv, wc) + '<span style="font-size:18px;font-weight:800;color:' + wc + ';">' + wn + ' 掷出 ' + dv + ' 点</span>';
      } else if (dv) {
        diceEl.innerHTML = dieBox(dv, '#888') + '<span style="font-size:16px;font-weight:700;color:#888;">上一手 ' + dv + ' 点</span>';
      } else {
        diceEl.innerHTML = '<span style="font-size:40px;opacity:.25;">🎲</span>';
      }
    }

    // === Info & button ===
    var info = document.getElementById('fcInfo'), btn = document.getElementById('fcRollBtn');
    var my = s.currentPlayer === pi && s.winner == null;
    if (info) {
      var turnTxt;
      if (s.winner != null) turnTxt = s.winner === pi ? '🏆 你赢了！' : '😢 你输了';
      else if (my) turnTxt = s.hasRolled ? '点击发光的 ✈ 走棋' : '轮到你掷骰子';
      else { var ci = window.gamePlayers && window.gamePlayers[s.currentPlayer]; var nm2 = ci ? ci.name : '对手'; turnTxt = s.hasRolled ? '🕐 ' + nm2 + ' 正在走棋…' : '🕐 等待 ' + nm2 + ' 掷骰'; }
      var lr = s.lastMoveResult || '';
      var special = /飞到对面|跳|踩/.test(lr);
      info.innerHTML = turnTxt + (special ? '<br><span style="color:#c8a45c;font-weight:800;">' + lr + '</span>' : '');
    }
    if (btn) btn.style.display = (my && !s.hasRolled && s.winner == null) ? '' : 'none';
  }

  // ---- Renderer registration ----

  window.gameRenderers.set('flightchess', {
    init: function(container) {
      cnt = container;
      container.innerHTML =
        '<div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:10px;">' +
        '<canvas id="fcCanvas" style="display:block;border-radius:16px;touch-action:manipulation;cursor:pointer;box-shadow:0 6px 28px rgba(0,0,0,.18);"></canvas>' +
        '<div id="fcDice" style="display:flex;align-items:center;justify-content:center;gap:12px;min-height:60px;"></div>' +
        '<div id="fcInfo" style="font-size:15px;color:#666;font-weight:600;text-align:center;min-height:22px;"></div>' +
        '<button id="fcRollBtn" class="btn btn-accent" style="font-size:17px;padding:13px 48px;border-radius:30px;">🎲 掷骰子</button>' +
        '</div>';
      cvs = document.getElementById('fcCanvas'); ctx = cvs.getContext('2d');

      // Reset animation state on init (e.g. game restart)
      stopAnimLoop();
      prevPlanes = null;

      var rs = function() {
        var avW = window.innerWidth - (window.innerWidth > 600 ? 80 : 28);
        var avH = window.innerHeight - 260;
        var pw = Math.min(avW, avH, 920);
        pw = Math.max(pw, 260);
        var dpr = window.devicePixelRatio || 1; W = pw;
        cvs.width = pw * dpr; cvs.height = pw * dpr;
        cvs.style.width = pw + 'px'; cvs.style.height = pw + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr);
        if (window._fcSt) {
          doRender(window._fcSt, parseInt(sessionStorage.getItem('playerIndex')), window._fcSt.winner);
        }
      };
      rs(); window.addEventListener('resize', rs);

      document.getElementById('fcRollBtn').addEventListener('click', function() {
        var s = window._fcSt; if (!s) return;
        var pi = parseInt(sessionStorage.getItem('playerIndex'));
        if (s.currentPlayer === pi && !s.hasRolled && s.winner == null) window.makeGameMove({ action: 'roll' });
      });

      cvs.addEventListener('click', function(e) {
        var s = window._fcSt; if (!s || s.winner != null) return;
        var pi = parseInt(sessionStorage.getItem('playerIndex'));
        if (s.currentPlayer !== pi || !s.hasRolled) return;
        // Don't allow clicking during animation
        if (animState.running) return;
        var rect = cvs.getBoundingClientRect(), mx = (e.clientX - rect.left) * W / rect.width, my = (e.clientY - rect.top) * W / rect.height;
        var hits = window._fcHb || [];
        for (var i = hits.length - 1; i >= 0; i--) {
          var h = hits[i];
          if (Math.abs(mx - h.x) < h.r + 8 && Math.abs(my - h.y) < h.r + 8 && h.pi === pi) {
            // Start pickup animation, then send move after a short delay
            stopAnimLoop();
            animState.type = 'pickup';
            animState.pickupPli = h.pi;
            animState.pickupPlane = h.idx;
            animState.pickupScale = 1.0;
            animState.pickupX = h.x;
            animState.pickupY = h.y;
            startAnimLoop();

            setTimeout(function() {
              window.makeGameMove({ action: 'move', planeIndex: h.idx });
            }, 120);
            return;
          }
        }
      });
    },

    render: function(s, container, pi, wr) {
      window._fcSt = s; window._fcCnt = container;
      if (!cvs) return;

      // Detect opponent plane movement for animation
      if (!animState.running && prevPlanes && s.players) {
        for (var pli = 0; pli < s._playerCount; pli++) {
          if (!s.players[pli] || !prevPlanes[pli]) continue;
          for (var i = 0; i < PP; i++) {
            var oldPos = prevPlanes[pli][i];
            var newPos = s.players[pli].planes[i];
            if (oldPos !== newPos && oldPos !== undefined && newPos !== undefined) {
              var fromP = getPlanePos(pli, i, oldPos);
              var toP = getPlanePos(pli, i, newPos);
              stopAnimLoop();
              animState.type = 'move';
              animState.movePli = pli;
              animState.movePlane = i;
              animState.moveFromX = fromP.x; animState.moveFromY = fromP.y;
              animState.moveToX = toP.x; animState.moveToY = toP.y;
              animState.moveProgress = 0;
              startAnimLoop();
              break;
            }
          }
          if (animState.running) break;
        }
      }

      // Save current plane positions for next comparison
      if (s.players) {
        prevPlanes = [];
        for (var pj = 0; pj < s._playerCount; pj++) {
          prevPlanes[pj] = s.players[pj] ? s.players[pj].planes.slice() : [];
        }
      }

      // If animation is running, animTick handles the re-render
      if (animState.running) return;

      doRender(s, pi, wr);
    }
  });

  // Die face box
  function dieBox(n, color) {
    return '<span style="display:inline-flex;width:54px;height:54px;border-radius:13px;background:#fff;' +
      'border:3px solid ' + color + ';align-items:center;justify-content:center;' +
      'font-size:32px;font-weight:900;color:' + color + ';box-shadow:0 3px 10px rgba(0,0,0,.15);">' + n + '</span>';
  }
})();
