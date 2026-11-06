import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { DuelSimulation, emptyInput } from './dist/duel/simulation.js';
import { CHAMPIONS } from './dist/duel/catalog.js';

const config = { player: 'karen', opponent: 'nomet', arena: 'sanctum', difficulty: 'warrior', mode: 'pvp' };
function start(overrides = {}) {
  const sim = new DuelSimulation({ ...config, ...overrides });
  for (let i = 0; i < 270; i++) sim.advance(.01, emptyInput(), emptyInput());
  assert.equal(sim.phase, 'fight');
  sim.fighters[0].x = 0; sim.fighters[0].z = 2; sim.fighters[0].yaw = Math.PI;
  sim.fighters[1].x = 0; sim.fighters[1].z = 0; sim.fighters[1].yaw = 0;
  sim.drainEvents(); return sim;
}
function advance(sim, seconds, a = emptyInput(), b = emptyInput()) { for (let i = 0; i < Math.ceil(seconds / .01); i++) sim.advance(.01, a, b); }
test('a light strike costs stamina and connects during its active window', () => {
  const sim = start(), health = sim.fighters[1].hp;
  sim.advance(.01, { ...emptyInput(), light: true }, emptyInput());
  assert.equal(sim.fighters[0].stamina, CHAMPIONS.karen.stamina - CHAMPIONS.karen.moves.light.stamina);
  advance(sim, .1); assert.equal(sim.fighters[1].hp, health);
  advance(sim, .15); assert.ok(sim.fighters[1].hp < health);
  const hits = sim.drainEvents().filter(e => e.kind === 'hit'); assert.equal(hits.length, 1);
  advance(sim, .5); assert.equal(sim.fighters[0].attack, null);
});
test('directional hit detection rejects a target outside the weapon arc', () => {
  const sim = start(), health = sim.fighters[1].hp;
  sim.fighters[0].yaw = 0;
  sim.advance(.01, { ...emptyInput(), light: true }, emptyInput());
  advance(sim, .6); assert.equal(sim.fighters[1].hp, health);
});
test('dodge invulnerability avoids an otherwise in-range strike', () => {
  const sim = start(), health = sim.fighters[1].hp;
  sim.advance(.01, { ...emptyInput(), light: true }, { ...emptyInput(), dodge: true });
  sim.fighters[1].vx = 0; sim.fighters[1].vz = 0;
  advance(sim, .3); assert.equal(sim.fighters[1].hp, health); assert.equal(sim.fighters[1].state, 'dodge');
});
test('a correctly timed fresh guard parries a light strike', () => {
  const sim = start(), health = sim.fighters[1].hp;
  sim.advance(.01, { ...emptyInput(), light: true }, emptyInput());
  advance(sim, .1);
  advance(sim, .16, emptyInput(), { ...emptyInput(), guard: true });
  assert.equal(sim.fighters[1].hp, health);
  assert.equal(sim.fighters[0].state, 'stagger');
  assert.ok(sim.drainEvents().some(e => e.kind === 'parry'));
});
test('heavy strikes break exhausted guards', () => {
  const sim = start();
  sim.fighters[1].stamina = 10;
  sim.advance(.01, { ...emptyInput(), heavy: true }, { ...emptyInput(), guard: true });
  advance(sim, .7, emptyInput(), { ...emptyInput(), guard: true });
  assert.ok(sim.drainEvents().some(e => e.kind === 'break')); assert.ok(sim.fighters[1].hp < CHAMPIONS.nomet.health);
});
test('stamina gates dodge and ultimate charge gates finishers', () => {
  const sim = start();
  sim.fighters[0].stamina = 5;
  sim.advance(.01, { ...emptyInput(), dodge: true, ultimate: true }, emptyInput());
  assert.notEqual(sim.fighters[0].state, 'dodge'); assert.equal(sim.fighters[0].attack, null);
  sim.fighters[0].stamina = 100; sim.fighters[0].charge = 1;
  sim.advance(.01, { ...emptyInput(), ultimate: true }, emptyInput());
  assert.equal(sim.fighters[0].attack.id, 'ultimate'); assert.equal(sim.fighters[0].charge, 0);
});
test('round outcomes advance best-of-three and restore fighters', () => {
  const sim = start(); sim.fighters[1].hp = 0;
  sim.advance(.01, emptyInput(), emptyInput()); assert.equal(sim.phase, 'roundEnd'); assert.deepEqual(sim.wins, [1, 0]);
  advance(sim, 3.3); assert.equal(sim.round, 2); assert.equal(sim.phase, 'intro'); assert.equal(sim.fighters[1].hp, CHAMPIONS.nomet.health);
  advance(sim, 2.7); sim.fighters[1].hp = 0; sim.advance(.01, emptyInput(), emptyInput()); advance(sim, 3.3);
  assert.equal(sim.phase, 'complete'); assert.equal(sim.winner, 0); assert.deepEqual(sim.wins, [2, 0]);
});
test('AI waits for observable history, closes range, and attacks without stat inflation', () => {
  const sim = new DuelSimulation({ ...config, mode: 'practice', difficulty: 'master' }, 42);
  const opponentHealth = sim.fighters[1].hp;
  advance(sim, 2.7); const x = sim.fighters[1].x, z = sim.fighters[1].z;
  sim.advance(.01, emptyInput());
  assert.equal(sim.fighters[1].x, x); assert.equal(sim.fighters[1].z, z);
  for (let i = 0; i < 3000 && sim.phase === 'fight'; i++) sim.advance(.01, emptyInput());
  assert.equal(opponentHealth, CHAMPIONS.nomet.health);
  assert.ok(sim.fighters[0].hp < CHAMPIONS.karen.health);
  assert.ok(sim.drainEvents().some(e => e.kind === 'hit' && e.slot === 1));
});

