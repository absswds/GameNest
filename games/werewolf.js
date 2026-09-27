// games/werewolf.js
// 狼人杀（预女猎白标准板）— the phone is the judge: night actions and votes happen
// on screen, day discussion happens out loud. 6–12 players, 屠边 win condition.

exports.name = 'werewolf';
exports.maxPlayers = 12;
exports.minPlayers = 6;

const SETUPS = {
  6: { wolf: 2, seer: 1, witch: 1, villager: 2 },
  7: { wolf: 2, seer: 1, witch: 1, hunter: 1, villager: 2 },
  8: { wolf: 3, seer: 1, witch: 1, hunter: 1, villager: 2 },
  9: { wolf: 3, seer: 1, witch: 1, hunter: 1, villager: 3 },
  10: { wolf: 3, seer: 1, witch: 1, hunter: 1, villager: 4 },
  11: { wolf: 3, seer: 1, witch: 1, hunter: 1, idiot: 1, villager: 4 },
  12: { wolf: 4, seer: 1, witch: 1, hunter: 1, idiot: 1, villager: 4 },
};
const GODS = ['seer', 'witch', 'hunter', 'idiot'];
const SEC = { wolf: 40, witch: 25, dawn: 6, sign: 15, vote: 25, hunter: 20, badge: 15 };

exports.SETUPS = SETUPS;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

exports.createState = () => ({
  phase: 'waiting',
  winner: null,
  n: 0,
  roles: [],
  alive: [],
  day: 0,
  deadline: 0,
  log: [],
});

exports.initGame = (state, n) => {
  const setup = SETUPS[Math.max(6, Math.min(12, n))];
  const roles = [];
  for (const role of Object.keys(setup)) for (let k = 0; k < setup[role]; k++) roles.push(role);
  const opts = state._options || {};
  Object.assign(state, {
    phase: 'night_wolf',
    winner: null,
    n,
    roles: shuffle(roles),
    alive: new Array(n).fill(true),
    revealed: new Array(n).fill(false), // idiot flipped / hunter shot → role public
    deathCause: new Array(n).fill(null),
    day: 0,
    night: 0,
    sheriff: -1,
    sheriffOn: opts.sheriff !== false,
    speechTime: [30, 60, 90, 120, 180].indexOf(opts.speechTime) >= 0 ? opts.speechTime : 60,
    potions: { save: true, poison: true },
    checks: [], // seer results
    log: [],
    queue: [],
  });
  startNight(state);
};

// ---------- helpers ----------
const alive = (s) => s.alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
const aliveWith = (s, role) => alive(s).filter((i) => s.roles[i] === role);
const setDeadline = (s, sec) => { s.deadline = Date.now() + sec * 1000; };

function kill(s, i, cause) {
  if (!s.alive[i]) return;
  s.alive[i] = false;
  s.deathCause[i] = cause;
}

// 屠边: wolves win when every god or every villager is dead; good wins when no wolf is left.
function checkWin(s) {
  const a = alive(s);
  if (!a.some((i) => s.roles[i] === 'wolf')) return end(s, -3);
  if (!a.some((i) => s.roles[i] === 'villager') || !a.some((i) => GODS.indexOf(s.roles[i]) >= 0)) return end(s, -2);
  return false;
}
function end(s, winner) {
  s.winner = winner; // -2 wolves, -3 good
  s.phase = 'over';
  s.deadline = 0;
  return true;
}

// ---------- night ----------
function startNight(s) {
  s.night++;
  s.phase = 'night_wolf';
  s.wolfVotes = {};
  s.seerDone = aliveWith(s, 'seer').length === 0;
  s.knife = -1;
  s.witchDone = false;
  s.saved = false;
  s.poisoned = -1;
  setDeadline(s, SEC.wolf);
}

function wolfTarget(s) {
  const counts = {};
  for (const w of aliveWith(s, 'wolf')) {
    const t = s.wolfVotes[w];
    if (t === undefined) continue;
    counts[t] = (counts[t] || 0) + 1;
  }
  const keys = Object.keys(counts);
  if (!keys.length) return -1;
  const max = Math.max(...keys.map((k) => counts[k]));
  const top = keys.filter((k) => counts[k] === max);
  return parseInt(top[Math.floor(Math.random() * top.length)], 10);
}

function witchCanAct(s) {
  const w = aliveWith(s, 'witch')[0];
  return w !== undefined && (s.potions.save || s.potions.poison);
}

