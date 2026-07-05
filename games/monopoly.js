// games/monopoly.js
exports.name = 'monopoly';
exports.maxPlayers = 6;

function _t(state, zh, en) { return state && state._lang === 'en' ? (en || zh) : zh; }

const JAIL_INDEX = 7;
const BOARD = buildBoard();

function buildBoard() {
  return [
    { type: 'go' },
    { type: 'property', name: '廉租房', nameEn: 'Low-rent Housing', price: 60,  rent: [2,10,30,90,160,250],    color: '#8B5A2B', group: 0 },
    { type: 'chance' },
    { type: 'property', name: '旧街道', nameEn: 'Old Street',       price: 60,  rent: [4,20,60,180,320,450],   color: '#8B5A2B', group: 0 },
    { type: 'tax', name: '所得税', nameEn: 'Income Tax', amount: 200 },
    { type: 'railroad', name: '北站', nameEn: 'North Station', price: 200 },
    { type: 'property', name: '东方路', nameEn: 'Dongfang Road',     price: 100, rent: [6,30,90,270,400,550],   color: '#3F51B5', group: 1 },
    { type: 'jail_visit' },
    { type: 'property', name: '南京路', nameEn: 'Nanjing Road',     price: 100, rent: [6,30,90,270,400,550],   color: '#3F51B5', group: 1 },
    { type: 'property', name: '淮海路', nameEn: 'Huaihai Road',     price: 120, rent: [8,40,100,300,450,600],  color: '#3F51B5', group: 1 },
    { type: 'utility', name: '电力公司', nameEn: 'Power Company', price: 150 },
    { type: 'property', name: '龙华寺', nameEn: 'Longhua Temple',   price: 140, rent: [10,50,150,450,625,750], color: '#E91E8C', group: 2 },
    { type: 'railroad', name: '南站', nameEn: 'South Station', price: 200 },
    { type: 'property', name: '新天地', nameEn: 'Xintiandi',        price: 140, rent: [10,50,150,450,625,750], color: '#E91E8C', group: 2 },
    { type: 'free_parking' },
    { type: 'property', name: '外滩', nameEn: 'The Bund',           price: 160, rent: [12,60,180,500,700,900], color: '#E91E8C', group: 2 },
    { type: 'property', name: '豫园', nameEn: 'Yu Garden',          price: 180, rent: [14,70,200,550,750,950], color: '#F39C12', group: 3 },
    { type: 'chance' },
    { type: 'property', name: '城隍庙', nameEn: 'City God Temple',  price: 180, rent: [14,70,200,550,750,950], color: '#F39C12', group: 3 },
    { type: 'property', name: '人民广场', nameEn: "People's Square",price: 200, rent: [16,80,220,600,800,1000],color: '#F39C12', group: 3 },
    { type: 'railroad', name: '西站', nameEn: 'West Station', price: 200 },
    { type: 'go_to_jail' },
    { type: 'property', name: '环球港', nameEn: 'Global Harbor',    price: 220, rent: [18,90,250,700,875,1050],color: '#E74C3C', group: 4 },
    { type: 'property', name: '徐汇滨江', nameEn: 'Xuhui Waterfront',price:220, rent: [18,90,250,700,875,1050],color: '#E74C3C', group: 4 },
    { type: 'property', name: '陆家嘴', nameEn: 'Lujiazui',         price: 240, rent: [20,100,300,750,925,1100],color: '#E74C3C', group: 4 },
    { type: 'railroad', name: '东站', nameEn: 'East Station', price: 200 },
    { type: 'property', name: '浦东机场', nameEn: 'Pudong Airport', price: 260, rent: [22,110,330,800,975,1150],color: '#F1C40F', group: 5 },
    { type: 'property', name: '迪士尼', nameEn: 'Disneyland',       price: 280, rent: [24,120,360,850,1025,1200],color: '#F1C40F', group: 5 },
  ];
}

