import math
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "wave1"
OUT.mkdir(parents=True, exist_ok=True)
INKSCAPE = "C:/Program Files/Inkscape/bin/inkscape.com"


def arc(cx, cy, r, a0, a1, step=2):
    n = max(2, int(abs(a1 - a0) / step) + 1)
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / (n - 1))),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / (n - 1)))) for i in range(n)]


def stroke(pts, w, cap="round", join="round", closed=False):
    return {"pts": pts, "w": w, "cap": cap, "join": join, "closed": closed}


def bbox(items, clip):
    xs, ys = [], []
    for it in items:
        h = it["w"] / 2
        for x, y in it["pts"]:
            xs += [x - h, x + h]
            ys += [y - h, y + h]
    y0, y1 = min(ys), max(ys)
    if clip:
        y0, y1 = max(y0, clip[0]), min(y1, clip[1])
    return min(xs), y0, max(xs), y1


def path_d(it):
    d = "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in it["pts"])
    return d + (" Z" if it["closed"] else "")


def glyph_svg(items, size, color, clip=None, cid="c"):
    x0, y0, x1, y1 = bbox(items, clip)
    s = size / max(x1 - x0, y1 - y0)
    tx = 32 - s * (x0 + x1) / 2
    ty = 32 - s * (y0 + y1) / 2
    body = "".join(
        f'<path d="{path_d(it)}" stroke="{color}" stroke-width="{it["w"]}" stroke-linecap="{it["cap"]}" '
        f'stroke-linejoin="{it["join"]}" stroke-miterlimit="12"/>' for it in items)
    defs, clip_attr = "", ""
    if clip:
        defs = f'<defs><clipPath id="{cid}"><rect x="-100" y="{clip[0]}" width="300" height="{clip[1] - clip[0]}"/></clipPath></defs>'
        clip_attr = f' clip-path="url(#{cid})"'
    return f'{defs}<g transform="translate({tx:.3f} {ty:.3f}) scale({s:.4f})"><g fill="none"{clip_attr}>{body}</g></g>'


def lines():
    return [stroke([(0, 0), (16, 0)], 7),
            stroke([(0, 11), (30, 11)], 4.2),
            stroke([(0, 20), (26, 20)], 4.2),
            stroke([(0, 29), (19, 29)], 4.2)]


def hash_sign():
    w, sl = 4.6, 5
    return [stroke([(7 + sl, 0), (7, 30)], w),
            stroke([(20 + sl, 0), (20, 30)], w),
            stroke([(0, 9.5), (31, 9.5)], w),
            stroke([(-1, 20.5), (30, 20.5)], w)]


def m_arrow():
    w = 4.6
    return [stroke([(0, 28), (0, 0), (10, 16), (20, 0), (20, 28)], w),
            stroke([(31, 0), (31, 27)], w),
            stroke([(24.5, 20.5), (31, 27), (37.5, 20.5)], w)]


def md_ligature():
    w = 4.2
    return [stroke([(0, 28), (0, 0), (11, 17), (22, 0), (22, 28)], w),
            stroke([(22, 0), (30, 0)] + arc(30, 14, 14, -90, 90) + [(22, 28)], w)]


def md_heavy():
    w = 7
    h = w / 2
    return [stroke([(h, 28), (h, 0), (14, 20), (24.5, 0), (24.5, 28)], w, cap="butt", join="miter"),
            stroke([(35.5, h), (40, h)] + arc(40, 14, 14 - h, -90, 90) + [(35.5, 28 - h)], w,
                   cap="butt", join="miter", closed=True)]


def md_geometric():
    w = 5
    h = w / 2
    return [stroke([(3, 28), (8, 0), (16, 28), (24, 0), (29, 28)], w, cap="butt", join="miter"),
            stroke([(36.5, h), (44, h)] + arc(44, 14, 14 - h, -90, 90) + [(36.5, 28 - h)], w,
                   cap="butt", join="miter", closed=True)]


VARIANTS = [
    ("a1-lines", "Строки", lines, True, None),
    ("a2-hash", "Решётка", hash_sign, True, None),
    ("a3-m-arrow", "M↓", m_arrow, True, None),
    ("b1-ligature", "Лигатура", md_ligature, False, None),
    ("b2-heavy", "Жирные", md_heavy, False, (0, 28)),
    ("b3-geometric", "Геометрия", md_geometric, False, (0, 28)),
]

