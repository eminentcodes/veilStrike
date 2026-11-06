// Per-fighter combat profiles (spec §13, §25, P1/P6). Composed on top of the base
// FIGHTER_DEFINITIONS in types.ts — that file keeps its stable shape; this layer adds the
// movement feel, stamina economy, procedural combat stance, entry choreography, signature
// ability, ultimate, and passive that make each fighter play and read distinctly.
//
// The sim (FightScene) reads movement/stamina/ability/passive; the view (ThreeStage) reads
// stance/entry/archetype. Everything is data, so tuning the roster never touches the loop.

import type { FighterId } from './types';
import { FIGHTER_DEFINITIONS } from './types';
import type { ArchetypeId, Moveset } from './moves';
import { movesetFor } from './moves';

export type PassiveId =
  | 'momentum' // kael — builds ability charge faster while pressing forward
  | 'counterpoise' // akio — less chip on block, more charge from parries
  | 'flow' // sai — faster stamina regen, charge on every dodge
  | 'rage' // brakk — damage scales up as his own health drops
  | 'evasion' // nyx — first strike after a backstep/dodge is empowered
  | 'zone'; // valen — hits from max range deal bonus damage

/** Movement feel (spec P1). Speeds in px/s, accel in px/s², times in ms, turnRate in rad/s.
 *  High accel + friction = responsive start/stop; heavier fighters trade accel for weight. */
export interface MovementProfile {
  walk: number;
  advance: number; // combat-walk toward the opponent (a touch more grounded)
  retreat: number; // backpedal
  dashSpeed: number;
  dashTime: number;
  dashCooldown: number;
  backdashSpeed: number;
  dodgeSpeed: number;
  dodgeTime: number;
  dodgeIFrames: [number, number]; // ms window inside the dodge that is invulnerable
  dodgeCooldown: number;
  jumpVelocity: number; // negative = up
  airControl: number; // 0..1 of walk speed steerable midair
  accel: number; // toward target velocity — responsiveness
  friction: number; // brake when no input — stop feel
  turnRate: number; // root rotation toward facing (smooth flip, not a hard 180°)
}

/** Stamina economy (spec §16). Blocking and attacking spend it; running out crumples. */
export interface StaminaProfile {
  max: number;
  regen: number; // per second, when not spending
  regenDelay: number; // ms after a spend before regen resumes
  blockDrainPerHit: number;
  guardBreakThreshold: number; // at/under this, a guard-breaker forces a crumple
}

/** Procedural combat stance (spec P4). Additive pose laid over the idle clip so each
 *  archetype reads as itself even when clips are shared across the KayKit roster. */
export interface StanceProfile {
  crouch: number; // lower the hips (world units)
  lean: number; // torso lean toward the opponent (rad)
  guardHeight: number; // lead hand/weapon height, 0 low .. 1 high
  bladeAngle: number; // weapon tilt (rad)
  bounce: number; // idle weight-shift amplitude (world units)
  bounceRate: number; // Hz
  wide: number; // stance width scale, 1 = neutral
}

/** Cinematic entry choreography (spec P7). */
export interface EntryProfile {
  startOffset: number; // px behind the fighting mark the fighter strolls in from
  walkInMs: number;
  drawMs: number; // stance-draw flourish beat
  clip: string[]; // clip intent for the walk-in
  drawClip: string[]; // clip intent for the flourish
}

export interface AbilityProfile {
  name: string;
  moveId: 'special';
  chargeCost: number; // fraction of the charge meter, 0..1
  cue: string; // announcer / HUD label
}

export interface UltimateProfile {
  name: string;
  moveId: 'ultimate';
  cue: string;
}

export interface FighterProfile {
  id: FighterId;
  archetype: ArchetypeId;
  movement: MovementProfile;
  stamina: StaminaProfile;
  stance: StanceProfile;
  entry: EntryProfile;
  ability: AbilityProfile;
  ultimate: UltimateProfile;
  passive: PassiveId;
  chargePerHitDealt: number; // added to the ability meter
  chargePerHitTaken: number;
}

const ARCHETYPE_BY_FIGHTER: Record<FighterId, ArchetypeId> = {
  kael: 'assassin',
  ronin: 'duelist',
  monk: 'monk',
  brakk: 'berserker',
  shade: 'shadow',
  valen: 'spear',
};

