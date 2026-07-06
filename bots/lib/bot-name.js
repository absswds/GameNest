// bots/lib/bot-name.js
function botName(playerIndex, lang) {
  var n = playerIndex + 1;
  if (lang === 'en') return 'Bot ' + n;
  return '电脑' + n;
}
module.exports = { botName };
