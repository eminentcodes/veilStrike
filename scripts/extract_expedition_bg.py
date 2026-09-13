"""Extract a clean scenic backdrop from the Preparing Expedition panel.

`docs/ui/04-matchmaking-crewready.png` paints the camp outside the mine, with the
matchmaking chrome sitting on top of it. The chrome is rebuilt in DOM so it can
scale to any viewport, which means the plate has to ship as scenery only.

We take the widescreen band of the left panel that is pure scenery -- the mine
entrance, the miner, the tents, the campfire, the crystal cluster and the notice
board -- and diffuse away the two pieces of chrome baked into it: the top status
bar and the PREPARING EXPEDITION banner.

Usage:  python scripts/extract_expedition_bg.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "ui" / "04-matchmaking-crewready.png"
OUT = ROOT / "apps" / "web" / "public" / "art" / "expedition-bg.png"

# Left panel of the sheet is x 0..750. This band is the scenery, in sheet coords.
# The foot stops just above the crew roster card so no chrome is included.
BAND = (4, 120, 746, 483)

# Chrome baked into the band, in sheet coords (x0, y0, x1, y1) inclusive.
CHROME = [
    (0, 120, 750, 148),     # foot of the top status bar
    (150, 140, 600, 248),   # PREPARING EXPEDITION banner
]

ITERATIONS = 700

# The panel already darkens under the canopy and toward the foreground; the
# scrim below extends that so the diffused patches read as depth rather than as
# smears, and so DOM text sits on a settled ground.
SCRIM_TOP = 0.40      # fraction of height fully scrimmed at the top
SCRIM_TOP_ALPHA = 0.58
SCRIM_BOTTOM = 0.80   # scrim ramps in from here to the foot
SCRIM_BOTTOM_ALPHA = 0.45


def inpaint(img: np.ndarray, mask: np.ndarray, iterations: int = ITERATIONS) -> np.ndarray:
    """Fill masked pixels by diffusing colour inward from the region boundary."""
    out = img.astype(np.float64).copy()
    known = ~mask
    if known.any():
        out[mask] = out[known].mean(axis=0)

    for _ in range(iterations):
        up = np.roll(out, 1, axis=0)
        down = np.roll(out, -1, axis=0)
        left = np.roll(out, 1, axis=1)
        right = np.roll(out, -1, axis=1)
        avg = (up + down + left + right) / 4.0
        out[mask] = avg[mask]

    return np.clip(out, 0, 255).astype(np.uint8)


def scrim(arr: np.ndarray) -> np.ndarray:
    """Darken the canopy and the foreground, per SCRIM_* above."""
    h = arr.shape[0]
    alpha = np.zeros(h, dtype=np.float64)

    top_end = max(1, int(h * SCRIM_TOP))
    alpha[:top_end] = np.linspace(SCRIM_TOP_ALPHA, 0.0, top_end)

    bot_start = int(h * SCRIM_BOTTOM)
    alpha[bot_start:] = np.linspace(0.0, SCRIM_BOTTOM_ALPHA, h - bot_start)

    out = arr.astype(np.float64) * (1.0 - alpha)[:, None, None]
    return np.clip(out, 0, 255).astype(np.uint8)


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    x0, y0, x1, y1 = BAND
    arr = np.array(src.crop((x0, y0, x1 + 1, y1 + 1)))

    mask = np.zeros(arr.shape[:2], dtype=bool)
    for cx0, cy0, cx1, cy1 in CHROME:
        ry0 = max(0, cy0 - y0)
        ry1 = min(arr.shape[0], cy1 - y0 + 1)
        rx0 = max(0, cx0 - x0)
        rx1 = min(arr.shape[1], cx1 - x0 + 1)
        if ry1 > ry0 and rx1 > rx0:
            mask[ry0:ry1, rx0:rx1] = True

    plate = Image.fromarray(scrim(inpaint(arr, mask)))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    plate.save(OUT, optimize=True)

    print(f"wrote {OUT}  {plate.width}x{plate.height}  aspect {plate.width / plate.height:.3f}")


if __name__ == "__main__":
    main()
