"""Measure a local music track for trailer timing using FFmpeg and stdlib."""
import argparse
import json
import math
import subprocess
from array import array
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    rate, step = 8000, 0.02
    frame_size = round(rate * step)

    def envelope(extra_filter=None):
        command = [args.ffmpeg, "-v", "error", "-i", str(args.source)]
        if extra_filter:
            command.extend(["-af", extra_filter])
        command.extend(["-ac", "1", "-ar", str(rate), "-f", "f32le", "pipe:1"])
        samples = array("f", subprocess.check_output(command))
        values = []
        for start in range(0, len(samples) - frame_size + 1, frame_size):
            block = samples[start:start + frame_size]
            values.append(math.sqrt(sum(x * x for x in block) / frame_size))
        return values, len(samples) / rate

    full, duration = envelope()
    bass, _ = envelope("lowpass=f=160")
    onset = [0.0]
    for i in range(1, min(len(full), len(bass))):
        onset.append(max(0, full[i] - full[i - 1]) + 1.5 * max(0, bass[i] - bass[i - 1]))
    # Tempo candidates are timing suggestions, not a verified musical transcription.
    tempo_candidates = []
    average = sum(onset) / len(onset)
    centered = [value - average for value in onset]
    for bpm in range(70, 181):
        lag = round(60 / bpm / step)
        score = sum(centered[i] * centered[i - lag] for i in range(lag, len(centered)))
        tempo_candidates.append({"bpm": bpm, "score": round(score, 5)})
    tempo_candidates.sort(key=lambda entry: entry["score"], reverse=True)
    seconds = []
    per_second = round(1 / step)
    for second in range(math.floor(duration)):
        segment = full[second * per_second:(second + 1) * per_second]
        seconds.append({"time": second, "rms": round(sum(segment) / len(segment), 5),
                        "peak": round(max(segment), 5)})
    threshold = sorted(onset)[round(len(onset) * 0.90)]
    hits = []
    for i in range(1, len(onset) - 1):
        if onset[i] >= threshold and onset[i] >= onset[i - 1] and onset[i] > onset[i + 1]:
            event = {"time": round(i * step, 2), "strength": round(onset[i], 5)}
            if hits and event["time"] - hits[-1]["time"] < 0.22:
                if event["strength"] > hits[-1]["strength"]:
                    hits[-1] = event
            else:
                hits.append(event)
    report = {"source": str(args.source), "duration_seconds": round(duration, 3),
              "analysis": "RMS energy and onset measurements; edit cues require listening review.",
              "tempo_candidates": tempo_candidates[:8], "seconds": seconds, "strong_onsets": hits}
    (args.out / "storm-analysis.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    # A simple waveform reference keeps music planning separate from game assets.
    width, height, pad = 1400, 400, 50
    max_rms = max(full)
    points = []
    buckets = 1200
    for bucket in range(buckets):
        begin = bucket * len(full) // buckets
        end = max(begin + 1, (bucket + 1) * len(full) // buckets)
        value = max(full[begin:end]) / max_rms
        x = pad + bucket / (buckets - 1) * (width - 2 * pad)
        y = height - pad - value * (height - 140)
        points.append(f"{x:.1f},{y:.1f}")
    labels = []
    for second in range(0, math.floor(duration) + 1, 10):
        x = pad + second / duration * (width - 2 * pad)
        labels.append(f'<line x1="{x:.1f}" y1="80" x2="{x:.1f}" y2="350" stroke="#dde2e7"/>'
                      f'<text x="{x:.1f}" y="377" text-anchor="middle" fill="#45505c" font-size="12">{second}s</text>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
           '<rect width="1400" height="400" fill="#ffffff"/>'
           '<text x="50" y="35" fill="#17202b" font-family="Arial" font-size="22">Aylex — Storm: energy reference</text>'
           f'<text x="50" y="60" fill="#45505c" font-family="Arial" font-size="14">{duration:.2f} seconds · peaks of 20 ms RMS windows</text>'
           + ''.join(labels) + '<polyline fill="none" stroke="#9b4c18" stroke-width="1.4" points="'
           + ' '.join(points) + '"/></svg>')
    (args.out / "storm-waveform.svg").write_text(svg, encoding="utf-8")
    print(json.dumps({"duration_seconds": report["duration_seconds"],
                      "tempo_candidates": report["tempo_candidates"],
                      "five_second_energy": [{"start": i, "rms": round(sum(row["rms"] for row in seconds[i:i + 5]) / len(seconds[i:i + 5]), 4)}
                                             for i in range(0, len(seconds), 5)],
                      "artifacts": [str(args.out / "storm-analysis.json"), str(args.out / "storm-waveform.svg")]}, indent=2))


if __name__ == "__main__":
    main()
