import * as THREE from 'three';
import { CHAMPIONS } from './catalog';
import type { ChampionId } from './catalog';

const normalize = (name: string) => name.toLowerCase().replace(/[\s._:\-]/g, '');
function factors(name: string): THREE.Vector3 {
  const key = normalize(name);
  if (key === 'hips') return new THREE.Vector3(1, 2, 1);
  if (key.startsWith('lowerleg') || key.startsWith('foot')) return new THREE.Vector3(1.9, 1.9, 1.9);
  if (key.startsWith('upperleg')) return new THREE.Vector3(.86, 1, 1);
  if (key.startsWith('lowerarm')) return new THREE.Vector3(1.15, 1.15, 1.15);
  if (key.startsWith('wrist')) return new THREE.Vector3(1.12, 1.12, 1.12);
  return new THREE.Vector3(1, 1, 1);
}

/** Original articulated fighter bodies, retargeted to the supplied KayKit animation skeleton. */
export function buildHumanFighter(model: THREE.Group, id: ChampionId, sourceClips: THREE.AnimationClip[]): THREE.AnimationClip[] {
  const champion = CHAMPIONS[id], premium = champion.cost > 0;
  const bones = new Map<string, THREE.Object3D>();
  const remove: THREE.Object3D[] = [];
  model.traverse(object => {
    if (object instanceof THREE.Mesh) remove.push(object);
    else if (object.name) bones.set(normalize(object.name), object);
  });
  for (const object of remove) object.removeFromParent();
  for (const [name, bone] of bones) bone.position.multiply(factors(name));
  const clips = sourceClips.map(original => {
    const clip = original.clone();
    for (const track of clip.tracks) {
      if (!track.name.endsWith('.position')) continue;
      const name = track.name.slice(0, -9), ratio = factors(name);
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = track.values[i]! * ratio.x;
        track.values[i + 1] = track.values[i + 1]! * ratio.y;
        track.values[i + 2] = track.values[i + 2]! * ratio.z;
        if (normalize(name) === 'root') { track.values[i] = 0; track.values[i + 2] = 0; }
      }
    }
    return clip;
  });
  const accent = new THREE.Color(champion.accent);
  const steel = new THREE.MeshStandardMaterial({ color: premium ? 0x565e68 : 0x414953, metalness: .8, roughness: .36 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: .8, metalness: .15 });
  const trim = new THREE.MeshStandardMaterial({ color: accent, metalness: .8, roughness: .27 });
  const luminous = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: premium ? 2 : .8, roughness: .35 });
  const leather = new THREE.MeshStandardMaterial({ color: id === 'mawren' ? 0x67533c : id === 'veyra' ? 0x4b2428 : 0x30292c, roughness: .92 });
  const cloth = new THREE.MeshStandardMaterial({ color: id === 'rhoven' ? 0x304855 : id === 'taren' ? 0x6a6047 : id === 'seyra' || id === 'vesper' ? 0x302338 : 0x292b31, side: THREE.DoubleSide, roughness: .95 });
  const heavy = ['cinder','earth','chain','sun','storm'].includes(champion.skill);
  const radius = heavy ? .095 : .075;
  const object = (geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], scale: [number, number, number] = [1, 1, 1]): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.scale.set(...scale); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.duelOwned = true; return mesh;
  };
  const attach = (name: string, mesh: THREE.Object3D) => { bones.get(normalize(name))?.add(mesh); };
  const sphere = (r: number, mat: THREE.Material, p: [number, number, number], s: [number, number, number] = [1, 1, 1]) => object(new THREE.SphereGeometry(r, 12, 8), mat, p, s);
  const box = (size: [number, number, number], mat: THREE.Material, p: [number, number, number]) => object(new THREE.BoxGeometry(...size), mat, p);
  const capsule = (name: string, next: string, r: number, mat: THREE.Material) => {
    const child = bones.get(normalize(next));
    if (!child) return;
    const direction = child.position.clone(), length = direction.length();
    const part = object(new THREE.CapsuleGeometry(r, Math.max(.01, length - r * 1.2), 4, 8), mat, [direction.x * .5, direction.y * .5, direction.z * .5]);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); attach(name, part);
  };
  // Long legs, a narrow armored waist, and human head proportions.
  attach('hips', sphere(.16, leather, [0, .065, 0], [1.3, .65, .9]));
  attach('hips', box([.34, .055, .23], trim, [0, .14, 0]));
  attach('hips', box([.08, .08, .035], steel, [0, .14, .14]));
  attach('spine', sphere(.16, dark, [0, .07, 0], [1.05, 1.1, .72]));
  const torso = sphere(.21, heavy ? steel : leather, [0, -.06, 0], [heavy ? 1.28 : 1.05, 1, .67]); attach('chest', torso);
  const breastplate = box([heavy ? .38 : .31, .28, .065], steel, [0, -.04, .13]);
  breastplate.rotation.x = -.1; attach('chest', breastplate);
  for (let i = 0; i < 3; i++) attach('spine', box([.27 - i * .015, .045, .19], steel, [0, -.015 + i * .07, .025]));
  const chestRune = object(new THREE.TorusGeometry(.048, .009, 6, 16), trim, [0, .04, .177]); attach('chest', chestRune);
  attach('chest', object(new THREE.OctahedronGeometry(.028), luminous, [0, .04, .182]));
  for (const side of ['l','r']) {
    const sign = side === 'l' ? 1 : -1;
    capsule('upperarm.' + side, 'lowerarm.' + side, radius, dark);
    capsule('lowerarm.' + side, 'wrist.' + side, radius * .85, steel);
    attach('upperarm.' + side, sphere(radius * 1.45, steel, [0, .025, 0], [1.05, 1, 1]));
    attach('upperarm.' + side, box([.09, .13, .13], trim, [0, .055, -.035]));
    attach('lowerarm.' + side, sphere(radius * .95, trim, [0, 0, 0]));
    attach('wrist.' + side, sphere(.055, leather, [0, .015, 0], [.8, 1.1, .7]));
    attach('hand.' + side, box([.065, .09, .06], dark, [0, .045, 0]));
    capsule('upperleg.' + side, 'lowerleg.' + side, heavy ? .115 : .095, leather);
    capsule('lowerleg.' + side, 'foot.' + side, heavy ? .105 : .082, steel);
    attach('lowerleg.' + side, sphere(.11, steel, [0, .025, -.025], [.9, .9, .7]));
    attach('lowerleg.' + side, box([.055, .14, .015], trim, [0, .12, -.09]));
    attach('foot.' + side, sphere(.11, dark, [0, .025, -.015], [.85, 1.35, .6]));
    const skirt = box([.16, .26, .04], heavy ? steel : cloth, [sign * .125, -.04, .12]);
    skirt.rotation.z = -sign * .12; attach('hips', skirt);
    if (premium) {
      const fin = object(new THREE.ConeGeometry(.04, .19, 4), trim, [0, .04, -.11]); fin.rotation.x = Math.PI / 2; attach('upperarm.' + side, fin);
      attach('lowerarm.' + side, box([.024, .14, .015], luminous, [0, .1, -.07]));
    }
  }
  attach('head', object(new THREE.CylinderGeometry(.06, .065, .14, 8), dark, [0, -.065, 0]));
  attach('head', sphere(.13, steel, [0, .085, 0], [.92, 1.15, .9]));
  const visor = box([.2, .022, .04], dark, [0, .10, .117]); attach('head', visor);
  for (const x of [-.05, .05]) attach('head', box([.038, .008, .015], luminous, [x, .1, .143]));
  const noseGuard = box([.032, .095, .035], trim, [0, .04, .136]); attach('head', noseGuard);
  attach('head', object(new THREE.ConeGeometry(.09, .105, 4), steel, [0, -.005, .047]));
  if (['shadow','veil','void'].includes(champion.skill)) {
    const hood = sphere(.16, cloth, [0, .10, -.014], [1.1, 1.25, .9]); attach('head', hood);
    attach('head', box([.24, .1, .045], cloth, [0, .21, .105]));
    // The steel mask remains visible below the hood's brow.
    attach('head', box([.21, .06, .04], dark, [0, .055, .145]));
    for (const x of [-.05, .05]) attach('head', box([.04, .009, .015], luminous, [x, .1, .15]));
  } else if (id === 'karen') {
    const crest = object(new THREE.TorusGeometry(.12, .018, 6, 18, Math.PI), trim, [0, .2, .02]); attach('head', crest);
  } else if (heavy || premium) {
    for (const sign of [-1, 1]) {
      const horn = object(new THREE.ConeGeometry(.035, premium ? .25 : .13, 5), trim, [sign * .09, .23, -.015]);
      horn.rotation.z = sign * -.38; attach('head', horn);
    }
  }
  if (premium) {
    const crest = box([.018, .16, .19], trim, [0, .23, 0]); attach('head', crest);
    for (const side of [-1, 1]) attach('chest', box([.023, .16, .02], luminous, [side * .12, -.02, .171]));
  }
  // Articulated cloth panels move with the torso and hips; armor stays attached to joints.
  if (id !== 'nomet' && id !== 'varkesh') {
    const cape = object(new THREE.PlaneGeometry(.42, .73, 2, 4), cloth, [0, -.22, -.14]);
    cape.rotation.x = -.13; cape.userData.duelCape = true; attach('chest', cape);
  }
  if (id === 'rhoven') {
    for (const side of [-1, 1]) attach('upperarm.' + (side === 1 ? 'l' : 'r'), object(new THREE.OctahedronGeometry(.12), luminous, [0, .035, -.1], [.65, 1.8, .6]));
  }
  if (id === 'varkesh') {
    for (let i = 0; i < 4; i++) attach('chest', object(new THREE.DodecahedronGeometry(.08, 0), steel, [(i % 2 ? 1 : -1) * .15, .1 - Math.floor(i / 2) * .14, .1]));
  }
  return clips;
}
