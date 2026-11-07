"""Render an offline male Edge Neural announcer with a restrained arena echo.

python scripts/build-announcer-audio.py [--preview]
The preview renders Victory only; the full build updates the runtime manifest.
"""
import asyncio
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.cache/audio-tools'))
import edge_tts
from edge_tts import communicate as edge_transport
import numpy as np
from pedalboard import Pedalboard, HighpassFilter, LowpassFilter, LowShelfFilter, PeakFilter, Compressor, Reverb, Limiter
from pedalboard.io import AudioFile

# Edge's certifi-only context omits trusted Windows roots on managed machines.
edge_transport._SSL_CTX.load_default_certs()

OUT = ROOT / 'apps/web/public/audio/voice'
SOURCE = ROOT / '.cache/announcer-source'
SR = 44100
PROFILE = {'engine': 'Microsoft Edge Neural TTS', 'voice': 'en-US-GuyNeural',
           'rate': '-6%', 'pitch': '-18Hz', 'volume': '+0%',
           'reference': 'Bountiq README in Desktop/Gentank identifies Edge Neural TTS; its female voice profile is absent from this checkout.'}
CUES = {
    'fight': 'Fight!', 'victory': 'Victory!', 'defeat': 'Defeat.', 'draw': 'A draw.',
    'parry': 'Perfect parry!', 'guard-break': 'Guard broken!',
    'heavy-impact': 'Heavy impact!', 'crushing-blow': 'Crushing blow!',
    'ten-seconds': 'Ten seconds remain.',
    'signature-karen': 'Crescent steel!', 'signature-taren': 'Oath repulse!',
    'signature-nomet': 'Gravequake!', 'signature-veyra': 'Chain pierce!',
    'signature-mawren': 'Rune seal!',
    'ultimate-karen': 'Steel resolve!', 'ultimate-taren': 'Hold the line!',
    'ultimate-nomet': 'Last burial!', 'ultimate-veyra': 'Captive steel!',
    'ultimate-mawren': 'Rune collapse!',
}
ROUND_WORDS = ['one', 'two', 'three', 'four', 'five']

async def fetch_sources(texts):
    gate = asyncio.Semaphore(2)
    async def one(key, text):
        path = SOURCE / (key + '.mp3')
        effective_profile = {**PROFILE, 'rate': '+12%' if key.startswith('round-') or key == 'fight' else PROFILE['rate']}
        tag = hashlib.sha256(json.dumps([text, effective_profile], sort_keys=True).encode()).hexdigest()
        metadata = path.with_suffix('.json')
        if path.exists() and path.stat().st_size > 500 and metadata.exists() and json.loads(metadata.read_text())['hash'] == tag:
            return
        async with gate:
            for attempt in range(3):
                try:
                    task = edge_tts.Communicate(text, PROFILE['voice'], rate=effective_profile['rate'], pitch=PROFILE['pitch'], volume=PROFILE['volume'], connect_timeout=12, receive_timeout=30)
                    await task.save(str(path))
                    if path.stat().st_size < 500:
                        raise RuntimeError('The speech service returned an empty clip')
                    metadata.write_text(json.dumps({'text': text, 'profile': effective_profile, 'hash': tag}, indent=2) + '\n')
                    print('Neural source:', key, flush=True)
                    return
                except Exception as error:
                    if attempt == 2:
                        raise RuntimeError(f'Neural speech failed for {key}: {error}') from error
                    await asyncio.sleep(attempt + 1)
    await asyncio.gather(*(one(key, text) for key, text in texts.items()))

def read_source(key):
    with AudioFile(str(SOURCE / (key + '.mp3'))) as source:
        source = source.resampled_to(SR)
        data = source.read(source.frames)
    if data.shape[0] == 1:
        data = np.repeat(data, 2, axis=0)
    active = np.where(np.max(np.abs(data), axis=0) > .006)[0]
    if not len(active):
        raise RuntimeError(f'No speech in {key}')
    start = max(0, active[0] - int(.025 * SR))
    end = min(data.shape[1], active[-1] + int(.075 * SR))
    return data[:2, start:end].copy()

