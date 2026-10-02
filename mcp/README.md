# GameNest MCP Server

让 AI（Claude Code / Claude Desktop 等）作为一个普通玩家加入 GameNest 房间，和真人或电脑同局对战。
A local MCP (stdio) server: it connects to a running GameNest server over WebSocket and plays as a normal seat.

## 使用 / Usage

1. 先启动 GameNest：`npm start`（默认 :3000）。
2. 安装 MCP 自己的依赖（独立的包，不会打进 exe/APK）：`cd mcp && npm install`。
3. 在仓库根目录注册（`GAMENEST_URL` 默认 `ws://localhost:3000`）：

```bash
claude mcp add gamenest -e GAMENEST_URL=ws://localhost:3000 -- node mcp/server.js
```

Claude Desktop (`claude_desktop_config.json`)：

```json
{
  "mcpServers": {
    "gamenest": {
      "command": "node",
      "args": ["D:/path/to/GameNest/mcp/server.js"],
      "env": { "GAMENEST_URL": "ws://localhost:3000" }
    }
  }
}
```

局域网内别的机器上的服务器：`GAMENEST_URL=ws://192.168.x.x:3000`。MCP 服务必须在 GameNest 仓库内运行（会读取 `games/`、`bots/`）。

## 工具 / Tools

`list_games`, `get_rules(game)`, `create_room(game, name?)`, `join_room(roomId, name?)`, `add_bot`, `remove_bot(seat)`,
`set_option(key, value)`, `ready`, `start_game`, `get_state`, `wait_for_turn(timeoutSec?)`, `make_move(move, expectSeq?)`,
`suggest_move`, `restart`, `next_round`, `return_to_room`, `send_message(type, data)`（换座/踢人/头像/改名）, `leave_room`.

典型流程 / Typical flow: `create_room` -> `add_bot` 或让真人用房间号加入 -> `ready` -> `start_game` ->
循环 `wait_for_turn` -> `get_rules`/`suggest_move` -> `make_move` -> 直到 `gameOver`。

- `wait_for_turn` 的 `reason`：`my_turn` / `game_over` / `round_end`（24 点，调用 `next_round`）/ `timeout`。同时进行的游戏（2048、数独、扫雷等）随时都算 `my_turn`。
- `expectSeq`：传入 `get_state` 的 `seq`，局面已变化时拒绝过期出招。
- 断线会用 resume token 自动重连原座位。日志只写 stderr。
- `suggest_move` 用项目内置电脑算法在你这个座位看得到的局面上给建议，不会偷看别人的手牌；数独由 MCP 自己解当前盘面。
