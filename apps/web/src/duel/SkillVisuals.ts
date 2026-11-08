import * as THREE from 'three';
import type {DuelSnapshot} from './simulation';
import type {ChampionRig} from './ChampionRig';
import {CHAMPIONS} from './catalog';

/** Persistent physical skill visuals follow the same authoritative fighter state as damage. */
export class SkillVisuals {
  private chains:(THREE.Group|null)[]=[null,null];
  private seals:(THREE.Group|null)[]=[null,null];
  private wards:(THREE.Mesh|null)[]=[null,null];
  private bolts:{mesh:THREE.Mesh;start:THREE.Vector3;end:THREE.Vector3;age:number;life:number}[]=[];
  bolt(slot:number,state:DuelSnapshot,ultimate:boolean):void {
    const f=state.fighters[slot]!;
    const start=new THREE.Vector3(f.x-Math.cos(f.yaw)*.3,1.95,f.z+Math.sin(f.yaw)*.3);
    const end=new THREE.Vector3(f.attack?.aimX??f.x+Math.sin(f.yaw)*8,1.4,f.attack?.aimZ??f.z+Math.cos(f.yaw)*8);
    const mesh=new THREE.Mesh(new THREE.OctahedronGeometry(ultimate?.3:.15,1),new THREE.MeshBasicMaterial({color:ultimate?0xe4c5ff:0xbfa5f0,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));
    mesh.name=ultimate?'mawren-rune-collapse-bolt':'mawren-arcane-bolt';mesh.position.copy(start);this.scene.add(mesh);
    this.bolts.push({mesh,start,end,age:0,life:.28});
    const points=[start,end],trail=new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(points[0]!,points[1]!),1,ultimate?.065:.025,6,false),new THREE.MeshBasicMaterial({color:0xb79adf,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));
    trail.name='arcane-bolt-trail';this.scene.add(trail);this.bolts.push({mesh:trail,start:new THREE.Vector3(),end:new THREE.Vector3(),age:0,life:.32});
  }
  constructor(private scene:THREE.Scene){}
  clear(): void {
    for (const object of [...this.chains, ...this.seals, ...this.wards]) if (object) object.visible = false;
    for (const bolt of this.bolts) {
      bolt.mesh.removeFromParent(); bolt.mesh.geometry.dispose(); (bolt.mesh.material as THREE.Material).dispose();
    }
    this.bolts = [];
  }
  update(state:DuelSnapshot,fighters:ChampionRig[],time:number,dt:number):void {
    for(let i=this.bolts.length-1;i>=0;i--){const b=this.bolts[i]!;b.age+=dt;if(b.mesh.name!=='arcane-bolt-trail')b.mesh.position.copy(b.start).lerp(b.end,Math.min(1,b.age/b.life));(b.mesh.material as THREE.MeshBasicMaterial).opacity=.9*(1-b.age/b.life);if(b.age>=b.life){b.mesh.removeFromParent();b.mesh.geometry.dispose();(b.mesh.material as THREE.Material).dispose();this.bolts.splice(i,1);}}
    state.fighters.forEach((f,slot)=>{
      if(f.id==='veyra'){
        let group=this.chains[slot];
        if(!group){
          group=new THREE.Group();group.name='veyra-chain-skill';
          const links=new THREE.InstancedMesh(new THREE.TorusGeometry(.037,.009,6,10),new THREE.MeshStandardMaterial({color:0xb8c3bc,metalness:.88,roughness:.32}),36);links.name='articulated-chain-links';links.frustumCulled=false;group.add(links);
          const blade=new THREE.Mesh(new THREE.ConeGeometry(.075,.53,3),new THREE.MeshStandardMaterial({color:0xd3ded6,metalness:.85,roughness:.26}));blade.name='launched-hooked-dagger';blade.rotation.x=Math.PI/2;group.add(blade);this.scene.add(group);this.chains[slot]=group;
        }
        const attack=f.attack,active=attack?.id==='special'||attack?.id==='ultimate';group.visible=active;
        fighters[slot]!.showHeldDagger(!active);
        if(active&&attack){
          const start=fighters[slot]!.handPosition('R'),move=CHAMPIONS.veyra.moves[attack.id];
          const enemy=state.fighters[slot===0?1:0],target=new THREE.Vector3(attack.connected?enemy.x:attack.aimX,1.35,attack.connected?enemy.z:attack.aimZ);
          let extend=Math.min(1,Math.max(0,(attack.elapsed-move.startup*.55)/(move.startup*.45)));
          if(attack.elapsed>move.startup+move.active)extend*=1-THREE.MathUtils.smoothstep(attack.elapsed,move.startup+move.active,move.startup+move.active+move.recovery);
          const end=start.clone().lerp(target,extend),links=group.children[0] as THREE.InstancedMesh,dummy=new THREE.Object3D();
          const direction=end.clone().sub(start).normalize(),base=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
          for(let i=0;i<36;i++){const t=i/35;dummy.position.copy(start).lerp(end,t);dummy.position.y-=Math.sin(t*Math.PI)*(.12+.12*(1-extend));dummy.quaternion.copy(base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),i%2*Math.PI/2));dummy.scale.setScalar(1);dummy.updateMatrix();links.setMatrixAt(i,dummy.matrix);}links.instanceMatrix.needsUpdate=true;
          const blade=group.children[1]!;blade.position.copy(end);blade.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
        }
      }else if(this.chains[slot])this.chains[slot]!.visible=false;
      if(f.id==='mawren'){
        let seal=this.seals[slot];
        if(!seal){
          seal=new THREE.Group();seal.name='mawren-inscribed-rune';
          const mat=new THREE.MeshBasicMaterial({color:0xbd9ee7,transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending});
          for(const radius of [.72,1.02]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.018,6,48),mat);ring.rotation.x=Math.PI/2;seal.add(ring);}
          for(let i=0;i<8;i++){const glyph=new THREE.Mesh(new THREE.OctahedronGeometry(.065,0),mat);glyph.position.set(Math.sin(i*Math.PI/4)*.85,.07,Math.cos(i*Math.PI/4)*.85);glyph.scale.y=.35;seal.add(glyph);}
          const starPoints:number[]=[];for(let i=0;i<5;i++){const a=i*Math.PI*4/5,b=(i+1)*Math.PI*4/5;starPoints.push(Math.sin(a)*.67,.02,Math.cos(a)*.67,Math.sin(b)*.67,.02,Math.cos(b)*.67);}seal.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(starPoints,3)),new THREE.LineBasicMaterial({color:0xcdb6ef,transparent:true,opacity:.7})));
          this.scene.add(seal);this.seals[slot]=seal;
        }
        seal.visible=f.runeTime>0;seal.position.set(f.runeX,.07,f.runeZ);seal.rotation.y=time*.16;seal.scale.setScalar(1.7);
        let ward=this.wards[slot];
        if(!ward){ward=new THREE.Mesh(new THREE.SphereGeometry(1,24,16,0,Math.PI),new THREE.MeshBasicMaterial({color:0xb49de0,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,wireframe:true}));ward.name='mawren-forward-arcane-ward';ward.scale.set(1.5,1.6,1.1);this.scene.add(ward);this.wards[slot]=ward;}
        ward.visible=f.wardTime>0;ward.position.set(f.x,1.25,f.z);ward.rotation.y=f.yaw;
      }else{if(this.seals[slot])this.seals[slot]!.visible=false;if(this.wards[slot])this.wards[slot]!.visible=false;}
    });
  }
}
