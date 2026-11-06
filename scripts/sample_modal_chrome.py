"""Pixel-sample the modal chrome ramps from 06-screens-modals-states.png.

Vertical scans through the PAUSE MENU (panel 7) buttons and parchment, so the
wallet-connect modal — which has no reference art of its own — is assembled from
colours that were actually painted, not invented.

Scan columns are chosen to sit in flat interior areas, away from glyphs.
"""

from PIL import Image

SRC = "docs/ui/06-screens-modals-states.png"


def scan(img, x, y0, y1, label):
    print(f"\n== {label}   column x={x}, y={y0}..{y1}")
    prev = None
    for y in range(y0, y1 + 1):
        hexc = "#%02x%02x%02x" % img.getpixel((x, y))[:3]
        if hexc != prev:
            print(f"   y{y:<5} {hexc}")
            prev = hexc


def point(img, x, y, label):
    print("   %-28s (%d,%d)  #%02x%02x%02x" % ((label, x, y) + img.getpixel((x, y))[:3]))


def main():
    img = Image.open(SRC).convert("RGB")

    # Green button ("Resume"), left of the label glyphs.
    scan(img, 60, 906, 932, "modal green button")
    # Red button ("Leave Expedition").
    scan(img, 60, 981, 1006, "modal red button")
    # Frame + parchment, horizontal position through the panel's left edge.
    print("\n== frame / parchment")
    for x in range(28, 46):
        point(img, x, 940, f"x{x}")
    print("\n== interior")
    point(img, 110, 902, "parchment upper")
    point(img, 110, 975, "parchment lower")
    point(img, 60, 890, "title glyph area")
    point(img, 181, 874, "close chip")


if __name__ == "__main__":
    main()
