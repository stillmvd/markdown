import io
import math
import pathlib

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from shapely.geometry import LineString, box
from shapely.ops import unary_union

HERE = pathlib.Path(__file__).resolve().parent
FONT = HERE.parent.parent / "src/assets/fonts/Gilroy-Bold.woff2"

HEIGHT = 28.0
SPAN = 21.0
D_EXT = 5.5
STROKE = 7.0
VERTEX = 20.0
FIELD = 1.0

TOP = "#cdb498"
BOTTOM = "#7a5c3f"
INK_LIGHT = "#17171a"
INK_DARK = "#ececef"

SMALL = dict(stroke=6.4, span=22.0, vertex=19.0)


def arc(cx, cy, r, a0, a1, step=2.0):
    n = max(2, int(abs(a1 - a0) / step) + 1)
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / (n - 1))),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / (n - 1)))) for i in range(n)]


def outline(stroke=STROKE, span=SPAN, d_ext=D_EXT, vertex=VERTEX):
    h = stroke / 2
    right = h + span
    over = HEIGHT + stroke
    m = LineString([(h, over), (h, 0), (h + span / 2, vertex), (right, 0), (right, over)])
    d = LineString([(right, h), (right + d_ext, h)] + arc(right + d_ext, HEIGHT / 2, HEIGHT / 2 - h, -90, 90)
                   + [(right, HEIGHT - h)])
    style = dict(cap_style="flat", join_style="mitre", mitre_limit=12)
    shape = unary_union([m.buffer(h, **style), d.buffer(h, **style)])
    return shape.intersection(box(-100, 0, 200, HEIGHT))


def fitted(shape, width, cx=32.0, cy=32.0):
    x0, y0, x1, y1 = shape.bounds
    s = width / (x1 - x0)
    tx, ty = cx - s * (x0 + x1) / 2, cy - s * (y0 + y1) / 2
    return s, tx, ty


def path_d(shape, s, tx, ty):
    polys = shape.geoms if hasattr(shape, "geoms") else [shape]
    parts = []
    for poly in polys:
        for ring in [poly.exterior, *poly.interiors]:
            pts = list(ring.coords)[:-1]
            parts.append("M" + "L".join(f"{tx + s * x:.2f} {ty + s * y:.2f}" for x, y in pts) + "Z")
    return "".join(parts)


def mark_body(shape, width, fill, cx=32.0, cy=32.0, gid="ginger"):
    s, tx, ty = fitted(shape, width, cx, cy)
    d = path_d(shape, s, tx, ty)
    if fill != "gradient":
        return f'<path d="{d}" fill="{fill}"/>'
    return (f'<defs><linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="0" y1="{ty:.2f}" x2="0" '
            f'y2="{ty + s * HEIGHT:.2f}"><stop offset="0" stop-color="{TOP}"/>'
            f'<stop offset="1" stop-color="{BOTTOM}"/></linearGradient></defs>'
            f'<path d="{d}" fill="url(#{gid})"/>')


def document(body, view="0 0 64 64", width=64, height=64):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" width="{width}" height="{height}">{body}</svg>'


def word(text, cap, x, baseline):
    font = TTFont(FONT)
    raw = io.BytesIO()
    font.flavor = None
    font.save(raw)
    face = hb.Face(hb.Blob(raw.getvalue()))
    hbfont = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    k = cap / font["OS/2"].sCapHeight
    glyphs = font.getGlyphSet()
    order = font.getGlyphOrder()
    pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.2f}")
    pen_x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        tp = TransformPen(pen, (k, 0, 0, -k, x + (pen_x + pos.x_offset) * k, baseline - pos.y_offset * k))
        glyphs[order[info.codepoint]].draw(tp)
        pen_x += pos.x_advance
    return pen.getCommands(), pen_x * k


def lockup(shape, ink):
    mark_h = 40.0
    s = mark_h / HEIGHT
    mark_w = (shape.bounds[2] - shape.bounds[0]) * s
    cap = mark_h / 1.5
    baseline = 12 + mark_h / 2 + cap / 2
    gap = mark_h * 0.42
    d, word_w = word("Markdown", cap, 12 + mark_w + gap, baseline)
    width = 12 + mark_w + gap + word_w + 12
    body = (mark_body(shape, mark_w, "gradient", 12 + mark_w / 2, 32, "ginger-lockup")
            + f'<path d="{d}" fill="{ink}"/>')
    return document(body, f"0 0 {width:.2f} 64", f"{width:.2f}", 64)


def main():
    base = outline()
    small = outline(**SMALL)
    width = 64 * FIELD
    files = {
        "mark.svg": document(mark_body(base, width, "gradient")),
        "mark-small.svg": document(mark_body(small, width, "gradient")),
        "mark-mono.svg": document(mark_body(base, width, "currentColor")),
        "favicon.svg": document(mark_body(small, width, "gradient")),
        "app-icon.svg": document(mark_body(base, width, "gradient"), width=1024, height=1024),
        "lockup.svg": lockup(base, INK_LIGHT),
        "lockup-on-dark.svg": lockup(base, INK_DARK),
    }
    for name, markup in files.items():
        (HERE / name).write_text(markup, encoding="utf-8")
    print("SVG:", ", ".join(files))


if __name__ == "__main__":
    main()
