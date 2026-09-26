// public/js/renderers/tictactoe.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();
  var LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  var MARK_X = '<svg class="ttt-mark" viewBox="0 0 40 40" aria-hidden="true"><path pathLength="1" d="M11 11 29 29"/><path pathLength="1" d="M29 11 11 29"/></svg>';
  var MARK_O = '<svg class="ttt-mark" viewBox="0 0 40 40" aria-hidden="true"><circle pathLength="1" cx="20" cy="20" r="10.5"/></svg>';
  var prevBoard = null;

  window.gameRenderers.set('tictactoe', {
    init: function(container) {
      container.innerHTML = '<div class="ttt-grid" id="tttBoard"></div>';
      prevBoard = null;
      var board = document.getElementById('tttBoard');
      for (var i = 0; i < 9; i++) {
        var cell = document.createElement('button');
        cell.className = 'ttt-cell';
        cell.dataset.cell = i;
        cell.addEventListener('click', function() {
          window.makeGameMove({ cell: parseInt(this.dataset.cell) });
        });
        board.appendChild(cell);
      }
    },
    render: function(state, container, playerIndex, winner) {
      var cells = document.querySelectorAll('.ttt-cell');
      if (cells.length === 0) return;
      var myTurn = (winner === null || winner === undefined || winner < 0) && state.currentPlayer === playerIndex;
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        var idx = parseInt(c.dataset.cell);
        var v = state.board[idx];
        var was = prevBoard ? prevBoard[idx] : v;
        if (v !== was || c.dataset.v !== String(v)) {
          c.innerHTML = v === 0 ? MARK_X : v === 1 ? MARK_O : '';
          c.dataset.v = String(v);
          // Draw-in animation only for a freshly placed mark
          if (v !== null && prevBoard && was === null) c.classList.add('ttt-new');
          else c.classList.remove('ttt-new');
        }
        c.className = 'ttt-cell' + (v === 0 ? ' p1' : v === 1 ? ' p2' : '') + (v !== null ? ' taken' : '') +
          (c.classList.contains('ttt-new') ? ' ttt-new' : '') + (v === null && myTurn ? ' open' : '');
        c.disabled = v !== null;
      }
      prevBoard = state.board.slice();
      if (winner >= 0) {
        for (var li = 0; li < LINES.length; li++) {
          var a = LINES[li][0], b = LINES[li][1], cc = LINES[li][2];
          if (state.board[a] === winner && state.board[a] === state.board[b] && state.board[b] === state.board[cc]) {
            [a, b, cc].forEach(function(k) {
              var el = document.querySelector('[data-cell="' + k + '"]');
              if (el) el.classList.add('win-cell');
            });
          }
        }
      }
    }
  });
})();
