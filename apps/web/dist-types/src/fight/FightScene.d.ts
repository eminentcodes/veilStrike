import Phaser from 'phaser';
import type { Difficulty, FighterId, MatchResult } from './types';
import type { VisualFrame } from './visualFrame';
import { CombatBridge } from './combatEvents';
interface SceneOptions {
    player: FighterId;
    opponent: FighterId;
    difficulty: Difficulty;
    bridge: CombatBridge;
    onExit: () => void;
    onComplete: (result: MatchResult) => void;
    onVisualFrame: (frame: VisualFrame) => void;
}
export declare class FightScene extends Phaser.Scene {
    private options;
    private bridge;
    private player;
    private bot;
    private keys;
    private phase;
    private round;
    private playerRounds;
    private botRounds;
    private drawnRounds;
    private roundStartedAt;
    private hitstopUntil;
    private entryStart;
    private entryDuration;
    private entrySkipped;
    private resolving;
    private readonly stride;
    private nextBotThink;
    private botIntent;
    private touchIntent;
    private finish;
    private readonly rectA;
    private readonly rectB;
    private projectiles;
    private nextProjectileId;
    constructor(options: SceneOptions);
    create(): void;
    private onTouchInput;
    private createCombatant;
    private bindInput;
    private beginEntry;
    private skipEntry;
    private updateEntry;
    private startRound;
    private resetCombatant;
    update(time: number, delta: number): void;
    private readPlayerIntent;
    private think;
    private botChooseAttack;
    private driveIntent;
    private buffer;
    private pull;
    private tryCancel;
    private nextChain;
    private pickLight;
    private pickHeavy;
    private integrate;
    /**
     * Cadenced footfalls while a fighter walks on the ground. Distance-based, so
     * the rhythm tracks real speed and there is silence when standing still,
     * blocking, attacking, or airborne (those states are not 'move').
     */
    private footsteps;
    private startDash;
    private startDodge;
    private startAttack;
    private startSpecial;
    private startUltimate;
    /** Hurl a vertical fan of knives in front of the caster. Real projectiles: they travel,
     *  collide with the opponent's hurtbox, and deal ranged damage (blockable). */
    private throwKnives;
    private updateProjectiles;
    private onProjectileHit;
    private resolveCombat;
    private onHit;
    private onBlocked;
    private onPerfectParry;
    private onGuardBreak;
    private onKnockedOut;
    private applyReaction;
    private advanceState;
    private regen;
    private separate;
    private clampArena;
    private reachOf;
    private hitboxRect;
    private hurtboxRect;
    private grounded;
    private actionable;
    private reeling;
    private invulnerable;
    private phaseOf;
    private strengthOf;
    private updateFacing;
    private smoothFacing;
    private updateTimer;
    private finishRound;
    private updateHud;
    private publishFrame;
    private toVisual;
}
export {};
