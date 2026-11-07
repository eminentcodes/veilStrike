"""Rebuild Karen's anatomical proportions, fitted swordswoman clothing and long hair in Blender.
Uses the existing editable MakeHuman/Veilstrike authoring pipeline; no external assets needed.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
original=ROOT/'scripts/build-karen.py'
source=original.read_text(encoding='utf-8')
def replace(before,after):
    global source
    if before not in source:raise RuntimeError('Authoring anchor missing: '+before[:70])
    source=source.replace(before,after)

replace("    skel = json.loads((CACHE / 'human-skeleton.json').read_text())",r"""
    # Refine an adult athletic female silhouette without changing bone lengths or hand positions.
    for index in body:
        x,y,z=v[index]
        if .82<z<1.025 and abs(x)>.065:
            x*=1+.10*math.sin((z-.82)/.205*math.pi)
        if 1.045<z<1.19 and abs(x)<.17:
            x*=1-.045*math.sin((z-1.045)/.145*math.pi)
        if 1.19<z<1.37 and .032<abs(x)<.14 and y<-.095:
            y-=.004*math.sin((z-1.19)/.18*math.pi)*math.sin((abs(x)-.032)/.108*math.pi)
        if 1.535<z<1.59 and abs(x)<.085:
            x*=1-.055*math.sin((z-1.535)/.055*math.pi)
        if 1.603<z<1.635 and .029<abs(x)<.067 and y<-.078:
            y-=.0028*math.sin((z-1.603)/.032*math.pi)
        if 1.59<z<1.66 and abs(x)<.014 and y<-.12:
            y+=.0018*math.sin((z-1.59)/.07*math.pi)
        v[index]=(x,y,z)
    skel = json.loads((CACHE / 'human-skeleton.json').read_text())
""")
replace("'lip':mat('Karen natural lips','#865749','skin')","'lip':mat('Karen natural lips','#965f53','skin')")
replace("'shirt':mat('Undyed linen shirt','#b9ad90')","'shirt':mat('Woven stone linen shirt','#c8bda6')")
replace("'leather':mat('Oxblood fitted leather','#512925','leather')","'leather':mat('Fitted oxblood sword vest','#6b4037','leather')")
replace("'pants':mat('Charcoal riding trousers','#302c2a')","'pants':mat('Charcoal riding trousers','#39403e')")
replace("'boots':mat('Weathered dark riding leather','#2d211c','leather')","'boots':mat('Weathered dark riding leather','#513b2c','leather')")
replace("'hair':mat('Dark auburn hair','#322019','hair')","'hair':mat('Dark auburn hair','#42271e','hair')")
replace("(abs(p[0])>.16 and abs(p[0])<.31 and 1.26<p[2]<1.44)","(abs(p[0])>.16 and abs(p[0])<.37 and 1.20<p[2]<1.44)")
replace("vest_selector=lambda p: .96<p[2]<1.365 and abs(p[0])<.168 and p[2]<1.30+abs(p[0])*.29", "vest_selector=lambda p: .945<p[2]<1.415 and abs(p[0])<.19 and p[2]<1.365+abs(p[0])*.26")
replace("surface('Oxblood tailored brigandine',vest_selector,M['leather'],.020)","surface('Fitted articulated leather sword vest',vest_selector,M['leather'],.024)")

start=source.index('for strand in range(3):')
end=source.index('# An arming sword is built around',start)
source=source[:start]+r'''
# Shoulder-to-waist flowing locks, with tapered volume and subtle secondary hair motion.
for strand in range(16):
    u=(strand-7.5)/7.5;points=[];radii=[];weights=[]
    for j in range(30):
        t=j/29
        x=u*(.067+.050*math.sin(t*math.pi))+.009*math.sin(t*math.tau*1.7+strand*.58)*t
        y=.024+.112*math.sin(min(1,t*2.5)*math.pi*.5)+.021*t
        z=1.733-t*(.55+.055*math.cos(strand*.67))
        points.append((x,y,z));radii.append((.012+.003*math.cos(strand*.71))*(1-t*.80))
        head=max(.12,1-t*1.8);weights.append({'head':head,'hair':1-head})
    tube('Long tapered auburn lock '+str(strand),points,radii,M['hair'],'hair',10,weights)
    if strand%3==0:
        seam('Fine auburn lock highlight '+str(strand),[(x-.001,y-.004,z) for x,y,z in points],M['hairlight'],'hair',.0007)
for sign in [-1,1]:
    points=[(sign*.047,-.036,1.744),(sign*.071,-.091,1.692),(sign*.080,-.063,1.602),(sign*.082,.003,1.505),(sign*.084,.038,1.443)]
    tube('Face framing swept lock '+str(sign),points,[.011,.013,.010,.008,.002],M['hair'],'head',10)

# A shaped baldric, waist belt and visible working fasteners support the fitted vest.
strap=[]
for z,x,y in [(1.397,-.102,-.116),(1.33,-.072,-.164),(1.255,-.038,-.181),(1.18,.002,-.147),(1.09,.044,-.137),(1.005,.084,-.131)]:
    strap.extend([(x-.013,y-.005,z),(x+.013,y-.005,z)])
geom('Working leather sword baldric',strap,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(5)],M['boots'],bone='spine03',sub=1)
for z,y in [(1.30,-.181),(1.20,-.156),(1.09,-.140)]:
    cube('Leather vest fastening',(0,y,z),(.046,.010,.018),M['boots'],'spine03',.002)
    cube('Worked brass vest clasp',(0,y-.007,z),(.020,.004,.014),M['brass'],'spine03',.001)
loft('Defined swordswoman waist cinch',[(.986,.160,.104,0,.005),(1.003,.155,.103,0,.005)],M['boots'],'root')

'''+source[end:]
replace("SOURCE/'karen-human-v3.blend'","ROOT/'assets/characters/karen-swordswoman-v4.blend'")
replace("'karen-human-v3.glb'","'karen-swordswoman-v4.glb'")
replace("'karen-human-v3.png'","'karen-swordswoman-v4.png'")
(ROOT/'assets/characters').mkdir(parents=True,exist_ok=True)
exec(compile(source,str(original),'exec'),{'__file__':str(original),'__name__':'__main__'})
manifest_path=ROOT/'apps/web/public/models/characters/manifest.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['characters']['karen'].update(file='karen-swordswoman-v4.glb',source='karen-swordswoman-v4.blend',revision='swordswoman-v4',refinementScript='scripts/polish-karen.py')
manifest['version']=8
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print('KAREN_SWORDSWOMAN_REBUILD_COMPLETE',flush=True)
