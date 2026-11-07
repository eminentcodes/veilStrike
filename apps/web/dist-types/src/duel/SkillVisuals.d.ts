import * as THREE from 'three';
import type { DuelSnapshot } from './simulation';
import type { ChampionRig } from './ChampionRig';
/** Persistent physical skill visuals follow the same authoritative fighter state as damage. */
export declare class SkillVisuals {
    private scene;
    private chains;
    private seals;
    private wards;
    private bolts;
    bolt(slot: number, state: DuelSnapshot, ultimate: boolean): void;
    constructor(scene: THREE.Scene);
    clear(): void;
    update(state: DuelSnapshot, fighters: ChampionRig[], time: number, dt: number): void;
}
