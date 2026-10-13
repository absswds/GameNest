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
  // 番值表（四川：清一色 8、七对 4）
  fan: { qingyise: 8, hunyise: 2, qidui: 4, duidui: 2, duanyao: 1, zimo: 1, haidi: 1, gangshang: 1,
         dasanyuan: 8, dasixi: 8, shisanyao: 8, wildcard: 1 },
};

const CANTONESE = {
  suits: ['wan', 'tong', 'tiao'],
  honours: true,
  allowChow: true,
  requireVoid: false,
  blood: false,
  maxPlayers: 4,
  minPlayers: 2,
  // 番值表（广东：清一色 8、七对 2）
  fan: { qingyise: 8, hunyise: 2, qidui: 2, duidui: 2, duanyao: 1, zimo: 1, haidi: 1, gangshang: 1,
         dasanyuan: 8, dasixi: 8, shisanyao: 8, wildcard: 1 },
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

const SUIT_ORDER = { wan: 0, tong: 1, tiao: 2, feng: 3, jian: 4 };
// 牌键 "k:n" 的排序值（花色优先，再按点数），保证递归总是从最小的牌开始拆
function tileOrd(key) {
  const i = key.indexOf(':');
  return (SUIT_ORDER[key.slice(0, i)] ?? 9) * 10 + parseInt(key.slice(i + 1), 10);
}

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

  // 十三幺 —— 仅在不启用百搭时判断（百搭牌的归属不确定，按原始牌面判定）
  if (wildcards === 0 && isShisanyao(counts)) return { win: true, type: 'shisanyao' };

  // 七对（无副露）：与标准牌型同时成立时优先按七对计番（七对番数不低于同一手牌的任何标准拆法）
  if (exposedMelds === 0 && hand.length === 14 && trySevenPairsWithWildcards(counts, wildcards)) {
    return { win: true, type: 'qidui', wildcard: wildcards > 0 };
  }

  const pair = findStandardPair(counts, wildcards);
  if (pair !== null) {
    const res = { win: true, type: 'standard', pair, wildcard: wildcards > 0 };
    // 大三元/大四喜：必须在标准牌型（面子+将）成立的前提下，三元牌/四风牌各成刻子
    if (wildcards === 0) {
      const c = (k) => counts[k] || 0;
      if (c('jian:1') >= 3 && c('jian:2') >= 3 && c('jian:3') >= 3) res.type = 'dasanyuan';
      else if (c('feng:1') >= 3 && c('feng:2') >= 3 && c('feng:3') >= 3 && c('feng:4') >= 3) res.type = 'dasixi';
    }
    return res;
  }

  return { win: false };
}

// 标准牌型：找一个将牌使剩余牌全部成面子；返回将牌的键（'wildcard' = 两张百搭做将），不成则返回 null
function findStandardPair(counts, wildcards) {
  const keys = Object.keys(counts).sort((a, b) => tileOrd(a) - tileOrd(b));
  for (const key of keys) {
    if (counts[key] >= 2) {
      const testCounts = Object.assign({}, counts);
      testCounts[key] -= 2;
      if (testCounts[key] === 0) delete testCounts[key];
      if (canFormMeldsWild(testCounts, wildcards)) return key;
    }
  }
  // Pair using wildcards: 1 real tile + 1 wildcard, or 2 wildcards
  if (wildcards >= 1) {
    for (const key of keys) {
      const testCounts = Object.assign({}, counts);
      testCounts[key] -= 1;
      if (testCounts[key] === 0) delete testCounts[key];
      if (canFormMeldsWild(testCounts, wildcards - 1)) return key;
    }
  }
  if (wildcards >= 2 && canFormMeldsWild(counts, wildcards - 2)) return 'wildcard';
  return null;
}

// 十三幺: 13种幺九字牌各至少1张 + 恰好1张成对，总14张
function isShisanyao(counts) {
  const terminals = ['wan:1','wan:9','tong:1','tong:9','tiao:1','tiao:9',
                     'feng:1','feng:2','feng:3','feng:4','jian:1','jian:2','jian:3'];
  let total = 0, pairCount = 0, zeroCount = 0;
  for (const key of terminals) {
    const c = counts[key] || 0;
    total += c;
    if (c === 0) zeroCount++;
    else if (c >= 2) pairCount++;
  }
  return total === 14 && zeroCount === 0 && pairCount === 1;
}

// 百搭面子递归：counts 为普通牌计数，wildcards 为剩余百搭数。
// 总是取排序后最小的牌 n：它是刻子的一员，或是顺子 (s, s+1, s+2) 的一员（s 取 n-2..n）。
// 缺的位置用百搭补；最小牌之前不会有普通牌，所以补在它前面的位置（如百搭当 7 组成 7-8-9）也会被尝试。
function canFormMeldsWild(counts, wildcards) {
  let key = null, best = Infinity;
  for (const k in counts) {
    if (counts[k] > 0) { const o = tileOrd(k); if (o < best) { best = o; key = k; } }
  }
  if (key === null) return true;

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
  if (k !== 'feng' && k !== 'jian') {
    for (let s = Math.max(1, n - 2); s <= Math.min(n, 7); s++) {
      const next = Object.assign({}, counts);
      let need = 0;
      for (let p = s; p < s + 3; p++) {
        const kp = k + ':' + p;
        if (next[kp] > 0) { next[kp]--; if (next[kp] === 0) delete next[kp]; }
        else need++;
      }
      if (need <= wildcards && canFormMeldsWild(next, wildcards - need)) return true;
    }
  }

  return false;
}

