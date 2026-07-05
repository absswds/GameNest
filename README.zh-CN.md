# GameNest

> 23 款局域网桌游、卡牌和聚会游戏。一台主机启动服务，同一 WiFi 下扫码或打开浏览器就能一起玩。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/absswds/GameNest/actions/workflows/ci.yml/badge.svg)](https://github.com/absswds/GameNest/actions/workflows/ci.yml)
[![Android APK](https://github.com/absswds/GameNest/actions/workflows/android-apk.yml/badge.svg)](https://github.com/absswds/GameNest/actions/workflows/android-apk.yml)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-43853d.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)

简体中文 | [English](README.md)

GameNest 是一个开源、自托管、浏览器优先的局域网桌游平台。它适合朋友聚会、宿舍开黑、家庭娱乐和课堂活动。一台电脑或一台 Android 手机当主机，其他设备在同一 WiFi 下直接通过浏览器加入即可。整个技术栈刻意保持轻量，只用 Express 4、`ws` 和原生 HTML/CSS/JavaScript。

## 为什么是 GameNest

- 内置 23 款游戏，覆盖棋盘、卡牌、扑克、推理、聚会、脑力竞速和实时对战。
- 零注册、零账号、局域网优先。一台主机开服后，其他设备通过房间二维码或主机 IP 即可加入。
- 大多数回合制游戏支持 AI，对局人数不够时也能玩，也方便单人测试。
- 每款游戏都有独立前端渲染器，支持隐藏信息视图、合法走法提示、Canvas 棋盘和轻量动画。
- 提供基于 nodejs-mobile 的 Android 包装层，同一套项目既能当浏览器服务，也能当手机主机。

## 截图素材

下个 release 前建议补齐这些素材：

- `docs/media/lobby.png` - 大厅选游戏页，最好用桌面端
- `docs/media/room.png` - 等待房间，能看到玩家列表、准备状态、二维码
- `docs/media/game-uno.png` - 卡牌类对局截图
- `docs/media/game-chinesechess.png` - 棋盘类对局截图
- `docs/media/android-host.jpg` - Android 主机页或手机加入流程
- `docs/media/join-flow.gif` - 15 到 30 秒的开房到加入演示

这些文件准备好之后，就可以直接插进 README 首页。

## 快速开始

```bash
npm install
npm start
```

主机打开大厅：

```text
http://localhost:3000
```

同一 WiFi 下的其他手机、平板或电脑可以访问：

```text
http://<主机IP>:3000
```

如果 Windows 上 `3000` 端口被旧的 Node 进程占用：

```powershell
taskkill /f /im node.exe
```

## 怎么玩

1. 在一台电脑或 Android 设备上启动 GameNest。
2. 打开大厅，选择游戏并创建房间。
3. 让其他玩家通过二维码或主机 IP 加入。
4. 在等待房里完成换座、加 AI、准备和游戏选项配置。
5. 开始游戏，之后所有状态同步都通过 WebSocket 在浏览器里完成。

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
- 适合电脑、教室、家庭局域网场景

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

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 查看前后端流程
- [CONTRIBUTING.md](CONTRIBUTING.md) 查看新增游戏清单
- [docs/STORE_LISTING.md](docs/STORE_LISTING.md) 查看商店文案和素材规划

## 现在还值得继续补强的地方

- README 首页正式截图和一个短 GIF
- 下一个 release 发布后补上更直接的 APK 下载说明
- 单独整理一小段 roadmap，说明接下来还要做哪些游戏、移动端打磨和测试补强
- 给较新的游戏和重渲染器流程补更多回归测试

## 参与贡献

欢迎提交 bug 修复、规则修正、AI 优化、渲染器打磨和新游戏。开始前先看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 协议

[MIT](LICENSE)
