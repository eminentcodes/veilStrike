"""Original Veilstrike character meshes, tailored rigs, and combat actions.

Run with Blender: blender -b --python scripts/build-characters.py -- [--only karen] [--portraits]
Source .blend files are kept in .cache/character-source. Runtime GLBs include
skin weights, embedded fabric/skin textures, and named animation actions.
"""
import bpy
import math
import json
import sys
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/web/public/models/characters'
SOURCE = ROOT / '.cache/character-source'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
PORTRAITS = '--portraits' in sys.argv
ONLY = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None

CAST = {
 'karen': dict(h=1.74, shoulder=.143, waist=.091, hip=.128, female=True, skin='#aa7651', hair='#241b16', style='braid', cloth='#e4d7b5', outer='#702e2e', pants='#463630', eye='#5b7543'),
 'taren': dict(h=1.91, shoulder=.175, waist=.132, hip=.139, female=False, skin='#bc9575', hair='#73716b', style='short', beard=True, cloth='#263c51', outer='#677077', pants='#26323c', eye='#667d85'),
 'nomet': dict(h=1.89, shoulder=.191, waist=.128, hip=.143, female=False, skin='#868c7e', hair='#292d27', style='bald', cloth='#6b6353', outer='#443e35', pants='#514936', eye='#bbd893'),
 'veyra': dict(h=1.79, shoulder=.149, waist=.092, hip=.126, female=True, skin='#9c6948', hair='#713820', style='ponytail', cloth='#7b7254', outer='#344e3b', pants='#343930', eye='#bda158'),
 'mawren': dict(h=1.86, shoulder=.150, waist=.123, hip=.130, female=False, skin='#9a816c', hair='#bdb8a8', style='short', beard=True, cloth='#343149', outer='#514334', pants='#332b37', eye='#a4bccc'),
 'neris': dict(h=1.68, shoulder=.137, waist=.087, hip=.116, female=True, skin='#c4a68e', hair='#cbcfd0', style='crop', cloth='#293339', outer='#18272f', pants='#29323c', eye='#769098'),
 'vesper': dict(h=1.83, shoulder=.152, waist=.116, hip=.127, female=False, skin='#b0927f', hair='#191d20', style='slick', cloth='#542833', outer='#d1c8b4', pants='#28262c', eye='#607c7b'),
 'rhoven': dict(h=1.85, shoulder=.143, waist=.094, hip=.120, female=False, skin='#826f5e', hair='#393329', style='ragged', cloth='#3e514e', outer='#51463c', pants='#343731', eye='#96d2d0'),
 'seyra': dict(h=1.84, shoulder=.137, waist=.083, hip=.124, female=True, skin='#b4d6d3', hair='#d5e0df', style='long', cloth='#60747a', outer='#293e4b', pants='#435863', eye='#d9fffa'),
 'varkesh': dict(h=2.49, shoulder=.265, waist=.183, hip=.175, female=False, skin='#383833', hair='#222521', style='bald', cloth='#3c2b24', outer='#272824', pants='#302822', eye='#ffd184'),
}

def rgba(hex_color):
    s=hex_color.lstrip('#')
    rgb=[int(s[i:i+2],16)/255 for i in (0,2,4)]
    return tuple((c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4) for c in rgb)+(1,)

def material(name, color, kind='cloth', metal=0, glow=0, alpha=1):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=rgba(color)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value={'skin':.58,'cloth':.92,'leather':.69,'hair':.42,'glass':.19,'metal':.31,'bone':.73}.get(kind,.6)
    if kind=='skin': p.inputs['Subsurface Weight'].default_value=.065
    if alpha<1:
        p.inputs['Alpha'].default_value=alpha
        m.diffuse_color=rgba(color)[:3]+(alpha,)
        m.surface_render_method='DITHERED'
    if kind=='glass': p.inputs['Transmission Weight'].default_value=.20
    if glow:
        p.inputs['Emission Color'].default_value=rgba(color)
        p.inputs['Emission Strength'].default_value=glow
    if kind in ('skin','cloth','leather','bone'):
        size=256
        seed=sum((i+1)*ord(c) for i,c in enumerate(name))
        rng=np.random.default_rng(seed)
        yy,xx=np.mgrid[:size,:size]
        grain=rng.normal(0,.014,(size,size))
        weave=(np.sin(xx*math.pi/2)*np.sin(yy*math.pi/2)*.055 if kind=='cloth' else 0)
        wash=(np.sin(xx*.055+yy*.014)+np.sin(yy*.071))*.018
        factor=np.clip(1+grain+weave+wash,.78,1.13)
        pixels=np.ones((size,size,4),dtype=np.float32)
        base=np.array(rgba(color)[:3])
        pixels[:,:,:3]=np.clip(base[None,None,:]*factor[:,:,None],0,1)
        image=bpy.data.images.new(name+' surface',width=size,height=size)
        image.pixels.foreach_set(pixels.ravel())
        image.pack()
        node=m.node_tree.nodes.new('ShaderNodeTexImage'); node.image=image
        m.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
    return m

def geometry(name, vertices, faces, mat, bone='hips', weights=None):
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces); data.update()
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for poly in data.polygons: poly.use_smooth=True
    uv=data.uv_layers.new(name='UVMap')
    for poly in data.polygons:
        for index,li in enumerate(poly.loop_indices):
            vi=data.loops[li].vertex_index
            uv.data[li].uv=(index%2,(vi//24)/max(1,len(vertices)/24))
    bind(obj,bone,weights)
    return obj

def bind(obj,bone='hips',weights=None):
    if weights:
        for i,values in enumerate(weights):
            for name,weight in values.items():
                group=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
                group.add([i],weight,'REPLACE')
    else:
        group=obj.vertex_groups.new(name=bone); group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('Anatomical rig','ARMATURE'); mod.object=RIG
    obj.parent=RIG
    PIECES.append(obj)

def ellipsoid(name, pos, scale, mat, bone='head', segments=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=12,location=pos)
    obj=bpy.context.object; obj.name=name; obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons: poly.use_smooth=True
    bind(obj,bone)
    return obj

def loft(name, rings, mat, bone='hips', sides=28, weighted=False):
    vertices=[]; weights=[]
    for z,rx,ry,cy in rings:
        for j in range(sides):
            a=j/sides*math.tau
            vertices.append((rx*math.cos(a),cy+ry*math.sin(a),z))
            if weighted:
                chest=max(0,min(1,(z/H-.54)/.16)); weights.append({'hips':1-chest,'chest':chest})
    faces=[]
    for i in range(len(rings)-1):
        for j in range(sides): faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces.extend([tuple(reversed(range(sides))),tuple((len(rings)-1)*sides+j for j in range(sides))])
    return geometry(name,vertices,faces,mat,bone,weights if weighted else None)

def tube(name, points, radii, mat, bone='head', sides=10, bone_chain=None):
    vertices=[]; weights=[]
    for i,p in enumerate(points):
        p=Vector(p)
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        tangent.normalize()
        axis=tangent.cross(Vector((0,0,1)))
        if axis.length<.01: axis=tangent.cross(Vector((1,0,0)))
        axis.normalize(); other=tangent.cross(axis).normalized()
        for j in range(sides):
            a=j/sides*math.tau
            v=p+radii[i]*(axis*math.cos(a)+other*math.sin(a)); vertices.append(tuple(v))
            if bone_chain:
                t=i/(len(points)-1)
                mix=max(0,min(1,(t-.36)/.30)); weights.append({bone_chain[0]:1-mix,bone_chain[1]:mix})
    faces=[]
    for i in range(len(points)-1):
        for j in range(sides): faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+j for j in range(sides))])
    return geometry(name,vertices,faces,mat,bone,weights if bone_chain else None)

