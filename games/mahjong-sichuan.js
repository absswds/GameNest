// games/mahjong-sichuan.js
// 四川麻将 (Sichuan Mahjong) — 血战到底, 定缺, 只碰不吃
// Uses the shared mahjong engine (games/lib/mahjong-core.js).

const core = require('./lib/mahjong-core');
const { SICHUAN, buildDeck, huCheck, sortTiles } = core;
const cantonese = require('./mahjong-cantonese');

exports.name = 'mahjong-sichuan';
exports.maxPlayers = 4;
exports.minPlayers = 2;

exports.createState = () => ({
  cfg: SICHUAN,
  deck: [],
  hands: [],
  melds: [],
  discards: [],
  currentPlayer: 0,
  phase: 'deal',
  voidSuit: [],
  drawn: null,
  lastDiscard: null,
  winner: null,
  winners: [],
  guessCount: [],
  _lastDiscardFrom: -1,
  claim: null, // {tile, discarder, order, idx, responses}
  _gangDraw: -1, // 刚杠后补牌的座位（杠上花）
  _noDraw: false, // 碰牌后无摸牌：不能自摸/杠
  _winMeta: {}, // 胡牌时的牌墙数/杠上花
  _exhausted: false, // 牌墙摸完流局
  _variants: 'sichuan',
  _winSelfDraw: {},
  _winFrom: {}, // winner seat -> discarder seat (-1 = self-draw), for zero-sum settlement
  // Rule flags (read from state._options in initGame)
  _bloodBattle: true,
  _rain: false,
  _multiWinner: false,
  _checkFlowerPig: false,
  _checkBigCall: false,
  _lastFourAutoWin: false,
  _swapThree: false,
  // Gang payment tracking: net points per player from 刮风下雨
  _gangScore: [],
  // Round-end penalty tracking (花猪/查大叫)
  _penalties: [],
});

// Unified entry: room.game stays 'mahjong-sichuan', but the actual ruleset is
// chosen via state._options.mahjongMode (injected by server applyRuntimeState).
// mode === 'cantonese' → rebuild the state object in place (keep the reference)
// into the Cantonese structure; otherwise run the default Sichuan setup.
exports.initGame = function (state, playerCount) {
  const mode = state._options && state._options.mahjongMode;
  if (mode === 'cantonese') {
    switchToCantonese(state, playerCount);
    return;
  }

  // Read Sichuan rule toggles from options (default: blood battle on, others off)
  const opt = state._options || {};
  state._bloodBattle = opt.mj_bloodBattle !== false; // default true
  state._rain = opt.mj_rain === true;
  state._multiWinner = opt.mj_multiWinner === true;
  state._checkFlowerPig = opt.mj_checkFlowerPig === true;
  state._checkBigCall = opt.mj_checkBigCall === true;
  state._lastFourAutoWin = opt.mj_lastFourAutoWin === true;
  state._swapThree = opt.mj_swapThree === true;

  // Server writes the next dealer into state.dealerIndex before initGame. Use it
  // for the extra tile and the starting player; fall back to 0 so the first
  // round and any path that does not set it stays unchanged.
  const dealer = state.dealerIndex || 0;

  const deck = buildDeck(SICHUAN);
  state.deck = deck;
  state.hands = [];
  state.melds = [];
  state.discards = [];
  state.voidSuit = new Array(playerCount).fill(undefined);
  state.winners = [];
  state.winner = null;
  state.drawn = null;
  state.lastDiscard = null;
  state._lastDiscardFrom = -1;
  state.claim = null;
  state._gangDraw = -1;
  state._noDraw = false;
  state._winMeta = {};
  state._exhausted = false;
  state.guessCount = new Array(playerCount).fill(0);
  state._winSelfDraw = {};
  state._winFrom = {};
  state._gangScore = new Array(playerCount).fill(0);
  state._penalties = new Array(playerCount).fill(0);
  state.currentPlayer = dealer;

  const hands = [];
  for (let i = 0; i < playerCount; i++) hands.push([]);
  // Deal round-robin: 13 each
  for (let r = 0; r < 13; r++) {
    for (let i = 0; i < playerCount; i++) {
      hands[i].push(deck.pop());
    }
  }
  // Dealer gets the 14th tile
  hands[dealer].push(deck.pop());

  for (let i = 0; i < playerCount; i++) {
    sortTiles(hands[i]);
    state.hands.push(hands[i]);
    state.melds.push([]);
    state.discards.push([]);
  }

  // 换三张：在定缺前增加换牌阶段
  state.phase = state._swapThree ? 'swap' : 'void';
  state._swapThree = !!state._swapThree;
  state._swapSelections = new Array(playerCount).fill(null); // 每家选的牌 id
  state._variants = 'sichuan';
};

