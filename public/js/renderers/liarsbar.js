// public/js/renderers/liarsbar.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var selectedCard = null;
  var SUIT_SYMBOL = { s: '♠', h: '♥', c: '♣', d: '♦' };
  var SUIT_COLOR = { s: '#1a1a1a', h: '#e74c3c', c: '#1a1a1a', d: '#e74c3c' };

  window.gameRenderers.set('liarsbar', {
    init: function(container) {
      container.innerHTML =
        '<div id="lbWrap" style="width:100%;max-width:420px;display:flex;flex-direction:column;gap:10px;font-family:inherit;">' +
          '<div id="lbPlayers" style="display:flex;justify-content:space-around;gap:8px;flex-wrap:wrap;"></div>' +
          '<div id="lbTheme" style="text-align:center;padding:10px;background:var(--bg);border-radius:var(--radius-sm);"></div>' +
          '<div id="lbPile" style="min-height:60px;background:var(--bg);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px;"></div>' +
          '<div id="lbMessage" style="display:none;text-align:center;font-size:13px;padding:8px;background:#fef9e7;border-radius:12px;color:#7d6608;"></div>' +
          '<div id="lbRevolver" style="display:none;text-align:center;padding:16px;background:var(--bg);border-radius:var(--radius-sm);"></div>' +
          '<div id="lbShotResults" style="display:none;text-align:center;font-size:14px;padding:8px;"></div>' +
          '<div id="lbHand" style="min-height:56px;display:flex;flex-wrap:wrap;justify-content:center;gap:4px;padding:8px 0;"></div>' +
          '<div id="lbActions" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;"></div>' +
        '</div>';
    },

    render: function(state, container, playerIndex, winner) {
      if (!state) return;
      this.renderPlayers(state, playerIndex, winner);
      this.renderTheme(state);
      this.renderPile(state, playerIndex);
      this.renderMessage(state);
      this.renderRevolver(state, playerIndex, winner);
      this.renderShotResults(state, playerIndex);
      this.renderHand(state, playerIndex, winner);
      this.renderActions(state, playerIndex, winner);
    },

    renderPlayers: function(s, selfIdx, winner) {
      var el = document.getElementById('lbPlayers');
      if (!el) return;
      var html = '';
      var alive = s.alive || [];
      var shots = s.firedShots || [];
      for (var i = 0; i < alive.length; i++) {
        var name = window.getPlayerName ? window.getPlayerName(i) : ('玩家' + (i + 1));
        var isMe = i === selfIdx;
        var isAlive = alive[i];
        var isActive = s.currentPlayer === i && winner == null && isAlive;
        var isShooting = s.currentShooter === i;
        var firedCount = shots[i] || 0;

        var statusHtml = '';
        if (!isAlive) {
          statusHtml = '<div style="font-size:11px;color:#e74c3c;font-weight:700;">💀 阵亡' + (isMe ? ' (你)' : '') + '</div>';
        } else if (isShooting) {
          statusHtml = '<div style="font-size:11px;color:#e74c3c;font-weight:700;animation:pulse 0.8s ease infinite;">🔫 扣扳机中...</div>';
        }

        // Show fired count as dots (just how many shots taken, NOT bullet position)
        var dotsHtml = '';
        for (var j = 0; j < 6; j++) {
          var d = j < firedCount;
          dotsHtml += '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin:1px;' +
            (d ? 'background:#999;' : 'background:#ddd;') + '"></span>';
        }

        html +=
          '<div style="text-align:center;padding:6px 10px;background:var(--bg);border-radius:12px;' +
          (isActive ? 'border:2px solid var(--accent);animation:pulse 2s ease infinite;' : 'border:1px solid var(--border);') +
          (isShooting ? 'border-color:#e74c3c;box-shadow:0 0 12px rgba(212,105,90,0.35);' : '') +
          (!isAlive ? 'opacity:0.45;' : '') + '">' +
          '<div style="font-size:12px;font-weight:600;">' + (isMe ? '⭐' : '') + name + '</div>' +
          '<div style="margin-top:2px;">' + dotsHtml + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);">' + (isAlive ? firedCount + '/6 枪' : '') + '</div>' +
          statusHtml +
          '</div>';
      }
      el.innerHTML = html;
    },

    renderTheme: function(s) {
      var el = document.getElementById('lbTheme');
      if (!el || !s.themeRank) return;
      var colorMap = { J: '#c8a45c', Q: '#d4695a', K: '#1a1a1a' };
      el.innerHTML =
        '<div style="font-size:13px;color:var(--text-muted);">本轮主题牌</div>' +
        '<div style="font-size:36px;font-weight:800;color:' + (colorMap[s.themeRank] || '#1a1a1a') + ';letter-spacing:4px;">' +
          s.themeRank +
        '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);">你必须声称出的是 ' + s.themeRank + '</div>';
    },

    renderPile: function(s, selfIdx) {
      var el = document.getElementById('lbPile');
      if (!el) return;
      var parts = [];

      if (s.phase === 'shooting') {
        var shooterName = window.getPlayerName ? window.getPlayerName(s.currentShooter) : ('玩家' + (s.currentShooter + 1));
        parts.push('<div style="font-size:14px;color:var(--danger);font-weight:600;">🔫 ' + shooterName + ' 正在扣扳机...</div>');
      } else if (s.revealedPile && s.revealedPile.length > 0) {
        parts.push('<div style="font-size:12px;color:var(--text-muted);">已揭示的牌</div>');
        var cardsHtml = '<div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">';
        for (var i = 0; i < s.revealedPile.length; i++) {
          cardsHtml += cardSpan(s.revealedPile[i]);
        }
        cardsHtml += '</div>';
        parts.push(cardsHtml);
      } else if (s.pileCards && s.pileCards.length > 0) {
        parts.push('<div style="font-size:12px;color:var(--text-muted);">桌上有 ' + s.pileCards.length + ' 张面朝下的牌</div>');
        var lastClaim = s.pileClaims && s.pileClaims[s.pileClaims.length - 1];
        if (lastClaim) {
          var claimer = window.getPlayerName ? window.getPlayerName(lastClaim.playerIndex) : ('玩家' + (lastClaim.playerIndex + 1));
          parts.push('<div style="font-size:13px;font-weight:600;">' + claimer + ' 声称是 ' + lastClaim.claimedRank + '</div>');
        }
      } else {
        parts.push('<div style="font-size:13px;color:var(--text-muted);">新的一轮，还没有人出牌</div>');
      }

      if (s.lastClaimant >= 0 && (!s.revealedPile || s.revealedPile.length === 0) && s.phase === 'playing') {
        if (s.lastClaimant !== selfIdx) {
          parts.push('<div style="font-size:12px;color:var(--danger);margin-top:4px;font-weight:600;">🔍 你可以质疑上家！</div>');
        }
      }

      el.innerHTML = parts.join('<div style="height:4px;"></div>');
    },

    renderMessage: function(s) {
      var el = document.getElementById('lbMessage');
      if (!el) return;
      if (s.roundMessage) { el.style.display = ''; el.textContent = s.roundMessage; }
      else { el.style.display = 'none'; }
    },

    renderRevolver: function(s, selfIdx, winner) {
      var el = document.getElementById('lbRevolver');
      if (!el) return;
      if (s.currentShooter !== selfIdx || winner != null) {
        el.style.display = 'none';
        return;
      }
      el.style.display = '';

      var firedCount = (s.firedShots || [])[selfIdx] || 0;
      var remaining = 6 - firedCount;

      var html = '<div style="font-size:14px;font-weight:700;margin-bottom:4px;color:#e74c3c;">🔫 轮到你了！</div>';
      html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">第 ' + (firedCount + 1) + ' 次开枪 (' + remaining + ' 发弹仓还没转)</div>';

      // Revolver cylinder visualization
      html += '<div style="display:flex;gap:5px;justify-content:center;margin-bottom:14px;">';
      for (var i = 0; i < 6; i++) {
        var stateClass = i < firedCount ? 'fired' : (i === firedCount ? 'next' : 'empty');
        var bg = stateClass === 'fired' ? '#999' : (stateClass === 'next' ? '#e74c3c' : '#ddd');
        var glow = stateClass === 'next' ? 'box-shadow:0 0 10px rgba(212,105,90,0.6);' : '';
        html += '<span style="display:inline-block;width:42px;height:42px;border-radius:50%;background:' + bg + ';' + glow + ';transition:all 0.2s;"></span>';
      }
      html += '</div>';

      html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">子弹藏在某个还没转到的弹仓里... 谁敢按下扳机？</div>';

      html += '<button class="btn btn-sm" id="lbFireBtn" style="background:#e74c3c;color:#fff;border:none;font-size:16px;font-weight:700;min-width:120px;" onclick="window._lbShoot()">🔫 开枪!</button>';

      el.innerHTML = html;
    },

    renderShotResults: function(s, selfIdx) {
      var el = document.getElementById('lbShotResults');
      if (!el || !s.lastShotResults || s.lastShotResults.length === 0) {
        el.style.display = 'none';
        return;
      }
      el.style.display = '';
      var html = '<div style="font-weight:700;margin-bottom:6px;">🔫 开枪结果</div>';
      for (var i = 0; i < s.lastShotResults.length; i++) {
        var r = s.lastShotResults[i];
        var name = window.getPlayerName ? window.getPlayerName(r.player) : ('玩家' + (r.player + 1));
        var isMe = r.player === selfIdx;

        if (r.dead) {
          html += '<div style="color:#e74c3c;font-weight:700;font-size:16px;margin:6px 0;animation:scaleIn .3s ease;">' +
            (isMe ? '💥💀 你的第 ' + r.firedCount + ' 枪... 中弹了！！你当场阵亡' : '💥💀 ' + name + ' 开第 ' + r.firedCount + ' 枪... 中弹阵亡！') +
            '</div>';
        } else {
          html += '<div style="color:#5a9e6f;font-size:14px;margin:3px 0;">' +
            (isMe ? '😮‍💨 第 ' + r.firedCount + ' 枪... 咔嚓！是空枪，你还活着' : '😮‍💨 ' + name + ' 开了第 ' + r.firedCount + ' 枪... 咔嚓！空枪') +
            '</div>';
        }
      }
      el.innerHTML = html;
    },

    renderHand: function(s, selfIdx, winner) {
      var el = document.getElementById('lbHand');
      if (!el) return;
      var hand = s.hands[selfIdx] || [];
      if (hand.length === 0) {
        el.innerHTML = '<div style="font-size:13px;color:var(--text-muted);text-align:center;">没有手牌了</div>';
        return;
      }

      var isAlive = (s.alive || [])[selfIdx];
      var myTurn = s.currentPlayer === selfIdx && winner == null && isAlive && s.phase === 'playing';
      var html = '';
      for (var i = 0; i < hand.length; i++) {
        var c = hand[i];
        var isSel = selectedCard === c.id;
        var isTheme = c.rank === s.themeRank;

        var bg = '#fff';
        if (c.suit === 'wild') bg = 'linear-gradient(135deg,#fef9e7,#fdf0d5)';
        else if (c.suit === 'ghost') bg = 'linear-gradient(135deg,#2a2a2a,#1a1a1a)';

        var style = 'display:inline-flex;align-items:center;justify-content:center;' +
          'width:54px;height:72px;border-radius:10px;' +
          'background:' + bg + ';border:1px solid var(--border);' +
          'font-size:15px;font-weight:700;cursor:' + (myTurn ? 'pointer' : 'default') + ';' +
          'transition:transform 0.12s,box-shadow 0.12s;' +
          'box-shadow:0 2px 6px rgba(0,0,0,0.10);line-height:1;';
        if (isSel) style += 'transform:translateY(-16px);box-shadow:0 4px 12px rgba(0,0,0,0.2);border-color:var(--accent);';
        if (isTheme && myTurn) style += 'box-shadow:0 0 0 2px var(--accent-glow);';

        var label, color;
        if (c.suit === 'wild') { label = '★'; color = '#c8a45c'; }
        else if (c.suit === 'ghost') { label = '👻'; color = '#fff'; }
        else { label = SUIT_SYMBOL[c.suit] + c.rank; color = SUIT_COLOR[c.suit] || '#1a1a1a'; }

        html += '<div class="lb-card" data-id="' + c.id + '" style="' + style + 'color:' + color + ';"';
        if (myTurn) html += ' onclick="window._lbSelectCard(\'' + c.id + '\')"';
        html += '>' + label + '</div>';
      }
      el.innerHTML = html;
    },

    renderActions: function(s, selfIdx, winner) {
      var el = document.getElementById('lbActions');
      if (!el) return;
      var isAlive = (s.alive || [])[selfIdx];
      var myTurn = s.currentPlayer === selfIdx && winner == null && isAlive && s.phase === 'playing';
      var html = '';

      if (!isAlive && winner == null) {
        html += '<div style="font-size:13px;color:var(--danger);text-align:center;width:100%;">💀 你已阵亡，正在观战中...</div>';
      } else if (myTurn) {
        html += '<button class="btn btn-sm btn-primary" onclick="window._lbPlayCard()">出牌</button>';
        if (s.lastClaimant >= 0 && s.lastClaimant !== selfIdx) {
          html += '<button class="btn btn-sm" style="background:var(--danger);color:#fff;border:none;" onclick="window._lbSuspect()">🔍 质疑上家！</button>';
        }
      }

      el.innerHTML = html;
    }
  });

  function cardSpan(c) {
    var bg = '#fff', label, color;
    if (c.suit === 'wild') { bg = 'linear-gradient(135deg,#fef9e7,#fdf0d5)'; label = '★'; color = '#c8a45c'; }
    else if (c.suit === 'ghost') { bg = 'linear-gradient(135deg,#2a2a2a,#1a1a1a)'; label = '👻'; color = '#fff'; }
    else { label = SUIT_SYMBOL[c.suit] + c.rank; color = SUIT_COLOR[c.suit] || '#1a1a1a'; }
    return '<span style="display:inline-flex;align-items:center;justify-content:center;' +
      'width:44px;height:58px;border-radius:8px;' +
      'background:' + bg + ';border:1px solid var(--border);' +
      'font-size:14px;font-weight:700;color:' + color + ';' +
      'box-shadow:0 1px 4px rgba(0,0,0,0.1);line-height:1;">' +
      label + '</span>';
  }

  window._lbSelectCard = function(id) {
    selectedCard = selectedCard === id ? null : id;
    if (window._lbState) {
      var renderer = window.gameRenderers.get('liarsbar');
      var container = document.getElementById('boardArea');
      var playerIndex = parseInt(sessionStorage.getItem('playerIndex'));
      if (renderer) renderer.render(window._lbState, container, playerIndex, window._lbState.winner);
    }
  };

  window._lbPlayCard = function() {
    if (!selectedCard) { showToast('请先选择一张牌'); return; }
    window.makeGameMove({ action: 'play', cardId: selectedCard });
    selectedCard = null;
  };

  window._lbSuspect = function() {
    window.makeGameMove({ action: 'suspect' });
  };

  window._lbShoot = function() {
    window.makeGameMove({ action: 'shoot' });
  };

  function showToast(msg) {
    var t = document.getElementById('toast') || (function() {
      var el = document.createElement('div');
      el.id = 'toast'; el.className = 'toast';
      document.body.appendChild(el);
      return el;
    })();
    t.textContent = msg; t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2000);
  }

  var origRender = window.gameRenderers.get('liarsbar').render;
  window.gameRenderers.get('liarsbar').render = function(state, container, playerIndex, winner) {
    window._lbState = state;
    origRender.call(this, state, container, playerIndex, winner);
  };
})();
