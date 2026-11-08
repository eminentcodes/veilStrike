import {chromium} from 'playwright';
import {readdir,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
const executablePath=(await readdir(join(process.env.LOCALAPPDATA,'ms-playwright'))).filter(n=>/^chromium-[0-9]+$/.test(n)).sort().reverse().map(n=>join(process.env.LOCALAPPDATA,'ms-playwright',n,'chrome-win64','chrome.exe')).find(existsSync);
const browser=await chromium.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(90000);
await mkdir('verification/screenshots/release-art',{recursive:true});
await page.route('**/release-art-page',r=>r.fulfill({contentType:'text/html',body:'<html><style>html,body{margin:0;background:#111b25}#host{position:fixed;inset:0}canvas{display:block}</style><body><div id="host"></div></body></html>'}));
try{
 await page.goto('http://127.0.0.1:5173/release-art-page');
 await page.evaluate(async()=>{const {DuelRenderer}=await import('/src/duel/DuelRenderer.ts'),{DuelSimulation}=await import('/src/duel/simulation.ts'),{CHAMPIONS}=await import('/src/duel/catalog.ts');Object.assign(window,{DuelRenderer,DuelSimulation,artChampions:CHAMPIONS});});
 async function setup(player,opponent,arena){await page.evaluate(async config=>{window.art?.renderer.destroy();const renderer=new window.DuelRenderer(document.querySelector('#host'),config,false,true);await renderer.ready;renderer.renderer.setPixelRatio(1);renderer.resize();const simulation=new window.DuelSimulation(config);window.art={renderer,simulation};}, {player,opponent,arena,difficulty:'warrior',mode:'pvp'});}
 async function draw({characters=false,camera=[6,4,9],look=[0,2,-9],portrait=false}={}){
  await page.evaluate(({characters,camera,look,portrait})=>{const {renderer:r,simulation:s}=window.art,frame=s.snapshot();frame.phase='fight';frame.events=[];for(let i=0;i<2;i++){Object.assign(frame.fighters[i],{state:'idle',stateTime:0,x:i===0?-.9:.9,z:i===0?0:-.35,yaw:i===0?.12:-.15});r.fighters[i].root.visible=characters&&(i===0||!portrait);r.fighters[i].root.position.set(frame.fighters[i].x,0,frame.fighters[i].z);r.fighters[i].root.rotation.y=frame.fighters[i].yaw;}if(portrait){frame.fighters[0].x=0;r.fighters[0].root.position.x=0;}for(let i=0;i<5;i++)r.render(frame,.025);r.camera.position.set(...camera);r.camera.lookAt(...look);r.renderer.render(r.scene,r.camera);if(r.composer)r.composer.render();}, {characters,camera,look,portrait});
 }
 for(const [name,arena,camera,look] of [['story','citadel',[5,3.7,8],[0,2.7,-13]],['achievements','forge',[4.5,3.5,8],[0,3,-17]],['leaderboards','rift',[4,3.2,7],[0,2,-10]]]){await setup('karen','taren',arena);await draw({camera,look});await page.screenshot({path:'verification/screenshots/release-art/'+name+'.png'});console.log(name+' artwork captured.');}
 await setup('veyra','mawren','sanctum');await draw({characters:true,camera:[.2,2.4,6.4],look:[0,1.5,0]});await page.screenshot({path:'verification/screenshots/release-art/fighters.png'});console.log('Premium pair captured.');
 await page.setViewportSize({width:480,height:640});
 for(const id of ['karen','taren','nomet','veyra','mawren']){await setup(id,'taren','sanctum');const size=await page.evaluate(id=>window.artChampions[id].size,id);await draw({characters:true,portrait:true,camera:[.25*size,1.8*size,4.5*size],look:[0,1.3*size,0]});await page.screenshot({path:'verification/screenshots/release-art/'+id+'.png'});console.log(id+' portrait captured.');}
}finally{await browser.close();}
