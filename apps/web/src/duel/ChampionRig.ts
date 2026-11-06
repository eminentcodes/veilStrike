import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CHAMPIONS } from './catalog';
import type { FighterFrame } from './simulation';
import { angleDelta, moveDuration, DODGE_DURATION } from './simulation';
import { resolveBones, indexClips, resolveClip } from '../fight/rig';
import type { BoneRole } from '../fight/rig';
import type { ChampionId } from './catalog';
import { buildHumanFighter } from './humanRig';

const loader = new GLTFLoader();
const modelCache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>();
function loadModel(name: string) {
  let promise = modelCache.get(name);
  if (!promise) {
    promise = loader.loadAsync(import.meta.env.BASE_URL + 'models/kaykit/' + name + '.glb').then(gltf => ({ scene: gltf.scene, animations: gltf.animations }));
    modelCache.set(name, promise);
    promise.catch(() => modelCache.delete(name));
  }
  return promise;
}
type CharacterAsset = { file: string; height: number; clips: string[] };
async function loadCharacter(id: ChampionId) {
  let entry: CharacterAsset | undefined;
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'models/characters/manifest.json', { cache: 'no-store' });
    const manifest = await response.json() as { characters?: Partial<Record<ChampionId, CharacterAsset>> };
    entry = manifest.characters?.[id];
  } catch { /* The previous rig keeps the lobby usable while assets are built. */ }
  if (!entry) return { ...await loadModel(CHAMPIONS[id].model), original: false, height: 0 };
  const url = import.meta.env.BASE_URL + 'models/characters/' + entry.file;
  let promise = modelCache.get(url);
  if (!promise) {
    promise = loader.loadAsync(url).then(gltf => ({ scene: gltf.scene, animations: gltf.animations }));
    modelCache.set(url, promise); promise.catch(() => modelCache.delete(url));
  }
  return { ...await promise, original: true, height: entry.height };
}
function mesh(geo: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number] = [0, 0, 0]): THREE.Mesh {
  const object = new THREE.Mesh(geo, material);
  object.userData.duelOwned = true; object.position.set(...position); object.castShadow = true; object.receiveShadow = true;
  return object;
}

