// games/monopoly.js — 大富翁（简化版）
// 28格棋盘，无拍卖无交易，有房产/机会/税收/监狱等
exports.name = 'monopoly';
exports.maxPlayers = 6;

const JAIL_INDEX = 7; // 监狱探视格（go_to_jail 把玩家送到这里）
const BOARD = buildBoard();

function buildBoard() {
  // 28 格对称棋盘：4 个角 (0=GO, 7=监狱探视, 14=免费停车, 21=入狱) + 每边 6 格
  // 色组 group 0-5，长度 2/3/3/3/3/2 = 16 块地产；4 铁路；1 电力；2 机会；1 税
  return [
    { type: 'go' },                                                                                  // 0  角：起点
    { type: 'property', name: '廉租房',  price: 60,  rent: [2,10,30,90,160,250],    color: '#8B5A2B', group: 0 }, // 1
    { type: 'chance' },                                                                               // 2
    { type: 'property', name: '旧街道',  price: 60,  rent: [4,20,60,180,320,450],   color: '#8B5A2B', group: 0 }, // 3
    { type: 'tax', name: '所得税', amount: 200 },                                                     // 4
    { type: 'railroad', name: '北站', price: 200 },                                                   // 5
    { type: 'property', name: '东方路',  price: 100, rent: [6,30,90,270,400,550],   color: '#5DADE2', group: 1 }, // 6
    { type: 'jail_visit' },                                                                           // 7  角：监狱探视
    { type: 'property', name: '南京路',  price: 100, rent: [6,30,90,270,400,550],   color: '#5DADE2', group: 1 }, // 8
    { type: 'property', name: '淮海路',  price: 120, rent: [8,40,100,300,450,600],  color: '#5DADE2', group: 1 }, // 9
    { type: 'utility', name: '电力公司', price: 150 },                                                // 10
    { type: 'property', name: '龙华寺',  price: 140, rent: [10,50,150,450,625,750], color: '#E91E8C', group: 2 }, // 11
    { type: 'railroad', name: '南站', price: 200 },                                                   // 12
    { type: 'property', name: '新天地',  price: 140, rent: [10,50,150,450,625,750], color: '#E91E8C', group: 2 }, // 13
    { type: 'free_parking' },                                                                         // 14 角：免费停车
    { type: 'property', name: '外滩',    price: 160, rent: [12,60,180,500,700,900], color: '#E91E8C', group: 2 }, // 15
    { type: 'property', name: '豫园',    price: 180, rent: [14,70,200,550,750,950], color: '#F39C12', group: 3 }, // 16
    { type: 'chance' },                                                                               // 17
    { type: 'property', name: '城隍庙',  price: 180, rent: [14,70,200,550,750,950], color: '#F39C12', group: 3 }, // 18
    { type: 'property', name: '人民广场',price: 200, rent: [16,80,220,600,800,1000],color: '#F39C12', group: 3 }, // 19
    { type: 'railroad', name: '西站', price: 200 },                                                   // 20
    { type: 'go_to_jail' },                                                                           // 21 角：入狱！
    { type: 'property', name: '环球港',  price: 220, rent: [18,90,250,700,875,1050],color: '#E74C3C', group: 4 }, // 22
    { type: 'property', name: '徐汇滨江',price: 220, rent: [18,90,250,700,875,1050],color: '#E74C3C', group: 4 }, // 23
    { type: 'property', name: '陆家嘴',  price: 240, rent: [20,100,300,750,925,1100],color: '#E74C3C', group: 4 }, // 24
    { type: 'railroad', name: '东站', price: 200 },                                                   // 25
    { type: 'property', name: '浦东机场',price: 260, rent: [22,110,330,800,975,1150],color: '#F1C40F', group: 5 }, // 26
    { type: 'property', name: '迪士尼',  price: 280, rent: [24,120,360,850,1025,1200],color: '#F1C40F', group: 5 }, // 27
  ];
}

