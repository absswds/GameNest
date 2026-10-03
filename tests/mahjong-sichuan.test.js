// tests/mahjong-sichuan.test.js — Sichuan Mahjong (四川血战到底)
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../games/lib/mahjong-core');
const game = require('../games/mahjong-sichuan');

// Build a tile object matching core.makeTile shape {k, n, id}
function t(k, n, i) { return { k, n, id: k + n + '#' + i }; }

// ---- initGame ----

test('initGame: 108 tiles, dealer 14 / others 13, phase void', () => {
  const s = game.createState();
  game.initGame(s, 4);
  assert.equal(s.phase, 'void');
  assert.equal(s.currentPlayer, 0);
  assert.equal(s.hands.length, 4);
  assert.equal(s.hands[0].length, 14); // dealer
  assert.equal(s.hands[1].length, 13);
  assert.equal(s.hands[2].length, 13);
  assert.equal(s.hands[3].length, 13);
  const dealt = s.hands.reduce((a, h) => a + h.length, 0);
  assert.equal(s.deck.length + dealt, 108);
  assert.equal(s.voidSuit.length, 4);
  assert.ok(s.voidSuit.every(v => v === undefined), 'void choices start unset');
  assert.equal(s.winner, null);
});

test('initGame: honours not present (Sichuan has no feng/jian)', () => {
  const s = game.createState();
  game.initGame(s, 4);
  for (const hand of s.hands) {
    for (const tile of hand) {
      assert.ok(tile.k === 'wan' || tile.k === 'tong' || tile.k === 'tiao',
        'expected number suit, got ' + tile.k);
    }
  }
});

test('initGame: supports 2 players', () => {
  const s = game.createState();
  game.initGame(s, 2);
  assert.equal(s.hands.length, 2);
  assert.equal(s.hands[0].length, 14);
  assert.equal(s.hands[1].length, 13);
  const dealt = s.hands.reduce((a, h) => a + h.length, 0);
  assert.equal(s.deck.length + dealt, 108);
});

// ---- dealer rotation (server writes state.dealerIndex before initGame) ----

test('initGame: dealerIndex rotates the dealer (extra tile + starting player)', () => {
  const s = game.createState();
  s.dealerIndex = 2; // server sets the next dealer before initGame
  game.initGame(s, 4);
  assert.equal(s.currentPlayer, 2, 'starting player is the dealer');
  assert.equal(s.hands[2].length, 14, 'dealer holds the extra tile');
  assert.equal(s.hands[0].length, 13);
  assert.equal(s.hands[1].length, 13);
  assert.equal(s.hands[3].length, 13);
});

test('initGame: dealer rotation persists through the void phase', () => {
  const s = game.createState();
  s.dealerIndex = 2;
  game.initGame(s, 4);
  assert.equal(s.phase, 'void');
  assert.equal(s.currentPlayer, 2, 'dealer picks void first');
  // all players pick void in turn order starting from the dealer
  for (const i of [2, 3, 0, 1]) {
    assert.equal(game.handleMove({ type: 'void', suit: 'wan' }, s, i), null);
  }
  assert.equal(s.phase, 'play');
  assert.equal(s.currentPlayer, 2, 'dealer starts play after void');
});

// ---- void selection ----

test('void: each player picks a suit; when all chosen, dealer plays', () => {
  const s = game.createState();
  game.initGame(s, 4);
  assert.equal(game.handleMove({ type: 'void', suit: 'wan' }, s, 0), null);
  assert.equal(s.voidSuit[0], 'wan');
  assert.equal(s.phase, 'void'); // not all chosen yet
  assert.equal(game.handleMove({ type: 'void', suit: 'tong' }, s, 1), null);
  assert.equal(game.handleMove({ type: 'void', suit: 'tiao' }, s, 2), null);
  assert.equal(game.handleMove({ type: 'void', suit: 'wan' }, s, 3), null);
  // all chosen -> dealer (0) plays; dealer already holds 14 (no draw)
  assert.equal(s.phase, 'play');
  assert.equal(s.currentPlayer, 0);
});

test('void: invalid suit rejected', () => {
  const s = game.createState();
  game.initGame(s, 4);
  const err = game.handleMove({ type: 'void', suit: 'feng' }, s, 0);
  assert.ok(err, 'expected error for invalid void suit');
  assert.equal(s.voidSuit[0], undefined);
});

