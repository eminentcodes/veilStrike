import { spawn } from 'node:child_process';
const children = [];
const node = process.execPath;
const vite = new URL('../node_modules/vite/bin/vite.js', import.meta.url);
children.push(spawn(node, [new URL('../server/index.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], { stdio: 'inherit', windowsHide: true }));
children.push(spawn(node, [vite.pathname.replace(/^\/([A-Za-z]:)/, '$1'), '--host', '0.0.0.0'], { cwd: new URL('../apps/web/', import.meta.url), stdio: 'inherit', windowsHide: true }));
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code; }
for (const child of children) { child.on('error', error => { console.error(error.message); stop(1); }); child.on('exit', code => { if (!stopping) stop(code ?? 1); }); }
process.once('SIGINT', () => stop()); process.once('SIGTERM', () => stop());