const CHANCE_CARDS = [
  { text: '收到银行股息，得 50元', textEn: 'Bank dividend, collect $50', amount: 50 },
  { text: '纳税申报，付 100元', textEn: 'Tax return, pay $100', amount: -100 },
  { text: '中了彩票！得 200元', textEn: 'Lottery win! Collect $200', amount: 200 },
  { text: '房屋维修费，付 150元', textEn: 'Home repairs, pay $150', amount: -150 },
  { text: '生日快乐！每位玩家送你 50元', textEn: 'Happy birthday! Each player gives you $50', type: 'birthday', amount: 50 },
  { text: '保险赔付，得 100元', textEn: 'Insurance payout, collect $100', amount: 100 },
  { text: '交通罚款，付 50元', textEn: 'Traffic fine, pay $50', amount: -50 },
  { text: '前进到起点，得 200元', textEn: 'Advance to GO, collect $200', type: 'goto', target: 0 },
  { text: '直接入狱！', textEn: 'Go directly to Jail!', type: 'jail' },
  { text: '度假归来，得 100元', textEn: 'Holiday refund, collect $100', amount: 100 },
  { text: '水管爆裂，付 80元', textEn: 'Water pipe burst, pay $80', amount: -80 },
  { text: '投资获利，得 150元', textEn: 'Investment profit, collect $150', amount: 150 },
  { text: '缴纳学费，付 100元', textEn: 'Tuition fee, pay $100', amount: -100 },
  { text: '找到钱包，得 50元', textEn: 'Found a wallet, collect $50', amount: 50 },
  { text: '慈善捐款，付 100元', textEn: 'Charity donation, pay $100', amount: -100 },
  { text: '股票大涨，得 250元', textEn: 'Stock market boom, collect $250', amount: 250 },
  { text: '前进3格', textEn: 'Advance 3 spaces', type: 'advance', steps: 3 },
  { text: '后退2格', textEn: 'Go back 2 spaces', type: 'advance', steps: -2 },
  { text: '免租一次（保留此卡）', textEn: 'Free rent pass (keep this card)', type: 'free_rent' },
  { text: '收缴经营所得，得 100元', textEn: 'Business income, collect $100', amount: 100 },
];

const BOARD_SIZE = BOARD.length;
const BASE_RENT_MULTIPLIER = 3;
const BUILT_RENT_MULTIPLIER = 1.5;

function calculatePropertyRent(space, houses, monopoly) {
  const multiplier = houses === 0 ? BASE_RENT_MULTIPLIER : BUILT_RENT_MULTIPLIER;
  let rent = Math.round(space.rent[houses] * multiplier);
  if (monopoly && houses === 0) rent *= 2;
  return rent;
}

exports.calculatePropertyRent = calculatePropertyRent;

