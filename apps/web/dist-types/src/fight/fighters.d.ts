import type { FighterId } from './types';
import type { ArchetypeId, Moveset } from './moves';
export type PassiveId = 'momentum' | 'counterpoise' | 'flow' | 'rage' | 'evasion' | 'zone';
/** Movement feel (spec P1). Speeds in px/s, accel in px/s², times in ms, turnRate in rad/s.
 *  High accel + friction = responsive start/stop; heavier fighters trade accel for weight. */
export interface MovementProfile {
    walk: number;
    advance: number;
    retreat: number;
    dashSpeed: number;
    dashTime: number;
    dashCooldown: number;
    backdashSpeed: number;
    dodgeSpeed: number;
    dodgeTime: number;
    dodgeIFrames: [number, number];
    dodgeCooldown: number;
    jumpVelocity: number;
    airControl: number;
    accel: number;
    friction: number;
    turnRate: number;
}
/** Stamina economy (spec §16). Blocking and attacking spend it; running out crumples. */
export interface StaminaProfile {
    max: number;
    regen: number;
    regenDelay: number;
    blockDrainPerHit: number;
    guardBreakThreshold: number;
}
/** Procedural combat stance (spec P4). Additive pose laid over the idle clip so each
 *  archetype reads as itself even when clips are shared across the KayKit roster. */
export interface StanceProfile {
    crouch: number;
    lean: number;
    guardHeight: number;
    bladeAngle: number;
    bounce: number;
    bounceRate: number;
    wide: number;
}
/** Cinematic entry choreography (spec P7). */
export interface EntryProfile {
    startOffset: number;
    walkInMs: number;
    drawMs: number;
    clip: string[];
    drawClip: string[];
}
export interface AbilityProfile {
    name: string;
    moveId: 'special';
    chargeCost: number;
    cue: string;
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
    chargePerHitDealt: number;
    chargePerHitTaken: number;
}
export declare function profileFor(id: FighterId): FighterProfile;
export declare function archetypeFor(id: FighterId): ArchetypeId;
/** The fully-assembled move table for a fighter (archetype base + signature + ultimate). */
export declare function movesetForFighter(id: FighterId): Moveset;
