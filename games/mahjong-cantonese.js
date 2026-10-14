// games/mahjong-cantonese.js
// 广东麻将 / 鸡平胡 (Cantonese Mahjong)
// 136 tiles (WITH honours), chow only from upstream, no void, one winner ends round.
//
// State machine:
//   'play'  — currentPlayer has drawn, must discard (or self-draw win)
//   'claim' — a tile was discarded; eligible players may chow/pung/kong/win in turn order
//   'over'  — round ended (winner index, or -1 = 荒庄 draw game)

const core = require('./lib/mahjong-core');
const CANTONESE = core.CANTONESE;

// 构建含百搭的配置（广东麻将可选规则：红中=万能百搭）
function getCfg(state) {
  if (state && state._wildcard) {
    return { ...CANTONESE, wildcard: { k: 'jian', n: 1 } };
  }
  return CANTONESE;
}

exports.getCfg = getCfg;
exports.findChowPairs = findChowPairs;
exports.name = 'mahjong-cantonese';
exports.maxPlayers = 4;
exports.minPlayers = 2;

function nextPlayer(state, idx) {
  return (idx + 1) % state._playerCount;
}

function sortHand(hand) {
  core.sortTiles(hand);
}

// Count tiles in hand matching (k, n).
function countMatching(hand, k, n) {
  let c = 0;
  for (const t of hand) if (t.k === k && t.n === n) c++;
  return c;
}

// Find all valid chow pairs (each a [tile, tile]) from hand that form a sequence with `tile`.
function findChowPairs(hand, tile) {
  if (tile.k === 'feng' || tile.k === 'jian') return [];
  const k = tile.k, n = tile.n;
  const pairs = [];
  const has = (num) => hand.filter(t => t.k === k && t.n === num);
  // sequences: (n-2,n-1,n), (n-1,n,n+1), (n,n+1,n+2)
  const tryPair = (a, b) => {
    const ta = has(a), tb = has(b);
    if (ta.length && tb.length) pairs.push([ta[0], tb[0]]);
  };
  if (n - 2 >= 1) tryPair(n - 2, n - 1);
  if (n - 1 >= 1 && n + 1 <= 9) tryPair(n - 1, n + 1);
  if (n + 2 <= 9) tryPair(n + 1, n + 2);
  return pairs;
}

// Can `player` win by claiming `tile`? (hand + tile + melds = winning hand)
function canWinWith(state, player, tile) {
  const test = state.hands[player].slice();
  test.push(tile);
  return core.huCheck(test, state.melds[player], getCfg(state)).win;
}

// Determine which claim types `player` can perform on `tile` (discarded by `discarder`).
function eligibleClaims(state, player, tile, discarder) {
  const claims = [];
  if (canWinWith(state, player, tile)) claims.push('win');
  if (countMatching(state.hands[player], tile.k, tile.n) >= 3) claims.push('kong');
  if (countMatching(state.hands[player], tile.k, tile.n) >= 2) claims.push('pung');
  // chow only from upstream (the player immediately after discarder)
  if (player === nextPlayer(state, discarder) && findChowPairs(state.hands[player], tile).length) claims.push('chow');
  return claims;
}

exports.createState = function () {
  return {
    phase: 'play',
    hands: [],          // concealed tiles per player
    melds: [],          // exposed melds per player: [{ type, tiles: [...], from }]
    discards: [],       // discard piles per player
    wall: [],           // remaining deck
    currentPlayer: 0,
    dealer: 0,
    hasDrawn: false,    // currentPlayer has drawn this turn
    drawn: null,        // id of the newly drawn tile (for highlight)
    lastDiscard: null,  // { tile, player }
    winner: null,       // player index, or -1 = 荒庄
    winInfo: null,      // { type, from, fan }
    claim: null,        // { tile, discarder, order: [players], idx, responses: {} }
    // Rule flags (read from state._options in initGame)
    _buyTiles: true,
    _maxFan: 0,         // 0 = no cap
    _minFan: 0,         // 0 = no minimum (鸡胡=0番可胡)
  };
};

