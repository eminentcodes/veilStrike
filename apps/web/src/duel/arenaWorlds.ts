import * as THREE from 'three';
import {ARENAS} from './catalog';
import type {ArenaId} from './catalog';
import type {ArenaScene} from './environment';

function texture(kind:'basalt'|'earth'|'ice'|'void'):THREE.CanvasTexture{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!;
  const colors={basalt:'#332d2a',earth:'#374239',ice:'#9aaeb5',void:'#312e47'};c.fillStyle=colors[kind];c.fillRect(0,0,512,512);
  let seed=97;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<23000;i++){const light=kind==='ice'?180+random()*70:40+random()*90;c.fillStyle=`rgba(${light},${light},${light},${random()*.16})`;c.fillRect(random()*512,random()*512,1+random()*4,1+random()*4);}
  if(kind==='earth'){for(let i=0;i<220;i++){c.fillStyle=i%2?'#4c5c3555':'#1e2d2355';c.beginPath();c.ellipse(random()*512,random()*512,3+random()*20,1+random()*8,random()*Math.PI,0,Math.PI*2);c.fill();}}
  else if(kind==='ice'){for(let i=0;i<16;i++){let x=random()*512,y=random()*512;c.strokeStyle='#476c8066';c.lineWidth=.6;c.beginPath();c.moveTo(x,y);for(let j=0;j<8;j++){x+=(random()-.5)*90;y+=(random()-.5)*55;c.lineTo(x,y);}c.stroke();}}
  else{for(let i=0;i<(kind==='void'?32:14);i++){let x=random()*512,y=random()*512;c.strokeStyle=kind==='void'?'#8980b366':'#120f0daa';c.lineWidth=kind==='void'?2:1;c.beginPath();c.moveTo(x,y);for(let j=0;j<5;j++){x+=(random()-.5)*70;y+=(random()-.5)*70;c.lineTo(x,y);}c.stroke();}}
  const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(4,4);map.colorSpace=THREE.SRGBColorSpace;return map;
}
/** Four separate worlds. Ashen Sanctum stays in the established arena builder. */
export function buildDistinctArena(scene:THREE.Scene,id:Exclude<ArenaId,'sanctum'>):ArenaScene{
  const theme=ARENAS[id];scene.background=new THREE.Color(theme.sky);scene.fog=new THREE.FogExp2(theme.fog,id==='grove'?.043:id==='forge'?.026:id==='rift'?.012:.022);
  scene.add(new THREE.HemisphereLight(theme.light,id==='grove'?0x223a24:0x151522,id==='rift'?1.05:1.7));
  const sun=new THREE.DirectionalLight(theme.light,id==='grove'?2.2:3.1);sun.position.set(-8,16,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14});sun.shadow.normalBias=.035;scene.add(sun);
  const rim=new THREE.DirectionalLight(theme.accent,1.4);rim.position.set(7,7,-12);scene.add(rim);
  const mat=(color:number,roughness=.85,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const add=(geometry:THREE.BufferGeometry,material:THREE.Material,p:[number,number,number],name:string)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...p);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;};
  const glow=(color:number,strength=2)=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:strength,roughness:.8});
  const tube=(name:string,points:number[][],radius:number,material:THREE.Material)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,radius,8,false),material,[0,0,0],name);
  const flames:THREE.Object3D[]=[];
  if(id==='forge'){
    const basalt=mat(0x3a3430),iron=mat(0x252c2e,.52,.7),lava=glow(0xff541e,1.5);
    add(new THREE.CylinderGeometry(10.4,11.5,1.2,8),basalt,[0,-.62,0],'octagonal-foundry-plinth');
    const deck=add(new THREE.CircleGeometry(10.35,8),new THREE.MeshStandardMaterial({map:texture('basalt'),roughness:.9}),[0,.008,0],'basalt-foundry-floor');deck.rotation.x=-Math.PI/2;deck.rotation.z=Math.PI/8;
    const river=add(new THREE.PlaneGeometry(85,85),lava,[0,-1.4,0],'flowing-lava-basin');river.rotation.x=-Math.PI/2;
    for(const sign of [-1,1]){
      for(let i=0;i<4;i++){const x=sign*(12+i*2.8),z=-9+i*5;add(new THREE.BoxGeometry(2,8+i*1.2,2.2),iron,[x,2.2+i*.6,z],'industrial-furnace-support');}
      add(new THREE.BoxGeometry(2,1,26),iron,[sign*12,9,0],'overhead-foundry-gantry');
      for(let i=0;i<22;i++){const y=8-i*.31;const link=add(new THREE.TorusGeometry(.17,.042,6,10),iron,[sign*11.2,y,-3],'hanging-forge-chain');link.rotation.y=i%2*Math.PI/2;}
      const vat=add(new THREE.CylinderGeometry(1.9,1.3,3.6,16,1,true),iron,[sign*15,1,-9],'molten-smelting-vat');vat.rotation.z=sign*.16;
      const melt=add(new THREE.CircleGeometry(1.65,32),lava,[sign*15,2.8,-9],'smelting-vat-glow');melt.rotation.x=-Math.PI/2;
      const light=new THREE.PointLight(0xff6e27,15,20);light.position.set(sign*13,3,-5);scene.add(light);
    }
    add(new THREE.BoxGeometry(12,13,5),iron,[0,5,-20],'great-foundry-furnace');
    const mouth=add(new THREE.PlaneGeometry(6,5),lava,[0,3,-17.4],'furnace-mouth');flames.push(mouth);
    for(let i=0;i<7;i++)add(new THREE.BoxGeometry(.15,5.6,.22),iron,[-3+i,3,-17.2],'furnace-iron-grille');
    for(let i=0;i<12;i++){const a=i*2.399,r=18+i%4*4;const rock=add(new THREE.IcosahedronGeometry(3+i%3,1),basalt,[Math.sin(a)*r,-.2,Math.cos(a)*r],'volcanic-cliff');rock.scale.y=1.6;}
  }else if(id==='grove'){
    const earth=mat(0x344031),bark=mat(0x33372c),leaves=mat(0x284638),water=mat(0x344c47,.17,.28);
    const soil=add(new THREE.CircleGeometry(10.6,64),new THREE.MeshStandardMaterial({map:texture('earth'),roughness:1}),[0,.005,0],'moss-and-earth-clearing');soil.rotation.x=-Math.PI/2;
    const wet=add(new THREE.PlaneGeometry(90,90),water,[0,-.14,0],'flooded-forest-water');wet.rotation.x=-Math.PI/2;
    for(let i=0;i<27;i++){const a=i*2.399,r=12.8+i%5*2,x=Math.sin(a)*r,z=Math.cos(a)*r,height=7+i%6;
      const trunk=add(new THREE.CylinderGeometry(.28,.72,height,10),bark,[x,height/2-.1,z],'ancient-forest-trunk');trunk.rotation.z=Math.sin(i)*.08;
      for(let j=0;j<3;j++){const angle=j*2+i*.7;const branch=tube('twisted-living-branch',[[x,height*.45,z],[x+Math.sin(angle)*1.2,height*.76,z+Math.cos(angle)],[x+Math.sin(angle)*3,height*.95,z+Math.cos(angle)*2.5]],.13,bark);branch.castShadow=true;}
      const canopy=add(new THREE.IcosahedronGeometry(3.5+i%3*.3,1),leaves,[x,height,z],'layered-forest-canopy');canopy.scale.set(1.4,.65,1.2);
      for(let j=0;j<3;j++){const angle=j*2.1+i; tube('exposed-buttress-root',[[x,.4,z],[x+Math.sin(angle)*1.1,.12,z+Math.cos(angle)*1.1],[x+Math.sin(angle)*2.3,-.09,z+Math.cos(angle)*2.3]],.15,bark);}
    }
    for(let i=0;i<70;i++){const a=i*2.399,r=9.7+i%7*.55,x=Math.sin(a)*r,z=Math.cos(a)*r;for(let j=0;j<4;j++){const blade=add(new THREE.ConeGeometry(.09,.65+i%3*.12,3),earth,[x+j*.06,.29,z],'marsh-reed');blade.rotation.z=(j-1.5)*.14;}}
    for(let i=0;i<12;i++){const a=i*1.73,r=4+i%3*1.6;const puddle=add(new THREE.CircleGeometry(.45+i%4*.12,24),water,[Math.sin(a)*r,.012,Math.cos(a)*r],'shallow-organic-puddle');puddle.rotation.x=-Math.PI/2;puddle.scale.y=.55;}
    tube('fallen-moss-covered-tree',[[11,.55,-6],[14,.62,-2],[18,.48,2]],.58,bark);
  }else if(id==='citadel'){
    const wall=mat(0x7d8b96),snow=mat(0xdbe3e2),ice=mat(0x91bacb,.24,.18);
    add(new THREE.BoxGeometry(23,.8,23),wall,[0,-.42,0],'rectangular-frozen-courtyard');
    const courtyard=add(new THREE.PlaneGeometry(22,22),new THREE.MeshStandardMaterial({map:texture('ice'),roughness:.46,metalness:.1}),[0,.008,0],'frost-cracked-courtyard-floor');courtyard.rotation.x=-Math.PI/2;
    for(const sign of [-1,1]){add(new THREE.BoxGeometry(2,7,31),wall,[sign*14,3,0],'northern-fortress-wall');for(let i=0;i<12;i++){add(new THREE.BoxGeometry(2.4,.5,1.3),snow,[sign*14,6.8,-14+i*2.5],'snow-covered-battlement');const icicle=add(new THREE.ConeGeometry(.15,.8+i%3*.3,6),ice,[sign*12.8,6,-14+i*2.5],'hanging-citadel-icicle');icicle.rotation.z=Math.PI;}}
    for(const x of [-8.5,8.5]){add(new THREE.CylinderGeometry(2.2,2.6,15,12),wall,[x,6.5,-18],'northern-citadel-tower');add(new THREE.ConeGeometry(3,4,12),snow,[x,15,-18],'snow-covered-tower-roof');}
    add(new THREE.BoxGeometry(14,13,3),wall,[0,5.5,-20],'citadel-gatehouse');add(new THREE.BoxGeometry(5,7,.15),mat(0x293c49),[0,2.8,-18.4],'deep-frozen-gateway');
    for(let i=0;i<18;i++){const a=i*2.399,r=11.5+i%4*2.5;const drift=add(new THREE.SphereGeometry(1,16,8),snow,[Math.sin(a)*r,.12,Math.cos(a)*r],'sculpted-snow-drift');drift.scale.set(2,.5,1.2);}
    for(let band=0;band<3;band++){const vertices=[],indices=[];for(let i=0;i<40;i++){const x=-30+i*1.6,y=16+Math.sin(i*.19+band)*2;vertices.push(x,y,-32-band*3,x,y+3+Math.sin(i*.35)*1.4,-32-band*3);if(i)indices.push((i-1)*2,(i-1)*2+1,i*2+1,(i-1)*2,i*2+1,i*2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);add(g,new THREE.MeshBasicMaterial({color:band%2?0x8975b9:0x6ed4bb,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false,fog:false}),[0,0,0],'northern-aurora-ribbon');}
  }else{
    const obsidian=mat(0x242334,.58,.25),crystal=glow(0x9075cf,.8);
    const platform=new THREE.CylinderGeometry(10.3,8.6,2.4,11);add(platform,obsidian,[0,-1.22,0],'fractured-floating-obsidian-island');
    const top=add(new THREE.CircleGeometry(10.25,11),new THREE.MeshStandardMaterial({map:texture('void'),roughness:.68,metalness:.2}),[0,.008,0],'fractured-void-stone-floor');top.rotation.x=-Math.PI/2;
    for(let i=0;i<17;i++){const a=i*2.399,r=14+i%5*2.2;const shard=add(new THREE.OctahedronGeometry(1.3+i%3*.4,0),obsidian,[Math.sin(a)*r,1+i%6*.9,Math.cos(a)*r],'suspended-rift-shard');shard.scale.set(1,2.8,.75);shard.rotation.set(i*.13,i*.37,i*.2);const core=add(new THREE.OctahedronGeometry(.15,0),crystal,[Math.sin(a)*r,2.5+i%6*.9,Math.cos(a)*r],'rift-shard-core');core.scale.y=2;}
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const monolith=add(new THREE.BoxGeometry(.8,6.4,.7),obsidian,[Math.sin(a)*12.4,3.2,Math.cos(a)*12.4],'broken-floating-monolith');monolith.rotation.z=Math.sin(i)*.22;add(new THREE.BoxGeometry(.07,3.4,.04),crystal,[Math.sin(a)*12.4,3.8,Math.cos(a)*12.4+.38],'monolith-amethyst-fracture');}
    const horizon=add(new THREE.TorusGeometry(11,.065,8,96),new THREE.MeshBasicMaterial({color:0x907cb3,transparent:true,opacity:.45,fog:false}),[0,8,-32],'distant-broken-void-halo');horizon.rotation.y=.4;horizon.rotation.x=.3;
    for(let i=0;i<9;i++){const a=i*2.399;const crack=add(new THREE.BoxGeometry(.012,.015,2.3+i%3*.4),crystal,[Math.sin(a)*6,.025,Math.cos(a)*6],'void-floor-fracture');crack.rotation.y=a;}
  }
  const count=id==='grove'?110:id==='citadel'?450:220,positions=new Float32Array(count*3),velocities=new Float32Array(count);
  for(let i=0;i<count;i++){positions[i*3]=Math.sin(i*47.31)*22;positions[i*3+1]=(i%120)/120*13;positions[i*3+2]=Math.cos(i*17.19)*22;velocities[i]=.3+i%7*.09;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const ambient=new THREE.Points(geometry,new THREE.PointsMaterial({color:id==='citadel'?0xe8f1f2:theme.accent,size:id==='grove'?.052:id==='citadel'?.042:.024,transparent:true,opacity:.65,depthWrite:false,blending:id==='citadel'?THREE.NormalBlending:THREE.AdditiveBlending}));ambient.name=id+'-weather';scene.add(ambient);
  return {flames,ambient,update:(dt,time)=>{for(let i=0;i<count;i++){positions[i*3+1]=positions[i*3+1]!+dt*velocities[i]!*(id==='citadel'?-1:1);if(positions[i*3+1]!<0)positions[i*3+1]=13;if(positions[i*3+1]!>13)positions[i*3+1]=0;if(id==='citadel')positions[i*3]=positions[i*3]!+Math.sin(time*.4+i)*dt*.22;}geometry.attributes.position!.needsUpdate=true;}};
}
