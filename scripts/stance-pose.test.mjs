import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
const require=createRequire(import.meta.url),three=new URL('three.module.js',pathToFileURL(require.resolve('three'))).href;
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const rigUrl=moduleUrl(compile(await readFile('apps/web/src/fight/rig.ts','utf8')));
const {resolveBones}=await import(rigUrl);
const stanceSource=compile(await readFile('apps/web/src/duel/stances.ts','utf8')).replace("from 'three'",`from '${three}'`).replace("from '../fight/rig'",`from '${rigUrl}'`);
const {buildStanceClips}=await import(moduleUrl(stanceSource));
async function model(id){
  const manifest=JSON.parse(await readFile('apps/web/public/models/characters/manifest.json','utf8'));
  const data=await readFile('apps/web/public/models/characters/'+manifest.characters[id].file);
  const j=JSON.parse(data.subarray(20,20+data.readUInt32LE(12))),binary=data.subarray(28+data.readUInt32LE(12));
  const joints=new Set(j.skins.flatMap(s=>s.joints));
  const nodes=j.nodes.map((node,i)=>{
    const bone=joints.has(i)?new THREE.Bone():new THREE.Object3D();bone.name=THREE.PropertyBinding.sanitizeNodeName(node.name||'node'+i);
    if(node.matrix)bone.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix));else{if(node.translation)bone.position.fromArray(node.translation);if(node.rotation)bone.quaternion.fromArray(node.rotation);if(node.scale)bone.scale.fromArray(node.scale);}
    return bone;
  });
  j.nodes.forEach((node,i)=>(node.children||[]).forEach(child=>nodes[i].add(nodes[child])));
  const root=new THREE.Group();j.scenes[j.scene||0].nodes.forEach(i=>root.add(nodes[i]));root.updateMatrixWorld(true);
  const accessor=index=>{const a=j.accessors[index],v=j.bufferViews[a.bufferView],components={SCALAR:1,VEC3:3,VEC4:4}[a.type],values=[];for(let i=0;i<a.count;i++)for(let c=0;c<components;c++)values.push(binary.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||components*4)+c*4));return values;};
  const clips=j.animations.map(animation=>new THREE.AnimationClip(animation.name,-1,animation.channels.map(channel=>{
    const sampler=animation.samplers[channel.sampler],path={translation:'position',rotation:'quaternion',scale:'scale'}[channel.target.path];
    const Track=path==='quaternion'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;
    return new Track(nodes[channel.target.node].name+'.'+path,accessor(sampler.input),accessor(sampler.output));
  })));
  const bones=resolveBones(root);bones.set('Hips',root.getObjectByName('root'));
  const generated=buildStanceClips(root,clips,bones,id);
  return {root,bones,clips,generated};
}
for(const id of ['karen','taren','nomet','veyra','mawren'])test(id+': reactions retain body orientation and keep feet and knees above the ground',async()=>{
  const {root,bones,clips,generated}=await model(id),mixer=new THREE.AnimationMixer(root);
  const p=role=>bones.get(role).getWorldPosition(new THREE.Vector3());
  const idle=mixer.clipAction(clips.find(c=>c.name==='Idle')).play();mixer.setTime(0);root.updateMatrixWorld(true);
  const floor=Math.min(p('FootL').y,p('FootR').y),hipsRotation=bones.get('Hips').getWorldQuaternion(new THREE.Quaternion());
  idle.stop();
  for(const name of ['Combat_Ready','Combat_Hit','Combat_Defeat','Combat_Fall','Combat_Rise']){
    mixer.stopAllAction();const clip=generated.find(c=>c.name===name);assert.ok(clip);
    const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
    for(let sample=0;sample<=24;sample++){
      action.reset().play();mixer.setTime(clip.duration*sample/24);root.updateMatrixWorld(true);
      assert.ok(p('FootL').y>=floor-.02&&p('FootR').y>=floor-.02,`${id} ${name}: a transition buried a foot at ${sample}/24`);
      if(name==='Combat_Hit')assert.ok(p('LegL').y>.23&&p('LegR').y>.23,`${id}: ordinary impact kneeled at ${sample}/24`);
    }
    action.reset().play();mixer.setTime(clip.duration*(name==='Combat_Hit'?.3:name==='Combat_Rise'?.5:.99));root.updateMatrixWorld(true);
    const feet=[p('FootL').y,p('FootR').y],knees=[p('LegL').y,p('LegR').y];
    console.log(JSON.stringify({id,name,floor,feet,knees,head:p('Head').toArray()}));
    assert.ok(feet.every(y=>y>=floor-.015),`${id} ${name}: feet below floor ${feet}`);
    assert.ok(feet.every(y=>y<=floor+.18),`${id} ${name}: feet floated above floor ${feet}`);
    assert.ok(knees.every(y=>y>=.015),`${id} ${name}: knees below floor ${knees}`);
    if(name==='Combat_Defeat')assert.ok(knees.every(y=>y<.15),`${id}: surrender knees are too far above ground ${knees}`);
    if(name==='Combat_Fall')assert.ok(p('Head').y<.45,`${id}: pressure knockdown should reach the ground, not kneel`);
    if(!['Combat_Fall','Combat_Rise'].includes(name))assert.ok(bones.get('Hips').getWorldQuaternion(new THREE.Quaternion()).angleTo(hipsRotation)<.1,`${id} ${name}: root rotation changed`);
  }
  // Crossfade from an authored attack into surrender must not have competing transform bindings.
  mixer.stopAllAction();const attack=mixer.clipAction(clips.find(c=>c.name==='Light_1')).play();mixer.update(.2);
  const defeat=mixer.clipAction(generated.find(c=>c.name==='Combat_Defeat')).setLoop(THREE.LoopOnce,1);defeat.clampWhenFinished=true;defeat.play().crossFadeFrom(attack,.075,false);
  for(let i=0;i<120;i++)mixer.update(1/60);root.updateMatrixWorld(true);
  assert.ok(p('FootL').y>=floor-.015&&p('FootR').y>=floor-.015,id+' crossfade buried the feet');
});

test('Nomet strikes the actual ground with his own fist and returns to standing',async()=>{
  const {root,bones,generated}=await model('nomet'),mixer=new THREE.AnimationMixer(root);
  const clip=generated.find(c=>c.name==='Combat_Slam');assert.ok(clip);
  const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
  mixer.setTime(clip.duration*.5);root.updateMatrixWorld(true);
  const hand=(root.getObjectByName('wristR')??root.getObjectByName('wristr')??bones.get('HandR')).getWorldPosition(new THREE.Vector3());
  console.log('Nomet fist contact',hand.toArray());
  assert.ok(hand.y<.2,'The fist must reach the ground, not stop in mid-air');
});
