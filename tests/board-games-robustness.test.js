// 回归:棋类游戏模块的输入校验(畸形坐标不抛异常)与规则修复。
const test = require('node:test');
const assert = require('node:assert/strict');

function load(id) { return require('../games/' + id); }
function fresh(id, n) {
  const g = load(id);
  const s = g.createState();
  if (g.initGame) g.initGame(s, n || 2);
  return { g, s };
}

const JUNK = [
  undefined, null, 0, 'x', [], {},
  { row: 1.5, col: 0 }, { row: 0, col: 1.5 }, { row: NaN, col: 1 }, { row: -1, col: 3 }, { row: '1', col: '1' },
  { cell: 1.5 }, { cell: '3' }, { col: 2.5 }, { col: 'a' },
  { from: { row: 1.5, col: 0 }, to: { row: 2, col: 1 } },
  { from: { row: 0.5, col: 0 }, to: { row: 1, col: 0 } },
  { from: 5, to: 6 }, { from: null, to: {} }, { from: {}, to: {} },
  { from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, promote: 1 },
  { from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, promote: {} },
  { r: 1.5, c: 3 }, { r: 3, c: 'a' }, { r: 0, c: 0, orientation: 'h', size: 5 },
  { action: 'move', planeIndex: 0.5 }, { action: 'move', planeIndex: '1' },
  { type: 'build', spaceIndex: 1.5 }, { type: 'build', spaceIndex: null }, { type: 5 },
  { pass: true },
];

for (const id of ['tictactoe', 'gomoku', 'connect4', 'reversi', 'checkers', 'chinesechess', 'go9', 'chess', 'flightchess', 'monopoly', 'battleship']) {
  test(id + ': garbage move data never throws', () => {
    for (const data of JUNK) {
      for (let pi = 0; pi < 2; pi++) {
        const { g, s } = fresh(id, 2);
        assert.doesNotThrow(() => {
          const r = g.handleMove(data, s, pi);
          assert.ok(r === null || typeof r === 'string');
          if (g.playerView) g.playerView(s, pi);
        }, id + ' data=' + JSON.stringify(data) + ' player=' + pi);
      }
    }
  });
}

test('reversi: boardSize option is clamped to 8/10/12', () => {
  for (const [input, expected] of [[1, 8], [1e8, 8], ['x', 8], [10, 10], [12, 12], [9, 8]]) {
    const g = load('reversi');
    const s = g.createState();
    s._options = { boardSize: input };
    g.initGame(s, 2);
    assert.equal(s.board.length, expected, 'boardSize ' + input);
  }
});

test('chess: threefold repetition is a draw', () => {
  const { g, s } = fresh('chess');
  const sq = (r, c) => ({ row: r, col: c });
  // Ng1-f3, Ng8-f6, Nf3-g1, Nf6-g8 (= back to the start position), repeated
  const cycle = [
    [sq(7, 6), sq(5, 5)], [sq(0, 6), sq(2, 5)], [sq(5, 5), sq(7, 6)], [sq(2, 5), sq(0, 6)],
  ];
  let turn = 0;
  for (let rep = 0; rep < 2; rep++) {
    for (const [from, to] of cycle) {
      assert.equal(s.winner, null, 'game should still be running');
      assert.equal(g.handleMove({ from, to }, s, turn), null);
      turn = 1 - turn;
    }
  }
  assert.equal(s.winner, -1, 'start position reached for the 3rd time');
});

test('chess: promote must be a string and out-of-range squares are refused', () => {
  const { g, s } = fresh('chess');
  assert.equal(g.handleMove({ from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, promote: 7 }, s, 0), null);
  const { g: g2, s: s2 } = fresh('chess');
  assert.equal(g2.handleMove({ from: { row: 9, col: 4 }, to: { row: 4, col: 4 } }, s2, 0), 'ch_invalid_move');
});

test('checkers: same position three times is a draw', () => {
  const { g, s } = fresh('checkers');
  s.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  s.board[7][0] = { type: 'k', side: 0 };
  s.board[0][7] = { type: 'k', side: 1 };
  const mv = (fr, fc, tr, tc, p) => assert.equal(g.handleMove({ from: { row: fr, col: fc }, to: { row: tr, col: tc } }, s, p), null);
  for (let i = 0; i < 2; i++) {
    mv(7, 0, 6, 1, 0); mv(0, 7, 1, 6, 1); mv(6, 1, 7, 0, 0); mv(1, 6, 0, 7, 1);
  }
  mv(7, 0, 6, 1, 0);
  assert.equal(s.winner, -1);
});

test('chinesechess: perpetual check loses, mutual or no check is a draw', () => {
  // Drive repetitionResult through handleMove is impractical; use a constructed ply log.
  const xq = load('chinesechess');
  assert.equal(typeof xq.repetitionResult, 'function');
  const R = 0, B = 1;
  const cyc = (a, b) => [
    { key: 'k', mover: null, check: false },
    { key: 'x', mover: R, check: a }, { key: 'y', mover: B, check: b },
    { key: 'z', mover: R, check: a }, { key: 'k', mover: B, check: b },
  ];
  assert.equal(xq.repetitionResult(cyc(true, false), 'k'), B, 'red keeps checking -> black wins');
  assert.equal(xq.repetitionResult(cyc(false, true), 'k'), R, 'black keeps checking -> red wins');
  assert.equal(xq.repetitionResult(cyc(true, true), 'k'), -1);
  assert.equal(xq.repetitionResult(cyc(false, false), 'k'), -1);
});