const CHANCE_CARDS = [
  { text: '收到银行股息，得 50元', amount: 50 },
  { text: '纳税申报，付 100元', amount: -100 },
  { text: '中了彩票！得 200元', amount: 200 },
  { text: '房屋维修费，付 150元', amount: -150 },
  { text: '生日快乐！每位玩家送你 50元', type: 'birthday', amount: 50 },
  { text: '保险赔付，得 100元', amount: 100 },
  { text: '交通罚款，付 50元', amount: -50 },
  { text: '前进到起点，得 200元', type: 'goto', target: 0 },
  { text: '直接入狱！', type: 'jail' },
  { text: '度假归来，得 100元', amount: 100 },
  { text: '水管爆裂，付 80元', amount: -80 },
  { text: '投资获利，得 150元', amount: 150 },
  { text: '缴纳学费，付 100元', amount: -100 },
  { text: '找到钱包，得 50元', amount: 50 },
  { text: '慈善捐款，付 100元', amount: -100 },
  { text: '股票大涨，得 250元', amount: 250 },
  { text: '前进3格', type: 'advance', steps: 3 },
  { text: '后退2格', type: 'advance', steps: -2 },
  { text: '免租一次（保留此卡）', type: 'free_rent' },
  { text: '收缴经营所得，得 100元', amount: 100 },
];

const BOARD_SIZE = BOARD.length; // 28

exports.createState = () => ({
  phase: 'waiting', // waiting → rolling → landed → buying → end_turn
  positions: [],
  cash: [],
  properties: {}, // {spaceIndex: {owner, houses}}
  inJail: [],
  jailTurns: [],
  eliminated: [],
  currentPlayer: 0,
  dice: [0, 0],
  lastCard: null,
  winner: null,
  _playerCount: 0,
  pendingAction: null, // 'can_buy', null
  freeRentCards: [], // boolean per player
  board: BOARD,        // 下发给前端，渲染器读这份（避免常量双份同步）
  lastMove: null,      // {player, from, to, steps, passedGo, kind:'walk'|'teleport'} 供动画
  lastRent: null,      // {payer, owner, amount, space} 供动画
});

exports.initGame = (state, playerCount) => {
  state._playerCount = playerCount;
  state.positions = Array(playerCount).fill(0);
  state.cash = Array(playerCount).fill(1500);
  state.properties = {};
  state.inJail = Array(playerCount).fill(false);
  state.jailTurns = Array(playerCount).fill(0);
  state.eliminated = Array(playerCount).fill(false);
  state.currentPlayer = 0;
  state.phase = 'waiting';
  state.lastCard = null;
  state.winner = null;
  state.pendingAction = null;
  state.freeRentCards = Array(playerCount).fill(false);
  state.board = BOARD;
  state.lastMove = null;
  state.lastRent = null;
};

function rollDice() {
  return [Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)];
}

function checkBankruptcy(state) {
  for (let i = 0; i < state._playerCount; i++) {
    if (!state.eliminated[i] && state.cash[i] < 0) {
      state.eliminated[i] = true;
      // Release all properties
      for (const [idx, prop] of Object.entries(state.properties)) {
        if (prop.owner === i) delete state.properties[idx];
      }
    }
  }
  const alive = state.eliminated.filter(e => !e).length;
  if (alive === 1) {
    state.winner = state.eliminated.indexOf(false);
    state.phase = 'gameover';
  } else if (alive === 0) {
    state.winner = 0;
    state.phase = 'gameover';
  }
}

function nextPlayer(state) {
  let next = (state.currentPlayer + 1) % state._playerCount;
  let loops = 0;
  while (state.eliminated[next] && loops < state._playerCount) {
    next = (next + 1) % state._playerCount;
    loops++;
  }
  state.currentPlayer = next;
  state.phase = 'waiting';
  state.pendingAction = null;
  state.lastCard = null;
  state.lastMove = null;
  state.lastRent = null;
}

