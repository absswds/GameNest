const assert = require('assert');
const truthdare = require('../games/truthdare');

function createStartedState(options, playerCount) {
  const state = truthdare.createState();
  state._options = options || {};
  truthdare.initGame(state, playerCount || 3);
  return state;
}

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    console.error('not ok - ' + name);
    throw err;
  }
}

test('initializes enabled built-in decks and player count', () => {
  const state = createStartedState({ enabledDecks: ['icebreaker', 'party'] }, 4);

  assert.strictEqual(state.players, 4);
  assert.deepStrictEqual(state.enabledDecks, ['icebreaker', 'party']);
  assert.ok(state.decks.icebreaker.truth.length > 0);
  assert.ok(state.decks.party.dare.length > 0);
});

test('draws a truth card from selected decks and records history', () => {
  const state = createStartedState({ enabledDecks: ['icebreaker'] }, 3);

  const err = truthdare.handleMove({ action: 'draw', kind: 'truth' }, state, 1);

  assert.strictEqual(err, null);
  assert.strictEqual(state.currentCard.kind, 'truth');
  assert.strictEqual(state.currentCard.player, 1);
  assert.strictEqual(state.currentCard.deck, 'icebreaker');
  assert.strictEqual(state.history.length, 1);
  assert.strictEqual(state.history[0].text, state.currentCard.text);
});

test('merges custom truth and dare cards into the custom deck', () => {
  const state = createStartedState({
    enabledDecks: ['custom'],
    customTruths: '你今天最开心的一件事是什么？\n最近一次心动是什么时候？',
    customDares: '给右手边的人一个夸夸\n模仿一种动物 10 秒',
  }, 2);

  assert.deepStrictEqual(state.decks.custom.truth, [
    '你今天最开心的一件事是什么？',
    '最近一次心动是什么时候？',
  ]);
  assert.deepStrictEqual(state.decks.custom.dare, [
    '给右手边的人一个夸夸',
    '模仿一种动物 10 秒',
  ]);
});

test('falls back to default decks when selected cards are empty', () => {
  const state = createStartedState({
    enabledDecks: ['custom'],
    customTruths: '',
    customDares: '',
  }, 2);

  const err = truthdare.handleMove({ action: 'draw', kind: 'random' }, state, 0);

  assert.strictEqual(err, null);
  assert.ok(['truth', 'dare'].includes(state.currentCard.kind));
  assert.ok(state.currentCard.text.length > 0);
});
