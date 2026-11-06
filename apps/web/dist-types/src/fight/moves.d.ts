export type ArchetypeId = 'assassin' | 'duelist' | 'monk' | 'berserker' | 'shadow' | 'spear';
export type ReactionType = 'light' | 'medium' | 'heavy' | 'launch' | 'trip' | 'crumple' | 'knockdown';
export type MoveKind = 'light' | 'heavy' | 'launcher' | 'sweep' | 'dash' | 'special' | 'ultimate';
/** Facing-relative hitbox. Center = (fighter.x + facing * x, fighter.y + y); the sim builds
 *  an AABB of `w`×`h` around it and tests against the defender's hurtbox. */
export interface Hitbox {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface MoveDef {
    id: string;
    kind: MoveKind;
    /** ms — readable wind-up before the hitbox is live. */
    startup: number;
    /** ms — hitbox is live. */
    active: number;
    /** ms — commitment after the strike. */
    recovery: number;
    damage: number;
    hitbox: Hitbox;
    /** forward velocity (px/s) applied at strike start — attack momentum (spec §10). */
    momentum: number;
    knockbackX: number;
    knockbackY: number;
    reaction: ReactionType;
    stamina: number;
    /** true = ignores standing block (lows, throws, guard-breakers). */
    unblockableByGuard?: boolean;
    guardBreak?: boolean;
    /** ms hit-stop on clean contact (spec §18). */
    hitstop: number;
    metallic: boolean;
    /** Move ids (or 'dodge' | 'block') this can cancel into. */
    cancelInto: string[];
    /** [fromMs, toMs] relative to move start where a buffered input is consumed (spec §11–12). */
    cancelWindow: [number, number];
    /** Clip-intent keywords the view scores against the rig's real clip names (spec §4, P4). */
    clip: string[];
    /** Vertical launch flag for juggle bookkeeping. */
    launches?: boolean;
}
export type Moveset = Record<string, MoveDef>;
/** Assemble the full per-fighter move table: archetype base + signature + ultimate. */
export declare function movesetFor(fighterId: string, archetype: ArchetypeId): Moveset;
export declare function moveDuration(move: MoveDef): number;