exports.createState = () => ({
  phase: 'waiting', positions: [], cash: [], properties: {}, inJail: [],
  jailTurns: [], eliminated: [], currentPlayer: 0, dice: [0, 0],
  lastCard: null, winner: null, _playerCount: 0, pendingAction: null,
  freeRentCards: [], lastCardEffect: null,
  board: BOARD, lastMove: null, lastRent: null,
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
  state.lastCardEffect = null;
  state.board = BOARD;
  state.lastMove = null;
  state.lastRent = null;
};

function rollDice() { return [Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]; }

function checkBankruptcy(state) {
  for (let i = 0; i < state._playerCount; i++) {
    if (!state.eliminated[i] && state.cash[i] < 0) {
      state.eliminated[i] = true;
      for (const [idx, prop] of Object.entries(state.properties)) {
        if (prop.owner === i) delete state.properties[idx];
      }
    }
  }
  const alive = state.eliminated.filter(e => !e).length;
  if (alive === 1) { state.winner = state.eliminated.indexOf(false); state.phase = 'gameover'; }
  else if (alive === 0) { state.winner = 0; state.phase = 'gameover'; }
}

function nextPlayer(state) {
  let next = (state.currentPlayer + 1) % state._playerCount;
  let loops = 0;
  while (state.eliminated[next] && loops < state._playerCount) { next = (next + 1) % state._playerCount; loops++; }
  state.currentPlayer = next; state.phase = 'waiting'; state.pendingAction = null;
  state.lastCard = null; state.lastCardEffect = null; state.lastMove = null; state.lastRent = null;
}

function getGroupSpaces(group) { return BOARD.map((s, i) => ({ s, i })).filter(x => x.s && x.s.group === group); }

function canBuildOnSpace(state, playerIndex, pos) {
  const space = BOARD[pos];
  if (!space || space.type !== 'property') return false;
  const prop = state.properties[pos];
  if (!prop || prop.owner !== playerIndex || prop.houses >= 5) return false;
  return getGroupSpaces(space.group).every(x => state.properties[x.i] && state.properties[x.i].owner === playerIndex);
}

function setLastCardEffect(state, playerIndex, extra) {
  state.lastCardEffect = Object.assign({
    player: playerIndex,
    tone: 'neutral',
    delta: 0,
    summary: state.lastCard ? _t(state, state.lastCard.text, state.lastCard.textEn) : '',
  }, extra);
}

function applyLanding(state, playerIndex) {
  const pos = state.positions[playerIndex];
  const space = BOARD[pos];
  if (!space) { state.phase = 'end_turn'; return; }

  if (space.type === 'go_to_jail') {
    state.lastMove = { player: playerIndex, from: pos, to: JAIL_INDEX, steps: 0, passedGo: false, kind: 'teleport' };
    state.positions[playerIndex] = JAIL_INDEX;
    state.inJail[playerIndex] = true; state.jailTurns[playerIndex] = 0;
    state.phase = 'end_turn'; return;
  }

  if (space.type === 'property') {
    const prop = state.properties[pos];
    if (!prop) { state.pendingAction = 'can_buy'; state.phase = 'landed'; }
    else if (prop.owner === playerIndex) {
      if (canBuildOnSpace(state, playerIndex, pos)) { state.pendingAction = 'can_build'; state.phase = 'landed'; }
      else { state.phase = 'end_turn'; }
    } else {
      const houses = prop.houses || 0;
      const groupSpaces = getGroupSpaces(space.group);
      const monopoly = groupSpaces.every(x => state.properties[x.i] && state.properties[x.i].owner === prop.owner);
      const rent = calculatePropertyRent(space, houses, monopoly);
      if (state.freeRentCards[playerIndex]) {
        state.freeRentCards[playerIndex] = false;
        state.lastCard = { text: '使用免租卡，本次免租！', textEn: 'Free rent card activated! Rent waived!' };
        state.lastRent = { payer: playerIndex, owner: prop.owner, amount: 0, space: pos };
      } else {
        state.cash[playerIndex] -= rent; state.cash[prop.owner] += rent;
        state.lastRent = { payer: playerIndex, owner: prop.owner, amount: rent, space: pos };
      }
      checkBankruptcy(state);
      if (state.phase !== 'gameover') state.phase = 'end_turn';
    }
    return;
  }

  if (space.type === 'railroad') {
    const prop = state.properties[pos];
    if (!prop) { state.pendingAction = 'can_buy'; state.phase = 'landed'; }
    else if (prop.owner !== playerIndex) {
      let rrCount = 0;
      BOARD.forEach((s, i) => { if (s && s.type === 'railroad' && state.properties[i] && state.properties[i].owner === prop.owner) rrCount++; });
      const rent = [60, 120, 240, 420][rrCount - 1] || 60;
      state.cash[playerIndex] -= rent; state.cash[prop.owner] += rent;
      state.lastRent = { payer: playerIndex, owner: prop.owner, amount: rent, space: pos };
      checkBankruptcy(state);
      if (state.phase !== 'gameover') state.phase = 'end_turn';
    } else { state.phase = 'end_turn'; }
    return;
  }

  if (space.type === 'utility') {
    const prop = state.properties[pos];
    if (!prop) { state.pendingAction = 'can_buy'; state.phase = 'landed'; }
    else if (prop.owner !== playerIndex) {
      const rent = (state.dice[0] + state.dice[1]) * 10;
      state.cash[playerIndex] -= rent; state.cash[prop.owner] += rent;
      state.lastRent = { payer: playerIndex, owner: prop.owner, amount: rent, space: pos };
      checkBankruptcy(state);
      if (state.phase !== 'gameover') state.phase = 'end_turn';
    } else { state.phase = 'end_turn'; }
    return;
  }

  if (space.type === 'chance') {
    const card = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
    state.lastCard = card;
    state.lastCardEffect = null;
    if (card.type === 'birthday') {
      let total = 0;
      for (let i = 0; i < state._playerCount; i++) {
        if (i !== playerIndex && !state.eliminated[i]) { state.cash[i] -= card.amount; state.cash[playerIndex] += card.amount; total += card.amount; }
      }
      setLastCardEffect(state, playerIndex, { tone: total > 0 ? 'gain' : 'neutral', delta: total, summary: (total > 0 ? '+' : '') + total + ' · ' + _t(state, card.text, card.textEn) });
    } else if (card.type === 'goto') {
      const passed = state.positions[playerIndex] > card.target;
      if (passed) state.cash[playerIndex] += 200;
      const fwd = ((card.target - pos) + BOARD_SIZE) % BOARD_SIZE;
      state.lastMove = { player: playerIndex, from: pos, to: card.target, steps: fwd, passedGo: passed, kind: 'walk' };
      state.positions[playerIndex] = card.target;
      setLastCardEffect(state, playerIndex, { tone: passed ? 'gain' : 'neutral', delta: passed ? 200 : 0, summary: (passed ? '+200 · ' : '') + _t(state, card.text, card.textEn) });
    } else if (card.type === 'jail') {
      state.lastMove = { player: playerIndex, from: pos, to: JAIL_INDEX, steps: 0, passedGo: false, kind: 'teleport' };
      state.positions[playerIndex] = JAIL_INDEX; state.inJail[playerIndex] = true; state.jailTurns[playerIndex] = 0;
      setLastCardEffect(state, playerIndex, { tone: 'loss', summary: _t(state, '入狱 · ', 'Go to Jail · ') + _t(state, card.text, card.textEn) });
    } else if (card.type === 'advance') {
      const np = ((state.positions[playerIndex] + card.steps) + BOARD_SIZE) % BOARD_SIZE;
      const passedGo = card.steps > 0 && np < pos;
      if (passedGo) state.cash[playerIndex] += 200;
      state.lastMove = { player: playerIndex, from: pos, to: np, steps: card.steps, passedGo: passedGo, kind: 'walk' };
      state.positions[playerIndex] = np;
      setLastCardEffect(state, playerIndex, { tone: passedGo ? 'gain' : 'neutral', delta: passedGo ? 200 : 0, summary: (passedGo ? '+200 · ' : '') + _t(state, card.text, card.textEn) });
    } else if (card.type === 'free_rent') {
      state.freeRentCards[playerIndex] = true;
      setLastCardEffect(state, playerIndex, { tone: 'gain', summary: _t(state, '获得免租卡 · ', 'Free rent card! · ') + _t(state, card.text, card.textEn) });
    } else if (card.amount) {
      state.cash[playerIndex] += card.amount;
      setLastCardEffect(state, playerIndex, { tone: card.amount > 0 ? 'gain' : 'loss', delta: card.amount, summary: (card.amount > 0 ? '+' : '') + card.amount + ' · ' + _t(state, card.text, card.textEn) });
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

  state.phase = 'end_turn';
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.phase === 'gameover') return _t(state, '游戏已结束', 'Game over');
  if (state.eliminated[playerIndex]) return _t(state, '你已出局', 'You are out');
  if (state.currentPlayer !== playerIndex) return _t(state, '还没轮到你', 'Not your turn yet');

  if (data.type === 'roll') {
    if (state.phase !== 'waiting') return _t(state, '现在不能掷骰', 'Cannot roll now');
    const dice = rollDice();
    state.dice = dice;
    const steps = dice[0] + dice[1];

    if (state.inJail[playerIndex]) {
      if (dice[0] === dice[1]) { state.inJail[playerIndex] = false; }
      else {
        state.jailTurns[playerIndex]++;
        if (state.jailTurns[playerIndex] >= 3) { state.inJail[playerIndex] = false; state.cash[playerIndex] -= 50; }
        else { state.phase = 'end_turn'; return null; }
      }
    }

    const oldPos = state.positions[playerIndex];
    const newPos = (oldPos + steps) % BOARD_SIZE;
    const passedGo = newPos < oldPos || newPos === 0;
    if (passedGo) state.cash[playerIndex] += 200;
    state.lastRent = null; state.lastCardEffect = null;
    state.lastMove = { player: playerIndex, from: oldPos, to: newPos, steps: steps, passedGo: passedGo, kind: 'walk' };
    state.positions[playerIndex] = newPos;
    applyLanding(state, playerIndex);
    return null;
  }

  if (data.type === 'buy') {
    if (state.phase !== 'landed' || state.pendingAction !== 'can_buy') return _t(state, '现在不能购买', 'Cannot buy now');
    const pos = state.positions[playerIndex]; const space = BOARD[pos];
    if (!space || !space.price) return _t(state, '此处不可购买', 'Cannot buy this');
    if (state.cash[playerIndex] < space.price) return _t(state, '余额不足', 'Insufficient funds');
    state.cash[playerIndex] -= space.price;
    state.properties[pos] = { owner: playerIndex, houses: 0 };
    state.pendingAction = null; state.phase = 'end_turn';
    return null;
  }

  if (data.type === 'skip_buy') {
    if (state.phase !== 'landed') return _t(state, '无需跳过', 'Nothing to skip');
    state.pendingAction = null; state.phase = 'end_turn';
    return null;
  }

  if (data.type === 'build') {
    const pos = data.spaceIndex !== undefined ? data.spaceIndex : state.positions[playerIndex];
    if (pos === undefined) return _t(state, '未指定地产', 'No property specified');
    const space = BOARD[pos];
    if (!space || space.type !== 'property') return _t(state, '不是地产', 'Not a property');
    const prop = state.properties[pos];
    if (!prop || prop.owner !== playerIndex) return _t(state, '你不拥有此地产', "You don't own this");
    if (prop.houses >= 5) return _t(state, '已建满（含旅馆）', 'Already fully built');
    const groupSpaces = getGroupSpaces(space.group);
    if (!groupSpaces.every(x => state.properties[x.i] && state.properties[x.i].owner === playerIndex)) return _t(state, '需垄断整个色组才能盖房', 'Need color group monopoly');
    const houseCost = space.price / 2;
    if (state.cash[playerIndex] < houseCost) return _t(state, '余额不足', 'Insufficient funds');
    state.cash[playerIndex] -= houseCost;
    prop.houses++;
    if (state.phase === 'landed' && state.pendingAction === 'can_build' && pos === state.positions[playerIndex]) { state.pendingAction = null; state.phase = 'end_turn'; }
    return null;
  }

  if (data.type === 'end_turn') {
    if (state.phase !== 'end_turn') return _t(state, '还不能结束回合', 'Cannot end turn yet');
    nextPlayer(state);
    return null;
  }

  return _t(state, '未知操作', 'Unknown action');
};
