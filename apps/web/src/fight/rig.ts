// Rig adaptation layer (spec §4, P4). The KayKit "Adventurers" models (Knight, Mage,
// Barbarian, Rogue, Rogue_Hooded) share one skeleton + animation set, but the exact clip
// and bone names must never be hard-assumed by the poser — so this module resolves both at
// runtime against whatever the loaded GLB actually exposes:
//
//   • clips  — each move/state carries an ordered list of *intent keywords*; resolveClip
//              scores every real clip name against them and returns the best match.
//   • bones  — the poser addresses bones by canonical ROLE (Hips, Spine2, ArmR, ForeArmL…);
//              resolveBones maps each role to the real bone via a list of aliases covering
//              KayKit's `UpperArm.R` / bare `Hips` scheme AND Mixamo's `mixamorigRightArm`.
//
// installHumanoid calls logRigManifest once per model so the true names print to the browser
// console; the intent lists in moves.ts/fighters.ts are then trivially fine-tuned to match.

import type * as THREE from 'three';

/** Canonical bone roles the procedural poser drives, independent of the rig's naming. */
export type BoneRole =
  | 'Root'
  | 'Hips'
  | 'Spine'
  | 'Spine1'
  | 'Spine2'
  | 'Neck'
  | 'Head'
  | 'ShoulderL'
  | 'ShoulderR'
  | 'ArmL'
  | 'ArmR'
  | 'ForeArmL'
  | 'ForeArmR'
  | 'HandL'
  | 'HandR'
  | 'UpLegL'
  | 'UpLegR'
  | 'LegL'
  | 'LegR'
  | 'FootL'
  | 'FootR';

/** Aliases per role, most-specific first. Covers three real-world conventions:
 *  KayKit (`UpperArm.R`, bare `Hips`), Mixamo (`mixamorigRightArm`), and generic
 *  `Right`/`Left`-prefixed rigs. Matching is case-insensitive and separator-insensitive. */
const BONE_ALIASES: Record<BoneRole, string[]> = {
  Root: ['root', 'armature', 'rig'],
  Hips: ['hips', 'pelvis', 'mixamorighips'],
  Spine: ['spine', 'spine_01', 'spine.01', 'mixamorigspine'],
  Spine1: ['spine1', 'spine_02', 'spine.02', 'chest', 'mixamorigspine1'],
  Spine2: ['spine2', 'spine_03', 'spine.03', 'upperchest', 'upper_chest', 'mixamorigspine2'],
  Neck: ['neck', 'neck01', 'mixamorigneck'],
  Head: ['head', 'mixamorighead'],
  ShoulderL: ['shoulder.l', 'shoulderl', 'shoulder_l', 'clavicle.l', 'leftshoulder', 'mixamorigleftshoulder'],
  ShoulderR: ['shoulder.r', 'shoulderr', 'shoulder_r', 'clavicle.r', 'rightshoulder', 'mixamorigrightshoulder'],
  ArmL: ['upperarm.l', 'upperarm01.l', 'upperarml', 'upper_arm.l', 'arm.l', 'upperarm_l', 'leftarm', 'mixamorigleftarm'],
  ArmR: ['upperarm.r', 'upperarm01.r', 'upperarmr', 'upper_arm.r', 'arm.r', 'upperarm_r', 'rightarm', 'mixamorigrightarm'],
  ForeArmL: ['lowerarm.l', 'lowerarm01.l', 'lowerarml', 'lower_arm.l', 'forearm.l', 'leftforearm', 'mixamorigleftforearm'],
  ForeArmR: ['lowerarm.r', 'lowerarm01.r', 'lowerarmr', 'lower_arm.r', 'forearm.r', 'rightforearm', 'mixamorigrightforearm'],
  HandL: ['hand.l', 'wrist.l', 'handl', 'hand_l', 'lefthand', 'mixamoriglefthand'],
  HandR: ['hand.r', 'wrist.r', 'handr', 'hand_r', 'righthand', 'mixamorigrighthand'],
  UpLegL: ['upperleg.l', 'upperleg01.l', 'upperlegl', 'upper_leg.l', 'thigh.l', 'leftupleg', 'mixamorigleftupleg'],
  UpLegR: ['upperleg.r', 'upperleg01.r', 'upperlegr', 'upper_leg.r', 'thigh.r', 'rightupleg', 'mixamorigrightupleg'],
  LegL: ['lowerleg.l', 'lowerleg01.l', 'lowerlegl', 'lower_leg.l', 'shin.l', 'calf.l', 'leftleg', 'mixamorigleftleg'],
  LegR: ['lowerleg.r', 'lowerleg01.r', 'lowerlegr', 'lower_leg.r', 'shin.r', 'calf.r', 'rightleg', 'mixamorigrightleg'],
  FootL: ['foot.l', 'footl', 'foot_l', 'leftfoot', 'mixamorigleftfoot'],
  FootR: ['foot.r', 'footr', 'foot_r', 'rightfoot', 'mixamorigrightfoot'],
};