test('two real WebSocket clients share a server-authoritative duel', { timeout: 15000 }, async () => {
  const port = 18987;
  const child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const clients = [], messages = [[], []];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out')), 5000);
      child.stdout.on('data', data => { if (String(data).includes('listening')) { clearTimeout(timer); resolve(); } });
      child.on('error', reject); child.stderr.on('data', data => { clearTimeout(timer); reject(new Error(String(data))); });
    });
    for (let i = 0; i < 2; i++) {
      const ws = new WebSocket('ws://127.0.0.1:' + port + '/duel'); clients.push(ws);
      ws.on('message', raw => messages[i].push(JSON.parse(raw.toString())));
      await once(ws, 'open');
    }
    const waitFor = async predicate => {
      for (let i = 0; i < 160; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 25)); }
      throw new Error('Expected room event did not arrive');
    };
    clients[0].send(JSON.stringify({ type: 'create', fighter: 'karen', arena: 'forge', name: 'Host' }));
    await waitFor(() => messages[0].some(m => m.type === 'room'));
    const roomCode = messages[0].find(m => m.type === 'room').code;
    clients[1].send(JSON.stringify({ type: 'join', code: roomCode, fighter: 'seyra', name: 'Challenger' }));
    await waitFor(() => messages[1].some(m => m.type === 'seat'));
    assert.equal(messages[1].find(m => m.type === 'seat').slot, 1);
    clients.forEach(ws => ws.send(JSON.stringify({ type: 'ready' })));
    await waitFor(() => messages[1].some(m => m.type === 'start'));
    assert.equal(messages[0].find(m => m.type === 'start').config.opponent, 'seyra');
    clients.forEach(ws => ws.send(JSON.stringify({ type: 'loaded' })));
    await waitFor(() => messages[0].some(m => m.type === 'state'));
    assert.deepEqual(messages[0].find(m => m.type === 'state').snapshot, messages[1].find(m => m.type === 'state').snapshot);
    await waitFor(() => messages[0].some(m => m.type === 'state' && m.snapshot.phase === 'fight'));
    const before = messages[0].findLast(m => m.type === 'state').snapshot;
    clients[0].send(JSON.stringify({ type: 'input', input: { x: 99999, z: 99999, hp: 99999, light: true } }));
    await new Promise(resolve => setTimeout(resolve, 250));
    const after = messages[0].findLast(m => m.type === 'state').snapshot;
    assert.equal(after.fighters[0].hp, before.fighters[0].hp);
    assert.ok(Math.hypot(after.fighters[0].x - before.fighters[0].x, after.fighters[0].z - before.fighters[0].z) < 2);
    assert.ok(after.fighters[0].stamina < before.fighters[0].stamina);
    clients[1].close();
    await waitFor(() => messages[0].some(m => m.type === 'closed'));
    assert.match(messages[0].find(m => m.type === 'closed').message, /disconnected/);
  } finally {
    for (const client of clients) client.terminate();
    child.kill('SIGTERM');
  }
});

