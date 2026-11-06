import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../apps/web/public/models/characters/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
for (const [id, height] of [['taren', 1.91], ['nomet', 1.92]]) {
  const file = `${id}-human-v1.glb`;
  const buffer = await readFile(new URL(file, root));
  const document = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  const clips = document.animations.map(a => a.name);
  for (const required of ['Idle', 'Lobby_Idle', 'Light_1', 'Light_2', 'Light_3', 'Heavy', 'Signature', 'Guard', 'Run', 'Hit']) {
    if (!clips.includes(required)) throw new Error(`${id}: missing ${required}`);
  }
  manifest.characters[id] = { file, height, source: `${id}-human-v1.blend`, rigged: true, clips, portrait: `${id}-human-v1.png`, baseLicense: 'CC0 MakeHuman anatomical mesh and weights', revision: 'starter-v1' };
}
manifest.version = 4;
manifest.playable = ['karen', 'taren', 'nomet'];
await writeFile(new URL('manifest.json', root), JSON.stringify(manifest, null, 2) + '\n');
console.log('Three anatomical starter models connected; animation clips validated.');
