import * as THREE from 'three';
import type { ChampionId } from './catalog';
import type { BoneRole } from '../fight/rig';
import { indexClips, resolveClip } from '../fight/rig';

type Stance = { name: string; crouch: number; lean: number; turn: number; width: number; lead: number; right: [number, number, number]; left: [number, number, number]; breath: number };
/** Coordinates are proportions of body height: hand width, height, forward reach. */
export const FIGHTING_STANCES: Record<ChampionId, Stance> = {
  karen: { name: 'Blade guard', crouch: .025, lean: .025, turn: -.12, width: .085, lead: .09, right: [.13,.69,.18], left: [.12,.66,.16], breath: .002 },
  taren: { name: 'Shield wall', crouch: .043, lean: .07, turn: -.10, width: .105, lead: .09, right: [.16,.66,.22], left: [.08,.69,.26], breath: .0015 },
  nomet: { name: 'Gravebreaker guard', crouch: .057, lean: .14, turn: -.16, width: .12, lead: .085, right: [.13,.78,.20], left: [.13,.82,.24], breath: .0035 },
  veyra: { name: 'Chain hunter', crouch: .035, lean: .07, turn: -.24, width: .095, lead: .12, right: [.17,.66,.22], left: [.12,.70,.15], breath: .002 },
  mawren: { name: 'Rune ward', crouch: .013, lean: .015, turn: -.06, width: .08, lead: .05, right: [.18,.61,.13], left: [.15,.78,.22], breath: .0025 },
  neris: { name: 'Low dagger guard', crouch: .074, lean: .17, turn: -.25, width: .105, lead: .13, right: [.18,.56,.20], left: [.13,.67,.25], breath: .002 },
  vesper: { name: 'Needle guard', crouch: .021, lean: .04, turn: -.30, width: .08, lead: .115, right: [.12,.73,.25], left: [.12,.69,.16], breath: .0015 },
  rhoven: { name: 'Fractured guard', crouch: .047, lean: .10, turn: -.21, width: .09, lead: .11, right: [.17,.63,.20], left: [.13,.73,.18], breath: .003 },
  seyra: { name: 'Divided guard', crouch: .015, lean: .025, turn: -.09, width: .08, lead: .06, right: [.16,.69,.17], left: [.19,.77,.17], breath: .004 },
  varkesh: { name: 'Furnace brace', crouch: .071, lean: .19, turn: -.08, width: .15, lead: .06, right: [.19,.63,.22], left: [.18,.73,.24], breath: .004 },
};
const ease = (t: number) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
type Transform = { bone: THREE.Bone; position: THREE.Vector3; rotation: THREE.Quaternion; scale: THREE.Vector3 };

