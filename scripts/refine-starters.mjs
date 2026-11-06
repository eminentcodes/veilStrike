import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
const folder = new URL('../apps/web/public/models/characters/', import.meta.url);
const palettes = {
  karen: { shirt: '#d3bb8b', leather: '#793b37', pants: '#665141', boots: '#573827', skin: '#b88661', hair: '#46251a' },
  taren: { shirt: '#2f5d83', leather: '#596879', pants: '#344f69', boots: '#795136', skin: '#a97e5f', hair: '#40342b' },
  nomet: { shirt: '#bbb494', leather: '#794833', pants: '#8c553b', boots: '#756850', skin: '#71816c', hair: '#303b2d' },
};
const versions = { karen: 'v3', taren: 'v1', nomet: 'v1' };
const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
for (const id of Object.keys(palettes)) {
  const original = await readFile(new URL(`${id}-human-${versions[id]}.glb`, folder));
  const j = JSON.parse(original.subarray(20, 20 + original.readUInt32LE(12)));
  const binaryStart = 20 + original.readUInt32LE(12) + 8;
  const binary = Buffer.from(original.subarray(binaryStart));
  for (const m of j.materials ?? []) {
    const name = m.name.toLowerCase(); let key;
    if (/skin|lips/.test(name)) key = 'skin';
    else if (/shirt|linen/.test(name)) key = 'shirt';
    else if (/trouser/.test(name)) key = 'pants';
    else if (/riding leather|boot/.test(name)) key = 'boots';
    else if (/fitted leather|oxblood/.test(name)) key = 'leather';
    else if (/hair|auburn/.test(name)) key = 'hair';
    if (!key) continue;
    const color = new THREE.Color(palettes[id][key]);
    m.pbrMetallicRoughness.baseColorFactor = [color.r, color.g, color.b, 1];
    // The old albedo encoded linear color as sRGB, crushing colored cloth.
    delete m.pbrMetallicRoughness.baseColorTexture;
    if (key === 'hair') m.pbrMetallicRoughness.roughnessFactor = .8;
    if (key === 'skin') m.pbrMetallicRoughness.roughnessFactor = .76;
  }
  for (const mesh of j.meshes) {
    if (id === 'karen' || !/exposed anatomical skin/i.test(mesh.name)) continue;
    for (const p of mesh.primitives) {
      const accessor = j.accessors[p.attributes.POSITION], view = j.bufferViews[accessor.bufferView];
      const stride = view.byteStride || 12, offset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
      const up = accessor.max[1] > accessor.max[2] ? 1 : 2;
      console.log(id,'skin bounds',accessor.min,accessor.max,'up axis',up);
      const values = new Float32Array(accessor.count * 3);
      for (let i = 0; i < accessor.count; i++) {
        const at = offset + i * stride;
        const coords=[binary.readFloatLE(at),binary.readFloatLE(at+4),binary.readFloatLE(at+8)];
        let x=coords[0],height=coords[up],front=up===1?coords[2]:-coords[1];
        if (height > 1.48 && height < 1.75) {
          const face = Math.max(0, 1 - Math.abs(height - 1.60) / .13);
          if (id === 'taren') {
            x *= 1 + .18 * face;
            if (Math.abs(x) < .022 && height > 1.59 && height < 1.67 && front > .08) front += .018 * face;
            if (height < 1.60 && front > .08) front += .008 * face;
          } else {
            x *= 1 - .13 * face;
            if (Math.abs(x) > .027 && height > 1.57 && height < 1.66 && front > .06) front -= .022 * face;
            if (Math.abs(x) < .025 && height > 1.58 && height < 1.66 && front > .08) front -= .010 * face;
          }
        }
        if (id === 'nomet' && height > 1.05 && height < 1.44 && Math.abs(x) < .24) {
          const bulk = Math.sin((height - 1.05) / .39 * Math.PI);
          x *= 1 + .23 * bulk; front *= 1 + .17 * bulk;
        }
        coords[0]=x;if(up===1)coords[2]=front;else coords[1]=-front;
        values.set(coords,i*3);for(let c=0;c<3;c++)binary.writeFloatLE(coords[c],at+c*4);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(values,3));
      if (p.indices != null) {
        const a=j.accessors[p.indices],v=j.bufferViews[a.bufferView],at=(v.byteOffset||0)+(a.byteOffset||0);
        const bits=a.componentType===5125?4:a.componentType===5123?2:1, indices=[];
        for(let i=0;i<a.count;i++) indices.push(bits===4?binary.readUInt32LE(at+i*bits):bits===2?binary.readUInt16LE(at+i*bits):binary.readUInt8(at+i));
        g.setIndex(indices);
      }
      g.computeVertexNormals();g.computeBoundingBox();accessor.min=g.boundingBox.min.toArray();accessor.max=g.boundingBox.max.toArray();
      if(p.attributes.NORMAL!=null){const a=j.accessors[p.attributes.NORMAL],v=j.bufferViews[a.bufferView],at=(v.byteOffset||0)+(a.byteOffset||0),step=v.byteStride||12,n=g.getAttribute('normal');for(let i=0;i<a.count;i++){binary.writeFloatLE(n.getX(i),at+i*step);binary.writeFloatLE(n.getY(i),at+i*step+4);binary.writeFloatLE(n.getZ(i),at+i*step+8);}}
      g.dispose();
    }
  }
  j.asset.extras={...j.asset.extras,veilstrikeRefined:true};
  let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  const file=`${id}-fantasy-v2.glb`;
  await writeFile(new URL(file,folder),Buffer.concat([header,json,binHeader,binary]));
  manifest.characters[id].file=file;manifest.characters[id].revision='fantasy-v2';
  console.log(`${id}: distinct materials and facial anatomy; all animations retained.`);
}
manifest.version=5;
await writeFile(new URL('manifest.json',folder),JSON.stringify(manifest,null,2)+'\n');
