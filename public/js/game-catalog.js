(function() {
  // Built-in Chinese catalog (fallback when language packs aren't loaded)
  var zhCatalog = {
    tictactoe: {
      id: 'tictactoe',
      name: '井字棋',
      icon: '✦',
      subtitle: '三子连线，最快开局',
      description: '适合两个人热身的一分钟对局。',
      players: '2人',
      duration: '约1分钟',
      category: '经典棋盘',
      tags: ['快节奏', '新手友好'],
      featured: false,
      supportsAI: true,
      maxPlayers: 2,
      cover: ''
    },
    gomoku: {
      id: 'gomoku',
      name: '五子棋',
      icon: '●',
      subtitle: '十五路攻防，五子成线',
      description: '更稳更长线的经典落子博弈。',
      players: '2人',
      duration: '约5分钟',
      category: '经典棋盘',
      tags: ['策略', '对弈'],
      featured: false,
      supportsAI: true,
      maxPlayers: 2,
      cover: ''
    },
    davinci: {
      id: 'davinci',
      name: '达芬奇密码',
      icon: '🧠',
      subtitle: '推理猜牌，步步试探',
      description: '通过数字与颜色推断对手隐藏牌。',
      players: '2-6人',
      duration: '约15分钟',
      category: '推理卡牌',
      tags: ['推理', '读心'],
      featured: false,
      supportsAI: true,
      maxPlayers: 6,
      cover: ''
    },
    uno: {
      id: 'uno',
      name: 'UNO',
      icon: '🃏',
      subtitle: '颜色接龙，一张定胜负',
      description: '轻松上手，适合聚会里的热闹一桌。',
      players: '2-6人',
      duration: '约10分钟',
      category: '派对卡牌',
      tags: ['经典', '聚会'],
      featured: false,
      supportsAI: true,
      maxPlayers: 6,
      cover: ''
    },
    doudizhu: {
      id: 'doudizhu',
      name: '斗地主',
      icon: '♠',
      subtitle: '叫地主，抢节奏',
      description: '经典三人扑克，带 AI 也能随时开局。',
      players: '2-3人',
      duration: '约10分钟',
      category: '扑克竞技',
      tags: ['经典', '三人局'],
      featured: false,
      supportsAI: true,
      maxPlayers: 3,
      cover: ''
    },
    'exploding-kittens': {
      id: 'exploding-kittens',
      name: '爆炸猫',
      icon: '💣',
      subtitle: '抽牌避险，反转不断',
      description: '轻派对向的运气与道具牌博弈。',
      players: '2-6人',
      duration: '约15分钟',
      category: '派对卡牌',
      tags: ['欢乐', '反转'],
      featured: false,
      supportsAI: true,
      maxPlayers: 6,
      cover: ''
    },
    rummikub: {
      id: 'rummikub',
      name: '魔力桥',
      icon: '▦',
      subtitle: '拆牌重组，手感很足',
      description: '一边排数字，一边重构桌面组合。',
      players: '2-4人',
      duration: '约15分钟',
      category: '桌面策略',
      tags: ['组合', '耐玩'],
      featured: false,
      supportsAI: true,
      maxPlayers: 4,
      cover: ''
    },
    twentyfour: {
      id: 'twentyfour',
      name: '24点',
      icon: '24',
      subtitle: '四数速算，抢答定输赢',
      description: '适合一群人一起拼脑速的快节奏竞速题。',
      players: '2-6人',
      duration: '约5分钟',
      category: '脑力竞速',
      tags: ['计算', '多人同屏'],
      featured: false,
      supportsAI: true,
      maxPlayers: 6,
      cover: ''
    },
    minesweeper: {
      id: 'minesweeper',
      name: '扫雷竞速',
      icon: '✹',
      subtitle: '同图对冲，失误即出局',
      description: '同一雷区比手感，紧张感很直接。',
      players: '2-6人',
      duration: '约5分钟',
      category: '脑力竞速',
      tags: ['速度', '观察'],
      featured: false,
      supportsAI: false,
      maxPlayers: 6,
      cover: ''
    },
    numberbomb: {
      id: 'numberbomb',
      name: '数字炸弹',
      icon: '#',
      subtitle: '缩小范围，别踩中雷',
      description: '社交局里最容易瞬间上头的猜数字小游戏。',
      players: '2-10人',
      duration: '约10分钟',
      category: '派对卡牌',
      tags: ['社交', '猜测'],
      featured: false,
      supportsAI: true,
      maxPlayers: 10,
      cover: ''
    },
    oldmaid: {
      id: 'oldmaid',
      name: '抽鬼牌',
      icon: '👻',
      subtitle: '配对弃牌，躲开鬼牌',
      description: '非常适合多人放松局的轻卡牌玩法。',
      players: '2-6人',
      duration: '约15分钟',
      category: '派对卡牌',
      tags: ['轻松', '多人'],
      featured: false,
      supportsAI: true,
      maxPlayers: 6,
      cover: ''
    },
    liarsbar: {
      id: 'liarsbar',
      name: '骗子酒馆',
      icon: '♣',
      subtitle: '虚张声势，抓住破绽',
      description: '半 bluff 半社交，心理战味道很足。',
      players: '2-6人',
      duration: '约15分钟',
      category: '推理卡牌',
      tags: ['心理战', '嘴炮'],
      featured: false,
      supportsAI: true,
      maxPlayers: 6,
      cover: ''
    },
    bigtwo: {
      id: 'bigtwo',
      name: '大老二',
      icon: '♠',
      subtitle: '顺牌压制，先出完获胜',
      description: '节奏干脆的传统扑克对抗。',
      players: '2-4人',
      duration: '约10分钟',
      category: '扑克竞技',
      tags: ['出牌博弈', '传统'],
      featured: false,
      supportsAI: true,
      maxPlayers: 4,
      cover: ''
    },
    texas: {
      id: 'texas',
      name: '德州扑克',
      icon: 'A',
      subtitle: '下注，读牌，翻盘',
      description: '最适合做成夜局气氛的一桌扑克。',
      players: '2-8人',
      duration: '约20分钟',
      category: '扑克竞技',
      tags: ['筹码', '博弈'],
      featured: true,
      supportsAI: true,
      maxPlayers: 8,
      cover: '/assets/game-covers/texas-table.png'
    },
    flightchess: {
      id: 'flightchess',
      name: '飞行棋',
      icon: '✈',
      subtitle: '掷骰起飞，冲刺回家',
      description: '最适合家庭局和朋友局的轻竞争棋盘。',
      players: '2-4人',
      duration: '约10分钟',
      category: '经典棋盘',
      tags: ['家庭局', '轻松'],
      featured: true,
      supportsAI: true,
      maxPlayers: 4,
      cover: '/assets/game-covers/flightchess-race.png'
    },
    snakebattle: {
      id: 'snakebattle',
      name: '贪吃蛇大乱斗',
      icon: 'S',
      subtitle: '同图生存，撞线淘汰',
      description: '实时对撞，节奏比桌游更像街机乱斗。',
      players: '2-6人',
      duration: '约5分钟',
      category: '实时对战',
      tags: ['街机', '刺激'],
      featured: false,
      supportsAI: true,
      maxPlayers: 6,
      cover: ''
    },
    chinesechess: {
      id: 'chinesechess',
      name: '中国象棋',
      icon: '楚',
      subtitle: '木纹棋盘，稳扎稳打',
      description: '双人长线对弈，适合沉浸式下棋。',
      players: '2人',
      duration: '约20分钟',
      category: '经典棋盘',
      tags: ['深度', '传统'],
      featured: false,
      supportsAI: true,
      maxPlayers: 2,
      cover: ''
    },
    chess: {
      id: 'chess',
      name: '国际象棋',
      icon: '♟',
      subtitle: '王车易位，升变将军',
      description: '完整 FIDE 规则的双人国际象棋。',
      players: '2人',
      duration: '约15分钟',
      category: '经典棋盘',
      tags: ['深度', '经典'],
      featured: false,
      supportsAI: true,
      maxPlayers: 2,
      cover: ''
    },
    checkers: {
      id: 'checkers',
      name: '西洋跳棋',
      icon: '◉',
      subtitle: '强制吃子，升王反击',
      description: '8×8 经典跳棋，连吃与升王。',
      players: '2人',
      duration: '约10分钟',
      category: '经典棋盘',
      tags: ['经典', '易学'],
      featured: false,
      supportsAI: true,
      maxPlayers: 2,
      cover: ''
    },
    connect4: {
      id: 'connect4',
      name: '四子棋',
      icon: '🔴',
      subtitle: '重力下落，四子连珠',
      description: '7×6 经典重力棋，全家欢乐。',
      players: '2人',
      duration: '约5分钟',
      category: '经典棋盘',
      tags: ['亲子', '快节奏'],
      featured: false,
      supportsAI: true,
      maxPlayers: 2,
      cover: ''
    },
    reversi: {
      id: 'reversi',
      name: '黑白棋',
      icon: '◐',
      subtitle: '翻转夹击，棋多者胜',
      description: '8×8 Othello，一步翻盘。',
      players: '2人',
      duration: '约10分钟',
      category: '经典棋盘',
      tags: ['策略', '反转'],
      featured: false,
      supportsAI: true,
      maxPlayers: 2,
      cover: ''
    },
    go9: {
      id: 'go9',
      name: '围棋 9路',
      icon: '○',
      subtitle: '短局围棋，落子见功',
      description: '更快结束的小棋盘围棋，非常适合线上玩。',
      players: '2人',
      duration: '约15分钟',
      category: '经典棋盘',
      tags: ['围地', '短局'],
      featured: false,
      supportsAI: true,
      maxPlayers: 2,
      cover: ''
    },
    monopoly: {
      id: 'monopoly',
      name: '大富翁',
      icon: 'M',
      subtitle: '买地建房，越滚越大',
      description: '买地建房加事件卡，谁经营到最后？',
      players: '2-6人',
      duration: '约20分钟',
      category: '桌面策略',
      tags: ['经营', '事件卡'],
      featured: true,
      supportsAI: true,
      maxPlayers: 6,
      cover: '/assets/game-covers/monopoly-golden-city.png'
    },
    suikabattle: {
      id: 'suikabattle',
      name: '合成大西瓜',
      icon: '◔',
      subtitle: '物理掉落，越合越大',
      description: '水果物理碰撞，实时对战拼手速。',
      players: '2-4人',
      duration: '约10分钟',
      category: '实时对战',
      tags: ['物理', '爽感'],
      featured: true,
      supportsAI: false,
      maxPlayers: 4,
      cover: '/assets/game-covers/suika-fruit-arena.png'
    },
    sheeptile: {
      id: 'sheeptile',
      name: '羊了个羊',
      icon: 'Y',
      subtitle: '三消堆叠，清盘才赢',
      description: '层叠三消，和对手比拼清盘速度。',
      players: '2-6人',
      duration: '约10分钟',
      category: '脑力竞速',
      tags: ['消除', '堆叠'],
      featured: true,
      supportsAI: true,
      maxPlayers: 6,
      cover: '/assets/game-covers/sheeptile-pasture.png'
    },
    drawguess: {
      id: 'drawguess',
      name: '你画我猜',
      icon: '✎',
      subtitle: '传话接龙，越歪越好笑',
      description: '传话接龙式猜词，画得越歪越好笑。',
      players: '2-8人',
      duration: '约15分钟',
      category: '派对卡牌',
      tags: ['社交', '欢乐'],
      featured: true,
      supportsAI: false,
      maxPlayers: 8,
      cover: '/assets/game-covers/drawguess-party.png'
    },
    hearts: {
      id: 'hearts',
      name: '红心大战',
      icon: '♥',
      subtitle: '避分夺分，射月逆转',
      description: '经典 4 人吃墩牌局，红心 1 分黑桃 Q 13 分。',
      players: '4人',
      duration: '约20分钟',
      category: '扑克竞技',
      tags: ['吃墩', '策略'],
      featured: false,
      supportsAI: true,
      maxPlayers: 4,
      cover: ''
    },
    truthdare: {
      id: 'truthdare',
      name: '真心话大冒险',
      icon: '?',
      subtitle: '抽卡问答，派对破冰',
      description: '多种主题卡组，聚会暖场必备。',
      players: '2-10人',
      duration: '约15分钟',
      category: '派对聚会',
      tags: ['社交', '轻松'],
      supportsAI: false,
      maxPlayers: 10,
      cover: '/assets/game-covers/truthdare.png'
    }
  };

  var catalog = zhCatalog;

  Object.keys(catalog).forEach(function(id) {
    if (!catalog[id].cover) {
      catalog[id].cover = '/assets/game-covers/' + id + '.png';
    }
  });

  const order = [
    'monopoly',
    'flightchess',
    'sheeptile',
    'suikabattle',
    'drawguess',
    'texas',
    'uno',
    'doudizhu',
    'davinci',
    'rummikub',
    'liarsbar',
    'bigtwo',
    'hearts',
    'tictactoe',
    'gomoku',
    'chinesechess',
    'chess',
    'checkers',
    'connect4',
    'reversi',
    'go9',
    'twentyfour',
    'minesweeper',
    'numberbomb',
    'oldmaid',
    'exploding-kittens',
    'truthdare',
    'snakebattle'
  ];

  function getLangPack() {
    var lang = (window.__ACTIVE_LANG === 'en' && window.__LANG && window.__LANG.en && window.__LANG.en.catalog) ? 'en' : 'zh';
    return window.__LANG && window.__LANG[lang] && window.__LANG[lang].catalog;
  }

  function withId(id) {
    var entry = catalog[id];
    if (!entry) return null;
    // Merge language pack over base catalog for localized fields
    var lp = getLangPack();
    if (lp && lp[id]) {
      return Object.assign({}, entry, lp[id]);
    }
    return Object.assign({}, entry);
  }

  window.gameCatalog = {
    byId: function(id) {
      return withId(id);
    },
    list: function() {
      return order.map(withId).filter(Boolean);
    },
    featured: function() {
      return order.map(withId).filter(function(item) {
        return item && item.featured;
      });
    },
    categories: function() {
      var seen = {};
      var result = [];
      order.forEach(function(id) {
        var item = catalog[id];
        if (!item) return;
        var cat = item.category;
        var lp = getLangPack();
        if (lp && lp[id] && lp[id].category) cat = lp[id].category;
        if (seen[cat]) return;
        seen[cat] = true;
        result.push(cat);
      });
      return result;
    }
  };
})();
