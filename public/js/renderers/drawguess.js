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
    window.makeGameMove && window.makeGameMove(data);
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
    if (currentStroke.pts.length > 1) {
      localStrokes.push(currentStroke);
      if (state && state.mode === 'stage') wsSend({ type: 'stage_stroke', stroke: currentStroke });
    }
    currentStroke = null;
    redrawCanvas();
  }
  function onTouchStart(e) { e.preventDefault(); onPointerDown(e.touches[0]); }
  function onTouchMove(e) { e.preventDefault(); onPointerMove(e.touches[0]); }

  function isMyDrawTurn() {
    return state && state.phase === 'playing' && state.myTask && (state.myTask.type === 'draw' || (state.myTask.type === 'stage' && state.myTask.canDraw));
  }

  function redrawCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

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
    eTb.textContent = _t('dg_eraser');
    eTb.style.cssText = 'padding:4px 8px;border-radius:4px;border:1px solid #ccc;background:#f8f9fa;cursor:pointer;font-size:12px;';
    eTb.onclick = function () { isEraser = true; };
    tb.appendChild(eTb);

    // Clear
    var clrBtn = document.createElement('button');
    clrBtn.textContent = _t('dg_clear');
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
    if (!remainingMs || remainingMs <= 0) { timerEl.textContent = _t('dg_no_time_limit'); return; }
    var localDeadline = Date.now() + remainingMs;
    var expired = false;
    function tick() {
      var rem = Math.ceil((localDeadline - Date.now()) / 1000);
      if (rem <= 1 && !expired) {
        expired = true;
        clearInterval(timerInterval);
        timerEl.textContent = _t('dg_time_up');
        if (onExpire) onExpire();
        return;
      }
      timerEl.textContent = _t('dg_remaining') + rem + _t('dg_seconds');
      timerEl.style.color = rem <= 10 ? '#e74c3c' : 'var(--text-muted)';
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
    var wordText = task.word ? (_t('dg_draw_this_word') + task.word) : (_t('dg_draw_from_desc') + task.prevContent + '」');
    wordLabel.textContent = wordText;
    wordLabel.style.cssText = 'font-size:17px;font-weight:700;color:var(--accent);margin-bottom:6px;text-align:center;';
    wrap.appendChild(wordLabel);

    resizeCanvas();
    wrap.appendChild(canvas);
    function doSubmitDraw() {
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
    input.placeholder = _t('dg_guess_placeholder');
    input.maxLength = 20;
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
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSubmit(); });
    setTimeout(function () { input.focus(); }, 100);
  }

  // ---- Render word choosing (first drawer picks 1 of N) ----
  function renderChooseWord(container, task) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:30px 16px;max-width:420px;margin:0 auto;';
    container.appendChild(wrap);

    var title = document.createElement('div');
    title.textContent = _t('dg_choose_word_title');
    title.style.cssText = 'font-size:19px;font-weight:800;margin-bottom:6px;';
    wrap.appendChild(title);

    startTimer(wrap, state && state.stepRemainingMs, null);

    (task.options || []).forEach(function (w, i) {
      var btn = document.createElement('button');
      btn.textContent = w;
      btn.style.cssText = 'width:100%;margin-top:12px;padding:16px;border-radius:14px;border:2px solid var(--border);background:#fff;font-size:18px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.06);';
      btn.onmouseenter = function () { btn.style.borderColor = '#c8a45c'; };
      btn.onmouseleave = function () { btn.style.borderColor = 'var(--border)'; };
      btn.onclick = function () {
        wsSend({ type: 'choose_word', index: i });
        renderWaiting(container, _t('dg_word_chosen'));
      };
      wrap.appendChild(btn);
    });

    var hint = document.createElement('div');
    hint.textContent = _t('dg_auto_select_hint');
    hint.style.cssText = 'margin-top:14px;font-size:12px;color:var(--text-muted);';
    wrap.appendChild(hint);
  }

  // ---- Render waiting ----
  function renderWaiting(container, msg) {
    container.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-muted);font-size:15px;">' + (msg || _t('dg_waiting_default')) + '</div>';
  }

  function renderStage(container, task) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:8px;';
    container.appendChild(wrap);
    var header = document.createElement('div');
    var drawer = (window._players && window._players[state.drawerIndex]) ? window._players[state.drawerIndex].name : (_t('dg_player_fallback') + (state.drawerIndex + 1));
    header.style.cssText = 'font-size:16px;font-weight:800;text-align:center;margin-bottom:6px;';
    header.textContent = task.canDraw ? (_t('dg_round_prefix') + state.round + _t('dg_round_draw') + task.word) : (_t('dg_round_prefix') + state.round + _t('dg_round_sep') + drawer + _t('dg_is_drawing') + (task.correct ? _t('dg_guessed_correct') : task.wordMask));
    wrap.appendChild(header);
    resizeCanvas();
    drawStrokes(task.strokes || []);
    wrap.appendChild(canvas);
    startTimer(wrap, state.stepRemainingMs, null);
    if (task.canDraw) { localStrokes = task.strokes || []; buildToolbar(wrap); return; }
    if (task.correct) return;
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:10px;width:min(100%,500px);'; wrap.appendChild(row);
    var input = document.createElement('input'); input.placeholder = _t('dg_stage_guess_placeholder'); input.maxLength = 20; input.style.cssText = 'flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:15px;'; row.appendChild(input);
    var btn = document.createElement('button'); btn.className = 'btn btn-primary'; btn.textContent = _t('dg_guess_btn'); row.appendChild(btn);
    function guess() { var text = input.value.trim(); if (!text) return; wsSend({ type: 'stage_guess', text: text }); input.select(); }
    btn.onclick = guess; input.onkeydown = function(e) { if (e.key === 'Enter') guess(); }; setTimeout(function(){ input.focus(); }, 50);
  }

  function renderStageResult(container, st) {
    clearInterval(timerInterval); container.innerHTML = '';
    var box = document.createElement('div'); box.style.cssText = 'margin:32px auto;padding:24px;max-width:420px;text-align:center;background:#fff9ee;border-radius:16px;font-size:16px;';
    var scores = (st.scores || []).map(function(s, i) { var n = window._players && window._players[i] ? window._players[i].name : (_t('dg_player_fallback') + (i + 1)); return n + ' ' + s + _t('dg_points_suffix'); }).join(' · ');
    box.innerHTML = '<div style="font-size:22px;font-weight:800">' + _t('dg_answer_label') + (st.word || '') + '</div><div style="margin-top:12px;color:var(--text-muted)">' + scores + '</div><div style="margin-top:12px">' + _t('dg_next_round_soon') + '</div>';
    container.appendChild(box);
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
      wordEl.textContent = _t('dg_original_word') + st.word + '」';
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
    resultEl.textContent = _t('dg_original_prefix') + st.word + _t('dg_to_final_guess') + (lastGuess || _t('dg_no_answer')) + '」';
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
    var note = document.createElement('div'); note.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:8px;'; note.textContent = _t('dg_vote_prompt') + count + '/' + (players ? players.length : 0) + '）'; voteBox.appendChild(note);
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

    render: function (st, container, pi, winner) {
      state = st;
      playerIndex = pi;

      if (st.mode === 'stage') {
        if (st.phase === 'choosing') {
          if (st.myTask && st.myTask.type === 'choose') renderChooseWord(container, st.myTask);
          else renderWaiting(container, _t('dg_waiting_drawer_choose'));
        } else if (st.phase === 'playing' && st.myTask) {
          renderStage(container, st.myTask);
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
