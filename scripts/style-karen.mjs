// Add a tailored sword coat to Karen's original, anatomically rigged Blender export.
// Keeps the editable v4 body, face, long hair, hand grip and all authored animations.
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
const folder = new URL('../apps/web/public/models/characters/', import.meta.url);
const original = await readFile(new URL('karen-swordswoman-v4.glb', folder));
const j = JSON.parse(original.subarray(20, 20 + original.readUInt32LE(12)));
const chunks = [Buffer.from(original.subarray(28 + original.readUInt32LE(12)))];
let length = chunks[0].length;
function material(name, hex, roughness = .75, metalness = 0) {
  const c = new THREE.Color(hex);
  j.materials.push({ name, doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [c.r,c.g,c.b,1], roughnessFactor: roughness, metallicFactor: metalness } });
  return j.materials.length - 1;
}
const navy = material('Midnight blue tailored sword coat', '#274b68', .82);
const inset = material('Deep navy coat facing', '#182a3b', .88);
const gold = material('Brushed brass piping and clasps', '#ba955b', .42, .65);
const ivory = material('Ivory folded linen collar', '#e0d5bd', .9);
const palette = [
  [/linen|shirt/i, '#ded4bd', .9], [/sword vest|oxblood/i, '#274b68', .82],
  [/trouser/i, '#26333d', .9], [/riding leather/i, '#3e3029', .67],
  [/hair|auburn/i, '#583322', .67], [/skin/i, '#bd8d6d', .72], [/lips/i, '#9c6359', .64],
  [/thread/i, '#bc9a64', .75],
];
for (const m of j.materials) {
  const match = palette.find(([pattern]) => pattern.test(m.name));
  if (!match) continue;
  const c = new THREE.Color(match[1]);
  m.pbrMetallicRoughness.baseColorFactor = [c.r,c.g,c.b,1];
  m.pbrMetallicRoughness.roughnessFactor = match[2];
  // Blender's old packed textures encode linear albedo as sRGB and darken the clothes.
  delete m.pbrMetallicRoughness.baseColorTexture;
}
const vestNode = j.nodes.find(n => n.mesh !== undefined && /articulated leather sword vest/i.test(j.meshes[n.mesh].name));
if (!vestNode) throw new Error('Missing Karen fitted vest');
const vestIndex = j.nodes.indexOf(vestNode), skin = j.skins[vestNode.skin];
const joint = name => { const index=skin.joints.findIndex(n=>j.nodes[n].name===name);if(index<0)throw new Error('Missing garment joint '+name);return index; };
function accessor(data, type, componentType, target, bounds) {
  const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const padding = (4-length%4)%4;if(padding){chunks.push(Buffer.alloc(padding));length+=padding;}
  const offset=length;chunks.push(bytes);length+=bytes.length;
  const view=j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target})-1;
  const size={SCALAR:1,VEC3:3,VEC4:4}[type];
  return j.accessors.push({bufferView:view,componentType,count:data.length/size,type,...bounds})-1;
}
function garment(name, positions, indices, mat, weights) {
  // Authoring helpers use Blender Z-up; the exported skin/inverse binds use glTF Y-up.
  positions=positions.flatMap((_,i)=>i%3===0?[positions[i],positions[i+2],-positions[i+1]]:[]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();
  const joints=[],values=[];
  for(let i=0;i<positions.length/3;i++) {const w=weights(i);joints.push(w[0],w[1]??w[0],0,0);values.push(w[2]??1,1-(w[2]??1),0,0);}
  const attributes={
    POSITION:accessor(new Float32Array(positions),'VEC3',5126,34962,{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}),
    NORMAL:accessor(geometry.getAttribute('normal').array,'VEC3',5126,34962),
    JOINTS_0:accessor(new Uint16Array(joints),'VEC4',5123,34962),
    WEIGHTS_0:accessor(new Float32Array(values),'VEC4',5126,34962),
  };
  const mesh=j.meshes.push({name,primitives:[{attributes,indices:accessor(new Uint32Array(indices),'SCALAR',5125,34963),material:mat}]})-1;
  const node=j.nodes.push({...vestNode,name,mesh})-1;
  const parent=j.nodes.find(n=>n.children?.includes(vestIndex));
  if(parent)parent.children.push(node);else j.scenes[j.scene??0].nodes.push(node);
  geometry.dispose();return node;
}
function ribbon(name, points, width, mat, weight) {
  const vertices=[],indices=[];
  for(let i=0;i<points.length;i++){const p=points[i];vertices.push(p[0]-width/2,p[1]-.002,p[2],p[0]+width/2,p[1]-.002,p[2]);if(i)indices.push((i-1)*2,(i-1)*2+1,i*2+1,(i-1)*2,i*2+1,i*2);}
  garment(name,vertices,indices,mat,i=>weight(Math.floor(i/2)));
}
const root=joint('root'),spine=joint('spine03'),tailL=joint('tabard.L'),tailR=joint('tabard.R');
// Flaring side and rear panels form a long coat with an open front for sword footwork.
for(const sign of [-1,1]) {
  const vertices=[],indices=[],rows=13,columns=25;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++) {
    const t=row/(rows-1),angle=-.28+col/(columns-1)*(Math.PI/2+.28);
    const z=.991-.46*t+.018*t*Math.sin(angle);
    vertices.push(sign*(.17+.065*t)*Math.cos(angle),.013+(.124+.037*t)*Math.sin(angle)+.006*Math.sin(col*.7)*t,z);
    if(row&&col){const a=(row-1)*columns+col-1,b=a+1,c=row*columns+col,d=c-1;indices.push(a,b,c,a,c,d);}
  }
  const tail=sign>0?tailL:tailR,weights=i=>[root,tail,Math.max(0,1-Math.floor(i/columns)/(rows-1)*2.5)];
  garment('Tailored midnight coat skirt '+sign,vertices,indices,navy,weights);
  const edge=Array.from({length:rows},(_,r)=>vertices.slice(r*columns*3,r*columns*3+3));
  ribbon('Brass edged open coat front '+sign,edge,.008,gold,i=>weights(i*columns));
  const hem=Array.from({length:columns},(_,c)=>vertices.slice(((rows-1)*columns+c)*3,((rows-1)*columns+c)*3+3));
  ribbon('Dark folded coat hem '+sign,hem,.012,inset,()=>[tail]);
  // Angular lapels follow the bust instead of forming a flat rectangular chest panel.
  const p=[sign*.116,-.130,1.405,sign*.085,-.174,1.328,sign*.018,-.175,1.268,sign*.030,-.174,1.370];
  garment('Shaped linen collar and coat lapel '+sign,p,[0,1,2,0,2,3],ivory,()=>[spine]);
  ribbon('Fine brass lapel piping '+sign,[[p[0],p[1]-.002,p[2]],[p[3],p[4]-.002,p[5]],[p[6],p[7]-.002,p[8]]],.004,gold,()=>[spine]);
}
// The old short front tails are retained as darker overlapping inner panels.
for(const mesh of j.meshes)if(/split leather coat tail/i.test(mesh.name))for(const p of mesh.primitives)p.material=inset;
j.asset.extras={...j.asset.extras,veilstrikeRevision:'swordcoat-v6',outfit:'Tailored midnight blue long sword coat, ivory collar and sleeves, brass trim, fitted waist, dark riding trousers and leather boots.'};
const finalPadding=(4-length%4)%4;if(finalPadding){chunks.push(Buffer.alloc(finalPadding));length+=finalPadding;}
j.buffers[0].byteLength=length;
let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(length);binHeader.writeUInt32LE(0x004e4942,4);
const file='karen-swordcoat-v6.glb';await writeFile(new URL(file,folder),Buffer.concat([header,json,binHeader,...chunks]));
const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
manifest.version=Math.max(10,manifest.version);Object.assign(manifest.characters.karen,{file,revision:'swordcoat-v6',source:'karen-swordswoman-v4.blend',refinementScript:'scripts/style-karen.mjs'});
await writeFile(new URL('manifest.json',folder),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({file,meshes:j.meshes.length,animations:j.animations.length,bytes:28+json.length+length}));
