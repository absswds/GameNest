# GameNest MCP Server

简体中文 | [English](README.md)

让任意支持 MCP 的 AI 客户端（Claude、Cursor、Codex、Gemini CLI、Cline、Continue 等）作为一个普通玩家加入 GameNest 房间，和真人或电脑同局对战。
它不绑定任何一家客户端：通过 WebSocket 连接正在运行的 GameNest 服务器，以普通座位身份出招，对外提供标准 MCP，支持 **stdio**（默认）和 **Streamable HTTP** 两种传输。

## 使用

1. 先启动 GameNest：`npm start`（默认 :3000）。
2. 安装 MCP 自己的依赖（独立的包，不会打进 exe/APK）：`cd mcp && npm install`。
3. 在你的 MCP 客户端里注册（`GAMENEST_URL` 默认 `ws://localhost:3000`）。

### 通用 stdio 配置

绝大多数客户端都接受下面这种 `mcpServers` JSON（路径改成你的仓库位置）：

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

常见客户端：

| 客户端 | 做法 |
| --- | --- |
| Claude Code | `claude mcp add gamenest -e GAMENEST_URL=ws://localhost:3000 -- node mcp/server.js` |
| Claude Desktop / Cursor / Cline / Windsurf | 把上面的 JSON 放进各自的 MCP 配置文件 |
| Codex CLI | `codex mcp add gamenest --env GAMENEST_URL=ws://localhost:3000 -- node mcp/server.js`，或写入 `~/.codex/config.toml` 的 `[mcp_servers.gamenest]` |
| Gemini CLI | 把 JSON 放进 `~/.gemini/settings.json` 的 `mcpServers` |

各客户端的命令和配置位置会随版本变化，以其官方文档为准；只要它能启动一个 stdio MCP 服务或连接一个 HTTP MCP 地址即可。

### HTTP 模式（Streamable HTTP）

不想让客户端拉起子进程（或客户端只支持远程 MCP）时：

```bash
node mcp/server.js --http=3333        # 或 MCP_HTTP_PORT=3333
```

客户端连接 `http://127.0.0.1:3333/mcp`（例如 `claude mcp add --transport http gamenest http://127.0.0.1:3333/mcp`、`gemini mcp add --transport http gamenest http://127.0.0.1:3333/mcp`；Codex 在 `config.toml` 里用 `url`，其他客户端见各自文档）。带非本机 `Origin` 的浏览器请求会被拒绝（403）。服务只监听该端口的 `POST /mcp`（无状态），**没有鉴权**，整个进程只占一个游戏座位，请只在本机或可信局域网使用。

连接局域网内别的机器上的服务器：`GAMENEST_URL=ws://192.168.x.x:3000`。MCP 服务必须在 GameNest 仓库内运行（会读取 `games/`、`bots/`）。

## 工具

`list_games`, `get_rules(game)`, `create_room(game, name?)`, `join_room(roomId, name?)`, `add_bot`, `remove_bot(seat)`,
`set_option(key, value)`, `ready`, `start_game`, `get_state`, `wait_for_turn(timeoutSec?)`, `make_move(move, expectSeq?)`,
`suggest_move`, `restart`, `next_round`, `return_to_room`, `send_message(type, data)`（换座/踢人/头像/改名）, `leave_room`.
画我猜专用：`get_canvas`（返回画布 PNG 图片，需客户端支持图片返回）、`draw(svg)`（画家用 SVG 作画，支持 line/rect/circle/ellipse/polyline/polygon/path，不支持 transform 和填充）、`undo_stroke(count?)`、`clear_canvas`（画错了撤销或清空，所有人同步看到）。

典型流程：`create_room` -> `add_bot` 或让真人用房间号加入 -> `ready` -> `start_game` ->
循环 `wait_for_turn` -> `get_rules`/`suggest_move` -> `make_move` -> 直到 `gameOver`。

- `wait_for_turn` 的 `reason`：`my_turn` / `game_over` / `round_end`（24 点，调用 `next_round`）/ `timeout`。同时进行的游戏（2048、数独、扫雷等）随时都算 `my_turn`。
- `expectSeq`：传入 `get_state` 的 `seq`，局面已变化时拒绝过期出招。
- 断线会用 resume token 自动重连原座位。日志只写 stderr。
- `suggest_move` 用项目内置电脑算法在你这个座位看得到的局面上给建议，不会偷看别人的手牌；数独由 MCP 自己解当前盘面。

## 已知限制

- **一个进程只占一个座位**：同一个 MCP 进程（包括 HTTP 模式）同一时间只能在一个房间坐一个座位；想让多个 AI 同局，要启动多个 MCP 进程。
- **HTTP 模式没有鉴权**，只校验 `Origin`；不要暴露到公网。
- **实时游戏不适合**：合成大西瓜对战（suikabattle）的落点和合成由浏览器物理引擎生成，AI 实际上没法玩；贪吃蛇（snakebattle）由服务器按帧推进，靠轮询工具调用很难跟上节奏。
- **`suggest_move` 不是每款都有**：没有内置电脑的游戏返回 `move: null`；电脑出错时也返回 `null`，不代表无路可走。
- **部分招式说明较粗**：狼人杀、三国杀、跳棋、象棋等的 `get_rules` 只给出大致格式，准确字段以 `get_state` 的状态和 `suggest_move` 的返回为准。
- **画我猜**：`get_canvas` 返回图片，客户端不支持图片结果时看不到画面；`draw` 每次最多 60 笔，只画线条（无填充、无 `transform`），复杂 SVG 会被近似成折线。
- **必须在仓库内运行**：MCP 会直接读取 `games/`、`bots/`，不能单独拷走 `mcp/` 目录使用。