def master(data):
    tone = Pedalboard([HighpassFilter(cutoff_frequency_hz=65),
                      LowShelfFilter(cutoff_frequency_hz=145, gain_db=2),
                      PeakFilter(cutoff_frequency_hz=330, gain_db=-1.6, q=.7),
                      Compressor(threshold_db=-21, ratio=3, attack_ms=8, release_ms=110),
                      LowpassFilter(cutoff_frequency_hz=10500)])
    data = tone(data, SR)
    # Add a short stereo reflection and a decaying slap echo without obscuring words.
    tail = int(.95 * SR)
    dry = np.pad(data, ((0, 0), (0, tail)))
    echo = np.zeros_like(dry)
    for channel in range(2):
        for delay, gain in [(.09 + channel * .016, .14), (.19 + channel * .012, .07), (.31 + channel * .008, .035)]:
            offset = int(delay * SR)
            echo[channel, offset:offset + data.shape[1]] += data[channel] * gain
    result = Pedalboard([Reverb(room_size=.53, damping=.68, wet_level=.12, dry_level=1, width=.9)])(dry + echo, SR)
    rms = float(np.sqrt(np.mean(data ** 2)))
    result *= min(3.2, .12 / max(rms, .001))
    result = Pedalboard([Limiter(threshold_db=-1.4, release_ms=90)])(result, SR)
    peak = float(np.max(np.abs(result)))
    result *= min(1, .88 / max(peak, .001))
    edge = int(.012 * SR)
    result[:, :edge] *= np.linspace(0, 1, edge)
    result[:, -edge:] *= np.linspace(1, 0, edge)
    return result

def write(key, data):
    path = OUT / (key + '.wav')
    with AudioFile(str(path), 'w', SR, 2, bit_depth=16) as output:
        output.write(data)
    return {'file': 'voice/' + path.name, 'seconds': round(data.shape[1] / SR, 3), 'peak': round(float(np.max(np.abs(data))), 4)}

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)
    preview = '--preview' in sys.argv
    texts = {'victory': CUES['victory']} if preview else {**CUES, **{f'round-{i+1}': f'Round {word}.' for i, word in enumerate(ROUND_WORDS)}}
    await fetch_sources(texts)
    rendered = {key: write(key, master(read_source(key))) for key in texts}
    if preview:
        print(json.dumps({'preview': rendered['victory'], 'profile': PROFILE}, indent=2), flush=True)
        return
    round_cues = {}
    for i in range(1, 6):
        intro, fight = read_source(f'round-{i}'), read_source('fight')
        # A brisk spoken round number leads straight into Fight; its marker releases control.
        start = max(int(1.0 * SR), intro.shape[1] + int(.035 * SR))
        combined = np.zeros((2, start + fight.shape[1]), dtype=np.float32)
        combined[:, :intro.shape[1]] = intro
        combined[:, start:] = fight
        key = f'round-fight-{i}'
        rendered[key] = write(key, master(combined))
        round_cues[key] = {'fightAt': round(start / SR + .025, 4)}
    manifest_path = OUT.parent / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['voices'] = {key: value['file'] for key, value in rendered.items() if not key.startswith('round-') or key.startswith('round-fight-')}
    manifest['revision'] = 'combat-rich-v12'
    manifest['roundCues'] = round_cues
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    lines = {**CUES, **{f'round-fight-{i+1}': f'Round {word}. Fight!' for i, word in enumerate(ROUND_WORDS)}}
    (OUT / 'cues.json').write_text(json.dumps(lines, indent=2) + '\n', encoding='utf-8')
    (OUT / 'profile.json').write_text(json.dumps({'profile': PROFILE, 'roundRate': '+12%', 'mastering': 'EQ, compression, stereo reflections, arena reverb and limiting via Spotify Pedalboard', 'roundCues': round_cues, 'files': rendered}, indent=2) + '\n', encoding='utf-8')
    print('Arena announcer ready:', len(manifest['voices']), 'neural voice clips.', flush=True)

if __name__ == '__main__':
    asyncio.run(main())
