# Security Policy

This project is designed for trusted local networks. It is not hardened as a public Internet game server.

## Supported Use

- Run on a private LAN or trusted WiFi.
- Do not expose port `3000` directly to the public Internet.
- Treat room IDs as convenience links, not access-control secrets.

## Reporting a Vulnerability

Please open a private report if GitHub security advisories are enabled for the repository. Otherwise, contact the maintainer privately before publishing details.

Useful reports include:

- Steps to reproduce.
- Affected browser or device.
- Whether the issue requires LAN access.
- Screenshots or logs when relevant.

## Known Boundaries

- The server keeps room state in memory.
- There is no account system.
- The Android wrapper is for local play and testing.
- Game content is not intended for untrusted public submissions without review.
