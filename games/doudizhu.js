// games/doudizhu.js
// 斗地主 — Landlord card game with 叫抢 (rob bid) and 叫分 (score bid) modes

var SUITS = ['s','h','c','d'];
var RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

exports.name = 'doudizhu';
exports.maxPlayers = 3;

function rankVal(rank) {
  if (rank === '小王') return 13;
  if (rank === '大王') return 14;
  return RANKS.indexOf(rank);
}

function createDeck() {
  var deck = [];
  for (var r = 0; r < RANKS.length; r++) {
    for (var s = 0; s < SUITS.length; s++) {
      deck.push({ rank: RANKS[r], suit: SUITS[s], id: RANKS[r] + SUITS[s] });
    }
  }
  deck.push({ rank: '小王', suit: '', id: 'SJ' });
  deck.push({ rank: '大王', suit: '', id: 'BJ' });
  return deck;
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}

function sortHand(hand) {
  hand.sort(function(a, b) { return rankVal(a.rank) - rankVal(b.rank); });
}

function syncBoard(state) {
  return {
    phase: state.phase,
    hands: state.hands.map(function(h) { return h.map(function(c) { return { ...c }; }); }),
    bottomCards: state.bottomCards.map(function(c) { return { ...c }; }),
    landlord: state.landlord,
    currentBidder: state.currentBidder,
    currentBid: state.currentBid,
    passCount: state.passCount,
    bids: state.bids ? { ...state.bids } : {},
    currentPlayer: state.currentPlayer,
    lastPlay: state.lastPlay ? { player: state.lastPlay.player, cards: state.lastPlay.cards.map(function(c) { return { ...c }; }), play: { ...state.lastPlay.play } } : null,
    passStreak: state.passStreak,
    passed: Array.isArray(state.passed) ? state.passed.slice() : [false, false, false],
    winner: state.winner,
    // NEW fields
    callPhase: state.callPhase,
    eligibleForRob: state.eligibleForRob ? state.eligibleForRob.slice() : [true, true, true],
    gameMultiplier: state.gameMultiplier || 1,
    currentTurnDeadline: state.currentTurnDeadline,
    cumulativeScore: state.cumulativeScore ? state.cumulativeScore.slice() : [],
    roundHistory: state.roundHistory ? state.roundHistory.slice() : [],
    continueVoting: state.continueVoting ? { ...state.continueVoting, votes: state.continueVoting.votes.slice() } : null,
    totalRounds: state.totalRounds || 1,
    currentRound: state.currentRound || 1,
  };
}

exports.createState = function() {
  var state = {
    board: null,
    phase: 'bidding',
    hands: [[], [], []],
    bottomCards: [],
    landlord: null,
    currentBidder: 0,
    currentBid: 0,
    passCount: 0,
    bids: {},
    currentPlayer: 0,
    lastPlay: null,
    passStreak: 0,
    passed: [false, false, false],
    winner: null,
    multiplier: 1,
    // 叫抢 fields
    callPhase: 'call',
    calledPlayers: [],
    passedCall: [false, false, false],
    eligibleForRob: [true, true, true],
    robAttempts: [],
    landlordCandidate: null,
    robMultiplier: 3,
    gameMultiplier: 1,
    // timer
    currentTurnDeadline: null,
    // multi-round
    cumulativeScore: [0, 0, 0],
    roundHistory: [],
    continueVoting: null,
    totalRounds: 1,
    currentRound: 1,
    // option defaults
    bidMode: 'rob',
    firstCaller: 'random',
    allowDouble: false,
    allowShowHand: false,
    playTimeLimit: 0,
  };
  dealCards(state);
  return state;
};

exports.initGame = function(state, playerCount) {
  dealCards(state);
};

function dealCards(state) {
  var deck = createDeck();
  shuffle(deck);
  state.hands[0] = deck.slice(0, 17);
  state.hands[1] = deck.slice(17, 34);
  state.hands[2] = deck.slice(34, 51);
  state.bottomCards = deck.slice(51, 54);
  for (var i = 0; i < 3; i++) sortHand(state.hands[i]);
  sortHand(state.bottomCards);
  resetRoundState(state);
}

