# v1.3.0 — Classic Board Pack / 经典棋盘包

## 🇨🇳 中文

### 新增游戏

- **国际象棋** — 完整 FIDE 规则：王车易位、吃过路兵、兵升变（Q/R/B/N 选择）、50 步和棋、三次重复、子力不足和棋。minimax AI（depth 3 + 6 棋子位置表）
- **西洋跳棋** — 英式跳棋：强制吃子、多跳连吃、普通子升王。minimax AI（depth 5 + 子力/推进/中心评估）
- **四子棋** — 7×6 重力下落棋盘，横竖斜 4 子连珠获胜。minimax AI（depth 6 + 窗口扫描评估）
- **黑白棋** — 落子夹击翻转对方棋子，角落权重策略。minimax AI（depth 5 + 角落/PST/机动性评估）
- **战舰** — 10×10 海战棋盘，放置 5 艘战舰轮流射击。per-player 隐藏视图 + AI 支持
- **红心大战** — 4 人吃墩卡牌，传牌/垫牌/射击月亮。全规则 AI

### 规则库

- 国际象棋规则基于 [chess.js](https://github.com/jhlywa/chess.js) v0.12.1（Jeff Hlywa，BSD-2-Clause 许可证），vendored 到 `games/vendor/chessjs.js`

### 修复

- **黑白棋**：10×10 / 12×12 棋盘尺寸选择终于生效；F12 或窗口缩放后棋盘不再消失；点击坐标缩放修正，落子更精准
- **玩家栏**：6 人游戏（羊了个羊等）手机上不再截断
- **AI 难度选择器**：仅在真正适配难度的游戏（10 款）中显示
- **路径清理**：删除硬编码的本地绝对路径

### 涨星配套

- README：23→29 款游戏、在线试玩链接、特性徽章、star 引导语、Star History 图表
- GitHub：20 个 topics、开启 Discussions、4 个 good-first-issue

### 验证

- 49/49 测试全绿
- 语法检查通过

---

## 🇺🇸 English

### New Games

- **Chess** — Full FIDE rules: castling, en passant, pawn promotion (Q/R/B/N selection), 50-move rule, threefold repetition, insufficient material draw. minimax AI (depth 3 + piece-square tables)
- **Checkers** — English draughts: forced captures, multi-jump, king promotion. minimax AI (depth 5 + material/advance/center evaluation)
- **Connect Four** — 7×6 gravity drop, connect 4 in any direction. minimax AI (depth 6 + window-scan evaluation)
- **Reversi/Othello** — Place to flank and flip opponent pieces. minimax AI (depth 5 + corner/PST/mobility evaluation)
- **Battleship** — 10×10 naval battle grid, place 5 ships and fire alternately. Per-player hidden view + AI support
- **Hearts** — 4-player trick-taking card game with passing, leading, and shooting the moon. Full rule AI

### Rule Library

- Chess rules powered by [chess.js](https://github.com/jhlywa/chess.js) v0.12.1 (Jeff Hlywa, BSD-2-Clause), vendored at `games/vendor/chessjs.js`

### Fixes

- **Reversi**: board size selection (10×10 / 12×12) now works correctly; board no longer disappears after F12 or window resize; click coordinate scaling fixed for accurate piece placement
- **Player bar**: no longer overflows/cuts off on mobile with 6 players
- **AI difficulty**: selector now only shows for games whose bots actually read the setting (10 games)
- **Path cleanup**: removed hardcoded local absolute paths from scripts

### GitHub Stars

- README: 23→29 games, Live Demo link, feature badges, star prompt, Star History chart
- GitHub: 20 topics, Discussions enabled, 4 good-first-issues

### Verification

- 49/49 tests green
- Syntax check passed

---

## Assets

| Asset | Link |
|-------|------|
| Windows EXE | `GameNest-Windows.exe` |
| Portable ZIP | `GameNest-Portable.zip` |
| Android APK | `app-debug.apk` |
| Web | `http://localhost:3000` |
