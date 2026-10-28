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
})();
