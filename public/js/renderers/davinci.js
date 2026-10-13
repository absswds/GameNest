// public/js/renderers/davinci.js
// 达芬奇密码 - Deduction game renderer with wild cards & penalty phase
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  var _state = null;
  var _selTarget = -1;
  var _selTileIdx = -1;
  var _selNum = 0;
  var _selJoker = false;
  var _cssAdded = false;

  function addStyles() {
    if (_cssAdded) return;
    _cssAdded = true;
    injectStylesOnce('davinci-styles',
'.dv-game{width:100%;display:flex;flex-direction:column;gap:10px;}' +
'.dv-player-section{padding:10px 12px;background:var(--bg);border-radius:16px;transition:opacity .2s;}' +
'.dv-player-section.dv-eliminated{opacity:.45;}' +
'.dv-player-section.dv-penalty{border:2px solid #e74c3c;}' +
'.dv-player-label{font-size:13px;font-weight:600;margin-bottom:6px;color:var(--text-muted);}' +
'.dv-player-section:first-child .dv-player-label{color:var(--text);}' +
'.dv-tile-row{display:flex;gap:5px;flex-wrap:wrap;}' +
'.dv-tile{width:46px;height:64px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;font-weight:700;transition:transform .12s,box-shadow .2s;flex-shrink:0;}' +
'.dv-tile:active{transform:scale(.94);}' +
'.dv-tile-white{background:linear-gradient(145deg,#fafafa,#e8e8e8);color:#333;border:1px solid #ddd;box-shadow:0 1px 3px rgba(0,0,0,.08);}' +
'.dv-tile-black{background:linear-gradient(145deg,#444,#222);color:#fff;border:1px solid #555;box-shadow:0 1px 3px rgba(0,0,0,.25);}' +
'.dv-tile-hidden{background:linear-gradient(145deg,#666,#444);color:#fff;border:1px solid #777;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.2);}' +
'.dv-tile-hidden:active{background:linear-gradient(145deg,#777,#555);}' +
'@media (hover:hover){.dv-tile-hidden:hover{background:linear-gradient(145deg,#777,#555);}}' +
'.dv-tile-revealed-self{box-shadow:0 0 0 2px #3498db,0 0 6px rgba(52,152,219,.4);}' +
'.dv-tile-color{font-size:9px;text-transform:uppercase;opacity:.7;line-height:1;}' +
'.dv-tile-num{font-size:22px;font-weight:800;line-height:1;margin-top:2px;}' +
'.dv-drawn{text-align:center;padding:10px;background:var(--accent-dim);border-radius:16px;}' +
'.dv-drawn-label{font-size:13px;color:var(--text-muted);margin-bottom:6px;}' +
'.dv-drawn .dv-tile{margin:0 auto;width:56px;height:72px;font-size:15px;}' +
'.dv-drawn .dv-tile-num{font-size:26px;}' +
'.dv-guess{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:16px;display:none;}' +
'.dv-guess-title{font-size:15px;font-weight:600;text-align:center;margin-bottom:10px;}' +
'.dv-guess-targets{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}' +
'.dv-guess-tile-grid{display:flex;gap:4px;justify-content:center;margin-bottom:10px;}' +
'.dv-guess-grid-tile{width:38px;height:52px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;cursor:pointer;transition:transform .12s,box-shadow .15s;}' +
'.dv-guess-grid-tile.selected{box-shadow:0 0 0 2px var(--accent);transform:scale(1.08);}' +
'.dv-guess-grid-tile.hidden{background:#555;color:#fff;}' +
'.dv-guess-grid-tile.revealed{opacity:.3;cursor:default;}' +
'.dv-color-row{display:flex;gap:8px;justify-content:center;margin-bottom:10px;}' +
'.dv-color-btn{padding:8px 20px;border-radius:12px;border:2px solid var(--border);font-size:14px;font-weight:600;cursor:pointer;transition:all .15s;flex:1;max-width:120px;}' +
'.dv-color-btn.selected{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent);}' +
'.dv-color-white{background:#f5f5f5;color:#333;}' +
'.dv-color-black{background:#333;color:#fff;}' +
'.dv-num-row{display:flex;gap:4px;justify-content:center;flex-wrap:wrap;margin-bottom:10px;}' +
'.dv-num-btn{width:32px;height:40px;border-radius:6px;border:1px solid var(--border);background:var(--bg);font-size:14px;font-weight:600;cursor:pointer;transition:all .12s;display:flex;align-items:center;justify-content:center;}' +
'.dv-num-btn:active{transform:scale(.9);}' +
'.dv-num-btn.selected{border-color:var(--accent);background:var(--accent-dim);box-shadow:0 0 0 1px var(--accent);}' +
'.dv-guess-actions{display:flex;gap:8px;}' +
'.dv-draw-btn{align-self:center;padding:6px 18px;font-size:13px;}' +
'.dv-place-btn{width:32px;height:64px;border:2px dashed var(--accent);border-radius:6px;background:var(--bg);cursor:pointer;font-weight:700;font-size:18px;color:var(--accent);display:flex;align-items:center;justify-content:center;}' +
'.dv-status{text-align:center;font-size:14px;color:var(--text-muted);padding:4px 0;min-height:22px;}' +
'.dv-target-info{text-align:center;font-size:14px;font-weight:500;margin-bottom:8px;color:var(--accent);}' +
'.dv-penalty-msg{text-align:center;font-size:15px;font-weight:700;color:#e74c3c;padding:8px 0;}' +
'.dv-penalty-hint{text-align:center;font-size:12px;color:var(--text-muted);}');
  }

  function tileClass(tile) {
    // Jokers keep their black/white color (no gold)
    return tile.color === 'white' ? 'dv-tile-white' : 'dv-tile-black';
  }

  function tileLabel(tile) {
    // Own tiles: show color + number (or ★ for joker). Owner sees the color of their joker.
    if (tile.wild) return '<span class="dv-tile-color">' + tile.color[0].toUpperCase() + '</span><span class="dv-tile-num" style="font-size:18px">★</span>';
    return '<span class="dv-tile-color">' + tile.color[0].toUpperCase() + '</span><span class="dv-tile-num">' + tile.num + '</span>';
  }

  // Opponent tile: color public, number hidden (show "?").
  // Jokers are indistinguishable from normal tiles — only color + "?" visible.
  function tileLabelHiddenNum(tile) {
    return '<span class="dv-tile-color">' + tile.color[0].toUpperCase() + '</span><span class="dv-tile-num">?</span>';
  }

  function buildPlayersUI(state, playerIndex) {
    var playersArea = document.getElementById('dvPlayers');
    if (!playersArea) return;

    playersArea.innerHTML = '';
    var inPenalty = (state.phase === 'penalty' && state.penaltyPlayer === playerIndex);

    for (var p = 0; p < state.tiles.length; p++) {
      (function(pIdx) {
        var tiles = state.tiles[pIdx];
        var rev = state.numRevealed && state.numRevealed[pIdx];
        var elim = state.eliminated && state.eliminated[pIdx];
        var isMe = pIdx === playerIndex;

        var section = document.createElement('div');
        section.className = 'dv-player-section' + (elim ? ' dv-eliminated' : '');

        var label = document.createElement('div');
        label.className = 'dv-player-label';
        var pName = (window.gamePlayers && window.gamePlayers[pIdx]) ? window.gamePlayers[pIdx].name : (_t('dv_player_fallback') + (pIdx + 1));
        label.textContent = isMe ? _t('dv_your_cards') : (pName + (elim ? _t('dv_eliminated') : ''));
        section.appendChild(label);

        var row = document.createElement('div');
        row.className = 'dv-tile-row';

        for (var t = 0; t < tiles.length; t++) {
          (function(tIdx) {
            var tile = tiles[tIdx];
            var isRev = rev && rev[tIdx];
            var tileEl = document.createElement('div');
            tileEl.className = 'dv-tile';

            if (isMe) {
              // Own tiles: color + number always visible; jokers show color + ★ (not gold)
              if (tile.wild) {
                tileEl.classList.add(tile.color === 'white' ? 'dv-tile-white' : 'dv-tile-black');
              } else {
                tileEl.classList.add(tileClass(tile));
              }
              // Highlight tiles that have been revealed (visible to others)
              if (isRev) tileEl.classList.add('dv-tile-revealed-self');
              tileEl.innerHTML = tileLabel(tile);
            } else if (isRev) {
              // Opponent tile with number revealed: jokers keep color + ★ (no gold)
              if (tile.wild) {
                tileEl.classList.add(tile.color === 'white' ? 'dv-tile-white' : 'dv-tile-black');
              } else {
                tileEl.classList.add(tileClass(tile));
              }
              tileEl.innerHTML = tileLabel(tile);
            } else {
              // Opponent tile: color PUBLIC, number hidden, joker looks like normal tile
              tileEl.classList.add(tile.color === 'white' ? 'dv-tile-white' : 'dv-tile-black');
              tileEl.innerHTML = tileLabelHiddenNum(tile);
              tileEl.addEventListener('click', function() {
                if (state.currentPlayer !== playerIndex) return;
                if (state.phase !== 'guess') return;
                _selTarget = pIdx;
                _selTileIdx = tIdx;
                selectTarget(state);
              });
            }

            // Penalty phase: own unrevealed tiles become clickable
            if (isMe && !isRev && inPenalty) {
              tileEl.style.cursor = 'pointer';
              tileEl.classList.add(tileClass(tile));
              tileEl.innerHTML = tileLabel(tile);
              tileEl.addEventListener('click', function() {
                window.makeGameMove({ revealIndex: tIdx });
              });
            }

            row.appendChild(tileEl);
          })(t);
        }

        section.appendChild(row);

        // Penalty hint for own section
        if (isMe && inPenalty) {
          var hint = document.createElement('div');
          hint.className = 'dv-penalty-hint';
          hint.textContent = _t('dv_penalty_hint');
          section.appendChild(hint);
        }

        playersArea.appendChild(section);
      })(p);
    }
  }

  function buildDrawnTile(state, playerIndex) {
    var drawnDiv = document.getElementById('dvDrawn');
    var drawnContent = document.getElementById('dvDrawnContent');
    if (!drawnDiv || !drawnContent) return;

    var showDrawn = (state.currentPlayer === playerIndex &&
        (state.phase === 'guess' || state.phase === 'penalty') &&
        state.drawnTile && state.drawnTile.color !== undefined);

    if (showDrawn) {
      drawnDiv.style.display = 'block';
      var dt = state.drawnTile;
      drawnContent.className = 'dv-tile ' + tileClass(dt);
      drawnContent.innerHTML = tileLabel(dt);
    } else {
      drawnDiv.style.display = 'none';
    }
  }

  function buildPenaltyMsg(state, playerIndex) {
    var el = document.getElementById('dvPenaltyMsg');
    if (!el) return;

    el.style.display = 'none';
  }

  function buildGuessPanel(state, playerIndex) {
    var guessDiv = document.getElementById('dvGuess');
    if (!guessDiv) return;

    var isMyTurn = state.currentPlayer === playerIndex;
    var shouldShow = isMyTurn && state.phase === 'guess' && state.winner === null;

    if (shouldShow) {
      guessDiv.style.display = 'block';

      var targetInfo = document.getElementById('dvTargetInfo');
      if (_selTarget >= 0 && _selTileIdx >= 0) {
        var tgt = state.tiles[_selTarget][_selTileIdx];
        targetInfo.textContent = _t('dv_guess_prefix') + (window.getPlayerName ? window.getPlayerName(_selTarget) : (_t('dv_player_fallback') + (_selTarget + 1))) + _t('dv_position') + (_selTileIdx + 1);
      } else {
        targetInfo.textContent = _t('dv_select_target_hint');
      }

      // Tile grid for target (color public, number hidden unless revealed)
      if (_selTarget >= 0 && _selTarget < state.tiles.length) {
        var tileGrid = document.getElementById('dvGuessGrid');
        tileGrid.innerHTML = '';
        var tgtTiles = state.tiles[_selTarget];
        var tgtRev = state.numRevealed[_selTarget];

        for (var tg = 0; tg < tgtTiles.length; tg++) {
          (function(tgIdx) {
            var gTile = document.createElement('div');
            var isRev = tgtRev && tgtRev[tgIdx];
            gTile.className = 'dv-guess-grid-tile';
            if (isRev) {
              gTile.classList.add('revealed');
              const tt = tgtTiles[tgIdx];
              gTile.classList.add(tt.wild ? (tt.color === 'white' ? 'dv-tile-white' : 'dv-tile-black') : tileClass(tt));
              gTile.innerHTML = tileLabel(tt);
            } else {
              gTile.classList.add(tgtTiles[tgIdx].color === 'white' ? 'dv-tile-white' : 'dv-tile-black');
              gTile.innerHTML = tileLabelHiddenNum(tgtTiles[tgIdx]);
              if (tgIdx === _selTileIdx) gTile.classList.add('selected');
              gTile.addEventListener('click', function() {
                _selTileIdx = tgIdx;
                selectTarget(state);
              });
            }
            tileGrid.appendChild(gTile);
          })(tg);
        }
      }
    } else {
      guessDiv.style.display = 'none';
    }
  }

  function buildDrawButton(state, playerIndex) {
    var drawBtn = document.getElementById('dvDrawBtn');
    if (!drawBtn) return;

    if (state.phase === 'place' && state.currentPlayer === playerIndex) {
      drawBtn.style.display = 'none';
      return;
    }

    if (state.currentPlayer === playerIndex &&
        state.phase === 'draw' &&
        state.winner === null) {
      drawBtn.style.display = 'block';
    } else {
      drawBtn.style.display = 'none';
    }
  }

  function buildPlaceUI(state, playerIndex) {
    var placeDiv = document.getElementById('dvPlace');
    var slotsDiv = document.getElementById('dvPlaceSlots');
    if (!placeDiv || !slotsDiv) return;

    var isPlace = state.phase === 'place' && state.currentPlayer === playerIndex &&
        state.winner === null && state.drawnTile;
    var isInitPlace = state.phase === 'init_place' && state.currentPlayer === playerIndex &&
        state.winner === null && state.initJokerQueue && state.initJokerQueue.length > 0;

    if (isPlace || isInitPlace) {
      placeDiv.style.display = 'block';
      var allTiles = state.tiles[playerIndex];
      // For init_place, hide the joker being placed so player sees where to insert it
      var jokerTileId = isInitPlace ? state.initJokerQueue[0].jokerTileId : null;
      var tiles = jokerTileId
        ? allTiles.filter(function(t) { return t.id !== jokerTileId; })
        : allTiles;
      var html = '';

      html += '<button class="dv-place-btn" onclick="window.makeGameMove({placeIndex:0})">←</button>';

      for (var t = 0; t < tiles.length; t++) {
        var tile = tiles[t];
        html += '<div class="dv-tile ' + tileClass(tile) + '" style="width:46px;height:64px;">' + tileLabel(tile) + '</div>';
        html += '<button class="dv-place-btn" onclick="window.makeGameMove({placeIndex:' + (t + 1) + '})">→</button>';
      }

      slotsDiv.innerHTML = html;
    } else {
      placeDiv.style.display = 'none';
    }
  }

  function buildStatus(state, playerIndex) {
    var statusEl = document.getElementById('dvStatus');
    if (!statusEl) return;

    if (state.winner !== null) {
      if (state.winner === playerIndex) statusEl.textContent = _t('dv_you_win');
      else if (state.winner === -1) statusEl.textContent = _t('dv_draw');
      else statusEl.textContent = _t('dv_game_over');
    } else if (state.phase === 'init_place') {
      if (state.currentPlayer === playerIndex) {
        statusEl.textContent = _t('dv_init_place_hint');
      } else {
        statusEl.textContent = _t('dv_waiting_init_place');
      }
    } else if (state.lastGuessResult && state.lastGuessResult.correct) {
      if (state.lastGuessResult.guesser === playerIndex) {
        statusEl.textContent = _t('dv_guess_correct');                       // you guessed right
      } else if (state.lastGuessResult.targetPlayer === playerIndex) {
        var cnt = state.guessCount ? state.guessCount[playerIndex] : 0;
        statusEl.textContent = _tf('dv_your_tile_guessed', cnt);             // your tile was guessed (with count)
      } else {
        statusEl.textContent = _tf('dv_tile_guessed', (window.getPlayerName ? window.getPlayerName(state.lastGuessResult.targetPlayer) : (_t('dv_player_fallback') + (state.lastGuessResult.targetPlayer + 1))));
      }
    } else if (state.lastGuessResult && !state.lastGuessResult.correct) {
      if (state.lastGuessResult.guesser === playerIndex) {
        statusEl.textContent = _t('dv_guess_wrong');                          // you guessed wrong
      } else {
        statusEl.textContent = _tf('dv_guess_failed', (window.getPlayerName ? window.getPlayerName(state.lastGuessResult.guesser) : (_t('dv_player_fallback') + (state.lastGuessResult.guesser + 1))));
      }
    } else if (state.currentPlayer === playerIndex) {
      if (state.phase === 'place') statusEl.textContent = _t('dv_place_joker');
      else if (state.phase === 'guess') statusEl.textContent = _t('dv_guess_or_pass');
      else statusEl.textContent = _t('dv_please_draw');
    } else {
      statusEl.textContent = _t('dv_waiting');
    }
  }

  function selectTarget(state) {
    var targetInfo = document.getElementById('dvTargetInfo');
    if (targetInfo) {
      targetInfo.textContent = _t('dv_guess_prefix') + _t('dv_player_fallback') + (_selTarget + 1) + _t('dv_position') + (_selTileIdx + 1);
    }
    if (state && state.tiles && _selTarget >= 0) {
      var tileGrid = document.getElementById('dvGuessGrid');
      if (tileGrid) {
        tileGrid.innerHTML = '';
        var tgtTiles = state.tiles[_selTarget];
        var tgtRev = state.numRevealed[_selTarget];
        for (var tg = 0; tg < tgtTiles.length; tg++) {
          (function(tgIdx) {
            var gTile = document.createElement('div');
            var isRev = tgtRev && tgtRev[tgIdx];
            gTile.className = 'dv-guess-grid-tile';
            if (isRev) {
              gTile.classList.add('revealed');
              const tt = tgtTiles[tgIdx];
              gTile.classList.add(tt.wild ? (tt.color === 'white' ? 'dv-tile-white' : 'dv-tile-black') : tileClass(tt));
              gTile.innerHTML = tileLabel(tt);
            } else {
              gTile.classList.add(tgtTiles[tgIdx].color === 'white' ? 'dv-tile-white' : 'dv-tile-black');
              gTile.innerHTML = tileLabelHiddenNum(tgtTiles[tgIdx]);
              if (tgIdx === _selTileIdx) gTile.classList.add('selected');
              gTile.addEventListener('click', function() {
                _selTileIdx = tgIdx;
                selectTarget(state);
              });
            }
            tileGrid.appendChild(gTile);
          })(tg);
        }
      }
    }
  }

  function mergeState(incoming) {
    if (!incoming) return _state;
    if (_state && _state.winner !== null && incoming.winner === null) {
      _state = null;
    }
    if (incoming.tiles && incoming.tiles.length > 0) {
      _state = incoming;
      return _state;
    }
    if (!_state) {
      _state = {};
      for (var k in incoming) _state[k] = incoming[k];
      return _state;
    }
    if (incoming.currentPlayer !== undefined) _state.currentPlayer = incoming.currentPlayer;
    if (incoming.winner !== undefined) _state.winner = incoming.winner;
    if (incoming.phase !== undefined) _state.phase = incoming.phase;
    if (incoming.penaltyPlayer !== undefined) _state.penaltyPlayer = incoming.penaltyPlayer;
    if (incoming.lastGuessResult !== undefined) _state.lastGuessResult = incoming.lastGuessResult;
    return _state;
  }

  window.gameRenderers.set('davinci', {
    init: function(container) {
      _state = null;
      _selTarget = -1;
      _selTileIdx = -1;
      _selNum = 0;
      _selJoker = false;
      addStyles();

      container.innerHTML =
'<div class="dv-game" id="dvGame">' +
  '<div class="dv-penalty-msg" id="dvPenaltyMsg" style="display:none"></div>' +
  '<div class="dv-players" id="dvPlayers"></div>' +
  '<button class="btn btn-primary btn-sm dv-draw-btn" id="dvDrawBtn" style="display:none">' + _t('dv_draw') + '</button>' +
  '<div class="dv-drawn" id="dvDrawn" style="display:none">' +
    '<div class="dv-drawn-label">' + _t('dv_drawn_label') + '</div>' +
    '<div class="dv-tile" id="dvDrawnContent"></div>' +
  '</div>' +
  '<div id="dvPlace" style="display:none;background:var(--accent-dim);border-radius:16px;padding:12px;text-align:center;margin:8px 0;">' +
    '<div style="font-size:14px;font-weight:600;margin-bottom:8px;">' + _t('dv_place_joker') + '</div>' +
    '<div id="dvPlaceSlots" style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;"></div>' +
  '</div>' +
  '<div class="dv-guess" id="dvGuess">' +
    '<div class="dv-guess-title">' + _t('dv_guess_title') + '</div>' +
    '<div class="dv-target-info" id="dvTargetInfo">' + _t('dv_select_target_hint') + '</div>' +
    '<div class="dv-guess-tile-grid" id="dvGuessGrid"></div>' +
    '<div class="dv-num-row" id="dvNumRow"></div>' +
    '<div class="dv-guess-actions">' +
      '<button class="btn btn-primary btn-sm" id="dvGuessBtn">' + _t('dv_guess_btn') + '</button>' +
      '<button class="btn btn-warning btn-sm" id="dvGuessJokerBtn">' + _t('dv_guess_joker') + '</button>' +
      '<button class="btn btn-outline btn-sm" id="dvPassBtn">' + _t('dv_pass') + '</button>' +
    '</div>' +
  '</div>' +
  '<div class="dv-status" id="dvStatus"></div>' +
'</div>';

      // Draw button
      document.getElementById('dvDrawBtn').addEventListener('click', function() {
        window.makeGameMove({});
      });

      // Number buttons (0-11)
      var numRow = document.getElementById('dvNumRow');
      for (var n = 0; n <= 11; n++) {
        (function(nVal) {
          var btn = document.createElement('button');
          btn.className = 'dv-num-btn' + (nVal === 0 ? ' selected' : '');
          btn.textContent = nVal;
          btn.addEventListener('click', function() {
            document.querySelectorAll('.dv-num-btn').forEach(function(b) { b.classList.remove('selected'); });
            this.classList.add('selected');
            _selNum = nVal;
            _selJoker = false;
          });
          numRow.appendChild(btn);
        })(n);
      }

      // Guess number button (continueGuess: true lets player keep guessing after correct)
      document.getElementById('dvGuessBtn').addEventListener('click', function() {
        if (_selTarget < 0 || _selTileIdx < 0) return;
        window.makeGameMove({
          targetPlayer: _selTarget,
          tileIndex: _selTileIdx,
          guessNum: _selNum,
          continueGuess: true,
        });
      });

      // Guess joker button
      document.getElementById('dvGuessJokerBtn').addEventListener('click', function() {
        if (_selTarget < 0 || _selTileIdx < 0) return;
        window.makeGameMove({
          targetPlayer: _selTarget,
          tileIndex: _selTileIdx,
          guessJoker: true,
          continueGuess: true,
        });
      });

      // Pass button
      document.getElementById('dvPassBtn').addEventListener('click', function() {
        window.makeGameMove({ pass: true });
      });
    },

    render: function(state, container, playerIndex, winner) {
      state = mergeState(state);
      if (!state) return;
      if (!state.tiles || state.tiles.length === 0) return;

      buildPenaltyMsg(state, playerIndex);
      buildPlayersUI(state, playerIndex);
      buildDrawnTile(state, playerIndex);
      buildGuessPanel(state, playerIndex);
      buildDrawButton(state, playerIndex);
      buildPlaceUI(state, playerIndex);
      buildStatus(state, playerIndex);
    }
  });
})();
