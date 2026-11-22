'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bj = require('../games/blackjack');
const bjBot = require('../bots/blackjack');
const serverZh = require('../lang/server-zh');
const serverEn = require('../lang/server-en');

function card(rank, suit = 's') {
  return { rank, suit, id: rank + suit };
}

describe('Blackjack — room options', () => {
  it('reads room options from state._options like the server sets them', () => {
    const s = bj.createState();
    s._options = { decks: 4, rounds: 5, turnTime: 30 };
    bj.initGame(s, 2);
    assert.equal(s.decks, 4);
    assert.equal(s.totalRounds, 5);
    assert.equal(s.shoeTotal, 208);
  });
});

describe('Blackjack — hand totals and soft aces', () => {
  it('computes hard, soft, bust, and natural blackjack totals', () => {
    // Natural blackjack (A + K = 21, 2 cards)
    const nat = bj.handValue([card('A', 's'), card('K', 'h')]);
    assert.equal(nat.total, 21);
    assert.equal(nat.soft, true);
    assert.equal(nat.blackjack, true);
    assert.equal(nat.bust, false);
    assert.equal(nat.label, '21');

    // Soft 17: A + 6 -> label "7/17"
    const s17 = bj.handValue([card('A', 's'), card('6', 'd')]);
    assert.equal(s17.total, 17);
    assert.equal(s17.soft, true);
    assert.equal(s17.low, 7);
    assert.equal(s17.blackjack, false);
    assert.equal(s17.label, '7/17');
    assert.equal(bj.formatTotal([card('A', 's'), card('6', 'd')]), '7/17');

    // Two aces: A + A -> 2/12
    const twoAces = bj.handValue([card('A', 's'), card('A', 'h')]);
    assert.equal(twoAces.total, 12);
    assert.equal(twoAces.soft, true);
    assert.equal(twoAces.label, '2/12');

    // Soft hand that converts to hard when hitting a high card: A + 6 + 10 = hard 17
    const hard17 = bj.handValue([card('A', 's'), card('6', 'd'), card('10', 'c')]);
    assert.equal(hard17.total, 17);
    assert.equal(hard17.soft, false);
    assert.equal(hard17.label, '17');

    // 3-card 21 is not natural blackjack
    const three21 = bj.handValue([card('7', 's'), card('7', 'h'), card('7', 'd')]);
    assert.equal(three21.total, 21);
    assert.equal(three21.blackjack, false);

    // Bust (>21)
    const bust = bj.handValue([card('10', 's'), card('8', 'h'), card('5', 'd')]);
    assert.equal(bust.total, 23);
    assert.equal(bust.bust, true);
  });
});

