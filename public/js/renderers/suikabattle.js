// public/js/renderers/suikabattle.js — 合成大西瓜对战版 (Matter.js 物理)
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var FRUITS = [
    { name: '樱桃', color: '#E74C3C', r: 18, emoji: '🍒', pts: 1 },
    { name: '草莓', color: '#FF4E6A', r: 24, emoji: '🍓', pts: 3 },
    { name: '葡萄', color: '#9B59B6', r: 30, emoji: '🍇', pts: 6 },
    { name: '橘子', color: '#F39C12', r: 37, emoji: '🍊', pts: 10 },
    { name: '柠檬', color: '#F1C40F', r: 44, emoji: '🍋', pts: 15 },
    { name: '猕猴桃', color: '#27AE60', r: 52, emoji: '🥝', pts: 21 },
    { name: '番茄', color: '#C0392B', r: 60, emoji: '🍅', pts: 28 },
    { name: '桃子', color: '#FFA07A', r: 68, emoji: '🍑', pts: 36 },
    { name: '菠萝', color: '#F1C40F', r: 78, emoji: '🍍', pts: 45 },
    { name: '椰子', color: '#8B6914', r: 88, emoji: '🥥', pts: 55 },
    { name: '西瓜', color: '#2ECC71', r: 100, emoji: '🍉', pts: 66 },
  ];

  var BOX_W = 320, BOX_H = 480;
  var SCALE = 1;
  var canvas, ctx, engine, world, Matter;
  var walls = { left: null, right: null, bottom: null };
  var fruits = []; // [{body, type, merged}]
  var dropping = false;
  var dropX = BOX_W / 2;
  var dropFruitType = 0;
  var nextFruitType = 0;
  var particles = []; // merge particles
  var state, playerIndex;
  var gameOver = false;
  var initialized = false;
  var aimLineX = BOX_W / 2;
  var DANGER_Y = 60; // overflow line

  function wsSend(data) {
    window.sendMove && window.sendMove(data);
  }

  function waitForMatter(cb) {
    if (window.Matter) { cb(window.Matter); return; }
    var script = document.createElement('script');
    script.src = 'https://unpkg.com/matter-js@0.19.0/build/matter.min.js';
    script.onload = function () { cb(window.Matter); };
    document.head.appendChild(script);
  }

  function initPhysics(M) {
    Matter = M;
    engine = Matter.Engine.create({ gravity: { y: 1.5 } });
    world = engine.world;

    var wallOpts = { isStatic: true, restitution: 0.3, friction: 0.5 };
    walls.left = Matter.Bodies.rectangle(-10, BOX_H / 2, 20, BOX_H, wallOpts);
    walls.right = Matter.Bodies.rectangle(BOX_W + 10, BOX_H / 2, 20, BOX_H, wallOpts);
    walls.bottom = Matter.Bodies.rectangle(BOX_W / 2, BOX_H + 10, BOX_W, 20, wallOpts);
    Matter.World.add(world, [walls.left, walls.right, walls.bottom]);

    // Merge detection
    Matter.Events.on(engine, 'collisionStart', function (ev) {
      ev.pairs.forEach(function (pair) {
        var a = getFruit(pair.bodyA.id);
        var b = getFruit(pair.bodyB.id);
        if (!a || !b || a.merged || b.merged) return;
        if (a.type !== b.type) return;
        if (a.type >= FRUITS.length - 1) return; // max size

        a.merged = true;
        b.merged = true;
        var newType = a.type + 1;
        var mx = (a.body.position.x + b.body.position.x) / 2;
        var my = (a.body.position.y + b.body.position.y) / 2;

        // Add particles
        for (var i = 0; i < 8; i++) {
          var angle = (i / 8) * Math.PI * 2;
          particles.push({ x: mx, y: my, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3 - 2, life: 1, color: FRUITS[newType].color, r: 5 });
        }

        // Remove old fruits, add merged
        setTimeout(function () {
          removeFruit(a);
          removeFruit(b);
          addFruit(mx, my, newType);
          wsSend({ type: 'merge', fruitType: newType });
        }, 0);
      });
    });
  }

  function getFruit(bodyId) {
    return fruits.find(function (f) { return f.body.id === bodyId; });
  }

  function removeFruit(f) {
    Matter.World.remove(world, f.body);
    fruits.splice(fruits.indexOf(f), 1);
  }

  function addFruit(x, y, type) {
    var info = FRUITS[type];
    var body = Matter.Bodies.circle(x, y, info.r, {
      restitution: 0.3,
      friction: 0.5,
      frictionAir: 0.01,
      label: 'fruit',
    });
    Matter.World.add(world, body);
    fruits.push({ body: body, type: type, merged: false });
    return body;
  }

  function drop(x) {
    if (dropping || gameOver) return;
    dropping = true;
    addFruit(x, DANGER_Y - FRUITS[dropFruitType].r - 5, dropFruitType);
    wsSend({ type: 'drop' });
    dropFruitType = nextFruitType;

    // Allow next drop after 500ms
    setTimeout(function () { dropping = false; }, 600);
  }

  function checkOverflow() {
    for (var i = 0; i < fruits.length; i++) {
      var f = fruits[i];
      if (f.body.position.y - FRUITS[f.type].r < DANGER_Y - 10 && Math.abs(f.body.velocity.y) < 0.5) {
        return true;
      }
    }
    return false;
  }

  function drawFrame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    var cW = BOX_W * SCALE, cH = BOX_H * SCALE;
    var ox = (canvas.width / (window.devicePixelRatio || 1) - cW) / 2;
    var oy = 0;

    // Box background
    ctx.fillStyle = '#FFF8F0';
    ctx.fillRect(ox, oy, cW, cH);
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, cW, cH);

    // Danger line
    ctx.strokeStyle = 'rgba(231,76,60,0.6)'; ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(ox, oy + DANGER_Y * SCALE); ctx.lineTo(ox + cW, oy + DANGER_Y * SCALE); ctx.stroke();
    ctx.setLineDash([]);

    // Aim line
    if (!dropping && !gameOver) {
      ctx.strokeStyle = 'rgba(200,164,92,0.5)'; ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(ox + aimLineX * SCALE, oy); ctx.lineTo(ox + aimLineX * SCALE, oy + cH); ctx.stroke();
      ctx.setLineDash([]);
      // Next fruit preview at top
      var info = FRUITS[dropFruitType];
      ctx.save();
      ctx.font = Math.max(12, info.r * SCALE * 1.2) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(info.emoji, ox + aimLineX * SCALE, oy + (DANGER_Y / 2) * SCALE);
      ctx.restore();
    }

    // Fruits
    fruits.forEach(function (f) {
      if (f.merged) return;
      var info = FRUITS[f.type];
      var fx = ox + f.body.position.x * SCALE;
      var fy = oy + f.body.position.y * SCALE;
      var fr = info.r * SCALE;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.beginPath(); ctx.arc(fx + 2, fy + 2, fr, 0, Math.PI * 2); ctx.fill();

      // Gradient fill
      var grad = ctx.createRadialGradient(fx - fr * 0.3, fy - fr * 0.3, fr * 0.1, fx, fy, fr);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.4, info.color);
      grad.addColorStop(1, info.color);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.stroke();

      // Emoji
      if (fr > 12) {
        ctx.font = Math.max(10, fr * 1.1) + 'px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(info.emoji, fx, fy);
      }
    });

    // Particles
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.06;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(ox + p.x * SCALE, oy + p.y * SCALE, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(ox, oy, cW, cH);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('出局！', ox + cW / 2, oy + cH / 2);
    }
  }

  var rafId;
  var overflowTimer = 0;
  function loop() {
    if (!engine) return;
    Matter.Engine.update(engine, 1000 / 60);
    drawFrame();

    // Overflow detection with grace period
    if (!gameOver && checkOverflow()) {
      overflowTimer++;
      if (overflowTimer > 120) { // ~2 seconds of overflow
        gameOver = true;
        wsSend({ type: 'gameover' });
      }
    } else {
      overflowTimer = 0;
    }

    rafId = requestAnimationFrame(loop);
  }

  window.gameRenderers.set('suikabattle', {
    init: function (container) {
      container.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:6px;';
      container.appendChild(wrap);

      // Opponent bar
      var oppBar = document.createElement('div');
      oppBar.id = 'suika-opp';
      oppBar.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap;justify-content:center;font-size:12px;';
      wrap.appendChild(oppBar);

      // Score + next fruit info
      var infoBar = document.createElement('div');
      infoBar.id = 'suika-info';
      infoBar.style.cssText = 'display:flex;gap:16px;align-items:center;margin-bottom:6px;font-size:13px;';
      wrap.appendChild(infoBar);

      canvas = document.createElement('canvas');
      canvas.style.cssText = 'touch-action:none;cursor:crosshair;border-radius:6px;';
      wrap.appendChild(canvas);
      ctx = canvas.getContext('2d');

      // Resize
      var dpr = window.devicePixelRatio || 1;
      SCALE = Math.min((window.innerWidth - 20) / BOX_W, (window.innerHeight - 160) / BOX_H, 1.2);
      SCALE = Math.max(SCALE, 0.6);
      canvas.width = BOX_W * SCALE * dpr;
      canvas.height = BOX_H * SCALE * dpr;
      canvas.style.width = BOX_W * SCALE + 'px';
      canvas.style.height = BOX_H * SCALE + 'px';
      ctx.scale(dpr, dpr);

      // Input handlers
      function handleInput(cx) {
        var ox = (BOX_W * SCALE - BOX_W * SCALE) / 2;
        aimLineX = Math.max(FRUITS[dropFruitType].r + 2, Math.min(cx / SCALE, BOX_W - FRUITS[dropFruitType].r - 2));
      }
      canvas.addEventListener('mousemove', function (e) {
        var r = canvas.getBoundingClientRect();
        handleInput(e.clientX - r.left);
      });
      canvas.addEventListener('touchmove', function (e) {
        e.preventDefault();
        var r = canvas.getBoundingClientRect();
        handleInput(e.touches[0].clientX - r.left);
      }, { passive: false });
      canvas.addEventListener('click', function (e) {
        var r = canvas.getBoundingClientRect();
        handleInput(e.clientX - r.left);
        drop(aimLineX);
      });
      canvas.addEventListener('touchend', function (e) {
        e.preventDefault();
        drop(aimLineX);
      });

      waitForMatter(function (M) {
        initPhysics(M);
        initialized = true;
        loop();
      });
    },

    render: function (st, container, pi, winner) {
      state = st;
      playerIndex = pi;

      if (!initialized) return;

      // Update next fruit from server state
      if (st.next && st.next[pi] !== undefined) {
        nextFruitType = st.next[pi];
      }

      // Info bar
      var infoBar = document.getElementById('suika-info');
      if (infoBar) {
        var nextInfo = FRUITS[nextFruitType];
        infoBar.innerHTML = '<span>分数: <b>' + (st.scores && st.scores[pi] || 0) + '</b></span>' +
          '<span>下一个: ' + nextInfo.emoji + ' ' + nextInfo.name + '</span>';
      }

      // Opponent bar
      var oppBar = document.getElementById('suika-opp');
      if (oppBar) {
        oppBar.innerHTML = '';
        var players = window._players || [];
        for (var i = 0; i < (st._playerCount || 0); i++) {
          if (i === pi) continue;
          var pname = players[i] ? players[i].name : ('玩家' + (i + 1));
          var elim = st.eliminated && st.eliminated[i];
          var chip = document.createElement('div');
          chip.style.cssText = 'padding:3px 10px;border-radius:12px;background:' + (elim ? '#fee' : '#f0f9f0') + ';border:1px solid ' + (elim ? '#fcc' : '#c0e0c0') + ';';
          chip.textContent = pname + ': ' + (elim ? '❌' : (st.scores && st.scores[i] || 0) + '分');
          oppBar.appendChild(chip);
        }
      }

      // Check win/loss
      if (winner !== null && winner !== undefined && !gameOver) {
        if (winner === pi) {
          // Show win overlay
        }
      }
      if (st.eliminated && st.eliminated[pi] && !gameOver) {
        gameOver = true;
      }
    },
  });
})();