export function createWeapon(id: ChampionId, offhand = false): THREE.Group {
  const champion = CHAMPIONS[id], accent = new THREE.Color(champion.accent);
  const steel = new THREE.MeshStandardMaterial({ color: 0xafb6bd, metalness: .92, roughness: .24 });
  const black = new THREE.MeshStandardMaterial({ color: 0x20242a, metalness: .65, roughness: .4 });
  const gold = new THREE.MeshStandardMaterial({ color: accent, metalness: .78, roughness: .3 });
  const rune = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2.2, roughness: .24 });
  const weapon = new THREE.Group();
  const cylinder = (radius: number, length: number, material: THREE.Material, y: number) => mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material, [0, y, 0]);
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), material, [x, y, z]);
  if (offhand && (id === 'taren')) {
    const shape = new THREE.Shape();
    shape.moveTo(-.43, .48); shape.lineTo(.43, .48); shape.lineTo(.46, -.1); shape.lineTo(0, -.64); shape.lineTo(-.46, -.1); shape.closePath();
    const shield = mesh(new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: true, bevelSize: .03, bevelThickness: .02, bevelSegments: 1, steps: 1 }), black);
    const rim = new THREE.LineSegments(new THREE.EdgesGeometry(shield.geometry), new THREE.LineBasicMaterial({ color: accent }));
    shield.add(rim);
    weapon.add(shield, box(.045, .8, .045, rune, 0, -.02, .12), box(.6, .045, .05, gold, 0, .08, .13));
    weapon.rotation.y = Math.PI / 2;
  } else if (id === 'neris') {
    weapon.add(cylinder(.055, .34, black, 0), box(.3, .055, .11, gold, 0, .18));
    const blade = mesh(new THREE.ConeGeometry(.12, .8, 3), steel, [0, .62, 0]);
    blade.scale.z = .28;
    weapon.add(blade, box(.025, .5, .026, rune, 0, .56, .042), mesh(new THREE.SphereGeometry(.065, 8, 8), gold, [0, -.2, 0]));
  } else if ((id === 'karen' || id === 'veyra' || id === 'taren')) {
    weapon.add(cylinder(.052, .44, black, 0), cylinder(.16, .05, gold, .24));
    const shape = new THREE.Shape();
    shape.moveTo(-.055, .26); shape.quadraticCurveTo(-.025, 1.2, .17, 1.78); shape.lineTo(.25, 1.93); shape.quadraticCurveTo(.075, 1.3, .07, .26); shape.closePath();
    weapon.add(mesh(new THREE.ExtrudeGeometry(shape, { depth: .028, bevelEnabled: false }), steel), box(.016, 1.2, .027, rune, .045, .92, .034));
    for (let i = 0; i < 5; i++) weapon.add(cylinder(.057, .025, gold, -.17 + i * .078));
  } else if (id === 'mawren') {
    weapon.add(cylinder(.065, 2.8, black, .2));
    for (const y of [-1.12, -.8, -.25, .65, 1.1, 1.5]) weapon.add(cylinder(.093, .11, gold, y));
    for (const y of [-1.28, 1.65]) {
      const crystal = mesh(new THREE.OctahedronGeometry(.18), rune, [0, y, 0]); crystal.scale.y = 1.65; weapon.add(crystal);
      const ring = mesh(new THREE.TorusGeometry(.23, .025, 8, 20), gold, [0, y, 0]); ring.rotation.x = Math.PI / 2; weapon.add(ring);
    }
  } else if ((id === 'nomet' || id === 'varkesh')) {
    weapon.add(cylinder(.08, 2.1, black, .45));
    for (let y = -.45; y < .4; y += .16) weapon.add(cylinder(.09, .04, gold, y));
    const shape = new THREE.Shape();
    shape.moveTo(.02, .88); shape.lineTo(.48, .76); shape.quadraticCurveTo(.83, 1.2, .63, 1.8); shape.lineTo(.09, 1.55); shape.closePath();
    const blade = mesh(new THREE.ExtrudeGeometry(shape, { depth: .13, bevelEnabled: true, bevelSize: .035, bevelThickness: .02, bevelSegments: 1, steps: 1 }), black);
    weapon.add(blade);
    const second = blade.clone(); second.scale.x = -1; weapon.add(second);
    weapon.add(box(.055, .66, .07, rune, .3, 1.24, .16), box(.055, .66, .07, rune, -.3, 1.24, .16), cylinder(.16, .15, gold, 1.24));
  } else if ((id === 'seyra' || id === 'vesper')) {
    weapon.add(cylinder(.06, .58, black, 0), box(.29, .04, .08, gold, 0, .32));
    const shape = new THREE.Shape();
    shape.moveTo(-.055, .32); shape.quadraticCurveTo(-.12, 1.27, .65, 1.6); shape.quadraticCurveTo(.1, .98, .07, .32); shape.closePath();
    weapon.add(mesh(new THREE.ExtrudeGeometry(shape, { depth: .05, bevelEnabled: false }), steel));
    weapon.add(mesh(new THREE.TorusGeometry(.105, .024, 6, 14), rune, [0, -.34, 0]));
  } else {
    weapon.add(cylinder(.058, 3.25, black, .65));
    for (const y of [-.68, .02, .42, 1.92]) weapon.add(cylinder(.08, .15, gold, y));
    const blade = mesh(new THREE.ConeGeometry(.16, .68, 4), steel, [0, 2.32, 0]); blade.scale.z = .35; weapon.add(blade);
    weapon.add(box(.025, .48, .025, rune, 0, 2.25, .057));
    for (const side of [-1, 1]) {
      const wing = box(.09, .4, .065, gold, side * .16, 2.01); wing.rotation.z = side * -.45; weapon.add(wing);
    }
  }
  return weapon;
}