exports.initGame = function (state, playerCount) {
  state._playerCount = playerCount;
  // Read Cantonese rule toggles from options
  const opt = state._options || {};
  state._buyTiles = opt.mj_buyTiles !== false; // default true
  state._maxFan = opt.mj_maxFan || 0; // 0 = no cap
  state._minFan = opt.mj_minFan || 0; // 0 = no minimum
  // 红中百搭（默认关闭）。兼容布尔 true 和字符串 'true'（checkbox 值可能被序列化为字符串）
  state._wildcard = opt.mj_wildcard === true || opt.mj_wildcard === 'true';
  // Server writes the next dealer into state.dealerIndex before initGame. Use it
  // to extend the deal and set the starting player; fall back to 0 for round 1.
  const dealer = state.dealerIndex || 0;
  const deck = core.buildDeck(CANTONESE);
  state.wall = deck;
  state.hands = [];
  state.melds = [];
  state.discards = [];
  for (let i = 0; i < playerCount; i++) {
    state.hands.push([]);
    state.melds.push([]);
    state.discards.push([]);
  }
  // deal 13 to each player
  for (let r = 0; r < 13; r++) {
    for (let i = 0; i < playerCount; i++) {
      state.hands[i].push(state.wall.pop());
    }
  }
  for (let i = 0; i < playerCount; i++) sortHand(state.hands[i]);
  state.dealer = dealer;
  state.currentPlayer = dealer;
  state.winner = null;
  state.winInfo = null;
  state.lastDiscard = null;
  state.claim = null;
  state.drawn = null;
  state.hasDrawn = false;
  state._afterClaim = false;
  // dealer draws first tile
  beginTurn(state, dealer);
};

// Draw a tile for `player` and set them as current. Handles wall exhaustion.
function beginTurn(state, player) {
  if (state.wall.length === 0) {
    state.phase = 'over';
    state.winner = -1; // 荒庄 — draw game, no winner
    state.hasDrawn = false;
    state.drawn = null;
    return;
  }
  const tile = state.wall.pop();
  state.hands[player].push(tile);
  sortHand(state.hands[player]);
  state.currentPlayer = player;
  state.hasDrawn = true;
  state.drawn = tile.id;
  state._gangShangHua = false; // 普通摸牌不算杠上花
  state._afterClaim = false;   // 正常摸牌：可以自摸/暗杠
  state.phase = 'play';
}