/** Weight class knobs derived once per fighter, then hand-tuned below. `weight` 0 = nimble,
 *  1 = heavy: it lowers accel/turn and softens the dash so big fighters feel grounded but
 *  never sluggish (the old build's core complaint). */
function movement(speed: number, weight: number): MovementProfile {
  const nimble = 1 - weight;
  return {
    walk: speed,
    advance: Math.round(speed * 1.0), // was 0.94 — close the gap at full pace
    retreat: Math.round(speed * 0.98), // was 0.86 — backing off is now nearly as fast, so disengaging feels free (P1: "hard to move back")
    dashSpeed: Math.round(speed * (3.1 - weight * 0.7)),
    dashTime: Math.round(160 + weight * 40),
    dashCooldown: Math.round(280 + weight * 120), // was 360+140 — dash/dodge available far more often
    backdashSpeed: Math.round(speed * (2.7 - weight * 0.5)),
    dodgeSpeed: Math.round(speed * (2.8 - weight * 0.5)),
    dodgeTime: Math.round(290 + weight * 40),
    dodgeIFrames: [40, Math.round(220 + weight * 30)],
    dodgeCooldown: Math.round(360 + weight * 140),
    jumpVelocity: -(720 + Math.round(nimble * 120)), // was 680+110 — punchier, more athletic jump (tune with arena gravity 1500)
    airControl: 0.52 + nimble * 0.22, // was 0.34+0.16 — air feels light and steerable, not heavy/committed
    accel: Math.round(4200 - weight * 1300), // was 3400-1200 — even snappier off the mark (top speed in ~45–70ms)
    friction: Math.round(4600 - weight * 900), // was 4200 — crisp, immediate stops
    turnRate: 12 + nimble * 8,
  };
}

function stamina(max: number, regen: number, weight: number): StaminaProfile {
  return {
    max,
    regen,
    regenDelay: 520,
    blockDrainPerHit: 8 + weight * 5,
    guardBreakThreshold: 12,
  };
}

