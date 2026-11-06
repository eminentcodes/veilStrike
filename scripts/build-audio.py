"""Build Veilstrike's original sound pack and pre-rendered neural announcer cues.

python scripts/build-audio.py [--voices-only | --sounds-only]
Voice generation uses edge-tts installed in .cache/audio-tools. Playback is offline.
"""
import asyncio
import json
import math
import random
import sys
import wave
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/web/public/audio'
SR = 22050
random.seed(57293)
VOICES = {
    'round-1': 'Round one.', 'round-2': 'Round two.', 'round-3': 'Final round.',
    'round-4': 'The battle continues.', 'round-5': 'Last round.', 'fight': 'Fight!',
    'victory': 'Victory.', 'defeat': 'Defeat.', 'draw': 'A draw.',
    'parry': 'Perfect parry.', 'guard-break': 'Guard broken.', 'finish': 'Finish it.',
    'ten-seconds': 'Ten seconds remain.', 'welcome': 'Welcome to Veilstrike.',
    'karen': 'Karen.', 'taren': 'Taren.', 'nomet': 'Nomet.', 'veyra': 'Veyra.',
    'mawren': 'Mawren.', 'neris': 'Neris.', 'vesper': 'Vesper.', 'rhoven': 'Rhoven.',
    'seyra': 'Seyra.', 'varkesh': 'Varkesh.',
    'ultimate-karen': 'Steel resolve!', 'ultimate-taren': 'Hold the line!',
    'ultimate-nomet': 'Last burial!', 'ultimate-veyra': 'Captive steel!',
    'ultimate-mawren': 'Rune collapse!', 'ultimate-neris': 'Smoke execution!',
    'ultimate-vesper': 'Final dosage!', 'ultimate-rhoven': 'Soulstorm!',
    'ultimate-seyra': 'Two as one!', 'ultimate-varkesh': 'Furnace rupture!',
}

def wav(name, values):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / (name + '.wav')
    path.parent.mkdir(parents=True, exist_ok=True)
    peak = max((abs(v) for v in values), default=1)
    gain = min(1, .86 / max(.001, peak))
    pcm = array('h', (round(max(-.98, min(.98, v * gain)) * 32767) for v in values))
    with wave.open(str(path), 'wb') as file:
        file.setnchannels(1); file.setsampwidth(2); file.setframerate(SR)
        file.writeframes(pcm.tobytes())

def noise(duration, cutoff=900):
    values = []
    state = 0
    blend = 1 - math.exp(-2 * math.pi * cutoff / SR)
    for _ in range(round(duration * SR)):
        state += (random.uniform(-1, 1) - state) * blend
        values.append(state)
    return values

def tone_into(dest, start, duration, freq, gain, kind='drum'):
    begin = round(start * SR); length = round(duration * SR)
    phase = 0
    for i in range(min(length, len(dest) - begin)):
        t = i / SR; p = i / max(1, length)
        if kind == 'drum':
            f = freq * math.exp(-t * 15) + 42
            phase += f * 2 * math.pi / SR
            v = (math.sin(phase) + .12 * math.sin(phase * 2.27)) * math.exp(-t * 9)
        elif kind == 'bow':
            phase = 2 * math.pi * freq * t + .006 * math.sin(t * 11)
            env = math.sin(math.pi * p) ** .8
            v = env * (math.sin(phase) + .24 * math.sin(phase * 2) + .09 * math.sin(phase * 3) + .04 * math.sin(phase * 5))
        elif kind == 'bell':
            phase = 2 * math.pi * freq * t
            v = (math.sin(phase) + .35 * math.sin(phase * 2.76) + .13 * math.sin(phase * 4.07)) * math.exp(-t * 3)
        else:
            phase = 2 * math.pi * freq * t
            v = math.sin(phase) * math.sin(math.pi * p) ** 1.5
        dest[begin + i] += v * gain

def effect(kind, variant):
    rng = random.Random(1000 + variant * 101 + sum(map(ord, kind)))
    duration = {'weapon-swing': .38, 'body-hit': .24, 'heavy-impact': .63, 'metal-clash': .65,
                'parry': .85, 'dodge': .34, 'footstep-stone': .18, 'footstep-earth': .2,
                'footstep-metal': .3, 'fist-swing': .28, 'chain': .8, 'bone': .72,
                'fire': 1.15, 'rune': .95, 'spirit': 1.1, 'poison': .48,
                'ui-click': .065, 'round-start': 1.1}.get(kind, .5)
    cutoff = 320 if kind in ['body-hit', 'heavy-impact', 'fire'] else 2800
    raw = noise(duration, cutoff); values = [0.] * len(raw)
    for i, value in enumerate(raw):
        t = i / SR; p = i / len(raw)
        if kind in ['weapon-swing', 'fist-swing', 'dodge']:
            env = math.sin(p * math.pi) ** 2.8
            values[i] = value * env * (.75 if kind == 'weapon-swing' else .6)
        elif kind in ['body-hit', 'heavy-impact', 'footstep-stone', 'footstep-earth', 'footstep-metal', 'bone']:
            values[i] = value * math.exp(-t * (18 if kind.startswith('footstep') else 11)) * .9
        elif kind in ['metal-clash', 'parry', 'chain']:
            values[i] = value * math.exp(-t * 24) * .45
            for ratio, amount in [(1, .27), (1.501, .18), (2.756, .13), (4.072, .06)]:
                values[i] += math.sin(2 * math.pi * (480 + variant * 23) * ratio * t) * math.exp(-t * (4 + ratio)) * amount
            if kind == 'chain': values[i] *= .55 + .45 * math.sin(t * 51) ** 6
        elif kind == 'fire': values[i] = value * math.sin(math.pi * p) ** .5 * .8
        elif kind in ['spirit', 'rune']:
            values[i] = value * math.sin(math.pi * p) * .16
        elif kind == 'poison': values[i] = value * math.exp(-t * 10) * .5
        else: values[i] = value * math.exp(-t * 50) * .6
    if kind in ['body-hit', 'heavy-impact', 'bone']:
        tone_into(values, 0, duration, 120 if kind == 'heavy-impact' else 185, .65)
    if kind.startswith('footstep'): tone_into(values, 0, min(.16, duration), 75, .4)
    if kind in ['spirit', 'rune', 'round-start']:
        for f, g in [(147, .24), (220, .15), (294, .10)]: tone_into(values, 0, duration, f, g, 'bow')
    if kind == 'fire': tone_into(values, 0, duration, 72, .45)
    if kind == 'ui-click': tone_into(values, 0, duration, 410 + variant * 30, .18, 'bell')
    return values

