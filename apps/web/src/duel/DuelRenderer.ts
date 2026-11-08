import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ChampionRig } from './ChampionRig';
import { SkillVisuals } from './SkillVisuals';
import { buildArena } from './environment';
import type { ArenaScene } from './environment';
import { CHAMPIONS } from './catalog';
import type { DuelConfig } from './catalog';
import type { DuelSnapshot, DuelEvent, Slot } from './simulation';

interface Spark { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: THREE.Color; }
interface Effect { object: THREE.Mesh | THREE.Sprite; age: number; life: number; baseScale: number; grow: number; float: number; }
interface Debris { object: THREE.Mesh; velocity: THREE.Vector3; spin: THREE.Vector3; age: number; life: number; settled: boolean; equipment: boolean; }

export class DuelRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 16 / 9, .1, 150);
  readonly renderer: THREE.WebGLRenderer;
  readonly fighters: [ChampionRig, ChampionRig];
  readonly ready: Promise<void>;
  private composer: EffectComposer | null = null;
  private arena: ArenaScene;
  private skills: SkillVisuals;
  private sparks: Spark[] = [];
  private sparkMesh: THREE.InstancedMesh;
  private effects: Effect[] = [];
  private debris: Debris[] = [];
  private lastRound = 0;
  private shakeLife = 0;
  private previewSlamAt = -100;
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
  inspection = false;
  backdrop = false;
  private snapCamera = false;
  private look = new THREE.Vector3();
  private desiredCamera = new THREE.Vector3();
  private desiredLook = new THREE.Vector3();

  constructor(host: HTMLElement, config: DuelConfig, preview = false, highQuality = true, onProgress?: (progress: number) => void) {
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
    this.skills = new SkillVisuals(this.scene);
    if (preview) {
      const key = new THREE.PointLight(0xffe0b6, 26, 18, 2); key.position.set(-2.2, 4.2, 3.7); this.scene.add(key);
      const fill = new THREE.PointLight(0xb4d2e5, 13, 16, 2); fill.position.set(2.6, 2.5, 2); this.scene.add(fill);
      const rim = new THREE.PointLight(0xd5eaf3, 21, 16, 2); rim.position.set(.4, 3.6, -2); this.scene.add(rim);
    }
    const loading = [0, 0];
    const progress = (slot: number, value: number) => {
      loading[slot] = value;
      onProgress?.(preview ? loading[0]! : (loading[0]! + loading[1]!) / 2);
    };
    this.fighters = [new ChampionRig(config.player, true, value => progress(0, value)), new ChampionRig(config.opponent, !preview, value => progress(1, value))];
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
  setReducedMotion(value: boolean): void { this.reducedMotion = value; }
  setBackdrop(value: boolean): void {
    if (this.backdrop === value) return;
    this.backdrop = value; this.snapCamera = true;
    this.fighters[0].root.visible = !value;
    this.fighters[1].root.visible = !this.preview && !value;
    this.camera.fov = value ? 48 : this.preview ? 36 : 48;
    this.camera.updateProjectionMatrix();
    this.previewSignatureAt = -100; this.nextPreviewSignature = this.time + 6;
    this.skills.clear();
    for (const effect of this.effects) this.disposeEffect(effect); this.effects = [];
    for (const piece of this.debris) this.disposeDebris(piece); this.debris = [];
    this.sparks = []; this.sparkMesh.count = 0;
    for (const telegraph of this.telegraphs) telegraph.visible = false;
  }
  render(state: DuelSnapshot, delta: number, slot: Slot = 0): void {
    if (this.dead) return;
    this.slot = slot;
    const dt = this.backdrop && this.reducedMotion ? 0 : Math.min(.05, delta); this.time += dt;
    if (state.round !== this.lastRound) { for (const piece of this.debris) this.disposeDebris(piece); this.debris = []; this.lastRound = state.round; }
    if (this.preview && !this.backdrop) {
      if (!this.reducedMotion && this.time >= this.nextPreviewSignature) this.showSignature();
      const f = state.fighters[0], age = this.time - this.previewSignatureAt;
      const m = CHAMPIONS[f.id].moves.special;
      const demonstrating = age >= 0 && age < m.startup + m.active + m.recovery;
      state = { ...state, phase: 'fight', events: [], fighters: [{ ...f, x: 0, z: 0, yaw: -.12, runeTime: f.id==='mawren'&&age>=m.startup&&age<8?8-age:0, runeX: -.2, runeZ: 3, wardTime: f.id==='mawren'&&age>=m.startup&&age<1.8?1.8-age:0, state: demonstrating ? 'attack' : 'idle', attack: demonstrating ? { id: 'special', elapsed: age, combo: 0, connected: false, startedAt: this.previewSignatureAt, power: 1, released: age >= m.startup, aimX: -.2, aimZ: 3 } : null }, state.fighters[1]] };
    }
    for (const [i, rig] of this.fighters.entries()) {
      if (this.backdrop) continue;
      if (this.preview && i === 1) continue;
      const f = state.fighters[i]!;
      rig.animate(f, dt, this.time, this.preview);
      this.updateTelegraph(i as Slot, state);
      if (f.attack) {
        const move = CHAMPIONS[f.id].moves[f.attack.id];
        const previous=this.strikeElapsed[i]!;
        const strike=Math.floor(Math.max(0,f.attack.elapsed-move.startup)/move.active*(move.strikes??1));
        const previousStrike=Math.floor(Math.max(0,previous-move.startup)/move.active*(move.strikes??1));
        if (f.attack.elapsed >= move.startup && f.attack.elapsed<move.startup+move.active && (previous < move.startup || f.attack.elapsed < previous || strike>previousStrike)) this.slash(i as Slot, state);
        this.strikeElapsed[i] = f.attack.elapsed;
      } else this.strikeElapsed[i] = 0;
    }
    if (!this.backdrop) this.skills.update(state, this.fighters, this.time,dt);
    for (const event of state.events) { if (event.id > this.seenEvent) { this.effect(event, state); this.seenEvent = event.id; } }
    if (this.preview && !this.backdrop) {
      const f = state.fighters[0];
      if ((f.id === 'nomet'||f.id==='taren') && f.attack && f.attack.elapsed >= CHAMPIONS[f.id].moves.special.startup && this.previewSlamAt !== f.attack.startedAt) {
        // Preview demonstrations use the same ground effects as a real release.
        if(f.id==='nomet')this.groundSlam(f.x,f.z);else this.shieldWave(f.x,f.z,f.yaw);
        this.previewSlamAt = f.attack.startedAt;
      }
    }
    this.updateCamera(state, dt);
    this.updateEffects(dt);
    for (const [i, flame] of this.arena.flames.entries()) { flame.scale.y = 1.5 + Math.sin(this.time * 6 + i * 2) * .22; flame.rotation.y += dt; }
    if(this.arena.update) this.arena.update(dt,this.time);
    else { this.arena.ambient.rotation.y += dt * .012; this.arena.ambient.position.y = Math.sin(this.time * .16) * .2; }
    this.flashAmount *= Math.exp(-16 * dt); this.flash.style.opacity = this.flashAmount < .008 ? '0' : String(this.flashAmount);
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
  }
  private updateCamera(state: DuelSnapshot, dt: number): void {
    if (this.backdrop) {
      const orbit = this.reducedMotion ? 0 : Math.sin(this.time * .045) * .13;
      const portrait = this.camera.aspect < 1;
      this.desiredCamera.set(3.5 + Math.sin(orbit) * 15, portrait ? 6.4 : 7.8, portrait ? 17.5 : 15.5 + Math.cos(orbit) * 1.5);
      this.desiredLook.set(-.4, portrait ? 4 : 3, -3.5);
    } else if (this.preview) {
      const size = CHAMPIONS[state.fighters[0].id].size;
      const portrait = this.camera.aspect < 1;
      this.desiredCamera.set(this.reducedMotion ? .2 : .2 + Math.sin(this.time * .06) * .12, 1.85 * size, (this.inspection ? 5.4 : portrait ? 8.9 : 5.9) * size);
      this.desiredLook.set(this.inspection ? 0 : -.35, 1.3 * size, 0);
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
    if (this.snapCamera || (this.backdrop && this.reducedMotion)) { this.camera.position.copy(this.desiredCamera); this.look.copy(this.desiredLook); this.snapCamera = false; }
    else { this.camera.position.lerp(this.desiredCamera, blend); this.look.lerp(this.desiredLook, blend); }
    const offset = new THREE.Vector3(Math.sin(this.time * 91) * this.shake, Math.cos(this.time * 107) * this.shake * .6, 0);
    this.camera.position.add(offset); this.camera.lookAt(this.look);
    this.shakeLife = Math.max(0,this.shakeLife-dt);
    this.shake *= Math.exp(-(this.shakeLife>0?3:15) * dt); this.zoom *= Math.exp(-12 * dt);
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
    if(f.id==='mawren') { if(attack.id==='heavy'||attack.id==='ultimate')this.skills.bolt(slot,state,attack.id==='ultimate'); return; }
    if(f.id==='veyra'&&attack.id==='special'||f.id==='nomet'&&attack.id==='special'||f.id==='taren'&&attack.id==='special')return;
    const ring = new THREE.Mesh(new THREE.RingGeometry(move.range * .65, move.range * .85, 40, 1, -.6, 1.65), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    ring.position.set(f.x, attack.id === 'heavy' ? 1.35 : 1.6, f.z);
    ring.rotation.set(-Math.PI / 2 + (attack.id === 'heavy' ? .65 : .18), 0, f.yaw - Math.PI / 2);
    this.scene.add(ring); this.effects.push({ object: ring, age: 0, life: .2, baseScale: 1, grow: .15, float: 0 });
    this.burst(f.x + Math.sin(f.yaw) * move.range * .6, f.z + Math.cos(f.yaw) * move.range * .6, color, attack.id === 'light' ? 6 : 13, .4);
  }
  private effect(event: DuelEvent, state: DuelSnapshot): void {
    const f = state.fighters[event.slot], accent = new THREE.Color(CHAMPIONS[f.id].accent);
    if (event.kind === 'hit') {
      const targetSlot = event.target ?? (event.slot === 0 ? 1 : 0), target = state.fighters[targetSlot];
      this.fighters[targetSlot].impact(event.move === 'light' ? .7 : 1.2);
      this.contactFlash(event.x,event.z,CHAMPIONS[target.id].height*.58,event.move !== 'light');
      this.shake = this.reducedMotion ? 0 : event.move === 'light' ? .065 : .18; this.zoom = event.move === 'light' ? .12 : .3;
      this.flashAmount = event.move === 'light' ? .06 : .14;
      this.burst(event.x, event.z, new THREE.Color(0xffd9ae), event.move === 'light' ? 17 : 35, event.move === 'light' ? 1 : 1.5);
      this.damage(event.x, event.z, event.damage ?? 0);
      if (event.knockdown) this.dust(event.x,event.z,10);
    } else if (event.kind === 'guard' || event.kind === 'parry' || event.kind === 'break') {
      this.fighters[event.slot].impact(.35);
      this.burst(event.x, event.z, new THREE.Color(event.kind === 'parry' ? 0xc2f4ff : 0xffbe6d), event.kind === 'parry' ? 40 : 23, 1.3);
      this.shake = .09; this.flashAmount = event.kind === 'parry' ? .22 : .07;
      this.shockwave(event.x, event.z, event.kind === 'parry' ? new THREE.Color(0xc2f4ff) : accent, 1.2, .4);
    } else if (event.kind === 'release' && f.id === 'nomet' && event.move === 'special') {
      this.groundSlam(f.x,f.z);
    } else if(event.kind==='release'&&f.id==='taren'&&event.move==='special'){
      this.shieldWave(f.x,f.z,f.yaw);
    } else if (event.kind === 'spell' || event.kind === 'ultimate') {
      this.shockwave(event.x, event.z, accent, event.kind === 'ultimate' ? 4.8 : 2.8, event.kind === 'ultimate' ? 1 : .7);
      this.burst(event.x, event.z, accent, event.kind === 'ultimate' ? 60 : 30, 1.2);
      if (event.kind === 'ultimate') { this.shake = .12; this.zoom = .5; this.flashAmount = .2; }
    } else if (event.kind === 'dodge') {
      this.burst(event.x, event.z, accent, 9, .3);
    } else if (event.kind === 'death') {
      this.dust(event.x,event.z,12);
      for (const object of this.fighters[event.slot].releaseEquipment()) {
        this.scene.add(object); this.debris.push({ object, velocity: new THREE.Vector3(f.vx*.3,.8+Math.random(),f.vz*.3), spin: new THREE.Vector3(2+Math.random(),1,1.5), age:0,life:4,settled:false,equipment:true });
      }
    } else if (event.kind === 'land' || event.kind === 'throw') this.dust(event.x,event.z,12);
  }
  private contactFlash(x: number,z: number,y: number,heavy: boolean): void {
    const flash=new THREE.Mesh(new THREE.RingGeometry(.035,heavy?.38:.24,8),new THREE.MeshBasicMaterial({color:0xffe4bb,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    flash.position.set(x,y,z);flash.quaternion.copy(this.camera.quaternion);
    this.scene.add(flash);this.effects.push({object:flash,age:0,life:.13,baseScale:1,grow:.8,float:0});
  }
  private dust(x: number,z: number,count: number): void {
    for (let i=0;i<count&&this.debris.length<70;i++) {
      const angle=i/count*Math.PI*2, radius=.1+Math.random()*.5;
      const object=new THREE.Mesh(new THREE.IcosahedronGeometry(.04+Math.random()*.055,0),new THREE.MeshStandardMaterial({color:i%3?0x776a59:0xafa48c,roughness:1,transparent:true}));
      object.position.set(x+Math.sin(angle)*radius,.07,z+Math.cos(angle)*radius);this.scene.add(object);
      this.debris.push({object,velocity:new THREE.Vector3(Math.sin(angle)*(1+Math.random()*2),1+Math.random()*3,Math.cos(angle)*(1+Math.random()*2)),spin:new THREE.Vector3(3,4,2),age:0,life:1.5+Math.random()*.5,settled:false,equipment:false});
    }
  }
  private shieldWave(x:number,z:number,yaw:number):void {
    const shape=new THREE.Shape();shape.moveTo(-.65,.85);shape.lineTo(.65,.85);shape.lineTo(.82,-.22);shape.lineTo(0,-1.05);shape.lineTo(-.82,-.22);shape.closePath();
    const field=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0xaee5ff,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    field.name='shield-force-field';field.position.set(x+Math.sin(yaw)*1.1,1.55,z+Math.cos(yaw)*1.1);field.rotation.y=yaw;
    this.scene.add(field);this.effects.push({object:field,age:0,life:.5,baseScale:.65,grow:2.8,float:0});
    const shell=new THREE.Mesh(new THREE.SphereGeometry(1,32,16,0,Math.PI),new THREE.MeshBasicMaterial({color:0x9bd5ff,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    shell.name='shield-shockwave';shell.position.set(x,1.2,z);shell.rotation.y=yaw;
    this.scene.add(shell);this.effects.push({object:shell,age:0,life:.5,baseScale:.2,grow:3.8,float:0});
    this.burst(x+Math.sin(yaw),z+Math.cos(yaw),new THREE.Color(0xb9e8ff),30,.8);
    this.shake=this.reducedMotion?0:.19;this.shakeLife=.25;
  }
  private groundSlam(x: number,z: number): void {
    this.shake = this.reducedMotion ? 0 : .27;this.shakeLife=.6;this.zoom=.25;
    this.shockwave(x,z,new THREE.Color(0xb7a58a),4.5,.7);this.dust(x,z,24);
    const geometry=new THREE.BufferGeometry(), points:number[]=[];
    for (let i=0;i<11;i++) {
      let px=x,pz=z;const angle=i/11*Math.PI*2;
      for (let step=0;step<5;step++) {
        const nx=px+Math.sin(angle+(Math.random()-.5)*.6)*.4,nz=pz+Math.cos(angle+(Math.random()-.5)*.6)*.4;
        points.push(px,.044,pz,nx,.044,nz);px=nx;pz=nz;
      }
    }
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    const cracks=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xc9b28c,transparent:true,opacity:.85}));
    // Keep cracks with debris so the normal match cleanup releases their buffers.
    const holder=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({visible:false}));holder.add(cracks);this.scene.add(holder);
    this.debris.push({object:holder,velocity:new THREE.Vector3(),spin:new THREE.Vector3(),age:0,life:1.8,settled:true,equipment:false});
  }
  private disposeDebris(piece: Debris): void {
    piece.object.removeFromParent();piece.object.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){o.geometry.dispose();for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();}});
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
    for (let i=this.debris.length-1;i>=0;i--) {
      const piece=this.debris[i]!;piece.age+=dt;
      if(piece.age>piece.life){this.disposeDebris(piece);this.debris.splice(i,1);continue;}
      if(!piece.settled){
        piece.velocity.y-=dt*15;piece.object.position.addScaledVector(piece.velocity,dt);
        piece.object.rotateX(piece.spin.x*dt);piece.object.rotateY(piece.spin.y*dt);piece.object.rotateZ(piece.spin.z*dt);
        const bottom=new THREE.Box3().setFromObject(piece.object).min.y;
        if(bottom<.035){piece.object.position.y+=.035-bottom;piece.velocity.y=Math.abs(piece.velocity.y)*.18;piece.velocity.x*=.55;piece.velocity.z*=.55;piece.spin.multiplyScalar(.45);if(piece.velocity.y<.25)piece.settled=true;}
      }
      if(piece.age>piece.life-.5)piece.object.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments)for(const mat of Array.isArray(o.material)?o.material:[o.material]){mat.transparent=true;mat.opacity=(piece.life-piece.age)/.5;}});
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
    for (const piece of this.debris) this.disposeDebris(piece); this.debris=[];
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


