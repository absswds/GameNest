// bots/lib/difficulty.js
// Read difficulty option from state and map to depth
function getDepth(state, depthMap) {
  var diff = (state._options && state._options.difficulty) || 'normal';
  return depthMap[diff] || depthMap.normal || 3;
}

// For heuristic bots: get difficulty level string
function getDifficulty(state) {
  return (state._options && state._options.difficulty) || 'normal';
}

module.exports = { getDepth, getDifficulty };
