import { spawn } from 'node:child_process';

const child = spawn('cmd.exe', ['/c', 'C:\\Users\\ay660\\AppData\\Local\\Roblox\\mcp.bat'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});

let out = '';
let err = '';
child.stdout.on('data', (d) => {
  const text = d.toString();
  out += text;
  process.stdout.write(text);
});
child.stderr.on('data', (d) => {
  const text = d.toString();
  err += text;
  process.stderr.write(text);
});

const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'probe', version: '1.0.0' },
  },
});
setTimeout(() => send({ jsonrpc: '2.0', method: 'notifications/initialized' }), 1200);
setTimeout(() => send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }), 1800);
setTimeout(() => {
  child.kill();
  console.log('\n--- stderr ---\n' + err);
  process.exit(0);
}, 7000);
