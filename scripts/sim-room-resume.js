const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const lobby = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const client = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'room-client.js'), 'utf8');
let failures = 0;
function assert(ok, message) { if (!ok) { failures++; console.error('FAIL:', message); } }

assert(server.includes('resumeToken'), '服务端应为玩家保存恢复凭证');
assert(server.includes('disconnectedAt'), '服务端应记录断线时间而非立即重置对局');
assert(client.includes("sessionStorage.getItem('resumeToken')"), '游戏页应携带恢复凭证重新加入');
assert(lobby.includes('resumeSection'), '大厅应提供返回进行中对局的入口');

if (failures) process.exit(1);
console.log('sim-room-resume: 恢复对局接线通过 ✓');