test('void: wrong player cannot choose out of order', () => {
  const s = game.createState();
  game.initGame(s, 4);
  const err = game.handleMove({ type: 'void', suit: 'wan' }, s, 2);
  assert.ok(err, 'player 2 cannot pick during player 0 turn');
});

// ---- discard ----

function dealAllVoid(s, suits) {
  // suits: array of 4 suits per player
  for (let i = 0; i < suits.length; i++) {
    assert.equal(game.handleMove({ type: 'void', suit: suits[i] }, s, i), null);
  }
}

test('discard: dealer discards one tile, moves to claim phase', () => {
  const s = game.createState();
  game.initGame(s, 4);
  dealAllVoid(s, ['wan', 'tong', 'tiao', 'wan']);
  assert.equal(s.phase, 'play');
  const handLen = s.hands[0].length;
  const tileId = s.hands[0][0].id;
  assert.equal(game.handleMove({ type: 'discard', tileId }, s, 0), null);
  assert.equal(s.hands[0].length, handLen - 1);
  assert.equal(s.discards[0].length, 1);
  assert.equal(s.discards[0][0].id, tileId);
  assert.equal(s.phase, 'claim');
  assert.equal(s.lastDiscard.id, tileId);
});

test('discard: not your turn rejected', () => {
  const s = game.createState();
  game.initGame(s, 4);
  dealAllVoid(s, ['wan', 'tong', 'tiao', 'wan']);
  const err = game.handleMove({ type: 'discard', tileId: s.hands[1][0].id }, s, 1);
  assert.ok(err, 'player 1 cannot discard during player 0 turn');
});

test('discard: tile not in hand rejected', () => {
  const s = game.createState();
  game.initGame(s, 4);
  dealAllVoid(s, ['wan', 'tong', 'tiao', 'wan']);
  const err = game.handleMove({ type: 'discard', tileId: 'nope#999' }, s, 0);
  assert.ok(err, 'cannot discard a tile you do not hold');
});

// ---- pung ----

test('pung: a player can pung the last discard, then must discard', () => {
  const s = game.createState();
  game.initGame(s, 4);
  dealAllVoid(s, ['wan', 'tong', 'tiao', 'wan']);
  // Force player 0 to hold a wan:5 to discard, and player 1 to hold two wan:5.
  const w5 = t('wan', 5, 8001);
  s.hands[0].push(w5);
  if (s.hands[0].length > 14) s.hands[0].shift(); // keep dealer at 14
  // Build player 1 a clean 13-tile hand containing two wan:5
  s.hands[1] = [
    t('wan', 5, 9001), t('wan', 5, 9002),
    t('tong', 1, 9003), t('tong', 2, 9004), t('tong', 3, 9005),
    t('tong', 4, 9006), t('tong', 5, 9007), t('tong', 6, 9008),
    t('tiao', 1, 9009), t('tiao', 2, 9010), t('tiao', 3, 9011),
    t('tiao', 4, 9012), t('tiao', 5, 9013),
  ];

  assert.equal(game.handleMove({ type: 'discard', tileId: w5.id }, s, 0), null);
  assert.equal(s.phase, 'claim');
  const before = s.hands[1].length;
  assert.equal(game.handleMove({ type: 'pung' }, s, 1), null);
  // pung: 2 tiles removed from hand, meld added
  assert.equal(s.hands[1].length, before - 2);
  assert.equal(s.melds[1].length, 1);
  assert.equal(s.melds[1][0].type, 'pung');
  assert.equal(s.currentPlayer, 1);
  assert.equal(s.phase, 'play'); // must discard
});

// ---- win detection ----

function winningHand() {
  // 4 melds + pair, using wan + tiao only (void = tong)
  // 1w2w3w, 4w5w6w, 7w8w9w (3 seq), 1t1t1t (pung), 2iao2iao (pair)
  const hand = [
    t('wan', 1, 1), t('wan', 2, 2), t('wan', 3, 3),
    t('wan', 4, 4), t('wan', 5, 5), t('wan', 6, 6),
    t('wan', 7, 7), t('wan', 8, 8), t('wan', 9, 9),
    t('tiao', 1, 10), t('tiao', 1, 11), t('tiao', 1, 12),
    t('tiao', 2, 13), t('tiao', 2, 14),
  ];
  return hand;
}

