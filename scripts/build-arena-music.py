"""Render Veilstrike's original 25-second rhythmic arena opening."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.cache/audio-tools'))
import numpy as np
from pedalboard import Pedalboard, HighpassFilter, LowpassFilter, Compressor, Reverb, Limiter
from pedalboard.io import AudioFile

SR, SECONDS, BPM = 44100, 25, 120
FADE_IN, FADE_OUT = .8, 3
out = ROOT / 'apps/web/public/audio'
temp = ROOT / '.cache/arena-tension.wav'
target = out / 'music-arena-tension.ogg'
t = np.arange(SR * SECONDS, dtype=np.float32) / SR
score = np.zeros((2, len(t)), dtype=np.float32)
drums = np.zeros_like(score)
rng = np.random.default_rng(70319)
beat = 60 / BPM


def age(seconds):
    return np.arange(int(seconds * SR), dtype=np.float32) / SR


def add(bus, sound, at, level=1, pan=0):
    """Bound each one-shot and reflection to the 25-second score."""
    start = int(at * SR)
    count = min(len(sound), bus.shape[1] - start)
    if start < 0 or count <= 0:
        return
    bus[0, start:start + count] += sound[:count] * level * (1 - max(pan, 0) * .5)
    bus[1, start:start + count] += sound[:count] * level * (1 + min(pan, 0) * .5)


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


# A steady 120 BPM beat with syncopated kicks and a restrained build every four bars.
a = age(.48)
kick = (np.sin(2 * np.pi * (48 * a + 52 * (1 - np.exp(-a * 30)) / 30))
        * np.minimum(a / .003, 1) * np.exp(-a * 11)
        + rng.normal(0, .12, len(a)) * np.exp(-a * 160)).astype(np.float32)
a = age(.24)
snare_noise = Pedalboard([HighpassFilter(cutoff_frequency_hz=1100), LowpassFilter(cutoff_frequency_hz=6500)])(
    rng.normal(0, 1, len(a)).astype(np.float32), SR)
snare = (snare_noise * .3 + np.sin(2 * np.pi * 185 * a) * .3) * np.minimum(a / .002, 1) * np.exp(-a * 20)
a = age(.1)
hat = Pedalboard([HighpassFilter(cutoff_frequency_hz=6800)])(rng.normal(0, 1, len(a)).astype(np.float32), SR)
hat *= np.minimum(a / .001, 1) * np.exp(-a * 65)
a = age(.46)
tom = np.sin(2 * np.pi * (92 * a + 25 * (1 - np.exp(-a * 15)) / 15)) * np.minimum(a / .004, 1) * np.exp(-a * 12)
for bar, at in enumerate(np.arange(0, SECONDS - 2, beat * 4)):
    energy = .72 + .28 * min(at / 12, 1)
    for step in [0, 1.5, 2, 3.5]:
        add(drums, kick, at + step * beat, .28 * energy * (1 if step % 1 == 0 else .72))
    for step in [1, 3]:
        add(drums, snare, at + step * beat, .23 * energy, -.12)
    for step in range(8):
        add(drums, hat, at + step * beat / 2, (.035 if step % 2 else .055) * energy, .22 if step % 2 else -.22)
    if bar % 4 == 3:
        for step in [3.25, 3.5, 3.75]:
            add(drums, tom, at + step * beat, .07 * energy, (step - 3.5) * 1.5)

# D minor pedal bass and wide bowed upper harmonics leave space for speech.
for voice, freq in enumerate([146.832, 174.614, 220, 293.665]):
    envelope = (.72 + .28 * np.sin(t * (.17 + voice * .015) + voice)) * (.6 + .4 * np.minimum(t / 15, 1))
    for channel in range(2):
        detune = 1 + (channel * 2 - 1) * (.0007 + voice * .00014)
        for harmonic in range(1, 5):
            score[channel] += np.sin(2 * np.pi * freq * harmonic * detune * t + voice * .4) * envelope * (.012 / harmonic ** 1.8)

a = age(.3)
for i, at in enumerate(np.arange(0, SECONDS - 2, beat / 2)):
    freq = hz([38, 38, 38, 45, 38, 38, 41, 37][i % 8])
    bass = (np.sin(2 * np.pi * freq * a) + .22 * np.sin(4 * np.pi * freq * a)) * np.minimum(a / .008, 1) * np.exp(-a * 12)
    add(score, bass, at, .065 if i % 2 == 0 else .048)

# Bright D harmonic-minor arpeggios introduce a high-register unresolved pulse.
# The C-sharp leading tone and occasional E-flat keep the melody tense.
motif = [74, 81, 77, 85, 74, 82, 81, 73]
a = age(.7)
for i, at in enumerate(np.arange(1, SECONDS - 2, beat / 2)):
    note = motif[i % len(motif)] + (12 if 12 <= at < 20 and i % 8 == 7 else 0)
    freq = hz(note)
    envelope = np.minimum(a / .006, 1) * np.exp(-a * 8)
    pluck = (np.sin(2 * np.pi * freq * a) + .24 * np.sin(4 * np.pi * freq * a) + .1 * np.sin(6 * np.pi * freq * a)) * envelope
    level = (.021 if i % 4 else .032) * (.7 + .3 * min(at / 12, 1))
    pan = -.45 if i % 2 else .45
    add(score, pluck, at, level, pan)
    add(score, pluck, at + beat * .75, level * .28, -pan)
    add(score, pluck, at + beat * 1.5, level * .12, pan)

# High string tremolo swells across the central eight bars, without a harsh riser.
for channel in range(2):
    swell = np.clip((t - 5) / 12, 0, 1) * (.6 + .4 * np.sin(2 * np.pi * 4 * t) ** 2)
    score[channel] += (np.sin(2 * np.pi * hz(86) * (1 + channel * .0005) * t)
                       + .22 * np.sin(2 * np.pi * hz(87) * t)) * swell * .008
air = Pedalboard([LowpassFilter(cutoff_frequency_hz=1600)])(rng.normal(0, .004, score.shape).astype(np.float32), SR)
score += air * (.5 + .5 * np.sin(t * .24) ** 2)
score = Pedalboard([HighpassFilter(cutoff_frequency_hz=35), LowpassFilter(cutoff_frequency_hz=7500),
                   Reverb(room_size=.72, damping=.58, wet_level=.18, dry_level=.92, width=1)])(score, SR)
drums = Pedalboard([HighpassFilter(cutoff_frequency_hz=32),
                   Compressor(threshold_db=-17, ratio=2.5, attack_ms=14, release_ms=100)])(drums, SR)
# A little beat-driven reduction of the harmonic bed keeps the kick defined.
pump = 1 - .2 * np.exp(-np.mod(t, beat) * 18)
score = score * pump + drums
score = Pedalboard([Compressor(threshold_db=-18, ratio=1.8, attack_ms=25, release_ms=130),
                   Limiter(threshold_db=-2, release_ms=100)])(score, SR)
score *= min(3, .68 / max(float(np.max(np.abs(score))), .001))
score *= np.minimum(t / FADE_IN, 1) * np.minimum((SECONDS - t) / FADE_OUT, 1)
edge = int(.025 * SR)
score[:, -edge:] *= np.linspace(1, 0, edge)
temp.parent.mkdir(parents=True, exist_ok=True)
out.mkdir(parents=True, exist_ok=True)
with AudioFile(str(temp), 'w', SR, 2, bit_depth=16) as file:
    file.write(score)
encoder = shutil.which('ffmpeg')
if not encoder:
    raise RuntimeError('FFmpeg is required to encode the arena OGG')
subprocess.run([encoder, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(temp), '-c:a', 'libvorbis', '-q:a', '5', str(target)], check=True)
manifest_path = out / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['music']['fight'] = target.name
manifest['revision'] = 'combat-rich-v12'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
(out / 'arena-music.json').write_text(json.dumps({'title': 'Into the Veil', 'source': 'Original composition generated by scripts/build-arena-music.py',
    'file': target.name, 'seconds': SECONDS, 'bpm': BPM, 'fadeInSeconds': FADE_IN, 'fadeOutSeconds': FADE_OUT, 'loop': False,
    'layers': ['syncopated kick and snare beat', 'stereo hats and tom fills', 'pulsing D minor bass',
               'bowed harmonics', 'bright harmonic-minor arpeggio and stereo delays', 'high string tremolo tension'],
    'peak': round(float(np.max(np.abs(score))), 4)}, indent=2) + '\n', encoding='utf-8')
print('Arena opening ready: 25 seconds, 120 BPM beat, bright tension motif, stereo OGG, three-second fade out.', flush=True)
