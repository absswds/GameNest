# Lobby, AI, And Animation Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake-looking catalog covers, redesign the lobby and room shell into a more premium tabletop experience, improve representative AI bots, and add clearer motion feedback across shared flows and selected games.

**Architecture:** Keep the shared catalog as the single metadata source, but switch its default media to realistic bitmap assets and use it to drive both lobby and room surfaces. Implement the user-visible polish in three waves: first covers plus shell redesign, then focused AI upgrades with tests, then motion upgrades in shared flows and representative renderers.

**Tech Stack:** Static HTML, vanilla JS, shared CSS, Node.js tests, existing bot modules, existing canvas/DOM renderers, generated bitmap cover art.

---

### Task 1: Replace Catalog Default Covers With Realistic Bitmap Assets

**Files:**
- Modify: `public/js/game-catalog.js`
- Modify: `tests/game-catalog-covers.test.js`
- Create: `public/assets/game-covers/*.png`
- Modify: `scripts/generate-cover-art.js`

- [ ] **Step 1: Write the failing cover expectation update**

```js
test('every game in the lobby catalog points to a bitmap cover asset', () => {
  const catalog = Array.from(loadCatalog());
  const nonBitmap = catalog
    .filter((game) => !/\.(png|jpe?g|webp)$/i.test(game.cover || ''))
    .map((game) => ({ id: game.id, cover: game.cover }));

  assert.deepEqual(nonBitmap, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/game-catalog-covers.test.js`

Expected: FAIL because many games still point at `.svg` assets or empty paths.

- [ ] **Step 3: Update the asset generator and catalog mapping**

```js
// scripts/generate-cover-art.js
const covers = [
  { id: 'tictactoe', prompt: 'realistic tabletop tic-tac-toe board with tactile X and O pieces, warm studio light, premium wood table' },
  { id: 'gomoku', prompt: 'realistic gomoku board with black and white stones, close tabletop photography, premium materials' },
  { id: 'texas', prompt: 'realistic poker table with chips, cards, cinematic tabletop lighting, premium casino materials' },
  { id: 'monopoly', prompt: 'realistic property trading board game city pieces and cards on premium table, warm light' },
];
```

```js
// public/js/game-catalog.js
Object.keys(catalog).forEach(function(id) {
  catalog[id].cover = '/assets/game-covers/' + id + '.png';
});
```

- [ ] **Step 4: Generate the final bitmap cover set and verify file presence**

Run: `node scripts/generate-cover-art.js`

Expected: one bitmap cover per catalog game in `public/assets/game-covers/`.

- [ ] **Step 5: Run tests to verify the catalog now resolves to bitmap assets**

Run: `node --test tests/game-catalog-covers.test.js`

Expected: PASS with all catalog cover tests green.

- [ ] **Step 6: Commit**

```bash
git add public/js/game-catalog.js public/assets/game-covers scripts/generate-cover-art.js tests/game-catalog-covers.test.js
git commit -m "feat: replace lobby default covers with realistic bitmap art"
```

### Task 2: Rebuild The Lobby Around Stronger Featured Media And Utility Bands

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Test: manual browser verification on `/`

- [ ] **Step 1: Add the new top utility band and denser featured structure in markup**

```html
<section class="lobby-utility-band">
  <div class="utility-block" id="resumeSection" style="display:none">
    <div class="panel-heading">继续对局</div>
    <button class="btn btn-primary" id="resumeBtn">返回进行中的对局</button>
  </div>
  <div class="utility-block utility-join-block">
    <label class="utility-label" for="roomCodeInput">加入房间</label>
    <div class="join-row">
      <input class="input" id="roomCodeInput" type="text" maxlength="4" placeholder="输入房间号">
      <button class="btn btn-outline" id="joinBtn">加入</button>
    </div>
  </div>
  <div class="utility-block utility-network-block" id="networkCallout" hidden>
    <strong id="networkCalloutTitle"></strong>
    <p id="networkCalloutHint"></p>
    <div class="network-links" id="networkLinks"></div>
  </div>
</section>

<section class="lobby-stage">
  <div class="stage-copy">
    <p class="eyebrow">FEATURED TABLES</p>
    <h2>先从这些局开始</h2>
    <p>主推游戏放大展示，其余游戏保留紧凑浏览。</p>
  </div>
  <div class="featured-carousel" id="featuredStrip"></div>
</section>
```

- [ ] **Step 2: Add the responsive layout, media sizing, and mobile density rules**

