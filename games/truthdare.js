// games/truthdare.js
// 真心话大冒险 — party helper for drawing shared truth/dare cards.

const { pick } = require('./lib/i18n');

exports.name = 'truthdare';
exports.maxPlayers = 10;
exports.minPlayers = 2;

const BUILTIN_DECKS = {
  icebreaker: {
    name: '轻松破冰',
    nameEn: 'Icebreaker',
    truth: [
      {text: '最近让你笑出声的一件小事是什么？', textEn: 'What small thing made you laugh out loud recently?'},
      {text: '如果今天可以重来一次，你最想重来哪个瞬间？', textEn: 'If you could redo today, which moment would you choose?'},
      {text: '你小时候最相信的一件离谱事情是什么？', textEn: 'What absurd thing did you believe as a child?'},
      {text: '最近一次被别人温柔到是什么时候？', textEn: 'When was the last time someone\u0027s kindness touched you?'},
      {text: '你最喜欢别人怎么夸你？', textEn: 'How do you most like being complimented?'},
      {text: '如果给自己取一个游戏昵称，你会叫什么？', textEn: 'If you picked a gaming username, what would it be?'},
    ],
    dare: [
      {text: '用三种表情连续自拍，给大家看最后一张。', textEn: 'Take 3 consecutive selfies with different expressions, show the last one.'},
      {text: '用播音腔介绍现场的一位玩家。', textEn: 'Introduce a player in a broadcaster voice.'},
      {text: '选一个人，认真夸 TA 15 秒。', textEn: 'Pick someone and sincerely compliment them for 15 seconds.'},
      {text: '模仿一种动物 10 秒。', textEn: 'Imitate an animal for 10 seconds.'},
      {text: '用一句话给今晚的聚会起标题。', textEn: 'Give tonight\u0027s party a one-line title.'},
      {text: '做一个你觉得最像\u201c胜利者\u201d的姿势。', textEn: 'Strike a pose you think looks most like \u201cvictor\u201d.'},
    ],
  },
  party: {
    name: '朋友聚会',
    nameEn: 'Party',
    truth: [
      {text: '在场谁最容易把气氛带起来？为什么？', textEn: 'Who here is best at livening up the atmosphere? Why?'},
      {text: '你最近一次社死经历是什么？', textEn: 'What was your most recent embarrassing moment?'},
      {text: '如果必须和在场一位玩家组队闯关，你选谁？', textEn: 'If you had to team up with one player here, who would it be?'},
      {text: '你手机里最近一张照片是什么内容？', textEn: 'What\u0027s the latest photo in your phone?'},
      {text: '你最受不了朋友哪种迟到理由？', textEn: 'What late excuse from a friend annoys you most?'},
      {text: '你觉得自己最像哪种桌游角色？', textEn: 'Which board game character do you resemble most?'},
    ],
    dare: [
      {text: '让大家给你指定一个 pose，保持 10 秒。', textEn: 'Let everyone pick a pose for you, hold it for 10 seconds.'},
      {text: '随机给通讯录里一位朋友发一个表情包。', textEn: 'Send a random sticker to someone in your contacts.'},
      {text: '用方言或奇怪口音说一句\u201c我输了但我很优雅\u201d。', textEn: 'Say \u201cI lost but I\u2019m graceful\u201d in a dialect or funny accent.'},
      {text: '和左手边的人击掌，并喊一句队名。', textEn: 'High-five the person to your left and shout a team name.'},
      {text: '闭眼指出今晚最有冠军相的人。', textEn: 'Point with closed eyes to who looks most like tonight\u0027s champion.'},
      {text: '用不超过 5 个字评价每位玩家。', textEn: 'Describe each player in under 5 words.'},
    ],
  },
  deep: {
    name: '深度真心话',
    nameEn: 'Deep Talk',
    truth: [
      {text: '你最近在为什么事情偷偷努力？', textEn: 'What have you been quietly working on recently?'},
      {text: '你最希望朋友理解你的哪一点？', textEn: 'What do you wish your friends understood about you?'},
      {text: '哪一刻你觉得自己真的长大了？', textEn: 'When did you feel you truly grew up?'},
      {text: '你最想保留现在生活里的哪件事？', textEn: 'What part of your current life do you want to keep most?'},
      {text: '有没有一句话对你影响很久？', textEn: 'Is there a quote that has influenced you for a long time?'},
      {text: '你最近最想感谢谁？', textEn: 'Who do you most want to thank recently?'},
    ],
    dare: [
      {text: '给一位玩家说一句真诚的感谢。', textEn: 'Give a sincere thank you to another player.'},
      {text: '分享一个你最近收藏的好东西。', textEn: 'Share something good you recently bookmarked/discovered.'},
      {text: '对自己说一句鼓励的话，声音要让大家听见。', textEn: 'Say an encouraging phrase to yourself loud enough for everyone.'},
      {text: '选一个人，请 TA 给你一个小建议。', textEn: 'Pick someone and ask them for a piece of advice.'},
      {text: '讲一个你坚持了很久的小习惯。', textEn: 'Share a small habit you\u0027ve kept for a long time.'},
      {text: '说出现场每个人一个你欣赏的点。', textEn: 'Name one quality you appreciate about each person here.'},
    ],
  },
  challenge: {
    name: '大冒险挑战',
    nameEn: 'Challenge',
    truth: [
      {text: '你最怕被朋友发现的小习惯是什么？', textEn: 'What small habit are you afraid your friends might discover?'},
      {text: '如果必须公开一个黑历史，你会选哪一个？', textEn: 'If you had to reveal an embarrassing past, which one would you pick?'},
      {text: '你觉得自己最不适合参加哪类综艺？', textEn: 'What type of show would you be worst at?'},
      {text: '你曾经为了面子硬撑过什么？', textEn: 'What did you pretend was fine just to save face?'},
      {text: '你最近一次嘴硬是什么时候？', textEn: 'When was the last time you refused to admit you were wrong?'},
      {text: '你最容易被哪句话破防？', textEn: 'What kind of remark gets to you the most emotionally?'},
    ],
    dare: [
      {text: '原地转三圈后说一句超自信的话。', textEn: 'Spin around 3 times then say something super confident.'},
      {text: '用夸张表情读出最近一条非隐私消息。', textEn: 'Read your most recent non-private message with exaggerated expression.'},
      {text: '让大家投票指定你模仿一个角色。', textEn: 'Have everyone vote on a character for you to imitate.'},
      {text: '用身体摆出一个汉字，让大家猜。', textEn: 'Use your body to form a Chinese character, let everyone guess.'},
      {text: '唱一句你脑子里现在出现的歌。', textEn: 'Sing a line of whatever song is in your head right now.'},
      {text: '给自己设计一个 5 秒钟出场动画。', textEn: 'Design a 5-second entrance animation for yourself.'},
    ],
  },
};