describe('Blackjack — dealing, dealer soft-17 stand, payouts, and rules', () => {
  it('dealer stands on soft 17 and draws on 16', () => {
    const s = bj.createState();
    s.options = { decks: 2, rounds: 5, turnTime: 20 };
    bj.initGame(s, 1);

    // Remember drawCard pops from the end of state.shoe.
    // Deal order for 1 player: player[0] card1, player[0] card2, dealer card1, dealer card2, then subsequent hits.
    // Case 1: Dealer has A + 6 (soft 17) -> must stand without drawing the 5 from the shoe.
    s.shoe = [
      card('5', 'c'), // would be drawn if dealer hit soft 17
      card('6', 'h'), // dealer card 2
      card('A', 'd'), // dealer card 1
      card('8', 's'), // player card 2
      card('10', 's') // player card 1 (player has 18)
    ];
    s.shoeTotal = 16; // keep threshold <= 4 so shoe is not reshuffled

    assert.equal(bj.handleMove({ type: 'bet', amount: 50 }, s, 0), null);
    assert.equal(s.phase, 'play');
    assert.equal(bj.handleMove({ type: 'stand' }, s, 0), null);

    assert.equal(s.phase, 'settle');
    assert.equal(s.dealerHand.length, 2, 'Dealer must stand on soft 17 (A+6)');
    assert.equal(s.lastResults[0].outcome, 'win');
    assert.equal(s.chips[0], 1050);

    // Advance to round 2: Dealer has A + 5 (soft 16) -> must draw!
    assert.equal(bj.handleMove({ type: 'next' }, s, 0), null);
    s.shoe = [
      card('2', 'c'), // dealer draw -> A+5+2 = 18
      card('5', 'h'), // dealer card 2
      card('A', 'd'), // dealer card 1
      card('7', 's'), // player card 2
      card('10', 's') // player card 1 (player has 17)
    ];
    s.shoeTotal = 16;

    assert.equal(bj.handleMove({ type: 'bet', amount: 50 }, s, 0), null);
    assert.equal(bj.handleMove({ type: 'stand' }, s, 0), null);
    assert.equal(s.dealerHand.length, 3, 'Dealer must hit on soft 16');
    assert.equal(bj.handValue(s.dealerHand).total, 18);
    assert.equal(s.lastResults[0].outcome, 'lose');
    assert.equal(s.chips[0], 1000);
  });

  it('pays 3:2 rounded down on natural blackjack (e.g. bet 25 -> +37 net)', () => {
    const s = bj.createState();
    bj.initGame(s, 1);

    // Player gets A + K (natural blackjack), dealer gets 9 + 8 (17).
    s.shoe = [
      card('8', 'c'), // dealer card 2
      card('9', 'd'), // dealer card 1
      card('K', 'h'), // player card 2
      card('A', 's')  // player card 1
    ];
    s.shoeTotal = 12;

    assert.equal(bj.handleMove({ type: 'bet', amount: 25 }, s, 0), null);
    // Natural blackjack auto-stands, so round settles immediately!
    assert.equal(s.phase, 'settle');
    assert.equal(s.lastResults[0].outcome, 'blackjack');
    assert.equal(s.lastResults[0].net, 37); // floor(25 * 1.5) = 37
    assert.equal(s.lastResults[0].payout, 62); // 25 + 37
    assert.equal(s.chips[0], 1037);
  });

  it('settles immediately when dealer up-card is Ace or 10-value and dealer has blackjack', () => {
    const s = bj.createState();
    bj.initGame(s, 2);

    // Seat 0 has 20 (10+Q), Seat 1 has natural BJ (A+J), Dealer has natural BJ (A up + K hole).
    s.shoe = [
      card('K', 'c'), // dealer card 2 (hole)
      card('A', 'd'), // dealer card 1 (up-card = Ace)
      card('J', 'h'), // seat 1 card 2
      card('A', 'h'), // seat 1 card 1 (Blackjack)
      card('Q', 's'), // seat 0 card 2
      card('10', 's') // seat 0 card 1 (20)
    ];
    s.shoeTotal = 16;

    assert.equal(bj.handleMove({ type: 'bet', amount: 100 }, s, 0), null);
    assert.equal(bj.handleMove({ type: 'bet', amount: 100 }, s, 1), null);

    // Should skip play phase and settle right away
    assert.equal(s.phase, 'settle');
    assert.equal(s.dealerRevealed, true);
    assert.equal(s.lastResults[0].outcome, 'lose');
    assert.equal(s.chips[0], 900);
    assert.equal(s.lastResults[1].outcome, 'push');
    assert.equal(s.chips[1], 1000);
  });

  it('handles double down (doubles bet, draws 1 card, auto-stands) and rejects illegal double', () => {
    const s = bj.createState();
    bj.initGame(s, 1);

    // Player gets 5 + 6 = 11, doubles and draws 10 -> 21; dealer has 10 + 7 = 17.
    s.shoe = [
      card('10', 'c'), // player double card -> 21
      card('7', 'h'),  // dealer card 2
      card('10', 'd'), // dealer card 1
      card('6', 's'),  // player card 2
      card('5', 's')   // player card 1
    ];
    s.shoeTotal = 16;

    assert.equal(bj.handleMove({ type: 'bet', amount: 100 }, s, 0), null);
    assert.equal(s.phase, 'play');
    assert.equal(bj.handleMove({ type: 'double' }, s, 0), null);

    assert.equal(s.phase, 'settle');
    assert.equal(s.bets[0], 200);
    assert.equal(s.doubled[0], true);
    assert.equal(s.hands[0].length, 3);
    assert.equal(s.lastResults[0].outcome, 'win');
    assert.equal(s.lastResults[0].net, 200);
    assert.equal(s.chips[0], 1200);

    // Next round: test that double is rejected after hitting (3 cards in hand)
    assert.equal(bj.handleMove({ type: 'next' }, s, 0), null);
    s.shoe = [
      card('2', 'c'),  // hit card
      card('7', 'h'),  // dealer card 2
      card('10', 'd'), // dealer card 1
      card('4', 's'),  // player card 2
      card('5', 's')   // player card 1
    ];
    s.shoeTotal = 16;

    assert.equal(bj.handleMove({ type: 'bet', amount: 50 }, s, 0), null);
    assert.equal(bj.handleMove({ type: 'hit' }, s, 0), null);
    assert.equal(s.hands[0].length, 3);
    const err = bj.handleMove({ type: 'double' }, s, 0);
    assert.equal(err, 'bj_cannot_double');
    assert.ok(serverZh[err] && serverEn[err]);
  });

  it('bust (>21) ends that player turn and advances to the next player', () => {
    const s = bj.createState();
    bj.initGame(s, 2);

    s.shoe = [
      card('9', 'c'),  // seat 0 hit card -> 15 + 9 = 24 (bust!)
      card('7', 'h'),  // dealer card 2
      card('10', 'd'), // dealer card 1
      card('8', 'h'),  // seat 1 card 2
      card('9', 'h'),  // seat 1 card 1 (17)
      card('5', 's'),  // seat 0 card 2
      card('10', 's')  // seat 0 card 1 (15)
    ];
    s.shoeTotal = 16;

    assert.equal(bj.handleMove({ type: 'bet', amount: 50 }, s, 0), null);
    assert.equal(bj.handleMove({ type: 'bet', amount: 50 }, s, 1), null);
    assert.equal(s.currentPlayer, 0);

    // Seat 0 hits and busts
    assert.equal(bj.handleMove({ type: 'hit' }, s, 0), null);
    assert.equal(s.status[0], 'bust');
    assert.equal(s.currentPlayer, 1, 'Turn must advance to seat 1 after seat 0 busts');

    // Seat 1 stands on 17 -> pushes against dealer 17
    assert.equal(bj.handleMove({ type: 'stand' }, s, 1), null);
    assert.equal(s.phase, 'settle');
    assert.equal(s.lastResults[0].outcome, 'bust');
    assert.equal(s.chips[0], 950);
    assert.equal(s.lastResults[1].outcome, 'push');
    assert.equal(s.chips[1], 1000);
  });

  it('handles bet timeout (auto-bets 10) and play timeout (auto-stands)', () => {
    const s = bj.createState();
    bj.initGame(s, 2);

    // Seat 0 bets 25; Seat 1 times out -> auto-bets 10
    assert.equal(bj.handleMove({ type: 'bet', amount: 25 }, s, 0), null);
    assert.deepEqual(bj.getPendingActors(s), [1]);
    assert.equal(bj.onTimeout(s), true);
    assert.equal(s.bets[1], 10);
    assert.equal(s.chips[1], 990);

    // If in play phase, timeout stands current player
    if (s.phase === 'play') {
      const cur = s.currentPlayer;
      assert.equal(bj.onTimeout(s), true);
      assert.equal(s.status[cur], 'stand');
    }
  });
});

