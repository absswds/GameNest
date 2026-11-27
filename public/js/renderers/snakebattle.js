(function () {
  var canvas, ctx, containerEl, swipeStart, padSwipeStart;
  var previousSnapshot, targetSnapshot, animationStart, rafId;
  var logicalW = 0, logicalH = 0, lastFsMode = null;
  var foodAnim = null, floatingTexts = [], deathAnims = {};
  var scoreboardRows = [], prevScores = null;

  var TICK_MS = 120;
  var FOOD_POP_MS = 200;
  var DEATH_MS = 400;
  var FLOAT_MS = 600;
  var SCORE_ROLL_MS = 600;
  var COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffb300', '#ab47bc', '#26a69a'];
  var KEY_TO_DIRECTION = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
  };

  function tr(key, fallback) {
    if (typeof window._t === 'function') return window._t(key);
    return fallback || key;
  }

  function escHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function isReducedMotion() {
    if (window.Motion && typeof window.Motion.reduced === 'function') return window.Motion.reduced();
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Exact cubic-bezier evaluator for project motion tokens.
  function cubicBezier(x1, y1, x2, y2, t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var lo = 0, hi = 1, u = t;
    for (var i = 0; i < 12; i++) {
      u = (lo + hi) * 0.5;
      var inv = 1 - u;
      var x = 3 * inv * inv * u * x1 + 3 * inv * u * u * x2 + u * u * u;
      if (x < t) lo = u;
      else hi = u;
    }
    var iu = 1 - u;
    return 3 * iu * iu * u * y1 + 3 * iu * u * u * y2 + u * u * u;
  }

  function easeOut(t) {
    return cubicBezier(0.23, 1, 0.32, 1, t);
  }

  function isFullscreen() {
    return !!(document.body && document.body.classList.contains('gn-fs'));
  }

  function sendDirection(direction) {
    var state = window._sbState;
    var me = state && state.snakes && state.snakes[window._sbPlayerIndex];
    if (!state || state.winner != null || !me || !me.alive) return;
    window.makeGameMove({ direction: direction });
  }

  function formatTimeLeft(state) {
    if (!state || !state.timeLimitTicks) return '';
    var left = Math.max(0, Math.ceil((state.timeLimitTicks - state.tick) * 0.12));
    return {
      seconds: left,
      text: Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'),
    };
  }

  function resize() {
    if (!canvas || !containerEl || !document.body.contains(containerEl)) return;
    var state = window._sbState;
    if (!state) return;

    var fs = isFullscreen();
    lastFsMode = fs;
    var width, height;

    if (fs) {
      var shell = document.getElementById('sbShell');
      var leftEl = document.getElementById('sbLeft');
      var rightEl = document.getElementById('sbRight');
      var stage = containerEl.closest('#gameStage');
      var wrap = containerEl.closest('.board-wrap') || containerEl;
      var wrapRect = wrap.getBoundingClientRect();
      var stageCS = stage ? getComputedStyle(stage) : null;
      var stagePadX = stageCS ? ((parseFloat(stageCS.paddingLeft) || 0) + (parseFloat(stageCS.paddingRight) || 0)) : 0;
      var stagePadBottom = stageCS ? (parseFloat(stageCS.paddingBottom) || 0) : 0;

      var shellW = Math.min(window.innerWidth - stagePadX, wrapRect.width > 0 ? wrapRect.width : window.innerWidth - stagePadX);
      var shellH = Math.max(180, window.innerHeight - Math.max(0, wrapRect.top) - stagePadBottom);
      var cs = shell ? getComputedStyle(shell) : null;
      var padX = cs ? ((parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)) : 20;
      var padY = cs ? ((parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)) : 16;
      var gapX = cs ? (parseFloat(cs.columnGap || cs.gap) || 10) : 10;
      var leftW = leftEl ? leftEl.getBoundingClientRect().width : 0;
      var rightW = rightEl ? rightEl.getBoundingClientRect().width : 0;

      var availW = Math.max(160, shellW - padX - leftW - rightW - gapX * 2);
      var availH = Math.max(140, shellH - padY);
      var ratio = state.width / state.height;
      width = Math.floor(Math.min(availW, availH * ratio));
      height = Math.floor(width / ratio);
    } else {
      width = Math.max(280, Math.min(window.innerWidth - 28, 620));
      height = Math.round(width * state.height / state.width);
    }

    var dpr = window.devicePixelRatio || 1;
    logicalW = width;
    logicalH = height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(performance.now());
  }

  function makeDeathVectors(body, snakeIndex) {
    return body.map(function (_cell, segIdx) {
      var seed = (snakeIndex + 1) * 31 + segIdx * 17 + 7;
      var angle = ((seed * 0.6180339887) % 1) * Math.PI * 2;
      var dist = 0.45 + ((seed * 0.7548776662) % 1) * 0.55;
      var rot = (((seed * 0.5698402909) % 1) - 0.5) * 1.6;
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, rot: rot };
    });
  }

  function snapshot(state) {
    return {
      tick: state.tick,
      width: state.width,
      height: state.height,
      food: state.food && { x: state.food.x, y: state.food.y },
      winner: state.winner,
      snakes: state.snakes.map(function (snake) {
        return {
          player: snake.player,
          alive: snake.alive,
          score: snake.score,
          body: snake.body.map(function (cell) { return { x: cell.x, y: cell.y }; }),
        };
      }),
    };
  }

  function interpolateBody(previous, target, progress) {
    if (progress >= 1 || !previous || !previous.alive || !target.alive) return target.body;
    var prevLen = previous.body.length;
    var currLen = target.body.length;
    if (currLen === prevLen) {
      return target.body.map(function (cell, index) {
        var old = previous.body[index];
        return { x: old.x + (cell.x - old.x) * progress, y: old.y + (cell.y - old.y) * progress };
      });
    }
    if (currLen === prevLen + 1) {
      return target.body.map(function (cell, index) {
        var old = index === 0 ? previous.body[0] : previous.body[index - 1];
        return { x: old.x + (cell.x - old.x) * progress, y: old.y + (cell.y - old.y) * progress };
      });
    }
    return target.body;
  }

  function interpolatedState(progress) {
    if (!previousSnapshot || progress >= 1) return targetSnapshot;
    return {
      width: targetSnapshot.width,
      height: targetSnapshot.height,
      food: targetSnapshot.food,
      winner: targetSnapshot.winner,
      snakes: targetSnapshot.snakes.map(function (snake, index) {
        return {
          player: snake.player,
          alive: snake.alive,
          score: snake.score,
          body: interpolateBody(previousSnapshot.snakes[index], snake, progress),
        };
      }),
    };
  }

  function drawSnakeSegment(partX, partY, size, cell, radius, color, alpha, isHead, isSelf) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(partX, partY, size, size, radius);
    ctx.fill();
    if (isHead) {
      ctx.strokeStyle = isSelf ? '#fff5bf' : 'rgba(255,255,255,.5)';
      ctx.lineWidth = Math.max(1.5, cell * 0.08);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFrame(now) {
    if (!canvas || !ctx || !targetSnapshot) return;
    var reduced = isReducedMotion();
    var progress = (previousSnapshot && !reduced) ? Math.min(1, (now - animationStart) / TICK_MS) : 1;
    var state = interpolatedState(progress);
    var playerIndex = window._sbPlayerIndex;

    var width = logicalW || parseFloat(canvas.style.width) || 320;
    var height = logicalH || parseFloat(canvas.style.height) || Math.round(width * state.height / state.width);
    var cell = Math.min(width / state.width, height / state.height);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#18231f';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,.055)';
    ctx.lineWidth = 1;
    for (var x = 0; x <= state.width; x++) {
      ctx.beginPath(); ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, height); ctx.stroke();
    }
    for (var y = 0; y <= state.height; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cell); ctx.lineTo(width, y * cell); ctx.stroke();
    }

    // Food with 200 ms pop-in (scale 0.6 -> 1; fade only on reduced motion)
    if (state.food) {
      var foodScale = 1;
      var foodAlpha = 1;
      if (foodAnim && foodAnim.x === state.food.x && foodAnim.y === state.food.y) {
        var ft = Math.min(1, (now - foodAnim.start) / FOOD_POP_MS);
        if (ft < 1) {
          if (reduced) {
            foodAlpha = ft;
          } else {
            foodScale = 0.6 + 0.4 * easeOut(ft);
            foodAlpha = Math.min(1, ft * 2.5);
          }
        } else {
          foodAnim = null;
        }
      }
      ctx.save();
      ctx.translate((state.food.x + 0.5) * cell, (state.food.y + 0.52) * cell);
      ctx.scale(foodScale, foodScale);
      ctx.globalAlpha = foodAlpha;
      ctx.font = Math.max(16, cell * 0.82) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🍎', 0, 0);
      ctx.restore();
    }

    var inset = Math.max(1.5, cell * 0.1);
    var size = cell - inset * 2;
    var radius = Math.max(3, cell * 0.22);

    // Draw dead snakes first, then alive snakes on top
    var passOrder = [];
    state.snakes.forEach(function (snake, index) {
      if (!snake.alive) passOrder.push({ snake: snake, index: index });
    });
    state.snakes.forEach(function (snake, index) {
      if (snake.alive) passOrder.push({ snake: snake, index: index });
    });

    passOrder.forEach(function (entry) {
      var snake = entry.snake;
      var index = entry.index;
      var color = COLORS[index % COLORS.length];
      var isSelf = index === playerIndex;

      if (!snake.alive && deathAnims[index] && !deathAnims[index].done) {
        var dAnim = deathAnims[index];
        var dt = (now - dAnim.start) / DEATH_MS;
        if (dt < 1) {
          if (reduced) {
            var fadeAlpha = 0.84 - (0.84 - 0.17) * dt;
            snake.body.forEach(function (part, partIndex) {
              var a = partIndex === 0 ? (1 - (1 - 0.17) * dt) : fadeAlpha;
              drawSnakeSegment(part.x * cell + inset, part.y * cell + inset, size, cell, radius, color, a, partIndex === 0, isSelf);
            });
          } else {
            var de = easeOut(dt);
            // Softly fade in the resting obstacle silhouette as segments scatter
            if (dt > 0.35) {
              var ghostAlpha = 0.17 * ((dt - 0.35) / 0.65);
              snake.body.forEach(function (part, partIndex) {
                drawSnakeSegment(part.x * cell + inset, part.y * cell + inset, size, cell, radius, color, ghostAlpha, partIndex === 0, isSelf);
              });
            }
            snake.body.forEach(function (part, partIndex) {
              var vec = dAnim.vectors[partIndex] || { dx: 0, dy: 0, rot: 0 };
              var cx = (part.x + 0.5 + vec.dx * de) * cell;
              var cy = (part.y + 0.5 + vec.dy * de) * cell;
              var segScale = 1 - 0.38 * de;
              var segAlpha = (partIndex === 0 ? 1 : 0.84) * (1 - dt);
              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(vec.rot * de);
              ctx.scale(segScale, segScale);
              drawSnakeSegment(-size * 0.5, -size * 0.5, size, cell, radius, color, segAlpha, partIndex === 0, isSelf);
              ctx.restore();
            });
          }
          return;
        }
        dAnim.done = true;
      }

      snake.body.forEach(function (part, partIndex) {
        var alpha = snake.alive ? (partIndex === 0 ? 1 : 0.84) : 0.17;
        drawSnakeSegment(part.x * cell + inset, part.y * cell + inset, size, cell, radius, color, alpha, partIndex === 0, isSelf);
      });
    });

    // Floating +N text (600 ms at head)
    if (floatingTexts.length > 0) {
      var remaining = [];
      for (var i = 0; i < floatingTexts.length; i++) {
        var item = floatingTexts[i];
        var pt = (now - item.start) / FLOAT_MS;
        if (pt >= 1) continue;
        remaining.push(item);
        var pe = easeOut(pt);
        var dy = reduced ? 0 : (-0.9 * cell * pe);
        var alpha = pt < 0.18 ? (pt / 0.18) : Math.max(0, 1 - (pt - 0.18) / 0.82);
        var tx = item.gx * cell;
        var ty = item.gy * cell + dy;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '800 ' + Math.max(12, Math.round(cell * 0.58)) + 'px Nunito, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2.5, cell * 0.14);
        ctx.strokeStyle = 'rgba(18, 26, 22, 0.9)';
        ctx.strokeText(item.text, tx, ty);
        ctx.fillStyle = '#fff5bf';
        ctx.fillText(item.text, tx, ty);
        ctx.restore();
      }
      floatingTexts = remaining;
    }
  }

  function hasActiveAnimations(now) {
    if (!targetSnapshot) return false;
    var reduced = isReducedMotion();
    if (!reduced && previousSnapshot && (now - animationStart) < TICK_MS) return true;
    if (foodAnim && (now - foodAnim.start) < FOOD_POP_MS) return true;
    if (floatingTexts.length > 0) return true;
    for (var k in deathAnims) {
      if (Object.prototype.hasOwnProperty.call(deathAnims, k) && !deathAnims[k].done) return true;
    }
    return false;
  }

  function drawAnimationFrame(now) {
    if (!targetSnapshot) {
      rafId = null;
      return;
    }
    drawFrame(now);
    if (hasActiveAnimations(now)) {
      rafId = requestAnimationFrame(drawAnimationFrame);
    } else {
      rafId = null;
    }
  }

  function rollScoreNumber(el, targetScore, skipAnim) {
    if (!el) return;
    if (el._sbRollRaf) {
      cancelAnimationFrame(el._sbRollRaf);
      el._sbRollRaf = null;
    }
    var targetStr = String(targetScore);
    if (skipAnim || isReducedMotion()) {
      el.textContent = targetStr;
      return;
    }
    var from = parseFloat(el.textContent);
    if (isNaN(from) || from === targetScore) {
      el.textContent = targetStr;
      return;
    }
    var start = performance.now();
    function step(now) {
      var t = Math.min(1, (now - start) / SCORE_ROLL_MS);
      var e = easeOut(t);
      el.textContent = String(Math.round(from + (targetScore - from) * e));
      if (t < 1) {
        el._sbRollRaf = requestAnimationFrame(step);
      } else {
        el._sbRollRaf = null;
        el.textContent = targetStr;
      }
    }
    el._sbRollRaf = requestAnimationFrame(step);
  }

  function updateFullscreenScoreboard(state, playerIndex, isFirstRender) {
    var headEl = document.getElementById('sbFsHead');
    var boardEl = document.getElementById('sbBoard');
    var padEl = document.getElementById('sbPad');
    if (!headEl || !boardEl) return;

    var me = state.snakes[playerIndex];
    if (padEl) {
      padEl.classList.toggle('is-disabled', !me || !me.alive || state.winner != null);
    }

    // Header: time left + match/survival state
    var timeInfo = formatTimeLeft(state);
    var statusTxt = '';
    if (state.winner != null) {
      statusTxt = state.winner === -1 ? tr('sb_draw', 'Draw') : state.winner === playerIndex ? tr('sb_you_survived', 'You survived') : tr('sb_game_over', 'Game over');
    } else if (!me || !me.alive) {
      statusTxt = tr('sb_eliminated', 'Eliminated');
    } else if (state.endReason === 'time') {
      statusTxt = tr('sb_time_up', 'Time up');
    }

    var headHtml = '';
    if (timeInfo && state.winner == null) {
      headHtml += '<div class="sb-fs-timer' + (timeInfo.seconds <= 15 ? ' is-urgent' : '') + '"><span>' + escHtml(tr('sb_time_left', 'Time left')) + '</span><strong>' + escHtml(timeInfo.text) + '</strong></div>';
    } else if (state.endReason === 'time') {
      headHtml += '<div class="sb-fs-timer"><span>' + escHtml(tr('sb_time_up', 'Time up')) + '</span></div>';
    }
    if (statusTxt) {
      headHtml += '<div class="sb-fs-status">' + escHtml(statusTxt) + '</div>';
    }
    headEl.innerHTML = headHtml;
    headEl.style.display = headHtml ? '' : 'none';

    // Leader detection: alive snakes ranked by length (or winner if game over)
    var aliveSnakes = state.snakes.filter(function (s) { return s.alive; });
    var maxAliveLen = 0;
    var minAliveLen = Infinity;
    var anyPositiveScore = false;
    aliveSnakes.forEach(function (s) {
      var len = s.body ? s.body.length : 0;
      if (len > maxAliveLen) maxAliveLen = len;
      if (len < minAliveLen) minAliveLen = len;
      if (s.score > 0) anyPositiveScore = true;
    });
    var hasLeader = aliveSnakes.length === 1 || (aliveSnakes.length > 1 && (maxAliveLen > minAliveLen || anyPositiveScore));

    // Rebuild rows only when snake count changes to avoid restarting transitions/rolls
    if (scoreboardRows.length !== state.snakes.length) {
      boardEl.innerHTML = '';
      scoreboardRows = state.snakes.map(function (_snake, index) {
        var row = document.createElement('div');
        row.className = 'sb-row';
        row.innerHTML =
          '<span class="sb-swatch"></span>' +
          '<div class="sb-row-main">' +
            '<div class="sb-row-top"><span class="sb-row-name"></span><span class="sb-row-you" style="display:none"></span></div>' +
            '<div class="sb-row-sub"><span class="sb-row-state"></span></div>' +
          '</div>' +
          '<div class="sb-row-metrics">' +
            '<strong class="sb-score-num">0</strong>' +
            '<span class="sb-len-num"></span>' +
          '</div>';
        boardEl.appendChild(row);
        return {
          root: row,
          swatch: row.querySelector('.sb-swatch'),
          name: row.querySelector('.sb-row-name'),
          you: row.querySelector('.sb-row-you'),
          state: row.querySelector('.sb-row-state'),
          score: row.querySelector('.sb-score-num'),
          len: row.querySelector('.sb-len-num'),
        };
      });
    }

    var nextScores = [];
    state.snakes.forEach(function (snake, index) {
      var refs = scoreboardRows[index];
      if (!refs) return;
      var color = COLORS[index % COLORS.length];
      var name = (window.gamePlayers && window.gamePlayers[index] && window.gamePlayers[index].name)
        ? window.gamePlayers[index].name
        : tr('sb_player_prefix', 'Player ') + (index + 1);
      var len = snake.body ? snake.body.length : 0;
      var isSelf = index === playerIndex;
      var isLeader = state.winner != null
        ? (state.winner >= 0 && index === state.winner)
        : (snake.alive && hasLeader && len === maxAliveLen);

      refs.root.classList.toggle('is-self', isSelf);
      refs.root.classList.toggle('is-dead', !snake.alive);
      refs.root.classList.toggle('is-leader', isLeader);
      refs.swatch.style.background = color;
      refs.name.textContent = (isLeader ? '★ ' : '') + name;
      if (isSelf) {
        refs.you.style.display = '';
        refs.you.textContent = tr('sb_you_tag', 'You');
      } else {
        refs.you.style.display = 'none';
      }
      refs.state.textContent = snake.alive ? tr('sb_alive', 'Alive') : tr('sb_dead', 'Out');
      refs.len.textContent = tr('sb_len', 'Len') + ' ' + len;

      var prevVal = prevScores && prevScores[index] !== undefined ? prevScores[index] : null;
      if (isFirstRender || prevVal === null) {
        rollScoreNumber(refs.score, snake.score, true);
      } else if (prevVal !== snake.score) {
        rollScoreNumber(refs.score, snake.score, false);
      }
      nextScores[index] = snake.score;
    });
    prevScores = nextScores;
  }

  function updateInfo(state, playerIndex, isFirstRender) {
    var status = document.getElementById('sbStatus'), players = document.getElementById('sbPlayers');
    if (players) players.innerHTML = state.snakes.map(function (snake, index) {
      var name = window.gamePlayers && window.gamePlayers[index] ? window.gamePlayers[index].name : tr('sb_player_prefix', 'Player ') + (index + 1);
      return '<span class="sb-player' + (index === playerIndex ? ' sb-self' : '') + (!snake.alive ? ' sb-out' : '') + '"><i style="background:' + COLORS[index % COLORS.length] + '"></i>' + escHtml(name) + ' · ' + snake.score + '</span>';
    }).join('');
    if (status) {
      var me = state.snakes[playerIndex];
      status.textContent = state.winner != null ? (state.winner === -1 ? tr('sb_draw', 'Draw') : state.winner === playerIndex ? tr('sb_you_survived', 'You survived') : tr('sb_game_over', 'Game over')) : (!me || !me.alive ? tr('sb_eliminated', 'Eliminated') : tr('sb_controls', 'Swipe or arrow keys to steer'));
      if (state.winner == null && state.timeLimitTicks) {
        var left = Math.max(0, Math.ceil((state.timeLimitTicks - state.tick) * 0.12));
        status.textContent += ' · ' + tr('sb_time_left', 'Time left') + ' ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
      } else if (state.endReason === 'time') {
        status.textContent += ' · ' + tr('sb_time_up', 'Time up');
      }
    }
    updateFullscreenScoreboard(state, playerIndex, isFirstRender);
  }

  function installStyles() {
    injectStylesOnce('sb-styles',
      // Normal mode (unchanged)
      '.sb-shell{width:100%;display:flex;flex-direction:column;align-items:center;gap:12px}' +
      '.sb-left{display:none}' +
      '.sb-center,.sb-right{display:contents}' +
      '.sb-players{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;min-height:28px}' +
      '.sb-player{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #e8e8e8;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800;color:#3a3a3a}' +
      '.sb-player i{width:9px;height:9px;border-radius:50%;display:block}' +
      '.sb-player.sb-self{border-color:#c8a45c;box-shadow:0 0 0 2px rgba(200,164,92,.15)}' +
      '.sb-player.sb-out{opacity:.38;text-decoration:line-through}' +
      '.sb-canvas{display:block;border-radius:18px;box-shadow:0 10px 26px rgba(21,44,34,.23);touch-action:none;background:#18231f}' +
      '.sb-status{min-height:22px;text-align:center;color:#6a6a6a;font-size:14px;font-weight:700}' +
      '.sb-pad{display:grid;grid-template-columns:repeat(3,58px);grid-template-rows:repeat(2,52px);gap:7px;justify-content:center}' +
      '.sb-pad button{border:0;border-radius:14px;background:#fff;color:#25382e;font-size:22px;font-weight:900;box-shadow:0 3px 10px rgba(0,0,0,.12);touch-action:manipulation;cursor:pointer}' +
      '.sb-pad button:active{transform:scale(.92);background:#e4f2e9}' +
      '.sb-pad .sb-up{grid-column:2}' +
      '.sb-pad .sb-left-btn{grid-column:1;grid-row:2}' +
      '.sb-pad .sb-down{grid-column:2;grid-row:2}' +
      '.sb-pad .sb-right-btn{grid-column:3;grid-row:2}' +
      '@media(max-width:380px){.sb-pad{grid-template-columns:repeat(3,52px);grid-template-rows:repeat(2,47px)}.sb-player{font-size:11px;padding:4px 7px}}' +

      // Fullscreen landscape mode (body.gn-fs)
      'body.gn-fs #boardArea{width:100%;height:100%;min-height:0;display:flex;align-items:center;justify-content:center}' +
      'body.gn-fs .sb-shell{width:100%;height:100%;display:grid;grid-template-columns:clamp(156px,21vw,216px) minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px 10px;box-sizing:border-box;overflow:hidden}' +
      'body.gn-fs .sb-players,body.gn-fs .sb-status{display:none}' +
      'body.gn-fs .sb-left{display:flex;flex-direction:column;justify-content:flex-start;align-self:stretch;gap:6px;padding-top:58px;min-width:0;min-height:0;overflow:hidden}' +
      'body.gn-fs .sb-center{display:flex;align-items:center;justify-content:center;min-width:0;min-height:0}' +
      'body.gn-fs .sb-right{display:flex;align-items:center;justify-content:center;align-self:stretch;min-width:0;min-height:0;touch-action:none}' +
      'body.gn-fs .sb-canvas{border-radius:14px;box-shadow:var(--ge-shadow-lift,0 10px 26px rgba(21,44,34,.28))}' +
      'body.gn-fs .sb-fs-head{background:var(--ge-paper,#fffdf8);border:1px solid var(--ge-line,rgba(28,27,25,.12));border-radius:12px;padding:6px 9px;box-shadow:var(--ge-shadow-rest,0 2px 6px rgba(0,0,0,.06));display:flex;flex-direction:column;gap:2px;flex-shrink:0}' +
      'body.gn-fs .sb-fs-timer{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11px;font-weight:700;color:var(--ge-ink-soft,#5d5850)}' +
      'body.gn-fs .sb-fs-timer strong{font-size:14px;font-weight:800;color:var(--ge-ink,#1c1b19);font-variant-numeric:tabular-nums}' +
      'body.gn-fs .sb-fs-timer.is-urgent strong{color:var(--ge-red,#c0392b)}' +
      'body.gn-fs .sb-fs-status{font-size:11px;font-weight:700;color:var(--ge-ink,#1c1b19);line-height:1.25}' +
      'body.gn-fs .sb-board{display:flex;flex-direction:column;gap:5px;min-height:0;overflow-y:auto;scrollbar-width:none}' +
      'body.gn-fs .sb-board::-webkit-scrollbar{display:none}' +
      'body.gn-fs .sb-row{display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:11px;background:var(--ge-paper,#fffdf8);border:1.5px solid var(--ge-line,rgba(28,27,25,.12));color:var(--ge-ink,#1c1b19);transition:opacity var(--dur,200ms) cubic-bezier(0.23,1,0.32,1);min-width:0}' +
      'body.gn-fs .sb-row.is-leader{border-color:var(--ge-gold,#b9954f);background:#faf4e4;box-shadow:0 0 0 1px rgba(185,149,79,.3)}' +
      'body.gn-fs .sb-row.is-self{box-shadow:inset 3px 0 0 var(--ge-ink,#1c1b19)}' +
      'body.gn-fs .sb-row.is-leader.is-self{box-shadow:inset 3px 0 0 var(--ge-gold,#b9954f),0 0 0 1px rgba(185,149,79,.3)}' +
      'body.gn-fs .sb-row.is-dead{opacity:.45}' +
      'body.gn-fs .sb-row.is-dead .sb-row-name{text-decoration:line-through}' +
      'body.gn-fs .sb-swatch{width:11px;height:11px;border-radius:4px;flex-shrink:0}' +
      'body.gn-fs .sb-row-main{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:1px}' +
      'body.gn-fs .sb-row-top{display:flex;align-items:center;gap:4px;min-width:0}' +
      'body.gn-fs .sb-row-name{font-size:12px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      'body.gn-fs .sb-row-you{flex-shrink:0;font-size:9px;font-weight:800;padding:1px 4px;border-radius:999px;background:rgba(28,27,25,.08);color:var(--ge-ink,#1c1b19)}' +
      'body.gn-fs .sb-row-sub{font-size:10px;font-weight:600;color:var(--ge-ink-soft,#5d5850);line-height:1.15}' +
      'body.gn-fs .sb-row-metrics{flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;line-height:1.1;font-variant-numeric:tabular-nums}' +
      'body.gn-fs .sb-score-num{font-size:14px;font-weight:800;color:var(--ge-ink,#1c1b19)}' +
      'body.gn-fs .sb-len-num{font-size:10px;font-weight:700;color:var(--ge-ink-soft,#5d5850)}' +
      'body.gn-fs .sb-pad{grid-template-columns:repeat(3,64px);grid-template-rows:repeat(2,64px);gap:6px}' +
      'body.gn-fs .sb-pad button{min-width:64px;min-height:64px;border:1px solid var(--ge-line,rgba(28,27,25,.12));border-radius:16px;background:var(--ge-paper,#fffdf8);color:var(--ge-ink,#1c1b19);font-size:24px;box-shadow:var(--ge-shadow-rest,0 2px 6px rgba(0,0,0,.08));transition:transform var(--dur-fast,120ms) cubic-bezier(0.23,1,0.32,1),background-color var(--dur-fast,120ms) cubic-bezier(0.23,1,0.32,1)}' +
      'body.gn-fs .sb-pad button:active{transform:scale(.97);background:#efe8d8}' +
      'body.gn-fs .sb-pad.is-disabled{opacity:.45}' +
      '@media(max-height:430px){body.gn-fs .sb-left{gap:4px}body.gn-fs .sb-fs-head{padding:4px 7px}body.gn-fs .sb-board{gap:4px}body.gn-fs .sb-row{padding:4px 7px}}' +
      '@media(min-width:1024px) and (min-height:540px){body.gn-fs .sb-shell{gap:14px;padding:12px 16px}body.gn-fs .sb-pad{grid-template-columns:repeat(3,72px);grid-template-rows:repeat(2,72px);gap:8px}body.gn-fs .sb-pad button{min-width:72px;min-height:72px;font-size:26px}}' +
      '@media(prefers-reduced-motion:reduce){body.gn-fs .sb-pad button{transition:background-color var(--dur-fast,120ms) linear}body.gn-fs .sb-pad button:active{transform:none}}'
    );
  }

  function handleSwipeEnd(startPos, endEvent) {
    if (!startPos) return null;
    var dx = endEvent.clientX - startPos.x;
    var dy = endEvent.clientY - startPos.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return null;
    sendDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    return null;
  }

  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('snakebattle', {
    init: function (container) {
      containerEl = container;
      installStyles();
      previousSnapshot = null;
      targetSnapshot = null;
      animationStart = 0;
      logicalW = 0;
      logicalH = 0;
      lastFsMode = null;
      foodAnim = null;
      floatingTexts = [];
      deathAnims = {};
      scoreboardRows = [];
      prevScores = null;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;

      container.innerHTML =
        '<div id="sbShell" class="sb-shell">' +
          '<div id="sbPlayers" class="sb-players"></div>' +
          '<aside id="sbLeft" class="sb-left">' +
            '<div id="sbFsHead" class="sb-fs-head"></div>' +
            '<div id="sbBoard" class="sb-board"></div>' +
          '</aside>' +
          '<div class="sb-center"><canvas id="sbCanvas" class="sb-canvas"></canvas></div>' +
          '<div id="sbStatus" class="sb-status"></div>' +
          '<div id="sbRight" class="sb-right">' +
            '<div id="sbPad" class="sb-pad">' +
              '<button type="button" class="sb-up" data-direction="up" aria-label="' + escHtml(tr('sb_dir_up', 'Up')) + '">▲</button>' +
              '<button type="button" class="sb-left-btn" data-direction="left" aria-label="' + escHtml(tr('sb_dir_left', 'Left')) + '">◀</button>' +
              '<button type="button" class="sb-down" data-direction="down" aria-label="' + escHtml(tr('sb_dir_down', 'Down')) + '">▼</button>' +
              '<button type="button" class="sb-right-btn" data-direction="right" aria-label="' + escHtml(tr('sb_dir_right', 'Right')) + '">▶</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      canvas = document.getElementById('sbCanvas');
      ctx = canvas.getContext('2d');

      container.querySelectorAll('[data-direction]').forEach(function (button) {
        var lastDownAt = 0;
        button.addEventListener('pointerdown', function () {
          lastDownAt = performance.now();
          sendDirection(button.dataset.direction);
        });
        button.addEventListener('click', function () {
          if (performance.now() - lastDownAt < 500) return;
          sendDirection(button.dataset.direction);
        });
      });

      canvas.addEventListener('pointerdown', function (event) {
        swipeStart = { x: event.clientX, y: event.clientY };
      });
      canvas.addEventListener('pointerup', function (event) {
        handleSwipeEnd(swipeStart, event);
        swipeStart = null;
      });
      canvas.addEventListener('pointercancel', function () { swipeStart = null; });

      var rightEl = document.getElementById('sbRight');
      if (rightEl) {
        rightEl.addEventListener('pointerdown', function (event) {
          if (event.target && event.target.closest && event.target.closest('button')) return;
          padSwipeStart = { x: event.clientX, y: event.clientY };
        });
        rightEl.addEventListener('pointerup', function (event) {
          handleSwipeEnd(padSwipeStart, event);
          padSwipeStart = null;
        });
        rightEl.addEventListener('pointercancel', function () { padSwipeStart = null; });
      }

      if (window._sbKeyHandler) window.removeEventListener('keydown', window._sbKeyHandler);
      window._sbKeyHandler = function (event) {
        var direction = KEY_TO_DIRECTION[event.key];
        if (!direction || !containerEl || !document.body.contains(containerEl)) return;
        event.preventDefault();
        sendDirection(direction);
      };
      window.addEventListener('keydown', window._sbKeyHandler);

      if (window._sbResizeHandler) window.removeEventListener('resize', window._sbResizeHandler);
      window._sbResizeHandler = resize;
      window.addEventListener('resize', window._sbResizeHandler);

      if (window._sbFsHandler) window.removeEventListener('gn:fullscreen', window._sbFsHandler);
      window._sbFsHandler = function () {
        resize();
        requestAnimationFrame(resize);
      };
      window.addEventListener('gn:fullscreen', window._sbFsHandler);
    },

    render: function (state, _container, playerIndex) {
      window._sbState = state;
      window._sbPlayerIndex = playerIndex;
      if (!canvas) return;

      var now = performance.now();
      var isFirstRender = !targetSnapshot;
      var isReset = !isFirstRender && state.tick < targetSnapshot.tick;
      var nextSnap = snapshot(state);

      if (isFirstRender || isReset) {
        previousSnapshot = null;
        targetSnapshot = nextSnap;
        animationStart = now;
        foodAnim = null;
        floatingTexts = [];
        deathAnims = {};
        if (isReset) prevScores = null;
      } else if (state.tick !== targetSnapshot.tick) {
        var prev = targetSnapshot;
        previousSnapshot = prev;
        targetSnapshot = nextSnap;
        animationStart = now;

        // Detect food spawn/move -> 200 ms pop-in
        if (nextSnap.food && (!prev.food || prev.food.x !== nextSnap.food.x || prev.food.y !== nextSnap.food.y)) {
          foodAnim = { x: nextSnap.food.x, y: nextSnap.food.y, start: now };
        }

        // Detect score gains (+N floating text) and snake deaths (400 ms break-apart/fade once)
        nextSnap.snakes.forEach(function (snake, index) {
          var prevSnake = prev.snakes[index];
          if (!prevSnake) return;
          if (snake.score > prevSnake.score && snake.body && snake.body.length > 0) {
            var gain = snake.score - prevSnake.score;
            floatingTexts.push({
              text: '+' + gain,
              gx: snake.body[0].x + 0.5,
              gy: snake.body[0].y + 0.35,
              color: COLORS[index % COLORS.length],
              start: now,
            });
          }
          if (prevSnake.alive && !snake.alive && !deathAnims[index]) {
            deathAnims[index] = {
              start: now,
              done: false,
              vectors: makeDeathVectors(snake.body, index),
            };
          }
        });
      }

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      updateInfo(state, playerIndex, isFirstRender || isReset);

      if (!canvas.style.width || lastFsMode !== isFullscreen()) {
        resize();
        if (hasActiveAnimations(now)) rafId = requestAnimationFrame(drawAnimationFrame);
      } else {
        drawAnimationFrame(now);
      }
    },
  });
})();
