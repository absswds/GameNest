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
  var _sortByNum = false;      // hand sort mode: false = colour then number (server order), true = number first

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

  // Look: green felt table that fills the stage, ivory tiles (coloured number + dot), wooden rack for the hand.
  var STYLES = '' +
    '.rk-game{--tw:36px;--th:50px;--tf:20px;--hw:42px;--hh:58px;--hf:24px;width:100%;max-width:1000px;margin:0 auto;display:flex;flex-direction:column;gap:8px;min-height:420px;}' +
    '.rk-opponents{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}' +
    '.rk-opp{background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:4px 12px 4px 6px;display:flex;align-items:center;gap:8px;transition:border-color .2s,box-shadow .2s;}' +
    '.rk-opp.active{border-color:var(--ge-gold,#b9954f);box-shadow:0 0 0 3px rgba(185,149,79,.18);}' +
    '.rk-opp .rk-opp-name{font-size:13px;font-weight:600;}' +
    '.rk-opp .rk-opp-count{display:flex;align-items:center;justify-content:center;min-width:24px;height:30px;padding:0 4px;border-radius:5px;font-size:14px;font-weight:800;color:#5b4a2c;background:linear-gradient(180deg,#f6efde,#e4d7b8);box-shadow:0 2px 0 #c9b98f;order:-1;}' +
    '.rk-opp .rk-opp-badge{font-size:11px;color:var(--ge-gold,#b9954f);font-weight:600;}' +
    '.rk-info{display:flex;align-items:center;gap:8px;padding:0 2px;}' +
    '.rk-info .rk-break{font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;}' +
    '.rk-info .rk-break.done{background:var(--accent-dim);color:var(--accent);}' +
    '.rk-info .rk-break.need{background:rgba(231,76,60,.12);color:#d9473a;}' +
    '.rk-pool-info{font-size:13px;color:var(--text-muted);margin-left:auto;display:flex;align-items:center;gap:6px;}' +
    '.rk-pool-info::before{content:"";width:12px;height:16px;border-radius:3px;background:linear-gradient(180deg,#f6efde,#e4d7b8);box-shadow:0 2px 0 #c9b98f;}' +
    '.rk-table-area{flex:1 1 auto;min-height:160px;overflow:auto;border-radius:16px;padding:16px 12px 12px;display:flex;flex-wrap:wrap;gap:16px 12px;align-items:flex-start;align-content:flex-start;' +
      'background:radial-gradient(ellipse at 50% 40%,#2f5a40 0%,#234731 60%,#1a3626 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),inset 0 6px 24px rgba(0,0,0,.35);}' +
    '.rk-table-area:has(>.rk-empty){align-content:center;justify-content:center;}.rk-empty{margin:auto;color:rgba(233,217,168,.55);font-size:14px;letter-spacing:.08em;text-align:center;}' +
    '.rk-table-set{display:flex;gap:3px;padding:5px;background:rgba(0,0,0,.18);max-width:100%;box-sizing:border-box;flex-wrap:wrap;border-radius:10px;border:1.5px solid rgba(255,255,255,.08);position:relative;transition:border-color .2s,box-shadow .2s;}' +
    '.rk-table-set[data-set]{cursor:pointer;border-style:dashed;border-color:rgba(233,217,168,.45);}' +
    '.rk-table-set.sel-target{border-style:solid;border-color:#7fd19a;box-shadow:0 0 0 3px rgba(127,209,154,.25);}' +
    '.rk-table-set.set-invalid{border-color:#e74c3c;}' +
    '.rk-set-idx{position:absolute;top:-8px;left:-6px;background:#e9d9a8;color:#2a2418;font-size:10px;min-width:16px;height:16px;padding:0 3px;box-sizing:border-box;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;}' +
    '.rk-tile{width:var(--tw);height:var(--th);border-radius:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-weight:900;background:linear-gradient(180deg,#fffdf6 0%,#f4ecda 100%);border:1px solid rgba(60,45,20,.18);box-shadow:0 3px 0 #cdbf9f,0 4px 8px rgba(0,0,0,.22);flex-shrink:0;cursor:pointer;position:relative;font-family:"Nunito",system-ui,sans-serif;transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s;user-select:none;-webkit-user-select:none;}' +
    '.rk-tile::after{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.85;}' +
    '.rk-tile .rk-num{font-size:var(--tf);line-height:1;}' +
    '.rk-tile:active{transform:scale(.95);}' +
    '.rk-tile.selected{transform:translateY(-10px);box-shadow:0 3px 0 #cdbf9f,0 12px 18px rgba(0,0,0,.3),0 0 0 2px var(--ge-gold,#d4b06a);}' +
    '.rk-tile-joker{color:#c0392b;}.rk-tile-joker .rk-num{background:linear-gradient(135deg,#c0392b,#c7741a 50%,#1f5f99);-webkit-background-clip:text;background-clip:text;color:transparent;}' +
    '.rk-tile-black{color:#1c1b19;}.rk-tile-blue{color:#1f63a8;}.rk-tile-red{color:#c63527;}.rk-tile-orange{color:#d27a12;}' +
    '.rk-status{text-align:center;font-size:13px;color:var(--text-muted);min-height:20px;}' +
    '.rk-status.mine{color:var(--text);font-weight:600;}' +
    '.rk-hand-wrap{position:relative;padding:10px 10px 14px;border-radius:14px;background:linear-gradient(180deg,#9a6a40 0%,#7b4f2c 55%,#5f3b20 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 6px 14px rgba(0,0,0,.18);}' +
    '.rk-hand-wrap::after{content:"";position:absolute;left:8px;right:8px;bottom:6px;height:4px;border-radius:2px;background:rgba(0,0,0,.25);}' +
    '.rk-hand{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;min-height:var(--hh);padding-top:8px;}' +
    '.rk-hand .rk-tile{width:var(--hw);height:var(--hh);}.rk-hand .rk-tile .rk-num{font-size:var(--hf);}' +
    '.rk-actions{display:flex;gap:8px;justify-content:center;flex-wrap:nowrap;}.rk-actions .btn{flex:1 1 0;width:auto;min-width:0;max-width:240px;min-height:44px;padding:8px 6px;font-size:15px;border-radius:12px;white-space:nowrap;}' +
    '.rk-ws-label{width:100%;font-size:12px;color:#e9d9a8;font-weight:600;}' +
    '.rk-boxes{display:flex;flex-wrap:wrap;gap:14px 10px;width:100%;}' +
    '.rk-box{display:flex;flex-wrap:wrap;gap:3px;padding:6px;min-width:52px;min-height:calc(var(--th) + 12px);background:rgba(0,0,0,.18);border-radius:10px;border:2px solid rgba(255,255,255,.15);align-items:center;cursor:pointer;position:relative;transition:border-color .15s,box-shadow .15s;box-sizing:border-box;}' +
    '.rk-box.ok{border-color:#7fd19a;box-shadow:0 0 0 2px rgba(127,209,154,.2);}' +
    '.rk-box.bad{border-color:#ff7a6b;box-shadow:0 0 0 2px rgba(255,122,107,.2);}' +
    '.rk-box.empty{border-style:dashed;color:rgba(233,217,168,.6);font-size:12px;justify-content:center;}' +
    '.rk-box-new{border-style:dashed;border-color:rgba(233,217,168,.6);color:#e9d9a8;font-size:13px;font-weight:600;justify-content:center;min-width:96px;}' +
    '.rk-handbox{width:100%;border:none;background:linear-gradient(180deg,#9a6a40,#6b4426);min-height:calc(var(--hh) + 16px);padding:8px;}.rk-handbox .rk-tile{width:var(--hw);height:var(--hh);}.rk-handbox .rk-tile .rk-num{font-size:var(--hf);}' +
    '.rk-box-tag{position:absolute;top:-9px;left:6px;background:#8a8270;color:#fff;font-size:9px;padding:1px 6px;border-radius:8px;font-weight:600;}' +
    '.rk-box.ok .rk-box-tag{background:#3f8a57;}.rk-box.bad .rk-box-tag{background:#d9473a;}' +
    '@media(hover:hover){.rk-table-set[data-set]:hover{border-color:#e9d9a8;}.rk-hand .rk-tile:hover:not(.selected){transform:translateY(-3px);}}' +
    '@media(max-width:600px){.rk-game{--tw:30px;--th:42px;--tf:17px;--hw:36px;--hh:50px;--hf:20px;gap:6px;}.rk-table-area{padding:14px 8px 8px;gap:14px 8px;}.rk-hand-wrap{padding:8px 6px 12px;}.rk-hand{gap:4px;}}' +
    '@media(max-width:380px){.rk-game{--tw:26px;--th:38px;--tf:15px;--hw:31px;--hh:44px;--hf:18px;}.rk-hand{gap:3px;}}';

  var COLOR_CSS = {
    black: 'rk-tile-black', blue: 'rk-tile-blue',
    red: 'rk-tile-red', orange: 'rk-tile-orange'
  };

  window.gameRenderers.set('rummikub', {
    init: function(container) {
      injectStylesOnce('rkStyles', STYLES);
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
            '<button class="btn btn-outline btn-sm" id="rkSortBtn" style="min-height:30px;padding:2px 10px;font-size:12px;">' + _t('rk_sort') + '</button>' +
          '</div>' +
          '<div class="rk-table-area" id="rkTable"><div class="rk-empty">' + _t('rk_table_placeholder') + '</div></div>' +
          '<div class="rk-status" id="rkStatus"></div>' +
          '<div class="rk-hand-wrap" id="rkHandWrap"><div class="rk-hand" id="rkHand"></div></div>' +
          '<div class="rk-actions" id="rkActions">' +
            '<button class="btn btn-primary btn-sm" id="rkPlayBtn">' + _t('rk_play') + '</button>' +
            '<button class="btn btn-accent btn-sm" id="rkManipBtn" style="display:none">' + _t('rk_manipulate') + '</button>' +
            '<button class="btn btn-outline btn-sm" id="rkEndTurnBtn" style="display:none">' + _t('rk_end_turn') + '</button>' +
            '<button class="btn btn-outline btn-sm" id="rkDrawBtn">' + _t('rk_draw_end') + '</button>' +
          '</div>' +
        '</div>';

      fitHeight(container);
      if (window._rkResize) window.removeEventListener('resize', window._rkResize);
      window._rkResize = function() { fitHeight(container); };
      window.addEventListener('resize', window._rkResize);

      document.getElementById('rkSortBtn').addEventListener('click', function() {
        _sortByNum = !_sortByNum;
        if (window.rkLastState) renderHand(window.rkLastState.s, window.rkLastState.i);
      });

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
        window.makeGameMove({ pass: true });
      });
    },

    render: function(state, container, playerIndex, winner) {
      if (!state || !state.hands || state.hands.length === 0) return;
      window.rkLastState = { s: state, i: playerIndex };
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
      el.innerHTML = '<div class="rk-empty">' + _t('rk_table_placeholder') + '</div>';
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
    var hand = (state.hands[selfIdx] || []).slice();
    if (_sortByNum) hand.sort(function(a, b) { return (a.wild ? 99 : a.num) - (b.wild ? 99 : b.num); });
    if (hand.length === 0) { el.innerHTML = ''; return; }
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
    el.classList.toggle('mine', state.winner === null && state.currentPlayer === selfIdx);
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

  // The game column fills the height left below the stage header, so the felt table grows instead of leaving blank space
  function fitHeight(container) {
    var game = container.querySelector('.rk-game');
    if (!game || !window.boardFit) return;
    game.style.height = Math.max(420, Math.floor(window.boardFit(container).h)) + 'px';
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.classList.remove('show'); }, 2000);
  }
})();