const norm = (s: string): string => s.toLowerCase().replace(/[\s._-]/g, '');

/** Resolve every canonical role to a real Object3D from the model (missing roles omitted). */
export function resolveBones(model: THREE.Object3D): Map<BoneRole, THREE.Object3D> {
  const byNorm = new Map<string, THREE.Object3D>();
  model.traverse((o) => {
    if (o.name) byNorm.set(norm(o.name), o);
  });
  const out = new Map<BoneRole, THREE.Object3D>();
  for (const role of Object.keys(BONE_ALIASES) as BoneRole[]) {
    for (const alias of BONE_ALIASES[role]) {
      const hit = byNorm.get(norm(alias));
      if (hit) {
        out.set(role, hit);
        break;
      }
    }
    // Fallback: substring match (e.g. a rig that suffixes an index) — first alias stem only.
    if (!out.has(role)) {
      const stem = norm(BONE_ALIASES[role][0] ?? role);
      for (const [n, o] of byNorm) {
        if (n.includes(stem) && (role === 'Root' || (o as THREE.Bone).isBone)) {
          out.set(role, o);
          break;
        }
      }
    }
  }
  return out;
}

export interface ClipIndex {
  /** normalized-name → clip name, for scoring. */
  names: string[];
  raw: Map<string, THREE.AnimationClip>;
}

export function indexClips(clips: THREE.AnimationClip[]): ClipIndex {
  const raw = new Map<string, THREE.AnimationClip>();
  for (const c of clips) raw.set(c.name, c);
  return { names: clips.map((c) => c.name), raw };
}

/** Score how well a real clip name satisfies an ordered intent list. Earlier intents weigh
 *  more; an exact/normalized-equal match beats a substring; a substring beats a token overlap. */
function scoreClip(clipName: string, intents: string[]): number {
  const cn = norm(clipName);
  let best = 0;
  for (let i = 0; i < intents.length; i += 1) {
    const it = norm(intents[i] ?? '');
    if (!it) continue;
    const weight = intents.length - i; // ordered preference
    let s = 0;
    if (cn === it) s = 100;
    else if (cn.includes(it)) s = 60 + Math.min(30, it.length); // longer keyword = more specific
    else if (it.includes(cn) && cn.length >= 3) s = 30;
    else {
      // token overlap on separators from the ORIGINAL (un-normalized) names
      const clipTokens = clipName.toLowerCase().split(/[\s._-]+/);
      const itTokens = (intents[i] ?? '').toLowerCase().split(/[\s._-]+/);
      const overlap = itTokens.filter((t) => t.length >= 3 && clipTokens.includes(t)).length;
      if (overlap) s = 12 * overlap;
    }
    best = Math.max(best, s * weight + (s > 0 ? weight : 0));
  }
  return best;
}

/** Pick the best real clip name for an ordered intent list, or null if nothing scores. */
export function resolveClip(index: ClipIndex, intents: string[]): string | null {
  let bestName: string | null = null;
  let bestScore = 0;
  for (const name of index.names) {
    const s = scoreClip(name, intents);
    if (s > bestScore) {
      bestScore = s;
      bestName = name;
    }
  }
  return bestName;
}

/** One-time console dump of the real rig contents so intent lists can be tuned to reality. */
export function logRigManifest(id: string, clips: THREE.AnimationClip[], bones: Map<BoneRole, THREE.Object3D>): void {
  const resolvedRoles = [...bones.entries()].map(([role, o]) => `${role}→${o.name}`);
  const missing = (Object.keys(BONE_ALIASES) as BoneRole[]).filter((r) => !bones.has(r));
  // eslint-disable-next-line no-console
  console.info(
    `%c[Veilstrike rig] ${id}%c\n  clips (${clips.length}): ${clips.map((c) => c.name).join(', ')}\n  bones: ${resolvedRoles.join(', ')}` +
      (missing.length ? `\n  UNRESOLVED roles: ${missing.join(', ')}` : ''),
    'color:#ef7954;font-weight:bold',
    'color:inherit',
  );
}
