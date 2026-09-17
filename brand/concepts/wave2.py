import wave1
from wave1 import arc, glyph_svg, stroke, INK, PAPER


def section_lines():
    return [stroke([(0, -3.5), (6, 2.5), (12, -3.5)], 4.6),
            stroke([(19, 0), (33, 0)], 6.5),
            stroke([(19, 10.5), (40, 10.5)], 4),
            stroke([(19, 19.5), (36, 19.5)], 4),
            stroke([(19, 28.5), (29, 28.5)], 4)]


def m_arrow_merged():
    w = 4.6
    return [stroke([(0, 28), (0, 0), (15, 13), (30, 0), (30, 28)], w),
            stroke([(15, 13), (15, 27.5)], w),
            stroke([(9.5, 22), (15, 27.5), (20.5, 22)], w)]


def md_ligature_round():
    w = 4.2
    return [stroke([(0, 28), (0, 0), (10, 17), (20, 0), (20, 28)], w),
            stroke(arc(20, 14, 14, -90, 90), w)]


def md_heavy_ligature():
    w = 7
    h = w / 2
    return [stroke([(h, 28), (h, 0), (14, 20), (24.5, 0), (24.5, 28)], w, cap="butt", join="miter"),
            stroke([(24.5, h), (30, h)] + arc(30, 14, 14 - h, -90, 90) + [(24.5, 28 - h)], w,
                   cap="butt", join="miter")]


def md_slanted_ligature():
    w = 5
    h = w / 2

    def leg_x(y):
        return 24 + 5 * y / 28

    return [stroke([(3, 28), (8, 0), (16, 28), (24, 0), (29, 28)], w, cap="butt", join="miter"),
            stroke([(leg_x(h), h), (33, h)] + arc(33, 14, 14 - h, -90, 90) + [(leg_x(28 - h), 28 - h)], w,
                   cap="butt", join="miter")]


VARIANTS = [
    ("a1-section", "Раздел", section_lines, True, None),
    ("a3-merged", "M со стрелкой", m_arrow_merged, True, None),
    ("b1-round", "Лигатура-полукруг", md_ligature_round, True, None),
    ("b2-ligature", "Жирная лигатура", md_heavy_ligature, False, (0, 28)),
    ("b3-slanted", "Наклонная ножка", md_slanted_ligature, False, (0, 28)),
]


def variant_svg(cid, key, in_circle):
    entry = next((v for v in VARIANTS if v[0] == key), None)
    if entry is None:
        return wave1.variant_svg(cid, key, in_circle)
    _, _, fn, _, clip = entry
    items = fn()
    if in_circle:
        size = 38 if key.startswith("a") else 42
        return f'<circle cx="32" cy="32" r="32" fill="{INK}"/>' + glyph_svg(items, size, PAPER, clip, cid)
    return glyph_svg(items, 58, INK, clip, cid)


NUMBER = 2
TITLE = "Волна 2 · композиция"
PROMPT = ("Меняется только композиция: толщину и пропорции доводим в следующей волне. В каждой карточке — "
          "что было и что стало. Отметьте, что оставить, — можно несколько.")
CHOSEN = ["B2′ без подложки"]

CARDS = [
    ("Глиф в круге", [
        {"code": "A1", "name": "Строки",
         "note": "Стрелка раскрытого раздела у заголовка, строки с отступом — это уже раздел документа, а не «выровнять влево». Но на 24 px стрелка сжимается в галочку, и знак похож на чек-лист.",
         "tiles": [("A1", "было", "a1-lines", True), ("A1′", "стало", "a1-section", True)]},
        {"code": "A3", "name": "M↓",
         "note": "Стрелка вырастает из середины M и уходит вниз: одна фигура вместо двух знаков рядом, уже не общий значок Markdown.",
         "tiles": [("A3", "было", "a3-m-arrow", True), ("A3′", "стало", "a3-merged", True)]},
    ]),
    ("Буквы MD", [
        {"code": "B1", "name": "Лигатура",
         "note": "D — чистый полукруг прямо от общей ножки. Знак плотнее, ближе к квадрату, буквы в круге крупнее.",
         "tiles": [("B1 в круге", "было", "b1-ligature", True), ("B1′ в круге", "стало", "b1-round", True)]},
        {"code": "B2", "name": "Жирные",
         "note": "Те же тяжёлые буквы на общей ножке: знак собран в одну фигуру и не распадается на две буквы.",
         "tiles": [("B2 без подложки", "было", "b2-heavy", False),
                   ("B2′ без подложки", "стало", "b2-ligature", False)]},
        {"code": "B3", "name": "Геометрия",
         "note": "Правая ножка раскрытой M становится ножкой D — буквы сцеплены, D получает наклон.",
         "tiles": [("B3 без подложки", "было, без подложки", "b3-geometric", False),
                   ("B3′ без подложки", "стало, без подложки", "b3-slanted", False),
                   ("B3 в круге", "было, в круге", "b3-geometric", True),
                   ("B3′ в круге", "стало, в круге", "b3-slanted", True)]},
    ]),
]

SUMMARY = ("Моё мнение: A3′ — самый свой из глифов и цел на 24 px. A1′ спасает смысл строк, но на мелких размерах "
           "становится чек-листом — строки я бы закрыл. Из букв B1′ в круге самый спокойный и читальный, "
           "B2′ сильнее всех на панели задач, B3′ в круге — самый характерный, но наклон D спорный.")
