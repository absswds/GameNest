// games/monopoly.js
exports.name = 'monopoly';
exports.maxPlayers = 6;

const { pick: _t } = require('./lib/i18n');
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
const RAILROAD_RENT = [25, 50, 100, 200];

// Face rent from the card; an unimproved space of a full colour group pays double.
function calculatePropertyRent(space, houses, monopoly) {
  let rent = space.rent[houses];
  if (monopoly && houses === 0) rent *= 2;
  return rent;
}

exports.calculatePropertyRent = calculatePropertyRent;

exports.createState = () => ({
  phase: 'waiting', positions: [], cash: [], properties: {}, inJail: [],
  jailTurns: [], eliminated: [], currentPlayer: 0, dice: [0, 0],
  lastCard: null, winner: null, _playerCount: 0, pendingAction: null,
  freeRentCards: [], lastCardEffect: null, doublesCount: 0, rollAgain: false, round: 1, roundLimit: DEFAULT_ROUND_LIMIT, assets: [], endReason: null,
  board: BOARD, lastMove: null, lastRent: null, tradeOffer: null, lastTrade: null,
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
  state.doublesCount = 0;
  state.rollAgain = false;
  state.round = 1;
  state.roundLimit = roundLimitOf(state);
  state.assets = [];
  state.endReason = null;
  state.board = BOARD;
  state.lastMove = null;
  state.lastRent = null;
  state.tradeOffer = null;
  state.lastTrade = null;
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
  if (state.tradeOffer && (state.eliminated[state.tradeOffer.from] || state.eliminated[state.tradeOffer.to])) {
    state.tradeOffer = null;
  }
  const alive = state.eliminated.filter(e => !e).length;
  if (alive === 1) { state.winner = state.eliminated.indexOf(false); state.phase = 'gameover'; }
  else if (alive === 0) { state.winner = 0; state.phase = 'gameover'; }
}


const DEFAULT_ROUND_LIMIT = 50;

// Room option roundLimit: 30 / 50 / 80 rounds, or 0 for unlimited (default 50).
function roundLimitOf(state) {
  const v = state._options && state._options.roundLimit;
  return [0, 30, 50, 80].includes(v) ? v : DEFAULT_ROUND_LIMIT;
}

// Net worth for the time-limit ranking: cash + purchase prices + house cost (no mortgages).
function computeAssets(state) {
  const out = [];
  for (let i = 0; i < state._playerCount; i++) out.push(state.eliminated[i] ? 0 : Math.max(0, state.cash[i]));
  for (const [idx, prop] of Object.entries(state.properties)) {
    const space = BOARD[idx];
    if (!space || state.eliminated[prop.owner]) continue;
    out[prop.owner] += space.price + (prop.houses || 0) * (space.price / 2);
  }
  return out;
}

// Round limit reached: richest player wins, ties broken by cash, then by seat order.
function finishByAssets(state) {
  const assets = computeAssets(state);
  let best = -1;
  for (let i = 0; i < state._playerCount; i++) {
    if (state.eliminated[i]) continue;
    if (best === -1 || assets[i] > assets[best] || (assets[i] === assets[best] && state.cash[i] > state.cash[best])) best = i;
  }
  state.assets = assets;
  state.endReason = 'rounds';
  state.winner = best === -1 ? 0 : best;
  state.phase = 'gameover';
}

function nextPlayer(state) {
  state.tradeOffer = null;
  const prev = state.currentPlayer;
  let next = (prev + 1) % state._playerCount;
  let loops = 0;
  while (state.eliminated[next] && loops < state._playerCount) { next = (next + 1) % state._playerCount; loops++; }
  state.roundLimit = roundLimitOf(state);
  if (next <= prev) {
    state.round++;
    if (state.roundLimit > 0 && state.round > state.roundLimit) { state.round = state.roundLimit; finishByAssets(state); return; }
  }
  state.assets = computeAssets(state);
  state.currentPlayer = next; state.phase = 'waiting'; state.pendingAction = null;
  state.doublesCount = 0; state.rollAgain = false;
  state.lastCard = null; state.lastCardEffect = null; state.lastMove = null; state.lastRent = null;
}


// Rolled doubles: once the landing is fully settled the same player rolls again.
function settleRollAgain(state, playerIndex) {
  if (state.phase !== 'end_turn' || !state.rollAgain) return;
  state.rollAgain = false;
  if (state.eliminated[playerIndex] || state.inJail[playerIndex]) return;
  state.phase = 'waiting'; state.pendingAction = null;
}

function getGroupSpaces(group) { return BOARD.map((s, i) => ({ s, i })).filter(x => x.s && x.s.group === group); }

function groupHasHouses(state, pos) {
  const space = BOARD[pos];
  if (!space || space.type !== 'property') return false;
  const groupSpaces = getGroupSpaces(space.group);
  return groupSpaces.some(x => state.properties[x.i] && (state.properties[x.i].houses || 0) > 0);
}

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

// Pay rent to a property owner. A free-rent card waives it (any rentable space); the owner only
// receives what the payer can actually cover, so a bankrupt payer does not mint money.
function payRent(state, payer, prop, rent, pos) {
  if (state.freeRentCards[payer]) {
    state.freeRentCards[payer] = false;
    state.lastCard = { text: '使用免租卡，本次免租！', textEn: 'Free rent card activated! Rent waived!' };
    state.lastRent = { payer: payer, owner: prop.owner, amount: 0, space: pos };
    return;
  }
  const paid = Math.max(0, Math.min(rent, state.cash[payer]));
  state.cash[payer] -= rent;
  state.cash[prop.owner] += paid;
  state.lastRent = { payer: payer, owner: prop.owner, amount: paid, owed: rent, space: pos };
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
      payRent(state, playerIndex, prop, rent, pos);
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
      const rent = RAILROAD_RENT[rrCount - 1] || RAILROAD_RENT[0];
      payRent(state, playerIndex, prop, rent, pos);
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
      payRent(state, playerIndex, prop, rent, pos);
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
    if (state.phase === 'gameover') return;
    if ((card.type === 'goto' || card.type === 'advance') && !state.eliminated[playerIndex]) {
      applyLanding(state, playerIndex); // a card that moves you resolves the new space (buy / rent / tax)
      return;
    }
    state.phase = 'end_turn';
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
  if (state.phase === 'gameover') return 'g_game_over';
  state.roundLimit = roundLimitOf(state);
  if (state.eliminated[playerIndex]) {
    // A player who went bankrupt on their own turn is still the current player: any input from
    // them (a human end_turn, or the bot's pass) hands the turn on, otherwise the game stalls.
    if (state.currentPlayer === playerIndex && state.phase === 'end_turn') { nextPlayer(state); return null; }
    return 'mp_eliminated';
  }
  if (!data) return 'g_invalid_action';
  if (data.pass || data.type === 'pass') {
    if (state.tradeOffer) {
      state.tradeOffer = null;
    }
    return null;
  }
  if (typeof data.type !== 'string') return 'g_invalid_action';


  // --- Trade Action Handlers ---
  if (data.type === 'trade_accept' || data.type === 'trade_decline') {
    if (!state.tradeOffer) return 'mp_no_pending_trade';
    if (state.tradeOffer.to !== playerIndex) return 'mp_not_trade_recipient';
    if (data.type === 'trade_accept') {
      const { from, to, offerCash, offerProps, requestCash, requestProps } = state.tradeOffer;
      if (state.cash[from] < offerCash || state.cash[to] < requestCash) {
        state.tradeOffer = null;
        return 'mp_insufficient_funds';
      }
      for (const p of offerProps) {
        if (!state.properties[p] || state.properties[p].owner !== from || groupHasHouses(state, p)) {
          state.tradeOffer = null;
          return 'mp_invalid_trade_assets';
        }
      }
      for (const p of requestProps) {
        if (!state.properties[p] || state.properties[p].owner !== to || groupHasHouses(state, p)) {
          state.tradeOffer = null;
          return 'mp_invalid_trade_assets';
        }
      }
      state.cash[from] -= offerCash;
      state.cash[to] += offerCash;
      state.cash[to] -= requestCash;
      state.cash[from] += requestCash;
      for (const p of offerProps) state.properties[p].owner = to;
      for (const p of requestProps) state.properties[p].owner = from;
      state.lastTrade = { from, to, offerCash, offerProps, requestCash, requestProps, accepted: true };
      state.tradeOffer = null;
      return null;
    } else {
      state.lastTrade = { from: state.tradeOffer.from, to: state.tradeOffer.to, accepted: false };
      state.tradeOffer = null;
      return null;
    }
  }

  if (data.type === 'trade_cancel') {
    if (!state.tradeOffer) return 'mp_no_pending_trade';
    if (state.tradeOffer.from !== playerIndex) return 'mp_not_trade_sender';
    state.tradeOffer = null;
    return null;
  }

  if (data.type === 'trade_offer') {
    if (state.tradeOffer) return 'mp_trade_already_pending';
    if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';
    const to = Number(data.to);
    if (!Number.isInteger(to) || to < 0 || to >= state._playerCount || to === playerIndex) return 'mp_trade_invalid_target';
    if (state.eliminated[to]) return 'mp_trade_invalid_target';

    const offerCash = Math.max(0, Math.floor(Number(data.offerCash) || 0));
    const requestCash = Math.max(0, Math.floor(Number(data.requestCash) || 0));
    if (offerCash > state.cash[playerIndex]) return 'mp_insufficient_funds';
    if (requestCash > state.cash[to]) return 'mp_insufficient_funds';

    const offerProps = Array.isArray(data.offerProps) ? data.offerProps.map(Number) : [];
    const requestProps = Array.isArray(data.requestProps) ? data.requestProps.map(Number) : [];

    if (offerCash === 0 && requestCash === 0 && offerProps.length === 0 && requestProps.length === 0) {
      return 'mp_trade_no_assets';
    }

    for (const p of offerProps) {
      if (!state.properties[p] || state.properties[p].owner !== playerIndex) return 'mp_not_owner';
      if (groupHasHouses(state, p)) return 'mp_group_has_houses';
    }
    for (const p of requestProps) {
      if (!state.properties[p] || state.properties[p].owner !== to) return 'mp_not_owner';
      if (groupHasHouses(state, p)) return 'mp_group_has_houses';
    }

    state.tradeOffer = { from: playerIndex, to, offerCash, offerProps, requestCash, requestProps };
    return null;
  }

  if (state.tradeOffer) return 'mp_trade_pending';
  if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';


  if (data.type === 'roll') {
    if (state.phase !== 'waiting') return 'mp_cannot_roll';
    const dice = rollDice();
    state.dice = dice;
    const steps = dice[0] + dice[1];
    const isDouble = dice[0] === dice[1];
    const jailedAtRollStart = !!state.inJail[playerIndex];
    state.lastCard = null;
    state.rollAgain = false;

    if (state.inJail[playerIndex]) {
      // Doubles that free you from jail do not earn an extra roll.
      state.doublesCount = 0;
      if (isDouble) { state.inJail[playerIndex] = false; }
      else {
        state.jailTurns[playerIndex]++;
        if (state.jailTurns[playerIndex] >= 3) {
          state.inJail[playerIndex] = false; state.cash[playerIndex] -= 50;
          // The fine can bankrupt: settle it now, before the roll moves a broke player onto a quiet space.
          checkBankruptcy(state);
          if (state.phase === 'gameover') return null;
          if (state.eliminated[playerIndex]) { state.phase = 'end_turn'; return null; }
        }
        else { state.phase = 'end_turn'; return null; }
      }
    }

    const oldPos = state.positions[playerIndex];
    if (isDouble && !jailedAtRollStart) {
      state.doublesCount++;
      if (state.doublesCount >= 3) {
        // Third double in a row: straight to jail without moving.
        state.doublesCount = 0;
        state.lastRent = null; state.lastCardEffect = null;
        state.lastMove = { player: playerIndex, from: oldPos, to: JAIL_INDEX, steps: 0, passedGo: false, kind: 'teleport' };
        state.positions[playerIndex] = JAIL_INDEX;
        state.inJail[playerIndex] = true; state.jailTurns[playerIndex] = 0;
        state.phase = 'end_turn';
        return null;
      }
      state.rollAgain = true;
    } else if (!isDouble) {
      state.doublesCount = 0;
    }
    const newPos = (oldPos + steps) % BOARD_SIZE;
    const passedGo = newPos < oldPos || newPos === 0;
    if (passedGo) state.cash[playerIndex] += 200;
    state.lastRent = null; state.lastCardEffect = null;
    state.lastMove = { player: playerIndex, from: oldPos, to: newPos, steps: steps, passedGo: passedGo, kind: 'walk' };
    state.positions[playerIndex] = newPos;
    applyLanding(state, playerIndex);
    settleRollAgain(state, playerIndex);
    return null;
  }

  if (data.type === 'buy') {
    if (state.phase !== 'landed' || state.pendingAction !== 'can_buy') return 'mp_cannot_buy';
    const pos = state.positions[playerIndex]; const space = BOARD[pos];
    if (!space || !space.price) return 'mp_not_buyable';
    if (state.cash[playerIndex] < space.price) return 'mp_insufficient_funds';
    state.cash[playerIndex] -= space.price;
    state.properties[pos] = { owner: playerIndex, houses: 0 };
    state.pendingAction = null; state.phase = 'end_turn';
    settleRollAgain(state, playerIndex);
    return null;
  }

  if (data.type === 'skip_buy') {
    if (state.phase !== 'landed') return 'mp_nothing_to_skip';
    state.pendingAction = null; state.phase = 'end_turn';
    settleRollAgain(state, playerIndex);
    return null;
  }

  if (data.type === 'build') {
    const pos = data.spaceIndex !== undefined && data.spaceIndex !== null ? data.spaceIndex : state.positions[playerIndex];
    if (!Number.isInteger(pos)) return 'mp_no_property';
    if (pos === undefined) return 'mp_no_property';
    const space = BOARD[pos];
    if (!space || space.type !== 'property') return 'mp_not_property';
    const prop = state.properties[pos];
    if (!prop || prop.owner !== playerIndex) return 'mp_not_owner';
    if (prop.houses >= 5) return 'mp_fully_built';
    const groupSpaces = getGroupSpaces(space.group);
    if (!groupSpaces.every(x => state.properties[x.i] && state.properties[x.i].owner === playerIndex)) return 'mp_need_monopoly';
    const houseCost = space.price / 2;
    if (state.cash[playerIndex] < houseCost) return 'mp_insufficient_funds';
    state.cash[playerIndex] -= houseCost;
    prop.houses++;
    if (state.phase === 'landed' && state.pendingAction === 'can_build' && pos === state.positions[playerIndex]) { state.pendingAction = null; state.phase = 'end_turn'; settleRollAgain(state, playerIndex); }
    return null;
  }

  if (data.type === 'end_turn') {
    if (state.phase !== 'end_turn') return 'mp_cannot_end_turn';
    nextPlayer(state);
    return null;
  }

  return 'mp_unknown_action';
};

exports.getCurrentActor = (state) => {
  if (state.tradeOffer) return state.tradeOffer.to;
  return state.currentPlayer;
};

exports.groupHasHouses = groupHasHouses;