NUMBER = 1
TITLE = "Волна 1 · направления"
PROMPT = "Отметьте, что вести во вторую волну, — можно несколько. Буквы показаны без подложки и в круге: отмечайте нужную версию."
CHOSEN = ["A1", "A3", "B1 в круге", "B2 без подложки", "B3 без подложки", "B3 в круге"]
GROUPS = [("Глиф в круге", ["a1-lines", "a2-hash", "a3-m-arrow"]),
          ("Буквы MD", ["b1-ligature", "b2-heavy", "b3-geometric"])]
TILES = {key: ([(None, True)] if key.startswith("a") else [("без подложки", False), ("в круге", True)])
         for key, *_ in VARIANTS}
NOTES = {
    "a1-lines": "Лист: короткий жирный заголовок и строки текста. Про чтение честно, но на 24 px это значок «выровнять влево» или меню.",
    "a2-hash": "Знак заголовка Markdown. Держится на всех размерах, но в круге читается как хэштег или канал Slack.",
    "a3-m-arrow": "Знак Markdown, узнаётся сразу. На 24 px цел. Минус — похожий значок у многих редакторов.",
    "b1-ligature": "M и D на общей ножке, одной линией. Самый изящный на крупном размере, на 24 px линия тонет.",
    "b2-heavy": "Тяжёлые прямые ножки, острый угол M. Из букв лучше всех держится на 24 px, но грубоват для читалки.",
    "b3-geometric": "Раскрытая M и круглая D, как у геометрического гротеска. Красиво, но без подложки буквы на 24 px высотой 11 px.",
}
SUMMARY = ("Моё мнение: сильнее всего M↓ в круге и лигатура MD. Строки отбрасываю — это чужой значок. Решётка держится, "
           "но смысл уводит в хэштеги. Буквы без подложки на панели задач мелкие: лигатуру стоит попробовать в круге.")

CARDS = [(title, [{"code": k.split("-")[0].upper(), "name": next(v[1] for v in VARIANTS if v[0] == k),
                     "note": NOTES[k],
                     "tiles": [(k.split("-")[0].upper() + (f" {label}" if label else ""), label, k, circ)
                               for label, circ in TILES[k]]}
                    for k in keys]) for title, keys in GROUPS]

INK = "#161618"
PAPER = "#f4f4f6"


def variant_svg(cid, key, in_circle):
    _, _, fn, _, clip = next(v for v in VARIANTS if v[0] == key)
    items = fn()
    if in_circle:
        size = 38 if key.startswith("a") else 42
        return f'<circle cx="32" cy="32" r="32" fill="{INK}"/>' + glyph_svg(items, size, PAPER, clip, cid)
    return glyph_svg(items, 58, INK, clip, cid)


def main():
    sheet = []
    col_w, big = 150, 128
    tiles = [(key, circ) for key, *_ in VARIANTS for _, circ in TILES[key]]
    for i, (key, circ) in enumerate(tiles):
        name = key + ("-circle" if circ and key.startswith("b") else "")
        (OUT / f"{name}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256">'
            f'{variant_svg(name, key, circ)}</svg>', encoding="utf-8")
        x = 16 + i * col_w
        sheet.append(f'<svg x="{x}" y="16" width="{big}" height="{big}" viewBox="0 0 64 64">{variant_svg(name + "L", key, circ)}</svg>')
        sx = x
        for px in (48, 32, 24):
            sheet.append(f'<svg x="{sx}" y="{160 + (48 - px)}" width="{px}" height="{px}" viewBox="0 0 64 64">{variant_svg(name + str(px), key, circ)}</svg>')
            sx += px + 10
    w = 16 + len(tiles) * col_w
    doc = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="228" viewBox="0 0 {w} 228">'
           f'<rect width="100%" height="100%" fill="#ffffff"/>' + "".join(sheet) + "</svg>")
    (OUT / "sheet.svg").write_text(doc, encoding="utf-8")
    subprocess.run([INKSCAPE, str(OUT / "sheet.svg"), "--export-type=png",
                    f"--export-filename={OUT / 'sheet.png'}", "--export-dpi=96"], check=True,
                   capture_output=True)
    print("ok", OUT / "sheet.png")


if __name__ == "__main__":
    main()
