#!/usr/bin/env python
"""生成站点图标 images/icon.svg：深色底 + 双层椭圆轨道 + 环形排布的专辑卡。

用法: python tools/gen-icon.py
"""
import math
from pathlib import Path

SIZE = 512
CX, CY = SIZE / 2, 268

OUTER = (188, 86)   # 外圈椭圆 rx, ry
INNER = (116, 54)   # 内圈椭圆

# (角度, 卡片边长, 颜色, 透明度)  角度 0=右，90=下（屏幕坐标）
OUTER_CARDS = [
    (168, 62, ('#38e1ff', '#2a6bd6'), 0.92),
    (12, 62, ('#ffc46b', '#d4583c'), 0.92),
    (96, 48, ('#8b5cf6', '#4c1d95'), 0.6),
    (252, 48, ('#5b6bff', '#1e3a8a'), 0.55),
]
INNER_CARDS = [
    (206, 44, ('#ff8fc7', '#a855f7'), 0.75),
    (334, 44, ('#7dd3fc', '#3b82f6'), 0.7),
]


def pos(angle_deg, rx, ry):
    a = math.radians(angle_deg)
    return CX + rx * math.cos(a), CY + ry * math.sin(a)


def card(angle_deg, size, colors, alpha, rx, ry, tilt=0.0):
    x, y = pos(angle_deg, rx, ry)
    c1, c2 = colors
    return (
        f'    <g transform="rotate({tilt} {x:.1f} {y:.1f})">'
        f'<rect x="{x - size / 2:.1f}" y="{y - size / 2:.1f}" width="{size}" height="{size}" '
        f'rx="{size * 0.22:.1f}" fill="url(#{c1[1:]}grad)" opacity="{alpha}"/></g>'
    )


def gradients(cards):
    out = []
    for _, _, (c1, c2), _ in cards:
        out.append(
            f'    <linearGradient id="{c1[1:]}grad" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>'
        )
    return out


def main():
    parts = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}">')
    parts.append('  <defs>')
    parts.append('    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
                 '<stop offset="0" stop-color="#191a26"/><stop offset="1" stop-color="#05060a"/></linearGradient>')
    parts.append('    <linearGradient id="front" x1="0" y1="0" x2="1" y2="1">'
                 '<stop offset="0" stop-color="#ff7ab8"/><stop offset="0.55" stop-color="#c084fc"/>'
                 '<stop offset="1" stop-color="#6d4bff"/></linearGradient>')
    parts.append('    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">'
                 '<stop offset="0" stop-color="#ff4fa3" stop-opacity="0.5"/>'
                 '<stop offset="0.6" stop-color="#a855f7" stop-opacity="0.16"/>'
                 '<stop offset="1" stop-color="#ff4fa3" stop-opacity="0"/></radialGradient>')
    parts.extend(gradients(OUTER_CARDS + INNER_CARDS))
    parts.append('  </defs>')
    parts.append('')
    parts.append(f'  <rect width="{SIZE}" height="{SIZE}" rx="{SIZE * 0.22:.0f}" fill="url(#bg)"/>')
    parts.append(f'  <ellipse cx="{CX}" cy="{CY}" rx="196" ry="132" fill="url(#glow)"/>')
    parts.append('')
    parts.append('  <!-- 外圈轨道 -->')
    parts.append(f'  <ellipse cx="{CX}" cy="{CY}" rx="{OUTER[0]}" ry="{OUTER[1]}" fill="none" '
                 'stroke="#ffffff" stroke-opacity="0.2" stroke-width="3.5"/>')
    parts.append('  <!-- 内圈轨道 -->')
    parts.append(f'  <ellipse cx="{CX}" cy="{CY}" rx="{INNER[0]}" ry="{INNER[1]}" fill="none" '
                 'stroke="#ffffff" stroke-opacity="0.13" stroke-width="2.5"/>')
    parts.append('')
    parts.append('  <!-- 外圈专辑卡 -->')
    for angle, size, colors, alpha in OUTER_CARDS:
        parts.append(card(angle, size, colors, alpha, *OUTER, tilt=-4 if angle > 90 else 4))
    parts.append('')
    parts.append('  <!-- 内圈专辑卡 -->')
    for angle, size, colors, alpha in INNER_CARDS:
        parts.append(card(angle, size, colors, alpha, *INNER))
    parts.append('')
    parts.append('  <!-- 正面的主封面 -->')
    parts.append('  <rect x="184" y="196" width="144" height="144" rx="30" fill="url(#front)"/>')
    parts.append('  <circle cx="256" cy="268" r="46" fill="#0b0c12" opacity="0.62"/>')
    parts.append('  <circle cx="256" cy="268" r="30" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>')
    parts.append('  <circle cx="256" cy="268" r="7" fill="#ff5fae"/>')
    parts.append('</svg>')

    out = Path(__file__).resolve().parent.parent / 'images' / 'icon.svg'
    out.write_text('\n'.join(parts) + '\n', encoding='utf-8')
    print(f'[ok] {out}')


if __name__ == '__main__':
    main()

