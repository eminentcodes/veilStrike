import {chromium} from 'playwright';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const executablePath=(await readdir(join(process.env.LOCALAPPDATA,'ms-playwright'))).filter(n=>/^chromium-[0-9]+$/.test(n)).sort().reverse().map(n=>join(process.env.LOCALAPPDATA,'ms-playwright',n,'chrome-win64','chrome.exe')).find(existsSync);
const browser=await chromium.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:960,height:720}}),errors=[],checks=[];
page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const base=process.env.REVIEW_URL||'http://127.0.0.1:5173/';
const folder='verification/screenshots/premium';await mkdir(folder,{recursive:true});
try{
  await page.addInitScript(()=>localStorage.setItem('veilstrike:profile:v1',JSON.stringify({version:1,name:'Review',id:'REVIEW',embers:4000,matches:1,wins:0,selectedFighter:'karen',onboarding:{setup:true,lobby:true,combat:true},levels:{karen:1,taren:1,nomet:1,veyra:1,mawren:1},claimed:[],daily:{day:'2026-11-07',matches:0,firstWin:false,threeMatches:false}})));
  await page.goto(base+'#lobby',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.game-lobby > .lobby-scene[data-ready="true"]');
  await page.screenshot({path:folder+'/lobby.png'});console.log('Lobby ready.');
  await page.getByRole('button',{name:'Characters',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'VEYRA Select',exact:true}).count(),1);
  await page.getByRole('button',{name:'VEYRA Select',exact:true}).click();
  await page.waitForSelector('.collection-model .lobby-scene[data-ready="true"]');
  await page.screenshot({path:folder+'/veyra-collection.png'});
  await page.getByRole('button',{name:'Close panel',exact:true}).click();
  await page.locator('.lobby-play').click();await page.waitForFunction(()=>!!window.__veilstrike?.renderer.fighters.every(f=>!!f.model));
  await page.locator('.duel-loading').waitFor({state:'detached'});
  await page.evaluate(()=>window.__veilstrike.pause(true));assert.equal(await page.evaluate(()=>window.__veilstrike.isPaused()),true);
  await page.evaluate(async()=>{const {DuelInput}=await import('/src/duel/input.ts');window.reviewInput=new DuelInput(document.querySelector('.duel-canvas'),()=>{},()=>{},()=>{});});
  // Actual DOM keyboard events are sampled manually while paused, so the attack cannot be missed between frames.
  for(const double of [false,true]){
    await page.evaluate(()=>window.reviewInput.reset());
    await page.keyboard.press('j');if(double)await page.keyboard.press('j',{delay:35});
    if(!double)await page.waitForTimeout(240);
    const sample=await page.evaluate(()=>{const d=window.__veilstrike;return window.reviewInput.sample(d.renderer.movementBasis(),true);});
    checks.push({input:double?'double':'single',sample});assert.equal(sample[double?'heavy':'light'],true);assert.equal(sample[double?'light':'heavy'],false);
  }
  checks.push({name:'Premium selectable in collection and combat',id:await page.evaluate(()=>window.__veilstrike.getSnapshot().fighters[0].id)});
  await page.evaluate(()=>window.reviewInput.destroy());
  await page.route('**/combat-visual-review',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>html,body{margin:0;background:#111822;color:#eee;font:14px sans-serif}#host{position:absolute;inset:0}#label{position:absolute;bottom:12px;left:16px;z-index:2;pointer-events:none;letter-spacing:2px}canvas{display:block;width:100%;height:100%}</style></head><body><div id="host"></div><div id="label"></div></body></html>'}));
  await page.goto(base+'combat-visual-review');
  await page.evaluate(async()=>{const {DuelRenderer}=await import('/src/duel/DuelRenderer.ts'),{DuelSimulation}=await import('/src/duel/simulation.ts'),{CHAMPIONS,ARENA_IDS}=await import('/src/duel/catalog.ts');Object.assign(window,{ReviewRenderer:DuelRenderer,ReviewSimulation:DuelSimulation,reviewChampions:CHAMPIONS,reviewArenas:ARENA_IDS});});
  async function create(id,arena='sanctum'){
    await page.evaluate(async({id,arena})=>{window.review?.renderer.destroy();const config={player:id,opponent:'taren',arena,difficulty:'warrior',mode:'pvp'},renderer=new window.ReviewRenderer(document.querySelector('#host'),config,false,false);await renderer.ready;renderer.renderer.shadowMap.enabled=false;renderer.renderer.setPixelRatio(1);renderer.resize();const simulation=new window.ReviewSimulation(config);window.review={renderer,simulation};}, {id,arena});
  }
  async function pose(id,state='idle',elapsed=0,move=null){
    return page.evaluate(({id,state,elapsed,move})=>{
      const {renderer:r,simulation:s}=window.review,frame=s.snapshot();frame.phase='fight';frame.events=[];
      frame.fighters[0]={...frame.fighters[0],x:0,z:0,yaw:0,state,stateTime:elapsed,stunDuration:.72,attack:move?{id:move,elapsed,combo:0,connected:false,startedAt:10,power:1,released:true,aimX:0,aimZ:3}:null};
      frame.fighters[1]={...frame.fighters[1],x:0,z:3,yaw:Math.PI};r.fighters[1].root.visible=false;
      if(move==='special'&&['nomet','taren'].includes(id))frame.events=[{id:100,kind:'release',slot:0,x:0,z:0,move}];
      if(id==='mawren'&&move==='special')Object.assign(frame.fighters[0],{runeTime:8,runeX:0,runeZ:2.6,wardTime:1.4});
      r.fighters[0].root.position.set(0,0,0);r.fighters[0].root.rotation.y=0;
      for(let i=0;i<7;i++)r.render(frame,.025);
      const size=window.reviewChampions[id].size;
      r.camera.position.set(.8*size,1.75*size,5.4*size);r.camera.lookAt(0,1.25*size,0);r.renderer.render(r.scene,r.camera);
      document.querySelector('#label').textContent=id.toUpperCase()+' · '+(move||state).toUpperCase();
      const rig=r.fighters[0],p=role=>rig.bones.get(role)?.getWorldPosition(rig.root.position.clone()).toArray();
      return {id,state,move,clip:rig.current?.getClip().name,yaw:rig.root.rotation.y,footL:p('FootL'),footR:p('FootR'),kneeL:p('LegL'),kneeR:p('LegR'),hand:p('HandR'),head:p('Head'),equipment:rig.equipment.map(m=>m.name),effects:r.scene.children.filter(o=>o.visible&&/chain|rune|ward|shield|bolt/.test(o.name)).map(o=>o.name)};
    },{id,state,elapsed,move});
  }
  for(const id of ['karen','taren','nomet','veyra','mawren']){
    await create(id);checks.push(await pose(id));await page.screenshot({path:folder+'/'+id+'-ready.png'});
    const m=await page.evaluate(id=>window.reviewChampions[id].moves.special,id);
    checks.push(await pose(id,'attack',m.startup+m.active*.3,'special'));await page.screenshot({path:folder+'/'+id+'-signature.png'});
    if(id==='mawren'){checks.push(await pose(id,'attack',.4,'heavy'));await page.screenshot({path:folder+'/mawren-bolt.png'});}
    if(id==='veyra'){checks.push(await pose(id,'attack',.85,'ultimate'));await page.screenshot({path:folder+'/veyra-ultimate.png'});}
    for(const [state,elapsed] of [['stagger',.22],['knockdown',.74],['getup',.55],['dead',1.75]]){
      const report=await pose(id,state,elapsed);checks.push(report);assert.equal(report.yaw,0,'Reaction rotated the fighter');
      assert.ok(report.footL[1]>=.015&&report.footR[1]>=.015,'Foot penetrated arena');
      if(state==='stagger')assert.ok(report.kneeL[1]>.3&&report.kneeR[1]>.3,'Ordinary impact kneeled');
      if(state==='dead')assert.ok(report.kneeL[1]>.025&&report.kneeR[1]>.025,'Defeat knees buried');
      await page.screenshot({path:folder+'/'+id+'-'+state+'.png'});
    }
    console.log(id+' captured and reactions checked.');
  }
  assert.equal(await page.evaluate(()=>window.reviewArenas.length),5);
  for(const arena of ['sanctum','forge','grove','citadel','rift']){
    await create('taren',arena);await pose('taren');
    const scenery=await page.evaluate(arena=>{const r=window.review.renderer;r.fighters.forEach(f=>f.root.visible=false);r.camera.position.set(13,11,16);r.camera.lookAt(0,2,-3);r.renderer.render(r.scene,r.camera);document.querySelector('#label').textContent=arena.toUpperCase();return r.scene.children.map(o=>o.name).filter(Boolean);},arena);
    checks.push({arena,scenery});await page.screenshot({path:folder+'/arena-'+arena+'.png'});console.log(arena+' captured.');
  }
  assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS: Premium selection, keyboard gestures, all five rigs, skills, reactions and five arenas.');
}catch(error){checks.push({failure:String(error)});await page.screenshot({path:folder+'/failure.png'}).catch(()=>{});throw error;}
finally{await writeFile('verification/premium-visual-review.json',JSON.stringify({checks,errors},null,2));await browser.close();}
