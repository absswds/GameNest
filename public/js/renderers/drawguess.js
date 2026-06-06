// public/js/renderers/drawguess.js — 你画我猜 (Gartic Phone 风格)
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var canvas, ctx, overlayDiv;
  var W, H;
  var state, playerIndex;
  var isDrawing = false;
  var currentStroke = null;
  var localStrokes = []; // strokes drawn this turn (for submit)
  var color = '#1a1a1a';
  var lineWidth = 4;
  var isEraser = false;
  var timerInterval = null;
  var revealStep = 0; // which chain step to show in reveal phase

  var COLORS = ['#1a1a1a','#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#ffffff','#95a5a6'];

  function wsSend(data) {
    window._ws && window._ws.send(JSON.stringify({ type: 'game_move', data: data }));
  }

  function setupCanvas(container) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;height:100%;overflow:hidden;';
    container.appendChild(wrap);

    // Overlay for waiting/info messages
    overlayDiv = document.createElement('div');
    overlayDiv.id = 'dg-overlay';
    overlayDiv.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100;display:flex;align-items:center;justify-content:center;';
    container.appendChild(overlayDiv);

    canvas = document.createElement('canvas');
    canvas.style.cssText = 'touch-action:none;cursor:crosshair;border-radius:8px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.1);';
    wrap.appendChild(canvas);
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mouse events
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    // Touch events
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onPointerUp);
  }

  function resizeCanvas() {
    if (!canvas) return;
    W = Math.min(window.innerWidth - 16, 500);
    H = Math.min(window.innerHeight - 220, W);
    W = Math.max(W, 280); H = Math.max(H, 280);
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    if (state) redrawCanvas();
  }

  function getPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }

  function onPointerDown(e) {
    if (!isMyDrawTurn()) return;
    isDrawing = true;
    var pt = getPos(e);
    currentStroke = { color: isEraser ? '#fff' : color, width: isEraser ? 20 : lineWidth, pts: [pt] };
  }
  function onPointerMove(e) {
    if (!isDrawing || !currentStroke) return;
    currentStroke.pts.push(getPos(e));
    redrawCanvas();
  }
  function onPointerUp() {
    if (!isDrawing || !currentStroke) return;
    isDrawing = false;
    if (currentStroke.pts.length > 1) localStrokes.push(currentStroke);
    currentStroke = null;
    redrawCanvas();
  }
  function onTouchStart(e) { e.preventDefault(); onPointerDown(e.touches[0]); }
  function onTouchMove(e) { e.preventDefault(); onPointerMove(e.touches[0]); }

  function isMyDrawTurn() {
    return state && state.phase === 'playing' && state.myTask && state.myTask.type === 'draw';
  }

  function redrawCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    var strokes = state && state.myTask && state.myTask.type === 'draw' && state.phase === 'playing'
      ? localStrokes
      : (state && state.myTask && state.myTask.prevContent ? state.myTask.prevContent : []);

    drawStrokes(strokes);
    if (currentStroke) drawOneStroke(currentStroke);
  }

  function drawStrokes(strokes) {
    if (!strokes || !strokes.length) return;
    strokes.forEach(s => drawOneStroke(s));
  }

  function drawOneStroke(s) {
    if (!s.pts || s.pts.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(s.pts[0].x, s.pts[0].y);
    for (var i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
    ctx.stroke();
  }

  // ---- Toolbar ----
  function buildToolbar(wrap) {
    var tb = document.createElement('div');
    tb.id = 'dg-toolbar';
    tb.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;padding:8px 4px;max-width:500px;';
    wrap.appendChild(tb);

    // Colors
    COLORS.forEach(function (c) {
      var btn = document.createElement('button');
      btn.style.cssText = 'width:26px;height:26px;border-radius:50%;border:2px solid #ccc;background:' + c + ';cursor:pointer;padding:0;flex-shrink:0;';
      btn.onclick = function () {
        color = c; isEraser = false;
        tb.querySelectorAll('.clr-btn').forEach(b => b.style.borderColor = '#ccc');
        btn.style.borderColor = '#c8a45c';
      };
      btn.className = 'clr-btn';
      if (c === '#1a1a1a') btn.style.borderColor = '#c8a45c';
      tb.appendChild(btn);
    });

    // Width
    [2, 5, 10].forEach(function (w) {
      var btn = document.createElement('button');
      btn.style.cssText = 'width:28px;height:28px;border-radius:4px;border:1px solid #ccc;background:#f8f9fa;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
      btn.innerHTML = '<div style="width:' + (w * 2) + 'px;height:' + (w * 2) + 'px;border-radius:50%;background:#333;"></div>';
      btn.onclick = function () { lineWidth = w; isEraser = false; };
      tb.appendChild(btn);
    });

    // Eraser
    var eTb = document.createElement('button');
    eTb.textContent = '橡皮';
    eTb.style.cssText = 'padding:4px 8px;border-radius:4px;border:1px solid #ccc;background:#f8f9fa;cursor:pointer;font-size:12px;';
    eTb.onclick = function () { isEraser = true; };
    tb.appendChild(eTb);

    // Clear
    var clrBtn = document.createElement('button');
    clrBtn.textContent = '清空';
    clrBtn.style.cssText = 'padding:4px 8px;border-radius:4px;border:1px solid #e74c3c;background:#fff5f5;color:#e74c3c;cursor:pointer;font-size:12px;';
    clrBtn.onclick = function () { localStrokes = []; redrawCanvas(); };
    tb.appendChild(clrBtn);

    return tb;
  }

  // ---- Submit button ----
  function buildSubmitBtn(wrap, label, onSubmit) {
    var btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = label;
    btn.style.cssText = 'margin-top:10px;min-width:120px;';
    btn.onclick = onSubmit;
    wrap.appendChild(btn);
    return btn;
  }

  // ---- Timer ----
  function startTimer(container, seconds) {
    clearInterval(timerInterval);
    var timerEl = document.getElementById('dg-timer');
    if (!timerEl) {
      timerEl = document.createElement('div');
      timerEl.id = 'dg-timer';
      timerEl.style.cssText = 'text-align:center;font-size:14px;color:var(--text-muted);margin-bottom:4px;';
      container.insertBefore(timerEl, canvas);
    }
    var end = Date.now() + seconds * 1000;
    timerInterval = setInterval(function () {
      var rem = Math.ceil((end - Date.now()) / 1000);
      if (rem <= 0) { clearInterval(timerInterval); timerEl.textContent = '时间到！'; return; }
      timerEl.textContent = '剩余 ' + rem + ' 秒';
      timerEl.style.color = rem <= 10 ? '#e74c3c' : 'var(--text-muted)';
    }, 500);
  }

  // ---- Render drawing turn ----
  function renderDrawTurn(container, task) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:8px 8px 0;';
    container.appendChild(wrap);

    var wordLabel = document.createElement('div');
    var wordText = task.word ? ('画这个词：' + task.word) : ('根据这段描述画画：「' + task.prevContent + '」');
    wordLabel.textContent = wordText;
    wordLabel.style.cssText = 'font-size:17px;font-weight:700;color:var(--accent);margin-bottom:6px;text-align:center;';
    wrap.appendChild(wordLabel);

    startTimer(wrap, 90);

    resizeCanvas();
    wrap.appendChild(canvas);
    buildToolbar(wrap);

    buildSubmitBtn(wrap, '提交画作 ✓', function () {
      if (localStrokes.length === 0) { alert('请先画一下再提交'); return; }
      wsSend({ type: 'submit', content: localStrokes });
      clearInterval(timerInterval);
      localStrokes = [];
      renderWaiting(container, '画作已提交，等待其他玩家…');
    });
  }

  // ---- Render guess turn ----
  function renderGuessTurn(container, task) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:8px;';
    container.appendChild(wrap);

    var lbl = document.createElement('div');
    lbl.textContent = '看图猜词（上一位玩家的画）:';
    lbl.style.cssText = 'font-size:14px;color:var(--text-muted);margin-bottom:6px;';
    wrap.appendChild(lbl);

    startTimer(wrap, 45);

    // Draw the previous strokes on canvas
    resizeCanvas();
    // Draw the previous content (strokes array)
    var prevStrokes = task.prevContent || [];
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    drawStrokes(prevStrokes);
    wrap.appendChild(canvas);

    var inputWrap = document.createElement('div');
    inputWrap.style.cssText = 'display:flex;gap:8px;margin-top:10px;';
    wrap.appendChild(inputWrap);

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '你猜这是什么？';
    input.maxLength = 20;
    input.style.cssText = 'flex:1;padding:10px 14px;border-radius:8px;border:1px solid var(--border);font-size:15px;';
    inputWrap.appendChild(input);

    var submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = '提交';
    inputWrap.appendChild(submitBtn);

    function doSubmit() {
      var val = input.value.trim();
      if (!val) { input.focus(); return; }
      wsSend({ type: 'submit', content: val });
      clearInterval(timerInterval);
      renderWaiting(container, '猜词已提交，等待其他玩家…');
    }
    submitBtn.onclick = doSubmit;
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSubmit(); });
    setTimeout(function () { input.focus(); }, 100);
  }

  // ---- Render waiting ----
  function renderWaiting(container, msg) {
    container.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-muted);font-size:15px;">' + (msg || '等待其他玩家完成当前步骤…') + '</div>';
  }

  // ---- Render reveal ----
  function renderReveal(container, st, players) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:10px;max-width:500px;margin:0 auto;';
    container.appendChild(wrap);

    var title = document.createElement('div');
    title.style.cssText = 'font-size:18px;font-weight:800;margin-bottom:6px;text-align:center;';
    title.textContent = '📺 揭示传话链';
    wrap.appendChild(title);

    if (st.word) {
      var wordEl = document.createElement('div');
      wordEl.style.cssText = 'font-size:14px;color:var(--text-muted);margin-bottom:12px;';
      wordEl.textContent = '原始词语：「' + st.word + '」';
      wrap.appendChild(wordEl);
    }

    var chain = st.chain || [];

    // Navigation
    var nav = document.createElement('div');
    nav.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:10px;';
    var prevBtn = document.createElement('button');
    prevBtn.className = 'btn';
    prevBtn.textContent = '← 上一步';
    var nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-primary';
    nextBtn.textContent = '下一步 →';
    var stepLabel = document.createElement('span');
    stepLabel.style.cssText = 'font-size:13px;color:var(--text-muted);';
    nav.appendChild(prevBtn);
    nav.appendChild(stepLabel);
    nav.appendChild(nextBtn);
    wrap.appendChild(nav);

    // Step display area
    var stepArea = document.createElement('div');
    stepArea.style.cssText = 'width:100%;';
    wrap.appendChild(stepArea);

    function showStep(idx) {
      revealStep = Math.max(0, Math.min(idx, chain.length - 1));
      prevBtn.disabled = revealStep === 0;
      nextBtn.disabled = revealStep === chain.length - 1;
      stepLabel.textContent = (revealStep + 1) + ' / ' + chain.length;

      var step = chain[revealStep];
      var pname = players && players[step.playerIndex] ? players[step.playerIndex].name : ('玩家' + (step.playerIndex + 1));
      stepArea.innerHTML = '';

      var hdr = document.createElement('div');
      hdr.style.cssText = 'font-size:14px;font-weight:600;margin-bottom:8px;text-align:center;';
      hdr.textContent = pname + ' ' + (step.type === 'draw' ? '画了：' : '猜的词：');
      stepArea.appendChild(hdr);

      if (step.type === 'draw') {
        var c2 = document.createElement('canvas');
        var cW = Math.min(window.innerWidth - 40, 460);
        var cH = Math.round(cW * 0.75);
        c2.width = cW * (window.devicePixelRatio || 1);
        c2.height = cH * (window.devicePixelRatio || 1);
        c2.style.width = cW + 'px'; c2.style.height = cH + 'px';
        c2.style.cssText += 'border-radius:8px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.1);display:block;margin:0 auto;';
        stepArea.appendChild(c2);
        var c2x = c2.getContext('2d');
        c2x.setTransform(1, 0, 0, 1, 0, 0);
        c2x.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        c2x.fillStyle = '#fff'; c2x.fillRect(0, 0, cW, cH);
        // Scale strokes to canvas size (original drawn at W×H)
        var sx = cW / (W || cW), sy = cH / (H || cH);
        (step.content || []).forEach(function (s) {
          if (!s.pts || s.pts.length < 2) return;
          c2x.beginPath();
          c2x.strokeStyle = s.color; c2x.lineWidth = s.width * sx; c2x.lineCap = 'round'; c2x.lineJoin = 'round';
          c2x.moveTo(s.pts[0].x * sx, s.pts[0].y * sy);
          for (var i = 1; i < s.pts.length; i++) c2x.lineTo(s.pts[i].x * sx, s.pts[i].y * sy);
          c2x.stroke();
        });
      } else {
        var guessEl = document.createElement('div');
        guessEl.style.cssText = 'font-size:28px;font-weight:800;text-align:center;padding:30px;background:#f8f9fa;border-radius:12px;letter-spacing:2px;';
        guessEl.textContent = step.content || '（空白）';
        stepArea.appendChild(guessEl);
      }

      // Vote button
      if (!st.winner) {
        var myVote = st.votes && st.votes[playerIndex];
        var voteBtn = document.createElement('button');
        voteBtn.style.cssText = 'display:block;margin:12px auto 0;padding:8px 20px;border-radius:20px;border:2px solid ' + (myVote === revealStep ? '#c8a45c' : '#ccc') + ';background:' + (myVote === revealStep ? '#fff9ee' : '#fff') + ';cursor:pointer;font-size:13px;';
        voteBtn.textContent = myVote === revealStep ? '✓ 已投票此步' : '👍 投票为最有趣的一步';
        voteBtn.onclick = function () { wsSend({ type: 'vote', stepIndex: revealStep }); };
        stepArea.appendChild(voteBtn);

        var voteInfo = document.createElement('div');
        voteInfo.style.cssText = 'text-align:center;font-size:12px;color:var(--text-muted);margin-top:6px;';
        var vc = 0;
        if (st.votes) Object.values(st.votes).forEach(function (v) { if (v === revealStep) vc++; });
        voteInfo.textContent = vc + ' 票';
        stepArea.appendChild(voteInfo);
      }
    }

    prevBtn.onclick = function () { showStep(revealStep - 1); };
    nextBtn.onclick = function () { showStep(revealStep + 1); };
    showStep(revealStep);

    // Winner banner
    if (st.winner !== null && st.winner !== undefined) {
      var wEl = document.createElement('div');
      wEl.style.cssText = 'margin-top:16px;padding:12px 20px;background:#fff9ee;border-radius:12px;text-align:center;font-size:14px;font-weight:600;color:#c8a45c;';
      var wname = players && players[st.winner] ? players[st.winner].name : ('玩家' + (st.winner + 1));
      wEl.textContent = '🏆 最有趣的一步属于：' + wname;
      wrap.appendChild(wEl);
    }
  }

  // ---- Main render ----
  window.gameRenderers.set('drawguess', {
    init: function (container) {
      setupCanvas(container);
    },

    render: function (st, container, pi, winner) {
      state = st;
      playerIndex = pi;

      if (winner !== null && winner !== undefined && st.phase !== 'reveal') {
        renderWaiting(container, '游戏结束！');
        return;
      }

      if (st.phase === 'playing') {
        var task = st.myTask;
        if (!task) {
          // Show progress while waiting
          var step = st.chain[st.currentStep] || {};
          var stepNum = (st.currentStep || 0) + 1;
          var total = st.chain ? st.chain.length : '?';
          renderWaiting(container, '第 ' + stepNum + ' / ' + total + ' 步进行中，请等待轮到你…');
        } else if (task.type === 'draw') {
          var alreadyDrawing = container.querySelector('#dg-toolbar');
          if (!alreadyDrawing) {
            localStrokes = [];
            renderDrawTurn(container, task);
          }
        } else {
          var alreadyGuessing = container.querySelector('input');
          if (!alreadyGuessing) renderGuessTurn(container, task);
        }
      } else if (st.phase === 'reveal') {
        clearInterval(timerInterval);
        renderReveal(container, st, window._players || []);
      }
    },
  });
})();
