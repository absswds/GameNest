window.Renderers = window.Renderers || {};

window.Renderers['quizrace'] = (() => {
  const OPTION_LABELS = ['A', 'B', 'C', 'D'];
  const PLAYER_COLORS = [
    '#d97706', '#2563eb', '#16a34a', '#dc2626',
    '#7c3aed', '#0891b2', '#db2777', '#4f46e5',
  ];

  let timerInterval = null;
  let lastQuestionKey = null;
  let lastPhase = null;
  let lastAnsweredMask = '';
  let prevScores = {};
  let resizeBound = false;

  function ensureStyles() {
    if (document.getElementById('qr-styles')) return;
    const st = document.createElement('style');
    st.id = 'qr-styles';
    st.textContent = `
      .qr-wrap {
        width: 100%;
        max-width: 780px;
        margin: 0 auto;
        padding: 12px 14px 16px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: var(--ge-ink, #1e293b);
        user-select: none;
      }
      .qr-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
      }
      .qr-meta-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .qr-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.82rem;
        font-weight: 700;
        background: var(--ge-card-alt, rgba(15, 23, 42, 0.06));
        color: var(--ge-ink, #1e293b);
        border: 1px solid var(--ge-border, rgba(15, 23, 42, 0.1));
      }
      .qr-badge-cat {
        color: var(--ge-primary, #b45309);
      }
      .qr-badge-double {
        background: linear-gradient(135deg, #f59e0b, #dc2626);
        color: #ffffff;
        border-color: transparent;
        box-shadow: 0 2px 8px rgba(220, 38, 38, 0.28);
      }
      .qr-badge-streak {
        background: rgba(217, 119, 6, 0.14);
        color: var(--ge-primary, #b45309);
        border-color: rgba(217, 119, 6, 0.35);
      }
      .qr-timer-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .qr-timer-track {
        flex: 1;
        height: 10px;
        border-radius: 999px;
        background: var(--ge-card-alt, rgba(15, 23, 42, 0.1));
        overflow: hidden;
        position: relative;
      }
      .qr-timer-fill {
        height: 100%;
        width: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--ge-primary, #d97706), #16a34a);
        transition: width 120ms linear, background-color var(--dur-fast, 160ms) ease;
      }
      .qr-timer-fill.is-urgent {
        background: var(--ge-danger, #dc2626);
      }
      .qr-timer-text {
        min-width: 44px;
        text-align: right;
        font-weight: 800;
        font-size: 0.95rem;
        font-variant-numeric: tabular-nums;
        color: var(--ge-ink, #1e293b);
      }
      .qr-timer-text.is-urgent {
        color: var(--ge-danger, #dc2626);
      }
      .qr-question-card {
        position: relative;
        background: var(--ge-card, #ffffff);
        border: 1px solid var(--ge-border, rgba(15, 23, 42, 0.12));
        border-radius: var(--ge-radius, 14px);
        padding: 18px 18px;
        box-shadow: var(--ge-shadow-sm, 0 2px 10px rgba(0, 0, 0, 0.05));
        text-align: center;
      }
      .qr-question-text {
        font-size: clamp(1.12rem, 2.6vw, 1.45rem);
        font-weight: 800;
        line-height: 1.4;
        color: var(--ge-ink, #0f172a);
        margin: 0;
        word-break: break-word;
      }
      .qr-status-banner {
        margin-top: 8px;
        font-size: 0.86rem;
        font-weight: 600;
        color: var(--ge-muted, #64748b);
      }
      .qr-answered-strip {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 4px 0;
      }
      .qr-avatar-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 9px 4px 5px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 600;
        background: var(--ge-card, #ffffff);
        border: 1px solid var(--ge-border, rgba(15, 23, 42, 0.12));
        color: var(--ge-muted, #64748b);
        transition: transform var(--dur-fast, 160ms) var(--ease-out, ease),
                    border-color var(--dur-fast, 160ms) ease,
                    background-color var(--dur-fast, 160ms) ease;
      }
      .qr-avatar-chip.has-answered {
        border-color: var(--ge-ok, #16a34a);
        background: rgba(22, 163, 74, 0.08);
        color: var(--ge-ink, #0f172a);
      }
      .qr-avatar-dot {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.72rem;
        font-weight: 800;
        color: #ffffff;
        flex-shrink: 0;
      }
      .qr-avatar-check {
        font-size: 0.75rem;
        font-weight: 800;
        color: var(--ge-ok, #16a34a);
      }
      .qr-options-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        width: 100%;
      }
      .qr-option-btn {
        position: relative;
        min-height: 58px;
        padding: 12px 14px;
        border-radius: var(--ge-radius, 12px);
        border: 2px solid var(--ge-border, rgba(15, 23, 42, 0.14));
        background: var(--ge-card, #ffffff);
        color: var(--ge-ink, #0f172a);
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
        font-family: inherit;
        font-size: clamp(0.95rem, 2vw, 1.08rem);
        font-weight: 700;
        cursor: pointer;
        box-sizing: border-box;
        box-shadow: var(--ge-shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.04));
        transition: transform var(--dur-fast, 150ms) var(--ease-out, ease),
                    border-color var(--dur-fast, 150ms) ease,
                    background-color var(--dur-fast, 150ms) ease,
                    box-shadow var(--dur-fast, 150ms) ease;
      }
      .qr-option-btn:hover:not(:disabled) {
        border-color: var(--ge-primary, #d97706);
        transform: translateY(-1px);
      }
      .qr-option-btn:active:not(:disabled) {
        transform: translateY(0);
      }
      .qr-option-btn:disabled {
        cursor: default;
      }
      .qr-option-btn.is-selected {
        border-color: var(--ge-primary, #d97706);
        background: rgba(217, 119, 6, 0.1);
        box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.22);
      }
      .qr-option-btn.is-correct {
        border-color: var(--ge-ok, #16a34a) !important;
        background: rgba(22, 163, 74, 0.14) !important;
        color: #14532d !important;
      }
      .qr-option-btn.is-wrong {
        border-color: var(--ge-danger, #dc2626) !important;
        background: rgba(220, 38, 38, 0.13) !important;
        color: #7f1d1d !important;
      }
      .qr-option-letter {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: var(--ge-card-alt, rgba(15, 23, 42, 0.07));
        color: var(--ge-ink, #0f172a);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.9rem;
        flex-shrink: 0;
      }
      .qr-option-btn.is-selected .qr-option-letter {
        background: var(--ge-primary, #d97706);
        color: #ffffff;
      }
      .qr-option-btn.is-correct .qr-option-letter {
        background: var(--ge-ok, #16a34a);
        color: #ffffff;
      }
      .qr-option-btn.is-wrong .qr-option-letter {
        background: var(--ge-danger, #dc2626);
        color: #ffffff;
      }
      .qr-option-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .qr-option-label {
        line-height: 1.3;
        word-break: break-word;
      }
      .qr-option-pickers {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .qr-picker-tag {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 700;
        background: rgba(15, 23, 42, 0.08);
        color: var(--ge-ink, #0f172a);
      }
      .qr-float-pts {
        position: absolute;
        top: -10px;
        right: 10px;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--ge-ok, #16a34a);
        color: #ffffff;
        font-size: 0.78rem;
        font-weight: 800;
        box-shadow: 0 3px 10px rgba(22, 163, 74, 0.35);
        animation: qrFloatUp 650ms var(--ease-out, ease-out) forwards;
        pointer-events: none;
      }
      @keyframes qrFloatUp {
        0% { opacity: 0; transform: translateY(8px) scale(0.85); }
        40% { opacity: 1; transform: translateY(-2px) scale(1.04); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      .qr-leaderboard {
        background: var(--ge-card, #ffffff);
        border: 1px solid var(--ge-border, rgba(15, 23, 42, 0.1));
        border-radius: var(--ge-radius, 12px);
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .qr-lb-header {
        font-size: 0.78rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ge-muted, #64748b);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .qr-lb-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 6px;
      }
      .qr-lb-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 5px 8px;
        border-radius: 8px;
        background: var(--ge-card-alt, rgba(15, 23, 42, 0.04));
        font-size: 0.82rem;
      }
      .qr-lb-row.is-me {
        border: 1px solid rgba(217, 119, 6, 0.4);
        background: rgba(217, 119, 6, 0.08);
      }
      .qr-lb-left {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .qr-lb-rank {
        font-weight: 800;
        color: var(--ge-muted, #64748b);
        width: 16px;
      }
      .qr-lb-name {
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .qr-lb-right {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
      }
      .qr-lb-score {
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
      .qr-lb-delta {
        font-size: 0.72rem;
        font-weight: 800;
        color: var(--ge-ok, #16a34a);
      }
      .qr-over-card {
        background: var(--ge-card, #ffffff);
        border: 1px solid var(--ge-border, rgba(15, 23, 42, 0.12));
        border-radius: var(--ge-radius, 14px);
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .qr-over-title {
        font-size: 1.25rem;
        font-weight: 800;
        text-align: center;
        margin: 0;
      }
      .qr-over-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.88rem;
      }
      .qr-over-table th,
      .qr-over-table td {
        padding: 8px 6px;
        text-align: left;
        border-bottom: 1px solid var(--ge-border, rgba(15, 23, 42, 0.08));
      }
      .qr-over-table th {
        font-size: 0.76rem;
        color: var(--ge-muted, #64748b);
        font-weight: 700;
      }
      .qr-over-table tr.is-me td {
        font-weight: 800;
        color: var(--ge-primary, #b45309);
      }
      .qr-wrap.sideways {
        padding: 6px 10px;
        gap: 6px;
      }
      .qr-wrap.sideways .qr-question-card {
        padding: 10px 12px;
      }
      .qr-wrap.sideways .qr-question-text {
        font-size: 1rem;
      }
      .qr-wrap.sideways .qr-option-btn {
        min-height: 48px;
        padding: 8px 10px;
      }
      @media (max-width: 480px) {
        .qr-wrap {
          padding: 8px 10px 12px;
          gap: 9px;
        }
        .qr-option-btn {
          min-height: 52px;
          padding: 10px 10px;
        }
      }
    `;
    document.head.appendChild(st);
  }

  function tr(key, fallback) {
    if (typeof window.t === 'function') {
      const val = window.t(key);
      if (val && val !== key) return val;
    }
    return fallback;
  }

  function currentLang() {
    if (window.I18N && window.I18N.lang === 'en') return 'en';
    return 'zh';
  }

  function categoryLabel(cat) {
    const lang = currentLang();
    const mapZh = {
      all: '全部题库',
      general: '综合常识',
      geography: '世界地理',
      science: '自然科学',
      history: '人文历史',
      nature: '动植物与自然',
      sports: '体育竞技',
      culture: '艺术与文化',
    };
    const mapEn = {
      all: 'All Categories',
      general: 'General',
      geography: 'Geography',
      science: 'Science',
      history: 'History',
      nature: 'Nature',
      sports: 'Sports',
      culture: 'Culture',
    };
    const fallback = (lang === 'en' ? mapEn[cat] : mapZh[cat]) || cat || '';
    return tr('qr_cat_' + cat, fallback);
  }

  function getPlayerLabel(p) {
    if (typeof window.playerName === 'function') {
      return window.playerName(p);
    }
    return tr('player', 'P') + ' ' + (p + 1);
  }

  function getPlayerInitial(p) {
    const name = getPlayerLabel(p).trim();
    return name ? name.slice(0, 1).toUpperCase() : String(p + 1);
  }

  function clearTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function applySidewaysClass(wrap) {
    if (!wrap) return;
    const isSideways = window.innerHeight < 540 && window.innerWidth > window.innerHeight;
    wrap.classList.toggle('sideways', isSideways);
  }

  function startCountdown(wrap, state) {
    clearTimer();
    const fillEl = wrap.querySelector('.qr-timer-fill');
    const textEl = wrap.querySelector('.qr-timer-text');
    if (!fillEl || !textEl) return;

    const totalSec = state.phase === 'reveal' ? 3 : (state.timePerQuestion || 15);
    const totalMs = totalSec * 1000;
    const deadline = state.deadline || 0;

    function tick() {
      if (!document.body.contains(wrap)) {
        clearTimer();
        return;
      }
      if (!deadline || state.phase === 'over' || state.phase === 'waiting') {
        fillEl.style.width = '0%';
        textEl.textContent = '0s';
        return;
      }
      const remMs = Math.max(0, deadline - Date.now());
      const remSec = Math.ceil(remMs / 1000);
      const pct = Math.max(0, Math.min(100, (remMs / totalMs) * 100));
      fillEl.style.width = pct.toFixed(1) + '%';
      textEl.textContent = remSec + 's';

      const urgent = state.phase === 'question' && remMs <= 5000;
      fillEl.classList.toggle('is-urgent', urgent);
      textEl.classList.toggle('is-urgent', urgent);
    }

    tick();
    timerInterval = setInterval(tick, 100);
  }

  function render(container, state, playerIndex, sendMove, isSpectator) {
    ensureStyles();
    clearTimer();
    container.innerHTML = '';

    if (!state || state.phase === 'waiting' || !state.question) {
      const waitEl = document.createElement('div');
      waitEl.className = 'qr-wrap';
      waitEl.innerHTML = `<div class="qr-question-card"><p class="qr-question-text">${tr('waiting_start', 'Waiting for game to start...')}</p></div>`;
      container.appendChild(waitEl);
      return;
    }

    const lang = currentLang();
    const qData = (state.question && state.question[lang]) || state.question.zh || { q: '', opts: [] };
    const n = state.playerCount || 1;
    const isReveal = state.phase === 'reveal';
    const isOver = state.phase === 'over' || state.winner !== null;
    const qKey = `${state.currentQuestion}:${state.questionId || ''}`;
    const isNewQuestion = qKey !== lastQuestionKey;
    const isNewPhase = state.phase !== lastPhase || isNewQuestion;
    const answeredMask = (state.answered || []).map((b) => (b ? '1' : '0')).join('');

    const wrap = document.createElement('div');
    wrap.className = 'qr-wrap';
    applySidewaysClass(wrap);

    if (!resizeBound) {
      resizeBound = true;
      window.addEventListener('resize', () => {
        const currentWrap = document.querySelector('.qr-wrap');
        if (currentWrap) applySidewaysClass(currentWrap);
      });
    }

    // 1. Top bar: progress, category, double points badge, streak badge
    const topbar = document.createElement('div');
    topbar.className = 'qr-topbar';

    const leftMeta = document.createElement('div');
    leftMeta.className = 'qr-meta-group';

    const progressBadge = document.createElement('span');
    progressBadge.className = 'qr-badge';
    progressBadge.textContent = `${tr('qr_question_num', lang === 'en' ? 'Question' : '第')} ${state.currentQuestion || 1} / ${state.totalQuestions || 10}`;
    leftMeta.appendChild(progressBadge);

    const catBadge = document.createElement('span');
    catBadge.className = 'qr-badge qr-badge-cat';
    catBadge.textContent = categoryLabel(state.questionCat || state.category || 'general');
    leftMeta.appendChild(catBadge);

    if (state.isDouble) {
      const dblBadge = document.createElement('span');
      dblBadge.className = 'qr-badge qr-badge-double';
      dblBadge.textContent = '×2 ' + tr('qr_double_points', lang === 'en' ? 'Double points' : '双倍积分');
      leftMeta.appendChild(dblBadge);
    }

    const rightMeta = document.createElement('div');
    rightMeta.className = 'qr-meta-group';

    const myStreak =
      typeof playerIndex === 'number' && state.streaks && state.streaks[playerIndex]
        ? state.streaks[playerIndex]
        : 0;
    if (myStreak >= 2) {
      const streakBadge = document.createElement('span');
      streakBadge.className = 'qr-badge qr-badge-streak';
      streakBadge.textContent = `🔥 ${myStreak} ${tr('qr_streak', lang === 'en' ? 'Streak' : '连对')}${myStreak >= 3 ? ' (+100)' : ''}`;
      rightMeta.appendChild(streakBadge);
    }

    topbar.appendChild(leftMeta);
    topbar.appendChild(rightMeta);
    wrap.appendChild(topbar);

    // 2. Countdown bar (during question & reveal)
    if (!isOver) {
      const timerWrap = document.createElement('div');
      timerWrap.className = 'qr-timer-wrap';
      timerWrap.innerHTML = `
        <div class="qr-timer-track"><div class="qr-timer-fill"></div></div>
        <div class="qr-timer-text">--</div>
      `;
      wrap.appendChild(timerWrap);
    }

    // 3. Question Card
    const qCard = document.createElement('div');
    qCard.className = 'qr-question-card';

    const qText = document.createElement('p');
    qText.className = 'qr-question-text';
    qText.textContent = qData.q || '';
    qCard.appendChild(qText);

    const statusBanner = document.createElement('div');
    statusBanner.className = 'qr-status-banner';
    const myAnswered =
      typeof playerIndex === 'number' && state.answered && Boolean(state.answered[playerIndex]);
    const myChoice =
      typeof playerIndex === 'number' && state.choices && state.choices[playerIndex] != null
        ? state.choices[playerIndex]
        : state.myChoice ?? null;

    if (isOver) {
      statusBanner.textContent = tr('qr_game_finished', lang === 'en' ? 'Quiz complete! Final standings below.' : '答题结束！以下是最终排名。');
    } else if (isReveal) {
      const myPts =
        typeof playerIndex === 'number' && state.roundPoints ? state.roundPoints[playerIndex] || 0 : 0;
      if (!isSpectator && typeof playerIndex === 'number') {
        if (myPts > 0) {
          statusBanner.textContent = `${tr('qr_correct', lang === 'en' ? 'Correct!' : '回答正确！')} +${myPts}`;
        } else if (myChoice !== null && myChoice !== undefined) {
          statusBanner.textContent = tr('qr_wrong', lang === 'en' ? 'Wrong answer' : '回答错误');
        } else {
          statusBanner.textContent = tr('qr_times_up', lang === 'en' ? 'Time is up!' : '时间到！');
        }
      } else {
        statusBanner.textContent = tr('qr_revealing', lang === 'en' ? 'Revealing correct answer...' : '公布正确答案...');
      }
    } else {
      if (isSpectator) {
        statusBanner.textContent = tr('qr_players_answering', lang === 'en' ? 'Players are answering...' : '玩家正在作答...');
      } else if (myAnswered) {
        statusBanner.textContent = tr('qr_waiting_others', lang === 'en' ? 'Locked in! Waiting for other players...' : '已锁定答案，等待其他玩家...');
      } else {
        statusBanner.textContent = tr('qr_pick_answer', lang === 'en' ? 'Tap the correct answer as fast as you can!' : '请尽快点击正确答案！');
      }
    }
    qCard.appendChild(statusBanner);
    wrap.appendChild(qCard);

    // 4. Avatars of who has answered
    const avatarStrip = document.createElement('div');
    avatarStrip.className = 'qr-answered-strip';
    for (let p = 0; p < n; p++) {
      const hasAns = Boolean(state.answered && state.answered[p]);
      const chip = document.createElement('div');
      chip.className = 'qr-avatar-chip' + (hasAns ? ' has-answered' : '');

      const dot = document.createElement('span');
      dot.className = 'qr-avatar-dot';
      dot.style.backgroundColor = PLAYER_COLORS[p % PLAYER_COLORS.length];
      dot.textContent = getPlayerInitial(p);
      chip.appendChild(dot);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = getPlayerLabel(p);
      chip.appendChild(nameSpan);

      const checkSpan = document.createElement('span');
      checkSpan.className = 'qr-avatar-check';
      checkSpan.textContent = hasAns ? '✓' : '…';
      chip.appendChild(checkSpan);

      avatarStrip.appendChild(chip);

      if (hasAns && lastAnsweredMask && lastAnsweredMask[p] === '0' && window.Motion) {
        window.Motion.pop(chip);
      }
    }
    wrap.appendChild(avatarStrip);

    // 5. 2x2 Options Grid
    const grid = document.createElement('div');
    grid.className = 'qr-options-grid';
    const opts = Array.isArray(qData.opts) ? qData.opts : [];

    for (let i = 0; i < 4; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qr-option-btn';
      btn.dataset.option = String(i);

      const canClick =
        !isSpectator &&
        state.phase === 'question' &&
        !myAnswered &&
        typeof playerIndex === 'number' &&
        playerIndex >= 0;

      btn.disabled = !canClick;

      if (myChoice === i) {
        btn.classList.add('is-selected');
      }

      if (isReveal || isOver) {
        if (state.answer === i) {
          btn.classList.add('is-correct');
        } else if (myChoice === i) {
          btn.classList.add('is-wrong');
        }
      }

      const letter = document.createElement('span');
      letter.className = 'qr-option-letter';
      letter.textContent = OPTION_LABELS[i] || String(i + 1);
      btn.appendChild(letter);

      const content = document.createElement('div');
      content.className = 'qr-option-content';

      const label = document.createElement('span');
      label.className = 'qr-option-label';
      label.textContent = opts[i] != null ? String(opts[i]) : '';
      content.appendChild(label);

      // Show who picked this option during reveal / over
      if ((isReveal || isOver) && Array.isArray(state.choices)) {
        const pickers = [];
        for (let p = 0; p < n; p++) {
          if (state.choices[p] === i) pickers.push(p);
        }
        if (pickers.length > 0) {
          const pickerRow = document.createElement('div');
          pickerRow.className = 'qr-option-pickers';
          for (const p of pickers) {
            const tag = document.createElement('span');
            tag.className = 'qr-picker-tag';
            tag.textContent = getPlayerLabel(p);
            pickerRow.appendChild(tag);
          }
          content.appendChild(pickerRow);
        }
      }

      btn.appendChild(content);

      // Floating +N indicator on the correct option during reveal
      if (isReveal && state.answer === i && typeof playerIndex === 'number') {
        const earned = (state.roundPoints && state.roundPoints[playerIndex]) || 0;
        if (earned > 0) {
          const floatPts = document.createElement('span');
          floatPts.className = 'qr-float-pts';
          floatPts.textContent = `+${earned}`;
          btn.appendChild(floatPts);
        }
      }

      if (canClick) {
        btn.addEventListener('click', () => {
          if (window.Motion) window.Motion.pop(btn);
          sendMove({ answer: i });
        });
      }

      grid.appendChild(btn);
    }
    wrap.appendChild(grid);

    // 6. Final Ranking Table (when phase === 'over') OR Compact Live Leaderboard
    const ranking = Array.isArray(state.ranking) && state.ranking.length
      ? state.ranking
      : Array.from({ length: n }, (_, p) => ({
          player: p,
          score: (state.scores && state.scores[p]) || 0,
          correctCount: (state.correctCounts && state.correctCounts[p]) || 0,
          avgTimeMs: (state.avgTimeMs && state.avgTimeMs[p]) || 0,
        }));

    if (isOver) {
      const overCard = document.createElement('div');
      overCard.className = 'qr-over-card';

      const title = document.createElement('h3');
      title.className = 'qr-over-title';
      title.textContent = tr('qr_final_ranking', lang === 'en' ? 'Final Standings' : '最终排行榜');
      overCard.appendChild(title);

      const table = document.createElement('table');
      table.className = 'qr-over-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>#</th>
            <th>${tr('qr_col_player', lang === 'en' ? 'Player' : '玩家')}</th>
            <th>${tr('qr_col_score', lang === 'en' ? 'Score' : '总分')}</th>
            <th>${tr('qr_col_correct', lang === 'en' ? 'Correct' : '答对题数')}</th>
            <th>${tr('qr_col_avg_time', lang === 'en' ? 'Avg Time' : '平均用时')}</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');
      ranking.forEach((row, idx) => {
        const trEl = document.createElement('tr');
        if (row.player === playerIndex) trEl.className = 'is-me';
        const avgSec = ((row.avgTimeMs || 0) / 1000).toFixed(1) + 's';
        trEl.innerHTML = `
          <td>${idx + 1}</td>
          <td>${getPlayerLabel(row.player)}</td>
          <td>${row.score}</td>
          <td>${row.correctCount} / ${state.totalQuestions || 10}</td>
          <td>${avgSec}</td>
        `;
        tbody.appendChild(trEl);
      });
      overCard.appendChild(table);
      wrap.appendChild(overCard);
    } else {
      const lb = document.createElement('div');
      lb.className = 'qr-leaderboard';

      const lbHeader = document.createElement('div');
      lbHeader.className = 'qr-lb-header';
      lbHeader.innerHTML = `
        <span>${tr('qr_leaderboard', lang === 'en' ? 'Live Standings' : '实时积分榜')}</span>
        <span>${tr('qr_total_questions', lang === 'en' ? 'Total' : '共')} ${state.totalQuestions || 10}</span>
      `;
      lb.appendChild(lbHeader);

      const lbList = document.createElement('div');
      lbList.className = 'qr-lb-list';

      ranking.forEach((row, rankIdx) => {
        const item = document.createElement('div');
        item.className = 'qr-lb-row' + (row.player === playerIndex ? ' is-me' : '');

        const left = document.createElement('div');
        left.className = 'qr-lb-left';
        left.innerHTML = `
          <span class="qr-lb-rank">${rankIdx + 1}</span>
          <span class="qr-lb-name">${getPlayerLabel(row.player)}</span>
        `;

        const right = document.createElement('div');
        right.className = 'qr-lb-right';

        const deltaPts = isReveal && state.roundPoints ? state.roundPoints[row.player] || 0 : 0;
        if (deltaPts > 0) {
          const deltaEl = document.createElement('span');
          deltaEl.className = 'qr-lb-delta';
          deltaEl.textContent = `+${deltaPts}`;
          right.appendChild(deltaEl);
        }

        const scoreEl = document.createElement('span');
        scoreEl.className = 'qr-lb-score';
        const prev = prevScores[row.player] ?? row.score;
        scoreEl.textContent = String(row.score);
        right.appendChild(scoreEl);

        if (isNewPhase && prev !== row.score && window.Motion && typeof window.Motion.countTo === 'function') {
          window.Motion.countTo(scoreEl, prev, row.score, 320);
        }
        prevScores[row.player] = row.score;

        item.appendChild(left);
        item.appendChild(right);
        lbList.appendChild(item);
      });

      lb.appendChild(lbList);
      wrap.appendChild(lb);
    }

    container.appendChild(wrap);

    if (isNewQuestion && window.Motion && typeof window.Motion.fade === 'function') {
      window.Motion.fade(qCard);
    }

    lastQuestionKey = qKey;
    lastPhase = state.phase;
    lastAnsweredMask = answeredMask;

    if (!isOver) {
      startCountdown(wrap, state);
    }
  }

  return { render };
})();

// Register with the shared renderer map (room-client calls render(state, container, playerIndex, winner)).
window.gameRenderers = window.gameRenderers || new Map();
window.gameRenderers.set('quizrace', {
  init: function (container) { container.innerHTML = ''; },
  render: function (state, container, playerIndex) {
    window.Renderers.quizrace.render(container, state, playerIndex, function (move) { window.makeGameMove(move); }, !(playerIndex >= 0));
  },
});
