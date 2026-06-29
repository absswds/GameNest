// games/truthdare.js
// 真心话大冒险 — party helper for drawing shared truth/dare cards.

exports.name = 'truthdare';
exports.maxPlayers = 10;
exports.minPlayers = 2;

const BUILTIN_DECKS = {
  icebreaker: {
    name: '轻松破冰',
    truth: [
      '最近让你笑出声的一件小事是什么？',
      '如果今天可以重来一次，你最想重来哪个瞬间？',
      '你小时候最相信的一件离谱事情是什么？',
      '最近一次被别人温柔到是什么时候？',
      '你最喜欢别人怎么夸你？',
      '如果给自己取一个游戏昵称，你会叫什么？',
    ],
    dare: [
      '用三种表情连续自拍，给大家看最后一张。',
      '用播音腔介绍现场的一位玩家。',
      '选一个人，认真夸 TA 15 秒。',
      '模仿一种动物 10 秒。',
      '用一句话给今晚的聚会起标题。',
      '做一个你觉得最像“胜利者”的姿势。',
    ],
  },
  party: {
    name: '朋友聚会',
    truth: [
      '在场谁最容易把气氛带起来？为什么？',
      '你最近一次社死经历是什么？',
      '如果必须和在场一位玩家组队闯关，你选谁？',
      '你手机里最近一张照片是什么内容？',
      '你最受不了朋友哪种迟到理由？',
      '你觉得自己最像哪种桌游角色？',
    ],
    dare: [
      '让大家给你指定一个 pose，保持 10 秒。',
      '随机给通讯录里一位朋友发一个表情包。',
      '用方言或奇怪口音说一句“我输了但我很优雅”。',
      '和左手边的人击掌，并喊一句队名。',
      '闭眼指出今晚最有冠军相的人。',
      '用不超过 5 个字评价每位玩家。',
    ],
  },
  deep: {
    name: '深度真心话',
    truth: [
      '你最近在为什么事情偷偷努力？',
      '你最希望朋友理解你的哪一点？',
      '哪一刻你觉得自己真的长大了？',
      '你最想保留现在生活里的哪件事？',
      '有没有一句话对你影响很久？',
      '你最近最想感谢谁？',
    ],
    dare: [
      '给一位玩家说一句真诚的感谢。',
      '分享一个你最近收藏的好东西。',
      '对自己说一句鼓励的话，声音要让大家听见。',
      '选一个人，请 TA 给你一个小建议。',
      '讲一个你坚持了很久的小习惯。',
      '说出现场每个人一个你欣赏的点。',
    ],
  },
  challenge: {
    name: '大冒险挑战',
    truth: [
      '你最怕被朋友发现的小习惯是什么？',
      '如果必须公开一个黑历史，你会选哪一个？',
      '你觉得自己最不适合参加哪类综艺？',
      '你曾经为了面子硬撑过什么？',
      '你最近一次嘴硬是什么时候？',
      '你最容易被哪句话破防？',
    ],
    dare: [
      '原地转三圈后说一句超自信的话。',
      '用夸张表情读出最近一条非隐私消息。',
      '让大家投票指定你模仿一个角色。',
      '用身体摆出一个汉字，让大家猜。',
      '唱一句你脑子里现在出现的歌。',
      '给自己设计一个 5 秒钟出场动画。',
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
  if (!state || state.winner !== null) return '游戏已结束';
  const action = data && data.action;
  if (action !== 'draw') return '未知操作';

  let kind = data.kind || 'random';
  if (kind !== 'truth' && kind !== 'dare' && kind !== 'random') {
    return '请选择真心话或大冒险';
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
  if (cards.length === 0) return '当前牌库没有可抽的卡';

  const picked = cards[Math.floor(Math.random() * cards.length)];
  const card = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    kind,
    text: picked.text,
    deck: picked.deck,
    deckName: picked.deckName,
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
    deck[kind].forEach(text => cards.push({
      text,
      deck: deckKey,
      deckName: deck.name || deckKey,
    }));
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
      truth: decks[key].truth.slice(),
      dare: decks[key].dare.slice(),
    };
  });
  return out;
}