// Rebuild `state` in place into the Cantonese structure. Cannot reassign the
// reference (server holds room.state), so we clear all keys then copy the
// Cantonese createState()/initGame() output. Runtime meta-fields injected by
// applyRuntimeState (_options/_realPlayerCount/_hasBots/_lang) are preserved so
// server logic that reads them later keeps working.
function switchToCantonese(state, playerCount) {
  const options = state._options;
  const realPlayerCount = state._realPlayerCount;
  const hasBots = state._hasBots;
  const lang = state._lang;
  // 多局累计字段：server 在 game_restart 时先于 initGame 写回 cumulativeScore/
  // dealerIndex/roundNumber，若这里一并清空就白写了。必须保留到 initGame 之后。
  const cumulativeScore = state.cumulativeScore;
  const dealerIndex = state.dealerIndex;
  const roundNumber = state.roundNumber;
  for (const k in state) delete state[k];
  Object.assign(state, cantonese.createState());
  if (options !== undefined) state._options = options;
  if (realPlayerCount !== undefined) state._realPlayerCount = realPlayerCount;
  if (hasBots !== undefined) state._hasBots = hasBots;
  if (lang !== undefined) state._lang = lang;
  if (cumulativeScore) state.cumulativeScore = cumulativeScore;
  if (dealerIndex !== undefined) state.dealerIndex = dealerIndex;
  if (roundNumber) state.roundNumber = roundNumber;
  cantonese.initGame(state, playerCount);
  state._variants = 'cantonese';
}

function validSuits() {
  return SICHUAN.suits || ['wan', 'tong', 'tiao'];
}

function findTileIndex(hand, tileId) {
  for (let i = 0; i < hand.length; i++) {
    if (hand[i].id === tileId) return i;
  }
  return -1;
}

// Count tiles of a given suit in a hand
function countSuit(hand, suit) {
  let c = 0;
  for (const t of hand) if (t.k === suit) c++;
  return c;
}

// Count tiles equal to `tile` (same suit and number) in a hand
function countSame(hand, tile) {
  let c = 0;
  for (const t of hand) if (t.k === tile.k && t.n === tile.n) c++;
  return c;
}

// 换三张：4 人与对家换（0↔2, 1↔3）；2 人互换；3 人按座位顺序轮转（i → i+1）
function swapTarget(i, playerCount) {
  return playerCount === 4 ? (i + 2) % 4 : (i + 1) % playerCount;
}

function executeSwap(state, playerCount) {
  // 先把每家选的牌全部取出，再统一发给目标座位（避免 3 人轮转时先发后取）
  const taken = [];
  for (let i = 0; i < playerCount; i++) {
    const sel = state._swapSelections[i] || [];
    const tiles = [];
    for (const id of sel) {
      const idx = findTileIndex(state.hands[i], id);
      if (idx >= 0) tiles.push(state.hands[i].splice(idx, 1)[0]);
    }
    taken.push(tiles);
  }
  for (let i = 0; i < playerCount; i++) {
    const to = swapTarget(i, playerCount);
    state.hands[to].push(...taken[i]);
  }
  for (let i = 0; i < playerCount; i++) sortTiles(state.hands[i]);
  state._swapSelections = [];
}

// After void chosen by all: dealer begins play, already holding 14.
function startPlayAfterVoid(state) {
  state.phase = 'play';
  state.currentPlayer = state.dealerIndex || 0;
  state.drawn = null;
}