function endWolfPhase(s) {
  s.knife = wolfTarget(s);
  s.phase = 'night_witch';
  // The step runs even with no living witch, so its length gives nothing away.
  setDeadline(s, witchCanAct(s) ? SEC.witch : 5 + Math.floor(Math.random() * 4));
  if (!witchCanAct(s)) s.witchDone = true;
}

function endNight(s) {
  const deaths = [];
  if (s.knife >= 0 && !s.saved) deaths.push([s.knife, 'knife']);
  if (s.poisoned >= 0 && s.poisoned !== s.knife) deaths.push([s.poisoned, 'poison']);
  else if (s.poisoned >= 0) deaths[0] = [s.poisoned, 'poison'];
  s.pendingDeaths = deaths;
  s.day++;
  if (s.day === 1 && s.sheriffOn) startSheriff(s);
  else startDawn(s);
}

// ---------- dawn & death triggers ----------
function startDawn(s) {
  const deaths = s.pendingDeaths || [];
  s.pendingDeaths = [];
  for (const [i, cause] of deaths) kill(s, i, cause);
  s.lastNight = deaths.map((d) => d[0]).sort((a, b) => a - b);
  s.log.push({ day: s.day, t: 'deaths', list: s.lastNight });
  if (checkWin(s)) return;
  s.queue = [];
  for (const i of s.lastNight) queueDeath(s, i, s.day === 1);
  s.afterQueue = 'speech';
  s.phase = 'dawn';
  setDeadline(s, SEC.dawn);
}

function queueDeath(s, i, lastWords) {
  if (s.roles[i] === 'hunter' && s.deathCause[i] !== 'poison') s.queue.push({ kind: 'hunter', who: i });
  if (s.sheriff === i) s.queue.push({ kind: 'badge', who: i });
  if (lastWords) s.queue.push({ kind: 'last', who: i });
}

function runQueue(s) {
  const task = s.queue.shift();
  if (!task) return s.afterQueue === 'night' ? startNight(s) : startDaySpeech(s);
  s.actor = task.who;
  if (task.kind === 'last') return startSpeech(s, 'last', [task.who]);
  s.phase = task.kind; // 'hunter' | 'badge'
  setDeadline(s, task.kind === 'hunter' ? SEC.hunter : SEC.badge);
}

// ---------- speeches ----------
function startSpeech(s, kind, speakers) {
  s.phase = 'speech';
  s.speechKind = kind; // sheriff | day | pk | last
  s.speakers = speakers;
  s.speakerPos = 0;
  setDeadline(s, s.speechTime);
}

function startDaySpeech(s) {
  const a = alive(s);
  let first;
  if (s.sheriff >= 0 && s.alive[s.sheriff]) first = s.sheriff + 1; // sheriff speaks last
  else if (s.lastNight && s.lastNight.length) first = s.lastNight[0] + 1;
  else first = a[Math.floor(Math.random() * a.length)];
  const order = [];
  for (let k = 0; k < s.n; k++) {
    const i = (first + k) % s.n;
    if (s.alive[i]) order.push(i);
  }
  startSpeech(s, 'day', order);
}

function nextSpeaker(s) {
  s.speakerPos++;
  if (s.speakerPos < s.speakers.length) return setDeadline(s, s.speechTime);
  const kind = s.speechKind;
  if (kind === 'sheriff') return startVote(s, 'sheriff', s.candidates, false);
  if (kind === 'day') return startVote(s, 'exile', alive(s), false);
  if (kind === 'pk') return startVote(s, 'exile', s.speakers, true);
  return runQueue(s); // last words
}

// ---------- sheriff election (day 1 only) ----------
function startSheriff(s) {
  s.phase = 'sheriff_sign';
  s.runs = {};
  setDeadline(s, SEC.sign);
}

function endSign(s) {
  s.candidates = alive(s).filter((i) => s.runs[i]);
  const voters = alive(s).filter((i) => !s.runs[i]);
  if (s.candidates.length === 1) {
    s.sheriff = s.candidates[0];
    s.log.push({ day: s.day, t: 'sheriff', who: s.sheriff });
  }
  if (s.candidates.length < 2 || !voters.length) {
    if (s.candidates.length !== 1) s.log.push({ day: s.day, t: 'no_sheriff' });
    return startDawn(s);
  }
  startSpeech(s, 'sheriff', s.candidates.slice());
}

// ---------- voting ----------
function startVote(s, kind, candidates, pk) {
  s.phase = 'vote';
  s.voteKind = kind; // sheriff | exile
  s.votePk = pk;
  s.voteCandidates = candidates.slice();
  s.voters = alive(s).filter((i) => {
    if (kind === 'sheriff') return s.candidates.indexOf(i) < 0;
    if (s.revealed[i] && s.roles[i] === 'idiot') return false; // a flipped idiot loses his vote
    return !pk || candidates.indexOf(i) < 0;
  });
  s.votes = {};
  setDeadline(s, SEC.vote);
}