exports.handleMove = function (data, state, playerIndex) {
  if (state.winner !== null && state.winner !== undefined) return 'g_game_over';

  if (state.phase === 'play') {
    if (playerIndex !== state.currentPlayer) return 'g_not_your_turn';
    if (!state.hasDrawn) return 'mj_must_draw';
    const d = data || {};

    // self-draw win
    if (d.type === 'win') {
      // 吃/碰之后没有摸牌，手牌是 14 张但不是自摸：不能在出牌阶段喊胡
      if (state._afterClaim) return 'mj_not_winning';
      const info = core.huCheck(state.hands[playerIndex], state.melds[playerIndex], getCfg(state));
      if (!info.win) return 'mj_not_winning';
      var scoreInfo = scoreHand(state.hands[playerIndex], state.melds[playerIndex], info, true, state.wall.length, state, state._gangShangHua);
      // 起胡番数检查
      if (state._minFan && state._minFan > 0 && scoreInfo.fan < state._minFan) return 'mj_not_enough_fan';
      state.winner = playerIndex;
      state.winInfo = { type: info.type, from: -1, fan: scoreInfo.fan, details: scoreInfo.details };
      // 买码：胡牌后从牌尾买牌加分
      if (state._buyTiles) {
        var buyResult = buyTiles(state, playerIndex);
        if (buyResult.bonusFan > 0) {
          state.winInfo.fan += buyResult.bonusFan;
          state.winInfo.buyDetails = buyResult.details;
        }
        state.winInfo.buyTiles = buyResult.tiles;
        state.winInfo.buyFan = buyResult.bonusFan;
      } else {
        state.winInfo.buyTiles = [];
        state.winInfo.buyFan = 0;
      }
      state.phase = 'over';
      return null;
    }

    // 暗杠：自己回合手中有 4 张相同牌，杠出并补牌
    if (d.type === 'selfkong') {
      if (state._afterClaim) return 'mj_cannot_kong';
      if (!core.doSelfKong(state.hands[playerIndex], state.melds[playerIndex], d.suit, d.num, playerIndex)) {
        return 'mj_cannot_kong';
      }
      if (state.wall.length > 0) {
        const rep = state.wall.pop();
        state.hands[playerIndex].push(rep);
        sortHand(state.hands[playerIndex]);
        state.drawn = rep.id;
      }
      state.hasDrawn = true;
      state._gangShangHua = true; // 杠后补牌，若胡牌则算杠上花
      state.phase = 'play';
      state.lastDiscard = null;
      return null;
    }

    // 补杠（加杠）：已碰的刻子，摸到第 4 张时升级成杠并补牌
    if (d.type === 'addkong') {
      if (state._afterClaim) return 'mj_cannot_kong';
      if (!core.doAddKong(state.hands[playerIndex], state.melds[playerIndex], d.suit, d.num)) {
        return 'mj_cannot_kong';
      }
      // 补牌（杠后若胡算杠上花）
      if (state.wall.length > 0) {
        const rep = state.wall.pop();
        state.hands[playerIndex].push(rep);
        sortHand(state.hands[playerIndex]);
        state.drawn = rep.id;
      }
      state.hasDrawn = true;
      state._gangShangHua = true;
      state.phase = 'play';
      state.lastDiscard = null;
      return null;
    }

    if (d.type === 'discard') {
      const tileId = d.tileId;
      const hand = state.hands[playerIndex];
      const idx = hand.findIndex(t => t.id === tileId);
      if (idx === -1) return 'mj_tile_not_in_hand';
      const tile = hand.splice(idx, 1)[0];
      tile._discardSeq = (state._discardCounter || 0);
      state._discardCounter = (state._discardCounter || 0) + 1;
      state.discards[playerIndex].push(tile);
      state.lastDiscard = { tile, player: playerIndex };
      state.hasDrawn = false;
      state.drawn = null;

      // build claim list: eligible players in turn order starting after discarder
      const order = [];
      for (let step = 1; step < state._playerCount; step++) {
        const p = (playerIndex + step) % state._playerCount;
        if (eligibleClaims(state, p, tile, playerIndex).length) order.push(p);
      }
      if (order.length === 0) {
        beginTurn(state, nextPlayer(state, playerIndex));
      } else {
        state.phase = 'claim';
        state.claim = { tile, discarder: playerIndex, order, idx: 0, responses: {} };
      }
      return null;
    }

    return 'mj_invalid_move';
  }

  if (state.phase === 'claim') {
    const claim = state.claim;
    const actor = claim.order[claim.idx];
    if (playerIndex !== actor) return 'g_not_your_turn';
    const d = data || {};
    const tile = claim.tile;

    if (d.type === 'pass') {
      claim.responses[playerIndex] = { type: 'pass' };
    } else if (d.type === 'chow') {
      // 广东只能吃上家（弃牌者逆时针下一家）。eligibleClaims 只对上游 offer，
      // 但 claim 响应入口必须再校验一次，防止非上游玩家非法吃牌。
      if (playerIndex !== nextPlayer(state, claim.discarder)) return 'mj_cannot_chow';
      const pairs = findChowPairs(state.hands[playerIndex], tile);
      if (!pairs.length) return 'mj_cannot_chow';
      // pick the pair matching requested tile ids, else first
      let pair = pairs[0];
      if (d.tiles) {
        const match = pairs.find(p => p.some(t => d.tiles.indexOf(t.id) >= 0));
        if (match) pair = match;
      }
      claim.responses[playerIndex] = { type: 'chow', tiles: pair };
    } else if (d.type === 'pung') {
      if (countMatching(state.hands[playerIndex], tile.k, tile.n) < 2) return 'mj_cannot_pung';
      claim.responses[playerIndex] = { type: 'pung' };
    } else if (d.type === 'kong') {
      if (countMatching(state.hands[playerIndex], tile.k, tile.n) < 3) return 'mj_cannot_kong';
      claim.responses[playerIndex] = { type: 'kong' };
    } else if (d.type === 'win') {
      if (!canWinWith(state, playerIndex, tile)) return 'mj_not_winning';
      claim.responses[playerIndex] = { type: 'win' };
    } else {
      return 'mj_invalid_claim';
    }

    claim.idx++;
    if (claim.idx >= claim.order.length) {
      resolveClaims(state);
    }
    return null;
  }

  return 'g_unknown_action';
};

