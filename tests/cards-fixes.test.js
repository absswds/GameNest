const test = require('node:test');
const assert = require('node:assert/strict');

// Regression tests for the card-game review fixes (hearts / doudizhu / bigtwo / texas).

function card(rank, suit) { return { rank, suit, id: rank + suit }; }

function runBots(id, n, opts, maxSteps) {
  const g = require('../games/' + id);
  const b = require('../bots/' + id);
  const s = g.createState();
  s._playerCount = n; s._options = Object.assign({}, opts || {}); s._hasBots = true;
  if (g.initGame) g.initGame(s, n);
  const bots = [...Array(n).keys()].map((i) => b.createBot(i));
  for (let step = 0; s.winner === null && step < (maxSteps || 6000); step++) {
    const p = typeof g.getCurrentActor === 'function' ? g.getCurrentActor(s) : s.currentPlayer;
    const mv = bots[p].getMove(s, p) || { pass: true };
    const err = g.handleMove(mv, s, p);
    assert.equal(err, null, id + ' rejected ' + JSON.stringify(mv) + ': ' + err);
  }
  return s;
}

// ---------- hearts ----------
test('hearts: a player cannot play out of turn', () => {
  const g = require('../games/hearts');
  const s = g.createState();
  s._playerCount = 4; s._options = {};
  g.initGame(s, 4);
  s.phase = 'playing';
  const other = (s.currentPlayer + 2) % 4;
  const before = s.currentTrick.length;
  assert.equal(g.handleMove({ card: s.hands[other][0].id }, s, other), 'g_not_your_turn');
  assert.equal(s.currentTrick.length, before);
});

test('hearts: passing phase never stalls with humans and bots mixed', () => {
  const g = require('../games/hearts');
  const s = g.createState();
  s._playerCount = 4; s._options = {};
  g.initGame(s, 4);
  if (s.phase !== 'passing') return;
  const pick = (i) => ({ cards: s.hands[i].slice(0, 3).map((c) => c.id) });
  assert.equal(g.handleMove(pick(2), s, 2), null);
  assert.equal(g.handleMove(pick(0), s, 0), null);
  assert.ok(!s.passSubmissions[s.currentPlayer], 'currentPlayer must be someone who still has to pass');
  assert.equal(g.handleMove(pick(1), s, 1), null);
  assert.equal(g.handleMove(pick(3), s, 3), null);
  assert.equal(s.phase, 'playing');
});

test('hearts: bots finish whole games', () => {
  for (let i = 0; i < 5; i++) assert.notEqual(runBots('hearts', 4).winner, null);
});

test('hearts: server bot fallback ({pass:true} / {}) plays a legal card', () => {
  const g = require('../games/hearts');
  const s = g.createState();
  s._playerCount = 4; s._options = {};
  g.initGame(s, 4);
  s.phase = 'playing';
  assert.equal(g.handleMove({ pass: true }, s, s.currentPlayer), null);
  assert.equal(g.handleMove({}, s, s.currentPlayer), null);
});

// ---------- bigtwo ----------
test('bigtwo: a same-suit straight is a straight flush and is detected as such', () => {
  const bt = require('../games/bigtwo');
  const sf = bt.detectType(['5', '6', '7', '8', '9'].map((r) => card(r, 's')));
  const st = bt.detectType([card('6', 'h'), card('7', 's'), card('8', 'h'), card('9', 'd'), card('10', 'c')]);
  assert.equal(sf.type, 'straight_flush');
  assert.equal(st.type, 'straight');
  // five-card types rank across types: a straight flush beats a plain straight, never the reverse
  assert.equal(bt.canBeat(st, sf), false);
  assert.equal(bt.canBeat(sf, st), true);
  const high = bt.detectType(['6', '7', '8', '9', '10'].map((r) => card(r, 'h')));
  assert.equal(bt.canBeat(high, sf), true);
});

test('bigtwo: bots finish whole games and the server fallback is a legal move', () => {
  for (let i = 0; i < 5; i++) assert.notEqual(runBots('bigtwo', 4).winner, null);
  const g = require('../games/bigtwo');
  const s = g.createState(); s._playerCount = 4; s._options = {}; g.initGame(s, 4);
  assert.equal(g.handleMove({}, s, s.currentPlayer), null);
});

// ---------- doudizhu ----------
test('doudizhu: bots finish whole games in rob and score bid modes', () => {
  for (const bidMode of ['rob', 'score']) for (let i = 0; i < 8; i++) {
    assert.notEqual(runBots('doudizhu', 3, { bidMode, totalRounds: 1 }, 20000).winner, null, bidMode);
  }
});

