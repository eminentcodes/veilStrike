import { CHAMPIONS, levelHealth, levelDamage } from './catalog.js';
import type { DuelConfig, MoveId, Move, ChampionId } from './catalog.js';
import type { Difficulty } from '../fight/types.js';

export type Slot = 0 | 1;
export type FighterState = 'idle' | 'move' | 'sprint' | 'attack' | 'dodge' | 'guard' | 'stagger' | 'jump' | 'grapple' | 'grabbed' | 'thrown' | 'knockdown' | 'getup' | 'dead';
export type Phase = 'intro' | 'fight' | 'roundEnd' | 'complete';
export interface InputFrame { x: number; z: number; sprint: boolean; guard: boolean; light: boolean; heavy: boolean; dodge: boolean; special: boolean; ultimate: boolean; jump: boolean; grapple: boolean; lockOn: boolean; }
export function emptyInput(): InputFrame { return { x: 0, z: 0, sprint: false, guard: false, light: false, heavy: false, dodge: false, special: false, ultimate: false, jump: false, grapple: false, lockOn: true }; }
export interface AttackState { id: MoveId; elapsed: number; combo: number; connected: boolean; startedAt: number; power: number; released: boolean; aimX: number; aimZ: number; strike?: number; }
export interface FighterFrame {
  id: ChampionId; x: number; z: number; yaw: number; hp: number; stamina: number; charge: number;
  state: FighterState; attack: AttackState | null; stateTime: number; vx: number; vz: number;
  guardTime: number; regenDelay: number; dodgeCooldown: number; combo: number; comboUntil: number;
  y: number; vy: number; dodgeX: number; dodgeZ: number; grabbedBy: Slot | null;
  stunDuration: number; specialCooldown: number; momentum: number;
  impactLoad: number; impactRecovery: number;
  runeTime: number; runeX: number; runeZ: number; wardTime: number;
}
export interface DuelEvent { id: number; kind: 'attack' | 'release' | 'hit' | 'guard' | 'parry' | 'break' | 'dodge' | 'spell' | 'ultimate' | 'death' | 'round' | 'jump' | 'land' | 'grab' | 'throw'; slot: Slot; x: number; z: number; damage?: number; move?: MoveId; target?: Slot; power?: number; knockdown?: boolean; }
export const INPUT_BUFFER_TIME = .24;
export const DODGE_DURATION = .34;
type BufferedAction = { action: MoveId | 'dodge' | 'jump' | 'grapple'; until: number };
export interface DuelSnapshot { time: number; round: number; timer: number; phase: Phase; phaseTime: number; wins: [number, number]; fighters: [FighterFrame, FighterFrame]; aiIntent: string; events: DuelEvent[]; winner: Slot | null; }
const AI_TUNING: Record<Difficulty, { delay: number; think: number; defense: number; pressure: number }> = {
  initiate: { delay: .58, think: .32, defense: .23, pressure: .42 },
  warrior: { delay: .28, think: .17, defense: .56, pressure: .7 },
  master: { delay: .15, think: .11, defense: .78, pressure: .87 },
};
export const ARENA_RADIUS = 9;
export const ROUND_LENGTH = 150;
export const ROUND_INTRO_SECONDS = 1;
export const NORMAL_DAMAGE_SCALE = .468;
export const ULTIMATE_DAMAGE_SCALE = .612;
export const MAX_ROUNDS = 3;
export const KNOCKDOWN_IMPACT = 3.2;
export function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
export function angleDelta(a: number, b: number): number { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
export function moveDuration(move: Move): number { return move.startup + move.active + move.recovery; }

function makeFighter(id: ChampionId, slot: Slot): FighterFrame {
  return { id, x: slot === 0 ? -1.2 : 1.2, z: slot === 0 ? 2.5 : -2.5, yaw: slot === 0 ? Math.PI : 0, hp: CHAMPIONS[id].health, stamina: CHAMPIONS[id].stamina, charge: 0, state: 'idle', attack: null, stateTime: 0, vx: 0, vz: 0, guardTime: 0, regenDelay: 0, dodgeCooldown: 0, combo: 0, comboUntil: 0, y: 0, vy: 0, dodgeX: 0, dodgeZ: 0, grabbedBy: null, stunDuration: .22, specialCooldown: 0, momentum: 0, impactLoad: 0, impactRecovery: 0, runeTime: 0, runeX: 0, runeZ: 0, wardTime: 0 };
}

export class DuelSimulation {
  readonly config: DuelConfig;
  fighters: [FighterFrame, FighterFrame];
  time = 0;
  round = 1;
  timer = ROUND_LENGTH;
  phase: Phase = 'intro';
  phaseTime = 0;
  wins: [number, number] = [0, 0];
  winner: Slot | null = null;
  aiIntent = 'Reading your stance';
  private sequence = 0;
  private events: DuelEvent[] = [];
  private rngState: number;
  private aiNext = 0;
  private aiPlan = emptyInput();
  private observations: { at: number; player: FighterFrame }[] = [];
  private habit = { guard: 0, attacks: 0, heavy: 0 };
  private buffered: [BufferedAction | null, BufferedAction | null] = [null, null];
  private freeze = 0;
  private announcedRound = 0;

  constructor(config: DuelConfig, seed = 57293) {
    this.config = config;
    this.rngState = seed >>> 0;
    this.fighters = [makeFighter(config.player, 0), makeFighter(config.opponent, 1)];
    this.fighters[0].hp = levelHealth(config.player, config.playerLevel);
    this.fighters[1].hp = levelHealth(config.opponent, config.opponentLevel);
  }
  private random(): number {
    this.rngState = (Math.imul(this.rngState, 1664525) + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }
  private emit(kind: DuelEvent['kind'], slot: Slot, extra: Partial<DuelEvent> = {}): void {
    const f = this.fighters[slot];
    this.events.push({ id: ++this.sequence, kind, slot, x: f.x, z: f.z, ...extra });
    if (this.events.length > 120) this.events.shift();
  }
  drainEvents(): DuelEvent[] { return this.events.splice(0); }
  snapshot(events: DuelEvent[] = []): DuelSnapshot {
    return { time: this.time, round: this.round, timer: this.timer, phase: this.phase, phaseTime: this.phaseTime, wins: [...this.wins], winner: this.winner, aiIntent: this.aiIntent, events, fighters: this.fighters.map(f => ({ ...f, attack: f.attack ? { ...f.attack } : null })) as [FighterFrame, FighterFrame] };
  }
  advance(delta: number, input0: InputFrame, input1?: InputFrame, introReleased = true): void {
    const dt = clamp(delta, 0, .05);
    this.time += dt;
    this.phaseTime += dt;
    if (this.phase === 'intro') {
      if (this.announcedRound !== this.round) { this.announcedRound = this.round; this.emit('round', 0); }
      if (this.phaseTime >= ROUND_INTRO_SECONDS && introReleased) { this.phase = 'fight'; this.phaseTime = 0; }
      return;
    }
    if (this.phase === 'roundEnd') {
      // Keep the final recoil and surrender playing while combat input is frozen.
      for (const f of this.fighters) {
        if (f.hp <= 0) {
          f.stateTime += dt; f.x += f.vx * dt; f.z += f.vz * dt;
          f.vx *= Math.exp(-9*dt); f.vz *= Math.exp(-9*dt);
          f.vy -= 18*dt; f.y = Math.max(0,f.y+f.vy*dt); if (f.y === 0) f.vy = 0;
          this.bound(f);
        } else { f.attack = null; f.state = 'idle'; f.vx = 0; f.vz = 0; }
      }
      if (this.phaseTime > 3.2) {
        if (this.wins[0] >= 2 || this.wins[1] >= 2 || this.round >= MAX_ROUNDS) {
          this.phase = 'complete'; this.phaseTime = 0;
          this.winner = this.wins[0] === this.wins[1] ? null : this.wins[0] > this.wins[1] ? 0 : 1;
        } else {
          this.round++; this.phase = 'intro'; this.phaseTime = 0; this.timer = ROUND_LENGTH;
          this.fighters = [makeFighter(this.config.player, 0), makeFighter(this.config.opponent, 1)];
          this.fighters[0].hp = levelHealth(this.config.player, this.config.playerLevel);
          this.fighters[1].hp = levelHealth(this.config.opponent, this.config.opponentLevel);
          this.buffered = [null, null]; this.observations = []; this.freeze = 0; this.aiNext = this.time;
        }
      }
      return;
    }
    if (this.phase === 'complete') return;
    this.timer = Math.max(0, this.timer - dt);
    this.habit.guard += (Number(input0.guard) - this.habit.guard) * dt * .5;
    if (input0.light || input0.heavy) this.habit.attacks += 1;
    if (input0.heavy) this.habit.heavy += 1;
    this.observations.push({ at: this.time, player: { ...this.fighters[0], attack: this.fighters[0].attack ? { ...this.fighters[0].attack } : null } });
    while (this.observations.length > 70) this.observations.shift();
    const second = input1 ?? this.thinkAI();
    this.captureInput(0, input0); this.captureInput(1, second);
    if (this.freeze > 0) { this.freeze = Math.max(0, this.freeze - dt); return; }
    this.integrate(0, input0, dt);
    this.integrate(1, second, dt);
    this.separate();
    this.resolveAttack(0);
    this.resolveAttack(1);
    if (this.fighters[0].hp <= 0 || this.fighters[1].hp <= 0 || this.timer <= 0) this.endRound();
  }

  private integrate(slot: Slot, input: InputFrame, dt: number): void {
    const f = this.fighters[slot], enemy = this.fighters[slot === 0 ? 1 : 0], champion = CHAMPIONS[f.id];
    f.stateTime += dt;
    f.regenDelay = Math.max(0, f.regenDelay - dt);
    f.dodgeCooldown = Math.max(0, f.dodgeCooldown - dt);
    f.specialCooldown = Math.max(0, f.specialCooldown - dt);
    f.runeTime=Math.max(0,f.runeTime-dt);f.wardTime=Math.max(0,f.wardTime-dt);
    f.momentum = Math.max(0, f.momentum - dt * .035);
    f.impactRecovery = Math.max(0, f.impactRecovery - dt);
    if (f.impactRecovery <= 0) f.impactLoad = Math.max(0, f.impactLoad - dt * 1.6);
    const queued = this.buffered[slot];
    if (queued && queued.until < this.time) this.buffered[slot] = null;
    const action = this.buffered[slot]?.action;
    if (f.y > 0 || f.vy > 0) {
      f.vy -= 18 * dt; f.y = Math.max(0, f.y + f.vy * dt);
      if (f.y === 0) { f.vy = 0; this.emit('land', slot); }
    }
    if (f.hp <= 0) { f.state = 'dead'; return; }
    if (f.state === 'grabbed') {
      const holder = f.grabbedBy === null ? null : this.fighters[f.grabbedBy];
      if (!holder || holder.state !== 'grapple') { f.grabbedBy = null; f.state = 'idle'; f.stateTime = 0; }
      else { f.x = holder.x + Math.sin(holder.yaw) * 1.12; f.z = holder.z + Math.cos(holder.yaw) * 1.12; f.yaw = holder.yaw + Math.PI; f.vx = 0; f.vz = 0; this.bound(f); return; }
    }
    if (f.state === 'grapple') {
      f.vx = 0; f.vz = 0;
      if (f.stateTime >= .56 && enemy.grabbedBy === slot) {
        const damage = Math.round((f.id === 'nomet' ? 23 : 16) * NORMAL_DAMAGE_SCALE * levelDamage(slot === 0 ? this.config.playerLevel : this.config.opponentLevel));
        enemy.hp = Math.max(0, enemy.hp - damage); enemy.grabbedBy = null;
        enemy.state = enemy.hp <= 0 ? 'dead' : 'thrown'; enemy.stateTime = 0;
        enemy.vx = Math.sin(f.yaw) * 7; enemy.vz = Math.cos(f.yaw) * 7; enemy.vy = 3.6; enemy.y = .12;
        this.emit('throw', slot, { x: enemy.x, z: enemy.z, damage });
        if (enemy.hp <= 0) this.emit('death', slot === 0 ? 1 : 0);
      }
      if (f.stateTime >= .80) { f.state = 'idle'; f.stateTime = 0; }
      return;
    }
    if (f.state === 'thrown' || f.state === 'knockdown' || f.state === 'getup') {
      f.x += f.vx * dt; f.z += f.vz * dt;
      f.vx *= Math.exp(-5 * dt); f.vz *= Math.exp(-5 * dt);
      if (f.state === 'thrown' && f.y === 0 && f.stateTime > .15) { f.state = 'knockdown'; f.stateTime = .30; }
      if (f.state === 'knockdown' && f.stateTime >= .95) { f.state = 'getup'; f.stateTime = 0; }
      if (f.state === 'getup' && f.stateTime >= 1.15) { f.state = 'idle'; f.stateTime = 0; }
      this.bound(f); return;
    }
    if (f.state === 'stagger') {
      f.vx *= Math.exp(-8 * dt); f.vz *= Math.exp(-8 * dt);
      f.x += f.vx * dt; f.z += f.vz * dt;
      if (f.stateTime >= f.stunDuration) { f.state = 'idle'; f.stateTime = 0; }
      this.bound(f); return;
    }
    if (f.state === 'dodge') {
      const speed = 11.8 * (1 - .70 * clamp(f.stateTime / DODGE_DURATION, 0, 1));
      f.vx = f.dodgeX * speed; f.vz = f.dodgeZ * speed;
      f.x += f.vx * dt; f.z += f.vz * dt;
      if (f.stateTime >= DODGE_DURATION) { f.state = 'idle'; f.stateTime = 0; f.vx *= .12; f.vz *= .12; }
      this.bound(f); return;
    }
    if (f.attack) {
      const move = champion.moves[f.attack.id];
      f.attack.elapsed += dt;
      if(move.strikes && f.attack.elapsed>=move.startup){
        const strike=Math.min(move.strikes-1,Math.floor((f.attack.elapsed-move.startup)/move.active*move.strikes));
        if(strike!==(f.attack.strike??0)){f.attack.strike=strike;f.attack.connected=false;}
      }
      if (!f.attack.released && f.attack.elapsed >= move.startup) {
        f.attack.released = true;
        if(f.id==='mawren'&&f.attack.id==='special'){
          f.runeTime=8;f.runeX=f.attack.aimX;f.runeZ=f.attack.aimZ;f.wardTime=1.4;
        }else if(f.id==='mawren'&&(f.attack.id==='heavy'||f.attack.id==='ultimate')&&f.runeTime>0){
          if(Math.hypot(enemy.x-f.runeX,enemy.z-f.runeZ)<1.8)f.attack.power*=1.65;
          this.emit('spell',slot,{x:f.runeX,z:f.runeZ,move:f.attack.id});f.runeTime=0;
        }
        this.emit('release', slot, { move: f.attack.id, ...(f.id === 'nomet' && f.attack.id === 'special' ? { x: f.attack.aimX, z: f.attack.aimZ } : {}) });
      }
      if (f.attack.elapsed < move.startup && input.lockOn) {
        const yaw = Math.atan2(enemy.x - f.x, enemy.z - f.z), turn = angleDelta(f.yaw, yaw);
        if (Math.abs(turn) < .8) f.yaw += turn * (1 - Math.exp(-22 * dt));
      }
      const recoveryAt = move.startup + move.active;
      if (action === 'dodge' && f.attack.elapsed > recoveryAt + move.recovery * (f.attack.connected ? .12 : .45) && f.stamina >= 19 && f.dodgeCooldown <= 0 && f.y === 0) {
        f.attack = null; this.buffered[slot] = null; this.startDodge(slot, input); return;
      }
      if (f.attack.id === 'light' && f.attack.connected && (action === 'light' || action === 'heavy') && f.attack.elapsed >= recoveryAt + move.recovery * .25) {
        if (this.startAttack(slot, action)) { this.bound(f); return; }
      }
      if (input.guard && f.attack.elapsed >= recoveryAt + move.recovery * .35) {
        f.attack = null; f.state = 'guard'; f.guardTime = 0; f.stateTime = 0; f.vx = 0; f.vz = 0; return;
      }
      f.vx = Math.sin(f.yaw) * move.lunge;
      f.vz = Math.cos(f.yaw) * move.lunge;
      if (f.attack.elapsed > move.startup * .65 && f.attack.elapsed < move.startup + move.active) {
        f.x += f.vx * dt; f.z += f.vz * dt;
      }
      if (f.attack.elapsed >= moveDuration(move)) {
        f.attack = null; f.state = 'idle'; f.stateTime = 0; f.vx = 0; f.vz = 0;
        if (action && ['light','heavy','special','ultimate'].includes(action)) this.startAttack(slot, action as MoveId);
      }
      this.bound(f); return;
    }
    if (f.regenDelay <= 0 && !input.guard && !input.sprint) f.stamina = Math.min(champion.stamina, f.stamina + champion.regen * dt);
    const tx = enemy.x - f.x, tz = enemy.z - f.z;
    const moving = Math.hypot(input.x, input.z) > .1;
    const targetYaw = !input.lockOn && moving ? Math.atan2(input.x, input.z) : Math.atan2(tx, tz);
    f.yaw += angleDelta(f.yaw, targetYaw) * (1 - Math.exp(-26 * dt));
    if (action === 'dodge' && f.stamina >= 19 && f.dodgeCooldown <= 0 && f.y === 0) {
      this.buffered[slot] = null;
      this.startDodge(slot, input); return;
    }
    if (action === 'jump' && f.y === 0 && f.stamina >= 14 && !input.guard) {
      this.buffered[slot] = null;
      f.vy = 6.4; f.y = .001; f.stamina -= 14; f.regenDelay = .65; f.stateTime = 0; this.emit('jump', slot);
    }
    if (action === 'grapple' && f.stamina >= 22 && f.y === 0 && Math.hypot(tx, tz) < 1.72 && Math.abs(angleDelta(f.yaw, Math.atan2(tx, tz))) < .9 && enemy.y < .2 && !['dodge','grabbed','grapple','knockdown','getup','dead'].includes(enemy.state)) {
      this.buffered[slot] = null;
      f.stamina -= 22; f.regenDelay = 1; f.state = 'grapple'; f.stateTime = 0; f.vx = 0; f.vz = 0;
      enemy.attack = null; this.buffered[slot === 0 ? 1 : 0] = null; enemy.state = 'grabbed'; enemy.stateTime = 0; enemy.grabbedBy = slot; enemy.vx = 0; enemy.vz = 0;
      this.emit('grab', slot); return;
    }
    if (action && ['light','heavy','special','ultimate'].includes(action) && this.startAttack(slot, action as MoveId)) return;
    if (input.guard && f.stamina > 3) {
      if (f.state !== 'guard') { f.guardTime = 0; f.stateTime = 0; }
      f.guardTime += dt; f.state = 'guard'; f.stamina = Math.max(0, f.stamina - 4 * dt);
    } else { f.guardTime = 0; f.state = 'idle'; }
    const magnitude = Math.hypot(input.x, input.z), normalized = Math.max(1, magnitude);
    let speed = champion.speed;
    if (input.sprint && f.stamina > 2 && !input.guard && magnitude > .1) {
      speed *= 1.5; f.stamina = Math.max(0, f.stamina - 18 * dt); f.regenDelay = .35; f.state = 'sprint';
    } else if (input.guard) speed *= .38;
    else if (magnitude > .1) f.state = 'move';
    const blend = (1 - Math.exp(-(magnitude > .1 ? 34 : 44) * dt)) * (f.y > 0 ? .58 : 1);
    f.vx += (input.x / normalized * speed - f.vx) * blend;
    f.vz += (input.z / normalized * speed - f.vz) * blend;
    if (magnitude < .1 && Math.hypot(f.vx, f.vz) < .05) { f.vx = 0; f.vz = 0; }
    if (f.y > 0) f.state = 'jump';
    f.x += f.vx * dt; f.z += f.vz * dt;
    this.bound(f);
  }
  private captureInput(slot: Slot, input: InputFrame): void {
    const action = input.dodge ? 'dodge' : input.ultimate ? 'ultimate' : input.special ? 'special' : input.grapple ? 'grapple' : input.heavy ? 'heavy' : input.light ? 'light' : input.jump ? 'jump' : null;
    if (action) this.buffered[slot] = { action, until: this.time + INPUT_BUFFER_TIME };
  }
  private startDodge(slot: Slot, input: InputFrame): void {
    const f = this.fighters[slot], length = Math.hypot(input.x, input.z);
    f.dodgeX = length > .1 ? input.x / length : -Math.sin(f.yaw);
    f.dodgeZ = length > .1 ? input.z / length : -Math.cos(f.yaw);
    f.vx = f.dodgeX * 11.8; f.vz = f.dodgeZ * 11.8; f.stamina -= 19; f.regenDelay = .48; f.dodgeCooldown = .46;
    f.state = 'dodge'; f.stateTime = 0; this.emit('dodge', slot);
  }
  private startAttack(slot: Slot, id: MoveId): boolean {
    const f = this.fighters[slot], move = CHAMPIONS[f.id].moves[id];
    if (f.stamina < move.stamina || (id === 'special' && f.specialCooldown > 0) || (id === 'ultimate' && f.charge < 1)) return false;
    if (id === 'special') f.specialCooldown = CHAMPIONS[f.id].cooldown * .8;
    if (id === 'ultimate') f.charge = 0;
    if (id === 'light') f.combo = this.time < f.comboUntil ? (f.combo + 1) % 3 : 0;
    else f.combo = 0;
    f.comboUntil = this.time + 1.1;
    const enemy = this.fighters[slot === 0 ? 1 : 0], distance = clamp(Math.hypot(enemy.x - f.x, enemy.z - f.z), 1.8, move.range || 1.8);
    f.attack = { id, elapsed: 0, combo: f.combo, connected: false, startedAt: this.time, power: f.id === 'taren' && id === 'special' ? 1 + f.momentum * .35 : 1, released: false, aimX: f.x + Math.sin(f.yaw) * distance, aimZ: f.z + Math.cos(f.yaw) * distance };
    if (f.id === 'taren' && id === 'special') f.momentum = 0;
    this.buffered[slot] = null;
    f.state = 'attack'; f.stateTime = 0; f.stamina -= move.stamina; f.regenDelay = id === 'light' ? .38 : .55;
    this.emit(id === 'ultimate' ? 'ultimate' : id === 'special' ? 'spell' : 'attack', slot, { move: id, ...(f.id === 'nomet' && id === 'special' ? { x: f.attack.aimX, z: f.attack.aimZ } : {}) });
    return true;
  }
  private bound(f: FighterFrame): void {
    const radius = Math.hypot(f.x, f.z);
    if (radius > ARENA_RADIUS) { f.x *= ARENA_RADIUS / radius; f.z *= ARENA_RADIUS / radius; }
  }
  private separate(): void {
    const [a, b] = this.fighters, dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 1.15 && d > .0001) {
      const push = (1.15 - d) * .5;
      a.x -= dx / d * push; a.z -= dz / d * push; b.x += dx / d * push; b.z += dz / d * push;
      this.bound(a); this.bound(b);
    }
  }
  private resolveAttack(slot: Slot): void {
    const attacker = this.fighters[slot], other: Slot = slot === 0 ? 1 : 0, target = this.fighters[other];
    const attack = attacker.attack;
    if (!attack || attack.connected || target.hp <= 0) return;
    const move = CHAMPIONS[attacker.id].moves[attack.id];
    if(move.damage<=0)return;
    if (attack.elapsed < move.startup || attack.elapsed > move.startup + move.active) return;
    const dx = target.x - attacker.x, dz = target.z - attacker.z, distance = Math.hypot(dx, dz);
    const angle = Math.abs(angleDelta(attacker.yaw, Math.atan2(dx, dz)));
    const groundSlam = attacker.id === 'nomet' && attack.id === 'special';
    const shieldWave = attacker.id === 'taren' && attack.id === 'special';
    if (distance > move.range || (!groundSlam && angle > move.arc)) return;
    if (Math.abs(target.y - attacker.y) > (groundSlam ? 1.2 : .9)) return;
    if (target.state === 'getup' || target.state === 'knockdown') return;
    if (target.state === 'dodge' && target.stateTime > .025 && target.stateTime < .265) return;
    attack.connected = true;
    const guardFacing = Math.abs(angleDelta(target.yaw, Math.atan2(-dx, -dz))) < 1.25;
    if ((target.state === 'guard'||target.wardTime>0) && guardFacing && attack.id !== 'ultimate') {
      if (target.state==='guard'&&target.guardTime <= .19 && !move.breakGuard) {
        attacker.attack = null; attacker.state = 'stagger'; attacker.stateTime = 0; attacker.stunDuration = .36; attacker.vx = -dx / Math.max(distance, .1) * 2; attacker.vz = -dz / Math.max(distance, .1) * 2;
        target.charge = clamp(target.charge + .22, 0, 1); target.stamina = Math.min(CHAMPIONS[target.id].stamina, target.stamina + 8);
        if (target.id === 'taren') target.momentum = clamp(target.momentum + .5, 0, 1);
        this.emit('parry', other); this.freeze = .045; return;
      }
      const cost = move.damage * (move.breakGuard ? 1.9 : 1.25) * (target.id === 'taren' ? .75 : 1);
      target.stamina = Math.max(0, target.stamina - cost); target.regenDelay = 1;
      if (target.stamina > 0) {
        target.hp = Math.max(0, target.hp - move.damage * NORMAL_DAMAGE_SCALE * .07);
        if (target.id === 'taren') target.momentum = clamp(target.momentum + .18, 0, 1);
        this.emit('guard', other, { target: other, power: attack.id === 'light' ? .35 : .7 });
        if (target.hp <= 0) { target.state = 'dead'; target.stateTime = 0; target.attack = null; this.emit('death', other); }
        this.freeze = .035; return;
      }
      this.emit('break', other);
    }
    const damage = Math.round(move.damage / (move.strikes??1) * (attack.id === 'ultimate' ? ULTIMATE_DAMAGE_SCALE : NORMAL_DAMAGE_SCALE) * attack.power * levelDamage(slot === 0 ? this.config.playerLevel : this.config.opponentLevel) * (1 - CHAMPIONS[target.id].armor) * (attack.id === 'light' ? 1 + attack.combo * .12 : 1));
    target.hp = Math.max(0, target.hp - damage);
    target.attack = null; this.buffered[other] = null;
    const power = move.strikes ? (attack.strike??0)===move.strikes-1?1.4:.55 : attack.id === 'light' ? 1 : attack.id === 'ultimate' ? 2.5 : 1.8;
    target.impactLoad += power; target.impactRecovery = 1.45;
    const knockedDown = shieldWave || groundSlam || attack.id === 'ultimate' || target.impactLoad >= KNOCKDOWN_IMPACT;
    target.state = target.hp <= 0 ? 'dead' : knockedDown ? 'knockdown' : 'stagger'; target.stateTime = 0;
    if (knockedDown) target.impactLoad = 0;
    target.stunDuration = attack.id === 'light' ? .52 : .72;
    const impulse = move.strikes ? (attack.strike??0)===move.strikes-1?4.7:1.4 : shieldWave ? 13 : Math.min(8.5,Math.max(attack.id === 'light' ? 2.6 : 4.7,move.knockback*6));
    target.vx = dx / Math.max(distance, .1) * impulse;
    target.vz = dz / Math.max(distance, .1) * impulse;
    if(attacker.id==='veyra'&&attack.id==='special'&&target.hp>0){
      target.vx=-dx/Math.max(distance,.1)*12;target.vz=-dz/Math.max(distance,.1)*12;
    }
    target.charge = clamp(target.charge + .075, 0, 1);
    attacker.charge = clamp(attacker.charge + (attack.id === 'light' ? .13 : .19), 0, 1);
    this.emit('hit', slot, { x: target.x, z: target.z, damage, move: attack.id, target: other, power, knockdown: knockedDown });
    this.freeze = attack.id === 'light' ? .04 : .075;
    if (target.hp <= 0) this.emit('death', other);
  }
  private endRound(): void {
    const [a, b] = this.fighters;
    // Only a defeat wins a round. Running out the clock is a tie even when health differs.
    this.winner = (a.hp <= 0) === (b.hp <= 0) ? null : a.hp > 0 ? 0 : 1;
    if (this.winner !== null) this.wins[this.winner]++;
    this.phase = 'roundEnd'; this.phaseTime = 0;
  }

  private thinkAI(): InputFrame {
    if (this.time < this.aiNext) {
      const result = { ...this.aiPlan };
      result.light = false; result.heavy = false; result.dodge = false; result.special = false; result.ultimate = false; result.jump = false; result.grapple = false;
      return result;
    }
    const tuning = AI_TUNING[this.config.difficulty];
    this.aiNext = this.time + tuning.think + this.random() * .06;
    const observation = this.observations.findLast(o => o.at <= this.time - tuning.delay);
    if (!observation) return emptyInput();
    const enemy = observation.player, self = this.fighters[1], champion = CHAMPIONS[self.id];
    const dx = enemy.x - self.x, dz = enemy.z - self.z, distance = Math.max(.1, Math.hypot(dx, dz));
    const ux = dx / distance, uz = dz / distance, plan = emptyInput();
    const light = champion.moves.light, staminaRatio = self.stamina / champion.stamina;
    const flank = Math.floor(this.time / 4.5) % 2 ? 1 : -1;
    if (staminaRatio < .27) {
      plan.x = -ux * .8 + uz * flank * .3; plan.z = -uz * .8 - ux * flank * .3;
      this.aiIntent = 'Recovering stamina';
    } else if (enemy.attack && distance < CHAMPIONS[enemy.id].moves[enemy.attack.id].range + .45 && enemy.attack.elapsed < CHAMPIONS[enemy.id].moves[enemy.attack.id].startup) {
      if (this.random() < tuning.defense) {
        if (enemy.attack.id === 'heavy' || enemy.attack.id === 'ultimate') {
          plan.x = uz * flank; plan.z = -ux * flank; plan.dodge = true; this.aiIntent = 'Evading the heavy swing';
        } else { plan.guard = true; this.aiIntent = 'Bracing for your strike'; }
      }
    } else if (enemy.attack && enemy.attack.elapsed > CHAMPIONS[enemy.id].moves[enemy.attack.id].startup + CHAMPIONS[enemy.id].moves[enemy.attack.id].active && distance < light.range + .65) {
      plan.x = ux; plan.z = uz; plan.light = this.random() < tuning.pressure; this.aiIntent = 'Punishing your recovery';
    } else if(self.id==='mawren'&&self.runeTime>0&&Math.hypot(enemy.x-self.runeX,enemy.z-self.runeZ)<1.8&&distance<champion.moves.heavy.range){
      plan.heavy=true;this.aiIntent='Detonating the placed rune';
    } else if(self.id==='mawren'&&self.runeTime<=0&&self.specialCooldown<=0&&staminaRatio>.45&&distance>=champion.moves.special.range){
      // Enter rune range before committing to a long-range bolt, so the setup can be used.
      plan.x=ux*.84+uz*flank*.28;plan.z=uz*.84-ux*flank*.28;
      this.aiIntent='Closing to inscribe a rune';
    } else if((self.id==='mawren'||self.id==='veyra')&&distance>light.range&&distance<champion.moves.special.range&&staminaRatio>.45&&self.specialCooldown<=0){
      plan.special=true;this.aiIntent=self.id==='veyra'?'Launching the chained dagger':'Inscribing a rune beneath you';
    } else if(self.id==='mawren'&&distance>light.range&&distance<champion.moves.heavy.range&&this.random()<tuning.pressure*.5){
      plan.heavy=true;this.aiIntent='Casting Arcane Bolt';
    } else if (distance > light.range * .89) {
      plan.x = ux * .84 + uz * flank * .28; plan.z = uz * .84 - ux * flank * .28;
      plan.sprint = distance > 6 && staminaRatio > .7;
      this.aiIntent = distance > 5 ? 'Closing the distance' : 'Circling for an opening';
    } else if (distance < light.range * .55 && self.id === 'taren') {
      plan.x = -ux + uz * flank * .2; plan.z = -uz - ux * flank * .2; this.aiIntent = 'Protecting spear range';
    } else {
      plan.x = uz * flank * .26; plan.z = -ux * flank * .26;
      const opening = enemy.state === 'stagger' || enemy.stamina < 20;
      if (self.charge >= 1 && distance < champion.moves.ultimate.range && (opening || this.random() < .22)) { plan.ultimate = true; this.aiIntent = 'Unleashing an ultimate'; }
      else if (self.specialCooldown <= 0 && (this.habit.guard > .4 || this.random() < .18)) { plan.special = true; this.aiIntent = 'Setting up a signature attack'; }
      else if (this.random() < tuning.pressure) {
        plan.heavy = opening || (this.habit.guard > .4 && this.random() < .6) || this.random() < .18;
        plan.light = !plan.heavy; this.aiIntent = plan.heavy ? 'Committing to a heavy strike' : 'Pressuring with quick cuts';
      } else { plan.guard = this.random() < tuning.defense * .45; this.aiIntent = 'Baiting your next move'; }
    }
    this.aiPlan = plan;
    return plan;
  }
}


