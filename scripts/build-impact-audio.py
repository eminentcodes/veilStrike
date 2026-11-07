"""Original impact pack: layered transients, body thuds, debris and low ground rumble."""
from pathlib import Path
from array import array
import json, math, random, wave
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/web/public/audio'
SR = 44100
lengths = {'punch-impact': .36, 'body-fall': .7, 'ground-slam': 1.45, 'equipment-drop': .72}
files = []
for kind, duration in lengths.items():
    for variant in range(1, 4):
        rng = random.Random(3321 + variant * 51 + sum(map(ord, kind)))
        low = mid = phase = 0.; values = []
        for i in range(round(SR * duration)):
            t = i / SR; raw = rng.uniform(-1, 1)
            low += (raw-low)*.018; mid += (raw-mid)*.21
            attack = min(1, t/.0018); tail = min(1, (duration-t)/.02)
            hz = (48 if kind == 'ground-slam' else 63) + (170 if kind == 'punch-impact' else 80)*math.exp(-t*45)
            phase += math.tau*hz/SR
            if kind == 'punch-impact':
                value = math.sin(phase)*.65*math.exp(-t*18)+mid*.95*math.exp(-t*35)+(raw-mid)*.24*math.exp(-t*120)
            elif kind == 'ground-slam':
                value = math.sin(phase)*.65*math.exp(-t*4.5)+low*1.6*math.exp(-t*2.6)+mid*.7*math.exp(-t*12)
                value += (raw-mid)*.2*max(0, math.sin(t*129))**12*math.exp(-t*3)
            elif kind == 'body-fall':
                value = math.sin(phase)*.45*math.exp(-t*11)+mid*.8*math.exp(-t*15)+low*.8*math.exp(-t*5)
            else:
                value = mid*.5*math.exp(-t*40)+(raw-mid)*.25*math.exp(-t*50)
                for freq, gain in [(621,.12),(1027,.1),(1843,.05)]:
                    value += math.sin(math.tau*(freq+variant*13)*t)*gain*math.exp(-t*7)
            values.append(value*attack*tail)
        peak=max(map(abs, values)); gain=.88/max(.001,peak)
        pcm=array('h',(round(math.tanh(v*gain)*32767) for v in values))
        name=f'{kind}-{variant}.wav'; files.append(name)
        with wave.open(str(OUT/name),'wb') as f:
            f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes(pcm.tobytes())
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
manifest['samples']=[f for f in manifest['samples'] if f not in files]+files
manifest['revision']='combat-impact-v5'
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print('Generated 12 original punch, ground-slam, body-fall and equipment-drop samples.')
