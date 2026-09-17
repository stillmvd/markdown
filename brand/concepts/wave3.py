import itertools

import wave2
from wave1 import arc, glyph_svg, stroke

WIDTHS = [("узкая", 18, 4), ("как сейчас", 21, 5.5), ("широкая", 25, 7.5)]
WEIGHTS = [("легче", 6), ("как сейчас", 7), ("тяжелее", 8.5)]
VERTICES = [("до середины", 14), ("как сейчас", 20), ("до низа", 28)]
BASE = (1, 1, 1)


def md_heavy(span, dext, w, vy):
    h = w / 2
    right = h + span
    return [stroke([(h, 28), (h, 0), (h + span / 2, vy), (right, 0), (right, 28)], w, cap="butt", join="miter"),
            stroke([(right, h), (right + dext, h)] + arc(right + dext, 14, 14 - h, -90, 90) + [(right, 28 - h)], w,
                   cap="butt", join="miter")]


def combo_items(i, j, k):
    _, span, dext = WIDTHS[i]
    return md_heavy(span, dext, WEIGHTS[j][1], VERTICES[k][1])


def variant_svg(cid, key, in_circle):
    if not key.startswith("c-"):
        return wave2.variant_svg(cid, key, in_circle)
    i, j, k = (int(x) for x in key[2:].split("-"))
    return glyph_svg(combo_items(i, j, k), 58, "#161618", (0, 28), cid)


def key(i, j, k):
    return f"c-{i}-{j}-{k}"


NUMBER = 3
TITLE = "Волна 3 · пропорции и толщина"
PROMPT = ("Доводим B2′. В каждой строке выберите один вариант — сверху сборка сразу покажет сочетание "
          "на светлом и на тёмном. Цвет — в следующей волне.")
CHOSEN = ["ширина как сейчас", "толщина как сейчас", "вершина как сейчас"]

CARDS = [
    ("B2′ · по одному параметру", [
        {"code": "Ширина", "name": "расстояние между ножками M и выступ D", "radio": True,
         "note": "Узкая ближе к квадрату и крупнее на иконке, но просветы M сужаются. Широкая спокойнее и ближе к надписи.",
         "tiles": [(f"ширина {name}", name, key(i, 1, 1), False, i == 1) for i, (name, *_) in enumerate(WIDTHS)]},
        {"code": "Толщина", "name": "вес линии", "radio": True,
         "note": "Легче — больше воздуха в D и в вершине M. Тяжелее — сильнее на 24 px, но просветы закрываются.",
         "tiles": [(f"толщина {name}", name, key(1, j, 1), False, j == 1) for j, (name, _) in enumerate(WEIGHTS)]},
        {"code": "Вершина M", "name": "куда опускается угол", "radio": True,
         "note": "До середины — M спокойная и открытая, до низа — острая V, знак жёстче и заметнее.",
         "tiles": [(f"вершина {name}", name, key(1, 1, k), False, k == 1) for k, (name, _) in enumerate(VERTICES)]},
    ]),
]

SUMMARY = ("Моё мнение: ширина как сейчас — узкая сжимает просветы M в щели, широкая распадается на две буквы; "
           "толщина как сейчас — тяжелее уже закрывает просвет D на 24 px; вершина до низа — острая V "
           "даёт самый узнаваемый силуэт и держится на мелких размерах.")


def preview():
    symbols, combos = [], []
    for i, j, k in itertools.product(range(3), repeat=3):
        cid = f"w3sym-{i}-{j}-{k}"
        symbols.append(f'<symbol id="{cid}" viewBox="0 0 64 64">'
                       f'{glyph_svg(combo_items(i, j, k), 58, "currentColor", (0, 28), cid + "-clip")}</symbol>')

        def use(size=None, cls=""):
            attrs = (f' width="{size}" height="{size}"' if size else "") + (f' class="{cls}"' if cls else "")
            return f'<svg viewBox="0 0 64 64"{attrs} aria-hidden="true"><use href="#{cid}"/></svg>'

        sizes = "".join(f'<span class="size">{use(px)}{px}</span>' for px in (48, 32, 24))
        hidden = "" if (i, j, k) == BASE else " hidden"
        combos.append(f'<div class="build-row" data-combo="{i}-{j}-{k}"{hidden}>'
                      f'<div class="build-tile light">{use(cls="big")}<span class="sizes">{sizes}</span></div>'
                      f'<div class="build-tile dark">{use(cls="big")}<span class="sizes">{sizes}</span></div></div>')
    sprite = f'<svg width="0" height="0" style="position:absolute" aria-hidden="true">{"".join(symbols)}</svg>'
    return f'<div class="build"><h3>Сборка</h3>{sprite}{"".join(combos)}</div>'
