window.Renderers = window.Renderers || {};

window.Renderers['quizrace'] = (() => {
  const OPTION_LABELS = ['A', 'B', 'C', 'D'];
  const TILE_COLORS = ['#e5484d', '#3b82f6', '#f5a524', '#22a06b'];
  const FALLBACK_AVATARS = ['😊', '🦊', '🐼', '🐯', '🐸', '🐵', '🦄', '🐙'];

  // Inline SVG shape icons (A = circle, B = diamond, C = triangle, D = square)
  const SHAPE_SVGS = [
    '<svg class="qr-shape-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="currentColor"/></svg>',
    '<svg class="qr-shape-svg" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2.5 21.5,12 12,21.5 2.5,12" fill="currentColor"/></svg>',
    '<svg class="qr-shape-svg" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,3 21.5,20 2.5,20" fill="currentColor"/></svg>',
    '<svg class="qr-shape-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2.5" fill="currentColor"/></svg>',
  ];

  const CHECK_SVG =
    '<svg class="qr-check-svg" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.3 3.3L15.2 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  let timerInterval = null;
  let activeDeadline = 0;
  let activeTotalMs = 15000;
  let activePhase = 'waiting';
  let activeWrap = null;

  let lastQuestionKey = null;
  let lastPhase = null;
  let prevAnswered = [];
  let prevScores = {};
  let prevRanks = {};
  let doubleAnnounced = false;
  let resizeBound = false;

  // Latest interaction context so persistent option buttons always use current state
  let currentCtx = {
    state: null,
    playerIndex: -1,
    sendMove: null,
    isSpectator: true,
    canClick: false,
  };

  function ensureMotionAnnounce() {
    window.Motion = window.Motion || {};
    if (typeof window.Motion.announce !== 'function') {
      window.Motion.announce = function (opts) {
        if (!opts || typeof document === 'undefined') return;
        const host = document.querySelector('.qr-wrap') || document.body;
        if (!host) return;
        const existing = host.querySelector('.qr-announce-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'qr-announce-toast tone-' + (opts.tone || 'warn');
        const iconHtml = opts.icon ? `<span class="qr-announce-icon">${opts.icon}</span>` : '';
        const titleTxt = opts.title || '';
        toast.innerHTML = `${iconHtml}<span class="qr-announce-title">${titleTxt}</span>`;
        host.appendChild(toast);
        if (typeof window.Motion.pop === 'function') {
          window.Motion.pop(toast);
        }
        setTimeout(() => {
          if (toast.parentNode) toast.remove();
        }, 2200);
      };
    }
  }

  function ensureStyles() {
    if (document.getElementById('qr-styles')) return;
    const st = document.createElement('style');
    st.id = 'qr-styles';
    st.textContent = `
      .qr-wrap {
        position: relative;
        width: 100%;
        max-width: 820px;
        margin: 0 auto;
        padding: 10px 12px 14px;
        box-sizing: border-box;
        color: var(--ge-ink, #1c1b19);
        user-select: none;
        min-width: 0;
      }
      .qr-wrap *,
      .qr-wrap *::before,
      .qr-wrap *::after {
        box-sizing: border-box;
      }

      /* Active play layout: single column on mobile/tablet, 2-col on >=1100px or sideways phone */
      .qr-play-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
        width: 100%;
        min-width: 0;
        align-items: start;
      }

      /* 1. Chips row */
      .qr-chips-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        flex-wrap: wrap;
        min-width: 0;
      }
      .qr-chips-left,
      .qr-chips-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        min-width: 0;
      }
      .qr-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 800;
        background: var(--ge-paper, #fffdf8);
        color: var(--ge-ink, #1c1b19);
        border: 1px solid var(--ge-line, rgba(28, 27, 25, 0.12));
        box-shadow: var(--ge-shadow-rest, 0 1px 2px rgba(0,0,0,0.06));
        white-space: nowrap;
        max-width: 100%;
      }
      .qr-chip-q {
        background: var(--ge-ink, #1c1b19);
        color: #ffffff;
        border-color: transparent;
      }
      .qr-chip-cat {
        color: var(--ge-ink-soft, #5d5850);
      }
      .qr-chip-streak {
        background: rgba(245, 165, 36, 0.16);
        color: #b45309;
        border-color: rgba(245, 165, 36, 0.4);
      }
      .qr-chip-rank {
        display: none;
        background: rgba(59, 130, 246, 0.14);
        color: #1d4ed8;
        border-color: rgba(59, 130, 246, 0.35);
      }

      /* 2. Question card */
      .qr-question-card {
        position: relative;
        background: var(--ge-paper, #fffdf8);
        border: 1px solid var(--ge-line, rgba(28, 27, 25, 0.12));
        border-radius: 16px;
        padding: 16px 18px 14px;
        box-shadow: var(--ge-shadow-rest, 0 1px 2px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.06));
        text-align: center;
        min-width: 0;
        overflow: hidden;
      }
      .qr-double-ribbon {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        margin-bottom: 8px;
        border-radius: 999px;
        background: linear-gradient(135deg, #fbbf24, #d97706);
        color: #ffffff;
        font-size: 0.76rem;
        font-weight: 900;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        box-shadow: 0 2px 8px rgba(217, 119, 6, 0.35);
      }
      .qr-chip[hidden],
      .qr-double-ribbon[hidden] {
        display: none !important;
      }
      .qr-question-text {
        font-size: 22px;
        font-weight: 800;
        line-height: 1.35;
        color: var(--ge-ink, #1c1b19);
        margin: 0;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      @media (min-width: 768px) {
        .qr-wrap:not(.sideways) .qr-question-text {
          font-size: 28px;
        }
      }
      .qr-status-banner {
        margin-top: 8px;
        font-size: 0.84rem;
        font-weight: 700;
        color: var(--ge-ink-soft, #5d5850);
        min-height: 1.2em;
      }
      .qr-status-banner.is-locked {
        color: #1d4ed8;
      }

      /* 3. Timer bar + big seconds number */
      .qr-timer-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .qr-timer-track {
        flex: 1;
        min-width: 0;
        height: 8px;
        border-radius: 999px;
        background: rgba(28, 27, 25, 0.12);
        overflow: hidden;
        position: relative;
      }
      .qr-timer-fill {
        height: 100%;
        width: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #f5a524, #22a06b);
        transition: width 120ms linear, background-color var(--dur-fast, 120ms) ease;
      }
      .qr-timer-fill.is-urgent {
        background: #e5484d;
        animation: qrUrgentPulse 550ms ease-in-out infinite alternate;
      }
      .qr-timer-text {
        min-width: 48px;
        text-align: right;
        font-weight: 900;
        font-size: 1.35rem;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: var(--ge-ink, #1c1b19);
        transition: color var(--dur-fast, 120ms) ease;
      }
      .qr-timer-text.is-urgent {
        color: #e5484d;
        animation: qrUrgentPulse 550ms ease-in-out infinite alternate;
      }
      @keyframes qrUrgentPulse {
        0% { transform: scale(1); opacity: 1; }
        100% { transform: scale(1.06); opacity: 0.82; }
      }

      /* 4. Options section (floating reveal banner + 2x2 solid colour tiles) */
      .qr-options-section {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        min-width: 0;
      }
      .qr-reveal-result {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
        min-height: 0;
        pointer-events: none;
      }
      .qr-reveal-result[hidden] {
        display: none !important;
      }
      .qr-float-result {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 14px;
        border-radius: 999px;
        font-size: 0.95rem;
        font-weight: 900;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
      }
      .qr-float-result.res-correct {
        background: #22a06b;
      }
      .qr-float-result.res-wrong {
        background: #e5484d;
      }
      .qr-float-result.res-no-answer {
        background: #64748b;
      }
      .qr-float-streak {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 11px;
        border-radius: 999px;
        font-size: 0.85rem;
        font-weight: 900;
        background: linear-gradient(135deg, #f5a524, #e5484d);
        color: #ffffff;
        box-shadow: 0 3px 10px rgba(229, 72, 77, 0.3);
      }
      .qr-float-streak[hidden] {
        display: none !important;
      }

      .qr-options-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        width: 100%;
        min-width: 0;
      }
      .qr-option-btn {
        position: relative;
        min-height: 64px;
        min-width: 0;
        padding: 12px 14px;
        border-radius: 16px;
        border: none;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
        font-family: inherit;
        font-size: clamp(0.95rem, 2.2vw, 1.12rem);
        font-weight: 800;
        cursor: pointer;
        overflow: hidden;
        box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18);
        transition: transform var(--dur-fast, 120ms) var(--ease, ease),
                    opacity var(--dur, 200ms) var(--ease, ease),
                    box-shadow var(--dur-fast, 120ms) var(--ease, ease),
                    filter var(--dur, 200ms) var(--ease, ease);
      }
      @media (min-width: 640px) {
        .qr-wrap:not(.sideways) .qr-option-btn {
          min-height: 88px;
          padding: 14px 16px;
        }
      }
      .qr-option-btn.qr-opt-0 { background-color: #e5484d; }
      .qr-option-btn.qr-opt-1 { background-color: #3b82f6; }
      .qr-option-btn.qr-opt-2 { background-color: #f5a524; }
      .qr-option-btn.qr-opt-3 { background-color: #22a06b; }

      @media (hover: hover) {
        .qr-option-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 0 rgba(0, 0, 0, 0.22);
          filter: brightness(1.04);
        }
      }
      .qr-option-btn:active:not(:disabled) {
        transform: translateY(2px);
        box-shadow: 0 2px 0 rgba(0, 0, 0, 0.18);
      }
      .qr-option-btn:disabled {
        cursor: default;
      }

      /* After answering: selected keeps full colour + white check ring, others dim to 45% */
      .qr-option-btn.is-dimmed {
        opacity: 0.45;
      }
      .qr-option-btn.is-selected {
        opacity: 1;
        box-shadow: 0 0 0 3px #ffffff, 0 4px 0 rgba(0, 0, 0, 0.28);
      }

      /* Reveal phase states: correct gets white glow + check, wrong tiles grey out */
      .qr-option-btn.is-correct {
        opacity: 1 !important;
        filter: none !important;
        box-shadow: 0 0 0 3px #ffffff, 0 0 20px rgba(255, 255, 255, 0.85), 0 5px 14px rgba(0, 0, 0, 0.26) !important;
      }
      .qr-option-btn.is-wrong-tile {
        filter: grayscale(0.78);
        opacity: 0.5;
      }

      /* Reveal horizontal fill bar inside each tile */
      .qr-tile-fill-bar {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 0%;
        background: rgba(255, 255, 255, 0.22);
        pointer-events: none;
        transition: width var(--dur-slow, 320ms) var(--ease, ease);
        z-index: 0;
      }
      .qr-option-shape {
        position: relative;
        z-index: 1;
        width: 32px;
        height: 32px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.2);
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .qr-shape-svg {
        width: 18px;
        height: 18px;
        display: block;
      }
      .qr-option-content {
        position: relative;
        z-index: 1;
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .qr-option-label {
        line-height: 1.28;
        color: #ffffff;
        font-weight: 800;
        word-break: break-word;
        overflow-wrap: anywhere;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
      }
      .qr-option-pickers {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        min-width: 0;
        overflow: hidden;
      }
      .qr-option-pickers[hidden] {
        display: none !important;
      }
      .qr-picker-tag {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.12);
      }
      .qr-picker-tag + .qr-picker-tag {
        margin-left: -6px;
      }
      .qr-picker-avatar {
        font-size: 0.82rem;
        line-height: 1;
      }
      .qr-picker-name {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      .qr-check-ring {
        position: relative;
        z-index: 1;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 2.5px solid #ffffff;
        background: rgba(255, 255, 255, 0.22);
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
      }
      .qr-check-ring[hidden] {
        display: none !important;
      }
      .qr-check-svg {
        width: 15px;
        height: 15px;
        display: block;
      }

      /* 5. Answered avatar bubbles row */
      .qr-answered-strip {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 2px 0;
        min-width: 0;
      }
      .qr-answer-bubble {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        width: 54px;
        min-width: 0;
        flex: 0 1 54px;
      }
      .qr-bubble-circle {
        position: relative;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--ge-paper, #fffdf8);
        border: 2px solid var(--ge-line, rgba(28, 27, 25, 0.14));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.15rem;
        line-height: 1;
        box-shadow: var(--ge-shadow-rest, 0 1px 3px rgba(0,0,0,0.08));
        transition: border-color var(--dur-fast, 120ms) ease,
                    background-color var(--dur-fast, 120ms) ease;
      }
      .qr-answer-bubble.has-answered .qr-bubble-circle {
        border-color: #22a06b;
        background: rgba(34, 160, 107, 0.12);
      }
      .qr-bubble-tick {
        position: absolute;
        right: -3px;
        bottom: -3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #22a06b;
        color: #ffffff;
        font-size: 0.65rem;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--ge-paper, #fffdf8);
        opacity: 0;
        transform: scale(0.5);
        transition: opacity var(--dur-fast, 120ms) ease, transform var(--dur-fast, 120ms) var(--ease, ease);
      }
      .qr-answer-bubble.has-answered .qr-bubble-tick {
        opacity: 1;
        transform: scale(1);
      }
      .qr-bubble-name {
        width: 100%;
        text-align: center;
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--ge-ink-soft, #5d5850);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .qr-answer-bubble.has-answered .qr-bubble-name {
        color: var(--ge-ink, #1c1b19);
      }

      /* 6. Leaderboard */
      .qr-leaderboard {
        background: var(--ge-paper, #fffdf8);
        border: 1px solid var(--ge-line, rgba(28, 27, 25, 0.12));
        border-radius: 14px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        box-shadow: var(--ge-shadow-rest, 0 1px 2px rgba(0,0,0,0.06));
      }
      .qr-lb-header {
        font-size: 0.76rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ge-ink-soft, #5d5850);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
      }
      .qr-lb-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
      }
      .qr-lb-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 9px;
        border-radius: 10px;
        background: rgba(28, 27, 25, 0.04);
        font-size: 0.84rem;
        min-width: 0;
      }
      .qr-lb-row.is-me {
        border: 1.5px solid rgba(245, 165, 36, 0.55);
        background: rgba(245, 165, 36, 0.12);
      }
      .qr-lb-left {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
        flex: 1;
      }
      .qr-lb-rank {
        font-weight: 900;
        color: var(--ge-ink-soft, #5d5850);
        width: 18px;
        text-align: center;
        flex-shrink: 0;
      }
      .qr-lb-row.rank-1 .qr-lb-rank { color: #d97706; }
      .qr-lb-row.rank-2 .qr-lb-rank { color: #64748b; }
      .qr-lb-row.rank-3 .qr-lb-rank { color: #b45309; }
      .qr-lb-avatar {
        font-size: 1.05rem;
        line-height: 1;
        flex-shrink: 0;
      }
      .qr-lb-name {
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .qr-lb-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .qr-lb-delta {
        font-size: 0.74rem;
        font-weight: 800;
        color: #22a06b;
      }
      .qr-lb-score {
        font-weight: 900;
        font-variant-numeric: tabular-nums;
      }

      /* Phone portrait (<=480px): collapse leaderboard to top 3 + you */
      @media (max-width: 480px) {
        .qr-wrap {
          padding: 8px 8px 12px;
        }
        .qr-play-layout {
          gap: 8px;
        }
        .qr-question-card {
          padding: 12px 14px;
        }
        .qr-question-text {
          font-size: 21px;
        }
        .qr-option-btn {
          min-height: 64px;
          padding: 10px 12px;
        }
        .qr-lb-row.qr-lb-extra {
          display: none !important;
        }
      }

      /* Wide desktop (>=1100px): leaderboard beside the question */
      @media (min-width: 1100px) {
        .qr-wrap:not(.sideways) .qr-play-layout {
          grid-template-columns: minmax(0, 1fr) 250px;
          column-gap: 16px;
          row-gap: 10px;
        }
        .qr-wrap:not(.sideways) .qr-chips-bar,
        .qr-wrap:not(.sideways) .qr-question-card,
        .qr-wrap:not(.sideways) .qr-timer-wrap,
        .qr-wrap:not(.sideways) .qr-options-section,
        .qr-wrap:not(.sideways) .qr-answered-strip {
          grid-column: 1;
        }
        .qr-wrap:not(.sideways) .qr-leaderboard {
          grid-column: 2;
          grid-row: 1 / span 5;
          align-self: start;
        }
      }

      /* Phone sideways (innerHeight < 540 && innerWidth > innerHeight):
         Two columns: left = chips, question, timer, answered row; right = 2x2 tiles;
         leaderboard hidden (rank shown as a chip). Fits in ~375px viewport height without scroll. */
      body:has(.qr-wrap.sideways) {
        padding-top: 2px !important;
        padding-bottom: 2px !important;
      }
      body:has(.qr-wrap.sideways) .game-page-shell {
        gap: 2px !important;
      }
      body:has(.qr-wrap.sideways) .game-topbar {
        padding: 0 !important;
        min-height: 26px !important;
      }
      body:has(.qr-wrap.sideways) #gameStage.game-stage-panel {
        padding: 4px 8px !important;
        gap: 2px !important;
      }
      body:has(.qr-wrap.sideways) #playerBar,
      body:has(.qr-wrap.sideways) #gameActions {
        display: none !important;
      }
      .qr-wrap.sideways {
        max-width: 100%;
        padding: 4px 6px;
      }
      .qr-wrap.sideways .qr-play-layout {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
        grid-template-rows: auto auto auto auto;
        column-gap: 12px;
        row-gap: 6px;
        align-items: center;
      }
      .qr-wrap.sideways .qr-chips-bar {
        grid-column: 1;
        grid-row: 1;
      }
      .qr-wrap.sideways .qr-chip {
        padding: 2px 8px;
        font-size: 0.74rem;
      }
      .qr-wrap.sideways .qr-chip-rank {
        display: inline-flex;
      }
      .qr-wrap.sideways .qr-question-card {
        grid-column: 1;
        grid-row: 2;
        padding: 8px 12px;
        border-radius: 12px;
      }
      .qr-wrap.sideways .qr-double-ribbon {
        margin-bottom: 4px;
        padding: 2px 8px;
        font-size: 0.68rem;
      }
      .qr-wrap.sideways .qr-question-text {
        font-size: 20px;
        line-height: 1.25;
      }
      .qr-wrap.sideways .qr-status-banner {
        margin-top: 4px;
        font-size: 0.75rem;
      }
      .qr-wrap.sideways .qr-timer-wrap {
        grid-column: 1;
        grid-row: 3;
      }
      .qr-wrap.sideways .qr-timer-text {
        font-size: 1.1rem;
        min-width: 38px;
      }
      .qr-wrap.sideways .qr-answered-strip {
        grid-column: 1;
        grid-row: 4;
        gap: 6px;
        padding: 0;
      }
      .qr-wrap.sideways .qr-answer-bubble {
        width: 44px;
        flex: 0 1 44px;
        gap: 2px;
      }
      .qr-wrap.sideways .qr-bubble-circle {
        width: 28px;
        height: 28px;
        font-size: 0.95rem;
      }
      .qr-wrap.sideways .qr-bubble-tick {
        width: 13px;
        height: 13px;
        font-size: 0.56rem;
      }
      .qr-wrap.sideways .qr-bubble-name {
        font-size: 0.66rem;
      }
      .qr-wrap.sideways .qr-options-section {
        grid-column: 2;
        grid-row: 1 / span 4;
        align-self: stretch;
        justify-content: center;
        gap: 6px;
      }
      .qr-wrap.sideways .qr-options-grid {
        gap: 8px;
      }
      .qr-wrap.sideways .qr-option-btn {
        min-height: 64px;
        padding: 8px 10px;
        font-size: 0.92rem;
      }
      .qr-wrap.sideways .qr-option-shape {
        width: 26px;
        height: 26px;
      }
      .qr-wrap.sideways .qr-shape-svg {
        width: 15px;
        height: 15px;
      }
      .qr-wrap.sideways .qr-leaderboard {
        display: none !important;
      }

      /* Announce toast for Double Points */
      .qr-announce-toast {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 30;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 999px;
        background: linear-gradient(135deg, #fbbf24, #d97706);
        color: #ffffff;
        font-size: 0.95rem;
        font-weight: 900;
        box-shadow: 0 8px 24px rgba(217, 119, 6, 0.4);
        pointer-events: none;
      }

      /* Game Over: Podium + Full Ranking */
      .qr-over-card {
        background: var(--ge-paper, #fffdf8);
        border: 1px solid var(--ge-line, rgba(28, 27, 25, 0.12));
        border-radius: 16px;
        padding: 18px 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-width: 0;
        box-shadow: var(--ge-shadow-rest, 0 2px 8px rgba(0,0,0,0.06));
      }
      .qr-over-title {
        font-size: 1.3rem;
        font-weight: 900;
        text-align: center;
        margin: 0;
      }
      .qr-podium {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        align-items: end;
        gap: 10px;
        max-width: 460px;
        width: 100%;
        margin: 4px auto 0;
        padding-top: 8px;
      }
      .qr-podium-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        min-width: 0;
      }
      .qr-podium-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #ffffff;
        border: 2.5px solid rgba(28, 27, 25, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.45rem;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
      }
      .qr-podium-col.rank-1 .qr-podium-avatar {
        width: 52px;
        height: 52px;
        font-size: 1.7rem;
        border-color: #f5a524;
        box-shadow: 0 0 0 3px rgba(245, 165, 36, 0.25), 0 4px 12px rgba(0, 0, 0, 0.14);
      }
      .qr-podium-name {
        width: 100%;
        text-align: center;
        font-size: 0.82rem;
        font-weight: 800;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .qr-podium-score {
        font-size: 0.8rem;
        font-weight: 900;
        color: var(--ge-ink-soft, #5d5850);
        font-variant-numeric: tabular-nums;
      }
      .qr-podium-bar {
        width: 100%;
        border-radius: 12px 12px 6px 6px;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 8px;
        font-size: 1.15rem;
        font-weight: 900;
        color: #ffffff;
      }
      .qr-podium-col.rank-1 .qr-podium-bar {
        height: 88px;
        background: linear-gradient(180deg, #fbbf24, #d97706);
      }
      .qr-podium-col.rank-2 .qr-podium-bar {
        height: 64px;
        background: linear-gradient(180deg, #94a3b8, #64748b);
      }
      .qr-podium-col.rank-3 .qr-podium-bar {
        height: 48px;
        background: linear-gradient(180deg, #d97706, #92400e);
      }
      .qr-over-table-wrap {
        width: 100%;
        min-width: 0;
        overflow-x: auto;
      }
      .qr-over-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.86rem;
        table-layout: fixed;
      }
      .qr-over-table th,
      .qr-over-table td {
        padding: 8px 4px;
        text-align: left;
        border-bottom: 1px solid var(--ge-line, rgba(28, 27, 25, 0.08));
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .qr-over-table th:nth-child(1),
      .qr-over-table td:nth-child(1) { width: 26px; }
      .qr-over-table th:nth-child(3),
      .qr-over-table td:nth-child(3) { width: 52px; text-align: right; }
      .qr-over-table th:nth-child(4),
      .qr-over-table td:nth-child(4) { width: 50px; text-align: right; }
      .qr-over-table th:nth-child(5),
      .qr-over-table td:nth-child(5) { width: 46px; text-align: right; }
      .qr-over-table th {
        font-size: 0.74rem;
        color: var(--ge-ink-soft, #5d5850);
        font-weight: 800;
      }
      .qr-over-table tr.is-me td {
        font-weight: 900;
        background: rgba(245, 165, 36, 0.1);
      }
      .qr-over-player-cell {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .qr-over-player-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .qr-timer-fill,
        .qr-timer-text,
        .qr-option-btn,
        .qr-tile-fill-bar,
        .qr-bubble-circle,
        .qr-bubble-tick {
          transition: opacity var(--dur, 200ms) linear !important;
          animation: none !important;
        }
        .qr-option-btn:hover:not(:disabled),
        .qr-option-btn:active:not(:disabled) {
          transform: none !important;
        }
      }
    `;
    document.head.appendChild(st);
  }

  function currentLang() {
    if (window.__ACTIVE_LANG === 'en') return 'en';
    if (window.I18N && window.I18N.lang === 'en') return 'en';
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'en') return 'en';
    } catch (e) {}
    return 'zh';
  }

  function tr(key, fallback) {
    if (typeof window._t === 'function') {
      const val = window._t(key);
      if (val && val !== key) return val;
    }
    if (typeof window.t === 'function') {
      const val = window.t(key);
      if (val && val !== key) return val;
    }
    return fallback;
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
      food: '美食',
      idiom: '成语俗语',
      life: '生活常识',
      cncult: '中国文化',
      anime: '动漫影视',
      mental: '心算',
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
      food: 'Food',
      idiom: 'Idioms',
      life: 'Daily Life',
      cncult: 'Chinese Culture',
      anime: 'Anime and Film',
      mental: 'Mental Math',
    };
    const fallback = (lang === 'en' ? mapEn[cat] : mapZh[cat]) || cat || '';
    return tr('qr_cat_' + cat, fallback);
  }

  function getPlayerObj(p) {
    const gp = window.gamePlayers || window._players;
    if (!Array.isArray(gp)) return null;
    if (gp[p] && (gp[p].index === undefined || gp[p].index === p)) return gp[p];
    for (let i = 0; i < gp.length; i++) {
      if (gp[i] && gp[i].index === p) return gp[i];
    }
    return gp[p] || null;
  }

  function getPlayerLabel(p) {
    const obj = getPlayerObj(p);
    if (obj && obj.name) return String(obj.name);
    if (typeof window.getPlayerName === 'function') {
      const name = window.getPlayerName(p);
      if (name) return String(name);
    }
    if (typeof window.playerName === 'function') {
      const name = window.playerName(p);
      if (name) return String(name);
    }
    return tr('player', currentLang() === 'en' ? 'Player ' : '玩家') + (p + 1);
  }

  function getPlayerAvatar(p) {
    const obj = getPlayerObj(p);
    if (obj && obj.avatar) return String(obj.avatar);
    if (obj && obj.isBot) return '🤖';
    return FALLBACK_AVATARS[p % FALLBACK_AVATARS.length];
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

  function tickCountdown() {
    if (!activeWrap || !document.body.contains(activeWrap)) {
      clearTimer();
      return;
    }
    const fillEl = activeWrap.querySelector('.qr-timer-fill');
    const textEl = activeWrap.querySelector('.qr-timer-text');
    if (!fillEl || !textEl) return;

    if (!activeDeadline || activePhase === 'over' || activePhase === 'waiting') {
      fillEl.style.width = '0%';
      textEl.textContent = '0s';
      fillEl.classList.remove('is-urgent');
      textEl.classList.remove('is-urgent');
      return;
    }

    const remMs = Math.max(0, activeDeadline - Date.now());
    const remSec = Math.ceil(remMs / 1000);
    const pct = Math.max(0, Math.min(100, (remMs / Math.max(1, activeTotalMs)) * 100));
    fillEl.style.width = pct.toFixed(1) + '%';
    textEl.textContent = remSec + 's';

    const urgent = activePhase === 'question' && remMs <= 5000;
    fillEl.classList.toggle('is-urgent', urgent);
    textEl.classList.toggle('is-urgent', urgent);
  }

  function updateCountdownTarget(wrap, state) {
    activeWrap = wrap;
    activePhase = state.phase || 'question';
    const totalSec = state.phase === 'reveal' ? 3 : (state.timePerQuestion || 15);
    activeTotalMs = totalSec * 1000;
    activeDeadline = state.deadline || 0;
    tickCountdown();
    if (!timerInterval) {
      timerInterval = setInterval(tickCountdown, 100);
    }
  }

  function buildPlaySkeleton(container) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'qr-wrap';
    wrap.dataset.view = 'play';
    applySidewaysClass(wrap);

    const layout = document.createElement('div');
    layout.className = 'qr-play-layout';

    // 1. Chips bar (above question card)
    const chipsBar = document.createElement('div');
    chipsBar.className = 'qr-chips-bar';
    chipsBar.innerHTML = `
      <div class="qr-chips-left">
        <span class="qr-chip qr-chip-q" data-role="chip-q"></span>
        <span class="qr-chip qr-chip-cat" data-role="chip-cat"></span>
      </div>
      <div class="qr-chips-right">
        <span class="qr-chip qr-chip-streak" data-role="chip-streak" hidden></span>
        <span class="qr-chip qr-chip-rank" data-role="chip-rank"></span>
      </div>
    `;
    layout.appendChild(chipsBar);

    // 2. Question card
    const qCard = document.createElement('div');
    qCard.className = 'qr-question-card';
    qCard.innerHTML = `
      <div class="qr-double-ribbon" data-role="double-ribbon" hidden></div>
      <p class="qr-question-text" data-role="question-text"></p>
      <div class="qr-status-banner" data-role="status-banner"></div>
    `;
    layout.appendChild(qCard);

    // 3. Timer bar + big seconds number
    const timerWrap = document.createElement('div');
    timerWrap.className = 'qr-timer-wrap';
    timerWrap.innerHTML = `
      <div class="qr-timer-track"><div class="qr-timer-fill"></div></div>
      <div class="qr-timer-text">--</div>
    `;
    layout.appendChild(timerWrap);

    // 4. Options section (reveal floating result + 2x2 tiles)
    const optionsSection = document.createElement('div');
    optionsSection.className = 'qr-options-section';

    const revealResult = document.createElement('div');
    revealResult.className = 'qr-reveal-result';
    revealResult.hidden = true;
    revealResult.innerHTML = `
      <span class="qr-float-result" data-role="float-result"></span>
      <span class="qr-float-streak" data-role="float-streak" hidden></span>
    `;
    optionsSection.appendChild(revealResult);

    const grid = document.createElement('div');
    grid.className = 'qr-options-grid';

    for (let i = 0; i < 4; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `qr-option-btn qr-opt-${i}`;
      btn.dataset.option = String(i);
      btn.setAttribute('aria-label', OPTION_LABELS[i]);

      const fillBar = document.createElement('div');
      fillBar.className = 'qr-tile-fill-bar';
      btn.appendChild(fillBar);

      const shapeWrap = document.createElement('span');
      shapeWrap.className = 'qr-option-shape';
      shapeWrap.innerHTML = SHAPE_SVGS[i];
      btn.appendChild(shapeWrap);

      const content = document.createElement('div');
      content.className = 'qr-option-content';

      const label = document.createElement('span');
      label.className = 'qr-option-label';
      content.appendChild(label);

      const pickers = document.createElement('div');
      pickers.className = 'qr-option-pickers';
      pickers.hidden = true;
      content.appendChild(pickers);

      btn.appendChild(content);

      const checkRing = document.createElement('span');
      checkRing.className = 'qr-check-ring';
      checkRing.hidden = true;
      checkRing.innerHTML = CHECK_SVG;
      btn.appendChild(checkRing);

      btn.addEventListener('click', () => {
        if (!currentCtx.canClick || typeof currentCtx.sendMove !== 'function') return;
        currentCtx.canClick = false;
        if (window.Motion && typeof window.Motion.pop === 'function') {
          window.Motion.pop(btn);
        }
        currentCtx.sendMove({ answer: i });
      });

      grid.appendChild(btn);
    }

    optionsSection.appendChild(grid);
    layout.appendChild(optionsSection);

    // 5. Answered avatar bubbles strip
    const answeredStrip = document.createElement('div');
    answeredStrip.className = 'qr-answered-strip';
    layout.appendChild(answeredStrip);

    // 6. Live Leaderboard
    const lb = document.createElement('div');
    lb.className = 'qr-leaderboard';
    lb.innerHTML = `
      <div class="qr-lb-header">
        <span data-role="lb-title"></span>
        <span data-role="lb-total"></span>
      </div>
      <div class="qr-lb-list" data-role="lb-list"></div>
    `;
    layout.appendChild(lb);

    wrap.appendChild(layout);
    container.appendChild(wrap);
    return wrap;
  }

  function computeFallbackRanking(state, n) {
    if (Array.isArray(state.ranking) && state.ranking.length === n) {
      return state.ranking;
    }
    const list = [];
    for (let p = 0; p < n; p++) {
      list.push({
        player: p,
        score: (state.scores && state.scores[p]) || 0,
        correctCount: (state.correctCounts && state.correctCounts[p]) || 0,
        avgTimeMs: (state.avgTimeMs && state.avgTimeMs[p]) || 0,
      });
    }
    list.sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || a.player - b.player);
    return list;
  }

  function renderGameOver(container, state, playerIndex) {
    clearTimer();
    const lang = currentLang();
    const n = state.playerCount || 1;
    const ranking = computeFallbackRanking(state, n);

    let wrap = container.querySelector('.qr-wrap[data-view="over"]');
    if (!wrap) {
      container.innerHTML = '';
      wrap = document.createElement('div');
      wrap.className = 'qr-wrap';
      wrap.dataset.view = 'over';
      container.appendChild(wrap);
    }
    applySidewaysClass(wrap);

    const overCard = document.createElement('div');
    overCard.className = 'qr-over-card';

    const title = document.createElement('h3');
    title.className = 'qr-over-title';
    title.textContent = tr('qr_final_ranking', lang === 'en' ? 'Final Standings' : '最终排行榜');
    overCard.appendChild(title);

    // Podium for top 3 (ordered visually: 2nd, 1st, 3rd)
    const podiumOrder = [
      { entry: ranking[1], rank: 2 },
      { entry: ranking[0], rank: 1 },
      { entry: ranking[2], rank: 3 },
    ];
    const podium = document.createElement('div');
    podium.className = 'qr-podium';

    podiumOrder.forEach(({ entry, rank }) => {
      const col = document.createElement('div');
      col.className = `qr-podium-col rank-${rank}`;
      if (!entry) {
        col.style.visibility = 'hidden';
        podium.appendChild(col);
        return;
      }
      const avatarEl = document.createElement('div');
      avatarEl.className = 'qr-podium-avatar';
      avatarEl.textContent = getPlayerAvatar(entry.player);
      col.appendChild(avatarEl);

      const nameEl = document.createElement('div');
      nameEl.className = 'qr-podium-name';
      nameEl.textContent = getPlayerLabel(entry.player);
      col.appendChild(nameEl);

      const scoreEl = document.createElement('div');
      scoreEl.className = 'qr-podium-score';
      scoreEl.textContent = String(entry.score);
      col.appendChild(scoreEl);

      const barEl = document.createElement('div');
      barEl.className = 'qr-podium-bar';
      barEl.textContent = String(rank);
      col.appendChild(barEl);

      podium.appendChild(col);
    });
    overCard.appendChild(podium);

    // Full ranking table with correct count and average time per player
    const tableWrap = document.createElement('div');
    tableWrap.className = 'qr-over-table-wrap';

    const table = document.createElement('table');
    table.className = 'qr-over-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>${tr('qr_col_player', lang === 'en' ? 'Player' : '玩家')}</th>
          <th>${tr('qr_col_score', lang === 'en' ? 'Score' : '总分')}</th>
          <th>${tr('qr_col_correct', lang === 'en' ? 'Correct' : '答对')}</th>
          <th>${tr('qr_col_avg_time', lang === 'en' ? 'Avg' : '用时')}</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    ranking.forEach((row, idx) => {
      const trEl = document.createElement('tr');
      if (row.player === playerIndex) trEl.className = 'is-me';
      const avgSec = ((row.avgTimeMs || 0) / 1000).toFixed(1) + 's';

      const tdRank = document.createElement('td');
      tdRank.textContent = String(idx + 1);

      const tdPlayer = document.createElement('td');
      const playerCell = document.createElement('div');
      playerCell.className = 'qr-over-player-cell';
      const avSpan = document.createElement('span');
      avSpan.textContent = getPlayerAvatar(row.player);
      const nmSpan = document.createElement('span');
      nmSpan.className = 'qr-over-player-name';
      nmSpan.textContent = getPlayerLabel(row.player);
      playerCell.appendChild(avSpan);
      playerCell.appendChild(nmSpan);
      tdPlayer.appendChild(playerCell);

      const tdScore = document.createElement('td');
      tdScore.textContent = String(row.score);

      const tdCorrect = document.createElement('td');
      tdCorrect.textContent = `${row.correctCount} / ${state.totalQuestions || 10}`;

      const tdTime = document.createElement('td');
      tdTime.textContent = avgSec;

      trEl.appendChild(tdRank);
      trEl.appendChild(tdPlayer);
      trEl.appendChild(tdScore);
      trEl.appendChild(tdCorrect);
      trEl.appendChild(tdTime);
      tbody.appendChild(trEl);
    });

    tableWrap.appendChild(table);
    overCard.appendChild(tableWrap);

    wrap.innerHTML = '';
    wrap.appendChild(overCard);
  }

  function render(container, state, playerIndex, sendMove, isSpectator) {
    ensureStyles();
    ensureMotionAnnounce();

    if (!resizeBound) {
      resizeBound = true;
      window.addEventListener('resize', () => {
        const currentWrap = document.querySelector('.qr-wrap');
        if (currentWrap) applySidewaysClass(currentWrap);
      });
    }

    if (!state || state.phase === 'waiting' || (!state.question && state.phase !== 'over' && state.winner === null)) {
      clearTimer();
      lastQuestionKey = null;
      lastPhase = 'waiting';
      prevAnswered = [];
      prevScores = {};
      prevRanks = {};
      doubleAnnounced = false;
      container.innerHTML = '';
      const waitEl = document.createElement('div');
      waitEl.className = 'qr-wrap';
      waitEl.dataset.view = 'waiting';
      applySidewaysClass(waitEl);
      waitEl.innerHTML = `<div class="qr-question-card"><p class="qr-question-text">${tr('waiting_start', 'Waiting for game to start...')}</p></div>`;
      container.appendChild(waitEl);
      return;
    }

    const isOver = state.phase === 'over' || state.winner !== null;
    if (isOver) {
      lastPhase = 'over';
      renderGameOver(container, state, playerIndex);
      return;
    }

    const lang = currentLang();
    const qData = (state.question && state.question[lang]) || (state.question && state.question.zh) || { q: '', opts: [] };
    const n = state.playerCount || 1;
    const isReveal = state.phase === 'reveal';
    const curQ = state.currentQuestion || ((state.questionIndex || 0) + 1);
    const totalQ = state.totalQuestions || 10;
    const isDouble = Boolean(state.isDouble || curQ > totalQ - 3);
    const qKey = `${curQ}:${state.questionId || ''}`;
    const isNewQuestion = qKey !== lastQuestionKey;
    const isNewPhase = state.phase !== lastPhase || isNewQuestion;

    if (curQ <= 1 && !isDouble) {
      doubleAnnounced = false;
    }

    let wrap = container.querySelector('.qr-wrap[data-view="play"]');
    if (!wrap) {
      wrap = buildPlaySkeleton(container);
      prevAnswered = [];
      prevScores = {};
      prevRanks = {};
    } else {
      applySidewaysClass(wrap);
    }

    const myAnswered =
      typeof playerIndex === 'number' && state.answered && Boolean(state.answered[playerIndex]);
    const myChoice =
      typeof playerIndex === 'number' && state.choices && state.choices[playerIndex] != null
        ? state.choices[playerIndex]
        : state.myChoice ?? null;

    const canClick =
      !isSpectator &&
      state.phase === 'question' &&
      !myAnswered &&
      typeof playerIndex === 'number' &&
      playerIndex >= 0;

    currentCtx = {
      state,
      playerIndex,
      sendMove,
      isSpectator,
      canClick,
    };

    const ranking = computeFallbackRanking(state, n);
    const myRankIndex = ranking.findIndex((r) => r.player === playerIndex);
    const myScore = typeof playerIndex === 'number' && state.scores ? state.scores[playerIndex] || 0 : 0;
    const myStreak =
      typeof playerIndex === 'number' && state.streaks && state.streaks[playerIndex]
        ? state.streaks[playerIndex]
        : 0;

    // 1. Update chips
    const chipQ = wrap.querySelector('[data-role="chip-q"]');
    if (chipQ) chipQ.textContent = `Q ${curQ} / ${totalQ}`;

    const chipCat = wrap.querySelector('[data-role="chip-cat"]');
    if (chipCat) chipCat.textContent = categoryLabel(state.questionCat || state.category || 'general');

    const chipStreak = wrap.querySelector('[data-role="chip-streak"]');
    if (chipStreak) {
      if (myStreak >= 2) {
        chipStreak.hidden = false;
        chipStreak.textContent = `🔥 ${myStreak} ${tr('qr_streak', lang === 'en' ? 'Streak' : '连对')}`;
      } else {
        chipStreak.hidden = true;
      }
    }

    const chipRank = wrap.querySelector('[data-role="chip-rank"]');
    if (chipRank) {
      const rankNum = myRankIndex >= 0 ? myRankIndex + 1 : 1;
      chipRank.textContent = `#${rankNum} · ${myScore}`;
    }

    // 2. Update Question Card & Double Points Ribbon
    const qCard = wrap.querySelector('.qr-question-card');
    const dblRibbon = wrap.querySelector('[data-role="double-ribbon"]');
    if (dblRibbon) {
      dblRibbon.hidden = !isDouble;
      if (isDouble) {
        dblRibbon.textContent = `⚡ ${tr('qr_double_points', lang === 'en' ? 'Double points' : '双倍积分')}`;
      }
    }

    if (isDouble && !doubleAnnounced && state.phase === 'question') {
      doubleAnnounced = true;
      if (window.Motion && typeof window.Motion.announce === 'function') {
        window.Motion.announce({
          title: tr('qr_double_announce', lang === 'en' ? 'Double points!' : '双倍积分！'),
          icon: '⚡',
          tone: 'warn',
        });
      }
    }

    const qText = wrap.querySelector('[data-role="question-text"]');
    if (qText && (isNewQuestion || qText.textContent !== (qData.q || ''))) {
      qText.textContent = qData.q || '';
      if (isNewQuestion && qCard && window.Motion && typeof window.Motion.fade === 'function') {
        window.Motion.fade(qCard);
      }
    }

    const statusBanner = wrap.querySelector('[data-role="status-banner"]');
    if (statusBanner) {
      let statusTxt = '';
      let lockedCls = false;
      if (isReveal) {
        statusTxt = tr('qr_revealing', lang === 'en' ? 'Revealing correct answer...' : '公布正确答案...');
      } else if (isSpectator) {
        statusTxt = tr('qr_players_answering', lang === 'en' ? 'Players are answering...' : '玩家正在作答...');
      } else if (myAnswered) {
        statusTxt = tr('qr_answer_locked', lang === 'en' ? 'Answer locked, waiting for others' : '已锁定答案，等待其他玩家');
        lockedCls = true;
      } else {
        statusTxt = tr('qr_pick_answer', lang === 'en' ? 'Tap the correct answer as fast as you can!' : '请尽快点击正确答案！');
      }
      if (statusBanner.textContent !== statusTxt) {
        statusBanner.textContent = statusTxt;
      }
      statusBanner.classList.toggle('is-locked', lockedCls);
    }

    // 3. Update Timer
    updateCountdownTarget(wrap, state);

    // 4. Update Reveal Floating Result & 2x2 Option Tiles (in place)
    const revealResultEl = wrap.querySelector('.qr-reveal-result');
    const floatResultEl = wrap.querySelector('[data-role="float-result"]');
    const floatStreakEl = wrap.querySelector('[data-role="float-streak"]');

    if (revealResultEl && floatResultEl && floatStreakEl) {
      if (isReveal) {
        const myPts =
          typeof playerIndex === 'number' && state.roundPoints ? state.roundPoints[playerIndex] || 0 : 0;
        let resText = '';
        let resKind = 'res-no-answer';
        if (myPts > 0) {
          resText = `+${myPts}`;
          resKind = 'res-correct';
        } else if (myChoice !== null && myChoice !== undefined) {
          resText = tr('qr_wrong_short', lang === 'en' ? 'Wrong' : '回答错误');
          resKind = 'res-wrong';
        } else {
          resText = tr('qr_no_answer', lang === 'en' ? 'No answer' : '未作答');
          resKind = 'res-no-answer';
        }
        floatResultEl.textContent = resText;
        floatResultEl.className = `qr-float-result ${resKind}`;

        if (myStreak >= 3) {
          floatStreakEl.hidden = false;
          floatStreakEl.textContent = `🔥 ${tr('qr_streak_label', lang === 'en' ? 'streak' : '连对')} ${myStreak}`;
        } else {
          floatStreakEl.hidden = true;
        }

        const wasHidden = revealResultEl.hidden;
        revealResultEl.hidden = false;
        if ((wasHidden || isNewPhase) && window.Motion && typeof window.Motion.pop === 'function') {
          window.Motion.pop(revealResultEl);
        }
      } else {
        revealResultEl.hidden = true;
      }
    }

    const opts = Array.isArray(qData.opts) ? qData.opts : [];
    const optionBtns = wrap.querySelectorAll('.qr-option-btn');
    optionBtns.forEach((btn, i) => {
      btn.disabled = !canClick;

      const labelEl = btn.querySelector('.qr-option-label');
      const nextLabel = opts[i] != null ? String(opts[i]) : '';
      if (labelEl && labelEl.textContent !== nextLabel) {
        labelEl.textContent = nextLabel;
      }

      const isSelected = myChoice === i;
      const isDimmed = !isReveal && myAnswered && myChoice !== i;
      const isCorrect = isReveal && state.answer === i;
      const isWrongTile = isReveal && state.answer !== i;

      btn.classList.toggle('is-selected', isSelected && !isReveal);
      btn.classList.toggle('is-dimmed', isDimmed);
      btn.classList.toggle('is-correct', isCorrect);
      btn.classList.toggle('is-wrong-tile', isWrongTile);

      const checkRing = btn.querySelector('.qr-check-ring');
      if (checkRing) {
        checkRing.hidden = !(isSelected && !isReveal) && !isCorrect;
      }

      const fillBar = btn.querySelector('.qr-tile-fill-bar');
      const pickersEl = btn.querySelector('.qr-option-pickers');

      if (isReveal && Array.isArray(state.choices)) {
        const pickers = [];
        for (let p = 0; p < n; p++) {
          if (state.choices[p] === i) pickers.push(p);
        }
        const pct = n > 0 ? Math.round((pickers.length / n) * 100) : 0;
        if (fillBar) fillBar.style.width = `${pct}%`;

        if (pickersEl) {
          if (pickers.length > 0) {
            pickersEl.hidden = false;
            const sig = pickers.map((p) => `${p}:${getPlayerAvatar(p)}:${getPlayerLabel(p)}`).join('|');
            if (pickersEl.dataset.sig !== sig) {
              pickersEl.dataset.sig = sig;
              pickersEl.innerHTML = '';
              pickers.forEach((p) => {
                const tag = document.createElement('span');
                tag.className = 'qr-picker-tag';
                tag.title = getPlayerLabel(p);
                const av = document.createElement('span');
                av.className = 'qr-picker-avatar';
                av.textContent = getPlayerAvatar(p);
                const nm = document.createElement('span');
                nm.className = 'qr-picker-name';
                nm.textContent = getPlayerLabel(p);
                tag.appendChild(av);
                tag.appendChild(nm);
                pickersEl.appendChild(tag);
              });
            }
          } else {
            pickersEl.hidden = true;
            pickersEl.dataset.sig = '';
            pickersEl.innerHTML = '';
          }
        }
      } else {
        if (fillBar) fillBar.style.width = '0%';
        if (pickersEl) {
          pickersEl.hidden = true;
          pickersEl.dataset.sig = '';
          pickersEl.innerHTML = '';
        }
      }
    });

    // 5. Update Who Has Answered avatar bubbles in place (animate only on change)
    const answeredStrip = wrap.querySelector('.qr-answered-strip');
    if (answeredStrip) {
      while (answeredStrip.children.length > n) {
        answeredStrip.lastElementChild.remove();
      }
      while (answeredStrip.children.length < n) {
        const idx = answeredStrip.children.length;
        const bubble = document.createElement('div');
        bubble.className = 'qr-answer-bubble';
        bubble.dataset.player = String(idx);
        bubble.innerHTML = `
          <div class="qr-bubble-circle">
            <span class="qr-bubble-emoji"></span>
            <span class="qr-bubble-tick" aria-hidden="true">✓</span>
          </div>
          <span class="qr-bubble-name"></span>
        `;
        answeredStrip.appendChild(bubble);
      }

      for (let p = 0; p < n; p++) {
        const bubble = answeredStrip.children[p];
        const hasAns = Boolean(state.answered && state.answered[p]);
        const wasAns = !isNewQuestion && Boolean(prevAnswered[p]);

        const emojiEl = bubble.querySelector('.qr-bubble-emoji');
        const avatarTxt = getPlayerAvatar(p);
        if (emojiEl && emojiEl.textContent !== avatarTxt) {
          emojiEl.textContent = avatarTxt;
        }

        const nameEl = bubble.querySelector('.qr-bubble-name');
        const nameTxt = getPlayerLabel(p);
        if (nameEl && nameEl.textContent !== nameTxt) {
          nameEl.textContent = nameTxt;
        }

        bubble.classList.toggle('has-answered', hasAns);

        if (hasAns && !wasAns && !isNewQuestion && window.Motion && typeof window.Motion.pop === 'function') {
          window.Motion.pop(bubble);
        }
        prevAnswered[p] = hasAns;
      }
    }

    // 6. Update Live Leaderboard in place (countTo on score change, slide on rank change)
    const lbTitle = wrap.querySelector('[data-role="lb-title"]');
    if (lbTitle) lbTitle.textContent = tr('qr_leaderboard', lang === 'en' ? 'Live Standings' : '实时积分榜');

    const lbTotal = wrap.querySelector('[data-role="lb-total"]');
    if (lbTotal) lbTotal.textContent = `${tr('qr_total_questions', lang === 'en' ? 'Total' : '共')} ${totalQ}`;

    const lbList = wrap.querySelector('[data-role="lb-list"]');
    if (lbList) {
      const oldRects = {};
      const rowMap = {};
      Array.from(lbList.children).forEach((el) => {
        const p = Number(el.dataset.player);
        rowMap[p] = el;
        oldRects[p] = el.getBoundingClientRect();
      });

      ranking.forEach((row, rankIdx) => {
        const p = row.player;
        let rowEl = rowMap[p];
        if (!rowEl) {
          rowEl = document.createElement('div');
          rowEl.className = 'qr-lb-row';
          rowEl.dataset.player = String(p);
          rowEl.innerHTML = `
            <div class="qr-lb-left">
              <span class="qr-lb-rank"></span>
              <span class="qr-lb-avatar"></span>
              <span class="qr-lb-name"></span>
            </div>
            <div class="qr-lb-right">
              <span class="qr-lb-delta" hidden></span>
              <span class="qr-lb-score">0</span>
            </div>
          `;
          rowMap[p] = rowEl;
        }

        const isMe = p === playerIndex;
        const isExtra = rankIdx >= 3 && !isMe;
        rowEl.className =
          'qr-lb-row' +
          (rankIdx < 3 ? ` rank-${rankIdx + 1}` : '') +
          (isMe ? ' is-me' : '') +
          (isExtra ? ' qr-lb-extra' : '');

        const rankEl = rowEl.querySelector('.qr-lb-rank');
        if (rankEl) rankEl.textContent = String(rankIdx + 1);

        const avEl = rowEl.querySelector('.qr-lb-avatar');
        const avTxt = getPlayerAvatar(p);
        if (avEl && avEl.textContent !== avTxt) avEl.textContent = avTxt;

        const nmEl = rowEl.querySelector('.qr-lb-name');
        const nmTxt = getPlayerLabel(p);
        if (nmEl && nmEl.textContent !== nmTxt) nmEl.textContent = nmTxt;

        const deltaEl = rowEl.querySelector('.qr-lb-delta');
        const deltaPts = isReveal && state.roundPoints ? state.roundPoints[p] || 0 : 0;
        if (deltaEl) {
          if (deltaPts > 0) {
            deltaEl.hidden = false;
            deltaEl.textContent = `+${deltaPts}`;
          } else {
            deltaEl.hidden = true;
          }
        }

        const scoreEl = rowEl.querySelector('.qr-lb-score');
        const prevScore = prevScores[p];
        if (scoreEl) {
          if (prevScore !== undefined && prevScore !== row.score && window.Motion && typeof window.Motion.countTo === 'function') {
            scoreEl.textContent = String(prevScore);
            window.Motion.countTo(scoreEl, row.score, 360);
          } else if (prevScore !== row.score) {
            scoreEl.textContent = String(row.score);
          }
        }
        prevScores[p] = row.score;

        lbList.appendChild(rowEl);
      });

      // Animate rank changes with a short slide
      ranking.forEach((row, rankIdx) => {
        const p = row.player;
        const prevRank = prevRanks[p];
        const rowEl = rowMap[p];
        if (
          prevRank !== undefined &&
          prevRank !== rankIdx &&
          oldRects[p] &&
          oldRects[p].height > 0 &&
          rowEl &&
          window.Motion &&
          typeof window.Motion.flyFrom === 'function'
        ) {
          window.Motion.flyFrom(rowEl, oldRects[p], 260);
        }
        prevRanks[p] = rankIdx;
      });
    }

    lastQuestionKey = qKey;
    lastPhase = state.phase;
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