// Advance to next non-winner player's turn: draw a tile, enter play phase.
function advanceTurn(state, playerCount) {
  let next = (state.currentPlayer + 1) % playerCount;
  let guard = 0;
  while (state.winners.includes(next) && guard < playerCount) {
    next = (next + 1) % playerCount;
    guard++;
  }
  if (state.deck.length === 0) {
    // pool empty -> game over (流局：此时才查花猪/查大叫)
    state.phase = 'over';
    state._exhausted = true;
    state.claim = null;
    return false;
  }
  const tile = state.deck.pop();
  state.hands[next].push(tile);
  sortTiles(state.hands[next]);
  state.drawn = tile.id;
  state.currentPlayer = next;
  state.phase = 'play';
  state.lastDiscard = null;
  state._lastDiscardFrom = -1;
  state.claim = null;
  state._noDraw = false; // 正常摸牌：可以自摸/暗杠
  state._gangDraw = -1;  // 普通摸牌不算杠上花
  return true;
}

// Check whether player has discarded all void-suit tiles (required to win)
function voidSatisfied(state, playerIndex) {
  const vs = state.voidSuit[playerIndex];
  if (!vs) return true; // no void chosen yet (shouldn't happen pre-win)
  return countSuit(state.hands[playerIndex], vs) === 0;
}

function checkWin(state, playerIndex, extraTile) {
  const hand = state.hands[playerIndex];
  const tiles = extraTile ? hand.concat([extraTile]) : hand;
  const res = huCheck(tiles, state.melds[playerIndex], SICHUAN);
  return res && res.win ? res : null;
}

function canWinOn(state, playerIndex, tile) {
  return voidSatisfied(state, playerIndex) && !!checkWin(state, playerIndex, tile);
}

// ---- Claim phase (出牌后的响应) ----
// 与广东一致：state.claim = { tile, discarder, order, idx, responses }。
//  - order：有资格响应的座位（不含出牌者、已胡玩家），能胡的排在前面，其余按出牌者之后的座次；
//  - 按 order 依次响应，responses[座位] 记录 pass/win/pung/kong；
//  - 全部响应完（或结果已无悬念）后统一结算，优先级 胡 > 杠 > 碰。
function startClaim(state, discarder, tile) {
  const n = state.hands.length;
  const cands = [];
  const responses = {};
  for (let step = 1; step < n; step++) {
    const p = (discarder + step) % n;
    if (state.winners.includes(p)) continue;
    const win = canWinOn(state, p, tile);
    // 最后四张自动胡：牌墙剩 4 张及以下时，能胡就直接记为胡，不允许放过
    if (win && state._lastFourAutoWin && state.deck.length <= 4) {
      responses[p] = { type: 'win' };
      continue;
    }
    if (win || countSame(state.hands[p], tile) >= 2) cands.push({ p, win });
  }
  cands.sort((a, b) => (b.win ? 1 : 0) - (a.win ? 1 : 0));
  state.phase = 'claim';
  state.claim = { tile, discarder, order: cands.map(c => c.p), idx: 0, responses };
  if (state.claim.order.length === 0 || canResolveEarly(state)) resolveClaim(state);
}

// 剩余响应者不可能改变结果时可以提前结算
function canResolveEarly(state) {
  const claim = state.claim;
  const rs = Object.keys(claim.responses).map(p => claim.responses[p]);
  const anyWinLeft = claim.order.slice(claim.idx).some(p => canWinOn(state, p, claim.tile));
  if (rs.some(r => r.type === 'win')) return !state._multiWinner || !anyWinLeft;
  if (anyWinLeft) return false;
  return rs.some(r => r.type === 'kong' || r.type === 'pung');
}

function respondClaim(state, playerIndex, resp) {
  const claim = state.claim;
  claim.responses[playerIndex] = resp;
  claim.idx++;
  if (claim.idx >= claim.order.length || canResolveEarly(state)) resolveClaim(state);
}

function recordWin(state, playerIndex, from, selfDraw) {
  if (!state.winners.includes(playerIndex)) state.winners.push(playerIndex);
  state._winSelfDraw[playerIndex] = selfDraw;
  state._winFrom[playerIndex] = selfDraw ? -1 : from;
  // 胡牌这一刻的牌墙数/杠上花：结算在局末才算，必须在这里记下
  state._winMeta[playerIndex] = {
    wallCount: state.deck.length,
    gangShangHua: selfDraw && state._gangDraw === playerIndex,
  };
}