function resetRoundState(state) {
  state.phase = 'bidding';
  state.callPhase = 'call';
  state.currentBidder = Math.floor(Math.random() * (state._playerCount || 3));
  state.currentBid = 0;
  state.passCount = 0;
  state.bids = {};
  state.landlord = null;
  state.currentPlayer = state.currentBidder;
  state.lastPlay = null;
  state.passStreak = 0;
  state.passed = [false, false, false];
  state.winner = null;
  state.multiplier = 1;
  state.calledPlayers = [];
  state.passedCall = [false, false, false];
  state.eligibleForRob = [true, true, true];
  state.robAttempts = [];
  state.landlordCandidate = null;
  state.robMultiplier = 3;
  state.gameMultiplier = 1;
  state.currentTurnDeadline = null;
  state.board = syncBoard(state);
  // Read options
  if (state._options) {
    state.bidMode = state._options.bidMode || 'rob';
    state.firstCaller = state._options.firstCaller || 'random';
    state.allowDouble = state._options.allowDouble || false;
    state.allowShowHand = state._options.allowShowHand || false;
    state.playTimeLimit = state._options.playTimeLimit || 0;
    state.totalRounds = state._options.totalRounds || 3;
  }
}

exports.startNextRound = function(state) {
  state.currentRound = (state.currentRound || 1) + 1;
  if (state.currentRound > state.totalRounds) return; // game over, should not reach here
  dealCards(state);
  // Check if this is the last round about to start → show continue vote
  if (state.currentRound === state.totalRounds && !state._continueVoteShown) {
    state._continueVoteShown = true;
    state.phase = 'continue_vote';
    state.continueVoting = {
      continueYesVotes: 0,
      continueNoVotes: 0,
      votes: [],
      totalPlayers: (state._playerCount || 3),
      resolved: false,
    };
  }
};

function calculatePerRoundScores(state) {
  var base = 100;
  var multiplier = state.gameMultiplier || 1;
  if (state.winner === -2) {
    // Landlord wins
    state.cumulativeScore[state.landlord] += 2 * base * multiplier;
    for (var f = 0; f < (state._playerCount || 3); f++) {
      if (f !== state.landlord) state.cumulativeScore[f] -= base * multiplier;
    }
  } else if (state.winner === -3) {
    // Farmers win
    state.cumulativeScore[state.landlord] -= 2 * base * multiplier;
    for (var g = 0; g < (state._playerCount || 3); g++) {
      if (g !== state.landlord) state.cumulativeScore[g] += base * multiplier;
    }
  }
  state.roundHistory.push({ winner: state.winner, multiplier: multiplier, landlord: state.landlord, scores: state.cumulativeScore.slice() });
}

var nextRoundResult = null;

// ---- Card type detection ----

function detectType(cards) {
  if (!cards || cards.length === 0) return null;
  var n = cards.length;
  var rvals = cards.map(function(c) { return rankVal(c.rank); }).sort(function(a,b) { return a-b; });

  if (n === 2 && cards.some(function(c) { return c.id === 'SJ'; }) && cards.some(function(c) { return c.id === 'BJ'; }))
    return { type: 'rocket', rank: 15 };

  if (n === 4 && rvals[0] === rvals[3])
    return { type: 'bomb', rank: rvals[0] };

  var countMap = Object.create(null);
  for (var i = 0; i < rvals.length; i++) countMap[rvals[i]] = (countMap[rvals[i]] || 0) + 1;
  var groups = { 1: [], 2: [], 3: [], 4: [] };
  for (var r in countMap) groups[countMap[r]].push(parseInt(r));
  for (var k in groups) groups[k].sort(function(a,b) { return a-b; });

  if (n === 1) return { type: 'single', rank: rvals[0] };
  if (n === 2 && rvals[0] === rvals[1]) return { type: 'pair', rank: rvals[0] };
  if (groups[3].length === 1 && n === 3) return { type: 'triple', rank: groups[3][0] };
  if (groups[3].length === 1 && n === 4) return { type: 'triple_one', rank: groups[3][0] };
  if (groups[3].length === 1 && n === 5 && groups[2].length === 1) return { type: 'triple_two', rank: groups[3][0] };
  if (n >= 5 && groups[1].length === n && isConsecutive(groups[1], n) && groups[1][n-1] < 12)
    return { type: 'straight', rank: groups[1][0], length: n };
  if (n >= 6 && n % 2 === 0 && groups[2].length === n/2 && isConsecutive(groups[2], n/2) && groups[2][n/2-1] < 12)
    return { type: 'consecutive_pairs', rank: groups[2][0], length: n/2 };
  if (n >= 6 && n % 3 === 0 && groups[3].length === n/3 && isConsecutive(groups[3], n/3) && groups[3][n/3-1] < 12)
    return { type: 'plane', rank: groups[3][0], length: n/3 };
  if (groups[3].length >= 2 && isConsecutive(groups[3], groups[3].length) && groups[3][groups[3].length-1] < 12) {
    var triCount = groups[3].length;
    var remaining = n - triCount * 3;
    if (remaining === triCount) return { type: 'plane_wings_1', rank: groups[3][0], length: triCount };
    if (remaining === triCount * 2 && groups[2].length === triCount && n === triCount * 5)
      return { type: 'plane_wings_2', rank: groups[3][0], length: triCount };
  }
  if (groups[4].length === 1 && n === 6) return { type: 'four_two', rank: groups[4][0] };
  if (groups[4].length === 1 && n === 8 && groups[2].length === 2) return { type: 'four_two_pairs', rank: groups[4][0] };
  return null;
}

