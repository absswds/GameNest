// games/lib/match.js — best-of-N match tracking for two-player board games.
// A game result is a winner index (0/1) or -1 for a draw.

const BEST_OF_CHOICES = [1, 3, 5];

function createMatch(bestOf) {
  const n = BEST_OF_CHOICES.indexOf(Number(bestOf)) >= 0 ? Number(bestOf) : 1;
  return { bestOf: n, wins: [0, 0], draws: 0, played: 0, over: false, winner: null };
}

function recordResult(match, winner) {
  if (!match || match.over) return match;
  match.played++;
  if (winner === 0 || winner === 1) match.wins[winner]++;
  else match.draws++;
  const need = Math.floor(match.bestOf / 2) + 1;
  if (match.wins[0] >= need || match.wins[1] >= need || match.played >= match.bestOf) {
    match.over = true;
    match.winner = match.wins[0] > match.wins[1] ? 0 : match.wins[1] > match.wins[0] ? 1 : -1;
  }
  return match;
}

module.exports = { BEST_OF_CHOICES, createMatch, recordResult };
