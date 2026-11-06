import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import RAPIER from '@dimforge/rapier3d-compat';

import type { FighterId } from './types';
import type { VisualFrame as CurrentVisualFrame, FighterVisual as CurrentFighterVisual } from './visualFrame';
import type { CombatBridge, Side } from './combatEvents';

interface Rig {
  id: FighterId;
  root: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  armFront: THREE.Group;
  armBack: THREE.Group;
  legFront: THREE.Group;
  legBack: THREE.Group;
  weapon: THREE.Group;
  phase: number;
  humanoid: THREE.Group | null;
  mixer: THREE.AnimationMixer | null;
  actions: Map<string, THREE.AnimationAction>;
  activeAction: string;
  bones: Map<string, THREE.Object3D>;
  cloth: THREE.Object3D[];
  poseOffsets: Map<string, THREE.Vector3>;
  reactionUntil: number;
  lastCueAt: number;
}

const FIGHTER_VISUALS: Record<FighterId, { accent: number; bodyScale: number }> = {
  kael: { accent: 0xb52f28, bodyScale: 1.48 },
  ronin: { accent: 0x9c7a4d, bodyScale: 1.54 },
  monk: { accent: 0xc49a55, bodyScale: 1.46 },
  brakk: { accent: 0xd0c9bd, bodyScale: 1.62 },
  shade: { accent: 0x7765c9, bodyScale: 1.5 },
  valen: { accent: 0x5ea895, bodyScale: 1.56 },
};

// Default full-screen impact wash (warm). Ability/parry VFX override with their own tint.
const DEFAULT_FLASH =
  'radial-gradient(circle at 50% 45%, rgba(255,240,210,0.92), rgba(255,150,90,0.25) 55%, transparent 78%)';

export class ThreeStage {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private player: Rig;
  private bot: Rig;
  private frame = 0;
  private particles: THREE.Points;
  private rapierWorld: any = null;
  private rapierBodies: any[] = [];

  // Combat event bus (impacts, hits, specials). The view was previously deaf to this — wiring
  // it up is what makes combat *read*: camera shake, distinct hit/block/parry VFX, per-fighter
  // ability spells, and thrown-knife rendering all key off it.
  private bridge: CombatBridge;
  private unsubs: Array<() => void> = [];
  private flashEl: HTMLDivElement | null = null;

  // Camera framing (smoothed) vs. impact offsets (instant, decaying) — kept separate so a hit
  // punch never fights the slow framing lerp.
  private camSmoothZ = 15.5;
  private camSmoothX = 0;
  private camTargetZ = 15.5;
  private camTargetX = 0;
  private camLookX = 0;
  private shake = 0;
  private zoomPunch = 0;
  private flash = 0;
  private readonly camBaseY = 3.4;

  // Live thrown-knife meshes, keyed by the sim's projectile id (spawn/retire by diffing).
  private projectileMeshes = new Map<number, THREE.Group>();

  // Transient combat VFX are ticked from the single renderLoop (not one rAF each) and share a
  // small pool of geometries (no per-particle GPU-buffer churn). Both matter a lot on the
  // integrated GPUs this runs on; without them, a fast combo spawns dozens of allocations/sec.
  private fxq: Array<{ obj: THREE.Object3D; start: number; ms: number; step: (p: number, o: THREE.Object3D) => void }> = [];
  private geoCache = new Map<string, THREE.BufferGeometry>();
  private lastFlashWritten = -1;
  private static readonly MAX_FX = 90;

  constructor(host: HTMLElement, playerId: FighterId, botId: FighterId, bridge: CombatBridge, onReady?: () => void) {
    this.bridge = bridge;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.resize();
    window.addEventListener('resize', this.resize);
    requestAnimationFrame(this.resize);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'three-stage';
    host.appendChild(this.renderer.domElement);
    this.createFlashOverlay(host);

    this.camera.position.set(0, 3.4, 15.5);
    this.camera.lookAt(0, 2.3, 0);
    this.scene.fog = new THREE.FogExp2(0x211722, 0.043);
    this.scene.background = new THREE.Color(0x552734);
    this.buildArena();
    this.player = this.createFighter(playerId, 0xd04e3d, 0);
    this.bot = this.createFighter(botId, 0xd7d1c5, 1.7);
    this.scene.add(this.player.root, this.bot.root);
    void this.loadHumanoids().then(() => onReady?.());
    this.particles = this.createParticles();
    this.scene.add(this.particles);
    void this.initRapier();
    this.subscribeToCombat();
    this.renderLoop();
  }

  update(frame: CurrentVisualFrame): void {
    this.apply(this.player, frame.player, frame.time, frame.phase === 'entry', frame.entryProgress);
    this.apply(this.bot, frame.bot, frame.time, frame.phase === 'entry', frame.entryProgress);
    const separation = Math.abs(frame.player.x - frame.bot.x);
    // Framing targets only — renderLoop eases toward these and layers impact shake on top.
    this.camTargetZ = THREE.MathUtils.lerp(15.8, 18.2, THREE.MathUtils.clamp((separation - 180) / 520, 0, 1));
    const centerX = ((frame.player.x + frame.bot.x) * 0.5 - 640) / 95;
    this.camTargetX = centerX * 0.12;
    this.camLookX = centerX;
    this.syncProjectiles(frame.projectiles, frame.time);
    if (this.rapierBodies.length === 2) {
      this.rapierBodies[0].setTranslation({ x: frame.player.x / 95, y: 0.9 + frame.player.y / 600, z: 0 }, true);
      this.rapierBodies[1].setTranslation({ x: frame.bot.x / 95, y: 0.9 + frame.bot.y / 600, z: 0 }, true);
    }
  }

