"""Final modal-chrome samples: title glyph, parchment gradient, close chip.

Complements the button ramps already scanned. Coordinates target panel 7
(PAUSE MENU) on docs/ui/06-screens-modals-states.png.
"""

from collections import Counter

from PIL import Image

SRC = "docs/ui/06-screens-modals-states.png"


def darkest(img, box, label):
    """Glyph fill = the darkest cluster inside a text box."""
    px = list(img.crop(box).convert("RGB").getdata())
    px.sort(key=lambda c: c[0] + c[1] + c[2])
    print(f"   {label:<26} #%02x%02x%02x" % px[len(px) // 40])


def main():
    img = Image.open(SRC).convert("RGB")

    print("== parchment vertical gradient (x=110, clear of glyphs)")
    for y in (884, 890, 896, 900, 936, 960, 972):
        print("   y%-5d #%02x%02x%02x" % ((y,) + img.getpixel((110, y))))

    print("\n== glyph fills")
    darkest(img, (78, 884, 140, 898), "modal title")
    darkest(img, (60, 912, 160, 926), "green button label (light)")

    print("\n== green button label — lightest cluster")
    px = list(img.crop((60, 912, 160, 926)).convert("RGB").getdata())
    px.sort(key=lambda c: -(c[0] + c[1] + c[2]))
    print("   #%02x%02x%02x" % px[len(px) // 40])

    print("\n== close chip ramp (x=181)")
    for y in range(866, 884):
        print("   y%-5d #%02x%02x%02x" % ((y,) + img.getpixel((181, y))))

    print("\n== parchment dominant, disconnect panel interior")
    counts = Counter(img.crop((960, 880, 1140, 950)).getdata())
    for rgb, n in counts.most_common(4):
        print("   #%02x%02x%02x  %d" % (rgb + (n,)))


if __name__ == "__main__":
    main()
