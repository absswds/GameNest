# 局域网联机桌游平台

> 同一 WiFi 下打开浏览器就能玩的本地多人桌游、卡牌和聚会游戏合集。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-43853d.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-ws-111111.svg)](https://github.com/websockets/ws)

简体中文 | [English](README.md)

这是一个面向家庭、朋友聚会、课堂活动和小型局域网场景的本地联机桌游平台。只需要一台电脑启动 Node.js 服务，其他手机或电脑在同一 WiFi 下通过二维码或主机 IP 加入房间即可。

项目刻意保持轻量：Express 4、`ws`、原生 HTML/CSS/JavaScript，以及可选的 nodejs-mobile Android 打包工程。

## 亮点

- 内置 23 款游戏，覆盖经典棋盘、卡牌、扑克、推理、聚会、脑力竞速和实时对战。
- 局域网优先：HTTP 与 WebSocket 共用 `3000` 端口，一台主机即可开局。
- 大多数回合制游戏支持 AI 对手，单人测试和少人局也能玩。
- 房间大厅支持准备状态、房主控制、换座、扫码加入、断线恢复和游戏选项。
- 每款游戏独立渲染器，支持 Canvas 棋盘、隐藏信息视图、合法走法提示和轻量动画。
- 可选 Android 包装工程，在手机上运行同一套 Node.js 服务并用 WebView 展示。

## 快速开始

```bash
npm install
npm start
```

打开大厅：

```text
http://localhost:3000
```

同一 WiFi 下的其他设备可以访问：

```text
http://<主机 IP>:3000
```

## 游戏列表

| 类型 | 游戏 |
| --- | --- |
| 经典棋盘 | 井字棋、五子棋、飞行棋、中国象棋、9 路围棋 |
| 派对卡牌 | UNO、爆炸猫、数字炸弹、抽鬼牌、你画我猜、真心话大冒险 |
| 推理 | 达芬奇密码、骗子酒馆 |
| 扑克 | 斗地主、大老二、德州扑克 |
| 桌面策略 | 魔力桥、大富翁 |
| 脑力竞速 | 24 点、扫雷竞速、羊了个羊 |
| 实时对战 | 贪吃蛇大乱斗、合成大西瓜 |

## 常用命令

```bash
npm start             # 启动局域网服务器
npm test              # 运行回归测试
npm run check         # 检查项目 JavaScript 语法
npm run test:monopoly # 运行大富翁专项测试
```

Windows 上如果 `3000` 端口还被旧的 Node 进程占用：

```powershell
taskkill /f /im node.exe
```

## 目录结构

```text
.
|-- server.js                 # Express + WebSocket 服务端、房间、路由、AI 调度
|-- main.js                   # Android nodejs-mobile 入口
|-- games/                    # 游戏规则和状态流转
|-- bots/                     # AI 走法生成器
|-- lang/                     # 服务端文本
|-- public/                   # 浏览器大厅、游戏壳、渲染器、样式、资源
|-- scripts/                  # 冒烟模拟和维护脚本
|-- tests/                    # node:test 回归测试
|-- android/                  # Android Studio 包装工程
`-- docs/                     # 公开架构和开发说明
```

服务端/客户端流程见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，新增游戏步骤见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## Android

Android 工程使用 nodejs-mobile + WebView 包装同一套 Node.js 游戏服务。完整配置见 [android/SETUP.md](android/SETUP.md)。

每次修改前后端后，先复制项目到 Android assets：

```powershell
cd android
.\copy-nodejs-project.ps1
```

然后用 Android Studio 打开 `android/` 并运行。

## 参与贡献

欢迎提交 bug、规则修正、AI 优化、渲染器打磨和新游戏。开始前请看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 协议

[MIT](LICENSE)
