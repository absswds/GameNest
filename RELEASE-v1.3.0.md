## GameNest v1.3.0 — Classic Board Pack / 经典棋盘包

### What's New / 新增内容

4 new classic board games — 4 款经典棋盘游戏：

| Game | Description | AI |
|------|-------------|-----|
| **Chess 国际象棋** | Full FIDE rules: castling, en passant, pawn promotion, 50-move rule, threefold repetition, insufficient material draw. / 完整 FIDE 规则：王车易位、吃过路兵、兵升变、50 步和棋、三次重复、子力不足和棋。 | minimax depth 3 + piece-square tables |
| **Checkers 西洋跳棋** | English draughts: forced captures, multi-jump, king promotion. / 英式跳棋：强制吃子、连吃、升王。 | minimax depth 5 |
| **Connect Four 四子棋** | Gravity drop on 7×6 grid, connect 4 in any direction. / 7×6 重力下落，横竖斜 4 子连珠。 | minimax depth 6 |
| **Reversi/Othello 黑白棋** | Place to flank and flip opponent pieces, corner heuristic strategy. / 落子夹击翻转对方棋子，角落权重策略。 | minimax depth 5 + corner heuristic |

Total games: 23 → 27. / 游戏总数：23 → 27。

### Other Changes / 其他改动

- README: Live Demo link, feature badges, Star History chart. / README：在线试玩链接、特性徽章、Star History 图表。
- GitHub: 20 topics, Discussions enabled, 4 good-first-issues. / GitHub：20 个 topics、开启 Discussions、4 个 good-first-issue。
- 4 new cover art images generated. / 生成 4 张新封面图。

### Acknowledgements / 致谢

Chess rules powered by [chess.js](https://github.com/jhlywa/chess.js) v0.12.1 (Jeff Hlywa, BSD-2-Clause). / 国际象棋规则基于 [chess.js](https://github.com/jhlywa/chess.js) v0.12.1（Jeff Hlywa，BSD-2-Clause 许可证）。
