import * as THREE from 'three';
import type { ArenaId } from './catalog';
export interface ArenaScene {
    flames: THREE.Object3D[];
    ambient: THREE.Points;
}
export declare function buildArena(scene: THREE.Scene, id: ArenaId): ArenaScene;
