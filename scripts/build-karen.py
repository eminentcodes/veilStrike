"""Karen: fitted dark-fantasy equipment on a CC0 anatomical human base.

blender -b --python scripts/build-karen.py -- --preview
The MakeHuman source mesh, morphs and skin weights are CC0; equipment,
materials and animation choreography are authored for Veilstrike.
"""
import bpy
import bmesh
import math
import json
import sys
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix, Euler
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache'
OUT = ROOT / 'apps/web/public/models/characters'
SOURCE = CACHE / 'character-source'
H = 1.74
FPS = 30
PIECES = []
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)

def read_base():
    vertices, uvs, faces, groups = [], [], [], {}
    group = ''
    for line in (CACHE / 'human-base.obj').read_text().splitlines():
        p = line.split()
        if not p: continue
        if p[0] == 'v': vertices.append(tuple(map(float, p[1:4])))
        elif p[0] == 'vt': uvs.append(tuple(map(float, p[1:3])))
        elif p[0] == 'g': group = p[1]
        elif p[0] == 'f':
            f = [(int(v.split('/')[0])-1, int(v.split('/')[1])-1) for v in p[1:]]
            faces.append((group, f))
            groups.setdefault(group, set()).update(v[0] for v in f)
    v = np.asarray(vertices, dtype=float)
    for filename, amount in [('human-female.target', 1.0), ('human-athletic.target', .27)]:
        for line in (CACHE / filename).read_text().splitlines():
            if not line or line.startswith('#'): continue
            row = line.split()
            v[int(row[0])] += np.array(list(map(float, row[1:]))) * amount
    body = list(groups['body'])
    floor = min(v[i,1] for i in body)
    factor = H / (max(v[i,1] for i in body)-floor)
    v = np.stack((v[:,0], -v[:,2], v[:,1]-floor), axis=1)*factor
    skel = json.loads((CACHE / 'human-skeleton.json').read_text())
    joints = {name: Vector(v[indices].mean(axis=0)) for name, indices in skel['joints'].items()}
    return v, uvs, faces, groups, skel, joints

V, UV, FACES, GROUPS, SKEL, JOINTS = read_base()
if '--inspect' in sys.argv:
    for name in ['root', 'head', 'spine01', 'spine05', 'upperarm01.R', 'lowerarm01.R', 'wrist.R', 'upperleg01.R', 'foot.R', 'eye.R', 'jaw']:
        b = SKEL['bones'][name]
        print(name, 'head', tuple(round(n,4) for n in JOINTS[b['head']]), 'tail', tuple(round(n,4) for n in JOINTS[b['tail']]), flush=True)
    print('BODY', len(GROUPS['body']), 'HEIGHT', H, flush=True)
    raise SystemExit(0)

