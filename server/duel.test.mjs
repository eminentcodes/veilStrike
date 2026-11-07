import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { DuelSimulation, emptyInput } from './dist/duel/simulation.js';
import { CHAMPIONS } from './dist/duel/catalog.js';
import { NORMAL_DAMAGE_SCALE, ROUND_LENGTH } from './dist/duel/simulation.js';

const config = { player: 'karen', opponent: 'nomet', arena: 'sanctum', difficulty: 'warrior', mode: 'pvp' };
function enterFight(sim) {
  for (let i=0; sim.phase === 'intro' && i<400; i++) sim.advance(.01, emptyInput());
  assert.equal(sim.phase, 'fight');
}
function start(overrides = {}) {
  const sim = new DuelSimulation({ ...config, ...overrides });
  enterFight(sim);
  assert.equal(sim.phase, 'fight');
  sim.fighters[0].x = 0; sim.fighters[0].z = 2; sim.fighters[0].yaw = Math.PI;
  sim.fighters[1].x = 0; sim.fighters[1].z = 0; sim.fighters[1].yaw = 0;
  sim.drainEvents(); return sim;
}
function advance(sim, seconds, a = emptyInput(), b = emptyInput()) { for (let i = 0; i < Math.ceil(seconds / .01); i++) sim.advance(.01, a, b); }
test('both fighters remain held until the spoken Fight gate releases the fast intro', () => {
  const sim = new DuelSimulation(config);
  const before = sim.fighters.map(f => ({x:f.x,z:f.z,hp:f.hp}));
  const move = {...emptyInput(),x:1,light:true};
  for(let i=0;i<160;i++)sim.advance(.01,move,move,false);
  assert.equal(sim.phase,'intro');assert.equal(sim.timer,ROUND_LENGTH);
  assert.deepEqual(sim.fighters.map(f=>({x:f.x,z:f.z,hp:f.hp})),before);
  assert.equal(sim.drainEvents().filter(e=>e.kind==='round').length,1);
  sim.advance(.01,emptyInput(),emptyInput(),true);assert.equal(sim.phase,'fight');
  sim.advance(.01,{...emptyInput(),x:1},{...emptyInput(),x:-1});
  assert.ok(sim.fighters[0].x>before[0].x);assert.ok(sim.fighters[1].x<before[1].x);
});
test('a light strike costs stamina and connects during its active window', () => {
  const sim = start(), health = sim.fighters[1].hp;
  sim.advance(.01, { ...emptyInput(), light: true }, emptyInput());
  assert.equal(sim.fighters[0].stamina, CHAMPIONS.karen.stamina - CHAMPIONS.karen.moves.light.stamina);
  advance(sim, .1); assert.equal(sim.fighters[1].hp, health);
  advance(sim, .15); assert.ok(sim.fighters[1].hp < health);
  const hits = sim.drainEvents().filter(e => e.kind === 'hit'); assert.equal(hits.length, 1);
  advance(sim, .5); assert.equal(sim.fighters[0].attack, null);
});
test('normal attacks reduce health damage and push the opponent backward without knocking them down', () => {
  const sim=start(),target=sim.fighters[1],health=target.hp;
  sim.advance(.01,{...emptyInput(),light:true},emptyInput());advance(sim,.25);
  const hit=sim.drainEvents().find(e=>e.kind==='hit');assert.ok(hit);
  assert.equal(hit.damage,Math.round(CHAMPIONS.karen.moves.light.damage*NORMAL_DAMAGE_SCALE*(1-CHAMPIONS.nomet.armor)));
  assert.equal(health-target.hp,hit.damage);assert.equal(target.state,'stagger');assert.ok(target.z<-.05);
  assert.equal(hit.target,1);assert.equal(hit.knockdown,false);
});

