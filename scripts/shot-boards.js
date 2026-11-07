// Screenshot every game's board mid-game (room + bots, started) for visual review.
// Usage: node scripts/shot-boards.js [baseUrl] [outDir] [game ...]
//   needs playwright-core (npm i playwright-core in any folder on NODE_PATH) and a running server.
// Env CHROME = path to chrome.exe (defaults to the Playwright chromium under %LOCALAPPDATA%).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const base = process.argv[2] || 'http://localhost:3000';
const out = path.resolve(process.argv[3] || 'shots');
const only = process.argv.slice(4);
const GAMES = only.length ? only : ['tictactoe', 'gomoku', 'go9', 'reversi', 'connect4', 'checkers', 'chess', 'chinesechess',
  'battleship', 'flightchess', 'monopoly', 'davinci', 'rummikub', 'uno', 'doudizhu', 'bigtwo', 'texas', 'hearts', 'oldmaid',
  'liarsbar', 'exploding-kittens', 'mahjong-sichuan', 'mahjong-cantonese', 'sanguo', 'werewolf', 'numberbomb', 'twentyfour',
  'snakebattle', 'suikabattle', '2048', 'sudoku', 'minesweeper', 'sheeptile', 'drawguess', 'truthdare'];
const BOTS = { doudizhu: 2, hearts: 3, 'mahjong-sichuan': 3, 'mahjong-cantonese': 3, sanguo: 4, werewolf: 5, monopoly: 2, texas: 3, bigtwo: 3, uno: 2, liarsbar: 3, flightchess: 3, rummikub: 2 };
const SOLO = ['2048', 'sudoku', 'minesweeper', 'numberbomb', 'twentyfour', 'suikabattle', 'sheeptile'];
const CHROME = process.env.CHROME || path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1248/chrome-win64/chrome.exe');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: CHROME });
  for (const game of GAMES) {
    for (const [tag, vp] of [['desk', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
      const page = await b.newPage({ viewport: vp });
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      try {
        await page.goto(base + '/');
        // create the room over the lobby's own protocol, then let game.html resume it
        await page.evaluate(async ({ game, base }) => {
          const ws = new WebSocket(base.replace(/^http/, 'ws'));
          const msg = await new Promise((res, rej) => {
            ws.onopen = () => ws.send(JSON.stringify({ type: 'create_room', data: { game, lang: 'zh' } }));
            ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === 'room_created') res(m); if (m.type === 'error') rej(new Error(m.message)); };
            setTimeout(() => rej(new Error('create timeout')), 5000);
          });
          GNSession.set({ roomId: msg.roomId, playerIndex: msg.playerIndex, game: msg.game, resumeToken: msg.resumeToken });
          ws.close();
        }, { game, base });
        await page.goto(base + '/game.html');
        await page.waitForTimeout(1200);
        const nBots = SOLO.includes(game) ? 0 : (BOTS[game] || 1);
        for (let i = 0; i < nBots; i++) {
          const bot = page.locator('#addBotBtn');
          if (await bot.isVisible().catch(() => false)) { await bot.click(); await page.waitForTimeout(250); }
        }
        const ready = page.locator('#readyBtn');
        if (await ready.isVisible().catch(() => false)) {
          const txt = await ready.textContent();
          if (!/取消/.test(txt || '')) await ready.click();
          await page.waitForTimeout(300);
        }
        const start = page.locator('#startGameBtn');
        if (await start.isVisible().catch(() => false)) await start.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(game === 'werewolf' || game === 'sanguo' ? 3500 : 2500);
        await page.screenshot({ path: path.join(out, `${game}-${tag}.png`), fullPage: true });
        console.log(game, tag, errs.length ? 'ERR ' + errs[0] : 'ok');
      } catch (e) {
        console.log(game, tag, 'FAIL', e.message);
      }
      await page.close();
    }
  }
  await b.close();
})();
