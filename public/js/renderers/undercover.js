// Who Is the Undercover (谁是卧底) renderer.
// Exposes window.renderUndercover(board, state, myIdx, makeMove).

(function () {
  var STYLE_ID = 'undercover-renderer-style';
  var wordVisible = true;
  var tickTimer = null;

  var ROLE_COLORS = {
    civilian: '#5b9bd5',
    undercover: '#d9534f',
    blank: '#b983ff',
  };

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      '.uc-wrap{width:100%;max-width:860px;margin:0 auto;padding:10px;color:var(--text);font-family:inherit;display:flex;flex-direction:column;gap:10px;box-sizing:border-box;container-type:inline-size;overflow-x:hidden;}',
      '.uc-main{display:flex;flex-direction:column;gap:10px;width:100%;min-width:0;box-sizing:border-box;}',
      '.uc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-radius:var(--ge-radius-lg,12px);background:var(--surface);border:1px solid var(--border);flex-wrap:wrap;}',
      '.uc-round-badge{font-size:13px;font-weight:700;padding:4px 10px;border-radius:999px;background:var(--accent-dim);color:#8a6a1f;}',
      '.uc-phase-title{font-size:15px;font-weight:700;color:var(--text);}',
      '.uc-timer{font-variant-numeric:tabular-nums;font-size:14px;font-weight:700;padding:4px 10px;border-radius:999px;background:var(--accent-dim);color:#8a6a1f;}',
      '.uc-word-banner{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:var(--ge-radius-lg,12px);background:linear-gradient(135deg,#fbf3df,#fff);border:1px solid rgba(200,164,92,.55);box-sizing:border-box;}',
      '.uc-word-banner.is-blank{background:linear-gradient(135deg,#f1e8ff,#fff);border-color:rgba(150,100,220,.45);}',
      '.uc-word-text{font-size:18px;font-weight:800;letter-spacing:.3px;color:#5c4310;word-break:break-word;min-width:0;flex:1;}',
      '.uc-word-sub{font-size:12px;opacity:.78;margin-top:2px;font-weight:400;}',
      '.uc-eye-btn{min-height:44px;min-width:44px;padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;flex-shrink:0;transition:background var(--dur-fast,150ms) var(--ease-out,ease-out);}',
      '.uc-eye-btn:hover{background:var(--accent-dim);}',
      '.uc-panel{padding:10px 12px;border-radius:var(--ge-radius-lg,12px);background:var(--surface);border:1px solid var(--border);display:flex;flex-direction:column;gap:8px;box-sizing:border-box;}',
      '.uc-action-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}',
      '.uc-prompt{font-size:14px;color:var(--text);min-width:0;flex:1;}',
      '.uc-btn{min-height:44px;padding:10px 16px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;transition:transform var(--dur-fast,150ms) var(--ease-out,ease-out),background var(--dur-fast,150ms) var(--ease-out,ease-out);box-sizing:border-box;}',
      '.uc-btn:hover{background:var(--accent-dim);}',
      '.uc-btn:active{transform:scale(.98);}',
      '.uc-btn.uc-primary{background:linear-gradient(135deg,#c99b3b,#a67822);border-color:#e0b85c;color:#fff;font-weight:700;}',
      '.uc-seats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;width:100%;box-sizing:border-box;}',
      '.uc-seat{position:relative;padding:10px;border-radius:10px;background:var(--surface);border:1.5px solid var(--border);display:flex;flex-direction:column;gap:6px;min-height:76px;box-sizing:border-box;min-width:0;transition:border-color var(--dur-fast,150ms) var(--ease-out,ease-out),background var(--dur-fast,150ms) var(--ease-out,ease-out);}',
      '.uc-seat.is-me{border-color:var(--accent);}',
      '.uc-seat.is-speaking{border-color:#5bc0de;box-shadow:0 0 0 2px rgba(91,192,222,.28);background:#eef9fd;}',
      '.uc-seat.is-dead{opacity:.48;filter:grayscale(.7);}',
      '.uc-seat-top{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0;}',
      '.uc-num{font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px;background:var(--bg);color:var(--text-muted);flex-shrink:0;}',
      '.uc-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}',
      '.uc-tags{display:flex;gap:4px;flex-wrap:wrap;align-items:center;}',
      '.uc-tag{font-size:11px;padding:2px 6px;border-radius:5px;background:var(--bg);color:var(--text-muted);font-weight:600;}',
      '.uc-tag.role-badge{color:#fff;}',
      '.uc-tag.spk-badge{background:#dff3fa;color:#1d6f8a;}',
      '.uc-tag.voted-badge{background:#e2f3e5;color:#2f7a45;}',
      '.uc-seat-speech{font-size:12px;color:var(--text);background:var(--bg);padding:5px 8px;border-radius:6px;word-break:break-word;line-height:1.35;}',
      '.uc-vote-btn{min-height:44px;width:100%;margin-top:auto;padding:8px 10px;border-radius:8px;border:1px solid var(--accent);background:var(--accent-dim);color:#7a5a14;font-size:13px;font-weight:700;cursor:pointer;transition:background var(--dur-fast,150ms) var(--ease-out,ease-out);}',
      '.uc-vote-btn:hover{background:#f3e6c6;}',
      '.uc-speeches-box{padding:10px 12px;border-radius:var(--ge-radius-lg,12px);background:var(--surface);border:1px solid var(--border);display:flex;flex-direction:column;gap:6px;max-height:190px;overflow-y:auto;box-sizing:border-box;}',
      '.uc-speeches-title{font-size:12px;font-weight:700;opacity:.75;text-transform:uppercase;letter-spacing:.4px;}',
      '.uc-speech-item{font-size:13px;line-height:1.45;padding:5px 8px;border-radius:6px;background:var(--bg);word-break:break-word;}',
      '.uc-speech-item.is-current{border-left:3px solid #5bc0de;background:#eef9fd;}',
      '.uc-speech-item .uc-sp-who{font-weight:700;color:#8a6a1f;margin-right:6px;}',
      '.uc-chat-dock{display:none;gap:8px;align-items:center;padding:8px 10px;border-radius:var(--ge-radius-lg,12px);background:var(--surface);border:1px solid var(--accent);box-sizing:border-box;}',
      '.uc-chat-dock.is-active{display:flex;}',
      '.uc-chat-input{flex:1;min-width:0;min-height:44px;padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:14px;box-sizing:border-box;}',
      '.uc-wrap.uc-compact{padding:6px;gap:6px;}',
      '.uc-wrap.uc-compact .uc-word-banner{padding:8px 10px;}',
      '.uc-wrap.uc-compact .uc-word-text{font-size:15px;}',
      '.uc-wrap.uc-compact .uc-speeches-box{max-height:110px;}',
      '@container (max-width: 480px){.uc-seats{grid-template-columns:repeat(2,minmax(0,1fr));}.uc-word-text{font-size:16px;}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function t(k) {
    var fn = window._t;
    var s = fn ? fn(k) : k;
    for (var i = 1; i < arguments.length; i++) {
      s = String(s).replace('%s', arguments[i]);
    }
    return s;
  }

  function pName(i) {
    if (typeof window.getPlayerName === 'function') return window.getPlayerName(i);
    if (typeof window.playerName === 'function') return window.playerName(i);
    return '#' + (i + 1);
  }

  function roleName(r) {
    return r ? t('uc_role_' + r) : '';
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function phaseTitle(s) {
    if (s.phase === 'over') return t('uc_phase_over');
    if (s.phase === 'speech') {
      return s.speechKind === 'pk' ? t('uc_phase_speech_pk') : t('uc_phase_speech');
    }
    if (s.phase === 'vote') {
      return s.votePk ? t('uc_phase_vote_pk') : t('uc_phase_vote');
    }
    return '';
  }

  function formatLogEntry(e) {
    if (!e) return '';
    switch (e.k) {
      case 'round_start':
        return '── ' + t('uc_log_round', e.round) + ' ──';
      case 'speech':
        return (e.pk ? '[' + t('uc_pk_tag') + '] ' : '') + pName(e.p) + '：' + e.text;
      case 'spoke':
        return (e.pk ? '[' + t('uc_pk_tag') + '] ' : '') + t('uc_log_spoke', pName(e.p));
      case 'tie_pk':
        return t('uc_log_tie_pk', (e.list || []).map(pName).join('、'));
      case 'exile':
        return t('uc_log_exile', pName(e.p), roleName(e.role));
      case 'no_exile':
        return t('uc_log_no_exile');
      case 'win_civilian':
        return t('uc_win_civilian');
      case 'win_undercover':
        return t('uc_win_undercover');
      default:
        return '';
    }
  }

  function renderUndercover(board, state, myIdx, makeMove) {
    injectStyle();
    if (!state || !state.numPlayers) return;

    var f = typeof window.boardFit === 'function' ? window.boardFit(board) : null;
    var isCompact = !!(f && f.h < 440);

    // Build persistent shell once so chat input is never wiped by broadcasts
    if (!board._ucShell) {
      // #boardArea shrinks to its content, and container-type:inline-size makes
      // .uc-wrap's intrinsic width 0, so the host must be given a width.
      board.style.width = '100%';
      board.innerHTML =
        '<div class="uc-wrap" id="ucWrap">' +
          '<div class="uc-main" id="ucMain"></div>' +
          '<div class="uc-chat-dock" id="ucChatDock">' +
            '<input class="uc-chat-input" id="ucChatInput" maxlength="60" autocomplete="off" />' +
            '<button type="button" class="uc-btn uc-primary" id="ucChatSend"></button>' +
          '</div>' +
        '</div>';
      board._ucShell = true;
      var inp = board.querySelector('#ucChatInput');
      var sendBtn = board.querySelector('#ucChatSend');
      var submitChat = function () {
        var v = inp.value.trim();
        if (!v || !board._ucMakeMove) return;
        board._ucMakeMove({ type: 'chat', text: v });
        inp.value = '';
      };
      sendBtn.addEventListener('click', submitChat);
      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.isComposing) {
          ev.preventDefault();
          submitChat();
        }
      });
    }

    board._ucMakeMove = makeMove;
    var wrap = board.querySelector('#ucWrap');
    var main = board.querySelector('#ucMain');
    var chatDock = board.querySelector('#ucChatDock');
    var chatInput = board.querySelector('#ucChatInput');
    var chatSend = board.querySelector('#ucChatSend');

    if (wrap) {
      if (isCompact) wrap.classList.add('uc-compact');
      else wrap.classList.remove('uc-compact');
    }

    var n = state.numPlayers;
    var myAlive = !!(state.alive && state.alive[myIdx]);
    var isBlank = !!(state.isBlank || (state.roles && state.roles[myIdx] === 'blank'));
    var myWord = state.myWord !== undefined && state.myWord !== null
      ? state.myWord
      : (state.words && state.words[myIdx]) || '';

    var curSpeaker = state.phase === 'speech' && state.speakers
      ? state.speakers[state.speakerPos]
      : -1;
    var isMySpeech = state.phase === 'speech' && curSpeaker === myIdx && myAlive;

    // Update persistent chat dock visibility without touching input.value
    if (chatDock && chatInput && chatSend) {
      chatInput.placeholder = t('uc_chat_placeholder');
      chatSend.textContent = t('uc_send_speech');
      if (isMySpeech && state.talkMode === 'chat') {
        chatDock.classList.add('is-active');
      } else {
        chatDock.classList.remove('is-active');
      }
    }

    // 1. Header
    var html = '<div class="uc-head">' +
      '<span class="uc-round-badge">' + esc(t('uc_round_n', state.round || 1)) + '</span>' +
      '<span class="uc-phase-title">' + esc(phaseTitle(state)) + '</span>' +
      '<span class="uc-timer" id="ucTimer"></span>' +
    '</div>';

    // 2. Word Banner + Eye button
    var bannerText = '';
    var bannerSub = '';
    if (!wordVisible) {
      bannerText = t('uc_word_hidden');
      bannerSub = t('uc_word_tap_hint');
    } else if (isBlank) {
      bannerText = t('uc_you_are_blank');
      bannerSub = t('uc_blank_sub');
    } else {
      bannerText = t('uc_your_word_fmt', myWord || '—');
      bannerSub = state.phase === 'over' ? '' : t('uc_word_sub');
    }
    html += '<div class="uc-word-banner' + (isBlank && wordVisible ? ' is-blank' : '') + '">' +
      '<div>' +
        '<div class="uc-word-text">' + esc(bannerText) + '</div>' +
        '<div class="uc-word-sub">' + esc(bannerSub) + '</div>' +
      '</div>' +
      '<button type="button" class="uc-eye-btn" id="ucEyeBtn" aria-label="Toggle word">' +
        '<span>' + (wordVisible ? '👁 ' + esc(t('uc_hide_word')) : '🙈 ' + esc(t('uc_show_word'))) + '</span>' +
      '</button>' +
    '</div>';

    // 3. Action bar (current turn / vote instructions / game over summary)
    html += '<div class="uc-panel"><div class="uc-action-row">';
    if (state.phase === 'over') {
      var winLabel = state.winner === -2 ? t('uc_win_civilian') : t('uc_win_undercover');
      var wordsReveal = (state.civWord || state.ucWord)
        ? t('uc_both_words_fmt', state.civWord || '—', state.ucWord || '—')
        : '';
      html += '<div class="uc-prompt"><b>' + esc(winLabel) + '</b>' + (wordsReveal ? '<div style="margin-top:4px;font-size:13px;color:var(--text-muted);">' + esc(wordsReveal) + '</div>' : '') + '</div>';
    } else if (!myAlive) {
      html += '<div class="uc-prompt">' + esc(t('uc_you_are_out')) + '</div>';
    } else if (state.phase === 'speech') {
      if (isMySpeech) {
        if (state.talkMode === 'chat') {
          html += '<div class="uc-prompt">' + esc(t('uc_your_turn_chat')) + '</div>' +
            '<button type="button" class="uc-btn" data-act="done">' + esc(t('uc_skip_speech')) + '</button>';
        } else {
          html += '<div class="uc-prompt">' + esc(t('uc_your_turn_face')) + '</div>' +
            '<button type="button" class="uc-btn uc-primary" data-act="done">' + esc(t('uc_done_speaking')) + '</button>';
        }
      } else {
        html += '<div class="uc-prompt">' + esc(t('uc_speaking_now', pName(curSpeaker))) + '</div>';
      }
    } else if (state.phase === 'vote') {
      var myVote = state.votes && state.votes[myIdx];
      if (myVote === undefined) {
        html += '<div class="uc-prompt">' + esc(t('uc_vote_prompt')) + '</div>' +
          '<button type="button" class="uc-btn" data-vote="-1">' + esc(t('uc_abstain')) + '</button>';
      } else {
        var votedLabel = myVote === -1
          ? t('uc_voted_abstain')
          : t('uc_voted_for', pName(myVote));
        html += '<div class="uc-prompt">' + esc(votedLabel) + '</div>';
      }
    }
    html += '</div></div>';

    // Find latest speech per seat for current round
    var latestSpeechBySeat = {};
    var speeches = state.speeches || [];
    for (var sIdx = 0; sIdx < speeches.length; sIdx++) {
      var sp = speeches[sIdx];
      if (sp && sp.round === state.round) {
        latestSpeechBySeat[sp.seat] = sp.text ? sp.text : t('uc_spoke_aloud');
      }
    }

    // 4. Player cards grid with vote buttons
    var canVoteNow = state.phase === 'vote' && myAlive && (!state.votes || state.votes[myIdx] === undefined);
    var candSet = new Set(state.voteCandidates || []);
    var votedSet = new Set(state.votedSeats || Object.keys(state.votes || {}).map(Number));

    html += '<div class="uc-seats">';
    for (var i = 0; i < n; i++) {
      var alive = !!(state.alive && state.alive[i]);
      var role = state.roles && state.roles[i];
      var isSpeaking = state.phase === 'speech' && curSpeaker === i;
      var cls = ['uc-seat'];
      if (i === myIdx) cls.push('is-me');
      if (!alive) cls.push('is-dead');
      if (isSpeaking) cls.push('is-speaking');

      var tags = '';
      if (i === myIdx) tags += '<span class="uc-tag">' + esc(t('uc_me')) + '</span>';
      if (isSpeaking) tags += '<span class="uc-tag spk-badge">' + esc(t('uc_speaking_tag')) + '</span>';
      if (state.phase === 'vote' && alive && votedSet.has(i)) {
        tags += '<span class="uc-tag voted-badge">' + esc(t('uc_voted_tag')) + '</span>';
      }
      if (!alive) {
        tags += '<span class="uc-tag">' + esc(t('uc_out_tag')) + '</span>';
      }
      if (role) {
        var rc = ROLE_COLORS[role] || '#666';
        tags += '<span class="uc-tag role-badge" style="background:' + rc + '">' + esc(roleName(role)) + '</span>';
      }
      if (state.phase === 'over' && state.words && state.words[i]) {
        tags += '<span class="uc-tag">' + esc(state.words[i]) + '</span>';
      }

      var seatSpeech = latestSpeechBySeat[i];
      var voteBtnHtml = '';
      if (canVoteNow && alive && i !== myIdx && candSet.has(i)) {
        voteBtnHtml = '<button type="button" class="uc-vote-btn" data-vote="' + i + '">' +
          esc(t('uc_vote_seat', pName(i))) +
        '</button>';
      }

      html += '<div class="' + cls.join(' ') + '">' +
        '<div class="uc-seat-top">' +
          '<span class="uc-num">' + (i + 1) + '</span>' +
          '<span class="uc-name">' + esc(pName(i)) + '</span>' +
        '</div>' +
        '<div class="uc-tags">' + tags + '</div>' +
        (seatSpeech ? '<div class="uc-seat-speech">' + esc(seatSpeech) + '</div>' : '') +
        voteBtnHtml +
      '</div>';
    }
    html += '</div>';

    // 5. Speech & event log list
    html += '<div class="uc-speeches-box">' +
      '<div class="uc-speeches-title">' + esc(t('uc_speeches_title')) + '</div>';
    if (state.phase === 'speech' && curSpeaker >= 0) {
      html += '<div class="uc-speech-item is-current">' +
        '<span class="uc-sp-who">' + esc(pName(curSpeaker)) + '</span>' +
        '<span>' + esc(t('uc_speaking_ellipsis')) + '</span>' +
      '</div>';
    }
    var logs = (state.log || []).slice(-30);
    if (!logs.length) {
      html += '<div class="uc-speech-item">' + esc(t('uc_no_speeches_yet')) + '</div>';
    } else {
      for (var lIdx = logs.length - 1; lIdx >= 0; lIdx--) {
        var line = formatLogEntry(logs[lIdx]);
        if (line) {
          html += '<div class="uc-speech-item">' + esc(line) + '</div>';
        }
      }
    }
    html += '</div>';

    main.innerHTML = html;

    // Bind eye button
    var eyeBtn = main.querySelector('#ucEyeBtn');
    if (eyeBtn) {
      eyeBtn.addEventListener('click', function () {
        wordVisible = !wordVisible;
        renderUndercover(board, state, myIdx, makeMove);
      });
    }

    // Bind done button
    main.querySelectorAll('[data-act="done"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        makeMove({ type: 'done' });
      });
    });

    // Bind vote buttons
    main.querySelectorAll('[data-vote]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = Number(btn.getAttribute('data-vote'));
        makeMove({ type: 'vote', target: target });
      });
    });

    // Countdown timer
    if (tickTimer) clearInterval(tickTimer);
    var timerEl = main.querySelector('#ucTimer');
    var updateClock = function () {
      if (!timerEl) return;
      var end = state.phaseEndsAt || 0;
      if (!end || state.phase === 'over') {
        timerEl.style.display = 'none';
        return;
      }
      var left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      timerEl.style.display = '';
      timerEl.textContent = left + 's';
    };
    updateClock();
    tickTimer = setInterval(updateClock, 500);
  }

  window.renderUndercover = renderUndercover;
  window.gameRenderers = window.gameRenderers || new Map();
  window.gameRenderers.set('undercover', {
    init: function (container) {
      if (container) container._ucShell = false;
      wordVisible = true;
    },
    render: function (state, container, playerIndex) {
      renderUndercover(container, state, playerIndex, function (data) {
        if (typeof window.makeGameMove === 'function') window.makeGameMove(data);
      });
    },
  });
})();