const PROFILES: Record<FighterId, FighterProfile> = {
  kael: {
    id: 'kael', archetype: 'assassin',
    movement: movement(FIGHTER_DEFINITIONS.kael.speed, 0.1),
    stamina: stamina(100, 20, 0.1),
    stance: { crouch: 0.06, lean: 0.18, guardHeight: 0.45, bladeAngle: -0.5, bounce: 0.03, bounceRate: 1.8, wide: 1.04 },
    entry: { startOffset: 230, walkInMs: 1500, drawMs: 640, clip: ['run', 'walk', 'jog'], drawClip: ['dualwield_melee_attack_stance', 'unsheath', 'dualwield', 'block'] },
    ability: { name: 'SHADOW STEP', moveId: 'special', chargeCost: 0.5, cue: 'SHADOW STEP' },
    ultimate: { name: 'THOUSAND CUTS', moveId: 'ultimate', cue: 'THOUSAND CUTS' },
    passive: 'momentum', chargePerHitDealt: 0.09, chargePerHitTaken: 0.04,
  },
  ronin: {
    id: 'ronin', archetype: 'duelist',
    movement: movement(FIGHTER_DEFINITIONS.ronin.speed, 0.4),
    stamina: stamina(110, 17, 0.4),
    stance: { crouch: 0.02, lean: 0.1, guardHeight: 0.72, bladeAngle: 0.35, bounce: 0.018, bounceRate: 1.2, wide: 1.12 },
    entry: { startOffset: 210, walkInMs: 1650, drawMs: 760, clip: ['walk', 'jog'], drawClip: ['2h_melee_idle', 'unsheath', 'sheath', 'block'] },
    ability: { name: 'PRECISION DRAW', moveId: 'special', chargeCost: 0.6, cue: 'IAIJUTSU' },
    ultimate: { name: 'FINAL MOON', moveId: 'ultimate', cue: 'FINAL MOON' },
    passive: 'counterpoise', chargePerHitDealt: 0.06, chargePerHitTaken: 0.06,
  },
  monk: {
    id: 'monk', archetype: 'monk',
    movement: movement(FIGHTER_DEFINITIONS.monk.speed, 0.12),
    stamina: stamina(104, 24, 0.12),
    stance: { crouch: 0.05, lean: 0.14, guardHeight: 0.6, bladeAngle: 0, bounce: 0.038, bounceRate: 2.2, wide: 1.0 },
    entry: { startOffset: 220, walkInMs: 1480, drawMs: 700, clip: ['run', 'jog', 'walk'], drawClip: ['unarmed_melee_idle', 'unarmed_melee_attack_stance', 'block'] },
    ability: { name: 'FLOW COUNTER', moveId: 'special', chargeCost: 0.45, cue: 'FLOW COUNTER' },
    ultimate: { name: 'HUNDRED FISTS', moveId: 'ultimate', cue: 'HUNDRED FISTS' },
    passive: 'flow', chargePerHitDealt: 0.07, chargePerHitTaken: 0.05,
  },
  brakk: {
    id: 'brakk', archetype: 'berserker',
    movement: movement(FIGHTER_DEFINITIONS.brakk.speed, 0.85),
    stamina: stamina(130, 14, 0.85),
    stance: { crouch: 0.11, lean: 0.22, guardHeight: 0.3, bladeAngle: -0.2, bounce: 0.012, bounceRate: 0.9, wide: 1.22 },
    entry: { startOffset: 190, walkInMs: 1750, drawMs: 820, clip: ['walk'], drawClip: ['2h_melee_idle', '2h_melee_attack_stance', 'block'] },
    ability: { name: 'RAGE BREAK', moveId: 'special', chargeCost: 0.6, cue: 'RAGE BREAK' },
    ultimate: { name: 'SKULLQUAKE', moveId: 'ultimate', cue: 'SKULLQUAKE' },
    passive: 'rage', chargePerHitDealt: 0.08, chargePerHitTaken: 0.07,
  },
  shade: {
    id: 'shade', archetype: 'shadow',
    movement: movement(FIGHTER_DEFINITIONS.shade.speed, 0.16),
    stamina: stamina(100, 20, 0.16),
    stance: { crouch: 0.08, lean: 0.12, guardHeight: 0.5, bladeAngle: -0.7, bounce: 0.028, bounceRate: 1.7, wide: 1.02 },
    entry: { startOffset: 235, walkInMs: 1520, drawMs: 680, clip: ['run', 'walk'], drawClip: ['1h_melee_idle', 'block', 'unsheath'] },
    ability: { name: 'VANISH FEINT', moveId: 'special', chargeCost: 0.5, cue: 'VANISH' },
    ultimate: { name: 'NIGHT COLLAPSE', moveId: 'ultimate', cue: 'NIGHT COLLAPSE' },
    passive: 'evasion', chargePerHitDealt: 0.07, chargePerHitTaken: 0.05,
  },
  valen: {
    id: 'valen', archetype: 'spear',
    movement: movement(FIGHTER_DEFINITIONS.valen.speed, 0.55),
    stamina: stamina(118, 16, 0.55),
    stance: { crouch: 0.03, lean: 0.08, guardHeight: 0.66, bladeAngle: 0.05, bounce: 0.016, bounceRate: 1.1, wide: 1.16 },
    entry: { startOffset: 200, walkInMs: 1680, drawMs: 780, clip: ['walk', 'jog'], drawClip: ['2h_melee_idle', '2h_melee_attack_stance', 'block'] },
    ability: { name: "WARDEN'S REACH", moveId: 'special', chargeCost: 0.55, cue: 'WARDEN' },
    ultimate: { name: 'IMPALE LINE', moveId: 'ultimate', cue: 'IMPALE LINE' },
    passive: 'zone', chargePerHitDealt: 0.07, chargePerHitTaken: 0.05,
  },
};

export function profileFor(id: FighterId): FighterProfile {
  return PROFILES[id];
}

export function archetypeFor(id: FighterId): ArchetypeId {
  return ARCHETYPE_BY_FIGHTER[id];
}

/** The fully-assembled move table for a fighter (archetype base + signature + ultimate). */
export function movesetForFighter(id: FighterId): Moveset {
  return movesetFor(id, ARCHETYPE_BY_FIGHTER[id]);
}
