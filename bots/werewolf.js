// bots/werewolf.js — filler players for testing a table. They only use what their seat may know:
// own role, teammates (wolves), seer results, the knife (witch), the sheriff, public vote results.
//  easy   — mostly random but legal; wastes potions, may even vote its own side
//  normal — acts on the obvious (wolves avoid teammates, the seer votes out wolves it found)
//  hard   — wolves move as a bloc, the seer/witch/hunter use their evidence, villagers follow the sheriff's vote
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'werewolf';

const pick = (a) => (a.length ? a[Math.floor(Math.random() * a.length)] : -1);
// highest score wins, ties go to the lowest seat so that teammates computing the same thing agree
const best = (list, score) => {
  let b = -1, bs = -Infinity;
  for (const i of list) { const v = score(i); if (v > bs) { bs = v; b = i; } }
  return b;
};

exports.createBot = (playerIndex) => {
  const memo = { saved: -1 }; // witch: who got the antidote (silver water = known good)
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex,
    getMove(s, idx) {
      const me = Number.isInteger(idx) ? idx : playerIndex;
      const role = s.roles[me];
      const diff = getDifficulty(s);
      const alive = s.alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
      const others = alive.filter((i) => i !== me);
      const mates = role === 'wolf' ? others.filter((i) => s.roles[i] === 'wolf') : [];
      const nonWolf = role === 'wolf' ? others.filter((i) => s.roles[i] !== 'wolf') : others;
      const knownWolves = (s.checks || []).filter((c) => c.wolf && s.alive[c.target]).map((c) => c.target);
      const knownGood = (s.checks || []).filter((c) => !c.wolf && s.alive[c.target]).map((c) => c.target);
      const live = (list) => list.filter((i) => !(s.revealed && s.revealed[i] && s.roles[i] === 'idiot'));
      const lv = s.lastVote && s.lastVote.kind === 'exile' ? s.lastVote : null;
      const votersOf = (t) => (lv ? Object.keys(lv.votes).map(Number).filter((v) => lv.votes[v] === t && s.alive[v]) : []);
      const sheriffVote = lv && s.sheriff >= 0 && s.alive[s.sheriff] && lv.votes[s.sheriff] !== undefined ? lv.votes[s.sheriff] : -1;
      // Hard villagers all vote the same way, so anyone who voted against the crowd last time is probably a wolf
      // (the sheriff — the seer in a hard game — is the one exception: it votes on what it found).
      const crowd = lv && !lv.pk && lv.top.length === 1 ? lv.top[0] : -1;
      const dissent = crowd < 0 ? [] : Object.keys(lv.votes).map(Number)
        .filter((v) => s.alive[v] && v !== me && v !== s.sheriff && lv.votes[v] >= 0 && lv.votes[v] !== crowd);
      const suspects = role === 'wolf' ? nonWolf : role === 'seer' && knownWolves.length ? knownWolves : others;
      const hard = diff === 'hard';

      switch (s.phase) {
        case 'night_wolf':
          if (role === 'wolf') {
            const mate = Object.keys(s.wolfVotes).map((k) => s.wolfVotes[k]).find((t) => t >= 0);
            if (mate !== undefined && diff !== 'easy') return { type: 'kill', target: mate };
            if (diff === 'easy') return { type: 'kill', target: Math.random() < 0.3 ? -1 : pick(others) }; // sometimes forgets to pick
            if (!hard) return { type: 'kill', target: pick(nonWolf) };
            // hard: go for who looks like a god — whoever voted against us, then the sheriff
            const t = best(live(nonWolf), (i) =>
              mates.reduce((n, m) => n + (votersOf(m).indexOf(i) >= 0 ? 2 : 0), 0) + (i === s.sheriff ? 3 : 0));
            return { type: 'kill', target: t };
          }
          { // the seer acts in the same phase
            const unchecked = others.filter((i) => !s.checks.some((c) => c.target === i));
            const pool = unchecked.length ? unchecked : others;
            return { type: 'check', target: hard ? best(pool, (i) => (i === s.sheriff ? 1 : 0) + Math.random() * 0.5) : pick(pool) };
          }
        case 'night_witch': {
          const canSave = s.knife >= 0 && s.knife !== me && s.potions.save;
          const poisonTarget = () => {
            // hard: whoever piled on the person we saved or on us is the best guess for a wolf
            const sc = (i) => (dissent.indexOf(i) >= 0 ? 3 : 0) + (votersOf(memo.saved).indexOf(i) >= 0 ? 2 : 0) + (votersOf(me).indexOf(i) >= 0 ? 1 : 0);
            const t = best(others, sc);
            return t >= 0 && sc(t) > 0 ? t : -1;
          };
          if (diff === 'easy') {
            if (canSave && Math.random() < 0.5) return { type: 'witch', save: true };
            if (s.potions.poison && Math.random() < 0.4) return { type: 'witch', poison: pick(others) };
            return { type: 'witch' };
          }
          if (canSave) { memo.saved = s.knife; return { type: 'witch', save: true }; }
          if (s.potions.poison) {
            if (hard) {
              const t = poisonTarget();
              if (t >= 0 && (s.night > 1 || s.knife === me)) return { type: 'witch', poison: t };
              if (s.knife === me && others.length) return { type: 'witch', poison: pick(others) };
            } else if (s.night > 1 && Math.random() < 0.25) return { type: 'witch', poison: pick(others) };
          }
          return { type: 'witch' };
        }
        case 'sheriff_sign': {
          if (hard) return { type: 'run', run: role === 'seer' }; // only the seer runs: hard villagers read the badge as a seer claim
          return { type: 'run', run: Math.random() < 0.35 };
        }
        case 'speech': return { type: 'end_speech' };
        case 'discuss': return { type: 'ready' };
        case 'vote': {
          const pool = s.voteCandidates.filter((i) => i !== me);
          if (!pool.length) return { type: 'vote', target: -1 };
          if (s.voteKind === 'sheriff') {
            // we want a friend with the badge
            if (diff === 'easy') return { type: 'vote', target: pick(pool) };
            const friendly = role === 'wolf' ? pool.filter((i) => mates.indexOf(i) >= 0)
              : role === 'seer' ? pool.filter((i) => knownWolves.indexOf(i) < 0) : pool;
            const good = hard && role === 'seer' ? friendly.filter((i) => knownGood.indexOf(i) >= 0) : [];
            return { type: 'vote', target: pick(good.length ? good : friendly.length ? friendly : pool) };
          }
          if (diff === 'easy') return { type: 'vote', target: Math.random() < 0.15 ? -1 : pick(pool) };
          if (!hard) {
            const pref = pool.filter((i) => suspects.indexOf(i) >= 0);
            return { type: 'vote', target: pick(pref.length ? pref : pool) };
          }
          const cand = live(pool).length ? live(pool) : pool;
          if (role === 'wolf') {
            const t = best(cand.filter((i) => mates.indexOf(i) < 0), (i) =>
              mates.reduce((n, m) => n + (votersOf(m).indexOf(i) >= 0 ? 3 : 0), 0) + (i === s.sheriff ? 1 : 0));
            return { type: 'vote', target: t >= 0 ? t : pick(cand) };
          }
          if (role === 'seer' && knownWolves.some((w) => cand.indexOf(w) >= 0)) return { type: 'vote', target: knownWolves.find((w) => cand.indexOf(w) >= 0) };
          // villagers can't talk, so they vote as a bloc: the sheriff's last target, else the lowest free seat
          const t = best(cand.filter((i) => knownGood.indexOf(i) < 0 && (i !== s.sheriff || i === sheriffVote)), (i) =>
            (dissent.indexOf(i) >= 0 ? 4 : 0) + (i === sheriffVote ? 3 : 0));
          return { type: 'vote', target: t >= 0 ? t : pick(cand) };
        }
        case 'hunter': {
          if (role !== 'hunter') return { type: 'shoot', target: -1 };
          if (hard) {
            const sc = (i) => (dissent.indexOf(i) >= 0 ? 3 : 0) + (votersOf(me).indexOf(i) >= 0 ? 1 : 0);
            const t = best(others, sc);
            return { type: 'shoot', target: t >= 0 && sc(t) > 0 ? t : -1 };
          }
          if (diff === 'easy') return { type: 'shoot', target: Math.random() < 0.7 ? pick(others) : -1 };
          return { type: 'shoot', target: Math.random() < 0.5 ? pick(others) : -1 };
        }
        case 'badge': {
          if (diff === 'easy') return { type: 'badge', target: pick(others) };
          const friends = role === 'wolf' ? mates : others.filter((i) => knownWolves.indexOf(i) < 0);
          const good = hard && role === 'seer' ? friends.filter((i) => knownGood.indexOf(i) >= 0) : [];
          return { type: 'badge', target: pick(good.length ? good : friends.length ? friends : others) };
        }
      }
      return { type: 'end_speech' };
    },
  };
};