test('one heavy hit staggers; sustained impacts cause knockdown followed by a longer recovery', () => {
  const sim=start();sim.advance(.01,{...emptyInput(),heavy:true},emptyInput());advance(sim,.55);
  assert.equal(sim.fighters[1].state,'stagger');assert.ok(sim.fighters[1].impactLoad>0);
  advance(sim,.4);
  sim.fighters[0].x=0;sim.fighters[0].z=2;sim.fighters[0].yaw=Math.PI;sim.fighters[1].x=0;sim.fighters[1].z=0;
  sim.advance(.01,{...emptyInput(),heavy:true},emptyInput());advance(sim,.5);
  assert.equal(sim.fighters[1].state,'knockdown');assert.ok(sim.drainEvents().some(e=>e.kind==='hit'&&e.knockdown));
  advance(sim,1.08);assert.equal(sim.fighters[1].state,'getup');advance(sim,1.2);assert.equal(sim.fighters[1].state,'idle');
});

test('impact pressure decays so isolated hits do not accumulate forever', () => {
  const sim=start();sim.advance(.01,{...emptyInput(),light:true},emptyInput());advance(sim,.4);
  assert.ok(sim.fighters[1].impactLoad>0);advance(sim,2.3);assert.equal(sim.fighters[1].impactLoad,0);
});

test('fatal impact keeps surrender advancing during the round result', () => {
  const sim=start();sim.fighters[1].hp=1;sim.advance(.01,{...emptyInput(),light:true},emptyInput());advance(sim,.3);
  assert.equal(sim.phase,'roundEnd');assert.equal(sim.fighters[1].state,'dead');
  const time=sim.fighters[1].stateTime;advance(sim,1.9);assert.ok(sim.fighters[1].stateTime>time+1.8);assert.equal(sim.fighters[1].hp,0);
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
  enterFight(sim); const x = sim.fighters[1].x, z = sim.fighters[1].z;
  sim.advance(.01, emptyInput());
  assert.equal(sim.fighters[1].x, x); assert.equal(sim.fighters[1].z, z);
  for (let i = 0; i < 3000 && sim.phase === 'fight'; i++) sim.advance(.01, emptyInput());
  assert.equal(opponentHealth, CHAMPIONS.nomet.health);
  assert.ok(sim.fighters[0].hp < CHAMPIONS.karen.health);
  assert.ok(sim.drainEvents().some(e => e.kind === 'hit' && e.slot === 1));
});

