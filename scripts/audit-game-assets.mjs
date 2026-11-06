import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const root = 'apps/web/public/models';
async function scan(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) await scan(path);
    else if (e.name.endsWith('.glb')) {
      const b = await readFile(path);
      if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('Invalid GLB: ' + path);
      const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
      const joints = [...new Set((j.skins || []).flatMap(s => s.joints))];
      console.log(JSON.stringify({path,bytes:b.length,animations:(j.animations||[]).map(a=>a.name),bones:joints.map(i=>j.nodes[i]?.name),copyright:j.asset?.copyright,textures:j.textures?.length||0}));
    }
  }
}
await scan(root);
