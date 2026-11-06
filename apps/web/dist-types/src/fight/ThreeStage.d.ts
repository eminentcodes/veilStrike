import type { FighterId } from './types';
import type { VisualFrame as CurrentVisualFrame } from './visualFrame';
import type { CombatBridge } from './combatEvents';
export declare class ThreeStage {
    private scene;
    private camera;
    private renderer;
    private player;
    private bot;
    private frame;
    private particles;
    private rapierWorld;
    private rapierBodies;
    private bridge;
    private unsubs;
    private flashEl;
    private camSmoothZ;
    private camSmoothX;
    private camTargetZ;
    private camTargetX;
    private camLookX;
    private shake;
    private zoomPunch;
    private flash;
    private readonly camBaseY;
    private projectileMeshes;
    private fxq;
    private geoCache;
    private lastFlashWritten;
    private static readonly MAX_FX;
    constructor(host: HTMLElement, playerId: FighterId, botId: FighterId, bridge: CombatBridge, onReady?: () => void);
    update(frame: CurrentVisualFrame): void;
    private initRapier;
    destroy(): void;
    private resize;
    private buildArena;
    private createFighter;
    private loadHumanoids;
    private installHumanoid;
    private apply;
    private applyEntryPose;
    private spawnHitBurst;
    /** Pixels→world X, matching apply()'s hardcoded mapping (arena center 640, /95). */
    private worldX;
    /** Contact height in world units: Phaser y (floor 600) → ~torso height, clamped sane. */
    private contactY;
    private rigForSide;
    /** Full-screen colour wash via a screen-blend div. `amount` 0..1 peak; decays in renderLoop. */
    private flashScreen;
    private createFlashOverlay;
    /** Register a transient object, animated by the shared renderLoop ticker (see tickFx). */
    private transient;
    /** Advance every live transient VFX one frame; retire + dispose the finished ones. */
    private tickFx;
    /** Lazily create + cache a shared VFX geometry. Pooled geometries are never disposed per-use. */
    private geo;
    /** Dispose a transient's materials (always) and its geometry (only if not pooled). */
    private disposeFx;
    /** Subscribe the view to every combat moment. Unsubs collected for destroy(). */
    private subscribeToCombat;
    /** Every swing draws a visible blade arc in the fighter's accent — heavy swings bigger/slower. */
    private onAttackStarted;
    /** A crescent "swing" that sweeps and fades. DoubleSide so the mirrored (negative-scale) side shows. */
    private spawnSlashArc;
    /** Contact spark/dust burst. Metallic = bright sparks, else warmer body-hit. Scales with strength. */
    private spawnImpact;
    /** Metal-clang: tight blue-white spark cluster flying back off the guard, plus a small ring. */
    private spawnBlockSparks;
    /** Perfect parry: brilliant white radial pop + expanding ring + cool screen flash. */
    private spawnParryFlash;
    /** Guard break: orange glass-shard shatter bursting outward + warm flash. */
    private spawnGuardBreakVfx;
    /** Flat ring expanding across the floor (quakes, ground spells, ultimates). */
    private spawnGroundRing;
    /** A forward energy lance (warden beam). */
    private spawnBeam;
    /** Bespoke ability spell per fighter — the demanded warden magic, assassin dark-step, etc. */
    private spawnSpecialVFX;
    /** Ultimate: floor shockwave ring + accent light column + white core burst + strong screen flash. */
    private spawnUltimateVFX;
    /** Mirror the sim's authoritative projectile list into THREE meshes, spawning/retiring by id. */
    private syncProjectiles;
    /** A thrown-knife mesh: metallic blade + accent guard, tinted to the owner. */
    private makeKnifeMesh;
    private animateCloth;
    private actionForState;
    private applyCombatPose;
    private addWarriorGear;
    private playAction;
    private createParticles;
    private renderLoop;
}