function isConsecutive(arr, len) {
  for (var i = 0; i < len - 1; i++) {
    if (arr[i + 1] - arr[i] !== 1) return false;
  }
  return true;
}

function canBeat(newPlay, lastPlay) {
  if (!lastPlay) return true;
  if (newPlay.type === 'rocket') return true;
  if (newPlay.type === 'bomb') {
    if (lastPlay.type === 'rocket') return false;
    if (lastPlay.type === 'bomb') return newPlay.rank > lastPlay.rank;
    return true;
  }
  if (newPlay.type !== lastPlay.type) return false;
  if ((newPlay.length || 0) !== (lastPlay.length || 0)) return false;
  return newPlay.rank > lastPlay.rank;
}

// ---- Handle Move ----

exports.handleMove = function(data, state, playerIndex) {
  if (state.winner !== null) return 'g_game_over';

  // ---- CONTINUE VOTE phase ----
  if (state.phase === 'continue_vote') {
    if (state.continueVoting && state.continueVoting.resolved) return 'g_invalid_action';
    if (data.action !== 'continue_vote') return 'ddz_invalid_action';
    if (state.continueVoting.votes[playerIndex] !== undefined) return 'ddz_already_voted';
    if (data.vote === 'yes') {
      state.continueVoting.votes[playerIndex] = 'yes';
      state.continueVoting.continueYesVotes++;
    } else if (data.vote === 'no') {
      state.continueVoting.votes[playerIndex] = 'no';
      state.continueVoting.continueNoVotes++;
    } else {
      return 'ddz_invalid_vote';
    }
    var v = state.continueVoting;
    if (v.continueNoVotes > 0) {
      v.resolved = true;
      state.continueVoting = null;
      startNewBiddingRound(state);
    } else if (v.continueYesVotes >= v.totalPlayers) {
      v.resolved = true;
      state.totalRounds += 3;
      if (state._options) state._options.totalRounds = state.totalRounds;
      state.continueVoting = null;
      state._continueVoteShown = false;
      startNewBiddingRound(state);
    }
    return null;
  }

  // ---- ROUND END phase ----
  if (state.phase === 'roundEnd') {
    if (data.action === 'next_round') {
      startNewBiddingRound(state);
      return null;
    }
    return 'ddz_click_next_round';
  }

  // ---- BIDDING PHASE ----
  if (state.phase === 'bidding') {
    if (playerIndex !== state.currentBidder) return 'ddz_not_your_bid';
    var options = state._options || {};
    var bidMode = options.bidMode || state.bidMode || 'rob';

    if (bidMode === 'score') {
      // ---- 叫分 mode (keep existing 1-3 bidding logic) ----
      var score = data.score;
      if (typeof score !== 'number' || score < 0 || score > 3) return 'ddz_bid_must_be_0_3';
      state.bids[playerIndex] = score;
      if (score > state.currentBid) { state.currentBid = score; state.landlord = playerIndex; }
      state.passCount++;
      if (score === 3) { finalizeLandlord(state, playerIndex); return null; }
      state.currentBidder = (state.currentBidder + 1) % (state._playerCount || 3);
      state.currentPlayer = state.currentBidder;
      if (state.passCount >= (state._playerCount || 3)) {
        if (state.landlord === null) { dealCards(state); return null; }
        finalizeLandlord(state, state.landlord);
      }
      state.board = syncBoard(state);
      return null;
    }

    // ---- 叫抢 mode ----

    if (state.callPhase === 'call') {
      // 叫地主 / 不叫
      if (data.call === true) {
        state.calledPlayers.push(playerIndex);
        state.landlordCandidate = playerIndex;
        state.eligibleForRob[playerIndex] = true;
        state.robMultiplier = 3;
        state.gameMultiplier = 3;
        state.callPhase = 'rob';
        state.currentBidder = nextPlayer(state, playerIndex);
        state.currentPlayer = state.currentBidder;
        if (!hasEligibleRobber(state)) finalizeLandlord(state, state.landlordCandidate);
        state.board = syncBoard(state);
        return null;
      }
      if (data.pass === true) {
        state.passedCall[playerIndex] = true;
        state.eligibleForRob[playerIndex] = false;
        state.passCount++;
        if (state.passCount >= (state._playerCount || 3)) {
          if (state.landlordCandidate === null) { dealCards(state); return null; }
          // All passed during call phase → re-deal
          dealCards(state); return null;
        }
        state.currentBidder = nextPlayer(state, playerIndex);
        state.currentPlayer = state.currentBidder;
        state.board = syncBoard(state);
        return null;
      }
      return 'ddz_invalid_bid_action';
    }

    if (state.callPhase === 'rob') {
      // 抢 / 不抢
      if (data.rob === true) {
        if (!state.eligibleForRob[playerIndex]) return 'ddz_not_eligible_to_rob';
        if (state.robAttempts.indexOf(playerIndex) >= 0) return 'ddz_already_robbed';
        state.robAttempts.push(playerIndex);
        state.landlord = playerIndex;
        state.gameMultiplier *= 2;
        state.robMultiplier *= 2;
        state.currentBidder = nextEligibleRobPlayer(state, playerIndex);
        if (state.currentBidder < 0) { finalizeLandlord(state, state.landlord); return null; }
        state.currentPlayer = state.currentBidder;
        state.board = syncBoard(state);
        return null;
      }
      if (data.passRob === true) {
        state.eligibleForRob[playerIndex] = false;
        // Auto-finalize landlordCandidate if no one robbed and no other eligible players remain
        if (state.landlord === null && state.landlordCandidate !== null) {
          var nonCandidateEligible = false;
          for (var rp = 0; rp < (state._playerCount || 3); rp++) {
            if (rp !== state.landlordCandidate && state.eligibleForRob[rp]) {
              nonCandidateEligible = true; break;
            }
          }
          if (!nonCandidateEligible) { finalizeLandlord(state, state.landlordCandidate); return null; }
        }
        state.currentBidder = nextEligibleRobPlayer(state, playerIndex);
        if (state.currentBidder < 0) {
          if (state.landlord === null && state.landlordCandidate !== null) finalizeLandlord(state, state.landlordCandidate);
          else if (state.landlord !== null) finalizeLandlord(state, state.landlord);
          else { dealCards(state); return null; }
          return null;
        }
        state.currentPlayer = state.currentBidder;
        state.board = syncBoard(state);
        return null;
      }
      return 'ddz_invalid_bid_action';
    }

    return 'ddz_invalid_bid_action';
  }

  // ---- PLAYING PHASE ----
  if (state.phase === 'playing') {
    if (playerIndex !== state.currentPlayer) return 'g_not_your_turn';
    var cardIds = data.cards;
    if (!Array.isArray(cardIds)) return 'ddz_invalid_format';

    // PASS
    if (cardIds.length === 0) {
      if (!state.lastPlay || state.lastPlay.player === playerIndex) return 'ddz_must_lead';
      if (!Array.isArray(state.passed)) state.passed = [false, false, false];
      state.passStreak++;
      state.passed[playerIndex] = true;
      state.currentPlayer = (state.currentPlayer + 1) % (state._playerCount || 3);
      setTurnTimer(state);
      if (state.passStreak >= 2) { state.lastPlay = null; state.passStreak = 0; state.passed = [false, false, false]; }
      state.board = syncBoard(state);
      return null;
    }

    // Remove cards from hand
    var hand = state.hands[playerIndex];
    var played = [];
    for (var p = 0; p < cardIds.length; p++) {
      var idx = hand.findIndex(function(c) { return c.id === cardIds[p]; });
      if (idx === -1) { hand.push.apply(hand, played); sortHand(hand); return 'ddz_card_not_in_hand'; }
      played.push(hand.splice(idx, 1)[0]);
    }

    var playType = detectType(played);
    if (!playType) { hand.push.apply(hand, played); sortHand(hand); return 'ddz_invalid_play'; }

    if (!canBeat(playType, state.lastPlay ? state.lastPlay.play : null)) {
      hand.push.apply(hand, played); sortHand(hand); return 'ddz_doesnt_beat';
    }

    state.lastPlay = { player: playerIndex, cards: played, play: playType };
    state.passStreak = 0;
    state.passed = [false, false, false];

    // Bomb/rocket multiplier
    if (playType.type === 'bomb' || playType.type === 'rocket') state.gameMultiplier *= 2;

    // Check win
    if (hand.length === 0) {
      if (playerIndex === state.landlord) state.winner = -2;
      else state.winner = -3;
      calculatePerRoundScores(state);
      // Multi-round: check if more rounds remain
      if (state.totalRounds > 1) {
        var wasLastRound = state.currentRound >= state.totalRounds;
        if (wasLastRound) {
          state.phase = 'over';
        } else {
          state.currentRound++;
          // Check continue vote: if NEXT round will be the last
          if (!state._continueVoteShown && state.currentRound === state.totalRounds) {
            state._continueVoteShown = true;
            state.phase = 'continue_vote';
            state.continueVoting = {
              continueYesVotes: 0,
              continueNoVotes: 0,
              votes: [],
              totalPlayers: (state._playerCount || 3),
              resolved: false,
            };
          } else {
            state.phase = 'roundEnd';
          }
        }
      }
      state.board = syncBoard(state);
      return null;
    }

    state.currentPlayer = (state.currentPlayer + 1) % (state._playerCount || 3);
    setTurnTimer(state);
    state.board = syncBoard(state);
    return null;
  }

  return 'g_unknown_action';
};