function resolveVote(s) {
  const tally = {};
  for (const v of s.voters) {
    const t = s.votes[v];
    if (t === undefined || t < 0) continue;
    tally[t] = (tally[t] || 0) + (v === s.sheriff && s.voteKind === 'exile' ? 1.5 : 1);
  }
  const keys = Object.keys(tally).map(Number);
  const max = keys.length ? Math.max(...keys.map((k) => tally[k])) : 0;
  const top = keys.filter((k) => tally[k] === max).sort((a, b) => a - b);
  s.lastVote = { day: s.day, kind: s.voteKind, pk: s.votePk, votes: Object.assign({}, s.votes), tally, top };

  if (s.voteKind === 'sheriff') {
    if (top.length === 1) {
      s.sheriff = top[0];
      s.log.push({ day: s.day, t: 'sheriff', who: s.sheriff });
      return startDawn(s);
    }
    if (top.length > 1 && !s.votePk) return startVote(s, 'sheriff', top, true);
    s.log.push({ day: s.day, t: 'no_sheriff' });
    return startDawn(s);
  }

  if (top.length === 1) return exile(s, top[0]);
  if (top.length > 1 && !s.votePk) return startSpeech(s, 'pk', top);
  s.log.push({ day: s.day, t: 'no_exile' });
  startNight(s);
}

function exile(s, i) {
  if (s.roles[i] === 'idiot' && !s.revealed[i]) {
    s.revealed[i] = true;
    s.log.push({ day: s.day, t: 'idiot', who: i });
    return startNight(s);
  }
  kill(s, i, 'exile');
  s.log.push({ day: s.day, t: 'exile', who: i });
  if (checkWin(s)) return;
  s.queue = [];
  queueDeath(s, i, true);
  s.afterQueue = 'night';
  runQueue(s);
}

// ---------- moves ----------
exports.handleMove = (data, s, p) => {
  if (!data || s.winner !== null) return 'ww_not_now';
  const t = data.type;
  const isAlive = (i) => Number.isInteger(i) && i >= 0 && i < s.n && s.alive[i];

  if (s.phase === 'night_wolf') {
    if (t === 'kill') {
      if (s.roles[p] !== 'wolf' || !s.alive[p]) return 'ww_not_now';
      if (data.target !== -1 && !isAlive(data.target)) return 'ww_bad_target';
      s.wolfVotes[p] = data.target;
    } else if (t === 'check') {
      if (s.roles[p] !== 'seer' || !s.alive[p] || s.seerDone) return 'ww_not_now';
      if (!isAlive(data.target) || data.target === p) return 'ww_bad_target';
      s.checks.push({ night: s.night, target: data.target, wolf: s.roles[data.target] === 'wolf' });
      s.seerDone = true;
    } else return 'ww_not_now';
    if (exports.getPendingActors(s).length === 0) endWolfPhase(s);
    return null;
  }

  if (s.phase === 'night_witch') {
    if (t !== 'witch' || s.roles[p] !== 'witch' || !s.alive[p] || s.witchDone) return 'ww_not_now';
    const save = !!data.save;
    const poison = Number.isInteger(data.poison) ? data.poison : -1;
    if (save && poison >= 0) return 'ww_one_potion';
    if (save && (!s.potions.save || s.knife < 0)) return 'ww_no_potion';
    if (save && s.knife === p) return 'ww_no_self_save';
    if (poison >= 0 && (!s.potions.poison || !isAlive(poison))) return 'ww_bad_target';
    if (save) { s.saved = true; s.potions.save = false; }
    if (poison >= 0) { s.poisoned = poison; s.potions.poison = false; }
    s.witchDone = true;
    endNight(s);
    return null;
  }

  if (s.phase === 'sheriff_sign') {
    if (t !== 'run' || !s.alive[p] || s.runs[p] !== undefined) return 'ww_not_now';
    s.runs[p] = !!data.run;
    if (exports.getPendingActors(s).length === 0) endSign(s);
    return null;
  }

  if (s.phase === 'speech') {
    if (t !== 'end_speech' || s.speakers[s.speakerPos] !== p) return 'ww_not_now';
    nextSpeaker(s);
    return null;
  }

  if (s.phase === 'vote') {
    if (t !== 'vote' || s.voters.indexOf(p) < 0 || s.votes[p] !== undefined) return 'ww_not_now';
    if (data.target !== -1 && s.voteCandidates.indexOf(data.target) < 0) return 'ww_bad_target';
    s.votes[p] = data.target;
    if (exports.getPendingActors(s).length === 0) resolveVote(s);
    return null;
  }

  if (s.phase === 'hunter') {
    if (t !== 'shoot' || p !== s.actor) return 'ww_not_now';
    if (data.target !== -1 && (!isAlive(data.target) || data.target === p)) return 'ww_bad_target';
    s.revealed[p] = true;
    if (data.target >= 0) {
      kill(s, data.target, 'shot');
      s.log.push({ day: s.day, t: 'shot', by: p, who: data.target });
      if (checkWin(s)) return null;
      if (s.sheriff === data.target) s.queue.unshift({ kind: 'badge', who: data.target });
    }
    runQueue(s);
    return null;
  }

  if (s.phase === 'badge') {
    if (t !== 'badge' || p !== s.actor) return 'ww_not_now';
    if (data.target !== -1 && !isAlive(data.target)) return 'ww_bad_target';
    s.sheriff = data.target;
    s.log.push({ day: s.day, t: 'badge', by: p, who: data.target });
    runQueue(s);
    return null;
  }

  return 'ww_not_now';
};

