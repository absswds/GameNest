# v1.3.0 — Classic Board Pack / 经典棋盘包

## 🇨🇳 中文

### 新增游戏

- **国际象棋** — 完整 FIDE 规则：王车易位、吃过路兵、兵升变（Q/R/B/N 选择）、50 步和棋、三次重复、子力不足和棋。minimax AI（depth 3 + 6 棋子位置表）
- **西洋跳棋** — 英式跳棋：强制吃子、多跳连吃、普通子升王。minimax AI（depth 5 + 子力/推进/中心评估）
- **四子棋** — 7×6 重力下落棋盘，横竖斜 4 子连珠获胜。minimax AI（depth 6 + 窗口扫描评估）
- **黑白棋** — 落子夹击翻转对方棋子，角落权重策略。minimax AI（depth 5 + 角落/PST/机动性评估）

### 规则库

- 国际象棋规则基于 [chess.js](https://github.com/jhlywa/chess.js) v0.12.1（Jeff Hlywa，BSD-2-Clause 许可证），vendored 到 `games/vendor/chessjs.js`

### 涨星配套

- README：23→27 款游戏、在线试玩链接、特性徽章、star 引导语、Star History 图表
- GitHub：20 个 topics、开启 Discussions、4 个 good-first-issue

### 验证

- 73/73 测试全绿（含 4 款新游戏的 57 个测试用例）
- 132 个 JS 文件语法检查通过

---

## 🇺🇸 English

### New Games

- **Chess** — Full FIDE rules: castling, en passant, pawn promotion (Q/R/B/N selection), 50-move rule, threefold repetition, insufficient material draw. minimax AI (depth 3 + piece-square tables)
- **Checkers** — English draughts: forced captures, multi-jump, king promotion. minimax AI (depth 5 + material/advance/center evaluation)
- **Connect Four** — 7×6 gravity drop, connect 4 in any direction. minimax AI (depth 6 + window-scan evaluation)
- **Reversi/Othello** — Place to flank and flip opponent pieces. minimax AI (depth 5 + corner/PST/mobility evaluation)

### Rule Library

- Chess rules powered by [chess.js](https://github.com/jhlywa/chess.js) v0.12.1 (Jeff Hlywa, BSD-2-Clause), vendored at `games/vendor/chessjs.js`

### GitHub Stars

- README: 23→27 games, Live Demo link, feature badges, star prompt, Star History chart
- GitHub: 20 topics, Discussions enabled, 4 good-first-issues

### Verification

- 73/73 tests green (57 new tests for 4 games)
- 132 JS files pass syntax check

---

## Assets

| Asset | Link |
|-------|------|
| Windows EXE | `GameNest-Windows.exe` |
| Portable ZIP | `GameNest-Portable.zip` |
| Android APK | `app-debug.apk` |
| Web | `http://localhost:3000` |
