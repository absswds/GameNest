(function() {
  window.injectStylesOnce = function(id, css) {
    if (document.getElementById(id)) return;
    var s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  };

  // Space a board canvas can use without horizontal overflow or vertical scrolling:
  // the container's real width, and the height from its top edge to the bottom of the screen.
  window.boardFit = function(container) {
    // #boardArea shrinks to its content, so measure the stage wrapper around it instead
    var box = container && (container.closest('.board-wrap') || container.parentElement || container);
    var w = window.innerWidth - 32;
    if (box && box.clientWidth) {
      var cs = getComputedStyle(box);
      w = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    }
    var top = container ? container.getBoundingClientRect().top + (window.scrollY || 0) : 240;
    // The 120px floor keeps room for the action bar under the board. The side layout (square
    // boards on wide or sideways screens) puts that bar in its own column, and on a phone held
    // sideways (~375px tall) the board matters more than keeping the bar on screen.
    var stage = box && box.closest('#gameStage.stage-side');
    var sideways = window.innerHeight < 540 && window.innerWidth > window.innerHeight;
    var floor = sideways || (stage && getComputedStyle(stage).display === 'grid') ? 0 : 120;
    var h = window.innerHeight - Math.max(floor, Math.min(top, 320)) - 24;
    return { w: w, h: h };
  };

  // Pulsing red ring around a checked king, shared by the chess and chinesechess canvases.
  // ring = { x, y, r, start } in canvas pixels. Returns false once the 1.2 s pulse is over.
  window.drawCheckRing = function(ctx, ring, now) {
    var elapsed = (now || performance.now()) - ring.start;
    if (elapsed >= 1200) return false;
    var pulse = 0.5 + 0.5 * Math.sin((elapsed / 200) * Math.PI);
    ctx.save();
    ctx.strokeStyle = 'rgba(220, 38, 38, ' + (0.45 + 0.5 * pulse) + ')';
    ctx.lineWidth = 3 + 2 * pulse;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r * (0.42 + 0.08 * pulse), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return true;
  };

  // Find the king of `side` on a board of { type, side } cells, or null.
  window.findKingCell = function(board, side) {
    for (var r = 0; r < board.length; r++) {
      for (var c = 0; c < (board[r] || []).length; c++) {
        var p = board[r][c];
        if (p && p.type === 'K' && p.side === side) return { row: r, col: c };
      }
    }
    return null;
  };
})();
