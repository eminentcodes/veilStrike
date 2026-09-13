"""Split the two-up matchmaking sheet into one plate per screen.

`docs/ui/04-matchmaking-crewready.png` draws two separate screens side by side
with a gutter between them. They are different screens in the flow, so each is
cropped to its own plate rather than being scaled as a pair.

The split column is found by scanning for the darkest (near-black) vertical
gutter in the middle third of the sheet, so it does not depend on eyeballing.
"""

from PIL import Image

SRC = "docs/ui/04-matchmaking-crewready.png"
OUT = "apps/web/public/art"


def main():
    img = Image.open(SRC).convert("RGB")
    w, h = img.size

    # Column brightness across the middle band; the gutter is the darkest run.
    band = img.crop((0, h // 4, w, 3 * h // 4))
    bw, bh = band.size
    px = band.load()

    best_x, best_v = w // 2, 1e9
    for x in range(int(bw * 0.40), int(bw * 0.60)):
        total = 0
        for y in range(0, bh, 8):
            r, g, b = px[x, y]
            total += r + g + b
        if total < best_v:
            best_v, best_x = total, x

    print(f"gutter centre x={best_x}  (sheet {w}x{h})")

    left = img.crop((0, 0, best_x - 4, h))
    right = img.crop((best_x + 5, 0, w, h))

    left.save(f"{OUT}/matchmaking.png")
    right.save(f"{OUT}/crew-ready.png")
    print(f"matchmaking.png {left.size}")
    print(f"crew-ready.png  {right.size}")


if __name__ == "__main__":
    main()