exports.createState = () => ({
  players: 0,
  currentPlayer: 0,
  winner: null,
  decks: {},
  enabledDecks: [],
  currentCard: null,
  history: [],
  drawCount: 0,
});

exports.getDefaultDecks = function () {
  return cloneDecks(BUILTIN_DECKS);
};

exports.initGame = function (state, playerCount) {
  const options = state._options || {};
  state.players = playerCount;
  state.currentPlayer = 0;
  state.winner = null;
  state.decks = buildDecks(options);
  state.enabledDecks = normalizeEnabledDecks(options.enabledDecks, state.decks);
  state.currentCard = null;
  state.history = [];
  state.drawCount = 0;
};

exports.handleMove = function (data, state, playerIndex) {
  if (!state || state.winner !== null) return 'g_game_over';
  const action = data && data.action;
  if (action !== 'draw') return 'g_unknown_action';

  let kind = data.kind || 'random';
  if (kind !== 'truth' && kind !== 'dare' && kind !== 'random') {
    return 'td_choose_kind';
  }

  if (kind === 'random') {
    const truthCards = collectCards(state, 'truth');
    const dareCards = collectCards(state, 'dare');
    if (truthCards.length === 0 && dareCards.length > 0) kind = 'dare';
    else if (dareCards.length === 0 && truthCards.length > 0) kind = 'truth';
    else kind = Math.random() < 0.5 ? 'truth' : 'dare';
  }

  let cards = collectCards(state, kind);
  if (cards.length === 0) {
    state.decks = buildDecks({});
    state.enabledDecks = Object.keys(state.decks);
    cards = collectCards(state, kind);
  }
  if (cards.length === 0) return 'td_empty_deck';

  const picked = cards[Math.floor(Math.random() * cards.length)];
  const card = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    kind,
    text: picked.text,
    textEn: picked.textEn || picked.text,
    deck: picked.deck,
    deckName: picked.deckName,
    deckNameEn: picked.deckNameEn || picked.deckName,
    player: playerIndex,
    at: Date.now(),
  };

  state.currentCard = card;
  state.drawCount = (state.drawCount || 0) + 1;
  state.history.unshift(card);
  if (state.history.length > 12) state.history.length = 12;
  return null;
};

function buildDecks(options) {
  const decks = cloneDecks(BUILTIN_DECKS);
  const customTruth = splitCustomCards(options.customTruths);
  const customDare = splitCustomCards(options.customDares);
  decks.custom = {
    name: '自定义',
    nameEn: 'Custom',
    truth: customTruth,
    dare: customDare,
  };
  return decks;
}

function normalizeEnabledDecks(enabled, decks) {
  const allKeys = Object.keys(decks);
  if (!Array.isArray(enabled) || enabled.length === 0) {
    return allKeys.filter(key => key !== 'custom' || hasCards(decks.custom));
  }
  const valid = enabled.filter(key => decks[key] && (key !== 'custom' || hasCards(decks.custom)));
  return valid.length > 0 ? valid : allKeys.filter(key => key !== 'custom' || hasCards(decks.custom));
}

function collectCards(state, kind) {
  const decks = state.decks && Object.keys(state.decks).length ? state.decks : buildDecks({});
  const enabled = normalizeEnabledDecks(state.enabledDecks, decks);
  const cards = [];
  enabled.forEach(deckKey => {
    const deck = decks[deckKey];
    if (!deck || !Array.isArray(deck[kind])) return;
    deck[kind].forEach(card => {
      if (typeof card === 'string') {
        cards.push({ text: card, textEn: card, deck: deckKey, deckName: deck.name || deckKey, deckNameEn: deck.nameEn || deckKey });
      } else {
        cards.push({ text: card.text, textEn: card.textEn || card.text, deck: deckKey, deckName: deck.name || deckKey, deckNameEn: deck.nameEn || deckKey });
      }
    });
  });
  return cards;
}

function splitCustomCards(text) {
  if (typeof text !== 'string') return [];
  return text
    .split(/\r?\n|[;；]/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 80);
}

function hasCards(deck) {
  return !!deck && ((deck.truth && deck.truth.length > 0) || (deck.dare && deck.dare.length > 0));
}

function cloneDecks(decks) {
  const out = {};
  Object.keys(decks).forEach(key => {
    out[key] = {
      name: decks[key].name,
      nameEn: decks[key].nameEn || decks[key].name,
      truth: decks[key].truth.slice(),
      dare: decks[key].dare.slice(),
    };
  });
  return out;
}
