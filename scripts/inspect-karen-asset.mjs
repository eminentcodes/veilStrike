import { readFile } from 'node:fs/promises';
const manifest=JSON.parse(await readFile('apps/web/public/models/characters/manifest.json','utf8'));
const b=await readFile('apps/web/public/models/characters/'+manifest.characters.karen.file);
const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
console.log(JSON.stringify({meshes:j.meshes.map((m,i)=>({i,name:m.name,bounds:j.accessors[m.primitives[0].attributes.POSITION]})).filter(m=>/vest|coat|lapel|body/i.test(m.name)),nodes:j.nodes.filter(n=>n.mesh!==undefined&&/vest|coat|lapel/i.test(n.name)),skins:j.skins.map(s=>({head:s.joints.findIndex(i=>j.nodes[i].name==='head'),hair:s.joints.findIndex(i=>j.nodes[i].name==='hair')}))}));
