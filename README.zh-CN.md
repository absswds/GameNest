# GameNest

> 23 款自托管局域网桌游、卡牌、聚会、益智和实时对战游戏。一台设备开服，分享房间号或二维码，同一 WiFi 下用浏览器就能一起玩。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/absswds/GameNest/actions/workflows/ci.yml/badge.svg)](https://github.com/absswds/GameNest/actions/workflows/ci.yml)
[![Android APK](https://github.com/absswds/GameNest/actions/workflows/android-apk.yml/badge.svg)](https://github.com/absswds/GameNest/actions/workflows/android-apk.yml)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-43853d.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)

简体中文 | [English](README.md)

GameNest 是一个轻量开源的局域网桌游房间，适合家庭娱乐、宿舍开黑、课堂活动、办公室摸鱼和朋友聚会。一台电脑或 Android 手机作为主机，其他设备在同一 WiFi 下直接通过浏览器加入。技术栈刻意保持简单：Express 4、`ws` 和原生 HTML/CSS/JavaScript。

## 亮点

- 内置 23 款游戏，覆盖经典棋盘、聚会卡牌、扑克、推理、脑力竞速和实时对战。
- 局域网优先：不需要账号，不依赖云服务，一台主机加一个 WiFi 就能开局。
- 支持房间号和二维码加入，手机、平板、电脑都能直接进房。
- 等待房间支持昵称、表情头像、准备状态、换座、加 AI 和游戏选项。
- 大多数回合制游戏支持 AI，对局人数不够或单人测试时也能跑起来。
- 每款游戏都有独立前端渲染器，支持隐藏信息视图、合法走法提示、Canvas 棋盘和轻量动画。
- 提供 Android 主机包装层，基于 nodejs-mobile，同一套项目也能变成随身局域网主机。

## 截图素材

下一次正式发布前，最需要补齐的是截图和短演示。建议准备这些文件：

| 文件 | 截什么 |
| --- | --- |
| `docs/media/lobby.png` | 桌面端大厅，包含首页横幅、精选游戏、搜索和游戏卡片。 |
| `docs/media/room.png` | 等待房间，能看到玩家、头像、准备状态、AI、房间号和二维码。 |
| `docs/media/game-flightchess.png` | 棋盘类游戏进行中，最好能看到顶部玩家头像。 |
| `docs/media/game-suika.png` | 实时或对战类游戏进行中。 |
| `docs/media/android-host.jpg` | 手机端主机页面，或同 WiFi 加入地址。 |
| `docs/media/join-flow.gif` | 15-30 秒演示：创建房间、扫码加入、准备、开始游戏。 |

素材放好后，把这一段替换成截图墙即可：

```md
![GameNest 大厅](docs/media/lobby.png)
![等待房间](docs/media/room.png)
![游戏进行中](docs/media/game-flightchess.png)
```

## 快速开始

```bash
npm install
npm start
```

主机打开大厅：

```text
http://localhost:3000
```

同一 WiFi 下的其他手机、平板或电脑访问：

```text
http://<主机IP>:3000
```

如果 Windows 上 `3000` 端口被旧的 Node 进程占用：

```powershell
taskkill /f /im node.exe
```

## 怎么玩

1. 在一台电脑或 Android 设备上启动 GameNest。
2. 打开大厅，选择想玩的游戏。
3. 创建房间，然后分享房间号、主机 IP 或二维码。
4. 在等待房间里换座、加 AI、改头像、准备，必要时调整游戏选项。
5. 房主开始游戏后，所有状态通过 WebSocket 在浏览器里同步。
6. 如果玩家临时退回大厅，可以通过大厅里的返回房间卡片继续回到原房间。

## 游戏列表

| 分类 | 游戏 |
| --- | --- |
| 经典棋盘 | 井字棋、五子棋、飞行棋、中国象棋、围棋 9x9 |
| 聚会卡牌 | UNO、爆炸猫、数字炸弹、抽鬼牌、你画我猜、真心话大冒险 |
| 推理 | 达芬奇密码、骗子酒馆 |
| 扑克 | 斗地主、大老二、德州扑克 |
| 桌面策略 | 魔力桥、大富翁 |
| 脑力竞速 | 24 点、扫雷竞速、羊了个羊 |
| 实时对战 | 贪吃蛇大乱斗、合成大西瓜对战 |

## 常用命令

```bash
npm start             # 启动局域网服务器
npm test              # 运行回归测试
npm run check         # 检查项目 JavaScript 语法
npm run test:monopoly # 运行大富翁专项测试
```

GitHub Actions 目前会自动跑 `npm run check` 和 `npm test`。

## 平台说明

### 浏览器主机

- 需要 Node.js `18+`
- HTTP 和 WebSocket 共用 `3000` 端口
- 适合电脑、教室、家庭局域网和临时聚会场景

### Android 主机

Android 工程会把同一套 Node.js 服务包装进 nodejs-mobile + WebView。

```powershell
cd android
.\copy-nodejs-project.ps1
```

然后用 Android Studio 打开 `android/` 并运行。完整说明见 [android/SETUP.md](android/SETUP.md)。

## 仓库结构

```text
.
|-- server.js                 # Express + WebSocket 服务端、房间管理、消息路由、AI 调度
|-- main.js                   # Android 的 nodejs-mobile 入口
|-- games/                    # 游戏规则与状态流转
|-- bots/                     # AI 走法生成
|-- lang/                     # 服务端文本
|-- public/                   # 大厅、游戏壳、渲染器、样式、资源
|-- scripts/                  # 检查和维护脚本
|-- tests/                    # node:test 回归测试
|-- android/                  # Android Studio 包装工程
`-- docs/                     # 架构与发布文档
```

补充资料：

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 说明服务端、WebSocket 和渲染器流程。
- [CONTRIBUTING.md](CONTRIBUTING.md) 提供新增游戏清单。
- [docs/STORE_LISTING.md](docs/STORE_LISTING.md) 收集商店文案和素材规划。

## 发布前还要做

- 按上面的清单补齐 README 截图和一个短 GIF。
- 下一次 APK 构建发布后，在 README 里补上 GitHub Release 直达下载说明。
- 写一小段 roadmap，说明接下来要补的游戏、移动端体验和测试覆盖。
- 给较新的游戏和重渲染器流程补更多回归测试。
- 打 tag 前，用两台同 WiFi 设备实际验证创建房间、扫码加入、返回房间和继续游戏。

## 参与贡献

欢迎提交 bug 修复、规则修正、AI 优化、渲染器打磨和新游戏。开始前建议先看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 协议

[MIT](LICENSE)
