// public/js/renderers/tictactoe.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();
  var LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  window.gameRenderers.set('tictactoe', {
    init: function(container) {
      container.innerHTML = '<div class="ttt-grid" id="tttBoard"></div>';
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
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        var idx = parseInt(c.dataset.cell);
        var v = state.board[idx];
        c.textContent = v === 0 ? 'X' : v === 1 ? 'O' : '';
        c.className = 'ttt-cell' + (v === 0 ? ' p1' : v === 1 ? ' p2' : '') + (v !== null ? ' taken' : '');
      }
      if (winner >= 0) {
        for (var li = 0; li < LINES.length; li++) {
          var a = LINES[li][0], b = LINES[li][1], cc = LINES[li][2];
          if (state.board[a] === winner && state.board[a] === state.board[b] && state.board[b] === state.board[cc]) {
            var el = document.querySelector('[data-cell="' + a + '"]'); if (el) el.classList.add('win-cell');
            el = document.querySelector('[data-cell="' + b + '"]'); if (el) el.classList.add('win-cell');
            el = document.querySelector('[data-cell="' + cc + '"]'); if (el) el.classList.add('win-cell');
          }
        }
      }
    }
  });
})();