// 七对（含百搭辅助）
function trySevenPairsWithWildcards(counts, wildcards) {
  let singles = 0;
  for (const key in counts) {
    if (counts[key] % 2 !== 0) singles++;
  }
  // 单张用百搭配对
  return singles <= wildcards;
}

// 听牌判断：手牌（3n+1 张）再摸任意一张是否能胡。excludeSuit：定缺花色不参与（四川）。
function isTenpai(hand, melds, cfg, excludeSuit) {
  const cands = [];
  for (const k of cfg.suits || ['wan', 'tong', 'tiao']) {
    if (k === excludeSuit) continue;
    for (let n = 1; n <= 9; n++) cands.push({ k, n });
  }
  if (cfg.honours) {
    for (let n = 1; n <= 4; n++) cands.push({ k: 'feng', n });
    for (let n = 1; n <= 3; n++) cands.push({ k: 'jian', n });
  }
  for (const c of cands) {
    const res = huCheck(hand.concat([{ k: c.k, n: c.n, id: 'tenpai-test' }]), melds, cfg);
    if (res && res.win) return true;
  }
  return false;
}

// 暗杠：手中恰有 4 张同牌才执行（先数后删，不够 4 张时不动手牌）。返回是否成功。
function doSelfKong(hand, melds, suit, num, playerIndex) {
  if (hand.filter(t => t.k === suit && t.n === num).length < 4) return false;
  for (let i = hand.length - 1; i >= 0; i--) {
    if (hand[i].k === suit && hand[i].n === num) hand.splice(i, 1);
  }
  melds.push({ type: 'kong', tile: { k: suit, n: num }, tiles: [], from: playerIndex });
  return true;
}

// 补杠：已碰的刻子 + 手中第 4 张，升级成杠。返回是否成功。
function doAddKong(hand, melds, suit, num) {
  const meld = melds.find(m => {
    if (m.type !== 'pung') return false;
    if (m.tile) return m.tile.k === suit && m.tile.n === num;
    return m.tiles && m.tiles[0] && m.tiles[0].k === suit && m.tiles[0].n === num;
  });
  if (!meld) return false;
  const ti = hand.findIndex(t => t.k === suit && t.n === num);
  if (ti < 0) return false;
  meld.type = 'kong';
  meld.tiles.push(hand.splice(ti, 1)[0]);
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
  var F = cfg.fan || (cfg.honours ? CANTONESE.fan : SICHUAN.fan);
  options = options || {};
  var suitsUsed = new Set();
  for (var i = 0; i < hand.length; i++) suitsUsed.add(hand[i].k);
  if (melds) for (var m = 0; m < melds.length; m++) {
    if (melds[m].tile) suitsUsed.add(melds[m].tile.k);
    if (melds[m].tiles) for (var t = 0; t < melds[m].tiles.length; t++) suitsUsed.add(melds[m].tiles[t].k);
  }
  // 清一色 (one suit)
  if (suitsUsed.size === 1) {
    details.push({ name: '清一色', fan: F.qingyise });
  }
  // 混一色 (two suits including honours)
  else if (suitsUsed.size === 2 && cfg.honours && (suitsUsed.has('feng') || suitsUsed.has('jian'))) {
    details.push({ name: '混一色', fan: F.hunyise });
  }
  // 七对
  if (winInfo && winInfo.type === 'qidui') {
    details.push({ name: '七对', fan: F.qidui });
  }
  // 对对和 (all pungs/kongs, no chows) — exposed melds AND the concealed tiles
  if (winInfo && winInfo.type === 'standard' && isAllPungs(hand, melds, cfg)) {
    details.push({ name: '对对和', fan: F.duidui });
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
  if (!hasTerminal) details.push({ name: '断幺', fan: F.duanyao });
  // 自摸
  if (options.selfDraw) details.push({ name: '自摸', fan: F.zimo });
  // 海底捞 (last tile self-draw)
  if (options.selfDraw && options.wallCount === 0) details.push({ name: '海底捞', fan: F.haidi });
  // 杠上花
  if (options.gangShangHua) details.push({ name: '杠上花', fan: F.gangshang });
  // 特殊番型
  if (winInfo && winInfo.type === 'dasanyuan') details.push({ name: '大三元', fan: F.dasanyuan });
  if (winInfo && winInfo.type === 'dasixi') details.push({ name: '大四喜', fan: F.dasixi });
  if (winInfo && winInfo.type === 'shisanyao') details.push({ name: '十三幺', fan: F.shisanyao });
  // 百搭（红中当百搭胡牌时加 1 番）
  if (winInfo && winInfo.wildcard) details.push({ name: '百搭', fan: F.wildcard });

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
  isTenpai,
  doSelfKong,
  doAddKong,
  countFan,
  countFanDetailed,
  sortTiles,
};
