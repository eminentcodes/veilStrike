"""Sample the Preparing Expedition panel so the responsive rebuild uses only
colours that exist in `docs/ui/04-matchmaking-crewready.png`."""

from collections import Counter
from PIL import Image

img = Image.open("docs/ui/04-matchmaking-crewready.png").convert("RGB")
print("size", img.size)

POINTS = {
    "card body cream": (400, 550),
    "card body cream 2": (300, 700),
    "card rim": (99, 560),
    "row divider": (400, 611),
    "connected green": (536, 517),
    "check ring green": (627, 517),
    "row label dark": (230, 517),
    "avatar tile": (160, 581),
    "tip tile green": (160, 765),
    "tip tile rim": (133, 740),
    "dark bar panel": (300, 856),
    "dark bar rim": (95, 845),
    "track empty": (600, 906),
    "track fill green": (200, 906),
    "cancel face": (350, 963),
    "cancel rim": (270, 945),
    "banner cream": (380, 185),
    "banner wood": (170, 165),
}

for name, (x, y) in POINTS.items():
    print(f"{name:20s} ({x},{y}) {img.getpixel((x, y))}")


def dominant(box, k=6):
    crop = img.crop(box)
    counts = Counter(crop.getdata())
    return counts.most_common(k)


print("\ncard region dominant:", dominant((100, 490, 660, 800), 8))
print("\ndark bar dominant:", dominant((90, 838, 660, 925), 6))
