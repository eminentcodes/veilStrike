import * as THREE from 'three';
import type { FighterFrame } from './simulation';
import type { ChampionId } from './catalog';
export declare function createWeapon(id: ChampionId, offhand?: boolean): THREE.Group;
export declare class ChampionRig {
    readonly root: THREE.Group<THREE.Object3DEventMap>;
    readonly id: ChampionId;
    model: THREE.Group | null;
    modelSource: 'blender' | 'legacy';
    private mixer;
    private bones;
    private actions;
    private current;
    private currentKey;
    private lastAttack;
    private lastState;
    private dead;
    private animatedCloth;
    private blinkMeshes;
    private resolveReady;
    constructor(id: ChampionId);
    ready(): Promise<void>;
    private install;
    private addArmor;
    private play;
    animate(f: FighterFrame, dt: number, time: number, preview?: boolean): void;
    dispose(): void;
}
