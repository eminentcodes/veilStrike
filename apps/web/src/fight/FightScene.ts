import Phaser from 'phaser';

import type { Difficulty, FighterId, MatchResult } from './types';
import { FIGHTER_DEFINITIONS } from './types';
import { fightAudio } from './audio';
import type { VisualFrame, FighterVisual, MovePhase, MatchPhase } from './visualFrame';
import { CombatBridge } from './combatEvents';
import type { Side, ReactionStrength } from './combatEvents';
import type { CombatState } from './combatState';
import { STATE_PERMS } from './combatState';
import type { MoveDef, ReactionType, Moveset } from './moves';
import { moveDuration } from './moves';
import { profileFor, movesetForFighter } from './fighters';
import type { FighterProfile } from './fighters';
import { ARENA_WIDTH, FLOOR_Y, ARENA_LEFT, ARENA_RIGHT } from './arena';

interface SceneOptions {
  player: FighterId;
  opponent: FighterId;
  difficulty: Difficulty;
  bridge: CombatBridge;
  onExit: () => void;
  onComplete: (result: MatchResult) => void;
  onVisualFrame: (frame: VisualFrame) => void;
}

const ROUND_SECONDS = 90;
const ROUNDS_TO_WIN = 2;
// Keep a visible body-to-body lane. Hitboxes are independent, so weapons can
// still reach across this gap without the character meshes colliding.
const MIN_SEPARATION = 220;
const HURT_W = 62;
const HURT_H = 150;
const CROUCH_H = 96;
const BODY_W = 46;

// Bot personalities layered on top of the per-fighter data (spec: upgraded bot AI).
const BOT_TUNING = {
  initiate: { react: 520, aggro: 0.34, block: 0.12, dodge: 0.05, punish: 0.18, whiffBait: 0.04, spacing: 42 },
  warrior: { react: 240, aggro: 0.62, block: 0.38, dodge: 0.24, punish: 0.58, whiffBait: 0.2, spacing: 18 },
  master: { react: 90, aggro: 0.86, block: 0.68, dodge: 0.58, punish: 0.92, whiffBait: 0.5, spacing: 6 },
} as const;

interface Combatant {
  side: Side;
  id: FighterId;
  profile: FighterProfile;
  moves: Moveset;
  body: Phaser.Physics.Arcade.Sprite;
  facing: 1 | -1;
  visualFacing: number; // smoothed toward facing for the view (no hard 180° flip)
  maxHealth: number;
  health: number;
  stamina: number;
  charge: number; // 0..1 ability meter
  state: CombatState;

  // attack bookkeeping
  move: MoveDef | null;
  attackStart: number;
  attackHitDone: boolean;
  comboCount: number;
  lastLightId: string | null; // for chaining light1→2→3
  targetVX: number; // desired horizontal velocity, eased toward by integrate()

  // input buffer (combo / cancel)
  bufferedInput: string | null;
  bufferedAt: number;

  // timers (absolute ms)
  stateUntil: number;
  iframeFrom: number;
  iframeUntil: number;
  parryUntil: number;
  regenAfter: number;
  dashCdUntil: number;
  dodgeCdUntil: number;
  wakeInvulnUntil: number;

  // one-shot reaction latch for the view
  reaction: ReactionType | null;
}

/** A thrown projectile (assassin/shadow knives). Authoritative motion + collision live here in
 *  the sim; the view renders it from the per-frame ProjectileVisual list. */
interface Projectile {
  id: number;
  owner: Side;
  ownerId: FighterId;
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  damage: number;
  reaction: ReactionType;
  bornAt: number;
  life: number; // total lifetime, ms
  dead: boolean;
  kind: string;
}

interface Intent {
  moveDir: -1 | 0 | 1;
  jump: boolean;
  crouch: boolean;
  block: boolean;
  dash: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
  ultimate: boolean;
  time: number;
}

function blankIntent(): Intent {
  return { moveDir: 0, jump: false, crouch: false, block: false, dash: false, light: false, heavy: false, special: false, ultimate: false, time: 0 };
}

export class FightScene extends Phaser.Scene {
  private options: SceneOptions;
  private bridge: CombatBridge;
  private player!: Combatant;
  private bot!: Combatant;
  private keys!: Record<'left' | 'right' | 'jump' | 'crouch' | 'light' | 'heavy' | 'block' | 'dash' | 'special' | 'ultimate' | 'escape', Phaser.Input.Keyboard.Key>;

  private phase: MatchPhase = 'entry';
  private round = 1;
  private playerRounds = 0;
  private botRounds = 0;
  private drawnRounds = 0;
  private roundStartedAt = 0;
  private hitstopUntil = 0;
  private entryStart = 0;
  private entryDuration = 3200;
  private entrySkipped = false;
  private resolving = false;

  // Per-fighter distance walked since the last footfall (drives footstep cadence).
  private readonly stride = new WeakMap<Combatant, number>();
  private nextBotThink = 0;
  private botIntent: Intent = blankIntent();
  private touchIntent: Partial<Intent> = {};
  private finish: MatchResult['finish'] = 'timeout';

  // reused scratch geometry so the per-frame resolver stays allocation-free (spec §30)
  private readonly rectA = new Phaser.Geom.Rectangle();
  private readonly rectB = new Phaser.Geom.Rectangle();

  // Live thrown projectiles (assassin/shadow knives). The sim owns motion + collision; the
  // view mirrors them each frame from publishFrame().
  private projectiles: Projectile[] = [];
  private nextProjectileId = 1;

  constructor(options: SceneOptions) {
    super('fight');
    this.options = options;
    this.bridge = options.bridge;
  }

  create(): void {
    window.addEventListener('veilstrike-touch', this.onTouchInput as EventListener);
    this.physics.world.setBounds(0, 0, ARENA_WIDTH, FLOOR_Y);
    this.player = this.createCombatant('player', this.options.player, ARENA_WIDTH * 0.36);
    this.bot = this.createCombatant('bot', this.options.opponent, ARENA_WIDTH * 0.64);
    // No inter-body arcade collider: spacing is the soft push-apart in separate(), which can
    // relax during active frames so strikes reach (a hard collider can't). World bounds still
    // hold each body on the floor and inside the arena.
    this.bindInput();
    this.beginEntry();
  }

  private onTouchInput = (event: Event): void => {
    const detail = (event as CustomEvent<{ key: keyof Intent; down: boolean; direction?: number }>).detail;
    if (!detail) return;
    if (detail.key === 'moveDir') this.touchIntent.moveDir = detail.down ? (detail.direction ?? 1) as -1 | 1 : 0;
    else if (detail.down) (this.touchIntent as Record<string, unknown>)[detail.key] = true;
  };

  // ─────────────────────────────── setup ───────────────────────────────

  private createCombatant(side: Side, id: FighterId, x: number): Combatant {
    // A tiny invisible physics body — used ONLY for separation/spacing, never for hits.
    const texKey = `body-${side}`;
    if (!this.textures.exists(texKey)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x000000, 0);
      g.fillRect(0, 0, BODY_W + 2, HURT_H);
      g.generateTexture(texKey, BODY_W + 2, HURT_H);
      g.destroy();
    }
    const def = FIGHTER_DEFINITIONS[id];
    const body = this.physics.add.sprite(x, FLOOR_Y - HURT_H / 2, texKey);
    body.setVisible(false);
    body.setCollideWorldBounds(true);
    body.setMaxVelocity(def.speed * 3.2, 1400);
    body.setDragX(0); // integrate() applies our own accel/friction toward targetVX
    body.setBounce(0);
    body.body!.setSize(BODY_W, HURT_H).setOffset(1, 0);

