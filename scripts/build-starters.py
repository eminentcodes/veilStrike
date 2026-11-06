"""Author Taren and Nomet with the anatomical pipeline used for Karen.

blender -b --python scripts/build-starters.py -- --only taren --preview
blender -b --python scripts/build-starters.py -- --only nomet --preview

The existing Karen authoring file supplies the CC0 human topology, skin
weights, IK and export utilities. Each starter has its own anatomy, fitted
costume, equipment, face details and choreography. Karen's asset is preserved.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
character = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else 'taren'
if character not in ('taren', 'nomet'):
    raise ValueError('Choose taren or nomet')

source = (ROOT / 'scripts/build-karen.py').read_text(encoding='utf-8')
profile = {
    'taren': dict(height=1.91, muscle=.95, width=1.10, skin='#ab886d',
                  shirt='#263747', leather='#39434b', pants='#29313a',
                  hair='#45443f', hairlight='#78766c', eyes='#c4beb1', iris='#62767b'),
    'nomet': dict(height=1.92, muscle=1.30, width=1.18, skin='#7b8273',
                  shirt='#5c594c', leather='#4b4539', pants='#454133',
                  hair='#242924', hairlight='#373b30', eyes='#b1bba4', iris='#c7d99e'),
}[character]
source = source.replace('H = 1.74', f'H = 1.74\nCHARACTER = {character!r}\nPROFILE = {profile!r}')
source = source.replace("SOURCE = CACHE / 'character-source'", "SOURCE = ROOT / 'assets/characters'")
source = source.replace("[('human-female.target', 1.0), ('human-athletic.target', .27)]",
                        f"[('human-female.target', 0.0), ('human-athletic.target', {profile['muscle']})]")
source = source.replace("skel = json.loads((CACHE / 'human-skeleton.json').read_text())",
    "v[:,0] *= PROFILE['width']\n    skel = json.loads((CACHE / 'human-skeleton.json').read_text())")
for key in ('skin', 'shirt', 'leather', 'pants', 'hair', 'hairlight', 'eyes', 'iris'):
    # Only alter the intended material's color, retaining fabric textures.
    import re
    source = re.sub(r"('" + key + r"':mat\('[^']*',)'#[0-9a-fA-F]{6}'",
                    lambda m: m.group(1) + repr(profile[key]), source)

costume = r'''
# Individually fitted clothing, weighted with the underlying anatomy.
surface('Worn pit trousers' if CHARACTER=='nomet' else 'Navy quilted soldier trousers',
        lambda p:.09<p[2]<1.025,M['pants'],.012)
if CHARACTER=='taren':
    torso=lambda p:.96<p[2]<1.405 and abs(p[0])<.23
    sleeve=lambda p:.18<abs(p[0])<.40 and 1.16<p[2]<1.46
    surface('Navy padded gambeson',lambda p:torso(p) or sleeve(p),M['shirt'],.016)
    surface('Fitted gunmetal cuirass',lambda p:1.02<p[2]<1.385 and abs(p[0])<.20,M['steel'],.029)
    surface('Leather vambraces',lambda p:.40<abs(p[0])<.53 and 1.035<p[2]<1.16,M['boots'],.013)
    exposed=lambda p:p[2]>1.405 or (.35<abs(p[0]) and p[2]>1.055 and not sleeve(p))
else:
    exposed=lambda p:p[2]>1.025
skin=surface(CHARACTER.title()+' exposed anatomical skin',exposed,M['skin'],0,1)
PIECES.remove(BODY);bpy.data.objects.remove(BODY,do_unlink=True);BODY=skin

for side,sign in [('L',1),('R',-1)]:
    ankle=JOINTS['foot.'+side+'____head']; x=ankle.x
    if CHARACTER=='taren':
        surface('Fitted veteran boot '+side,lambda p:.065<p[2]<.43 and p[0]*sign>0,M['boots'],.017)
        loft('Armored boot '+side,[(.012,.063,.13,x,-.065),(.039,.066,.13,x,-.065),(.076,.061,.105,x,-.05),(.11,.048,.052,x,-.022)],M['boots'],'foot.'+side)
        loft('Worn soldier sole '+side,[(.008,.067,.132,x,-.066),(.026,.067,.132,x,-.066)],M['dark'],'foot.'+side)
        knee=JOINTS['lowerleg01.'+side+'____head']
        sphere('Dented steel poleyn '+side,(knee.x,knee.y-.044,knee.z),(.058,.019,.082),M['steel'],'lowerleg01.'+side)
        sh=JOINTS['upperarm01.'+side+'____head']
        sphere('Rounded soldier pauldron '+side,(sh.x,sh.y,sh.z+.02),(.103,.086,.067),M['steel'],'upperarm01.'+side)
        for dx in [-.067,.067]:
            sphere('Shoulder brass fastening '+side,(sh.x+dx,sh.y-.06,sh.z+.015),(.004,.003,.004),M['brass'],'upperarm01.'+side,12)
    else:
        # Bare shaped feet wrapped for the pit, rather than military boots.
        surface('Ashen bare foot '+side,lambda p:p[2]<.115 and p[0]*sign>0,M['skin'],0)
        for j in range(4):
            loft('Dirty ankle wrap '+side,[(.10+j*.012,.046,.043,x,-.013),(.109+j*.012,.048,.044,x,-.013)],M['shirt'],'foot.'+side,24)
        for bone in ['wrist.'+side,'lowerarm01.'+side]:
            center=RIG.data.bones[bone].head_local
            sphere('Forged pit shackle '+bone,center,(.047,.044,.035),M['steel'],bone)
            for j in range(3):
                sphere('Shackle rivet '+bone,(center.x,center.y-.042,center.z+(j-1)*.011),(.003,.003,.003),M['brass'],bone,10)
        # Knuckle plates remain bound to the articulated hand.
        for finger in range(2,6):
            joint=JOINTS[f'finger{finger}-1.{side}____head']
            sphere('Iron knuckle '+side+str(finger),(joint.x,joint.y-.009,joint.z),(.010,.009,.008),M['steel'],'wrist.'+side,12)

waist=JOINTS['root____head'].z if 'root____head' in JOINTS else .96
loft('Weathered utility belt',[(.94,.177,.107,0,.003),(.976,.179,.109,0,.003)],M['boots'])
cube('Square brass belt clasp',(0,-.115,.958),(.048,.011,.041),M['brass'])
cube('Clasp center',(0,-.123,.958),(.027,.005,.022),M['dark'])
if CHARACTER=='taren':
    for sign in [-1,1]:
        seam('Cuirass panel edge',[(sign*.115,-.144,1.35),(sign*.155,-.15,1.24),(sign*.124,-.12,1.07)],M['edge'],'spine03',.0025)
        for z in [1.13,1.20,1.27,1.34]:
            sphere('Armor fastener',(sign*.12,-.157,z),(.0035,.002,.0035),M['brass'],'spine03',12)
    cube('Field repair pouch',(-.183,.015,.92),(.071,.060,.091),M['boots'])
    for side,sign in [('L',1),('R',-1)]:
        verts=[(sign*.025,-.108,.942),(sign*.17,-.077,.942),(sign*.19,-.065,.62),(sign*.037,-.096,.65)]
        geom('Navy divided soldier skirt '+side,verts,[(0,1,2,3)],M['shirt'],bone='tabard.'+side,sub=1)
    scar=mat('Healed veteran scar','#856558','skin')
    seam('Old cheek scar',[(-.035,-.111,1.612),(-.044,-.111,1.596),(-.041,-.108,1.581)],scar,'head',.0014)
else:
    bone_mat=mat('Exposed weathered bone','#b8b398','bone')
    scar=mat('Old undead scars','#4c5146','skin')
    for sign in [-1,1]:
        seam('Pit torso scar',[(sign*.035,-.152,1.31),(sign*.093,-.141,1.29),(sign*.125,-.131,1.25)],scar,'spine03',.0023)
        for z in [1.20,1.27,1.34]:
            seam('Scar stitch',[(sign*.066,-.151,z-.005),(sign*.070,-.152,z+.005)],M['dark'],'spine03',.001)
    # Two exposed forearm bones with visible dark margins and an elbow joint.
    elbow=JOINTS['lowerarm01.R____head']; wrist=JOINTS['wrist.R____head']
    for offset in [-.012,.012]:
        points=[tuple(elbow+Vector((0,-.026,offset))),tuple(elbow.lerp(wrist,.5)+Vector((0,-.035,offset))),tuple(wrist+Vector((0,-.025,offset)))]
        tube('Exposed radius and ulna',points,[.011,.008,.009],bone_mat,'lowerarm01.R',12)
    sphere('Exposed elbow bone',elbow+Vector((0,-.028,0)),(.024,.018,.022),bone_mat,'lowerarm01.R')
    for j in range(6):
        x=-.132+j*.053
        seam('Trouser waistband repair',[(x,-.118,.988),(x+.008,-.121,.969)],M['thread'],'root',.0018)
    seam('Rope pit belt',[(.177*math.cos(a),.111*math.sin(a),.955) for a in np.linspace(0,math.tau,48)],M['thread'],'root',.004)
'''

hair = r'''
# Natural facial topology, brows, separate eyes and individual hairstyles.
if CHARACTER=='taren':
    surface('Close cropped greying hair',lambda p:p[2]>1.686 or (p[1]>-.018 and p[2]>1.605),M['hair'],.005)
    for j in range(12):
        x=(j-5.5)*.010
        tube('Swept short hair',[(x,.008,1.744),(x,-.045,1.739),(x,-.082,1.705)],[.005,.006,.001],M['hairlight'] if j%4==0 else M['hair'],'head',8)
    for sign in [-1,1]:
        for j in range(9):
            x=sign*(.009+j*.006)
            tube('Weathered beard strand',[(x,-.101+j*.001,1.583),(x*.91,-.103,1.566),(x*.68,-.075,1.545)],[.0035,.003,.0008],M['hairlight'] if j%4==0 else M['hair'],'head',6)
        seam('Veteran moustache',[(0,-.127,1.586),(sign*.015,-.124,1.585),(sign*.026,-.118,1.580)],M['hair'],'head',.003)
else:
    # A scarred scalp with a few sparse locks, not the soldier's hairstyle.
    for sign in [-1,1]:
        for j in range(3):
            x=sign*(.035+j*.014)
            tube('Sparse undead hair',[(x,.009,1.745-j*.012),(x*1.06,.041,1.718-j*.020),(x*1.12,.041,1.682-j*.016)],[.003,.004,.0007],M['hair'],'head',6)
    seam('Undead brow scar',[(-.040,-.115,1.65),(-.031,-.124,1.634),(-.036,-.12,1.622)],M['dark'],'head',.0015)
for side,sign in [('L',1),('R',-1)]:
    eye=JOINTS['eye.'+side+'____head']
    sphere('Anatomical eyeball '+side,eye,(.0115,.0115,.0115),M['eyes'])
    sphere('Iris '+side,(eye.x,eye.y-.0108,eye.z),(.0045,.001,.0045),M['iris'])
    sphere('Pupil '+side,(eye.x,eye.y-.0117,eye.z),(.002,.0005,.002),M['pupil'])
    seam('Shaped brow '+side,[(eye.x-sign*.014,eye.y-.010,eye.z+.018),(eye.x,eye.y-.012,eye.z+.021),(eye.x+sign*.018,eye.y-.004,eye.z+.015)],M['hair'],'head',.0023)
'''

equipment = r'''
if CHARACTER=='taren':
    shaft=mat('Worn ash spear shaft','#69513a','leather')
    tube('Ash short spear shaft',[tuple(sword_point(-.76)),tuple(sword_point(.84))],[.015,.012],shaft,'wrist.R',16)
    tube('Spear leather hand binding',[tuple(sword_point(-.064)),tuple(sword_point(.064))],[.018,.018],M['boots'],'wrist.R',16)
    tube('Forged spear socket',[tuple(sword_point(.77)),tuple(sword_point(.90))],[.017,.013],M['steel'],'wrist.R',12)
    verts=[]
    for distance,width in [(.84,.017),(.95,.054),(1.21,0)]:
        for w,d in [(-width,0),(0,.008),(width,0),(0,-.008)]:verts.append(tuple(sword_point(distance,w,d)))
    faces=[(r*4+j,r*4+(j+1)%4,(r+1)*4+(j+1)%4,(r+1)*4+j) for r in range(2) for j in range(4)]
    geom('Leaf steel spearhead',verts,faces,M['edge'],bone='wrist.R')
    hand=JOINTS['wrist.L____head']
    cx,cy,cz=hand.x,hand.y-.075,hand.z
    outline=[(-.265,-.40),(.265,-.40),(.29,.28),(.20,.43),(-.20,.43),(-.29,.28)]
    verts=[(cx+x,cy-.024*(1-(x/.30)**2),cz+z) for x,z in outline]
    geom('Repaired curved tower shield',verts,[tuple(range(6))],M['steel'],bone='wrist.L')
    for i in range(6):
        x,z=outline[i]; nx,nz=outline[(i+1)%6]
        tube('Rolled tower shield rim',[(cx+x,cy-.015,cz+z),(cx+nx,cy-.015,cz+nz)],[.012,.012],M['edge'],'wrist.L',10)
    cube('Shield repair strip',(cx+.12,cy-.032,cz),(.055,.015,.70),M['boots'],'wrist.L')
    cube('Shield oath crest vertical',(cx-.07,cy-.034,cz+.045),(.025,.012,.25),M['brass'],'wrist.L')
    cube('Shield oath crest crossbar',(cx-.07,cy-.035,cz+.075),(.145,.013,.025),M['brass'],'wrist.L')
    for z in [-.28,-.12,.10,.27]:
        sphere('Shield patch rivet',(cx+.12,cy-.048,cz+z),(.008,.006,.008),M['brass'],'wrist.L',12)
'''

def replace_section(text, start, end, replacement):
    a = text.index(start); b = text.index(end, a)
    return text[:a] + replacement + '\n' + text[b:]

source = replace_section(source, '# Garments follow the anatomical topology', '# The hair cap uses scalp topology', costume)
source = replace_section(source, '# The hair cap uses scalp topology', '# An arming sword is built', hair)
source = replace_section(source, "tube('Sword leather wrapped handle'", '# Blink deforms the upper eyelids', equipment)

choreography = r'''
    # Weapon-specific action: shield/spear thrusts versus bare-fist boxing.
    if CHARACTER=='taren':
        lhand=np.array((.20,-.31,1.245));rhand=np.array((-.225,-.235,1.18))
        blade=np.array((-.08,-.24,.97))
        if name=='Guard':
            lhand+=np.array((-.03,-.08,.08));rhand+=np.array((.04,.05,-.03));drop-=.045
        if name.startswith('Light_') or name in ('Heavy','Ultimate'):
            jab=envelope(t,.16,.72); windup=envelope(t,0,.28)
            rhand+=np.array((.055*jab,-.24*jab+.045*windup,.035*jab))
            blade=mix((-.1,-.35,.93),(0,-.985,.17),jab)
            lhand[1]-=.065*jab;twist-=.09*jab
        if name=='Signature':
            charge=envelope(t,.12,.80)
            lhand+=np.array((-.05,-.11,.09))*charge
            rhand+=np.array((.055,-.17,-.02))*charge
            blade=mix(blade,(0,-.96,.28),charge);lean+=.18*charge;drop-=.10*charge
    else:
        rhand=np.array((-.19,-.30,1.365));lhand=np.array((.19,-.32,1.37))
        blade=np.array((0,-.98,.18));lean+=.10;drop-=.035
        if name in ('Idle','Lobby_Idle','Guard'):
            rhand[2]+=.008*wave;lhand[2]-=.008*wave;twist+=.02*wave
        if name.startswith('Light_'):
            punch=envelope(t,.16,.70);direction=-1 if name=='Light_2' else 1
            if direction==1:rhand+=np.array((.13,-.28,-.05))*punch
            else:lhand+=np.array((-.13,-.28,-.045))*punch
            twist+=direction*.21*punch;lean+=.10*punch
        elif name in ('Heavy','Ultimate'):
            punch=envelope(t,.26,.75)
            rhand+=np.array((.16,-.27,-.25))*punch;lhand[2]+=.04*punch
            lean+=.20*punch;twist+=.30*punch
        elif name=='Signature':
            slam=envelope(t,.16,.72)
            rhand=mix(rhand,(-.17,-.38,.48),slam)
            lhand+=np.array((0,-.04,-.20))*slam;drop-=.20*slam;lean+=.43*slam
        elif name.startswith('Dodge_'):
            rhand[2]-=.12*math.sin(t*math.pi);lhand[2]-=.12*math.sin(t*math.pi)
'''
root_line = "    RIG.pose.bones['root'].location=RIG.data.bones['root'].matrix_local.to_3x3().inverted()@Vector((.005*wave,0,drop))"
source = source.replace(root_line, choreography + '\n' + root_line)
source = source.replace("    aim('wrist.L',ltarget,ltarget+Vector((.008,-.025,-.045)))",
    "    if CHARACTER=='taren':\n        rest=RIG.data.bones['wrist.L']\n        RIG.pose.bones['wrist.L'].matrix=Matrix.Translation(ltarget)@rest.matrix_local.to_quaternion().to_matrix().to_4x4()\n    else:\n        aim('wrist.L',ltarget,ltarget+Vector((.008,-.025,-.045)))")
source = source.replace("if side=='R' else (.16 if segment==1 else .30)",
    "if side=='R' or CHARACTER=='nomet' else (.22 if segment==1 else .45)")
source = source.replace("blend_path=SOURCE/'karen-human-v3.blend'",
    "RIG.scale=(PROFILE['height']/H,)*3\nblend_path=SOURCE/'karen-human-v3.blend'")
source = source.replace("scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True",
    "scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True")
source = source.replace("camera.data.ortho_scale=2.10", "camera.data.ortho_scale=2.48")
source = source.replace("target=Vector((0,-.025,.98))", "target=Vector((0,-.025,1.04))")
source = source.replace('karen-human-v3', character + '-human-v1')
source = source.replace('Karen', character.title()).replace('KAREN_', character.upper() + '_')
exec(compile(source, str(ROOT / 'scripts/build-karen.py'), 'exec'), {'__file__': str(ROOT / 'scripts/build-karen.py'), '__name__': '__main__'})