def linear_color(code):
    rgb = [int(code.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)

def mat(name, color, kind='cloth', metallic=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = linear_color(color)
    p.inputs['Roughness'].default_value = {'skin':.55,'cloth':.86,'leather':.57,'hair':.38,'steel':.28,'eye':.24}.get(kind,.65)
    p.inputs['Metallic'].default_value = metallic
    if kind == 'skin':
        p.inputs['Subsurface Weight'].default_value=.08
        p.inputs['Subsurface Radius'].default_value=(.8,.35,.18)
    if kind in ('cloth','leather','steel','skin'):
        noise = m.node_tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = {'cloth':270,'leather':190,'skin':650,'steel':85}[kind]
        noise.inputs['Roughness'].default_value=.7
        bump = m.node_tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value=.12 if kind=='skin' else .28
        bump.inputs['Distance'].default_value=.0003 if kind=='skin' else .001
        m.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
        m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
    # Embed a surface texture so runtime retains color/material variation.
    if kind in ('cloth','leather'):
        size=256
        yy,xx=np.mgrid[:size,:size]
        rng=np.random.default_rng(sum(ord(c) for c in name))
        factor=1+rng.normal(0,.025,(size,size))+.02*np.sin(xx*.085)*np.cos(yy*.068)
        if kind=='cloth': factor+=.055*np.sin(xx*math.pi/2)*np.sin(yy*math.pi/2)
        pixels=np.ones((size,size,4),dtype=np.float32)
        pixels[:,:,:3]=np.array(linear_color(color)[:3])*factor[:,:,None]
        img=bpy.data.images.new(name+' albedo',width=size,height=size)
        img.pixels.foreach_set(pixels.ravel());img.pack()
        t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=img
        m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    return m

def weight_name(name):
    if name.startswith(('upperarm02.','lowerarm02.','upperleg02.','lowerleg02.')):
        return name.replace('02.','01.')
    if name.startswith('pelvis.'): return 'root'
    if name.startswith(('breast.','risorius','levator','oculi','orbicularis','oris','temporalis','special','tongue')) or name=='jaw':
        return 'head' if not name.startswith('breast.') else 'spine02'
    return name

def make_rig():
    arm=bpy.data.armatures.new('Karen anatomical skeleton')
    rig=bpy.data.objects.new('KarenRig',arm);bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    used={weight_name(k) for k in SKEL['bones']}
    for name in used:
        if name not in SKEL['bones']: continue
        spec=SKEL['bones'][name]
        b=arm.edit_bones.new(name)
        b.head=JOINTS[spec['head']]
        if name.startswith('upperarm01.'): b.tail=JOINTS['lowerarm01.'+name[-1]+'____head']
        elif name.startswith('lowerarm01.'): b.tail=JOINTS['wrist.'+name[-1]+'____head']
        elif name.startswith('upperleg01.'): b.tail=JOINTS['lowerleg01.'+name[-1]+'____head']
        elif name.startswith('lowerleg01.'): b.tail=JOINTS['foot.'+name[-1]+'____head']
        else: b.tail=JOINTS[spec['tail']]
        if (b.tail-b.head).length<.002: b.tail=b.head+Vector((0,0,.02))
        b.align_roll(Vector((0,1,0)))
    for b in arm.edit_bones:
        parent=SKEL['bones'][b.name]['parent']
        while parent and weight_name(parent)==b.name:
            parent=SKEL['bones'][parent]['parent']
        parent=weight_name(parent) if parent else None
        if parent and parent in arm.edit_bones: b.parent=arm.edit_bones[parent]
    # Soft cloth and hair use their own deform bones.
    for name,head,tail,parent in [
        ('hair',(0,.055,1.66),(.015,.085,1.28),'head'),
        ('tabard.L',(.075,.015,.92),(.11,.04,.56),'root'),
        ('tabard.R',(-.075,.015,.92),(-.11,.04,.56),'root')]:
        b=arm.edit_bones.new(name);b.head=head;b.tail=tail;b.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    return rig

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
RIG=make_rig()
WEIGHTS=[{} for _ in range(len(V))]
for name, rows in json.loads((CACHE/'human-weights.json').read_text())['weights'].items():
    mapped=weight_name(name)
    if mapped not in RIG.data.bones: continue
    for index, value in rows:
        WEIGHTS[index][mapped]=WEIGHTS[index].get(mapped,0)+value
for w in WEIGHTS:
    total=sum(w.values())
    if total:
        for key in w: w[key]/=total

M={
    'skin':mat('Karen warm skin','#af805d','skin'),
    'lip':mat('Karen natural lips','#865749','skin'),
    'shirt':mat('Undyed linen shirt','#b9ad90'),
    'leather':mat('Oxblood fitted leather','#512925','leather'),
    'pants':mat('Charcoal riding trousers','#302c2a'),
    'boots':mat('Weathered dark riding leather','#2d211c','leather'),
    'steel':mat('Worked dark steel','#687477','steel',.83),
    'edge':mat('Honed steel edges','#c0c4bf','steel',.9),
    'brass':mat('Aged brass rivets','#9b8054','steel',.78),
    'hair':mat('Dark auburn hair','#322019','hair'),
    'hairlight':mat('Auburn strand sheen','#543527','hair'),
    'eyes':mat('Natural offwhite sclera','#c2beb0','eye'),
    'iris':mat('Amber iris','#6c5538','eye'),
    'pupil':mat('Dark pupil','#141511','eye'),
    'dark':mat('Mouth and seam shadow','#342a23','leather'),
    'thread':mat('Tan linen stitching','#938064'),
}

def bind(obj, weights=None, bone=None):
    if bone:
        g=obj.vertex_groups.new(name=bone);g.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    elif weights:
        for i,w in enumerate(weights):
            for name,value in w.items():
                if value<=.0001: continue
                g=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
                g.add([i],value,'REPLACE')
    arm=obj.modifiers.new('Continuous skin deformation','ARMATURE');arm.object=RIG
    obj.parent=RIG;PIECES.append(obj)

def geom(name, verts, faces, material, weights=None, bone=None, uv=None, sub=0):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    for p in mesh.polygons:p.use_smooth=True
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
    layer=mesh.uv_layers.new(name='UVMap')
    for p in mesh.polygons:
        for n,li in enumerate(p.loop_indices):
            v=mesh.vertices[mesh.loops[li].vertex_index].co
            layer.data[li].uv=uv[p.index][n] if uv else (v.x*3,v.z*3+v.y)
    bind(obj,weights,bone)
    if sub:
        modifier=obj.modifiers.new('Anatomical surface smoothing','SUBSURF');modifier.levels=sub
        # Apply before the armature without losing weights.
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.modifier_move_up(modifier=modifier.name)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj

def surface(name, selector, material, offset=.006, sub=1):
    selected=[f for group,f in FACES if group=='body' and selector(V[[i for i,t in f]].mean(axis=0))]
    indices=sorted({i for f in selected for i,t in f});remap={old:new for new,old in enumerate(indices)}
    verts=[]
    for i in indices:
        p=Vector(V[i]);normal=BODY_NORMALS.get(i,Vector((0,-1,0)))
        p+=normal*offset;verts.append(tuple(p))
    return geom(name,verts,[[remap[i] for i,t in f] for f in selected],material,[WEIGHTS[i] for i in indices],uv=[[UV[t] for i,t in f] for f in selected],sub=sub)

# The base has actual facial, joint and hand topology. Preserve it instead of
# assembling an approximate body from overlapping primitive solids.
bf=[f for group,f in FACES if group=='body']
bi=sorted(GROUPS['body']);remap={old:new for new,old in enumerate(bi)}
BODY=geom('Karen continuous anatomical body',[tuple(V[i]) for i in bi],[[remap[i] for i,t in f] for f in bf],M['skin'],[WEIGHTS[i] for i in bi],uv=[[UV[t] for i,t in f] for f in bf])
BODY_NORMALS={old:BODY.data.vertices[remap[old]].normal.copy() for old in bi}

def sphere(name, pos, scale, material, bone='head', segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=16,location=pos)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=True
    bind(o,bone=bone);return o

def tube(name, points, radii, material, bone='root', sides=10, weights=None):
    verts=[]
    for i,p in enumerate(points):
        p=Vector(p)
        d=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
        a=d.cross(Vector((0,0,1)))
        if a.length<.01:a=d.cross(Vector((1,0,0)))
        a.normalize();b=d.cross(a).normalized()
        for j in range(sides):
            angle=j/sides*math.tau
            verts.append(tuple(p+radii[i]*(a*math.cos(angle)+b*math.sin(angle))))
    faces=[]
    for i in range(len(points)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces+=[tuple(reversed(range(sides))),tuple((len(points)-1)*sides+j for j in range(sides))]
    expanded=[weights[i//sides] for i in range(len(verts))] if weights else None
    return geom(name,verts,faces,material,expanded,bone if not weights else None)

def seam(name, points, material, bone='root', radius=.0015):
    return tube(name,points,[radius]*len(points),material,bone,6)

def loft(name, rings, material, bone='root', sides=40):
    verts=[]
    for z,rx,ry,cx,cy in rings:
        for j in range(sides):
            a=j/sides*math.tau
            verts.append((cx+rx*math.cos(a),cy+ry*math.sin(a),z))
    faces=[]
    for i in range(len(rings)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces+=[tuple(reversed(range(sides))),tuple((len(rings)-1)*sides+j for j in range(sides))]
    return geom(name,verts,faces,material,bone=bone)

def cube(name, pos, scale, material, bone='root', bevel=.003):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Worked edges','BEVEL');mod.width=bevel;mod.segments=3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(material)
    bind(o,bone=bone);return o

# Garments follow the anatomical topology and share its skin weights, so
# shoulders, waist, elbows and knees bend continuously under clothing.
shirt_selector=lambda p: (.965<p[2]<1.43 and abs(p[0])<.19 and p[2]<1.385+abs(p[0])*.25) or (abs(p[0])>.16 and abs(p[0])<.31 and 1.26<p[2]<1.44)
vest_selector=lambda p: .96<p[2]<1.365 and abs(p[0])<.168 and p[2]<1.30+abs(p[0])*.29
surface('Fitted linen shirt and shaped short sleeves',shirt_selector,M['shirt'],.010)
surface('Oxblood tailored brigandine',vest_selector,M['leather'],.020)
surface('Reinforced charcoal riding trousers',lambda p:.325<p[2]<1.01,M['pants'],.011)
surface('Fitted leather forearm bracers',lambda p:abs(p[0])>.385 and 1.075<p[2]<1.16,M['boots'],.009)
surface('Riding boot calves',lambda p:.068<p[2]<.45,M['boots'],.014)

# Hide covered anatomy rather than letting skin poke through layered armor.
exposed=lambda p: p[2]>1.40 or (p[2]>1.36 and abs(p[0])<.10) or (abs(p[0])>.27 and p[2]>1.13 and not shirt_selector(p)) or (abs(p[0])>.445 and p[2]>1.00)
skin=surface('Karen face neck arms and articulated hands',exposed,M['skin'],0,1)
PIECES.remove(BODY);bpy.data.objects.remove(BODY,do_unlink=True);BODY=skin
mouth=Vector(V[list(GROUPS['joint-mouth'])].mean(axis=0))
BODY.data.materials.append(M['lip'])
for p in BODY.data.polygons:
    c=p.center
    if abs(c.x)<.026 and abs(c.z-mouth.z)<.0048 and c.y<mouth.y-.012:p.material_index=1

for side,sgn in [('L',1),('R',-1)]:
    ankle=JOINTS['foot.'+side+'____head'];x=ankle.x
    loft('Sculpted boot toe '+side,[(.014,.056,.128,x,-.076),(.032,.060,.130,x,-.076),(.062,.058,.12,x,-.073),(.085,.052,.095,x,-.055),(.115,.044,.055,x,-.031)],M['boots'],'foot.'+side)
    loft('Stitched boot sole '+side,[(.009,.058,.13,x,-.078),(.026,.060,.13,x,-.078)],M['dark'],'foot.'+side)
    knee=JOINTS['lowerleg01.'+side+'____head']
    xk=knee.x
    # Concave overlapping knee guards with brass fasteners.
    sphere('Worked knee guard '+side,(xk,knee.y-.049,knee.z+.015),(.047,.018,.071),M['steel'],'lowerleg01.'+side)
    for dx in [-.032,.032]:sphere('Knee plate rivet '+side,(xk+dx,knee.y-.064,knee.z+.02),(.0025,.002,.0025),M['brass'],'lowerleg01.'+side,12)
    # A leather cuff covers the join to the calf.
    loft('Folded boot cuff '+side,[(.398,.059,.054,x,-.01),(.405,.064,.058,x,-.01),(.437,.067,.06,x,-.008),(.446,.061,.056,x,-.008)],M['boots'],'lowerleg01.'+side)

# Structured armor details belong to the torso, not a rectangular outer box.
loft('Sword belt',[(.942,.158,.096,0,.005),(.972,.159,.098,0,.005)],M['boots'])
cube('Belt buckle',(0,-.099,.96),(.043,.008,.037),M['brass'])
cube('Buckle opening',(0,-.104,.96),(.026,.004,.021),M['dark'])
for i in range(4):
    cube('Leather keeper '+str(i),(-.12+i*.073,-.095,.96),(.011,.009,.039),M['leather'])

# Curved brigandine front seams and small individually set rivets.
for sign in [-1,1]:
    path=[]
    for z,x,y in [(1.305,.067,-.15),(1.23,.105,-.174),(1.13,.089,-.126),(1.025,.071,-.122),(.979,.082,-.123)]:
        path.append((sign*x,y,z))
    seam('Brigandine shaped panel seam',path,M['thread'],'spine03',.0014)
    for z,x,y in [(1.292,.062,-.151),(1.25,.082,-.170),(1.205,.099,-.156),(1.16,.094,-.143),(1.115,.083,-.128),(1.07,.075,-.124),(1.025,.073,-.124)]:
        sphere('Hand-set armor rivet',(sign*x,y-.004,z),(.0026,.0018,.0026),M['brass'],'spine03',12)

# Short divided coat tails add a distinct silhouette and secondary motion.
for sign,side in [(1,'L'),(-1,'R')]:
    verts=[]
    for row in range(7):
        t=row/6;z=.944-t*.33
        for col in range(6):
            u=col/5
            x=sign*(.026+u*(.116+t*.025))
            y=-.094-.02*t+.013*math.sin(u*math.tau)
            verts.append((x,y,z+.009*math.sin(u*math.pi)))
    faces=[(r*6+c,r*6+c+1,(r+1)*6+c+1,(r+1)*6+c) for r in range(6) for c in range(5)]
    tail=geom('Split leather coat tail '+side,verts,faces,M['leather'],bone='tabard.'+side,sub=1)
    seam('Stitched coat-tail hem '+side,[(sign*.032,-.117,.615),(sign*.1,-.123,.620),(sign*.153,-.11,.611)],M['thread'],'tabard.'+side)

# One worked, overlapping shoulder guard; the other shoulder remains linen.
shoulder=JOINTS['upperarm01.R____head']
for layer in range(3):
    verts=[]
    for row in range(7):
        phi=.18+row/6*1.5
        for col in range(17):
            theta=-math.pi*.93+col/16*math.pi*1.86
            rx=.087-layer*.005;ry=.088-layer*.007;rz=.068
            verts.append((shoulder.x-.007+rx*math.sin(phi)*math.cos(theta),shoulder.y+ry*math.sin(phi)*math.sin(theta),shoulder.z+.037-layer*.035+rz*math.cos(phi)))
    faces=[(r*17+c,r*17+c+1,(r+1)*17+c+1,(r+1)*17+c) for r in range(6) for c in range(16)]
    plate=geom('Overlapping worked shoulder lame '+str(layer),verts,faces,M['steel'],bone='upperarm01.R',sub=1)
    seam('Rolled shoulder edge '+str(layer),[verts[6*17+c] for c in range(17)],M['edge'],'upperarm01.R',.002)
    for col in [2,14]:sphere('Shoulder fastening',verts[5*17+col],(.003,.003,.003),M['brass'],'upperarm01.R',12)

# Leather belt loops secure three actual throwing knives at her free hand.
for i in range(3):
    x=.101+i*.019;y=-.114;z=.977
    tube('Throwing blade leather grip',[(x,y,z),(x,y,z+.054)],[.006,.005],M['boots'],'root',10)
    verts=[(x-.006,y-.002,z),(x+.006,y-.002,z),(x+.008,y-.002,z-.055),(x,y-.002,z-.091),(x-.008,y-.002,z-.055)]
    geom('Belt throwing blade '+str(i),verts,[(0,1,2,3,4)],M['edge'],bone='root')
    cube('Blade loop '+str(i),(x,y+.004,z-.007),(.013,.009,.018),M['leather'])
    sphere('Blade grip cap',(x,y,z+.054),(.006,.006,.003),M['brass'],'root',12)
cube('Worn utility pouch',(-.146,.029,.918),(.056,.061,.083),M['boots'])
cube('Pouch closure',(-.15,-.005,.932),(.044,.012,.024),M['leather'])

# The hair cap uses scalp topology, preserving the natural forehead and ears.
surface('Dark auburn fitted scalp',lambda p:p[2]>1.673 or (p[1]>-.07 and p[2]>1.59) or (abs(p[0])>.065 and p[2]>1.637),M['hair'],.004)
for sign in [-1,1]:
    eye=JOINTS['eye.'+('L' if sign>0 else 'R')+'____head']
    sphere('Eyeball '+str(sign),eye,(.0118,.0118,.0118),M['eyes'])
    sphere('Amber iris '+str(sign),(eye.x,eye.y-.0112,eye.z),(.0046,.001,.0046),M['iris'],segments=24)
    sphere('Round pupil '+str(sign),(eye.x,eye.y-.0120,eye.z),(.0019,.00045,.0021),M['pupil'],segments=20)
    seam('Natural shaped eyebrow '+str(sign),[(eye.x-sign*.015,-.133,eye.z+.018),(eye.x-sign*.003,-.136,eye.z+.021),(eye.x+sign*.010,-.130,eye.z+.019),(eye.x+sign*.020,-.119,eye.z+.015)],M['hair'],'head',.0018)
    sphere('Small brass ear stud',(sign*.073,-.031,1.596),(.0028,.003,.0028),M['brass'],segments=12)
    # Several tapered overlapping locks are hair, not a row of bright wires.
    for j in range(5):
        x=sign*(.009+j*.012)
        pts=[(x,.015,1.747-j*.003),(x*1.07,-.034,1.731-j*.005),(x*1.16,-.085,1.700-j*.007),(sign*(.044+j*.004),-.11+j*.004,1.669-j*.010),(sign*(.069+j*.001),-.047,1.625-j*.005)]
        tube('Swept auburn lock',pts,[.006,.008,.009,.006,.001],M['hair'],'head',8)

for strand in range(3):
    points=[];radii=[]
    for j in range(25):
        t=j/24;a=t*math.tau*4+strand*math.tau/3
        points.append((.012+.015*math.cos(a)*(1-t*.7),.082+.012*math.sin(a)+t*.015,1.655-t*.344))
        radii.append(.008*(1-t*.7))
    tube('Interwoven dark auburn braid '+str(strand),points,radii,M['hair'],'hair',10)
    seam('Subtle braided strand sheen',[(x+.003,y-.004,z) for x,y,z in points],M['hairlight'],'hair',.0008)
tube('Leather braid tie',[(.013,.094,1.332),(.013,.095,1.318)],[.012,.011],M['boots'],'hair',16)

# An arming sword is built around the palm grip axis. Its handle lies inside
# the curled fingers and its crossguard clears the knuckles.
RWRIST=RIG.data.bones['wrist.R']
index=JOINTS['finger2-1.R____head'];pinky=JOINTS['finger5-1.R____head']
GRIP_AXIS=(index-pinky).normalized()
finger_dir=(JOINTS['finger3-1.R____tail']-JOINTS['finger3-1.R____head']).normalized()
PALM_NORMAL=GRIP_AXIS.cross(finger_dir).normalized()
GRIP_CENTER=(index+pinky)*.5+finger_dir*.014+PALM_NORMAL*.006
side_axis=finger_dir.normalized();thick_axis=GRIP_AXIS.cross(side_axis).normalized()
def sword_point(distance,width=0,depth=0):return GRIP_CENTER+GRIP_AXIS*distance+side_axis*width+thick_axis*depth
tube('Sword leather wrapped handle',[tuple(sword_point(-.043)),tuple(sword_point(.043))],[.009,.009],M['boots'],'wrist.R',16)
for j in range(8):
    tube('Diagonal grip winding',[tuple(sword_point(-.039+j*.010)),tuple(sword_point(-.035+j*.010))],[.0095,.0095],M['leather'],'wrist.R',12)
sphere('Faceted sword pommel',sword_point(-.062),(.017,.017,.018),M['steel'],'wrist.R',16)
tube('Sword curved crossguard',[tuple(sword_point(.050,-.076)),tuple(sword_point(.044,-.045)),tuple(sword_point(.040,0)),tuple(sword_point(.044,.045)),tuple(sword_point(.050,.076))],[.004,.006,.007,.006,.004],M['brass'],'wrist.R',12)
verts=[]
for length,width in [(.063,.029),(.18,.030),(.57,.019),(.78,.008),(.83,0)]:
    for w,d in [(-width,0),(0,.0035),(width,0),(0,-.0035)]:verts.append(tuple(sword_point(length,w,d)))
faces=[]
for row in range(4):
    for j in range(4):faces.append((row*4+j,row*4+(j+1)%4,(row+1)*4+(j+1)%4,(row+1)*4+j))
geom('Honed diamond-section arming sword',verts,faces,M['edge'],bone='wrist.R')
tube('Sword recessed central fuller',[tuple(sword_point(.105,0,.0036)),tuple(sword_point(.625,0,.0036))],[.0022,.0012],M['steel'],'wrist.R',6)

# Blink deforms the upper eyelids, keeping the sclera behind the skin.
BODY.shape_key_add(name='Basis')
blink=BODY.shape_key_add(name='Blink')
for side in ['L','R']:
    eye=JOINTS['eye.'+side+'____head']
    for point in blink.data:
        p=point.co
        dx=abs(p.x-eye.x);dz=p.z-eye.z
        if dx<.015 and -.001<dz<.011 and p.y<eye.y-.004:
            amount=(1-dx/.015)*max(0,1-abs(dz-.004)/.009)
            p.z-=.010*amount

# Two-bone inverse kinematics keeps the feet planted and lets the shoulders,
# elbows and wrists move as an anatomical chain.
def world_rotation(name, angles):
    bone=RIG.pose.bones[name]
    rest=RIG.data.bones[name].matrix_local.to_quaternion()
    q=Euler(angles,'XYZ').to_quaternion()
    bone.rotation_mode='QUATERNION';bone.rotation_quaternion=rest.inverted()@q@rest

def aim(name, head, target):
    bone=RIG.pose.bones[name];rest=RIG.data.bones[name]
    q=(rest.tail_local-rest.head_local).normalized().rotation_difference((Vector(target)-Vector(head)).normalized())
    bone.matrix=Matrix.Translation(head)@(q@rest.matrix_local.to_quaternion()).to_matrix().to_4x4()

def limb(upper, lower, target, pole):
    bpy.context.view_layer.update()
    head=RIG.pose.bones[upper].head.copy();target=Vector(target)
    a=RIG.data.bones[upper].length;b=RIG.data.bones[lower].length
    vector=target-head;length=max(.015,min(vector.length,a+b-.0005));axis=vector.normalized()
    along=(a*a-b*b+length*length)/(2*length)
    perpendicular=Vector(pole)-head
    perpendicular-=axis*perpendicular.dot(axis)
    if perpendicular.length<.0001:perpendicular=Vector((0,-1,0))
    perpendicular.normalize()
    joint=head+axis*along+perpendicular*math.sqrt(max(.00001,a*a-along*along))
    target=head+axis*length
    aim(upper,head,joint);bpy.context.view_layer.update();aim(lower,joint,target)
    return target

def wrist_grip(target, axis):
    rest=RIG.data.bones['wrist.R']
    q=GRIP_AXIS.rotation_difference(Vector(axis).normalized())
    RIG.pose.bones['wrist.R'].matrix=Matrix.Translation(target)@(q@rest.matrix_local.to_quaternion()).to_matrix().to_4x4()

def mix(a,b,t):return np.array(a)*(1-t)+np.array(b)*t
def envelope(t,a,b):
    if t<=a or t>=b:return 0
    return math.sin((t-a)/(b-a)*math.pi)

def pose(name,t):
    for bone in RIG.pose.bones:
        bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion();bone.location=(0,0,0);bone.scale=(1,1,1)
    wave=math.sin(t*math.tau)
    drop=-.020;lean=.025;twist=.035
    rhand=np.array((-.242,-.27,1.19));lhand=np.array((.196,-.073,.976))
    blade=np.array((-.055,-.16,.986))
    feet={side:JOINTS['foot.'+side+'____head'].copy() for side in ['L','R']}
    if name in ('Idle','Lobby_Idle','Guard'):
        breath=wave
        drop+=breath*.003
        lean+=breath*.004
        twist+=math.sin(t*math.tau+.3)*.009
        rhand+=np.array((breath*.004,breath*.004,breath*.005))
        lhand+=np.array((math.sin(t*math.tau+.8)*.005,0,breath*.004))
        if name=='Lobby_Idle':
            twist+=math.sin(t*math.tau)*.025
            world_rotation('head',(.018*wave,0,.065*math.sin(t*math.tau)))
        if name=='Guard':
            drop-=.042;lean+=.035
            rhand=np.array((-.15,-.33,1.38));lhand=np.array((.065,-.34,1.32));blade=np.array((.29,-.08,.95))
    elif name in ('Walk','Run','Walk_Back','Strafe_Left','Strafe_Right'):
        running=name=='Run';back=name=='Walk_Back';strafe=name.startswith('Strafe')
        stance=.44 if running else .60
        stride=.51 if running else .31
        lift=.15 if running else .07
        for side,phase in [('L',t%1),('R',(t+.5)%1)]:
            if phase<stance:
                travel=-stride+2*stride*phase/stance;up=0
            else:
                swing=(phase-stance)/(1-stance)
                travel=stride*math.cos(swing*math.pi);up=math.sin(swing*math.pi)*lift
            if strafe:
                feet[side].x+=travel*.6*(1 if name=='Strafe_Left' else -1)
            else:feet[side].y+=travel*(-.65 if back else 1)
            feet[side].z+=up
        drop+=(-.05 if running else -.015)+.013*math.cos(t*math.tau*2)
        lean+=.12 if running else .035
        twist+=wave*.052
        rhand+=np.array((wave*.019,wave*.027,-.075 if running else 0))
        lhand+=np.array((wave*.021,-wave*(.11 if running else .07),abs(wave)*.048))
        blade=np.array((-.12,-.30,.947)) if running else blade
    elif name.startswith('Light_') or name in ('Heavy','Signature','Ultimate'):
        strike=envelope(t,.20,.79);anticipate=envelope(t,0,.40)
        heavy=name in ('Heavy','Ultimate')
        twist+=(-.27*anticipate+.39*strike)*(1 if name!='Light_2' else -1)
        lean+=.10*strike-.04*anticipate
        drop-=.035*strike
        if name=='Signature':
            # Sword stays in the right hand; the free hand retrieves and throws.
            if t<.28:lhand=mix((.196,-.073,.976),(.12,-.151,.99),t/.28)
            elif t<.48:lhand=mix((.12,-.151,.99),(.16,-.04,1.45),(t-.28)/.20)
            elif t<.61:lhand=mix((.16,-.04,1.45),(.10,-.48,1.32),(t-.48)/.13)
            else:lhand=mix((.10,-.48,1.32),(.196,-.073,.976),min(1,(t-.61)/.39))
            rhand+=np.array((0,.03,-.02));blade=np.array((-.14,-.12,.982))
        elif heavy:
            rhand+=np.array((.08*anticipate,-.08*strike,.43*anticipate-.10*strike))
            blade=mix((0,.15,.989),(0,-.94,-.34),strike)
            lhand+=np.array((-.07*strike,-.09*strike,.12*strike))
        else:
            direction=-1 if name=='Light_2' else 1
            rhand+=np.array((direction*(-.11*anticipate+.27*strike),-.13*strike,.18*anticipate+.025*strike))
            blade=mix((-.32*direction,.08,.944),(.76*direction,-.63,.16),strike)
        feet['L'].y-=.075*strike
    elif name.startswith('Dodge_'):
        drive=math.sin(t*math.pi)
        drop-=.16*drive;lean+=.17*drive
        lateral=-1 if name=='Dodge_Right' else 1
        if name in ('Dodge_Left','Dodge_Right'):
            feet['L'].x+=lateral*.12*drive;feet['R'].x+=lateral*.12*drive
            world_rotation('spine03',(0,.09*lateral*drive,0))
        else:
            feet['L'].y-=.12*drive;feet['R'].y+=.10*drive
        rhand+=np.array((0,-.06,-.16*drive));lhand+=np.array((0,-.04,-.12*drive))
    elif name=='Jump':
        crouch=envelope(t,0,.36)+envelope(t,.69,1)
        drop-=.105*crouch;lean+=.085*crouch
        for side in feet:feet[side].z+=.08*envelope(t,.25,.75)
        rhand+=np.array((0,0,.08*envelope(t,.1,.75)))
        lhand+=np.array((0,-.08,.13*envelope(t,.1,.75)))
    elif name=='Hit':
        hit=envelope(t,0,.78);lean-=.17*hit;twist-=.075*hit;drop-=.035*hit
        rhand+=np.array((-.02,.10*hit,-.04*hit));lhand+=np.array((.02,.035*hit,.035*hit))
    elif name in ('Grapple','Grabbed'):
        drive=envelope(t,.05,.9);lean+=.12*drive;drop-=.06*drive
        lhand=mix(lhand,(.10,-.39,1.34),drive)
        rhand=mix(rhand,(-.13,-.34,1.34),drive)
    elif name in ('Fall','Death','GetUp','Thrown'):
        down=min(1,t/.7) if name!='GetUp' else max(0,1-t/.78)
        world_rotation('root',(-1.44*down,0,.06*down))
        RIG.pose.bones['root'].location=RIG.data.bones['root'].matrix_local.to_3x3().inverted()@Vector((0,0,-.83*down))
        world_rotation('spine02',(-.06*down,0,0))
        for side in ['L','R']:
            world_rotation('upperleg01.'+side,(-.24*down,0,0))
            world_rotation('lowerleg01.'+side,(.44*down,0,0))
            world_rotation('upperarm01.'+side,(-.09*down,0,(-1 if side=='L' else 1)*.18*down))
        return
    RIG.pose.bones['root'].location=RIG.data.bones['root'].matrix_local.to_3x3().inverted()@Vector((.005*wave,0,drop))
    for name2,factor in [('spine04',.20),('spine03',.26),('spine02',.25),('spine01',.29)]:
        world_rotation(name2,(lean*factor,0,twist*factor))
    if name!='Lobby_Idle':world_rotation('head',(-lean*.40,0,-twist*.43))
    bpy.context.view_layer.update()
    for side in ['L','R']:
        target=limb('upperleg01.'+side,'lowerleg01.'+side,feet[side],(feet[side].x,-.45,.53))
        rest=RIG.data.bones['foot.'+side]
        RIG.pose.bones['foot.'+side].matrix=Matrix.Translation(target)@rest.matrix_local.to_quaternion().to_matrix().to_4x4()
    rhand[2]+=drop*.62;lhand[2]+=drop*.62
    target=limb('upperarm01.R','lowerarm01.R',rhand,(-.44,-.035,1.22))
    wrist_grip(target,blade)
    ltarget=limb('upperarm01.L','lowerarm01.L',lhand,(.40,-.04,1.22))
    aim('wrist.L',ltarget,ltarget+Vector((.008,-.025,-.045)))
    # Grip closes each anatomical finger around the handle rather than
    # attaching a floating sword to an open palm.
    for side in ['R','L']:
        axis=GRIP_AXIS if side=='R' else Vector((-GRIP_AXIS.x,GRIP_AXIS.y,GRIP_AXIS.z))
        for finger in range(1,6):
            for segment in range(1,4):
                key=f'finger{finger}-{segment}.{side}'
                if key not in RIG.pose.bones:continue
                angle=(.65 if segment==1 else 1.04 if segment==2 else .75) if side=='R' else (.16 if segment==1 else .30)
                if finger==1:angle*=.44
                rest=RIG.data.bones[key].matrix_local.to_quaternion()
                q=Quaternion(axis,-angle)
                RIG.pose.bones[key].rotation_quaternion=rest.inverted()@q@rest
    world_rotation('hair',(.035*wave+.12*abs(lean),.019*math.sin(t*math.tau+.8),.018*wave))
    for side,sign in [('L',1),('R',-1)]:world_rotation('tabard.'+side,(.055*math.sin(t*math.tau+.8)+lean*.3,0,.025*sign*wave))

CLIPS=[('Lobby_Idle',7.2),('Idle',3.6),('Walk',.90),('Run',.64),('Walk_Back',.95),('Strafe_Left',.84),('Strafe_Right',.84),('Guard',2.4),('Light_1',.62),('Light_2',.62),('Light_3',.62),('Heavy',1.15),('Signature',.95),('Ultimate',1.95),('Hit',.48),('Dodge_Forward',.44),('Dodge_Back',.44),('Dodge_Left',.44),('Dodge_Right',.44),('Jump',.82),('Grapple',1.1),('Grabbed',1),('Fall',.72),('Death',1.3),('GetUp',.78),('Thrown',.72)]
bpy.context.scene.render.fps=FPS
for name,duration in CLIPS:
    action=bpy.data.actions.new(name);RIG.animation_data_create();RIG.animation_data.action=action
    samples=max(12,round(duration*12))
    for i in range(samples+1):
        t=i/samples;frame=1+round(t*duration*FPS)
        pose(name,t)
        for bone in RIG.pose.bones:
            bone.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=bone.name)
            if bone.name=='root':bone.keyframe_insert(data_path='location',frame=frame,group=bone.name)
    print('ACTION_READY',name,flush=True)

RIG.animation_data.action=bpy.data.actions['Lobby_Idle'];bpy.context.scene.frame_set(1)
bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=217
# Export first to a new path. The live game switches only after visual review.
blend_path=SOURCE/'karen-human-v3.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
bpy.ops.object.select_all(action='DESELECT')
for obj in PIECES:obj.select_set(True)
RIG.select_set(True)
props=set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
options=dict(filepath=str(OUT/'karen-human-v3.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_nla_strips=False,export_anim_slide_to_zero=True,export_materials='EXPORT',export_yup=True,export_def_bones=False,export_animation_pointer=False)
bpy.ops.export_scene.gltf(**{k:v for k,v in options.items() if k in props})
print('KAREN_HUMAN_MODEL_EXPORTED',flush=True)

if '--preview' in sys.argv:
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
    scene.render.resolution_x=700;scene.render.resolution_y=880;scene.render.resolution_percentage=100
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.011,.014,.018,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
    scene.view_settings.view_transform='AgX'
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.006))
    floor=bpy.context.object;floor.data.materials.append(mat('Portrait slate','#171e21','steel'))
    target=Vector((0,-.025,.98))
    bpy.ops.object.camera_add(location=(.36,-3.35,1.44));camera=bpy.context.object
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=2.10;scene.camera=camera
    for position,energy,color,size in [((-.8,-1.8,2.9),190,(1,.82,.66),1.6),((1.4,-1.0,1.8),125,(.68,.80,1),1.8),((.1,.8,2.4),280,(.76,.86,1),1.2)]:
        bpy.ops.object.light_add(type='AREA',location=position);light=bpy.context.object
        light.data.energy=energy;light.data.color=color;light.data.shape='DISK';light.data.size=size
        light.rotation_euler=(Vector((0,0,1.2))-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/'karen-human-v3.png');scene.render.image_settings.file_format='PNG'
    bpy.ops.render.render(write_still=True)
    print('KAREN_PORTRAIT_READY',flush=True)


