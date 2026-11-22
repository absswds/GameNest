// Lobby acceptance shots: 4 viewports x light/dark, plus automatic checks from the v2.3 lobby acceptance list.
// Usage: NODE_PATH=<dir>/node_modules node scripts/shot-lobby.js [baseUrl] [outDir]
//   needs playwright-core and a running server. Env CHROME overrides the chromium path.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const base = process.argv[2] || 'http://localhost:3000';
const out = path.resolve(process.argv[3] || 'shots-lobby');
const CHROME = process.env.CHROME || path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const SIZES = [['phone', 390, 844, true], ['sideways', 812, 375, true], ['tablet', 1024, 768, true], ['desk', 1280, 800, false]];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: CHROME });
  const problems = [];
  for (const theme of ['light', 'dark']) {
    for (const [tag, width, height, touch] of SIZES) {
      const ctx = await b.newContext({ viewport: { width, height }, hasTouch: touch, colorScheme: theme });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.addInitScript(() => {
        window.__shifts = 0;
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts += e.value; })
          .observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(base + '/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);
      const info = await page.evaluate(() => {
        const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
        const cards = [...document.querySelectorAll('.lb-card')].filter(vis);
        const cols = new Set(cards.slice(0, 8).map((c) => Math.round(c.getBoundingClientRect().left))).size;
        const search = document.getElementById('gameSearch');
        return {
          theme: document.documentElement.getAttribute('data-theme') || getComputedStyle(document.body).backgroundColor,
          cards: cards.length,
          cols,
          searchVisible: vis(search) && getComputedStyle(search.closest('.lb-search-wrap') || search).opacity !== '0',
          hScroll: document.documentElement.scrollWidth > innerWidth + 1,
          shifts: Math.round(window.__shifts * 1000) / 1000,
        };
      });
      const name = `${theme}-${tag}-${width}x${height}`;
      await page.screenshot({ path: path.join(out, name + '.png') });
      await page.screenshot({ path: path.join(out, name + '-full.png'), fullPage: true });
      if (errs.length) problems.push(`${name}: page errors ${errs.join(' | ')}`);
      if (info.hScroll) problems.push(`${name}: horizontal scroll`);
      if (info.shifts > 0.01) problems.push(`${name}: layout shift ${info.shifts}`);
      if (tag === 'tablet' && (info.cols < 3 || !info.searchVisible)) problems.push(`${name}: not desktop layout (cols ${info.cols}, search ${info.searchVisible})`);
      console.log(name, JSON.stringify(info));
      await ctx.close();
    }
  }
  // reduced motion: switching theme and category must not animate
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + '/');
  await page.waitForTimeout(500);
  const anims = await page.evaluate(async () => {
    const before = document.getAnimations().length;
    const chips = document.querySelectorAll('.lb-chip, [data-cat]');
    if (chips[1]) chips[1].click();
    const t = document.querySelector('#themeBtn, .lb-theme-btn, [aria-label*="模式"]');
    if (t) t.click();
    await new Promise((r) => setTimeout(r, 50));
    return document.getAnimations().filter((a) => a.playState === 'running').length - before;
  });
  if (anims > 0) problems.push(`reduced motion: ${anims} running animations after theme/category switch`);
  await ctx.close();
  await b.close();
  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'all checks passed');
})();