// ---------- phase hooks (server.js schedulePhaseGame) ----------
exports.getPhaseDeadline = (s) => (s.winner === null && s.phase !== 'waiting' ? s.deadline : 0);

exports.getPendingActors = (s) => {
  if (s.winner !== null) return [];
  switch (s.phase) {
    case 'night_wolf': {
      const list = aliveWith(s, 'wolf').filter((w) => s.wolfVotes[w] === undefined);
      if (!s.seerDone) list.push(aliveWith(s, 'seer')[0]);
      return list;
    }
    case 'night_witch': return s.witchDone ? [] : aliveWith(s, 'witch');
    case 'sheriff_sign': return alive(s).filter((i) => s.runs[i] === undefined);
    case 'speech': return [s.speakers[s.speakerPos]];
    case 'vote': return s.voters.filter((v) => s.votes[v] === undefined);
    case 'hunter': case 'badge': return [s.actor];
    default: return [];
  }
};

exports.onTimeout = (s) => {
  switch (s.phase) {
    case 'night_wolf': return endWolfPhase(s);
    case 'night_witch': s.witchDone = true; return endNight(s);
    case 'sheriff_sign': return endSign(s);
    case 'speech': return nextSpeaker(s);
    case 'vote': return resolveVote(s);
    case 'hunter': s.revealed[s.actor] = true; return runQueue(s);
    case 'badge':
      s.log.push({ day: s.day, t: 'badge', by: s.actor, who: -1 });
      s.sheriff = -1;
      return runQueue(s);
    case 'dawn': return runQueue(s);
  }
};

// Everyone may act at once, so there is no single turn owner.
exports.getCurrentActor = () => -1;
exports.setCurrentActor = () => {};

// ---------- hidden information ----------
exports.playerView = (s, idx) => {
  const v = JSON.parse(JSON.stringify(s));
  if (!Array.isArray(s.roles) || !s.roles.length) return v;
  const over = s.winner !== null;
  const mine = s.roles[idx];
  v.myRole = mine || null;
  if (!over) {
    v.roles = s.roles.map((r, i) => (i === idx || s.revealed[i] || (mine === 'wolf' && r === 'wolf') ? r : null));
    v.deathCause = s.deathCause.map((c) => (c === 'shot' || c === 'exile' ? c : c ? 'dead' : null));
    if (mine !== 'wolf') v.wolfVotes = {};
    if (mine !== 'seer') v.checks = [];
    if (mine !== 'witch') v.potions = null;
    v.knife = mine === 'witch' && s.phase === 'night_witch' && s.potions.save ? s.knife : -1;
    v.saved = false;
    v.poisoned = -1;
    v.pendingDeaths = [];
    v.seerDone = mine === 'seer' ? s.seerDone : false;
    v.witchDone = mine === 'witch' ? s.witchDone : false;
    // Who has answered is shown, not what they answered (until results are public).
    if (s.phase === 'sheriff_sign') v.runs = Object.keys(s.runs).reduce((o, k) => { o[k] = +k === idx ? s.runs[k] : null; return o; }, {});
    if (s.phase === 'vote') v.votes = Object.keys(s.votes).reduce((o, k) => { o[k] = +k === idx ? s.votes[k] : null; return o; }, {});
  }
  return v;
};
