// public/js/paodekuai-patterns.js
// 跑得快 (Run Fast) card patterns, shared by the server (games/paodekuai.js, bots/paodekuai.js,
// tests) and the browser (renderers/paodekuai.js: card-type label and Hint button).
// Loaded with require() in Node and as window.PaodekuaiPatterns in the browser.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PaodekuaiPatterns = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  var SUITS = ['s', 'h', 'c', 'd'];
  var SUIT_ORDER = { d: 0, c: 1, h: 2, s: 3 };
  // Highest rank that may sit inside a sequence (the ace); the 2 never does.
  var SEQ_MAX = 11;

  function rankVal(rank) {
    return RANKS.indexOf(rank);
  }

  function cardKey(c) {
    return rankVal(c.rank) * 4 + (SUIT_ORDER[c.suit] || 0);
  }

  function sortCards(cards) {
    cards.sort(function (a, b) { return cardKey(a) - cardKey(b); });
    return cards;
  }

  // 48 cards: no jokers, no 2 of hearts / clubs / diamonds, no ace of spades.
  function createDeck() {
    var deck = [];
    for (var r = 0; r < RANKS.length; r++) {
      for (var s = 0; s < SUITS.length; s++) {
        var id = RANKS[r] + SUITS[s];
        if (id === 'As') continue;
        if (RANKS[r] === '2' && SUITS[s] !== 's') continue;
        deck.push({ rank: RANKS[r], suit: SUITS[s], id: id });
      }
    }
    return deck;
  }

  function mk(type, rank, length, size, short) {
    return { type: type, rank: rank, length: length, size: size, short: !!short };
  }

  // Classify a set of cards. isLast = the play empties the player's hand: only then may a triple
  // carry fewer than two extra cards and an airplane fewer than two per triple.
  // Returns { type, rank, length, size, short } or null.
  //   type: single | pair | pairs | triple | plane | straight | bomb
  //   rank: lowest rank of the pattern; length: number of pairs / triples / cards in a straight
  function detect(cards, isLast) {
    if (!cards || !cards.length) return null;
    var n = cards.length;
    var cnt = [];
    var i, v;
    for (i = 0; i < RANKS.length; i++) cnt.push(0);
    for (i = 0; i < n; i++) {
      v = rankVal(cards[i].rank);
      if (v < 0) return null;
      cnt[v]++;
    }
    var present = [];
    for (v = 0; v < cnt.length; v++) if (cnt[v] > 0) present.push(v);
    var lo = present[0];
    var hi = present[present.length - 1];
    var consecutive = hi - lo + 1 === present.length;
    function allCnt(k) {
      for (var j = 0; j < present.length; j++) if (cnt[present[j]] !== k) return false;
      return true;
    }

    if (n === 1) return mk('single', lo, 1, 1);
    if (n === 2 && allCnt(2)) return mk('pair', lo, 1, 2);
    if (n === 4 && allCnt(4)) return mk('bomb', lo, 1, 4);
    if (n >= 5 && allCnt(1) && consecutive && hi <= SEQ_MAX) return mk('straight', lo, n, n);
    if (n >= 4 && n % 2 === 0 && allCnt(2) && consecutive && hi <= SEQ_MAX) return mk('pairs', lo, n / 2, n);

    var tri = [];
    for (v = 0; v < cnt.length; v++) if (cnt[v] >= 3) tri.push(v);
    if (!tri.length) return null;

    // Triple with two cards (one or none on the last play)
    if (n === 5 || (isLast && (n === 3 || n === 4))) {
      return mk('triple', tri[0], 1, n, n < 5);
    }

    // Airplane: k consecutive triples, each with two cards (fewer on the last play)
    for (var k = Math.floor(n / 3); k >= 2; k--) {
      var full = 5 * k;
      if (isLast ? (n < 3 * k || n > full) : n !== full) continue;
      for (var s = SEQ_MAX - k + 1; s >= 0; s--) {
        var ok = true;
        for (i = 0; i < k; i++) {
          if (cnt[s + i] < 3) { ok = false; break; }
        }
        if (ok) return mk('plane', s, k, n, n < full);
      }
    }
    return null;
  }

  // Can play `n` be played on top of table play `t`? Same pattern and card count with a higher
  // rank; a bomb beats anything but a higher bomb. A short last play (fewer extra cards) may
  // follow a full triple / airplane of the same shape.
  function canBeat(n, t) {
    if (!n) return false;
    if (!t) return true;
    if (n.type === 'bomb') return t.type === 'bomb' ? n.rank > t.rank : true;
    if (t.type === 'bomb') return false;
    if (n.type !== t.type || n.length !== t.length) return false;
    if (n.size !== t.size && !n.short) return false;
    return n.rank > t.rank;
  }

  function maxRankOf(hand) {
    var m = -1;
    for (var i = 0; i < hand.length; i++) {
      var v = rankVal(hand[i].rank);
      if (v > m) m = v;
    }
    return m;
  }

  // Every legal play of `hand` on `table` (a play object, or null when leading), weakest first.
  //   opts.mustInclude: card id the play must contain (opening play of the match)
  //   opts.nextOneCard: the next player holds a single card, so a lone card must be the top rank
  // Each entry: { cards: [card...], play: pattern }.
  function enumerate(hand, table, opts) {
    opts = opts || {};
    var must = opts.mustInclude || null;
    var handLen = hand.length;
    var sorted = sortCards(hand.slice());
    var maxRank = maxRankOf(sorted);
    var byRank = [];
    var v, i, s, e, k;
    for (v = 0; v < RANKS.length; v++) byRank.push([]);
    for (i = 0; i < sorted.length; i++) byRank[rankVal(sorted[i].rank)].push(sorted[i]);
    if (must) {
      for (v = 0; v < byRank.length; v++) {
        for (i = 1; i < byRank[v].length; i++) {
          if (byRank[v][i].id === must) byRank[v].unshift(byRank[v].splice(i, 1)[0]);
        }
      }
    }

    var plays = [];
    var seen = {};
    function has(cards, id) {
      for (var j = 0; j < cards.length; j++) if (cards[j].id === id) return true;
      return false;
    }
    function add(cards) {
      var key = cards.map(function (c) { return c.id; }).sort().join(',');
      if (seen[key]) return;
      seen[key] = true;
      var p = detect(cards, cards.length === handLen);
      if (!p) return;
      if (opts.nextOneCard && p.type === 'single' && p.rank !== maxRank) return;
      if (must && !has(cards, must)) return;
      if (table && !canBeat(p, table)) return;
      plays.push({ cards: cards, play: p });
    }
    // Core cards (triples) plus `count` extra cards: lone cards first, or simply the lowest ones
    function addWithWings(core, count) {
      var inCore = {};
      core.forEach(function (c) { inCore[c.id] = true; });
      var pool = sorted.filter(function (c) { return !inCore[c.id]; });
      if (pool.length < count) return;
      var lonelyFirst = pool.slice().sort(function (a, b) {
        var d = byRank[rankVal(a.rank)].length - byRank[rankVal(b.rank)].length;
        return d || cardKey(a) - cardKey(b);
      });
      [lonelyFirst, pool.slice()].forEach(function (list) {
        if (must && !inCore[must]) {
          for (var j = 1; j < list.length; j++) {
            if (list[j].id === must) { list.unshift(list.splice(j, 1)[0]); break; }
          }
        }
        add(core.concat(list.slice(0, count)));
      });
    }

    for (v = 0; v < RANKS.length; v++) {
      var g = byRank[v];
      if (g.length >= 1) add([g[0]]);
      if (g.length >= 2) add(g.slice(0, 2));
      if (g.length === 4) add(g.slice(0, 4));
      if (g.length >= 3) {
        addWithWings(g.slice(0, 3), 2);
        // The whole hand as a triple with fewer extra cards (last play)
        if (handLen === 3 || handLen === 4) add(sorted.slice());
      }
    }
    // Straights
    for (s = 0; s <= SEQ_MAX; s++) {
      for (e = s; e <= SEQ_MAX && byRank[e].length >= 1; e++) {
        if (e - s + 1 < 5) continue;
        var run = [];
        for (i = s; i <= e; i++) run.push(byRank[i][0]);
        add(run);
      }
    }
    // Consecutive pairs
    for (s = 0; s <= SEQ_MAX; s++) {
      for (e = s; e <= SEQ_MAX && byRank[e].length >= 2; e++) {
        if (e - s < 1) continue;
        var prs = [];
        for (i = s; i <= e; i++) prs.push(byRank[i][0], byRank[i][1]);
        add(prs);
      }
    }
    // Airplanes
    for (s = 0; s < SEQ_MAX; s++) {
      for (k = 2; s + k - 1 <= SEQ_MAX; k++) {
        if (byRank[s + k - 1].length < 3) break;
        var okRun = true;
        for (i = 0; i < k; i++) if (byRank[s + i].length < 3) { okRun = false; break; }
        if (!okRun) break;
        var core = [];
        for (i = 0; i < k; i++) core.push(byRank[s + i][0], byRank[s + i][1], byRank[s + i][2]);
        addWithWings(core, 2 * k);
        // The whole hand as an airplane with fewer extra cards (last play)
        if (handLen >= 3 * k && handLen < 5 * k) add(sorted.slice());
      }
    }

    plays.sort(function (a, b) {
      var ab = a.play.type === 'bomb' ? 1 : 0;
      var bb = b.play.type === 'bomb' ? 1 : 0;
      if (ab !== bb) return ab - bb;
      if (a.play.rank !== b.play.rank) return a.play.rank - b.play.rank;
      return a.play.size - b.play.size;
    });
    return plays;
  }

  return {
    RANKS: RANKS,
    SUITS: SUITS,
    SEQ_MAX: SEQ_MAX,
    rankVal: rankVal,
    cardKey: cardKey,
    sortCards: sortCards,
    createDeck: createDeck,
    detect: detect,
    canBeat: canBeat,
    maxRankOf: maxRankOf,
    enumerate: enumerate,
  };
});