test('two real WebSocket clients share a server-authoritative duel', { timeout: 20000 }, async () => {
  const port = 18987;
  const child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const clients = [], messages = [[], []];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
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
    clients[1].send(JSON.stringify({ type: 'join', code: roomCode, fighter: 'taren', name: 'Challenger' }));
    await waitFor(() => messages[1].some(m => m.type === 'seat'));
    assert.equal(messages[1].find(m => m.type === 'seat').slot, 1);
    clients.forEach(ws => ws.send(JSON.stringify({ type: 'ready' })));
    await waitFor(() => messages[1].some(m => m.type === 'start'));
    assert.equal(messages[0].find(m => m.type === 'start').config.opponent, 'taren');
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

test('Taren repulse only hits nearby opponents in front and sends them into a high-impact fall',()=>{
  for(const [distance,facing,connect] of [[2,Math.PI,true],[5,Math.PI,false],[2,0,false]]){
    const sim=start({player:'taren',opponent:'karen'}),hp=sim.fighters[1].hp;
    sim.fighters[0].z=distance;sim.fighters[0].yaw=facing;
    sim.advance(.01,{...emptyInput(),special:true},emptyInput());advance(sim,.6);
    assert.equal(sim.fighters[1].hp<hp,connect);
    if(connect){assert.equal(sim.fighters[1].state,'knockdown');assert.ok(sim.fighters[1].z<-.4);}
  }
});

test('Nomet ground slam hits around him and cannot damage distant opponents',()=>{
  for(const distance of [2,5]){
    const sim=start({player:'nomet',opponent:'karen'}),hp=sim.fighters[1].hp;
    sim.fighters[0].z=distance;sim.fighters[0].yaw=0;
    sim.advance(.01,{...emptyInput(),special:true},emptyInput());advance(sim,.6);
    assert.equal(sim.fighters[1].hp<hp,distance===2);
    if(distance===2)assert.equal(sim.fighters[1].state,'knockdown');
  }
});

test('Veyra launches at range and pulls the opponent toward her; a miss never pulls',()=>{
  const sim=start({player:'veyra',opponent:'karen'});sim.fighters[0].z=6;
  sim.advance(.01,{...emptyInput(),special:true},emptyInput());advance(sim,.5);
  assert.equal(sim.fighters[1].state,'stagger');assert.ok(sim.fighters[1].z>.08);assert.ok(sim.fighters[1].vz>0);
  const miss=start({player:'veyra',opponent:'karen'});miss.fighters[0].z=6;miss.fighters[0].yaw=0;
  miss.advance(.01,{...emptyInput(),special:true},emptyInput());advance(miss,.6);
  assert.equal(miss.fighters[1].hp,CHAMPIONS.karen.health);assert.equal(miss.fighters[1].z,0);
});

test('Mawren lays a persistent visible seal and ward; bolt detonates the seal for increased damage',()=>{
  const setup=()=>{const s=start({player:'mawren',opponent:'karen'});s.fighters[0].z=3;return s;};
  const base=setup();base.advance(.01,{...emptyInput(),heavy:true},emptyInput());advance(base,.55);
  const ordinary=CHAMPIONS.karen.health-base.fighters[1].hp;
  const sim=setup();sim.advance(.01,{...emptyInput(),special:true},emptyInput());advance(sim,.6);
  assert.equal(sim.fighters[1].hp,CHAMPIONS.karen.health);assert.ok(sim.fighters[0].runeTime>7);assert.ok(sim.fighters[0].wardTime>1);
  assert.ok(Math.hypot(sim.fighters[0].runeX,sim.fighters[0].runeZ)<.01);
  advance(sim,.4);sim.advance(.01,{...emptyInput(),heavy:true},emptyInput());advance(sim,.55);
  assert.equal(sim.fighters[0].runeTime,0);assert.ok(CHAMPIONS.karen.health-sim.fighters[1].hp>ordinary*1.5);
  const ward=setup();ward.fighters[0].wardTime=1.4;ward.fighters[1].z=1;
  ward.advance(.01,emptyInput(),{...emptyInput(),light:true});advance(ward,.3);
  assert.ok(ward.drainEvents().some(e=>e.kind==='guard'&&e.slot===0));assert.equal(ward.fighters[1].state,'attack');
});

test('Karen signature has three independent sword contacts without an ordinary kneel',()=>{
  const sim=start();sim.advance(.01,{...emptyInput(),special:true},emptyInput());advance(sim,1.3);
  assert.equal(sim.drainEvents().filter(e=>e.kind==='hit'&&e.move==='special').length,3);
  assert.notEqual(sim.fighters[1].state,'dead');assert.notEqual(sim.fighters[1].state,'knockdown');
});

test('Premium release stats exceed starters and all fighters share longer rounds and faster recharge',()=>{
  for(const id of ['veyra','mawren'])for(const basic of ['karen','taren','nomet']){
    for(const stat of ['health','stamina','regen','armor','speed'])assert.ok(CHAMPIONS[id][stat]>CHAMPIONS[basic][stat],id+' '+stat);
    for(const move of ['light','heavy','ultimate'])assert.ok(CHAMPIONS[id].moves[move].damage>CHAMPIONS[basic].moves[move].damage);
  }
  const sim=start({player:'veyra'});assert.ok(sim.timer>119);
  sim.advance(.01,{...emptyInput(),special:true},emptyInput());assert.ok(Math.abs(sim.fighters[0].specialCooldown-4.8)<1e-9);
  advance(sim,4.9);assert.equal(sim.fighters[0].specialCooldown,0);
});

test('Premium AI uses its signature and follows it with damaging attacks',()=>{
  for(const id of ['veyra','mawren']){
    const sim=new DuelSimulation({...config,opponent:id,mode:'practice',difficulty:'master'},42);
    enterFight(sim);const events=[];
    for(let i=0;i<2500;i++){sim.advance(.01,emptyInput());events.push(...sim.drainEvents());}
    assert.ok(events.some(e=>e.slot===1&&e.kind==='release'&&e.move==='special'),id+' did not use special');
    assert.ok(events.some(e=>e.slot===1&&e.kind==='hit'),id+' did not attack');
  }
});

