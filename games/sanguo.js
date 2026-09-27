// games/sanguo.js
// 三国身份局 — standard identity mode for 4–8 players. Rules live in lib/sanguo-core.js.
// Step 1: rules engine only; generals have hp/gender/kingdom but no skills yet.
const core = require('./lib/sanguo-core');

exports.name = 'sanguo';
exports.maxPlayers = 8;
exports.minPlayers = 4;

// Historical names; skill ids are filled in step 2.
const GENERALS = [
  { id: 'liubei', kingdom: 'shu', hp: 4, gender: 'm' },
  { id: 'guanyu', kingdom: 'shu', hp: 4, gender: 'm' },
  { id: 'zhangfei', kingdom: 'shu', hp: 4, gender: 'm' },
  { id: 'caocao', kingdom: 'wei', hp: 4, gender: 'm' },
  { id: 'simayi', kingdom: 'wei', hp: 3, gender: 'm' },
  { id: 'xiahoudun', kingdom: 'wei', hp: 4, gender: 'm' },
  { id: 'sunquan', kingdom: 'wu', hp: 4, gender: 'm' },
  { id: 'ganning', kingdom: 'wu', hp: 4, gender: 'm' },
  { id: 'lvmeng', kingdom: 'wu', hp: 4, gender: 'm' },
  { id: 'lvbu', kingdom: 'qun', hp: 4, gender: 'm' },
  { id: 'huatuo', kingdom: 'qun', hp: 3, gender: 'm' },
  { id: 'diaochan', kingdom: 'qun', hp: 3, gender: 'f' },
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
