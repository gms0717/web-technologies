"""生成 6 张 16:9 的占位轮播图（480×270 JPEG）。"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "images" / "banners"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 480, 270

PALETTES = [
    ((255, 79, 163), (24, 6, 28)),
    ((56, 225, 255), (6, 18, 30)),
    ((255, 180, 84), (32, 14, 6)),
    ((163, 230, 53), (10, 24, 8)),
    ((157, 180, 255), (8, 12, 30)),
    ((192, 132, 252), (18, 8, 32)),
]


def gradient(size, c1, c2):
    w, h = size
    base = Image.new("RGB", size, c2)
    draw = ImageDraw.Draw(base)
    for y in range(h):
        t = y / max(1, h - 1)
        for step, (x0, x1) in enumerate(((0, w // 2), (w // 2, w))):
            tt = (x0 / w) * 0.6 + t * 0.4
            color = tuple(int(c1[i] * (1 - tt) + c2[i] * tt) for i in range(3))
            draw.rectangle([x0, y, x1, y], fill=color)
    return base


def make(index, c1, c2):
    img = gradient((W, H), c1, c2).convert("RGB")
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # 同心弧
    cx, cy = W * 0.72, H * 0.42
    for r in range(40, 220, 26):
        d.arc([cx - r, cy - r, cx + r, cy + r], start=200 + index * 12, end=340 + index * 12,
              fill=(255, 255, 255, 46), width=2)

    # 斜线
    for x in range(-H, W, 34):
        d.line([(x, H), (x + H, 0)], fill=(255, 255, 255, 12), width=1)

    # 高光块
    d.rounded_rectangle([W * 0.08, H * 0.62, W * 0.42, H * 0.86], radius=10,
                        fill=(255, 255, 255, 26))

    layer = layer.filter(ImageFilter.GaussianBlur(0.4))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")

    out = OUT / f"{index + 1}.jpg"
    img.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"{out.name} {out.stat().st_size // 1024} KB")


for i, (c1, c2) in enumerate(PALETTES):
    make(i, c1, c2)
