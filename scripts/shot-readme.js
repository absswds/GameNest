// Regenerate the README screenshots in docs/media/:
//   lobby.png / lobby.en.png, room.png / room.en.png, game-pool.png / game-pool.en.png (1280x674; zh at 2x, en at 1x)
//   join-flow.gif (host | guest side by side, 960x352, the create -> join -> ready -> start flow)
// Usage: NODE_PATH=C:/Users/Sam/node_modules node scripts/shot-readme.js http://localhost:3000
// Needs playwright-core somewhere on NODE_PATH and Python with Pillow (for the GIF).
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');

const base = process.argv[2] || 'http://localhost:3000';
const MEDIA = path.join(__dirname, '..', 'docs', 'media');
const CHROME = process.env.CHROME || path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const VIEW = { width: 1280, height: 674 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, lang, viewport, scale) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, colorScheme: 'light' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('lang', l); localStorage.setItem('gn_name', l === 'en' ? 'Sam' : '小森'); } catch (e) {} }, lang);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));
  return page;
}

// Create a room over the lobby protocol and open game.html as its host.
async function openRoomAsHost(page, game, options) {
  await page.goto(base + '/');
  await page.evaluate(async ({ game, base, options }) => {
    const ws = new WebSocket(base.replace(/^http/, 'ws'));
    const msg = await new Promise((res, rej) => {
      ws.onopen = () => ws.send(JSON.stringify({ type: 'create_room', data: { game, lang: localStorage.getItem('lang') || 'zh' } }));
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === 'room_created') res(m); };
      setTimeout(() => rej(new Error('create timeout')), 5000);
    });
    for (const [key, value] of Object.entries(options || {})) ws.send(JSON.stringify({ type: 'set_option', data: { key, value } }));
    await new Promise((r) => setTimeout(r, 300));
    GNSession.set({ roomId: msg.roomId, playerIndex: msg.playerIndex, game: msg.game, resumeToken: msg.resumeToken });
    ws.close();
  }, { game, base, options });
  await page.goto(base + '/game.html');
  await page.waitForTimeout(1200);
}

async function addBots(page, n) {
  for (let i = 0; i < n; i++) {
    const bot = page.locator('#addBotBtn');
    if (await bot.isVisible().catch(() => false)) { await bot.click(); await page.waitForTimeout(250); }
  }
}

async function startGame(page) {
  const ready = page.locator('#readyBtn');
  if (await ready.isVisible().catch(() => false)) {
    if (!/取消|Cancel/.test((await ready.textContent()) || '')) await ready.click();
    await page.waitForTimeout(300);
  }
  await page.locator('#startGameBtn').click({ timeout: 5000 });
  await page.waitForTimeout(1500);
}

async function stills(browser) {
  for (const [lang, suffix, scale] of [['zh', '', 2], ['en', '.en', 1]]) {
    // Lobby
    let page = await newPage(browser, lang, VIEW, scale);
    await page.goto(base + '/');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(MEDIA, `lobby${suffix}.png`) });
    await page.context().close();

    // Waiting room: host + two bots, the one-line settings summary and the QR code
    page = await newPage(browser, lang, VIEW, scale);
    await openRoomAsHost(page, 'doudizhu');
    await addBots(page, 2);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(MEDIA, `room${suffix}.png`) });
    await page.context().close();

    // Pool in fullscreen: place the cue ball for the break and aim at the rack
    page = await newPage(browser, lang, VIEW, scale);
    await openRoomAsHost(page, 'pool');
    await addBots(page, 1);
    await startGame(page);
    await page.locator('.fs-launch-card').click();
    await page.waitForTimeout(1200);
    const confirm = page.locator('#poolFsConfirmPlaceBtn');
    if (await confirm.isVisible().catch(() => false)) { await confirm.click(); await page.waitForTimeout(800); }
    const c = await page.locator('#poolCanvas').boundingBox();
    await page.mouse.move(c.x + c.width * 0.75, c.y + c.height * 0.52);
    await page.mouse.down();
    await page.mouse.move(c.x + c.width * 0.76, c.y + c.height * 0.5, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(MEDIA, `game-pool${suffix}.png`) });
    await page.context().close();
    console.log('stills', lang, 'done');
  }
}

async function joinFlowGif(browser) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-gif-'));
  const panel = { width: 480, height: 352 };
  const host = await newPage(browser, 'zh', panel, 1);
  const guest = await newPage(browser, 'zh', panel, 1);
  await guest.context().addInitScript(() => { try { localStorage.setItem('gn_name', '阿杰'); } catch (e) {} });
  const frames = [];
  const snap = async (ms) => {
    const i = frames.length;
    await host.screenshot({ path: path.join(tmp, `h${i}.png`) });
    await guest.screenshot({ path: path.join(tmp, `g${i}.png`) });
    frames.push(ms);
  };

  await host.goto(base + '/');
  await guest.goto(base + '/');
  await wait(2000);
  await snap(1200);

  // Host taps UNO twice: select, then create the room
  const card = host.locator('.lb-card[data-game="uno"]').first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await wait(300);
  await card.click();
  await host.waitForURL(/game\.html/, { timeout: 8000 });
  await wait(1500);
  await snap(1500);
  const code = (await host.locator('#roomBadge').textContent()).trim();

  // Guest types the room code
  await guest.locator('#roomCodeInput').fill(code);
  await wait(200);
  await snap(1200);
  await guest.locator('#joinBtn').click();
  await guest.waitForURL(/game\.html/, { timeout: 8000 });
  await wait(1500);
  await snap(1500);

  await addBots(host, 1);
  await wait(500);
  await snap(1200);

  await guest.locator('#readyBtn').click();
  await wait(600);
  await snap(1200);

  await startGame(host); // the host readies up too, then starts
  await wait(500);
  await snap(2500);

  const py = path.join(tmp, 'make.py');
  fs.writeFileSync(py, [
    'import sys',
    'from PIL import Image',
    'tmp, out, durs = sys.argv[1], sys.argv[2], [int(x) for x in sys.argv[3].split(",")]',
    'frames = []',
    'for i in range(len(durs)):',
    '    h = Image.open(f"{tmp}/h{i}.png").convert("RGB"); g = Image.open(f"{tmp}/g{i}.png").convert("RGB")',
    '    f = Image.new("RGB", (960, 352), (240, 238, 232)); f.paste(h, (0, 0)); f.paste(g, (480, 0))',
    '    frames.append(f.quantize(colors=128, method=Image.Quantize.MEDIANCUT))',
    'frames[0].save(out, save_all=True, append_images=frames[1:], duration=durs, loop=0, optimize=True)',
  ].join('\n'));
  execFileSync('python', [py, tmp, path.join(MEDIA, 'join-flow.gif'), frames.join(',')], { stdio: 'inherit' });
  await host.context().close();
  await guest.context().close();
  console.log('gif done,', frames.length, 'frames');
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    // GIF first, on a fresh server: the stills create rooms that would show up in the lobby's LAN room list.
    await joinFlowGif(browser);
    await stills(browser);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