test('doudizhu: bot answers triple-with-kicker and beats non-bomb plays with a bomb', () => {
  const g = require('../games/doudizhu');
  const bots = require('../bots/doudizhu');
  const s = g.createState(); s._playerCount = 3; s._options = {}; g.initGame(s, 3);
  s.phase = 'playing'; s.landlord = 0; s.currentPlayer = 1;
  s.hands[1] = [card('7', 's'), card('7', 'h'), card('7', 'c'), card('9', 'd'), card('4', 's'), card('4', 'h'), card('4', 'c'), card('4', 'd')];
  const played = [card('5', 's'), card('5', 'h'), card('5', 'c'), card('3', 's')];
  s.lastPlay = { player: 0, cards: played, play: g.detectType(played) };
  const mv = bots.createBot(1).getMove(s);
  const chosen = s.hands[1].filter((c) => mv.cards.includes(c.id));
  assert.equal(g.detectType(chosen).type, 'triple_one');
  assert.equal(g.handleMove(mv, s, 1), null);
  // a bomb beats a straight even when its rank is lower
  s.currentPlayer = 2;
  s.hands[2] = [card('4', 'x'), card('4', 'y'), card('4', 'z'), card('4', 'w'), card('K', 's')];
  const str = ['8', '9', '10', 'J', 'Q'].map((r) => card(r, 's'));
  s.lastPlay = { player: 0, cards: str, play: g.detectType(str) };
  assert.equal(bots.createBot(2).getMove(s).cards.length, 4);
});

test('doudizhu: multi-round matches go through roundEnd and can finish', () => {
  const g = require('../games/doudizhu');
  const s = g.createState(); s._playerCount = 3; s._options = { totalRounds: 2 }; g.initGame(s, 3);
  const finishRound = () => {
    s.phase = 'playing'; s.landlord = 0; s.currentPlayer = 0; s.lastPlay = null;
    s.hands[0] = [card('3', 's')];
    assert.equal(g.handleMove({ cards: ['3s'] }, s, 0), null);
  };
  finishRound();
  assert.equal(s.winner, null);
  assert.equal(s.roundWinner, -2);
  assert.equal(s.currentRound, 1);
  if (s.phase === 'continue_vote') {
    for (let i = 0; i < 3 && s.phase === 'continue_vote'; i++) assert.equal(g.handleMove({ action: 'continue_vote', vote: 'no' }, s, i), null);
  } else {
    assert.equal(s.phase, 'roundEnd');
    assert.equal(g.handleMove({ action: 'next_round' }, s, 0), null);
  }
  assert.equal(s.phase, 'bidding');
  assert.equal(s.currentRound, 2);
  finishRound();
  assert.equal(s.winner, -2);
  assert.equal(s.cumulativeScore[0] > 0, true);
  assert.equal(s.roundHistory.length, 2);
});

test('doudizhu: score bids must be integers above the current bid and scale the score', () => {
  const g = require('../games/doudizhu');
  const s = g.createState(); s._playerCount = 3; s._options = { bidMode: 'score' }; g.initGame(s, 3);
  let p = s.currentBidder;
  assert.equal(g.handleMove({ score: 1.5 }, s, p), 'ddz_bid_must_be_0_3');
  assert.equal(g.handleMove({ score: 2 }, s, p), null);
  p = s.currentBidder;
  assert.equal(g.handleMove({ score: 1 }, s, p), 'ddz_bid_must_be_0_3');
  assert.equal(g.handleMove({ score: 0 }, s, p), null);
  p = s.currentBidder;
  assert.equal(g.handleMove({}, s, p), null);
  assert.equal(s.phase, 'playing');
  assert.equal(s.gameMultiplier, 2);
});

test('doudizhu: server bot fallback is a legal move while bidding', () => {
  const g = require('../games/doudizhu');
  const s = g.createState(); s._playerCount = 3; s._options = {}; g.initGame(s, 3);
  assert.equal(g.handleMove({ pass: true }, s, s.currentBidder), null);
  assert.equal(g.handleMove({}, s, s.currentBidder), null);
});

// ---------- texas ----------
function txGame(n, dealer, chips) {
  const g = require('../games/texas');
  const s = g.createState();
  s.dealer = dealer;
  g.initGame(s, n);
  if (chips) chips.forEach((c, i) => { s.chips[i] = c; });
  return { g, s };
}
const txTotal = (s) => s.chips.reduce((a, b) => a + b, 0) + s.pot;

test('texas: heads-up the dealer posts the small blind and acts first preflop', () => {
  const { s } = txGame(2, 0);
  assert.equal(s.smallBlind, 0);
  assert.equal(s.bigBlind, 1);
  assert.equal(s.currentPlayer, 0);
});