def line(name, points, radius, mat, bone='head', sides=8):
    return tube(name,points,[radius]*len(points),mat,bone,sides)

def box(name,pos,scale,mat,bone='hips', bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Worked edges','BEVEL'); mod.width=bevel; mod.segments=2
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    bind(o,bone); return o

def ring(name,pos,radius,thickness,mat,bone='hips',rotation=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=6,location=pos,major_radius=radius,minor_radius=thickness,rotation=rotation)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    bind(o,bone);return o

def make_rig(c):
    arm=bpy.data.armatures.new('Veilstrike anatomical skeleton')
    rig=bpy.data.objects.new('VeilstrikeRig',arm); bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    def bone(name,head,tail,parent=None):
        b=arm.edit_bones.new(name); b.head=head;b.tail=tail
        if parent:b.parent=arm.edit_bones[parent]
        return b
    bone('root',(0,0,0),(0,0,.1*H))
    bone('hips',(0,0,.50*H),(0,0,.57*H),'root')
    bone('spine',(0,0,.57*H),(0,0,.67*H),'hips')
    bone('chest',(0,0,.67*H),(0,0,.79*H),'spine')
    bone('neck',(0,0,.79*H),(0,0,.87*H),'chest')
    bone('head',(0,0,.87*H),(0,0,.99*H),'neck')
    bone('hair',(0,.07*H,.94*H),(0,.10*H,.66*H),'head')
    for side,sgn in [('l',1),('r',-1)]:
        sx=sgn*c['shoulder']*H
        bone('upperarm.'+side,(sx,0,.78*H),(sx+sgn*.035*H,-.004*H,.63*H),'chest')
        bone('lowerarm.'+side,(sx+sgn*.035*H,-.004*H,.63*H),(sx+sgn*.06*H,-.012*H,.49*H),'upperarm.'+side)
        bone('wrist.'+side,(sx+sgn*.06*H,-.012*H,.49*H),(sx+sgn*.063*H,-.018*H,.43*H),'lowerarm.'+side)
        hx=sgn*c['hip']*.58*H
        bone('upperleg.'+side,(hx,0,.51*H),(hx,-.014*H,.29*H),'hips')
        bone('lowerleg.'+side,(hx,-.014*H,.29*H),(hx,.008*H,.075*H),'upperleg.'+side)
        bone('foot.'+side,(hx,.008*H,.075*H),(hx,-.09*H,.035*H),'lowerleg.'+side)
        bone('cape.'+side,(sgn*.045*H,.07*H,.53*H),(sgn*.07*H,.10*H,.20*H),'hips')
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    return rig

def face(c):
    female=c['female']; demon=ID=='varkesh'
    jaw=.045 if female else .057
    if ID=='rhoven':jaw=.043
    if demon:jaw=.094
    rx=.065 if female else .069
    if demon:rx=.095
    rings=[(.857*H,jaw*H,.043*H,-.01*H),(.878*H,(jaw+.014)*H,.053*H,-.012*H),(.910*H,rx*H,.063*H,0),(.947*H,(rx+.003)*H,.064*H,.005*H),(.980*H,rx*.83*H,.055*H,.008*H),(1.00*H,.029*H,.025*H,.004*H)]
    loft('Sculpted face and jaw',rings,M['skin'],'head',32)
    ellipsoid('Back of skull',(0,.027*H,.931*H),(.064*H,.057*H,.067*H),M['skin'])
    for s in [-1,1]:
        eye_x=s*(.029 if female else .030)*H
        eye_y=-.061*H;eye_z=.934*H
        ellipsoid('Eye white',(eye_x,eye_y,eye_z),(.016*H,.008*H,.009*H),M['sclera'],segments=20)
        ellipsoid('Iris',(eye_x,-.0683*H,eye_z),(.0060*H,.0017*H,.0067*H),M['iris'],segments=18)
        ellipsoid('Pupil',(eye_x,-.0698*H,eye_z),(.0026*H,.0010*H,.0040*H),M['pupil'],segments=12)
        ellipsoid('Eye catchlight',(eye_x-.0018*H,-.0706*H,eye_z+.0023*H),(.0011*H,.0006*H,.0011*H),M['sclera'],segments=8)
        for upper in [True,False]:
            points=[]
            for j in range(9):
                a=j/8*math.pi
                points.append((eye_x+math.cos(a)*.0163*H,-.0670*H,eye_z+(1 if upper else -1)*math.sin(a)*.0093*H))
            line('Anatomical eyelid',points,.0018*H,M['skin'])
        brow_z=.950*H
        line('Eyebrow',[(eye_x-s*.018*H,-.060*H,brow_z-.001*H),(eye_x,-.064*H,brow_z+.003*H),(eye_x+s*.015*H,-.058*H,brow_z+.001*H)],(.0023 if female else .0034)*H,M['hair'])
        ellipsoid('Ear',(s*(rx+.006)*H,.008*H,.925*H),(.012*H,.011*H,.023*H),M['skin'])
        ellipsoid('Ear concha',(s*(rx+.010)*H,-.001*H,.925*H),(.007*H,.005*H,.014*H),M['lip'])
    nose_w=(.010 if female else .013)*H
    verts=[(-nose_w,-.059*H,.936*H),(nose_w,-.059*H,.936*H),(-nose_w*.65,-.078*H,.907*H),(nose_w*.65,-.078*H,.907*H),(0,-.087*H,.911*H),(-nose_w,-.070*H,.902*H),(nose_w,-.070*H,.902*H)]
    geometry('Nose bridge and tip',verts,[(0,1,4),(0,4,2),(1,3,4),(2,4,3),(2,3,6,5),(0,2,5),(1,6,3)],M['skin'],'head')
    for s in [-1,1]:ellipsoid('Nostril',(s*.006*H,-.078*H,.905*H),(.0037*H,.002*H,.0018*H),M['shadow'],segments=12)
    mouth_y=-.062*H; mouth_z=.890*H
    line('Upper lip',[(-.022*H,mouth_y,mouth_z),(-.008*H,mouth_y-.004*H,mouth_z+.002*H),(0,mouth_y-.004*H,mouth_z+.001*H),(.008*H,mouth_y-.004*H,mouth_z+.002*H),(.022*H,mouth_y,mouth_z)],.0021*H,M['lip'])
    line('Lower lip',[(-.020*H,mouth_y,mouth_z-.002*H),(0,mouth_y-.004*H,mouth_z-.005*H),(.020*H,mouth_y,mouth_z-.002*H)],.0025*H,M['lip'])
    line('Mouth expression',[(-.020*H,mouth_y-.001*H,mouth_z-.001*H),(0,mouth_y-.0055*H,mouth_z-.0015*H),(.020*H,mouth_y-.001*H,mouth_z-.001*H)],.0007*H,M['shadow'])
    if ID in ['taren','nomet','rhoven']:
        line('Facial scar',[(.038*H,-.057*H,.966*H),(.045*H,-.057*H,.938*H),(.039*H,-.052*H,.917*H)],.0015*H,M['scar'])
    if ID in ['taren','vesper','mawren']:
        for i in range(2):line('Forehead crease',[(-.027*H,-.055*H,(.969+i*.006)*H),(0,-.06*H,(.969+i*.006)*H),(.027*H,-.055*H,(.969+i*.006)*H)],.00065*H,M['lip'])
    if demon:
        for s in [-1,1]:
            tube('Volcanic brow',[(s*.012*H,-.064*H,.955*H),(s*.052*H,-.062*H,.966*H),(s*.088*H,-.041*H,.96*H)],[.011*H,.013*H,.006*H],M['basalt'])
            tube('Lower fang',[(s*.038*H,-.059*H,.868*H),(s*.032*H,-.080*H,.90*H),(s*.028*H,-.08*H,.911*H)],[.009*H,.005*H,.0005*H],M['bone'])
            points=[(s*.065*H,.016*H,.973*H),(s*.087*H,.034*H,1.022*H),(s*.093*H,.01*H,1.088*H),(s*.072*H,-.011*H,1.136*H)]
            if s==1:points=points[:3];radii=[.022*H,.018*H,.011*H]
            else:radii=[.022*H,.020*H,.013*H,.0004*H]
            tube('Broken horn' if s==1 else 'Curved furnace horn',points,radii,M['bone'],sides=14)

def hair(c):
    if c['style']=='bald':return
    # The front hairline sits above the brows, leaving the face readable.
    vertices=[];faces=[]; sides=28;rows=10
    for i in range(rows):
        for j in range(sides):
            az=j/sides*math.tau
            front=math.sin(az)<0
            maximum=1.14 if front else 1.84
            theta=(i+.04)/rows*maximum
            vertices.append((.073*H*math.sin(theta)*math.cos(az),.009*H+.066*H*math.sin(theta)*math.sin(az),.934*H+.077*H*math.cos(theta)))
    for i in range(rows-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    geometry('Shaped hair cap',vertices,faces,M['hair'],'head')
    for i in range(12):
        x=(i/11-.5)*.119*H
        line('Combed hair strand',[(x,-.049*H,.974*H),(x*.90,-.026*H,1.004*H),(x*.8,.035*H,1.003*H),(x*.75,.071*H,.968*H)],.0017*H,M['hairlight'])
    if c['style'] in ['braid','ponytail']:
        for strand in range(3):
            points=[]
            for i in range(18):
                t=i/17;a=t*math.tau*3+strand*math.tau/3
                points.append((.015*H+math.cos(a)*.010*H,.080*H+math.sin(a)*.008*H+t*.035*H,(.957-.34*t)*H))
            tube('Braided hair' if c['style']=='braid' else 'Huntress ponytail',points,[.010*H*(1-i/22) for i in range(18)],M['hair'],'hair',8)
        ring('Hair tie',(.015*H,.085*H,.929*H),.019*H,.003*H,M['leather'],'hair',(math.pi/2,0,0))
    if c['style'] in ['long','ragged']:
        for side in [-1,1]:
            for i in range(5):
                x=side*(.058+i*.005)*H
                points=[(x,.024*H,.969*H),(x*1.15,.058*H,.88*H),(x*1.10,.08*H,.73*H),(x*.94,.10*H,(.58+i*.01)*H)]
                tube('Flowing silver lock' if ID=='seyra' else 'Uneven hair lock',points,[.010*H,.011*H,.010*H,.001*H],M['hair'],'hair',8)
    if c['style']=='crop':
        for i in range(7):
            tube('Asymmetrical silver fringe',[(.060*H-i*.014*H,-.030*H,.994*H),(.038*H-i*.012*H,-.052*H,.975*H),(.014*H-i*.013*H,-.059*H,.954*H)],[.010*H,.009*H,.001*H],M['hair'])
    if c.get('beard'):
        long=ID=='mawren'
        for i in range(11):
            x=(i/10-.5)*.08*H
            points=[(x,-.056*H,.888*H),(x*.8,-.060*H,.861*H),(x*.42,-.050*H,(.732 if long else .850)*H)]
            tube('Braided sorcerer beard' if long else 'Weathered beard',points,[.008*H,.008*H,.002*H],M['hair'],sides=8)

def anatomy(c):
    shoulder=c['shoulder'];waist=c['waist'];hip=c['hip']
    loft('Organic torso',[(.47*H,hip*H,.075*H,0),(.53*H,hip*.96*H,.073*H,0),(.59*H,waist*H,.065*H,0),(.67*H,shoulder*.86*H,.092*H,-.004*H),(.73*H,shoulder*.98*H,.089*H,0),(.79*H,shoulder*.78*H,.063*H,0),(.815*H,.047*H,.044*H,0)],M['skin'],weighted=True)
    loft('Anatomical neck',[(.79*H,.042*H,.04*H,0),(.85*H,.031*H,.033*H,0),(.875*H,.039*H,.037*H,0)],M['skin'],'neck',20)
    for side,sgn in [('l',1),('r',-1)]:
        sx=sgn*shoulder*H
        points=[(sx,0,.785*H),(sx+sgn*.018*H,0,.72*H),(sx+sgn*.035*H,-.004*H,.63*H),(sx+sgn*.049*H,-.008*H,.56*H),(sx+sgn*.06*H,-.012*H,.49*H)]
        bulk=1.55 if ID=='varkesh' else 1.25 if ID=='nomet' else .88 if c['female'] else 1
        radii=[.039*H*bulk,.036*H*bulk,.027*H*bulk,.028*H*bulk,.018*H*bulk]
        tube('Smooth weighted arm '+side,points,radii,M['skin'],sides=18,bone_chain=('upperarm.'+side,'lowerarm.'+side))
        hx=sgn*hip*.58*H
        legpoints=[(hx,0,.51*H),(hx,0,.43*H),(hx,-.014*H,.29*H),(hx,.001*H,.20*H),(hx,.008*H,.075*H)]
        legmat=M['skin'] if ID=='varkesh' else M['pants']
        tube('Weighted leg '+side,legpoints,[.067*H,.056*H,.036*H,.039*H,.025*H],legmat,sides=18,bone_chain=('upperleg.'+side,'lowerleg.'+side))
        footmat=M['skin'] if ID=='varkesh' else M['leather']
        ellipsoid('Anatomical foot' if ID=='varkesh' else 'Worn riding boot',(hx,-.038*H,.041*H),(.045*H,-.083*H if False else .079*H,.041*H),footmat,'foot.'+side)
        if ID!='varkesh':
            tube('Boot shaft '+side,[(hx,.008*H,.07*H),(hx,0,.16*H),(hx,-.008*H,.23*H)],[.029*H,.04*H,.04*H],M['leather'],'lowerleg.'+side,14)
            box('Boot sole',(hx,-.038*H,.015*H),(.090*H,.163*H,.016*H),M['dark'],'foot.'+side,.005*H)
            ring('Boot strap',(hx,-.004*H,.166*H),.041*H,.003*H,M['trim'],'lowerleg.'+side)
        hand_x=sx+sgn*.063*H
        glove=ID in ['taren','neris','vesper','veyra']
        handmat=M['leather'] if glove else M['skin']
        ellipsoid('Palm '+side,(hand_x,-.016*H,.455*H),(.025*H*bulk,.018*H*bulk,.038*H),handmat,'wrist.'+side,18)
        for finger in range(4):
            fx=hand_x+(finger-1.5)*.012*H*bulk
            length=[.039,.046,.044,.035][finger]*H
            points=[(fx,-.013*H,.447*H),(fx,-.021*H,.433*H),(fx,-.029*H,.447*H-length),(fx,-.035*H,.455*H-length)]
            tube('Individual finger '+side+str(finger),points,[.0061*H*bulk,.0064*H*bulk,.0056*H*bulk,.0047*H*bulk],handmat,'wrist.'+side,8)
            if ID=='varkesh':tube('Demon finger claw',[(fx,-.035*H,.455*H-length),(fx,-.047*H,.454*H-length),(fx,-.051*H,.465*H-length)],[.005*H,.003*H,.0004*H],M['bone'],'wrist.'+side)
        tube('Opposable thumb '+side,[(hand_x-sgn*.024*H,-.012*H,.469*H),(hand_x-sgn*.034*H,-.028*H,.452*H),(hand_x-sgn*.022*H,-.039*H,.444*H)],[.008*H*bulk,.007*H*bulk,.005*H*bulk],handmat,'wrist.'+side)
        if ID=='varkesh':
            for i in range(3):tube('Volcanic foot claw',[(hx+(i-1)*.027*H,-.088*H,.035*H),(hx+(i-1)*.027*H,-.132*H,.016*H)],[.012*H,.0008*H],M['bone'],'foot.'+side)

def clothes(c):
    shoulder=c['shoulder'];waist=c['waist'];hip=c['hip']
    if ID not in ['nomet','varkesh']:
        bodyrings=[(.50*H,(hip+.008)*H,.080*H,0),(.59*H,(waist+.010)*H,.071*H,0),(.67*H,(shoulder*.86+.01)*H,.098*H,-.003*H),(.735*H,(shoulder*.98+.009)*H,.094*H,0),(.793*H,(shoulder*.77+.008)*H,.069*H,0)]
        loft('Fitted textile layers',bodyrings,M['cloth'],weighted=True)
        for s,side in [(1,'l'),(-1,'r')]:
            sx=s*shoulder*H
            if ID=='neris' and side=='l':continue
            tube('Layered sleeve '+side,[(sx,0,.78*H),(sx+s*.018*H,0,.71*H),(sx+s*.030*H,-.002*H,.655*H)],[.043*H,.041*H,.033*H],M['outer'] if ID in ['vesper','neris'] else M['cloth'],'upperarm.'+side,16)
    if ID in ['karen','veyra','neris','rhoven','taren']:
        loft('Identity-specific cuirass',[(.548*H,(waist+.016)*H,.08*H,0),(.605*H,(waist+.015)*H,.078*H,0),(.684*H,(shoulder*.88+.014)*H,.105*H,-.002*H),(.749*H,(shoulder*.9+.014)*H,.099*H,0)],M['outer'],weighted=True)
        for s in [-1,1]:
            line('Hand stitched bodice seam',[(s*.035*H,-.082*H,.556*H),(s*.054*H,-.082*H,.618*H),(s*.084*H,-.095*H,.702*H)],.0013*H,M['trim'],'chest')
        for i in range(5):box('Cuirass fastening',(0,-.106*H,(.620+i*.024)*H),(.008*H,.010*H,.005*H),M['trim'],'chest',.001*H)
    # A belt, actual buckle, stitches, and individual equipment pouches.
    loft('Leather belt',[(.53*H,(hip+.013)*H,.085*H,0),(.551*H,(hip+.011)*H,.083*H,0)],M['leather'],'hips',28)
    box('Forged belt buckle',(0,-.087*H,.541*H),(.038*H,.011*H,.027*H),M['trim'],'hips',.003*H)
    box('Buckle inset',(0,-.095*H,.541*H),(.025*H,.004*H,.015*H),M['dark'],'hips',.001*H)
    for s in [-1,1]:
        box('Equipment pouch',(s*.110*H,-.064*H,.512*H),(.045*H,.027*H,.044*H),M['leather'],'hips',.008*H)
        box('Pouch flap',(s*.110*H,-.081*H,.529*H),(.047*H,.008*H,.017*H),M['outer'],'hips',.002*H)
    if ID in ['mawren','vesper','seyra','neris','rhoven','veyra']:
        length=.12 if ID in ['mawren','seyra'] else .30 if ID=='vesper' else .38
        for s,side in [(1,'l'),(-1,'r')]:
            vertices=[];faces=[];rows=10;cols=11
            for r in range(rows):
                t=r/(rows-1);z=(.55*(1-t)+length*t)*H
                for j in range(cols):
                    a=(j/(cols-1)*math.pi)+(.05 if s==1 else math.pi+.05)
                    rx=(hip+.012+t*.055)*H;ry=(.089+t*.037)*H
                    vertices.append((rx*math.cos(a),ry*math.sin(a)+t*.023*H*math.sin(j*1.7),z+t*.008*H*math.sin(j*1.4)))
            for r in range(rows-1):
                for j in range(cols-1):faces.append((r*cols+j,r*cols+j+1,(r+1)*cols+j+1,(r+1)*cols+j))
            geometry('Split mourning dress' if ID=='seyra' else 'Layered coat tail',vertices,faces,M['outer'],'cape.'+side)
    if ID in ['karen','taren']:
        sx=c['shoulder']*H
        ellipsoid('Worked shoulder pauldron',(sx,0,.776*H),(.052*H,.054*H,.027*H),M['steel'],'upperarm.l')
        for i in range(4):ellipsoid('Shoulder rivet',(sx+(.01+i*.008)*H,-.036*H,.78*H),(.0024*H,.0024*H,.0024*H),M['trim'],'upperarm.l',8)
    if ID=='taren':
        loft('Dented steel breastplate',[(.606*H,.145*H,.089*H,0),(.699*H,.164*H,.112*H,0),(.751*H,.151*H,.107*H,0)],M['steel'],'chest',24)
        for s in [-1,1]:
            line('Breastplate rolled edge',[(s*.13*H,-.059*H,.610*H),(s*.163*H,-.039*H,.706*H),(s*.14*H,-.070*H,.751*H)],.004*H,M['trim'],'chest')
        for i in range(7):line('Quilted fabric stitch',[(-.125*H,-.041*H,(.568+i*.012)*H),(0,-.084*H,(.568+i*.012)*H),(.125*H,-.041*H,(.568+i*.012)*H)],.0015*H,M['clothlight'],'hips')
    if ID=='nomet':
        for s in [-1,1]:
            ellipsoid('Brawler pectoral',(s*.077*H,-.074*H,.708*H),(.077*H,.037*H,.046*H),M['skin'],'chest')
            for i in range(3):ellipsoid('Abdominal muscle',(s*.037*H,-.067*H,(.593+i*.030)*H),(.032*H,.020*H,.018*H),M['skin'],'spine')
        for i in range(4):line('Pit fighting scar',[(-.10*H,-.07*H,(.65+i*.018)*H),(-.014*H,-.091*H,(.66+i*.018)*H),(.047*H,-.086*H,(.66+i*.018)*H)],.0019*H,M['scar'],'chest')
        sx=c['shoulder']*H
        for i in [-1,1]:tube('Exposed radius and ulna',[(sx+.037*H+i*.008*H,-.030*H,.615*H),(sx+.052*H+i*.009*H,-.033*H,.535*H)],[.007*H,.005*H],M['bone'],'lowerarm.l')
    if ID in ['nomet','varkesh']:
        for s,side in [(1,'l'),(-1,'r')]:
            x=s*(c['shoulder']+.054)*H
            ring('Iron wrist shackle',(x,-.011*H,.521*H),(.031 if ID=='nomet' else .045)*H,.007*H,M['steel'],'lowerarm.'+side)
        box('Pit belt or furnace girdle',(0,-.080*H,.494*H),(.185*H,.017*H,.062*H),M['leather'],'hips',.01*H)
    if ID=='veyra':
        sx=-(c['shoulder']+.045)*H
        for i in range(16):ring('Articulated forearm chain',(sx+.022*H*math.cos(i*.9),.022*H*math.sin(i*.9),(.546+i*.004)*H),.009*H,.0018*H,M['steel'],'lowerarm.r',(math.pi/2,(i%2)*math.pi/2,0))
    if ID=='vesper':
        for s in [-1,1]:
            for i in range(4):ellipsoid('Physician coat button',(s*.047*H,-.101*H,(.60+i*.032)*H),(.004*H,.002*H,.004*H),M['trim'],'chest',10)
        for i in range(4):
            x=(-.074+i*.026)*H
            tube('Individual glass medicine vessel',[(x,-.085*H,.493*H),(x,-.085*H,.536*H)],[.009*H,.007*H],M['vial'],'hips',12)
            box('Medicine cork',(x,-.085*H,.539*H),(.013*H,.014*H,.006*H),M['leather'],'hips',.001*H)
    if ID=='mawren':
        box('Bound spell book',(.126*H,-.057*H,.516*H),(.078*H,.038*H,.10*H),M['leather'],'hips',.006*H)
        for z in [.48,.54]:line('Book binding clasp',[(.088*H,-.079*H,z*H),(.164*H,-.079*H,z*H)],.004*H,M['trim'],'hips')
    if ID in ['rhoven','seyra','varkesh']:
        # Fractures are authored geometry rather than a colored whole-body glow.
        for s in [-1,1]:
            for i in range(4):
                x=s*(.027+i*.029)*H;z=(.59+i*.035)*H
                line('Luminous body fracture',[(x,-.09*H,z),(x+s*.018*H,-.09*H,z+.017*H),(x+s*.010*H,-.101*H,z+.043*H)],(.0028 if ID=='varkesh' else .0014)*H,M['glow'],'chest')

def blade(name,x,y,z,length,mat,bone='wrist.r',width=.023):
    verts=[(x-width*H,y,z),(x+width*H,y,z),(x+width*.65*H,y,z-length*.75),(x,y,z-length),(x-width*.65*H,y,z-length*.75),(x,y-.007*H,z),(x,y-.005*H,z-length*.76)]
    geometry(name,verts,[(0,5,1),(1,5,6,2),(2,6,3),(3,6,4),(4,6,5,0),(0,1,2,3,4)],mat,bone)
    line(name+' grip',[(x,y,z),(x,y,z+.067*H)],.009*H,M['leather'],bone)
    box(name+' crossguard',(x,y,z+.004*H),(.075*H,.019*H,.010*H),M['trim'],bone,.002*H)
    ellipsoid(name+' pommel',(x,y,z+.074*H),(.013*H,.012*H,.013*H),M['trim'],bone,12)

def weapons(c):
    x=-(c['shoulder']+.063)*H;y=-.031*H;z=.442*H
    if ID=='karen':
        blade('Arming sword',x,y,z,.365*H,M['steel'])
        for i in range(3):blade('Belt throwing knife',(0.060+i*.026)*H,-.084*H,.53*H,.070*H,M['steel'],'hips',.007)
    elif ID=='taren':
        line('Ash wood spear shaft',[(x,y,.16*H),(x,y,1.006*H)],.011*H,M['wood'],'wrist.r',12)
        blade('Short spear point',x,y,1.012*H,-.115*H,M['steel'],'wrist.r',.023)
        sx=(c['shoulder']+.063)*H
        width=.153*H;top=.80*H;bottom=.322*H;sy=-.065*H
        outline=[(sx-width,sy,top),(sx+width,sy,top),(sx+width*.93,sy,bottom+.10*H),(sx,sy,bottom),(sx-width*.93,sy,bottom+.10*H)]
        geometry('Repaired tower shield',outline,[(0,1,2,3,4)],M['wood'],'wrist.l')
        line('Tower shield steel rim',outline+[outline[0]],.009*H,M['steel'],'wrist.l')
        for i in range(5):line('Shield wood plank',[(sx+(-.10+i*.05)*H,sy-.003*H,top-.015*H),(sx+(-.10+i*.05)*H,sy-.003*H,bottom+.086*H)],.002*H,M['dark'],'wrist.l')
        box('Shield repair plate',(sx+.045*H,sy-.01*H,.55*H),(.103*H,.012*H,.10*H),M['steel'],'wrist.l',.002*H)
        for a in [-1,1]:
            for b in [-1,1]:ellipsoid('Shield rivet',(sx+.045*H+a*.041*H,sy-.018*H,.55*H+b*.036*H),(.004*H,.003*H,.004*H),M['trim'],'wrist.l',10)
    elif ID=='mawren':
        line('Carved sorcerer staff',[(x,y,.07*H),(x,y,1.016*H)],.015*H,M['wood'],'wrist.r',14)
        ring('Staff orbit',(x,y,1.033*H),.060*H,.004*H,M['trim'],'wrist.r',(math.pi/2,0,0))
        ellipsoid('Rune focus',(x,y,1.031*H),(.025*H,.025*H,.044*H),M['glow'],'wrist.r',16)
        for i in range(5):ring('Staff binding',(x,y,(.30+i*.14)*H),.018*H,.003*H,M['trim'],'wrist.r')
    elif ID in ['neris','veyra','rhoven','seyra']:
        blade('Chained dagger' if ID=='veyra' else 'Glass blade' if ID=='seyra' else 'Hooked dagger',x,y,z,(.21 if ID=='seyra' else .12)*H,M['glass'] if ID=='seyra' else M['steel'],width=.015)
        if ID in ['neris','rhoven']:blade('Offhand spectral knife' if ID=='rhoven' else 'Offhand hooked dagger',-x,y,z,.115*H,M['glow'] if ID=='rhoven' else M['steel'],'wrist.l',.014)
    elif ID=='vesper':
        for s,side in [(-1,'r'),(1,'l')]:
            xx=s*(c['shoulder']+.063)*H
            for i in range(3):tube('Surgical needle',[(xx+(i-1)*.009*H,y,z+.016*H),(xx+(i-1)*.012*H,y-.02*H,z-.148*H)],[.002*H,.0002*H],M['steel'],'wrist.'+side,6)

def animate(c):
    fps=30;bpy.context.scene.render.fps=fps
    def action(name,duration,poses):
        a=bpy.data.actions.new(name);RIG.animation_data_create();RIG.animation_data.action=a
        for t,pose in poses:
            frame=round(t*duration*fps)+1
            for b in RIG.pose.bones:
                b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
                if b.name in pose:b.rotation_euler=pose[b.name]
                if b.name=='hips':b.location=(0,pose.get('forward',0)*H,pose.get('drop',0)*H)
                if b.name=='wrist.r' and ID=='varkesh' and name=='Signature':b.scale=(1+t*.7,1+t*.7,1+t*.7) if t<.6 else (1,1,1)
                if b.name.startswith('cape.'):
                    sign=1 if b.name.endswith('l') else -1
                    b.rotation_euler.x += math.sin(t*math.tau+sign)*.035
                b.keyframe_insert(data_path='rotation_euler',frame=frame,group=b.name)
                b.keyframe_insert(data_path='location',frame=frame,group=b.name)
                b.keyframe_insert(data_path='scale',frame=frame,group=b.name)
        return a
    wide=ID in ['nomet','varkesh']
    base={'upperarm.l':(-.12,0,.08 if wide else .035),'upperarm.r':(-.14,0,-.08 if wide else -.035),'lowerarm.l':(-.13,0,0),'lowerarm.r':(-.16,0,0)}
    def pose(**changes):return {**base,**changes}
    idle=[]
    for i in range(5):
        t=i/4;v=math.sin(t*math.tau)
        idle.append((t,{**base,'chest':(.006*v,0,0),'head':(.009*v,.012*v,0),'drop':.002*v}))
    action('Idle',4,idle)
    for name,amp,duration in [('Walk',.34,1),('Run',.62,.72),('Walk_Back',-.27,1.05)]:
        samples=[]
        for i in range(9):
            t=i/8;v=math.sin(t*math.tau)
            samples.append((t,{**base,'upperleg.l':(v*amp,0,0),'upperleg.r':(-v*amp,0,0),'lowerleg.l':(-max(0,-v)*abs(amp)*.95,0,0),'lowerleg.r':(-max(0,v)*abs(amp)*.95,0,0),'upperarm.l':(-v*amp*.50-.12,0,.03),'upperarm.r':(v*amp*.45-.12,0,-.03),'chest':(.11 if name=='Run' else .025,0,v*.025),'drop':-abs(v)*.009}))
        action(name,duration,samples)
    for name,sign in [('Strafe_Left',1),('Strafe_Right',-1)]:
        action(name,.83,[(i/8,{**base,'upperleg.l':(.10,0,math.sin(i/8*math.tau)*.22*sign),'upperleg.r':(-.10,0,-math.sin(i/8*math.tau)*.22*sign),'drop':-.008*abs(math.sin(i/8*math.tau))}) for i in range(9)])
    action('Guard',1,[(0,pose(**{'upperarm.l':(-.85,0,.20),'lowerarm.l':(-.95,0,0),'upperarm.r':(-.60,0,-.16),'lowerarm.r':(-.75,0,0),'chest':(.08,0,.04)})),(1,pose(**{'upperarm.l':(-.85,0,.20),'lowerarm.l':(-.95,0,0),'upperarm.r':(-.60,0,-.16),'lowerarm.r':(-.75,0,0),'chest':(.08,0,.04)}))])
    for combo in range(3):
        fast=ID in ['neris','veyra','rhoven','vesper']; fist=ID in ['nomet','varkesh']; mage=ID=='mawren'
        wind=pose(**{'chest':(.02,(-.32 if combo%2==0 else .28),0),'upperarm.r':(.28 if not mage else -.60,.1,-.18),'lowerarm.r':(-.85,0,0)})
        strike=pose(**{'chest':(.13,.35 if combo%2==0 else -.28,0),'upperarm.r':(-1.23 if fist or mage else -.93,0,.62 if combo%2==0 else -.68),'lowerarm.r':(-.13 if fist else -.31,0,0),'upperarm.l':(-.70 if fast else -.25,0,.12),'lowerarm.l':(-.6,0,0)})
        action('Light_'+str(combo+1),.54 if fast else .68 if not fist else .77,[(0,base),(.25,wind),(.49,strike),(.72,{**strike,'chest':(.14,.20,0)}),(1,base)])
    action('Heavy',1.18,[(0,base),(.34,pose(**{'upperarm.r':(-2.20,0,-.12),'lowerarm.r':(-.6,0,0),'chest':(-.12,-.20,0)})),(.59,pose(**{'upperarm.r':(-.78,0,.25),'lowerarm.r':(-.05,0,0),'chest':(.40,.24,0),'drop':-.04})),(.78,pose(**{'upperarm.r':(-.6,0,.35),'chest':(.24,.13,0)})),(1,base)])
    signatures={
      'karen':[pose(**{'upperarm.r':(-.18,0,.38),'lowerarm.r':(-1.15,0,0),'chest':(0,-.34,0)}),pose(**{'upperarm.r':(-1.43,0,-.14),'lowerarm.r':(0,0,0),'chest':(.14,.31,0)})],
      'taren':[pose(**{'upperarm.l':(-.97,0,.05),'lowerarm.l':(-.8,0,0),'upperarm.r':(-.85,0,-.12),'lowerarm.r':(-.5,0,0),'drop':-.04}),pose(**{'chest':(.32,0,0),'upperarm.l':(-1.03,0,0),'lowerarm.l':(-.8,0,0),'upperarm.r':(-1.0,0,-.14),'lowerarm.r':(-.05,0,0),'drop':-.045})],
      'nomet':[pose(**{'upperarm.r':(.32,0,-.25),'lowerarm.r':(-1.35,0,0),'chest':(-.10,-.25,0)}),pose(**{'chest':(.88,.18,0),'upperarm.r':(-.74,0,-.15),'lowerarm.r':(0,0,0),'upperleg.l':(.38,0,0),'lowerleg.l':(-.68,0,0),'drop':-.20})],
      'veyra':[pose(**{'upperarm.r':(-.30,0,-.65),'lowerarm.r':(-1.4,0,0),'chest':(0,-.3,0)}),pose(**{'upperarm.r':(-1.45,0,.08),'lowerarm.r':(0,0,0),'chest':(.08,.2,0),'upperarm.l':(-.58,0,.3)})],
      'mawren':[pose(**{'upperarm.l':(-.42,0,.30),'lowerarm.l':(-1.03,0,0),'upperarm.r':(-.64,0,-.1)}),pose(**{'upperarm.l':(-1.30,0,.2),'lowerarm.l':(-.10,0,0),'upperarm.r':(-.66,0,-.1),'head':(-.1,0,0)})],
      'neris':[pose(**{'chest':(.55,-.20,0),'upperarm.l':(-.35,0,.2),'lowerarm.l':(-1.13,0,0),'drop':-.15}),pose(**{'chest':(.48,.15,0),'upperarm.l':(-.95,0,.2),'lowerarm.l':(-.18,0,0),'upperarm.r':(-.33,0,-.25),'drop':-.12})],
      'vesper':[pose(**{'upperarm.r':(-.55,0,-.15),'lowerarm.r':(-1.30,0,0),'head':(0,-.12,0)}),pose(**{'upperarm.r':(-1.38,0,-.14),'lowerarm.r':(-.03,0,0),'chest':(.08,.13,0),'head':(0,.08,0)})],
      'rhoven':[pose(**{'chest':(-.08,0,0),'upperarm.l':(-.10,0,-.45),'upperarm.r':(-.1,0,.45),'head':(-.15,0,0)}),pose(**{'upperarm.l':(-.20,0,-1.05),'upperarm.r':(-.20,0,1.05),'head':(-.08,0,0),'drop':.035})],
      'seyra':[pose(**{'upperarm.l':(-.65,0,-.2),'lowerarm.l':(-.7,0,0),'upperarm.r':(-.35,0,.2)}),pose(**{'upperarm.l':(-.2,0,-.90),'upperarm.r':(-.2,0,.9),'head':(0,.16,0),'drop':.025})],
      'varkesh':[pose(**{'upperarm.r':(.35,0,.55),'lowerarm.r':(-1.10,0,0),'chest':(-.1,-.4,0)}),pose(**{'upperarm.r':(-1.47,0,-.15),'lowerarm.r':(0,0,0),'chest':(.36,.35,0),'drop':-.065})],
    }
    wind,release=signatures[ID]
    action('Signature',1.35,[(0,base),(.30,wind),(.51,release),(.76,release),(1,base)])
    action('Ultimate',1.85,[(0,base),(.25,wind),(.45,release),(.65,{**release,'chest':(.32,.3,0)}),(.78,release),(1,base)])
    action('Hit',.48,[(0,base),(.22,pose(**{'chest':(-.24,-.12,.05),'head':(-.18,.13,0),'upperarm.l':(-.30,0,.2),'upperarm.r':(-.28,0,-.2),'drop':-.03})),(1,base)])
    crouch=pose(**{'chest':(.52,0,0),'upperleg.l':(.68,0,0),'upperleg.r':(.68,0,0),'lowerleg.l':(-1.22,0,0),'lowerleg.r':(-1.22,0,0),'drop':-.22,'head':(-.3,0,0)})
    for name,lean in [('Dodge_Forward',.13),('Dodge_Back',-.19),('Dodge_Left',.24),('Dodge_Right',-.24)]:
        mid={**crouch,'chest':(.30,0,lean)}
        action(name,.52,[(0,base),(.15,crouch),(.52,mid),(.81,crouch),(1,base)])
    action('Jump',.85,[(0,base),(.18,crouch),(.42,pose(**{'upperleg.l':(.4,0,0),'lowerleg.l':(-.75,0,0),'upperleg.r':(-.15,0,0),'lowerleg.r':(-.55,0,0),'upperarm.l':(-.6,0,.1),'upperarm.r':(-.6,0,-.1)})),(.75,crouch),(1,base)])
    grab=pose(**{'upperarm.l':(-1.4,0,.20),'lowerarm.l':(-.22,0,0),'upperarm.r':(-1.4,0,-.20),'lowerarm.r':(-.22,0,0),'chest':(.15,0,0)})
    action('Grapple',1.15,[(0,base),(.25,grab),(.55,{**grab,'chest':(-.25,0,0),'lowerarm.l':(-.8,0,0),'lowerarm.r':(-.8,0,0)}),(.76,{**grab,'chest':(.56,0,0)}),(1,base)])
    action('Grabbed',1,[(0,pose(**{'upperarm.l':(-.35,0,-.12),'upperarm.r':(-.3,0,.12),'chest':(-.08,0,0)})),(1,pose(**{'upperarm.l':(-.35,0,-.12),'upperarm.r':(-.3,0,.12),'chest':(-.08,0,0)}))])
    down=pose(**{'hips':(-1.38,0,.15),'chest':(-.15,0,0),'head':(.10,0,0),'upperleg.l':(.30,0,.1),'upperleg.r':(.15,0,-.1),'lowerleg.l':(-.4,0,0),'lowerleg.r':(-.3,0,0),'drop':-.42})
    action('Fall',.9,[(0,base),(.35,pose(**{'chest':(-.4,0,0),'head':(-.2,0,0)})),(.74,down),(1,down)])
    action('GetUp',.9,[(0,down),(.3,{**down,'hips':(-.70,0,.10),'drop':-.32}),(.65,crouch),(1,base)])
    action('Thrown',1,[(0,grab),(.5,pose(**{'hips':(-.65,0,.10),'upperleg.l':(.45,0,0),'upperleg.r':(.6,0,0),'lowerleg.l':(-.8,0,0),'lowerleg.r':(-.75,0,0)})),(1,down)])
    action('Death',1.3,[(0,base),(.45,down),(1,down)])
    RIG.animation_data.action=bpy.data.actions.get('Idle')
    bpy.context.scene.frame_set(1)

def portrait(c):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=512;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.world.color=(.028,.035,.046)
    bpy.ops.object.camera_add(location=(.85*H,-2.8*H,.84*H));camera=bpy.context.object
    target=Vector((0,0,.65*H));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=1.25*H;scene.camera=camera
    for location,energy,color,size in [((1.3*H,-1.5*H,2*H),650,(1,.86,.69),1.8*H),((-1.5*H,-.9*H,1.2*H),380,(.63,.78,1),2*H),((0,1.2*H,1.6*H),950,(.77,.89,1),H)]:
        bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=energy;light.data.color=color;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,.68*H))-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/(ID+'.png'));bpy.ops.render.render(write_still=True)

