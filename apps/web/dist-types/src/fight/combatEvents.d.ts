import type { FighterId } from './types';
/** Which fighter an event refers to. */
export type Side = 'player' | 'bot';
export type ReactionStrength = 'light' | 'medium' | 'heavy' | 'critical';
export interface HitPayload {
    attacker: Side;
    defender: Side;
    /** Contact point in Phaser world pixels (converted to 3D by the view). */
    x: number;
    y: number;
    facing: 1 | -1;
    strength: ReactionStrength;
    heavy: boolean;
    /** Metal-on-metal (weapon/armor) vs body contact — drives spark vs dust. */
    metallic: boolean;
    damage: number;
    comboCount: number;
}
export interface SimplePoint {
    side: Side;
    x: number;
    y: number;
    facing: 1 | -1;
}
export interface CombatEventMap {
    entryStart: {
        player: FighterId;
        bot: FighterId;
    };
    entryDone: void;
    roundStart: {
        round: number;
    };
    roundEnd: {
        winner: Side;
    };
    attackStarted: {
        side: Side;
        moveId: string;
        heavy: boolean;
    };
    attackWhiffed: {
        side: Side;
        moveId: string;
    };
    hit: HitPayload;
    blocked: HitPayload;
    perfectParry: SimplePoint & {
        by: Side;
    };
    guardBroken: SimplePoint;
    counter: {
        side: Side;
    };
    dodge: SimplePoint;
    knockdown: SimplePoint;
    special: {
        side: Side;
        ability: string;
    };
    ultimate: {
        side: Side;
    };
    finisher: {
        side: Side;
        x: number;
        y: number;
    };
    /** Freeze animation for `ms` (hit-stop), driven from a single place. */
    hitstop: {
        ms: number;
    };
    /** Camera emphasis: shake magnitude 0..1 and optional zoom punch. */
    cameraImpact: {
        magnitude: number;
        zoom: number;
    };
    victory: {
        side: Side;
    };
    defeat: {
        side: Side;
    };
}
type Handler<K extends keyof CombatEventMap> = (payload: CombatEventMap[K]) => void;
export declare class CombatEvents {
    private handlers;
    on<K extends keyof CombatEventMap>(event: K, handler: Handler<K>): () => void;
    emit<K extends keyof CombatEventMap>(event: K, payload: CombatEventMap[K]): void;
    clear(): void;
}
/** Continuously-updated HUD state. Mutated in place each sim frame; the React HUD reads it
 *  on its own rAF cadence so 60fps sim ticks don't force 60fps React re-renders (spec §30). */
export interface HudSnapshot {
    phase: 'entry' | 'fight' | 'roundEnd' | 'matchEnd';
    round: number;
    timer: number;
    playerHealth: number;
    botHealth: number;
    playerStamina: number;
    botStamina: number;
    playerCharge: number;
    botCharge: number;
    playerRounds: number;
    botRounds: number;
    comboSide: Side | null;
    comboCount: number;
    banner: string;
    canSkipIntro: boolean;
}
export declare function createHudSnapshot(): HudSnapshot;
/** The shared object handed to the sim (writes), the view (subscribes), and the HUD (reads). */
export declare class CombatBridge {
    readonly events: CombatEvents;
    readonly hud: HudSnapshot;
    dispose(): void;
}
export {};
