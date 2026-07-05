(function () {
  var canvas, ctx, containerEl, swipeStart, previousSnapshot, targetSnapshot, animationStart, rafId;
  var ANIMATION_MS = 125;
  var COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffb300', '#ab47bc', '#26a69a'];
  var KEY_TO_DIRECTION = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

  function sendDirection(direction) {
    var state = window._sbState;
    var me = state && state.snakes && state.snakes[window._sbPlayerIndex];
    if (!state || state.winner != null || !me || !me.alive) return;
    window.makeGameMove({ direction: direction });
  }

  function resize() {
    if (!canvas || !window._sbState) return;
    var state = window._sbState;
    var width = Math.max(280, Math.min(window.innerWidth - 28, 620));
    var height = Math.round(width * state.height / state.width);
    var dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr;
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawAnimationFrame(performance.now());
  }

  function draw(state, playerIndex) {
    if (!canvas || !ctx) return;
    var width = parseFloat(canvas.style.width) || 320;
    var height = parseFloat(canvas.style.height) || Math.round(width * state.height / state.width);
    var cell = Math.min(width / state.width, height / state.height);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#18231f'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1;
    for (var x = 0; x <= state.width; x++) { ctx.beginPath(); ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, height); ctx.stroke(); }
    for (var y = 0; y <= state.height; y++) { ctx.beginPath(); ctx.moveTo(0, y * cell); ctx.lineTo(width, y * cell); ctx.stroke(); }
    if (state.food) {
      ctx.font = Math.max(16, cell * .82) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🍎', (state.food.x + .5) * cell, (state.food.y + .52) * cell);
    }
    state.snakes.forEach(function (snake, index) {
      snake.body.forEach(function (part, partIndex) {
        var inset = Math.max(1.5, cell * .1), size = cell - inset * 2;
        ctx.globalAlpha = snake.alive ? (partIndex === 0 ? 1 : .84) : .17;
        ctx.fillStyle = COLORS[index % COLORS.length];
        ctx.beginPath(); ctx.roundRect(part.x * cell + inset, part.y * cell + inset, size, size, Math.max(3, cell * .22)); ctx.fill();
        if (partIndex === 0) {
          ctx.strokeStyle = index === playerIndex ? '#fff5bf' : 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(1.5, cell * .08); ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    });
    if (state.winner != null) {
      ctx.fillStyle = 'rgba(0,0,0,.52)'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 ' + Math.max(21, width * .075) + 'px system-ui';
      ctx.fillText(state.winner === -1 ? _t('sb_draw_canvas') : state.winner === playerIndex ? _t('sb_you_survived_canvas') : _tf('sb_player_wins_canvas', state.winner + 1), width / 2, height / 2);
    }
  }

  function snapshot(state) {
    return {
      width: state.width, height: state.height, food: state.food && { x: state.food.x, y: state.food.y }, winner: state.winner,
      snakes: state.snakes.map(function (snake) { return { player: snake.player, alive: snake.alive, score: snake.score, body: snake.body.map(function (cell) { return { x: cell.x, y: cell.y }; }) }; }),
    };
  }

  function interpolateBody(previous, target, progress) {
    if (!previous || !previous.alive || !target.alive || previous.body.length !== target.body.length) return target.body;
    return target.body.map(function (cell, index) {
      var old = previous.body[index];
      return { x: old.x + (cell.x - old.x) * progress, y: old.y + (cell.y - old.y) * progress };
    });
  }

  function interpolatedState(progress) {
    if (!previousSnapshot) return targetSnapshot;
    return {
      width: targetSnapshot.width, height: targetSnapshot.height, food: targetSnapshot.food, winner: targetSnapshot.winner,
      snakes: targetSnapshot.snakes.map(function (snake, index) {
        return { player: snake.player, alive: snake.alive, score: snake.score, body: interpolateBody(previousSnapshot.snakes[index], snake, progress) };
      }),
    };
  }

  function drawAnimationFrame(now) {
    if (!targetSnapshot) return;
    var progress = previousSnapshot ? Math.min(1, (now - animationStart) / ANIMATION_MS) : 1;
    draw(interpolatedState(progress), window._sbPlayerIndex);
    if (progress < 1) rafId = requestAnimationFrame(drawAnimationFrame);
    else rafId = null;
  }

  function updateInfo(state, playerIndex) {
    var status = document.getElementById('sbStatus'), players = document.getElementById('sbPlayers');
    if (players) players.innerHTML = state.snakes.map(function (snake, index) {
      var name = window.gamePlayers && window.gamePlayers[index] ? window.gamePlayers[index].name : _t('sb_player_prefix') + (index + 1);
      return '<span class="sb-player' + (index === playerIndex ? ' sb-self' : '') + (!snake.alive ? ' sb-out' : '') + '"><i style="background:' + COLORS[index % COLORS.length] + '"></i>' + name + ' · ' + snake.score + '</span>';
    }).join('');
    if (!status) return;
    var me = state.snakes[playerIndex];
    status.textContent = state.winner != null ? (state.winner === -1 ? _t('sb_draw') : state.winner === playerIndex ? _t('sb_you_survived') : _t('sb_game_over')) : (!me || !me.alive ? _t('sb_eliminated') : _t('sb_controls'));
  }

  function installStyles() {
    if (document.getElementById('sb-styles')) return;
    var style = document.createElement('style'); style.id = 'sb-styles';
    style.textContent = '.sb-shell{width:100%;display:flex;flex-direction:column;align-items:center;gap:12px}.sb-players{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;min-height:28px}.sb-player{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #e8e8e8;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800;color:#3a3a3a}.sb-player i{width:9px;height:9px;border-radius:50%;display:block}.sb-player.sb-self{border-color:#c8a45c;box-shadow:0 0 0 2px rgba(200,164,92,.15)}.sb-player.sb-out{opacity:.38;text-decoration:line-through}.sb-canvas{display:block;border-radius:18px;box-shadow:0 10px 26px rgba(21,44,34,.23);touch-action:none;background:#18231f}.sb-status{min-height:22px;text-align:center;color:#6a6a6a;font-size:14px;font-weight:700}.sb-pad{display:grid;grid-template-columns:repeat(3,58px);grid-template-rows:repeat(2,52px);gap:7px;justify-content:center}.sb-pad button{border:0;border-radius:14px;background:#fff;color:#25382e;font-size:22px;font-weight:900;box-shadow:0 3px 10px rgba(0,0,0,.12);touch-action:manipulation}.sb-pad button:active{transform:scale(.92);background:#e4f2e9}.sb-pad .sb-up{grid-column:2}.sb-pad .sb-left{grid-column:1;grid-row:2}.sb-pad .sb-down{grid-column:2;grid-row:2}.sb-pad .sb-right{grid-column:3;grid-row:2}@media(max-width:380px){.sb-pad{grid-template-columns:repeat(3,52px);grid-template-rows:repeat(2,47px)}.sb-player{font-size:11px;padding:4px 7px}}';
    document.head.appendChild(style);
  }

  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('snakebattle', {
    init: function (container) {
      containerEl = container; installStyles();
      previousSnapshot = null; targetSnapshot = null; animationStart = 0;
      if (rafId) cancelAnimationFrame(rafId);
      container.innerHTML = '<div class="sb-shell"><div id="sbPlayers" class="sb-players"></div><canvas id="sbCanvas" class="sb-canvas"></canvas><div id="sbStatus" class="sb-status"></div><div class="sb-pad"><button class="sb-up" data-direction="up">▲</button><button class="sb-left" data-direction="left">◀</button><button class="sb-down" data-direction="down">▼</button><button class="sb-right" data-direction="right">▶</button></div></div>';
      canvas = document.getElementById('sbCanvas'); ctx = canvas.getContext('2d');
      container.querySelectorAll('[data-direction]').forEach(function (button) { button.addEventListener('click', function () { sendDirection(button.dataset.direction); }); });
      canvas.addEventListener('pointerdown', function (event) { swipeStart = { x: event.clientX, y: event.clientY }; });
      canvas.addEventListener('pointerup', function (event) {
        if (!swipeStart) return; var dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y; swipeStart = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
        sendDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      });
      if (window._sbKeyHandler) window.removeEventListener('keydown', window._sbKeyHandler);
      window._sbKeyHandler = function (event) { var direction = KEY_TO_DIRECTION[event.key]; if (!direction || !containerEl || !document.body.contains(containerEl)) return; event.preventDefault(); sendDirection(direction); };
      window.addEventListener('keydown', window._sbKeyHandler); window.addEventListener('resize', resize);
    },
    render: function (state, container, playerIndex) {
      window._sbState = state; window._sbPlayerIndex = playerIndex;
      if (!canvas) return;
      if (targetSnapshot && state.tick !== targetSnapshot.tick) previousSnapshot = targetSnapshot;
      targetSnapshot = snapshot(state);
      animationStart = performance.now();
      if (rafId) cancelAnimationFrame(rafId);
      if (!canvas.style.width) resize(); else drawAnimationFrame(animationStart);
      updateInfo(state, playerIndex);
    },
  });
})();
