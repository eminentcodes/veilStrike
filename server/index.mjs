import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { DuelSimulation, emptyInput, clamp } from './dist/duel/simulation.js';
import { validArena, playableFighter } from './dist/duel/catalog.js';

const port = Number(process.env.PORT || 8787);
const rooms = new Map();
const peers = new Map();
const actionKeys = ['light', 'heavy', 'dodge', 'special', 'ultimate', 'jump', 'grapple'];
function send(socket, value) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); }
function code() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value;
  do { value = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(value));
  return value;
}
function info(room) {
  return { type: 'room', code: room.code, status: room.status, arena: room.config.arena, players: room.seats.map(seat => seat ? { fighter: seat.fighter, name: seat.name, ready: seat.ready } : null) };
}
function publishRoom(room) { const value = info(room); room.seats.forEach(seat => send(seat?.socket, value)); }
function reject(socket, message) { send(socket, { type: 'error', message }); }
function cleanInput(value) {
  const input = emptyInput();
  if (!value || typeof value !== 'object') return input;
  input.x = typeof value.x === 'number' && Number.isFinite(value.x) ? clamp(value.x, -1, 1) : 0;
  input.z = typeof value.z === 'number' && Number.isFinite(value.z) ? clamp(value.z, -1, 1) : 0;
  const magnitude = Math.hypot(input.x, input.z);
  if (magnitude > 1) { input.x /= magnitude; input.z /= magnitude; }
  for (const key of ['sprint', 'guard', ...actionKeys]) input[key] = value[key] === true;
  input.lockOn = value.lockOn !== false;
  return input;
}
function closeRoom(room, message, departed) {
  for (const seat of room.seats) {
    if (!seat) continue;
    if (seat.socket !== departed) send(seat.socket, { type: 'closed', message });
    const peer = peers.get(seat.socket);
    if (peer) peer.room = null;
  }
  rooms.delete(room.code);
}
const server = createServer((request, response) => {
  if (request.url !== '/health') { response.writeHead(404); response.end('Not found'); return; }
  response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
});
const sockets = new WebSocketServer({ server, path: '/duel', maxPayload: 4096 });
sockets.on('connection', socket => {
  const peer = { room: null, slot: null, lastMessageWindow: performance.now(), messages: 0, alive: true };
  peers.set(socket, peer);
  socket.on('pong', () => { peer.alive = true; });
  socket.on('message', raw => {
    const now = performance.now();
    if (now - peer.lastMessageWindow > 1000) { peer.messages = 0; peer.lastMessageWindow = now; }
    if (++peer.messages > 150) { socket.close(1008, 'Too many messages'); return; }
    let message;
    try { message = JSON.parse(raw.toString()); } catch { reject(socket, 'Invalid message.'); return; }
    if (!message || typeof message !== 'object') { reject(socket, 'Invalid message.'); return; }
    if (message.type === 'create' || message.type === 'join') {
      if (peer.room) { reject(socket, 'You are already in a room.'); return; }
      if (!playableFighter(message.fighter)) { reject(socket, 'That fighter is coming soon. Choose Karen, Taren, or Nomet.'); return; }
      const seat = { socket, fighter: message.fighter, name: typeof message.name === 'string' ? message.name.trim().slice(0, 20) || 'Warrior' : 'Warrior', ready: false, loaded: false, input: emptyInput() };
      if (message.type === 'create') {
        if (!validArena(message.arena)) { reject(socket, 'Choose a valid arena.'); return; }
        if (rooms.size >= 100) { reject(socket, 'The arena server is full. Try again shortly.'); return; }
        const room = { code: code(), createdAt: now, status: 'waiting', seats: [seat, null], config: { player: message.fighter, opponent: 'nomet', arena: message.arena, difficulty: 'warrior', mode: 'pvp' }, simulation: null, lastBroadcast: 0 };
        rooms.set(room.code, room); peer.room = room; peer.slot = 0;
        send(socket, { type: 'seat', slot: 0 }); publishRoom(room);
      } else {
        const room = typeof message.code === 'string' ? rooms.get(message.code.toUpperCase()) : null;
        if (!room) { reject(socket, 'Room not found. Check the five-character code.'); return; }
        if (room.seats[1] || room.status !== 'waiting') { reject(socket, 'That room already has two fighters.'); return; }
        room.seats[1] = seat; room.config.opponent = message.fighter; peer.room = room; peer.slot = 1;
        send(socket, { type: 'seat', slot: 1 }); publishRoom(room);
      }
      return;
    }
    const room = peer.room;
    if (!room || peer.slot === null) { reject(socket, 'Create or join a room first.'); return; }
    const seat = room.seats[peer.slot];
    if (!seat) return;
    if (message.type === 'ready' && room.status === 'waiting') {
      seat.ready = true;
      if (room.seats.every(s => s?.ready)) {
        room.status = 'loading'; publishRoom(room);
        room.seats.forEach(s => send(s.socket, { type: 'start', config: room.config }));
      } else publishRoom(room);
    } else if (message.type === 'loaded' && room.status === 'loading') {
      seat.loaded = true;
      if (room.seats.every(s => s?.loaded)) {
        room.status = 'fighting'; room.simulation = new DuelSimulation(room.config, randomInt(2147483647)); publishRoom(room);
      }
    } else if (message.type === 'input' && room.status === 'fighting') {
      const input = cleanInput(message.input);
      for (const key of actionKeys) input[key] ||= seat.input[key];
      seat.input = input;
    } else if (message.type === 'leave') {
      closeRoom(room, 'Your opponent left the arena.', socket);
    }
  });
  socket.on('close', () => { if (peer.room) closeRoom(peer.room, 'Your opponent disconnected.', socket); peers.delete(socket); });
  socket.on('error', () => undefined);
});
let lastTick = performance.now();
const loop = setInterval(() => {
  const now = performance.now(), dt = Math.min(.05, (now - lastTick) / 1000); lastTick = now;
  for (const room of rooms.values()) {
    if (now - room.createdAt > 30 * 60 * 1000) { closeRoom(room, 'This room has expired. Create a new arena.'); continue; }
    if (!room.simulation) continue;
    room.simulation.advance(dt, room.seats[0].input, room.seats[1].input);
    for (const seat of room.seats) for (const key of actionKeys) seat.input[key] = false;
    if (now - room.lastBroadcast >= 32) {
      room.lastBroadcast = now;
      const snapshot = room.simulation.snapshot(room.simulation.drainEvents());
      room.seats.forEach(seat => send(seat.socket, { type: 'state', snapshot }));
    }
  }
}, 1000 / 60);
const heartbeat = setInterval(() => {
  for (const [socket, peer] of peers) { if (!peer.alive) { socket.terminate(); continue; } peer.alive = false; socket.ping(); }
}, 25000);
server.listen(port, '0.0.0.0', () => console.log('Veilstrike PvP server listening on :' + port));
function stop() {
  clearInterval(loop); clearInterval(heartbeat);
  for (const socket of peers.keys()) socket.close(1001, 'Server stopping');
  sockets.close(); server.close(); setTimeout(() => process.exit(0), 400).unref();
}
process.once('SIGINT', stop); process.once('SIGTERM', stop);

