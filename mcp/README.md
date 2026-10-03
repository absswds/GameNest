# GameNest MCP Server

[简体中文](README.zh-CN.md) | English

Lets any MCP-capable AI client (Claude, Cursor, Codex, Gemini CLI, Cline, Continue, ...) join a GameNest room as an ordinary player and play against humans or bots.
It is client-agnostic: it connects to a running GameNest server over WebSocket and plays as a normal seat. It speaks standard MCP over **stdio** (default) or **Streamable HTTP**, so it is not tied to any one vendor.

## Usage

1. Start GameNest first: `npm start` (port 3000 by default).
2. Install the MCP package's own dependencies (it is a separate package and is not bundled into the exe/APK): `cd mcp && npm install`.
3. Register it in your MCP client (`GAMENEST_URL` defaults to `ws://localhost:3000`).

### Generic stdio config

Most clients accept this `mcpServers` JSON (change the path to where your repo lives):

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

Common clients:

| Client | How |
| --- | --- |
| Claude Code | `claude mcp add gamenest -e GAMENEST_URL=ws://localhost:3000 -- node mcp/server.js` |
| Claude Desktop / Cursor / Cline / Windsurf | Paste the JSON above into the client's MCP config file |
| Codex CLI | `codex mcp add gamenest --env GAMENEST_URL=ws://localhost:3000 -- node mcp/server.js`, or add `[mcp_servers.gamenest]` to `~/.codex/config.toml` |
| Gemini CLI | Put the JSON under `mcpServers` in `~/.gemini/settings.json` |

Client CLIs and config paths change between versions, so check your client's docs. Any client that can launch a stdio MCP server or reach an HTTP MCP endpoint works.

### Streamable HTTP

If you don't want the client to spawn a child process (or the client only supports remote MCP):

```bash
node mcp/server.js --http=3333        # or MCP_HTTP_PORT=3333
```

Point the client at `http://127.0.0.1:3333/mcp` (for example `claude mcp add --transport http gamenest http://127.0.0.1:3333/mcp` or `gemini mcp add --transport http gamenest http://127.0.0.1:3333/mcp`; Codex uses `url` in `config.toml`; see your client's docs for others). Browser requests with a non-local `Origin` are rejected (403). The server only handles `POST /mcp` on that port (stateless), has **no authentication**, and holds one game seat for the whole process, so keep it on localhost or a trusted LAN.

For a GameNest server on another machine in the LAN: `GAMENEST_URL=ws://192.168.x.x:3000`. The MCP server must run inside the GameNest repo (it reads `games/` and `bots/`).

## Tools

`list_games`, `get_rules(game)`, `create_room(game, name?)`, `join_room(roomId, name?)`, `add_bot`, `remove_bot(seat)`,
`set_option(key, value)`, `ready`, `start_game`, `get_state`, `wait_for_turn(timeoutSec?)`, `make_move(move, expectSeq?)`,
`suggest_move`, `restart`, `next_round`, `return_to_room`, `send_message(type, data)` (swap seats / kick / avatar / rename), `leave_room`.
Draw & Guess only: `get_canvas` (returns the canvas as a PNG image; the client must support image results), `draw(svg)` (the drawer draws with SVG: line/rect/circle/ellipse/polyline/polygon/path; no `transform` and no fill), `undo_stroke(count?)` and `clear_canvas` (undo or clear mistakes; everyone sees the change).

Typical flow: `create_room` -> `add_bot`, or let humans join with the room code -> `ready` -> `start_game` ->
loop `wait_for_turn` -> `get_rules`/`suggest_move` -> `make_move` -> until `gameOver`.

- `wait_for_turn` returns a `reason`: `my_turn` / `game_over` / `round_end` (24 Points; call `next_round`) / `timeout`. In simultaneous games (2048, Sudoku, Minesweeper, ...) it is always `my_turn`.
- `expectSeq`: pass the `seq` from `get_state`, and a stale move is rejected if the game has moved on.
- After a disconnect it reconnects to the same seat with the resume token. Logs go to stderr only.
- `suggest_move` runs the project's built-in bot on the position your seat can see, so it never peeks at other players' hands. Sudoku is solved by the MCP server itself.

## Known limitations

- **One process = one seat**: one MCP process (HTTP mode included) can sit in only one seat in one room at a time. To put several AIs in the same game, start several MCP processes.
- **No authentication in HTTP mode**, only an `Origin` check. Don't expose it to the Internet.
- **Realtime games don't work well**: in Suika Battle (suikabattle) drops and merges come from the browser's physics engine, so an AI effectively can't play; Snake Battle (snakebattle) advances frame by frame on the server, which polling tool calls can hardly keep up with.
- **`suggest_move` isn't available everywhere**: games without a built-in bot return `move: null`. It also returns `null` when the bot fails, which doesn't mean there is no legal move.
- **Some move guides are rough**: for Werewolf, Three Kingdoms, Checkers, Chinese Chess and a few others, `get_rules` only gives the general shape. Trust the state from `get_state` and the result of `suggest_move` for the exact fields.
- **Draw & Guess**: `get_canvas` returns an image, so clients without image results can't see the canvas. `draw` takes at most 60 strokes per call and draws outlines only (no fill, no `transform`); complex SVG is approximated with polylines.
- **Must run inside the repo**: the MCP server reads `games/` and `bots/` directly, so the `mcp/` folder can't be copied out and used on its own.
