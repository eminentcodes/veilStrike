import type { ArenaId, Champion, ChampionId } from './catalog';
import type { DuelEvent, DuelSnapshot, Slot } from './simulation';
interface CombatAudio {
    sound: (name: string, gain?: number, pan?: number) => unknown;
    announce: (cue: string, priority?: number, force?: boolean) => void;
    combatImpact: (heavy: boolean, fists: boolean, pan: number) => void;
    ultimate: (id: string, skill: string) => void;
}
export declare function arenaSurface(arena: ArenaId): string;
/** Impacts follow contact, floor sounds follow landing, and footsteps follow travel. */
export declare class DuelSoundscape {
    private audio;
    private champions;
    private surface;
    private floorPlayed;
    private equipmentPlayed;
    private collapsePlayed;
    private getupPlayed;
    private positions;
    private resultRound;
    constructor(arena: ArenaId, audio: CombatAudio, champions: Record<ChampionId, Champion>);
    event(event: DuelEvent, snapshot: DuelSnapshot, viewer: Slot): void;
    update(snapshot: DuelSnapshot, viewer: Slot): void;
}
export {};