test('win: self-draw winning hand registers a winner', () => {
  const s = game.createState();
  game.initGame(s, 4);
  dealAllVoid(s, ['tong', 'tong', 'tong', 'tong']); // void tong; winning hand has no tong
  // Set player 0 hand to a winning 14-tile hand
  s.hands[0] = winningHand();
  s.phase = 'play';
  s.currentPlayer = 0;
  s.drawn = s.hands[0][13].id; // simulate last drawn
  const res = game.handleMove({ type: 'win' }, s, 0);
  assert.equal(res, null);
  assert.ok(s.winners.includes(0), 'player 0 should be a winner');
  // 血战到底：一局未结束（仅1家胡，牌墙未空），下一家摸牌继续 → phase 回到 play
  assert.equal(s.phase, 'play', 'blood battle continues; next player draws');
  assert.equal(s.currentPlayer, 1, 'turn advances to next non-winner player');
  assert.equal(s.hands[1].length, 14, 'next player drew a tile');
});

test('win: cannot win while holding void-suit tiles', () => {
  const s = game.createState();
  game.initGame(s, 4);
  dealAllVoid(s, ['tiao', 'tiao', 'tiao', 'tiao']); // void = tiao
  // winning hand contains tiao tiles -> illegal win
  s.hands[0] = winningHand();
  s.phase = 'play';
  s.currentPlayer = 0;
  const res = game.handleMove({ type: 'win' }, s, 0);
  assert.ok(res, 'expected error: still holding void-suit tiles');
  assert.ok(!s.winners.includes(0));
});

test('win: non-winning hand rejected', () => {
  const s = game.createState();
  game.initGame(s, 4);
  dealAllVoid(s, ['tong', 'tong', 'tong', 'tong']);
  // Scrambled hand that cannot win
  s.hands[0] = [
    t('wan', 1, 1), t('wan', 4, 4), t('wan', 7, 7),
    t('tiao', 2, 8), t('tiao', 5, 11), t('tiao', 8, 14),
    t('wan', 2, 2), t('wan', 5, 5), t('wan', 8, 8),
    t('tiao', 3, 9), t('tiao', 6, 12), t('tiao', 9, 15),
    t('wan', 3, 3), t('wan', 6, 6),
  ];
  s.phase = 'play';
  s.currentPlayer = 0;
  const res = game.handleMove({ type: 'win' }, s, 0);
  assert.ok(res, 'scrambled hand should not win');
});

// ---- playerView ----

test('playerView: hides opponent hands, reveals own hand + melds/discards/void', () => {
  const s = game.createState();
  game.initGame(s, 4);
  dealAllVoid(s, ['wan', 'tong', 'tiao', 'wan']);
  const view = game.playerView(s, 0);
  // own hand fully visible
  assert.deepEqual(view.hands[0], s.hands[0]);
  // opponent hands hidden: only count
  assert.equal(view.hands[1].length, s.hands[1].length);
  assert.ok(view.hands[1].every(t => t && t.k === undefined && t.n === undefined),
    'opponent tiles should be blanked');
  // public info preserved
  assert.deepEqual(view.discards, s.discards);
  assert.deepEqual(view.melds, s.melds);
  assert.deepEqual(view.voidSuit, s.voidSuit);
  assert.equal(view.phase, s.phase);
});

// ---- blood battle: game continues after first win ----

test('blood battle: a second player can still win after first winner', () => {
  const s = game.createState();
  game.initGame(s, 4);
  dealAllVoid(s, ['tong', 'tong', 'tong', 'tong']);
  // Player 0 wins
  s.hands[0] = winningHand();
  s.phase = 'play';
  s.currentPlayer = 0;
  s.drawn = s.hands[0][13].id;
  assert.equal(game.handleMove({ type: 'win' }, s, 0), null);
  assert.ok(s.winners.includes(0));
  // Player 1 also has a winning hand and it's their turn
  s.hands[1] = winningHand();
  s.phase = 'play';
  s.currentPlayer = 1;
  s.drawn = s.hands[1][13].id;
  assert.equal(game.handleMove({ type: 'win' }, s, 1), null);
  assert.ok(s.winners.includes(1));
});

