// bots/monopoly.js — 大富翁 AI (难度分级 + 建房 + 交易估值与提议)
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');
const { groupHasHouses } = require('../games/monopoly');

exports.name = 'monopoly';

// Chance of passing up a purchase / a house even when affordable (the "mistake rate" of each tier).
const MISS_BUY = { easy: 0.55, normal: 0.3, hard: 0 };
const MISS_BUILD = { easy: 0.5, normal: 0.15, hard: 0 };
exports.createBot = (playerIndex) => {
  let lastProposedTurn = -1;
  let lastProposedKey = null;
  const declined = {}; // `${to}:${targetPos}` -> round it was declined

  return {
    name: botName(playerIndex, 'zh'),
    getMove(state) {
      if (!state) return { pass: true };
      if (state.eliminated && state.eliminated[playerIndex]) return { pass: true };

      // 1. 响应正在进行的交易提议
      if (state.tradeOffer) {
        if (state.tradeOffer.to === playerIndex) {
          return evaluateIncomingTrade(state, playerIndex, state.tradeOffer);
        }
        return { pass: true };
      }

      if (state.currentPlayer !== playerIndex) return { pass: true };

      const diff = getDifficulty(state);
      const board = state.board || [];
      const reserve = diff === 'hard' ? 60 : (diff === 'easy' ? 180 : 100);
      const buildReserve = diff === 'hard' ? 80 : (diff === 'easy' ? 220 : 150);

      // 记住被拒绝的提议，至少 5 回合内不再提同一笔
      const lt = state.lastTrade;
      if (lt && lt.accepted === false && lt.from === playerIndex && lastProposedKey) {
        declined[lastProposedKey] = state.round;
        lastProposedKey = null;
      }

      // 2. 主动发起交易提议（有真人对战或明确开启交易选项时，差 1 张凑齐垄断时主动找对手交易）
      const canPropose = state._realPlayerCount > 0 || (state._options && state._options.trading === true);
      if (canPropose && (state.phase === 'waiting' || state.phase === 'end_turn') && !state.tradeOffer && lastProposedTurn !== state.round) {
        const tradeMove = considerProactiveTrade(state, board, playerIndex, diff, declined);
        if (tradeMove) {
          lastProposedTurn = state.round;
          lastProposedKey = `${tradeMove.to}:${tradeMove.requestProps[0]}`;
          return tradeMove;
        }
      }


      if (state.phase === 'waiting') {
        const early = pickBuild(state, board, playerIndex, buildReserve, diff);
        if (early !== -1) return { type: 'build', spaceIndex: early };
        return { type: 'roll' };
      }

      if (state.phase === 'landed' && state.pendingAction === 'can_buy') {
        const pos = state.positions[playerIndex];
        const space = board[pos];
        const cash = state.cash[playerIndex];
        const price = space && space.price ? space.price : 0;
        if (!price) return { type: 'skip_buy' };

        // 简单模式：有 25% 概率错过买地
        if (Math.random() < MISS_BUY[diff]) return { type: 'skip_buy' };

        if (space.type === 'property') {
          if (wouldComplete(state, board, pos, space.group, playerIndex) && cash >= price) return { type: 'buy' };
          if (blocksOpponent(state, board, pos, space.group, playerIndex) && cash - price >= (diff === 'hard' ? 10 : 30)) return { type: 'buy' };
          if (ownsInGroup(state, board, space.group, playerIndex) > 0 && cash - price >= (diff === 'hard' ? 20 : 50)) return { type: 'buy' };
        }
        if (cash - price >= reserve) return { type: 'buy' };
        return { type: 'skip_buy' };
      }

      if (state.phase === 'landed' && state.pendingAction === 'can_build') {
        const pos = state.positions[playerIndex];
        const space = board[pos];
        if (space && space.price && state.cash[playerIndex] - space.price / 2 >= buildReserve) {
          if (Math.random() < MISS_BUILD[diff]) return { type: 'skip_buy' };
          return { type: 'build', spaceIndex: pos };
        }
        return { type: 'skip_buy' };
      }

      if (state.phase === 'end_turn') {
        const buildTarget = pickBuild(state, board, playerIndex, buildReserve, diff);
        if (buildTarget !== -1) return { type: 'build', spaceIndex: buildTarget };
        return { type: 'end_turn' };
      }
      return { pass: true };
    },
  };
};

