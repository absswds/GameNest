// public/js/renderers/liarsbar.js
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var selectedCards = [];
  var _lastHandLen = 0;
  var SUIT_SYMBOL = { s: '♠', h: '♥', c: '♣', d: '♦' };
  var SUIT_COLOR = { s: '#1a1a1a', h: '#e74c3c', c: '#1a1a1a', d: '#e74c3c' };

  window.gameRenderers.set('liarsbar', {
    init: function(container) {
      container.innerHTML =
        '<div id="lbWrap" style="width:100%;max-width:560px;display:flex;flex-direction:column;gap:10px;font-family:inherit;">' +
          '<div id="lbPlayers" style="display:flex;justify-content:space-around;gap:8px;flex-wrap:wrap;"></div>' +
          '<div id="lbTheme" style="text-align:center;padding:10px;background:var(--bg);border-radius:var(--radius-sm);"></div>' +
          '<div id="lbPile" style="min-height:60px;background:var(--bg);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px;"></div>' +
          '<div id="lbMessage" style="display:none;text-align:center;font-size:13px;padding:8px;background:#fef9e7;border-radius:12px;color:#7d6608;"></div>' +
          '<div id="lbRevolver" style="display:none;text-align:center;padding:16px;background:var(--bg);border-radius:var(--radius-sm);"></div>' +
          '<div id="lbShotResults" style="display:none;text-align:center;font-size:14px;padding:8px;"></div>' +
          '<div id="lbHand" style="min-height:112px;padding:4px 0;"></div>' +
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
        var name = window.getPlayerName ? window.getPlayerName(i) : (_t('lb_player_fallback') + (i + 1));
        var isMe = i === selfIdx;
        var isAlive = alive[i];
        var isActive = s.currentPlayer === i && winner == null && isAlive;
        var isShooting = s.currentShooter === i;
        var firedCount = shots[i] || 0;

        var statusHtml = '';
        if (!isAlive) {
          statusHtml = '<div style="font-size:11px;color:#e74c3c;font-weight:700;">' + _t('lb_died') + (isMe ? _t('lb_you_suffix') : '') + '</div>';
        } else if (isShooting) {
          statusHtml = '<div style="font-size:11px;color:#e74c3c;font-weight:700;animation:pulse 0.8s ease infinite;">' + _t('lb_pulling_trigger') + '</div>';
        }

        // Show fired count as dots (just how many shots taken, NOT bullet position)
        var dotsHtml = '';
        for (var j = 0; j < 6; j++) {
          var d = j < firedCount;
          dotsHtml += '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin:1px;' +
            (d ? 'background:#999;' : 'background:#ddd;') + '"></span>';
        }

        html +=
          '<div class="' + (isActive ? 'is-active-turn' : '') + '" style="text-align:center;padding:6px 10px;background:var(--bg);border-radius:12px;' +
          (isActive ? '' : 'border:1px solid var(--border);') +
          (isShooting ? 'border-color:#e74c3c;box-shadow:0 0 12px rgba(212,105,90,0.35);' : '') +
          (!isAlive ? 'opacity:0.45;' : '') + '">' +
          '<div style="font-size:12px;font-weight:600;">' + (isMe ? '⭐' : '') + name + '</div>' +
          '<div style="margin-top:2px;">' + dotsHtml + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);">' + (isAlive ? firedCount + _t('lb_shots_count') : '') + '</div>' +
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
        '<div style="font-size:13px;color:var(--text-muted);">' + _t('lb_theme_label') + '</div>' +
        '<div style="font-size:36px;font-weight:800;color:' + (colorMap[s.themeRank] || '#1a1a1a') + ';letter-spacing:4px;">' +
          s.themeRank +
        '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);">' + _tf('lb_claim_prompt', s.themeRank) + '</div>';
    },

    renderPile: function(s, selfIdx) {
      var el = document.getElementById('lbPile');
      if (!el) return;
      var parts = [];

      if (s.phase === 'shooting') {
        var shooterName = window.getPlayerName ? window.getPlayerName(s.currentShooter) : (_t('lb_player_fallback') + (s.currentShooter + 1));
        parts.push('<div style="font-size:14px;color:var(--danger);font-weight:600;">' + _tf('lb_shooter_triggering', shooterName) + '</div>');
      }
      // Keep the flipped cards visible while the shots play out, so everyone sees why
      if (s.revealedPile && s.revealedPile.length > 0 && (s.phase === 'shooting' || !(s.pileCards && s.pileCards.length))) {
        parts.push('<div style="font-size:12px;color:var(--text-muted);">' + _t('lb_revealed_cards') + '</div>');
        var cardsHtml = '<div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">';
        for (var i = 0; i < s.revealedPile.length; i++) {
          cardsHtml += cardSpan(s.revealedPile[i]);
        }
        cardsHtml += '</div>';
        parts.push(cardsHtml);
      } else if (s.phase === 'shooting') {
        // shooter line already shown
      } else if (s.pileCards && s.pileCards.length > 0) {
        parts.push('<div style="font-size:12px;color:var(--text-muted);">' + _tf('lb_face_down_cards', s.pileCards.length) + '</div>');
        var lastClaim = s.pileClaims && s.pileClaims[s.pileClaims.length - 1];
        if (lastClaim) {
          var claimer = window.getPlayerName ? window.getPlayerName(lastClaim.playerIndex) : (_t('lb_player_fallback') + (lastClaim.playerIndex + 1));
          parts.push('<div style="font-size:13px;font-weight:600;">' + _tf('lb_claimed_as', claimer, lastClaim.claimedRank) + '</div>');
        }
      } else {
        parts.push('<div style="font-size:13px;color:var(--text-muted);">' + _t('lb_new_round') + '</div>');
      }

      if (s.lastClaimant >= 0 && (!s.revealedPile || s.revealedPile.length === 0) && s.phase === 'playing') {
        if (s.lastClaimant !== selfIdx) {
          parts.push('<div style="font-size:12px;color:var(--danger);margin-top:4px;font-weight:600;">' + _t('lb_can_suspect') + '</div>');
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

      var html = '<div style="font-size:14px;font-weight:700;margin-bottom:4px;color:#e74c3c;">' + _t('lb_your_turn_shoot') + '</div>';
      html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">' + _tf('lb_shoot_info', firedCount + 1, remaining) + '</div>';

      // Revolver cylinder visualization
      html += '<div style="display:flex;gap:5px;justify-content:center;margin-bottom:14px;">';
      for (var i = 0; i < 6; i++) {
        var stateClass = i < firedCount ? 'fired' : (i === firedCount ? 'next' : 'empty');
        var bg = stateClass === 'fired' ? '#999' : (stateClass === 'next' ? '#e74c3c' : '#ddd');
        var glow = stateClass === 'next' ? 'box-shadow:0 0 10px rgba(212,105,90,0.6);' : '';
        html += '<span style="display:inline-block;width:42px;height:42px;border-radius:50%;background:' + bg + ';' + glow + ';transition:all 0.2s;"></span>';
      }
      html += '</div>';

      html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">' + _t('lb_cylinder_hint') + '</div>';

      html += '<button class="btn btn-sm" id="lbFireBtn" style="background:#e74c3c;color:#fff;border:none;font-size:16px;font-weight:700;min-width:120px;" onclick="window._lbShoot()">' + _t('lb_shoot_btn') + '</button>';

      el.innerHTML = html;
    },

    renderShotResults: function(s, selfIdx) {
      var el = document.getElementById('lbShotResults');
      if (!el || !s.lastShotResults || s.lastShotResults.length === 0) {
        el.style.display = 'none';
        return;
      }
      el.style.display = '';
      var html = '<div style="font-weight:700;margin-bottom:6px;">' + _t('lb_shoot_results') + '</div>';
      for (var i = 0; i < s.lastShotResults.length; i++) {
        var r = s.lastShotResults[i];
        var name = window.getPlayerName ? window.getPlayerName(r.player) : (_t('lb_player_fallback') + (r.player + 1));
        var isMe = r.player === selfIdx;

        if (r.dead) {
          html += '<div style="color:#e74c3c;font-weight:700;font-size:16px;margin:6px 0;animation:scaleIn .3s ease;">' +
            (isMe ? _tf('lb_you_died', r.firedCount) : _tf('lb_player_died', name, r.firedCount)) +
            '</div>';
        } else {
          html += '<div style="color:#5a9e6f;font-size:14px;margin:3px 0;">' +
            (isMe ? _tf('lb_you_survived', r.firedCount) : _tf('lb_player_survived', name, r.firedCount)) +
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
        el.innerHTML = '<div style="font-size:13px;color:var(--text-muted);text-align:center;">' + _t('lb_no_cards') + '</div>';
        return;
      }

      var isAlive = (s.alive || [])[selfIdx];
      var myTurn = s.currentPlayer === selfIdx && winner == null && isAlive && s.phase === 'playing';
      var deal = hand.length > _lastHandLen + 2;
      _lastHandLen = hand.length;
      el.innerHTML = window.CardUI.group(hand, {
        layout: 'hand',
        deal: deal,
        cardOpts: function(c) {
          var cls = myTurn ? 'pc-selectable lb-card' : 'lb-card';
          if (myTurn && c.rank === s.themeRank) cls += ' lb-theme';
          return {
            size: 'lg',
            selected: selectedCards.indexOf(c.id) !== -1,
            className: cls,
            attrs: myTurn ? 'onclick="window._lbToggleCard(\'' + c.id + '\')"' : ''
          };
        }
      });
    },

    renderActions: function(s, selfIdx, winner) {
      var el = document.getElementById('lbActions');
      if (!el) return;
      var isAlive = (s.alive || [])[selfIdx];
      var myTurn = s.currentPlayer === selfIdx && winner == null && isAlive && s.phase === 'playing';
      var html = '';

      if (!isAlive && winner == null) {
        html += '<div style="font-size:13px;color:var(--danger);text-align:center;width:100%;">' + _t('lb_spectating') + '</div>';
      } else if (myTurn && (s.hands[selfIdx] || []).length === 0) {
        // Out of cards: calling the bluff is the only move left
        html += '<div style="font-size:13px;color:var(--text-muted);text-align:center;width:100%;">' + _t('lb_must_suspect') + '</div>';
        html += '<button class="btn btn-sm" style="background:var(--danger);color:#fff;border:none;" onclick="window._lbSuspect()">' + _t('lb_suspect_btn') + '</button>';
      } else if (myTurn) {
        var selCount = selectedCards.length;
        html += '<button class="btn btn-sm btn-primary" onclick="window._lbPlayCards()" ' +
          (selCount === 0 ? 'disabled' : '') + '>' +
          (selCount > 0 ? _tf('lb_play_n_cards', selCount) : _t('lb_play_card')) + '</button>';
        if (s.lastClaimant >= 0 && s.lastClaimant !== selfIdx) {
          html += '<button class="btn btn-sm" style="background:var(--danger);color:#fff;border:none;" onclick="window._lbSuspect()">' + _t('lb_suspect_btn') + '</button>';
        }
      }

      el.innerHTML = html;
    }
  });

  function cardSpan(c) {
    return window.CardUI.render(c, { size: 'sm' });
  }

  window._lbToggleCard = function(id) {
    var idx = selectedCards.indexOf(id);
    if (idx !== -1) {
      selectedCards.splice(idx, 1);
    } else {
      if (selectedCards.length >= 3) return;
      selectedCards.push(id);
    }
    if (window._lbState) {
      var renderer = window.gameRenderers.get('liarsbar');
      var container = document.getElementById('boardArea');
      var playerIndex = parseInt(sessionStorage.getItem('playerIndex'));
      if (renderer) renderer.render(window._lbState, container, playerIndex, window._lbState.winner);
    }
  };

  window._lbPlayCards = function() {
    if (selectedCards.length === 0) { showToast(_t('lb_toast_select_first')); return; }
    window.makeGameMove({ action: 'play', cardIds: selectedCards.slice() });
    selectedCards = [];
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