// 胡牌之后：非血战直接结束；血战则 3 家胡/牌墙摸完结束，否则由下一家摸牌继续
function afterWin(state, nextFrom) {
  const n = state.hands.length;
  state.claim = null;
  if (!state._bloodBattle) {
    state.phase = 'over';
    return;
  }
  if (state.winners.length >= n - 1 || state.deck.length === 0) {
    state.phase = 'over';
    if (state.deck.length === 0) state._exhausted = true;
    return;
  }
  state.currentPlayer = nextFrom;
  advanceTurn(state, n);
}

function resolveClaim(state) {
  const claim = state.claim;
  const tile = claim.tile;
  const from = claim.discarder;
  const n = state.hands.length;
  state.claim = null;

  const dist = (p) => (p - from + n) % n;
  const seats = Object.keys(claim.responses).map(Number).sort((a, b) => dist(a) - dist(b));
  const wins = seats.filter(p => claim.responses[p].type === 'win');

  if (wins.length > 0) {
    // 点炮胡：一炮多响时所有响应胡的玩家都胡，否则只有离出牌者最近的一家
    const takers = state._multiWinner ? wins : wins.slice(0, 1);
    removeDiscard(state, from, tile.id); // 必须先于 afterWin（afterWin 会重置 _lastDiscardFrom）
    for (const p of takers) {
      // 把胡牌张加入手牌，保证计分（清一色/七对等）基于完整14张
      state.hands[p].push({ k: tile.k, n: tile.n, id: tile.id });
      sortTiles(state.hands[p]);
      recordWin(state, p, from, false);
    }
    state.lastDiscard = null;
    afterWin(state, state._multiWinner ? from : takers[0]);
    return;
  }

  // 杠 > 碰；同级按离出牌者的座次
  const pick = (type) => seats.find(p => claim.responses[p].type === type);
  const kongP = pick('kong');
  const pungP = pick('pung');
  const p = kongP !== undefined ? kongP : pungP;
  if (p === undefined) {
    // 全部放过：下一家摸牌
    advanceTurn(state, n);
    return;
  }

  removeDiscard(state, from, tile.id);
  state.currentPlayer = p;
  state.lastDiscard = null;
  state.drawn = null;
  state._lastDiscardFrom = -1;
  if (p === kongP) {
    removeTileFromHand(state, p, tile.k, tile.n);
    removeTileFromHand(state, p, tile.k, tile.n);
    removeTileFromHand(state, p, tile.k, tile.n);
    state.melds[p].push({ type: 'kong', tile: { k: tile.k, n: tile.n }, tiles: [tile], from });
    // 刮风下雨：直杠（点杠）收引杠者 2 分
    if (state._rain && from >= 0 && from !== p) {
      state._gangScore[p] = (state._gangScore[p] || 0) + 2;
      state._gangScore[from] = (state._gangScore[from] || 0) - 2;
    }
    drawReplacement(state, p);
  } else {
    removeTileFromHand(state, p, tile.k, tile.n);
    removeTileFromHand(state, p, tile.k, tile.n);
    state.melds[p].push({ type: 'pung', tile: { k: tile.k, n: tile.n }, tiles: [tile] });
    state._noDraw = true; // 碰牌后没有摸牌，不能“自摸”
    state._gangDraw = -1;
  }
  state.phase = 'play';
}

// 杠后补牌；补牌后若胡牌算杠上花。牌墙已空则没有补牌，也不能自摸。
function drawReplacement(state, p) {
  if (state.deck.length > 0) {
    const rep = state.deck.pop();
    state.hands[p].push(rep);
    sortTiles(state.hands[p]);
    state.drawn = rep.id;
    state._noDraw = false;
    state._gangDraw = p;
  } else {
    state._noDraw = true;
    state._gangDraw = -1;
  }
}