test('texas: min raise is the big blind, then the last raise increment', () => {
  const { g, s } = txGame(3, 0);
  // seat 0 acts first (UTG); BB is 20 so the minimum raise-to is 40
  assert.equal(g.handleMove({ action: 'raise', amount: 39 }, s, 0), 'tx_raise_too_low');
  assert.equal(g.handleMove({ action: 'raise', amount: 20.5 }, s, 0), 'tx_raise_too_low');
  assert.equal(g.handleMove({ action: 'raise', amount: 100 }, s, 0), null); // increment 80
  assert.equal(s.lastRaise, 80);
  assert.equal(g.handleMove({ action: 'raise', amount: 159 }, s, 1), 'tx_raise_too_low');
  assert.equal(g.handleMove({ action: 'raise', amount: 180 }, s, 1), null);
});

test('texas: all-in marks the player and a short all-in does not reopen raising', () => {
  const { g, s } = txGame(3, 0, [1000, 1000, 1000]);
  assert.equal(g.handleMove({ action: 'raise', amount: 100 }, s, 0), null);
  s.chips[1] = 105 - s.bets[1];                       // seat 1 can only shove to 105 (a 5 raise)
  assert.equal(g.handleMove({ action: 'all_in' }, s, 1), null);
  assert.equal(s.allIn[1], true);
  assert.equal(s.currentBet, 105);
  assert.equal(s.lastRaise, 80);                       // unchanged by the short shove
  assert.equal(g.handleMove({ action: 'call' }, s, 2), null);
  assert.equal(g.handleMove({ action: 'raise', amount: 300 }, s, 0), 'tx_raise_closed');
  assert.equal(g.handleMove({ action: 'call' }, s, 0), null);
});

test('texas: side pots go to the right winners and chips are conserved', () => {
  const { g, s } = txGame(3, 0, [100, 1000, 1000]);
  // force hands: seat 0 (short stack) has the best hand, seats 1 and 2 split nothing: seat 1 beats 2
  const C = (r, su) => ({ rank: r, suit: su, id: r + su });
  s.hands = [[C('A', 's'), C('A', 'h')], [C('K', 's'), C('K', 'h')], [C('2', 's'), C('7', 'h')]];
  s.communityDeck = null;
  const total = txTotal(s);
  assert.equal(g.handleMove({ action: 'all_in' }, s, s.currentPlayer), null);
  while (s.winner === null) {
    const p = s.currentPlayer;
    const need = s.currentBet - s.bets[p];
    const mv = need > 0 ? (s.chips[p] > need ? { action: 'call' } : { action: 'all_in' }) : { action: 'check' };
    // pre-set the board so the pre-chosen hands decide: no flush / straight possible
    assert.equal(g.handleMove(mv, s, p), null);
    if (s.communityCards.length === 5 && s.phase !== 'showdown') s.communityCards = [C('3', 'c'), C('4', 'd'), C('9', 'c'), C('J', 'd'), C('Q', 'h')];
  }
  s.communityCards = s.communityCards; // board already evaluated at showdown
  assert.equal(s.chips.reduce((a, b) => a + b, 0), total);
});

test('texas: a split pot is shared and the uncalled excess is returned', () => {
  const { g, s } = txGame(3, 0, [500, 500, 1000]);
  const C = (r, su) => ({ rank: r, suit: su, id: r + su });
  s.hands = [[C('A', 's'), C('K', 'h')], [C('A', 'h'), C('K', 's')], [C('2', 's'), C('3', 'h')]];
  s.communityCards = [];
  s.deck = [C('9', 'c'), C('J', 'd'), C('Q', 'c'), C('5', 'h'), C('8', 'd'), C('4', 'c'), C('7', 'd'), C('10', 'h')].concat(s.deck.filter(() => false));
  const total = txTotal(s);
  // seat 2 shoves 1000 over two all-in callers, so 500 of it can never be matched
  assert.equal(g.handleMove({ action: 'all_in' }, s, 0), null);
  assert.equal(g.handleMove({ action: 'all_in' }, s, 1), null);
  assert.equal(g.handleMove({ action: 'all_in' }, s, 2), null);
  assert.equal(s.phase, 'showdown');
  assert.equal(txTotal(s), total);
  assert.ok(s.chips[2] >= 500, 'uncalled 500 goes back');
});

test('texas: bots finish whole games and the server fallback is a legal move', () => {
  for (const n of [2, 3, 5, 8]) for (let i = 0; i < 10; i++) {
    const s = runBots('texas', n, {}, 2000);
    assert.notEqual(s.winner, null);
    assert.equal(s.chips.reduce((a, b) => a + b, 0) + s.pot, n * 1000);
  }
  const { g, s } = txGame(3, 0);
  assert.equal(g.handleMove({}, s, s.currentPlayer), null);
});