// ---- non-blood-battle: one win ends the round ----

test('non-blood-battle: single win ends the round immediately', () => {
  const s = game.createState();
  // Inject options before initGame
  s._options = { mahjongMode: 'sichuan', mj_bloodBattle: false };
  game.initGame(s, 4);
  assert.equal(s._bloodBattle, false, 'blood battle disabled via option');
  dealAllVoid(s, ['tong', 'tong', 'tong', 'tong']);
  // Player 0 wins
  s.hands[0] = winningHand();
  s.phase = 'play';
  s.currentPlayer = 0;
  s.drawn = s.hands[0][13].id;
  assert.equal(game.handleMove({ type: 'win' }, s, 0), null);
  assert.ok(s.winners.includes(0));
  assert.equal(s.phase, 'over', 'round ends immediately in non-blood-battle mode');
});

test('blood battle: enabled by default', () => {
  const s = game.createState();
  game.initGame(s, 4);
  assert.equal(s._bloodBattle, true, 'default is blood battle');
});

// ---- multi-winner (一炮多响) ----

test('multi-winner: two players can win from same discard', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'sichuan', mj_multiWinner: true, mj_bloodBattle: true };
  game.initGame(s, 4);
  assert.equal(s._multiWinner, true, 'multi-winner enabled');
  dealAllVoid(s, ['tong', 'tong', 'tong', 'tong']);
  // Player 0 discards a wan:5
  const discardTile = t('wan', 5, 7001);
  s.hands[0].push(discardTile);
  if (s.hands[0].length > 14) s.hands[0].shift();
  assert.equal(game.handleMove({ type: 'discard', tileId: discardTile.id }, s, 0), null);
  assert.equal(s.phase, 'claim');
  // Player 1 and Player 2 both have winning hands that need wan:5
  // Void suit is 'tong' for all, so hands must only use wan + tiao
  // Build: 123wan 456wan 789wan 11tiao + wan:5 = 14 tiles, wins with wan:5
  function winningHandNeeding() {
    return [
      t('wan', 1, 8001), t('wan', 2, 8002), t('wan', 3, 8003),
      t('wan', 4, 8004), t('wan', 5, 8005), t('wan', 6, 8006),
      t('wan', 7, 8007), t('wan', 8, 8008), t('wan', 9, 8009),
      t('tiao', 1, 8010), t('tiao', 1, 8011),
      t('wan', 5, 8012), t('wan', 5, 8013),
    ];
  }
  s.hands[1] = winningHandNeeding();
  s.hands[2] = winningHandNeeding();
  // Player 1 wins
  assert.equal(game.handleMove({ type: 'win' }, s, 1), null);
  assert.ok(s.winners.includes(1));
  // In multi-winner mode, claim phase continues
  assert.equal(s.phase, 'claim', 'claim phase continues for other winners');
  // Player 2 also wins
  assert.equal(game.handleMove({ type: 'win' }, s, 2), null);
  assert.ok(s.winners.includes(2));
  // Player 3 passes → claim phase ends
  assert.equal(game.handleMove({ type: 'pass' }, s, 3), null);
  // Both winners recorded
  assert.ok(s.winners.includes(1) && s.winners.includes(2));
});

test('multi-winner: disabled by default', () => {
  const s = game.createState();
  game.initGame(s, 4);
  assert.equal(s._multiWinner, false, 'multi-winner disabled by default');
});

test('multi-winner + blood battle: self-draw win advances turn (no deadlock)', () => {
  // Bug 1 regression: under multiWinner+bloodBattle, a self-draw win has no
  // discard to claim, so registerWin must advance the turn instead of returning
  // early and leaving currentPlayer pointing at the already-won player.
  const s = game.createState();
  s._options = { mahjongMode: 'sichuan', mj_multiWinner: true, mj_bloodBattle: true };
  game.initGame(s, 4);
  assert.equal(s._multiWinner, true, 'multi-winner enabled');
  dealAllVoid(s, ['tong', 'tong', 'tong', 'tong']); // void tong; winning hand uses wan + tiao only
  // Player 0: 123wan 456wan 789wan 111tiao + 2tiao pair = 14-tile winning hand
  s.hands[0] = winningHand();
  s.phase = 'play';
  s.currentPlayer = 0;
  s.drawn = s.hands[0][13].id; // simulate last drawn tile
  const res = game.handleMove({ type: 'win' }, s, 0);
  assert.equal(res, null, 'self-draw win should succeed');
  assert.ok(s.winners.includes(0), 'player 0 should be a winner');
  // Blood battle continues: turn must advance to next non-winner, never deadlock
  assert.equal(s.phase, 'play', 'blood battle continues to next player');
  assert.equal(s.currentPlayer, 1, 'turn advances to next non-winner player');
  assert.equal(s.hands[1].length, 14, 'next player drew a tile');
});

