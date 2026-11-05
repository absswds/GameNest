// Who Is the Undercover (谁是卧底) — 4 to 10 players party word-deduction game.
// Civilians receive the same word, 1–2 Undercovers receive a close word,
// and an optional Blank (6+ players) receives no word at all.
// Nobody knows their role while alive; voted-out players have their role revealed.

const { getWordList } = require('./undercover-words');

exports.name = 'undercover';
exports.maxPlayers = 10;
exports.minPlayers = 4;

const VOTE_SECS = 25;
const MAX_SPEECH = 60; // English hints run up to ~55 chars

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function aliveIndices(s) {
  const out = [];
  if (!s || !Array.isArray(s.alive)) return out;
  for (let i = 0; i < s.numPlayers; i++) {
    if (s.alive[i]) out.push(i);
  }
  return out;
}

function aliveFrom(s, startSeat) {
  const out = [];
  for (let k = 0; k < s.numPlayers; k++) {
    const p = (startSeat + k) % s.numPlayers;
    if (s.alive[p]) out.push(p);
  }
  return out;
}

function computeRoleCounts(n, opts) {
  const rawUc = opts && opts.ucCount;
  let ucCount;
  if (rawUc === 1 || rawUc === '1') {
    ucCount = 1;
  } else if (rawUc === 2 || rawUc === '2') {
    ucCount = Math.min(2, Math.max(1, n - 2));
  } else {
    ucCount = n <= 6 ? 1 : 2;
  }
  const hasBlank = !!(opts && opts.blank) && n >= 6;
  const blankCount = hasBlank ? 1 : 0;
  // Ensure civilians strictly outnumber undercover + blank at start
  while (ucCount + blankCount >= n - 1 && ucCount > 1) {
    ucCount -= 1;
  }
  return { ucCount, blankCount };
}

function pickWordPair(lang, wordDiff) {
  const list = getWordList(lang, wordDiff);
  const pair = list[Math.floor(Math.random() * list.length)];
  const flip = Math.random() < 0.5;
  return {
    civWord: flip ? pair.b : pair.a,
    ucWord: flip ? pair.a : pair.b,
  };
}

function armDeadline(s, secs) {
  s.phaseEndsAt = secs > 0 ? Date.now() + secs * 1000 : 0;
}

function checkWin(s) {
  const alive = aliveIndices(s);
  const ucAlive = alive.some((i) => s.roles[i] === 'undercover');
  const blankAlive = alive.some((i) => s.roles[i] === 'blank');
  if (!ucAlive && !blankAlive) {
    s.winner = -2; // Civilians win
    s.phase = 'over';
    s.phaseEndsAt = 0;
    s.log.push({ k: 'win_civilian' });
    return true;
  }
  if (alive.length <= 3 && (ucAlive || blankAlive)) {
    s.winner = -3; // Undercover side wins
    s.phase = 'over';
    s.phaseEndsAt = 0;
    s.log.push({ k: 'win_undercover' });
    return true;
  }
  return false;
}

function startSpeech(s, kind, speakers) {
  const list = speakers.filter((i) => s.alive[i]);
  s.phase = 'speech';
  s.speechKind = kind; // 'round' | 'pk'
  s.speakers = list;
  s.speakerPos = 0;
  if (list.length === 0) {
    startVote(s, kind === 'pk');
    return;
  }
  armDeadline(s, s.speechTime);
}

function startRound(s) {
  if (checkWin(s)) return;
  if (s.round >= 20) {
    s.winner = -3;
    s.phase = 'over';
    s.phaseEndsAt = 0;
    s.log.push({ k: 'win_undercover' });
    return;
  }
  if (s.round === 0) {
    s.firstSpeaker = 0;
    if (!s.alive[s.firstSpeaker]) {
      const a = aliveIndices(s);
      s.firstSpeaker = a.length ? a[0] : 0;
    }
  } else {
    for (let k = 1; k <= s.numPlayers; k++) {
      const cand = (s.firstSpeaker + k) % s.numPlayers;
      if (s.alive[cand]) {
        s.firstSpeaker = cand;
        break;
      }
    }
  }
  s.round += 1;
  s.votePk = false;
  s.pkTargets = [];
  s.voteCandidates = [];
  s.votes = {};
  const order = aliveFrom(s, s.firstSpeaker);
  s.log.push({ k: 'round_start', round: s.round, first: s.firstSpeaker });
  startSpeech(s, 'round', order);
}

