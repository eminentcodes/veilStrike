import type * as THREE from 'three';
/** Canonical bone roles the procedural poser drives, independent of the rig's naming. */
export type BoneRole = 'Root' | 'Hips' | 'Spine' | 'Spine1' | 'Spine2' | 'Neck' | 'Head' | 'ShoulderL' | 'ShoulderR' | 'ArmL' | 'ArmR' | 'ForeArmL' | 'ForeArmR' | 'HandL' | 'HandR' | 'UpLegL' | 'UpLegR' | 'LegL' | 'LegR' | 'FootL' | 'FootR';
/** Resolve every canonical role to a real Object3D from the model (missing roles omitted). */
export declare function resolveBones(model: THREE.Object3D): Map<BoneRole, THREE.Object3D>;
export interface ClipIndex {
    /** normalized-name → clip name, for scoring. */
    names: string[];
    raw: Map<string, THREE.AnimationClip>;
}
export declare function indexClips(clips: THREE.AnimationClip[]): ClipIndex;
/** Pick the best real clip name for an ordered intent list, or null if nothing scores. */
export declare function resolveClip(index: ClipIndex, intents: string[]): string | null;
/** One-time console dump of the real rig contents so intent lists can be tuned to reality. */
export declare function logRigManifest(id: string, clips: THREE.AnimationClip[], bones: Map<BoneRole, THREE.Object3D>): void;
