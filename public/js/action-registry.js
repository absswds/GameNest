(function() {
  var actions = {};
  window.registerAction = function(name, fn) {
    actions[name] = fn;
    window[name] = fn;
  };
  window.unregisterAllActions = function() {
    for (var k in actions) { delete window[k]; }
    actions = {};
  };
})();