function startVote(s, isPk) {
  s.phase = 'vote';
  s.votePk = !!isPk;
  s.voteCandidates = isPk ? s.pkTargets.filter((i) => s.alive[i]) : aliveIndices(s);
  s.votes = {};
  armDeadline(s, VOTE_SECS);
}

function nextSpeaker(s) {
  s.speakerPos += 1;
  while (s.speakerPos < s.speakers.length && !s.alive[s.speakers[s.speakerPos]]) {
    s.speakerPos += 1;
  }
  if (s.speakerPos < s.speakers.length) {
    armDeadline(s, s.speechTime);
    return;
  }
  startVote(s, s.speechKind === 'pk');
}

function resolveVote(s) {
  const tally = {};
  for (const [, target] of Object.entries(s.votes)) {
    if (target !== null && target !== undefined && target >= 0 && s.alive[target]) {
      tally[target] = (tally[target] || 0) + 1;
    }
  }
  let max = 0;
  let top = [];
  for (const [candStr, count] of Object.entries(tally)) {
    const cand = Number(candStr);
    if (count > max) {
      max = count;
      top = [cand];
    } else if (count === max) {
      top.push(cand);
    }
  }
  top.sort((a, b) => a - b);
  s.lastVote = {
    round: s.round,
    pk: !!s.votePk,
    votes: { ...s.votes },
    tally,
    top,
  };

  if (top.length === 1) {
    const out = top[0];
    s.alive[out] = false;
    s.revealed[out] = true;
    s.lastExiled = out;
    s.log.push({ k: 'exile', p: out, role: s.roles[out], round: s.round, pk: !!s.votePk });
    if (checkWin(s)) return;
    startRound(s);
    return;
  }

  if (top.length > 1 && !s.votePk) {
    s.votePk = true;
    s.pkTargets = top;
    s.log.push({ k: 'tie_pk', list: top, round: s.round });
    startSpeech(s, 'pk', top);
    return;
  }

  // Tie on PK revote or everyone abstained: nobody eliminated this round
  s.lastExiled = null;
  s.log.push({ k: 'no_exile', round: s.round, pk: !!s.votePk });
  if (checkWin(s)) return;
  startRound(s);
}

function containsOwnWord(s, seat, text) {
  const ownWord = s.words && s.words[seat];
  if (!ownWord || typeof text !== 'string') return false;
  return text.toLowerCase().includes(String(ownWord).toLowerCase());
}

exports.createState = () => ({
  phase: 'waiting',
  winner: null,
  numPlayers: 0,
  roles: [],
  words: [],
  alive: [],
  round: 0,
  speeches: [],
  chat: [],
  log: [],
});

exports.initGame = (state, numPlayers) => {
  const n = Math.max(4, Math.min(10, Number(numPlayers) || 4));
  const opts = state._options || {};
  const talkMode = opts.talkMode === 'chat' ? 'chat' : 'face';
  const rawTime = Number(opts.speechTime);
  const speechTime = [30, 45, 60].includes(rawTime) ? rawTime : 45;
  const wordDiff = ['easy', 'normal', 'hard'].includes(opts.wordDiff) ? opts.wordDiff : 'mixed';
  const { ucCount, blankCount } = computeRoleCounts(n, opts);

  const roles = [];
  for (let i = 0; i < ucCount; i++) roles.push('undercover');
  for (let i = 0; i < blankCount; i++) roles.push('blank');
  while (roles.length < n) roles.push('civilian');
  shuffle(roles);

  const { civWord, ucWord } = pickWordPair(state._lang, wordDiff);
  const words = roles.map((r) => {
    if (r === 'civilian') return civWord;
    if (r === 'undercover') return ucWord;
    return '';
  });

  state.numPlayers = n;
  state.talkMode = talkMode;
  state.wordDiff = wordDiff;
  state.speechTime = speechTime;
  state.ucCount = ucCount;
  state.hasBlank = blankCount > 0;
  state.civWord = civWord;
  state.ucWord = ucWord;
  state.roles = roles;
  state.words = words;
  state.alive = Array(n).fill(true);
  state.revealed = Array(n).fill(false);

  state.round = 0;
  state.firstSpeaker = 0;
  state.phase = 'speech';
  state.speechKind = 'round';
  state.speakers = [];
  state.speakerPos = 0;
  state.votePk = false;
  state.pkTargets = [];
  state.voteCandidates = [];
  state.votes = {};
  state.lastVote = null;
  state.lastExiled = null;
  state.speeches = [];
  state.chat = [];
  state.log = [];
  state.phaseEndsAt = 0;
  state.winner = null;

  startRound(state);
};

