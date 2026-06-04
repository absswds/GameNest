// Chinese Chess renderer v3 — large board, wood texture, beautifully drawn pieces
(function() {
  window.gameRenderers = window.gameRenderers || new Map();
  var ROWS = 10, COLS = 9;
  var PIECE_NAMES = {
    K:{0:'帅',1:'将'}, R:{0:'车',1:'車'}, H:{0:'马',1:'馬'},
    C:{0:'炮',1:'砲'}, E:{0:'相',1:'象'}, A:{0:'仕',1:'士'}, P:{0:'兵',1:'卒'}
  };
  var canvas, ctx, W, margin, cs;
  var selRow = -1, selCol = -1; // selected piece

  window.gameRenderers.set('chinesechess', {
    init: function(container) {
      canvas = document.createElement('canvas');
      canvas.id = 'ccCanvas';
      canvas.style.cssText = 'width:100%;display:block;border-radius:16px;touch-action:manipulation;';
      container.appendChild(canvas);
      ctx = canvas.getContext('2d');
      var resize = function() {
        var avW = window.innerWidth - (window.innerWidth > 600 ? 80 : 32);
        var avH = window.innerHeight - 240;
        W = Math.min(avW, avH, 960);
        W = Math.max(W, 240);
        var dpr = window.devicePixelRatio || 1;
        cs = (W - 60) / (COLS - 1); // cell size
        margin = 30;
        var H = margin*2 + cs*(ROWS-1);
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr, dpr);
      };
      resize(); window.addEventListener('resize', resize);

      canvas.addEventListener('click', function(e) {
        var r = canvas.getBoundingClientRect();
        var x = (e.clientX - r.left) * (W / r.width);
        var y = (e.clientY - r.top) * (W / r.width);
        var col = Math.round((x - margin) / cs);
        var row = Math.round((y - margin) / cs);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) { selRow = -1; return; }
        var state = window._ccState;
        var pi = parseInt(sessionStorage.getItem('playerIndex'));
        if (!state || state.winner != null) return;
        if (state.currentPlayer !== pi) { selRow = -1; return; }
        if (selRow >= 0 && selCol >= 0) {
          window.makeGameMove({
            from: { row: selRow, col: selCol },
            to: { row: row, col: col }
          });
          selRow = -1; selCol = -1;
        } else {
          var piece = state.board[row][col];
          if (piece && piece.side === pi) { selRow = row; selCol = col; }
          else { selRow = -1; selCol = -1; }
        }
      });
    },
    render: function(state, container, playerIndex, winner) {
      window._ccState = state;
      if (!canvas || !state || !state.board) return;
      ctx.clearRect(0, 0, canvas.width/(window.devicePixelRatio||1), canvas.height/(window.devicePixelRatio||1));
      var boardH = cs * (ROWS - 1);

      // === Board background (wood gradient) ===
      var bgGrad = ctx.createLinearGradient(0, 0, W, boardH+margin*2);
      bgGrad.addColorStop(0, '#e8c97a'); bgGrad.addColorStop(0.5, '#dfb85a'); bgGrad.addColorStop(1, '#d4a840');
      ctx.fillStyle = bgGrad;
      ctx.beginPath(); rrect(ctx, margin-16, margin-16, cs*(COLS-1)+32, boardH+32, 10); ctx.fill();

      // Inner shadow effect
      ctx.fillStyle = '#d4a535';
      ctx.beginPath(); rrect(ctx, margin-8, margin-8, cs*(COLS-1)+16, boardH+16, 6); ctx.fill();

      // Wood grain lines (subtle)
      ctx.strokeStyle = 'rgba(139,90,20,0.06)'; ctx.lineWidth = 1;
      for (var i = 0; i < 12; i++) {
        var gy = margin + boardH * (i/11); ctx.beginPath();
        ctx.moveTo(margin-8, gy); ctx.lineTo(margin+cs*(COLS-1)+8, gy+Math.sin(gy*0.1)*8); ctx.stroke();
      }

      // === Grid lines ===
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.5;
      var riverTop = margin + 4*cs, riverBot = margin + 5*cs;

      // Horizontals
      for (var r = 0; r < ROWS; r++) {
        ctx.beginPath(); ctx.moveTo(margin, margin+r*cs);
        ctx.lineTo(margin+(COLS-1)*cs, margin+r*cs); ctx.stroke();
      }
      // Verticals
      for (var c = 0; c < COLS; c++) {
        var x = margin + c*cs;
        if (c === 0 || c === COLS-1) {
          ctx.beginPath(); ctx.moveTo(x, margin); ctx.lineTo(x, margin+boardH); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.moveTo(x, margin); ctx.lineTo(x, riverTop); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, riverBot); ctx.lineTo(x, margin+boardH); ctx.stroke();
        }
      }

      // Palace diagonals
      var drawPalace = function(tr) {
        ctx.beginPath(); ctx.moveTo(margin+3*cs, margin+tr*cs); ctx.lineTo(margin+5*cs, margin+(tr+2)*cs); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(margin+5*cs, margin+tr*cs); ctx.lineTo(margin+3*cs, margin+(tr+2)*cs); ctx.stroke();
      };
      drawPalace(0); drawPalace(7);

      // River text
      ctx.fillStyle = '#5a3a1a'; ctx.font = 'bold '+(cs*0.46)+'px "KaiTi","楷体","STKaiti",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('楚   河', margin+cs*1.6, margin+4.5*cs);
      ctx.fillText('汉   界', margin+cs*6.4, margin+4.5*cs);

      // === Pieces ===
      var radius = cs * 0.42;
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var piece = state.board[r][c];
          if (!piece) continue;
          var px = margin + c*cs, py = margin + r*cs;
          var isRed = piece.side === 0;
          var isSel = selRow === r && selCol === c;

          // Selection glow
          if (isSel) {
            var glow = ctx.createRadialGradient(px, py, radius*0.6, px, py, radius+7);
            glow.addColorStop(0, 'rgba(255,215,0,0.6)'); glow.addColorStop(1, 'rgba(255,215,0,0)');
            ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, radius+7, 0, Math.PI*2); ctx.fill();
          }

          // Piece shadow
          ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(px+2.5, py+3.5, radius, 0, Math.PI*2); ctx.fill();

          // Piece body — radial gradient for 3D effect
          var grad = ctx.createRadialGradient(px-radius*0.25, py-radius*0.25, radius*0.05, px, py, radius);
          grad.addColorStop(0, '#fffef5'); grad.addColorStop(0.5, '#f0e8c8'); grad.addColorStop(1, '#d4c8a0');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI*2); ctx.fill();

          // Outer ring
          ctx.strokeStyle = isRed ? '#c04040' : '#1a1a1a'; ctx.lineWidth = 2.8;
          ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI*2); ctx.stroke();

          // Inner ring
          ctx.strokeStyle = isRed ? '#c04040' : '#1a1a1a'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(px, py, radius*0.78, 0, Math.PI*2); ctx.stroke();

          // Character
          ctx.fillStyle = isRed ? '#b02020' : '#111';
          ctx.font = 'bold '+(radius*1.2)+'px "KaiTi","楷体","STKaiti","SimSun",serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          var name = (PIECE_NAMES[piece.type]||{})[piece.side] || piece.type;
          ctx.fillText(name, px, py+1.5);

          // Selection highlight ring
          if (isSel) {
            ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 3;
            ctx.setLineDash([4,3]);
            ctx.beginPath(); ctx.arc(px, py, radius+4, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // === Status bar ===
      var sy = margin + boardH + 22;
      ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center';
      if (state.winner != null) {
        ctx.fillText(state.winner === playerIndex ? '🏆 你赢了！' : '😢 你输了', W/2, sy);
      } else {
        if (state.currentPlayer === playerIndex) {
          ctx.fillStyle = '#c8a45c'; ctx.fillText('▼ 轮到你走棋 ▼', W/2, sy);
        } else {
          var cp = (window.gamePlayers||[])[state.currentPlayer];
          ctx.fillText('对手回合 · ' + (cp ? cp.name : '等待中'), W/2, sy);
        }
      }
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
