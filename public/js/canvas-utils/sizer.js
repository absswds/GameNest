(function() {
  window.createCanvasSizer = function(canvas, opts) {
    opts = opts || {};
    var topPad = opts.topPad || 0;
    var bottomPad = opts.bottomPad || 0;
    var sidePad = opts.sidePad || 0;
    var maxWidth = opts.maxWidth || Infinity;

    function resize() {
      var w = window.innerWidth - sidePad * 2;
      var h = window.innerHeight - topPad - bottomPad;
      var size = Math.min(w, h, maxWidth);
      canvas.width = size;
      canvas.height = size;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      return size;
    }

    var listeners = [];
    function onResize(fn) { listeners.push(fn); }

    var resizeHandler = function() {
      resize();
      for (var i = 0; i < listeners.length; i++) listeners[i]();
    };
    window.addEventListener('resize', resizeHandler);

    return {
      resize: resize,
      onResize: onResize,
      destroy: function() { window.removeEventListener('resize', resizeHandler); }
    };
  };
})();
