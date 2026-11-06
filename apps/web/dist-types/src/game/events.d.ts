import type { AiRoleId, EnemyId, HazardId, ResourceId, WorldEventId } from '@goldrush/shared';
import Phaser from 'phaser';
/** GDD 4.3 — all five tiers, including Emerald. */
export type TeamResources = Record<ResourceId, number>;
export declare function emptyResources(): TeamResources;
export interface Objective {
    label: string;
    progress: number;
    target: number;
    /** One line telling the player what to actually do next. */
    hint: string;
}
/** A miner in the crew, as the HUD needs to draw them (GDD 8.3). */
export interface CrewMemberState {
    id: string;
    label: string;
    role: AiRoleId;
    isPlayer: boolean;
    /** What they are actually swinging with — falls away as vitality does. */
    miningPower: number;
    /** Their power at full health, so the HUD can show what the mine has cost them. */
    basePower: number;
    vitality: number;
    vitalityMax: number;
    /** Out of the fight until a teammate picks them up. */
    downed: boolean;
    carrying: number;
    carryMax: number;
    /** What they are doing right now — "Mining", "Hauling", "Scouting"... */
    activity: string;
    /** Normalised 0..1 world position, for the mini map (GDD 8.2/8.5). */
    x: number;
    y: number;
}
/**
 * The gated cart. Ore only becomes score past a single-tile neck, and the gate
 * at its mouth answers to a group rather than to one miner.
 */
export interface VaultState {
    open: boolean;
    minersAtGate: number;
    minersRequired: number;
    /** The player is inside the corridor, where the hazards are thickest. */
    inCorridor: boolean;
}
/** A hazard the crew has spotted, drawn on the mini map. */
export interface HazardMark {
    id: number;
    x: number;
    y: number;
    kind: HazardId;
}
/** A live enemy, for the mini map and the threat readout. */
export interface EnemyMark {
    id: number;
    x: number;
    y: number;
    kind: EnemyId;
    /** 0..1 of its starting health, so the HUD can show a fight in progress. */
    health: number;
    /** Standing on a seam, as opposed to roaming. */
    guarding: boolean;
}
/**
 * What the player is about to swing at. Drives the attack prompt, so the HUD
 * never has to guess what is in range.
 */
export interface TargetState {
    label: string;
    kind: EnemyId;
    health: number;
    /** What the codex says beats it. */
    counter: string;
}
/** GDD 5.5 — a Crystal Core only breaks under the crew's combined power. */
export interface CoopState {
    power: number;
    required: number;
    /** How many miners are contributing, the player included. */
    miners: number;
}
export interface WorldEventState {
    id: WorldEventId;
    label: string;
    blurb: string;
    secondsLeft: number;
}
/** One card of the onboarding sequence (GDD 7.12 — teach by doing). */
export interface TutorialStep {
    id: string;
    title: string;
    body: string;
    /** The key that satisfies it, drawn as a keycap. */
    key?: string;
}
/** A seam a Scout has called out, drawn on the mini map. */
export interface MapPing {
    id: number;
    x: number;
    y: number;
    kind: ResourceId;
}
/**
 * GDD 5.6 / 8.6 — the five quick-chat pings, in order. Lives here rather than in
 * either consumer because the scene acts on them and the HUD draws them, and a
 * second copy of the list is a second place for them to drift out of sync.
 */
export declare const QUICK_CHAT_LINES: readonly {
    key: string;
    label: string;
}[];
export interface HudState {
    secondsLeft: number;
    teamScore: number;
    /** Deposited in the cart — the only resources that count (GDD 4.6). */
    banked: TeamResources;
    /** In the player's pack, still at risk. */
    carried: TeamResources;
    objective: Objective;
    backpack: number;
    backpackMax: number;
    contextPrompt: string | null;
    /** 0..1 while holding to mine, else null. */
    miningProgress: number | null;
    /** Set while the player is working a seam that needs the crew. */
    coop: CoopState | null;
    crew: CrewMemberState[];
    event: WorldEventState | null;
    tutorial: TutorialStep | null;
    pings: MapPing[];
    /** Normalised cart position for the mini map. */
    cart: {
        x: number;
        y: number;
    };
    /** The vault gate in front of the cart. */
    vault: VaultState;
    /** Hazards the crew has revealed, for the mini map. */
    hazards: HazardMark[];
    /** Live enemies, for the mini map. */
    enemies: EnemyMark[];
    /** What the pick is in range of, if anything. */
    target: TargetState | null;
    /** Points earned this run — bounties and banked ore. */
    points: number;
    /** Where the player entered, for the mini map. */
    entrance: {
        x: number;
        y: number;
    };
    /** 0..1 while picking a downed teammate up, with who is being helped. */
    reviving: {
        label: string;
        progress: number;
    } | null;
    ended: boolean;
    won: boolean;
}
/** Sent once when the cave is generated, so the HUD can draw the mini map. */
export interface MineMap {
    cols: number;
    rows: number;
    /** One byte per cell, 1 = rock. */
    walls: Uint8Array;
}
export type GameEvent = {
    hud: (state: HudState) => void;
    map: (map: MineMap) => void;
    /** Transient banner, e.g. "+15 Gold" or a world event announcement. */
    toast: (toast: {
        id: number;
        title: string;
        tone: 'good' | 'warn' | 'event';
    }) => void;
};
declare class GameBus extends Phaser.Events.EventEmitter {
    emitHud(state: HudState): void;
    emitMap(map: MineMap): void;
    emitToast(title: string, tone: 'good' | 'warn' | 'event'): void;
}
export declare const gameBus: GameBus;
export {};