def build_one(id,c):
    global ID,H,RIG,PIECES,M
    ID=id;H=c['h'];PIECES=[]
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for a in list(bpy.data.actions):bpy.data.actions.remove(a)
    RIG=make_rig(c)
    M={
      'skin':material(id+' anatomy',c['skin'],'glass' if id=='seyra' else 'skin',alpha=.88 if id=='seyra' else 1),
      'cloth':material(id+' woven base',c['cloth']), 'clothlight':material(id+' stitch', '#a39e8f'),
      'outer':material(id+' outer garment',c['outer'],'metal' if id=='taren' else 'cloth',metal=.69 if id=='taren' else 0),
      'pants':material(id+' trousers',c['pants']), 'leather':material(id+' worn leather','#45332a','leather'),
      'trim':material(id+' worked brass','#aaa084','metal',metal=.75), 'steel':material(id+' forged steel','#9ca6aa','metal',metal=.82),
      'hair':material(id+' hair',c['hair'],'hair'),'hairlight':material(id+' hair highlights','#dedfdb' if id in ['neris','seyra'] else '#857968','hair'),
      'sclera':material(id+' eye whites','#dcd9c8','glass'), 'iris':material(id+' iris',c['eye'],'glass',glow=.7 if id in ['seyra','varkesh','nomet'] else 0),
      'pupil':material(id+' pupil','#131919','glass'), 'lip':material(id+' lips','#8f6460' if c['female'] else '#786356','skin'),
      'shadow':material(id+' facial creases','#403931','skin'), 'scar':material(id+' scar tissue','#72605c','skin'),
      'dark':material(id+' hardware dark','#252a2d','metal',metal=.4), 'bone':material(id+' exposed bone','#bcb8a0','bone'),
      'wood':material(id+' worn ash wood','#645345','leather'), 'glass':material(id+' spirit glass','#bbdfde','glass',glow=.25,alpha=.85),
      'vial':material(id+' medicine glass','#628a77','glass',alpha=.78), 'basalt':material(id+' basalt','#232d2c','bone'),
      'glow':material(id+' signature light','#ff9142' if id=='varkesh' else '#9edfd5','glass',glow=3),
    }
    anatomy(c);face(c);hair(c);clothes(c);weapons(c)
    # Joining retains weights and material boundaries while avoiding hundreds of draws.
    bpy.ops.object.select_all(action='DESELECT')
    for p in PIECES:p.select_set(True)
    bpy.context.view_layer.objects.active=PIECES[0];bpy.ops.object.join()
    mesh=bpy.context.object;mesh.name=id+' anatomy and clothing';mesh['original_character']=id
    # All geometry shares one skeleton; one armature modifier is enough after joining.
    for mod in list(mesh.modifiers)[1:]:mesh.modifiers.remove(mod)
    animate(c)
    bpy.context.scene.render.fps=30;bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=121
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(id+'.blend')))
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);RIG.select_set(True)
    props=set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    export=dict(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_nla_strips=False,export_anim_slide_to_zero=True,export_materials='EXPORT',export_yup=True)
    bpy.ops.export_scene.gltf(**{k:v for k,v in export.items() if k in props})
    entry={'file':id+'.glb','height':H,'source':id+'.blend','rigged':True,'clips':[a.name for a in bpy.data.actions], 'portrait':id+'.png' if PORTRAITS else None}
    manifest_path=OUT/'manifest.json'
    try:manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    except (ValueError,FileNotFoundError):manifest={}
    manifest.setdefault('characters',{})[id]=entry;manifest['version']=2;manifest['generator']='Blender 4.5 · Original Veilstrike assets'
    temporary=OUT/'manifest.tmp';temporary.write_text(json.dumps(manifest,indent=2),encoding='utf-8');temporary.replace(manifest_path)
    print('CHARACTER_READY',id,(OUT/(id+'.glb')).stat().st_size,flush=True)
    if PORTRAITS:portrait(c)

for id,c in CAST.items():
    if ONLY and id!=ONLY:continue
    build_one(id,c)
print('VEILSTRIKE_CHARACTER_BUILD_COMPLETE',flush=True)
