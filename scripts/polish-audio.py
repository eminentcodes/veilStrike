"""Original layered, 44.1kHz combat and interface sound pack; no network needed."""
from pathlib import Path
import math, random, wave, json
from array import array
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'apps/web/public/audio'; SR=44100
KINDS={'ui-hover':.045,'ui-click':.085,'weapon-swing':.22,'fist-swing':.16,'blade-hit':.30,'body-hit':.26,'heavy-impact':.62,'metal-clash':.39,'parry':.50,'dodge':.25,'bone':.85,'footstep-stone':.17,'footstep-earth':.15,'footstep-metal':.22,'round-start':1.05,'victory':2.2,'defeat':1.9,'draw':1.65}
def render(kind,variant):
    rng=random.Random(901+variant*67+sum(map(ord,kind))); duration=KINDS[kind]; values=[]; low=0.; phase=0.
    for i in range(round(duration*SR)):
        t=i/SR; p=t/duration; raw=rng.uniform(-1,1); low+=(raw-low)*.13; high=raw-low; attack=min(1,t/.002)
        if kind.startswith('ui-'):
            v=(low*.36+high*.13)*math.exp(-t*(150 if kind=='ui-hover' else 95))
            if kind=='ui-click':v+=math.sin(2*math.pi*(210+variant*12)*t)*math.exp(-t*100)*.14
        elif kind in ('weapon-swing','fist-swing','dodge'):
            env=math.sin(math.pi*p)**2; v=(high*.25+low*.52)*env
            if kind=='weapon-swing':v+=math.sin(2*math.pi*(1200-t*1800)*t)*env*.025
        elif kind in ('body-hit','blade-hit','heavy-impact','bone'):
            phase+=2*math.pi*(52+(145 if kind=='heavy-impact' else 210)*math.exp(-t*31))/SR
            v=math.sin(phase)*math.exp(-t*(9 if kind in ('heavy-impact','bone') else 18))*.58
            v+=low*.63*math.exp(-t*26)+high*.18*math.exp(-t*85)
            if kind=='blade-hit':v+=high*.26*math.exp(-t*34)
            if kind=='bone':v+=high*.18*max(0,math.sin(t*83))**8*math.exp(-t*7)
        elif kind in ('metal-clash','parry'):
            v=(high*.26+low*.47)*math.exp(-t*48)
            for f,g in [(735,.14),(1327,.09),(2183,.04)]:v+=math.sin(2*math.pi*(f+variant*17)*t)*math.exp(-t*(12 if kind=='metal-clash' else 8))*g
        elif kind.startswith('footstep'):
            v=low*.43*math.exp(-t*34)+high*.12*math.exp(-t*65)+math.sin(2*math.pi*78*t)*math.exp(-t*31)*.22
        else:
            notes={'victory':[(0,146.83),(.18,220),(.36,293.66),(.57,349.23),(.8,440)],'defeat':[(0,220),(.27,196),(.57,146.83)],'draw':[(0,164.81),(.34,220)],'round-start':[(0,73.42),(.19,110),(.38,146.83)]}[kind]
            v=low*.075*math.exp(-t*7)
            for at,f in notes:
                u=t-at
                if u>=0:v+=(math.sin(2*math.pi*f*u)+.21*math.sin(2*math.pi*f*2.01*u))*.15*min(1,u/.006)*math.exp(-u*3.2)
        values.append(v*attack*min(1,(duration-t)/.01))
    peak=max(map(abs,values)); gain=min(1.3,.79/max(.001,peak))
    pcm=array('h',(round(max(-.95,min(.95,v*gain))*32767) for v in values))
    path=OUT/f'{kind}-{variant}.wav'
    with wave.open(str(path),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes(pcm.tobytes())
    return path.name
manifest=json.loads((OUT/'manifest.json').read_text()); manifest['samples']=[render(k,v) for k in KINDS for v in range(1,4)];manifest['revision']='combat-v4'
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('54 layered effects: hover/click, cuts, punches, slams, bone eruption and result stings.')