// After all claimers respond, pick highest-priority claim (win > kong > pung > chow),
// tie-break by turn order (earlier in claim.order wins).
function resolveClaims(state) {
  const claim = state.claim;
  const tile = claim.tile;
  const priority = { win: 4, kong: 3, pung: 2, chow: 1 };
  let best = null;
  for (const p of claim.order) {
    const r = claim.responses[p];
    if (!r || r.type === 'pass') continue;
    if (!best || priority[r.type] > priority[best.type]) {
      best = r;
      best.player = p;
    }
  }

  // A win below _minFan cannot stand. Demote it to a pass and re-resolve the
  // remaining responses so the round always continues. Resolving *before* we null
  // claim (and returning an error) kept the room in phase 'claim' with claim=null
  // and winner unset, which made the caller dereference a null claim and crash.
  if (best && best.type === 'win' && state._minFan && state._minFan > 0) {
    const p = best.player;
    const test = state.hands[p].slice();
    test.push(tile);
    const info = core.huCheck(test, state.melds[p], getCfg(state));
    var scoreInfo = scoreHand(test, state.melds[p], info, false, state.wall.length, state);
    if (scoreInfo.fan < state._minFan) {
      claim.responses[p] = { type: 'pass' };
      return resolveClaims(state);
    }
  }

  state.claim = null;

  if (!best) {
    // everyone passed → next player draws
    beginTurn(state, nextPlayer(state, claim.discarder));
    return;
  }

  const p = best.player;

  if (best.type === 'win') {
    const test = state.hands[p].slice();
    test.push(tile);
    const info = core.huCheck(test, state.melds[p], getCfg(state));
    var scoreInfo = scoreHand(test, state.melds[p], info, false, state.wall.length, state);
    // 起胡番数已在上方 demote 检查中保证 >= _minFan（不满足的 win 已被降级为 pass）
    state.winner = p;
    state.winInfo = { type: info.type, from: claim.discarder, fan: scoreInfo.fan, details: scoreInfo.details };
    // 买码：胡牌后从牌尾买牌加分
    if (state._buyTiles) {
      var buyResult = buyTiles(state, p);
      if (buyResult.bonusFan > 0) {
        state.winInfo.fan += buyResult.bonusFan;
        state.winInfo.buyDetails = buyResult.details;
      }
      state.winInfo.buyTiles = buyResult.tiles;
      state.winInfo.buyFan = buyResult.bonusFan;
    } else {
      state.winInfo.buyTiles = [];
      state.winInfo.buyFan = 0;
    }
    state.phase = 'over';
    return;
  }

  // form the meld
  const meld = { type: best.type, from: claim.discarder, tiles: [tile] };
  const hand = state.hands[p];

  if (best.type === 'chow') {
    const pair = best.tiles;
    for (const t of pair) {
      const i = hand.findIndex(x => x.id === t.id);
      if (i >= 0) { hand.splice(i, 1); meld.tiles.push(t); }
    }
    sortHand(meld.tiles);
  } else if (best.type === 'pung') {
    let need = 2;
    for (let i = hand.length - 1; i >= 0 && need > 0; i--) {
      if (hand[i].k === tile.k && hand[i].n === tile.n) {
        meld.tiles.push(hand.splice(i, 1)[0]);
        need--;
      }
    }
  } else if (best.type === 'kong') {
    let need = 3;
    for (let i = hand.length - 1; i >= 0 && need > 0; i--) {
      if (hand[i].k === tile.k && hand[i].n === tile.n) {
        meld.tiles.push(hand.splice(i, 1)[0]);
        need--;
      }
    }
  }
  state.melds[p].push(meld);

  // Remove the claimed tile from the discard pile so it no longer shows in the center.
  const discardPile = state.discards[claim.discarder];
  for (let di = discardPile.length - 1; di >= 0; di--) {
    if (discardPile[di].id === tile.id) { discardPile.splice(di, 1); break; }
  }

  // kong draws a replacement tile; chow/pung go straight to discard
  state.currentPlayer = p;
  if (best.type === 'kong') {
    if (state.wall.length === 0) {
      // no replacement available — still must discard; hand is short by one
      state.hasDrawn = true;
      state.drawn = null;
      state._afterClaim = true;
      state.phase = 'play';
      return;
    }
    state._afterClaim = false;
    const rep = state.wall.pop();
    state.hands[p].push(rep);
    sortHand(state.hands[p]);
    state.drawn = rep.id;
    state._gangShangHua = true; // 杠后补牌，若胡牌则算杠上花
  } else {
    state.drawn = null;
    state._gangShangHua = false;
    state._afterClaim = true; // 吃/碰后没有摸牌，不能自摸或杠
  }
  state.hasDrawn = true;
  state.phase = 'play';
}