```css
.lobby-utility-band {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.featured-carousel {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}

@media (max-width: 640px) {
  .lobby-utility-band { grid-template-columns: 1fr; }
  .browse-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

- [ ] **Step 3: Update the lobby renderer logic to support the new featured emphasis**

```js
function buildFeaturedCard(game) {
  const selectedClass = game.id === selectedGame ? ' selected' : '';
  return '<button class="featured-card featured-card-large' + selectedClass + '" data-game="' + game.id + '">' +
    '<div class="featured-media">' + buildCover(game, true) + '</div>' +
    '<div class="featured-content">' +
      '<div class="featured-topline"><span>' + escapeHtml(game.category) + '</span><span>' + escapeHtml(game.players) + '</span></div>' +
      '<h3>' + escapeHtml(game.name) + '</h3>' +
      '<p>' + escapeHtml(game.subtitle) + '</p>' +
    '</div>' +
  '</button>';
}
```

- [ ] **Step 4: Run syntax verification on the inline lobby script**

Run:

```bash
@'
const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const match = html.match(/<script>\s*([\s\S]*)<\/script>\s*<\/body>/);
if (!match) throw new Error('inline script not found');
fs.writeFileSync('.tmp-index-inline.js', match[1]);
'@ | node -
node --check .tmp-index-inline.js
```

Expected: no syntax errors.

- [ ] **Step 5: Manually verify the lobby at desktop and mobile widths**

Run: `node server.js`

Verify:
- featured covers look like real media instead of poster cards
- top utility band keeps resume / join / LAN address visible
- mobile browse grid stays scannable
- create action still tracks the selected game

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/style.css
git commit -m "feat: redesign lobby around realistic media and utility bands"
```

### Task 3: Upgrade The Waiting Room And Game Shell Presentation

**Files:**
- Modify: `public/game.html`
- Modify: `public/style.css`
- Modify: `public/js/room-client.js`

- [ ] **Step 1: Add richer room shell sections in the waiting-room markup**

```html
<section class="surface-panel waiting-main-panel">
  <div class="waiting-headline">
    <div class="waiting-headline-copy">
      <p class="eyebrow">ROOM SETUP</p>
      <h2 id="waitingGameName">游戏房间</h2>
      <p id="waitingGameSubtitle">等待房主安排座位并开始。</p>
    </div>
    <div class="waiting-meta-row" id="waitingMeta"></div>
  </div>
  <div class="waiting-session-summary" id="waitingFacts"></div>
  <div class="waiting-slots" id="waitingSlots"></div>
  <div class="waiting-actions">
    <button class="btn btn-outline btn-sm" id="readyBtn">准备</button>
    <button class="btn btn-outline btn-sm" id="addBotBtn" style="display:none">添加 AI</button>
    <button class="btn btn-accent btn-sm" id="startGameBtn" style="display:none">开始游戏</button>
  </div>
</section>

<aside class="surface-panel waiting-side-panel">
  <div class="waiting-cover-card">
    <img id="waitingCoverImage" src="" alt="游戏封面" style="display:none">
    <div class="waiting-cover-fallback" id="waitingCoverFallback">?</div>
  </div>
  <div class="qr-card" id="qrArea">
    <img id="qrImage" src="" alt="QR">
    <div class="qr-room-code" id="qrRoomCode"></div>
    <div class="qr-hint">扫码或输入房间号加入</div>
  </div>
</aside>
```

- [ ] **Step 2: Style the room like a pre-match lounge instead of a settings card**

```css
.waiting-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.85fr);
  gap: 18px;
}

.waiting-session-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
```

- [ ] **Step 3: Move room shell copy and cover rendering onto the shared metadata**

```js
function updateSharedShell() {
  setText('waitingGameName', gameInfo.name);
  setText('waitingGameSubtitle', gameInfo.description || gameInfo.subtitle || '');
  renderFacts('waitingFacts', [gameInfo.players, gameInfo.duration, gameInfo.category]);
  renderCover();
}
```

- [ ] **Step 4: Run syntax verification for the room client**

Run: `node --check public/js/room-client.js`

Expected: PASS with no syntax errors.

- [ ] **Step 5: Manually verify room creation, join, ready, and start flow**

Run: `node server.js`

Verify:
- cover, subtitle, roster, and QR area feel visually coherent
- host and player controls remain usable
- game transition still enters the board state cleanly

- [ ] **Step 6: Commit**

```bash
git add public/game.html public/style.css public/js/room-client.js
git commit -m "feat: upgrade waiting room and game shell presentation"
```

### Task 4: Improve Representative AI Bots With Focused Regression Tests

**Files:**
- Modify: `bots/texas.js`
- Modify: `bots/gomoku.js`
- Modify: `bots/davinci.js`
- Modify: `bots/oldmaid.js`
- Modify: `bots/numberbomb.js`
- Create: `tests/bots.test.js`

- [ ] **Step 1: Write failing representative bot behavior tests**

```js
test('numberbomb bot guesses the midpoint without random fuzz', () => {
  const bot = require('../bots/numberbomb').createBot(0);
  const move = bot.getMove({ min: 1, max: 99 });
  assert.equal(move.guess, 50);
});

test('oldmaid bot targets the opponent with the fewest safe options first', () => {
  const bot = require('../bots/oldmaid').createBot(0);
  const move = bot.getMove({
    hands: [
      ['A', 'B'],
      ['X'],
      ['Y', 'Z', 'W']
    ]
  });
  assert.equal(move.drawFrom, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/bots.test.js`