function ownsInGroup(state, board, group, pi) {
  return groupSpaces(board, group).filter(i => state.properties[i] && state.properties[i].owner === pi).length;
}

function blocksOpponent(state, board, pos, group, pi) {
  if (group === undefined) return false;
  const spaces = groupSpaces(board, group);
  return spaces.some(i => state.properties[i] && state.properties[i].owner !== pi)
    && !spaces.some(i => i !== pos && state.properties[i] && state.properties[i].owner === pi);
}

function groupSpaces(board, group) {
  const out = [];
  board.forEach((s, i) => { if (s && s.group === group) out.push(i); });
  return out;
}

function wouldComplete(state, board, pos, group, pi) {
  if (group === undefined) return false;
  const spaces = groupSpaces(board, group);
  return spaces.every(i => i === pos || (state.properties[i] && state.properties[i].owner === pi));
}

// Exported helper takes a position; any space of the group will do.
function groupHasHousesIn(state, board, group) {
  const spaces = groupSpaces(board, group);
  return spaces.length > 0 && groupHasHouses(state, spaces[0]);
}

function pickBuild(state, board, pi, buildReserve, diff) {
  if (Math.random() < MISS_BUILD[diff]) return -1;
  let best = -1, bestPrice = Infinity;
  for (let i = 0; i < board.length; i++) {
    const s = board[i];
    if (!s || s.type !== 'property') continue;
    const prop = state.properties[i];
    if (!prop || prop.owner !== pi || prop.houses >= 5) continue;
    const spaces = groupSpaces(board, s.group);
    if (!spaces.every(j => state.properties[j] && state.properties[j].owner === pi)) continue;
    const cost = s.price / 2;
    if (state.cash[pi] - cost < buildReserve) continue;
    const minInGroup = Math.min(...spaces.map(j => state.properties[j].houses || 0));
    if ((prop.houses || 0) > minInGroup) continue;
    // hard builds where the extra rent per dollar is highest; the others just take the cheapest
    const sc = diff === 'hard' ? -((s.rent[(prop.houses || 0) + 1] - s.rent[prop.houses || 0]) / cost) : s.price;
    if (sc < bestPrice) { bestPrice = sc; best = i; }
  }
  return best;
}

// 评估收到的交易提议
function evaluateIncomingTrade(state, botIndex, offer) {
  const diff = getDifficulty(state);
  const board = state.board || [];

  let gain = offer.offerCash || 0;
  for (const pos of offer.offerProps) {
    const space = board[pos];
    if (!space) continue;
    let val = space.price || 100;
    if (wouldComplete(state, board, pos, space.group, botIndex)) {
      val *= 2.8; // 补全自身垄断价值极高
    } else if (ownsInGroup(state, board, space.group, botIndex) > 0) {
      val *= 1.4;
    }
    gain += val;
  }

  let loss = offer.requestCash || 0;
  if (state.cash[botIndex] - offer.requestCash < 50) {
    loss += 500; // 现金濒临破产绝对拒绝
  }

  for (const pos of offer.requestProps) {
    const space = board[pos];
    if (!space) continue;
    let val = space.price || 100;
    // 对方若因此垄断，给予巨大惩罚权重
    if (wouldComplete(state, board, pos, space.group, offer.from)) {
      val *= (diff === 'hard' ? 3.5 : (diff === 'normal' ? 2.5 : 1.6));
    } else if (ownsInGroup(state, board, space.group, botIndex) > 1) {
      val *= 2.0;
    }
    loss += val;
  }

  const threshold = diff === 'easy' ? 0.8 : (diff === 'hard' ? 1.05 : 0.95);
  if (gain >= loss * threshold) {
    return { type: 'trade_accept' };
  }
  return { type: 'trade_decline' };
}

