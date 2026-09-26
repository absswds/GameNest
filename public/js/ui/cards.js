// Shared playing-card renderer. Returns HTML strings to match the renderers'
// string-building style. Card shape: { id, suit: 's'|'h'|'c'|'d'|'wild'|'ghost', rank }
// Jokers: id 'SJ' / 'BJ' (Dou Dizhu).
(function() {
  var SUIT_SYMBOL = { s: '♠', h: '♥', c: '♣', d: '♦' };

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function isRed(card) {
    return card.suit === 'h' || card.suit === 'd' || card.id === 'BJ';
  }

  function render(card, opts) {
    opts = opts || {};
    var cls = 'pc-card pc-' + (opts.size || 'md');
    if (opts.selected) cls += ' is-selected';
    if (opts.disabled) cls += ' is-disabled';
    if (opts.className) cls += ' ' + opts.className;
    var attrs = opts.attrs || '';
    var style = opts.index != null ? ' style="--i:' + opts.index + '"' : '';

    if (!card || opts.faceDown) {
      return '<div class="' + cls + ' pc-back"' + style + ' ' + attrs + '></div>';
    }

    var dataId = card.id != null ? ' data-id="' + esc(card.id) + '"' : '';

    if (card.id === 'SJ' || card.id === 'BJ') {
      var jokerLabel = opts.jokerLabel || (card.id === 'BJ' ? 'JOKER' : 'joker');
      return '<div class="' + cls + ' pc-joker' + (card.id === 'BJ' ? ' pc-red' : '') + '"' + dataId + style + ' ' + attrs + '>' +
        '<span class="pc-joker-text">' + esc(jokerLabel) + '</span><span class="pc-pip">★</span></div>';
    }
    if (card.suit === 'wild') {
      return '<div class="' + cls + ' pc-special pc-wild"' + dataId + style + ' ' + attrs + '><span class="pc-pip">★</span></div>';
    }
    if (card.suit === 'ghost') {
      return '<div class="' + cls + ' pc-special pc-ghost"' + dataId + style + ' ' + attrs + '><span class="pc-pip">👻</span></div>';
    }

    var sym = SUIT_SYMBOL[card.suit] || '';
    var corner = '<span class="pc-rank">' + esc(card.rank) + '</span><span class="pc-suit">' + sym + '</span>';
    return '<div class="' + cls + (isRed(card) ? ' pc-red' : '') + '"' + dataId + style + ' ' + attrs + '>' +
      '<span class="pc-corner">' + corner + '</span>' +
      '<span class="pc-pip">' + sym + '</span>' +
      '<span class="pc-corner pc-corner-br">' + corner + '</span>' +
      '</div>';
  }

  // A row of cards. layout: 'row' (tabletop), 'hand' (fan on desktop, scroll on phones)
  function group(cards, opts) {
    opts = opts || {};
    var html = '';
    for (var i = 0; i < cards.length; i++) {
      var o = Object.assign({}, opts.cardOpts ? opts.cardOpts(cards[i], i) : opts, { index: i });
      html += render(cards[i], o);
    }
    var layout = opts.layout || 'row';
    return '<div class="pc-group pc-layout-' + layout + (opts.deal ? ' pc-deal' : '') + '" style="--n:' + cards.length + '">' + html + '</div>';
  }

  window.CardUI = { render: render, group: group, isRed: isRed, SUIT_SYMBOL: SUIT_SYMBOL };

  // Scroll-position bar under any horizontally scrolling hand, so phone players can
  // see there are more cards and where they are. Tap the bar to jump.
  var SCROLLERS = '.pc-layout-hand, .ek-hand-wrap';
  function syncBar(el) {
    var bar = el.nextElementSibling;
    var over = el.scrollWidth - el.clientWidth > 4;
    if (!bar || !bar.classList.contains('hs-bar')) {
      if (!over) return;
      bar = document.createElement('div');
      bar.className = 'hs-bar';
      bar.innerHTML = '<i></i>';
      bar.addEventListener('click', function (e) {
        var r = bar.getBoundingClientRect();
        el.scrollTo({ left: (e.clientX - r.left) / r.width * el.scrollWidth - el.clientWidth / 2, behavior: 'smooth' });
      });
      el.parentNode.insertBefore(bar, el.nextSibling);
    }
    bar.hidden = !over;
    if (!over) return;
    var thumb = bar.firstChild;
    thumb.style.width = (el.clientWidth / el.scrollWidth * 100) + '%';
    thumb.style.left = (el.scrollLeft / el.scrollWidth * 100) + '%';
  }
  var pending = false;
  function syncAll() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      var els = document.querySelectorAll(SCROLLERS);
      for (var i = 0; i < els.length; i++) syncBar(els[i]);
    });
  }
  document.addEventListener('scroll', function (e) {
    if (e.target.matches && e.target.matches(SCROLLERS)) syncBar(e.target);
  }, true);
  window.addEventListener('resize', syncAll);
  if (window.MutationObserver) {
    new MutationObserver(function (list) {
      // Ignore our own bar updates
      for (var i = 0; i < list.length; i++) {
        var t = list[i].target;
        if (!(t.classList && (t.classList.contains('hs-bar') || (t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('hs-bar'))))) { syncAll(); return; }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
