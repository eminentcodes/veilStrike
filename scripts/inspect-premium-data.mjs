import {readFile} from 'node:fs/promises';
for(const file of ['taren-fantasy-v2.glb','mawren-premium-v1.glb']){
 const b=await readFile('apps/web/public/models/characters/'+file),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 console.log(file);
 for(const n of j.nodes)if(n.mesh!==undefined){const m=j.meshes[n.mesh];if(/^(Cube|Sphere)/.test(m.name))console.log(m.name,j.materials[m.primitives[0].material]?.name,j.accessors[m.primitives[0].attributes.POSITION].min,j.accessors[m.primitives[0].attributes.POSITION].max);}
}
