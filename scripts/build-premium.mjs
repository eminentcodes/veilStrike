// Original equipment and silhouettes on CC0 MakeHuman skin and articulated hands.
// SAMPLECHARA.jpg guides the layered armor, broad shoulder outlines and limited magic.
import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {characterAsset} from './character-glb.mjs';
const folder=new URL('../apps/web/public/models/characters/',import.meta.url);
function coat(a,name,top,bottom,rx,ry,mat){
  const root=a.joint('root');
  for(const sign of [-1,1]){const vertices=[],indices=[],rows=18,cols=33;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const t=r/(rows-1),angle=-.95+c/(cols-1)*(Math.PI/2+.95);vertices.push(sign*(rx+.075*t)*Math.cos(angle),top+(bottom-top)*t, -(.008+(ry+.035*t)*Math.sin(angle)));if(r&&c){const x=(r-1)*cols+c-1;indices.push(x,x+1,x+cols+1,x,x+cols+1,x+cols);}}
    const tail=a.joint(sign>0?'tabard.L':'tabard.R'),weights=i=>[root,tail,Math.max(0,1-Math.floor(i/cols)/(rows-1)*2)];
    a.surface(name+' '+sign,vertices,indices,mat,'root',weights);
  }
}
function shoulders(a,metal,edge,male=false){for(const side of ['L','R']){const sign=side==='L'?1:-1;for(let layer=0;layer<3;layer++){
  const x=sign*(.195+.024*layer),y=(male?1.575:1.423)-.029*layer;
  const vertices=[x-sign*.055,y+.022,.025,x+sign*.075,y+.060,.010,x+sign*.13,y-.012,.035,x+sign*.075,y-.055,.122,x-sign*.045,y-.043,.140,x-sign*.073,y-.013,-.079];
  a.surface('Hand worked pointed layered pauldron '+side+layer,vertices,[0,1,2,0,2,3,0,3,4,0,4,5,0,5,1],metal,'upperarm01.'+side);
  a.tube('Raised shoulder plate edge '+side+layer,[vertices.slice(3,6),vertices.slice(6,9),vertices.slice(9,12),vertices.slice(12,15)],.0024,edge,'upperarm01.'+side);
}}}
function fittedArmor(a,metal,edge,male=false){
 const ratio=male?1.1:1,rows=[[1.39,.13,.17],[1.31,.15,.23],[1.21,.16,.23],[1.10,.105,.17],[1.005,.13,.158]],v=[],ix=[];
 for(let r=0;r<rows.length;r++)for(let c=0;c<17;c++){const u=c/16*2-1,[y,w,z]=rows[r];v.push(u*w*ratio,y*ratio,(z-.06*u*u)*ratio);if(r&&c){const n=(r-1)*17+c-1;ix.push(n,n+1,n+18,n,n+18,n+17);}}
 a.surface('Sculpted fitted chased breastplate',v,ix,metal,'spine03',i=>[a.joint('spine03'),a.joint('root'),Math.max(.1,1-Math.floor(i/17)/(rows.length-1))]);
 for(const sign of [-1,1])a.tube('Engraved curved breastplate border '+sign,rows.map(([y,w,z])=>[sign*w*.96*ratio,y*ratio,(z-.052)*ratio]),.004,edge,'spine03');
 for(let i=0;i<3;i++)a.tube('Chased chest chevron '+i,[[-.09*ratio,(1.31-i*.055)*ratio,.237*ratio],[0,(1.29-i*.055)*ratio,.239*ratio],[.09*ratio,(1.31-i*.055)*ratio,.237*ratio]],.0025,edge,'spine03');
 const belt=a.material('Premium worked leather belt','#33271f',.84);
 a.mesh('Continuous fitted waist belt',new THREE.TorusGeometry(.147,.024,10,40).rotateX(Math.PI/2).scale(1,.65,.83).translate(0,1.0*ratio,.012),belt,'root');
 a.mesh('Raised bronze belt clasp',new THREE.BoxGeometry(.035,.032,.011).translate(0,1.0*ratio,.15*ratio),edge,'root');
 for(const side of ['L','R']){const sign=side==='L'?1:-1,x=sign*(male?.20:.185);
  for(let layer=0;layer<3;layer++){const y=(.45-layer*.07)*ratio;a.surface('Articulated engraved shin plate '+side+layer,[x-.045,y+.045,.115,x+.045,y+.045,.115,x+.035,y-.04,.11,x-.035,y-.04,.11],[0,1,2,0,2,3],metal,'lowerleg01.'+side);a.tube('Shin chased edge '+side+layer,[[x-.043,y+.04,.12],[x,y+.052,.135],[x+.043,y+.04,.12]],.003,edge,'lowerleg01.'+side);}
 }
}
const report=[];
{
 const a=await characterAsset(new URL('karen-swordswoman-v4.glb',folder));
 a.remove(/^Sword |arming sword|blade|grip winding|pommel|shoulder lame|shoulder edge|shoulder fastening|long tapered|face framing|fine auburn|swept auburn|baldric|vest fastening|vest clasp|coat.tail|braid tie/i);
 a.deform(/face neck arms/i,([x,y,z])=>{
   if(y>1.52&&y<1.69&&Math.abs(x)<.095){const f=Math.sin((y-1.52)/.17*Math.PI);x*=1-.13*f;if(Math.abs(x)>.025&&y>1.59&&z>.08)z+=.008*f;if(y<1.59)z-=.006*f;}
   return [x,y,z];
 });
 a.recolor(/skin/,'#775142',.7);a.recolor(/lips/,'#71413d');a.recolor(/hair|auburn/,'#1c1919');a.recolor(/iris/,'#608a62',.4);a.recolor(/shirt|linen/,'#69705a');a.recolor(/sword vest|oxblood/,'#75634a');a.recolor(/boots|riding leather/,'#332c25');a.recolor(/trouser/,'#26312c');a.recolor(/steel/,'#647168',.4,.7);
 const hunt=a.material('Moss velvet and worked hunt leather','#354a3c',.86),metal=a.material('Patinated huntress armor','#60736a',.4,.72),gold=a.material('Bronze chased edging','#b39b64',.42,.65),chain=a.material('Blackened steel chain','#83908c',.32,.84),red=a.material('Muted ochre hunt scarf','#996247',.95);
 coat(a,'Split moss hunt coat',.994,.49,.171,.132,hunt);shoulders(a,metal,gold);fittedArmor(a,metal,gold);
 const mask=a.material('Fitted huntress charcoal leather half mask','#242d29',.78);
 const mv=[],mi=[];for(let row=0;row<5;row++)for(let col=0;col<17;col++){const u=col/16*2-1,t=row/4;mv.push(u*(.055+.019*t),1.531+.073*t,.134+.032*Math.cos(u*Math.PI/2)+.008*t);if(row&&col){const n=(row-1)*17+col-1;mi.push(n,n+1,n+18,n,n+18,n+17);}}
 a.surface('Sculpted fitted lower face hunt mask',mv,mi,mask,'head');
 for(const sign of [-1,1])a.tube('Leather mask fastening '+sign,[[sign*.068,1.583,.137],[sign*.081,1.61,.031],[sign*.074,1.61,-.043]],.003,mask,'head');
 for(const sign of [-1,1])a.tube('Bronze shaped vest seam '+sign,[[sign*.071,1.36,.168],[sign*.12,1.26,.194],[sign*.078,1.09,.149],[sign*.082,.992,.139]],.003,gold,'spine03');
 a.mesh('Fitted hunt scarf collar',new THREE.TorusGeometry(.071,.024,12,40).rotateX(Math.PI/2).scale(1,.8,1).translate(0,1.452,.005),red,'neck01');
 a.surface('Layered hunt scarf fall',[-.085,1.43,.196,-.016,1.44,.216,.06,1.14,.264,-.016,1.13,.275],[0,1,2,0,2,3],red,'spine03');
 const blackHair=a.material('Black braided huntress hair','#171b18',.94);
 for(let braid=0;braid<10;braid++){const x=(braid-4.5)*.018,pts=[];for(let i=0;i<24;i++){const t=i/23;pts.push([x+.009*Math.sin(t*Math.PI*12+braid),1.735-t*(.40+.045*Math.cos(braid)),-.055-.085*Math.sin(t*Math.PI/2)]);}a.tube('Interwoven black hunt braid '+braid,pts,.008,blackHair,'hair');}
 // Closed dagger grip and visible winding chain harness.
 const skin=a.j.skins[0],wristNode=a.j.nodes[skin.joints[a.joint('wrist.R')]],wrist=wristNode.translation??[-.54,1.04,0];
 // Hand attachments share the original sword's anatomical palm position.
 const original=await readFile(new URL('karen-swordswoman-v4.glb',folder));const j=JSON.parse(original.subarray(20,20+original.readUInt32LE(12)));
 const grip=j.meshes.find(m=>/Sword leather wrapped handle/.test(m.name)),bound=j.accessors[grip.primitives[0].attributes.POSITION];
 const center=bound.min.map((v,i)=>(v+bound.max[i])/2),axis=new THREE.Vector3(.90,.12,-.42).normalize(),p=t=>new THREE.Vector3(...center).addScaledVector(axis,t).toArray();
 a.tube('Hooked dagger leather grip',[p(-.04),p(.04)],.011,red,'wrist.R');
 const v=[];for(const [d,w] of [[.05,.023],[.17,.036],[.32,.02],[.4,0]])for(const s of [-1,1]){const q=p(d);v.push(q[0],q[1]+s*w,q[2]+Math.max(0,d-.22)*.23);}
 a.surface('Forged hooked chain dagger',v,[0,1,3,0,3,2,2,3,5,2,5,4,4,5,7,4,7,6],chain,'wrist.R');
 for(let i=0;i<15;i++){const theta=i/15*Math.PI*2;a.mesh('Forearm chain winding '+i,new THREE.TorusGeometry(.012,.0024,6,12).rotateY(i%2*Math.PI/2).translate(-.47+.014*Math.cos(theta),1.15+.035*Math.sin(theta),.035),chain,'lowerarm01.R');}
 for(let i=0;i<7;i++)a.mesh('Belt chain link '+i,new THREE.TorusGeometry(.017,.003,6,12).rotateY(i%2*Math.PI/2).translate(.12,.96-i*.028,.12),chain,'root');
 report.push({id:'veyra',...await a.save(new URL('veyra-premium-v1.glb',folder),{veilstrikeRevision:'premium-v1',authoring:'scripts/build-premium.mjs',identity:'Original armored chain huntress; CC0 female anatomical base.'})});
}
{
 const a=await characterAsset(new URL('taren-fantasy-v2.glb',folder));
 a.deform(/exposed anatomical skin/i,([x,y,z])=>{if(y>1.68&&y<1.90&&Math.abs(x)<.12){const f=Math.sin((y-1.68)/.22*Math.PI);x*=1-.22*f;if(y<1.75)y-=.015*f;if(Math.abs(x)<.022&&y>1.77&&z>.12)z+=.017*f;if(Math.abs(x)>.028&&y>1.76&&z>.12)z-=.010*f;}return [x,y,z];});
 a.remove(/shield|spear|cuirass|pauldron|shoulder brass|poleyn|scar|soldier skirt|armor fastener|field repair|belt clasp|clasp center/i);
 a.remove(/^(Sphere\.001|Sphere\.005|Weathered beard strand|Veteran moustache)/);
 for(const n of a.j.nodes)if(n.mesh!==undefined){const m=a.j.meshes[n.mesh],bound=a.j.accessors[m.primitives[0].attributes.POSITION];if(/^(Cube|Sphere)/.test(m.name)&&bound.min[0]>.35)delete n.mesh;}
 a.recolor(/skin/,'#b9a691',.78);a.recolor(/hair|beard/,'#c0beb2',.86);a.recolor(/shirt|quilted/,'#343249',.9);a.recolor(/trouser/,'#252735');a.recolor(/leather|boots/,'#302b28');
 const robe=a.material('Indigo layered sorcerer brocade','#38344f',.87),lining=a.material('Shadow violet robe facing','#242635',.88),metal=a.material('Etched silver sorcerer shoulder plates','#858c8d',.39,.76),gold=a.material('Sand gold embroidered borders','#bcaa7a',.52,.4),rune=a.material('Restrained amethyst rune glass','#9477c0',.3,.1,'#634391');
 coat(a,'Long divided indigo sorcerer robe',1.13,.095,.20,.14,robe);shoulders(a,metal,gold,true);fittedArmor(a,metal,gold,true);
 a.surface('Asymmetrical sorcerer stole',[-.13,1.56,.267,-.07,1.57,.270,.075,.5,.197,.145,.51,.186],[0,1,2,0,2,3],lining,'spine03');
 for(const sign of [-1,1])a.tube('Sand gold embroidered chest border '+sign,[[sign*.14,1.41,.15],[sign*.09,1.26,.185],[sign*.105,1.06,.14]],.004,gold,'spine03');
 a.mesh('Swept broad sorcerer hat brim',new THREE.CylinderGeometry(.21,.225,.026,48).scale(1.3,1,1).translate(0,1.925,-.003),metal,'head');
 a.mesh('Tapered indigo sorcerer hat crown',new THREE.ConeGeometry(.119,.21,32).scale(1.1,1,1).translate(0,2.03,-.003),robe,'head');
 a.mesh('Sorcerer hat embroidered band',new THREE.TorusGeometry(.121,.006,8,40).rotateX(Math.PI/2).translate(0,1.944,-.003),gold,'head');
 const beard=a.material('Aged silver beard','#c0beb2',.95);
 for(let i=0;i<13;i++){const x=(i-6)*.008;a.tube('Swept silver beard strand '+i,[[x,1.73,.145],[x*.9,1.66,.155],[x*.4,1.55,.125]],.006,beard,'head');}
 for(let i=0;i<3;i++){a.mesh('Bound rune scroll '+i,new THREE.CylinderGeometry(.020,.020,.14,12).rotateZ(.08).translate(-.14+i*.037,.936,.127),gold,'root');a.mesh('Scroll leather tie '+i,new THREE.TorusGeometry(.021,.003,6,16).rotateX(Math.PI/2).translate(-.14+i*.037,.936,.127),lining,'root');}
 // A tall physical staff accompanies the floating spell hand.
 const handle=a.j.meshes.find(m=>/Spear leather hand binding/i.test(m.name)),bounds=a.j.accessors[handle.primitives[0].attributes.POSITION],center=bounds.min.map((v,i)=>(v+bounds.max[i])/2);
 const axis=new THREE.Vector3(.445,.44,.803).normalize(),p=(t,x=0)=>new THREE.Vector3(...center).addScaledVector(axis,t).add(new THREE.Vector3(x,0,0)).toArray(),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
 a.tube('Gnarled bronze rune staff',[p(-1),p(0,-.008),p(.88)],.016,gold,'wrist.R');
 a.mesh('Restrained rune staff focus',new THREE.OctahedronGeometry(.085,1).scale(.7,1.45,.7).applyQuaternion(q).translate(...p(.98)),rune,'wrist.R');
 for(const sign of [-1,1])a.tube('Curved staff focus guard '+sign,[p(.85,sign*.025),p(.97,sign*.1),p(1.04,sign*.067)],.007,metal,'wrist.R');
 report.push({id:'mawren',...await a.save(new URL('mawren-premium-v1.glb',folder),{veilstrikeRevision:'premium-v1',authoring:'scripts/build-premium.mjs',identity:'Original elderly rune sorcerer; CC0 male anatomical base.'})});
}
const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
for(const id of ['veyra','mawren'])manifest.characters[id]={file:id+'-premium-v1.glb',height:id==='veyra'?1.74:1.91,source:id+'-premium-v1.blend',rigged:true,revision:'premium-v1',refinementScript:'scripts/build-premium.mjs',baseLicense:'CC0 MakeHuman anatomical mesh and weights; original Veilstrike costume and equipment'};
manifest.version=Math.max(12,manifest.version);manifest.playable=['karen','taren','nomet','veyra','mawren'];await writeFile(new URL('manifest.json',folder),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(report));