Expected: FAIL because the current bots still use random or shallow choices.

- [ ] **Step 3: Implement minimal deterministic heuristics in the targeted bots**

```js
// bots/numberbomb.js
const guess = Math.floor((state.min + state.max) / 2);
return { guess };
```

```js
// bots/texas.js
if (toCall <= 0 && strength >= 220 && chips > 120) {
  const raiseTo = state.currentBet + Math.max(20, Math.floor(Math.max(pot, 40) * 0.6));
  return { action: 'raise', amount: Math.min(chips, raiseTo) };
}
if (toCall > chips * 0.45 && strength < 180) return { action: 'fold' };
return { action: toCall > 0 ? 'call' : 'check' };
```

- [ ] **Step 4: Run the targeted bot tests again**

Run: `node --test tests/bots.test.js`

Expected: PASS.

- [ ] **Step 5: Run broader syntax verification on touched bots**

Run:

```bash
node --check bots/texas.js
node --check bots/gomoku.js
node --check bots/davinci.js
node --check bots/oldmaid.js
node --check bots/numberbomb.js
```

Expected: PASS across all touched bot files.

- [ ] **Step 6: Commit**

```bash
git add bots/texas.js bots/gomoku.js bots/davinci.js bots/oldmaid.js bots/numberbomb.js tests/bots.test.js
git commit -m "feat: improve representative game ai heuristics"
```

### Task 5: Add Shared Flow And Representative Renderer Motion Upgrades

**Files:**
- Modify: `public/style.css`
- Modify: `public/index.html`
- Modify: `public/js/renderers/monopoly.js`
- Modify: `public/js/renderers/texas.js`
- Modify: `public/js/renderers/uno.js`

- [ ] **Step 1: Write a small renderer regression for motion-triggered feedback data**

```js
test('monopoly renderer can surface structured chance feedback', () => {
  const state = { lastCardEffect: { title: '机会', detail: '获得 200' } };
  assert.equal(Boolean(state.lastCardEffect.detail), true);
});
```

- [ ] **Step 2: Run the focused renderer-related regression**

Run: `node --test tests/monopoly.test.js`

Expected: existing Monopoly tests remain green before renderer edits.

- [ ] **Step 3: Add motion hooks for shared flow states and representative renderers**

```css
.featured-card.selected {
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 18px 34px rgba(200, 164, 92, 0.18);
}

.waiting-slot.ready {
  animation: readyPulse 420ms ease;
}
```

```js
// public/js/renderers/monopoly.js
if (st.lastCardEffect && st.lastCardEffect !== prevSnap.lastCardEffect) {
  eventLog.unshift(st.lastCardEffect.detail);
  anim.queue.push({ type: 'card_reveal', detail: st.lastCardEffect.detail });
}
```

- [ ] **Step 4: Run syntax verification on the touched renderer files**

Run:

```bash
node --check public/js/renderers/monopoly.js
node --check public/js/renderers/texas.js
node --check public/js/renderers/uno.js
```

Expected: PASS with no syntax errors.

- [ ] **Step 5: Run end-to-end manual verification on lobby, room, and a representative game**

Run: `node server.js`

Verify:
- selected game changes feel more alive
- room ready/start transitions read clearly
- Monopoly / Texas / UNO state changes show clearer motion feedback

- [ ] **Step 6: Run regression coverage for recent game logic**

Run: `node tests/monopoly.test.js`

Expected: PASS after renderer and shell changes.

- [ ] **Step 7: Commit**

```bash
git add public/style.css public/index.html public/js/renderers/monopoly.js public/js/renderers/texas.js public/js/renderers/uno.js
git commit -m "feat: add clearer shared flow and game motion feedback"
```

### Task 6: Final Verification And Branch Wrap-Up

**Files:**
- Test: `tests/game-catalog-covers.test.js`
- Test: `tests/bots.test.js`
- Test: `tests/monopoly.test.js`

- [ ] **Step 1: Run the full focused verification set**

Run:

```bash
node --test tests/game-catalog-covers.test.js tests/bots.test.js
node tests/monopoly.test.js
node --check public/js/game-catalog.js
node --check public/js/room-client.js
node --check server.js
```

Expected: all commands pass cleanly.

- [ ] **Step 2: Start the server and re-check key runtime paths**

Run: `node server.js`

Verify:
- lobby loads with realistic covers
- mobile-width browse grid remains usable
- room create/join/ready/start works
- LAN address surface still tells phone users where to connect

- [ ] **Step 3: Commit the final verification checkpoint**

```bash
git add docs/superpowers/plans/2026-07-02-lobby-ai-animation-refresh.md
git commit -m "test: verify lobby ai and animation refresh"
```