  private async initRapier(): Promise<void> {
    await RAPIER.init();
    this.rapierWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floor = this.rapierWorld.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 5).setTranslation(0, 0, 0));
    void floor;
    this.rapierBodies = [0, 1].map(() => {
      const body = this.rapierWorld.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 0));
      this.rapierWorld.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3), body);
      return body;
    });
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    for (const off of this.unsubs) off();
    this.unsubs = [];
    for (const fx of this.fxq) { this.scene.remove(fx.obj); this.disposeFx(fx.obj); }
    this.fxq.length = 0;
    for (const mesh of this.projectileMeshes.values()) { this.scene.remove(mesh); this.disposeFx(mesh); }
    this.projectileMeshes.clear();
    for (const g of this.geoCache.values()) g.dispose();
    this.geoCache.clear();
    this.flashEl?.remove();
    this.flashEl = null;
    this.renderer.dispose();
    this.renderer.domElement.remove();
    window.removeEventListener('resize', this.resize);
  }

  private resize = (): void => {
    const host = this.renderer.domElement.parentElement;
    if (!host) return;
    const maxWidth = Math.max(320, host.clientWidth || window.innerWidth || 1280);
    const maxHeight = Math.max(180, host.clientHeight || window.innerHeight || 720);
    const width = Math.min(maxWidth, maxHeight * 16 / 9);
    const height = width * 9 / 16;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = `${width}px`;
    this.renderer.domElement.style.height = `${height}px`;
  };

  private buildArena(): void {
    const hemi = new THREE.HemisphereLight(0xf6b276, 0x17131c, 2.8);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffc48c, 5.5);
    sun.position.set(-4, 8, 6);
    sun.castShadow = true;
    this.scene.add(sun);
    const rim = new THREE.PointLight(0xd54a3d, 24, 20);
    rim.position.set(3, 3, -4);
    this.scene.add(rim);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 9), new THREE.MeshStandardMaterial({ color: 0x3b3029, roughness: 0.96 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const path = new THREE.Mesh(new THREE.PlaneGeometry(24, 4.8), new THREE.MeshStandardMaterial({ color: 0x6b5542, roughness: 1 }));
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.012, 1.1);
    path.receiveShadow = true;
    this.scene.add(path);

    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(3.1, 64), new THREE.MeshBasicMaterial({ color: 0xf2aa69, fog: false }));
    sunDisc.position.set(0, 4.8, -7);
    this.scene.add(sunDisc);

    const mountainMaterial = new THREE.MeshStandardMaterial({ color: 0x2b1d28, roughness: 1, flatShading: true });
    for (let i = 0; i < 7; i += 1) {
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(2.8 + Math.random() * 2, 5 + Math.random() * 4, 4), mountainMaterial);
      mountain.position.set(-12 + i * 4.2, 2, -6 - Math.random() * 3);
      mountain.rotation.y = Math.PI / 4;
      this.scene.add(mountain);
    }

    const stone = new THREE.MeshStandardMaterial({ color: 0x242126, roughness: 1 });
    for (let i = 0; i < 12; i += 1) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2 + Math.random() * 3, 0.45), stone);
      pillar.position.set(-11 + i * 2, pillar.geometry.parameters.height / 2, -3.8 - Math.random() * 1.4);
      pillar.rotation.z = (Math.random() - 0.5) * 0.18;
      pillar.castShadow = true;
      this.scene.add(pillar);
    }

    const trunk = new THREE.MeshStandardMaterial({ color: 0x3a2923, roughness: 1 });
    const leaves = new THREE.MeshStandardMaterial({ color: 0x263d35, roughness: 0.95, flatShading: true });
    for (const x of [-10.5, -7.8, 7.8, 10.5]) {
      const tree = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.8, 7), trunk);
      stem.position.y = 1.4;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.25, 2.8, 7), leaves);
      crown.position.y = 3.2;
      tree.add(stem, crown);
      tree.position.set(x, 0, -2.8);
      tree.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
      this.scene.add(tree);
    }
  }

  private createFighter(id: FighterId, accent: number, phase: number): Rig {
    const root = new THREE.Group();
    root.visible = true;
    const black = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.56, metalness: 0.08 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.9 });
    const edge = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.42, metalness: 0.6, emissive: accent, emissiveIntensity: 0.08 });
    const heavy = id === 'brakk';

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(heavy ? 0.48 : 0.38, heavy ? 1.15 : 1.05, 6, 10), cloth);
    torso.position.y = 2.35;
    torso.scale.x = heavy ? 1.22 : 1;
    torso.castShadow = true;
    root.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(heavy ? 0.38 : 0.33, 20, 16), black);
    head.position.y = 3.45;
    head.castShadow = true;
    root.add(head);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(heavy ? 0.55 : 0.48, 0.13, 0.12), edge);
    mask.position.set(0, 3.45, 0.29);
    root.add(mask);

    const limb = (length: number, radius: number, material = black) => {
      const joint = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 5, 8), material);
      mesh.position.y = -length / 2;
      mesh.castShadow = true;
      joint.add(mesh);
      root.add(joint);
      return joint;
    };
    const armFront = limb(1.35, heavy ? 0.17 : 0.13);
    const armBack = limb(1.3, heavy ? 0.17 : 0.13);
    armFront.position.set(0.42, 2.85, 0.12);
    armBack.position.set(-0.42, 2.85, -0.08);
    const legFront = limb(1.65, heavy ? 0.2 : 0.16);
    const legBack = limb(1.65, heavy ? 0.2 : 0.16);
    legFront.position.set(0.25, 1.55, 0.1);
    legBack.position.set(-0.25, 1.55, -0.1);

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(heavy ? 0.58 : 0.48, heavy ? 0.58 : 0.48, 0.18, 16), edge);
    belt.position.y = 1.78;
    root.add(belt);
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(heavy ? 0.65 : 1.05, 0.08, 0.18), edge);
    scarf.position.set(-0.45, 3.12, -0.05);
    scarf.rotation.z = 0.2;
    root.add(scarf);

    const weapon = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, heavy ? 2.2 : 2.45, 10), black);
    handle.rotation.z = Math.PI / 2;
    weapon.add(handle);
    const blade = heavy
      ? new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.28), edge)
      : new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 0.2), edge);
    blade.position.x = heavy ? 1.05 : 1.75;
    weapon.add(blade);
    weapon.position.set(0.55, 2.25, 0.35);
    root.add(weapon);

    // The Phaser collision rig is invisible; the imported KayKit model is the only visible fighter.
    torso.visible = false;
    head.visible = false;
    armFront.visible = false;
    armBack.visible = false;
    legFront.visible = false;
    legBack.visible = false;
    weapon.visible = false;

    return { id, root, torso, head, armFront, armBack, legFront, legBack, weapon, phase, humanoid: null, mixer: null, actions: new Map(), activeAction: '', bones: new Map(), cloth: [], poseOffsets: new Map(), reactionUntil: 0, lastCueAt: 0 };
  }

  private async loadHumanoids(): Promise<void> {
    const loader = new GLTFLoader();
    const paths: Record<FighterId, string> = {
      kael: `${import.meta.env.BASE_URL}models/kaykit/Rogue_Hooded.glb`,
      ronin: `${import.meta.env.BASE_URL}models/kaykit/Knight.glb`,
      monk: `${import.meta.env.BASE_URL}models/kaykit/Mage.glb`,
      brakk: `${import.meta.env.BASE_URL}models/kaykit/Barbarian.glb`,
      shade: `${import.meta.env.BASE_URL}models/kaykit/Rogue.glb`,
      valen: `${import.meta.env.BASE_URL}models/kaykit/Knight.glb`,
    };
    const load = async (rig: Rig) => {
      const gltf = await loader.loadAsync(paths[rig.id]);
      this.installHumanoid(rig, gltf.scene, gltf.animations);
    };
    await Promise.all([load(this.player), load(this.bot)]);
  }

  private installHumanoid(rig: Rig, source: THREE.Group, clips: THREE.AnimationClip[]): void {
    const profile = FIGHTER_VISUALS[rig.id];
    const accent = profile.accent;
    const heavy = rig.id === 'brakk' || rig.id === 'valen';
    const model = clone(source) as THREE.Group;
    model.scale.setScalar(profile.bodyScale);
    model.scale.x *= 0.82;
    model.scale.z *= 0.9;
    model.position.y = 0;
    // Rotate KayKit's local forward axis into the side-view combat plane.
    model.rotation.y = Math.PI / 2;
    model.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh || object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const hand = model.getObjectByName('mixamorigRightHand') ?? model.getObjectByName('RightHand');
    if (hand) {
      const weapon = new THREE.Group();
      const metal = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.85, roughness: 0.24, emissive: accent, emissiveIntensity: 0.06 });
      const blade = heavy
        ? new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.05, 0.3), metal)
        : new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.7, 0.18), metal);
      blade.position.y = heavy ? -0.58 : -0.98;
      const grip = new THREE.MeshStandardMaterial({ color: 0x171216, roughness: 0.8 });
      const gripMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 10), grip);
      gripMesh.position.y = 0.22;
      weapon.add(blade, gripMesh);
      weapon.rotation.z = heavy ? 0.1 : -0.08;
      hand.add(weapon);
    }

    const dark = new THREE.MeshStandardMaterial({ color: 0x171216, roughness: 0.86 });
    rig.cloth = this.addWarriorGear(model, accent, heavy, dark);

    rig.root.add(model);
    rig.torso.visible = false;
    rig.head.visible = false;
    rig.armFront.visible = false;
    rig.armBack.visible = false;
    rig.legFront.visible = false;
    rig.legBack.visible = false;
    rig.weapon.visible = false;
    rig.humanoid = model;
    for (const key of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg']) {
      const bone = model.getObjectByName(`mixamorig${key}`) ?? model.getObjectByName(key);
      if (bone) rig.bones.set(key, bone);
    }
    rig.mixer = new THREE.AnimationMixer(model);
    for (const clip of clips) rig.actions.set(clip.name.toLowerCase(), rig.mixer.clipAction(clip));
    this.playAction(rig, 'idle');
  }

  private apply(rig: Rig, state: CurrentFighterVisual, time: number, entering = false, entryProgress = 1): void {
    const visualState = state.state as string;
    if (entering) {
      this.applyEntryPose(rig, state, time, entryProgress);
    }
    if (state.reaction) {
      rig.reactionUntil = time + (state.reaction === 'heavy' || state.reaction === 'knockdown' ? 260 : 150);
      this.spawnHitBurst(rig, state.reaction === 'heavy' || state.reaction === 'knockdown');
    }
    // Signature-ability spells are spawned from the 'special'/'ultimate' events (bespoke per
    // fighter), not here — this keeps the cast VFX in one place and synced to the sim.
    rig.root.position.x = (state.x - 640) / 95;
    // Height above the floor. state.y is the FEET pixel (floor = 600); a jump lifts it.
    const airborneY = Math.max(0, (500 - state.y) / 95);
    rig.root.position.y = airborneY;
    rig.root.rotation.y = state.facing === 1 ? 0 : Math.PI;
    if (rig.humanoid && rig.mixer) {
      // Start each frame from a neutral scale so jump-squash / attack-stretch never accumulate.
      if (!entering) rig.root.scale.set(1, 1, 1);
      const action = this.actionForState(rig, state);
      this.playAction(rig, action);
      rig.mixer.update(1 / 60);
      this.applyCombatPose(rig, state);
      this.animateCloth(rig, state, time);
      rig.root.rotation.z = visualState === 'hit' ? -0.14 * state.facing : visualState === 'knockdown' ? -1.22 * state.facing : 0;
      if (time < rig.reactionUntil) {
        const recoil = state.reaction === 'heavy' || state.reaction === 'knockdown' ? 0.16 : 0.09;
        rig.root.position.x -= state.facing * recoil;
        rig.root.rotation.z -= state.facing * recoil * 0.35;
      }
      if (visualState === 'attack' || visualState === 'special') {
        const p = state.moveProgress;
        const anticipation = p < 0.28 ? -(0.28 - p) * 0.18 : 0;
        const drive = p >= 0.28 && p < 0.62 ? ((p - 0.28) / 0.34) * 0.28 : p >= 0.62 ? (1 - p) * 0.12 : 0;
        rig.root.position.x += state.facing * (anticipation + drive);
        rig.root.rotation.z += state.facing * (p < 0.3 ? -0.08 : p < 0.65 ? 0.1 : -0.04);
        rig.root.scale.x = 1 + Math.sin(p * Math.PI) * 0.05;
        rig.root.scale.z = 1 - Math.sin(p * Math.PI) * 0.04;
        const strike = Math.sin(p * Math.PI);
        const moveId = state.moveId ?? '';
        // Weapon identity changes the attack silhouette: knives thrust, swords cut,
        // and the spear drives in a straight line.
        if (moveId === 'light1') rig.weapon.rotation.z = -0.95 + strike * 1.45;
        else if (moveId === 'light2') rig.weapon.rotation.z = 0.65 - strike * 2.15;
        else if (moveId === 'light3' || moveId === 'heavy') rig.weapon.rotation.z = -1.25 + strike * 2.7;
        else if (state.id === 'kael' || state.id === 'shade') rig.weapon.rotation.z = -0.9 + strike * 1.5;
        else if (state.id === 'valen') rig.weapon.rotation.z = -0.15 + strike * 0.35;
        else if (state.id === 'ronin') rig.weapon.rotation.z = -1.2 + strike * 2.5;
        else rig.weapon.rotation.z = -0.7 + strike * 1.9;
        if (visualState === 'special' && p > 0.3 && p < 0.75) {
          rig.weapon.scale.x = 1.18 + strike * 0.28;
          rig.root.scale.x += 0.06 * strike;
        } else rig.weapon.scale.x = 1;
      }
      if (visualState === 'jump' || visualState === 'dodge') {
        const air = THREE.MathUtils.clamp(Math.abs(state.vy) / 700, 0, 1);
        rig.root.rotation.z += state.facing * (state.vy < 0 ? -0.12 : 0.1);
        rig.root.scale.y = 0.94 + air * 0.08;
        rig.root.scale.x = 1.04 - air * 0.04;
        if (visualState === 'dodge') rig.root.position.x += state.vx * 0.0007;
      }
      // Crouch is the ONLY state that overrides height/scale here. Every other state keeps the
      // airborne height computed above — the old unconditional `position.y = 0` is what pinned
      // jumping fighters to the floor (the "characters feel heavy when they jump" bug).
      if (visualState === 'crouch') {
        rig.root.scale.y = 0.74;
        rig.root.position.y = 0.12;
        rig.torso.rotation.z = -0.12 * state.facing;
      }
      return;
    }
    const walk = state.state === 'move' ? Math.sin(time * 0.012 + rig.phase) : 0;
    rig.legFront.rotation.z = walk * 0.55;
    rig.legBack.rotation.z = -walk * 0.55;
    rig.armFront.rotation.z = -walk * 0.32;
    rig.armBack.rotation.z = walk * 0.32;
    rig.root.rotation.z = visualState === 'hit' ? -0.18 * state.facing : visualState === 'knockdown' ? -1.28 * state.facing : 0;
    const crouched = state.state === 'crouch';
    rig.root.scale.y = crouched ? 0.72 : 1;
    rig.root.position.y = crouched ? 0.14 : airborneY;
    if (state.state === 'block') {
      rig.armFront.rotation.z = -1.3;
      rig.weapon.rotation.z = -0.7;
    } else if (state.state === 'attack') {
      const strike = Math.sin(state.moveProgress * Math.PI);
      rig.armFront.rotation.z = -1.4 + strike * 2.4;
      rig.weapon.rotation.z = -1.1 + strike * 2.2;
      rig.torso.rotation.z = strike * 0.18 * state.facing;
    } else if (crouched) {
      rig.torso.rotation.z = -0.14 * state.facing;
      rig.weapon.rotation.z = -0.7;
    } else {
      rig.weapon.rotation.z = -0.42;
      rig.torso.rotation.z = 0;
    }
    rig.head.position.y = 3.45 + Math.sin(time * 0.003 + rig.phase) * 0.025;
  }

  private applyEntryPose(rig: Rig, _state: CurrentFighterVisual, time: number, progress: number): void {
    const pulse = Math.sin(time * 0.004 + rig.phase) * 0.025;
    const spine = rig.bones.get('Spine');
    const hips = rig.bones.get('Hips');
    const rightArm = rig.bones.get('RightArm');
    const leftArm = rig.bones.get('LeftArm');
    if (spine) spine.rotation.z = pulse;
    if (hips) hips.rotation.z = -pulse * 0.5;
    const profile = rig.id;
    if (rightArm) rightArm.rotation.z = profile === 'brakk' ? -0.7 : profile === 'ronin' ? -0.95 : -0.35;
    if (leftArm) leftArm.rotation.z = profile === 'monk' ? 0.65 : 0.3;
    rig.root.rotation.z = Math.sin(time * 0.002 + rig.phase) * 0.012;
    const flourish = THREE.MathUtils.smoothstep(progress, 0.62, 0.92);
    rig.root.scale.y = 0.96 + flourish * 0.04;
    rig.root.rotation.x = (1 - flourish) * (rig.id === 'brakk' ? -0.08 : 0.04);
  }

  private spawnHitBurst(rig: Rig, heavy: boolean): void {
    const color = rig.id === 'valen' || rig.id === 'monk' ? 0x73d8c3 : rig.id === 'shade' || rig.id === 'kael' ? 0xbca7ff : heavy ? 0xff8b52 : 0xfff0c2;
    const burst = new THREE.Mesh(
      this.geo(heavy ? 'burstBig' : 'burstSmall', () => new THREE.SphereGeometry(heavy ? 0.16 : 0.1, 10, 8)),
      new THREE.MeshBasicMaterial({ color, transparent: true }),
    );
    burst.position.set(rig.root.position.x, rig.root.position.y + 2.2, 0.7);
    this.transient(burst, 180, (p, o) => {
      o.scale.setScalar(1 + p * (heavy ? 4 : 2.5));
      (o.material as THREE.MeshBasicMaterial).opacity = 1 - p;
    });
  }

  // ─── Event-driven combat VFX ─────────────────────────────────────────────────────────────
  // Everything below turns the sim's CombatEvents into things you can SEE: screen flashes,
  // impact sparks, weapon slash arcs, bespoke per-fighter ability spells, and thrown-knife
  // meshes. Wiring this is what stops hits from feeling like "hitting a stone".

  /** Pixels→world X, matching apply()'s hardcoded mapping (arena center 640, /95). */
  private worldX(px: number): number {
    return (px - 640) / 95;
  }

  /** Contact height in world units: Phaser y (floor 600) → ~torso height, clamped sane. */
  private contactY(py: number): number {
    return THREE.MathUtils.clamp((600 - py) / 95, 0, 1.8) + 1.3;
  }

  private rigForSide(side: Side): Rig {
    return side === 'player' ? this.player : this.bot;
  }

  /** Full-screen colour wash via a screen-blend div. `amount` 0..1 peak; decays in renderLoop. */
  private flashScreen(amount: number, tint?: string): void {
    if (!this.flashEl) return;
    this.flashEl.style.background = tint
      ? `radial-gradient(circle at 50% 45%, ${tint}, transparent 74%)`
      : DEFAULT_FLASH;
    this.flash = Math.max(this.flash, Math.min(1, amount));
  }

  private createFlashOverlay(host: HTMLElement): void {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;inset:0;pointer-events:none;opacity:0;z-index:2;will-change:opacity;';
    el.style.background = DEFAULT_FLASH;
    host.appendChild(el);
    this.flashEl = el;
  }

  /** Register a transient object, animated by the shared renderLoop ticker (see tickFx). */
  private transient<T extends THREE.Object3D>(obj: T, ms: number, step: (p: number, obj: T) => void): void {
    // Budget guard: if effects flood in, retire the oldest so cost stays bounded during spam.
    if (this.fxq.length >= ThreeStage.MAX_FX) {
      const oldest = this.fxq.shift();
      if (oldest) { this.scene.remove(oldest.obj); this.disposeFx(oldest.obj); }
    }
    this.scene.add(obj);
    this.fxq.push({ obj, start: performance.now(), ms, step: step as (p: number, o: THREE.Object3D) => void });
  }

  /** Advance every live transient VFX one frame; retire + dispose the finished ones. */
  private tickFx(now: number): void {
    for (let i = this.fxq.length - 1; i >= 0; i--) {
      const fx = this.fxq[i]!;
      const p = Math.min(1, (now - fx.start) / fx.ms);
      fx.step(p, fx.obj);
      if (p >= 1) {
        this.scene.remove(fx.obj);
        this.disposeFx(fx.obj);
        this.fxq.splice(i, 1);
      }
    }
  }

  /** Lazily create + cache a shared VFX geometry. Pooled geometries are never disposed per-use. */
  private geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.geoCache.get(key);
    if (!g) {
      g = make();
      g.userData.pooled = true;
      this.geoCache.set(key, g);
    }
    return g;
  }

  /** Dispose a transient's materials (always) and its geometry (only if not pooled). */
  private disposeFx(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.geometry.userData.pooled) child.geometry.dispose();
        const mat = child.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }

  /** Subscribe the view to every combat moment. Unsubs collected for destroy(). */
  private subscribeToCombat(): void {
    const e = this.bridge.events;
    this.unsubs.push(
      e.on('cameraImpact', ({ magnitude, zoom }) => {
        this.shake = Math.min(1.8, this.shake + magnitude);
        this.zoomPunch = Math.min(2.0, this.zoomPunch + zoom * 6);
      }),
      e.on('hit', (p) => this.spawnImpact(this.worldX(p.x), this.contactY(p.y), p.strength, p.metallic, p.facing)),
      e.on('blocked', (p) => this.spawnBlockSparks(this.worldX(p.x), this.contactY(p.y), p.facing)),
      e.on('perfectParry', (p) => this.spawnParryFlash(this.worldX(p.x), this.contactY(p.y))),
      e.on('guardBroken', (p) => this.spawnGuardBreakVfx(this.worldX(p.x), this.contactY(p.y))),
      e.on('attackStarted', (p) => this.onAttackStarted(p)),
      e.on('special', (p) => this.spawnSpecialVFX(this.rigForSide(p.side))),
      e.on('ultimate', (p) => this.spawnUltimateVFX(this.rigForSide(p.side))),
    );
  }

  /** Every swing draws a visible blade arc in the fighter's accent — heavy swings bigger/slower. */
  private onAttackStarted(p: { side: Side; moveId: string; heavy: boolean }): void {
    const rig = this.rigForSide(p.side);
    const facing: 1 | -1 = rig.root.rotation.y === 0 ? 1 : -1;
    const x = rig.root.position.x + facing * 1.0;
    const y = rig.root.position.y + 1.9;
    this.spawnSlashArc(x, y, facing, FIGHTER_VISUALS[rig.id].accent, p.heavy ? 1.4 : 0.9, p.heavy ? 240 : 160);
  }

  /** A crescent "swing" that sweeps and fades. DoubleSide so the mirrored (negative-scale) side shows. */
  private spawnSlashArc(x: number, y: number, facing: 1 | -1, color: number, scale: number, ms: number): void {
    const arc = new THREE.Mesh(
      this.geo('slashArc', () => new THREE.TorusGeometry(0.6, 0.06, 6, 20, Math.PI * 1.1)),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    arc.position.set(x, y, 0.75);
    arc.rotation.z = facing === 1 ? -Math.PI * 0.25 : Math.PI * 1.25;
    this.transient(arc, ms, (prog, o) => {
      const s = (0.6 + prog * 0.7) * scale;
      o.scale.set(facing * s, s, s);
      o.rotation.z += facing * 0.05;
      (o.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - prog);
    });
  }

  /** Contact spark/dust burst. Metallic = bright sparks, else warmer body-hit. Scales with strength. */
  private spawnImpact(x: number, y: number, strength: string, metallic: boolean, facing: 1 | -1): void {
    const big = strength === 'heavy' || strength === 'critical';
    const coreColor = metallic ? (big ? 0xfff2c0 : 0xffe6a0) : big ? 0xff9a6a : 0xffc79a;
    const flash = new THREE.Mesh(
      this.geo(big ? 'impactBig' : 'impactSmall', () => new THREE.SphereGeometry(big ? 0.22 : 0.14, 12, 10)),
      new THREE.MeshBasicMaterial({ color: coreColor, transparent: true }),
    );
    flash.position.set(x, y, 0.72);
    this.transient(flash, big ? 200 : 150, (prog, o) => {
      o.scale.setScalar(1 + prog * (big ? 4.6 : 3));
      (o.material as THREE.MeshBasicMaterial).opacity = 1 - prog;
    });
    const count = big ? 10 : 6;
    const sparkColor = metallic ? 0xfff6d8 : 0xffcaa0;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const spd = (big ? 3.2 : 2.2) * (0.6 + Math.random() * 0.7);
      const vx = Math.cos(ang) * spd + facing * 0.8;
      const vy = Math.sin(ang) * spd;
      const shard = new THREE.Mesh(
        this.geo('sparkBox', () => new THREE.BoxGeometry(0.05, 0.3, 0.05)),
        new THREE.MeshBasicMaterial({ color: sparkColor, transparent: true }),
      );
      shard.position.set(x, y, 0.72);
      shard.rotation.z = ang;
      this.transient(shard, big ? 260 : 180, (prog, o) => {
        o.position.set(x + vx * prog, y + vy * prog - prog * prog * 1.4, 0.72);
        o.scale.y = 1 - prog * 0.6;
        (o.material as THREE.MeshBasicMaterial).opacity = 1 - prog;
      });
    }
    if (big) this.flashScreen(strength === 'critical' ? 0.6 : 0.36);
  }

  /** Metal-clang: tight blue-white spark cluster flying back off the guard, plus a small ring. */
  private spawnBlockSparks(x: number, y: number, facing: 1 | -1): void {
    const ring = new THREE.Mesh(
      this.geo('blockRing', () => new THREE.TorusGeometry(0.22, 0.03, 6, 16)),
      new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.9 }),
    );
    ring.position.set(x, y, 0.75);
    this.transient(ring, 170, (prog, o) => {
      o.scale.setScalar(1 + prog * 2.2);
      (o.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - prog);
    });
    for (let i = 0; i < 5; i++) {
      const spd = 1.8 + Math.random() * 1.3;
      const ang = (Math.random() - 0.5) * 2.2;
      const vx = -facing * Math.abs(Math.cos(ang)) * spd;
      const vy = Math.abs(Math.sin(ang)) * spd + 1;
      const sx = x - facing * 0.2;
      const shard = new THREE.Mesh(
        this.geo('blockShard', () => new THREE.BoxGeometry(0.04, 0.22, 0.04)),
        new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true }),
      );
      shard.position.set(sx, y, 0.76);
      this.transient(shard, 200, (prog, o) => {
        o.position.set(sx + vx * prog, y + vy * prog - prog * prog * 2.2, 0.76);
        (o.material as THREE.MeshBasicMaterial).opacity = 1 - prog;
      });
    }
  }

  /** Perfect parry: brilliant white radial pop + expanding ring + cool screen flash. */
  private spawnParryFlash(x: number, y: number): void {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
    );
    core.position.set(x, y, 0.8);
    this.transient(core, 220, (prog, o) => {
      o.scale.setScalar(1 + prog * 5);
      (o.material as THREE.MeshBasicMaterial).opacity = 1 - prog;
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.9 }),
    );
    ring.position.set(x, y, 0.8);
    this.transient(ring, 260, (prog, o) => {
      o.scale.setScalar(1 + prog * 4);
      (o.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - prog);
    });
    this.flashScreen(0.55, 'rgba(220,240,255,0.9)');
  }

  /** Guard break: orange glass-shard shatter bursting outward + warm flash. */
  private spawnGuardBreakVfx(x: number, y: number): void {
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2;
      const spd = 2.4 + Math.random() * 1.5;
      const vx = Math.cos(ang) * spd;
      const vy = Math.sin(ang) * spd + 1.2;
      const shard = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.12),
        new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true }),
      );
      shard.position.set(x, y, 0.7);
      this.transient(shard, 420, (prog, o) => {
        o.position.set(x + vx * prog, y + vy * prog - prog * prog * 3.2, 0.7);
        o.rotation.x += 0.3;
        o.rotation.y += 0.24;
        (o.material as THREE.MeshBasicMaterial).opacity = 1 - prog;
      });
    }
    this.flashScreen(0.4, 'rgba(255,180,110,0.85)');
  }

  /** Flat ring expanding across the floor (quakes, ground spells, ultimates). */
  private spawnGroundRing(x: number, groundY: number, color: number, maxScale: number, ms: number): void {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.06, 8, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, groundY + 0.05, 0.2);
    this.transient(ring, ms, (prog, o) => {
      const s = 0.6 + prog * maxScale;
      o.scale.set(s, s, s);
      (o.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - prog);
    });
  }

  /** A forward energy lance (warden beam). */
  private spawnBeam(x: number, y: number, facing: 1 | -1, color: number, len: number, ms: number): void {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.18, 0.18),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }),
    );
    beam.position.set(x + (facing * len) / 2, y, 0.5);
    this.transient(beam, ms, (prog, o) => {
      o.scale.y = 1 + prog * 0.6;
      (o.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - prog);
    });
  }

  /** Bespoke ability spell per fighter — the demanded warden magic, assassin dark-step, etc. */
  private spawnSpecialVFX(rig: Rig): void {
    const facing: 1 | -1 = rig.root.rotation.y === 0 ? 1 : -1;
    const x = rig.root.position.x;
    const y = rig.root.position.y;
    switch (rig.id) {
      case 'valen': {
        // WARDEN'S REACH — teal spell: floor rune ring, rising rune pillars, forward beam, screen wash.
        this.spawnGroundRing(x, y, 0x5ee0c2, 4.5, 420);
        for (let i = 0; i < 3; i++) {
          const rx = x + facing * (0.9 + i * 0.9);
          const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 2, 8),
            new THREE.MeshBasicMaterial({ color: 0x8fe8d8, transparent: true, opacity: 0.75 }),
          );
          pillar.position.set(rx, y + 0.4, 0.2);
          this.transient(pillar, 380, (prog, o) => {
            o.scale.y = 0.2 + prog;
            o.position.y = y + 0.4 + prog * 0.8;
            (o.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - prog);
          });
        }
        this.spawnBeam(x, y + 1.7, facing, 0x7ff0e0, 3.4, 300);
        this.flashScreen(0.4, 'rgba(120,240,220,0.8)');
        break;
      }
      case 'kael':
      case 'shade': {
        // Dark-step: purple after-images trailing behind + soft wash. (Real knives render separately.)
        const ghostColor = rig.id === 'kael' ? 0xb083ff : 0x9f79ff;
        for (let i = 1; i <= 3; i++) {
          const gx = x - facing * i * 0.55;
          const ghost = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 1.7, 0.3),
            new THREE.MeshBasicMaterial({ color: ghostColor, transparent: true, opacity: 0.32 }),
          );
          ghost.position.set(gx, y + 1.5, 0.1);
          this.transient(ghost, 240 + i * 50, (prog, o) => {
            o.position.x = gx + facing * prog * 0.4;
            (o.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - prog);
          });
        }
        this.flashScreen(0.24, 'rgba(150,120,255,0.7)');
        break;
      }
      case 'ronin': {
        // PRECISION DRAW — a single blinding iai slash line that shoots forward.
        const slash = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.5, 0.12),
          new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true }),
        );
        slash.position.set(x + facing * 0.5, y + 1.9, 0.6);
        this.transient(slash, 220, (prog, o) => {
          o.scale.x = 1 + prog * 32;
          o.position.x = x + facing * (0.5 + prog * 1.6);
          (o.material as THREE.MeshBasicMaterial).opacity = 1 - prog;
        });
        this.flashScreen(0.42, 'rgba(255,220,150,0.85)');
        break;
      }
      case 'monk': {
        // FLOW COUNTER — concentric chi rings pulse outward from the fist.
        for (let i = 0; i < 3; i++) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.3, 0.04, 8, 20),
            new THREE.MeshBasicMaterial({ color: 0x73e0c8, transparent: true, opacity: 0.8 }),
          );
          ring.position.set(x + facing * 0.4, y + 1.8, 0.6);
          this.transient(ring, 240 + i * 70, (prog, o) => {
            const s = 0.5 + prog * (2.4 + i);
            o.scale.set(s, s, s);
            (o.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - prog);
          });
        }
        break;
      }
      case 'brakk': {
        // RAGE BREAK — ground quake ring, flung rubble, red aura swell.
        this.spawnGroundRing(x, y, 0xff7045, 5, 380);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const vx = Math.cos(ang) * 2.4;
          const vy = 2.4 + Math.random();
          const rock = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.16, 0.16),
            new THREE.MeshBasicMaterial({ color: 0x6b4a34, transparent: true }),
          );
          rock.position.set(x, y + 0.1, 0.2);
          this.transient(rock, 460, (prog, o) => {
            o.position.set(x + vx * prog, y + 0.1 + vy * prog - prog * prog * 4, 0.2);
            o.rotation.z += 0.2;
            (o.material as THREE.MeshBasicMaterial).opacity = 1 - prog;
          });
        }
        const aura = new THREE.Mesh(
          new THREE.SphereGeometry(0.9, 16, 12),
          new THREE.MeshBasicMaterial({ color: 0xff5030, transparent: true, opacity: 0.3 }),
        );
        aura.position.set(x, y + 1.6, 0);
        this.transient(aura, 340, (prog, o) => {
          o.scale.setScalar(1 + prog * 0.8);
          (o.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - prog);
        });
        this.flashScreen(0.34, 'rgba(255,110,70,0.8)');
        break;
      }
    }
  }

  /** Ultimate: floor shockwave ring + accent light column + white core burst + strong screen flash. */
  private spawnUltimateVFX(rig: Rig): void {
    const facing: 1 | -1 = rig.root.rotation.y === 0 ? 1 : -1;
    const x = rig.root.position.x;
    const y = rig.root.position.y;
    const accent = FIGHTER_VISUALS[rig.id].accent;
    this.spawnGroundRing(x, y, accent, 7, 460);
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.9, 6, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    column.position.set(x, y + 3, 0);
    this.transient(column, 520, (prog, o) => {
      o.scale.x = 1 + prog * 0.4;
      o.scale.z = 1 + prog * 0.4;
      (o.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - prog);
    });
    const burst = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
    );
    burst.position.set(x + facing * 0.3, y + 2, 0.4);
    this.transient(burst, 300, (prog, o) => {
      o.scale.setScalar(1 + prog * 7);
      (o.material as THREE.MeshBasicMaterial).opacity = 1 - prog;
    });
    this.flashScreen(0.8, 'rgba(255,245,225,0.95)');
  }

  /** Mirror the sim's authoritative projectile list into THREE meshes, spawning/retiring by id. */
  private syncProjectiles(list: CurrentVisualFrame['projectiles'], _time: number): void {
    const seen = new Set<number>();
    for (const proj of list) {
      seen.add(proj.id);
      let mesh = this.projectileMeshes.get(proj.id);
      if (!mesh) {
        mesh = this.makeKnifeMesh(FIGHTER_VISUALS[proj.ownerId].accent);
        this.projectileMeshes.set(proj.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(this.worldX(proj.x), this.contactY(proj.y), 0.6);
      const fade = proj.life > 0.85 ? Math.max(0, 1 - (proj.life - 0.85) / 0.15) : 1;
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const m = child.material as THREE.MeshStandardMaterial;
          m.transparent = true;
          m.opacity = fade;
        }
      });
    }
    for (const [id, mesh] of this.projectileMeshes) {
      if (seen.has(id)) continue;
      this.scene.remove(mesh);
      this.disposeFx(mesh);
      this.projectileMeshes.delete(id);
    }
  }

  /** A thrown-knife mesh: metallic blade + accent guard, tinted to the owner. */
  private makeKnifeMesh(color: number): THREE.Group {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(
      this.geo('knifeBlade', () => new THREE.ConeGeometry(0.07, 0.5, 6)),
      new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.8, roughness: 0.3, emissive: color, emissiveIntensity: 0.3 }),
    );
    blade.rotation.z = -Math.PI / 2;
    const guard = new THREE.Mesh(
      this.geo('knifeGuard', () => new THREE.BoxGeometry(0.06, 0.2, 0.06)),
      new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4, emissive: color, emissiveIntensity: 0.35 }),
    );
    guard.position.x = -0.2;
    g.add(blade, guard);
    return g;
  }

  private animateCloth(rig: Rig, state: CurrentFighterVisual, time: number): void {
    const mode = state.state as string;
    const motion = mode === 'move' ? 0.18 : mode === 'attack' ? 0.34 : 0.08;
    const speed = mode === 'attack' ? 0.018 : 0.006;
    rig.cloth.forEach((piece, index) => {
      piece.rotation.z = Math.sin(time * speed + index * 1.7 + rig.phase) * motion - state.facing * state.moveProgress * 0.22;
      piece.rotation.x = Math.cos(time * speed * 0.7 + index) * motion * 0.35;
    });
  }

  private actionForState(rig: Rig, state: CurrentFighterVisual): string {
    const names = [...rig.actions.keys()];
    const find = (terms: string[]): string | null => {
      const match = names.find((name) => terms.some((term) => name.includes(term)));
      return match ?? null;
    };
    if (state.state === 'entry') return find(['idle', 'combat', 'stand', 'ready']) ?? names[0] ?? 'idle';
    if (state.state === 'jump') return find(['jump', 'fall']) ?? names[0] ?? 'idle';
    if (state.state === 'block') return find(['block', 'guard']) ?? 'idle';
    if (state.state === 'hit' || state.state === 'stagger') return find(['hurt', 'hit', 'damage']) ?? 'idle';
    if (state.state === 'knockdown' || state.state === 'defeat') return find(['knock', 'fall', 'die']) ?? 'idle';
    if (state.state === 'attack') return find([state.moveId ?? '', state.moveKind ?? '', 'attack', 'punch', 'kick', 'slash']) ?? names[0] ?? 'idle';
    if (state.state === 'move') return find(['run', 'walk']) ?? names[0] ?? 'idle';
    return find(['idle', 'combat', 'breath', 'stand', 'ready']) ?? names[0] ?? 'idle';
  }

  private applyCombatPose(rig: Rig, state: CurrentFighterVisual): void {
    for (const [name, offset] of rig.poseOffsets) {
      const bone = rig.bones.get(name);
      if (bone) {
        bone.rotation.x -= offset.x;
        bone.rotation.y -= offset.y;
        bone.rotation.z -= offset.z;
      }
    }
    rig.poseOffsets.clear();
    const rotate = (name: string, x = 0, y = 0, z = 0) => {
      const bone = rig.bones.get(name);
      if (!bone) return;
      bone.rotation.x += x;
      bone.rotation.y += y;
      bone.rotation.z += z;
      rig.poseOffsets.set(name, new THREE.Vector3(x, y, z));
    };

    if (state.state === 'jump') {
      const rising = state.vy < -70;
      rotate('Spine', rising ? -0.12 : 0.1, 0, 0);
      rotate('LeftUpLeg', rising ? -0.72 : -0.38, 0, 0.18);
      rotate('RightUpLeg', rising ? -0.36 : -0.82, 0, -0.14);
      rotate('LeftLeg', rising ? 1.05 : 0.74);
      rotate('RightLeg', rising ? 0.72 : 1.12);
      rotate('LeftArm', -0.45, 0, -0.55);
      rotate('RightArm', -0.55, 0, 0.7);
      rotate('LeftForeArm', -0.42);
      rotate('RightForeArm', -0.52);
      return;
    }

    if (state.state === 'crouch') {
      rotate('Hips', 0.24);
      rotate('Spine', -0.18);
      rotate('LeftUpLeg', -0.82, 0, 0.22);
      rotate('RightUpLeg', -0.82, 0, -0.22);
      rotate('LeftLeg', 1.35);
      rotate('RightLeg', 1.35);
    } else if (state.state === 'block') {
      rotate('Spine2', -0.08, 0.2 * state.facing, 0);
      rotate('LeftArm', -0.52, 0, -1.02);
      rotate('RightArm', -0.7, 0, 1.1);
      rotate('LeftForeArm', -1.25, 0, 0.25);
      rotate('RightForeArm', -1.35, 0, -0.22);
      rotate('LeftUpLeg', -0.18, 0, 0.14);
      rotate('RightUpLeg', 0.14, 0, -0.12);
    } else if (state.state === 'attack') {
      const p = PhaserLike.easeStrike(state.moveProgress);
      const power = state.moveKind === 'heavy' || state.moveKind === 'special' || state.moveKind === 'ultimate' ? 1.28 : 0.88;
      const low = state.moveId === 'sweep';
      const rising = state.moveId === 'rising';
      rotate('Hips', 0, p * 0.28 * state.facing, 0);
      rotate('Spine2', (low ? 0.3 : -0.12) * p, p * 0.44 * state.facing, p * 0.12 * state.facing);
      rotate('RightArm', -0.35 - p * power, 0, 0.7 - p * 1.45);
      rotate('RightForeArm', -0.45 - p * 0.85);
      rotate('LeftArm', -0.4, 0, -0.55 + p * 0.2);
      rotate('LeftForeArm', -0.85);
      rotate('LeftUpLeg', low ? -0.95 * p : rising ? -0.4 * p : -0.12, 0, p * 0.12);
      rotate('RightUpLeg', low ? 0.72 * p : rising ? -0.55 * p : 0.1, 0, -p * 0.16);
      if (low) { rotate('LeftLeg', 0.4 * p); rotate('RightLeg', 1.05 * p); }
    } else if (state.state === 'hit' || state.state === 'stagger') {
      rotate('Spine', 0.32, 0, -0.18 * state.facing);
      rotate('Head', -0.18, 0, 0.12 * state.facing);
      rotate('LeftArm', 0.38, 0, -0.5);
      rotate('RightArm', 0.42, 0, 0.55);
    }
  }

  private addWarriorGear(model: THREE.Group, accent: number, heavy: boolean, dark: THREE.Material): THREE.Object3D[] {
    const movingCloth: THREE.Object3D[] = [];
    const armor = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.48, metalness: 0.62, emissive: accent, emissiveIntensity: 0.035 });
    const cloth = new THREE.MeshStandardMaterial({ color: heavy ? 0x251d20 : 0x17161b, roughness: 0.96 });
    const attach = (names: string[], object: THREE.Object3D) => {
      const bone = names.map((name) => model.getObjectByName(name)).find(Boolean);
      bone?.add(object);
    };

    const hood = new THREE.Mesh(new THREE.SphereGeometry(heavy ? 0.18 : 0.19, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.72), cloth);
    hood.scale.set(1.15, 1.25, 1.2);
    hood.position.set(0, 0.07, -0.01);
    attach(['mixamorigHead', 'Head'], hood);

    const faceMask = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.085, 0.035), dark);
    faceMask.position.set(0, 0.015, 0.145);
    attach(['mixamorigHead', 'Head'], faceMask);

    for (const [side, names] of [
      [-1, ['mixamorigLeftShoulder', 'LeftShoulder']],
      [1, ['mixamorigRightShoulder', 'RightShoulder']],
    ] as const) {
      if (!heavy && side === -1) continue;
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(heavy ? 0.17 : 0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), armor);
      pauldron.scale.set(1.35, 0.72, 1.05);
      pauldron.position.set(side * 0.055, 0, 0);
      attach([...names], pauldron);
    }

    const chest = new THREE.Mesh(new THREE.BoxGeometry(heavy ? 0.38 : 0.31, heavy ? 0.38 : 0.31, 0.085), armor);
    chest.position.set(0, 0.17, 0.115);
    chest.rotation.x = -0.08;
    attach(['mixamorigSpine2', 'Spine2', 'mixamorigSpine1', 'Spine1'], chest);

    const sash = new THREE.Mesh(new THREE.BoxGeometry(heavy ? 0.4 : 0.32, 0.075, 0.12), armor);
    sash.position.set(0, 0.02, 0.02);
    attach(['mixamorigHips', 'Hips'], sash);

    const skirt = new THREE.Mesh(new THREE.ConeGeometry(heavy ? 0.24 : 0.2, 0.42, 8, 1, true), cloth);
    skirt.position.y = -0.23;
    attach(['mixamorigHips', 'Hips'], skirt);

    for (const names of [
      ['mixamorigLeftForeArm', 'LeftForeArm'], ['mixamorigRightForeArm', 'RightForeArm'],
      ['mixamorigLeftLeg', 'LeftLeg'], ['mixamorigRightLeg', 'RightLeg'],
    ]) {
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(heavy ? 0.085 : 0.067, heavy ? 0.075 : 0.06, heavy ? 0.25 : 0.2, 12), armor);
      guard.rotation.z = Math.PI / 2;
      attach(names, guard);
    }

    if (!heavy) {
      for (let i = 0; i < 2; i += 1) {
        const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.62 - i * 0.1, 0.045, 0.075), cloth);
        scarf.position.set(-0.33, -0.015 - i * 0.055, -0.06);
        scarf.rotation.z = 0.2 + i * 0.08;
        attach(['mixamorigNeck', 'Neck'], scarf);
        movingCloth.push(scarf);
      }
      const backSheath = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.82, 0.09), dark);
      backSheath.position.set(-0.16, 0.02, -0.16);
      backSheath.rotation.z = -0.52;
      attach(['mixamorigSpine2', 'Spine2'], backSheath);
      for (const side of [-1, 1]) {
        const waistTail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.055), cloth);
        waistTail.position.set(side * 0.11, -0.27, -0.02);
        waistTail.rotation.z = side * 0.1;
        attach(['mixamorigHips', 'Hips'], waistTail);
        movingCloth.push(waistTail);
      }
    } else {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 18, Math.PI * 1.45), armor);
      collar.rotation.x = Math.PI / 2;
      collar.rotation.z = -0.7;
      attach(['mixamorigNeck', 'Neck'], collar);
      const trophyWrap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), cloth);
      trophyWrap.position.set(0, 0.08, -0.12);
      trophyWrap.rotation.z = -0.08;
      attach(['mixamorigSpine2', 'Spine2'], trophyWrap);
      const beltDrop = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.07), armor);
      beltDrop.position.set(0, -0.31, 0.12);
      attach(['mixamorigHips', 'Hips'], beltDrop);
      movingCloth.push(beltDrop);
    }
    return movingCloth;
  }

  private playAction(rig: Rig, preferred: string): void {
    if (rig.activeAction === preferred) return;
    const next = rig.actions.get(preferred) ?? rig.actions.values().next().value;
    if (!next) return;
    const current = rig.actions.get(rig.activeAction);
    current?.fadeOut(0.16);
    next.reset().fadeIn(0.16).play();
    rig.activeAction = preferred;
  }

  private createParticles(): THREE.Points {
    const positions = new Float32Array(180 * 3);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (Math.random() - 0.5) * 24;
      positions[i + 1] = Math.random() * 9;
      positions[i + 2] = -2 + Math.random() * 8;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `uniform float uTime; varying float vFade; void main(){ vec3 p=position; p.y += sin(uTime*0.35+p.x*0.7)*0.08; vFade=0.35+0.65*sin(uTime*0.5+p.x)*0.5; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); gl_PointSize=3.0; }`,
      fragmentShader: `varying float vFade; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor=vec4(0.95,0.52,0.28,(1.0-d*2.0)*vFade); }`,
    });
    return new THREE.Points(geometry, material);
  }

  private renderLoop = (): void => {
    // Combat movement is authored by Phaser; Rapier is kept ready for future
    // environment bodies but is not stepped every render frame.
    this.particles.rotation.y += 0.0005;
    if (this.particles.material instanceof THREE.ShaderMaterial) this.particles.material.uniforms.uTime!.value += 0.016;
    this.particles.position.y += 0.0012;
    if (this.particles.position.y > 1) this.particles.position.y = 0;

    // Camera: ease framing toward the sim's target, then add instant impact shake + zoom punch.
    this.camSmoothZ += (this.camTargetZ - this.camSmoothZ) * 0.08;
    this.camSmoothX += (this.camTargetX - this.camSmoothX) * 0.06;
    const ox = (Math.random() - 0.5) * this.shake * 0.6;
    const oy = (Math.random() - 0.5) * this.shake * 0.4;
    this.camera.position.set(this.camSmoothX + ox, this.camBaseY + oy, this.camSmoothZ - this.zoomPunch);
    this.camera.lookAt(this.camLookX + ox * 0.4, 2.3, 0);
    this.shake *= 0.86; if (this.shake < 0.003) this.shake = 0;
    this.zoomPunch *= 0.82; if (this.zoomPunch < 0.003) this.zoomPunch = 0;

    // Advance every transient combat VFX from this one loop — no per-particle rAF storm.
    this.tickFx(performance.now());

    // Screen flash (heavy hits / parries / ability casts) decays here. Only touch the DOM
    // when the value actually changed, so an idle arena costs zero style writes.
    if (this.flashEl && this.flash !== this.lastFlashWritten) {
      this.flashEl.style.opacity = this.flash < 0.01 ? '0' : this.flash.toFixed(3);
      this.lastFlashWritten = this.flash;
    }
    this.flash *= 0.82; if (this.flash < 0.01) this.flash = 0;

    // Spin/advance live knives so they read as thrown blades even between sim frames.
    for (const mesh of this.projectileMeshes.values()) mesh.rotation.z += 0.5;

    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.renderLoop);
  };
}

const PhaserLike = {
  easeStrike(progress: number): number {
    const p = Math.max(0, Math.min(1, progress));
    return p < 0.42 ? (p / 0.42) * 0.55 : 0.55 + Math.sin(((p - 0.42) / 0.58) * Math.PI) * 0.95;
  },
};
