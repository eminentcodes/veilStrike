import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../apps/web/src/duel/audio.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const { DuelSoundscape } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
function setup(arena='sanctum') {
  const calls=[];
  const audio={sound:(name,gain,pan)=>calls.push({name,gain,pan}),announce:(cue,priority,force)=>calls.push({name:'voice:'+cue,priority,force}),
    combatImpact:(heavy,fists,pan)=>calls.push({name:'impact',heavy,fists,pan}),ultimate:()=>{}};
  const champions={karen:{id:'karen',skill:'blade'},taren:{id:'taren',skill:'oath'},nomet:{id:'nomet',skill:'grave'}};
  const fighter=id=>({id,x:0,z:0,y:0,state:'idle',stateTime:0});
  const frame={fighters:[fighter('karen'),fighter('nomet')],round:1,phase:'fight',phaseTime:0,winner:null};
  const soundscape=new DuelSoundscape(arena,audio,champions);
  const event=(kind,extra={})=>soundscape.event({id:1,kind,slot:0,x:0,z:0,...extra},frame,0);
  return {calls,frame,soundscape,event,count:name=>calls.filter(c=>c.name===name).length};
}

test('a knockdown impact precedes one floor thud; standing hits never fall',()=>{
  const s=setup();
  s.event('hit',{move:'heavy',target:1,knockdown:true});
  assert.equal(s.count('body-fall'),0);
  s.frame.fighters[1].state='knockdown';s.frame.fighters[1].stateTime=.05;s.soundscape.update(s.frame,0);
  assert.equal(s.count('body-fall'),0);
  s.frame.fighters[1].stateTime=.8;s.soundscape.update(s.frame,0);s.soundscape.update(s.frame,0);
  assert.equal(s.count('body-fall'),1);
});

test('a jump lands on its surface; a throw waits for body contact',()=>{
  const s=setup('forge');
  s.event('jump');s.event('land');assert.equal(s.count('land-metal'),1);assert.equal(s.count('body-fall'),0);
  s.event('throw');assert.equal(s.count('body-fall'),0);
  s.frame.fighters[1].state='thrown';s.event('land',{slot:1});assert.equal(s.count('body-fall'),1);
});

test('surrender delays equipment and body contact, and unarmed fighters do not drop weapons',()=>{
  const s=setup();
  for(const f of s.frame.fighters){f.state='dead';f.stateTime=.05;}
  s.soundscape.update(s.frame,0);assert.equal(s.count('equipment-drop'),0);assert.equal(s.count('body-collapse'),0);
  for(const f of s.frame.fighters)f.stateTime=1.5;
  s.soundscape.update(s.frame,0);s.soundscape.update(s.frame,0);
  assert.equal(s.count('equipment-drop'),1);assert.equal(s.count('body-collapse'),2);
});

test('footsteps require grounded travel and reject spawn teleports',()=>{
  const s=setup('grove');s.frame.fighters[0].state='move';
  s.soundscape.update(s.frame,0);s.soundscape.update(s.frame,0);assert.equal(s.count('footstep-earth'),0);
  s.frame.fighters[0].x=1.1;s.soundscape.update(s.frame,0);assert.equal(s.count('footstep-earth'),1);
  s.frame.fighters[0].x=7;s.soundscape.update(s.frame,0);assert.equal(s.count('footstep-earth'),1);
  s.frame.fighters[0].state='jump';s.frame.fighters[0].y=1;s.frame.fighters[0].x=8;s.soundscape.update(s.frame,0);
  assert.equal(s.count('footstep-earth'),1);
});

test('weapon and fist releases differ; hit sound comes from the victim side',()=>{
  const s=setup();s.event('release',{move:'light'});s.event('release',{slot:1,move:'heavy'});
  assert.equal(s.count('weapon-swing'),1);assert.equal(s.count('fist-swing'),1);
  s.event('hit',{slot:1,target:0,move:'heavy'});
  const hit=s.calls.find(c=>c.name==='impact');assert.equal(hit.fists,true);assert.equal(hit.heavy,true);assert.ok(hit.pan<0);
});

test('signature charging is separate from the ground slam release',()=>{
  const s=setup();s.event('spell',{slot:1,move:'special'});assert.equal(s.count('ground-slam'),0);
  s.event('release',{slot:1,move:'special'});assert.equal(s.count('ground-slam'),1);
});

test('round results have one cue after the finish rather than every frame',()=>{
  const s=setup();s.frame.phase='roundEnd';s.frame.winner=0;s.soundscape.update(s.frame,0);
  assert.equal(s.count('round-win'),0);s.frame.phaseTime=1.2;
  s.soundscape.update(s.frame,0);s.soundscape.update(s.frame,0);assert.equal(s.count('round-win'),1);
});

test('announcer reacts to signature release and substantial impacts, not ordinary contact',()=>{
  const s=setup();s.event('spell',{slot:1,move:'special'});assert.equal(s.count('voice:signature-nomet'),0);
  s.event('release',{slot:1,move:'special'});assert.equal(s.count('voice:signature-nomet'),1);
  s.event('hit',{move:'light',damage:12,target:1});assert.equal(s.count('voice:crushing-blow'),0);
  s.event('hit',{move:'heavy',damage:22,target:1});assert.equal(s.count('voice:crushing-blow'),1);
  s.event('hit',{move:'special',target:1,knockdown:true});assert.equal(s.count('voice:heavy-impact'),1);
});

test('round three uses its own combined Round three Fight announcement',()=>{
  const s=setup();s.frame.round=3;s.event('round');
  const voice=s.calls.find(c=>c.name==='voice:round-fight-3');assert.equal(voice.priority,8);assert.equal(voice.force,true);
});
