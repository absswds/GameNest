// bots/lib/difficulty.js
// Read difficulty option from state and map to depth or heuristic behavior.

function getDifficulty(state) {
  return (state && state._options && state._options.difficulty) || 'normal';
}

function getDepth(state, depthMap) {
  const diff = getDifficulty(state);
  return depthMap[diff] || depthMap.normal || 3;
}

function isEasy(state) {
  return getDifficulty(state) === 'easy';
}

function isHard(state) {
  return getDifficulty(state) === 'hard';
}

function maybeBlunder(diff, blunderProb, bestAction, fallbackAction) {
  if (diff === 'easy' && Math.random() < blunderProb) {
    return typeof fallbackAction === 'function' ? fallbackAction() : fallbackAction;
  }
  return typeof bestAction === 'function' ? bestAction() : bestAction;
}

module.exports = { getDepth, getDifficulty, isEasy, isHard, maybeBlunder };
