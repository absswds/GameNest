// public/js/ui/sheet.js
(function() {
  window.GNUI = window.GNUI || {};

  var sheetSeq = 0;

  function isReducedMotion() {
    if (window.Motion && typeof window.Motion.reduced === 'function') {
      return window.Motion.reduced();
    }
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function getEase() {
    return (window.Motion && window.Motion.EASE) || 'cubic-bezier(.2,.8,.2,1)';
  }

  function focusSafely(node) {
    if (!node || typeof node.focus !== 'function') return;
    try {
      node.focus({ preventScroll: true });
    } catch (e) {
      node.focus();
    }
  }

  function createSheet(opts) {
    opts = opts || {};
    sheetSeq += 1;
    var titleId = 'uiSheetTitle-' + sheetSeq;

    var backdrop = document.createElement('div');
    backdrop.className = 'ui-sheet-backdrop' + (opts.desktopDialog ? ' ui-sheet-responsive' : '');
    backdrop.hidden = true;
    if (opts.id) backdrop.id = opts.id;

    var sheetEl = document.createElement('div');
    sheetEl.className = 'ui-sheet';
    sheetEl.setAttribute('role', 'dialog');
    sheetEl.setAttribute('aria-modal', 'true');
    sheetEl.setAttribute('aria-labelledby', titleId);

    var handleEl = document.createElement('div');
    handleEl.className = 'ui-sheet-handle';
    handleEl.setAttribute('aria-hidden', 'true');

    var headEl = document.createElement('div');
    headEl.className = 'ui-sheet-head';

    var titleEl = document.createElement('h2');
    titleEl.className = 'ui-sheet-title';
    titleEl.id = titleId;
    titleEl.textContent = opts.title != null ? String(opts.title) : '';

    var closeLabel = typeof window._t === 'function' ? window._t('ui_sheet_close') : 'Close';
    if (!closeLabel || closeLabel === 'ui_sheet_close') closeLabel = 'Close';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ui-sheet-close';
    closeBtn.setAttribute('aria-label', closeLabel);
    closeBtn.textContent = '✕';

    headEl.appendChild(titleEl);
    headEl.appendChild(closeBtn);

    var bodyEl = document.createElement('div');
    bodyEl.className = 'ui-sheet-body';

    sheetEl.appendChild(handleEl);
    sheetEl.appendChild(headEl);
    sheetEl.appendChild(bodyEl);
    backdrop.appendChild(sheetEl);
    document.body.appendChild(backdrop);

    var prevFocus = null;
    var isClosing = false;
    var destroyed = false;
    var animToken = 0;
    var activeAnims = [];

    function cancelAnims() {
      animToken += 1;
      for (var i = 0; i < activeAnims.length; i++) {
        try { activeAnims[i].cancel(); } catch (e) {}
      }
      activeAnims = [];
    }

    function setContent(nodeOrHtml) {
      bodyEl.innerHTML = '';
      if (nodeOrHtml && typeof nodeOrHtml === 'object' && nodeOrHtml.nodeType) {
        bodyEl.appendChild(nodeOrHtml);
      } else if (typeof nodeOrHtml === 'string') {
        bodyEl.innerHTML = nodeOrHtml;
      }
    }

    if (opts.content !== undefined) {
      setContent(opts.content);
    }

    function isOpen() {
      return !destroyed && !backdrop.hidden && !isClosing;
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && isOpen()) {
        e.preventDefault();
        close();
      }
    }

    function isCenteredDialog() {
      return !!(opts.desktopDialog && window.matchMedia && window.matchMedia('(min-width: 768px)').matches);
    }

    function open() {
      if (destroyed) return;
      if (!backdrop.hidden && !isClosing) return;
      cancelAnims();
      isClosing = false;
      prevFocus = document.activeElement;
      backdrop.hidden = false;
      backdrop.style.opacity = '';
      sheetEl.style.transform = '';

      if (typeof opts.onOpen === 'function') {
        opts.onOpen(api);
      }

      document.addEventListener('keydown', onKeyDown);

      if (typeof backdrop.animate === 'function' && typeof sheetEl.animate === 'function') {
        var ease = getEase();
        if (isReducedMotion()) {
          activeAnims.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: ease }));
        } else if (isCenteredDialog()) {
          activeAnims.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: ease }));
          activeAnims.push(sheetEl.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 220, easing: ease }));
        } else {
          activeAnims.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: ease }));
          activeAnims.push(sheetEl.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 260, easing: ease }));
        }
      }

      focusSafely(closeBtn);
    }

    function close() {
      if (destroyed || backdrop.hidden || isClosing) return;
      cancelAnims();
      isClosing = true;
      document.removeEventListener('keydown', onKeyDown);

      var token = animToken;
      var currentTransform = sheetEl.style.transform || 'translateY(0)';
      var currentOpacity = backdrop.style.opacity !== '' ? Number(backdrop.style.opacity) : 1;

      function finishClose() {
        if (token !== animToken || destroyed) return;
        isClosing = false;
        backdrop.hidden = true;
        backdrop.style.opacity = '';
        sheetEl.style.transform = '';
        // The close animations use fill:'forwards'; cancel them, or their final
        // frame (opacity 0, off-screen) overrides the sheet on the next open.
        cancelAnims();
        if (prevFocus && prevFocus.isConnected) {
          focusSafely(prevFocus);
        }
        prevFocus = null;
        if (typeof opts.onClose === 'function') {
          opts.onClose(api);
        }
      }

      if (typeof backdrop.animate === 'function' && typeof sheetEl.animate === 'function') {
        var ease = getEase();
        if (isReducedMotion()) {
          var fadeOut = backdrop.animate([{ opacity: currentOpacity }, { opacity: 0 }], { duration: 120, easing: ease, fill: 'forwards' });
          activeAnims.push(fadeOut);
          fadeOut.onfinish = finishClose;
        } else if (isCenteredDialog()) {
          var dlgBgAnim = backdrop.animate([{ opacity: currentOpacity }, { opacity: 0 }], { duration: 180, easing: ease, fill: 'forwards' });
          var dlgAnim = sheetEl.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 180, easing: ease, fill: 'forwards' });
          activeAnims.push(dlgBgAnim, dlgAnim);
          dlgAnim.onfinish = finishClose;
        } else {
          var bgAnim = backdrop.animate([{ opacity: currentOpacity }, { opacity: 0 }], { duration: 200, easing: ease, fill: 'forwards' });
          var sheetAnim = sheetEl.animate([{ transform: currentTransform }, { transform: 'translateY(100%)' }], { duration: 200, easing: ease, fill: 'forwards' });
          activeAnims.push(bgAnim, sheetAnim);
          sheetAnim.onfinish = finishClose;
        }
      } else {
        finishClose();
      }
    }

    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) close();
    });

    closeBtn.addEventListener('click', function() {
      close();
    });

    // Swipe-down to dismiss on handle, header, or body (when scrolled to top)
    var dragState = null;

    function startDrag(clientY, fromBody) {
      if (!isOpen() || isCenteredDialog()) return;
      if (fromBody && bodyEl.scrollTop > 0) return;
      cancelAnims();
      dragState = { startY: clientY, dy: 0, active: false, fromBody: fromBody };
    }

    function moveDrag(clientY, preventDefault) {
      if (!dragState) return;
      var dy = clientY - dragState.startY;
      if (!dragState.active) {
        if (dy <= 6) return;
        if (dragState.fromBody && bodyEl.scrollTop > 0) {
          dragState = null;
          return;
        }
        dragState.active = true;
      }
      if (dy < 0) dy = 0;
      dragState.dy = dy;
      if (preventDefault) preventDefault();
      sheetEl.style.transform = 'translateY(' + dy + 'px)';
      backdrop.style.opacity = String(Math.max(0.2, 1 - dy / 300));
    }

    function endDrag() {
      if (!dragState) return;
      var wasActive = dragState.active;
      var dy = dragState.dy;
      dragState = null;
      if (!wasActive) return;

      if (dy > 80) {
        close();
        return;
      }

      if (typeof sheetEl.animate === 'function' && !isReducedMotion()) {
        var ease = getEase();
        var curOp = backdrop.style.opacity !== '' ? Number(backdrop.style.opacity) : 1;
        var a1 = sheetEl.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'translateY(0)' }], { duration: 180, easing: ease });
        var a2 = backdrop.animate([{ opacity: curOp }, { opacity: 1 }], { duration: 180, easing: ease });
        activeAnims.push(a1, a2);
      }
      sheetEl.style.transform = '';
      backdrop.style.opacity = '';
    }

    function bindSwipeTarget(target, fromBody) {
      if (window.PointerEvent) {
        target.addEventListener('pointerdown', function(e) {
          if (e.button !== undefined && e.button !== 0) return;
          if (e.target && e.target.closest && e.target.closest('.ui-sheet-close')) return;
          startDrag(e.clientY, fromBody);
        });
      } else {
        target.addEventListener('touchstart', function(e) {
          if (!e.touches || !e.touches[0]) return;
          if (e.target && e.target.closest && e.target.closest('.ui-sheet-close')) return;
          startDrag(e.touches[0].clientY, fromBody);
        }, { passive: true });
      }
    }

    bindSwipeTarget(handleEl, false);
    bindSwipeTarget(headEl, false);
    bindSwipeTarget(bodyEl, true);

    var onMove = null;
    var onEnd = null;
    if (window.PointerEvent) {
      onMove = function(e) {
        moveDrag(e.clientY, function() { if (e.cancelable) e.preventDefault(); });
      };
      onEnd = endDrag;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    } else {
      onMove = function(e) {
        if (!e.touches || !e.touches[0]) return;
        moveDrag(e.touches[0].clientY, function() { if (e.cancelable) e.preventDefault(); });
      };
      onEnd = endDrag;
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
      window.addEventListener('touchcancel', onEnd);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnims();
      document.removeEventListener('keydown', onKeyDown);
      if (window.PointerEvent) {
        if (onMove) window.removeEventListener('pointermove', onMove);
        if (onEnd) {
          window.removeEventListener('pointerup', onEnd);
          window.removeEventListener('pointercancel', onEnd);
        }
      } else {
        if (onMove) window.removeEventListener('touchmove', onMove);
        if (onEnd) {
          window.removeEventListener('touchend', onEnd);
          window.removeEventListener('touchcancel', onEnd);
        }
      }
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    var api = {
      open: open,
      close: close,
      isOpen: isOpen,
      setContent: setContent,
      el: backdrop,
      bodyEl: bodyEl,
      destroy: destroy
    };

    return api;
  }

  window.GNUI.sheet = createSheet;
})();