test('chinesechess: the opening position counts as the first occurrence', () => {
  const { g, s } = fresh('chinesechess');
  const mv = (fr, fc, tr, tc, p) => assert.equal(g.handleMove({ from: { row: fr, col: fc }, to: { row: tr, col: tc } }, s, p), null);
  // Horse out and back for both sides: start position reached again after 4 plies
  const cycle = () => { mv(9, 1, 7, 2, 0); mv(0, 1, 2, 2, 1); mv(7, 2, 9, 1, 0); mv(2, 2, 0, 1, 1); };
  cycle(); cycle();
  assert.equal(s.winner, -1, 'third occurrence (counting the opening) after two full cycles');
});

test('monopoly: a player bankrupted on their own turn can pass the turn on', () => {
  const { g, s } = fresh('monopoly', 3);
  // State right after player 1 went bankrupt paying rent on their own turn
  s.currentPlayer = 1;
  s.cash[1] = -5;
  s.eliminated[1] = true;
  s.phase = 'end_turn';
  assert.equal(g.handleMove({ type: 'end_turn' }, s, 1), null);
  assert.equal(s.currentPlayer, 2);
  // bots answer an eliminated seat with {pass:true}: must also advance, not error
  s.currentPlayer = 1; s.phase = 'end_turn';
  assert.equal(g.handleMove({ pass: true }, s, 1), null);
  assert.notEqual(s.currentPlayer, 1);
  // not the current player and out -> refused
  assert.equal(g.handleMove({ type: 'end_turn' }, s, 1), 'mp_eliminated');
});

test('monopoly: free-rent card works on railroads and rent is capped at cash', () => {
  const { g, s } = fresh('monopoly', 3);
  s.properties[5] = { owner: 0, houses: 0 };
  s.properties[12] = { owner: 0, houses: 0 };
  s.properties[19] = { owner: 0, houses: 0 };
  s.properties[25] = { owner: 0, houses: 0 };
  // free-rent on a station: stand on 5 and let the landing resolve through a roll of 4 (3+1) from 1
  const roll = (playerIdx, pos, wantSteps) => {
    s.currentPlayer = playerIdx; s.phase = 'waiting'; s.positions[playerIdx] = pos;
    const orig = Math.random;
    const vals = wantSteps === 4 ? [(3 - 0.5) / 6, (1 - 0.5) / 6] : [(6 - 0.5) / 6, (1 - 0.5) / 6];
    let i = 0;
    Math.random = () => vals[i++ % 2];
    try { return g.handleMove({ type: 'roll' }, s, playerIdx); } finally { Math.random = orig; }
  };
  s.freeRentCards[1] = true;
  const cash1 = s.cash[1];
  assert.equal(roll(1, 1, 4), null);
  assert.equal(s.positions[1], 5);
  assert.equal(s.cash[1], cash1, 'free rent card waives the station rent');
  assert.equal(s.freeRentCards[1], false);

  // cap: payer has 50, rent 4 stations = 420 -> owner gains only 50
  s.cash[2] = 50;
  const cash0 = s.cash[0];
  assert.equal(roll(2, 1, 4), null);
  assert.equal(s.cash[0] - cash0, 50, 'owner only receives what the payer could pay');
  assert.equal(s.eliminated[2], true);
});

test('monopoly: a jail fine that bankrupts ends the turn instead of moving the player', () => {
  const { g, s } = fresh('monopoly', 3);
  s.currentPlayer = 1; s.phase = 'waiting'; s.inJail[1] = true; s.jailTurns[1] = 2; s.cash[1] = 30;
  s.positions[1] = 7;
  const orig = Math.random;
  const vals = [0, 0.5]; // 1 + 4: not doubles
  let i = 0;
  Math.random = () => vals[i++ % 2];
  try { assert.equal(g.handleMove({ type: 'roll' }, s, 1), null); } finally { Math.random = orig; }
  assert.equal(s.eliminated[1], true);
  assert.equal(s.positions[1], 7, 'bankrupt player does not move');
  assert.equal(s.phase, 'end_turn');
});

test('monopoly: errors are i18n keys', () => {
  const { g, s } = fresh('monopoly', 2);
  assert.equal(g.handleMove({ type: 'buy' }, s, 0), 'mp_cannot_buy');
  assert.equal(g.handleMove({ type: 'nope' }, s, 0), 'mp_unknown_action');
  assert.equal(g.handleMove({ type: 'roll' }, s, 1), 'g_not_your_turn');
  const zh = require('../lang/server-zh.js');
  const en = require('../lang/server-en.js');
  for (const k of ['mp_cannot_buy', 'mp_unknown_action', 'mp_eliminated', 'mp_insufficient_funds', 'mp_need_monopoly', 'mp_cannot_end_turn']) {
    assert.ok(zh[k], 'zh ' + k);
    assert.ok(en[k], 'en ' + k);
  }
});

test('flightchess: the guaranteed-6 notice is kept in the result text', () => {
  const { g, s } = fresh('flightchess', 2);
  s.players[0].noSixStreak = 4;
  const orig = Math.random;
  Math.random = () => 0; // dice 1 -> pity forces 6
  try { assert.equal(g.handleMove({ action: 'roll' }, s, 0), null); } finally { Math.random = orig; }
  assert.equal(s.dice, 6);
  assert.match(s.lastMoveResult, /保底|[Gg]uaranteed/);
});