// 主动寻找有利交易（如差 1 张凑齐垄断）
function considerProactiveTrade(state, board, botIndex, diff, declined) {
  if (diff === 'easy') return null; // 简单机器人不主动算计交易
  const botCash = state.cash[botIndex];
  if (botCash < 200) return null;

  // 扫描所有色组，寻找差 1 张就垄断的组
  const groupMap = {};
  board.forEach((s, i) => {
    if (s && s.type === 'property' && s.group !== undefined) {
      groupMap[s.group] = groupMap[s.group] || [];
      groupMap[s.group].push(i);
    }
  });

  for (const group of Object.keys(groupMap)) {
    const spaces = groupMap[group];
    if (groupHasHousesIn(state, board, Number(group))) continue;

    const myProps = spaces.filter(i => state.properties[i] && state.properties[i].owner === botIndex);
    const unownedOrOther = spaces.filter(i => !state.properties[i] || state.properties[i].owner !== botIndex);

    // 差 1 张
    if (myProps.length === spaces.length - 1 && unownedOrOther.length === 1) {
      const targetPos = unownedOrOther[0];
      const targetProp = state.properties[targetPos];
      if (!targetProp || targetProp.owner === undefined || targetProp.owner === null) continue;
      const targetPlayer = targetProp.owner;
      if (state.eliminated[targetPlayer]) continue;
      const dr = declined && declined[`${targetPlayer}:${targetPos}`];
      if (dr !== undefined && state.round - dr < 5) continue;

      const targetSpace = board[targetPos];
      const price = targetSpace.price || 150;

      // 寻找我方拥有的孤立地产（我方仅有 1 张且该组无房），优先选择对手在该色组已有地产的互换
      let bestSwapProp = -1;
      let bestSwapScore = -Infinity;

      for (let p = 0; p < board.length; p++) {
        const myP = state.properties[p];
        if (!myP || myP.owner !== botIndex) continue;
        const s = board[p];
        if (!s || s.type !== 'property' || s.group === undefined) continue;
        if (s.group === Number(group)) continue; // 不拿正在凑的同组
        if (groupHasHousesIn(state, board, s.group)) continue;

        if (ownsInGroup(state, board, s.group, botIndex) === 1) {
          const oppOwns = ownsInGroup(state, board, s.group, targetPlayer);
          const score = oppOwns * 100 - (s.price || 0) * 0.1;
          if (score > bestSwapScore) {
            bestSwapScore = score;
            bestSwapProp = p;
          }
        }
      }

      if (bestSwapProp !== -1) {
        // 地产置换提议：视价格差异补少许现金
        const swapSpace = board[bestSwapProp];
        const cashDiff = Math.max(0, (targetSpace.price || 0) - (swapSpace.price || 0));
        const sweetCash = Math.min(botCash - 80, cashDiff + 40);
        return {
          type: 'trade_offer',
          to: targetPlayer,
          offerCash: Math.max(0, sweetCash),
          offerProps: [bestSwapProp],
          requestCash: 0,
          requestProps: [targetPos],
        };
      }

      // 纯现金求购：如果手头现金充沛，出 2.0x~2.6x 溢价打动对手
      const multiplier = diff === 'hard' ? 2.5 : 2.0;
      const offerCash = Math.floor(price * multiplier);
      if (botCash - offerCash >= 100) {
        return {
          type: 'trade_offer',
          to: targetPlayer,
          offerCash: offerCash,
          offerProps: [],
          requestCash: 0,
          requestProps: [targetPos],
        };
      }
    }
  }
  return null;
}


