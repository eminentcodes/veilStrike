import {readFile,writeFile} from 'node:fs/promises';
const lobby='apps/web/src/lobby/GameLobby.tsx';let source=await readFile(lobby,'utf8');
function replace(before,after){if(!source.includes(before))throw new Error('Integration anchor missing: '+before);source=source.replaceAll(before,after);}
replace('completeOnboarding, rewardMatch, upgradeCharacter','completeOnboarding, rewardMatch, unlockCharacter, upgradeCharacter');
replace('<small>6 WORLDS</small>','<small>{ARENA_IDS.length} WORLDS</small>');
replace('Three free fighters ready for battle. Seven more are coming soon. Earn Embers to upgrade your starters.','Three basic fighters and two premium fighters are ready for battle. Unlock premium fighters with Embers.');
replace('{level && level < 3 ? <>','{!level ? <button className="duel-primary" disabled={profile.embers < character.cost} onClick={() => setProfile(p => unlockCharacter(p, player))}><LockKey size={17}/> UNLOCK {character.name} · {character.cost.toLocaleString()} EMBERS</button> : level < 3 ? <>');
await writeFile(lobby,source);
const roster='apps/web/src/duel/roster.ts';let lines=(await readFile(roster,'utf8')).split('\n');
const index=id=>lines.findIndex(line=>line.trimStart().startsWith(id+': fighter('));
let i=index('veyra');
for(const [a,b] of [
 ['health: 122, stamina: 116, speed: 4.8','health: 172, stamina: 146, regen: 36, armor: .16, speed: 5.4, cooldown: 6'],
 ["outfit: 'Black braids, moss-green hunt coat, tan hide vest, charcoal trousers, and a chain winding harness at her forearm.'","outfit: 'Layered pointed steel shoulder plates, bronze-edged moss hunt coat, fitted hide vest, charcoal face mask, green eyes, black braids and a chained dagger.'"],
 ['startup: .17, range: 2.3','startup: .13, range: 2.5, damage: 15'],
 ['range: 2.7, arc: 1.5, damage: 23','range: 2.9, arc: 1.5, damage: 35'],
 ['startup: .39, active: .2, recovery: .9, range: 7.8, damage: 19','startup: .32, active: .2, recovery: .62, range: 8, damage: 40'],
 ['range: 5.5, damage: 48','range: 5.5, damage: 62'],
 ]){if(!lines[i].includes(a))throw new Error('Veyra tuning anchor '+a);lines[i]=lines[i].replace(a,b);}
i=index('mawren');
for(const [a,b] of [
 ['health: 108, stamina: 118, regen: 29, speed: 4.05','health: 170, stamina: 148, regen: 36, speed: 5.15, cooldown: 6'],
 ['armor: .025','armor: .16'],
 ["weakness: 'Spells need preparation; fragile under close pressure.'","weakness: 'Runes require accurate placement; a missed bolt leaves a casting recovery window.'"],
 ["outfit: 'Silver hair and beard, layered indigo robes, sand-gold embroidered borders, scroll cases, and a gnarled staff.'","outfit: 'Broad silver sorcerer hat, long lean elderly face, silver beard, pointed engraved shoulder plates, layered indigo robes, sand-gold borders, scroll belt and a bronze rune staff.'"],
 ['damage: 9 }, { startup: .4','damage: 15 }, { startup: .32'],
 ['range: 8, damage: 21','range: 8.5, damage: 36'],
 ['startup: .54, active: .2','startup: .42, active: .2'],
 ['damage: 48','damage: 62'],
 ]){if(!lines[i].includes(a))throw new Error('Mawren tuning anchor '+a);lines[i]=lines[i].replace(a,b);}
await writeFile(roster,lines.join('\n'));console.log('Premium unlocks, outfit descriptions and stronger premium combat tuning integrated.');
