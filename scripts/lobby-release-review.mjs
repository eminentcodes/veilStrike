import {chromium} from 'playwright';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const executablePath=(await readdir(join(process.env.LOCALAPPDATA,'ms-playwright'))).filter(n=>/^chromium-[0-9]+$/.test(n)).sort().reverse().map(n=>join(process.env.LOCALAPPDATA,'ms-playwright',n,'chrome-win64','chrome.exe')).find(existsSync);
const browser=await chromium.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],checks=[];
page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{if(!localStorage.getItem('veilstrike:profile:v1'))localStorage.setItem('veilstrike:profile:v1',JSON.stringify({version:1,name:'Review',id:'REVIEW',embers:400,matches:1,wins:0,selectedFighter:'karen',onboarding:{setup:true,lobby:true,combat:true},levels:{karen:1,taren:1,nomet:1},claimed:[],daily:{day:'2026-11-07',matches:0,firstWin:false,threeMatches:false}}));});
const base=process.env.REVIEW_URL||'http://127.0.0.1:5173/';await mkdir('verification/screenshots/lobby-release',{recursive:true});
try{
 await page.goto(base+'#lobby');await page.waitForSelector('.game-lobby > .lobby-scene[data-ready="true"]');
 await page.locator('.lobby-coming').hover();assert.equal(await page.locator('.lobby-coming button').count(),0);await page.clock.install();
 const bounds=await page.evaluate(()=>{const c=document.querySelector('.lobby-coming').getBoundingClientRect(),s=document.querySelector('.lobby-spin-event').getBoundingClientRect();return {card:{top:c.top,bottom:c.bottom,left:c.left,right:c.right},spin:{top:s.top,bottom:s.bottom}};});
 assert.ok(bounds.card.bottom<bounds.spin.top,'Preview must appear above the spinner');checks.push({name:'Visible preview above spinner',bounds});
 await page.screenshot({path:'verification/screenshots/lobby-release/desktop.png'});console.log('Preview visible above spinner.');
 const before=await page.locator('.coming-slide.is-current h2').textContent();await page.clock.fastForward(15000);assert.equal(await page.locator('.coming-slide.is-current h2').textContent(),before,'Hover should pause the card');
 await page.mouse.move(0,0);
 for(let i=0;i<4;i++){const prior=await page.locator('.coming-slide.is-current h2').textContent();await page.clock.fastForward(10100);const next=await page.locator('.coming-slide.is-current h2').textContent();assert.notEqual(next,prior);checks.push({preview:next});}
 await page.getByRole('button',{name:'400 Embers. Open Ember shop',exact:true}).click();assert.equal(await page.getByRole('button',{name:'PURCHASE EMBERS — COMING SOON',exact:true}).isDisabled(),true);
 await page.screenshot({path:'verification/screenshots/lobby-release/ember-shop.png'});await page.getByRole('button',{name:'Close panel',exact:true}).click();
 await page.getByRole('button',{name:'Characters',exact:true}).click();await page.getByRole('button',{name:'VEYRA Select',exact:true}).click();await page.getByRole('button',{name:'Close panel',exact:true}).click();await page.locator('.lobby-play').click();
 await page.getByText('VEYRA IS LOCKED',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'UNLOCK VEYRA',exact:true}).isDisabled(),true);await page.screenshot({path:'verification/screenshots/lobby-release/unlock.png'});
 await page.getByRole('button',{name:'CHOOSE ANOTHER FIGHTER',exact:true}).click();await page.getByRole('button',{name:'KAREN Select',exact:true}).click();await page.getByRole('button',{name:'Close panel',exact:true}).click();
 await page.getByRole('button',{name:'Change game mode',exact:true}).click();assert.equal(await page.locator('.difficulty-options').count(),0);await page.getByRole('button',{name:'CONFIRM BATTLE',exact:true}).click();
 checks.push({name:'Carousel navigation, shop coming soon, locked Play popup, no difficulty selector',passed:true});
 const mechanics=await page.evaluate(async()=>{
  const {readProfile,rewardMatch}=await import('/src/duel/progression.ts'),{DuelSimulation,emptyInput,ROUND_LENGTH,NORMAL_DAMAGE_SCALE,ULTIMATE_DAMAGE_SCALE}=await import('/src/duel/simulation.ts');
  const p=readProfile(),results=[{won:true,tied:false,playerRounds:2,botRounds:0},{won:false,tied:false,playerRounds:1,botRounds:2},{won:false,tied:false,playerRounds:0,botRounds:2},{won:false,tied:true,playerRounds:0,botRounds:0}];
  const rewards=results.map((r,i)=>rewardMatch(p,'review-'+i,r).reward),again=rewardMatch(rewardMatch(p,'repeated',results[0]).profile,'repeated',results[0]).reward;
  const config={player:'karen',opponent:'taren',arena:'sanctum',difficulty:'warrior',mode:'pvp'},sim=new DuelSimulation(config);
  for(let round=1;round<=3;round++){sim.phase='fight';sim.timer=.001;sim.fighters[0].hp=60;sim.fighters[1].hp=100;sim.advance(.01,emptyInput(),emptyInput());if(sim.winner!==null)throw Error('Timeout awarded a winner');for(let i=0;i<330;i++)sim.advance(.01,emptyInput(),emptyInput());}
  return {rewards,again,round:sim.round,phase:sim.phase,winner:sim.winner,wins:sim.wins,ROUND_LENGTH,NORMAL_DAMAGE_SCALE,ULTIMATE_DAMAGE_SCALE};
 });
 assert.deepEqual(mechanics.rewards,[75,25,0,30]);assert.equal(mechanics.again,0);assert.equal(mechanics.ROUND_LENGTH,150);assert.equal(mechanics.NORMAL_DAMAGE_SCALE,.468);assert.equal(mechanics.ULTIMATE_DAMAGE_SCALE,.612);assert.equal(mechanics.phase,'complete');assert.equal(mechanics.round,3);assert.equal(mechanics.winner,null);checks.push(mechanics);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'verification/screenshots/lobby-release/mobile.png'});
 const mobile=await page.evaluate(()=>{const c=document.querySelector('.lobby-coming').getBoundingClientRect(),s=document.querySelector('.lobby-spin-event').getBoundingClientRect();return {right:c.right,left:c.left,cardBottom:c.bottom,spinTop:s.top,width:document.documentElement.scrollWidth};});assert.ok(mobile.right<=390&&mobile.left>=0&&mobile.cardBottom<mobile.spinTop);checks.push(mobile);
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS: visible previews, lock popup, Ember shop, rewards, 2:30 rounds, three-round draw and mobile layout.');
}catch(error){checks.push({failure:String(error)});await page.screenshot({path:'verification/screenshots/lobby-release/failure.png'}).catch(()=>{});throw error;}
finally{await writeFile('verification/lobby-release-review.json',JSON.stringify({checks,errors},null,2));await browser.close();}