exports.handleMove = (data, state, p) => {
  const s = state;
  if (!s || s.winner !== null) return 'uc_game_over';
  if (!data || typeof data !== 'object') return 'uc_invalid_move';
  if (!Number.isInteger(p) || p < 0 || p >= s.numPlayers) return 'uc_invalid_move';
  if (!s.alive[p]) return 'uc_dead';

  // Server bot fallback passes `{ pass: true }` or `{}` when a bot move fails
  if (data.pass === true || Object.keys(data).length === 0) {
    if (s.phase === 'speech' && s.speakers[s.speakerPos] === p) {
      s.speeches.push({ round: s.round, pk: s.speechKind === 'pk', seat: p, text: '' });
      s.log.push({ k: 'spoke', p, round: s.round, pk: s.speechKind === 'pk' });
      nextSpeaker(s);
      return;
    }
    if (s.phase === 'vote' && s.votes[p] === undefined) {
      s.votes[p] = -1;
      if (aliveIndices(s).every((i) => s.votes[i] !== undefined)) resolveVote(s);
      return;
    }
    return 'uc_invalid_phase';
  }

  const t = data.type;

  if (t === 'chat' || t === 'speak') {
    if (s.phase !== 'speech' || s.speakers[s.speakerPos] !== p) return 'uc_not_your_speech';
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text) return 'uc_empty_chat';
    if (text.length > MAX_SPEECH) return 'uc_chat_too_long';
    if (containsOwnWord(s, p, text)) return 'uc_word_in_chat';

    s.speeches.push({ round: s.round, pk: s.speechKind === 'pk', seat: p, text });
    s.chat.push({ seat: p, text, round: s.round, pk: s.speechKind === 'pk' });
    s.log.push({ k: 'speech', p, text, round: s.round, pk: s.speechKind === 'pk' });
    nextSpeaker(s);
    return;
  }

  if (t === 'done' || t === 'end_speech') {
    if (s.phase !== 'speech' || s.speakers[s.speakerPos] !== p) return 'uc_not_your_speech';
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (text) {
      if (text.length > MAX_SPEECH) return 'uc_chat_too_long';
      if (containsOwnWord(s, p, text)) return 'uc_word_in_chat';
      s.speeches.push({ round: s.round, pk: s.speechKind === 'pk', seat: p, text });
      s.chat.push({ seat: p, text, round: s.round, pk: s.speechKind === 'pk' });
      s.log.push({ k: 'speech', p, text, round: s.round, pk: s.speechKind === 'pk' });
    } else {
      s.speeches.push({ round: s.round, pk: s.speechKind === 'pk', seat: p, text: '' });
      s.log.push({ k: 'spoke', p, round: s.round, pk: s.speechKind === 'pk' });
    }
    nextSpeaker(s);
    return;
  }

  if (t === 'vote') {
    if (s.phase !== 'vote') return 'uc_invalid_phase';
    if (s.votes[p] !== undefined) return 'uc_already_voted';
    const rawTarget = data.target;
    const target = rawTarget === null || rawTarget === undefined ? -1 : Number(rawTarget);
    if (!Number.isInteger(target)) return 'uc_invalid_target';
    if (target === p) return 'uc_cannot_vote_self';
    if (target !== -1 && (!s.alive[target] || !s.voteCandidates.includes(target))) {
      return 'uc_invalid_target';
    }
    s.votes[p] = target;
    if (aliveIndices(s).every((i) => s.votes[i] !== undefined)) {
      resolveVote(s);
    }
    return;
  }

  return 'uc_invalid_move';
};

