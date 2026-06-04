// public/js/renderers/twentyfour.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var _expr = '';
  var _usedNums = [];
  var _lastState = null;

  var STYLES =
    '.tf-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;}' +
    '.tf-round{font-size:14px;font-weight:600;color:var(--accent);text-align:center;}' +
    '.tf-nums{display:flex;gap:12px;justify-content:center;}' +
    '.tf-num{width:64px;height:80px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;cursor:pointer;transition:transform .12s,opacity .3s;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.15);}' +
    '.tf-num:active{transform:scale(.92);}' +
    '.tf-num.used{opacity:.25;pointer-events:none;}' +
    '.tf-expr{min-height:46px;font-size:20px;font-weight:700;padding:8px 14px;background:var(--bg);border-radius:12px;text-align:center;width:100%;word-break:break-all;}' +
    '.tf-ops{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}' +
    '.tf-op{width:46px;height:46px;border-radius:12px;border:2px solid var(--border);background:var(--surface);font-size:22px;font-weight:700;cursor:pointer;transition:transform .12s;display:flex;align-items:center;justify-content:center;}' +
    '.tf-op:active{transform:scale(.9);}' +
    '.tf-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}' +
    '.tf-info{text-align:center;font-size:13px;color:var(--text-muted);padding:4px;}' +
    '.tf-round-winner{text-align:center;font-size:15px;font-weight:700;color:#5a9e6f;padding:8px;}' +
    '.tf-leaderboard{width:100%;background:var(--bg);border-radius:14px;padding:10px 14px;}' +
    '.tf-lb-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:14px;}' +
    '.tf-lb-row:last-child{border-bottom:none;}' +
    '.tf-lb-rank{font-weight:800;font-size:18px;min-width:28px;}' +
    '.tf-lb-wins{font-weight:600;color:var(--accent);}' +
    '.tf-n0{background:#e74c3c;} .tf-n1{background:#3498db;} .tf-n2{background:#2ecc71;} .tf-n3{background:#f39c12;}' +
    '.tf-hint{text-align:center;font-size:13px;color:#5a9e6f;padding:4px;font-weight:600;min-height:18px;}';

  var _numColors = ['tf-n0', 'tf-n1', 'tf-n2', 'tf-n3'];

  window.gameRenderers.set('twentyfour', {
    init: function(container) {
      _expr = '';
      _usedNums = [];
      if (!document.getElementById('tfStyles')) {
        var s = document.createElement('style');
        s.id = 'tfStyles'; s.textContent = STYLES;
        document.head.appendChild(s);
      }

      container.innerHTML =
        '<div class="tf-wrap">' +
          '<div class="tf-round" id="tfRound"></div>' +
          '<div class="tf-nums" id="tfNums"></div>' +
          '<div class="tf-expr" id="tfExpr"></div>' +
          '<div id="tfError" style="display:none;text-align:center;font-size:13px;font-weight:600;color:#e74c3c;min-height:18px;"></div>' +
          '<div id="tfMyStatus" style="display:none;text-align:center;font-size:14px;font-weight:700;color:#5a9e6f;"></div>' +
          '<div class="tf-ops">' +
            '<button class="tf-op" onclick="window._tfPushOp(\'+\')">+</button>' +
            '<button class="tf-op" onclick="window._tfPushOp(\'-\')">-</button>' +
            '<button class="tf-op" onclick="window._tfPushOp(\'*\')">×</button>' +
            '<button class="tf-op" onclick="window._tfPushOp(\'/\')">÷</button>' +
            '<button class="tf-op" onclick="window._tfPushOp(\'(\')">(</button>' +
            '<button class="tf-op" onclick="window._tfPushOp(\')\')">)</button>' +
          '</div>' +
          '<div class="tf-actions">' +
            '<button class="btn btn-outline btn-sm" onclick="window._tfUndo()">撤销</button>' +
            '<button class="btn btn-outline btn-sm" onclick="window._tfClear()">清空</button>' +
            '<button class="btn btn-primary btn-sm" onclick="window._tfSubmit()">提交</button>' +
            '<button class="btn btn-outline btn-sm" id="tfHintBtn" onclick="window._tfHint()">💡 来点提示</button>' +
          '</div>' +
          '<div class="tf-hint" id="tfHint"></div>' +
          '<div class="tf-round-winner" id="tfRoundWinner" style="display:none"></div>' +
          '<div class="tf-leaderboard" id="tfLB" style="display:none"></div>' +
          '<div class="tf-info" id="tfInfo"></div>' +
        '</div>';

      // Surface server-side move errors (e.g. wrong-answer computed result) in the board
      window._gameErrorHandler = function(message) {
        var errEl = document.getElementById('tfError');
        if (!errEl) return;
        errEl.textContent = '❌ ' + message;
        errEl.style.display = '';
        clearTimeout(errEl._timer);
        errEl._timer = setTimeout(function() { errEl.style.display = 'none'; }, 4000);
      };
    },

    render: function(state, container, playerIndex, winner) {
      if (!state || !state.numbers) return;
      _lastState = state;

      // Round indicator
      var roundEl = document.getElementById('tfRound');
      if (roundEl) roundEl.textContent = '第 ' + (state.currentRound || 1) + ' / ' + (state.maxRounds || 5) + ' 轮';

      // Build number cards (only when numbers change)
      var numsDiv = document.getElementById('tfNums');
      var numsKey = JSON.stringify(state.numbers);
      if (numsDiv && numsDiv.dataset.rendered !== numsKey) {
        numsDiv.dataset.rendered = numsKey;
        _expr = '';
        _usedNums = [];
        var errClear = document.getElementById('tfError');
        if (errClear) errClear.style.display = 'none';
        var hintEl = document.getElementById('tfHint');
        if (hintEl) hintEl.textContent = '';
        var hintBtn = document.getElementById('tfHintBtn');
        if (hintBtn) hintBtn.disabled = false;
        numsDiv.innerHTML = '';
        for (var i = 0; i < state.numbers.length; i++) {
          (function(idx) {
            var btn = document.createElement('div');
            btn.className = 'tf-num ' + _numColors[idx];
            btn.textContent = state.numbers[idx];
            btn.addEventListener('click', function() {
              _expr += state.numbers[idx];
              _usedNums.push(idx);
              updateDisplay();
            });
            numsDiv.appendChild(btn);
          })(i);
        }
      }

      // Mark numbers as used
      if (numsDiv) {
        var children = numsDiv.children;
        for (var j = 0; j < children.length; j++) {
          var isUsed = _usedNums.indexOf(j) >= 0;
          children[j].className = 'tf-num ' + _numColors[j] + (isUsed ? ' used' : '');
        }
      }

      updateDisplay();

      // "Already answered, waiting for countdown" status (timed mode)
      var myStatusEl = document.getElementById('tfMyStatus');
      var subs = state.playerSubmissions || {};
      var mySub = subs[playerIndex];
      var answeredCount = 0;
      for (var sk in subs) { if (subs[sk] && subs[sk].correct) answeredCount++; }
      if (myStatusEl) {
        if (state.phase === 'playing' && mySub && mySub.correct) {
          myStatusEl.style.display = '';
          myStatusEl.textContent = '✅ 已答对！等待倒计时结束…（已有 ' + answeredCount + ' 人答对）';
        } else if (state.phase === 'playing' && answeredCount > 0) {
          myStatusEl.style.display = '';
          myStatusEl.style.color = 'var(--text-muted)';
          myStatusEl.textContent = '已有 ' + answeredCount + ' 人答对，加油！';
        } else {
          myStatusEl.style.display = 'none';
          myStatusEl.style.color = '#5a9e6f';
        }
      }
      // Clear stale error when a new round's numbers appear
      var errEl = document.getElementById('tfError');
      if (errEl && state.phase !== 'playing') { errEl.style.display = 'none'; }

      // Round winner / time's up — reveal answer
      var rwEl = document.getElementById('tfRoundWinner');
      if (rwEl) {
        if (state.phase === 'round_end') {
          var answerLine = '';
          var sol = findSolution(state.numbers.slice());
          if (sol) {
            answerLine = '<div style="font-size:13px;color:var(--text-muted);margin-top:4px;">答案: ' + sol.str + ' = 24</div>';
          }
          if (state.roundWinner === -1) {
            rwEl.style.display = '';
            rwEl.innerHTML = '⏰ 时间到！本轮无人得分' + answerLine +
              '<br><button class="btn btn-accent btn-sm" onclick="window._tfNextRound()" style="margin-top:8px;">' +
              (state.currentRound >= state.maxRounds ? '查看最终排名' : '下一轮') + '</button>';
          } else if (state.roundWinner !== null) {
            var rwName = state.roundWinner === playerIndex ? '你' : ((window.gamePlayers && window.gamePlayers[state.roundWinner]) ? window.gamePlayers[state.roundWinner].name : ('玩家' + (state.roundWinner + 1)));
            rwEl.style.display = '';
            rwEl.innerHTML = '🎉 ' + rwName + ' 赢了本轮！' + answerLine +
              '<br><button class="btn btn-accent btn-sm" onclick="window._tfNextRound()" style="margin-top:8px;">' +
              (state.currentRound >= state.maxRounds ? '查看最终排名' : '下一轮') + '</button>';
          } else {
            rwEl.style.display = 'none';
          }
        }
      }

      // Leaderboard
      var lbEl = document.getElementById('tfLB');
      if (lbEl && state.roundsWon) {
        lbEl.style.display = '';
        var sorted = [];
        for (var p = 0; p < state.roundsWon.length; p++) {
          sorted.push({ player: p, wins: state.roundsWon[p] || 0 });
        }
        sorted.sort(function(a, b) { return b.wins - a.wins; });

        var medals = ['🥇', '🥈', '🥉'];
        var html = '<div style="font-size:14px;font-weight:700;margin-bottom:6px;">排行榜</div>';
        for (var r = 0; r < sorted.length; r++) {
          var name = sorted[r].player === playerIndex ? '你' : ((window.gamePlayers && window.gamePlayers[sorted[r].player]) ? window.gamePlayers[sorted[r].player].name : ('玩家' + (sorted[r].player + 1)));
          var icon = medals[r] || (r + 1);
          html += '<div class="tf-lb-row"><span><span class="tf-lb-rank">' + icon + '</span> ' + name + '</span><span class="tf-lb-wins">' + sorted[r].wins + ' 胜</span></div>';
        }
        lbEl.innerHTML = html;
      }

      // Info / countdown / game over
      var infoEl = document.getElementById('tfInfo');
      if (infoEl) {
        if (state.phase === 'over') {
          stopCountdown();
          var champ = state.winner === playerIndex ? '你' : ((window.gamePlayers && window.gamePlayers[state.winner]) ? window.gamePlayers[state.winner].name : ('玩家' + (state.winner + 1)));
          infoEl.innerHTML = '<span style="font-size:16px;font-weight:700;color:#c8a45c;">🏆 总冠军: ' + champ + '</span>';
        } else if (state.phase === 'round_end') {
          stopCountdown();
          infoEl.textContent = '等待房主开始下一轮...';
        } else if (state.phase === 'playing') {
          // Timed mode: use client-local clock to avoid cross-machine clock skew
          var numKey = JSON.stringify(state.numbers);
          // Reset hint level when numbers change (new round)
          if (numKey !== _lastTimedNumsKey) {
            _lastTimedNumsKey = numKey;
            _roundLocalStart = Date.now();
            resetHintForRound();
          }
          if (state.roundTime && state.roundTime > 0) {
            if (_roundLocalStart) {
              startCountdown(state.roundTime, _roundLocalStart, infoEl);
            }
          } else {
            infoEl.textContent = '用所有数字算出24！先答对的赢';
          }
        }
      }

      // Reset countdown when numbers change (use client-local clock)
      if (state.phase === 'playing' && _roundLocalStart && state.roundTime > 0) {
        var remaining = Math.max(0, Math.ceil(state.roundTime - (Date.now() - _roundLocalStart) / 1000));
        updateCountdownDisplay(remaining);
      }
    }
  });

  function updateDisplay() {
    var el = document.getElementById('tfExpr');
    if (el) el.textContent = _expr || '点击数字和运算符开始';
  }

  window._tfPushOp = function(op) {
    _expr += op === '*' ? '×' : op === '/' ? '÷' : op;
    updateDisplay();
  };

  window._tfUndo = function() {
    if (_expr.length > 0) {
      var ch = _expr.charAt(_expr.length - 1);
      _expr = _expr.slice(0, -1);
      if (/\d/.test(ch) && _usedNums.length > 0) _usedNums.pop();
      updateDisplay();
    }
  };

  window._tfClear = function() {
    _expr = '';
    _usedNums = [];
    updateDisplay();
  };

  window._tfSubmit = function() {
    if (!_expr.trim()) { showToast('请先组合表达式'); return; }
    var realExpr = _expr.replace(/×/g, '*').replace(/÷/g, '/');
    _expr = '';
    _usedNums = [];
    updateDisplay();
    window.makeGameMove({ expression: realExpr });
  };

  window._tfNextRound = function() {
    // Send next_round to server (add it as a global if not exists)
    if (typeof window._sendNextRound === 'function') {
      window._sendNextRound();
    }
  };

  var _countdownTimer = null;
  var _roundLocalStart = 0;     // client-local Date.now() when current timed round started
  var _lastTimedNumsKey = '';   // detect numbers change to reset local timer
  var _hintLevel = 0;           // progressive hint, resets each round

  // startCountdown accepts (roundTime, roundStartedAt) or (endsAt, infoEl) for legacy mode.
  // roundStartedAt is now a client-local Date.now() to avoid cross-machine clock skew.
  function startCountdown(arg1, arg2, infoEl) {
    var tick;
    if (typeof arg1 === 'number' && typeof arg2 === 'number' && arg1 > 0 && arg2 > 0) {
      // roundTime (seconds), roundStartedAt (client-local timestamp)
      var roundTime = arg1;
      var startedAt = arg2;
      tick = function() {
        var elapsed = (Date.now() - startedAt) / 1000;
        var remaining = Math.max(0, Math.ceil(roundTime - elapsed));
        updateCountdownDisplay(remaining, infoEl);
        if (remaining <= 0) {
          stopCountdown();
        } else {
          _countdownTimer = setTimeout(tick, 200);
        }
      };
    } else {
      // Legacy mode: absolute endsAt timestamp
      var endsAt = arg1;
      tick = function() {
        var remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        updateCountdownDisplay(remaining, infoEl);
        if (remaining <= 0) {
          stopCountdown();
        } else {
          _countdownTimer = setTimeout(tick, 200);
        }
      };
    }
    stopCountdown();
    tick();
  }

  function stopCountdown() {
    if (_countdownTimer) { clearTimeout(_countdownTimer); _countdownTimer = null; }
  }

  function updateCountdownDisplay(remaining, infoEl) {
    if (!infoEl) infoEl = document.getElementById('tfInfo');
    if (!infoEl) return;
    if (remaining <= 0) {
      infoEl.innerHTML = '<span style="color:#e74c3c;font-weight:700;">⏰ 时间到！</span>';
      return;
    }
    var mins = Math.floor(remaining / 60);
    var secs = remaining % 60;
    var color = remaining <= 10 ? '#e74c3c' : remaining <= 30 ? '#f39c12' : 'var(--text-muted)';
    infoEl.innerHTML = '<span style="color:' + color + ';font-weight:700;">⏱ 剩余 ' + (mins > 0 ? mins + '分' : '') + secs + '秒</span>';
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.classList.remove('show'); }, 1800);
  }

  // ---- Solver & progressive hints ----
  function findSolution(nums) {
    var ops = ['+', '-', '*', '/'];
    var opSym = { '+': '+', '-': '-', '*': '×', '/': '÷' };
    var EPS = 1e-9;

    function applyOp(a, b, op) {
      if (op === '+') return a + b;
      if (op === '-') return a - b;
      if (op === '*') return a * b;
      if (op === '/' && Math.abs(b) > EPS) return a / b;
      return null;
    }

    function permutations(arr) {
      if (arr.length <= 1) return [arr.slice()];
      var result = [];
      for (var i = 0; i < arr.length; i++) {
        var rest = arr.slice(0, i).concat(arr.slice(i + 1));
        var perms = permutations(rest);
        for (var j = 0; j < perms.length; j++) {
          result.push([arr[i]].concat(perms[j]));
        }
      }
      return result;
    }

    var perms = permutations(nums);
    for (var pi = 0; pi < perms.length; pi++) {
      var p = perms[pi];
      var a = p[0], b = p[1], c = p[2], d = p[3];
      var sa = '' + a, sb = '' + b, sc = '' + c, sd = '' + d;
      for (var o1 = 0; o1 < 4; o1++) {
        for (var o2 = 0; o2 < 4; o2++) {
          for (var o3 = 0; o3 < 4; o3++) {
            var op1 = ops[o1], op2 = ops[o2], op3 = ops[o3];
            var s1 = opSym[op1], s2 = opSym[op2], s3 = opSym[op3];
            var v1, v2, v3, v4, v5, v6, t1, t2;
            // Pattern 1: ((a op1 b) op2 c) op3 d
            t1 = applyOp(a, b, op1);
            if (t1 !== null) {
              t2 = applyOp(t1, c, op2);
              if (t2 !== null) {
                v1 = applyOp(t2, d, op3);
                if (v1 !== null && Math.abs(v1 - 24) < EPS)
                  return { str: '((' + sa + s1 + sb + ')' + s2 + sc + ')' + s3 + sd, nums: p, ops: [s1, s2, s3], pattern: 1 };
              }
            }
            // Pattern 2: (a op1 (b op2 c)) op3 d
            t1 = applyOp(b, c, op2);
            if (t1 !== null) {
              t2 = applyOp(a, t1, op1);
              if (t2 !== null) {
                v2 = applyOp(t2, d, op3);
                if (v2 !== null && Math.abs(v2 - 24) < EPS)
                  return { str: '(' + sa + s1 + '(' + sb + s2 + sc + '))' + s3 + sd, nums: p, ops: [s1, s2, s3], pattern: 2 };
              }
            }
            // Pattern 3: (a op1 b) op2 (c op3 d)
            t1 = applyOp(a, b, op1);
            t2 = applyOp(c, d, op3);
            if (t1 !== null && t2 !== null) {
              v3 = applyOp(t1, t2, op2);
              if (v3 !== null && Math.abs(v3 - 24) < EPS)
                return { str: '(' + sa + s1 + sb + ')' + s2 + '(' + sc + s3 + sd + ')', nums: p, ops: [s1, s2, s3], pattern: 3 };
            }
            // Pattern 4: a op1 ((b op2 c) op3 d)
            t1 = applyOp(b, c, op2);
            if (t1 !== null) {
              t2 = applyOp(t1, d, op3);
              if (t2 !== null) {
                v4 = applyOp(a, t2, op1);
                if (v4 !== null && Math.abs(v4 - 24) < EPS)
                  return { str: sa + s1 + '((' + sb + s2 + sc + ')' + s3 + sd + ')', nums: p, ops: [s1, s2, s3], pattern: 4 };
              }
            }
            // Pattern 5: a op1 (b op2 (c op3 d))
            t1 = applyOp(c, d, op3);
            if (t1 !== null) {
              t2 = applyOp(b, t1, op2);
              if (t2 !== null) {
                v5 = applyOp(a, t2, op1);
                if (v5 !== null && Math.abs(v5 - 24) < EPS)
                  return { str: sa + s1 + '(' + sb + s2 + '(' + sc + s3 + sd + '))', nums: p, ops: [s1, s2, s3], pattern: 5 };
              }
            }
          }
        }
      }
    }
    return null;
  }

  function generateHint(solution, nums) {
    // Progressive hint, each level gives a useful clue based on actual numbers.
    // Cycles 1-4, never reveals full answer.
    if (!solution) return null;
    var ops = solution.ops;
    var a = solution.nums[0], b = solution.nums[1], c = solution.nums[2], d = solution.nums[3];

    var level = ((_hintLevel - 1) % 4) + 1;
    switch (level) {
      case 1:
        // Which two numbers interact first, and how
        if (ops[0] === '×')
          return a + ' × ' + b + ' = ' + (a * b) + '，从这里开始试试';
        if (ops[0] === '+')
          return a + ' + ' + b + ' = ' + (a + b) + '，先加这两个';
        if (ops[0] === '-')
          return a + ' - ' + b + ' = ' + (a - b) + '，先减这两个';
        if (ops[0] === '÷')
          return a + ' ÷ ' + b + ' = ' + (a / b).toFixed(1) + '，从这里入手';
        return '第一步试试 ' + a + ' ' + ops[0] + ' ' + b;
      case 2:
        // What intermediate result to target
        if (solution.pattern === 1 || solution.pattern === 2) {
          var t1_1 = solution.pattern === 1 ? (ops[0] === '+' ? a + b : ops[0] === '-' ? a - b : ops[0] === '×' ? a * b : a / b) : 0;
          var t1_2 = solution.pattern === 2 ? (ops[1] === '+' ? b + c : ops[1] === '-' ? b - c : ops[1] === '×' ? b * c : b / c) : 0;
          var target = solution.pattern === 1 ? t1_1 : t1_2;
          if (target && Number.isInteger(target)) return '需要先凑出 ' + Math.round(target) + '，然后继续运算';
        }
        if (solution.pattern === 3) {
          var ta = ops[0] === '+' ? a + b : ops[0] === '-' ? a - b : ops[0] === '×' ? a * b : a / b;
          var tb = ops[2] === '+' ? c + d : ops[2] === '-' ? c - d : ops[2] === '×' ? c * d : c / d;
          if (ta && tb && Number.isInteger(ta) && Number.isInteger(tb))
            return '分成两组：凑 ' + Math.round(ta) + ' 和 ' + Math.round(tb) + '，再用 ' + ops[1] + ' 组合';
        }
        return '想想中间需要凑出什么数，再和剩余数字运算';
      case 3:
        // The critical operation / insight
        var critical = ops[0] === '×' || ops[1] === '×' || ops[2] === '×' ? '乘法' :
                        ops[0] === '÷' || ops[1] === '÷' || ops[2] === '÷' ? '除法' : '加减法';
        if (ops.filter(function(o){return o==='×'}).length >= 2) return '关键：两次乘法，注意乘积不要太大';
        if (ops.indexOf('÷') >= 0) return '除法是关键，想想哪个数除以哪个能得到整数';
        if (ops[0] === '-' || ops[1] === '-' || ops[2] === '-') return '用减法来消掉多余的数';
        return '最后一步用 ' + ops[2] + '，倒推需要什么中间结果';
      case 4:
        // The overall structure
        if (solution.pattern === 1) return '结构: ((' + a + ' _ ' + b + ') _ ' + c + ') _ ' + d;
        if (solution.pattern === 2) return '结构: (' + a + ' _ (' + b + ' _ ' + c + ')) _ ' + d;
        if (solution.pattern === 3) return '结构: (' + a + ' _ ' + b + ') _ (' + c + ' _ ' + d + ')';
        if (solution.pattern === 4) return '结构: ' + a + ' _ ((' + b + ' _ ' + c + ') _ ' + d + ')';
        if (solution.pattern === 5) return '结构: ' + a + ' _ (' + b + ' _ (' + c + ' _ ' + d + '))';
        return '括号结构是突破口，试试不同分组';
    }
  }

  // Reset hint level when new numbers appear
  function resetHintForRound() {
    _hintLevel = 0;
    var hintEl = document.getElementById('tfHint');
    if (hintEl) hintEl.textContent = '';
    var hintBtn = document.getElementById('tfHintBtn');
    if (hintBtn) hintBtn.disabled = false;
  }

  window._tfHint = function() {
    var hintEl = document.getElementById('tfHint');
    var hintBtn = document.getElementById('tfHintBtn');
    if (!_lastState || !_lastState.numbers) { if (hintEl) hintEl.textContent = '暂无数字'; return; }
    var solution = findSolution(_lastState.numbers.slice());
    if (!solution) {
      if (hintEl) hintEl.textContent = '😅 本轮暂无标准24点解法';
      if (hintBtn) hintBtn.disabled = true;
      return;
    }
    _hintLevel++;
    var hintText = generateHint(solution, _lastState.numbers);
    if (hintEl && hintText) {
      var label = _hintLevel > 4 ? '反复思考' : (_hintLevel === 4 ? '最后一眼' : (_hintLevel === 3 ? '再近一步' : (_hintLevel === 2 ? '再想一想' : '初窥门径')));
      hintEl.textContent = '💡 [' + label + '] ' + hintText;
    }
    if (_hintLevel >= 16) {
      if (hintBtn) hintBtn.disabled = true;
    }
  };
})();
