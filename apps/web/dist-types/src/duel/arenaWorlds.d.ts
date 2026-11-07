import * as THREE from 'three';
import type { ArenaId } from './catalog';
import type { ArenaScene } from './environment';
/** Four separate worlds. Ashen Sanctum stays in the established arena builder. */
export declare function buildDistinctArena(scene: THREE.Scene, id: Exclude<ArenaId, 'sanctum'>): ArenaScene;
