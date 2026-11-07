import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
const folder = new URL('../apps/web/public/models/characters/', import.meta.url);
const original = await readFile(new URL('nomet-fantasy-v2.glb',folder));
const j = JSON.parse(original.subarray(20,20+original.readUInt32LE(12)));
const binary = Buffer.from(original.subarray(28+original.readUInt32LE(12)));
const changes=[];
for (const mesh of j.meshes) {
  if (!/exposed anatomical skin/i.test(mesh.name)) continue;
  for (const primitive of mesh.primitives) {
    const accessor=j.accessors[primitive.attributes.POSITION],view=j.bufferViews[accessor.bufferView];
    const stride=view.byteStride||12,offset=(view.byteOffset||0)+(accessor.byteOffset||0);
    const up=accessor.max[1]>accessor.max[2]?1:2,vertices=new Float32Array(accessor.count*3);
    let changed=0;
    for(let i=0;i<accessor.count;i++) {
      const at=offset+i*stride,coords=[binary.readFloatLE(at),binary.readFloatLE(at+4),binary.readFloatLE(at+8)];
      let x=coords[0],height=coords[up],front=up===1?coords[2]:-coords[1];
      const initial=[x,height,front];
      if(height>1.035&&height<1.445&&Math.abs(x)<.27) {
        const bulk=Math.sin((height-1.035)/.41*Math.PI);
        x*=1+.29*bulk;front*=1+.29*bulk;
        // Raised trapezius mass makes the brawler's neckline distinct.
        if(height>1.32&&Math.abs(x)>.075&&Math.abs(x)<.18)height+=.018*Math.sin((Math.abs(x)-.075)/.105*Math.PI);
      }
      if(Math.abs(x)>.24&&Math.abs(x)<.55&&height>1.05&&height<1.44) {
        const muscle=Math.sin((Math.abs(x)-.24)/.31*Math.PI);
        front*=1+.80*muscle;x+=Math.sign(x)*.022*muscle;
        height=1.26+(height-1.26)*(1+.14*muscle);
      }
      // Heavy angular jaw, hollow cheeks and a pronounced brow, using anatomical topology.
      if(height>1.535&&height<1.675&&Math.abs(x)<.09) {
        if(height<1.585)x*=1+.10*Math.sin((height-1.535)/.05*Math.PI);
        if(height>1.59&&height<1.635&&Math.abs(x)>.028&&front>.065)front-=.009*Math.sin((height-1.59)/.045*Math.PI);
        if(height>1.634&&height<1.665&&front>.075)front+=.008*Math.sin((height-1.634)/.031*Math.PI);
      }
      if(x!==initial[0]||height!==initial[1]||front!==initial[2])changed++;
      coords[0]=x;coords[up]=height;if(up===1)coords[2]=front;else coords[1]=-front;
      vertices.set(coords,i*3);for(let c=0;c<3;c++)binary.writeFloatLE(coords[c],at+c*4);
    }
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(vertices,3));
    if(primitive.indices!==undefined) {
      const a=j.accessors[primitive.indices],v=j.bufferViews[a.bufferView],at=(v.byteOffset||0)+(a.byteOffset||0),bits=a.componentType===5125?4:2,indices=[];
      for(let i=0;i<a.count;i++)indices.push(bits===4?binary.readUInt32LE(at+i*bits):binary.readUInt16LE(at+i*bits));
      geometry.setIndex(indices);
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();accessor.min=geometry.boundingBox.min.toArray();accessor.max=geometry.boundingBox.max.toArray();
    if(primitive.attributes.NORMAL!==undefined){const a=j.accessors[primitive.attributes.NORMAL],v=j.bufferViews[a.bufferView],at=(v.byteOffset||0)+(a.byteOffset||0),step=v.byteStride||12,n=geometry.getAttribute('normal');for(let i=0;i<a.count;i++){binary.writeFloatLE(n.getX(i),at+i*step);binary.writeFloatLE(n.getY(i),at+i*step+4);binary.writeFloatLE(n.getZ(i),at+i*step+8);}}
    geometry.dispose();changes.push({mesh:mesh.name,vertices:accessor.count,changed});
  }
}
if(!changes.some(c=>c.changed>0))throw new Error('No Nomet anatomy changed');
j.asset.extras={...j.asset.extras,veilstrikeRevision:'gravebreaker-v5',refinement:'Heavyweight torso, powerful broader arms and refined jaw, brow and cheek topology.'};
let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
const file='nomet-gravebreaker-v5.glb';await writeFile(new URL(file,folder),Buffer.concat([header,json,binHeader,binary]));
const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
manifest.characters.nomet.file=file;manifest.characters.nomet.revision='gravebreaker-v5';manifest.characters.nomet.refinementScript='scripts/refine-nomet.mjs';manifest.version=Math.max(11,manifest.version);
await writeFile(new URL('manifest.json',folder),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({file,changes}));
