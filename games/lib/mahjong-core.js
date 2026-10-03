// games/lib/mahjong-core.js — Shared mahjong engine (Sichuan + Cantonese)
// Pure functions only; no game state, no mutation of inputs.

// ---- Config objects ----

const SICHUAN = {
  suits: ['wan', 'tong', 'tiao'],
  honours: false,
  allowChow: false,
  requireVoid: true,
  blood: true,
  maxPlayers: 4,
  minPlayers: 2,
};

const CANTONESE = {
  suits: ['wan', 'tong', 'tiao'],
  honours: true,
  allowChow: true,
  requireVoid: false,
  blood: false,
  maxPlayers: 4,
  minPlayers: 2,
};

// ---- Tile helpers ----

function sortTiles(tiles) {
  const suitOrder = { wan: 0, tong: 1, tiao: 2, feng: 3, jian: 4 };
  tiles.sort((a, b) => {
    const sa = suitOrder[a.k] ?? 9, sb = suitOrder[b.k] ?? 9;
    if (sa !== sb) return sa - sb;
    return a.n - b.n;
  });
}

let _tileId = 0;
function makeTile(k, n) {
  return { k, n, id: k + n + '#' + (_tileId++) };
}

// ---- buildDeck ----

function buildDeck(cfg) {
  _tileId = 0;
  const deck = [];
  const suits = cfg.suits || ['wan', 'tong', 'tiao'];
  for (const k of suits) {
    for (let n = 1; n <= 9; n++) {
      for (let c = 0; c < 4; c++) deck.push(makeTile(k, n));
    }
  }
  if (cfg.honours) {
    // Winds: 1-4 (East, South, West, North)
    for (let n = 1; n <= 4; n++) {
      for (let c = 0; c < 4; c++) deck.push(makeTile('feng', n));
    }
    // Dragons: 1-3 (中, 发, 白)
    for (let n = 1; n <= 3; n++) {
      for (let c = 0; c < 4; c++) deck.push(makeTile('jian', n));
    }
  }
  // shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ---- huCheck: determine if hand + melds is a winning hand ----

function huCheck(hand, melds, cfg) {
  // Count tiles by (k, n), separating wildcards (百搭) if configured
  const wildcardDef = cfg && cfg.wildcard;
  let wildcards = 0;
  const counts = {};
  for (const t of hand) {
    if (wildcardDef && t.k === wildcardDef.k && t.n === wildcardDef.n) {
      wildcards++;
    } else {
      const key = t.k + ':' + t.n;
      counts[key] = (counts[key] || 0) + 1;
    }
  }

  const exposedMelds = melds ? melds.length : 0;

  // 特殊番型检测（十三幺/大三元/大四喜）—— 仅在不启用百搭时判断
  // （百搭牌的归属不确定，特殊番型按原始牌面判定）
  if (wildcards === 0) {
    const special = checkSpecialHand(counts);
    if (special) return special;
  }

  // Try standard decomposition: find a pair, rest must form melds
  const keys = Object.keys(counts);
  for (const key of keys) {
    if (counts[key] >= 2) {
      const testCounts = Object.assign({}, counts);
      testCounts[key] -= 2;
      if (testCounts[key] === 0) delete testCounts[key];
      if (canFormMeldsWild(testCounts, wildcards)) {
        return { win: true, type: 'standard', pair: key, wildcard: wildcards > 0 };
      }
    }
  }

  // Pair using wildcards: 1 real tile + 1 wildcard, or 2 wildcards
  if (wildcards >= 1) {
    for (const key of keys) {
      if (counts[key] >= 1) {
        const testCounts = Object.assign({}, counts);
        testCounts[key] -= 1;
        if (testCounts[key] === 0) delete testCounts[key];
        if (canFormMeldsWild(testCounts, wildcards - 1)) {
          return { win: true, type: 'standard', pair: key, wildcard: true };
        }
      }
    }
  }
  if (wildcards >= 2) {
    if (canFormMeldsWild(counts, wildcards - 2)) {
      return { win: true, type: 'standard', pair: 'wildcard', wildcard: true };
    }
  }

  // Try seven pairs (only if no exposed melds)
  if (exposedMelds === 0) {
    const qidui = trySevenPairsWithWildcards(counts, wildcards);
    if (qidui) return { win: true, type: 'qidui', wildcard: wildcards > 0 };
  }

  return { win: false };
}

// 特殊番型：十三幺、大三元、大四喜（从暗手牌面判定）
function checkSpecialHand(counts) {
  const terminals = ['wan:1','wan:9','tong:1','tong:9','tiao:1','tiao:9',
                     'feng:1','feng:2','feng:3','feng:4','jian:1','jian:2','jian:3'];

  // 十三幺: 13种幺九字牌各至少1张 + 恰好1张成对，其余各1张，总14张
  let total = 0, pairCount = 0, zeroCount = 0;
  for (const key of terminals) {
    const c = counts[key] || 0;
    total += c;
    if (c === 0) zeroCount++;
    else if (c >= 2) pairCount++;
  }
  if (total === 14 && zeroCount === 0 && pairCount === 1) {
    return { win: true, type: 'shisanyao' };
  }

  // 大三元: 中(1)发(2)白(3) 各有至少3张（刻子）
  const zhong = counts['jian:1'] || 0;
  const fa = counts['jian:2'] || 0;
  const bai = counts['jian:3'] || 0;
  if (zhong >= 3 && fa >= 3 && bai >= 3) {
    return { win: true, type: 'dasanyuan' };
  }

  // 大四喜: 东南西北 各有至少3张（刻子）
  const dong = counts['feng:1'] || 0;
  const nan = counts['feng:2'] || 0;
  const xi = counts['feng:3'] || 0;
  const bei = counts['feng:4'] || 0;
  if (dong >= 3 && nan >= 3 && xi >= 3 && bei >= 3) {
    return { win: true, type: 'dasixi' };
  }

  return null;
}

// 百搭面子递归：counts 为普通牌计数，wildcards 为剩余百搭数
function canFormMeldsWild(counts, wildcards) {
  const keys = Object.keys(counts).filter(k => counts[k] > 0);
  if (keys.length === 0) return true;

  const key = keys[0];
  const [k, nStr] = key.split(':');
  const n = parseInt(nStr);
  const cnt = counts[key];

  // 刻子：用 min(cnt,3) 张普通牌 + 百搭补足
  if (cnt >= 3) {
    const next = Object.assign({}, counts);
    next[key] -= 3;
    if (next[key] === 0) delete next[key];
    if (canFormMeldsWild(next, wildcards)) return true;
  }
  const wildForPung = Math.max(0, 3 - cnt);
  if (wildForPung > 0 && wildForPung <= wildcards) {
    const next = Object.assign({}, counts);
    delete next[key];
    if (canFormMeldsWild(next, wildcards - wildForPung)) return true;
  }

  // 顺子（仅数牌）
  if (k !== 'feng' && k !== 'jian' && n <= 7) {
    const key2 = k + ':' + (n + 1);
    const key3 = k + ':' + (n + 2);
    const has2 = counts[key2] || 0;
    const has3 = counts[key3] || 0;

    // 纯顺子
    if (has2 > 0 && has3 > 0) {
      const next = Object.assign({}, counts);
      next[key]--; if (next[key] === 0) delete next[key];
      next[key2]--; if (next[key2] === 0) delete next[key2];
      next[key3]--; if (next[key3] === 0) delete next[key3];
      if (canFormMeldsWild(next, wildcards)) return true;
    }
    // 百搭顺子：缺几张补几张
    const need = (has2 > 0 ? 0 : 1) + (has3 > 0 ? 0 : 1);
    if (need > 0 && need <= wildcards) {
      const next = Object.assign({}, counts);
      next[key]--; if (next[key] === 0) delete next[key];
      if (has2 > 0) { next[key2]--; if (next[key2] === 0) delete next[key2]; }
      if (has3 > 0) { next[key3]--; if (next[key3] === 0) delete next[key3]; }
      if (canFormMeldsWild(next, wildcards - need)) return true;
    }
  }

  return false;
}

// 七对（含百搭辅助）
function trySevenPairsWithWildcards(counts, wildcards) {
  let pairs = 0, singles = 0;
  for (const key in counts) {
    const c = counts[key];
    pairs += Math.floor(c / 2);
    if (c % 2 !== 0) singles++;
  }
  // 单张用百搭配对
  return singles <= wildcards;
}

function canFormMelds(counts) {
  // Check if remaining tiles can be fully decomposed into melds (triples/sequences)
  const keys = Object.keys(counts).filter(k => counts[k] > 0);
  if (keys.length === 0) return true;

  const key = keys[0];
  const [k, nStr] = key.split(':');
  const n = parseInt(nStr);

  // Try pung (triple)
  if (counts[key] >= 3) {
    const next = Object.assign({}, counts);
    next[key] -= 3;
    if (next[key] === 0) delete next[key];
    if (canFormMelds(next)) return true;
  }

  // Try chow (sequence) — only for number tiles, not honours
  if (k !== 'feng' && k !== 'jian' && n <= 7) {
    const key2 = k + ':' + (n + 1);
    const key3 = k + ':' + (n + 2);
    if (counts[key2] > 0 && counts[key3] > 0) {
      const next = Object.assign({}, counts);
      next[key]--; next[key2]--; next[key3]--;
      if (next[key] === 0) delete next[key];
      if (next[key2] === 0) delete next[key2];
      if (next[key3] === 0) delete next[key3];
      if (canFormMelds(next)) return true;
    }
  }

  return false;
}

function trySevenPairs(counts) {
  const keys = Object.keys(counts);
  if (keys.length !== 7) return false;
  for (const key of keys) {
    if (counts[key] !== 2) return false;
  }
  return true;
}

// Every exposed meld is a pung/kong and the concealed tiles split into pungs + one pair
// (wildcards, if configured, may fill any gap).
function isAllPungs(hand, melds, cfg) {
  if (melds) for (var i = 0; i < melds.length; i++) {
    if (melds[i].type !== 'pung' && melds[i].type !== 'kong') return false;
  }
  var wildcardDef = cfg && cfg.wildcard;
  var wild = 0, counts = {};
  for (var j = 0; j < hand.length; j++) {
    var t = hand[j];
    if (wildcardDef && t.k === wildcardDef.k && t.n === wildcardDef.n) { wild++; continue; }
    counts[t.k + ':' + t.n] = (counts[t.k + ':' + t.n] || 0) + 1;
  }
  var keys = Object.keys(counts);
  var fill = 0; // wildcards needed to turn every group into a pung
  for (var k = 0; k < keys.length; k++) {
    if (counts[keys[k]] > 3) return false;
    fill += 3 - counts[keys[k]];
  }
  // The pair is one group short of a pung (saves one wildcard) or two spare wildcards
  var options = keys.length ? [fill - 1] : [];
  options.push(fill + 2);
  for (var o = 0; o < options.length; o++) {
    var left = wild - options[o];
    if (left >= 0 && left % 3 === 0) return true;
  }
  return false;
}

// ---- countFan: basic scoring ----

function countFan(hand, melds, winInfo, cfg) {
  // Delegate to detailed version for backward compatibility.
  return countFanDetailed(hand, melds, winInfo, cfg, {}).fan;
}

// ---- countFanDetailed: returns { fan, details: [{ name, fan }] } ----

function countFanDetailed(hand, melds, winInfo, cfg, options) {
  var details = [];
  options = options || {};
  var suitsUsed = new Set();
  for (var i = 0; i < hand.length; i++) suitsUsed.add(hand[i].k);
  if (melds) for (var m = 0; m < melds.length; m++) {
    if (melds[m].tile) suitsUsed.add(melds[m].tile.k);
    if (melds[m].tiles) for (var t = 0; t < melds[m].tiles.length; t++) suitsUsed.add(melds[m].tiles[t].k);
  }
  // 清一色 (one suit)
  if (suitsUsed.size === 1) {
    details.push({ name: '清一色', fan: cfg.honours ? 4 : 8 });
  }
  // 混一色 (two suits including honours)
  else if (suitsUsed.size === 2 && cfg.honours && (suitsUsed.has('feng') || suitsUsed.has('jian'))) {
    details.push({ name: '混一色', fan: 2 });
  }
  // 七对
  if (winInfo && winInfo.type === 'qidui') {
    details.push({ name: '七对', fan: cfg.honours ? 2 : 4 });
  }
  // 对对和 (all pungs/kongs, no chows) — exposed melds AND the concealed tiles
  if (winInfo && winInfo.type === 'standard' && isAllPungs(hand, melds, cfg)) {
    details.push({ name: '对对和', fan: 2 });
  }
  // 断幺九 (no terminals or honours) — check concealed hand AND exposed meld tiles
  var hasTerminal = false;
  var termCheck = function(t) {
    if (t.k === 'feng' || t.k === 'jian' || t.n === 1 || t.n === 9) hasTerminal = true;
  };
  for (var i2 = 0; i2 < hand.length; i2++) termCheck(hand[i2]);
  if (!hasTerminal && melds) for (var mm = 0; mm < melds.length; mm++) {
    var md = melds[mm];
    if (md.tile) termCheck(md.tile);
    if (md.tiles) for (var mt = 0; mt < md.tiles.length; mt++) termCheck(md.tiles[mt]);
  }
  if (!hasTerminal) details.push({ name: '断幺', fan: 1 });
  // 自摸
  if (options.selfDraw) details.push({ name: '自摸', fan: 1 });
  // 海底捞 (last tile self-draw)
  if (options.selfDraw && options.wallCount === 0) details.push({ name: '海底捞', fan: 1 });
  // 杠上花
  if (options.gangShangHua) details.push({ name: '杠上花', fan: 1 });
  // 特殊番型
  if (winInfo && winInfo.type === 'dasanyuan') details.push({ name: '大三元', fan: 8 });
  if (winInfo && winInfo.type === 'dasixi') details.push({ name: '大四喜', fan: 8 });
  if (winInfo && winInfo.type === 'shisanyao') details.push({ name: '十三幺', fan: 8 });
  // 百搭（红中当百搭胡牌时加 1 番）
  if (winInfo && winInfo.wildcard) details.push({ name: '百搭', fan: 1 });

  var total = details.reduce(function (s, d) { return s + d.fan; }, 0);
  // 平胡底分：没有任何番种时记 1 分（四川麻将平胡起码 1 番）
  if (total === 0) {
    details.push({ name: '平胡', fan: 1 });
    total = 1;
  }
  return { fan: total, details: details };
}

// ---- Export ----

module.exports = {
  SICHUAN,
  CANTONESE,
  buildDeck,
  huCheck,
  countFan,
  countFanDetailed,
  sortTiles,
};