exports.handleMove = function (data, state, playerIndex) {
  if (state._variants === 'cantonese') return cantonese.handleMove(data, state, playerIndex);

  const playerCount = state.hands.length;

  if (!data || !data.type) return 'g_bad_move';

  // ---- Swap phase (换三张) ----
  if (state.phase === 'swap') {
    if (data.type !== 'swap') return 'mj_choose_swap';
    if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';
    const tileIds = data.tileIds;
    if (!Array.isArray(tileIds) || tileIds.length !== 3) return 'mj_bad_swap';
    // 三张必须互不相同
    if (new Set(tileIds).size !== 3) return 'mj_bad_swap';
    // 验证3张牌都在手中且同一花色
    const hand = state.hands[playerIndex];
    const suitCounts = {};
    for (const id of tileIds) {
      const idx = findTileIndex(hand, id);
      if (idx < 0) return 'mj_bad_swap';
      const tile = hand[idx];
      if (tile.k === 'feng' || tile.k === 'jian') return 'mj_bad_swap';
      suitCounts[tile.k] = (suitCounts[tile.k] || 0) + 1;
    }
    // 必须同一花色
    if (Object.keys(suitCounts).length !== 1) return 'mj_bad_swap';
    state._swapSelections[playerIndex] = tileIds;
    // 所有玩家都选完 → 执行交换
    if (state._swapSelections.every(s => s !== null)) {
      executeSwap(state, playerCount);
      state.phase = 'void';
    } else {
      // 轮到下一家
      let next = (playerIndex + 1) % playerCount;
      while (state._swapSelections[next] !== null) {
        next = (next + 1) % playerCount;
      }
      state.currentPlayer = next;
    }
    return null;
  }

  // ---- Void phase ----
  if (state.phase === 'void') {
    if (data.type !== 'void') return 'mj_choose_void';
    if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';
    const suit = data.suit;
    if (!validSuits().includes(suit)) return 'mj_bad_void_suit';
    state.voidSuit[playerIndex] = suit;
    // If all players have chosen, start play; otherwise advance to next unchosen.
    if (state.voidSuit.every(v => v !== undefined)) {
      startPlayAfterVoid(state);
    } else {
      let next = (playerIndex + 1) % playerCount;
      while (state.voidSuit[next] !== undefined) {
        next = (next + 1) % playerCount;
      }
      state.currentPlayer = next;
    }
    return null;
  }

  // ---- Claim phase (after a discard) ----
  if (state.phase === 'claim') {
    const claim = state.claim;
    if (!claim) return 'g_bad_move';
    // 只有轮到的响应者能操作（出牌者、已胡玩家、没有资格的玩家都不在 order 里）
    if (claim.order[claim.idx] !== playerIndex) return 'g_not_your_turn';
    const tile = claim.tile;

    if (data.type === 'pass') {
      respondClaim(state, playerIndex, { type: 'pass' });
      return null;
    }

    if (data.type === 'win') {
      if (!voidSatisfied(state, playerIndex)) return 'mj_void_not_satisfied';
      if (!checkWin(state, playerIndex, tile)) return 'mj_not_winning';
      respondClaim(state, playerIndex, { type: 'win' });
      return null;
    }

    if (data.type === 'pung') {
      if (countSame(state.hands[playerIndex], tile) < 2) return 'mj_cannot_pung';
      respondClaim(state, playerIndex, { type: 'pung' });
      return null;
    }

    if (data.type === 'kong') {
      if (countSame(state.hands[playerIndex], tile) < 3) return 'mj_cannot_kong';
      respondClaim(state, playerIndex, { type: 'kong' });
      return null;
    }

    return 'mj_bad_claim';
  }

  // ---- Play phase (current player must discard) ----
  if (state.phase === 'play') {
    if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';

    if (data.type === 'win') {
      // Self-draw (自摸): winning hand already in hand. 碰牌后没摸牌，不能胡。
      if (state._noDraw) return 'mj_not_winning';
      if (!voidSatisfied(state, playerIndex)) return 'mj_void_not_satisfied';
      const info = checkWin(state, playerIndex, null);
      if (!info) return 'mj_not_winning';
      recordWin(state, playerIndex, -1, true);
      afterWin(state, playerIndex);
      return null;
    }

    // 暗杠（下雨）：手中有4张相同牌，在自己回合杠出
    if (data.type === 'selfkong') {
      if (state._noDraw) return 'mj_cannot_kong';
      if (!core.doSelfKong(state.hands[playerIndex], state.melds[playerIndex], data.suit, data.num, playerIndex)) {
        return 'mj_cannot_kong';
      }
      // 刮风下雨：暗杠收所有未胡者 2 分
      if (state._rain) {
        for (let p = 0; p < state.hands.length; p++) {
          if (p !== playerIndex && !state.winners.includes(p)) {
            state._gangScore[playerIndex] = (state._gangScore[playerIndex] || 0) + 2;
            state._gangScore[p] = (state._gangScore[p] || 0) - 2;
          }
        }
      }
      drawReplacement(state, playerIndex);
      state.phase = 'play';
      state.lastDiscard = null;
      return null;
    }

    // 补杠（加杠）：已碰的刻子，摸到第 4 张时升级成杠并补牌
    if (data.type === 'addkong') {
      if (state._noDraw) return 'mj_cannot_kong';
      if (!core.doAddKong(state.hands[playerIndex], state.melds[playerIndex], data.suit, data.num)) {
        return 'mj_cannot_kong';
      }
      // 刮风下雨：补杠（加杠）收所有未胡者 1 分
      if (state._rain) {
        for (let p = 0; p < state.hands.length; p++) {
          if (p !== playerIndex && !state.winners.includes(p)) {
            state._gangScore[playerIndex] = (state._gangScore[playerIndex] || 0) + 1;
            state._gangScore[p] = (state._gangScore[p] || 0) - 1;
          }
        }
      }
      drawReplacement(state, playerIndex);
      state.phase = 'play';
      state.lastDiscard = null;
      return null;
    }

    if (data.type === 'discard') {
      const tileId = data.tileId;
      const idx = findTileIndex(state.hands[playerIndex], tileId);
      if (idx < 0) return 'mj_tile_not_in_hand';
      const tile = state.hands[playerIndex].splice(idx, 1)[0];
      tile._discardSeq = (state._discardCounter || 0);
      state._discardCounter = (state._discardCounter || 0) + 1;
      state.discards[playerIndex].push(tile);
      state.lastDiscard = tile;
      state._lastDiscardFrom = playerIndex;
      state.drawn = null;
      state._noDraw = false;
      state._gangDraw = -1;
      // Enter claim phase: other players may pung/kong/win (no eligible player → next draw)
      startClaim(state, playerIndex, tile);
      return null;
    }

    return 'mj_must_discard';
  }

  if (state.phase === 'over') return 'g_game_over';

  return 'g_bad_move';
};