function applyLanding(state, playerIndex) {
  const pos = state.positions[playerIndex];
  const space = BOARD[pos];
  if (!space) { state.phase = 'end_turn'; return; }

  if (space.type === 'go_to_jail') {
    state.lastMove = { player: playerIndex, from: pos, to: JAIL_INDEX, steps: 0, passedGo: false, kind: 'teleport' };
    state.positions[playerIndex] = JAIL_INDEX;
    state.inJail[playerIndex] = true;
    state.jailTurns[playerIndex] = 0;
    state.phase = 'end_turn';
    return;
  }

  if (space.type === 'property') {
    const prop = state.properties[pos];
    if (!prop) {
      // Unowned
      state.pendingAction = 'can_buy';
      state.phase = 'landed';
    } else if (prop.owner === playerIndex) {
      state.phase = 'end_turn';
    } else {
      // Pay rent
      const houses = prop.houses || 0;
      let rent = space.rent[houses];
      // Check monopoly (all in group owned by same person)
      const groupSpaces = BOARD.map((s, i) => ({ s, i })).filter(x => x.s && x.s.group === space.group);
      const monopoly = groupSpaces.every(x => state.properties[x.i] && state.properties[x.i].owner === prop.owner);
      if (monopoly && houses === 0) rent *= 2;
      if (state.freeRentCards[playerIndex]) {
        state.freeRentCards[playerIndex] = false;
        state.lastCard = { text: '使用免租卡，本次免租！' };
        state.lastRent = { payer: playerIndex, owner: prop.owner, amount: 0, space: pos };
      } else {
        state.cash[playerIndex] -= rent;
        state.cash[prop.owner] += rent;
        state.lastRent = { payer: playerIndex, owner: prop.owner, amount: rent, space: pos };
      }
      checkBankruptcy(state);
      if (state.phase !== 'gameover') state.phase = 'end_turn';
    }
    return;
  }

  if (space.type === 'railroad') {
    const prop = state.properties[pos];
    if (!prop) {
      state.pendingAction = 'can_buy';
      state.phase = 'landed';
    } else if (prop.owner !== playerIndex) {
      // Count railroads owned
      let rrCount = 0;
      BOARD.forEach((s, i) => { if (s && s.type === 'railroad' && state.properties[i] && state.properties[i].owner === prop.owner) rrCount++; });
      const rent = [25, 50, 100, 200][rrCount - 1] || 25;
      state.cash[playerIndex] -= rent;
      state.cash[prop.owner] += rent;
      state.lastRent = { payer: playerIndex, owner: prop.owner, amount: rent, space: pos };
      checkBankruptcy(state);
      if (state.phase !== 'gameover') state.phase = 'end_turn';
    } else {
      state.phase = 'end_turn';
    }
    return;
  }

  if (space.type === 'utility') {
    const prop = state.properties[pos];
    if (!prop) {
      state.pendingAction = 'can_buy';
      state.phase = 'landed';
    } else if (prop.owner !== playerIndex) {
      const mult = 4; // simplified
      const rent = (state.dice[0] + state.dice[1]) * mult;
      state.cash[playerIndex] -= rent;
      state.cash[prop.owner] += rent;
      state.lastRent = { payer: playerIndex, owner: prop.owner, amount: rent, space: pos };
      checkBankruptcy(state);
      if (state.phase !== 'gameover') state.phase = 'end_turn';
    } else {
      state.phase = 'end_turn';
    }
    return;
  }

  if (space.type === 'chance') {
    const card = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
    state.lastCard = card;
    if (card.type === 'birthday') {
      for (let i = 0; i < state._playerCount; i++) {
        if (i !== playerIndex && !state.eliminated[i]) {
          state.cash[i] -= card.amount;
          state.cash[playerIndex] += card.amount;
        }
      }
    } else if (card.type === 'goto') {
      const passed = state.positions[playerIndex] > card.target;
      if (passed) state.cash[playerIndex] += 200;
      const fwd = ((card.target - pos) + BOARD_SIZE) % BOARD_SIZE;
      state.lastMove = { player: playerIndex, from: pos, to: card.target, steps: fwd, passedGo: passed, kind: 'walk' };
      state.positions[playerIndex] = card.target;
    } else if (card.type === 'jail') {
      state.lastMove = { player: playerIndex, from: pos, to: JAIL_INDEX, steps: 0, passedGo: false, kind: 'teleport' };
      state.positions[playerIndex] = JAIL_INDEX;
      state.inJail[playerIndex] = true;
      state.jailTurns[playerIndex] = 0;
    } else if (card.type === 'advance') {
      const np = ((state.positions[playerIndex] + card.steps) + BOARD_SIZE) % BOARD_SIZE;
      const passedGo = card.steps > 0 && np < pos;
      if (passedGo) state.cash[playerIndex] += 200;
      state.lastMove = { player: playerIndex, from: pos, to: np, steps: card.steps, passedGo: passedGo, kind: 'walk' };
      state.positions[playerIndex] = np;
    } else if (card.type === 'free_rent') {
      state.freeRentCards[playerIndex] = true;
    } else if (card.amount) {
      state.cash[playerIndex] += card.amount;
    }
    checkBankruptcy(state);
    if (state.phase !== 'gameover') state.phase = 'end_turn';
    return;
  }

  if (space.type === 'tax') {
    state.cash[playerIndex] -= space.amount;
    checkBankruptcy(state);
    if (state.phase !== 'gameover') state.phase = 'end_turn';
    return;
  }

  // GO, jail_visit, free_parking: nothing happens
  state.phase = 'end_turn';
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.phase === 'gameover') return '游戏已结束';
  if (state.eliminated[playerIndex]) return '你已出局';
  if (state.currentPlayer !== playerIndex) return '还没轮到你';

  if (data.type === 'roll') {
    if (state.phase !== 'waiting') return '现在不能掷骰';
    const dice = rollDice();
    state.dice = dice;
    const steps = dice[0] + dice[1];

    if (state.inJail[playerIndex]) {
      if (dice[0] === dice[1]) {
        state.inJail[playerIndex] = false;
      } else {
        state.jailTurns[playerIndex]++;
        if (state.jailTurns[playerIndex] >= 3) {
          state.inJail[playerIndex] = false;
          state.cash[playerIndex] -= 50;
        } else {
          state.phase = 'end_turn';
          return null;
        }
      }
    }

    const oldPos = state.positions[playerIndex];
    const newPos = (oldPos + steps) % BOARD_SIZE;
    const passedGo = newPos < oldPos || newPos === 0;
    if (passedGo) state.cash[playerIndex] += 200; // passed GO
    state.lastRent = null;
    state.lastMove = { player: playerIndex, from: oldPos, to: newPos, steps: steps, passedGo: passedGo, kind: 'walk' };
    state.positions[playerIndex] = newPos;
    applyLanding(state, playerIndex);
    return null;
  }

  if (data.type === 'buy') {
    if (state.phase !== 'landed' || state.pendingAction !== 'can_buy') return '现在不能购买';
    const pos = state.positions[playerIndex];
    const space = BOARD[pos];
    if (!space || !space.price) return '此处不可购买';
    if (state.cash[playerIndex] < space.price) return '余额不足';
    state.cash[playerIndex] -= space.price;
    state.properties[pos] = { owner: playerIndex, houses: 0 };
    state.pendingAction = null;
    state.phase = 'end_turn';
    return null;
  }

  if (data.type === 'skip_buy') {
    if (state.phase !== 'landed') return '无需跳过';
    state.pendingAction = null;
    state.phase = 'end_turn';
    return null;
  }

  if (data.type === 'build') {
    // Build a house on owned property
    const pos = data.spaceIndex;
    if (pos === undefined) return '未指定地产';
    const space = BOARD[pos];
    if (!space || space.type !== 'property') return '不是地产';
    const prop = state.properties[pos];
    if (!prop || prop.owner !== playerIndex) return '你不拥有此地产';
    if (prop.houses >= 5) return '已建满（含旅馆）';
    // Must own all in color group
    const groupSpaces = BOARD.map((s, i) => ({ s, i })).filter(x => x.s && x.s.group === space.group);
    if (!groupSpaces.every(x => state.properties[x.i] && state.properties[x.i].owner === playerIndex)) return '需垄断整个色组才能盖房';
    const houseCost = space.price / 2;
    if (state.cash[playerIndex] < houseCost) return '余额不足';
    state.cash[playerIndex] -= houseCost;
    prop.houses++;
    return null;
  }

  if (data.type === 'end_turn') {
    if (state.phase !== 'end_turn') return '还不能结束回合';
    nextPlayer(state);
    return null;
  }

  return '未知操作';
};