test('multi-winner + non-blood-battle: self-draw win ends round', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'sichuan', mj_multiWinner: true, mj_bloodBattle: false };
  game.initGame(s, 4);
  dealAllVoid(s, ['tong', 'tong', 'tong', 'tong']);
  s.hands[0] = winningHand();
  s.phase = 'play';
  s.currentPlayer = 0;
  s.drawn = s.hands[0][13].id;
  const res = game.handleMove({ type: 'win' }, s, 0);
  assert.equal(res, null, 'self-draw win should succeed');
  assert.ok(s.winners.includes(0), 'player 0 should be a winner');
  assert.equal(s.phase, 'over', 'non-blood-battle: single win ends the round');
});

test('multi-winner: 3 winners ends game immediately (no claim-phase deadlock)', () => {
  // Bug 2 regression: when 3 of 4 players win from the same discard, the game
  // must end right away. Before the fix finishMultiWinnerClaim called advanceTurn
  // with 3 winners, which looped forever (maxSteps exceeded).
  const s = game.createState();
  s._options = { mahjongMode: 'sichuan', mj_multiWinner: true, mj_bloodBattle: true };
  game.initGame(s, 4);
  dealAllVoid(s, ['tong', 'tong', 'tong', 'tong']);
  // Player 0 discards a wan:5
  const discardTile = t('wan', 5, 7001);
  s.hands[0].push(discardTile);
  if (s.hands[0].length > 14) s.hands[0].shift();
  assert.equal(game.handleMove({ type: 'discard', tileId: discardTile.id }, s, 0), null);
  assert.equal(s.phase, 'claim');
  // Players 1, 2, 3 all hold 13-tile hands that win with wan:5
  function winningHandNeeding() {
    return [
      t('wan', 1, 8001), t('wan', 2, 8002), t('wan', 3, 8003),
      t('wan', 4, 8004), t('wan', 5, 8005), t('wan', 6, 8006),
      t('wan', 7, 8007), t('wan', 8, 8008), t('wan', 9, 8009),
      t('tiao', 1, 8010), t('tiao', 1, 8011),
      t('wan', 5, 8012), t('wan', 5, 8013),
    ];
  }
  s.hands[1] = winningHandNeeding();
  s.hands[2] = winningHandNeeding();
  s.hands[3] = winningHandNeeding();
  // All three win from the same discard
  assert.equal(game.handleMove({ type: 'win' }, s, 1), null);
  assert.equal(game.handleMove({ type: 'win' }, s, 2), null);
  assert.equal(game.handleMove({ type: 'win' }, s, 3), null);
  assert.ok(s.winners.includes(1) && s.winners.includes(2) && s.winners.includes(3),
    'all three winners recorded');
  // 3 winners → game must be over, not stuck in claim/play
  assert.equal(s.phase, 'over', '3 winners should end the game immediately');
});

// ---- 刮风下雨 (gang scoring) ----