function removeTileFromHand(state, playerIndex, suit, num) {
  const hand = state.hands[playerIndex];
  for (let i = 0; i < hand.length; i++) {
    if (hand[i].k === suit && hand[i].n === num) {
      hand.splice(i, 1);
      return true;
    }
  }
  return false;
}

function removeDiscard(state, playerIndex, tileId) {
  if (playerIndex < 0) return;
  const pile = state.discards[playerIndex];
  for (let i = 0; i < pile.length; i++) {
    if (pile[i].id === tileId) { pile.splice(i, 1); return; }
  }
}

// 暗杠不公开牌面：对其他玩家去掉 tile（广东的 playerView 同样不下发）
function viewMelds(state, playerIndex) {
  return state.melds.map((ms, seat) => ms.map(m => {
    if (seat === playerIndex || !(m.type === 'kong' && m.tiles.length === 0)) return m;
    return { type: m.type, from: m.from, tiles: [], concealed: true };
  }));
}

// Per-player view: hide opponent hand tiles (show count only); reveal melds/discards/void/winners.
exports.playerView = function (state, playerIndex) {
  if (state._variants === 'cantonese') return cantonese.playerView(state, playerIndex);

  const hands = state.hands.map((hand, i) => {
    if (i === playerIndex) return hand;
    // hidden: array of placeholder tiles (count preserved)
    return hand.map(() => ({ k: undefined, n: undefined, id: undefined }));
  });
  return {
    cfg: state.cfg,
    hands,
    melds: viewMelds(state, playerIndex),
    discards: state.discards,
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    voidSuit: state.voidSuit,
    // 刚摸的牌进的是暗手，只能让摸牌者本人看见，否则对手能逐回合还原他的手牌
    drawn: state.currentPlayer === playerIndex ? state.drawn : null,
    lastDiscard: state.lastDiscard,
    _noDraw: state._noDraw === true, // 碰牌后没摸牌：不能自摸/杠
    // 响应窗口：渲染器按 claim.order[idx] 判断轮到谁（只下发座位，不下发别人的响应内容）
    claim: state.claim ? {
      tile: { k: state.claim.tile.k, n: state.claim.tile.n, id: state.claim.tile.id },
      discarder: state.claim.discarder,
      order: state.claim.order.slice(),
      idx: state.claim.idx,
    } : null,
    winner: state.winner,
    winners: state.winners,
    guessCount: state.guessCount,
    deckCount: state.deck.length,
    cumulativeScore: state.cumulativeScore ? state.cumulativeScore.slice() : [0,0,0,0],
    roundNumber: state.roundNumber || 1,
    dealerIndex: state.dealerIndex || 0,
    _bloodBattle: state._bloodBattle,
    _rain: state._rain,
    _multiWinner: state._multiWinner,
    _checkFlowerPig: state._checkFlowerPig,
    _checkBigCall: state._checkBigCall,
    _lastFourAutoWin: state._lastFourAutoWin,
    _swapThree: state._swapThree,
    _gangScore: state._gangScore,
    _penalties: state._penalties,
  };
};

