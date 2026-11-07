"""Build combat cues from CC0 Kenney Foley plus original impact/music layers.

Requires numpy and pedalboard (python -m pip install --target .cache/audio-tools
numpy pedalboard). Source OGGs and CC0 license live in assets/audio/sources/kenney-rpg.
This build preserves lobby music and the approved hover/interface sounds.
"""
from pathlib import Path
import json
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.cache/audio-tools'))
import numpy as np
from pedalboard import Pedalboard, Compressor, HighpassFilter, LowpassFilter, Reverb, Limiter
from pedalboard.io import AudioFile

SR = 44100
SOURCE = ROOT / 'assets/audio/sources/kenney-rpg'
OUT = ROOT / 'apps/web/public/audio'
FILES = {}
SOURCES_USED = {}


def source(name, speed=1.):
    if name not in FILES:
        with AudioFile(str(SOURCE / (name + '.ogg'))).resampled_to(SR) as audio:
            values = audio.read(audio.frames).mean(axis=0)
        audible = np.flatnonzero(np.abs(values) > .003)
        if len(audible): values = values[max(0, audible[0] - 88):audible[-1] + 442]
        FILES[name] = values / max(.001, float(np.abs(values).max())) * .72
    values = FILES[name]
    if speed != 1:
        values = np.interp(np.arange(0, len(values) - 1, speed), np.arange(len(values)), values).astype(np.float32)
    return values


def layer(dest, values, gain=1., at=0.):
    begin = round(at * SR)
    count = min(len(values), len(dest) - begin)
    if count > 0: dest[begin:begin + count] += values[:count] * gain


def thump(duration, hz=110, decay=20., gain=.4):
    t = np.arange(round(duration * SR)) / SR
    phase = 2 * np.pi * (48 * t + (hz - 48) * (1 - np.exp(-t * 25)) / 25)
    return (np.sin(phase) * np.exp(-t * decay) * np.minimum(1, t / .0015) * gain).astype(np.float32)


def grit(duration, seed, gain=.05, decay=10.):
    t = np.arange(round(duration * SR)) / SR
    values = np.random.default_rng(seed).uniform(-1, 1, len(t)).astype(np.float32)
    return values * np.exp(-t * decay) * np.minimum(1, t / .002) * gain


def note(dest, at, hz, gain=.1, decay=5., attack=.005):
    offset = round(at * SR)
    t = np.arange(len(dest) - offset) / SR
    envelope = np.minimum(1., t / attack) * np.exp(-t * decay)
    values = (np.sin(2 * np.pi * hz * t) + .16 * np.sin(2 * np.pi * hz * 2.003 * t)) * envelope * gain
    layer(dest, values, at=at)