test('rain: 直杠 (kong from discard) scores immediately', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'sichuan', mj_rain: true };
  game.initGame(s, 4);
  assert.equal(s._rain, true, 'rain enabled');
  dealAllVoid(s, ['wan', 'tong', 'tiao', 'wan']);
  // Player 0 discards wan:5
  const w5 = t('wan', 5, 7001);
  s.hands[0].push(w5);
  if (s.hands[0].length > 14) s.hands[0].shift();
  assert.equal(game.handleMove({ type: 'discard', tileId: w5.id }, s, 0), null);
  // Player 1 has 3x wan:5 and kongs (直杠)
  s.hands[1] = [
    t('wan', 5, 9001), t('wan', 5, 9002), t('wan', 5, 9003),
    t('tong', 1, 9004), t('tong', 2, 9005), t('tong', 3, 9006),
    t('tong', 4, 9007), t('tong', 5, 9008), t('tong', 6, 9009),
    t('tiao', 1, 9010), t('tiao', 2, 9011), t('tiao', 3, 9012), t('tiao', 4, 9013),
  ];
  assert.equal(game.handleMove({ type: 'kong' }, s, 1), null);
  // 直杠: player 1 gets +2, player 0 (discarder) gets -2
  assert.equal(s._gangScore[1], 2, 'kong player gains 2 from 直杠');
  assert.equal(s._gangScore[0], -2, 'discarder loses 2 from 直杠');
});

test('rain: 暗杠 (self-kong) scores from all non-winners', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'sichuan', mj_rain: true };
  game.initGame(s, 4);
  dealAllVoid(s, ['wan', 'tong', 'tiao', 'wan']);
  // Player 0 has 4x wan:1 and draws, then self-kongs
  s.hands[0] = [
    t('wan', 1, 8001), t('wan', 1, 8002), t('wan', 1, 8003), t('wan', 1, 8004),
    t('tong', 2, 8005), t('tong', 3, 8006), t('tong', 4, 8007),
    t('tiao', 1, 8008), t('tiao', 2, 8009), t('tiao', 3, 8010),
    t('tiao', 5, 8011), t('tiao', 6, 8012), t('tiao', 7, 8013), t('tiao', 8, 8014),
  ];
  s.phase = 'play';
  s.currentPlayer = 0;
  s.drawn = s.hands[0][13].id;
  assert.equal(game.handleMove({ type: 'selfkong', suit: 'wan', num: 1 }, s, 0), null);
  // 暗杠: player 0 gets +2 from each of 3 non-winners = +6
  assert.equal(s._gangScore[0], 6, 'self-kong gains 2 from each non-winner');
  assert.equal(s._gangScore[1], -2);
  assert.equal(s._gangScore[2], -2);
  assert.equal(s._gangScore[3], -2);
});

test('rain: disabled by default (no gang scoring)', () => {
  const s = game.createState();
  game.initGame(s, 4);
  assert.equal(s._rain, false, 'rain disabled by default');
  dealAllVoid(s, ['wan', 'tong', 'tiao', 'wan']);
  const w5 = t('wan', 5, 7001);
  s.hands[0].push(w5);
  if (s.hands[0].length > 14) s.hands[0].shift();
  assert.equal(game.handleMove({ type: 'discard', tileId: w5.id }, s, 0), null);
  s.hands[1] = [
    t('wan', 5, 9001), t('wan', 5, 9002), t('wan', 5, 9003),
    t('tong', 1, 9004), t('tong', 2, 9005), t('tong', 3, 9006),
    t('tong', 4, 9007), t('tong', 5, 9008), t('tong', 6, 9009),
    t('tiao', 1, 9010), t('tiao', 2, 9011), t('tiao', 3, 9012), t('tiao', 4, 9013),
  ];
  assert.equal(game.handleMove({ type: 'kong' }, s, 1), null);
  assert.equal(s._gangScore[0], 0, 'no gang scoring when rain disabled');
  assert.equal(s._gangScore[1], 0, 'no gang scoring when rain disabled');
});

// ---- 流局查花猪/查大叫 ----