describe('Blackjack — playerView privacy and immutability', () => {
  it('never exposes the shoe or dealer hole card before reveal, and guards unset fields', () => {
    // Before initGame
    const raw = bj.createState();
    const emptyView = bj.playerView(raw, 0);
    assert.equal(emptyView.shoe, undefined);
    assert.deepEqual(emptyView.dealerHand, []);

    // During play phase before dealer reveal
    const s = bj.createState();
    bj.initGame(s, 2);
    s.shoe = [
      card('8', 'c'),  // dealer hole card (must stay hidden!)
      card('10', 'd'), // dealer up card
      card('7', 'h'),
      card('9', 'h'),
      card('6', 's'),
      card('10', 's')
    ];
    s.shoeTotal = 16;

    bj.handleMove({ type: 'bet', amount: 50 }, s, 0);
    bj.handleMove({ type: 'bet', amount: 50 }, s, 1);
    assert.equal(s.phase, 'play');
    assert.equal(s.dealerRevealed, false);

    const snap = JSON.stringify(s);
    const v0 = bj.playerView(s, 0);
    assert.equal(JSON.stringify(s), snap, 'playerView must not mutate state');
    assert.equal(v0.shoe, undefined, 'shoe array must not be exposed');
    assert.equal(v0.dealerHand.length, 2);
    assert.deepEqual(v0.dealerHand[0], card('10', 'd'));
    assert.equal(v0.dealerHand[1], null, 'dealer hole card must be null until reveal');
    assert.equal(v0.dealerTotal, 10, 'dealerTotal must only reflect up-card before reveal');

    // After both players stand, dealer hole card is revealed
    bj.handleMove({ type: 'stand' }, s, 0);
    bj.handleMove({ type: 'stand' }, s, 1);
    assert.equal(s.phase, 'settle');
    const vAfter = bj.playerView(s, 0);
    assert.equal(vAfter.dealerRevealed, true);
    assert.notEqual(vAfter.dealerHand[1], null);
    assert.equal(vAfter.dealerTotal, 18);
  });
});