def finish(kind, variant, values, sources, movement=False, result=False):
    stereo = np.stack([values, values]).astype(np.float32)
    board = Pedalboard([
        HighpassFilter(cutoff_frequency_hz=36),
        Compressor(threshold_db=-18, ratio=2.6, attack_ms=3, release_ms=65),
        Reverb(room_size=.32 if result else .18, damping=.65,
               wet_level=.18 if result else .055, dry_level=.94, width=.8),
        Limiter(threshold_db=-1.5, release_ms=50),
    ])
    stereo = board(stereo, SR)
    peak = float(np.abs(stereo).max())
    stereo *= (.66 if movement else .78 if result else .84) / max(.001, peak)
    fade = min(round(.025 * SR), stereo.shape[1] // 4)
    stereo[:, :64] *= np.linspace(0, 1, 64)
    stereo[:, -fade:] *= np.linspace(1, 0, fade)
    filename = f'{kind}-{variant}.wav'
    pcm = (np.clip(stereo.T, -.98, .98) * 32767).astype('<i2')
    with wave.open(str(OUT / filename), 'wb') as wav:
        wav.setnchannels(2); wav.setsampwidth(2); wav.setframerate(SR)
        wav.writeframes(pcm.tobytes())
    SOURCES_USED[filename] = sources
    return filename


def effect(kind, variant):
    durations = {'weapon-swing':.35,'fist-swing':.25,'punch-impact':.42,'punch-heavy':.58,
        'blade-hit':.48,'body-hit':.38,'heavy-impact':.7,'body-block':.35,'shield-block':.52,
        'metal-clash':.55,'armor-hit':.4,'parry':.7,'guard-break':.82,'body-fall':.9,
        'body-collapse':.6,'equipment-drop':.85,'ground-slam':1.5,'bone':.8,
        'dodge':.36,'jump':.3,'getup':.5,'grapple-grab':.4,'throw-swing':.52,
        'blade-toss':.4,'shield-charge':.62,'ability-charge':.65,'smoke':.65,
        'defeat-impact':.7}
    movement = kind in ['dodge','jump','getup','fist-swing','weapon-swing','throw-swing','grapple-grab'] or kind.startswith('footstep-')
    duration = .32 if kind.startswith('footstep-') else .47 if kind.startswith('land-') else durations[kind]
    values = np.zeros(round(duration * SR), dtype=np.float32)
    used = []
    def add(name, gain=1., speed=1., at=0., cutoff=None):
        sample = source(name, speed)
        if cutoff: sample = LowpassFilter(cutoff_frequency_hz=cutoff)(sample, SR)
        layer(values, sample, gain, at); used.append(name + '.ogg')
    cloth = 'cloth_' + str(variant)
    metal = 'metal_pot_' + str(variant)
    foot = 'footstep_' + str(variant - 1)
    if kind == 'weapon-swing':
        add('knife_slice' if variant == 1 else 'knife_slice_2', .72, 1.2)
        add(cloth, .15, 1.4)
    elif kind == 'fist-swing':
        add(cloth, .6, 1.7); layer(values, grit(duration, 501 + variant, .06, 12))
    elif kind in ['punch-impact','punch-heavy','body-hit','heavy-impact','body-block']:
        heavy = kind in ['punch-heavy','heavy-impact']
        add('chop', .42 if heavy else .36, .84 if heavy else 1.1)
        add('drop_leather', .36, .84 if heavy else 1.2, cutoff=1800)
        layer(values, thump(duration, 135 if heavy else 190, 13 if heavy else 25, .5 if heavy else .28))
    elif kind == 'blade-hit':
        add('chop', .42, 1.14); add('knife_slice_2', .2, 1.5); add(metal, .07, 1.4)
        layer(values, thump(duration, 155, 25, .28))
    elif kind in ['shield-block','metal-clash','armor-hit','parry','guard-break','equipment-drop','shield-charge']:
        add(metal, .58 if kind != 'armor-hit' else .28, 1.65 if kind == 'parry' else .85)
        add('metal_latch', .25, 1.2)
        if kind in ['shield-block','guard-break','shield-charge']:
            add('door_close_' + str(variant), .17, 1.1, cutoff=1200)
            layer(values, thump(duration, 160, 18, .32))
        if kind == 'equipment-drop': add('metal_click', .3, 1., at=.18)
        if kind == 'parry': note(values, .012, 1760, .05, 9)
    elif kind in ['body-fall','body-collapse','ground-slam','defeat-impact','bone']:
        add('drop_leather', .46, .75 if kind == 'ground-slam' else .95)
        add('chop', .23, .78, at=.015)
        add(foot, .22, .78, at=.035)
        add(cloth, .13, .9, at=.06)
        layer(values, thump(duration, 112, 4.5 if kind == 'ground-slam' else 10, .48 if kind == 'ground-slam' else .33))
        if kind == 'ground-slam': layer(values, grit(duration, 919 + variant, .12, 3.5), at=.05)
        if kind == 'bone':
            for at in [.06,.115,.18]: add('chop', .17, 1.7, at=at)
    elif kind.startswith(('footstep-','land-')):
        surface = kind.split('-', 1)[1]
        add(foot, .8, .88 if kind.startswith('land-') else 1.15, cutoff=1700 if surface in ['earth','snow'] else None)
        if surface == 'metal': add('metal_click', .12, .9)
        if surface in ['gravel','snow']:
            layer(values, grit(duration, 391 + variant, .08 if surface == 'gravel' else .04, 13))
            add(cloth, .16, 1.5)
        if kind.startswith('land-'): layer(values, thump(duration, 100, 22, .22))
    elif kind in ['dodge','jump','getup','grapple-grab','throw-swing','smoke']:
        add(cloth, .62, 1.35 if kind != 'getup' else .9)
        add('handle_small_leather', .22, 1.3)
        if kind in ['jump','grapple-grab']: add(foot, .12, 1.3)
        if kind == 'throw-swing': layer(values, grit(duration, 42 + variant, .09, 8))
    elif kind == 'blade-toss':
        add('draw_knife_' + str(variant), .55, 1.35); add('knife_slice', .42, 1.4, at=.035)
    elif kind == 'ability-charge':
        add('cloth_belt', .18, .85); note(values, .01, 146.83, .11, 5, .04); note(values, .03, 293.66, .05, 7, .05)
    return finish(kind, variant, values, sorted(set(used)), movement)


def result(kind, variant):
    duration = 1.9 if kind in ['victory','defeat','draw'] else .95
    values = np.zeros(round(duration * SR), dtype=np.float32)
    if kind in ['victory','round-win']: notes = [146.83,220.,293.66,369.99,587.33]
    elif kind in ['defeat','round-loss']: notes = [293.66,261.63,220.,146.83]
    else: notes = [146.83,220.,293.66]
    layer(values, thump(duration, 95, 5, .19))
    for i, hz in enumerate(notes): note(values, .04 + i * (.13 if duration > 1 else .08), hz, .1, 3.2 if duration > 1 else 7)
    if kind == 'round-start':
        layer(values, source('metal_latch'), .12)
        note(values, .08, 73.42, .13, 5)
    return finish(kind, variant, values, ['metal_latch.ogg'] if kind == 'round-start' else [], result=True)


def main():
    if not (SOURCE / 'LICENSE.txt').is_file(): raise SystemExit('Missing CC0 source pack in assets/audio/sources/kenney-rpg.')
    OUT.mkdir(parents=True, exist_ok=True)
    kinds = ['weapon-swing','fist-swing','punch-impact','punch-heavy','blade-hit','body-hit','heavy-impact',
        'body-block','shield-block','metal-clash','armor-hit','parry','guard-break','body-fall','body-collapse',
        'equipment-drop','ground-slam','bone','dodge','jump','getup','grapple-grab','throw-swing',
        'blade-toss','shield-charge','ability-charge','smoke','defeat-impact']
    kinds += [prefix + surface for prefix in ['footstep-','land-'] for surface in ['stone','earth','metal','snow','gravel']]
    files = [effect(kind, v) for kind in kinds for v in range(1,4)]
    files += [result(kind, v) for kind in ['round-start','round-win','round-loss','round-draw','victory','defeat','draw'] for v in range(1,4)]
    manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
    manifest['samples'] = sorted(p.name for p in OUT.glob('*.wav') if not p.name.startswith(('music-', 'ambience-')))
    manifest['revision'] = 'combat-rich-v8'
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    credits = {'author':'Kenney','pack':'RPG Audio','license':'CC0-1.0',
        'source':'https://github.com/Boyquotes/kenney-rpg-audio-for-godot/tree/22eb79b',
        'homepage':'https://kenney.nl/assets/rpg-audio','processing':'Spotify Pedalboard 0.9.26 plus original synthesis',
        'files':SOURCES_USED}
    (OUT / 'combat-sources.json').write_text(json.dumps(credits, indent=2) + '\n', encoding='utf-8')
    license_dir = OUT / 'licenses'; license_dir.mkdir(exist_ok=True)
    (license_dir / 'kenney-rpg-CC0.txt').write_bytes((SOURCE / 'LICENSE.txt').read_bytes())
    print(f'Built {len(files)} layered combat cues with Pedalboard; lobby and interface sounds preserved.')


if __name__ == '__main__': main()