test('penalties: 查花猪 detects player with void suit tiles', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'sichuan', mj_checkFlowerPig: true };
  game.initGame(s, 4);
  dealAllVoid(s, ['wan', 'tong', 'tiao', 'wan']);
  // Simulate round end: deck empty, no winners
  s.deck = [];
  s.phase = 'over';
  // Player 0 still has wan tiles (void=wan) → flower pig
  s.hands[0] = [
    t('wan', 1, 7001), t('wan', 2, 7002), t('wan', 3, 7003),
    t('tong', 1, 7004), t('tong', 2, 7005), t('tong', 3, 7006),
    t('tiao', 1, 7007), t('tiao', 2, 7008), t('tiao', 3, 7009),
    t('tiao', 4, 7010), t('tiao', 5, 7011), t('tiao', 6, 7012), t('tiao', 7, 7013),
  ];
  // Player 1-3 have no void suit tiles (void=tong/tiao/wan respectively, hands clean)
  s.hands[1] = [
    t('wan', 1, 8001), t('wan', 2, 8002), t('wan', 3, 8003),
    t('tiao', 1, 8004), t('tiao', 2, 8005), t('tiao', 3, 8006),
    t('tiao', 4, 8007), t('tiao', 5, 8008), t('tiao', 6, 8009),
    t('tiao', 7, 8010), t('tiao', 8, 8011), t('tiao', 9, 8012), t('wan', 4, 8013),
  ];
  s.hands[2] = [
    t('wan', 1, 8101), t('wan', 2, 8102), t('wan', 3, 8103),
    t('wan', 4, 8104), t('wan', 5, 8105), t('wan', 6, 8106),
    t('tong', 1, 8107), t('tong', 2, 8108), t('tong', 3, 8109),
    t('tong', 4, 8110), t('tong', 5, 8111), t('tong', 6, 8112), t('tong', 7, 8113),
  ];
  s.hands[3] = [
    t('tong', 1, 8201), t('tong', 2, 8202), t('tong', 3, 8203),
    t('tong', 4, 8204), t('tong', 5, 8205), t('tong', 6, 8206),
    t('tiao', 1, 8207), t('tiao', 2, 8208), t('tiao', 3, 8209),
    t('tiao', 4, 8210), t('tiao', 5, 8211), t('tiao', 6, 8212), t('tiao', 7, 8213),
  ];
  const result = game.calculatePenalties(s);
  // Player 0 is flower pig (has wan tiles, void=wan)
  assert.ok(result.penalties[0] < 0, 'flower pig pays penalty');
  assert.ok(result.penalties[1] > 0 || result.penalties[2] > 0 || result.penalties[3] > 0, 'non-pigs receive penalty');
});

// ---- 最后四张自动胡 ----

test('lastFourAutoWin: must win when deck <= 4 and can win', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'sichuan', mj_lastFourAutoWin: true };
  game.initGame(s, 4);
  dealAllVoid(s, ['tong', 'tong', 'tong', 'tong']);
  // Player 0 discards wan:5
  const w5 = t('wan', 5, 7001);
  s.hands[0].push(w5);
  if (s.hands[0].length > 14) s.hands[0].shift();
  assert.equal(game.handleMove({ type: 'discard', tileId: w5.id }, s, 0), null);
  // Player 1 has winning hand needing wan:5
  s.hands[1] = [
    t('wan', 1, 8001), t('wan', 2, 8002), t('wan', 3, 8003),
    t('wan', 4, 8004), t('wan', 5, 8005), t('wan', 6, 8006),
    t('wan', 7, 8007), t('wan', 8, 8008), t('wan', 9, 8009),
    t('tiao', 1, 8010), t('tiao', 1, 8011),
    t('wan', 5, 8012), t('wan', 5, 8013),
  ];
  // Set deck to 4 tiles
  s.deck = [t('tong', 9, 9901), t('tong', 9, 9902), t('tong', 9, 9903), t('tong', 9, 9904)];
  // Player 1 tries to pass → should be rejected
  const err = game.handleMove({ type: 'pass' }, s, 1);
  assert.equal(err, 'mj_last_four_must_win', 'cannot pass when can win on last 4');
  // Player 1 wins → should succeed
  assert.equal(game.handleMove({ type: 'win' }, s, 1), null);
});

// ---- 换三张 ----

