import {readFile,writeFile} from 'node:fs/promises';
async function edit(path,changes){let s=await readFile(path,'utf8');for(const [from,to] of changes){if(!s.includes(from)){if(s.includes(to))continue;throw new Error('Missing anchor in '+path+': '+from);}s=s.replace(from,to);}await writeFile(path,s);}
await edit('apps/web/src/duel/DuelGame.tsx',[["simulation, renderer, getSnapshot:","simulation, renderer, input, pause, isPaused: () => pausedRef.current, getSnapshot:"]]);
await edit('apps/web/src/duel/roster.ts',[
 ['Arming sword & throwing blades','Arming sword'],
 ['Decisive cuts, clear footwork, and a steel blade when distance opens.','Decisive cuts, clear footwork, and a flowing three-cut sword combination.'],
 ['Balanced swordplay / Blade Toss','Balanced swordplay / Crescent Steel'],
 ['Reach to the belt, turn the shoulder, and throw a real steel blade. A miss leaves a brief recovery opening.','Sweep the sword across, reverse into a rising cut, then drive a final descending strike. Her supporting hand follows the grip and each cut has its own steel trail and impact.'],
 ['Moderate reach; exposed after a missed throw.','Moderate reach; exposed after a missed combination.'],
 ["specialName: 'BLADE TOSS'","specialName: 'CRESCENT STEEL'"],
 ['Faster blade recovery','Faster sword recovery'],
 ["{ startup: .23, active: .2, recovery: .30, range: 7.5, damage: 20 }","{ startup: .27, active: .81, recovery: .35, range: 3.25, arc: 1.45, damage: 36, strikes: 3, lunge: 1.1, clip: ['Combat_SwordCombo'] }"]
]);
console.log('Integrated deterministic review controls and Karen sword signature.');
