// public/js/renderers/rummikub.js
// 拉密 / 魔力桥 (Rummikub) renderer — with table manipulation, break-aware, clickable targets
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var selectedTiles = {};
  var _targetSet = null;       // clicked table set index for adding 1 tile
  // ---- manipulate (box-based) state ----
  var _boxes = [];             // array of groups (each an array of tiles), seeded from the table
  var _handBox = [];           // tiles kept in hand during manipulate
  var _sel = {};               // selected tile ids (across all boxes + hand)
  var _manipInit = false;      // whether boxes have been seeded for this manipulate session

  // Client-side set validity (mirrors games/rummikub.js) for live colour feedback
  function clientValidSet(tiles) {
    if (!tiles || tiles.length < 3) return false;
    var nonWild = tiles.filter(function(t){ return !t.wild; });
    if (nonWild.length === 0) return false;
    var nums = nonWild.map(function(t){ return t.num; });
    var colors = nonWild.map(function(t){ return t.color; });
    var uniqNums = {}, uniqColors = {};
    nums.forEach(function(n){ uniqNums[n] = 1; });
    colors.forEach(function(c){ uniqColors[c] = 1; });
    var wilds = tiles.length - nonWild.length;
    // group: same number, distinct colours, 3-4 tiles
    if (Object.keys(uniqNums).length === 1) {
      if (Object.keys(uniqColors).length !== nonWild.length) return false;
      return tiles.length >= 3 && tiles.length <= 4;
    }
    // run: same colour, consecutive (wilds fill gaps)
    if (Object.keys(uniqColors).length === 1) {
      var sorted = nums.slice().sort(function(a,b){ return a-b; });
      for (var i = 1; i < sorted.length; i++) { if (sorted[i] === sorted[i-1]) return false; }
      var gaps = 0;
      for (var k = 1; k < sorted.length; k++) gaps += sorted[k] - sorted[k-1] - 1;
      if (gaps > wilds) return false;
      return tiles.length <= 13;
    }
    return false;
  }

  var STYLES = '' +
    '.rk-game{width:100%;display:flex;flex-direction:column;gap:8px;}' +
    '.rk-opponents{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}' +
    '.rk-opp{background:var(--bg);border-radius:14px;padding:10px 14px;text-align:center;min-width:75px;border:2px solid transparent;}' +
    '.rk-opp.active{border-color:var(--accent);background:var(--surface);animation:pulse 2s ease infinite;}' +
    '.rk-opp .rk-opp-name{font-size:13px;font-weight:600;}' +
    '.rk-opp .rk-opp-count{font-size:20px;font-weight:800;}' +
    '.rk-opp .rk-opp-badge{font-size:11px;color:var(--accent);}' +
    '.rk-table-area{background:var(--bg);border-radius:16px;padding:12px;min-height:60px;display:flex;flex-direction:column;gap:10px;align-items:stretch;}' +
    '.rk-table-set{display:flex;gap:3px;padding:6px;background:var(--surface);width:100%;box-sizing:border-box;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;border-radius:10px;border:2px solid var(--border);position:relative;cursor:pointer;transition:border-color .2s;}' +
    '.rk-table-set:hover{border-color:var(--accent);}' +
    '.rk-table-set.target{border-color:var(--accent);box-shadow:0 0 0 3px rgba(200,164,92,0.3);}' +
    '.rk-table-set.set-invalid{border-color:#e74c3c;}' +
    '.rk-tile{width:38px;height:54px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;box-shadow:0 2px 5px rgba(0,0,0,.12);flex-shrink:0;cursor:pointer;transition:transform .12s,box-shadow .12s;position:relative;}' +
    '.rk-tile:active{transform:scale(.93);}' +
    '.rk-tile.selected{transform:translateY(-10px);box-shadow:0 6px 14px rgba(0,0,0,.25);}' +
    '.rk-tile .rk-num{font-size:22px;line-height:1;}' +
    '.rk-tile .rk-color-dot{width:8px;height:8px;border-radius:50%;margin-top:3px;}' +
    '.rk-tile-joker{background:linear-gradient(145deg,#c8a45c,#a8863a);color:#fff;}' +
    '.rk-tile-black{background:linear-gradient(145deg,#444,#222);color:#fff;}' +
    '.rk-tile-blue{background:linear-gradient(145deg,#2980b9,#1a5276);color:#fff;}' +
    '.rk-tile-red{background:linear-gradient(145deg,#e74c3c,#922b21);color:#fff;}' +
    '.rk-tile-orange{background:linear-gradient(145deg,#e67e22,#935116);color:#fff;}' +
    '.rk-hand-wrap{overflow:visible;padding:4px 2px;margin:0 -4px;}' +
    '.rk-hand{display:flex;flex-wrap:wrap;gap:5px;min-height:70px;padding:4px;}' +
    '.rk-info{display:flex;justify-content:space-between;align-items:center;padding:4px 0;}' +
    '.rk-info .rk-break{font-size:12px;font-weight:600;padding:4px 12px;border-radius:12px;}' +
    '.rk-info .rk-break.done{background:var(--accent-dim);color:var(--accent);}' +
    '.rk-info .rk-break.need{background:#ffeaea;color:#e74c3c;}' +
    '.rk-pool-info{font-size:13px;color:var(--text-muted);}' +
    '.rk-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}' +
    '.rk-status{text-align:center;font-size:14px;color:var(--text-muted);min-height:20px;}' +
    '.rk-set-idx{position:absolute;top:-8px;right:-6px;background:var(--accent);color:#fff;font-size:10px;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;}' +
    '.rk-workspace{background:var(--bg);border-radius:16px;border:2px dashed var(--accent);padding:12px;min-height:50px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;}' +
    '.rk-ws-label{width:100%;font-size:12px;color:var(--accent);font-weight:600;margin-bottom:2px;}' +
    '.rk-manip-group{display:flex;gap:3px;padding:6px;background:var(--surface);border-radius:10px;border:2px solid var(--accent);position:relative;}' +
    '.rk-table-set.sel-target{border-color:#5a9e6f;box-shadow:0 0 0 3px rgba(90,158,111,0.3);}' +
    '.rk-boxes{display:flex;flex-wrap:wrap;gap:10px;width:100%;}' +
    '.rk-box{display:flex;flex-wrap:wrap;gap:3px;padding:8px;min-width:58px;min-height:62px;background:var(--surface);border-radius:10px;border:2px solid var(--border);align-items:center;cursor:pointer;position:relative;transition:border-color .15s,box-shadow .15s;}' +
    '.rk-box.ok{border-color:#5a9e6f;box-shadow:0 0 0 2px rgba(90,158,111,.18);}' +
    '.rk-box.bad{border-color:#e74c3c;box-shadow:0 0 0 2px rgba(231,76,60,.18);}' +
    '.rk-box.empty{border-style:dashed;color:var(--text-muted);font-size:12px;justify-content:center;}' +
    '.rk-box-new{border-style:dashed;border-color:var(--accent);color:var(--accent);font-size:13px;font-weight:600;justify-content:center;min-width:96px;cursor:pointer;}' +
    '.rk-handbox{width:100%;border-style:dashed;border-color:var(--accent);background:var(--accent-dim);min-height:70px;}' +
    '.rk-box-tag{position:absolute;top:-9px;left:6px;background:var(--text-muted);color:#fff;font-size:9px;padding:1px 6px;border-radius:8px;font-weight:600;}' +
    '.rk-box.ok .rk-box-tag{background:#5a9e6f;}' +
    '.rk-box.bad .rk-box-tag{background:#e74c3c;}' +
    '@media(max-width:400px){.rk-table-area{padding:8px;gap:8px;}.rk-table-set{padding:5px;}.rk-tile{width:34px;height:48px;}.rk-tile .rk-num{font-size:17px;}}' +
    '@media(max-width:360px){.rk-tile{width:30px;height:44px;}.rk-tile .rk-num{font-size:15px;}}' +
    '@media(max-width:320px){.rk-tile{width:28px;height:40px;}.rk-tile .rk-num{font-size:14px;}}';

  var COLOR_CSS = {
    black: 'rk-tile-black', blue: 'rk-tile-blue',
    red: 'rk-tile-red', orange: 'rk-tile-orange'
  };

  window.gameRenderers.set('rummikub', {
    init: function(container) {
      if (!document.getElementById('rkStyles')) {
        var s = document.createElement('style'); s.id = 'rkStyles'; s.textContent = STYLES;
        document.head.appendChild(s);
      }
      selectedTiles = {};
      _targetSet = null;
      _boxes = [];
      _handBox = [];
      _sel = {};
      _manipInit = false;
      container.innerHTML =
        '<div class="rk-game">' +
          '<div class="rk-opponents" id="rkOpps"></div>' +
          '<div class="rk-info">' +
            '<span class="rk-break" id="rkBreakBadge" style="display:none"></span>' +
            '<span class="rk-pool-info" id="rkPoolInfo">' + _tf('rk_pool', 0) + '</span>' +
          '</div>' +
          '<div class="rk-table-area" id="rkTable"><div style="color:var(--text-muted);font-size:13px;padding:8px;">' + _t('rk_table_placeholder') + '</div></div>' +
          '<div class="rk-hand-wrap" id="rkHandWrap"><div class="rk-hand" id="rkHand"></div></div>' +
          '<div class="rk-actions" id="rkActions">' +
            '<button class="btn btn-primary btn-sm" id="rkPlayBtn">' + _t('rk_play') + '</button>' +
            '<button class="btn btn-accent btn-sm" id="rkManipBtn" style="display:none">' + _t('rk_manipulate') + '</button>' +
            '<button class="btn btn-outline btn-sm" id="rkEndTurnBtn" style="display:none">' + _t('rk_end_turn') + '</button>' +
            '<button class="btn btn-outline btn-sm" id="rkDrawBtn">' + _t('rk_draw_end') + '</button>' +
          '</div>' +
          '<div class="rk-status" id="rkStatus"></div>' +
        '</div>';

      // Play button
      document.getElementById('rkPlayBtn').addEventListener('click', function() {
        var ids = Object.keys(selectedTiles);
if (ids.length === 0) { showToast(_t('rk_select_tiles_first')); return; }
        var data = { tileIds: ids };
        if (ids.length === 1 && _targetSet !== null) {
          data.targetSet = _targetSet;
        }
        selectedTiles = {};
        _targetSet = null;
        window.makeGameMove(data);
      });

      // Manipulate button
      document.getElementById('rkManipBtn').addEventListener('click', function() {
        window.makeGameMove({ action: 'start_manipulate' });
      });

      // End turn button
      document.getElementById('rkEndTurnBtn').addEventListener('click', function() {
        window.makeGameMove({ endTurn: true });
      });

      // Draw button
      document.getElementById('rkDrawBtn').addEventListener('click', function() {
        selectedTiles = {};
        _targetSet = null;
        _selWorkspace = {};
        _manipGroups = [];
        window.makeGameMove({ pass: true });
      });
    },

    render: function(state, container, playerIndex, winner) {
      if (!state || !state.hands || state.hands.length === 0) return;
      renderOpponents(state, playerIndex);
      if (state.phase === 'manipulate' && state.currentPlayer === playerIndex) {
        renderManipulate(state, playerIndex);
      } else {
        _manipInit = false; // leaving manipulate; reseed next time
        renderInfo(state, playerIndex);
        renderTable(state, playerIndex);
        renderHand(state, playerIndex);
        renderActions(state, playerIndex);
      }
      renderStatus(state, playerIndex);
    }
  });

  // ---- MANIPULATE MODE (box-based: each set is its own box; move tiles by select→target) ----
  function seedBoxes(state, selfIdx) {
    _boxes = (state.table || []).map(function(set){ return set.slice(); });
    _handBox = (state.hands[selfIdx] || []).slice();
    _sel = {};
    _manipInit = true;
  }

  function moveSelectedTo(target) { // target: 'hand' or a box index
    var moving = [];
    var pull = function(arr) {
      for (var i = arr.length - 1; i >= 0; i--) {
        if (_sel[arr[i].id]) { moving.unshift(arr[i]); arr.splice(i, 1); }
      }
    };
    for (var b = 0; b < _boxes.length; b++) pull(_boxes[b]);
    pull(_handBox);
    if (moving.length === 0) return false;
    if (target === 'hand') { _handBox = _handBox.concat(moving); }
    else { _boxes[target] = _boxes[target].concat(moving); }
    _sel = {};
    return true;
  }

  function renderManipulate(state, selfIdx) {
    if (!_manipInit) seedBoxes(state, selfIdx);
    var poolEl = document.getElementById('rkPoolInfo');
    if (poolEl) poolEl.textContent = _tf('rk_pool', state.pool ? state.pool.length : 0);

    var tableEl = document.getElementById('rkTable');
    if (tableEl) {
      var html = '<div class="rk-ws-label">' + _t('rk_manip_instructions') + '</div>';
      html += '<div class="rk-boxes">';
      for (var i = 0; i < _boxes.length; i++) {
        var box = _boxes[i];
        var cls = box.length === 0 ? 'empty' : (clientValidSet(box) ? 'ok' : 'bad');
        html += '<div class="rk-box ' + cls + '" data-box="' + i + '">';
        html += '<span class="rk-box-tag">' + (box.length === 0 ? _t('rk_empty') : box.length + _t('rk_tiles_suffix')) + '</span>';
        for (var t = 0; t < box.length; t++) html += tileHTML(box[t], _sel[box[t].id]);
        if (box.length === 0) html += _t('rk_drop_here');
        html += '</div>';
      }
      html += '<div class="rk-box rk-box-new" data-newbox="1">' + _t('rk_new_group') + '</div>';
      html += '</div>';
      html += '<div class="rk-ws-label" style="margin-top:10px;">' + _t('rk_manip_hand_label') + '</div>';
      html += '<div class="rk-box rk-handbox" data-hand="1">';
      for (var h = 0; h < _handBox.length; h++) html += tileHTML(_handBox[h], _sel[_handBox[h].id]);
      html += '</div>';
      tableEl.innerHTML = html;

      if (state.currentPlayer === selfIdx) {
        // tile selection
        var tiles = tableEl.querySelectorAll('.rk-tile[data-id]');
        for (var j = 0; j < tiles.length; j++) {
          (function(el, id) {
            el.addEventListener('click', function(e) {
              e.stopPropagation();
              var targetBox = el.closest('.rk-box');
              if (Object.keys(_sel).length > 0 && !_sel[id] && targetBox) {
                var target = targetBox.dataset.hand ? 'hand' : parseInt(targetBox.dataset.box, 10);
                if (target === 'hand' || !isNaN(target)) {
                  if (moveSelectedTo(target)) renderManipulate(state, selfIdx);
                  return;
                }
              }
              if (_sel[id]) delete _sel[id]; else _sel[id] = true;
              renderManipulate(state, selfIdx);
            });
          })(tiles[j], tiles[j].dataset.id);
        }
        // box drop targets
        var boxEls = tableEl.querySelectorAll('.rk-box[data-box]');
        for (var k = 0; k < boxEls.length; k++) {
          (function(el, idx) {
            el.addEventListener('click', function() { if (moveSelectedTo(idx)) renderManipulate(state, selfIdx); });
          })(boxEls[k], parseInt(boxEls[k].dataset.box));
        }
        var newBox = tableEl.querySelector('.rk-box-new');
        if (newBox) newBox.addEventListener('click', function() {
          _boxes.push([]);
          moveSelectedTo(_boxes.length - 1);
          renderManipulate(state, selfIdx);
        });
        var handDrop = tableEl.querySelector('.rk-handbox');
        if (handDrop) handDrop.addEventListener('click', function() { if (moveSelectedTo('hand')) renderManipulate(state, selfIdx); });
      }
    }

    var handEl = document.getElementById('rkHand');
    if (handEl) handEl.innerHTML = '';

    var actEl = document.getElementById('rkActions');
    if (actEl) {
      actEl.innerHTML =
        '<button class="btn btn-accent btn-sm" id="rkSubmitBtn">' + _t('rk_submit') + '</button>' +
        '<button class="btn btn-outline btn-sm" id="rkCancelBtn">' + _t('rk_cancel') + '</button>';
      if (state.currentPlayer === selfIdx) {
        document.getElementById('rkSubmitBtn').addEventListener('click', function() {
          var groups = _boxes.filter(function(b){ return b.length > 0; });
          for (var g = 0; g < groups.length; g++) {
            if (!clientValidSet(groups[g])) { showToast(_t('rk_invalid_groups')); return; }
          }
          if (groups.length === 0) { showToast(_t('rk_min_one_group')); return; }
          window.makeGameMove({ action: 'submit', groups: groups.map(function(b){ return b.slice(); }) });
          _manipInit = false;
        });
        document.getElementById('rkCancelBtn').addEventListener('click', function() {
          window.makeGameMove({ action: 'cancel' });
          _manipInit = false;
        });
      }
    }
  }

  // ---- OPPONENTS ----
  function renderOpponents(state, selfIdx) {
    var el = document.getElementById('rkOpps');
    if (!el) return;
    var html = '';
    for (var i = 0; i < state.hands.length; i++) {
      if (i === selfIdx) continue;
      var count = state.hands[i] ? state.hands[i].length : 0;
      var active = i === state.currentPlayer ? ' active' : '';
      var brokenHtml = '';
      if (state.requireBreak) {
        brokenHtml = state.hasBroken && state.hasBroken[i]
          ? '<div class="rk-opp-badge">' + _t('rk_broken_badge') + '</div>'
          : '<div style="font-size:11px;color:var(--text-muted)">' + _t('rk_not_broken_badge') + '</div>';
      }
      html += '<div class="rk-opp' + active + '"><div class="rk-opp-name">' +
        (window.getPlayerName ? window.getPlayerName(i) : (_t('rk_player_prefix') + ' ' + (i + 1))) + '</div>' +
        '<div class="rk-opp-count">' + count + '</div>' + brokenHtml + '</div>';
    }
    el.innerHTML = html;
  }

  // ---- INFO BAR ----
  function renderInfo(state, selfIdx) {
    var badge = document.getElementById('rkBreakBadge');
    if (badge) {
      if (!state.requireBreak) {
        badge.style.display = 'none';
      } else {
        badge.style.display = '';
        if (state.hasBroken && state.hasBroken[selfIdx]) {
          badge.className = 'rk-break done'; badge.textContent = _t('rk_broken_done');
        } else {
          badge.className = 'rk-break need'; badge.textContent = _t('rk_need_break');
        }
      }
    }
    var pi = document.getElementById('rkPoolInfo');
    if (pi) pi.textContent = _tf('rk_pool', state.pool ? state.pool.length : 0);
  }

  // ---- TABLE RENDER ----
  function renderTable(state, selfIdx) {
    var el = document.getElementById('rkTable');
    if (!el) return;
    if (!state.table || state.table.length === 0) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px;">' + _t('rk_table_placeholder') + '</div>';
      return;
    }
    var isMyTurn = state.currentPlayer === selfIdx && state.winner === null;
    var selCount = Object.keys(selectedTiles).length;
    var html = '';
    for (var s = 0; s < state.table.length; s++) {
      var set = state.table[s];
      var targetClass = (_targetSet === s) ? ' sel-target' : '';
      var clickable = (isMyTurn && selCount === 1) ? ' data-set="' + s + '"' : '';
      html += '<div class="rk-table-set' + targetClass + '"' + clickable + '><span class="rk-set-idx">' + s + '</span>';
      for (var t = 0; t < set.length; t++) {
        html += tileHTML(set[t], false);
      }
      html += '</div>';
    }
    el.innerHTML = html;

    // Attach click handlers for table sets (target selection for 1-tile add)
    if (isMyTurn && selCount === 1) {
      var sets = el.querySelectorAll('.rk-table-set[data-set]');
      for (var i = 0; i < sets.length; i++) {
        (function(el, idx) {
          el.addEventListener('click', function(e) {
            // Don't trigger if clicking on a tile inside
            if (e.target.closest('.rk-tile')) return;
            _targetSet = (_targetSet === idx) ? null : idx;
            renderTable(state, selfIdx);
          });
        })(sets[i], parseInt(sets[i].dataset.set));
      }
    }
  }

  function tileHTML(tile, isSelected) {
    var cls = tile.wild ? 'rk-tile-joker' : (COLOR_CSS[tile.color] || '');
    if (isSelected) cls += ' selected';
    return '<div class="rk-tile ' + cls + '" data-id="' + tile.id + '">' +
      '<div class="rk-num">' + (tile.wild ? '★' : tile.num) + '</div></div>';
  }

  // ---- HAND ----
  function renderHand(state, selfIdx) {
    var el = document.getElementById('rkHand');
    if (!el) return;
    var hand = state.hands[selfIdx];
    if (!hand || hand.length === 0) { el.innerHTML = ''; return; }
    var isMyTurn = state.currentPlayer === selfIdx && state.winner === null;
    var html = '';
    for (var i = 0; i < hand.length; i++) {
      var c = hand[i];
      var sel = selectedTiles[c.id] ? true : false;
      html += tileHTML(c, sel);
    }
    el.innerHTML = html;

    if (isMyTurn) {
      var tiles = el.children;
      for (var j = 0; j < tiles.length; j++) {
        (function(el, tile) {
          el.addEventListener('click', function() {
            if (selectedTiles[tile.id]) {
              delete selectedTiles[tile.id];
            } else {
              selectedTiles[tile.id] = true;
            }
            // Re-render to update selection and table target availability
            renderHand(state, selfIdx);
            renderTable(state, selfIdx);
          });
        })(tiles[j], hand[j]);
      }
    }

  }

  // ---- ACTIONS ----
  function ensureActionButtons() {
    var actions = document.getElementById('rkActions');
    if (!actions || document.getElementById('rkPlayBtn')) return;
    actions.innerHTML =
      '<button class="btn btn-primary btn-sm" id="rkPlayBtn">' + _t('rk_play') + '</button>' +
      '<button class="btn btn-accent btn-sm" id="rkManipBtn">' + _t('rk_manipulate_short') + '</button>' +
      '<button class="btn btn-outline btn-sm" id="rkEndTurnBtn">' + _t('rk_end_turn') + '</button>' +
      '<button class="btn btn-outline btn-sm" id="rkDrawBtn">' + _t('rk_draw_end') + '</button>';
    document.getElementById('rkPlayBtn').addEventListener('click', function() {
      var ids = Object.keys(selectedTiles);
      if (ids.length === 0) { showToast(_t('rk_select_tiles_first')); return; }
      var data = { tileIds: ids };
      if (ids.length === 1 && _targetSet !== null) data.targetSet = _targetSet;
      selectedTiles = {}; _targetSet = null; window.makeGameMove(data);
    });
    document.getElementById('rkManipBtn').addEventListener('click', function() { window.makeGameMove({ action: 'start_manipulate' }); });
    document.getElementById('rkEndTurnBtn').addEventListener('click', function() { window.makeGameMove({ endTurn: true }); });
    document.getElementById('rkDrawBtn').addEventListener('click', function() { selectedTiles = {}; _targetSet = null; window.makeGameMove({ pass: true }); });
  }

  function renderActions(state, selfIdx) {
    ensureActionButtons();
    var playBtn = document.getElementById('rkPlayBtn');
    var manipBtn = document.getElementById('rkManipBtn');
    var endBtn = document.getElementById('rkEndTurnBtn');
    var drawBtn = document.getElementById('rkDrawBtn');

    var isMyTurn = state.currentPlayer === selfIdx && state.winner === null;
    var hasPlayed = state.playedThisTurn && state.playedThisTurn[selfIdx];
    var hasTable = state.table && state.table.length > 0;

    if (playBtn) playBtn.style.display = isMyTurn ? '' : 'none';
    if (manipBtn) manipBtn.style.display = (isMyTurn && hasTable) ? '' : 'none';
    if (endBtn) endBtn.style.display = (isMyTurn && hasPlayed) ? '' : 'none';
    if (drawBtn) drawBtn.style.display = (isMyTurn && !hasPlayed) ? '' : 'none';

    if (drawBtn && isMyTurn) {
      drawBtn.textContent = _t('rk_draw_end');
    }
  }

  // ---- STATUS ----
  function renderStatus(state, selfIdx) {
    var el = document.getElementById('rkStatus');
    if (!el) return;
    if (state.winner !== null) {
      el.textContent = state.winner === selfIdx ? _t('rk_you_win') :
        (window.getPlayerName ? window.getPlayerName(state.winner) : (_t('rk_player_prefix') + ' ' + (state.winner + 1))) + ' ' + _t('rk_rummikub');
    } else if (state.currentPlayer === selfIdx) {
      if (state.requireBreak && state.hasBroken && !state.hasBroken[selfIdx]) {
        el.textContent = _t('rk_break_requirement');
      } else {
        el.textContent = _t('rk_turn_prompt');
      }
    } else {
      el.textContent = _t('rk_waiting');
    }
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.classList.remove('show'); }, 2000);
  }
})();
