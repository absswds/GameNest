// public/js/renderers/truthdare.js
// Truth or Dare — shared party card picker
(function() {
  function t(key) { return typeof _t === 'function' ? _t(key) : key; }
  function tf(key) { var args = Array.prototype.slice.call(arguments, 1); return String(t(key)).replace(/%s/g, function() { return args.shift(); }); }

  window.gameRenderers = window.gameRenderers || new Map();

  window.gameRenderers.set('truthdare', {
    init: function(container) {
      container.innerHTML = '' +
        '<div class="td-shell">' +
          '<div class="td-hero">' +
            '<div class="td-kicker">' + t('td_kicker') + '</div>' +
            '<h2>' + t('td_title') + '</h2>' +
            '<p>' + t('td_desc') + '</p>' +
          '</div>' +
          '<div class="td-card" id="tdCard">' +
            '<div class="td-card-type" id="tdCardType">READY</div>' +
            '<div class="td-card-text" id="tdCardText">' + t('td_card_prompt') + '</div>' +
            '<div class="td-card-deck" id="tdCardDeck">' + t('td_card_deck') + '</div>' +
          '</div>' +
          '<div class="td-actions">' +
            '<button class="td-btn truth" onclick="window._tdDraw(\'truth\')">' + t('td_truth') + '</button>' +
            '<button class="td-btn random" onclick="window._tdDraw(\'random\')">' + t('td_random') + '</button>' +
            '<button class="td-btn dare" onclick="window._tdDraw(\'dare\')">' + t('td_dare') + '</button>' +
          '</div>' +
          '<div class="td-hint" id="tdHint"></div>' +
          '<div class="td-history-wrap">' +
            '<div class="td-history-title">' + t('td_history_title') + '</div>' +
            '<div class="td-history" id="tdHistory"></div>' +
          '</div>' +
        '</div>';

      injectStylesOnce('truthdare-styles', '' +
          '.td-shell{width:100%;max-width:620px;margin:0 auto;display:flex;flex-direction:column;gap:14px;align-items:center;}' +
          '.td-hero{text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:22px;padding:18px 18px 16px;box-shadow:var(--shadow-sm);width:100%;box-sizing:border-box;}' +
          '.td-kicker{display:inline-flex;padding:4px 10px;border-radius:999px;background:rgba(200,164,92,.12);color:var(--accent);font-size:12px;font-weight:800;letter-spacing:.08em;}' +
          '.td-hero h2{margin:10px 0 6px;font-size:26px;letter-spacing:.03em;}' +
          '.td-hero p{margin:0;color:var(--text-muted);font-size:14px;line-height:1.6;}' +
          '.td-card{width:100%;box-sizing:border-box;min-height:220px;border-radius:28px;padding:24px 22px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;' +
            'background:linear-gradient(145deg,#1b1b1f,#2c2a30);color:#fff;box-shadow:0 18px 40px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.08);position:relative;overflow:hidden;}' +
          '.td-card:before{content:"";position:absolute;inset:-50% auto auto -20%;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(200,164,92,.32),transparent 65%);}' +
          '.td-card.truth{background:linear-gradient(145deg,#18213a,#262b45);}' +
          '.td-card.dare{background:linear-gradient(145deg,#351c20,#3a2a22);}' +
          '.td-card.pop{animation:tdPop .34s ease;}' +
          '.td-card-type{position:relative;font-size:13px;font-weight:900;letter-spacing:.18em;color:#d9bf7a;margin-bottom:14px;}' +
          '.td-card-text{position:relative;font-size:25px;font-weight:900;line-height:1.45;max-width:520px;}' +
          '.td-card-deck{position:relative;margin-top:16px;color:rgba(255,255,255,.68);font-size:13px;}' +
          '.td-actions{width:100%;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}' +
          '.td-btn{border:0;border-radius:18px;padding:15px 8px;font-size:16px;font-weight:900;cursor:pointer;color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.16);transition:transform .1s,filter .15s;}' +
          '.td-btn:active{transform:scale(.96);filter:brightness(.94);}' +
          '.td-btn.truth{background:linear-gradient(135deg,#3b5b92,#253c68);}' +
          '.td-btn.random{background:linear-gradient(135deg,#c8a45c,#a9833a);}' +
          '.td-btn.dare{background:linear-gradient(135deg,#b85f4a,#8d3d31);}' +
          '.td-hint{min-height:20px;text-align:center;font-size:13px;color:var(--text-muted);}' +
          '.td-history-wrap{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:12px;box-sizing:border-box;box-shadow:var(--shadow-sm);}' +
          '.td-history-title{font-size:13px;font-weight:800;margin-bottom:8px;color:var(--text-muted);}' +
          '.td-history{display:flex;flex-direction:column;gap:7px;max-height:190px;overflow:auto;}' +
          '.td-history-empty{text-align:center;color:var(--text-muted);font-size:13px;padding:10px 0;}' +
          '.td-history-row{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start;padding:8px 10px;border-radius:12px;background:var(--bg);font-size:13px;line-height:1.45;}' +
          '.td-history-badge{font-size:12px;font-weight:900;color:#fff;border-radius:999px;padding:2px 8px;background:#1a1a1a;}' +
          '.td-history-badge.truth{background:#3b5b92;}.td-history-badge.dare{background:#b85f4a;}' +
          '.td-history-meta{color:var(--text-muted);font-size:12px;margin-top:2px;}' +
          '@keyframes tdPop{0%{transform:scale(.98);opacity:.85;}60%{transform:scale(1.015);}100%{transform:scale(1);opacity:1;}}' +
          '@media(max-width:520px){.td-actions{grid-template-columns:1fr;}.td-card-text{font-size:22px;}.td-hero h2{font-size:23px;}.td-card{min-height:200px;}}');
    },

    render: function(state, container, playerIndex) {
      var cardEl = document.getElementById('tdCard');
      var typeEl = document.getElementById('tdCardType');
      var textEl = document.getElementById('tdCardText');
      var deckEl = document.getElementById('tdCardDeck');
      var hintEl = document.getElementById('tdHint');
      var historyEl = document.getElementById('tdHistory');

      if (state && state.currentCard && cardEl && typeEl && textEl && deckEl) {
        var card = state.currentCard;
        cardEl.className = 'td-card ' + card.kind + ' pop';
        setTimeout(function() { if (cardEl) cardEl.classList.remove('pop'); }, 360);
        typeEl.textContent = card.kind === 'truth' ? t('td_truth') : t('td_dare');
        textEl.textContent = card.text;
        var playerName = window.getPlayerName ? window.getPlayerName(card.player) : t('player') + (card.player + 1);
        deckEl.textContent = playerName + ' ' + t('td_drawn_by') + ' · ' + (card.deckName || card.deck || t('td_deck_default'));
      }

      if (hintEl) {
        var deckCount = state && state.enabledDecks ? state.enabledDecks.length : 0;
        hintEl.textContent = tf('td_decks_enabled', deckCount);
      }

      if (historyEl) {
        var history = state && Array.isArray(state.history) ? state.history : [];
        if (history.length === 0) {
          historyEl.innerHTML = '<div class="td-history-empty">' + t('td_history_empty') + '</div>';
        } else {
          historyEl.innerHTML = history.map(function(card) {
            var label = card.kind === 'truth' ? t('td_truth') : t('td_dare');
            var playerName = window.getPlayerName ? window.getPlayerName(card.player) : t('player') + (card.player + 1);
            return '<div class="td-history-row">' +
              '<span class="td-history-badge ' + card.kind + '">' + label + '</span>' +
              '<div><div>' + escapeHtml(card.text) + '</div>' +
              '<div class="td-history-meta">' + escapeHtml(card.deckName || card.deck || t('td_deck_default')) + ' · ' +
                escapeHtml(playerName) + '</div></div>' +
              '</div>';
          }).join('');
        }
      }
    }
  });

  window._tdDraw = function(kind) {
    window.makeGameMove({ action: 'draw', kind: kind });
  };

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
})();
