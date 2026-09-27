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
    var h = window.innerHeight - Math.max(120, Math.min(top, 320)) - 24;
    return { w: w, h: h };
  };
})();
