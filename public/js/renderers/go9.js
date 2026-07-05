// Go 9x9 renderer v3 — large board, beautiful gradient stones, correct values
// Server: EMPTY=0, BLACK=1, WHITE=2
(function() {
  window.gameRenderers = window.gameRenderers || new Map();
  var SIZE = 9;
  var STAR = [[2,2],[2,6],[6,2],[6,6]];
  var canvas, ctx, W, margin, cs;

  window.gameRenderers.set('go9', {
    init: function(container) {
      container.innerHTML = `
        <div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:14px;">
          <canvas id="goCanvas" style="width:100%;display:block;border-radius:18px;box-shadow:0 4px 24px rgba(0,0,0,.08);touch-action:manipulation;"></canvas>
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center;">
            <button id="goPassBtn" class="btn btn-outline btn-sm" style="padding:12px 32px;font-size:16px;border-radius:28px;">` + _t('go_pass') + `</button>
            <div id="goInfo" style="font-size:15px;color:var(--text);text-align:center;font-weight:600;min-width:160px;line-height:1.5;"></div>
          </div>
        </div>`;
      canvas = document.getElementById('goCanvas');
      ctx = canvas.getContext('2d');
      var resize = function() {
        var avW = window.innerWidth - (window.innerWidth > 600 ? 80 : 32);
        var avH = window.innerHeight - 240;
        W = Math.min(avW, avH, 900);
        W = Math.max(W, 240);
        var dpr = window.devicePixelRatio || 1;
        margin = W * 0.06;
        cs = (W - margin*2) / (SIZE - 1);
        var pad = 24;
        var size = W;
        canvas.width = size * dpr; canvas.height = size * dpr;
        canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
        ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr, dpr);
      };
      resize(); window.addEventListener('resize', resize);

      document.getElementById('goPassBtn').addEventListener('click', function() {
        window.makeGameMove({ pass: true });
      });

      canvas.addEventListener('click', function(e) {
        var r = canvas.getBoundingClientRect();
        var x = (e.clientX - r.left) * (W / r.width);
        var y = (e.clientY - r.top) * (W / r.width);
        var col = Math.round((x - margin) / cs);
        var row = Math.round((y - margin) / cs);
        if (col < 0 || col >= SIZE || row < 0 || row >= SIZE) return;
        var state = window._goState;
        var pi = parseInt(sessionStorage.getItem('playerIndex'));
        if (!state || state.winner != null) return;
        if (state.currentPlayer !== pi) return;
        window.makeGameMove({ row: row, col: col });
      });
    },
    render: function(state, container, playerIndex, winner) {
      window._goState = state;
      if (!canvas) return;
      ctx.clearRect(0, 0, W, W);

      // === Board (golden wood color) ===
      var bgGrad = ctx.createLinearGradient(0, 0, W, W);
      bgGrad.addColorStop(0, '#dab860'); bgGrad.addColorStop(0.5, '#c9a345'); bgGrad.addColorStop(1, '#b8902a');
      ctx.fillStyle = bgGrad;
      var bpad = margin - 10;
      var bsize = cs*(SIZE-1) + 20;
      ctx.beginPath(); rrect(ctx, bpad, bpad, bsize, bsize, 8); ctx.fill();

      // Wood grain
      ctx.strokeStyle = 'rgba(120,80,10,0.04)'; ctx.lineWidth = 0.8;
      for (var i = 0; i < 15; i++) {
        var gy = bpad + bsize*(i/14); ctx.beginPath();
        ctx.moveTo(bpad, gy); ctx.lineTo(bpad+bsize, gy+Math.sin(gy*0.2)*10); ctx.stroke();
      }

      // === Grid ===
      ctx.strokeStyle = '#3a2005'; ctx.lineWidth = 1.5;
      for (var i = 0; i < SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(margin, margin+i*cs); ctx.lineTo(margin+(SIZE-1)*cs, margin+i*cs); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(margin+i*cs, margin); ctx.lineTo(margin+i*cs, margin+(SIZE-1)*cs); ctx.stroke();
      }

      // Star points
      for (var si = 0; si < STAR.length; si++) {
        var sr = STAR[si][0], sc = STAR[si][1];
        ctx.fillStyle = '#3a2005'; ctx.beginPath();
        ctx.arc(margin+sc*cs, margin+sr*cs, cs*0.14, 0, Math.PI*2); ctx.fill();
      }

      // === Stones ===
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          var s = state.board[r][c];
          if (s === 0) continue; // EMPTY

          var sx = margin + c*cs, sy = margin + r*cs;
          var rad = cs * 0.43;

          // Shadow
          ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath();
          ctx.arc(sx + 2.5, sy + 3.5, rad, 0, Math.PI*2); ctx.fill();

          // Stone gradient
          var grad = ctx.createRadialGradient(sx-rad*0.3, sy-rad*0.3, rad*0.08, sx, sy, rad);
          if (s === 1) { // BLACK(1)
            grad.addColorStop(0, '#555'); grad.addColorStop(0.5, '#2a2a2a'); grad.addColorStop(1, '#111');
          } else { // WHITE(2)
            grad.addColorStop(0, '#fff'); grad.addColorStop(0.4, '#f8f8f8'); grad.addColorStop(1, '#ddd');
          }
          ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI*2); ctx.fill();

          // Border
          ctx.strokeStyle = s === 1 ? '#000' : '#bbb'; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI*2); ctx.stroke();

          // Ko marker (red dot)
          if (state.koPoint && state.koPoint.row === r && state.koPoint.col === c) {
            ctx.fillStyle = '#d44'; ctx.beginPath(); ctx.arc(sx, sy, rad*0.28, 0, Math.PI*2); ctx.fill();
          }

          // Last move marker
          if (state.moveHistory && state.moveHistory.length > 0) {
            var last = state.moveHistory[state.moveHistory.length-1];
            if (!last.pass && last.row === r && last.col === c) {
              ctx.fillStyle = s === 1 ? '#fff' : '#000';
              ctx.beginPath(); ctx.arc(sx, sy, rad*0.22, 0, Math.PI*2); ctx.fill();
            }
          }
        }
      }

      // === Captures display ===
      var cy = W - margin * 0.4;
      ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'left'; ctx.fillText(_t('go_captures_black') + ((state.captures||[])[0]||0), margin, cy);
      ctx.textAlign = 'right'; ctx.fillText(_t('go_captures_white') + ((state.captures||[])[1]||0) + ' ⚪', W-margin, cy);

      // === Info ===
      var info = document.getElementById('goInfo');
      var passBtn = document.getElementById('goPassBtn');
      if (info) {
        if (state.winner != null) {
          var w = state.winner;
          info.innerHTML = w === -1 ? _t('go_draw') : (w === playerIndex ? _t('go_win') : _t('go_lose'));
          if (state.finalScores) info.innerHTML += '<br><span style="font-size:12px;color:var(--text-muted);">' + _t('go_score_black') + state.finalScores.black.toFixed(1) + _t('go_score_mid') + state.finalScores.white.toFixed(1) + _t('go_score_komi') + '</span>';
        } else {
          info.textContent = state.currentPlayer === playerIndex ? _t('go_your_turn') : _t('go_opponent_turn');
        }
      }
      if (passBtn) passBtn.style.display = (state.currentPlayer === playerIndex && state.winner == null) ? '' : 'none';
    }
  });

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
    ctx.arcTo(x+w, y, x+w, y+r, r); ctx.lineTo(x+w, y+h-r);
    ctx.arcTo(x+w, y+h, x+w-r, y+h, r); ctx.lineTo(x+r, y+h);
    ctx.arcTo(x, y+h, x, y+h-r, r); ctx.lineTo(x, y+r);
    ctx.arcTo(x, y, x+r, y, r); ctx.closePath();
  }
})();