describe('Blackjack — bot safety and full game simulation', () => {
  it('bot never mutates state and always returns a legal move across 200 random positions', () => {
    const diffs = ['easy', 'normal', 'hard'];
    let positionsChecked = 0;

    while (positionsChecked < 200) {
      const n = 1 + (positionsChecked % 4);
      const s = bj.createState();
      const diff = diffs[positionsChecked % diffs.length];
      s.options = { decks: 2, rounds: 5, turnTime: 20, difficulty: diff };
      s._options = s._options || s.options;
      bj.initGame(s, n);

      let safety = 0;
      while (s.winner === null && safety++ < 100 && positionsChecked < 200) {
        const pending = bj.getPendingActors(s);
        if (pending.length === 0) {
          if (s.phase === 'settle') {
            const bot0 = bjBot.createBot(0);
            const snap = JSON.stringify(s);
            const mv = bot0.getMove(s, 0);
            assert.equal(JSON.stringify(s), snap, 'bot mutated state in settle phase');
            assert.equal(bj.handleMove(mv, s, 0), null);
            positionsChecked++;
            continue;
          }
          break;
        }

        const seat = pending[0];
        const bot = bjBot.createBot(seat);

        // Test on raw state
        const rawSnap = JSON.stringify(s);
        const mvRaw = bot.getMove(s, seat);
        assert.equal(JSON.stringify(s), rawSnap, 'bot mutated raw state');
        assert.ok(mvRaw && typeof mvRaw === 'object', 'bot returned invalid move on raw state');

        // Test on playerView
        const view = bj.playerView(s, seat);
        view._options = s._options;
        const viewSnap = JSON.stringify(view);
        const mvView = bot.getMove(view, seat);
        assert.equal(JSON.stringify(view), viewSnap, 'bot mutated playerView');
        assert.ok(mvView && typeof mvView === 'object', 'bot returned invalid move on playerView');

        const res = bj.handleMove(mvView, s, seat);
        assert.equal(res, null, `bot move ${JSON.stringify(mvView)} rejected with ${res} in phase ${s.phase}`);
        positionsChecked++;
      }
    }

    assert.ok(positionsChecked >= 200);
  });

  it('completes a full bot-only game and crowns a winner', () => {
    for (const playerCount of [1, 4]) {
      const s = bj.createState();
      s.options = { decks: 2, rounds: 5, turnTime: 20, difficulty: 'hard' };
      s._options = s._options || s.options;
      bj.initGame(s, playerCount);

      let steps = 0;
      while (s.winner === null && steps++ < 500) {
        const pending = bj.getPendingActors(s);
        if (pending.length === 0) {
          assert.equal(bj.onTimeout(s), true);
          continue;
        }
        for (const seat of pending) {
          const bot = bjBot.createBot(seat);
          const view = bj.playerView(s, seat);
          view._options = s._options;
          const mv = bot.getMove(view, seat);
          assert.equal(bj.handleMove(mv, s, seat), null);
        }
      }

      assert.notEqual(s.winner, null, `Game with ${playerCount} players did not finish`);
      assert.ok(s.winner >= 0 && s.winner < playerCount);
    }
  });
});
