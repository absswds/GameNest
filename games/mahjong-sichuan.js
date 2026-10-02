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
  _claimPending: 0,
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
  state._claimPending = 0;
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

// 换三张：与对家交换（0↔2, 1↔3）
function executeSwap(state, playerCount) {
  const partner = (i) => (i + 2) % playerCount; // 对家
  for (let i = 0; i < playerCount; i++) {
    const p = partner(i);
    if (i >= p) continue; // 只处理一次
    const selI = state._swapSelections[i] || [];
    const selP = state._swapSelections[p] || [];
    if (selI.length !== 3 || selP.length !== 3) continue;
    // 从手牌取出牌对象
    const tilesI = [];
    const tilesP = [];
    for (const id of selI) {
      const idx = findTileIndex(state.hands[i], id);
      if (idx >= 0) tilesI.push(state.hands[i].splice(idx, 1)[0]);
    }
    for (const id of selP) {
      const idx = findTileIndex(state.hands[p], id);
      if (idx >= 0) tilesP.push(state.hands[p].splice(idx, 1)[0]);
    }
    // 交换
    state.hands[i].push(...tilesP);
    state.hands[p].push(...tilesI);
    sortTiles(state.hands[i]);
    sortTiles(state.hands[p]);
  }
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
    // pool empty -> game over
    state.phase = 'over';
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

// 一炮多响收尾：所有玩家响应完毕后，移除弃牌并推进
function finishMultiWinnerClaim(state, playerCount) {
  // 移除被胡的弃牌（只移除一张，即使多家胡）
  removeDiscard(state, state._lastDiscardFrom, state.lastDiscard ? state.lastDiscard.id : null);
  state._multiWinClaimants = [];
  // 3 家已胡 → 游戏结束，无需再推进（否则 advanceTurn 在 claim 阶段死循环）
  if (state.winners.length >= 3) {
    state.phase = 'over';
    return;
  }
  // 推进：血战模式继续，非血战则已结束（registerWin 已设 over）
  if (state.phase === 'claim') {
    if (state.winners.length > 0 && state.deck.length === 0) {
      state.phase = 'over';
    } else if (!advanceTurn(state, playerCount)) {
      // deck empty → over
    }
  }
}

function registerWin(state, playerIndex) {
  if (!state.winners.includes(playerIndex)) state.winners.push(playerIndex);
  if (!state._winFrom) state._winFrom = {};
  state._winFrom[playerIndex] = state._winSelfDraw[playerIndex] ? -1 : state._lastDiscardFrom;
  // 一炮多响模式：不立即推进，等所有玩家响应完毕
  if (state._multiWinner) {
    // 自摸胡：无点炮者，无法进入 claim 等待响应，直接走血战分支推进
    if (state._winSelfDraw[playerIndex]) {
      if (!state._bloodBattle) {
        state.phase = 'over';
        return;
      }
      if (state.winners.length >= 3 || state.deck.length === 0) {
        state.phase = 'over';
      } else {
        state.currentPlayer = playerIndex;
        advanceTurn(state, state.hands.length);
      }
      return;
    }
    // 点炮胡：仅记录赢家，phase 推进由 finishMultiWinnerClaim 处理
    // 但如果非血战模式，最后一家胡了就直接结束
    if (!state._bloodBattle) {
      state.phase = 'over';
    }
    return;
  }
  // Non-blood-battle: one win ends the round immediately
  if (!state._bloodBattle) {
    state.phase = 'over';
    return;
  }
  // Blood battle: continue until 3 winners or deck empty
  if (state.winners.length >= 3 || state.deck.length === 0) {
    state.phase = 'over';
  } else {
    // 血战到底: 继续游戏。从胡牌者下一家开始，由下一家摸牌出牌。
    // 把 currentPlayer 设为胡牌家，advanceTurn 会跳过已胡牌的玩家。
    state.currentPlayer = playerIndex;
    advanceTurn(state, state.hands.length);
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
    // 验证3张牌都在手中且同一花色
    const hand = state.hands[playerIndex];
    const tilesToSwap = [];
    const suitCounts = {};
    for (const id of tileIds) {
      const idx = findTileIndex(hand, id);
      if (idx < 0) return 'mj_bad_swap';
      const tile = hand[idx];
      if (tile.k === 'feng' || tile.k === 'jian') return 'mj_bad_swap';
      tilesToSwap.push(tile);
      suitCounts[tile.k] = (suitCounts[tile.k] || 0) + 1;
    }
    // 必须同一花色
    if (Object.keys(suitCounts).length !== 1) return 'mj_bad_swap';
    state._swapSelections[playerIndex] = tileIds;
    // 所有玩家都选完 → 执行交换（与对家换）
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
    const ld = state.lastDiscard;
    if (!ld) { state.phase = 'play'; }

    if (data.type === 'pass') {
      // 最后四张自动胡：牌墙剩4张时，能胡不能过
      if (state._lastFourAutoWin && state.deck.length <= 4 && ld) {
        if (voidSatisfied(state, playerIndex) && checkWin(state, playerIndex, ld)) {
          return 'mj_last_four_must_win';
        }
      }
      state._claimPending = Math.max(0, state._claimPending - 1);
      if (state._claimPending <= 0) {
        // 一炮多响收尾：移除弃牌并推进
        if (state._multiWinner && state._multiWinClaimants && state._multiWinClaimants.length > 0) {
          finishMultiWinnerClaim(state, playerCount);
        } else if (state.winners.length > 0 && state.deck.length === 0) {
          state.phase = 'over';
        } else if (!advanceTurn(state, playerCount)) {
          return null;
        }
      }
      return null;
    }

    if (data.type === 'win') {
      // Win by discard (点炮): the claimant takes ld as winning tile
      if (!voidSatisfied(state, playerIndex)) return 'mj_void_not_satisfied';
      const info = checkWin(state, playerIndex, ld);
      if (!info) return 'mj_not_winning';
      // 把胡牌张加入手牌，保证计分（清一色/七对等）基于完整14张
      state.hands[playerIndex].push({ k: ld.k, n: ld.n, id: ld.id });
      sortTiles(state.hands[playerIndex]);
      state._winSelfDraw[playerIndex] = false;
      registerWin(state, playerIndex);

      if (state._multiWinner) {
        // 一炮多响: 不立即移除弃牌，允许其他玩家也胡这张牌
        state._claimPending = Math.max(0, state._claimPending - 1);
        // 记录已胡的玩家（用于后续移除弃牌）
        state._multiWinClaimants = state._multiWinClaimants || [];
        state._multiWinClaimants.push(playerIndex);
        if (state._claimPending <= 0) {
          // 所有玩家都已响应，移除弃牌并继续
          finishMultiWinnerClaim(state, playerCount);
        }
      } else {
        // 标准模式：移除弃牌，结束 claim 阶段
        removeDiscard(state, state._lastDiscardFrom, ld.id);
      }
      return null;
    }

    if (data.type === 'pung') {
      if (!canPung(state, playerIndex)) return 'mj_cannot_pung';
      // remove 2 matching tiles from hand, form meld, take discard
      const suit = ld.k, num = ld.n;
      removeTileFromHand(state, playerIndex, suit, num);
      removeTileFromHand(state, playerIndex, suit, num);
      removeDiscard(state, state._lastDiscardFrom, ld.id);
      state.melds[playerIndex].push({ type: 'pung', tile: { k: suit, n: num }, tiles: [ld] });
      state.currentPlayer = playerIndex;
      state.phase = 'play';
      state.drawn = null;
      state.lastDiscard = null;
      state._claimPending = 0;
      return null;
    }

    if (data.type === 'kong') {
      if (!canKong(state, playerIndex)) return 'mj_cannot_kong';
      const suit = ld.k, num = ld.n;
      removeTileFromHand(state, playerIndex, suit, num);
      removeTileFromHand(state, playerIndex, suit, num);
      removeTileFromHand(state, playerIndex, suit, num);
      removeDiscard(state, state._lastDiscardFrom, ld.id);
      state.melds[playerIndex].push({ type: 'kong', tile: { k: suit, n: num }, tiles: [ld], from: state._lastDiscardFrom });
      // 刮风下雨：直杠（点杠）收引杠者 2 分
      if (state._rain && state._lastDiscardFrom >= 0 && state._lastDiscardFrom !== playerIndex) {
        state._gangScore[playerIndex] = (state._gangScore[playerIndex] || 0) + 2;
        state._gangScore[state._lastDiscardFrom] = (state._gangScore[state._lastDiscardFrom] || 0) - 2;
      }
      // Kong draws a replacement tile
      if (state.deck.length > 0) {
        const rep = state.deck.pop();
        state.hands[playerIndex].push(rep);
        sortTiles(state.hands[playerIndex]);
        state.drawn = rep.id;
      }
      state.currentPlayer = playerIndex;
      state.phase = 'play';
      state.lastDiscard = null;
      state._claimPending = 0;
      return null;
    }

    return 'mj_bad_claim';
  }

  // ---- Play phase (current player must discard) ----
  if (state.phase === 'play') {
    if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';

    if (data.type === 'win') {
      // Self-draw (自摸): winning hand already in hand
      if (!voidSatisfied(state, playerIndex)) return 'mj_void_not_satisfied';
      const info = checkWin(state, playerIndex, null);
      if (!info) return 'mj_not_winning';
      state._winSelfDraw[playerIndex] = true;
      registerWin(state, playerIndex);
      return null;
    }

    // 暗杠（下雨）：手中有4张相同牌，在自己回合杠出
    if (data.type === 'selfkong') {
      const suit = data.suit, num = data.num;
      // 验证手中有4张
      let removed = 0;
      for (let i = state.hands[playerIndex].length - 1; i >= 0 && removed < 4; i--) {
        if (state.hands[playerIndex][i].k === suit && state.hands[playerIndex][i].n === num) {
          state.hands[playerIndex].splice(i, 1);
          removed++;
        }
      }
      if (removed < 4) return 'mj_cannot_kong';
      state.melds[playerIndex].push({ type: 'kong', tile: { k: suit, n: num }, tiles: [], from: playerIndex });
      // 刮风下雨：暗杠收所有未胡者 2 分
      if (state._rain) {
        for (let p = 0; p < state.hands.length; p++) {
          if (p !== playerIndex && !state.winners.includes(p)) {
            state._gangScore[playerIndex] = (state._gangScore[playerIndex] || 0) + 2;
            state._gangScore[p] = (state._gangScore[p] || 0) - 2;
          }
        }
      }
      // 摸补牌
      if (state.deck.length > 0) {
        const rep = state.deck.pop();
        state.hands[playerIndex].push(rep);
        sortTiles(state.hands[playerIndex]);
        state.drawn = rep.id;
      }
      state.phase = 'play';
      state.lastDiscard = null;
      return null;
    }

    // 补杠（加杠）：已碰的刻子，摸到第 4 张时升级成杠并补牌
    if (data.type === 'addkong') {
      const suit = data.suit, num = data.num;
      const hand = state.hands[playerIndex];
      const melds = state.melds[playerIndex];
      const mi = melds.findIndex(m => {
        if (m.type !== 'pung') return false;
        if (m.tile) return m.tile.k === suit && m.tile.n === num;
        return m.tiles && m.tiles[0] && m.tiles[0].k === suit && m.tiles[0].n === num;
      });
      if (mi < 0) return 'mj_cannot_kong';
      const ti = hand.findIndex(t => t.k === suit && t.n === num);
      if (ti < 0) return 'mj_cannot_kong';
      const meld = melds[mi];
      meld.type = 'kong';
      meld.tiles.push(hand.splice(ti, 1)[0]);
      // 刮风下雨：补杠（加杠）收所有未胡者 1 分
      if (state._rain) {
        for (let p = 0; p < state.hands.length; p++) {
          if (p !== playerIndex && !state.winners.includes(p)) {
            state._gangScore[playerIndex] = (state._gangScore[playerIndex] || 0) + 1;
            state._gangScore[p] = (state._gangScore[p] || 0) - 1;
          }
        }
      }
      if (state.deck.length > 0) {
        const rep = state.deck.pop();
        state.hands[playerIndex].push(rep);
        sortTiles(state.hands[playerIndex]);
        state.drawn = rep.id;
      }
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
      // Enter claim phase: other players may pung/kong/win
      state.phase = 'claim';
      state._claimPending = playerCount - 1;
      state._multiWinClaimants = []; // 一炮多响：记录已胡玩家
      return null;
    }

    return 'mj_must_discard';
  }

  // 血战到底在 registerWin 里已自动推进到下一家（advanceTurn → phase 'play'），
  // 不再存在独立的 'win' 阶段。保留 cantonese 委托路径不会走到这里。

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

function canPung(state, playerIndex) {
  const ld = state.lastDiscard;
  if (!ld) return false;
  if (state.winners.includes(playerIndex)) return false;
  let c = 0;
  for (const tile of state.hands[playerIndex]) {
    if (tile.k === ld.k && tile.n === ld.n) c++;
  }
  return c >= 2;
}

function canKong(state, playerIndex) {
  const ld = state.lastDiscard;
  if (!ld) return false;
  if (state.winners.includes(playerIndex)) return false;
  let c = 0;
  for (const tile of state.hands[playerIndex]) {
    if (tile.k === ld.k && tile.n === ld.n) c++;
  }
  return c >= 3;
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
    melds: state.melds,
    discards: state.discards,
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    voidSuit: state.voidSuit,
    // 刚摸的牌进的是暗手，只能让摸牌者本人看见，否则对手能逐回合还原他的手牌
    drawn: state.currentPlayer === playerIndex ? state.drawn : null,
    lastDiscard: state.lastDiscard,
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

// Current actor for bot scheduling. Cantonese exposes its own (claim responder);
// Sichuan uses the plain currentPlayer (default behaviour).
exports.getCurrentActor = function (state) {
  if (state._variants === 'cantonese') return cantonese.getCurrentActor(state);
  return state.currentPlayer;
};

// server.js skipDisconnectedTurn calls setCurrentActor when a game exposes
// getCurrentActor. Sichuan advances plain currentPlayer; Cantonese has no
// setCurrentActor (matches standalone Cantonese, which also skips on disconnect).
exports.setCurrentActor = function (state, candidate) {
  if (state._variants === 'cantonese') return;
  state.currentPlayer = candidate;
};

// ---- Scoring (四川麻将完整番种) ----

function countGens(hand, melds) {
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

  var result = core.countFanDetailed(hand, melds, winInfo, SICHUAN, {
    selfDraw: isSelfDraw,
    wallCount: state.deck.length,
    gangShangHua: false,
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
  var genFan = countGens(hand, melds);
  if (genFan > 0) {
    result.details.push({ name: '根', fan: genFan });
    result.fan += genFan;
  }

  return result;
}

exports.calculateScore = calculateScore;

// Check if a 13-tile hand is one tile away from winning (听牌)
function isReadyHand(hand13, melds, voidSuit) {
  if (voidSuit) {
    for (const t of hand13) if (t.k === voidSuit) return false; // still has void suit tiles
  }
  // Test adding each possible tile
  const suits = ['wan', 'tong', 'tiao'];
  for (const k of suits) {
    if (k === voidSuit) continue;
    for (let n = 1; n <= 9; n++) {
      const testTiles = hand13.concat([{ k, n, id: 'test' }]);
      const res = huCheck(testTiles, melds, SICHUAN);
      if (res && res.win) return true;
    }
  }
  return false;
}

// 流局查花猪/查大叫：计算每个未胡玩家的罚分
// 返回 { penalties: [...], details: [{player, type, amount, to}] }
exports.calculatePenalties = function (state) {
  const playerCount = state.hands.length;
  const penalties = new Array(playerCount).fill(0);
  const details = [];
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
      // 计算手牌（13张 = 总张数 - 明牌张数）
      const meldTiles = state.melds[i].reduce((s, m) => s + (m.type === 'kong' ? 4 : 3), 0);
      const handLen = state.hands[i].length - meldTiles;
      if (handLen === 13) {
        if (!isReadyHand(state.hands[i], state.melds[i], state.voidSuit[i])) {
          notReady.push(i);
        }
      }
    }
  }

  // 花猪赔给所有非花猪未胡玩家：每人 8 分
  if (flowerPigs.length > 0) {
    const nonPigs = [];
    for (let i = 0; i < playerCount; i++) {
      if (!state.winners.includes(i) && !flowerPigs.includes(i)) nonPigs.push(i);
    }
    for (const pig of flowerPigs) {
      for (const np of nonPigs) {
        penalties[pig] -= 8;
        penalties[np] += 8 / Math.max(1, nonPigs.length);
        details.push({ player: pig, type: '花猪', amount: 8 / Math.max(1, nonPigs.length), to: np });
      }
    }
  }

  // 未听牌赔给听牌玩家
  if (notReady.length > 0) {
    const ready = [];
    for (let i = 0; i < playerCount; i++) {
      if (state.winners.includes(i) || notReady.includes(i)) continue;
      ready.push(i);
    }
    for (const nr of notReady) {
      for (const r of ready) {
        penalties[nr] -= 4;
        penalties[r] += 4 / Math.max(1, ready.length);
        details.push({ player: nr, type: '大叫', amount: 4 / Math.max(1, ready.length), to: r });
      }
    }
  }

  return { penalties, details };
};
