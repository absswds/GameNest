(function() {
  window.snapshotBoard = function(board) {
    if (!board) return null;
    return board.map(function(row) { return row.slice(); });
  };

  window.diffBoard = function(prev, curr) {
    if (!prev || !curr) return null;
    var changes = [];
    for (var r = 0; r < prev.length; r++) {
      for (var c = 0; c < prev[r].length; c++) {
        if (prev[r][c] !== curr[r][c]) {
          changes.push({ row: r, col: c, from: prev[r][c], to: curr[r][c] });
        }
      }
    }
    return changes.length > 0 ? changes : null;
  };
})();
