# Generates the astr.to pixel logo (SVG + PNG/ICO sizes) into public/.
# Run from the repo root:  uv run -q --with pillow python contrib/astr/make_brand.py
from pathlib import Path
from PIL import Image

SKY = "#0e0f26"
C = {"W": "#fff8de", "Y": "#ffce54", "O": "#f7802c", "R": "#cd342e", "S": "#ece8d6"}
# 16x16 four-point star; '.' = sky
GRID = """\
................
.......R........
.......O........
.......O........
......OYO.......
......YWY.......
....OYYWYYO.....
.ROOYWWWWWYOOR..
....OYYWYYO.....
......YWY.......
......OYO.......
.......O........
.......O........
.......R....S...
...........SSS..
............S..."""
ROWS = GRID.splitlines()
N = 16
DOT = "#e8564c"   # notification dot colours
HIGHLIGHT = "#ffce54"


def svg(dot=None):
    rects = [f'<rect width="{N}" height="{N}" fill="{SKY}"/>']
    for y, row in enumerate(ROWS):
        for x, ch in enumerate(row):
            if ch in C:
                rects.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{C[ch]}"/>')
    if dot:
        rects.append(f'<rect x="11" y="0" width="5" height="5" fill="{SKY}"/><rect x="12" y="1" width="3" height="3" fill="{dot}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" shape-rendering="crispEdges">'
            + "".join(rects) + "</svg>\n")


def png(size):
    img = Image.new("RGB", (N, N), SKY)
    px = img.load()
    for y, row in enumerate(ROWS):
        for x, ch in enumerate(row):
            if ch in C:
                px[x, y] = tuple(int(C[ch][i:i + 2], 16) for i in (1, 3, 5))
    return img.resize((size, size), Image.NEAREST)


root = Path("public")
(root / "res/svg/cinny.svg").write_text(svg())
(root / "res/svg/cinny-unread.svg").write_text(svg(DOT))
(root / "res/svg/cinny-highlight.svg").write_text(svg(HIGHLIGHT))
for p in (root / "res/android").glob("android-chrome-*x*.png"):
    png(int(p.stem.split("-")[-1].split("x")[0])).save(p)
for p in (root / "res/apple").glob("apple-touch-icon-*x*.png"):
    png(int(p.stem.split("-")[-1].split("x")[0])).save(p)
png(256).save(root / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
png(512).save(Path("contrib/astr/logo-512.png"))
print("brand assets written")
