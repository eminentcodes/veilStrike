import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ChampionRig } from './ChampionRig';
import { buildArena } from './environment';
import type { ArenaScene } from './environment';
import { CHAMPIONS } from './catalog';
import type { DuelConfig } from './catalog';
import type { DuelSnapshot, DuelEvent, Slot } from './simulation';

interface Spark { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: THREE.Color; }
interface Effect { object: THREE.Mesh | THREE.Sprite; age: number; life: number; baseScale: number; grow: number; float: number; }

export class DuelRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 16 / 9, .1, 150);
  readonly renderer: THREE.WebGLRenderer;
  readonly fighters: [ChampionRig, ChampionRig];
  readonly ready: Promise<void>;
  private composer: EffectComposer | null = null;
  private arena: ArenaScene;
  private sparks: Spark[] = [];
  private sparkMesh: THREE.InstancedMesh;
  private effects: Effect[] = [];
  private telegraphs: [THREE.Mesh, THREE.Mesh];
  private telegraphKey = ['', ''];
  private strikeElapsed = [0, 0];
  private dummy = new THREE.Object3D();
  private shake = 0;
  private zoom = 0;
  private time = 0;
  private host: HTMLElement;
  private observer: ResizeObserver;
  private dead = false;
  private flash: HTMLDivElement;
  private flashAmount = 0;
  private seenEvent = 0;
  private preview = false;
  private previewSignatureAt = -100;
  private nextPreviewSignature = 3;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private slot: Slot = 0;
  locked = true;
  private look = new THREE.Vector3();
  private desiredCamera = new THREE.Vector3();
  private desiredLook = new THREE.Vector3();

  constructor(host: HTMLElement, config: DuelConfig, preview = false, highQuality = true) {
    this.host = host; this.preview = preview;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, preview ? 1.3 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = !preview;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'duel-canvas';
    host.append(this.renderer.domElement);
    this.arena = buildArena(this.scene, config.arena);
    if (preview) {
      const key = new THREE.PointLight(0xffe0b6, 26, 18, 2); key.position.set(-2.2, 4.2, 3.7); this.scene.add(key);
      const fill = new THREE.PointLight(0xb4d2e5, 13, 16, 2); fill.position.set(2.6, 2.5, 2); this.scene.add(fill);
      const rim = new THREE.PointLight(0xd5eaf3, 21, 16, 2); rim.position.set(.4, 3.6, -2); this.scene.add(rim);
    }
    this.fighters = [new ChampionRig(config.player), new ChampionRig(config.opponent)];
    this.scene.add(...this.fighters.map(f => f.root));
    this.fighters[0].root.position.set(-1.4, 0, 4.3); this.fighters[0].root.rotation.y = Math.PI;
    this.fighters[1].root.position.set(1.4, 0, -4.3);
    if (preview) {
      this.fighters[0].root.position.set(0, 0, 0); this.fighters[0].root.rotation.y = -.12;
      this.fighters[1].root.visible = false;
      this.camera.fov = 36; this.camera.updateProjectionMatrix();
    }
    this.ready = Promise.all((preview ? [this.fighters[0]] : this.fighters).map(f => f.ready())).then(() => undefined);
    const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.sparkMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 4, 3), sparkMaterial, 300);
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.sparkMesh.frustumCulled = false; this.sparkMesh.count = 0; this.scene.add(this.sparkMesh);
    this.telegraphs = [0, 1].map(i => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x8dbcd0 : 0xe77b5e, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = .04; m.visible = false; this.scene.add(m); return m;
    }) as unknown as [THREE.Mesh, THREE.Mesh];
    this.flash = document.createElement('div'); this.flash.className = 'duel-impact'; host.append(this.flash);
    if (highQuality && !preview) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(800, 450), .36, .45, 1.1));
      this.composer.addPass(new OutputPass());
    }
    this.camera.position.set(0, preview ? 2.1 : 4.6, preview ? 6.6 : 11); this.look.set(0, preview ? 1.45 : 1.8, 0);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host); this.resize();
  }
  private resize(): void {
    if (this.dead) return;
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false); this.composer?.setSize(width, height);
  }
  movementBasis(): { forwardX: number; forwardZ: number; rightX: number; rightZ: number } {
    const forward = new THREE.Vector3(); this.camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    return { forwardX: forward.x, forwardZ: forward.z, rightX: -forward.z, rightZ: forward.x };
  }
  showSignature(): void { this.previewSignatureAt = this.time; this.nextPreviewSignature = this.time + 11; }
  render(state: DuelSnapshot, delta: number, slot: Slot = 0): void {
    if (this.dead) return;
    this.slot = slot;
    const dt = Math.min(.05, delta); this.time += dt;
    if (this.preview) {
      if (!this.reducedMotion && this.time >= this.nextPreviewSignature) this.showSignature();
      const f = state.fighters[0], age = this.time - this.previewSignatureAt;
      const m = CHAMPIONS[f.id].moves.special;
      const demonstrating = age >= 0 && age < m.startup + m.active + m.recovery;
      state = { ...state, phase: 'fight', events: [], fighters: [{ ...f, x: 0, z: 0, yaw: -.12, state: demonstrating ? 'attack' : 'idle', attack: demonstrating ? { id: 'special', elapsed: age, combo: 0, connected: false, startedAt: this.previewSignatureAt, power: 1, released: age >= m.startup, aimX: -.2, aimZ: 3 } : null }, state.fighters[1]] };
    }
    for (const [i, rig] of this.fighters.entries()) {
      if (this.preview && i === 1) continue;
      const f = state.fighters[i]!;
      rig.animate(f, dt, this.time, this.preview);
      this.updateTelegraph(i as Slot, state);
      if (f.attack) {
        const move = CHAMPIONS[f.id].moves[f.attack.id];
        if (f.attack.elapsed >= move.startup && (this.strikeElapsed[i]! < move.startup || f.attack.elapsed < this.strikeElapsed[i]!)) this.slash(i as Slot, state);
        this.strikeElapsed[i] = f.attack.elapsed;
      } else this.strikeElapsed[i] = 0;
    }
    for (const event of state.events) { if (event.id > this.seenEvent) { this.effect(event, state); this.seenEvent = event.id; } }
    this.updateCamera(state, dt);
    this.updateEffects(dt);
    for (const [i, flame] of this.arena.flames.entries()) { flame.scale.y = 1.5 + Math.sin(this.time * 6 + i * 2) * .22; flame.rotation.y += dt; }
    this.arena.ambient.rotation.y += dt * .012;
    this.arena.ambient.position.y = Math.sin(this.time * .16) * .2;
    this.flashAmount *= Math.exp(-16 * dt); this.flash.style.opacity = this.flashAmount < .008 ? '0' : String(this.flashAmount);
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
  }
  private updateCamera(state: DuelSnapshot, dt: number): void {
    if (this.preview) {
      const size = CHAMPIONS[state.fighters[0].id].size;
      const portrait = this.camera.aspect < 1;
      this.desiredCamera.set(this.reducedMotion ? .25 : .25 + Math.sin(this.time * .06) * .18, 1.95 * size, (portrait ? 8.9 : 6.6) * size);
      this.desiredLook.set(-.35, 1.4 * size, 0);
    } else {
      const self = state.fighters[this.slot], enemy = state.fighters[this.slot === 0 ? 1 : 0];
      const yaw = this.locked ? Math.atan2(enemy.x - self.x, enemy.z - self.z) : self.yaw;
      const separation = Math.hypot(enemy.x - self.x, enemy.z - self.z);
      const range = 6.6 + Math.min(1.5, separation * .11) - this.zoom;
      this.desiredCamera.set(self.x - Math.sin(yaw) * range + Math.cos(yaw) * 1.1, 4.6, self.z - Math.cos(yaw) * range - Math.sin(yaw) * 1.1);
      this.desiredLook.set(self.x + Math.sin(yaw) * Math.min(3.8, separation * .4), 1.5, self.z + Math.cos(yaw) * Math.min(3.8, separation * .4));
      if (state.phase === 'intro') {
        const cinematic = Math.max(0, 1 - state.phaseTime / 2.6);
        this.desiredCamera.x += cinematic * 3; this.desiredCamera.y += cinematic * 1.4;
      }
    }
    const blend = 1 - Math.exp(-5 * dt);
    this.camera.position.lerp(this.desiredCamera, blend); this.look.lerp(this.desiredLook, blend);
    const offset = new THREE.Vector3(Math.sin(this.time * 91) * this.shake, Math.cos(this.time * 107) * this.shake * .6, 0);
    this.camera.position.add(offset); this.camera.lookAt(this.look);
    this.shake *= Math.exp(-15 * dt); this.zoom *= Math.exp(-12 * dt);
  }
  private updateTelegraph(slot: Slot, state: DuelSnapshot): void {
    const f = state.fighters[slot], object = this.telegraphs[slot];
    const attack = f.attack;
    object.visible = !!attack && attack.id !== 'light' && state.phase === 'fight';
    if (!object.visible || !attack) return;
    const move = CHAMPIONS[f.id].moves[attack.id];
    if (this.telegraphKey[slot] !== f.id + attack.id) {
      object.geometry.dispose();
      object.geometry = new THREE.RingGeometry(.3, move.range, 48, 1, -move.arc, move.arc * 2);
      this.telegraphKey[slot] = f.id + attack.id;
    }
    object.position.set(f.x, .045, f.z);
    object.rotation.set(-Math.PI / 2, 0, f.yaw - Math.PI / 2);
    (object.material as THREE.MeshBasicMaterial).opacity = attack.elapsed < move.startup ? .1 + attack.elapsed / move.startup * .2 : .06;
  }
  private burst(x: number, z: number, color: THREE.Color, count: number, power = 1): void {
    for (let i = 0; i < count && this.sparks.length < 300; i++) {
      const angle = Math.random() * Math.PI * 2, speed = (1 + Math.random() * 4) * power;
      const life = .3 + Math.random() * .5;
      this.sparks.push({ x, y: 1.5 + Math.random() * .4, z, vx: Math.sin(angle) * speed, vy: Math.random() * 5, vz: Math.cos(angle) * speed, life, max: life, color: color.clone() });
    }
  }
  private slash(slot: Slot, state: DuelSnapshot): void {
    const f = state.fighters[slot], attack = f.attack!;
    const move = CHAMPIONS[f.id].moves[attack.id], color = new THREE.Color(CHAMPIONS[f.id].accent);
    const ring = new THREE.Mesh(new THREE.RingGeometry(move.range * .65, move.range * .85, 40, 1, -.6, 1.65), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    ring.position.set(f.x, attack.id === 'heavy' ? 1.35 : 1.6, f.z);
    ring.rotation.set(-Math.PI / 2 + (attack.id === 'heavy' ? .65 : .18), 0, f.yaw - Math.PI / 2);
    this.scene.add(ring); this.effects.push({ object: ring, age: 0, life: .2, baseScale: 1, grow: .15, float: 0 });
    this.burst(f.x + Math.sin(f.yaw) * move.range * .6, f.z + Math.cos(f.yaw) * move.range * .6, color, attack.id === 'light' ? 6 : 13, .4);
  }
  private effect(event: DuelEvent, state: DuelSnapshot): void {
    const f = state.fighters[event.slot], accent = new THREE.Color(CHAMPIONS[f.id].accent);
    if (event.kind === 'hit') {
      this.shake = event.move === 'light' ? .065 : .16; this.zoom = event.move === 'light' ? .12 : .3;
      this.flashAmount = event.move === 'light' ? .06 : .14;
      this.burst(event.x, event.z, new THREE.Color(0xffd9ae), event.move === 'light' ? 17 : 35, event.move === 'light' ? 1 : 1.5);
      this.damage(event.x, event.z, event.damage ?? 0);
    } else if (event.kind === 'guard' || event.kind === 'parry' || event.kind === 'break') {
      this.burst(event.x, event.z, new THREE.Color(event.kind === 'parry' ? 0xc2f4ff : 0xffbe6d), event.kind === 'parry' ? 40 : 23, 1.3);
      this.shake = .09; this.flashAmount = event.kind === 'parry' ? .22 : .07;
      this.shockwave(event.x, event.z, event.kind === 'parry' ? new THREE.Color(0xc2f4ff) : accent, 1.2, .4);
    } else if (event.kind === 'spell' || event.kind === 'ultimate') {
      this.shockwave(event.x, event.z, accent, event.kind === 'ultimate' ? 4.8 : 2.8, event.kind === 'ultimate' ? 1 : .7);
      this.burst(event.x, event.z, accent, event.kind === 'ultimate' ? 60 : 30, 1.2);
      if (event.kind === 'ultimate') { this.shake = .12; this.zoom = .5; this.flashAmount = .2; }
    } else if (event.kind === 'dodge') {
      this.burst(event.x, event.z, accent, 9, .3);
    } else if (event.kind === 'death') { this.burst(event.x, event.z, accent, 40, 1.3); this.shockwave(event.x, event.z, accent, 3, 1.2); }
  }
  private shockwave(x: number, z: number, color: THREE.Color, radius: number, life: number): void {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .025, 6, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, .12, z);
    this.scene.add(ring); this.effects.push({ object: ring, age: 0, life, baseScale: .25, grow: radius, float: 0 });
  }
  private damage(x: number, z: number, value: number): void {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d')!; ctx.font = 'bold 42px Georgia'; ctx.textAlign = 'center'; ctx.strokeStyle = '#111820'; ctx.lineWidth = 5; ctx.strokeText(String(value), 64, 47); ctx.fillStyle = '#fff1d8'; ctx.fillText(String(value), 64, 47);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.position.set(x, 2.8, z); sprite.scale.set(1, .5, 1);
    this.scene.add(sprite); this.effects.push({ object: sprite, age: 0, life: .8, baseScale: 1, grow: 0, float: 1.1 });
  }
  private disposeEffect(effect: Effect): void {
    effect.object.removeFromParent();
    if (effect.object instanceof THREE.Mesh) effect.object.geometry.dispose();
    const mat = effect.object.material as THREE.SpriteMaterial | THREE.MeshBasicMaterial;
    if ('map' in mat) mat.map?.dispose(); mat.dispose();
  }
  private updateEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]!; effect.age += dt;
      if (effect.age > effect.life || this.effects.length > 48) { this.disposeEffect(effect); this.effects.splice(i, 1); continue; }
      const progress = effect.age / effect.life;
      (effect.object.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * .8;
      if (effect.object instanceof THREE.Mesh) effect.object.scale.setScalar(effect.baseScale + progress * effect.grow);
      effect.object.position.y += effect.float * dt;
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i]!; spark.life -= dt;
      if (spark.life <= 0) { this.sparks.splice(i, 1); continue; }
      spark.vy -= dt * 8; spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.z += spark.vz * dt;
      if (spark.y < .05) { spark.y = .05; spark.vy = Math.abs(spark.vy) * .2; }
    }
    for (let i = 0; i < this.sparks.length; i++) {
      const spark = this.sparks[i]!;
      this.dummy.position.set(spark.x, spark.y, spark.z); this.dummy.scale.setScalar(spark.life / spark.max * 1.8); this.dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, this.dummy.matrix); this.sparkMesh.setColorAt(i, spark.color);
    }
    this.sparkMesh.count = this.sparks.length; this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
  }
  destroy(): void {
    if (this.dead) return;
    this.dead = true; this.observer.disconnect();
    for (const effect of this.effects) this.disposeEffect(effect); this.effects = [];
    for (const fighter of this.fighters) fighter.dispose();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        geometries.add(o.geometry);
        for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
          materials.add(mat);
          if (mat instanceof THREE.MeshStandardMaterial && mat.map) textures.add(mat.map);
        }
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    for (const pass of this.composer?.passes ?? []) pass.dispose(); this.composer?.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove(); this.flash.remove();
  }
}


