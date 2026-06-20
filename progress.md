# Progress Log

## 2026-06-20 — Investigation in progress
- Reproduced by source tracing: Monopoly's purchase state triggers a duplicate move event because `lastMove` is compared by reference after a JSON state refresh.
- Reproduced by source tracing: Sheep Tile intentionally dims blocked tiles to 50% alpha plus a dark overlay, matching the reported low-visibility symptom.
- Two browser research attempts for the Steam reference returned Cloudflare 403; switched to a direct public Steam request, which successfully found the DrawGuess result.

## 2026-06-20 — New DrawGuess request
- Investigated the requested round-based Whisper flow and the lobby mode-label bug before implementation.
- Confirmed the label bug is reproducible from the message shapes: initial room messages omit `options`, while the client defaults missing `mode` to `stage`.
- No production code changed yet; awaiting the user's confirmation of the round/scoring design.

## 2026-06-20 — DrawGuess scored relay completed
- Added a failing simulation for Whisper round scoring and verified it failed with five expected missing behaviors.
- Implemented round-local chain construction, starter rotation, majority-vote score award, timed result transition, final winner selection, and result score rendering.
- A first green run found that `_wordPool` leaked words through Whisper player views. The existing secrecy test caught it; fixed by deleting `_wordPool` from every player view.
- Added a failing message-shape guard for initial room options, then added `options` to initial server packets and saved them in the initial client handler.
- Verification: `node scripts/sim-drawguess.js` and `node --check` for game, renderer, client, and server passed.

## 2026-06-20 — Next request triage
- Started evidence gathering for mobile timer, resumable rooms, Rummikub manipulation, and homepage categorization.
- No production changes made in this phase yet.
- Confirmed the Rummikub manipulation failure at the renderer event boundary: tile click propagation prevents full target groups from receiving a selected-tile drop.
- DrawGuess timer now receives `stepRemainingMs` from the server-side player view and starts from receipt time; its simulation passes.
- Added `scripts/sim-rummikub-ui.js` red/green guard and changed manipulation clicks so an existing target group accepts selected tiles.

## 2026-06-20 — DrawGuess Stage implementation
- Added switchable `stage` (default) and `whisper` modes. Stage is server-authoritative: private word selection, live validated strokes, simultaneous repeat guesses, score order, five-second round result, drawer rotation, and winner after every player has drawn.
- Added Stage mode picker to the existing room settings and live canvas / guess / result rendering while retaining the Whisper renderer flow.
- Fixed Monopoly's duplicate move animation by snapshotting a stable move signature; covered Sheep tiles now keep 90% icon opacity with a lighter overlay.
- Verification: `node --check` on changed JS files plus all three game simulations passed.

## 2026-06-04 — 飞行棋重做 + 魔力桥重组 + 人机健壮性

### 飞行棋（重大重做）
- **尺寸**：渲染器改用 `window.innerWidth/innerHeight` 计算（原来读 `boardArea.clientWidth` 读到 0/极小值），并删掉 `style.css` 桌面媒体查询里钉死的 `max-width:640px`（之前 JS 改了被 CSS 覆盖，等于没改）。象棋、围棋同步改。
- **跳棋/飞行机制（原来是坏的）**：`games/flightchess.js` 的 `isOwnColor` 只在起飞格触发，等于失效。重写为：同色格（step%4===0）跳 +4；飞行格（FLY_STEP=8）沿虚线飞 +24 到对面同色格，再按规则跳 +4。FLY_ADV 原 26 不是 4 的倍数（落点非同色），已修。
- **棋盘视觉**：深蓝底 + 交错四色实心格（abs%4）+ 起飞格✈ + 4 条 90° 旋转对称的虚线飞行航线（风车状，带箭头）+ 回家入口转进箭头。
- **骰子**：移到棋盘下方大方块显示数字，且没掷到 6/自动跳过时也显示"上一手 X 点"——之前看不到投了多少。
- 已用 2 万步模拟验证逻辑无死循环、无崩溃。