// Cantonese scoring wrapper.
//  - fan values come from CANTONESE.fan in the core (清一色 8 etc.); core adds 平胡 = 1
//    when no pattern scores
//  - 自摸 = +1 always stacks on top (counted here, so core is called with selfDraw:false)
function scoreHand(hand, melds, winInfo, selfDraw, wallCount, state, gangShangHua) {
  var result = core.countFanDetailed(hand, melds, winInfo, CANTONESE, {
    selfDraw: false,
    wallCount: wallCount || 0,
  });
  // 自摸 always stacks as +1; plus 海底捞月 if the winning tile is the last one.
  if (selfDraw) {
    if ((wallCount || 0) === 0) { result.details.push({ name: '海底捞', fan: 1 }); result.fan += 1; }
    result.details.push({ name: '自摸', fan: 1 }); result.fan += 1;
  }
  // 杠上花：杠后补牌胡牌
  if (gangShangHua) { result.details.push({ name: '杠上花', fan: 1 }); result.fan += 1; }
  // 封顶
  if (state && state._maxFan && state._maxFan > 0 && result.fan > state._maxFan) {
    result.fan = state._maxFan;
    result.details.push({ name: '封顶', fan: state._maxFan });
  }
  return result;
}

// 供 bot 使用：这手牌（hand 已含自摸牌/点炮牌）按当前规则能不能胡（含起胡番数）。
exports.winAllowed = function (state, hand, melds, selfDraw) {
  const info = core.huCheck(hand, melds, getCfg(state));
  if (!info.win) return false;
  if (!state._minFan || state._minFan <= 0) return true;
  const wallCount = Array.isArray(state.wall) ? state.wall.length : (state.wall || 0);
  return scoreHand(hand, melds, info, selfDraw, wallCount, state, selfDraw && state._gangShangHua).fan >= state._minFan;
};

// 买码：胡牌后从牌尾买牌加分（花牌/字牌每张 +1 番）
function buyTiles(state, winnerIndex) {
  if (!state.wall || state.wall.length === 0) return { tiles: [], bonusFan: 0, details: [] };
  var count = Math.min(4, state.wall.length); // 买 4 张
  var bought = [];
  var bonusFan = 0;
  var details = [];
  for (var i = 0; i < count; i++) {
    var tile = state.wall.pop();
    bought.push(tile);
    if (tile.k === 'feng' || tile.k === 'jian') {
      bonusFan += 1;
      details.push(tile.k === 'feng' ? 'mj_buytile_wind' : 'mj_buytile_jian');
    }
  }
  return { tiles: bought, bonusFan: bonusFan, details: details };
}

