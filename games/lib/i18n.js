// Shared helper for bilingual state narratives (server-side)
exports.pick = function (state, zh, en) {
  return state && state._lang === 'en' ? (en || zh) : zh;
};
