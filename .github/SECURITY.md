# 安全策略 / Security Policy

本项目面向可信的局域网设计，没有按公网游戏服务器的标准做安全加固。

This project is designed for trusted local networks. It is not hardened as a public Internet game server.

## 适用范围 / Supported Use

- 在私人局域网或可信 WiFi 中运行。
- 不要把 `3000` 端口直接暴露到公网。
- 房间号只是方便加入的链接，不是访问控制用的密钥。

- Run on a private LAN or trusted WiFi.
- Do not expose port `3000` directly to the public Internet.
- Treat room IDs as convenience links, not access-control secrets.

## 报告漏洞 / Reporting a Vulnerability

如果仓库开启了 GitHub Security Advisories，请提交私密报告；否则请先私下联系维护者，再公开细节。

Please open a private report if GitHub security advisories are enabled for the repository. Otherwise, contact the maintainer privately before publishing details.

有用的报告包括 / Useful reports include:

- 复现步骤 / Steps to reproduce.
- 受影响的浏览器或设备 / Affected browser or device.
- 是否需要局域网访问才能利用 / Whether the issue requires LAN access.
- 相关的截图或日志 / Screenshots or logs when relevant.

## 已知边界 / Known Boundaries

- 服务器把房间状态保存在内存中。 / The server keeps room state in memory.
- 没有账号系统。 / There is no account system.
- Android 版用于本地游玩和测试。 / The Android wrapper is for local play and testing.
- 游戏内容未经审核，不适合接收不可信的公开投稿。 / Game content is not intended for untrusted public submissions without review.