exports.getPhaseDeadline = (s) => (s && s.phaseEndsAt) || 0;

exports.getPendingActors = (s) => {
  if (!s || s.winner !== null) return [];
  if (s.phase === 'speech') {
    const sp = s.speakers && s.speakers[s.speakerPos];
    return sp !== undefined && s.alive[sp] ? [sp] : [];
  }
  if (s.phase === 'vote') {
    return aliveIndices(s).filter((i) => s.votes[i] === undefined);
  }
  return [];
};

exports.onTimeout = (s) => {
  if (!s || s.winner !== null) return;
  if (s.phase === 'speech') {
    const sp = s.speakers && s.speakers[s.speakerPos];
    if (sp !== undefined) {
      s.speeches.push({ round: s.round, pk: s.speechKind === 'pk', seat: sp, text: '' });
      s.log.push({ k: 'spoke', p: sp, round: s.round, pk: s.speechKind === 'pk', timeout: true });
    }
    nextSpeaker(s);
    return;
  }
  if (s.phase === 'vote') {
    for (const i of aliveIndices(s)) {
      if (s.votes[i] === undefined) s.votes[i] = -1;
    }
    resolveVote(s);
  }
};

exports.getCurrentActor = () => -1;
exports.setCurrentActor = () => {};

exports.playerView = (state, idx) => {
  if (!state || typeof state !== 'object') return {};
  if (!Array.isArray(state.roles) || state.roles.length === 0) {
    return { ...state };
  }
  const n = state.numPlayers || state.roles.length;
  const validSeat = Number.isInteger(idx) && idx >= 0 && idx < n;
  const over = state.winner !== null && state.winner !== undefined;

  const v = {
    ...state,
    speeches: Array.isArray(state.speeches) ? state.speeches.map((e) => ({ ...e })) : [],
    chat: Array.isArray(state.chat) ? state.chat.map((e) => ({ ...e })) : [],
    log: Array.isArray(state.log) ? state.log.map((e) => ({ ...e })) : [],
    alive: Array.isArray(state.alive) ? state.alive.slice() : [],
    revealed: Array.isArray(state.revealed) ? state.revealed.slice() : [],
    speakers: Array.isArray(state.speakers) ? state.speakers.slice() : [],
    pkTargets: Array.isArray(state.pkTargets) ? state.pkTargets.slice() : [],
    voteCandidates: Array.isArray(state.voteCandidates) ? state.voteCandidates.slice() : [],
    mySeat: validSeat ? idx : -1,
    myWord: validSeat ? (state.roles[idx] === 'blank' ? '' : state.words[idx]) : null,
    isBlank: validSeat ? state.roles[idx] === 'blank' : false,
  };

  if (!over) {
    v.civWord = null;
    v.ucWord = null;
    v.words = Array.isArray(state.words)
      ? state.words.map((w, i) => (i === idx ? (state.roles[i] === 'blank' ? '' : w) : null))
      : [];
    // Nobody knows their own role while alive; voted-out players have their role revealed
    v.roles = state.roles.map((r, i) => (!state.alive[i] || (state.revealed && state.revealed[i]) ? r : null));

    if (state.phase === 'vote' && state.votes) {
      const maskedVotes = {};
      for (const [k, val] of Object.entries(state.votes)) {
        maskedVotes[k] = Number(k) === idx ? val : 'voted';
      }
      v.votes = maskedVotes;
      v.votedSeats = Object.keys(state.votes).map(Number);
    } else {
      v.votes = state.votes ? { ...state.votes } : {};
      v.votedSeats = state.votes ? Object.keys(state.votes).map(Number) : [];
    }
  } else {
    v.civWord = state.civWord;
    v.ucWord = state.ucWord;
    v.words = Array.isArray(state.words) ? state.words.slice() : [];
    v.roles = state.roles.slice();
    v.votes = state.votes ? { ...state.votes } : {};
    v.votedSeats = state.votes ? Object.keys(state.votes).map(Number) : [];
  }

  return v;
};
