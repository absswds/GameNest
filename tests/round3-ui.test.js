const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Round 3 UI-facing logic: minesweeper solo loss, numberbomb structured log, sudoku lives,
// 2048 race scores, sheeptile hit order, lang key parity.

test('minesweeper: a solo run ending on a mine is a loss (-2), not a draw', () => {
  const g = require('../games/minesweeper');
  let lost = false;
  for (let attempt = 0; attempt < 20 && !lost; attempt++) {
    const s = g.createState();
    g.initGame(s, 1);
    for (let r = 0; r < s.rows && s.winner === null; r++) {
      for (let c = 0; c < s.cols && s.winner === null; c++) {
        if (!s.revealed[0][r][c]) g.handleMove({ action: 'reveal', row: r, col: c }, s, 0);
      }
    }
    if (s.winner === -2) lost = true;
    assert.notEqual(s.winner, -1);
  }
  assert.ok(lost, 'expected at least one solo mine loss');
});

test('minesweeper: all players dead -> the survivor wins when the other player hits a mine', () => {
  const g = require('../games/minesweeper');
  const s = g.createState();
  g.initGame(s, 2);
  s.cellsRevealed = [5, 3];
  s.alive = [true, true];
  // force each player onto a mine
  const mineAt = (p) => { for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) if (s.mines[p][r][c]) return [r, c]; };
  // make sure first-click safety is already spent
  s.cellsRevealed = [5, 3];
  const [r0, c0] = mineAt(0), [r1, c1] = mineAt(1);
  // spend each player's first-click protection with a revealed non-mine cell
  for (const p of [0, 1]) for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) if (!s.mines[p][r][c] && !s.revealed[p].some((rw) => rw.some(Boolean))) s.revealed[p][r][c] = true;
  g.handleMove({ action: 'reveal', row: r0, col: c0 }, s, 0);
  assert.equal(s.winner, 1);
});

test('numberbomb: log messages carry structured fields', () => {
  const g = require('../games/numberbomb');
  const s = g.createState();
  g.initGame(s, 2);
  s.bomb = 50;
  assert.equal(g.handleMove({ guess: 80 }, s, 0), null);
  const m = s.messages[s.messages.length - 1];
  assert.equal(m.kind, 'range');
  assert.equal(m.player, 0);
  assert.equal(m.guess, 80);
  assert.equal(m.dir, 'high');
  assert.equal(m.high, 79);
  assert.equal(g.handleMove({ guess: 150 }, s, 1), 'nb_invalid_guess');
});

test('sudoku: a wrong value costs a life and is visible in the player view', () => {
  const g = require('../games/sudoku');
  const s = g.createState();
  g.initGame(s, 1);
  let rr, cc;
  outer: for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!s.given[r][c]) { rr = r; cc = c; break outer; }
  const wrong = s.solution[rr][cc] % 9 + 1;
  const before = g.playerView(s, 0).lives;
  assert.equal(g.handleMove({ type: 'fill', row: rr, col: cc, val: wrong }, s, 0), 'su_wrong');
  assert.equal(g.playerView(s, 0).lives, before - 1);
});

test('2048: player view lists everyone\'s score but not their boards', () => {
  const g = require('../games/2048');
  const s = g.createState();
  g.initGame(s, 3);
  s.scores = [10, 40, 20];
  const v = g.playerView(s, 0);
  assert.deepEqual(v.scores, [10, 40, 20]);
  assert.equal(v.aliveAll.length, 3);
  assert.equal(v.boards, undefined);
});

test('lang: keys added this round exist in both zh and en', () => {
  const load = (f) => {
    const win = {};
    const ls = { getItem: () => null, setItem() {} };
    new Function('window', 'localStorage', 'navigator', 'document', fs.readFileSync(path.join(__dirname, '../public/js/lang/' + f + '.js'), 'utf8'))(win, ls, { language: 'zh' }, { documentElement: {}, addEventListener() {} });
    return win.__LANG[f];
  };
  const zh = load('zh'), en = load('en');
  const keys = ['nb_out_of_range', 'nb_dir_high', 'nb_dir_low', 'nb_log_hit', 'nb_log_range', 'nb_log_forced',
    'om_log_draw', 'om_log_empty', 'om_log_pair', 'om_log_open_pair', 'ms_flag_mode', 'ms_solo_lost',
    'uno_stack_hint', 'sudoku_pick_cell', 'need_all_ready', 'need_more_players', 'pvp_only_hint',
    'toast_cell_taken', 'toast_illegal_move', 'toast_already_shot', 'tf_click_next', 'view_board'];
  for (const k of keys) {
    assert.ok(zh[k], 'zh missing ' + k);
    assert.ok(en[k], 'en missing ' + k);
    assert.equal((zh[k].match(/%s/g) || []).length, (en[k].match(/%s/g) || []).length, 'placeholder count differs for ' + k);
  }
});
