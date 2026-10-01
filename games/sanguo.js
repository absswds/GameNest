// games/sanguo.js
// 三国身份局 — standard identity mode for 4–8 players. Rules live in lib/sanguo-core.js.
// Skills are implemented inside the engine, keyed by general id.
const core = require('./lib/sanguo-core');

exports.name = 'sanguo';
exports.maxPlayers = 8;
exports.minPlayers = 4;

// Historical names; each general has one or two skills (ids only; text lives in the lang packs).
// Lord skills (jijiang, hujia, jiuyuan) are not implemented yet.
const GENERALS = [
  { id: 'liubei', skills: ['rende'], kingdom: 'shu', hp: 4, gender: 'm' },
  { id: 'guanyu', skills: ['wusheng'], kingdom: 'shu', hp: 4, gender: 'm' },
  { id: 'zhangfei', skills: ['paoxiao'], kingdom: 'shu', hp: 4, gender: 'm' },
  { id: 'caocao', skills: ['jianxiong'], kingdom: 'wei', hp: 4, gender: 'm' },
  { id: 'simayi', skills: ['fankui'], kingdom: 'wei', hp: 3, gender: 'm' },
  { id: 'xiahoudun', skills: ['ganglie'], kingdom: 'wei', hp: 4, gender: 'm' },
  { id: 'sunquan', skills: ['zhiheng'], kingdom: 'wu', hp: 4, gender: 'm' },
  { id: 'ganning', skills: ['qixi'], kingdom: 'wu', hp: 4, gender: 'm' },
  { id: 'lvmeng', skills: ['keji'], kingdom: 'wu', hp: 4, gender: 'm' },
  { id: 'lvbu', skills: ['wushuang'], kingdom: 'qun', hp: 4, gender: 'm' },
  { id: 'huatuo', skills: ['jijiu', 'qingnang'], kingdom: 'qun', hp: 3, gender: 'm' },
  { id: 'diaochan', skills: ['lijian', 'biyue'], kingdom: 'qun', hp: 3, gender: 'f' },
];
exports.GENERALS = GENERALS;

exports.createState = () => ({ phase: 'waiting', winner: null, winners: [], players: [], log: [] });

exports.initGame = (state, n) => {
  state.phase = 'playing';
  core.setup(state, n, GENERALS);
};

exports.handleMove = (data, state, p) => core.handleMove(data, state, p);
exports.onTimeout = (state) => core.onTimeout(state);
exports.getPhaseDeadline = (state) => (state.winner === null && state.ask ? state.ask.deadline : 0);
exports.getPendingActors = (state) => (state.winner === null && state.ask ? [state.ask.to] : []);
exports.getCurrentActor = () => -1;
exports.setCurrentActor = () => {};

// Other hands become counts; roles stay hidden except the lord, the dead and yourself.
exports.playerView = (state, idx) => {
  if (!Array.isArray(state.players) || !state.players.length) return state;
  const over = state.winner !== null;
  const v = Object.assign({}, state, {
    deck: [],
    deckCount: (state.deck || []).length,
    stack: [],
    players: state.players.map((P, i) => {
      const mine = i === idx;
      return Object.assign({}, P, {
        hand: mine ? P.hand : [],
        handCount: P.hand.length,
        role: mine || over || !P.alive || P.role === 'lord' ? P.role : null,
      });
    }),
  });
  return v;
};