// Current actor for bot scheduling. Cantonese exposes its own; Sichuan during the
// claim phase is the seat whose response is pending (works on a playerView too).
exports.getCurrentActor = function (state) {
  if (state._variants === 'cantonese') return cantonese.getCurrentActor(state);
  if (state.phase === 'claim' && state.claim) return state.claim.order[state.claim.idx];
  return state.currentPlayer;
};

// server.js skipDisconnectedTurn calls this when the current actor has been gone past the
// reconnect grace. Re-pointing currentPlayer at someone else is wrong for every phase
// (they would act without drawing / the claim window would be skewed), so instead the
// missing seat makes a minimal automatic move: swap / void choice, discard, or pass.
exports.setCurrentActor = function (state) {
  if (state._variants === 'cantonese') return cantonese.setCurrentActor(state);
  const p = exports.getCurrentActor(state);
  if (!Number.isInteger(p) || p < 0) return;
  const hand = state.hands[p] || [];
  const suits = validSuits();
  let move = null;
  if (state.phase === 'swap') {
    const suit = suits.slice().sort((a, b) => countSuit(hand, b) - countSuit(hand, a))[0];
    move = { type: 'swap', tileIds: hand.filter(t => t.k === suit).slice(0, 3).map(t => t.id) };
  } else if (state.phase === 'void') {
    move = { type: 'void', suit: suits.slice().sort((a, b) => countSuit(hand, a) - countSuit(hand, b))[0] };
  } else if (state.phase === 'claim') {
    move = { type: 'pass' };
  } else if (state.phase === 'play' && hand.length) {
    const vs = state.voidSuit[p];
    const pick = hand.find(t => t.k === vs) || hand.find(t => t.id === state.drawn) || hand[hand.length - 1];
    move = { type: 'discard', tileId: pick.id };
  }
  if (move) exports.handleMove(move, state, p);
};

// ---- Scoring (四川麻将完整番种) ----

function countGens(hand) {
  // 根：手中有4张相同的牌（未杠出来的）
  var counts = {};
  for (var i = 0; i < hand.length; i++) {
    var key = hand[i].k + ':' + hand[i].n;
    counts[key] = (counts[key] || 0) + 1;
  }
  var gens = 0;
  for (var k in counts) if (counts[k] === 4) gens++;
  return gens;
}