### 魔力桥 Rummikub
- **重组牌桌（核心诉求：能拿走桌面别人的牌）**：渲染器 `renderManipulate` 重做为分格牌桌——桌面每个牌组一个方框 + 手牌框，点牌选中→点目标框移动，可拆分/合并/新建组，实时绿框=合法/红框=非法。
- **修复丢牌 bug**：`games/rummikub.js` submit 增加校验——桌面原有的牌必须全部重新成组，否则拒绝（原来未成组的桌面牌会凭空消失）。
- **按钮**：「🔀重组牌桌」原来只在出过牌后才显示，改为回合一开始就能用。
- 教程更新：新增「重组牌桌」说明，删除未实现的"替换百搭牌"描述。

### 人机健壮性（影响全部游戏）
- **server.js**：bot 走出非法步时原来只 `console.error` 后 return，**不推进回合→整局卡死**。改为回退到摸牌/空步，保证回合一定推进。
- **bots/rummikub.js**：删除会丢桌面牌的 `tryManipulate`（现已被服务端校验拒绝），bot 只走安全步（出手牌组/接单张/摸牌）。40 局 bot 对战 0 卡死。
- **bots/gomoku.js**：修复棋盘接近满时 fallback 只搜中心区找不到空格→读 undefined 崩溃。改为中心优先、否则全盘找空格、满盘返回 pass。30 局 0 崩溃。

### 待办（用户要求继续做的，未开始）
- 第 4 阶段新游戏：你画我猜、羊了个羊、合成大西瓜（需浏览器实测渲染器，建议下次单独开工）
- 其余 bot 可继续调强（gomoku 双 AI 偏防守易长局；davinci/oldmaid 胜率偏低）

---

## 2026-06-02 — 第 2 阶段完成

### 新增 3 款游戏
1. **骗子酒馆** — 面朝下出牌 + 声明花色 + 质疑机制 + 命数系统
2. **大老二（锄大地）** — 13 张出完为胜 + 花色比大小 + ♦3先手
3. **德州扑克** — 盲注 + 四轮下注 + 公共牌 + per-player 手牌隐私 + 摊牌比大小

### 新增文件
- `games/liarsbar.js` — 骗子酒馆服务端（质疑结算 + 命数淘汰）
- `games/bigtwo.js` — 大老二服务端（牌型检测：单张/对子/三条/顺子/同花/葫芦/铁支/同花顺）
- `games/texas.js` — 德州扑克服务端（7选5 最佳牌型评估 + per-player playerView）
- `bots/liarsbar.js` — 概率推理 AI（根据可见牌推断质疑策略）
- `bots/bigtwo.js` — 复杂牌型 AI（打最小单张/找压过的牌）
- `bots/texas.js` — 手牌强度评估 AI（底池赔率 + bluff 概率）
- `public/js/renderers/liarsbar.js` — 命数显示 + 选牌 + 质疑按钮
- `public/js/renderers/bigtwo.js` — 对手信息 + 牌型检测 + 选牌提示
- `public/js/renderers/texas.js` — 公共牌区 + 筹码显示 + 下注操作 + 摊牌展示

### 修改文件
- `server.js` — 新增 texas per-player playerView 分支（game_started/game_move/game_restart）
- `public/index.html` — 注册 3 款游戏到大厅
- `public/game.html` — 加载 3 个新渲染器脚本
- `public/js/room-client.js` — gameNames 映射（新增 3 款）
- `public/js/tutorials.js` — 3 款游戏教程说明

### 服务端特殊处理
- 德州扑克使用 `playerView()` 导出函数，服务端在 game_started/game_move/game_restart 三处调用，确保每人的底牌仅自己可见
- 其他两款为标准 handleMove 模式，无需特殊分支