def music(mode):
    duration = 32
    values = [v * .035 for v in noise(duration, 180)]
    roots = [55., 41.2034, 48.9994, 36.7081]
    for bar in range(12):
        start = bar * (8 / 3)
        root = roots[(bar // 3) % 4]
        for f, g in [(root, .09), (root * 2, .07), (root * 2.378414, .032), (root * 2.996614, .035)]:
            tone_into(values, start, 8 / 3, f, g, 'bow')
        if mode == 'battle':
            for step, g, freq in [(0, .5, 110), (2, .32, 85), (3.5, .19, 135)]:
                tone_into(values, start + step * 2 / 3, .48, freq, g, 'drum')
            if bar % 3 == 2:
                tone_into(values, start + 2, .35, 170, .18, 'drum')
        elif bar % 4 == 0:
            tone_into(values, start + .25, 2, root * 8, .065, 'bell')
    # Short symmetric edge fades prevent clicks at the loop boundary.
    for i in range(SR // 12):
        gain = i / (SR // 12)
        values[i] *= gain; values[-1 - i] *= gain
    return values

def ambience(kind):
    values = noise(24, 250 if kind == 'forge' else 650)
    for i in range(len(values)):
        t = i / SR
        values[i] *= .3 * (.5 + .5 * math.sin(2 * math.pi * t / 24) ** 2)
        if kind == 'grove': values[i] += .07 * math.sin(2 * math.pi * 330 * t) * math.sin(t * 2.3) ** 18
        elif kind == 'forge': values[i] += .06 * math.sin(2 * math.pi * 45 * t)
    for i in range(SR // 5):
        values[i] *= i / (SR // 5); values[-1 - i] *= i / (SR // 5)
    return values

async def build_voices():
    sys.path.insert(0, str(ROOT / '.cache/audio-tools'))
    import edge_tts
    gate = asyncio.Semaphore(3)
    async def one(key, text):
        path = OUT / 'voice' / (key + '.mp3')
        if path.exists() and path.stat().st_size > 500: return
        async with gate:
            for attempt in range(3):
                try:
                    task = edge_tts.Communicate(text, 'en-US-GuyNeural', rate='-8%', pitch='-12Hz', connect_timeout=12, receive_timeout=30)
                    await task.save(str(path))
                    print('Voice ready:', key, flush=True); return
                except Exception as error:
                    if attempt == 2: print('Voice pending:', key, str(error), flush=True)
                    else: await asyncio.sleep(1 + attempt)
    (OUT / 'voice').mkdir(parents=True, exist_ok=True)
    await asyncio.gather(*(one(key, text) for key, text in VOICES.items()))

def manifest():
    samples = [p.name for p in sorted(OUT.glob('*.wav')) if not p.name.startswith(('music-', 'ambience-'))]
    voices = {k: 'voice/' + k + '.mp3' for k in VOICES if (OUT / 'voice' / (k + '.mp3')).exists() and (OUT / 'voice' / (k + '.mp3')).stat().st_size > 500}
    data = {'samples': samples, 'music': {'menu': 'music-lobby.wav', 'fight': 'music-battle.wav'},
            'ambience': {key: 'ambience-' + key + '.wav' for key in ['wind', 'forge', 'grove']}, 'voices': voices}
    (OUT / 'manifest.json').write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    (OUT / 'voice/cues.json').write_text(json.dumps(VOICES, indent=2) + '\n', encoding='utf-8')
    print('Pack ready:', len(samples), 'sound effects,', len(voices), 'voiced cues.', flush=True)

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    if '--voices-only' not in sys.argv:
        for kind in ['weapon-swing', 'body-hit', 'heavy-impact', 'metal-clash', 'parry', 'dodge', 'footstep-stone', 'footstep-earth', 'footstep-metal', 'fist-swing', 'chain', 'bone', 'fire', 'rune', 'spirit', 'poison', 'ui-click', 'round-start']:
            for variant in range(1, 4): wav(kind + '-' + str(variant), effect(kind, variant))
        for key in ['lobby', 'battle']: wav('music-' + key, music(key))
        for key in ['wind', 'forge', 'grove']: wav('ambience-' + key, ambience(key))
        print('Original sounds and music ready.', flush=True)
    if '--sounds-only' not in sys.argv: asyncio.run(build_voices())
    (OUT / 'voice').mkdir(parents=True, exist_ok=True)
    manifest()
