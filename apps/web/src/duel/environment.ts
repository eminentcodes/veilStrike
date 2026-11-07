import * as THREE from 'three';
import { buildDistinctArena } from './arenaWorlds';
import { ARENAS } from './catalog';
import type { ArenaId } from './catalog';

function add(scene: THREE.Scene, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; scene.add(object); return object;
}
function floorTexture(arena: ArenaId): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = arena === 'forge' ? '#49413b' : arena === 'grove' ? '#47554b' : '#52616f'; ctx.fillRect(0, 0, 512, 512);
  let seed = 947;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 18000; i++) {
    const color = Math.floor(random() * 80 + 60);
    ctx.fillStyle = 'rgba(' + color + ',' + color + ',' + color + ',.13)';
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 3, 1 + random() * 3);
  }
  ctx.strokeStyle = '#1a2022'; ctx.lineWidth = 3;
  for (let y = 0; y <= 512; y += 128) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    for (let x = (y / 128) % 2 ? 64 : 0; x < 512; x += 128) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 128); ctx.stroke(); }
  }
  for (let i = 0; i < 24; i++) {
    let x = random() * 512, y = random() * 512;
    ctx.strokeStyle = '#1c2527aa'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) { x += (random() - .5) * 35; y += random() * 25; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(7, 7); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export interface ArenaScene { flames: THREE.Object3D[]; ambient: THREE.Points; update?: (dt: number, time: number) => void; }
export function buildArena(scene: THREE.Scene, id: ArenaId): ArenaScene {
  const theme = ARENAS[id];
  if(theme.id !== 'sanctum') return buildDistinctArena(scene,theme.id);
  scene.background = new THREE.Color(theme.sky); scene.fog = new THREE.FogExp2(theme.fog, .029);
  scene.add(new THREE.HemisphereLight(theme.light, 0x111820, 1.6));
  const key = new THREE.DirectionalLight(theme.light, 3);
  key.position.set(-7, 15, 8); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -14; key.shadow.camera.right = 14; key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
  key.shadow.normalBias = .035; scene.add(key);
  const rim = new THREE.DirectionalLight(theme.accent, 2); rim.position.set(4, 6, -12); scene.add(rim);
  const rock = new THREE.MeshStandardMaterial({ color: theme.stone, roughness: .84, metalness: .12 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x20272e, roughness: .75 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x87958e, roughness: .46, metalness: .68 });
  const glow = new THREE.MeshStandardMaterial({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 2.6, roughness: .6 });
  const ground = new THREE.MeshStandardMaterial({ map: floorTexture(id), roughness: id === 'grove' ? .46 : .72, metalness: .14 });
  add(scene, new THREE.CylinderGeometry(10, 10.5, .55, 96), dark, 0, -.3, 0);
  const floor = add(scene, new THREE.CircleGeometry(10, 96), ground, 0, .005, 0); floor.rotation.x = -Math.PI / 2;
  for (const radius of [3.8, 7.8, 9.35, 9.7]) {
    const ring = add(scene, new THREE.TorusGeometry(radius, radius > 9 ? .04 : .017, 5, 96), radius > 9 ? glow : trim, 0, .023, 0); ring.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const rune = add(scene, new THREE.BoxGeometry(.06, .015, .45), glow, Math.sin(a) * 8.85, .028, Math.cos(a) * 8.85); rune.rotation.y = a;
  }
  const flames: THREE.Object3D[] = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8, x = Math.sin(a) * 11.6, z = Math.cos(a) * 11.6;
    add(scene, new THREE.CylinderGeometry(.72, .9, .38, 6), rock, x, -.08, z);
    add(scene, new THREE.CylinderGeometry(.3, .42, 3.6, 8), rock, x, 1.7, z);
    add(scene, new THREE.CylinderGeometry(.6, .42, .22, 8), trim, x, 3.5, z);
    const flame = add(scene, new THREE.IcosahedronGeometry(.2, 1), glow, x, 3.86, z); flame.scale.y = 1.8; flames.push(flame);
    const light = new THREE.PointLight(theme.accent, 5, 7, 2); light.position.set(x, 3.7, z); scene.add(light);
    if (id === 'sanctum') {
      add(scene, new THREE.BoxGeometry(.85, 1.8 + (i % 3) * .8, .75), rock, x * 1.18, 3.8, z * 1.18);
    }
  }
  const backdrop = add(scene, new THREE.CircleGeometry(4, 64), new THREE.MeshBasicMaterial({ color: id === 'forge' ? 0xe06c34 : id === 'grove' ? 0x789992 : 0xb7c9cf, fog: false }), -4, 10, -32);
  if (id === 'sanctum') {
    for (const x of [-6.5, 6.5]) {
      add(scene, new THREE.BoxGeometry(1.8, 11, 2), rock, x, 5, -15.5);
      for (let y = 1; y < 11; y += 1.6) add(scene, new THREE.BoxGeometry(2.1, .12, 2.2), trim, x, y, -15.5);
    }
    const arch = add(scene, new THREE.TorusGeometry(6.5, .7, 6, 32, Math.PI), rock, 0, 10, -15.5);
    arch.rotation.z = 0;
    const glass = new THREE.MeshStandardMaterial({ color: 0x335e6f, emissive: 0x284859, emissiveIntensity: .7, transparent: true, opacity: .7, side: THREE.DoubleSide });
    add(scene, new THREE.PlaneGeometry(4.3, 8), glass, 0, 5.5, -18);
    for (const x of [-1.5, 0, 1.5]) add(scene, new THREE.BoxGeometry(.06, 8, .05), trim, x, 5.5, -17.9);
  } else if (id === 'forge') {
    const lava = add(scene, new THREE.CircleGeometry(30, 64), glow, 0, -.7, 0); lava.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 18; i++) {
      const a = i * 2.399, radius = 16 + i % 3 * 4;
      const mountain = add(scene, new THREE.ConeGeometry(4.5, 7 + i % 4 * 3, 5), dark, Math.sin(a) * radius, 2.5, Math.cos(a) * radius);
      mountain.rotation.z = Math.sin(i) * .15;
    }
    for (const x of [-5, 5]) {
      add(scene, new THREE.BoxGeometry(2.4, 12, 2), dark, x, 5, -14);
      add(scene, new THREE.BoxGeometry(.1, 11, .1), glow, x + .6, 5, -12.9);
    }
    add(scene, new THREE.BoxGeometry(12, 1, 2), trim, 0, 10.5, -14);
  } else {
    backdrop.material = new THREE.MeshBasicMaterial({ color: 0x718f80, fog: false });
    for (let i = 0; i < 24; i++) {
      const a = i * 2.399, radius = 14 + i % 5 * 2;
      const x = Math.sin(a) * radius, z = Math.cos(a) * radius;
      const tree = add(scene, new THREE.CylinderGeometry(.2, .7, 7 + i % 5, 5), dark, x, 3.2, z); tree.rotation.z = Math.sin(i) * .18;
      for (let j = 0; j < 3; j++) {
        const branch = add(scene, new THREE.CylinderGeometry(.05, .21, 3.4, 5), dark, x + Math.sin(j * 2) * .9, 5 + j * .7, z + Math.cos(j * 2) * .8); branch.rotation.z = .7 + j;
      }
      const canopy = add(scene, new THREE.IcosahedronGeometry(3.6, 0), new THREE.MeshStandardMaterial({ color: 0x263f33, roughness: 1 }), x, 8 + i % 3, z);
      canopy.scale.y = .6;
    }
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399, radius = 2 + i % 3 * 2.5;
      const puddle = add(scene, new THREE.CircleGeometry(.6 + i % 3 * .3, 24), new THREE.MeshStandardMaterial({ color: 0x405d54, roughness: .08, metalness: .65, transparent: true, opacity: .65 }), Math.sin(a) * radius, .02, Math.cos(a) * radius); puddle.rotation.x = -Math.PI / 2; puddle.scale.y = .55;
    }
  }
  const rubbleGeo = new THREE.DodecahedronGeometry(.25, 0);
  const rubble = new THREE.InstancedMesh(rubbleGeo, rock, 80); rubble.castShadow = true; rubble.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 80; i++) {
    const a = i * 2.399, radius = 10.5 + i % 5 * .65;
    dummy.position.set(Math.sin(a) * radius, .08, Math.cos(a) * radius);
    dummy.rotation.set(i, i * .3, i * .7); dummy.scale.setScalar(.5 + i % 5 * .4); dummy.updateMatrix(); rubble.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rubble);
  const positions = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) { positions[i * 3] = Math.sin(i * 47.32) * 20; positions[i * 3 + 1] = (i % 100) * .12; positions[i * 3 + 2] = Math.cos(i * 17.17) * 20; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const ambient = new THREE.Points(geo, new THREE.PointsMaterial({ color: theme.accent, size: id === 'grove' ? .055 : .028, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(ambient);
  return { flames, ambient };
}

