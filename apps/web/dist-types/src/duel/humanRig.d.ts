import * as THREE from 'three';
import type { ChampionId } from './catalog';
/** Original articulated fighter bodies, retargeted to the supplied KayKit animation skeleton. */
export declare function buildHumanFighter(model: THREE.Group, id: ChampionId, sourceClips: THREE.AnimationClip[]): THREE.AnimationClip[];
