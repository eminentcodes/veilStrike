import * as THREE from 'three';
import type { ChampionId } from './catalog';
import type { BoneRole } from '../fight/rig';
type Stance = {
    name: string;
    crouch: number;
    lean: number;
    turn: number;
    width: number;
    lead: number;
    right: [number, number, number];
    left: [number, number, number];
    breath: number;
};
/** Coordinates are proportions of body height: hand width, height, forward reach. */
export declare const FIGHTING_STANCES: Record<ChampionId, Stance>;
/** Bake real bone motion over the authored clips. IK keeps soles planted and preserves grips. */
export declare function buildStanceClips(model: THREE.Group, clips: THREE.AnimationClip[], bones: Map<BoneRole, THREE.Object3D>, id: ChampionId): THREE.AnimationClip[];
export {};
