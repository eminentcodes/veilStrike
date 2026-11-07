"""Render original UI audio: tactile clicks, soft glass hovers, and an Ember wheel.

python scripts/build-ui-audio.py
No downloads or dependencies. Wheel ticks follow the UI's 1.9s cubic-bezier
(.14, .7, .18, 1) animation and its eight possible final rotations.
"""
from array import array
from pathlib import Path
import json
import math
import random
import wave

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/web/public/audio'
SR = 44100
SPIN_SECONDS = 1.9


def tone(dest, start, duration, frequency, gain, decay, attack=.0015):
    offset = round(start * SR)
    for i in range(min(round(duration * SR), len(dest) - offset)):
        t = i / SR
        envelope = min(1., t / attack) * math.exp(-t * decay)
        dest[offset + i] += math.sin(math.tau * frequency * t) * envelope * gain


def noise(dest, start, duration, gain, decay, seed, cutoff=1600):
    rng = random.Random(seed)
    state = 0.
    blend = 1. - math.exp(-math.tau * cutoff / SR)
    offset = round(start * SR)
    for i in range(min(round(duration * SR), len(dest) - offset)):
        t = i / SR
        state += (rng.uniform(-1, 1) - state) * blend
        dest[offset + i] += state * gain * min(1., t / .001) * math.exp(-t * decay)


def write(name, values, peak, room=.1):
    # A quiet, asymmetric room tail gives short cues depth without a long wash.
    channels = []
    for delays in (((.013, .55), (.031, .3), (.067, .16)),
                   ((.019, .55), (.043, .3), (.079, .16))):
        channel = values.copy()
        for seconds, amount in delays:
            offset = round(seconds * SR)
            for i in range(offset, len(channel)):
                channel[i] += values[i - offset] * amount * room
        channels.append(channel)
    highest = max(abs(v) for channel in channels for v in channel)
    scale = peak / max(.00001, highest)
    pcm = array('h')
    fade_frames = round(.018 * SR)
    for i in range(len(values)):
        edge = min(1., i / 64, (len(values) - 1 - i) / fade_frames)
        for channel in channels:
            pcm.append(round(max(-.98, min(.98, channel[i] * scale * edge)) * 32767))
    filename = name + '.wav'
    with wave.open(str(OUT / filename), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(pcm.tobytes())
    return filename


def hover(variant):
    values = [0.] * round(.19 * SR)
    detune = (variant - 2) * 8
    tone(values, 0, .15, 1174.66 + detune, .12, 36, .003)
    tone(values, .004, .14, 1760 + detune, .035, 45, .003)
    tone(values, 0, .09, 293.66, .055, 65)
    noise(values, 0, .035, .04, 150, 440 + variant, 2400)
    return write(f'ui-hover-{variant}', values, .28, .13)


def click(variant):
    values = [0.] * round(.15 * SR)
    # A tight mechanical snap, cushioned bottom, and a dry release. No bell tail.
    noise(values, 0, .032, .62, 175, 881 + variant, 6200)
    tone(values, 0, .065, 112 + variant * 4, .28, 90, .001)
    tone(values, .001, .055, 780 + variant * 19, .035, 105, .0008)
    noise(values, .018, .025, .20, 195, 191 + variant, 3600)
    tone(values, .018, .04, 245, .07, 125, .001)
    return write(f'ui-click-{variant}', values, .70, .045)


def bezier(t, a, b):
    return 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3


def wheel(index):
    values = [0.] * round(SPIN_SECONDS * SR)
    tone(values, 0, .3, 110, .22, 14)
    noise(values, 0, .12, .18, 34, 631, 1200)
    # Soft rising air and a low rotating mechanism beneath the individual teeth.
    rng = random.Random(77)
    low = 0.
    for i in range(len(values)):
        t = i / SR
        p = t / SPIN_SECONDS
        low += (rng.uniform(-1, 1) - low) * .05
        envelope = math.sin(math.pi * p) ** .6
        values[i] += low * .12 * envelope * (1 - p) ** .6
        values[i] += math.sin(math.tau * (68 * t + 24 * t * t)) * .025 * envelope
    rotation = 1800 - (index * 45 + 22.5)
    # Solve the CSS curve for each sector crossing, then render its ratchet tick.
    for tooth in range(1, math.floor(rotation / 45) + 1):
        progress = tooth * 45 / rotation
        lower, upper = 0., 1.
        for _ in range(25):
            param = (lower + upper) / 2
            if bezier(param, .7, 1.) < progress:
                lower = param
            else:
                upper = param
        at = bezier((lower + upper) / 2, .14, .18) * SPIN_SECONDS
        strength = .12 + .08 * (at / SPIN_SECONDS)
        noise(values, at, .026, strength, 180, 510 + tooth, 3400)
        tone(values, at, .048, 740 + (tooth % 3) * 19, strength * .58, 95)
        tone(values, at, .041, 220, strength * .46, 110)
    tone(values, SPIN_SECONDS - .085, .085, 146.83, .20, 34)
    noise(values, SPIN_SECONDS - .085, .06, .12, 75, 442, 1800)
    return write(f'spin-wheel-{index}', values, .67, .055)


def reward(jackpot=False):
    duration = 1.65 if jackpot else 1.1
    values = [0.] * round(duration * SR)
    notes = [293.66, 369.99, 440., 587.33] if jackpot else [293.66, 440., 587.33]
    tone(values, 0, .4, 146.83, .13, 8)
    for i, note in enumerate(notes):
        start = .035 + i * .085
        tone(values, start, duration - start, note, .15, 4.5, .007)
        tone(values, start, duration - start, note * 2.002, .038, 8, .005)
        tone(values, start + .01, duration - start - .01, note * 3.01, .009, 12)
    noise(values, 0, .08, .06, 60, 17, 2600)
    if jackpot:
        tone(values, .5, 1.1, 1174.66, .035, 5, .025)
        tone(values, .64, .9, 1760, .015, 7, .025)
    return write('ui-jackpot' if jackpot else 'ui-reward', values, .68, .25)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = [hover(v) for v in range(1, 4)] + [click(v) for v in range(1, 4)]
    files += [wheel(i) for i in range(8)] + [reward(), reward(True)]
    manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
    manifest['samples'] = list(dict.fromkeys(manifest.get('samples', []) + files))
    manifest['revision'] = 'ui-premium-v7'
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'Generated {len(files)} original stereo UI cues; lobby and combat tracks preserved.')


if __name__ == '__main__':
    main()