### 已修复的问题
1. **数字炸弹 — 输入方式**：加上了数字键盘（0-9 按钮），手机也能方便输入
2. **数字炸弹 — 消息日志**：新增消息区域，每次猜测都清晰显示"P1 猜了 50 ↓ 小了 → 范围 1~49"，踩雷时高亮红色标记
3. **数字炸弹 — 踩雷特效**：全屏 💥 爆炸动画 + 该玩家命数行闪红
4. **数字炸弹 — 唯一数字提示**：当范围缩到只剩一个数时，状态栏变红提示"只剩 X 一个数字！必须猜它…"
5. **抽鬼牌 — 选牌交互**：重做为两步——先点击对手头像选中，对手的牌面朝下展示，再点击具体牌抽取。可"换个人"取消选择
6. **抽鬼牌 — 选牌状态持久化**：选中状态存在 DOM data 属性中，re-render 后不丢失
7. **扫雷 — 独立棋盘**：重写服务端，每人独立的 reveal/flag 状态，相同的雷布局。服务器按玩家分别返回各自的棋盘视图
8. **扫雷 — 服务端改造**：在 server.js 的 game_move 处理中添加 minesweeper 特殊分支，调用 `playerBoardView()` 给每人发独立棋盘
9. **教程文档更新**：全部 3 款游戏的教程说明重写，明确了平局规则和交互方式

### 修改的文件
- `games/minesweeper.js` — 重写：独立 per-player 棋盘状态
- `games/numberbomb.js` — 新增 lastGuess、messages 日志
- `games/oldmaid.js` — 新增 _ping no-op、cardIndex 选牌
- `public/js/renderers/minesweeper.js` — 重写：长按标旗 + 自适应响应式
- `public/js/renderers/numberbomb.js` — 重写：数字键盘 + 消息日志 + 爆炸动画 + "只剩一个"提示
- `public/js/renderers/oldmaid.js` — 重写：两步选牌交互 + DOM state 持久化
- `public/js/tutorials.js` — 全部 3 款游戏教程重写
- `server.js` — 新增 minesweeper per-player board view 分支
- `bots/oldmaid.js` — 更新为 drawFrom + cardIndex 格式

---

## 2026-06-02 — 第 3 阶段：棋盘策略类（进行中）

### 新增 3 款游戏
1. **飞行棋** — 2-4人 · 掷骰起飞 · 踩人回基地 · 跳板加速 · 4机到终为胜
2. **中国象棋** — 2人 · 9×10棋盘 · 7种棋子 · 将死判胜
3. **围棋(9×9)** — 2人 · 9×9棋盘 · 提子打劫 · 数子判胜

### 新增文件
- `games/flightchess.js` — 飞行棋服务端（十字形棋盘+基地起飞+踩人回基地+跳板+3次6回合作废）
- `games/chinesechess.js` — 中国象棋服务端（7种棋子走法+将军检测+对面规则+困毙判负）
- `games/go9.js` — 围棋9×9服务端（BFS连通块+气数+提子+打劫+双pass终局+中国数子法黑贴3.75子）
- `bots/flightchess.js` — 贪心AI（起飞>踩人>前进）
- `bots/chinesechess.js` — Minimax+Alpha-Beta AI（深度2层+棋子估值+着法排序）
- `bots/go9.js` — 启发式评分AI（角星位+连络+避孤立+避自杀）
- `public/js/renderers/flightchess.js` — Canvas十字形棋盘+4色基地+骰子按钮+飞机点击移动+玩家图例
- `public/js/renderers/chinesechess.js` — Canvas木质棋盘+楚河汉界+楷体棋子+选中高亮
- `public/js/renderers/go9.js` — Canvas围棋+渐变石子+最后一手标记+劫禁红点+过手按钮+贴目显示

### 修改文件
- `server.js` — 无需特殊分支（三款均为普通回合制）
- `public/index.html` — 大厅注册3款游戏
- `public/game.html` — 加载3个渲染器脚本
- `public/js/room-client.js` — gameNames映射 + maxSlots逻辑（中国象棋/围棋=2人）
- `public/js/tutorials.js` — 3款游戏规则教程
- `public/style.css` — 新增棋盘Canvas样式

### 已修复的问题
1. **围棋贴目** — 改"6.5目"为"黑贴3.75子"（中国数子法标准）
2. **围棋不能继续下** — 修复棋盘值混淆（EMPTY=0, BLACK=1, WHITE=2，与playerIndex区分）
3. **飞行棋棋盘** — 重做为十字形Ludo风格，4色区域+中心交叉
4. **全部棋盘放大** — 去掉max-width限制，最大化利用手机屏幕宽度