// currentActor for bot scheduling: during claim, it's the current responder.
exports.getCurrentActor = function (state) {
  if (state.phase === 'claim' && state.claim) {
    return state.claim.order[state.claim.idx];
  }
  return state.currentPlayer;
};

// server.js skipDisconnectedTurn calls this when the current actor has been gone past the
// reconnect grace: the missing seat makes a minimal automatic move (pass a claim, or discard
// the tile just drawn) so the table never waits on them.
exports.setCurrentActor = function (state) {
  const p = exports.getCurrentActor(state);
  if (!Number.isInteger(p) || p < 0) return;
  if (state.phase === 'claim') {
    exports.handleMove({ type: 'pass' }, state, p);
  } else if (state.phase === 'play' && state.hasDrawn) {
    const hand = state.hands[p] || [];
    const pick = hand.find(t => t.id === state.drawn) || hand[hand.length - 1];
    if (pick) exports.handleMove({ type: 'discard', tileId: pick.id }, state, p);
  }
};

exports.playerView = function (state, playerIndex) {
  return {
    phase: state.phase,
    currentPlayer: state.currentPlayer,
    dealer: state.dealer,
    winner: state.winner,
    winInfo: state.winInfo,
    buyTiles: state.winInfo && state.winInfo.buyTiles ? state.winInfo.buyTiles.map(t => ({ k: t.k, n: t.n, id: t.id })) : null,
    buyFan: state.winInfo ? state.winInfo.buyFan || 0 : 0,
    hasDrawn: state.hasDrawn,
    _afterClaim: state._afterClaim === true, // 吃/碰后没摸牌：不能自摸/杠
    _gangShangHua: state._gangShangHua === true,
    // 刚摸的牌进的是暗手，只能让摸牌者本人看见，否则对手能逐回合还原他的手牌
    drawn: state.currentPlayer === playerIndex ? (state.drawn || null) : null,
    // own hand: full tiles; others: count only
    hands: state.hands.map((h, i) => {
      if (i === playerIndex) return h.map(t => ({ k: t.k, n: t.n, id: t.id }));
      return h.length;
    }),
    melds: state.melds.map(m => m.map(md => ({
      type: md.type, from: md.from, tiles: md.tiles.map(t => ({ k: t.k, n: t.n, id: t.id })),
    }))),
    // _discardSeq 必须一起下发：渲染器靠它把四家的弃牌还原成全局出牌顺序，
    // 丢掉就会退化成按玩家分组堆叠（排序全为 0，sort 成了空操作）
    discards: state.discards.map(d => d.map(t => ({ k: t.k, n: t.n, id: t.id, _discardSeq: t._discardSeq }))),
    wall: state.wall.length, // hide actual wall tiles
    // 统一为扁平 tile 结构（与四川一致）：渲染器按 ld.k/ld.n/ld.id 读取，
    // 广东的 state.lastDiscard 是 { tile, player }，这里展开成扁平 + player 附加字段
    lastDiscard: state.lastDiscard ? { k: state.lastDiscard.tile.k, n: state.lastDiscard.tile.n, id: state.lastDiscard.tile.id, player: state.lastDiscard.player } : null,
    claim: state.claim ? {
      tile: { k: state.claim.tile.k, n: state.claim.tile.n, id: state.claim.tile.id },
      discarder: state.claim.discarder,
      order: state.claim.order.slice(),
      idx: state.claim.idx,
    } : null,
    cumulativeScore: state.cumulativeScore ? state.cumulativeScore.slice() : [0,0,0,0],
    roundNumber: state.roundNumber || 1,
    dealerIndex: state.dealerIndex || 0,
    _playerCount: state._playerCount,
    _buyTiles: state._buyTiles,
    _maxFan: state._maxFan,
    _minFan: state._minFan,
    _wildcard: state._wildcard === true,
  };
};