function nextPlayer(state, current) {
  return (current + 1) % (state._playerCount || 3);
}

function hasEligibleRobber(state) {
  for (var i = 0; i < (state._playerCount || 3); i++) {
    if (state.eligibleForRob[i] && i !== state.landlordCandidate) return true;
  }
  return false;
}

function nextEligibleRobPlayer(state, current) {
  var n = state._playerCount || 3;
  for (var step = 1; step <= n; step++) {
    var p = (current + step) % n;
    if (state.eligibleForRob[p] && state.robAttempts.indexOf(p) < 0) {
      return p;
    }
  }
  return -1;
}

function finalizeLandlord(state, landlordIdx) {
  state.landlord = landlordIdx;
  state.callPhase = 'decided';
  state.phase = 'playing';
  state.currentPlayer = landlordIdx;
  state.hands[landlordIdx].push.apply(state.hands[landlordIdx], state.bottomCards);
  sortHand(state.hands[landlordIdx]);
  setTurnTimer(state);
  state.board = syncBoard(state);
}

function setTurnTimer(state) {
  if (state.playTimeLimit > 0) {
    state.currentTurnDeadline = Date.now() + state.playTimeLimit * 1000;
  } else {
    state.currentTurnDeadline = null;
  }
}

function startNewBiddingRound(state) {
  state.phase = 'bidding';
  dealCards(state);
}

exports.getCurrentActor = function(state) {
  if (state.phase === 'continue_vote' && state.continueVoting) {
    for (var i = 0; i < (state._playerCount || 3); i++) {
      if (state.continueVoting.votes[i] === undefined) return i;
    }
    return state.currentPlayer;
  }
  return state.currentPlayer;
};
