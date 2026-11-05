# astr.to brand assets in the design language of infra/traefik-404 ("No route to host"):
# its nebula sky (gen_bg ported 1:1), its 3x5 pixel font, its beacon as the logo.
# Run from the repo root:  uv run -q --with pillow python contrib/astr/make_brand.py
from pathlib import Path
from PIL import Image

M = 0xFFFFFFFF

# ---- palette (traefik-404/src/scene.c) --------------------------------------
NEB = [(12, 30, 58), (14, 44, 76), (18, 62, 92), (26, 88, 108), (44, 122, 124), (86, 168, 150)]
VEIL = [(96, 32, 104), (168, 52, 134), (236, 104, 172)]
SC = [(235, 250, 255), (150, 230, 255), (255, 240, 170), (255, 170, 220)]
INK, SHADE, ACID, PINK, CREAM = (184, 255, 222), (6, 20, 34), (222, 255, 92), (255, 96, 182), (255, 255, 230)


def hash2(x, y):
    h = (x * 374761393 + y * 668265263) & M
    h = ((h ^ (h >> 13)) * 1274126177) & M
    return h ^ (h >> 16)


def hf(x, y):
    return (hash2(x, y) & 0xFFFF) / 65535.0


def vnoise(x, y, seed):
    ix, iy = int(x // 1), int(y // 1)
    fx, fy = x - ix, y - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    s = seed * 1013
    a, b = hf(ix, iy + s), hf(ix + 1, iy + s)
    c, d = hf(ix, iy + 1 + s), hf(ix + 1, iy + 1 + s)
    top, bot = a + (b - a) * fx, c + (d - c) * fx
    return top + (bot - top) * fy


def fbm(x, y, seed):
    v, amp = 0.0, 0.5
    for i in range(4):
        v += vnoise(x, y, seed + i) * amp
        x, y, amp = x * 2.03 + 7.1, y * 2.03 - 3.7, amp * 0.5
    return v / 0.9375


def clamp01(v):
    return 0.0 if v < 0 else 1.0 if v > 1 else v


def pick(p, v, th):
    v = clamp01(v) * (len(p) - 1)
    i = int(v)
    if i >= len(p) - 1:
        return p[-1]
    return p[i + 1] if v - i > th else p[i]


def mix(a, b, t):
    return tuple(a[k] + (b[k] - a[k]) * t for k in range(3))


def dz(x, y):
    return hf(x * 3 + 17, y * 5 + 911)


def sky(W, H, seed=10):
    U = min(W, H) / 180.0
    sc = 1.0 / (70.0 * U)
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            nx, ny = x * sc, y * sc
            n = fbm(nx, ny, seed)
            m = fbm(nx * 1.6 + 9.0, ny * 1.6 - 3.0, seed + 50)
            grad = 0.18 * (x / W) + 0.12 * (y / H)
            th = dz(x, y)
            c = pick(NEB, clamp01((n - 0.38) * 1.6) + grad, th)
            veil = clamp01((m - 0.58) * 3.2)
            if veil > 0.02:
                c = mix(c, pick(VEIL, veil * 0.9, th), veil * 0.55)
            px[x, y] = tuple(int(round(v)) for v in c)
    # stars, frozen at a pleasant twinkle
    for i in range(W * H // 180):
        h = hash2(i, 4242 + 1)
        x, y = h % W, (h >> 11) % H
        k = (h >> 22) & 31
        kind = 0 if k < 22 else 1 if k < 30 else 2
        col = SC[(h >> 3) & 3]
        a = 0.45 if kind == 0 else 0.95
        blend(px, x, y, col, a, W, H)
        if kind == 2:
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                blend(px, x + dx, y + dy, col, 0.5, W, H)
    return img


def blend(px, x, y, c, a, W, H):
    if 0 <= x < W and 0 <= y < H:
        o = px[x, y]
        px[x, y] = tuple(int(round(o[k] + (c[k] - o[k]) * a)) for k in range(3))


# ---- 3x5 font (same glyphs as the 404) -------------------------------------
GL = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.:/->!?#,()+=%_"
GB = ["000000000000000", "111101101101111", "010110010010111", "111001111100111", "111001111001111",
      "101101111001001", "111100111001111", "111100111101111", "111001001010010", "111101111101111",
      "111101111001111", "010101111101101", "110101110101110", "011100100100011", "110101101101110",
      "111100110100111", "111100110100100", "011100101101011", "101101111101101", "111010010010111",
      "001001001101010", "101101110101101", "100100100100111", "101111111101101", "110101101101101",
      "010101101101010", "110101110100100", "010101101110011", "110101110101101", "011100010001110",
      "111010010010010", "101101101101111", "101101101101010", "101101111111101", "101101010101101",
      "101101010010010", "111001010100111", "000000000000010", "000010000010000", "001001010100100",
      "000000111000000", "100010001010100", "010010010000010", "111001010000010", "101111101111101",
      "000000000010100", "010100100100010", "010001001001010", "000010111010000", "000111000111000",
      "101001010100101", "000000000000111"]


def hexc(c):
    return "#%02x%02x%02x" % c


def wordmark_svg(s, col=ACID):
    # 2 grid units per font pixel; shade offset by half a pixel, as the 404 does
    w, h = (len(s) * 4 - 1) * 2 + 1, 5 * 2 + 1
    shade, fg = [], []
    for n, ch in enumerate(s.upper()):
        g = GB[GL.index(ch)]
        for r in range(5):
            for q in range(3):
                if g[r * 3 + q] == "1":
                    x, y = (n * 4 + q) * 2, r * 2
                    shade.append(f'<rect x="{x + 1}" y="{y + 1}" width="2" height="2"/>')
                    fg.append(f'<rect x="{x}" y="{y}" width="2" height="2"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" shape-rendering="crispEdges">'
            f'<g fill="{hexc(SHADE)}" fill-opacity="0.85">{"".join(shade)}</g>'
            f'<g fill="{hexc(col)}">{"".join(fg)}</g></svg>\n')


# ---- logo: the 404 beacon on a quiet patch of its sky ------------------------
def logo(N=32, dot=None):
    import math
    img = Image.new("RGB", (N, N))
    px = img.load()
    for y in range(N):
        for x in range(N):
            v = 0.15 + 0.35 * ((x + y) / (2 * N))           # slight diagonal lift, dithered
            px[x, y] = pick(NEB[:3], v, dz(x, y))
    for i, (x, y, c) in enumerate([(4, 6, SC[3]), (26, 4, SC[1]), (5, 26, SC[2]), (27, 24, SC[0]), (9, 15, SC[1])]):
        px[x, y] = c
    cx = cy = N / 2 - 0.5
    for r, n, a in ((12.5, 28, 0.55), (9.0, 20, 0.8)):
        for j in range(n):
            t = j * 2 * math.pi / n
            blend(px, int(round(cx + math.cos(t) * r)), int(round(cy + math.sin(t) * r)), ACID, a, N, N)
    for dx, dy in ((0, -6), (6, 0), (0, 6), (-6, 0)):
        for ox in (0, 1):
            for oy in (0, 1):
                px[int(cx) + dx + ox, int(cy) + dy + oy] = ACID
    c0 = int(cx)
    for y in range(-4, 6):
        for x in range(-4, 6):
            if abs(x - 0.5) + abs(y - 0.5) <= 4.5:
                px[c0 + x, c0 + y] = CREAM if x + y < 1 else ACID
    if dot:
        for y in range(0, 10):
            for x in range(N - 10, N):
                px[x, y] = SHADE
        for y in range(2, 8):
            for x in range(N - 8, N - 2):
                px[x, y] = dot
    return img


def to_svg(img):
    W, H = img.size
    px = img.load()
    rects = "".join(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{hexc(px[x, y])}"/>'
                    for y in range(H) for x in range(W))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" shape-rendering="crispEdges">'
            f"{rects}</svg>\n")


if __name__ == "__main__":
    pub = Path("public")
    out = pub / "res/astr"
    out.mkdir(parents=True, exist_ok=True)
    sky(480, 270).save(out / "sky.png")
    sky(270, 480, seed=13).save(out / "sky-tall.png")
    (out / "wordmark.svg").write_text(wordmark_svg("astr.to"))
    base = logo()
    (pub / "res/svg/cinny.svg").write_text(to_svg(base))
    (pub / "res/svg/cinny-unread.svg").write_text(to_svg(logo(dot=INK)))
    (pub / "res/svg/cinny-highlight.svg").write_text(to_svg(logo(dot=PINK)))
    for p in list((pub / "res/android").glob("android-chrome-*x*.png")) + list((pub / "res/apple").glob("apple-touch-icon-*x*.png")):
        size = int(p.stem.split("-")[-1].split("x")[0])
        base.resize((size, size), Image.NEAREST).save(p)
    base.resize((256, 256), Image.NEAREST).save(pub / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
    base.resize((512, 512), Image.NEAREST).save(Path("contrib/astr/logo-512.png"))
    print("brand assets written")