/** Bake real bone motion over the authored clips. IK keeps soles planted and preserves grips. */
export function buildStanceClips(model: THREE.Group, clips: THREE.AnimationClip[], bones: Map<BoneRole, THREE.Object3D>, id: ChampionId): THREE.AnimationClip[] {
  const skeleton: Transform[] = [];
  model.traverse(o => { if (o instanceof THREE.Bone) skeleton.push({ bone: o, position: o.position.clone(), rotation: o.quaternion.clone(), scale: o.scale.clone() }); });
  const hips = bones.get('Hips') ?? model.getObjectByName('root');
  const head = bones.get('Head');
  const footL = bones.get('FootL'), footR = bones.get('FootR');
  if (!hips || !head || !footL || !footR || !skeleton.length) return [];
  const profile = FIGHTING_STANCES[id], index = indexClips(clips);
  const sampler = new THREE.AnimationMixer(model);
  const point = (bone: THREE.Object3D) => model.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
  const rotation = (bone: THREE.Object3D) => model.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  const setRotation = (bone: THREE.Object3D, q: THREE.Quaternion) => {
    const world = model.getWorldQuaternion(new THREE.Quaternion()).multiply(q);
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    model.updateMatrixWorld(true);
  };
  const offset = (bone: THREE.Object3D, delta: THREE.Vector3) => {
    bone.position.copy(bone.parent!.worldToLocal(model.localToWorld(point(bone).add(delta))));
    model.updateMatrixWorld(true);
  };
  const turn = (bone: THREE.Object3D | undefined, pitch: number, yaw: number) => {
    if (bone) setRotation(bone, new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ')).multiply(rotation(bone)));
  };
  const aim = (bone: THREE.Object3D, child: THREE.Object3D, direction: THREE.Vector3) => {
    const current = point(child).sub(point(bone)).normalize();
    setRotation(bone, new THREE.Quaternion().setFromUnitVectors(current,direction.clone().normalize()).multiply(rotation(bone)));
  };
  const limb = (upper: THREE.Object3D | undefined, lower: THREE.Object3D | undefined, tip: THREE.Object3D | undefined, target: THREE.Vector3, pole: THREE.Vector3) => {
    if (!upper || !lower || !tip) return;
    const tipRotation = rotation(tip), start = point(upper);
    const a = start.distanceTo(point(lower)), b = point(lower).distanceTo(point(tip));
    const axis = target.clone().sub(start), length = Math.max(.001,Math.min(axis.length(),a+b-.0002)); axis.normalize();
    const along = (a*a-b*b+length*length)/(2*length);
    const bend = pole.clone().sub(start); bend.addScaledVector(axis,-bend.dot(axis));
    if (bend.lengthSq()<1e-8) bend.set(0,0,1); bend.normalize();
    const elbow = start.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
    const end = start.clone().addScaledVector(axis,length);
    aim(upper,lower,elbow.sub(start)); aim(lower,tip,end.sub(point(lower))); setRotation(tip,tipRotation);
  };
  const kneel = (upper: THREE.Object3D | undefined, lower: THREE.Object3D | undefined, foot: THREE.Object3D | undefined, floor: number, h: number, amount: number) => {
    if(!upper||!lower||!foot)return;
    const start=point(upper),normalKnee=point(lower),normalFoot=point(foot),q=rotation(foot);
    const a=start.distanceTo(normalKnee),b=normalKnee.distanceTo(normalFoot);
    const kneeY=THREE.MathUtils.lerp(normalKnee.y,.035*h,amount);
    const dy=THREE.MathUtils.clamp(start.y-kneeY,-a*.97,a*.97);
    const knee=new THREE.Vector3(start.x,start.y-dy,start.z+Math.sqrt(Math.max(0,a*a-dy*dy)));
    const ankleY=floor+.018*h*amount;
    const ankleDy=THREE.MathUtils.clamp(ankleY-knee.y,-b*.97,b*.97);
    const ankle=new THREE.Vector3(knee.x,knee.y+ankleDy,knee.z-Math.sqrt(Math.max(0,b*b-ankleDy*ankleDy)));
    aim(upper,lower,knee.clone().sub(start));aim(lower,foot,ankle.sub(point(lower)));
    const folded=new THREE.Quaternion().setFromEuler(new THREE.Euler(.18,Math.PI,0)).multiply(q);
    setRotation(foot,q.slerp(folded,amount));
  };
  const restore = () => { for (const t of skeleton) { t.bone.position.copy(t.position); t.bone.quaternion.copy(t.rotation); t.bone.scale.copy(t.scale); } model.updateMatrixWorld(true); };
  const generated: THREE.AnimationClip[] = [];
  const definitions: [string,string[],number?][] = [
    ...(id==='karen'||id==='taren' ? [['Combat_Lobby',['Lobby_Idle','Idle'],6] as [string,string[],number]] : []),
    ...(id==='karen' ? [['Combat_SwordCombo',['Idle'],1.43]] as [string,string[],number][] : []),
    ['Combat_Ready',['Idle','2H_Melee_Idle','Unarmed_Idle'],3.8],
    ['Combat_Guard',['Guard','Blocking','Block','Idle'],2.8],
    ['Combat_Walk',['Walk','Walking_A']], ['Combat_Run',['Run','Running_A']],
    ['Combat_Back',['Walk_Back','Walking_Backwards','Walking_A']],
    ['Combat_Left',['Strafe_Left','Walking_A']], ['Combat_Right',['Strafe_Right','Walking_A']],
    ['Combat_Defeat',['Idle','Unarmed_Idle'],1.75],
    ['Combat_Hit',['Idle','Unarmed_Idle'],.42],
    ['Combat_Fall',['Idle','Unarmed_Idle'],.72], ['Combat_Rise',['Idle','Unarmed_Idle'],1.15],
    ...(id==='nomet' ? [['Combat_Slam',['Idle','Unarmed_Idle'],1.25] as [string,string[],number]] : []),
    ...(id==='taren' ? [['Combat_Shield',['Idle'],1.35],['Combat_Bash',['Idle'],.9]] as [string,string[],number][] : []),
    ...(id==='veyra' ? [['Combat_Chain',['Idle'],1.45],['Combat_Reel',['Idle'],1.8]] as [string,string[],number][] : []),
    ...(id==='mawren' ? [['Combat_Cast',['Idle'],1.25],['Combat_Bolt',['Idle'],1.1]] as [string,string[],number][] : []),
  ];
  for (const [name,terms,fixedDuration] of definitions) {
    const sourceName = resolveClip(index,terms), source = clips.find(c=>c.name===sourceName); if (!source) continue;
    sampler.stopAllAction(); restore();
    const action = sampler.clipAction(source).setLoop(THREE.LoopRepeat,Infinity).play();
    const duration = fixedDuration ?? source.duration;
    const samples = Math.max(18,Math.ceil(duration*24)), times: number[] = [];
    const values = skeleton.map(()=>({p:[] as number[],q:[] as number[],s:[] as number[]}));
    const locomotion = ['Combat_Walk','Combat_Run','Combat_Back','Combat_Left','Combat_Right'].includes(name);
    for (let i=0;i<=samples;i++) {
      const t=i/samples;
      // THREE skips writes for unchanged animated values. Reactivate after restoring the rig,
      // otherwise procedural offsets accumulate when sampling the same frame repeatedly.
      sampler.stopAllAction(); restore(); action.reset().setLoop(THREE.LoopRepeat,Infinity).play();
      // Last sample equals first for looping poses; falls and surrender hold their final pose.
      const reaction = ['Combat_Hit','Combat_Defeat','Combat_Fall','Combat_Rise','Combat_Slam','Combat_Shield','Combat_Bash','Combat_Chain','Combat_Cast','Combat_Bolt'].includes(name);
      sampler.setTime(reaction ? 0 : locomotion ? t*source.duration : (t===1 ? 0 : t)*source.duration);
      model.updateMatrixWorld(true);
      const leftFoot=point(footL),rightFoot=point(footR);
      const floor = Math.min(leftFoot.y,rightFoot.y), h=Math.max(.5,point(head).y-floor+.13);
      const wave=Math.sin(t*Math.PI*2), guard=name==='Combat_Guard';
      const lobby=name==='Combat_Lobby';
      let drop=locomotion ? profile.crouch*.45 : profile.crouch;
      let lean=profile.lean, twist=profile.turn;
      let surrender=0,fall=0,recoil=0,slam=0;
      if(lobby){drop=.008;lean=.008;twist=-.025;}
      if (name==='Combat_Hit') {
        recoil=t<.13?ease(t/.13):t<.5?1:1-ease((t-.5)/.5);
        lean=profile.lean-.26*recoil;twist=profile.turn*(1-recoil);drop+=.038*recoil;
      }
      if (name==='Combat_Slam') {
        slam=t<.18?0:t<.42?ease((t-.18)/.24):t<.65?1:1-ease((t-.65)/.35);
        drop=profile.crouch+.40*slam;lean=.13+.95*slam;twist=0;
      }
      if(name==='Combat_Shield'||name==='Combat_Bash'){
        const drive=t<.42?ease(t/.42):t<.65?1:1-ease((t-.65)/.35);
        drop=profile.crouch+.035*drive;lean=profile.lean+.16*drive;twist=profile.turn-.07*drive;
      }
      if (name==='Combat_Defeat') {
        surrender=ease((t-.12)/.64); drop=profile.crouch+.29*surrender;
        lean=-.15*Math.sin(Math.min(1,t/.24)*Math.PI)+.36*surrender; twist=0;
      } else if (name==='Combat_Fall'||name==='Combat_Rise') {
        // Pressure knockdowns collapse onto the back. Only defeat uses kneeling.
        fall=name==='Combat_Fall'?ease(t/.88):1-ease((t-.15)/.85);
        drop=profile.crouch;lean=profile.lean*(1-fall);twist=profile.turn*(1-fall);
      }
      offset(hips,new THREE.Vector3(wave*profile.breath*h,-drop*h,-.035*h*recoil));
      if(fall>0){
        const standing=point(hips);
        offset(hips,new THREE.Vector3(0,(.095*h-standing.y)*fall,-.11*h*fall));
        turn(hips,-1.46*fall,0);
      }
      turn(bones.get('Spine'),lean*.35,twist*.4);
      turn(bones.get('Spine1'),lean*.4,twist*.4);
      turn(bones.get('Spine2'),lean*.25,twist*.2);
      turn(head,-lean*.35+surrender*.36,0);
      if (!locomotion) {
        const lp=leftFoot.clone(),rp=rightFoot.clone();
        lp.x=Math.sign(lp.x||1)*profile.width*h; rp.x=Math.sign(rp.x||-1)*profile.width*h;
        lp.z+=profile.lead*h;rp.z-=profile.lead*h;
        if(lobby){lp.x*=.75;rp.x*=.75;lp.z=leftFoot.z+.028*h;rp.z=rightFoot.z-.018*h;}
        if(name==='Combat_Hit') {
          // Catch the impact with a backward step, then hold the weakened stance.
          rp.z-=.16*h*ease(t/.55);lp.z-=.035*h*ease(t/.85);
          rp.y+=t<.55?Math.sin(t/.55*Math.PI)*.035*h:0;
        }
        if(fall>0){
          lp.z=THREE.MathUtils.lerp(lp.z,.27*h,fall);rp.z=THREE.MathUtils.lerp(rp.z,.19*h,fall);
          lp.y=THREE.MathUtils.lerp(lp.y,floor+.012*h,fall);rp.y=THREE.MathUtils.lerp(rp.y,floor+.012*h,fall);
        }
        limb(bones.get('UpLegL'),bones.get('LegL'),footL,lp,new THREE.Vector3(lp.x,.25*h,.35*h));
        limb(bones.get('UpLegR'),bones.get('LegR'),footR,rp,new THREE.Vector3(rp.x,.25*h,.35*h));
        if(surrender>0){
          const down=surrender,upperL=bones.get('UpLegL'),upperR=bones.get('UpLegR'),kneeL=bones.get('LegL'),kneeR=bones.get('LegR');
          if(upperL&&upperR&&kneeL&&kneeR){
            const thigh=(point(upperL).distanceTo(point(kneeL))+point(upperR).distanceTo(point(kneeR)))*.5;
            const hipHeight=(point(upperL).y+point(upperR).y)*.5;
            offset(hips,new THREE.Vector3(0,(.035*h+thigh*.76-hipHeight)*down,0));
          }
          kneel(upperL,kneeL,footL,floor,h,down);kneel(upperR,kneeR,footR,floor,h,down);
        }
      } else {
        // Retain the authored steps after lowering the center of mass.
        limb(bones.get('UpLegL'),bones.get('LegL'),footL,leftFoot,new THREE.Vector3(leftFoot.x,.3*h,.4*h));
        limb(bones.get('UpLegR'),bones.get('LegR'),footR,rightFoot,new THREE.Vector3(rightFoot.x,.3*h,.4*h));
      }
      for (const side of ['L','R'] as const) {
        const upper=bones.get(side==='L'?'ArmL':'ArmR'),lower=bones.get(side==='L'?'ForeArmL':'ForeArmR'),hand=bones.get(side==='L'?'HandL':'HandR');
        if (!upper||!lower||!hand) continue;
        const sign=Math.sign(point(upper).x)||(side==='L'?1:-1), target=side==='L'?profile.left:profile.right;
        const down=Math.max(surrender,fall);
        const sway=locomotion ? wave*.009 : wave*profile.breath;
        const handTarget=new THREE.Vector3(sign*(target[0]*(1-down)+.15*down)*h,
          floor+(target[1]*(1-down)+(fall>0?.07:.19)*down-drop*.35*(1-down)+sway+(guard?.055:0))*h,
          (target[2]*(1-down)+.13*down+(guard?.035:0))*h);
        if(id==='karen'&&down===0){
          const swordSide=Math.sign(point(bones.get('ArmR')!).x)||-1;
          if(side==='L')handTarget.set(swordSide*.065*h,floor+(.655-drop*.35+sway+(guard?.055:0))*h,.19*h);
          if(lobby)handTarget.set(swordSide*(side==='R'?.125:.061)*h,floor+(side==='R'?.655:.61)*h+(sway*h),.19*h);
        }
        if(recoil>0){handTarget.y-=.10*h*recoil;handTarget.z-=.045*h*recoil;}
        if(fall>0){
          handTarget.lerp(new THREE.Vector3(sign*.23*h,floor+.012*h,-.16*h),fall);
        }
        if(name==='Combat_Slam') {
          if(side==='R') {
            const windup=t<.20?Math.sin(t/.20*Math.PI):0;
            handTarget.set(sign*.10*h,(.83+.13*windup-.79*slam)*h,(.10+.18*slam)*h);
          } else handTarget.set(sign*.16*h,floor+(.80-.57*slam)*h,.21*h);
        }
        if(id==='taren'&&(name==='Combat_Shield'||name==='Combat_Bash')){
          const drive=t<.42?ease(t/.42):t<.65?1:1-ease((t-.65)/.35);
          if(side==='L')handTarget.set(sign*.045*h,floor+.70*h,(.23+.18*drive)*h);
          else handTarget.set(sign*.18*h,floor+(.68-.065*drive)*h,(.20+.13*drive)*h);
        }
        if(name==='Combat_Chain'||name==='Combat_Reel'){
          const launch=t<.42?ease(t/.42):1-ease((t-.65)/.35);
          handTarget.set(sign*(side==='R'?.09:.15)*h,floor+(side==='R'?.69:.65)*h,(side==='R'?.12+.30*launch:.16)*h);
          if(name==='Combat_Reel'&&side==='R'&&t>.5){const reel=ease((t-.5)/.3);handTarget.z-=.22*h*reel;handTarget.y+=.12*h*Math.sin(reel*Math.PI);}
        }
        if(name==='Combat_SwordCombo'){
          // Crossing cut, rising reversal, and descending finish, with the free hand supporting the wrist.
          const phase=THREE.MathUtils.clamp((t-.18)/.57,0,1),a=phase*Math.PI*6;
          const reach=Math.sin(phase*Math.PI)*.08;
          handTarget.set((-.075+Math.sin(a)*.13)*h,floor+(.67+Math.sin(a-Math.PI/2)*.07+reach)*h,(.24+Math.cos(a)*.045)*h);
          if(side==='L')handTarget.add(new THREE.Vector3(.025*h,-.035*h,-.018*h));
        }
        if(name==='Combat_Cast'||name==='Combat_Bolt'){
          const cast=t<.42?ease(t/.42):t<.65?1:1-ease((t-.65)/.35);
          if(side==='L')handTarget.set(sign*.14*h,floor+(.74+.055*cast)*h,(.13+.23*cast)*h);
          else handTarget.set(sign*.15*h,floor+.65*h,.14*h);
        }
        limb(upper,lower,hand,handTarget,new THREE.Vector3(sign*.32*h,.59*h,-.07*h));
        if(name==='Combat_SwordCombo'){
          const phase=THREE.MathUtils.clamp((t-.18)/.57,0,1),a=phase*Math.PI*6;
          turn(hand,.5*Math.sin(a),.65*Math.sin(a));
        }
        if(id==='karen'&&side==='L'&&down===0){
          const finger=skeleton.find(s=>/finger3[-_]1[._]?L$/i.test(s.bone.name))?.bone;
          if(finger){
            const toward=point(bones.get('HandR')!).sub(point(hand));toward.y-=.025*h;
            aim(hand,finger,toward);
          }
        }
      }
      model.updateMatrixWorld(true);
      for (let b=0;b<skeleton.length;b++) {
        const bone=skeleton[b]!.bone,v=values[b]!;
        v.p.push(...bone.position.toArray());
        const q=bone.quaternion.clone();
        if (v.q.length&&q.dot(new THREE.Quaternion().fromArray(v.q,v.q.length-4))<0) q.set(-q.x,-q.y,-q.z,-q.w);
        v.q.push(...q.toArray());v.s.push(...bone.scale.toArray());
      }
      times.push(t*duration);
    }
    action.stop();
    const tracks: THREE.KeyframeTrack[]=[];
    for (let b=0;b<skeleton.length;b++) {
      const bone=skeleton[b]!.bone,v=values[b]!;
      // Share the authored binding paths so crossfades blend one property instead of competing writers.
      tracks.push(new THREE.VectorKeyframeTrack(bone.name+'.position',times,v.p),new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',times,v.q),new THREE.VectorKeyframeTrack(bone.name+'.scale',times,v.s));
    }
    generated.push(new THREE.AnimationClip(name,duration,tracks));
  }
  sampler.stopAllAction();sampler.uncacheRoot(model);restore();
  return generated;
}
