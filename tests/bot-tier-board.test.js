const test = require('node:test');
const assert = require('node:assert/strict');

const tictactoeBot = require('../bots/tictactoe');
const gomokuBot = require('../bots/gomoku');
const go9Bot = require('../bots/go9');
const tictactoe = require('../games/tictactoe');
const go9 = require('../games/go9');

const opts = (difficulty) => ({ difficulty });

test('tictactoe: hard takes the win and the block, every time', () => {
  const win = { board: [0, 0, null, 1, 1, null, null, null, null], _options: opts('hard') };
  const block = { board: [1, 1, null, null, 0, null, null, null, null], _options: opts('hard') };
  for (let i = 0; i < 20; i++) {
    assert.equal(tictactoeBot.createBot(0).getMove(win).cell, 2);
    assert.equal(tictactoeBot.createBot(0).getMove(block).cell, 2);
  }
});

test('tictactoe: hard never loses to normal/easy; easy loses more often than normal', () => {
  const play = (d0, d1) => {
    const s = tictactoe.createState();
    const bots = [tictactoeBot.createBot(0), tictactoeBot.createBot(1)];
    const diffs = [d0, d1];
    for (let i = 0; i < 9 && s.winner === null; i++) {
      const p = s.currentPlayer;
      const view = { ...s, _options: opts(diffs[p]) };
      assert.equal(tictactoe.handleMove(bots[p].getMove(view), s, p), null);
    }
    return s.winner;
  };
  let hardLost = 0, easyLost = 0, normalLost = 0;
  for (let g = 0; g < 24; g++) {
    const hardFirst = g % 2 === 0;
    const hs = hardFirst ? 0 : 1;
    if (play(...(hardFirst ? ['hard', 'normal'] : ['normal', 'hard'])) === 1 - hs) hardLost++;
    if (play(...(hardFirst ? ['hard', 'easy'] : ['easy', 'hard'])) === 1 - hs) hardLost++;
    const ns = g % 2;
    if (play(...(ns === 0 ? ['normal', 'easy'] : ['easy', 'normal'])) === (ns === 0 ? 1 : 0)) normalLost++;
    // easy loses = normal wins
    const w = play(...(ns === 0 ? ['normal', 'easy'] : ['easy', 'normal']));
    if (w === ns) easyLost++;
  }
  assert.equal(hardLost, 0);
  assert.ok(easyLost > normalLost, `easy lost ${easyLost}, normal lost ${normalLost}`);
});

function emptyGomoku() {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

test('gomoku: hard completes five and blocks an open four threat', () => {
  const win = emptyGomoku();
  for (let c = 3; c < 7; c++) win[7][c] = 0;
  for (let c = 3; c < 6; c++) win[8][c] = 1;
  const m = gomokuBot.createBot(0).getMove({ board: win, _options: opts('hard') });
  assert.equal(m.row, 7);
  assert.ok(m.col === 2 || m.col === 7);

  const blk = emptyGomoku();
  for (let c = 3; c < 7; c++) blk[7][c] = 1;
  blk[9][9] = 0; blk[9][10] = 0;
  const b = gomokuBot.createBot(0).getMove({ board: blk, _options: opts('hard') });
  assert.equal(b.row, 7);
  assert.ok(b.col === 2 || b.col === 7);
});

test('gomoku: all tiers return an empty on-board cell and do not mutate state', () => {
  const board = emptyGomoku();
  board[7][7] = 0; board[7][8] = 1; board[8][8] = 0;
  const before = JSON.stringify(board);
  for (const d of ['easy', 'normal', 'hard']) {
    const m = gomokuBot.createBot(1).getMove({ board, _options: opts(d) });
    assert.equal(board[m.row][m.col], null);
  }
  assert.equal(JSON.stringify(board), before);
});

test('go9: every tier plays legal moves, hard stays fast, state untouched', () => {
  for (const d of ['easy', 'normal', 'hard']) {
    const s = go9.createState();
    const bots = [go9Bot.createBot(0), go9Bot.createBot(1)];
    let worst = 0;
    for (let i = 0; i < 40 && s.winner === null && s.phase === 'playing'; i++) {
      const p = s.currentPlayer;
      const view = { ...s, _options: opts(d) };
      const snap = JSON.stringify(s.board);
      const t0 = Date.now();
      const mv = bots[p].getMove(view);
      worst = Math.max(worst, Date.now() - t0);
      assert.equal(JSON.stringify(s.board), snap);
      assert.equal(go9.handleMove(mv, s, p), null, `${d} illegal move ${JSON.stringify(mv)}`);
    }
    assert.ok(worst < 1000, `${d} took ${worst}ms`);
  }
});