    const profile = profileFor(id);
    return {
      side, id, profile, moves: movesetForFighter(id), body,
      facing: side === 'player' ? 1 : -1,
      visualFacing: side === 'player' ? 1 : -1,
      maxHealth: Math.round(def.health * 1.45), health: Math.round(def.health * 1.45),
      stamina: profile.stamina.max, charge: 0,
      state: 'entry',
      move: null, attackStart: 0, attackHitDone: false, comboCount: 0, lastLightId: null, targetVX: 0,
      bufferedInput: null, bufferedAt: 0,
      stateUntil: 0, iframeFrom: 0, iframeUntil: 0, parryUntil: 0, regenAfter: 0,
      dashCdUntil: 0, dodgeCdUntil: 0, wakeInvulnUntil: 0,
      reaction: null,
    };
  }

  private bindInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable');
    this.keys = keyboard.addKeys({
      left: 'A', right: 'D', jump: 'W', crouch: 'S', light: 'J', heavy: 'K',
      block: 'L', dash: 'SHIFT', special: 'U', ultimate: 'I', escape: 'ESC',
    }) as typeof this.keys;
    this.keys.escape.on('down', this.options.onExit);
    keyboard.on('keydown', () => { if (this.phase === 'entry') this.skipEntry(); });
  }

  // ─────────────────────────────── entry cinematic (P7) ───────────────────────────────

  private beginEntry(): void {
    this.phase = 'entry';
    this.entrySkipped = false;
    this.round = 1;
    this.playerRounds = 0;
    this.botRounds = 0;
    this.drawnRounds = 0;
    this.projectiles.length = 0;
    const pMark = ARENA_WIDTH * 0.4;
    const bMark = ARENA_WIDTH * 0.6;
    this.resetCombatant(this.player, pMark - this.player.profile.entry.startOffset);
    this.resetCombatant(this.bot, bMark + this.bot.profile.entry.startOffset);
    this.player.state = 'entry';
    this.bot.state = 'entry';
    this.entryStart = this.time.now;
    this.entryDuration = 3200;
    this.bridge.events.emit('entryStart', { player: this.player.id, bot: this.bot.id });
    this.bridge.hud.phase = 'entry';
    this.bridge.hud.canSkipIntro = true;
    this.bridge.hud.banner = '';
    fightAudio.entry();
  }

  private skipEntry(): void {
    if (this.phase !== 'entry' || this.entrySkipped) return;
    this.entrySkipped = true;
    this.entryDuration = Math.min(this.entryDuration, this.time.now - this.entryStart + 260);
  }

  private updateEntry(time: number, dt: number): void {
    const t = Phaser.Math.Clamp((time - this.entryStart) / this.entryDuration, 0, 1);
    const pMark = ARENA_WIDTH * 0.4;
    const bMark = ARENA_WIDTH * 0.6;
    const walk = Phaser.Math.Easing.Sine.InOut(Phaser.Math.Clamp(t / 0.7, 0, 1));
    this.player.body.x = Phaser.Math.Linear(pMark - this.player.profile.entry.startOffset, pMark, walk);
    this.bot.body.x = Phaser.Math.Linear(bMark + this.bot.profile.entry.startOffset, bMark, walk);
    this.player.body.setVelocity(0, 0);
    this.bot.body.setVelocity(0, 0);
    this.player.state = t < 0.7 ? 'move' : 'combat_idle';
    this.bot.state = this.player.state;
    this.player.facing = 1;
    this.bot.facing = -1;
    this.smoothFacing(this.player, dt);
    this.smoothFacing(this.bot, dt);
    this.bridge.hud.banner = t < 0.72 ? '' : 'FIGHT';

    this.publishFrame(time, dt, t);

    if (t >= 1) {
      this.bridge.events.emit('entryDone', undefined);
      this.bridge.hud.canSkipIntro = false;
      this.startRound(true);
    }
  }

  // ─────────────────────────────── round flow ───────────────────────────────

  private startRound(afterEntry: boolean): void {
    this.resolving = false;
    this.finish = 'timeout';
    this.projectiles.length = 0;
    this.resetCombatant(this.player, ARENA_WIDTH * 0.4);
    this.resetCombatant(this.bot, ARENA_WIDTH * 0.6);
    this.phase = 'roundEnd'; // frozen behind the banner until showFight flips to 'fight'
    this.bridge.hud.phase = 'fight';
    this.bridge.hud.round = this.round;
    this.bridge.hud.playerRounds = this.playerRounds;
    this.bridge.hud.botRounds = this.botRounds;

    const showFight = () => {
      this.bridge.hud.banner = 'FIGHT';
      fightAudio.fight();
      this.bridge.events.emit('roundStart', { round: this.round });
      this.roundStartedAt = this.time.now;
      this.phase = 'fight';
      this.time.delayedCall(520, () => { if (this.phase === 'fight') this.bridge.hud.banner = ''; });
    };

    if (afterEntry) {
      this.bridge.hud.banner = 'FIGHT';
      this.time.delayedCall(260, showFight);
    } else {
      fightAudio.round();
    this.bridge.hud.banner = `ROUND ${this.round} OF 3`;
      this.time.delayedCall(900, showFight);
    }
  }

  private resetCombatant(c: Combatant, x: number): void {
    c.health = c.maxHealth;
    c.stamina = c.profile.stamina.max;
    c.state = 'combat_idle';
    c.move = null;
    c.comboCount = 0;
    c.lastLightId = null;
    c.reaction = null;
    c.targetVX = 0;
    c.bufferedInput = null;
    c.body.enableBody(true, x, FLOOR_Y - HURT_H / 2, true, false);
    c.body.setVelocity(0, 0);
    c.facing = x < ARENA_WIDTH / 2 ? 1 : -1;
    c.visualFacing = c.facing;
  }

  // ─────────────────────────────── main loop ───────────────────────────────

  override update(time: number, delta: number): void {
    const dt = Math.min(delta, 40);

    if (this.phase === 'entry') { this.updateEntry(time, dt); return; }

    const frozen = time < this.hitstopUntil;

    this.updateFacing();
    this.smoothFacing(this.player, dt);
    this.smoothFacing(this.bot, dt);

    if (this.phase === 'fight' && !frozen) {
      this.think(this.bot, time);
      this.driveIntent(this.player, time, this.readPlayerIntent(time));
      this.driveIntent(this.bot, time, this.botIntent);
      this.integrate(this.player, dt);
      this.integrate(this.bot, dt);
      this.footsteps(this.player, dt);
      this.footsteps(this.bot, dt);
      this.separate();
      this.resolveCombat(this.player, this.bot, time);
      this.resolveCombat(this.bot, this.player, time);
      this.advanceState(this.player, time);
      this.advanceState(this.bot, time);
      this.regen(this.player, time, dt);
      this.regen(this.bot, time, dt);
      this.clampArena(this.player);
      this.clampArena(this.bot);
      // Final hard spacing pass after movement, attack momentum, and knockback.
      // This prevents either body from crossing the other during the same frame.
      this.separate(true);
      this.clampArena(this.player);
      this.clampArena(this.bot);
      this.updateProjectiles(time, dt);
      this.updateTimer(time);
    } else if (frozen) {
      this.player.body.setVelocity(0, 0);
      this.bot.body.setVelocity(0, 0);
    }

    this.updateHud();
    this.publishFrame(time, dt, 1);
  }

  // ─────────────────────────────── intent (player + bot) ───────────────────────────────

  private readPlayerIntent(time: number): Intent {
    const k = this.keys;
    const keyboardDir = Number(k.right.isDown) - Number(k.left.isDown);
    const dir = (keyboardDir || this.touchIntent.moveDir || 0) as -1 | 0 | 1;
    const touch = this.touchIntent;
    const consume = (key: keyof Intent) => { const value = Boolean(touch[key]); delete touch[key]; return value; };
    return {
      moveDir: dir,
      jump: Phaser.Input.Keyboard.JustDown(k.jump) || consume('jump'),
      crouch: k.crouch.isDown,
      block: k.block.isDown || Boolean(touch.block),
      dash: Phaser.Input.Keyboard.JustDown(k.dash),
      light: Phaser.Input.Keyboard.JustDown(k.light) || consume('light'),
      heavy: Phaser.Input.Keyboard.JustDown(k.heavy) || consume('heavy'),
      special: Phaser.Input.Keyboard.JustDown(k.special) || consume('special'),
      ultimate: Phaser.Input.Keyboard.JustDown(k.ultimate),
      time,
    };
  }

  private think(bot: Combatant, time: number): void {
    this.botIntent = blankIntent();
    this.botIntent.time = time;
    const opp = this.player;
    const t = BOT_TUNING[this.options.difficulty];
    const dist = Math.abs(bot.body.x - opp.body.x);
    // Decision range includes the weapon extension used by hit detection.
    const range = this.reachOf(bot.moves.light1!) + 92;

    // Keep a smooth spacing lean every frame (not twitchy).
    const preferred = Math.max(MIN_SEPARATION + 18, range - t.spacing);
    if (this.actionable(bot)) {
      if (dist > preferred + 16) this.botIntent.moveDir = Math.sign(opp.body.x - bot.body.x) as -1 | 0 | 1;
      else if (dist < MIN_SEPARATION + 24) {
        // Give ground attacks room to animate instead of walking into the player.
        this.botIntent.moveDir = Math.sign(bot.body.x - opp.body.x) as -1 | 0 | 1;
      }
    }

    if (time < this.nextBotThink) return;
    this.nextBotThink = time + t.react;
    if (!this.actionable(bot)) return;

    // React to an incoming attack: dodge or block.
    if (opp.state === 'attack' && dist < this.reachOf(opp.move ?? opp.moves.light1!) + 40) {
      const r = Math.random();
      if (r < t.dodge && time > bot.dodgeCdUntil) { this.botIntent.crouch = true; this.botIntent.dash = true; return; }
      if (r < t.dodge + t.block) { this.botIntent.block = true; return; }
    }
    // Punish a whiffing / recovering opponent.
    if ((opp.state === 'hit' || opp.state === 'stagger' || (opp.state === 'attack' && this.phaseOf(opp, time) === 'recovery')) &&
        dist < range + 30 && Math.random() < t.punish) {
      this.botChooseAttack(dist); return;
    }
    // Ultimate when charged and in range.
    if (bot.charge >= 1 && dist < this.reachOf(bot.moves.ultimate!) && Math.random() < t.aggro) { this.botIntent.ultimate = true; return; }
    // Special when charged.
    const special = bot.moves.special;
    if (special && bot.charge >= bot.profile.ability.chargeCost && dist < this.reachOf(special) + 20 && Math.random() < t.aggro * 0.7) {
      this.botIntent.special = true; return;
    }
    // Attack in range.
    if (dist <= range + 34 && Math.random() < t.aggro) { this.botChooseAttack(dist); return; }
    // Occasional whiff-bait backdash.
    if (Math.random() < t.whiffBait && time > bot.dashCdUntil) { this.botIntent.moveDir = (-bot.facing) as -1 | 1; this.botIntent.dash = true; }
  }

  private botChooseAttack(dist: number): void {
    if (dist < 74 && Math.random() < 0.4) { this.botIntent.crouch = true; this.botIntent.heavy = true; return; } // sweep
    if (Math.random() < 0.45) this.botIntent.heavy = true; else this.botIntent.light = true;
  }

  // ─────────────────────────────── intent → action ───────────────────────────────

  private driveIntent(c: Combatant, time: number, intent: Intent): void {
    // Buffer attack presses for a short window so combos/cancels feel responsive.
    if (intent.light) this.buffer(c, 'light', time);
    else if (intent.heavy) this.buffer(c, 'heavy', time);
    else if (intent.special) this.buffer(c, 'special', time);
    else if (intent.ultimate) this.buffer(c, 'ultimate', time);
    else if (intent.dash) this.buffer(c, intent.crouch ? 'dodge' : 'dash', time);

    // Mid-attack: only cancels (via cancel windows) are allowed.
    if (c.state === 'attack' && c.move) { this.tryCancel(c, time); return; }

    // A dash can be canceled into a dash-attack.
    if (c.state === 'dash') {
      if (this.pull(c, 'heavy', time) || this.pull(c, 'light', time)) this.startAttack(c, c.moves.dashAttack ?? c.moves.heavy!, time);
      return;
    }

    // Self-running / locked states run themselves out in advanceState.
    if (this.reeling(c) || c.state === 'knockdown' || c.state === 'wakeup' || c.state === 'special' ||
        c.state === 'finisher' || c.state === 'dodge' || c.state === 'victory' || c.state === 'defeat') {
      return;
    }

    if (!STATE_PERMS[c.state].canAct) return;

    const grounded = this.grounded(c);

    // Ultimate / special.
    if (this.pull(c, 'ultimate', time) && c.charge >= 1) { this.startUltimate(c, time); return; }
    if (this.pull(c, 'special', time)) { const sp = c.moves.special; if (sp && c.charge >= c.profile.ability.chargeCost) { this.startSpecial(c, time); return; } }

    // Dodge (crouch+dash, i-frames) or dash burst.
    if (grounded && this.pull(c, 'dodge', time) && time > c.dodgeCdUntil) { this.startDodge(c, intent, time); return; }
    if (grounded && this.pull(c, 'dash', time) && time > c.dashCdUntil) { this.startDash(c, intent, time); return; }

    // Attacks.
    if (this.pull(c, 'light', time)) { this.startAttack(c, this.pickLight(c, intent, grounded), time); return; }
    if (this.pull(c, 'heavy', time)) { this.startAttack(c, this.pickHeavy(c, intent, grounded), time); return; }

    // Block (hold). Parry window opens only on the fresh guard frame, never on hold.
    if (grounded && intent.block) {
      if (c.state !== 'block') { c.state = 'block'; c.stateUntil = 0; c.parryUntil = time + 130; }
      c.targetVX = 0;
      return;
    }

    // Jump.
    if (grounded && intent.jump) {
      c.body.setVelocityY(c.profile.movement.jumpVelocity);
      c.state = 'jump';
      c.stateUntil = 0;
      c.targetVX = intent.moveDir * c.profile.movement.walk * c.profile.movement.airControl;
      fightAudio.jump();
      return;
    }

    // Crouch (grounded, no direction).
    if (grounded && intent.crouch && intent.moveDir === 0) { if (c.state !== 'crouch') { c.state = 'crouch'; c.stateUntil = 0; } c.targetVX = 0; return; }

    // Movement: set a TARGET velocity; integrate() eases toward it (responsive accel/brake).
    const mv = c.profile.movement;
    if (intent.moveDir !== 0) {
      const toward = Math.sign((c === this.player ? this.bot.body.x : this.player.body.x) - c.body.x);
      const advancing = intent.moveDir === toward;
      const speed = grounded ? (advancing ? mv.advance : mv.retreat) : mv.walk * mv.airControl;
      c.targetVX = intent.moveDir * speed;
      if (grounded && c.state !== 'move') { c.state = 'move'; c.stateUntil = 0; }
    } else {
      c.targetVX = 0;
      if (grounded && (c.state === 'move' || c.state === 'block' || c.state === 'crouch' || c.state === 'idle')) { c.state = 'combat_idle'; c.stateUntil = 0; }
    }
    if (!grounded) c.state = 'jump';
  }

  private buffer(c: Combatant, input: string, time: number): void { c.bufferedInput = input; c.bufferedAt = time; }
  private pull(c: Combatant, input: string, time: number): boolean {
    if (c.bufferedInput === input && time - c.bufferedAt <= 150) { c.bufferedInput = null; return true; }
    return false;
  }

  private tryCancel(c: Combatant, time: number): void {
    const move = c.move;
    if (!move || !c.bufferedInput) return;
    const elapsed = time - c.attackStart;
    const [from, to] = move.cancelWindow;
    if (elapsed < from || elapsed > to) return;
    const want = c.bufferedInput;
    if (want === 'dodge' && move.cancelInto.includes('dodge') && time > c.dodgeCdUntil) { c.bufferedInput = null; this.startDodge(c, blankIntent(), time); return; }
    if (want === 'special' && move.cancelInto.includes('special')) { const sp = c.moves.special; if (sp && c.charge >= c.profile.ability.chargeCost) { c.bufferedInput = null; this.startSpecial(c, time); } return; }
    if (want === 'light') { const next = this.nextChain(c); if (next && move.cancelInto.includes(next.id)) { c.bufferedInput = null; this.startAttack(c, next, time); } return; }
    if (want === 'heavy' && move.cancelInto.includes('heavy')) { c.bufferedInput = null; this.startAttack(c, c.moves.heavy!, time); }
  }

  private nextChain(c: Combatant): MoveDef | null {
    const order = ['light1', 'light2', 'light3'];
    const idx = c.lastLightId ? order.indexOf(c.lastLightId) : -1;
    const nextId = order[idx + 1];
    return nextId ? (c.moves[nextId] ?? null) : null;
  }

  private pickLight(c: Combatant, intent: Intent, grounded: boolean): MoveDef {
    if (!grounded) return c.moves.aerial ?? c.moves.light1!;
    if (intent.crouch) return c.moves.sweep ?? c.moves.light1!;
    const chained = this.nextChain(c);
    if (chained && c.lastLightId) return chained;
    return c.moves.light1!;
  }

  private pickHeavy(c: Combatant, intent: Intent, grounded: boolean): MoveDef {
    if (!grounded) return c.moves.aerial ?? c.moves.heavy!;
    if (intent.crouch) return c.moves.sweep ?? c.moves.heavy!;
    if (intent.jump) return c.moves.launcher ?? c.moves.heavy!;
    return c.moves.heavy!;
  }

  // ─────────────────────────────── movement integration (P1) ───────────────────────────────

  private integrate(c: Combatant, dt: number): void {
    const mv = c.profile.movement;
    const dtSec = dt / 1000;
    const vx = c.body.body!.velocity.x;

    // Dash / dodge: the burst velocity set at start persists for the state's duration.
    if (c.state === 'dash' || c.state === 'dodge') return;

    // Reeling / knocked down: let the knockback slide and decay (no self-control).
    if (this.reeling(c) || c.state === 'knockdown') {
      const decay = 1800 * dtSec;
      c.body.setVelocityX(vx + Phaser.Math.Clamp(-vx, -decay, decay));
      return;
    }

    if (!STATE_PERMS[c.state].canMove) {
      // attack/special taper their lunge; other locked states brake at full friction.
      const rate = (c.state === 'attack' || c.state === 'special' || c.state === 'finisher') ? 2600 : mv.friction;
      const decay = rate * dtSec;
      c.body.setVelocityX(vx + Phaser.Math.Clamp(-vx, -decay, decay));
      return;
    }

    // Free movement: accelerate toward the target by at most accel·dt (friction when stopping).
    const maxDelta = (c.targetVX !== 0 ? mv.accel : mv.friction) * dtSec;
    c.body.setVelocityX(vx + Phaser.Math.Clamp(c.targetVX - vx, -maxDelta, maxDelta));
  }

  /**
   * Cadenced footfalls while a fighter walks on the ground. Distance-based, so
   * the rhythm tracks real speed and there is silence when standing still,
   * blocking, attacking, or airborne (those states are not 'move').
   */
  private footsteps(c: Combatant, dt: number): void {
    if (c.state !== 'move' || !this.grounded(c)) { this.stride.delete(c); return; }
    const vx = c.body.body!.velocity.x;
    const speed = Math.abs(vx);
    if (speed < 24) return; // barely moving — no step
    const STRIDE = 60; // px between footfalls
    const advancing = Math.sign(vx) === c.facing;
    let acc = (this.stride.get(c) ?? STRIDE) + speed * (dt / 1000);
    if (acc >= STRIDE) {
      acc -= STRIDE;
      fightAudio.footstep(advancing ? 1 : 0.82);
    }
    this.stride.set(c, acc);
  }

  private startDash(c: Combatant, intent: Intent, time: number): void {
    const mv = c.profile.movement;
    const dir = (intent.moveDir || c.facing) as -1 | 1;
    const back = dir !== c.facing;
    c.body.setVelocityX(dir * (back ? mv.backdashSpeed : mv.dashSpeed));
    c.state = 'dash';
    c.stateUntil = time + mv.dashTime;
    c.dashCdUntil = time + mv.dashCooldown;
    fightAudio.dash();
    this.bridge.events.emit('dodge', { side: c.side, x: c.body.x, y: c.body.y, facing: c.facing });
  }

  private startDodge(c: Combatant, intent: Intent, time: number): void {
    const mv = c.profile.movement;
    const dir = (intent.moveDir || -c.facing) as -1 | 1;
    c.body.setVelocityX(dir * mv.dodgeSpeed);
    c.state = 'dodge';
    c.stateUntil = time + mv.dodgeTime;
    c.iframeFrom = time + mv.dodgeIFrames[0];
    c.iframeUntil = time + mv.dodgeIFrames[1];
    c.dodgeCdUntil = time + mv.dodgeCooldown;
    fightAudio.dodge();
    this.bridge.events.emit('dodge', { side: c.side, x: c.body.x, y: c.body.y, facing: c.facing });
  }

  // ─────────────────────────────── attacks / abilities ───────────────────────────────

  private startAttack(c: Combatant, move: MoveDef, time: number): void {
    if (c.stamina < move.stamina * 0.5) fightAudio.exhausted();
    c.move = move;
    c.state = 'attack';
    c.attackStart = time;
    c.attackHitDone = false;
    c.stateUntil = time + moveDuration(move);
    if (move.id === 'light1' || move.id === 'light2' || move.id === 'light3') c.lastLightId = move.id;
    else c.lastLightId = null;
    c.stamina = Math.max(0, c.stamina - move.stamina);
    c.regenAfter = time + c.profile.stamina.regenDelay;
    c.body.setVelocityX(c.facing * move.momentum); // attack momentum (spec §10)
    fightAudio.swing(move.kind === 'heavy' || move.kind === 'special' || move.kind === 'ultimate', move.kind);
    this.bridge.events.emit('attackStarted', { side: c.side, moveId: move.id, heavy: move.kind === 'heavy' });
  }

  private startSpecial(c: Combatant, time: number): void {
    const sp = c.moves.special!;
    c.charge = Math.max(0, c.charge - c.profile.ability.chargeCost);
    c.move = sp;
    c.state = 'special';
    c.attackStart = time;
    c.attackHitDone = false;
    c.stateUntil = time + moveDuration(sp);
    c.lastLightId = null;
    c.body.setVelocityX(c.facing * sp.momentum);
    fightAudio.ability(c.id);
    this.bridge.events.emit('special', { side: c.side, ability: c.profile.ability.name });
    this.bridge.events.emit('cameraImpact', { magnitude: 0.35, zoom: 0.06 });
    // Assassin / shadow specials hurl a fan of real thrown knives (ranged threat), on top of
    // the melee strike — the "assassin can throw knives" identity. Bots inherit this via think().
    if (c.id === 'kael' || c.id === 'shade') this.throwKnives(c, time);
  }

  private startUltimate(c: Combatant, time: number): void {
    const ult = c.moves.ultimate!;
    c.charge = 0;
    c.move = ult;
    c.state = 'special';
    c.attackStart = time;
    c.attackHitDone = false;
    c.stateUntil = time + moveDuration(ult);
    c.lastLightId = null;
    c.body.setVelocityX(c.facing * ult.momentum);
    fightAudio.ultimate(c.id);
    this.bridge.events.emit('ultimate', { side: c.side });
    this.bridge.events.emit('cameraImpact', { magnitude: 0.6, zoom: 0.14 });
    this.hitstopUntil = Math.max(this.hitstopUntil, time + 90); // dramatic beat on cast
  }

  // ─────────────────────────────── projectiles (thrown knives) ───────────────────────────────

  /** Hurl a vertical fan of knives in front of the caster. Real projectiles: they travel,
   *  collide with the opponent's hurtbox, and deal ranged damage (blockable). */
  private throwKnives(c: Combatant, time: number, count = 3): void {
    const power = FIGHTER_DEFINITIONS[c.id].power;
    const baseY = c.body.y - HURT_H * 0.06; // roughly chest height
    for (let i = 0; i < count; i++) {
      const spread = i - (count - 1) / 2; // -1, 0, +1 for a 3-knife fan
      this.projectiles.push({
        id: this.nextProjectileId++,
        owner: c.side,
        ownerId: c.id,
        x: c.body.x + c.facing * 44,
        y: baseY + spread * 20,
        vx: c.facing * (900 + Math.abs(spread) * 60),
        facing: c.facing,
        damage: Math.max(4, Math.round(7 * power)),
        reaction: 'light',
        bornAt: time,
        life: 760,
        dead: false,
        kind: 'knife',
      });
    }
  }

  private updateProjectiles(time: number, dt: number): void {
    if (this.projectiles.length === 0) return;
    const step = dt / 1000;
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.x += p.vx * step;
      // Retire on lifetime end or when it leaves the arena.
      if (time - p.bornAt >= p.life || p.x < ARENA_LEFT - 80 || p.x > ARENA_RIGHT + 80) { p.dead = true; continue; }
      const target = p.owner === 'player' ? this.bot : this.player;
      if (this.invulnerable(target, time)) continue; // dodges/i-frames beat the knife
      this.hurtboxRect(target, this.rectB);
      this.rectA.setTo(p.x - 18, p.y - 9, 36, 18); // slim blade AABB
      if (Phaser.Geom.Rectangle.Overlaps(this.rectA, this.rectB)) {
        p.dead = true;
        this.onProjectileHit(p, target, time);
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  private onProjectileHit(p: Projectile, target: Combatant, time: number): void {
    const owner = p.owner === 'player' ? this.player : this.bot;
    const cx = p.x;
    const cy = p.y;

    // A knife can be blocked if the target is guarding and facing the incoming blade.
    if (target.state === 'block' && target.facing === -p.facing) {
      const chip = Math.max(1, Math.round(p.damage * 0.25));
      target.health = Math.max(1, target.health - chip);
      fightAudio.block(true);
      this.bridge.events.emit('blocked', {
        attacker: owner.side, defender: target.side, x: cx, y: cy, facing: p.facing,
        strength: 'light', heavy: false, metallic: true, damage: chip, comboCount: 0,
      });
      this.bridge.events.emit('cameraImpact', { magnitude: 0.1, zoom: 0 });
      return;
    }

    const dmg = p.damage;
    target.health = Math.max(0, target.health - dmg);
    owner.charge = Math.min(1, owner.charge + 0.02);
    target.charge = Math.min(1, target.charge + target.profile.chargePerHitTaken * 0.5);
    target.body.setVelocity(p.facing * 150, -30);
    this.applyReaction(target, p.reaction);
    target.reaction = p.reaction;
    fightAudio.hit('light', true);

    const dmgText = this.add.text(cx, cy - 60, `-${dmg}`, { fontFamily: 'Arial Black', fontSize: '20px', color: '#ffe0a0', stroke: '#24181a', strokeThickness: 5 }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: dmgText, y: dmgText.y - 30, alpha: 0, duration: 460, ease: 'Cubic.Out', onComplete: () => dmgText.destroy() });
    this.bridge.events.emit('hit', {
      attacker: owner.side, defender: target.side, x: cx, y: cy, facing: p.facing,
      strength: 'light', heavy: false, metallic: true, damage: dmg, comboCount: 0,
    });
    this.bridge.events.emit('cameraImpact', { magnitude: 0.2, zoom: 0.02 });
    this.hitstopUntil = Math.max(this.hitstopUntil, time + 40);
    this.bridge.events.emit('hitstop', { ms: 40 });

    if (target.health <= 0) {
      this.finish = 'ko';
      this.onKnockedOut(owner, target);
    }
  }

  // ─────────────────────────────── hit resolution (P3) ───────────────────────────────

  private resolveCombat(attacker: Combatant, defender: Combatant, time: number): void {
    if ((attacker.state !== 'attack' && attacker.state !== 'special') || !attacker.move) return;
    if (attacker.attackHitDone) return;
    if (this.phaseOf(attacker, time) !== 'active') return;

    const move = attacker.move;
    this.hitboxRect(attacker, move, this.rectA);
    this.hurtboxRect(defender, this.rectB);
    if (!Phaser.Geom.Rectangle.Overlaps(this.rectA, this.rectB)) return;

    attacker.attackHitDone = true;

    if (this.invulnerable(defender, time)) {
      this.bridge.events.emit('attackWhiffed', { side: attacker.side, moveId: move.id });
      return;
    }

    const cx = (Math.max(this.rectA.left, this.rectB.left) + Math.min(this.rectA.right, this.rectB.right)) / 2;
    const cy = defender.body.y - HURT_H * 0.12;

    const facingAttack = defender.facing === -attacker.facing;

    // Perfect parry: guard raised within the parry window, facing the attack.
    if (defender.state === 'block' && facingAttack && time < defender.parryUntil && !move.unblockableByGuard) {
      this.onPerfectParry(attacker, defender, cx, cy, time);
      return;
    }

    // Normal block.
    if (defender.state === 'block' && facingAttack && !move.unblockableByGuard) {
      const breaks = move.guardBreak && defender.stamina <= defender.profile.stamina.guardBreakThreshold;
      defender.stamina = Math.max(0, defender.stamina - defender.profile.stamina.blockDrainPerHit - (move.guardBreak ? 6 : 0));
      defender.regenAfter = time + defender.profile.stamina.regenDelay + 200;
      if (breaks) { this.onGuardBreak(attacker, defender, cx, cy, time); return; }
      this.onBlocked(attacker, defender, move, cx, cy, time);
      return;
    }

    this.onHit(attacker, defender, move, cx, cy, time);
  }

  private onHit(attacker: Combatant, defender: Combatant, move: MoveDef, cx: number, cy: number, time: number): void {
    const power = FIGHTER_DEFINITIONS[attacker.id].power;
    const lightMove = move.kind === 'light' || move.kind === 'sweep' || move.kind === 'dash';
    let dmg = move.damage * power * (lightMove ? 0.62 : 1);
    if (attacker.profile.passive === 'rage') dmg *= 1 + (1 - attacker.health / attacker.maxHealth) * 0.5;
    if (attacker.profile.passive === 'zone' && Math.abs(attacker.body.x - defender.body.x) > this.reachOf(move) * 0.8) dmg *= 1.18;
    if (attacker.profile.passive === 'evasion' && time < attacker.iframeUntil + 260) dmg *= 1.25;
    dmg = Math.round(dmg);

    const hitZone = move.kind === 'launcher' || move.id === 'light2' ? 'HEAD' : move.kind === 'sweep' ? 'LEG' : (Math.random() < 0.22 ? 'HEAD' : 'BODY');
    if (hitZone === 'HEAD') dmg = Math.round(dmg * 1.15);
    defender.health = Math.max(0, defender.health - dmg);
    const continuing = attacker.state === 'special' || move.reaction === 'launch' || defender.state === 'hit' || defender.state === 'stagger';
    attacker.comboCount = continuing ? attacker.comboCount + 1 : 1;

    const momentumBonus = attacker.profile.passive === 'momentum' && attacker.targetVX * attacker.facing > 0 ? 1.4 : 1;
    attacker.charge = Math.min(1, attacker.charge + attacker.profile.chargePerHitDealt * momentumBonus);
    defender.charge = Math.min(1, defender.charge + defender.profile.chargePerHitTaken);

    const strength = this.strengthOf(move, dmg);
    defender.body.setVelocity(attacker.facing * move.knockbackX, move.knockbackY);
    this.applyReaction(defender, move.reaction);
    defender.reaction = move.reaction;

    const heavy = move.kind === 'heavy' || move.kind === 'special' || move.kind === 'ultimate';
    // Connecting on a fighter is a flesh/armor impact; a bladed weapon adds a
    // cutting slash over it. The ringing metal *clash* stays reserved for
    // blocks and parries, where two weapons actually meet — so a clean hit and
    // a blocked strike never sound the same.
    fightAudio.hit(strength, move.metallic);
    const damageText = this.add.text(cx, cy - 92, `${hitZone}  -${dmg}`, { fontFamily: 'Arial Black', fontSize: heavy ? '28px' : '22px', color: hitZone === 'HEAD' ? '#ffe08a' : heavy ? '#ffb56b' : '#fff4e4', stroke: '#24181a', strokeThickness: 5 }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: damageText, y: damageText.y - (heavy ? 48 : 34), alpha: 0, duration: 520, ease: 'Cubic.Out', onComplete: () => damageText.destroy() });
    const tip = this.add.text(24, 640, heavy ? 'HEAVY HIT  •  CREATE SPACE' : 'HIT CONFIRMED  •  KEEP PRESSURE', { fontFamily: 'Arial', fontSize: '14px', color: '#e6c7a8', backgroundColor: '#20191bcc', padding: { left: 10, right: 10, top: 7, bottom: 7 } }).setDepth(25);
    this.tweens.add({ targets: tip, alpha: 0, delay: 500, duration: 350, onComplete: () => tip.destroy() });
    this.bridge.events.emit('hit', {
      attacker: attacker.side, defender: defender.side, x: cx, y: cy, facing: attacker.facing,
      strength, heavy, metallic: move.metallic, damage: dmg, comboCount: attacker.comboCount,
    });
    const mag = strength === 'critical' ? 0.8 : strength === 'heavy' ? 0.55 : strength === 'medium' ? 0.32 : 0.18;
    this.bridge.events.emit('cameraImpact', { magnitude: mag, zoom: heavy ? 0.08 : 0.03 });
    this.hitstopUntil = Math.max(this.hitstopUntil, time + move.hitstop);
    this.bridge.events.emit('hitstop', { ms: move.hitstop });

    this.bridge.hud.comboSide = attacker.side;
    this.bridge.hud.comboCount = attacker.comboCount;

    if (defender.health <= 0) {
      this.finish = move.kind === 'ultimate' ? 'ultimate' : 'ko';
      this.onKnockedOut(attacker, defender);
    }
  }

  private onBlocked(attacker: Combatant, defender: Combatant, move: MoveDef, cx: number, cy: number, time: number): void {
    const chip = Math.round(move.damage * 0.12 * (move.guardBreak ? 1.6 : 1));
    defender.health = Math.max(1, defender.health - chip);
    defender.body.setVelocityX(attacker.facing * Math.min(180, move.knockbackX * 0.35));
    fightAudio.block(move.metallic);
    this.bridge.events.emit('blocked', {
      attacker: attacker.side, defender: defender.side, x: cx, y: cy, facing: attacker.facing,
      strength: 'light', heavy: false, metallic: true, damage: chip, comboCount: 0,
    });
    this.bridge.events.emit('cameraImpact', { magnitude: 0.16, zoom: 0.01 });
    this.hitstopUntil = Math.max(this.hitstopUntil, time + 30);
    attacker.comboCount = 0;
    this.bridge.hud.comboSide = null;
    this.bridge.hud.comboCount = 0;
    if (defender.profile.passive === 'counterpoise') defender.charge = Math.min(1, defender.charge + 0.03);
  }

  private onPerfectParry(attacker: Combatant, defender: Combatant, cx: number, cy: number, time: number): void {
    fightAudio.parry();
    this.bridge.events.emit('perfectParry', { side: defender.side, x: cx, y: cy, facing: defender.facing, by: defender.side });
    this.bridge.events.emit('cameraImpact', { magnitude: 0.5, zoom: 0.1 });
    this.hitstopUntil = Math.max(this.hitstopUntil, time + 140);
    // Attacker is punished into a long recovery; defender gets a counter window + charge.
    this.applyReaction(attacker, 'medium');
    attacker.stateUntil = time + 520;
    defender.charge = Math.min(1, defender.charge + (defender.profile.passive === 'counterpoise' ? 0.34 : 0.22));
    defender.state = 'parry';
    defender.stateUntil = time + 180;
    defender.stamina = Math.min(defender.profile.stamina.max, defender.stamina + 14);
    this.bridge.events.emit('counter', { side: defender.side });
  }

  private onGuardBreak(attacker: Combatant, defender: Combatant, cx: number, cy: number, time: number): void {
    fightAudio.guardBreak();
    this.bridge.events.emit('guardBroken', { side: defender.side, x: cx, y: cy, facing: defender.facing });
    this.bridge.events.emit('cameraImpact', { magnitude: 0.5, zoom: 0.09 });
    this.hitstopUntil = Math.max(this.hitstopUntil, time + 120);
    defender.state = 'guard_break';
    defender.stateUntil = time + 900;
    defender.move = null;
    defender.comboCount = 0;
    defender.reaction = 'crumple';
    defender.body.setVelocityX(attacker.facing * 120);
  }

  private onKnockedOut(attacker: Combatant, defender: Combatant): void {
    defender.state = 'knockdown';
    defender.stateUntil = this.time.now + 1600;
    defender.move = null;
    defender.reaction = 'knockdown';
    defender.body.setVelocity(attacker.facing * 260, -260);
    this.bridge.events.emit('knockdown', { side: defender.side, x: defender.body.x, y: defender.body.y, facing: defender.facing });
    this.finishRound(attacker.side === 'player');
  }

  private applyReaction(c: Combatant, reaction: ReactionType): void {
    c.move = null;
    c.comboCount = 0;
    c.bufferedInput = null;
    const now = this.time.now;
    const set = (state: CombatState, ms: number) => { c.state = state; c.stateUntil = now + ms; };
    switch (reaction) {
      case 'light': set('hit', 220); break;
      case 'medium': set('hit', 320); break;
      case 'heavy': set('stagger', 460); break;
      case 'crumple': set('guard_break', 900); break;
      case 'launch': set('stagger', 620); break;
      case 'trip': set('knockdown', 1000); break;
      case 'knockdown': set('knockdown', 1400); break;
    }
  }

  // ─────────────────────────────── state advance ───────────────────────────────

  private advanceState(c: Combatant, time: number): void {
    // Airborne jump/aerial: hold until landing.
    if (!this.grounded(c) && (c.state === 'jump' || c.state === 'attack')) {
      if (c.state === 'attack' && time >= c.stateUntil) { c.state = 'jump'; c.move = null; }
      return;
    }
    if (time < c.stateUntil) return;

    switch (c.state) {
      case 'attack':
      case 'special':
        c.move = null;
        c.state = 'combat_idle';
        c.lastLightId = null;
        break;
      case 'dash':
      case 'dodge':
      case 'parry':
        c.state = 'combat_idle';
        break;
      case 'hit':
      case 'stagger':
        c.state = 'combat_idle';
        c.wakeInvulnUntil = time + 120;
        break;
      case 'guard_break':
        c.state = 'combat_idle';
        c.stamina = Math.max(c.stamina, c.profile.stamina.max * 0.3);
        c.wakeInvulnUntil = time + 200;
        break;
      case 'knockdown':
        c.state = 'wakeup';
        c.stateUntil = time + 380;
        break;
      case 'wakeup':
        c.state = 'combat_idle';
        c.wakeInvulnUntil = time + 200;
        break;
      case 'jump':
        if (this.grounded(c)) { c.state = 'combat_idle'; fightAudio.land(); }
        break;
      default:
        break;
    }
  }

  private regen(c: Combatant, time: number, dt: number): void {
    if (time < c.regenAfter) return;
    const rate = c.profile.stamina.regen * (c.profile.passive === 'flow' && this.grounded(c) ? 1.4 : 1);
    c.stamina = Math.min(c.profile.stamina.max, c.stamina + rate * (dt / 1000));
  }

  // ─────────────────────────────── spacing (P2) ───────────────────────────────

  private separate(hard = false): void {
    const a = this.player;
    const b = this.bot;
    const dx = b.body.x - a.body.x;
    const dist = Math.abs(dx);
    const dir = dx >= 0 ? 1 : -1;
    if (dist >= MIN_SEPARATION) {
      // Fighters are free to hold or open up distance — spacing is the player's and
      // the bot AI's job, never a magnet. (An earlier "magnetic lane" here nudged both
      // bodies back together every frame, which made retreating feel sticky/impossible
      // and kept the wide models visually overlapping. Removed.)
      return;
    }
    // Relax the push while a strike is active so attacks can reach (spec P2/§10).
    const overlap = MIN_SEPARATION - dist;
    // Symmetric soft push; a reeling fighter braces less, so it slides more.
    const aReel = this.reeling(a) ? 1.4 : 1;
    const bReel = this.reeling(b) ? 1.4 : 1;
    const total = aReel + bReel;
    a.body.x -= dir * overlap * (bReel / total);
    b.body.x += dir * overlap * (aReel / total);
    if (hard) {
      // Stop only inward velocity. Retreating fighters must remain controllable.
      if (a.targetVX * dir > 0) a.body.setVelocityX(0);
      if (b.targetVX * dir < 0) b.body.setVelocityX(0);
      // Never allow a frame of momentum to carry either fighter through the other.
      if (a.body.x >= b.body.x) {
        const center = (a.body.x + b.body.x) * 0.5;
        a.body.x = center - MIN_SEPARATION * 0.5;
        b.body.x = center + MIN_SEPARATION * 0.5;
      }
    }
  }

  private clampArena(c: Combatant): void {
    if (c.body.x < ARENA_LEFT) { c.body.x = ARENA_LEFT; if (c.body.body!.velocity.x < 0) c.body.setVelocityX(0); }
    if (c.body.x > ARENA_RIGHT) { c.body.x = ARENA_RIGHT; if (c.body.body!.velocity.x > 0) c.body.setVelocityX(0); }
  }

  // ─────────────────────────────── geometry helpers ───────────────────────────────

  private reachOf(move: MoveDef): number { return move.hitbox.x + move.hitbox.w / 2; }

  private hitboxRect(c: Combatant, move: MoveDef, out: Phaser.Geom.Rectangle): void {
    // Weapon reach extends beyond the body lane. This is intentionally separate
    // from body spacing so a sword/spear can strike before models touch.
    const weaponExtension = move.metallic ? 92 : 54;
    const cx = c.body.x + c.facing * (move.hitbox.x + weaponExtension);
    const cy = c.body.y + move.hitbox.y; // tracks the attacker's real height (airborne too)
    out.setTo(cx - (move.hitbox.w + weaponExtension) / 2, cy - move.hitbox.h / 2, move.hitbox.w + weaponExtension, move.hitbox.h);
  }

  private hurtboxRect(c: Combatant, out: Phaser.Geom.Rectangle): void {
    const h = c.state === 'crouch' ? CROUCH_H : HURT_H;
    const cx = c.body.x;
    const cy = c.body.y + (HURT_H - h) / 2; // crouch lowers the box so highs whiff over it
    out.setTo(cx - HURT_W / 2, cy - h / 2, HURT_W, h);
  }

  // ─────────────────────────────── predicates ───────────────────────────────

  private grounded(c: Combatant): boolean {
    const body = c.body.body;
    return !!(body?.blocked.down || body?.touching.down) || c.body.y >= FLOOR_Y - HURT_H / 2 - 1;
  }
  private actionable(c: Combatant): boolean { return STATE_PERMS[c.state].canAct && !this.reeling(c); }
  private reeling(c: Combatant): boolean {
    return STATE_PERMS[c.state].reeling || c.state === 'hit' || c.state === 'stagger' || c.state === 'guard_break';
  }
  private invulnerable(c: Combatant, time: number): boolean {
    if (time < c.wakeInvulnUntil) return true;
    if (c.state === 'dodge' && time >= c.iframeFrom && time <= c.iframeUntil) return true;
    return STATE_PERMS[c.state].invulnerable && c.state !== 'block';
  }

  private phaseOf(c: Combatant, time: number): MovePhase | null {
    if ((c.state !== 'attack' && c.state !== 'special') || !c.move) return null;
    const e = time - c.attackStart;
    if (e < c.move.startup) return 'startup';
    if (e < c.move.startup + c.move.active) return 'active';
    return 'recovery';
  }

  private strengthOf(move: MoveDef, dmg: number): ReactionStrength {
    if (move.kind === 'ultimate' || dmg >= 30) return 'critical';
    if (move.kind === 'heavy' || move.kind === 'special' || move.reaction === 'heavy' || move.reaction === 'launch') return 'heavy';
    if (dmg >= 9) return 'medium';
    return 'light';
  }

  private updateFacing(): void {
    // Re-face only when free to; never flip mid-swing.
    if (this.actionable(this.player) && this.player.state !== 'attack') this.player.facing = this.player.body.x <= this.bot.body.x ? 1 : -1;
    if (this.actionable(this.bot) && this.bot.state !== 'attack') this.bot.facing = this.bot.body.x <= this.player.body.x ? 1 : -1;
  }

  private smoothFacing(c: Combatant, dt: number): void {
    const rate = c.profile.movement.turnRate * (dt / 1000);
    c.visualFacing = Phaser.Math.Linear(c.visualFacing, c.facing, Math.min(1, rate));
    if (Math.abs(c.visualFacing - c.facing) < 0.02) c.visualFacing = c.facing;
  }

  // ─────────────────────────────── round / match end ───────────────────────────────

  private updateTimer(time: number): void {
    const seconds = Math.max(0, ROUND_SECONDS - Math.floor((time - this.roundStartedAt) / 1000));
    if (seconds === 0 && !this.resolving) {
      this.finish = 'timeout';
      this.finishRound(this.player.health >= this.bot.health);
    }
  }

  private finishRound(playerWon: boolean): void {
    if (this.resolving) return;
    this.resolving = true;
    this.phase = 'roundEnd';
    this.bridge.hud.phase = 'roundEnd';
    const isDraw = this.finish === 'timeout' && this.player.health === this.bot.health;
    if (isDraw) this.drawnRounds += 1;
    else if (playerWon) this.playerRounds += 1; else this.botRounds += 1;
    const winner = playerWon ? this.player : this.bot;
    const loser = playerWon ? this.bot : this.player;
    winner.state = 'victory';
    winner.stateUntil = 0;
    winner.body.setVelocity(0, 0);
    winner.move = null;
    if (loser.state !== 'knockdown') { loser.state = 'defeat'; loser.stateUntil = 0; loser.move = null; }
    this.bridge.events.emit('roundEnd', { winner: winner.side });
    this.bridge.hud.banner = isDraw ? 'ROUND DRAW' : playerWon ? 'ROUND WON' : 'ROUND LOST';
    this.bridge.hud.playerRounds = this.playerRounds;
    this.bridge.hud.botRounds = this.botRounds;

    const matchOver = this.playerRounds >= ROUNDS_TO_WIN || this.botRounds >= ROUNDS_TO_WIN || this.round >= 3;
    this.time.delayedCall(matchOver ? 2000 : 1500, () => {
      if (matchOver) {
        const won = this.playerRounds > this.botRounds;
        const tied = this.playerRounds === this.botRounds;
        this.phase = 'matchEnd';
        this.bridge.hud.phase = 'matchEnd';
        if (!tied) this.bridge.events.emit(won ? 'victory' : 'defeat', { side: won ? 'player' : 'bot' });
        if (tied) fightAudio.round(); else if (won) fightAudio.victory(); else fightAudio.defeat();
        this.options.onComplete({ won, tied, playerRounds: this.playerRounds, botRounds: this.botRounds, finish: this.finish });
        return;
      }
      this.round += 1;
      this.startRound(false);
    });
  }

  // ─────────────────────────────── publish to HUD + view ───────────────────────────────

  private updateHud(): void {
    const h = this.bridge.hud;
    h.playerHealth = this.player.health / this.player.maxHealth;
    h.botHealth = this.bot.health / this.bot.maxHealth;
    h.playerStamina = this.player.stamina / this.player.profile.stamina.max;
    h.botStamina = this.bot.stamina / this.bot.profile.stamina.max;
    h.playerCharge = this.player.charge;
    h.botCharge = this.bot.charge;
    h.timer = Math.max(0, ROUND_SECONDS - Math.floor((this.time.now - this.roundStartedAt) / 1000));
    // Give the player a clear, short cue when the signature ability is available.
    if (this.phase === 'fight' && this.player.charge >= this.player.profile.ability.chargeCost && !h.banner) {
      h.banner = `${this.player.profile.ability.name} READY  [U]`;
      this.time.delayedCall(1200, () => { if (this.phase === 'fight' && h.banner.includes('READY')) h.banner = ''; });
    }
    if (this.player.comboCount === 0 && this.bot.comboCount === 0) { h.comboCount = 0; h.comboSide = null; }
  }

  private publishFrame(time: number, dt: number, entryProgress: number): void {
    this.options.onVisualFrame({
      time, dt,
      player: this.toVisual(this.player, time),
      bot: this.toVisual(this.bot, time),
      projectiles: this.projectiles.map((p) => ({
        id: p.id,
        kind: p.kind,
        x: p.x,
        y: p.y,
        facing: p.facing,
        ownerId: p.ownerId,
        life: Phaser.Math.Clamp((time - p.bornAt) / p.life, 0, 1),
      })),
      hitstopRemaining: Math.max(0, this.hitstopUntil - time),
      phase: this.phase,
      entryProgress,
    });
    this.player.reaction = null;
    this.bot.reaction = null;
  }

  private toVisual(c: Combatant, time: number): FighterVisual {
    const phase = this.phaseOf(c, time);
    const move = c.move;
    const progress = move ? Phaser.Math.Clamp((time - c.attackStart) / moveDuration(move), 0, 1) : 0;
    return {
      id: c.id,
      x: c.body.x,
      y: c.body.y + HURT_H / 2, // FEET position (floor = FLOOR_Y); the view places the model root here
      facing: (c.visualFacing >= 0 ? 1 : -1) as 1 | -1,
      state: c.state,
      moveId: move?.id ?? null,
      movePhase: phase,
      moveProgress: progress,
      moveKind: move?.kind ?? null,
      vx: c.body.body?.velocity.x ?? 0,
      vy: c.body.body?.velocity.y ?? 0,
      grounded: this.grounded(c),
      blocking: c.state === 'block',
      dodgingIFrames: c.state === 'dodge' && time >= c.iframeFrom && time <= c.iframeUntil,
      comboCount: c.comboCount,
      healthFrac: c.health / c.maxHealth,
      staminaFrac: c.stamina / c.profile.stamina.max,
      chargeFrac: c.charge,
      reaction: c.reaction,
    };
  }
}