function calculateScore(state, winnerIndex) {
  var hand = state.hands[winnerIndex];
  var melds = state.melds[winnerIndex];
  var winInfo = core.huCheck(hand, melds, SICHUAN);
  // 自摸：仅在摸牌时胡牌记一分。点炮（接炮）不记自摸分。
  var isSelfDraw = !!state._winSelfDraw[winnerIndex];
  // 海底捞/杠上花取胡牌那一刻的状态（recordWin 记录），不能用局末的牌墙数
  var meta = (state._winMeta && state._winMeta[winnerIndex]) || {};

  var result = core.countFanDetailed(hand, melds, winInfo, SICHUAN, {
    selfDraw: isSelfDraw,
    wallCount: meta.wallCount !== undefined ? meta.wallCount : state.deck.length,
    gangShangHua: !!meta.gangShangHua,
  });

  // 刮风/杠加分
  var gangFan = 0;
  for (var m = 0; m < melds.length; m++) {
    if (melds[m].type === 'kong') {
      gangFan += melds[m].from !== undefined ? 3 : 2;
    }
  }
  if (gangFan > 0) result.details.push({ name: '杠', fan: gangFan });
  result.fan += gangFan;

  // 根
  var genFan = countGens(hand);
  if (genFan > 0) {
    result.details.push({ name: '根', fan: genFan });
    result.fan += genFan;
  }

  return result;
}

exports.calculateScore = calculateScore;

// 听牌：手牌 3n+1 张（n = 4 - 副露数）时再摸一张能胡；多一张（3n+2）时看是否有一种打法能听牌。
function isReady(state, i) {
  const hand = state.hands[i];
  const melds = state.melds[i];
  const vs = state.voidSuit[i];
  if (vs && hand.some(t => t.k === vs)) return false; // 缺门还没打完
  const base = 13 - 3 * melds.length; // hands[i] 只含暗手，副露不在里面
  if (hand.length === base) return core.isTenpai(hand, melds, SICHUAN, vs);
  if (hand.length === base + 1) {
    return hand.some((t, idx) => core.isTenpai(hand.filter((_, j) => j !== idx), melds, SICHUAN, vs));
  }
  return true; // 张数异常（如杠后无牌可补）：不判未听
}

// 流局查花猪/查大叫：计算每个未胡玩家的罚分。只在牌墙摸完的流局时才查，
// 有人胡牌就结束的非血战局不查。
// 返回 { penalties: [...], details: [{player, type, amount, to}] }
exports.calculatePenalties = function (state) {
  const playerCount = state.hands.length;
  const penalties = new Array(playerCount).fill(0);
  const details = [];
  if (!state._exhausted) return { penalties, details };
  if (!state._rain && !state._checkFlowerPig && !state._checkBigCall) return { penalties, details };

  // 查花猪：手里还有缺门花色的玩家
  const flowerPigs = [];
  if (state._checkFlowerPig || state._rain) {
    for (let i = 0; i < playerCount; i++) {
      if (state.winners.includes(i)) continue;
      const vs = state.voidSuit[i];
      if (!vs) continue;
      const hasVoid = state.hands[i].some(t => t.k === vs);
      if (hasVoid) flowerPigs.push(i);
    }
  }

  // 查大叫：未听牌的玩家
  const notReady = [];
  if (state._checkBigCall || state._rain) {
    for (let i = 0; i < playerCount; i++) {
      if (state.winners.includes(i)) continue;
      if (!isReady(state, i)) notReady.push(i);
    }
  }

  // 花猪赔给每个非花猪未胡玩家 8 分（零和：花猪付出的 = 各家收到的）
  if (flowerPigs.length > 0) {
    const nonPigs = [];
    for (let i = 0; i < playerCount; i++) {
      if (!state.winners.includes(i) && !flowerPigs.includes(i)) nonPigs.push(i);
    }
    for (const pig of flowerPigs) {
      for (const np of nonPigs) {
        penalties[pig] -= 8;
        penalties[np] += 8;
        details.push({ player: pig, type: '花猪', amount: 8, to: np });
      }
    }
  }

  // 未听牌赔给每个听牌玩家 4 分
  if (notReady.length > 0) {
    const ready = [];
    for (let i = 0; i < playerCount; i++) {
      if (state.winners.includes(i) || notReady.includes(i)) continue;
      ready.push(i);
    }
    for (const nr of notReady) {
      for (const r of ready) {
        penalties[nr] -= 4;
        penalties[r] += 4;
        details.push({ player: nr, type: '大叫', amount: 4, to: r });
      }
    }
  }

  return { penalties, details };
};
