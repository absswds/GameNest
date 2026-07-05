# 局域网联机桌游平台 · LAN Local Multiplayer Board Game Platform

> 同一 WiFi 下打开浏览器即玩，无需安装客户端。Node.js + WebSocket 驱动的 23 款桌游合集。
>
> Open a browser on the same WiFi and play. A collection of 23 board/card/party games powered by Node.js + WebSocket.

---

## 截图预览 / Screenshot

_(在此插入游戏大厅截图 / Insert a screenshot of the game lobby here)_

---

## 快速开始 / Quick Start

```bash
npm install
node server.js
```

打开浏览器访问 `http://localhost:3000`。手机/平板在同一 WiFi 下扫码或输入电脑 IP:3000 即可加入。

Open `http://localhost:3000` in your browser. Phones and tablets on the same WiFi can scan the QR code or enter `IP:3000` to join.

---

## 功能特性 / Features

- **零安装** — 纯浏览器，无需下载 App（手机端也有 Android APK 可选）
- **AI 机器人** — 大部分游戏支持 AI 对手，单人也可开局
- **断线重连** — 房间掉线 5 分钟内可自动恢复
- **二维码分享** — 大厅和房间内一键扫码加入
- **Android APK** — 基于 nodejs-mobile，手机上运行 Node.js 服务器 + WebView 显示
- **23 款游戏** — 覆盖经典棋盘、卡牌、派对、实时对战等多种类型

---

## 游戏列表 / Game List

### 经典棋盘 / Classic Board
| 游戏 | 人数 | 说明 |
|------|------|------|
| 井字棋 Tic-Tac-Toe | 2 | 三子连线，一分钟对局 |
| 五子棋 Gomoku | 2 | 十五路攻防，五子成线 |
| 飞行棋 Flight Chess | 2-4 | 掷骰起飞，冲刺回家 |
| 中国象棋 Chinese Chess | 2 | 木纹棋盘，长线对弈 |
| 围棋 9路 Go 9x9 | 2 | 小棋盘围棋，短局围地 |

### 派对卡牌 / Party Cards
| 游戏 | 人数 | 说明 |
|------|------|------|
| UNO | 2-6 | 颜色接龙，一张定胜负 |
| 爆炸猫 Exploding Kittens | 2-6 | 抽牌避险，道具反转 |
| 数字炸弹 Number Bomb | 2-10 | 缩小范围，别踩中雷 |
| 抽鬼牌 Old Maid | 2-6 | 配对弃牌，躲开鬼牌 |
| 你画我猜 Draw & Guess | 2-8 | 传话接龙式猜词 |

### 推理卡牌 / Deduction Cards
| 游戏 | 人数 | 说明 |
|------|------|------|
| 达芬奇密码 Davinci Code | 2-6 | 推理猜牌，步步试探 |
| 骗子酒馆 Liar's Bar | 2-6 | 虚张声势，心理战 bluff |

### 扑克竞技 / Poker
| 游戏 | 人数 | 说明 |
|------|------|------|
| 斗地主 Dou Dizhu | 2-3 | 叫地主，抢节奏 |
| 大老二 Big Two | 2-4 | 顺牌压制，先出完获胜 |
| 德州扑克 Texas Hold'em | 2-8 | 下注读牌，筹码博弈 |

### 桌面策略 / Tabletop Strategy
| 游戏 | 人数 | 说明 |
|------|------|------|
| 魔力桥 Rummikub | 2-4 | 拆牌重组，数字组合 |
| 大富翁 Monopoly | 2-6 | 买地建房，经营竞争 |

### 脑力竞速 / Brain Racing
| 游戏 | 人数 | 说明 |
|------|------|------|
| 24点 24 Game | 2-6 | 四数速算，抢答定输赢 |
| 扫雷竞速 Minesweeper Race | 2-6 | 同图雷区，失误出局 |
| 羊了个羊 Sheep Tile | 2-6 | 三消堆叠，清盘获胜 |

### 实时对战 / Real-time Battle
| 游戏 | 人数 | 说明 |
|------|------|------|
| 贪吃蛇大乱斗 Snake Battle | 2-6 | 同图生存，撞线淘汰 |
| 合成大西瓜 Suika Battle | 2-4 | 物理掉落，越合越大 |

### 派对聚会 / Party Gathering
| 游戏 | 人数 | 说明 |
|------|------|------|
| 真心话大冒险 Truth or Dare | 2-10 | 抽卡问答，派对破冰 |

---

## 技术栈 / Tech Stack

| 层 | 技术 |
|---|------|
| 后端 | Node.js + Express 4 + ws (WebSocket) |
| 前端 | 原生 HTML / CSS / JavaScript（无框架） |
| 通信 | WebSocket（HTTP 和 WS 共用 3000 端口） |
| Android | nodejs-mobile（手机端运行 Node.js）+ WebView |
| 二维码 | qrcode npm 包 |
| AI 机器人 | 每款游戏独立 bot 模块（games/ + bots/） |

---

## Android APK 构建 / Android Build

详见 [android/SETUP.md](android/SETUP.md)。

1. 安装 Android Studio + NDK 24.0.8215888
2. 下载 nodejs-mobile 预编译 `libnode.so` 放入 `android/app/libs/jniLibs/`
3. `cd android && .\copy-nodejs-project.ps1`（每次改代码后运行）
4. Android Studio 打开 `android/` 目录 → Run

---

## 项目结构 / Project Structure

```
├── server.js              # 全部服务端逻辑
├── main.js                # nodejs-mobile 入口（仅 Android）
├── games/*.js             # 23 款游戏逻辑模块
├── bots/*.js              # AI 机器人模块
├── scripts/               # 模拟脚本与工具
├── tests/                 # 测试（直接 node 运行）
├── public/
│   ├── index.html         # 大厅页面
│   ├── game.html          # 游戏壳页面
│   ├── style.css          # 全局样式
│   └── js/
│       ├── game-catalog.js
│       ├── room-client.js
│       └── renderers/*.js
└── android/               # Android 打包工程
```

---

## 协议 / License

[MIT](LICENSE) © 2026 Local Games