test('swapThree: players swap 3 same-suit tiles with partner', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'sichuan', mj_swapThree: true };
  game.initGame(s, 4);
  assert.equal(s.phase, 'swap', 'starts in swap phase');
  // Give player 0 three wan tiles and player 2 three tong tiles
  s.hands[0] = [
    t('wan', 1, 7001), t('wan', 2, 7002), t('wan', 3, 7003),
    t('tong', 1, 7004), t('tong', 2, 7005), t('tong', 3, 7006),
    t('tiao', 1, 7007), t('tiao', 2, 7008), t('tiao', 3, 7009),
    t('tiao', 4, 7010), t('tiao', 5, 7011), t('tiao', 6, 7012), t('tiao', 7, 7013),
  ];
  s.hands[2] = [
    t('tong', 4, 8001), t('tong', 5, 8002), t('tong', 6, 8003),
    t('wan', 4, 8004), t('wan', 5, 8005), t('wan', 6, 8006),
    t('wan', 7, 8007), t('wan', 8, 8008), t('wan', 9, 8009),
    t('tiao', 1, 8010), t('tiao', 2, 8011), t('tiao', 3, 8012), t('tiao', 4, 8013),
  ];
  // Player 0 selects 3 wan tiles
  assert.equal(game.handleMove({ type: 'swap', tileIds: [7001, 7002, 7003].map((_, i) => 'wan' + (i + 1) + '#700' + (i + 1)) }, s, 0), null);
  // Player 1 selects 3 tiles (any same suit)
  s.hands[1] = [
    t('wan', 1, 7101), t('wan', 2, 7102), t('wan', 3, 7103),
    t('tong', 1, 7104), t('tong', 2, 7105), t('tong', 3, 7106),
    t('tiao', 1, 7107), t('tiao', 2, 7108), t('tiao', 3, 7109),
    t('tiao', 4, 7110), t('tiao', 5, 7111), t('tiao', 6, 7112), t('tiao', 7, 7113),
  ];
  assert.equal(game.handleMove({ type: 'swap', tileIds: ['wan1#7101', 'wan2#7102', 'wan3#7103'] }, s, 1), null);
  // Player 2 selects 3 tong tiles
  assert.equal(game.handleMove({ type: 'swap', tileIds: ['tong4#8001', 'tong5#8002', 'tong6#8003'] }, s, 2), null);
  // Player 3 selects 3 tiles
  s.hands[3] = [
    t('tong', 7, 8101), t('tong', 8, 8102), t('tong', 9, 8103),
    t('wan', 1, 8104), t('wan', 2, 8105), t('wan', 3, 8106),
    t('tiao', 5, 8107), t('tiao', 6, 8108), t('tiao', 7, 8109),
    t('tiao', 8, 8110), t('tiao', 9, 8111), t('tiao', 1, 8112), t('tiao', 2, 8113),
  ];
  assert.equal(game.handleMove({ type: 'swap', tileIds: ['tong7#8101', 'tong8#8102', 'tong9#8103'] }, s, 3), null);
  // After all swap, phase should be void
  assert.equal(s.phase, 'void', 'swap complete → void phase');
  // Player 0 should now have player 2's tong tiles
  const player0Suits = s.hands[0].map(t => t.k);
  assert.ok(player0Suits.includes('tong'), 'player 0 received tong tiles from partner');
});

test('swapThree: disabled by default', () => {
  const s = game.createState();
  game.initGame(s, 4);
  assert.equal(s._swapThree, false, 'disabled by default');
  assert.equal(s.phase, 'void', 'starts in void phase');
});

test('lastFourAutoWin: disabled by default', () => {
  const s = game.createState();
  game.initGame(s, 4);
  assert.equal(s._lastFourAutoWin, false, 'disabled by default');
});

test('penalties: no penalties when feature disabled', () => {
  const s = game.createState();
  game.initGame(s, 4);
  dealAllVoid(s, ['wan', 'tong', 'tiao', 'wan']);
  s.deck = [];
  s.phase = 'over';
  s.hands[0] = [t('wan', 1, 7001), t('wan', 2, 7002), t('wan', 3, 7003), t('tong', 1, 7004), t('tong', 2, 7005), t('tong', 3, 7006), t('tiao', 1, 7007), t('tiao', 2, 7008), t('tiao', 3, 7009), t('tiao', 4, 7010), t('tiao', 5, 7011), t('tiao', 6, 7012), t('tiao', 7, 7013)];
  const result = game.calculatePenalties(s);
  assert.equal(result.penalties.every(p => p === 0), true, 'no penalties when disabled');
});

test('sichuan bot works on the masked playerView (no state.deck, only deckCount)', () => {
  const g = require('../games/mahjong-sichuan');
  const bot = require('../bots/mahjong-sichuan');
  const st = g.createState(); g.initGame(st, 4);
  const view = g.playerView(st, st.currentPlayer);
  assert.strictEqual(view.deck, undefined);
  const mv = bot.createBot(st.currentPlayer).getMove(view, st.currentPlayer);
  assert.ok(mv && typeof mv === 'object');
});