export class ChampionRig {
  readonly root = new THREE.Group();
  readonly id: ChampionId;
  model: THREE.Group | null = null;
  modelSource: 'blender' | 'legacy' = 'legacy';
  private mixer: THREE.AnimationMixer | null = null;
  private bones = new Map<BoneRole, THREE.Object3D>();
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private currentKey = '';
  private lastState = '';
  private dead = false;
  private animatedCloth: THREE.Object3D[] = [];
  private blinkMeshes: THREE.Mesh[] = [];
  private resolveReady: Promise<void>;
  constructor(id: ChampionId) {
    this.id = id;
    this.root.name = 'champion-' + id;
    const shadow = mesh(new THREE.CircleGeometry(.62, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .24, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .025; this.root.add(shadow);
    this.resolveReady = this.install();
  }
  ready(): Promise<void> { return this.resolveReady; }
  private async install(): Promise<void> {
    const asset = await loadCharacter(this.id);
    if (this.dead) return;
    const model = clone(asset.scene) as THREE.Group;
    this.modelSource = asset.original ? 'blender' : 'legacy';
    const clips = asset.original ? asset.animations : buildHumanFighter(model, this.id, asset.animations);
    model.traverse(o => {
      if (o instanceof THREE.Mesh) {
        const originals = Array.isArray(o.material) ? o.material : [o.material];
        const materials = originals.map(original => {
          const mat = original.clone() as THREE.MeshStandardMaterial;
          if (!asset.original) { mat.roughness = .64; mat.metalness = .12; }
          if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
          return mat;
        });
        o.material = Array.isArray(o.material) ? materials : materials[0]!;
        if (o instanceof THREE.SkinnedMesh) o.frustumCulled = false;
        if (o.morphTargetDictionary?.Blink !== undefined) this.blinkMeshes.push(o);
        o.castShadow = true; o.receiveShadow = true;
      }
    });
    this.bones = resolveBones(model);
    if (asset.original) {
      const right = model.getObjectByName('wrist.R') ?? model.getObjectByName('wristR') ?? model.getObjectByName('wrist.r') ?? model.getObjectByName('wristr');
      const left = model.getObjectByName('wrist.L') ?? model.getObjectByName('wristL') ?? model.getObjectByName('wrist.l') ?? model.getObjectByName('wristl');
      if (right) this.bones.set('HandR', right);
      if (left) this.bones.set('HandL', left);
    }
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = 2.45 * CHAMPIONS[this.id].size / Math.max(asset.original ? asset.height : size.y, .01);
    model.scale.setScalar(scale);
    model.position.y = -box.min.y * scale;
    this.model = model; this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    const index = indexClips(clips);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
    const add = (name: string, role: BoneRole, object: THREE.Object3D) => {
      const slot = model.getObjectByName(name) ?? model.getObjectByName(name.replaceAll('.', '_')) ?? this.bones.get(role);
      if (!slot) throw new Error('Missing weapon attachment for ' + this.id + ': ' + role);
      slot.add(object);
    };
    if (!asset.original) {
    const mainWeapon = createWeapon(this.id);
    mainWeapon.scale.setScalar(1 / scale);
    mainWeapon.rotation.x = Math.PI / 2;
    add('handslot.r', 'HandR', mainWeapon);
    if (this.id === 'neris' || this.id === 'taren' || this.id === 'vesper') {
      const second = createWeapon(this.id, true); second.scale.setScalar(1 / scale);
      if (this.id === 'neris') second.rotation.x = Math.PI / 2;
      add('handslot.l', 'HandL', second);
    }
    }
    this.addArmor(scale);
    const idle = resolveClip(index, ['Idle', '2H_Melee_Idle', 'Unarmed_Idle']);
    if (idle) this.play(idle, false, 'idle');
  }
  private addArmor(_scale: number): void {
    this.model?.traverse(object => { if (object.userData.duelCape) this.animatedCloth.push(object); });
  }
  private play(name: string, once: boolean, key: string, duration?: number): void {
    const next = this.actions.get(name);
    if (!next || (this.currentKey === key && this.current === next)) return;
    const previous = this.current;
    const gaitPhase = previous && this.currentKey.startsWith('locomotion') && key.startsWith('locomotion') ? (previous.time / previous.getClip().duration) % 1 : null;
    this.current = next; this.currentKey = key;
    next.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.enabled = true;
    next.setEffectiveTimeScale(duration ? next.getClip().duration / duration : 1);
    next.setEffectiveWeight(1).play();
    if (gaitPhase !== null) next.time = gaitPhase * next.getClip().duration;
    if (previous && previous !== next) next.crossFadeFrom(previous, once ? .075 : .15, false);
  }
  animate(f: FighterFrame, dt: number, time: number, preview = false): void {
    if (!this.mixer || !this.model) return;
    if (!preview) {
      const smoothing = 1 - Math.exp(-55 * dt);
      this.root.position.x += (f.x - this.root.position.x) * smoothing;
      this.root.position.z += (f.z - this.root.position.z) * smoothing;
      this.root.position.y = f.y;
      this.root.rotation.y += angleDelta(this.root.rotation.y, f.yaw) * (1 - Math.exp(-26 * dt));
    }
    let terms: string[] = preview ? ['Lobby_Idle','Idle','2H_Melee_Idle'] : ['Idle','2H_Melee_Idle'];
    let once = false, duration: number | undefined, key: string = f.state;
    if (f.attack) {
      const move = CHAMPIONS[this.id].moves[f.attack.id];
      terms = [move.clip[f.attack.combo % move.clip.length]!, ...move.clip];
      once = true; duration = moveDuration(move);
      key = f.attack.id + '-' + f.attack.combo + '-' + f.attack.startedAt;
    } else if (f.state === 'dodge') {
      const forward = f.dodgeX * Math.sin(f.yaw) + f.dodgeZ * Math.cos(f.yaw);
      const lateral = f.dodgeX * Math.cos(f.yaw) - f.dodgeZ * Math.sin(f.yaw);
      terms = [Math.abs(lateral) > Math.abs(forward) ? lateral > 0 ? 'Dodge_Right' : 'Dodge_Left' : forward > 0 ? 'Dodge_Forward' : 'Dodge_Back','Dodge_Forward']; once = true; duration = DODGE_DURATION;
    }
    else if (f.state === 'guard') terms = ['Guard','Blocking','Block'];
    else if (f.state === 'jump') { terms = ['Jump','Jump_Full','Jump_Idle']; once = true; duration = .72; }
    else if (f.state === 'grapple') { terms = ['Grapple','Punch_C']; once = true; duration = .80; }
    else if (f.state === 'grabbed') { terms = ['Grabbed','Hit']; once = true; duration = .56; }
    else if (f.state === 'thrown') { terms = ['Thrown','Fall','Death']; once = true; duration = .5; }
    else if (f.state === 'knockdown') { terms = ['Fall','Death']; once = true; duration = .62; }
    else if (f.state === 'getup') { terms = ['GetUp','Idle']; once = true; duration = .48; }
    else if (f.state === 'stagger') { terms = ['Hit','Hit_B','Hit_A']; once = true; duration = f.stunDuration; }
    else if (f.state === 'dead') { terms = ['Death','Death_A','Death_B']; once = true; duration = 1.3; }
    else if (f.state === 'move' || f.state === 'sprint') {
      const forward = f.vx * Math.sin(f.yaw) + f.vz * Math.cos(f.yaw);
      const lateral = f.vx * Math.cos(f.yaw) - f.vz * Math.sin(f.yaw);
      const speed = Math.hypot(f.vx, f.vz);
      terms = Math.abs(lateral) > Math.abs(forward) * 1.2 ? [lateral > 0 ? 'Strafe_Right' : 'Strafe_Left','Walking_A'] : forward < -.6 ? ['Walk_Back','Walking_Backwards','Walking_A'] : f.state === 'sprint' || speed > 2.7 ? ['Run','Running_B','Running_A'] : ['Walk','Walking_A','Running_A'];
      key = 'locomotion-' + terms[0];
    }
    if (this.lastState !== f.state && once) this.currentKey = '';
    const index = { names: [...this.actions.keys()], raw: new Map<string, THREE.AnimationClip>() };
    const name = resolveClip(index, terms);
    if (name) this.play(name, once, key, duration);
    if (!once && this.current && key.startsWith('locomotion')) {
      const strideSpeed = this.current.getClip().name === 'Run' ? 4.45 : this.current.getClip().name.startsWith('Strafe') ? 1.75 : 1.95;
      this.current.setEffectiveTimeScale(Math.max(.35, Math.min(2.4, Math.hypot(f.vx, f.vz) / strideSpeed)));
    }
    this.mixer.update(dt);
    if (once && this.current) {
      const elapsed = f.attack?.elapsed ?? f.stateTime;
      const total = f.attack ? moveDuration(CHAMPIONS[this.id].moves[f.attack.id]) : duration;
      if (total) {
        let progress = Math.max(0, elapsed) / total;
        if (f.attack) {
          const move = CHAMPIONS[this.id].moves[f.attack.id];
          progress = elapsed < move.startup ? elapsed / move.startup * .42 : elapsed < move.startup + move.active ? .42 + (elapsed - move.startup) / move.active * .23 : .65 + (elapsed - move.startup - move.active) / move.recovery * .35;
        }
        this.current.time = Math.min(this.current.getClip().duration, progress * this.current.getClip().duration); this.mixer.update(0);
      }
    }
    const blinkPhase = time % 4.8;
    const blink = blinkPhase > 3.82 && blinkPhase < 4.02 ? Math.sin((blinkPhase - 3.82) / .20 * Math.PI) : 0;
    for (const mesh of this.blinkMeshes) if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) mesh.morphTargetInfluences[mesh.morphTargetDictionary.Blink!] = f.state === 'dead' ? 1 : blink;
    for (const [i, piece] of this.animatedCloth.entries()) { piece.rotation.x = -.18 + Math.sin(time * 2.5 + i) * .035 + Math.min(.17, Math.hypot(f.vx, f.vz) * .024); }
    this.lastState = f.state;
  }
  dispose(): void {
    this.dead = true;
    this.mixer?.stopAllAction(); if (this.model) this.mixer?.uncacheRoot(this.model);
    this.root.traverse(o => {
      if (o instanceof THREE.Mesh) {
        // GLTF geometry and textures belong to the shared model cache.
        if (o.userData.duelOwned) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      }
    });
    this.root.removeFromParent();
  }
}


