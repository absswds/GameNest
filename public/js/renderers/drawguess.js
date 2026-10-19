// public/js/renderers/drawguess.js — 你画我猜 (Gartic Phone 风格)
(function () {
  window.gameRenderers = window.gameRenderers || new Map();

  var canvas, ctx, overlayDiv;
  // Every stroke is stored in one LOGICAL x LOGICAL space and scaled to each screen's canvas, so a picture
  // drawn on a desktop looks the same on a phone. mcp/draw.js uses the same 0-280 space.
  var LOGICAL = 280;
  var canvasSize = 0, canvasW = 0;
  var state, playerIndex;
  var isDrawing = false;
  var activePointer = null;
  var currentStroke = null; // points of the stroke being drawn that are not sent yet; pts[0] = last sent point
  var localStrokes = []; // strokes drawn this turn (for submit); in stage mode a mirror of what the server has
  var strokeSeq = 0;     // g: stroke id, shared by the segments of one stroke so undo removes it whole
  var flushTimer = null;
  var FLUSH_MS = 50;     // stage mode streams the stroke being drawn this often, so guessers watch it live
  var color = '#1a1a1a';
  var lineWidth = 3;
  var isEraser = false;
  var timerInterval = null;
  var revealStep = 0; // which chain step to show in reveal phase

  var COLORS = ['#1a1a1a','#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#ffffff','#95a5a6'];

  var SIDE_W = 220; // side panel width on wide screens
  var MAIN_W = 520;

  function wsSend(data) {
    window.makeGameMove && window.makeGameMove(data);
  }

  function esc(v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pname(i) { return window._players && window._players[i] ? window._players[i].name : (_t('dg_player_fallback') + (i + 1)); }

  var CSS = [
    '.dg-lay{display:flex;justify-content:center;align-items:flex-start;gap:24px;width:100%}',
    '.dg-main{flex:1 1 0;min-width:0}',
    '.dg-side{display:none;width:' + SIDE_W + 'px;flex:none;flex-direction:column;gap:12px;padding-top:8px}',
    '.dg-lay.wide .dg-main{flex:none;width:' + MAIN_W + 'px}',
    '.dg-lay.wide .dg-side{display:flex}',
    '.dg-lay.wide #dg-timer,.dg-lay.wide .dg-hdr{display:none !important}',
    '.dg-card{padding:12px 14px;border-radius:var(--radius-sm);background:var(--bg);font-size:13px}',
    '.dg-label{display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px}',
    '.dg-label span{font-weight:400;white-space:nowrap}',
    '.dg-big{font-size:20px;font-weight:800;color:var(--accent);word-break:break-all}',
    '.dg-sub{margin-top:4px;color:var(--text-muted)}',
    '.dg-word{font-size:22px;font-weight:800;letter-spacing:3px;word-break:break-all}',
    '.dg-srow{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:10px}',
    '.dg-srow + .dg-srow{margin-top:2px}',
    '.dg-srow.me{background:var(--surface);font-weight:600}',
    '.dg-srow .no{width:22px;text-align:center;color:var(--text-muted);font-size:12px;flex:none}',
    '.dg-srow .who{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.dg-srow .tag{font-size:12px;flex:none;color:#5a9e6f;font-weight:700}',
    '.dg-srow b{font-variant-numeric:tabular-nums;font-size:15px;color:var(--accent);flex:none}',
    '.dg-tips{color:var(--text-muted);line-height:1.5}',
    '.dg-choices{display:grid;grid-template-columns:1fr;gap:12px;width:100%;margin-top:14px}',
    '.dg-pick{display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px 12px;border-radius:16px;border:2px solid var(--border);background:linear-gradient(180deg,#fffdf6,#f6efe0);cursor:pointer;box-shadow:0 2px 0 #e3d8c0,0 4px 12px rgba(0,0,0,.06);transition:transform .15s,border-color .15s,box-shadow .15s}',
    '.dg-pick:active{transform:scale(.97)}',
    '.dg-pick b{font-size:26px;font-weight:800;letter-spacing:2px;color:var(--ge-ink,#1c1b19);word-break:break-all}',
    '.dg-pick span{font-size:12px;color:var(--text-muted);padding:2px 10px;border-radius:10px;background:rgba(200,164,92,.16)}',
    '@media (hover:hover){.dg-pick:hover{border-color:#c8a45c;transform:translateY(-3px);box-shadow:0 2px 0 #e3d8c0,0 10px 20px rgba(0,0,0,.12)}}',
    '@media (min-width:560px){.dg-choices{grid-template-columns:repeat(3,1fr)}}',
  ].join('\n');

  // Stage mode only: wrap the screen as <aside left> <main> <aside right>. The asides stay hidden unless there is room.
  // Returns the element the screen should be built in (the container itself outside stage mode).
  function stageLayout(container) {
    container.innerHTML = '';
    if (!state || state.mode !== 'stage') return container;
    window.injectStylesOnce('dg-side-styles', CSS);
    var lay = document.createElement('div');
    lay.className = 'dg-lay';
    lay.innerHTML = '<aside class="dg-side" id="dg-left"></aside><div class="dg-main"></div><aside class="dg-side" id="dg-right"></aside>';
    container.appendChild(lay);
    fitLay(container);
    if (window._dgResize) window.removeEventListener('resize', window._dgResize);
    window._dgResize = function () { fitLay(container); };
    window.addEventListener('resize', window._dgResize);
    updateSides(lay);
    return lay.querySelector('.dg-main');
  }

  function fitLay(container) {
    var lay = container.querySelector('.dg-lay');
    if (!lay) return;
    var fit = window.boardFit ? window.boardFit(container) : { w: window.innerWidth - 32 };
    lay.classList.toggle('wide', fit.w >= MAIN_W + SIDE_W * 2 + 48);
  }

  // Left: round, drawer, word (or its mask), timer. Right: ranking with who drew / guessed.
  function updateSides(lay) {
    var st = state, task = st.myTask;
    var left = lay.querySelector('#dg-left'), right = lay.querySelector('#dg-right');
    var total = (st.scores || []).length;
    var rounds = st.totalRounds || total;
    var isDrawer = playerIndex === st.drawerIndex;
    var word = '';
    if (st.phase === 'playing' && task) {
      var raw = isDrawer ? task.word : task.wordMask;
      var len = Array.from(String(raw || '').replace(/\s+/g, '')).length;
      word = '<div class="dg-card"><div class="dg-label">' + _t(isDrawer ? 'dg_side_word' : 'dg_side_hint') + '<span>' + len + _t('dg_side_chars') + '</span></div>' +
        '<div class="dg-word">' + esc(raw || '') + '</div></div>';
    }
    left.innerHTML =
      '<div class="dg-card"><div class="dg-label">' + _t('dg_side_round') + '</div><div class="dg-big">' + st.round + ' / ' + rounds + '</div>' +
        '<div class="dg-sub">' + _t('dg_side_drawer') + ' ' + esc(pname(st.drawerIndex)) + (isDrawer ? ' (' + _t('dg_side_you') + ')' : '') + '</div></div>' +
      word +
      '<div class="dg-card"><div class="dg-label">' + _t('dg_side_time') + '</div><div class="dg-big" id="dg-side-timer"></div></div>';

    var order = [];
    for (var i = 0; i < total; i++) order.push(i);
    order.sort(function (a, b) { return (st.scores[b] || 0) - (st.scores[a] || 0); });
    var rows = order.map(function (p, k) {
      var tag = p === st.drawerIndex ? '<span class="tag">✏️</span>' : (st.correct && st.correct[p] ? '<span class="tag">✓ ' + _t('dg_side_guessed') + '</span>' : '');
      return '<div class="dg-srow' + (p === playerIndex ? ' me' : '') + '"><span class="no">' + (k + 1) + '</span><span class="who">' + esc(pname(p)) + '</span>' + tag + '<b>' + (st.scores[p] || 0) + '</b></div>';
    }).join('');
    right.innerHTML =
      '<div class="dg-card"><div class="dg-label">' + _t('dg_side_rank') + '<span>' + _t('dg_points_suffix') + '</span></div>' + rows + '</div>' +
      '<div class="dg-card"><div class="dg-label">' + _t('dg_side_tips') + '</div><div class="dg-tips">' + _t(isDrawer ? 'dg_side_tip_draw' : 'dg_side_tip_guess') + '</div></div>';
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
    window.addEventListener('resize', function () { resizeCanvas(); });

    if (window.PointerEvent) {
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
    } else {
      canvas.addEventListener('mousedown', onPointerDown);
      canvas.addEventListener('mousemove', onPointerMove);
      canvas.addEventListener('mouseup', onPointerUp);
      canvas.addEventListener('mouseleave', onPointerUp);
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onPointerUp);
    }
  }

  // Square canvas, as wide as the screen allows. While the guess input has focus the phone keyboard
  // shrinks innerHeight; the canvas keeps its size then instead of jumping smaller and back.
  function resizeCanvas() {
    if (!canvas) return;
    var w = Math.min(window.innerWidth - 16, 500);
    var ae = document.activeElement;
    var typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
    if (!(typing && canvasSize && w === canvasW)) {
      canvasW = w;
      canvasSize = Math.max(280, Math.min(w, window.innerHeight - 220));
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvasSize * dpr); canvas.height = Math.round(canvasSize * dpr);
      canvas.style.width = canvasSize + 'px'; canvas.style.height = canvasSize + 'px';
      var k = dpr * canvasSize / LOGICAL;
      ctx.setTransform(k, 0, 0, k, 0, 0);
    }
    if (state) redrawCanvas();
  }

  function getPos(e) {
    var r = canvas.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - r.left) * (LOGICAL / r.width) * 10) / 10,
      y: Math.round((e.clientY - r.top) * (LOGICAL / r.height) * 10) / 10,
    };
  }

  function onPointerDown(e) {
    if (!isMyDrawTurn() || isDrawing) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerId !== undefined) {
      activePointer = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    }
    if (e.preventDefault && e.cancelable !== false) e.preventDefault();
    isDrawing = true;
    strokeSeq++;
    currentStroke = { color: isEraser ? '#fff' : color, width: isEraser ? 14 : lineWidth, g: strokeSeq, pts: [getPos(e)], sent: false };
  }
  function onPointerMove(e) {
    if (!isDrawing || !currentStroke) return;
    if (activePointer !== null && e.pointerId !== undefined && e.pointerId !== activePointer) return;
    // Coalesced events: the full-rate pointer path even when the page only gets one event per frame
    var evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    if (!evs.length) evs = [e];
    var pts = currentStroke.pts;
    for (var i = 0; i < evs.length; i++) {
      var p = getPos(evs[i]), last = pts[pts.length - 1];
      if (Math.abs(p.x - last.x) + Math.abs(p.y - last.y) < 0.8) continue; // skip sub-pixel jitter
      drawSegment(ctx, last, p, currentStroke);
      pts.push(p);
    }
    if (state && state.mode === 'stage' && !flushTimer && pts.length > 1) flushTimer = setTimeout(flushStroke, FLUSH_MS);
  }
  function onPointerUp(e) {
    if (!isDrawing || !currentStroke) return;
    if (e && activePointer !== null && e.pointerId !== undefined && e.pointerId !== activePointer) return;
    isDrawing = false;
    activePointer = null;
    if (currentStroke.pts.length === 1 && !currentStroke.sent) {
      // A tap: draw a dot (a zero-length line draws nothing)
      var p = currentStroke.pts[0];
      currentStroke.pts.push({ x: p.x + 0.1, y: p.y });
      drawOneStroke(currentStroke);
    }
    flushStroke();
    currentStroke = null;
  }
  // Moves the drawn-but-unsent points into localStrokes as one segment and (stage mode) sends it.
  // The next segment starts at this one's last point so the line stays continuous.
  function flushStroke() {
    clearTimeout(flushTimer);
    flushTimer = null;
    var cs = currentStroke;
    if (!cs || cs.pts.length < 2) return;
    var seg = { color: cs.color, width: cs.width, g: cs.g, pts: cs.pts };
    localStrokes.push(seg);
    if (state && state.mode === 'stage') wsSend({ type: 'stage_stroke', stroke: seg });
    cs.pts = [cs.pts[cs.pts.length - 1]];
    cs.sent = true;
  }
  function onTouchStart(e) { e.preventDefault(); onPointerDown(e.touches[0]); }
  function onTouchMove(e) { e.preventDefault(); onPointerMove(e.touches[0]); }

  function isMyDrawTurn() {
    return state && state.phase === 'playing' && state.myTask && (state.myTask.type === 'draw' || (state.myTask.type === 'stage' && state.myTask.canDraw));
  }

  function maxStrokeId(strokes) {
    var m = 0;
    (strokes || []).forEach(function (s) { if (typeof s.g === 'number' && s.g > m) m = s.g; });
    return m;
  }

  function redrawCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, LOGICAL, LOGICAL);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, LOGICAL, LOGICAL);

    var strokes;
    if (isMyDrawTurn()) {
      strokes = localStrokes;
    } else if (state && state.mode === 'stage' && state.myTask) {
      strokes = state.myTask.strokes || [];
    } else if (state && state.myTask && state.myTask.type === 'draw' && state.phase === 'playing') {
      strokes = localStrokes;
    } else if (state && state.myTask && state.myTask.prevContent) {
      strokes = state.myTask.prevContent;
    } else {
      strokes = [];
    }

    drawStrokes(strokes);
    if (currentStroke) drawOneStroke(currentStroke);
  }

  function drawStrokes(strokes, c) {
    if (!strokes || !strokes.length) return;
    strokes.forEach(function (s) { drawOneStroke(s, c); });
  }

  function drawOneStroke(s, c) {
    c = c || ctx;
    if (!c || !s || !s.pts || s.pts.length < 2) return;
    c.beginPath();
    c.strokeStyle = s.color;
    c.lineWidth = s.width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.moveTo(s.pts[0].x, s.pts[0].y);
    for (var i = 1; i < s.pts.length; i++) c.lineTo(s.pts[i].x, s.pts[i].y);
    c.stroke();
  }

  // While drawing only the newest piece is painted; repainting every stroke on every pointer move is what
  // made long or heavily filled drawings lag
  function drawSegment(c, a, b, style) {
    c.beginPath();
    c.strokeStyle = style.color;
    c.lineWidth = style.width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  }

  // ---- Toolbar ----
  function buildToolbar(wrap) {
    var tb = document.createElement('div');
    tb.id = 'dg-toolbar';
    tb.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;padding:8px 4px;max-width:500px;';
    wrap.appendChild(tb);

    var ON = '#c8a45c', OFF = '#ccc';
    var widthBtns = [], eTb;
    function markTool() {
      widthBtns.forEach(function (b) { b.style.borderColor = !isEraser && b._w === lineWidth ? ON : OFF; });
      if (eTb) eTb.style.borderColor = isEraser ? ON : OFF;
    }

    // Colors
    COLORS.forEach(function (c) {
      var btn = document.createElement('button');
      btn.style.cssText = 'width:26px;height:26px;border-radius:50%;border:2px solid #ccc;background:' + c + ';cursor:pointer;padding:0;flex-shrink:0;';
      btn.onclick = function () {
        color = c; isEraser = false;
        tb.querySelectorAll('.clr-btn').forEach(function (b) { b.style.borderColor = OFF; });
        btn.style.borderColor = ON;
        markTool();
      };
      btn.className = 'clr-btn';
      if (c === color) btn.style.borderColor = ON;
      tb.appendChild(btn);
    });

    // Width (logical units: the biggest is for filling large areas)
    [1.5, 3, 6, 12].forEach(function (w) {
      var btn = document.createElement('button');
      btn._w = w;
      var dot = Math.round(4 + w * 1.5);
      btn.style.cssText = 'width:30px;height:30px;border-radius:6px;border:2px solid #ccc;background:#f8f9fa;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;';
      btn.innerHTML = '<div style="width:' + dot + 'px;height:' + dot + 'px;border-radius:50%;background:#333;"></div>';
      btn.onclick = function () { lineWidth = w; isEraser = false; markTool(); };
      widthBtns.push(btn);
      tb.appendChild(btn);
    });

    // Eraser
    eTb = document.createElement('button');
    eTb.textContent = _t('dg_eraser');
    eTb.style.cssText = 'padding:4px 8px;border-radius:6px;border:2px solid #ccc;background:#f8f9fa;cursor:pointer;font-size:12px;';
    eTb.onclick = function () { isEraser = true; markTool(); };
    tb.appendChild(eTb);
    markTool();

    // Undo: the last whole stroke (stage mode sends a long stroke as several segments with the same g)
    var undoBtn = document.createElement('button');
    undoBtn.textContent = _t('dg_undo');
    undoBtn.style.cssText = 'padding:4px 8px;border-radius:6px;border:1px solid #ccc;background:#f8f9fa;cursor:pointer;font-size:12px;';
    undoBtn.onclick = function () {
      if (isDrawing || !localStrokes.length) return;
      var last = localStrokes.pop();
      if (last.g !== undefined) {
        while (localStrokes.length && localStrokes[localStrokes.length - 1].g === last.g) localStrokes.pop();
      }
      redrawCanvas();
      if (state && state.mode === 'stage') wsSend({ type: 'stage_undo' });
    };
    tb.appendChild(undoBtn);

    // Clear
    var clrBtn = document.createElement('button');
    clrBtn.textContent = _t('dg_clear');
    clrBtn.style.cssText = 'padding:4px 8px;border-radius:6px;border:1px solid #e74c3c;background:#fff5f5;color:#e74c3c;cursor:pointer;font-size:12px;';
    clrBtn.onclick = function () {
      if (isDrawing) return;
      localStrokes = []; redrawCanvas();
      if (state && state.mode === 'stage') wsSend({ type: 'stage_clear' });
    };
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
  // 服务端权威倒计时：读 state.stepDeadline（绝对时间戳，0=不限时）。
  // onExpire: 剩余 ≤1s 时触发一次（自动提交当前内容，抢在服务端 onTimeout 的 2s 缓冲之前）
  function startTimer(container, remainingMs, onExpire) {
    clearInterval(timerInterval);
    var timerEl = document.getElementById('dg-timer');
    if (!timerEl) {
      timerEl = document.createElement('div');
      timerEl.id = 'dg-timer';
      timerEl.style.cssText = 'text-align:center;font-size:14px;color:var(--text-muted);margin-bottom:4px;';
      // Insert before canvas if it's a child of container, else just append
      if (canvas && canvas.parentNode === container) {
        container.insertBefore(timerEl, canvas);
      } else {
        container.appendChild(timerEl);
      }
    }
    function syncSide() {
      var sideEl = document.getElementById('dg-side-timer');
      if (sideEl) { sideEl.textContent = timerEl.textContent; sideEl.style.color = timerEl.style.color; }
    }
    if (!remainingMs || remainingMs <= 0) { timerEl.textContent = _t('dg_no_time_limit'); syncSide(); return; }
    var localDeadline = Date.now() + remainingMs;
    var expired = false;
    function tick() {
      var rem = Math.ceil((localDeadline - Date.now()) / 1000);
      if (rem <= 1 && !expired) {
        expired = true;
        clearInterval(timerInterval);
        timerEl.textContent = _t('dg_time_up');
        syncSide();
        if (onExpire) onExpire();
        return;
      }
      timerEl.textContent = _t('dg_remaining') + rem + _t('dg_seconds');
      timerEl.style.color = rem <= 10 ? '#e74c3c' : 'var(--text-muted)';
      syncSide();
    }
    tick();
    timerInterval = setInterval(tick, 500);
  }

  // ---- Render drawing turn ----
  function renderDrawTurn(container, task) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:8px 8px 0;';
    container.appendChild(wrap);

    var wordLabel = document.createElement('div');
    var wordText = task.word ? (_t('dg_draw_this_word') + task.word) : (_t('dg_draw_from_desc') + task.prevContent + _t('dg_close_quote'));
    wordLabel.textContent = wordText;
    wordLabel.style.cssText = 'font-size:17px;font-weight:700;color:var(--accent);margin-bottom:6px;text-align:center;';
    wrap.appendChild(wordLabel);

    resizeCanvas();
    wrap.appendChild(canvas);
    function doSubmitDraw() {
      if (isDrawing) onPointerUp(); // time ran out mid-stroke: keep it
      wsSend({ type: 'submit', content: localStrokes });
      clearInterval(timerInterval);
      localStrokes = [];
      renderWaiting(container, _t('dg_drawing_submitted'));
    }
    startTimer(wrap, state && state.stepRemainingMs, doSubmitDraw);
    buildToolbar(wrap);

    buildSubmitBtn(wrap, _t('dg_submit_drawing'), function () {
      if (localStrokes.length === 0) { alert(_t('dg_draw_first_alert')); return; }
      doSubmitDraw();
    });
  }

  // Enter while a Chinese/Japanese IME is composing only commits the candidate text: it must not submit
  function isSubmitKey(e) {
    return e.key === 'Enter' && !e.isComposing && e.keyCode !== 229;
  }

  // Plain answer box: no autocorrect/capitalisation rewriting the guess, and a "send" key on phone keyboards
  function setGuessInputAttrs(input) {
    if (!input.setAttribute) return;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('enterkeyhint', 'send');
  }

  // ---- Render guess turn ----
  function renderGuessTurn(container, task) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:8px;';
    container.appendChild(wrap);

    var lbl = document.createElement('div');
    lbl.textContent = _t('dg_guess_instruction');
    lbl.style.cssText = 'font-size:14px;color:var(--text-muted);margin-bottom:6px;';
    wrap.appendChild(lbl);

    startTimer(wrap, state && state.stepRemainingMs, function () {
      var val = (input && input.value.trim()) || _t('dg_timeout_fallback');
      wsSend({ type: 'submit', content: val });
      renderWaiting(container, _t('dg_guess_submitted'));
    });

    // Shows the previous player's drawing (redrawCanvas picks task.prevContent)
    resizeCanvas();
    wrap.appendChild(canvas);

    var inputWrap = document.createElement('div');
    inputWrap.style.cssText = 'display:flex;gap:8px;margin-top:10px;';
    wrap.appendChild(inputWrap);

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = _t('dg_guess_placeholder');
    input.maxLength = 20;
    setGuessInputAttrs(input);
    input.style.cssText = 'flex:1;padding:10px 14px;border-radius:8px;border:1px solid var(--border);font-size:15px;';
    inputWrap.appendChild(input);

    var submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = _t('dg_submit');
    inputWrap.appendChild(submitBtn);

    function doSubmit() {
      var val = input.value.trim();
      if (!val) { input.focus(); return; }
      wsSend({ type: 'submit', content: val });
      clearInterval(timerInterval);
      renderWaiting(container, _t('dg_guess_submitted'));
    }
    submitBtn.onclick = doSubmit;
    input.addEventListener('keydown', function (e) { if (isSubmitKey(e)) doSubmit(); });
    setTimeout(function () { input.focus(); }, 100);
  }

  // ---- Render word choosing (first drawer picks 1 of N) ----
  function renderChooseWord(container, task) {
    var host = stageLayout(container);
    window.injectStylesOnce('dg-side-styles', CSS);
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:30px 16px;max-width:560px;margin:0 auto;';
    host.appendChild(wrap);

    var title = document.createElement('div');
    title.textContent = _t('dg_choose_word_title');
    title.style.cssText = 'font-size:19px;font-weight:800;margin-bottom:6px;';
    wrap.appendChild(title);

    startTimer(wrap, state && state.stepRemainingMs, null);

    var choices = document.createElement('div');
    choices.className = 'dg-choices';
    wrap.appendChild(choices);
    (task.options || []).forEach(function (w, i) {
      var btn = document.createElement('button');
      btn.className = 'dg-pick';
      btn.innerHTML = '<b>' + esc(w) + '</b><span>' + Array.from(String(w)).length + _t('dg_side_chars') + '</span>';
      btn.onclick = function () {
        wsSend({ type: 'choose_word', index: i });
        renderWaiting(container, _t('dg_word_chosen'));
      };
      choices.appendChild(btn);
    });

    var hint = document.createElement('div');
    hint.textContent = _t('dg_auto_select_hint');
    hint.style.cssText = 'margin-top:14px;font-size:12px;color:var(--text-muted);';
    wrap.appendChild(hint);
  }

  // ---- Render waiting ----
  function renderWaiting(container, msg) {
    stageLayout(container).innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-muted);font-size:15px;">' + (msg || _t('dg_waiting_default')) + '</div>';
  }

  // Every stroke / undo / clear / guess broadcasts a full game_state. The stage screen is built once per
  // round and role; later updates within it are patched in place (see updateStage).
  var stageView = null; // { key, lay, wrap, header }

  function stageKey(task) {
    return state.round + ':' + state.drawerIndex + ':' + (task.canDraw ? 'draw' : task.correct ? 'correct' : 'guess');
  }

  function stageHeader(task) {
    var drawer = (window._players && window._players[state.drawerIndex]) ? window._players[state.drawerIndex].name : (_t('dg_player_fallback') + (state.drawerIndex + 1));
    var round = state.round + (state.totalRounds ? '/' + state.totalRounds : '');
    return task.canDraw ? (_t('dg_round_prefix') + round + _t('dg_round_draw') + task.word) : (_t('dg_round_prefix') + round + _t('dg_round_sep') + drawer + _t('dg_is_drawing') + (task.correct ? _t('dg_guessed_correct') : task.wordMask));
  }

  // Same round and role: only strokes, scores and the timer changed. Rebuilding would replace the guess
  // input, which closes the mobile keyboard and breaks IME composition on every stroke the drawer sends.
  // The drawer's own canvas is never replaced by what the server echoes back: those states trail the
  // strokes already on screen, and overwriting localStrokes with them made fresh lines vanish and reappear.
  function updateStage(container, task) {
    if (!stageView || stageView.key !== stageKey(task) || stageView.lay.parentNode !== container) return false;
    stageView.header.textContent = stageHeader(task);
    updateSides(stageView.lay);
    if (!task.canDraw) redrawCanvas();
    startTimer(stageView.wrap, state.stepRemainingMs, null);
    return true;
  }

  // Strokes from game_delta: guessers paint just the new segment on top of the current picture
  function applyStageDelta(d) {
    if (!d || !state || state.mode !== 'stage' || state.phase !== 'playing' || !state.myTask || !stageView) return;
    if (isMyDrawTurn()) return; // the drawer already has these strokes on screen
    var strokes = state.myTask.strokes || (state.myTask.strokes = []);
    if (d.op === 'stroke' && d.stroke) {
      strokes.push(d.stroke);
      drawOneStroke(d.stroke);
    } else if (d.op === 'trim') {
      strokes.length = Math.min(strokes.length, d.n || 0);
      redrawCanvas();
    }
  }

  function renderStage(container, task) {
    var host = stageLayout(container);
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:8px;';
    host.appendChild(wrap);
    var header = document.createElement('div');
    header.className = 'dg-hdr';
    header.style.cssText = 'font-size:16px;font-weight:800;text-align:center;margin-bottom:6px;';
    header.textContent = stageHeader(task);
    wrap.appendChild(header);
    stageView = { key: stageKey(task), lay: host.parentNode, wrap: wrap, header: header };
    clearTimeout(flushTimer); flushTimer = null;
    isDrawing = false; currentStroke = null;
    if (task.canDraw) { localStrokes = (task.strokes || []).slice(); strokeSeq = maxStrokeId(localStrokes); }
    resizeCanvas(); // also paints the current strokes
    wrap.appendChild(canvas);
    startTimer(wrap, state.stepRemainingMs, null);
    if (task.canDraw) { buildToolbar(wrap); return; }
    if (task.correct) return;
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:10px;width:min(100%,500px);'; wrap.appendChild(row);
    var input = document.createElement('input'); input.placeholder = _t('dg_stage_guess_placeholder'); input.maxLength = 20; input.style.cssText = 'flex:1;min-width:0;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:16px;'; row.appendChild(input);
    setGuessInputAttrs(input);
    var btn = document.createElement('button'); btn.className = 'btn btn-primary'; btn.textContent = _t('dg_guess_btn'); btn.style.cssText = 'flex:0 0 auto;width:auto;min-width:72px;padding-left:18px;padding-right:18px;'; row.appendChild(btn);
    function guess() { var text = input.value.trim(); if (!text) return; wsSend({ type: 'stage_guess', text: text }); input.select(); }
    btn.onclick = guess; input.onkeydown = function(e) { if (isSubmitKey(e)) guess(); };
    // Autofocus once per round on desktop only: on touch devices it would pop the keyboard over the canvas
    if (!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) setTimeout(function(){ input.focus(); }, 50);
  }

  function renderStageResult(container, st) {
    clearInterval(timerInterval);
    var host = stageLayout(container);
    var box = document.createElement('div'); box.style.cssText = 'margin:32px auto;padding:24px;max-width:420px;text-align:center;background:#fff9ee;border-radius:16px;font-size:16px;';
    var scores = (st.scores || []).map(function(s, i) { var n = window._players && window._players[i] ? window._players[i].name : (_t('dg_player_fallback') + (i + 1)); return n + ' ' + s + _t('dg_points_suffix'); }).join(' · ');
    box.innerHTML = '<div style="font-size:22px;font-weight:800">' + _t('dg_answer_label') + (st.word || '') + '</div><div style="margin-top:12px;color:var(--text-muted)">' + scores + '</div><div style="margin-top:12px">' + _t('dg_next_round_soon') + '</div>';
    host.appendChild(box);
  }

  // ---- Render reveal ----
  function renderReveal(container, st, players) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:10px;max-width:500px;margin:0 auto;';
    container.appendChild(wrap);

    var title = document.createElement('div');
    title.style.cssText = 'font-size:18px;font-weight:800;margin-bottom:6px;text-align:center;';
    title.textContent = _t('dg_reveal_title');
    wrap.appendChild(title);

    if (st.word) {
      var wordEl = document.createElement('div');
      wordEl.style.cssText = 'font-size:14px;color:var(--text-muted);margin-bottom:12px;';
      wordEl.textContent = _t('dg_original_word') + st.word + _t('dg_close_quote');
      wrap.appendChild(wordEl);
    }

    var chain = st.chain || [];

    // Navigation
    var nav = document.createElement('div');
    nav.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;margin-bottom:10px;width:100%;flex-wrap:nowrap;';
    var prevBtn = document.createElement('button');
    prevBtn.className = 'btn';
    prevBtn.textContent = _t('dg_prev_step');
    prevBtn.style.cssText = 'white-space:nowrap;flex:0 0 132px;width:132px;padding:10px 0;';
    var nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-primary';
    nextBtn.textContent = _t('dg_next_step');
    nextBtn.style.cssText = 'white-space:nowrap;flex:0 0 132px;width:132px;padding:10px 0;';
    var stepLabel = document.createElement('span');
    stepLabel.style.cssText = 'font-size:13px;color:var(--text-muted);white-space:nowrap;flex:0 0 auto;min-width:30px;text-align:center;';
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
      nextBtn.textContent = revealStep === chain.length - 1 ? _t('dg_replay_end') : _t('dg_next_step');
      stepLabel.textContent = (revealStep + 1) + ' / ' + chain.length;

      var step = chain[revealStep];
      var pname = players && players[step.playerIndex] ? players[step.playerIndex].name : (_t('dg_player_fallback') + (step.playerIndex + 1));
      stepArea.innerHTML = '';

      var hdr = document.createElement('div');
      hdr.style.cssText = 'font-size:14px;font-weight:600;margin-bottom:8px;text-align:center;';
      hdr.textContent = pname + ' ' + (step.type === 'draw' ? _t('dg_action_drew') : _t('dg_action_guessed'));
      stepArea.appendChild(hdr);

      if (step.type === 'draw') {
        var c2 = document.createElement('canvas');
        var cW = Math.min(window.innerWidth - 40, 460);
        var dpr2 = window.devicePixelRatio || 1;
        c2.width = Math.round(cW * dpr2);
        c2.height = Math.round(cW * dpr2);
        c2.style.width = cW + 'px'; c2.style.height = cW + 'px';
        c2.style.cssText += 'border-radius:8px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.1);display:block;margin:0 auto;';
        stepArea.appendChild(c2);
        var c2x = c2.getContext('2d');
        var k2 = dpr2 * cW / LOGICAL;
        c2x.setTransform(k2, 0, 0, k2, 0, 0);
        c2x.fillStyle = '#fff'; c2x.fillRect(0, 0, LOGICAL, LOGICAL);
        drawStrokes(step.content || [], c2x);
      } else {
        var guessEl = document.createElement('div');
        guessEl.style.cssText = 'font-size:28px;font-weight:800;text-align:center;padding:30px;background:#f8f9fa;border-radius:12px;letter-spacing:2px;';
        guessEl.textContent = step.content || _t('dg_blank');
        stepArea.appendChild(guessEl);
      }

    }

    prevBtn.onclick = function () { showStep(revealStep - 1); };
    nextBtn.onclick = function () { showStep(revealStep + 1); };
    showStep(revealStep);

    var lastGuess = '';
    for (var gi = chain.length - 1; gi >= 0; gi--) {
      if (chain[gi].type === 'guess' && chain[gi].content) { lastGuess = chain[gi].content; break; }
    }
    var resultEl = document.createElement('div');
    resultEl.style.cssText = 'margin-top:16px;padding:14px 20px;background:#f8f9fa;border-radius:12px;text-align:center;font-size:15px;font-weight:700;color:#5a4a32;';
    resultEl.textContent = _t('dg_original_prefix') + st.word + _t('dg_to_final_guess') + (lastGuess || _t('dg_no_answer')) + _t('dg_close_quote');
    wrap.appendChild(resultEl);

    if (st.transmissionResult) {
      var verdict = document.createElement('div');
      var matched = st.transmissionResult === 'match';
      verdict.style.cssText = 'margin-top:12px;padding:12px;border-radius:12px;text-align:center;font-weight:800;background:' + (matched ? '#ecf9ef' : '#fff5f2') + ';color:' + (matched ? '#23864a' : '#c95f3c') + ';';
      verdict.textContent = matched ? _t('dg_verdict_match') : _t('dg_verdict_drift');
      wrap.appendChild(verdict);
      var matchVotes = st.votes ? Object.values(st.votes).filter(function(v) { return v === 'match'; }).length : 0;
      var driftVotes = st.votes ? Object.values(st.votes).filter(function(v) { return v === 'drift'; }).length : 0;
      var tally = document.createElement('div');
      tally.style.cssText = 'margin-top:8px;font-size:13px;color:var(--text-muted);text-align:center;';
      tally.textContent = _t('dg_match_votes_prefix') + matchVotes + _t('dg_votes_separator') + driftVotes + _t('dg_votes_suffix');
      wrap.appendChild(tally);
      var restartBtn = document.createElement('button');
      restartBtn.className = 'btn btn-primary'; restartBtn.textContent = _t('dg_play_again');
      restartBtn.style.cssText = 'margin-top:14px;white-space:nowrap;';
      restartBtn.onclick = function () { if (window.doRestart) window.doRestart(); };
      wrap.appendChild(restartBtn);
      return;
    }

    var voteBox = document.createElement('div');
    voteBox.style.cssText = 'margin-top:12px;text-align:center;';
    var myVote = st.votes && st.votes[playerIndex];
    var agreeBtn = document.createElement('button');
    var driftBtn = document.createElement('button');
    agreeBtn.className = 'btn'; driftBtn.className = 'btn';
    agreeBtn.textContent = myVote === 'match' ? _t('dg_voted_match') : _t('dg_vote_match');
    driftBtn.textContent = myVote === 'drift' ? _t('dg_voted_drift') : _t('dg_vote_drift');
    agreeBtn.style.cssText = 'margin:0 5px;white-space:nowrap;'; driftBtn.style.cssText = 'margin:0 5px;white-space:nowrap;';
    agreeBtn.onclick = function () { wsSend({ type: 'vote_match', value: 'match' }); };
    driftBtn.onclick = function () { wsSend({ type: 'vote_match', value: 'drift' }); };
    voteBox.appendChild(agreeBtn); voteBox.appendChild(driftBtn);
    var count = st.votes ? Object.keys(st.votes).length : 0;
    var note = document.createElement('div'); note.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:8px;'; note.textContent = _t('dg_vote_prompt') + count + '/' + (players ? players.length : 0) + _t('dg_close_paren'); voteBox.appendChild(note);
    wrap.appendChild(voteBox);
  }

  function normalizeText(v) { return String(v || '').trim().replace(/\s+/g, '').toLowerCase(); }

  function renderWhisperResult(container, st, isFinal) {
    clearInterval(timerInterval);
    container.innerHTML = '';
    var box = document.createElement('div');
    box.style.cssText = 'margin:28px auto;padding:24px;max-width:440px;text-align:center;background:#fff9ee;border-radius:16px;box-shadow:0 4px 18px rgba(115,82,31,.10);';
    var result = st.roundResults || {};
    var starter = result.drawerIndex === undefined ? 0 : result.drawerIndex;
    var starterName = window._players && window._players[starter] ? window._players[starter].name : (_t('dg_player_fallback') + (starter + 1));
    var rows = (st.scores || []).map(function(score, index) {
      var name = window._players && window._players[index] ? window._players[index].name : (_t('dg_player_fallback') + (index + 1));
      return '<div style="display:flex;justify-content:space-between;padding:7px 4px;border-bottom:1px solid rgba(200,164,92,.18);"><span>' + name + '</span><strong>' + score + ' ' + _t('dg_points_suffix') + '</strong></div>';
    }).join('');
    if (isFinal) {
      var winnerName = window._players && window._players[st.winner] ? window._players[st.winner].name : (_t('dg_player_fallback') + ((st.winner || 0) + 1));
      box.innerHTML = '<div style="font-size:24px;font-weight:800">🏆 ' + winnerName + _t('dg_wins') + '</div><div style="margin:8px 0 16px;color:var(--text-muted)">' + _t('dg_final_scores') + '</div>' + rows;
    } else {
      var gained = result.scoreAwarded || 0;
      var matched = st.transmissionResult === 'match';
      var nextIndex = (starter + 1) % (st.scores || [0]).length;
      var nextName = window._players && window._players[nextIndex] ? window._players[nextIndex].name : (_t('dg_player_fallback') + (nextIndex + 1));
      box.innerHTML = '<div style="font-size:21px;font-weight:800">' + _t('dg_round_prefix') + st.round + _t('dg_round_result_suffix') + '</div>' +
        '<div style="margin:10px 0;padding:10px;border-radius:10px;background:' + (matched ? '#ecf9ef' : '#fff5f2') + ';color:' + (matched ? '#23864a' : '#c95f3c') + ';font-weight:700">' +
        (matched ? _t('dg_transmission_match') : _t('dg_transmission_drift')) + ' · ' + starterName + ' +' + gained + ' ' + _t('dg_points_suffix') + '</div>' +
        '<div style="text-align:left;margin-top:10px">' + rows + '</div>' +
        '<div style="margin-top:16px;color:var(--text-muted);font-size:13px">' + _t('dg_next_round_by_prefix') + nextName + _t('dg_next_round_by_suffix') + '</div>';
      startTimer(box, st.stepRemainingMs, null);
    }
    container.appendChild(box);
  }

  // ---- Main render ----
  window.gameRenderers.set('drawguess', {
    init: function (container) {
      setupCanvas(container);
    },

    applyDelta: function (delta) {
      applyStageDelta(delta);
    },

    render: function (st, container, pi, winner) {
      state = st;
      playerIndex = pi;

      if (st.mode === 'stage') {
        if (st.phase === 'choosing') {
          if (st.myTask && st.myTask.type === 'choose') renderChooseWord(container, st.myTask);
          else renderWaiting(container, _t('dg_waiting_drawer_choose'));
        } else if (st.phase === 'playing' && st.myTask) {
          if (!updateStage(container, st.myTask)) renderStage(container, st.myTask);
        } else if (st.phase === 'round_result') {
          renderStageResult(container, st);
        } else if (st.phase === 'gameover') {
          renderStageResult(container, st);
        }
        return;
      }

      if (st.phase === 'round_result') {
        renderWhisperResult(container, st, false);
        return;
      }
      if (st.phase === 'gameover') {
        renderWhisperResult(container, st, true);
        return;
      }

      if (winner !== null && winner !== undefined && st.phase !== 'reveal') {
        renderWaiting(container, _t('dg_game_over'));
        return;
      }

      if (st.phase !== 'reveal') revealStep = 0; // 新一局重置揭示页

      if (st.phase === 'choosing') {
        if (st.myTask && st.myTask.type === 'choose') {
          renderChooseWord(container, st.myTask);
        } else {
          var chooser = st.chain && st.chain[0] ? st.chain[0].playerIndex : 0;
          var cname = (window._players && window._players[chooser]) ? window._players[chooser].name : (_t('dg_player_fallback') + (chooser + 1));
          renderWaiting(container, cname + _t('dg_is_choosing'));
        }
        return;
      }

      if (st.phase === 'playing') {
        var task = st.myTask;
        if (!task) {
          // Show progress while waiting
          var step = st.chain[st.currentStep] || {};
          var stepNum = (st.currentStep || 0) + 1;
          var total = st.chain ? st.chain.length : '?';
          renderWaiting(container, _t('dg_round_prefix') + stepNum + ' / ' + total + _t('dg_step_in_progress'));
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
